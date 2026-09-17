# Execute Init Project

`execute init project <project>` creates a dependency-aware execution plan, not tickets or implementation work. Follow the shared defaults in `skill://execute`.

## Gather context

1. Resolve the project, tracker, repositories and documentation location from the request, repository instructions and existing project docs. Ask only if the project or destination remains ambiguous; do not invent a project directory.
2. Use the configured tracker integration to fetch the full project task list, including completed and canceled tasks, descriptions, acceptance criteria, statuses, priorities, assignees and dependency links. Check installed CLI help for supported commands and pagination.
3. Read any existing project plan before changing it. Preserve useful decisions and user-authored notes. If a source is inaccessible or incomplete, identify the missing coverage rather than presenting the plan as complete.

## Order the work

- Distinguish explicit blocking relationships from inferred technical dependencies. A related-task link is not itself a blocker. Label assumptions and unresolved scope.
- Order unfinished tasks after their prerequisites. Use project priorities and existing recommendations to break ties, then consider which task unlocks more work. Do not invent foundation phases without a real dependency.
- Check for cycles, missing dependencies, external blockers and on-hold tasks. List the affected tasks and the decision needed to unblock them; do not force them into a runnable sequence.
- Identify independent tasks that could proceed in parallel, accounting for shared files, data migrations and API contracts. This is a planning option, not authorization to launch workers.
- Note material risks and the repository-appropriate verification each track needs. Reconsider the ordering and assumptions before saving.

## Write the plan

This command authorizes the project document, using the established location and format. Keep it as small as the project permits:

- Project name, source links, goals and refresh date.
- Task table with ID/link, title, observed status, dependencies, priority and associated PR links when known.
- Recommended execution order with brief dependency reasoning and any independent tracks.
- Clarifications, cycles, blocked/on-hold work and material engineering risks.
- Current progress and tasks available now, with evidence for satisfied prerequisites.

Keep tracker status and implementation/PR status distinct. A merged PR is not automatically proof that all acceptance criteria or deployment requirements are complete. Use the project's completion rules; mark unknowns explicitly.

## Report and stop

Return the document path, short execution summary, next available tasks and outstanding blockers or questions. Suggest `execute update project <project>` for later refreshes.

This command writes the project plan only; it does not start tasks or change tracker state.
