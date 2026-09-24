# Execute Ticket

`execute <ticket ID, URL, or name>` requests implementation. Use discovery and authorization rules in `skill://execute`.

## Establish context and plan

1. Read the ticket description, acceptance criteria, relevant comments, attachments and dependencies through the configured provider. Locate the affected behavior and existing repository patterns.
2. Resolve missing requirements from available evidence. Ask only if the intended outcome, scope or required dependency remains unclear; do not invent acceptance criteria or silently narrow the request.
3. Confirm the assigned repository/worktree and intended PR base. Reuse the current environment and repository install/verification commands.
4. Make a proportionate plan covering affected files, every acceptance criterion, risks and verification. **Proceed without another plan-approval round when implementation is authorized.** Pause only for real ambiguity, material scope/risk decisions or sensitive actions outside the existing authorization.

## Implement, verify and review

- Follow the red/green TDD contract in `skill://execute`: capture the failing behavior before
  production edits, make the minimum fix, then prove the same check passes.
- Make the smallest complete change following existing patterns; fix the root cause and migrate affected callers.
- For bugs, confirm the reported reproduction no longer fails after green. Keep a useful regression
  test when practical; otherwise remove the throwaway check and report the smoke check and its
  limitations. Do not repeat a user-reported failure manually merely to confirm it.
- Update affected tests and exercise the actual changed surface. Capture real UI evidence when relevant; do not impose browser work or a new runner on unrelated changes.
- Map every acceptance criterion to evidence and run applicable repository CI checks after edits settle. Report exact commands, outcomes and gaps rather than claiming unverified success.
- Review correctness and scope against the request; fix blocking findings and repeat affected verification. Keep an environment needed for the user's visual review.

## Feature demo video (when requested)

Use the existing `playwright-demo-kit` checkout and read its `README.md` before recording. Confirm the frontend **and backend** target are safe for demo actions; do not hardcode credentials or record secrets. From the kit root, set `PLAYWRIGHT_BASE_URL` and any existing demo auth variables as needed, then select the one feature spec and run test plus render under **one** lock:

```bash
DEMO_SLUG=<ticket-or-work-slug> python3 scripts/with-recording-lock.py -- sh -c 'npx playwright test -c playwright.demo.config.ts tests/demo/<feature>.demo.spec.ts && npm run demo:render'
```

Replace both placeholders with the actual work identifier and spec path. `DEMO_SLUG=<slug> npm run demo:flow` is only for deliberately recording **all** kit specs; its render selects the newest video. Do not start capture via bare `npx playwright test`, run separate test/render steps for a feature showcase, delete the lock file, or bypass a busy lock. The macOS file lock spans the recorder child and releases when it exits; the JSON slug/time is informational, not a stale timeout. This protects recordings on this Mac only. Report the actual video path and observed result, not just a test listing.

## Deliver

Update existing documentation when the contract requires it. Follow the publication authorization in `skill://execute`; an existing instruction to commit/push/publish needs no repeat confirmation.

Include the ticket link, concise result, verification, relevant UI evidence and limitations in the
draft PR. After publishing the draft, immediately run `skill://execute/reference/review-loop.md`;
do not return merely because the PR exists. Notify the user when the review gate completes or when
that workflow reaches a blocker it cannot resolve. Missing optional reviewers do not block
authorized publication.
