import { expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import type { AssistantMessage, StopReason } from "@oh-my-pi/pi-ai";
import { classifyExecutePrompt, parseAssessment, register, type Snapshot } from "./index";

const assessment = {
	phase: "verify", objective: "Verify addition", criteria: [{ text: "Addition works", status: "verified", evidence: "T1.0: 1 pass, 0 fail" }],
	eliminated: ["The addition operator was wrong"], newEvidence: true, stalled: false,
	confidence: "medium", progressLow: 60, progressHigh: 80, stallReason: "", nextExperiment: "Run the boundary check",
};
const usage = { input: 100, output: 200, cacheRead: 300, cacheWrite: 50, totalTokens: 650, cost: { input: 0, output: 0.01, cacheRead: 0, cacheWrite: 0, total: 0.01 } };
const reply = (text = JSON.stringify(assessment), stopReason: StopReason = "stop"): AssistantMessage => ({
	role: "assistant", api: "openai-codex-responses", provider: "test", model: "small", timestamp: Date.now(),
	content: [{ type: "text", text }], usage, stopReason,
});
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function harness(assess: Parameters<typeof register>[1]) {
	type Handler = (event: unknown, ctx: ExtensionContext) => unknown;
	const handlers = new Map<string, Handler>();
	const entries: { type: "custom"; customType: string; data: Snapshot | null }[] = [];
	const messages: { message: Parameters<ExtensionAPI["sendMessage"]>[0]; options: Parameters<ExtensionAPI["sendMessage"]>[1] }[] = [];
	const notices: string[] = [];
	let widget: string[] | undefined;
	let idle = true;
	let model: { provider: string; id: string } | undefined = { provider: "test", id: "small" };
	let command: ((args: string, ctx: ExtensionContext) => Promise<void>) | undefined;
	const pi = {
		on: (name: string, handler: Handler) => handlers.set(name, handler),
		registerCommand: (_name: string, definition: { handler: (args: string, ctx: ExtensionContext) => Promise<void> }) => { command = definition.handler; },
		appendEntry: (customType: string, data: Snapshot | null) => entries.push({ type: "custom", customType, data: structuredClone(data) }),
		sendMessage: (message: Parameters<ExtensionAPI["sendMessage"]>[0], options: Parameters<ExtensionAPI["sendMessage"]>[1]) => messages.push({ message, options }),
	};
	const ctx = {
		agent: { kind: "main" }, hasUI: true, mode: "tui", isIdle: () => idle,
		ui: { setWidget: (_key: string, value: string[] | undefined) => { widget = value; }, notify: (message: string) => notices.push(message), theme: { fg: (_color: string, text: string) => text } },
		sessionManager: { getBranch: () => entries },
		models: { resolve: () => model },
		modelRegistry: { getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "test" }) },
	};
	// This controlled fixture supplies exactly the API/context members used by the extension.
	const api = pi as unknown as ExtensionAPI;
	const context = ctx as unknown as ExtensionContext;
	register(api, assess);
	const emit = async (name: string, event: unknown = {}) => { await handlers.get(name)?.(event, context); await flush(); };
	return {
		emit, entries, messages, notices, ctx,
		get widget() { return widget; },
		get snapshot() { const snapshot = entries.at(-1)?.data; if (!snapshot) throw new Error("Expected tracked task"); return snapshot; },
		command: async (args: string) => { await command!(args, context); await flush(); },
		setIdle: (value: boolean) => { idle = value; },
		setModel: (value: { provider: string; id: string } | undefined) => { model = value; },
		turn: async (n: number, output = "1 pass, 0 fail", stopReason: StopReason = "toolUse") => {
			const message = { ...reply("Investigating addition", stopReason), content: [{ type: "toolCall", id: `call${n}`, name: "bash", arguments: { command: "bun test" } }] };
			await emit("message_end", { message });
			await emit("turn_end", { turnIndex: n, message, toolResults: [{ role: "toolResult", toolCallId: `call${n}`, toolName: "bash", isError: false, content: [{ type: "text", text: output }] }] });
		},
	};
}

