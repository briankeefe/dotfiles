# Execute Update Project

`execute update project <project>` refreshes an existing project document from its tracker and code host. Follow the shared defaults in `skill://execute`.

## Gather current evidence

1. Locate the plan using the request and repository documentation conventions. Ask if the project is ambiguous. If no plan exists, report that and stop; suggest `execute init project <project>`.
2. Read the whole plan to identify the project, tracker, task IDs, repositories, PR links, dependency order and completion rules.
3. Fetch current task statuses, relevant description/acceptance changes and dependency links. If the document tracks the whole project, check project membership for newly added or removed tasks. Use configured integrations and installed CLI help, including pagination; do not assume a provider or ticket format.
4. Fetch linked PR states, draft/review status and merge/close dates. Search for missing PR links only within the relevant repositories and verify the association before recording it.
5. Identify changed blockers, cycles, external holds and discrepancies between the plan and live sources. If a source is unavailable, preserve its last-known values and mark them stale; report partial coverage explicitly.

## Update the document only

This command authorizes refreshing the existing project document, not changing the tracker or PRs.

- Preserve structure, formatting, decisions and user notes. Make only factual changes to status fields, PR links, blockers, the current summary and next-available list.
- Keep tracker status separate from PR state. Draft, ready for review, merged, closed-unmerged and reverted are different facts. Do not equate a merged PR with completed acceptance criteria or deployment unless the project defines it that way.
- Refresh availability using satisfied dependencies and current holds. Do not silently resolve cycles or rewrite the approved execution order; flag decisions needed.
- Record newly discovered tasks in the existing task list, and annotate removals/cancellations without deleting useful history. Flag changed scope or acceptance criteria for planning rather than rewriting the plan speculatively.
- Update the refresh timestamp and source coverage. Do not imply unavailable sources were checked.

## Report and stop

Return the document path, number of tasks checked/changed, material status changes, new PR links, progress counts, remaining blockers and next available tasks. Include unknown/stale evidence and planning decisions needing attention.

Do not transition, assign or edit tickets, start tasks, post comments, publish, merge PRs or change draft/ready status. Any proposed ticket changes require a separate approved plan.
