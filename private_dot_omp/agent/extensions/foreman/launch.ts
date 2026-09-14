import { createHash, randomUUID } from "node:crypto";
import { realpath, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import {
  ensureSession,
  sessions,
  request,
  startWorker,
  type AgentInfo,
} from "./herdr";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(
    "Usage: foreman [directory] [--profile NAME] [--restart]\n\nLaunch or attach to your persistent foreman. --restart creates a fresh Herdr session after the previous session stops, resuming the same OMP journal. Old native sessions are preserved. Workers are never restarted automatically.\n\nIn OMP: /foreman reviewers login,org/team, then describe a Linear task and repository. /foreman status lists preserved assignments. /foreman off pauses monitoring, not workers.",
  );
} else {
  const values = new Map<string, string>();
  for (const [index, arg] of args.entries()) {
    if (arg === "--profile") {
      const profile = args[index + 1];
      if (!profile || !/^[A-Za-z0-9_-]+$/.test(profile))
        throw new Error("--profile requires a profile name");
      values.set("profile", profile);
    } else if (args[index - 1] === "--profile" || arg === "--restart") {
      continue;
    } else if (arg.startsWith("-") || values.has("cwd")) {
      throw new Error("Unknown argument. Use foreman --help.");
    } else values.set("cwd", arg);
  }
  const cwd = await realpath(values.get("cwd") ?? process.cwd());
  const profile =
    values.get("profile") ?? (process.env.OMP_PROFILE || undefined);
  const key = `foreman-${createHash("sha256")
    .update(`${profile ?? "default"}:${cwd}`)
    .digest("hex")
    .slice(0, 8)}`;
  const root = process.env.PI_CONFIG_DIR ?? path.join(homedir(), ".omp");
  const agentDir = profile
    ? path.join(root, "profiles", profile, "agent")
    : (process.env.PI_CODING_AGENT_DIR ?? path.join(root, "agent"));
  const sessionDir = path.join(agentDir, "foreman-sessions", key);
  await mkdir(sessionDir, { recursive: true, mode: 0o700 });
  const markerPath = path.join(sessionDir, "launched");
  const marker = Bun.file(markerPath);
  const recorded = (await marker.exists())
    ? (await marker.text()).trim()
    : undefined;
  if (recorded && !new RegExp(`^${key}(?:-[0-9a-f]{8})?$`).test(recorded))
    throw new Error(
      "Invalid foreman session marker. Inspect it before launching.",
    );
  const previous = (await sessions()).find(
    (session) => session.name === (recorded ?? key),
  );
  const creating = !previous?.running;
  if (creating && (recorded || previous) && !args.includes("--restart"))
    throw new Error(
      "Foreman session is stopped or missing. Inspect it, then use --restart to resume its journal in a fresh native session.",
    );
  // Never restore stale native agent identities or discard their saved terminal state.
  const name =
    creating && (recorded || previous)
      ? `${key}-${randomUUID().slice(0, 8)}`
      : (recorded ?? key);
  if (creating || !recorded)
    await writeFile(markerPath, name, {
      flag: recorded ? "w" : "wx",
      mode: 0o600,
    });
  const socket = await ensureSession(name, cwd);
  const { snapshot } = await request<{ snapshot: { agents: AgentInfo[] } }>(
    socket,
    "session.snapshot",
    {},
  );
  const existing = snapshot.agents.find(
    (agent) =>
      agent.agent === "omp" &&
      (agent.name === "foreman" ||
        agent.tokens?.foreman_role === "coordinator"),
  );
  const paneId = await (async () => {
    if (existing) {
      const { agent } = await request<{ agent: AgentInfo }>(
        socket,
        "agent.get",
        { target: existing.pane_id },
      );
      if (!agent.interactive_ready || !agent.agent_session?.value)
        throw new Error(
          "Foreman is not ready. Inspect its native session; no replacement was launched.",
        );
      return agent.pane_id;
    }
    if (!creating)
      throw new Error(
        "No live foreman found. Inspect and stop its native session before using --restart.",
      );
    const launched = await startWorker(socket, {
      name: "foreman",
      cwd,
      env: {
        OMP_FOREMAN_AUTO: "1",
        OMP_FOREMAN_WORKER: "",
        OMP_FOREMAN_PARENT: "",
        HERDR_NAMER_DISABLE: "1",
        ZDOTDIR: import.meta.dir,
        OMP_FOREMAN_PROFILE: profile ?? "",
        OMP_PROFILE: profile ?? "",
      },
      args: [
        ...(profile ? ["--profile", profile] : []),
        "--no-title",
        "--session-dir",
        sessionDir,
        "--continue",
        "-e",
        path.join(import.meta.dir, "index.ts"),
        "-e",
        path.resolve(import.meta.dir, "../herdr-omp-agent-state.ts"),
      ],
    });
    return launched.paneId;
  })();
  await request(socket, "agent.focus", { target: paneId });
  const client = Bun.spawn(["herdr", "session", "attach", name], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exitCode = await client.exited;
}
