# PR Summary

`execute pr summary` reports the current user's open, non-draft PRs. This is read-only. Follow `skill://execute` for shared defaults.

## Gather

1. Derive the host, authenticated user and repository scope from supplied URLs, current repository and project docs. Use an explicitly requested multi-repository scope; otherwise use the current repository. Ask only if scope cannot be determined. Do not search unrelated organizations by default.
2. Use the host's installed CLI/API, checking its help for supported commands and fields. Fetch every page of open PRs authored by that user; a fixed result limit is not evidence of completeness. Exclude drafts unless the user requests them.
3. For each PR, fetch its URL, title, creation time, current head, review decisions and requests, checks and mergeability. Collect reviews, comments and thread state using **Collect feedback** in `skill://execute/reference/update-pr.md`, without entering its edit workflow. Include human and bot feedback by substance.
4. Report inaccessible repositories or truncated results as incomplete coverage, not as empty results.

## Interpret

- **Review:** show the host's current decision, outstanding requests and any unresolved actionable feedback separately. A re-request means review was requested again, not that earlier concerns were fixed. New commits, timestamps or the author's last reply alone never establish resolution.
- **Reviewers:** deduplicate people/teams, retaining their latest formal state and pending requests. Include substantive commenters not otherwise listed; author replies are context, not peer reviews.
- **Checks:** distinguish failing/error/cancelled/timed-out, pending/running, passing, skipped/neutral and missing/unknown. Do not count skipped or absent checks as passing. Identify required-check status when available.
- **Mergeability:** report clean, conflicting or unknown as returned by the host. Approval plus green checks does not prove all branch policies are satisfied or authorize merging.

## Present

Show the scope, total and a compact entry per PR: repository, number/title, URL, review state, feedback needing action, CI, mergeability and reviewers. Sort needs-action items first (blocking feedback, failed checks, conflicts), then approved/passing, then awaiting review; use oldest first within each group. Keep counts mutually exclusive and consistent with entries.

Say “No open non-draft PRs found” only after complete discovery. Never edit code, post comments, request reviews, push, merge or change draft/ready state from this command.
