import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

type Player = readonly [command: string, args: readonly string[]];

const PLAYERS: readonly Player[] = [
  ["paplay", ["/usr/share/sounds/freedesktop/stereo/complete.oga"]],
  ["canberra-gtk-play", ["-i", "complete"]],
  ["afplay", ["/System/Library/Sounds/Glass.aiff"]],
];

async function playDoneSound(pi: ExtensionAPI) {
  for (const [command, args] of PLAYERS) {
    try {
      await pi.exec(command, [...args]);
      return;
    } catch {
      // Try next platform-specific player.
    }
  }
}

// Plays a sound when the main agent finishes a turn and hands control back.
// session_stop fires exactly once per completed response and never for
// task/subagent sessions, so subagents won't trigger extra dings.
export default function (pi: ExtensionAPI) {
  pi.setLabel("Ding on done");
  pi.on("session_stop", async (_event, ctx) => {
    void playDoneSound(pi);
    if (ctx.hasUI) ctx.ui.notify("Agent finished", "info");
  });
}
