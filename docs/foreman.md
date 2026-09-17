# Foreman cheat sheet

[Back to README](../README.md)

Foreman is an OMP coordinator running inside Herdr. You assign the work; it starts
independent OMP workers in separate Git worktrees. It does not pick a backlog for you.

## Open, check, and leave

Run these in a normal terminal **outside Herdr**:

```sh
foreman ~/code          # launch or attach to the coordinator for this root
foreman --help
herdr session list --json
```

The directory must already exist. `~/code` is the coordinator's working directory,
not necessarily the repository a worker will edit. Supply that repository separately
when assigning work.

Inside the coordinator's OMP prompt:

```text
/foreman status
```

A fresh coordinator shows `enabled: true`, `workers: []`, and `reviewers: []`.
Detach the Herdr client with **Ctrl-B, then q**, without Enter. The coordinator and
workers keep running. Run `foreman ~/code` again to return. Ctrl-C interrupts the
foreground program; it is not the detach shortcut.

## Why several sessions appear

| What you see | Meaning |
| --- | --- |
| `foreman-<hash>` native Herdr session | Coordinator selected by resolved directory plus OMP profile |
| `foreman` OMP agent inside it | The coordinator you talk to |
| Additional task sessions / worker agents | Independent workers, normally one per assigned task |

Repeated `foreman ~/code` calls attach to the same running coordinator. A different
directory or `--profile NAME` selects a different coordinator. A saved Herdr session
can remain after its OMP agent exits; a session name alone does not prove an agent
is running. Don't delete unfamiliar sessions to reduce the count.

## Configure before dispatch

The implementation requires at least one reviewer **before starting a worker**, even
for a trial that will not publish. Replace the placeholders with real intended
reviewers; do not paste example identities or choose your own login as a PR reviewer.

```text
/foreman reviewers REVIEWER_LOGIN,ORG/TEAM
```

Use one login, a comma-separated list, or an organization/team slug. This replaces
the configured list; it does not itself create a PR or request a GitHub review.
Actual publication requests those reviewers and can trigger their review bots.

## First worker trial

Use an existing cloned Git repository with an `origin` remote and working Git access.
OMP's model authentication must also work. Replace the repository path below and
paste this as a normal message to the coordinator, not a slash command:

```text
Start one independent worker for TEST-1 in /absolute/path/to/repo.
Inspect the test setup and identify the smallest existing check for this repo.
Report the check command and relevant file paths. Do not edit tracked files,
commit, push, create a PR, or request reviews. Do not run the check yet.
```

Dispatch still fetches Git refs and creates a local branch/worktree and Herdr worker.
Use `/foreman status` to find the worker ID, worktree, native session, and pane.
A separate worker is expected, not a duplicate coordinator. Read its report before
considering the task successful; `idle` alone is not proof of completion.

Inside Herdr, Foreman shows each worker in a separate single-pane workspace in the
current window, with a named OMP agent-switcher entry. It preserves focus and reuses
existing views; it does not split the coordinator pane or open another terminal.
The installed `foreman/view.ts` wrapper attaches to the original worker and forwards
its lifecycle events, so working/blocked/idle status stays live. A disconnected or
replaced worker becomes unknown rather than appearing successfully idle. Detaching
the view releases its local status authority without stopping the worker. Views
have their own display-only identity, never the worker's resumable transcript;
Foreman always controls the original worker.

For real implementation work, give the task/ticket ID, absolute repository path,
concrete scope, and acceptance criteria. State whether publication is authorized.
The normal workflow commits verified changes and publishes a **draft** PR, requesting
the configured reviewers. Automatic bot-feedback delivery runs only while the PR is
open and draft. Ready/closed PRs stop that loop; Foreman never automatically marks a
PR ready or merges it.

## Daily controls

These go in the coordinator's OMP prompt. Replace `WORKER_ID` with an actual ID from
status, such as `TEST-1/primary`.

| Command or action | Effect |
| --- | --- |
| `/foreman status` | Show assignments, observed agents, PR state, and recorded errors |
| `/foreman off` | Pause monitoring and block coordinator tool dispatch; does not stop workers |
| `/foreman on` | Enable monitoring again; does not automatically restart workers |
| `/foreman stale 30` | Set the stale-progress threshold to 30 minutes, not a task timeout |
| `/foreman bots BOT_LOGIN` | Replace the additional bot-login list used for feedback filtering |
| Ask: "Read WORKER_ID and explain its current blocker; don't send instructions yet." | Inspect before deciding whether to nudge |
| Ask: "Auth is fixed; continue WORKER_ID." | Foreman reads the latest conversation, then uses `continue` with your quoted authorization to prompt the same idle worker. No slash command or restart needed. |
| Talk directly to a worker | Your latest direct instructions take priority over Foreman's |

GitHub Bot accounts and `[bot]` logins are recognized without adding them to
`/foreman bots`. Ordinary human review comments are not automatically delivered
unless their authors are explicitly configured as bots.

## Recovery: inspect first

| Situation | Next action |
| --- | --- |
| Dispatch cancelled or startup interrupted | Inspect the recorded worktree and native session. Partial work may exist; do not blindly repeat the assignment. |
| Worker exited or changed sessions | `/foreman resume WORKER_ID` asks for confirmation to adopt/relaunch using preserved state. It does not replay the assignment. |
| Reported blocker resolved, same worker still idle | Tell Foreman to continue. Explicitly authorized `continue` retains newer-input, session-identity, pending-delivery, and native approval-dialog guards. It cannot adopt or restart a worker. |
| Prompt delivery outcome is uncertain | Inspect the worker conversation, then `/foreman acknowledge WORKER_ID` if resolved. This clears the hold without resending. |
| Coordinator's native session stopped | After inspection, `foreman ~/code --restart` creates a fresh native session and continues the coordinator journal when available. It does not restart workers. |
| Native session is running but no live coordinator exists | Inspect it first. `--restart` is not a shortcut around a still-running native session. |
| "Another Foreman launch is in progress" | Let the active launcher finish. For a stale lock, confirm no launcher is running before manually removing only the exact empty `launch.lock` directory named in the error. |

Cancellation is not rollback: existing worktrees, panes, and possibly delivered
requests are preserved. Do not remove journals or worktrees as a recovery shortcut.

## Local files and verification

- Launcher: `~/.local/bin/foreman`
- Extension: `~/.omp/agent/extensions/foreman/`
- Default-profile coordinator markers/journals: `~/.omp/agent/foreman-sessions/`
- Source: `private_dot_omp/agent/extensions/foreman/` in this repository
- Regression checks: `bun test macos/foreman.test.ts` from the repository root

The regression suite uses recording Git/GitHub/Herdr fixtures, not real PR mutations.
Installation verified idle startup, `/foreman status`, and repeat attach/detach.
That smoke check does not verify an actual development task or live GitHub review loop.
