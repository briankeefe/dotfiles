import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

// Plays a sound when the main agent finishes a turn and hands control back.
// session_stop fires exactly once per completed response and never for
// task/subagent sessions, so subagents won't trigger extra dings.
export default function (pi: ExtensionAPI) {
  pi.setLabel("Ding on done");
  pi.on("session_stop", async (_event, ctx) => {
    // Fire-and-forget: don't await playback, so the prompt settles immediately.
    void pi
      .exec("afplay", ["/System/Library/Sounds/Glass.aiff"])
      .catch(() => {});
    if (ctx.hasUI) ctx.ui.notify("Agent finished", "info");
  });
}
