import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

export type PullRequest = {
  url: string;
  number: number;
  repo: string;
  headSha: string;
  draft: boolean;
  state: string;
};
export type Feedback = {
  key: string;
  author: string;
  body: string;
  url: string;
  path?: string;
  line?: number | null;
};
export class ReviewerError extends Error {
  constructor(
    message: string,
    readonly pr: PullRequest,
  ) {
    super(message);
    this.name = "ReviewerError";
  }
}
const exec = promisify(execFile);
async function run(command: string, args: string[], cwd?: string) {
  const result = await exec(command, args, {
    cwd,
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GH_PROMPT_DISABLED: "1", GIT_TERMINAL_PROMPT: "0" },
  });
  return result.stdout.trim();
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid GitHub object");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid GitHub text field");
  return value;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Invalid GitHub connection");
  return value;
}
function metadata(value: unknown): PullRequest {
  const raw = object(value);
  const url = new URL(text(raw.url));
  const match = url.pathname.match(/^\/([^/]+\/[^/]+)\/pull\/(\d+)\/?$/);
  if (
    url.protocol !== "https:" ||
    !match ||
    raw.number !== Number(match[2]) ||
    typeof raw.isDraft !== "boolean" ||
    !["OPEN", "CLOSED", "MERGED"].includes(text(raw.state))
  )
    throw new Error("Invalid GitHub PR metadata");
  return {
    url: url.href,
    number: Number(match[2]),
    repo: match[1],
    headSha: text(raw.headRefOid),
    draft: raw.isDraft,
    state: text(raw.state),
  };
}
const prFields = "url,number,headRefOid,isDraft,state";

