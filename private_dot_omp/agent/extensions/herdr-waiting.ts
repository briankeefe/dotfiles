// Companion metadata only. Herdr's managed extension retains lifecycle authority.
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const { HERDR_ENV, HERDR_SOCKET_PATH, HERDR_PANE_ID, OMPCODE } = process.env;
	const enabled = HERDR_ENV === "1" && !!HERDR_SOCKET_PATH && !!HERDR_PANE_ID && OMPCODE !== "1";
	let waiting = false;
	let pending: Promise<boolean> = Promise.resolve(true);

	function publish(value: boolean): Promise<boolean> {
		if (!enabled) return Promise.resolve(false);
		const args = [
			`HERDR_ENV=${HERDR_ENV}`, `HERDR_SOCKET_PATH=${HERDR_SOCKET_PATH}`, `HERDR_PANE_ID=${HERDR_PANE_ID}`,
			"herdr", "pane", "report-metadata", HERDR_PANE_ID!, "--source", "omp:waiting",
			"--applies-to-source", "herdr:omp",
			...(value ? ["--token", "waiting=●"] : ["--clear-token", "waiting"]),
		];
		pending = pending.then(async () => {
			try {
				// Pin the inherited socket and pane, never the UI-focused pane.
				const result = await pi.exec("env", args, { timeout: 2000 });
				return result.code === 0 && !result.killed;
			} catch {
				return false;
			}
		});
		return pending;
	}

	async function sync(ctx: ExtensionContext, notify = false) {
		const value = waiting;
		if (ctx.hasUI) {
			ctx.ui.setStatus("herdr-waiting", value
				? "\x1b[38;2;187;154;247m●\x1b[39m Waiting on someone else (/waiting off)"
				: undefined);
		}
		const delivered = await publish(value);
		if (notify || (!delivered && (enabled || value))) {
			ctx.ui.notify(
				`${value ? "Waiting on someone else" : "Waiting marker cleared"}.${delivered ? "" : " Herdr integration unavailable; OMP state saved, sidebar not updated."}`,
				delivered ? "info" : "warning",
			);
		}
	}

	async function restore(_event: unknown, ctx: ExtensionContext) {
		waiting = false;
		const entries = ctx.sessionManager.getBranch();
		for (let i = entries.length - 1; i >= 0; i--) {
			const entry = entries[i];
			if (entry.type !== "custom" || entry.customType !== "herdr-waiting") continue;
			const data = entry.data;
			if (!data || typeof data !== "object" || !("waiting" in data) || typeof data.waiting !== "boolean") continue;
			waiting = data.waiting;
			break;
		}
		await sync(ctx);
	}

	pi.on("session_start", restore);
	pi.on("session_switch", restore);
	pi.registerCommand("waiting", {
		description: "Waiting on someone else: /waiting [on|off|toggle|help] (default: toggle)",
		handler: async (args, ctx) => {
			const action = args.trim().toLowerCase();
			if (!["", "on", "off", "toggle"].includes(action)) {
				ctx.ui.notify("Usage: /waiting [on|off|toggle] (default: toggle). Manual marker until cleared; agent activity is unchanged.", "info");
				return;
			}
			waiting = action === "on" || (action !== "off" && !waiting);
			pi.appendEntry("herdr-waiting", { waiting });
			await sync(ctx, true);
		},
	});
}
