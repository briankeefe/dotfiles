import { test, expect } from "bun:test";
import { mkdtemp, writeFile, rm, realpath, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { createHash } from "node:crypto";
// The override deliberately selects original or edited modules at runtime for red/green checks.
const sourceDirectory = path.resolve(
  process.env.FOREMAN_TEST_SOURCE ??
    path.join(import.meta.dir, "../private_dot_omp/agent/extensions/foreman"),
);
const { attention } = await import(path.join(sourceDirectory, "index.ts"));
const { request, subscribe } = await import(path.join(sourceDirectory, "herdr.ts"));
const githubPath = path.join(sourceDirectory, "github.ts");

// Runs in its own process: environment, module globals, sockets, and native CLI calls stay isolated.
async function cancellationChild(sourceDirectory: string, mode: string) {
  const { default: extension } = await import(path.join(sourceDirectory, "index.ts"));
  const directory = process.env.TEST_DIR!;
  const repo = path.join(directory, "repo");
  const worktree = path.join(directory, "repo-eng-1-primary");
  const socketPath = path.join(directory, "api.sock");
  const controller = new AbortController();
  const calls: string[] = [];
  const publications: Record<string, string>[] = [];
  const sockets = new Set<net.Socket>();
  const native = { workspace: false, started: false };
  const agent = {
    pane_id: "w1:p1",
    agent: "omp",
    agent_status: "idle",
    interactive_ready: true,
    agent_session: { kind: "path", value: path.join(directory, "worker.jsonl") },
    tokens: { foreman_input_at: "" },
  };
  let armed = false;
  let sentinelResponses = 0;
  let sentinelResponse: string | undefined;
  let onSentinel: (() => void) | undefined;
  let workspaceResponse: string | undefined;
  const emit = net.Socket.prototype.emit;
  // Cancel after the real response decoder resolves, before its awaiting continuation runs.
  net.Socket.prototype.emit = function (event: string | symbol, ...args: unknown[]) {
    const result = emit.call(this, event, ...args);
    if (event === "data" && sentinelResponse &&
        String(args[0]).includes(sentinelResponse) && String(args[0]).includes('"agent"')) {
      sentinelResponse = undefined;
      // The sentinel is last in tick(); next event-loop turn follows its promise continuations.
      setImmediate(() => { sentinelResponses++; onSentinel?.(); });
    }
    if (
      mode === "workspace-received" && event === "data" && workspaceResponse &&
      (typeof args[0] === "string" || Buffer.isBuffer(args[0])) && args[0].toString().includes(workspaceResponse) &&
      args[0].toString().includes('"root_pane"')
    ) {
      workspaceResponse = undefined;
      controller.abort();
    }
    return result;
  };
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
    socket.once("data", (chunk) => {
      const input = JSON.parse(chunk.toString());
      calls.push(input.method);
      let result: unknown;
      if (input.method === "ping") result = { type: "pong" };
      else if (input.method === "workspace.create") {
        native.workspace = true;
        result = { root_pane: { pane_id: agent.pane_id } };
        if (mode === "workspace-pending") controller.abort();
        if (mode === "workspace-received") workspaceResponse = input.id;
      } else if (input.method === "agent.start") {
        native.started = true;
        result = { type: "agent_started", agent };
      } else if (input.method === "agent.get") {
        if (mode === "started" || (armed && mode.endsWith("-inspect"))) controller.abort();
        result = { agent: input.params.target === "w1:p2" ? { ...agent, pane_id: "w1:p2", tokens: {} } : agent };
        if (input.params.target === "w1:p2") sentinelResponse = input.id;
      } else if (input.method === "agent.read") {
        if (armed && mode === "read-pending") controller.abort();
        result = { text: "visible worker conversation" };
      } else if (input.method === "agent.prompt") {
        if (armed && mode === "prompt-pending") controller.abort();
        result = { ok: true };
      } else if (input.method === "pane.report_metadata") {
        if (input.params.tokens.foreman_pr) publications.push(input.params.tokens);
        result = { ok: true };
      } else if (input.method === "events.subscribe") {
        socket.write(JSON.stringify({ id: input.id, result: { type: "subscription_started" } }) + "\n");
        return;
      } else {
        socket.end(JSON.stringify({ id: input.id, error: { code: "unexpected", message: input.method } }) + "\n");
        return;
      }
      socket.end(JSON.stringify({ id: input.id, result }) + "\n");
    });
  });
  await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  // Only the schema operations used by this extension are needed at the recording API boundary.
  // Objects validate and strip unknown keys, including when the journal is reloaded.
  type Schema = {
    parse(value: unknown): unknown;
    optional(): Schema;
    nullable(): Schema;
    safeParse(value: unknown): { success: boolean; data?: unknown; error?: unknown };
  };
  const schema = (parse: (value: unknown) => unknown): Schema => ({
    parse,
    optional: () => schema((value) => value === undefined ? undefined : parse(value)),
    nullable: () => schema((value) => value === null ? null : parse(value)),
    safeParse: (value: unknown) => {
      try { return { success: true, data: parse(value) }; }
      catch (error) { return { success: false, error }; }
    },
  });
  const primitive = (kind: string) => schema((value) => {
    if (typeof value !== kind) throw new Error("Expected " + kind);
    return value;
  });
  const zod = {
    string: () => primitive("string"),
    number: () => primitive("number"),
    boolean: () => primitive("boolean"),
    literal: (expected: unknown) => schema((value) => {
      if (value !== expected) throw new Error("Unexpected literal");
      return value;
    }),
    enum: (values: unknown[]) => schema((value) => {
      if (!values.includes(value)) throw new Error("Unexpected enum");
      return value;
    }),
    object: (shape: Record<string, Schema>) => schema((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected object");
      return Object.fromEntries(Object.entries(shape).flatMap(([key, field]) => {
        const parsed = field.parse((value as Record<string, unknown>)[key]);
        return parsed === undefined ? [] : [[key, parsed]];
      }));
    }),
    array: (item: Schema) => schema((value) => {
      if (!Array.isArray(value)) throw new Error("Expected array");
      return value.map((entry) => item.parse(entry));
    }),
    record: (key: Schema, item: Schema) => schema((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected record");
      return Object.fromEntries(Object.entries(value).map(([name, entry]) => [key.parse(name), item.parse(entry)]));
    }),
  };
  const entries = [{
    type: "custom", customType: "dotfiles.foreman",
    data: { version: 1, enabled: true, namespace: "fixture", reviewers: ["fixture-reviewer"], botLogins: [] as string[], staleMinutes: 15, workers: [] as Record<string, unknown>[] },
  }];
  if (mode === "receipts") {
    entries[0].data.workers = ["primary", "sentinel"].map((name, i) => ({
      id: `ENG-1/${name}`, task: "ENG-1", name, sessionName: "ENG-1-fixture",
      socketPath, paneId: `w1:p${i + 1}`, sessionFile: agent.agent_session.value,
      repo, cwd: repo, branch: `foreman/eng-1/${name}`, base: "main", brief: "Receipt lifecycle fixture",
      createdAt: new Date().toISOString(), seenFeedback: [],
    }));
  }
  type Handler = (...args: unknown[]) => Promise<unknown>;
  const events = new Map<string, Handler>();
  const tools = new Map<string, { name: string; execute: Handler }>();
  const commands = new Map<string, { handler: Handler }>();
  let status = { workers: [] as Record<string, unknown>[] };
  const ctx = {
    hasUI: true,
    cwd: repo,
    sessionManager: { getSessionId: () => "fixture", getEntries: () => entries },
    ui: { notify: (text: string) => { if (text.startsWith("{")) status = JSON.parse(text); } },
  };
  extension({
    zod,
    on: (name: string, handler: Handler) => events.set(name, handler),
    registerTool: (tool: { name: string; execute: Handler }) => tools.set(tool.name, tool),
    registerCommand: (name: string, command: { handler: Handler }) => commands.set(name, command),
    appendEntry: (customType: string, data: typeof entries[number]["data"]) => entries.push({ type: "custom", customType, data: structuredClone(data) }),
    setSessionName: async () => {},
    sendMessage: () => {},
    exec: async () => { throw new Error("Unexpected external extension command"); },
  });
  const execute = (params: Record<string, unknown>, signal?: AbortSignal) =>
    tools.get("foreman").execute("fixture-call", params, signal, undefined, ctx);
  const start = { op: "start", task: "ENG-1", repo, base: "main", brief: "Inspect only the isolated fixture." };
  let error: string | undefined;
  try {
    await events.get("session_start")({}, ctx);
    if (mode === "publication") {
      const publish = () => tools.get("foreman_publish").execute("publication", {
        title: "Fixture publication", summary: "Isolated change", verification: "Recording fixture passed",
      }, undefined, undefined, ctx);
      await publish();
      await publish();
      const fixture = await Bun.file(process.env.FOREMAN_FIXTURE!).json();
      await writeFile(process.env.FOREMAN_FIXTURE!, JSON.stringify({ ...fixture, reviewerError: true }));
      await publish().catch((failure: unknown) => { error = String(failure); });
      console.log(JSON.stringify({ publications, error }));
      return;
    }
    if (mode === "receipts") {
      const waitForTick = (count: number) => new Promise<void>((resolve) => {
        const check = () => { if (sentinelResponses >= count) { onSentinel = undefined; resolve(); } };
        onSentinel = check;
        check();
      });
      await waitForTick(2); // subscription reconciliation, then the initial tick
      const published = { url: "https://github.com/example/project/pull/1", number: 1,
        repo: "example/project", headSha: "abc123", draft: true, state: "OPEN" };
      const snapshots: unknown[] = [];
      const cycle = async (receipt: string, draft: boolean, reload = false) => {
        Object.assign(agent.tokens, { foreman_pr: JSON.stringify(published), foreman_pr_receipt: receipt });
        await writeFile(path.join(directory, "github-pr.json"), JSON.stringify({
          url: published.url, number: 1, headRefOid: "abc123", isDraft: draft, state: "OPEN",
        }));
        const count = sentinelResponses + (reload ? 2 : 1);
        if (reload) {
          await events.get("session_shutdown")();
          await events.get("session_switch")({}, ctx);
        } else await commands.get("foreman").handler("on", ctx);
        await waitForTick(count);
        const cli = (await Bun.file(path.join(directory, "commands.jsonl")).text())
          .trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
        snapshots.push({ worker: structuredClone(entries.at(-1).data.workers[0]),
          polls: cli.filter((call) => call.command === "gh" && call.args[0] === "pr").length });
      };
      await cycle("receipt-a", true);
      await cycle("receipt-a", false);
      await cycle("receipt-a", true);
      await cycle("receipt-b", true);
      await cycle("receipt-b", false);
      await cycle("receipt-b", true, true);
      await cycle("receipt-c", true);
      console.log(JSON.stringify({ snapshots }));
      return;
    }
    if (mode.startsWith("read-") || mode.startsWith("prompt-") || mode.startsWith("continue-")) {
      await execute(start);
      calls.length = 0;
      armed = true;
      if (mode.startsWith("continue-")) {
        Object.assign(agent.tokens, { foreman_status: "blocked" });
        if (mode === "continue-dialog") agent.agent_status = "blocked";
        if (mode === "continue-stale") agent.tokens.foreman_input_at = "new-user-input";
        if (mode === "continue-session") agent.agent_session.value = path.join(directory, "different.jsonl");
      }
    }
    if (mode === "preaborted") controller.abort();
    const params = mode.startsWith("read-")
      ? { op: "read", id: "ENG-1/primary" }
      : mode.startsWith("prompt-")
        ? { op: "prompt", id: "ENG-1/primary", text: "Continue the fixture.", observedInputAt: "" }
        : start;
    if (mode.startsWith("continue-")) {
      Object.assign(params, {
        op: mode === "continue-ordinary" ? "prompt" : "continue",
        id: "ENG-1/primary", text: "Auth resolved; continue the assigned ticket.", observedInputAt: "",
        userAuthorization: mode === "continue-missing" ? "" : "can you correct that and continue",
      });
    }
    const pending = execute(params, controller.signal).catch((failure: unknown) => { error = String(failure); });
    if (mode === "fetch") {
      // Cross-process filesystem handoff cannot use this process's fake clock.
      const deadline = Date.now() + 3000;
      while (!(await Bun.file(path.join(directory, "fetch-paused")).exists())) {
        if (Date.now() > deadline) throw new Error("Fixture fetch never paused");
        await Bun.sleep(5);
      }
      controller.abort();
      await writeFile(path.join(directory, "release-fetch"), "");
    }
    await pending;
    const workers = entries.at(-1).data.workers;
    await events.get("session_shutdown")();
    entries.at(-1).data.enabled = false;
    await events.get("session_switch")({}, ctx);
    await commands.get("foreman").handler("status", ctx);
    const cli = (await Bun.file(path.join(directory, "commands.jsonl")).text()).trim()
      .split("\n").filter(Boolean).map((line) => JSON.parse(line));
    console.log(JSON.stringify({
      error, calls, cli, native, workers, reloaded: status.workers,
      worktree: await Bun.file(path.join(worktree, "preserved")).exists(),
    }));
  } finally {
    await events.get("session_shutdown")();
    net.Socket.prototype.emit = emit;
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function cancellationRun(mode: string) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), "foreman-cancel-")));
  try {
    await mkdir(path.join(directory, "repo"));
    await writeFile(path.join(directory, "commands.jsonl"), "");
    const cli = `#!${process.execPath}
import { appendFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
const directory = process.env.TEST_DIR;
const command = path.basename(process.argv[1]);
const args = process.argv.slice(2);
appendFileSync(path.join(directory, "commands.jsonl"), JSON.stringify({command,args}) + "\\n");
if (command === "git") {
  if (args[0] !== "-C") throw new Error("Expected explicit fixture repository");
  const op = args[2];
  if (op === "rev-parse") console.log(args[1]);
  else if (op === "check-ref-format") {}
  else if (op === "fetch") {
    if (process.env.TEST_MODE === "fetch") {
      writeFileSync(path.join(directory, "fetch-paused"), "");
      while (!existsSync(path.join(directory, "release-fetch"))) await Bun.sleep(5);
    }
  } else if (op === "worktree" && args[3] === "add") {
    mkdirSync(args[6]);
    writeFileSync(path.join(args[6], "preserved"), "fixture worktree");
  } else throw new Error("Unexpected git mutation: " + args);
} else if (command === "herdr" && args.join(" ") === "session list --json") {
  console.log(JSON.stringify({sessions:[{name:"ENG-1-fixture",running:true,socket_path:path.join(directory,"api.sock"),session_dir:directory}]}));
} else if (command === "gh" && args[0] === "pr" && args[1] === "view") console.log(await Bun.file(path.join(directory,"github-pr.json")).text());
else if (command === "gh" && args[0] === "api" && args[1] === "graphql") console.log("[]");
else throw new Error("Unexpected CLI: " + command + " " + args);
`;
    await Promise.all(["git", "gh", "herdr"].map((name) =>
      writeFile(path.join(directory, name), mode === "publication" && name !== "herdr" ? fixtureCli : cli, { mode: 0o700 }),
    ));
    await writeFile(path.join(directory, "fixture.json"), JSON.stringify({ pr }));
    const script = path.join(directory, "run.ts");
    await writeFile(script, `import path from "node:path";
import net from "node:net";
import { writeFile } from "node:fs/promises";
await (${cancellationChild.toString()})(${JSON.stringify(sourceDirectory)}, ${JSON.stringify(mode)});
`);
    const child = Bun.spawn([process.execPath, script], {
      env: {
        ...process.env,
        PATH: directory,
        TEST_DIR: directory,
        TEST_MODE: mode,
        FOREMAN_FIXTURE: path.join(directory, "fixture.json"),
        OMP_FOREMAN_WORKER: mode === "publication" ? "ENG-1/primary" : "",
        OMP_FOREMAN_PARENT: "",
        OMP_FOREMAN_REVIEWERS: '["fixture-reviewer"]',
        OMP_FOREMAN_BASE: "main",
        OMP_FOREMAN_AUTO: "",
        HERDR_SOCKET_PATH: mode === "publication" ? path.join(directory, "api.sock") : "",
        HERDR_PANE_ID: mode === "publication" ? "w1:p1" : "",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    // A hung child must not leave a socket/process behind; this is a watchdog, not synchronization.
    const timeout = setTimeout(() => child.kill(), 8000);
    try {
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
      ]);
      if (code !== 0) throw new Error(`Cancellation fixture exited ${code}: ${stderr}\n${stdout}`);
      return JSON.parse(stdout);
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("explicit continuation unblocks an idle worker without weakening prompt safeguards", async () => {
  const continued = await cancellationRun("continue-authorized");
  expect(continued.error).toBeUndefined();
  expect(continued.calls.filter((method: string) => method === "agent.prompt")).toHaveLength(1);
  expect(continued.calls).not.toContain("agent.start");
  expect(continued.calls).not.toContain("workspace.create");
  for (const mode of ["ordinary", "missing", "dialog", "stale", "session"]) {
    const rejected = await cancellationRun(`continue-${mode}`);
    expect(typeof rejected.error).toBe("string");
    expect(rejected.calls).not.toContain("agent.prompt");
    expect(rejected.calls).not.toContain("agent.start");
    expect(rejected.calls).not.toContain("workspace.create");
  }
});

test("cancellation: a pre-aborted request never opens a socket", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "foreman-preabort-"));
  const socketPath = path.join(directory, "api.sock");
  let connections = 0;
  const server = net.createServer((socket) => {
    connections++;
    socket.once("data", (chunk) => {
      const input = JSON.parse(chunk.toString());
      socket.end(JSON.stringify({ id: input.id, result: { ok: true } }) + "\n");
    });
  });
  await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  try {
    await expect(request(socketPath, "workspace.create", {}, 1000, AbortSignal.abort()))
      .rejects.toMatchObject({ code: "aborted" });
    expect(connections).toBe(0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("cancellation: a pre-aborted native tool runs no Git or Herdr operation", async () => {
  const result = await cancellationRun("preaborted");
  expect(typeof result.error).toBe("string");
  expect(result.cli).toEqual([]);
  expect(result.calls).toEqual([]);
  expect(result.workers).toEqual([]);
  expect(result.worktree).toBe(false);
});

test("cancellation: aborting paused fetch prevents worktree, worker, and assignment", async () => {
  const result = await cancellationRun("fetch");
  expect(typeof result.error).toBe("string");
  expect(result.cli.map((call: { args: string[] }) => call.args[2]))
    .toEqual(["rev-parse", "check-ref-format", "fetch"]);
  expect(result.calls).toEqual([]);
  expect(result.workers).toEqual([]);
  expect(result.worktree).toBe(false);
});

test.each(["workspace-pending", "workspace-received", "started"])(
  "cancellation: %s preserves native recovery state without later mutations",
  async (mode) => {
    const result = await cancellationRun(mode);
    expect(typeof result.error).toBe("string");
    expect(result.worktree).toBe(true);
    expect(result.native).toEqual({ workspace: true, started: mode === "started" });
    expect(result.calls).not.toContain("agent.prompt");
    if (mode !== "started") expect(result.calls).not.toContain("agent.start");
    expect(result.workers).toHaveLength(1);
    const worker = result.workers[0];
    expect(worker).toMatchObject({
      id: "ENG-1/primary",
      branch: "foreman/eng-1/primary",
      error: expect.any(String),
    });
    expect(worker.cwd).toMatch(/repo-eng-1-primary$/);
    expect(worker.socketPath).toMatch(/api\.sock$/);
    expect(worker.paneId).toBe(mode === "workspace-pending" ? undefined : "w1:p1");
    expect(worker.delivery).toBeUndefined();
    expect(result.reloaded).toEqual(result.workers);
  },
);

test.each(["read-inspect", "prompt-inspect", "read-pending", "prompt-pending"])(
  "cancellation: %s stops the native operation and retains recovery holds",
  async (mode) => {
    const result = await cancellationRun(mode);
    expect(typeof result.error).toBe("string");
    expect(result.calls).toEqual(
      mode.endsWith("-inspect") ? ["agent.get"] : ["agent.get", mode.startsWith("read") ? "agent.read" : "agent.prompt"],
    );
    expect(result.native).toEqual({ workspace: true, started: true });
    expect(result.worktree).toBe(true);
    expect(result.workers[0].paneId).toBe("w1:p1");
    expect(result.workers[0].sessionFile).toMatch(/worker\.jsonl$/);
    if (mode === "prompt-pending") {
      expect(result.error).toMatch(/uncertain/i);
      expect(result.workers[0].delivery).toMatchObject({
        text: expect.stringContaining("Continue the fixture."),
        error: expect.any(String),
      });
    } else expect(result.workers[0].delivery).toBeUndefined();
    expect(result.reloaded).toEqual(result.workers);
  },
);

test("receipts: same-PR republication resumes polling without replaying old metadata across reload", async () => {
  const { snapshots } = await cancellationRun("receipts");
  expect(snapshots.map((snapshot: { polls: number }) => snapshot.polls)).toEqual([1, 2, 2, 3, 4, 4, 5]);
  expect(snapshots.map((snapshot: { worker: { pr: { draft: boolean } } }) => snapshot.worker.pr.draft))
    .toEqual([true, false, false, true, false, false, true]);
  expect(snapshots[5].worker.prReceipt).toBe("receipt-b");
  expect(snapshots[6].worker.pr.url).toBe(snapshots[0].worker.pr.url);
  expect(snapshots[6].worker.pr.headSha).toBe(snapshots[0].worker.pr.headSha);
});

test("receipts: every publication reports a new receipt, including reviewer failure", async () => {
  const { publications, error } = await cancellationRun("publication");
  expect(typeof error).toBe("string");
  expect(publications.map((tokens: Record<string, string>) => tokens.foreman_status)).toEqual(["ready", "ready", "blocked"]);
  const receipts = publications.map((tokens: Record<string, string>) => tokens.foreman_pr_receipt);
  expect(receipts.every((receipt: string) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(receipt))).toBe(true);
  expect(new Set(receipts).size).toBe(3);
  expect(publications.every((tokens: Record<string, string>) => JSON.parse(tokens.foreman_pr).draft)).toBe(true);
});

// A recording CLI boundary: no test may create a real PR, push a branch, or notify a reviewer.
const fixtureCli = `#!${process.execPath}
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const file = process.env.FOREMAN_FIXTURE;
const fixture = JSON.parse(readFileSync(file, 'utf8'));
const args = process.argv.slice(2);
const command = path.basename(process.argv[1]);
const save = value => writeFileSync(file, JSON.stringify(value));
const out = value => console.log(typeof value === 'string' ? value : JSON.stringify(value));
if (command === 'git') {
  if (args[0] === 'branch') out(fixture.branch ?? 'foreman/ENG-1/primary');
  else if (args[0] === 'status') out(fixture.dirty ? ' M changed.ts' : '');
  else if (args[0] === 'remote') out('git@github.com:example/project.git');
  else if (args[0] === 'rev-list') out('1');
  else if (args[0] === 'push') save({...fixture, pushed:true});
  else if (args[0] !== 'check-ref-format') throw new Error('Unexpected git call: ' + args);
} else if (args[0] === 'repo') out('main');
else if (args[0] === 'pr' && args[1] === 'list') {
  if (fixture.listError) throw new Error('GitHub unavailable');
  // Preserve the old native CLI cap only for regression runs against the original source.
  out(fixture.lookupPages ? fixture.lookupPages.flat().slice(0,30).map(row => ({
    url: row.html_url, number: row.number, headRefOid: row.head?.sha, isDraft: row.draft,
    state: row.merged_at ? 'MERGED' : row.state?.toUpperCase(), baseRefName: row.base?.ref,
    headRepository: row.head?.repo ? {name:row.head.repo.full_name.split('/')[1]} : null,
    headRepositoryOwner: row.head?.repo ? {login:row.head.repo.full_name.split('/')[0]} : null,
  })) : fixture.created ? [fixture.pr] : []);
} else if (args[0] === 'pr' && args[1] === 'create') {
  const updated = {...fixture, created:true, pr:{...fixture.pr,isDraft:args.includes('--draft')}};
  save(updated);
  if (fixture.lostCreateResponse) throw new Error('Connection lost after create');
  out(fixture.pr.url);
} else if (args[0] === 'pr' && args[1] === 'edit') {
  if (fixture.reviewerError) throw new Error('Reviewer service unavailable');
  const reviewers = args.flatMap((arg,i)=>arg === '--add-reviewer' ? [args[i+1]] : []);
  save({...fixture,reviewers});
} else if (args[0] === 'pr' && args[1] === 'view') {
  out(args.includes('reviewRequests,latestReviews') ? {reviewRequests:fixture.requested ?? [],latestReviews:fixture.reviewsByPeople ?? []} : fixture.pr);
} else if (args[0] === 'api') {
  if (!args.includes('--paginate') || !args.includes('--slurp')) throw new Error('Missing native pagination');
  if (args[1] === 'repos/example/project/pulls') {
    if (fixture.listError) throw new Error('GitHub unavailable');
    if (args[args.indexOf('--hostname')+1] !== 'github.com' ||
        args[args.indexOf('--method')+1] !== 'GET' ||
        !args.includes('state=all') || !args.includes('head=example:' + (fixture.branch ?? 'foreman/ENG-1/primary')) ||
        !args.includes('per_page=100')) throw new Error('Invalid REST discovery request');
    const pr = fixture.pr;
    out(fixture.lookupPages ?? [fixture.created ? [{
      html_url:pr.url, number:pr.number, head:{sha:pr.headRefOid,repo:{full_name:pr.headRepositoryOwner.login + '/' + pr.headRepository.name}},
      draft:pr.isDraft, state:pr.state.toLowerCase(), merged_at:pr.state === 'MERGED' ? '2026-01-01T00:00:00Z' : null,
      base:{ref:pr.baseRefName},
    }] : []]);
    process.exit(0);
  }
  if (args[1] !== 'graphql') throw new Error('Unexpected API endpoint');
  const query = args.find(arg=>arg.startsWith('query='));
  const key = query.includes('node(id:') ? 'threadComments' : query.includes('reviewThreads(') ? 'reviewThreads' : query.includes('reviews(') ? 'reviews' : 'comments';
  out(fixture[key]);
} else throw new Error('Unexpected gh call: ' + args);
`;

async function fixtureRun(
  fixture: Record<string, unknown>,
  expression: string,
) {
  const directory = await mkdtemp(path.join(tmpdir(), "foreman-check-"));
  try {
    const file = path.join(directory, "fixture.json");
    await writeFile(file, JSON.stringify(fixture));
    await Promise.all(
      ["gh", "git"].map((command) =>
        writeFile(path.join(directory, command), fixtureCli, { mode: 0o700 }),
      ),
    );
    const script = path.join(directory, "run.ts");
    await writeFile(
      script,
      `import { publishDraft, readFeedback } from ${JSON.stringify(githubPath)};\ntry { console.log(JSON.stringify({result:await (${expression})})); } catch(error) { console.log(JSON.stringify({error:String(error)})); }`,
    );
    const child = Bun.spawn([process.execPath, script], {
      env: {
        ...process.env,
        PATH: directory,
        FOREMAN_FIXTURE: file,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(child.stdout).text();
    expect(await child.exited).toBe(0);
    return {
      ...JSON.parse(output),
      fixture: JSON.parse(await Bun.file(file).text()),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
const pr = {
  url: "https://github.com/example/project/pull/1",
  number: 1,
  headRefOid: "abc123",
  isDraft: true,
  state: "OPEN",
  baseRefName: "main",
  headRepository: { name: "project", nameWithOwner: "" },
  headRepositoryOwner: { login: "example" },
};
const trackedPr = {
  url: pr.url,
  number: 1,
  repo: "example/project",
  headSha: "abc123",
  draft: true,
  state: "OPEN",
};
const publish = `publishDraft({cwd:process.cwd(),title:'Verified change',body:'Checks passed',base:'main',reviewers:['alice','example/backend']})`;
const comment = (id: string, author: string, body: string, kind = "Bot") => ({
  id,
  author: { login: author, __typename: kind },
  body,
  url: `${pr.url}#${id}`,
  updatedAt: "2026-01-01T00:00:00Z",
});
const page = (connection: string, nodes: unknown[]) => ({
  data: { repository: { pullRequest: { [connection]: { nodes } } } },
});

test("waiting and deliberate pauses are not stalls; a real block still needs attention", () => {
  const time = Date.parse("2026-01-01T12:00:00Z");
  const agent = {
    pane_id: "w1:p1",
    agent_status: "working",
    tokens: { foreman_progress_at: "2026-01-01T10:00:00Z" },
  };
  expect(attention(agent, 15, time)).toBe("stale");
  expect(
    attention(
      { ...agent, tokens: { ...agent.tokens, foreman_status: "waiting" } },
      15,
      time,
    ),
  ).toBeUndefined();
  expect(
    attention(
      { ...agent, agent_status: "idle", tokens: { foreman_status: "paused" } },
      15,
      time,
    ),
  ).toBeUndefined();
  expect(
    attention(
      {
        ...agent,
        tokens: { ...agent.tokens, foreman_deadline: "2026-01-01T12:30:00Z" },
      },
      15,
      time,
    ),
  ).toBeUndefined();
  expect(
    attention(
      {
        ...agent,
        agent_status: "blocked",
        tokens: { foreman_status: "waiting" },
      },
      15,
      time,
    ),
  ).toBe("blocked");
});

test("publishes a draft, recovers a lost create response, and requests reviewers rather than assignees", async () => {
  const result = await fixtureRun({ pr, lostCreateResponse: true }, publish);
  expect(result.error).toBeUndefined();
  expect(result.result.draft).toBe(true);
  expect(result.fixture.reviewers).toEqual(["alice", "example/backend"]);
  expect(result.fixture.pushed).toBe(true);
});

test("team requests are distinct from same-named users and deleted reviewers", async () => {
  const result = await fixtureRun(
    {
      pr,
      requested: [{ __typename: "User", login: "backend" }],
      reviewsByPeople: [{ author: null }],
    },
    publish,
  );
  expect(result.error).toBeUndefined();
  expect(result.fixture.reviewers).toContain("example/backend");
});

test("an existing draft targeting another base is rejected before pushing", async () => {
  const result = await fixtureRun(
    { pr: { ...pr, baseRefName: "release" }, created: true },
    publish,
  );
  expect(result.error).toContain("targets release, not main");
  expect(result.fixture.pushed).toBeUndefined();
});

test("publication fails closed before pushing when GitHub lookup fails or PR is already ready", async () => {
  const unavailable = await fixtureRun({ pr, listError: true }, publish);
  expect(unavailable.error).toContain("GitHub unavailable");
  expect(unavailable.fixture.pushed).toBeUndefined();
  const ready = await fixtureRun(
    { pr: { ...pr, isDraft: false }, created: true },
    publish,
  );
  expect(ready.error).toContain("no longer an open draft");
  expect(ready.fixture.pushed).toBeUndefined();
});

test("lookup: origin ready PR beyond the former cap blocks push despite fork rows", async () => {
  const row = { html_url: pr.url, number: 1, head: { sha: "abc123", repo: { full_name: "fork/project" } },
    draft: true, state: "open", merged_at: null, base: { ref: "main" } };
  const result = await fixtureRun({ pr, lookupPages: [
    Array.from({ length: 35 }, (_, i) => ({ ...row, number: i + 2, html_url: `https://github.com/example/project/pull/${i + 2}` })),
    [{ ...row, draft: false, head: { ...row.head, repo: { full_name: "EXAMPLE/Project" } } }],
  ] }, publish);
  expect(result.fixture.pushed).toBeUndefined();
  expect(typeof result.error).toBe("string");
});

test("lookup: malformed pages and rows fail before any push", async () => {
  for (const lookupPages of [[{}], [[{ html_url: pr.url }]]]) {
    const result = await fixtureRun({ pr, lookupPages }, publish);
    expect(typeof result.error).toBe("string");
    expect(result.fixture.pushed).toBeUndefined();
  }
});

test("lookup: deleted head repositories cannot hide an origin draft", async () => {
  const row = { html_url: pr.url, number: 1, head: { sha: "abc123", repo: null },
    draft: false, state: "open", merged_at: null, base: { ref: "main" } };
  const result = await fixtureRun({ pr, lookupPages: [[row], [
    { ...row, draft: true, head: { sha: "abc123", repo: { full_name: "example/project" } } },
  ]] }, publish);
  expect(result.error).toBeUndefined();
  expect(result.result.draft).toBe(true);
  expect(result.fixture.pushed).toBe(true);
});

test("only bot findings are delivered, across pages, excluding resolved/outdated threads", async () => {
  const active = {
    id: "t1",
    isResolved: false,
    isOutdated: false,
    comments: {
      pageInfo: { hasNextPage: false },
      nodes: [
        comment("bot", "reviewer[bot]", "valid"),
        comment("human", "alice", "not automatic", "User"),
      ],
    },
  };
  const fixture = {
    pr,
    reviewThreads: [
      page("reviewThreads", [
        active,
        {
          ...active,
          isResolved: true,
          comments: {
            ...active.comments,
            nodes: [comment("resolved", "bot", "resolved")],
          },
        },
      ]),
      page("reviewThreads", [{ ...active, isOutdated: true }]),
    ],
    reviews: [
      page("reviews", [comment("named", "beans", "configured bot", "User")]),
    ],
    comments: [
      page("comments", []),
      page("comments", [comment("late", "ci[bot]", "later page")]),
    ],
  };
  const expression = `readFeedback(${JSON.stringify(trackedPr)},['beans'])`;
  const result = await fixtureRun(fixture, expression);
  expect(result.error).toBeUndefined();
  expect(
    result.result.feedback.map((item: { body: string }) => item.body),
  ).toEqual(["valid", "configured bot", "later page"]);
  const edited = await fixtureRun(
    {
      ...fixture,
      reviews: [
        page("reviews", [comment("named", "beans", "edited in place", "User")]),
      ],
    },
    expression,
  );
  expect(edited.result.feedback[1].key).not.toBe(result.result.feedback[1].key);
});

test("socket subscriptions deliver metadata and malformed frames fail rather than disappearing", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "foreman-wire-"));
  const socketPath = path.join(directory, "api.sock");
  const received = Promise.withResolvers<Record<string, unknown>>();
  const server = net.createServer((socket) => {
    socket.once("data", (chunk) => {
      const input = JSON.parse(chunk.toString());
      if (input.method === "bad") {
        socket.end("not-json\n");
        return;
      }
      socket.write(
        `${JSON.stringify({ id: input.id, result: { type: "subscription_started" } })}\n`,
      );
      socket.write(
        `${JSON.stringify({ event: "pane_updated", data: { tokens: { summary: "café" } } })}\n`,
      );
    });
  });
  const ready = Promise.withResolvers<void>();
  server.listen(socketPath, ready.resolve);
  await ready.promise;
  try {
    const close = await subscribe(
      socketPath,
      received.resolve,
      received.reject,
    );
    expect(await received.promise).toEqual({
      event: "pane_updated",
      data: { tokens: { summary: "café" } },
    });
    close();
    await expect(request(socketPath, "bad", {})).rejects.toThrow();
  } finally {
    server.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test.each(["running", "stopped"])(
  "launcher preserves a %s foreman without restoring stale native identities",
  async (state) => {
    const stopped = state === "stopped";
    const directory = await realpath(
      await mkdtemp(path.join(tmpdir(), "foreman-launch-")),
    );
    const socketPath = path.join(directory, "api.sock");
    const name = `foreman-${createHash("sha256").update(`default:${directory}`).digest("hex").slice(0, 8)}`;
    const journalDir = path.join(directory, "agent", "foreman-sessions", name);
    await mkdir(journalDir, { recursive: true });
    await writeFile(path.join(journalDir, "launched"), name);
    await writeFile(
      path.join(directory, "herdr"),
      `#!${process.execPath}
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
const old = {name:process.env.TEST_SESSION_NAME,running:process.env.TEST_STATE !== "stopped",socket_path:process.env.TEST_SOCKET,session_dir:process.env.TEST_DIR};
const created = Bun.file(process.env.TEST_DIR + "/created-native");
if (args[1] === "list") {
  const listing = {sessions:[old,...(await created.exists() ? [{...old,name:await created.text(),running:true}] : [])]};
  if (process.env.TEST_HOLD === "1" && !await Bun.file(process.env.TEST_DIR + "/listing-paused").exists()) {
    await Bun.write(process.env.TEST_DIR + "/listing-paused", "");
    while (!await Bun.file(process.env.TEST_DIR + "/release-listing").exists()) await Bun.sleep(5);
  }
  console.log(JSON.stringify(listing));
}
else if (args[0] === "--session" && args[2] === "server") {
  if (args[1] === old.name) throw new Error("Must not restore the old native session");
  await Bun.write(created, args[1]);
  appendFileSync(process.env.TEST_DIR + "/native-names", args[1] + "\\n");
} else if (args[1] === "attach") await Bun.write(process.env.TEST_DIR + "/attached", args[2]);
else process.exit(1);
`,
      { mode: 0o700 },
    );
    const coordinator = {
      pane_id: "w2:p1",
      agent: "omp",
      name: "foreman",
      interactive_ready: true,
      agent_session: {
        kind: "path",
        value: path.join(journalDir, "session.jsonl"),
      },
      tokens: { foreman_role: "coordinator" },
    };
    let starts = 0;
    const server = net.createServer((socket) => {
      socket.once("data", async (chunk) => {
        const input = JSON.parse(chunk.toString());
        const result = await (async () => {
          if (input.method === "ping") return { type: "pong" };
          if (input.method === "session.snapshot")
            return {
              type: "session_snapshot",
              snapshot: {
                agents: stopped && starts === 0
                  ? []
                  : [
                      {
                        pane_id: "w1:p1",
                        agent: null,
                        tokens: { foreman_role: "coordinator" },
                      },
                      coordinator,
                    ],
              },
            };
          if (input.method === "workspace.create")
            return { root_pane: { pane_id: coordinator.pane_id } };
          if (input.method === "agent.start") {
            starts++;
            await writeFile(path.join(directory, "started"), "");
            return { type: "agent_started", agent: coordinator };
          }
          if (input.method === "agent.get") {
            if (
              stopped &&
              !(await Bun.file(path.join(directory, "started")).exists())
            )
              throw new Error("No live agent in the new native session");
            return { type: "agent_info", agent: coordinator };
          }
          if (input.method === "agent.focus") {
            await writeFile(
              path.join(directory, "focused"),
              input.params.target,
            );
            return { type: "agent_info", agent: coordinator };
          }
          throw new Error(`Unexpected native mutation: ${input.method}`);
        })();
        socket.end(`${JSON.stringify({ id: input.id, result })}\n`);
      });
    });
    const ready = Promise.withResolvers<void>();
    server.listen(socketPath, ready.resolve);
    await ready.promise;
    const run = (restart: boolean, hold = false) =>
      Bun.spawn(
        [
          process.execPath,
          path.join(sourceDirectory, "launch.ts"),
          directory,
          ...(restart ? ["--restart"] : []),
        ],
        {
          env: {
            ...process.env,
            OMP_PROFILE: "",
            PATH: directory,
            PI_CODING_AGENT_DIR: path.join(directory, "agent"),
            TEST_SESSION_NAME: name,
            TEST_STATE: state,
            TEST_SOCKET: socketPath,
            TEST_DIR: directory,
            TEST_HOLD: hold ? "1" : "",
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
    try {
      if (stopped) {
        expect(await run(false).exited).toBe(1);
        expect(
          await Bun.file(path.join(directory, "created-native")).exists(),
        ).toBe(false);
      }
      const child = run(stopped, stopped);
      let loserCode: number | undefined;
      let loserError = "";
      if (stopped) {
        try {
          const deadline = Date.now() + 3000;
          while (!await Bun.file(path.join(directory, "listing-paused")).exists()) {
            if (Date.now() > deadline) throw new Error("Launcher never reached listing barrier");
            await Bun.sleep(5);
          }
          const loser = run(true);
          [loserCode, loserError] = await Promise.all([loser.exited, new Response(loser.stderr).text()]);
        } finally {
          await writeFile(path.join(directory, "release-listing"), "");
        }
      }
      expect(await child.exited).toBe(0);
      if (stopped) {
        expect(loserCode).toBe(1);
        expect(loserError).toContain(path.join(journalDir, "launch.lock"));
        expect((await Bun.file(path.join(directory, "native-names")).text()).trim().split("\n")).toHaveLength(1);
        expect(starts).toBe(1);
      }
      const attached = await Bun.file(path.join(directory, "attached")).text();
      expect(attached).toMatch(
        new RegExp(stopped ? `^${name}-[0-9a-f]{8}$` : `^${name}$`),
      );
      expect(await Bun.file(path.join(journalDir, "launched")).text()).toBe(
        attached,
      );
      expect(await Bun.file(path.join(directory, "focused")).text()).toBe(
        "w2:p1",
      );
      expect(await run(false).exited).toBe(0);
      expect(await Bun.file(path.join(directory, "attached")).text()).toBe(attached);
      expect(starts).toBe(stopped ? 1 : 0);
    } finally {
      server.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