export async function publishDraft(options: {
  cwd: string;
  title: string;
  body: string;
  base: string;
  reviewers: string[];
}): Promise<PullRequest> {
  const { cwd, title, body, base, reviewers } = options;
  if (
    !reviewers.length ||
    reviewers.some(
      (login) =>
        !/^[A-Za-z0-9][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9][A-Za-z0-9_.-]*)?$/.test(
          login,
        ),
    )
  )
    throw new Error(
      "Configure valid reviewer user/team logins before publishing",
    );
  if (!title.trim() || !body.trim())
    throw new Error("PR title and verification summary are required");
  await run("git", ["check-ref-format", "--branch", base], cwd);
  const branch = await run("git", ["branch", "--show-current"], cwd);
  if (!branch || ["main", "master", base].includes(branch))
    throw new Error("Publishing requires a dedicated task branch");
  await run("git", ["check-ref-format", "--branch", branch], cwd);
  if (await run("git", ["status", "--porcelain"], cwd))
    throw new Error(
      "Commit the verified changes before publishing; worktree is dirty",
    );
  const origin = await run("git", ["remote", "get-url", "origin"], cwd);
  const remote = new URL(
    origin.replace(/^git@([^:]+):/, "https://$1/").replace(/\.git$/, ""),
  );
  const repoUrl = `https://${remote.hostname}${remote.pathname}`;
  if (!/^\/[^/]+\/[^/]+$/.test(remote.pathname))
    throw new Error("origin must identify a GitHub repository");
  const defaultBranch = await run(
    "gh",
    [
      "repo",
      "view",
      repoUrl,
      "--json",
      "defaultBranchRef",
      "--jq",
      ".defaultBranchRef.name",
    ],
    cwd,
  );
  if (branch === defaultBranch)
    throw new Error("Refusing to publish the repository's default branch");
  const count = Number(
    await run(
      "git",
      ["rev-list", "--count", `refs/remotes/origin/${base}..HEAD`],
      cwd,
    ),
  );
  if (!Number.isFinite(count) || count < 1)
    throw new Error("No task commits against the remote base branch");
  const list = async () =>
    array(
      JSON.parse(
        await run(
          "gh",
          [
            "api",
            `repos${remote.pathname}/pulls`,
            "--hostname",
            remote.hostname,
            "--method",
            "GET",
            "--paginate",
            "--slurp",
            "-f",
            "state=all",
            "-f",
            `head=${remote.pathname.split("/")[1]}:${branch}`,
            "-f",
            "per_page=100",
          ],
          cwd,
        ),
      ),
    )
      .flatMap((page) => array(page))
      .map((value) => {
        const row = object(value);
        const head = object(row.head);
        const state = text(row.state).toUpperCase();
        if (row.merged_at !== null) text(row.merged_at);
        return {
          ...metadata({
            url: row.html_url,
            number: row.number,
            headRefOid: head.sha,
            isDraft: row.draft,
            state: row.merged_at === null ? state : "MERGED",
          }),
          base: text(object(row.base).ref),
          headRepo: head.repo === null ? "" : text(object(head.repo).full_name),
        };
      })
      .filter(
        (item) =>
          item.headRepo.toLowerCase() ===
          remote.pathname.slice(1).toLowerCase(),
      );
  const existing = await list();
  const pr = existing.find((item) => item.state === "OPEN") ?? existing[0];
  if (pr && pr.base !== base)
    throw new Error(`Existing PR targets ${pr.base}, not ${base}: ${pr.url}`);
  if (pr && (pr.state !== "OPEN" || !pr.draft))
    throw new Error(`PR is no longer an open draft: ${pr.url}`);
  await run(
    "git",
    ["push", "--set-upstream", "origin", `HEAD:refs/heads/${branch}`],
    cwd,
  );
  if (!pr) {
    try {
      await run(
        "gh",
        [
          "pr",
          "create",
          "--repo",
          repoUrl,
          "--head",
          branch,
          "--base",
          base,
          "--draft",
          `--title=${title}`,
          `--body=${body}`,
          "--assignee",
          "@me",
        ],
        cwd,
      );
    } catch (error) {
      // A failed response can follow a successful create. Reconcile by read, never retry the mutation.
      const reconciled = (await list()).find(
        (item) => item.state === "OPEN" && item.draft,
      );
      if (!reconciled) throw error;
    }
  }
  const published = (await list()).find((item) => item.state === "OPEN");
  if (!published?.draft || published.base !== base)
    throw new Error(
      "PR changed lifecycle during publication; inspect before continuing",
    );
  try {
    const requested = object(
      JSON.parse(
        await run(
          "gh",
          [
            "pr",
            "view",
            published.url,
            "--json",
            "reviewRequests,latestReviews",
          ],
          cwd,
        ),
      ),
    );
    const known = [
      ...array(requested.reviewRequests).map((value) => {
        const row = object(value);
        return row.__typename === "Team"
          ? `team:${published.repo.split("/")[0]}/${text(row.slug)}`.toLowerCase()
          : `user:${text(row.login)}`.toLowerCase();
      }),
      ...array(requested.latestReviews).flatMap((value) => {
        const author = object(value).author;
        return author === null
          ? []
          : [`user:${text(object(author).login)}`.toLowerCase()];
      }),
    ];
    const missing = reviewers.filter(
      (login) =>
        !known.includes(
          `${login.includes("/") ? "team" : "user"}:${login}`.toLowerCase(),
        ),
    );
    if (missing.length)
      await run(
        "gh",
        [
          "pr",
          "edit",
          published.url,
          ...missing.flatMap((login) => ["--add-reviewer", login]),
        ],
        cwd,
      );
  } catch (error) {
    throw new ReviewerError(
      `Reviewer request failed for ${published.url}: ${String(error)}`,
      published,
    );
  }
  return published;
}

