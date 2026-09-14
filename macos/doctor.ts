#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

type Check = {
  label: string;
  status: "OK" | "MISSING" | "MANUAL";
  detail: string;
};
type Requirement = { runtime: string; version: string; source: string };
const check = (label: string, ok: boolean, detail: string): Check => ({
  label,
  status: ok ? "OK" : "MISSING",
  detail,
});
const manual = (label: string, detail: string): Check => ({
  label,
  status: "MANUAL",
  detail,
});
const text = (file: string): string | null => {
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return null;
  }
};
const entries = (directory: string): string[] => {
  try {
    return readdirSync(directory);
  } catch {
    return [];
  }
};
const real = (file: string): string | null => {
  try {
    return realpathSync(file);
  } catch {
    return null;
  }
};
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";

export function coerceToSemver(value: string): string | null {
  const match = value
    .trim()
    .match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?([+-][\w.-]+)?$/);
  return match
    ? `${match[1]}.${match[2] ?? "0"}.${match[3] ?? "0"}${match[4] ?? ""}`
    : null;
}

// Unsupported aliases/PEP 440 operators stay unverified, never a false pass.
export function versionSatisfies(
  actual: string,
  required: string,
): boolean | null {
  const version = coerceToSemver(actual);
  const range = required.trim().replace(/,\s*/g, " ");
  const token =
    /^(?:(?:>=|<=|>|<|=|~|\^)?v?\d+(?:\.(?:\d+|x|X|\*)){0,2}(?:-[\w.-]+)?|\*|-)$/;
  if (
    !version ||
    !range ||
    !range.split("||").every(
      (part) =>
        part.trim() &&
        part
          .trim()
          .split(/\s+/)
          .every((word) => token.test(word)),
    )
  )
    return null;
  try {
    return Bun.semver.satisfies(version, range);
  } catch {
    return null;
  }
}

export function probe(command: string, args: string[], timeout = 8000) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      HOMEBREW_NO_AUTO_UPDATE: "1",
      AWS_PAGER: "",
      AWS_EC2_METADATA_DISABLED: "true",
      COREPACK_ENABLE_NETWORK: "0",
      COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
      YARN_ENABLE_NETWORK: "0",
    },
  });
  return {
    ok: result.status === 0 && !result.error,
    out: (result.stdout ?? "").trim(),
    err: (result.stderr ?? "").trim(),
  };
}

