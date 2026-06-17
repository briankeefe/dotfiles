> Ported from /Users/brian/code/EXECUTE_ACTIONABLE_PR.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# Execute Actionable PR Instructions

When the user types `execute actionable pr`:

## Workflow Steps

### 1. Fetch All Open PRs by User
Search for all open PRs authored by the current user across Dripos ecosystem repositories:

```bash
gh search prs --author=@me --state=open --json number,title,repository,url,updatedAt --limit 100
```

Filter to only Dripos ecosystem repos:
- `Frostbyte-Technologies/Dripos`
- `Frostbyte-Technologies/Dripos-React-Partner`
- `Frostbyte-Technologies/Dripos-POS-React-Native`
- `Frostbyte-Technologies/Dripos-Dashboard-React-Native`
- `Frostbyte-Technologies/Dripos-React-Native`
- `Frostbyte-Technologies/Dripos-React-Order`
- `Frostbyte-Technologies/Lets-Go-Reader`
- `Frostbyte-Technologies/Frostbyte-Tailwind`

### 2. Fetch Detailed PR Information
For each PR, fetch full details including reviews and comments:

```bash
gh pr view <PR-NUMBER> --repo <REPO> --json number,title,url,author,reviews,comments,latestReviews,updatedAt
```

### 3. Identify Actionable Feedback
A PR has **actionable feedback** if:

1. **Review with CHANGES_REQUESTED state** from a peer (not the author)
2. **Review comments or file comments** from peers (not the author) that suggest changes
3. **New comments since author's last commit** that ask questions or request changes

**Actionable indicators:**
- Review state: `CHANGES_REQUESTED`
- Comment contains: "can you", "could you", "please fix", "needs", "should", "must", question marks
- Review body is non-empty and from a different user

**NOT actionable:**
- APPROVED reviews
- Comments from the PR author themselves
- Empty/placeholder comments
- Bot comments

### 4. Find "Not Yet Looked At" PRs
Determine if feedback has been addressed by checking:

1. **No commits after the review/comment** - Indicates feedback not yet acted upon
2. **No author response to the comment** - No reply from author
3. **Review still shows CHANGES_REQUESTED** - Not resolved

Priority order:
1. PRs with `CHANGES_REQUESTED` reviews and no commits after review
2. PRs with unanswered peer comments/questions
3. Oldest actionable feedback first

### 5. Output Format

**CRITICAL**: Always put URLs on their own line with no other text to prevent hyperlink bleeding in Claude Code UI.

**If one PR with actionable feedback:**
```
Actionable PR: <PR-TITLE> (#<NUMBER>)

Repository: <REPO-NAME>

URL:
<PR-URL>

Last updated: <DATE>

Actionable feedback from <REVIEWER>:
---
<REVIEW-BODY or COMMENT-TEXT>
---

Status: <CHANGES_REQUESTED | COMMENTED>
Files affected: <FILE1, FILE2, ...> (if file-level comments)

Next action: Address the feedback above
```

**If multiple PRs with actionable feedback:**
Show ALL PRs with actionable feedback, each with their own section and URL:

```
Found <N> PRs with actionable feedback:

---

## 1. <PR-TITLE> (#<NUMBER>) - MOST URGENT

Repository: <REPO-NAME>

URL:
<PR-URL>

Actionable feedback from <REVIEWER>:
---
<REVIEW-BODY or COMMENT-TEXT>
---

Status: <CHANGES_REQUESTED | COMMENTED>
Last updated: <DATE>

---

## 2. <PR-TITLE> (#<NUMBER>)

Repository: <REPO-NAME>

URL:
<PR-URL>

Actionable feedback from <REVIEWER>:
---
<REVIEW-BODY or COMMENT-TEXT>
---

Status: <CHANGES_REQUESTED | COMMENTED>
Last updated: <DATE>

---

[Continue for all actionable PRs...]
```

**If no PRs with actionable feedback:**
```
No PRs with actionable feedback.

Your open PRs:
- #<NUMBER> - <TITLE> (no reviews yet)
- #<NUMBER> - <TITLE> (approved)
- #<NUMBER> - <TITLE> (awaiting review)
```

## Selection Priority

When choosing between multiple PRs with actionable feedback:

1. **CHANGES_REQUESTED over COMMENTED** - Reviews blocking merge take priority
2. **Oldest feedback first** - Address feedback that's been waiting longest
3. **Most comments** - More discussion indicates higher priority
4. **Project priority** - If tied, choose from higher priority project

## Example Command Flow

```bash
# User runs:
execute actionable pr

# You execute:
1. gh search prs --author=@me --state=open --json number,title,repository,url,updatedAt --limit 100
2. Filter to Dripos repos
3. For each PR:
   gh pr view <NUMBER> --repo <REPO> --json reviews,comments,author
4. Identify PRs with peer reviews/comments
5. Check if feedback is addressed (commits after review)
6. Choose highest priority PR with unaddressed feedback
7. Output PR details with actionable feedback highlighted
```

## Critical Rules

1. **Ignore self-comments** - Only peer feedback counts
2. **Ignore bot comments** - Only human reviewers
3. **Check timestamps** - Feedback after author's last commit is actionable
4. **Be specific** - Show exact feedback text, not summaries
5. **Show ALL actionable PRs** - List every PR with actionable feedback, not just one
6. **URL formatting** - ALWAYS put URLs on their own line with "URL:" label above
7. **Include URL** - Always include clickable PR link for each PR
8. **Show reviewer name** - Identify who gave the feedback

## Edge Cases

- **Draft PRs**: Include them, they can still have actionable feedback
- **Stale PRs**: Flag PRs with feedback older than 7 days
- **Multiple reviewers**: Show feedback from all reviewers, prioritize CHANGES_REQUESTED
- **Thread discussions**: If author responded but reviewer replied again, still actionable