// Native gh pagination owns cursors, including review bodies, issue comments and long inline threads.
async function pages(pr: PullRequest, query: string, fields: string[] = []) {
  const host = new URL(pr.url).hostname;
  const [owner, repo] = pr.repo.split("/");
  const raw = JSON.parse(
    await run("gh", [
      "api",
      "graphql",
      "--hostname",
      host,
      "--paginate",
      "--slurp",
      "-f",
      `query=${query}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `repo=${repo}`,
      "-F",
      `number=${pr.number}`,
      ...fields,
    ]),
  );
  return array(raw).map((value) => {
    const page = object(value);
    if (page.errors)
      throw new Error(`GitHub GraphQL errors: ${JSON.stringify(page.errors)}`);
    return object(page.data);
  });
}
const commentFields = "id author{login __typename} body url updatedAt";
const pageInfo = "pageInfo{hasNextPage endCursor}";

export async function readFeedback(
  pr: PullRequest,
  botLogins: string[] = [],
): Promise<{ pr: PullRequest; feedback: Feedback[] }> {
  const fresh = metadata(
    JSON.parse(await run("gh", ["pr", "view", pr.url, "--json", prFields])),
  );
  if (fresh.repo !== pr.repo || fresh.number !== pr.number)
    throw new Error("Tracked PR identity changed");
  if (fresh.state !== "OPEN" || !fresh.draft)
    return { pr: fresh, feedback: [] };
  const bots = botLogins.map((login) => login.toLowerCase());
  const convert = (value: unknown, kind: string): Feedback[] => {
    const row = object(value);
    if (row.author === null) return [];
    const author = object(row.author);
    const login = text(author.login);
    if (
      author.__typename !== "Bot" &&
      !login.toLowerCase().endsWith("[bot]") &&
      !bots.includes(login.toLowerCase())
    )
      return [];
    const body = text(row.body);
    if (!body.trim() || row.state === "DISMISSED" || row.state === "PENDING")
      return [];
    const id = text(row.id);
    const version = createHash("sha256")
      .update(`${text(row.updatedAt)}:${body}`)
      .digest("hex")
      .slice(0, 16);
    return [
      {
        key: `${kind}:${id}:${version}`,
        author: login,
        body,
        url: text(row.url),
        ...(typeof row.path === "string"
          ? {
              path: row.path,
              line: typeof row.line === "number" ? row.line : null,
            }
          : {}),
      },
    ];
  };
  const feeds = await Promise.all(
    ["reviewThreads", "reviews", "comments"].map(async (connection) => {
      const fields =
        connection === "reviewThreads"
          ? `id isResolved isOutdated comments(first:100){${pageInfo} nodes{${commentFields} path line}}`
          : `${commentFields}${connection === "reviews" ? " state" : ""}`;
      const query = `query($owner:String!,$repo:String!,$number:Int!,$endCursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){${connection}(first:100,after:$endCursor){${pageInfo} nodes{${fields}}}}}}`;
      const results = await pages(fresh, query);
      const rows = results.flatMap((data) =>
        array(
          object(object(object(data.repository).pullRequest)[connection]).nodes,
        ),
      );
      if (connection !== "reviewThreads")
        return rows.flatMap((row) => convert(row, connection));
      const comments = await Promise.all(
        rows.map(async (value) => {
          const thread = object(value);
          if (
            typeof thread.isResolved !== "boolean" ||
            typeof thread.isOutdated !== "boolean"
          )
            throw new Error("Invalid review thread status");
          if (thread.isResolved || thread.isOutdated) return [];
          const connection = object(thread.comments);
          const info = object(connection.pageInfo);
          if (!info.hasNextPage)
            return array(connection.nodes).flatMap((row) =>
              convert(row, "thread"),
            );
          const query = `query($owner:String!,$repo:String!,$number:Int!,$thread:ID!,$endCursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){number}} node(id:$thread){... on PullRequestReviewThread{comments(first:100,after:$endCursor){${pageInfo} nodes{${commentFields} path line}}}}}`;
          const all = await pages(fresh, query, [
            "-f",
            `thread=${text(thread.id)}`,
          ]);
          return all.flatMap((data) =>
            array(object(object(data.node).comments).nodes).flatMap((row) =>
              convert(row, "thread"),
            ),
          );
        }),
      );
      return comments.flat();
    }),
  );
  return { pr: fresh, feedback: feeds.flat() };
}
