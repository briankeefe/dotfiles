> Ported from /Users/brian/code/EXECUTE_NEXT_TASK.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# Execute Next Task Instructions

When the user types `execute next task [ProjectName]` (e.g., `execute next task PAYOUTS`):

## Workflow Steps

### 1. Locate Project Documentation
- Find the project file in `/Users/brian/code/ProjectInfo/<ProjectName>.md`
- Example: `PAYOUTS` → `/Users/brian/code/ProjectInfo/PAYOUTS.md`
- If file doesn't exist, notify user and exit

### 2. Parse Project Status
Read the project documentation and identify:
- **AVAILABLE tickets**: Tickets marked as ✅ AVAILABLE or similar ready-to-start status
- **NOT STARTED tickets**: Tickets marked as ❌ NOT STARTED with no blockers
- **BLOCKED tickets**: Tickets with ⏸️ BLOCKED status
- **IN REVIEW tickets**: Tickets with 🔄 IN REVIEW status
- **COMPLETE tickets**: Tickets with ✅ COMPLETE status

### 3. Filter for Next Available Task
Apply this logic in order:

1. **Exclude completed, in review, blocked, and on-hold tickets**
2. **Look for AVAILABLE tasks** (explicitly marked as ready to start)
3. **Check NOT STARTED tasks** for any without dependencies/blockers
4. **If multiple available**, choose based on:
   - Priority order in the doc (phase/track structure)
   - Dependency chain (foundation before features)
   - Simplicity (quick wins if tied)
   - Notes/recommendations in the doc

### 4. Output Format

**If one task available:**
```
Next task: DRI-XXX

[Output full ticket details from Linear]
```

**If multiple tasks available:**
```
Next recommended task: DRI-XXX

[Output full ticket details from Linear]

Other available tasks:
- DRI-YYY: [brief description]
- DRI-ZZZ: [brief description]
```

**If no tasks available:**
```
No tasks available.

Reason: [Explain why - all complete, all blocked, waiting for reviews, etc.]

Current blockers:
- DRI-XXX: Blocked by [dependencies]
- DRI-YYY: Blocked by [dependencies]

In review (waiting for merge):
- DRI-AAA: PR #XXXX
- DRI-BBB: PR #YYYY
```

## Selection Priority

When choosing between multiple available tasks:

1. **Foundation first** - Tasks in earlier phases (Phase 1 before Phase 2)
2. **Unblock others** - Tasks that unblock the most other tasks
3. **Quick wins** - Simple tasks when priority is equal
4. **Explicit recommendations** - Follow "Next Available Tasks" section if present

## Example Command Flow

```bash
# User runs:
execute next task PAYOUTS

# You execute:
1. Read /Users/brian/code/ProjectInfo/PAYOUTS.md
2. Parse current status table
3. Identify DRI-764 and DRI-768 as available
4. Choose DRI-764 (appears first in recommendations)
5. linear issue view DRI-764 --no-comments --no-pager
6. Output full ticket details
```

## Critical Rules

1. **Always fetch latest from Linear** - Don't rely solely on cached doc data
2. **Be factual** - Only recommend tasks that are truly unblocked
3. **Explain reasoning** - If choosing between multiple, say why
4. **Update project doc** - If status has changed, mention it
5. **Respect phase order** - Foundation before features, unless doc says otherwise