test("tracks implementation invocations but keeps follow-ups and clears read-only execute routes", () => {
	for (const prompt of ["execute ENG-1", "/execute ENG-1", "/skill:execute ENG-1", "Run the `execute` toolkit for: `ENG-1`\n\nRead `skill://execute`, route it.", '[IMPORTANT: User invoked the "execute" skill; follow its instructions. Full skill below.]\nbody\n[Skill directory: /tmp/execute]\nResolve relative paths.\nUser: ENG-1']) {
		expect(classifyExecutePrompt(prompt)).toEqual({ task: "ENG-1" });
	}
	for (const args of ["", "help", "pr summary", "pr review https://example.com/pull/1", "ops health", "https://github.com/org/repo/pull/12", "local-repro ENG-1", "docs API", "init project demo"]) {
		expect(classifyExecutePrompt(`execute ${args}`)).toBe("other-execute");
	}
	for (const args of ["update-pr", "shepherd-pr", "e2e test checkout"]) expect(classifyExecutePrompt(`execute ${args}`)).toEqual({ task: args });
	expect(classifyExecutePrompt("also check the logs")).toBeUndefined();
});

test("rejects malformed estimates and downgrades uncited verification", () => {
	expect(parseAssessment(JSON.stringify(assessment)).ok).toBe(true);
	expect(parseAssessment("```json\n" + JSON.stringify(assessment) + "\n```").ok).toBe(true);
	for (const value of ["", "not JSON", JSON.stringify({ ...assessment, progressHigh: 10 }), JSON.stringify({ ...assessment, stalled: "yes" }), JSON.stringify({ ...assessment, confidence: 0.9 })]) {
		expect(parseAssessment(value).ok).toBe(false);
	}
	const missing = parseAssessment(JSON.stringify({ ...assessment, criteria: [{ text: "Works", status: "verified", evidence: "" }] }));
	expect(missing.ok && missing.value.criteria[0].status).toBe("unknown");
});

test("keeps the persistent widget compact while retaining diagnostics on demand", async () => {
	let response = reply();
	const h = harness(async () => response);
	await h.emit("before_agent_start", { prompt: `execute ${"long task ".repeat(20)}` });
	const compact = () => {
		expect(h.widget).toHaveLength(1);
		expect(h.widget![0].length).toBeLessThanOrEqual(80);
	};
	compact();
	await h.turn(1);
	await h.command("check"); await flush();
	compact();
	expect(h.widget![0]).toContain("60-80%");
	expect(h.widget![0]).toContain("verify");
	response = reply(JSON.stringify({ ...assessment, stalled: true, stallReason: "Repeating the basic check" }));
	await h.command("check"); await flush();
	compact();
	expect(h.widget![0]).toContain("possible churn");
	response = reply("provider unavailable", "error");
	await h.command("check"); await flush();
	compact();
	expect(h.widget![0]).toContain("assessor error");
	await h.command("status");
	const details = h.notices.at(-1)!;
	expect(details).toContain('"uncachedIn":150');
	expect(details).toContain('"failures":1');
	expect(details).toContain("Repeating the basic check");
	expect(details).toContain("Run the boundary check");
});

test("counts real usage, bounds concurrent assessments, and discards compaction-stale results without losing spend", async () => {
	const pending = Promise.withResolvers<AssistantMessage>();
	let calls = 0;
	const h = harness(async () => { calls++; return pending.promise; });
	await h.emit("before_agent_start", { prompt: "execute ENG-1" });
	for (let n = 1; n <= 8; n++) await h.turn(n);
	expect(calls).toBe(1);
	await h.command("check");
	expect(calls).toBe(1);
	await h.emit("session_compact");
	pending.resolve(reply());
	await flush(); await flush();
	expect(h.snapshot.last).toBeUndefined();
	expect(h.snapshot.assess.discarded).toBe(1);
	expect(h.snapshot.assess.input).toBe(150);
	expect(h.snapshot.main).toMatchObject({ turns: 8, output: 1600, uncachedIn: 1200, cacheRead: 2400 });
	expect(h.snapshot.assess.cost).toBe(0.01);
});

