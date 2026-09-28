---
name: execute
description: Project-neutral development workflows for `execute <command>`: tickets, PR summaries/reviews/updates, E2E tests, sanity checks, project planning, documentation, release membership and local reproduction. Also use for questions about whether an issue/PR/commit is in a release, how to reproduce a change locally, or project operations. Discover the repository, issue provider and tools from current context rather than assuming an organization or stack.
---

# Execute Toolkit

Use the matching workflow with active harness/repository rules and the user's current authorization.

## Dispatch

Match the longest named command prefix below before interpreting a ticket. Pass remaining
arguments unchanged. Empty input or `help` shows this table without starting work.
A bare PR URL routes to `pr-review.md`; a bare issue URL, provider-recognized ID (for example
`ENG-2612`, not a required prefix), or resolvable ticket name routes to `ticket.md`.
Resolve names using the configured tracker; ambiguous names require clarification before
work starts. Unknown commands or unrecognized URLs show help rather than inventing a ticket.
An explicit command wins: `local-repro <PR_URL>` reproduces, it does not post a review.

| Invocation | Reference doc | Purpose |
|---|---|---|
| `execute help` | (this file) | Show commands |
| `execute <ticket-ID/name/issue-URL>` | `reference/ticket.md` | Fetch, plan, implement, verify, review, PR |
| `execute pr summary [scope]` | `reference/pr-summary.md` | Summarize your open PRs |
| `execute pr review <PR_URL>` | `reference/pr-review.md` | Review with Conventional Comments |
| `execute update-pr [PR_URL]` | `reference/update-pr.md` | Address actionable reviewer feedback |
| `execute shepherd-pr [PR_URL]` | `reference/review-loop.md` | Run Cursor review/fix cycles, then mark the PR ready |
| `execute actionable pr [scope]` | `reference/actionable-pr.md` | Find PRs with unaddressed feedback |
| `execute e2e test [flow]` | `reference/e2e-test.md` | Exercise a flow and generate a test |
| `execute sanity check` | `reference/sanity-check.md` | Check completed work against requirements |
| `execute init project NAME` | `reference/init-project.md` | Plan project dependencies and execution |
| `execute next task NAME` | `reference/next-task.md` | Identify the next available task, do not start it |
| `execute update project NAME` | `reference/update-project.md` | Refresh project documentation |
| `execute docs [topic]` | `reference/docs.md` | Draft project documentation |
| `execute release-check <ticket/PR/sha> [target]` | `reference/release-check.md` | Check release membership or missing changes |
| `execute local-repro <ticket/PR>` | `reference/local-repro.md` | Bring up the relevant local stack and verify |
| `execute ops [question]` | `reference/ops-facts.md` | Consult project-local operational guidance |

Reference paths resolve as `skill://execute/reference/<doc>`.

## Discover once, reuse

- Read applicable repository instructions and the relevant project docs before editing.
  Resolve repository/host from an explicit URL, assigned worktree, remotes and ticket links.
  Do not silently substitute the current repo for a different repo named by a URL.
- Resolve the issue provider/workspace and ID format from the URL and local configuration.
  Use available authenticated integrations or CLIs. Inspect installed `--help` before unfamiliar
  commands; for example `linear issue view --help` only when Linear is the actual provider.
  Never assume authentication, flags, JSON fields or a database integration exists.
- Reuse the assigned branch/worktree. Otherwise discover the default base from repository
  metadata and any documented project branch; never assume `master`, `main` or a release name.
  Verify remotes before network writes. If release timing changes the strategy and is unstated,
  ask whether this targets the normal next release or something faster.
- Derive runtime/package manager from repo instructions, manifests, lockfiles and pinned versions.
  Reuse existing install, dev, test, lint and CI commands; do not install a runner merely to fit
  this toolkit. Resolve documentation locations from the repository, not a global personal path.
- Missing context: exhaust repo/tool evidence, then ask one focused question. Report unavailable
  credentials or services without guessing values or exposing secrets.

## Red/green TDD

Every behavior-changing implementation workflow MUST use red/green TDD:

1. **Red:** Before editing production code, add or update the smallest behavior-level test or
   throwaway executable check. Run it against the current code and verify it fails for the intended
   reason. A user-reported failure is ground truth; encode it without repeating the manual
   reproduction merely to confirm it.
2. **Green:** Make the minimum source change, then rerun the exact red check and verify it passes.
3. **Refactor:** Clean up only after green, then rerun the affected check.

Keep the regression test only when it meets the repository's test-value bar; otherwise remove the
throwaway check after verification. Documentation-only, metadata-only and purely mechanical changes
are exempt. Behavior-preserving refactors use a passing characterization check before and after
instead of fabricating a failure.

For retrospective workflow comparisons, use OMP session usage records to track uncached input
tokens per single-ticket session alongside staging-discovered defects and user corrections. Keep
multi-ticket sessions separate; cached reads and raw transcript size are not token-cost estimates.

## Acceptance gate for publishing and revisions

Before creating a draft PR, enumerate every acceptance criterion from the ticket and later decisions.
Personally exercise each feasible criterion on the running surface where its behavior is observable;
include the named negative, scope and persistence cases rather than treating a happy-path video as
coverage. For stateful work, check the same record through edit, visible result, save, reload and
reopen where applicable. Record what happened and the environment for each criterion. Automated
tests, builds, demos, code inspection and reviewer approvals supplement but never replace this pass.
If any criterion fails or cannot be exercised, do not publish the draft as complete: fix it or
report the exact blocker and keep the work local until verification is possible.

After PR revisions, personally re-exercise affected criteria and any connected behavior the edits
could change; reconcile the full criterion list against the current head before claiming feedback
addressed or marking the PR ready. Do not accept a revision, post a fix reply, or transition a PR
based only on a green check or a previous head's evidence. Repeat on staging when the change reaches
it; staging catches environment differences, not skipped pre-PR acceptance checks.

## Scope and authorization

`execute <ticket>` requests implementation, not another mandatory plan-approval round.
Plan proportionately and proceed when authorized. Ask only for unresolved requirements,
material scope/risk decisions or sensitive actions not already authorized.

Use active harness tool/delegation rules, inline first. Native task subagents are not independent
Foreman workers; retain an assigned worker's worktree/session rather than creating a replacement.

When delegating, give each agent narrow ownership, already-inspected symbols and open acceptance
cases; return a short evidence handoff instead of duplicating broad reads or full transcripts.
In long sessions, keep a compact record of what was verified and what remains, rather than
reloading prior tool output.

Read-only commands do not start implementation or publish. Tracker updates are never automatic.
Publishing needs authorization, not repeated confirmation when already granted. Create draft PRs,
keep the author assigned, and follow the assigned publication mechanism unless explicitly overridden.
Reviewer identities/triggers are repository-local: report missing optional reviewers and proceed
with authorized publication, never borrow another project's configuration. Distinguish a posted
trigger, recorded request and completed review. Do not merge. The standing authorization in
`reference/review-loop.md` permits its exact review comments, fixes, pushes, replies and final
draft-to-ready transition only after both required approvals.
