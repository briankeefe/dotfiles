> Ported from /Users/brian/code/EXECUTE_UPDATE_PROJECT.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# Execute Update Project Instructions

When the user types `execute update project <ProjectName>` (e.g., `execute update project Payouts`):

## Workflow Steps

### 1. Locate Project Documentation
- Find the project file in `/Users/brian/code/ProjectInfo/<ProjectName>.md`
- Example: `Payouts` → `/Users/brian/code/ProjectInfo/Payouts.md`
- If file doesn't exist, notify user and exit

### 2. Extract Project Context
Read the project documentation to identify:
- Linear project ID (if present)
- Associated ticket IDs (DRI-XXX format)
- Related GitHub PRs and repositories
- Current project status and phase

### 3. Fetch Linear Updates
For each ticket ID found in the project doc:
```bash
linear issue view <TICKET-ID> --no-comments --no-pager
```

Gather:
- Current ticket status (unstarted, started, completed, canceled)
- Updated descriptions or acceptance criteria
- Recent activity or status changes

### 4. Fetch GitHub PR Updates
For each PR URL or ticket mentioned in the project doc:
```bash
# Search for PRs by ticket ID
gh search prs --state=all "<TICKET-ID>" --json number,title,state,url,repository,isDraft,author

# Or get specific PR details
gh pr view <PR-NUMBER> --repo <REPO> --json number,title,state,url,isDraft,reviews,author
```

Gather:
- PR status (open, merged, closed, draft)
- Review status
- Merge/close dates
- Any blocking issues

### 5. Update Project Documentation
Systematically update the project file with:
- **Ticket statuses**: Update status indicators (✅, 🔄, ❌, ⏸️, 🚫)
- **PR information**: Add/update PR numbers, states, and links
- **Blocking information**: Update dependencies and blockers
- **Current status summary**: Refresh the status table with latest info
- **Timestamp**: Update "Last Updated" timestamp at bottom

**Status Legend**:
- ✅ `COMPLETE` - PR merged
- 🔄 `IN REVIEW` - PR open and ready for review
- ⚠️ `IN REVIEW` - PR open as draft or needs changes
- ✅ `AVAILABLE` - Ready to start, no blockers
- ⏸️ `BLOCKED` - Blocked by dependencies
- ❌ `NOT STARTED` - Not yet started
- 🚫 `HOLD` - On hold pending external factors
- ⏪ `REVERTED` - Previously merged but reverted

### 6. Present Summary
Show user a concise summary of updates:
- Number of tickets updated
- Status changes (e.g., "DRI-765 moved from draft to review")
- New PRs discovered
- Blocked tickets
- Recommended next actions

## Critical Rules

1. **Preserve content structure** - Only update status fields, don't reorganize or rewrite sections
2. **Maintain existing formatting** - Keep tables, lists, and headers as-is
3. **Add timestamp** - Always update the "Last Updated" date
4. **Be factual** - Only add information from Linear/GitHub, no assumptions
5. **Minimal changes** - Update only what has changed since last update

## Example Command Flow

```bash
# User runs:
execute update project Payouts

# You execute:
1. Read /Users/brian/code/ProjectInfo/Payouts.md
2. linear issue view DRI-765 --no-comments --no-pager
3. linear issue view DRI-767 --no-comments --no-pager
   # ... (for each ticket in doc)
4. gh pr view 2179 --repo Frostbyte-Technologies/Dripos-React-Partner --json state,isDraft,reviews
   # ... (for each PR in doc)
5. Update ProjectInfo/Payouts.md with new statuses
6. Present summary to user
```

## Output Format

**Summary Example**:
```
Updated Payouts project documentation with latest status from Linear and GitHub:

✅ Completed (newly merged):
  - DRI-761: PR #2171 merged

🔄 In Review (status changed):
  - DRI-765: PR #2179 now ready for review (was draft)

⏸️ Blocked:
  - DRI-767: Still blocked by DRI-765, DRI-824

❌ Not Started:
  - DRI-824, DRI-820, DRI-758

📊 Progress: 2/13 complete, 3 in review, 2 blocked, 6 available/not started

💡 Next Available: DRI-764, DRI-768

Last updated: October 8, 2025
```
