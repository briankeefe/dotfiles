# Execute Next Task

`execute next task <project>` selects and reports the next available task. It does not start work. Follow the shared defaults in `skill://execute`.

## Resolve and refresh

1. Find the existing project plan using the request and repository documentation conventions. Ask if the project is ambiguous. If no plan exists, report that and stop; suggest `execute init project <project>`.
2. Read the plan, including priorities, dependency order, recommendations and holds.
3. Resolve the configured tracker and code host from that context. Fetch current candidate details and prerequisite statuses, including linked PR evidence where completion depends on it. Use installed CLI help rather than assuming commands or flags.
4. If access fails or prerequisite status cannot be established, report the gap. Do not label an unverified task ready based only on a stale plan. Mention discrepancies without editing the plan; suggest `execute update project <project>`.

## Select inline

- Exclude completed, canceled, in-progress, in-review, blocked and on-hold work. Do not select work already owned by an active worker as a new task.
- Consider explicitly available tasks first, then unstarted tasks whose prerequisites are satisfied. Readiness labels never override a live blocker.
- Respect documented priorities, phase order and explicit recommendations. Among otherwise equal tasks, prefer one that unblocks others, then a smaller task.
- Inspect dependency chains for cycles, missing tasks and external blockers. Report these instead of guessing an order. Keep tracker and PR status distinct and apply the project's completion rules.

## Output and stop

When a task is available, return:

- **Next recommended task:** ID, title and source link.
- Current ticket details: description, acceptance criteria, status, priority, assignee and dependencies, with unknown fields identified rather than invented.
- Why it is available and why it was selected.
- Other available tasks, if any, as IDs/titles with brief distinguishing context.

If none is available, say so and distinguish all-complete from waiting, blocked or unverified work. List the blocking dependencies/cycles and relevant in-review PR links.

Do not implement, claim or assign the task, launch workers, edit project docs or change tracker state. Wait for a separate execution request.
