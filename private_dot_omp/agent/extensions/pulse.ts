import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { matchesKey, replaceTabs, wrapTextWithAnsi } from "@oh-my-pi/pi-tui";
import { spawnSync } from "node:child_process";

const prompt = `Give a read-only health check of the CURRENT session's actual task, including any work in progress. Do not take actions or call tools. Return ONLY a JSON object with string fields "phase", "progress", "momentum", "evidence", "risk", "next" and a string or null field "steer".
phase: current work stage, with remaining major stages.
progress: approximate fraction or range of the *whole requested outcome* complete, not tokens/time/number of tool calls. Explain the basis briefly; if not estimable say so. Never imply a precise measurement.
momentum: On track / Slow / Stalled, with a concrete reason. Flag repeated searches, repeated failed checks, reversals, scope drift, or waiting without a next action, but do not mistake normal verification or a long-running job for wheel-spinning.
evidence: one concrete completed milestone and one specific remaining gap; distinguish observed facts from inference.
risk: the most material blocker, safety issue, or verification gap; say "None evident" if there is none.
next: the single highest-value next action in the current plan.
steer: null unless the session actually needs USER steering to correct a specific problem. If needed, give one short, ready-to-paste instruction addressed to the working agent. Do not suggest steering just because work remains, and do not ask the agent to ignore safeguards. Do not execute the steer. Keep each field under 180 characters and the steer under 240; be honest about missing visibility.`;

const fields = ["phase", "progress", "momentum", "evidence", "risk", "next"] as const;

export default function (pi: ExtensionAPI) {
	pi.registerCommand("pulse", {
		description: "Check progress, momentum, risks and optional steer (copied to clipboard)",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui" || !ctx.runEphemeralTurn) {
				ctx.ui.notify("Run health requires an interactive session with side turns", "warning");
				return;
			}
			ctx.ui.notify("Checking run health without interrupting the session…", "info");
			const { replyText } = await ctx.runEphemeralTurn({ promptText: prompt, tools: false, dedupeReply: false });
			const report: unknown = JSON.parse(replyText.replace(/^```(?:json)?\s*|\s*```$/g, ""));
			if (!report || typeof report !== "object" ||
				!fields.every(field => typeof (report as Record<string, unknown>)[field] === "string") ||
				!(typeof (report as Record<string, unknown>).steer === "string" || (report as Record<string, unknown>).steer === null)) {
				throw new Error("Run health returned an invalid report; nothing was copied");
			}
			const data = report as Record<(typeof fields)[number], string> & { steer: string | null };
			const steer = data.steer?.trim();
			const copy = steer ? spawnSync("pbcopy", [], { input: steer, encoding: "utf8" }) : null;
			const copyStatus = copy ? (copy.status === 0 ? "Copied to clipboard; paste only if you agree." : "Clipboard copy failed; copy the steer below manually.") : "No steering needed.";
			const lines = [
				"RUN HEALTH", "",
				`Progress  ${data.progress}`, `Phase     ${data.phase}`,
				`Momentum  ${data.momentum}`, "",
				`Evidence  ${data.evidence}`, `Risk      ${data.risk}`,
				`Next      ${data.next}`, "",
				`Steer     ${copyStatus}`,
				...(steer ? [steer] : []), "", "Esc to close",
			];
			await ctx.ui.custom((_tui, _theme, _keys, done) => ({
				render: (width: number) => lines.flatMap(line => wrapTextWithAnsi(replaceTabs(line.replace(/[\x00-\x1f\x7f-\x9f]/g, " ")), Math.max(1, width - 2))),
				handleInput: (key: string) => { if (matchesKey(key, "escape") || matchesKey(key, "enter")) done(undefined); },
			}), { overlay: true });
		},
	});
}
