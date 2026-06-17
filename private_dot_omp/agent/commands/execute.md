---
description: Dripos execute toolkit — run `execute <command>` workflows (ticket, pr summary/review/update, e2e, sanity check, project planning, docs)
---

Run the Dripos `execute` toolkit for: `$ARGUMENTS`

1. `read skill://execute` for the dispatch table, environment, and Oh My Pi tool conventions.
2. Match `$ARGUMENTS` against the dispatch table (longest-prefix wins). If nothing matches
   or the argument is `help` / empty, show the command table from the skill and stop.
3. `read skill://execute/reference/<doc>` for the matched command and execute that workflow
   exactly — honor every MUST, STOP, and approval gate — passing the remaining arguments
   (e.g. the ticket ID, PR URL, or project name).