export function inspectProject(directory: string): {
  requirements: Requirement[];
  issues: string[];
  compose: boolean;
} {
  const files = [
    ["node", ".nvmrc"],
    ["node", ".node-version"],
    ["python", ".python-version"],
    ["java", ".java-version"],
  ];
  const pins = files.flatMap(([runtime, source]) => {
    const version = text(join(directory, source));
    return version ? [{ runtime, version, source }] : [];
  });
  const tools = (text(join(directory, ".tool-versions")) ?? "")
    .split("\n")
    .flatMap((line) => {
      const [tool, ...versions] = line.replace(/#.*/, "").trim().split(/\s+/);
      return tool
        ? [
            {
              runtime: tool === "nodejs" ? "node" : tool,
              version: versions.join(" "),
              source: ".tool-versions",
            },
          ]
        : [];
    });
  const pkg = (() => {
    const data = text(join(directory, "package.json"));
    if (data === null) return { requirements: [], issues: [] };
    try {
      const value = JSON.parse(data);
      const node = [value.engines?.node, value.volta?.node]
        .filter((v) => typeof v === "string")
        .map((version) => ({
          runtime: "node",
          version,
          source: "package.json",
        }));
      const manager =
        typeof value.packageManager === "string"
          ? value.packageManager.match(/^(npm|yarn|pnpm|bun)@([^+]+)(?:\+.*)?$/)
          : null;
      const requirements = [
        ...node,
        ...(manager
          ? [
              {
                runtime: manager[1],
                version: manager[2],
                source: "package.json packageManager",
              },
            ]
          : []),
      ];
      return {
        requirements,
        issues: [
          ...(![...pins, ...tools, ...node].some((r) => r.runtime === "node")
            ? [
                "package.json has no declared Node version; review project instructions",
              ]
            : []),
          ...(value.packageManager && !manager
            ? ["unsupported packageManager declaration"]
            : []),
        ],
      };
    } catch {
      return {
        requirements: [],
        issues: ["invalid package.json; cannot determine runtimes"],
      };
    }
  })();
  const python = (() => {
    const data = text(join(directory, "pyproject.toml"));
    if (data === null) return { requirements: [], issues: [] };
    try {
      const value = Bun.TOML.parse(data) as {
        project?: { "requires-python"?: unknown };
      };
      const version = value.project?.["requires-python"];
      return typeof version === "string"
        ? {
            requirements: [
              { runtime: "python", version, source: "pyproject.toml" },
            ],
            issues: [],
          }
        : {
            requirements: [],
            issues: [
              "pyproject.toml has no supported requires-python declaration; review Python version",
            ],
          };
    } catch {
      return {
        requirements: [],
        issues: ["invalid pyproject.toml; cannot determine Python requirement"],
      };
    }
  })();
  // Java toolchain declares a JDK requirement; sourceCompatibility alone only declares output compatibility.
  const gradle = [
    "build.gradle",
    "build.gradle.kts",
    "android/build.gradle",
    "android/app/build.gradle",
    "android/app/build.gradle.kts",
  ].flatMap((source) => {
    const data = text(join(directory, source));
    if (!data) return [];
    const match = data.match(
      /(?:JavaLanguageVersion\.of\s*\(\s*|jvmToolchain\s*\(\s*)(\d+)\s*\)/,
    );
    return match ? [{ runtime: "java", version: match[1], source }] : [];
  });
  const hasGradle = [
    "build.gradle",
    "build.gradle.kts",
    "android/build.gradle",
    "android/build.gradle.kts",
  ].some((file) => existsSync(join(directory, file)));
  const requirements = [
    ...pins,
    ...tools,
    ...pkg.requirements,
    ...python.requirements,
    ...gradle,
  ];
  return {
    requirements,
    issues: [
      ...pkg.issues,
      ...python.issues,
      ...(hasGradle && !requirements.some((r) => r.runtime === "java")
        ? [
            "Gradle project has no supported JDK pin/toolchain; review its Java requirements",
          ]
        : []),
    ],
    compose: entries(directory).some((file) =>
      /^(?:docker-)?compose(?:[.-][\w.-]+)?\.ya?ml$/.test(file),
    ),
  };
}

function runtimeChecks(
  name: string,
  directory: string,
  requirements: Requirement[],
  home: string,
): Check[] {
  const commands: Record<string, string> = {
    node: "node",
    python: "python3",
    java: "java",
    npm: "npm",
    yarn: "yarn",
    pnpm: "pnpm",
    bun: "bun",
  };
  return requirements.map((req) => {
    const label = `${name}:${req.runtime}`;
    const detail = `${req.version} from ${req.source}`;
    if (!commands[req.runtime])
      return manual(
        label,
        `${detail}; unsupported runtime, review project instructions`,
      );
    const active = probe(
      commands[req.runtime],
      [req.runtime === "java" ? "-version" : "--version"],
      3000,
    );
    const activeVersion = (active.out || active.err).match(
      /\bv?(\d+\.\d+(?:\.\d+)?)/,
    )?.[1];
    const installed =
      req.runtime === "node"
        ? entries(
            join(process.env.NVM_DIR ?? join(home, ".nvm"), "versions/node"),
          )
        : req.runtime === "python"
          ? entries(
              join(process.env.PYENV_ROOT ?? join(home, ".pyenv"), "versions"),
            )
          : req.runtime === "java"
            ? (probe("/usr/libexec/java_home", ["-V"], 3000).err.match(
                /\b\d+\.\d+(?:\.\d+)?/g,
              ) ?? [])
            : [];
    const versions = [...installed, ...(activeVersion ? [activeVersion] : [])];
    if (versionSatisfies("0.0.0", req.version) === null)
      return manual(
        label,
        `${detail}; cannot compare this declaration automatically`,
      );
    const related = requirements.filter(
      (other) => other.runtime === req.runtime,
    );
    const match = versions.find((version) =>
      related.every(
        (other) => versionSatisfies(version, other.version) === true,
      ),
    );
    const activate =
      req.runtime === "node"
        ? `cd ${quote(directory)}; nvm use ${quote(match ?? req.version)}`
        : "activate the matching runtime in this project's shell";
    if (match)
      return check(label, true, `${detail}; installed ${match}; ${activate}`);
    const next =
      req.runtime === "node" && existsSync(join(directory, ".nvmrc"))
        ? `cd ${quote(directory)}; nvm install; nvm use`
        : req.runtime === "node" && coerceToSemver(req.version)
          ? `nvm install ${quote(req.version)}`
          : req.runtime === "python" && coerceToSemver(req.version)
            ? `pyenv install ${quote(req.version)}`
            : ["npm", "yarn", "pnpm", "bun"].includes(req.runtime)
              ? `activate this repo's Node/runtime first, then install ${req.runtime}@${req.version} per its packageManager declaration (no global latest)`
              : "install a version satisfying the declaration using project instructions";
    return check(
      label,
      false,
      `${detail}; no installed version satisfies all declarations for this runtime; reconcile conflicts if present; ${next}`,
    );
  });
}

function main(): number {
  const options = (() => {
    try {
      return parseArgs({
        options: {
          "code-dir": { type: "string" },
          offline: { type: "boolean" },
          help: { type: "boolean" },
        },
        allowPositionals: false,
      }).values;
    } catch {
      return null;
    }
  })();
  if (!options || options.help) {
    console.log(
      "Usage: bun macos/doctor.ts [--code-dir PATH] [--offline] [--help]",
    );
    return options ? 0 : 2;
  }
  const home = process.env.HOME!;
  const code = resolve(options["code-dir"] ?? join(home, "code"));
  const manifest = (text(join(import.meta.dir, "repos.txt")) ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const projects = manifest.map((repo) => {
    const name = repo.split("/").at(-1)!;
    const directory = join(code, name);
    return { repo, name, directory, project: inspectProject(directory) };
  });
  const tools = {
    brew: "install Homebrew from brew.sh",
    chezmoi: "brew install chezmoi",
    gh: "brew install gh",
    git: "brew install git",
    bun: "brew install oven-sh/bun/bun",
    omp: "bun install -g @oh-my-pi/pi-coding-agent",
    herdr: "use https://herdr.dev/install.sh",
    linear: "brew install schpet/tap/linear",
    aws: "brew install awscli",
  };
  const toolChecks = Object.entries(tools).map(([tool, hint]) =>
    check(
      `tool:${tool}`,
      !!Bun.which(tool),
      Bun.which(tool) ? "available" : hint,
    ),
  );
  const gitChecks = [
    "user.name",
    "user.email",
    "init.defaultBranch",
    "fetch.prune",
    "pull.ff",
  ].map((key): Check => {
    const value = probe("git", ["config", "--global", "--get", key]);
    const wanted: Record<string, string> = {
      "init.defaultBranch": "main",
      "fetch.prune": "true",
      "pull.ff": "only",
    };
    return check(
      `git:${key}`,
      value.ok && (wanted[key] ? value.out === wanted[key] : !!value.out),
      "review with macos/configure-git.sh; signing and credential helpers are not changed",
    );
  });
  const repoChecks = projects.flatMap(({ repo, name, directory, project }) => {
    const origin = probe("git", [
      "-C",
      directory,
      "remote",
      "get-url",
      "origin",
    ]);
    const matches =
      origin.ok &&
      [
        `https://github.com/${repo}`,
        `https://github.com/${repo}.git`,
        `git@github.com:${repo}.git`,
      ].includes(origin.out);
    if (!matches)
      return [
        check(
          `repo:${name}`,
          false,
          `missing or wrong origin; review before cloning ${repo} into ${directory}`,
        ),
      ];
    return [
      check(`repo:${name}`, true, directory),
      ...project.issues.map((issue) => manual(`${name}:declarations`, issue)),
      ...runtimeChecks(name, directory, project.requirements, home),
    ];
  });
  const shared = join(code, "agent-skills/skills");
  const skills = entries(shared).filter(
    (name) =>
      name !== "_template" && existsSync(join(shared, name, "SKILL.md")),
  );
  const missingSkills = skills.filter(
    (name) =>
      real(join(home, ".agents/skills", name)) !== real(join(shared, name)),
  );
  const skillCheck = check(
    "skills:shared",
    skills.length > 0 && missingSkills.length === 0,
    skills.length && !missingSkills.length
      ? "native OMP skill links resolve to the shared repo"
      : `run bootstrap's shared-skill setup; missing/conflicting links: ${missingSkills.join(", ") || "shared repo unavailable"}`,
  );
  const aerospace = Bun.which("aerospace");
  const desktop = [
    check(
      "app:ghostty",
      existsSync("/Applications/Ghostty.app") ||
        existsSync(join(home, "Applications/Ghostty.app")),
      "install Ghostty via the Brewfile",
    ),
    check(
      "app:aerospace",
      !!aerospace && probe(aerospace, ["list-windows", "--all"]).ok,
      "AeroSpace must be running and answer a window-list query",
    ),
    manual(
      "permission:aerospace",
      "confirm AeroSpace can focus a window; grant Accessibility in System Settings if needed",
    ),
  ];
  const online = (
    label: string,
    command: string,
    args: string[],
    action: string,
  ): Check =>
    options.offline
      ? manual(label, `offline; not verified; ${action}`)
      : check(label, probe(command, args).ok, action);
  const tail =
    Bun.which("tailscale") ??
    "/Applications/Tailscale.app/Contents/MacOS/Tailscale";
  const tailscale: Check = options.offline
    ? manual(
        "auth:tailscale",
        "offline; not verified; open Tailscale and sign in",
      )
    : (() => {
        const result = probe(tail, ["status", "--json"]);
        try {
          return check(
            "auth:tailscale",
            result.ok && JSON.parse(result.out).BackendState === "Running",
            "open Tailscale and sign in to the work tailnet",
          );
        } catch {
          return check(
            "auth:tailscale",
            false,
            "open Tailscale and sign in to the work tailnet",
          );
        }
      })();
  const auth = [
    online(
      "auth:github",
      "gh",
      ["auth", "status"],
      "gh auth login; gh auth setup-git",
    ),
    online(
      "auth:github-api",
      "gh",
      ["api", "user", "--silent"],
      "GitHub API must accept current authentication",
    ),
    online(
      "auth:linear",
      "linear",
      ["team", "list"],
      "provide LINEAR_API_KEY in your local secret environment; run linear config",
    ),
    tailscale,
    online(
      "auth:aws",
      "aws",
      ["sts", "get-caller-identity", "--output", "json", "--no-cli-pager"],
      "configure your SSO profile, select AWS_PROFILE, then aws sso login",
    ),
    manual(
      "auth:omp",
      "start command omp, use /login for configured providers and send a harmless prompt; model lists are not proof of access",
    ),
    manual(
      "auth:notion",
      "authorize the Notion MCP connection inside OMP and read a permitted page; no token files are inspected",
    ),
  ];
  const composeRepos = projects
    .filter(({ project }) => project.compose)
    .map(({ repo }) => repo);
  const docker: Check[] = composeRepos.length
    ? (() => {
        if (!Bun.which("docker")) {
          return [
            check(
              "docker",
              false,
              "install Docker Desktop via the Brewfile, then finish its first-run setup",
            ),
          ];
        }
        const context = probe("docker", [
          "context",
          "inspect",
          "--format",
          '{{(index .Endpoints "docker").Host}}',
        ]);
        const endpoint = process.env.DOCKER_CONTEXT
          ? context.out
          : (process.env.DOCKER_HOST ?? context.out);
        if (!endpoint.startsWith("unix://"))
          return [
            manual(
              "docker",
              "local Docker endpoint not confirmed; open Docker Desktop/select its local context (remote daemons are not probed)",
            ),
          ];
        return [
          check(
            "docker:engine",
            probe("docker", ["info", "--format", "{{.ServerVersion}}"]).ok,
            `local daemon required by ${composeRepos.join(", ")}; open Docker Desktop`,
          ),
          check(
            "docker:compose",
            probe("docker", ["compose", "version", "--short"]).ok,
            "Docker Compose plugin must be available",
          ),
        ];
      })()
    : [];
  const configs = [
    ".aerospace.toml",
    ".config/ghostty/config",
    ".config/herdr/config.toml",
    ".omp/agent/config.yml",
    ".omp/agent/mcp.json",
    ".omp/plugins/bun.lock",
  ].map((file) =>
    check(
      `config:${file}`,
      existsSync(join(home, file)),
      "restore via the reviewed core-config step in bootstrap",
    ),
  );
  const checks = [
    check("platform", process.platform === "darwin", "macOS required"),
    ...toolChecks,
    ...configs,
    ...gitChecks,
    check(
      "repos:manifest",
      manifest.length > 0,
      "macos/repos.txt must list work repos",
    ),
    ...repoChecks,
    skillCheck,
    ...desktop,
    ...auth,
    ...docker,
  ];
  for (const item of checks)
    console.log(`${item.status} ${item.label}: ${item.detail}`);
  const pending = checks.filter((item) => item.status !== "OK");
  console.log(
    `\n${checks.length - pending.length}/${checks.length} verified; ${pending.length} missing or manual checks. No configuration was changed.`,
  );
  return pending.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = main();
