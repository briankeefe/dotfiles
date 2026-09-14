import net from "node:net";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const exec = promisify(execFile);
const safeName = /^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/;

export class HerdrError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly paneId?: string,
  ) {
    super(message);
    this.name = "HerdrError";
  }
}

export type AgentInfo = {
  pane_id: string;
  name?: string;
  agent?: string | null;
  agent_status: string;
  interactive_ready?: boolean;
  agent_session?: { kind: string; value: string } | null;
  tokens?: Record<string, string>;
};
export type StartWorkerResult = { paneId: string };
export type SessionEntry = {
  name: string;
  running: boolean;
  socket_path: string;
  session_dir: string;
};

// Decode UTF-8 across packet boundaries and reject malformed/oversized frames, never silently lose events.
function frames(
  socket: net.Socket,
  receive: (frame: Record<string, unknown>) => void,
  fail: (error: Error) => void,
) {
  const buffers = new Map([[socket, ""]]);
  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => {
    const lines = `${buffers.get(socket)}${chunk}`.split("\n");
    const pending = lines.at(-1)!;
    if (pending.length > 4 * 1024 * 1024) {
      fail(new HerdrError("Herdr frame exceeds 4 MiB"));
      return;
    }
    buffers.set(socket, pending);
    for (const line of lines.slice(0, -1).filter(Boolean)) {
      try {
        if (line.length > 4 * 1024 * 1024)
          throw new Error("Herdr frame exceeds 4 MiB");
        const value: unknown = JSON.parse(line);
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new Error("Invalid Herdr response");
        receive(value as Record<string, unknown>);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        return;
      }
    }
  });
}
function responseError(value: unknown) {
  if (!value || typeof value !== "object")
    return new HerdrError("Invalid Herdr error response");
  return new HerdrError(
    "message" in value && typeof value.message === "string"
      ? value.message
      : "Herdr request failed",
    "code" in value && typeof value.code === "string" ? value.code : undefined,
  );
}

export function request<T = unknown>(
  socketPath: string,
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 5000,
): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  const id = randomUUID();
  const socket = net.createConnection(socketPath);
  const done = new AbortController();
  const finish = (error?: Error, value?: T) => {
    if (done.signal.aborted) return;
    done.abort();
    clearTimeout(timer);
    socket.destroy();
    if (error) reject(error);
    else resolve(value!);
  };
  const timer = setTimeout(
    () =>
      finish(
        new HerdrError(
          `${method} timed out; mutation outcome may be uncertain`,
        ),
      ),
    timeoutMs,
  );
  socket.on("error", finish);
  socket.on("end", () =>
    finish(new HerdrError(`${method}: socket closed before response`)),
  );
  frames(
    socket,
    (frame) => {
      if (frame.id !== id) return;
      if (frame.error) finish(responseError(frame.error));
      else if ("result" in frame) finish(undefined, frame.result as T);
      else finish(new HerdrError("Missing Herdr result"));
    },
    finish,
  );
  socket.on("connect", () =>
    socket.write(`${JSON.stringify({ id, method, params })}\n`),
  );
  return promise;
}

export function subscribe(
  socketPath: string,
  onEvent: (event: Record<string, unknown>) => void,
  onDisconnect: (error: Error) => void,
): Promise<() => void> {
  const { promise, resolve, reject } = Promise.withResolvers<() => void>();
  const id = randomUUID();
  const socket = net.createConnection(socketPath);
  const lifecycle = new Set<string>();
  const close = () => {
    lifecycle.add("closed");
    clearTimeout(timer);
    socket.destroy();
  };
  const fail = (error: Error) => {
    if (lifecycle.has("closed")) return;
    close();
    if (lifecycle.has("ack")) onDisconnect(error);
    else reject(error);
  };
  const timer = setTimeout(
    () => fail(new HerdrError("Herdr subscription acknowledgement timed out")),
    10_000,
  );
  socket.on("error", fail);
  socket.on("end", () =>
    fail(new HerdrError("Herdr subscription disconnected")),
  );
  frames(
    socket,
    (frame) => {
      if (frame.id === id) {
        if (frame.error) {
          fail(responseError(frame.error));
          return;
        }
        if (!frame.result) {
          fail(new HerdrError("Missing Herdr subscription acknowledgement"));
          return;
        }
        lifecycle.add("ack");
        clearTimeout(timer);
        resolve(close);
      } else if ("event" in frame && "data" in frame) onEvent(frame);
    },
    fail,
  );
  socket.on("connect", () =>
    socket.write(
      `${JSON.stringify({
        id,
        method: "events.subscribe",
        params: {
          subscriptions: [
            "pane.created",
            "pane.closed",
            "pane.updated",
            "pane.exited",
            "pane.agent_detected",
            "workspace.closed",
          ].map((type) => ({ type })),
        },
      })}\n`,
    ),
  );
  return promise;
}