test("keeps accepted evidence through failures, excludes invented citations, and stays off without model calls", async () => {
	let response = reply();
	let calls = 0;
	const h = harness(async () => { calls++; return response; });
	await h.emit("before_agent_start", { prompt: "execute ENG-2" });
	await h.turn(1);
	await h.command("check"); await flush();
	expect(h.snapshot.last.criteria[0].status).toBe("verified");
	const accepted = structuredClone(h.snapshot.last);
	response = reply("provider unavailable", "error");
	await h.command("check"); await flush();
	expect(h.snapshot.last).toEqual(accepted);
	expect(h.snapshot.assess.failures).toBe(1);
	response = reply(JSON.stringify({ ...assessment, criteria: [{ ...assessment.criteria[0], evidence: "T999.0: 10 pass" }] }));
	await h.command("check"); await flush();
	expect(h.snapshot.last.criteria[0].status).toBe("unknown");
	await h.emit("before_agent_start", { prompt: "also check the logs" });
	expect(h.snapshot.task).toBe("ENG-2");
	await h.command("off");
	const before = calls;
	for (let n = 2; n <= 22; n++) await h.turn(n);
	await h.command("check");
	expect(calls).toBe(before);
	expect(h.widget).toBeUndefined();
	await h.command("on");
	h.setModel(undefined);
	await h.command("check"); await flush();
	expect(h.snapshot.assess.failures).toBe(2);
	expect(calls).toBe(before);
	await h.emit("before_agent_start", { prompt: "execute help" });
	expect(h.widget).toBeUndefined();
});

test("nudges only on request, never resumes idle work, and resets tasks without accepting old results", async () => {
	let response: Promise<AssistantMessage> | AssistantMessage = reply(JSON.stringify({ ...assessment, newEvidence: false, stalled: true, stallReason: "Repeating the basic check" }));
	const h = harness(async () => response);
	await h.emit("before_agent_start", { prompt: "execute ENG-3" });
	await h.turn(1);
	await h.command("check"); await flush();
	expect(h.snapshot.last.stalled).toBe(true);
	expect(h.messages).toHaveLength(0);
	await h.command("nudge");
	expect(h.messages[0].options).toEqual({ deliverAs: "steer" });
	expect(h.messages[0].message.attribution).toBe("user");
	const pending = Promise.withResolvers<AssistantMessage>();
	response = pending.promise;
	await h.command("check");
	await h.emit("before_agent_start", { prompt: "execute ENG-4" });
	pending.resolve(reply()); await flush(); await flush();
	expect(h.snapshot.task).toBe("ENG-4");
	expect(h.snapshot.last).toBeUndefined();
	expect(h.snapshot.assess.calls).toBe(0);
	await h.emit("session_switch", { reason: "new" });
	expect(h.widget).toBeUndefined();
});

test("resume preserves counters, abort invalidates an assessment, and subagents cannot change the tracker", async () => {
	const pending = Promise.withResolvers<AssistantMessage>();
	const h = harness(async () => pending.promise);
	await h.emit("before_agent_start", { prompt: "execute ENG-5" });
	await h.turn(1);
	await h.emit("session_start");
	expect(h.snapshot.main.turns).toBe(1);
	await h.command("check");
	await h.turn(2, "interrupted", "aborted");
	pending.resolve(reply()); await flush(); await flush();
	expect(h.snapshot.last).toBeUndefined();
	expect(h.snapshot.assess.discarded).toBe(1);
	expect(h.snapshot.main.turns).toBe(2);
	h.ctx.agent.kind = "sub";
	await h.emit("before_agent_start", { prompt: "execute ENG-6" });
	expect(h.snapshot.task).toBe("ENG-5");
});

test("agent claims and unrelated tool failures cannot manufacture progress or reset the evidence gap", async () => {
	const h = harness(async () => reply(JSON.stringify({
		...assessment, criteria: [{ text: "Addition works", status: "unknown", evidence: "" }],
		eliminated: [], newEvidence: true, progressLow: 10, progressHigh: 20,
	})));
	await h.emit("before_agent_start", { prompt: "execute ENG-7" });
	await h.turn(1, "unrelated service is unavailable");
	await h.command("check"); await flush();
	expect(h.snapshot.last?.newEvidence).toBe(false);
	expect(h.snapshot.last?.progressHigh).toBe(0);
	expect(h.snapshot.gap.turns).toBe(1);
});
