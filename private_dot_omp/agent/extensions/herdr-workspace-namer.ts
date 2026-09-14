// Auto-names the Herdr workspace after the current OMP task.
//
// Naming rules:
//   - reviewing someone else's work  -> "[review: DRI-1234]" / "[review: PR-1773]" / "[review: <slug>]"
//   - developing a ticket            -> "DRI-1234"
//   - ad-hoc                         -> short kebab slug ("fix-checkout-regression")
//
// This is a hand-written companion to herdr-omp-agent-state.ts. Herdr does NOT
// manage this file, so the integration installer/updater will not overwrite it.
//
// Toggle off with HERDR_NAMER_DISABLE=1. Override manually with /herdr-name <label>.

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { createConnection } from "node:net";

const HERDR_ENV = process.env.HERDR_ENV;
const socketPath = process.env.HERDR_SOCKET_PATH;
const paneId = process.env.HERDR_PANE_ID;
let workspaceId = process.env.HERDR_WORKSPACE_ID;

const REQUEST_TIMEOUT_MS = 800;
const MAX_LABEL_LEN = 64;

function enabled(): boolean {
	return (
		HERDR_ENV === "1" &&
		!!socketPath &&
		!!paneId &&
		process.env.HERDR_NAMER_DISABLE !== "1"
	);
}

/** Fire a newline-delimited JSON-RPC request at the Herdr socket and return the parsed reply. */
function rpc(method: string, params: Record<string, unknown>): Promise<unknown> {
	const { promise, resolve } = Promise.withResolvers<unknown>();
	if (!enabled() || !socketPath) {
		resolve(undefined);
		return promise;
	}

	let buf = "";
	let done = false;
	const socket = createConnection(socketPath);
	const finish = (value: unknown) => {
		if (done) return;
		done = true;
		socket.destroy();
		resolve(value);
	};

	const id = `herdr:namer:${Date.now()}:${Math.random().toString(36).slice(2)}`;
	socket.on("connect", () =>
		socket.write(`${JSON.stringify({ id, method, params })}\n`),
	);
	socket.on("data", (chunk) => {
		buf += chunk.toString();
		try {
			finish(JSON.parse(buf.trim()));
		} catch {
			// partial frame; wait for more data
		}
	});
	socket.on("error", () => finish(undefined));
	socket.on("end", () => finish(undefined));
	const timer = setTimeout(() => finish(undefined), REQUEST_TIMEOUT_MS);
	timer.unref?.();
	return promise;
}

/** Pull result.pane.workspace_id out of a pane.get reply without trusting its shape. */
function extractWorkspaceId(response: unknown): string | undefined {
	if (!response || typeof response !== "object" || !("result" in response)) {
		return undefined;
	}
	const result = response.result;
	if (!result || typeof result !== "object" || !("pane" in result)) {
		return undefined;
	}
	const pane = result.pane;
	if (!pane || typeof pane !== "object" || !("workspace_id" in pane)) {
		return undefined;
	}
	const id = pane.workspace_id;
	return typeof id === "string" && id.length > 0 ? id : undefined;
}

async function resolveWorkspaceId(): Promise<string | undefined> {
	if (workspaceId) return workspaceId;
	if (!paneId) return undefined;
	const id = extractWorkspaceId(await rpc("pane.get", { pane_id: paneId }));
	if (id) workspaceId = id;
	return workspaceId;
}

// --- classification ----------------------------------------------------------

const DRI_RE = /\bDRI[-\s]?(\d{1,6})\b/i;
const PR_URL_RE = /\/pull\/(\d{1,7})\b/i;
const PR_TOKEN_RE = /\bPR[-\s#]?(\d{1,7})\b/i;
const ISSUE_HASH_RE = /(?:^|\s)#(\d{1,7})\b/;
const REVIEW_INTENT_RE = /\b(?:reviewing|review)\b/i;
const STRIP_REVIEW_RE =
	/^\s*(?:execute\s+)?(?:pr\s+review|review\s+pr|reviewing|review)\b[\s:_-]*/i;

const STOP_WORDS: Record<string, true> = {
	the: true, a: true, an: true, to: true, of: true, for: true, and: true,
	or: true, in: true, on: true, at: true, is: true, it: true, this: true,
	that: true, these: true, those: true, please: true, can: true, could: true,
	would: true, should: true, i: true, im: true, we: true, let: true, lets: true,
	help: true, me: true, my: true, our: true, with: true, do: true, does: true,
	need: true, want: true, execute: true, run: true, into: true, from: true,
	about: true, out: true, up: true,
};

function firstLine(text: string): string {
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed) return trimmed;
	}
	return text.trim();
}

