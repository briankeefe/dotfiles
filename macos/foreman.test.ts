import { test, expect } from "bun:test";
import { mkdtemp, writeFile, rm, realpath, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { createHash } from "node:crypto";
import { attention } from "../private_dot_omp/agent/extensions/foreman/index";
import {
  request,
  subscribe,
} from "../private_dot_omp/agent/extensions/foreman/herdr";

const githubPath = path.resolve(
  import.meta.dir,
  "../private_dot_omp/agent/extensions/foreman/github.ts",
);

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
  out(fixture.created ? [fixture.pr] : []);
} else if (args[0] === 'pr' && args[1] === 'create') {
  const updated = {...fixture, created:true, pr:{...fixture.pr,isDraft:args.includes('--draft')}};
  save(updated);
  if (fixture.lostCreateResponse) throw new Error('Connection lost after create');
  out(fixture.pr.url);
} else if (args[0] === 'pr' && args[1] === 'edit') {
  const reviewers = args.flatMap((arg,i)=>arg === '--add-reviewer' ? [args[i+1]] : []);
  save({...fixture,reviewers});
} else if (args[0] === 'pr' && args[1] === 'view') {
  out(args.includes('reviewRequests,latestReviews') ? {reviewRequests:fixture.requested ?? [],latestReviews:fixture.reviewsByPeople ?? []} : fixture.pr);
} else if (args[0] === 'api') {
  if (!args.includes('--paginate') || !args.includes('--slurp')) throw new Error('Missing native pagination');
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
        PATH: `${directory}:${process.env.PATH}`,
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
const args = process.argv.slice(2);
const old = {name:process.env.TEST_SESSION_NAME,running:process.env.TEST_STATE !== "stopped",socket_path:process.env.TEST_SOCKET,session_dir:process.env.TEST_DIR};
const created = Bun.file(process.env.TEST_DIR + "/created-native");
if (args[1] === "list") console.log(JSON.stringify({sessions:[old,...(await created.exists() ? [{...old,name:await created.text(),running:true}] : [])]}));
else if (args[0] === "--session" && args[2] === "server") {
  if (args[1] === old.name) throw new Error("Must not restore the old native session");
  await Bun.write(created, args[1]);
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
    const server = net.createServer((socket) => {
      socket.once("data", async (chunk) => {
        const input = JSON.parse(chunk.toString());
        const result = await (async () => {
          if (input.method === "ping") return { type: "pong" };
          if (input.method === "session.snapshot")
            return {
              type: "session_snapshot",
              snapshot: {
                agents: stopped
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
    const run = (restart: boolean) =>
      Bun.spawn(
        [
          process.execPath,
          path.resolve(
            import.meta.dir,
            "../private_dot_omp/agent/extensions/foreman/launch.ts",
          ),
          directory,
          ...(restart ? ["--restart"] : []),
        ],
        {
          env: {
            ...process.env,
            OMP_PROFILE: "",
            PATH: `${directory}:${process.env.PATH}`,
            PI_CODING_AGENT_DIR: path.join(directory, "agent"),
            TEST_SESSION_NAME: name,
            TEST_STATE: state,
            TEST_SOCKET: socketPath,
            TEST_DIR: directory,
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
      const child = run(stopped);
      expect(await child.exited).toBe(0);
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
    } finally {
      server.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
