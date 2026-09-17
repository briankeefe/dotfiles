---
description: Project-neutral execute toolkit for tickets, PRs, verification, project planning and docs
---

Run the `execute` toolkit for: `$ARGUMENTS`

1. `read skill://execute` for dispatch, project discovery, safety gates and OMP tool conventions.
2. Route `$ARGUMENTS` using the skill's dispatch rules: named commands first, then PR URLs
   or tracker-resolved tickets. Empty input, `help` or unknown input shows help without starting work.
3. `read skill://execute/reference/<doc>` for the matched command and execute that workflow
   exactly, honoring every MUST, STOP and approval gate, and pass the remaining arguments
   (e.g. the ticket ID, PR URL, or project name).
