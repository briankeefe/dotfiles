---
name: execute
description: Dripos development command toolkit. Use when the user types `execute <command>` (e.g. `execute DRI-123`, `execute pr summary`, `execute pr review <url>`, `execute update-pr`, `execute e2e test`, `execute sanity check`, `execute init project NAME`, `execute next task NAME`, `execute update project NAME`, `execute actionable pr`, `execute release-check`, `execute local-repro`, `execute ops`, `execute docs`, `execute help`). Also use when asked whether a ticket/PR/commit is in a release branch, which merged PRs are missing from a release, how to test/reproduce a ticket or PR locally, or about PostHog keys/logging architecture and POS staging OTA deploy and version-bump rules. Drives Linear ticket execution, PR triage/review/update, release-branch membership checks, local reproduction setup, E2E test generation, project planning, and documentation against the Dripos/Frostbyte ecosystem using the Linear CLI, gh CLI, and the Oh My Pi task/browser tools.
---

# Execute Toolkit (Oh My Pi port)

User-invoked command toolkit for Dripos development. Triggered by `execute <command>`
(via the `/execute` slash command, or recognized in free text). Each command maps to a
detailed workflow doc in this skill's `reference/` directory — **read the matching doc and
follow it exactly**, including every MUST/STOP/approval gate.

## Dispatch table

Parse the command words after `execute`, match the longest prefix, then
`read skill://execute/reference/<doc>` and execute that workflow with the remaining
arguments.

| Invocation | Reference doc | Purpose |
|---|---|---|
| `execute help` | (this file) | List available commands |
| `execute DRI-XXX` / `execute <ticket-name>` | `reference/ticket.md` | Full ticket workflow: fetch → plan → implement → test → review → PR |
| `execute pr summary` | `reference/pr-summary.md` | Status of all your open PRs across the Dripos ecosystem |
| `execute pr review <PR_URL>` | `reference/pr-review.md` | Comprehensive code review using Conventional Comments |
| `execute update-pr [PR_URL]` | `reference/update-pr.md` | Address open reviewer feedback (auto-detects PR from branch) |
| `execute actionable pr` | `reference/actionable-pr.md` | Find one PR with unaddressed actionable feedback |
| `execute e2e test` | `reference/e2e-test.md` | Walk a flow with the browser tool, generate a Playwright test |
| `execute sanity check` | `reference/sanity-check.md` | Sanity-check recently completed work against requirements |
| `execute init project NAME` | `reference/init-project.md` | Build a dependency-aware project execution plan |
| `execute next task NAME` | `reference/next-task.md` | Output the next available task from a project |
| `execute update project NAME` | `reference/update-project.md` | Refresh project docs from Linear + GitHub |
| `execute docs` | `reference/docs.md` | Documentation workflow |
| `execute release-check <DRI/PR/sha> [release-NN]` | `reference/release-check.md` | Is a ticket/PR/commit in a release branch; which merged PRs are missing; merge master into a release branch |
| `execute local-repro <ticket/PR>` | `reference/local-repro.md` | Stand up backend/FE/mobile + auth to reproduce or verify a change locally |
| `execute ops` (posthog / logging / deploy questions) | `reference/ops-facts.md` | PostHog keys & logging architecture, POS staging OTA deploy & version-bump rules |

If no command matches, show this table.

## Environment

- `linear` CLI — configured and authenticated. Ticket IDs look like `DRI-XXX`.
- `gh` CLI — authenticated (account `briankeefe`). Used for PR status, diffs, comments, creation.
- Working tree root: `/Users/brian/code`. Project docs in `/Users/brian/code/ProjectInfo/`.
- Worktrees: `/Users/brian/code/<repo>-dri-XXX`, branches `briankeefe/dri-<n>-<desc>`.
- Agent lock coordination for parallel runs: `/Users/brian/code/.agent-locks.json`
  (`yarn_install`, `playwright`) per `/Users/brian/code/AGENT_LOCKS.md`.

## Oh My Pi tool conventions (how this toolkit maps from its Claude Code origin)

These reference docs were ported from a Claude Code toolkit. When a doc describes a step,
use the Oh My Pi equivalent:

- **Subagents** — use the `task` tool. Map roles to agent types:
  - planning / decomposition → `agent: "planner"`
  - critical analysis, gap/risk identification, plan validation → `agent: "critic"`
  - code review (quality, patterns) → `agent: "code-reviewer"`; security-specific → `agent: "security-reviewer"`
  - dependency-aware ordering / data analysis → `agent: "analyst"` (or `scientist`)
  - heavy open-ended reasoning / second opinion → `agent: "oracle"`
  - read-only investigation → `agent: "explore"`
  Spawn synchronously and wait for the result. There is no `category=`, `load_skills=`,
  or `mcp_skill(...)` — those Claude Code primitives do not exist here.
- **Browser / UI verification & E2E** — use the `browser` tool (`open`, then `run` with
  `tab.observe`, `tab.click`, `tab.fill`, `tab.screenshot`, etc.), not Playwright MCP.
  Generated test files still use the `@playwright/test` framework run via `yarn`/`npx playwright`.
- **DB access (OTP retrieval, schema inspection)** — use a configured MySQL MCP if present.
  If none is configured in this session, surface that as a blocker for the DB-dependent step
  rather than fabricating values.
- **Reading skill/reference content** — `read skill://execute/reference/<doc>`.
- **Self-challenge / scope check** — do it yourself; no external tool needed.

Everything else (Linear CLI, gh CLI, git, yarn, file paths, approval gates, templates)
ports verbatim.
