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

## Deliver

Update existing documentation when the contract requires it. Follow the publication authorization in `skill://execute`; an existing instruction to commit/push/publish needs no repeat confirmation.

Include the ticket link, concise result, verification, relevant UI evidence and limitations in the draft PR and final response. Missing optional reviewers do not block authorized publication. Subsequent feedback uses `skill://execute/reference/update-pr.md`.
