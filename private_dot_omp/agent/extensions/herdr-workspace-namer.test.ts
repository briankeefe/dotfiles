import { expect, test } from "bun:test";
import { classify, uniqueLabel } from "./herdr-workspace-namer";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

test("uses the first prompt for ad-hoc names when OMP has a title", () => {
	expect(classify("can we modify our herdr/omp connector to have better session renaming?", undefined).label)
		.toBe("modify-herdr-omp");
	expect(classify("", "Improve Herdr OMP Session Renaming")).toEqual({
		label: "improve-herdr-omp",
		lock: "adhoc",
	});
	expect(classify("fix the report page", "Retitled After Compaction").label).toBe("fix-report-page");
});

test("names tickets with their IDs and a short issue description", () => {
	expect(classify("execute https://example.invalid/issue/DEMO-101/dashboard-enable-inline-editing-of-price-and-quantity", undefined)).toEqual({
		label: "DEMO-101-inline-editing-price",
		lock: "ticket",
	});
	expect(classify("execute https://example.invalid/issue/DEMO-102/dashboard-inventory-add-stock-count", undefined)).toEqual({
		label: "DEMO-102-stock-count",
		lock: "ticket",
	});
	expect(classify("execute ENG-2629 enable inline editing of payment rates", undefined)).toEqual({
		label: "ENG-2629-inline-editing-payment",
		lock: "ticket",
	});
	expect(classify("work with UTF-8 encoded files", undefined).lock).toBe("adhoc");
});

test("adds a stable workspace suffix only when another workspace has the label", () => {
	const name = "ENG-2629-inline-editing-payment";
	expect(uniqueLabel(name, "w2F", [{ workspace_id: "w2G", label: "other" }])).toBe(name);
	expect(uniqueLabel(name, "w2F", [{ workspace_id: "w2G", label: name }])).toBe(`${name}-w2F`);
	expect(uniqueLabel(name, "w2F", [{ workspace_id: "w2F", label: name }])).toBe(name);
});

test("keeps ticket reviews distinct from development", () => {
	expect(classify("execute pr review https://example.invalid/issue/DEMO-101/task", undefined)).toEqual({
		label: "[review: DEMO-101]",
		lock: "review",
	});
});

test("keeps a chosen label through later prompts, resume, and manual overrides", async () => {
	const dir = mkdtempSync(join(tmpdir(), "herdr-namer-"));
	const socketPath = join(dir, "socket");
	const labels: string[] = [];
	const server = createServer((socket) => {
		socket.once("data", (chunk) => {
			const request = JSON.parse(chunk.toString());
			if (request.method === "workspace.rename") labels.push(request.params.label);
			socket.end(JSON.stringify({
				id: request.id,
				result: request.method === "workspace.list"
					? { workspaces: [{ workspace_id: "w2G", label: "ENG-2629-inline-payment-editing" }] }
					: {},
			}) + "\n");
		});
	});
	await new Promise<void>((resolve) => server.listen(socketPath, resolve));
	const previous = [process.env.HERDR_ENV, process.env.HERDR_SOCKET_PATH, process.env.HERDR_PANE_ID, process.env.HERDR_WORKSPACE_ID];
	process.env.HERDR_ENV = "1";
	process.env.HERDR_SOCKET_PATH = socketPath;
	process.env.HERDR_PANE_ID = "w2F:p1";
	process.env.HERDR_WORKSPACE_ID = "w2F";
	try {
		// The extension snapshots Herdr env at module load, so this test needs a fresh module instance.
		const { default: extension } = await import("./herdr-workspace-namer.ts?runtime");
		const entries: { type: string; customType: string; data: unknown }[] = [];
		const ctx = { hasUI: true, sessionManager: { getBranch: () => entries } };
		const makePi = () => {
			type Handler = (...args: unknown[]) => unknown;
			const handlers = new Map<string, Handler>();
			const pi = {
				on: (name: string, handler: Handler) => handlers.set(name, handler),
				registerCommand: (name: string, command: { handler: Handler }) => handlers.set(name, command.handler),
				appendEntry: (customType: string, data: unknown) => entries.push({ type: "custom", customType, data }),
				getSessionName: () => "Retitled After Compaction",
			};
			// Only the API members used by this extension are needed in the fake.
			extension(pi as unknown as ExtensionAPI);
			return handlers;
		};
		const handlers = makePi();
		await handlers.get("session_start")!({}, ctx);
		await handlers.get("before_agent_start")!({ prompt: "execute https://example.invalid/issue/ENG-2629/model-enable-inline-payment-editing" }, ctx);
		await handlers.get("before_agent_start")!({ prompt: "continue after compact" }, ctx);
		expect(labels).toEqual(["ENG-2629-inline-payment-editing-w2F"]);
		const resumed = makePi();
		await resumed.get("session_start")!({}, ctx);
		expect(labels).toEqual(["ENG-2629-inline-payment-editing-w2F", "ENG-2629-inline-payment-editing-w2F"]);
		await resumed.get("herdr-name")!("my-custom-name", { ui: { notify: () => {} } });
		const again = makePi();
		await again.get("session_start")!({}, ctx);
		expect(labels.at(-1)).toBe("my-custom-name");
	} finally {
		[process.env.HERDR_ENV, process.env.HERDR_SOCKET_PATH, process.env.HERDR_PANE_ID, process.env.HERDR_WORKSPACE_ID] = previous;
		await new Promise<void>((resolve) => server.close(() => resolve()));
		rmSync(dir, { recursive: true });
	}
});
