import { request, subscribe, type AgentInfo } from "./herdr";
import { randomUUID } from "node:crypto";

// Forward the original OMP lifecycle authority, not an inferred screen status.
// Do not copy session identity: restoring this view must not launch a duplicate worker.
const source = "herdr:omp";

export async function mirrorWorkerStatus(
  worker: { socket: string; pane: string; sessionFile: string },
  view: { socket: string; pane: string },
  onError: (error: unknown) => void = console.error,
) {
  if (worker.socket === view.socket && worker.pane === view.pane)
    throw new Error("A worker cannot mirror itself.");
  let stopped = false;
  let ready = false;
  let disconnected = false;
  let dirty = false;
  let active: Promise<void> | undefined;
  // Herdr requires a fresh identity and sequence to activate lifecycle authority.
  // This view-only ID must never identify the original worker transcript.
  const viewSessionId = randomUUID();
  let lastState: string | undefined;
  let seq = Date.now() * 1000;
  const publish = async (state: string) => {
    if (state === lastState) return;
    await request(view.socket, "pane.report_agent", {
      pane_id: view.pane, source, agent: "omp", state, seq: ++seq, agent_session_id: viewSessionId,
    });
    lastState = state;
  };
  const refresh = () => {
    if (stopped) return Promise.resolve();
    dirty = true;
    if (!ready) return Promise.resolve();
    if (active) return active;
    active = (async () => {
      while (dirty && !stopped) {
        dirty = false;
        try {
          if (disconnected) throw new Error("Worker status connection lost.");
          const { agent } = await request<{ agent: AgentInfo }>(worker.socket, "agent.get", { target: worker.pane });
          if (stopped) return;
          if (disconnected || agent.agent !== "omp" || agent.agent_session?.kind !== "path" || agent.agent_session.value !== worker.sessionFile)
            throw new Error("Worker session changed or disconnected; status is unknown.");
          const state = agent.agent_status === "done" ? "idle" : agent.agent_status;
          await publish(["working", "blocked", "idle"].includes(state) ? state : "unknown");
        } catch (error) {
          if (stopped) return;
          onError(error);
          await publish("unknown").catch(onError);
        }
      }
    })().finally(() => { active = undefined; });
    return active;
  };
  const unsubscribe = await subscribe(worker.socket, () => { void refresh(); }, (error) => {
    disconnected = true;
    onError(error);
    void refresh();
  });
  try {
    await request(view.socket, "pane.report_agent_session", {
      pane_id: view.pane, source, agent: "omp", agent_session_id: viewSessionId,
      seq: ++seq, session_start_source: "startup",
    });
  } catch (error) {
    stopped = true;
    unsubscribe();
    throw error;
  }
  ready = true;
  await refresh();
  return async () => {
    stopped = true;
    unsubscribe();
    await active;
    await request(view.socket, "pane.release_agent", { pane_id: view.pane, source, agent: "omp", seq: ++seq });
  };
}

if (import.meta.main) {
  const [sessionName, socket, pane, sessionFile] = process.argv.slice(2);
  const view = { socket: process.env.HERDR_SOCKET_PATH!, pane: process.env.HERDR_PANE_ID! };
  if (process.env.HERDR_ENV !== "1" || !view.socket || !view.pane || !sessionName || !socket || !pane || !sessionFile)
    throw new Error("Usage inside Herdr: bun view.ts SESSION SOCKET PANE SESSION_FILE");
  const stop = await mirrorWorkerStatus({ socket, pane, sessionFile }, view);
  try {
    const child = Bun.spawn(["herdr", "--session", sessionName, "agent", "attach", pane], {
      stdin: "inherit", stdout: "inherit", stderr: "inherit",
      env: { ...process.env, HERDR_AGENT: "omp" },
    });
    process.exitCode = await child.exited;
  } finally {
    await stop();
  }
}