/** Lowercase kebab slug. Splits CamelCase (OMP session titles) and drops filler. */
function slugify(text: string, maxWords = 5, maxLen = 36): string {
	const spaced = text
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
	const cleaned = spaced
		.toLowerCase()
		.replace(/https?:\/\/\S+/g, " ")
		.replace(/['’`]/g, "")
		.replace(/[^a-z0-9\s-]/g, " ");
	const allWords = cleaned.split(/\s+/).filter(Boolean);
	const meaningful = allWords.filter((word) => !STOP_WORDS[word]);
	const picked = (meaningful.length > 0 ? meaningful : allWords).slice(0, maxWords);
	// accumulate whole words up to maxLen so the slug never ends mid-word
	const kept: string[] = [];
	for (const word of picked) {
		if ([...kept, word].join("-").length > maxLen) break;
		kept.push(word);
	}
	const chosen = kept.length > 0 ? kept : picked.slice(0, 1);
	const slug = chosen.join("-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, maxLen);
	return slug || "session";
}

type LockKind = "review" | "dri" | "adhoc";

interface Classification {
	label: string;
	lock: LockKind;
}

/** Decide the workspace label for a prompt. sessionName is OMP's auto title, if any. */
function classify(prompt: string, sessionName: string | undefined): Classification {
	const driMatch = prompt.match(DRI_RE);
	const dri = driMatch ? `DRI-${driMatch[1]}` : undefined;

	if (REVIEW_INTENT_RE.test(firstLine(prompt).slice(0, 160))) {
		const prMatch =
			prompt.match(PR_URL_RE) ??
			prompt.match(PR_TOKEN_RE) ??
			prompt.match(ISSUE_HASH_RE);
		const id = dri ?? (prMatch ? `PR-${prMatch[1]}` : undefined);
		const inner = id ?? slugify(prompt.replace(STRIP_REVIEW_RE, ""));
		return { label: `[review: ${inner}]`, lock: "review" };
	}

	if (dri) {
		return { label: dri, lock: "dri" };
	}

	const named = sessionName?.trim();
	const base = named && named.length > 0 ? named : prompt;
	return { label: slugify(base), lock: "adhoc" };
}

// --- extension ---------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	if (!enabled()) return;

	let rootSession = false;
	let lock: LockKind | "manual" | undefined;
	let applied: string | undefined;

	async function apply(rawLabel: string): Promise<boolean> {
		const label = rawLabel.trim().slice(0, MAX_LABEL_LEN).trim();
		if (!label || label === applied) return false;
		const id = await resolveWorkspaceId();
		if (!id) return false;
		await rpc("workspace.rename", { workspace_id: id, label });
		applied = label;
		return true;
	}

	pi.on("session_start", (_event, ctx) => {
		if (ctx.hasUI === true) rootSession = true;
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (!rootSession || ctx.hasUI !== true) return;
		// review / dri / manual names are sticky; ad-hoc keeps tracking the task.
		if (lock === "manual" || lock === "review" || lock === "dri") return;
		const result = classify(event.prompt ?? "", pi.getSessionName());
		lock = result.lock;
		await apply(result.label);
	});

	pi.registerCommand("herdr-name", {
		description: "Set or show the Herdr workspace name (usage: /herdr-name [label])",
		handler: async (args, ctx) => {
			const label = args.trim();
			if (label) {
				lock = "manual";
				const ok = await apply(label);
				ctx.ui.notify(
					ok ? `Workspace named: ${label}` : "Could not rename workspace",
					ok ? "info" : "warning",
				);
			} else {
				ctx.ui.notify(
					applied ? `Workspace: ${applied}` : "No workspace name set yet",
					"info",
				);
			}
		},
	});
}
