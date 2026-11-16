import { expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import extension from "./herdr-waiting";

const envKeys = ["HERDR_ENV", "HERDR_SOCKET_PATH", "HERDR_PANE_ID", "OMPCODE"] as const;
type Entry = { type: string; customType: string; data: unknown };
type Handler = (...args: unknown[]) => unknown;

async function harness(insideHerdr = true, nested = false, socketPath = "/isolated-fixture/socket") {
	const previous = envKeys.map(key => process.env[key]);
	Object.assign(process.env, {
		HERDR_ENV: insideHerdr ? "1" : "0",
		HERDR_SOCKET_PATH: socketPath,
		HERDR_PANE_ID: "w-test:p7",
		OMPCODE: nested ? "1" : "0",
	});
	try {
		const handlers = new Map<string, Handler>();
		const calls: { command: string; args: string[] }[] = [];
		const notices: string[] = [];
		const statuses = new Map<string, string | undefined>();
		let entries: Entry[] = [];
		let fail = false;
		// These fakes implement only the extension's context and API surface.
		const ctx = {
			hasUI: true,
			sessionManager: { getBranch: () => entries },
			ui: {
				notify: (message: string) => notices.push(message),
				setStatus: (key: string, text: string | undefined) => statuses.set(key, text),
			},
		} as unknown as ExtensionContext;
		const pi = {
			on: (name: string, handler: Handler) => handlers.set(name, handler),
			registerCommand: (name: string, command: { handler: Handler }) => handlers.set(name, command.handler),
			appendEntry: (customType: string, data: unknown) => entries.push({ type: "custom", customType, data }),
			exec: async (command: string, args: string[]) => {
				calls.push({ command, args });
				return { code: fail ? 1 : 0, stdout: "", stderr: "", killed: false };
			},
		} as unknown as ExtensionAPI;
		extension(pi);
		return {
			handlers, calls, notices, statuses,
			emit: (name: string) => handlers.get(name)?.({}, ctx),
			command: (args: string) => handlers.get("waiting")!(args, ctx),
			branch: () => entries,
			switchTo: (branch: Entry[]) => { entries = branch; },
			fail: () => { fail = true; },
		};
	} finally {
		envKeys.forEach((key, index) => {
			if (previous[index] === undefined) delete process.env[key];
			else process.env[key] = previous[index];
		});
	}
}

test("waiting persists manually, restores per session, and never replaces lifecycle metadata", async () => {
	const h = await harness();
	await h.emit("session_start");
	await h.command("on");
	const waitingBranch = h.branch();
	expect(waitingBranch.at(-1)?.data).toEqual({ waiting: true });
	expect(h.statuses.get("herdr-waiting")).toContain("Waiting on someone else");
	const on = h.calls.at(-1)!;
	expect(on.command).toBe("env");
	expect(on.args).toEqual([
		"HERDR_ENV=1", "HERDR_SOCKET_PATH=/isolated-fixture/socket", "HERDR_PANE_ID=w-test:p7",
		"herdr", "pane", "report-metadata", "w-test:p7", "--source", "omp:waiting",
		"--applies-to-source", "herdr:omp", "--token", "waiting=●",
	]);
	const callCount = h.calls.length;
	await h.emit("before_agent_start");
	await h.emit("agent_start");
	await h.emit("agent_end");
	expect(h.calls).toHaveLength(callCount);
	expect(h.statuses.get("herdr-waiting")).toContain("Waiting on someone else");

	h.switchTo([]);
	await h.emit("session_switch");
	expect(h.statuses.get("herdr-waiting")).toBeUndefined();
	expect(h.calls.at(-1)?.args.slice(-2)).toEqual(["--clear-token", "waiting"]);
	h.switchTo(waitingBranch);
	await h.emit("session_switch");
	expect(h.calls.at(-1)?.args.slice(-2)).toEqual(["--token", "waiting=●"]);
	await h.command("off");
	expect(h.branch().at(-1)?.data).toEqual({ waiting: false });
	await h.emit("session_start");
	expect(h.statuses.get("herdr-waiting")).toBeUndefined();
	await h.command("");
	expect(h.branch().at(-1)?.data).toEqual({ waiting: true });
	await h.command("toggle");
	expect(h.branch().at(-1)?.data).toEqual({ waiting: false });
	const count = h.branch().length;
	await h.command("help");
	await h.command("invalid");
	expect(h.branch()).toHaveLength(count);
	expect(h.notices.at(-1)).toContain("/waiting");
	for (const call of h.calls) {
		expect(call.args).not.toContain("report-agent");
		expect(call.args).not.toContain("--state-label");
		expect(call.args).not.toContain("--title");
		expect(call.args).not.toContain("--display-agent");
	}
});

test("waiting persists without Herdr and nested OMP never writes the parent pane", async () => {
	for (const [inside, nested] of [[false, false], [true, true]]) {
		const h = await harness(inside, nested);
		await h.emit("session_start");
		await h.command("on");
		expect(h.branch().at(-1)?.data).toEqual({ waiting: true });
		expect(h.calls).toHaveLength(0);
		expect(h.notices.at(-1)).toContain("Herdr integration unavailable");
		await h.emit("session_switch");
		expect(h.statuses.get("herdr-waiting")).toContain("Waiting on someone else");
	}
});

test("failed metadata delivery keeps persisted waiting state and reports the failure", async () => {
	const h = await harness();
	h.fail();
	await h.command("on");
	expect(h.branch().at(-1)?.data).toEqual({ waiting: true });
	expect(h.notices.at(-1)).toContain("Herdr integration unavailable");
	expect(h.statuses.get("herdr-waiting")).toContain("Waiting on someone else");
});

