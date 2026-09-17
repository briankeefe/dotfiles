import { test, expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { mirrorWorkerStatus } from "../private_dot_omp/agent/extensions/foreman/view";

test("worker views follow real lifecycle, reject replacement sessions, and clear authority on detach", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "foreman-view-"));
  const socketPath = path.join(directory, "api.sock");
  const connections = new Set<net.Socket>();
  const reports: string[] = [];
  let subscription: net.Socket | undefined;
  let nextReport: ((state: string) => void) | undefined;
  let released = false;
  const agent = { agent: "omp", agent_status: "working", agent_session: { kind: "path", value: "/original.jsonl" } };
  const server = net.createServer((socket) => {
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
    socket.once("data", (chunk) => {
      const input = JSON.parse(chunk.toString());
      let result: unknown = { ok: true };
      if (input.method === "events.subscribe") {
        subscription = socket;
        socket.write(JSON.stringify({ id: input.id, result }) + "\n");
        return;
      }
      if (input.method === "agent.get") result = { agent };
      else if (input.method === "pane.report_agent") {
        expect(input.params.pane_id).toBe("view");
        expect(input.params.source).toBe("herdr:omp");
        expect(input.params.agent_session_path).toBeUndefined();
        reports.push(input.params.state);
        nextReport?.(input.params.state);
      } else if (input.method === "pane.release_agent") {
        if (input.params.agent !== "omp") throw new Error("Missing release agent");
        released = true;
      }
      else if (input.method !== "pane.report_agent_session") throw new Error("Unexpected operation: " + input.method);
      socket.end(JSON.stringify({ id: input.id, result }) + "\n");
    });
  });
  await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  let stop: (() => Promise<void>) | undefined;
  const change = async (update: () => void, expected: string) => {
    const reported = new Promise<string>((resolve) => { nextReport = resolve; });
    update();
    subscription!.write(JSON.stringify({ event: "pane.updated", data: { pane_id: "worker" } }) + "\n");
    expect(await reported).toBe(expected);
    nextReport = undefined;
  };
  try {
    stop = await mirrorWorkerStatus(
      { socket: socketPath, pane: "worker", sessionFile: "/original.jsonl" },
      { socket: socketPath, pane: "view" },
      () => {},
    );
    expect(reports).toEqual(["working"]);
    await change(() => { agent.agent_status = "blocked"; }, "blocked");
    await change(() => { agent.agent_status = "done"; }, "idle");
    await change(() => { agent.agent_status = "working"; }, "working");
    await change(() => { agent.agent_session.value = "/replacement.jsonl"; }, "unknown");
    await change(() => { agent.agent_session.value = "/original.jsonl"; }, "working");
    const lost = new Promise<string>((resolve) => { nextReport = resolve; });
    subscription!.end();
    expect(await lost).toBe("unknown");
    await stop();
    stop = undefined;
    expect(released).toBe(true);
    expect(reports).toEqual(["working", "blocked", "idle", "working", "unknown", "working", "unknown"]);
  } finally {
    await stop?.();
    for (const socket of connections) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}, 10000);
