# Actionable PRs

`execute actionable pr` finds open PRs with feedback needing the author's attention. This is read-only. Follow `skill://execute` for shared defaults.

1. Derive host, authenticated author and repository scope from the request, current repository and project docs. Default to the current repository, not an invented organization list; ask only if scope is unavailable.
2. Discover all open PRs in scope, including drafts, using the installed host CLI/API and complete pagination. Collect every PR's feedback using **Collect feedback** in `skill://execute/reference/update-pr.md`. Do not enter that document's edit/publication steps.
3. Read the full conversation and relevant current code before classifying feedback. Human and bot findings count by substance; approved reviews may still contain actionable questions or suggestions. Ignore empty messages, routine bot status and duplicates, not all bot comments. Read author replies for context.
4. Separate **needs change**, **needs answer**, **addressed in code awaiting reviewer confirmation**, **resolved**, and **uncertain**. Check actual thread resolution, replies and the current implementation. A later commit, an outdated anchor, a re-request or the author replying last does not prove a concern was addressed. Link the code/commit or reply supporting an addressed classification; disclose missing evidence.
5. List every PR with actionable feedback and identify the best next one: blocking valid concerns first, then unanswered substantive questions, then oldest feedback. Do not rank by comment volume or keywords alone. Include uncertain cases separately rather than silently discarding them.

For each candidate show its repository, PR number/title, draft status, URL, reviewer, linked exact feedback excerpt, affected `path:line` (or general discussion), current disposition with evidence, and next action. Distinguish historical inline locations from current-head locations. Offer `execute update-pr <URL>` for the selected PR; do not start it automatically.

If none qualify, report that within the inspected scope, with access/pagination gaps. Incomplete collection is not proof of no actionable feedback.