export async function sessions(): Promise<SessionEntry[]> {
  const { stdout } = await exec("herdr", ["session", "list", "--json"], {
    timeout: 10_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const result: unknown = JSON.parse(stdout);
  if (
    !result ||
    typeof result !== "object" ||
    !("sessions" in result) ||
    !Array.isArray(result.sessions)
  )
    throw new HerdrError("Invalid Herdr session listing");
  return result.sessions.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("name" in entry) ||
      typeof entry.name !== "string" ||
      !("running" in entry) ||
      typeof entry.running !== "boolean" ||
      !("socket_path" in entry) ||
      typeof entry.socket_path !== "string" ||
      !("session_dir" in entry) ||
      typeof entry.session_dir !== "string"
    )
      throw new HerdrError("Invalid Herdr session entry");
    return {
      name: entry.name,
      running: entry.running,
      socket_path: entry.socket_path,
      session_dir: entry.session_dir,
    };
  });
}

export async function ensureSession(
  name: string,
  cwd: string,
): Promise<string> {
  if (!safeName.test(name))
    throw new HerdrError(
      "Herdr session name must be 1–63 alphanumeric/hyphen/underscore characters",
    );
  const existing = (await sessions()).find((session) => session.name === name);
  if (existing?.running) {
    await request(existing.socket_path, "ping", {});
    return existing.socket_path;
  }
  if (existing)
    throw new HerdrError(
      `Session ${name} is stopped. Explicit --restart or /foreman resume approval required.`,
      "session_stopped",
    );
  const child = spawn("herdr", ["--session", name, "server"], {
    cwd,
    detached: true,
    stdio: "ignore",
  });
  const failures = new Map<string, Error>();
  child.on("error", (error) => failures.set("error", error));
  child.on("exit", (code) => {
    if (code)
      failures.set(
        "error",
        new HerdrError(`Herdr server exited ${code}; inspect ${name}`),
      );
  });
  child.unref();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (failures.has("error")) throw failures.get("error");
    const ready = (await sessions()).find(
      (session) => session.name === name && session.running,
    );
    if (ready) {
      try {
        await request(ready.socket_path, "ping", {}, 1000);
        return ready.socket_path;
      } catch {
        /* The server may be listed before its socket accepts requests. */
      }
    }
    await Bun.sleep(100);
  }
  throw new HerdrError(
    `Timed out starting ${name}. Inspect the native session; do not blindly start another.`,
  );
}

export async function startWorker(
  socketPath: string,
  options: {
    name: string;
    cwd: string;
    env: Record<string, string>;
    args: string[];
  },
): Promise<StartWorkerResult> {
  if (!safeName.test(options.name)) throw new HerdrError("Invalid worker name");
  const result = await request<{ root_pane: { pane_id: string } }>(
    socketPath,
    "workspace.create",
    {
      cwd: options.cwd,
      env: options.env,
      label: options.name,
      focus: false,
    },
  );
  const paneId = result.root_pane?.pane_id;
  if (typeof paneId !== "string")
    throw new HerdrError(
      "Workspace creation returned no pane ID; inspect native session before retrying",
    );
  try {
    await request(
      socketPath,
      "agent.start",
      {
        name: options.name,
        kind: "omp",
        pane_id: paneId,
        args: options.args,
        timeout_ms: 60_000,
      },
      65_000,
    );
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const { agent } = await request<{ agent: AgentInfo }>(
        socketPath,
        "agent.get",
        { target: paneId },
      );
      if (agent.agent_session?.kind === "path" && agent.interactive_ready)
        return { paneId };
      await Bun.sleep(100);
    }
    throw new HerdrError(
      "OMP started but its persisted session reference is not ready; inspect the pane",
    );
  } catch (error) {
    throw new HerdrError(
      String(error),
      error instanceof HerdrError ? error.code : undefined,
      paneId,
    );
  }
}
