# PR Review Loop

`execute shepherd-pr [PR_URL]` owns a draft pull request from its first Cursor review trigger through approval. Ticket delivery enters this workflow automatically after publishing a draft PR.

## Standing authorization

The user has authorized this workflow to:

- post `/check` comments;
- wait for and inspect Cursor reviews;
- make, verify, commit and push minimal in-scope fixes;
- reply with evidence when feedback is invalid or already addressed;
- repeat those actions until approval; and
- mark the draft ready for review after the approval gate passes.

Do not ask for confirmation for those actions. This authorization does not permit merging, force-pushing, changing the PR base, resolving unrelated feedback, broadening ticket scope, or ignoring repository publication rules.

## Establish the review cycle

1. Resolve the PR from the URL or current branch. Confirm it is open and that the assigned worktree matches its head branch. Preserve unrelated user changes.
2. Confirm the repository supports the `/check` trigger and identify the repository's two Cursor review actions from actual check and review metadata. For Kubera Health these are the risk analysis and the thermo-nuclear code quality review; they may appear as separate actions under the same Cursor account.
3. Confirm the current commit is pushed, then post a PR comment containing exactly `/check`. Verify the comment exists. Record the head SHA and comment timestamp for this cycle so stale reviews cannot satisfy the gate.

## Wait and inspect

Poll the host API at a reasonable interval until both Cursor actions triggered for the recorded head have completed. Do not busy-wait. Keep running in the assigned session so the user can work elsewhere.

A successful check run proves only that the automation executed. Approval must come from each action's review state or explicit review conclusion. Fetch full formal reviews, review bodies, inline comments, general comments, thread state and check details using the **Collect feedback** rules in `skill://execute/reference/update-pr.md`.

Before acting, verify the PR head is still the recorded SHA. If another authorized actor pushed, restart the cycle against the new head without overwriting their work.

## Triage and respond

Classify every new substantive finding against the current code:

- **Valid:** make the smallest root-cause fix, add or update only a valuable behavioral check, run targeted verification, commit and push without force.
- **Invalid or already addressed:** reply at the finding with concise code or test evidence. Do not change code merely to appease a mistaken review.
- **Ambiguous or conflicting:** investigate repository and ticket evidence first. Notify the user only when a product decision or unavailable prerequisite truly prevents an informed choice.

Reply to every substantive finding with its disposition. Never claim verification that was not run. After all fixes and replies are published, confirm the new head is remote and comment exactly `/check` again. Record the new head and trigger timestamp, then return to **Wait and inspect**.

If an action fails without producing a substantive review, inspect the failure. Fix an in-scope cause; otherwise retrigger once. Repeated infrastructure failure, missing authentication, an unavailable reviewer action, or the same unsupported finding recurring without new evidence is a blocker: preserve the draft and notify the user with links and the exact reason.

## Approval gate

Continue the cycle until all of these are true for the current head and latest `/check` cycle:

- the risk analysis action explicitly approves;
- the thermo-nuclear review explicitly approves or states that no blocking changes are required;
- no newer unresolved `CHANGES_REQUESTED` review or substantive Cursor finding remains; and
- required repository checks are not failing because of this PR.

Approval from one Cursor action never substitutes for the other. An old approval, green automation run, author's reply, dismissed review, or outdated thread does not satisfy this gate.

## Finish

Re-read the PR head, draft state, approvals and checks immediately before transition. If the gate still holds, mark the PR ready for review using the host's supported command and verify the draft flag changed. Do not merge it.

Notify the user with the PR URL, the approval evidence from both Cursor actions, fixes or pushbacks made during the loop, verification performed, and confirmation that the PR is ready for review.
