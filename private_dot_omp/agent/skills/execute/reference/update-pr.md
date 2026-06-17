> Ported from /Users/brian/code/EXECUTE_UPDATE_PR.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# Execute Update PR - Address Reviewer Feedback Workflow

## Command
```bash
execute update-pr [PR_URL]
```

## Overview
This workflow reads all open reviewer feedback on a pull request, triages which comments are valid, makes the necessary code changes, and drafts GitHub replies for every comment — including polite explanations for items being declined.

**Two mandatory confirmation gates — nothing happens without your approval:**
1. **Triage gate** (Step 4) — confirm which comments to fix, reply to, or decline before any code changes
2. **Reply gate** (Step 8) — review all drafted replies and the code diff before anything is pushed or posted

---

## Workflow Steps

### Step 1: Identify PR

**If `$ARGUMENTS` contains a URL** (`https://github.com/OWNER/REPO/pull/NUMBER`):
- Parse owner, repo name, and PR number from the URL
- Determine the local repo path from the repo name (e.g., `/Users/brian/code/Dripos-React-Partner`)

**If `$ARGUMENTS` is empty:**
- Auto-detect from the current git branch:
```bash
gh pr view --json number,title,url,headRefName,baseRefName,repository
```
- If no PR is found for the current branch, stop and ask the user for the PR URL

---

### Step 2: Fetch All Reviewer Feedback

Fetch all three feedback sources in parallel:

```bash
# 1. Reviews — overall state and top-level review body
gh api repos/OWNER/REPO/pulls/PR_NUMBER/reviews

# 2. Inline review comments — line-specific comments attached to the diff
gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments --paginate

# 3. General PR issue comments — comments posted at the bottom of the PR page
gh api repos/OWNER/REPO/issues/PR_NUMBER/comments --paginate
```

**Filtering rules:**
- **Skip self-comments** — exclude any comment where `user.login` matches the PR author
- **Skip bots** — exclude any `user.login` ending in `[bot]` or containing `bot`
- **For inline threads** — only process the top-level comment (`in_reply_to_id == null`); read the full thread for context but don't create duplicate triage entries
- **Skip already-resolved threads** — if the PR author's reply is the latest message in the thread AND the reviewer has not replied since, consider the thread resolved and skip it
- **Skip APPROVED reviews with empty body** — no action needed

Also fetch the PR diff to understand current state:
```bash
gh pr diff PR_NUMBER --repo OWNER/REPO
```

---

### Step 3: Triage Feedback

For EACH piece of unresolved feedback, perform a self-challenge to assess validity. Do this yourself — read the real code and challenge each comment honestly before categorizing:

```
CRITICAL TRIAGE — Evaluate each comment honestly before categorizing.

For each comment:
1. Read the actual code at the referenced file + line (not just the diff)
2. Is the concern real, or based on misreading the code?
3. Is this something that should change, or is the current approach intentional?
4. Has a recent commit already addressed this without a reply?

Categories:
- FIX:     Valid feedback → requires a code change + reply describing what changed
- REPLY:   Valid question or concern → needs an explanation, no code change
- DECLINE: We disagree or it's not applicable → needs a polite explanation why

Remove anything that's clearly based on misreading the code.
```

Build a triage table for all items:

| # | Reviewer | Location | Comment Summary | Category | Proposed Action |
|---|----------|----------|-----------------|----------|-----------------|
| 1 | @alice | `src/foo.js:42` | "Missing null check" | FIX | Add null guard before accessing `data.user` |
| 2 | @alice | General review | "Could you add a test?" | REPLY | Explain existing test coverage at `__tests__/foo.test.js:15` |
| 3 | @bob | `src/bar.js:10` | "This looks redundant" | DECLINE | Explain why this is intentional for readability |

---

### Step 4: MANDATORY STOP — Triage Approval

**DO NOT make any code changes until the user explicitly approves the triage.**

Present the complete triage table and ask:

```
Found [N] reviewer comments requiring attention. Here's my triage:

[Triage table]

Plan:
- FIX ([X] items): I'll make code changes and reply with what changed
- REPLY ([Y] items): I'll post an explanation, no code change
- DECLINE ([Z] items): I'll post a polite explanation of why we're not changing it

Does this look right? Type "looks good" to proceed, or tell me what to adjust.
```

**STOP. Wait for explicit user approval before proceeding.**

If the user adjusts any categories, update the triage table and confirm again before continuing.

---

### Step 5: Address FIX Items

For each approved FIX item, make the code change in the **current worktree**. Do NOT create a new worktree or switch branches.

**Rules:**
- Make the **minimal change** required — do not refactor surrounding code
- Match existing codebase patterns exactly
- For each change, record: what file was modified, what line(s) changed, and a one-sentence summary (used in Step 7 to compose the reply)
- Follow all code standards from AGENTS.md (no class components, no let/var reassignment, no mutation, etc.)

---

### Step 6: Verify Changes

After all FIX items are addressed:

```bash
# Check formatting
yarn prettier:check   # or yarn prettier-check (depends on project)

# Run tests if they exist
yarn test
```

If verification fails due to changes you made, fix them before proceeding. Do NOT fix pre-existing failures.

---

### Step 7: Draft Replies

For EVERY comment in the triage (FIX, REPLY, and DECLINE), compose a concise GitHub reply.

**FIX replies** — describe what changed, referencing specific code:
```
Done! Added a null guard before accessing `data.user` — if `data` is 
undefined, the function now returns early. See line 42 of `src/foo.js`.
```

**REPLY replies** — answer the question directly:
```
Good catch — the `nullUser` scenario is already covered in 
`src/__tests__/foo.test.js:15`. I didn't add a separate test here 
to avoid duplicating that coverage.
```

**DECLINE replies** — polite, with a clear reason:
```
Intentional! The apparent redundancy here is for readability — this 
function is called from three different contexts and collapsing it 
makes the call sites harder to follow. Happy to revisit if you feel 
strongly about it.
```

**Guidelines:**
- Keep replies short (2–4 sentences max)
- Reference specific line numbers or test files when helpful
- Never be defensive — treat every comment as coming from someone who wants the code to be better
- For DECLINE: acknowledge the reviewer's intent even while explaining why you're keeping it

---

### Step 8: MANDATORY STOP — Reply Approval

**DO NOT push code or post any replies until the user explicitly approves.**

Present the full set of proposed replies, grouped by comment:

```
Here's what I'll push and post. Please review:

---
FIX — @alice on src/foo.js:42 ("Missing null check")
Code change: Added null guard at line 42
Reply: "Done! Added a null guard before accessing `data.user`..."

---
REPLY — @alice, General review ("Could you add a test?")
Reply: "Good catch — the `nullUser` scenario is already covered in..."

---
DECLINE — @bob on src/bar.js:10 ("This looks redundant")
Reply: "Intentional! The apparent redundancy here is for readability..."

---

Ready to push and post all replies? Type "yes" to proceed, or let me know 
which replies to edit first.
```

**STOP. Wait for explicit user approval before pushing or posting.**

---

### Step 9: Commit & Push

Once approved, commit all code changes and push:

```bash
git add .

# Commit message lists what was addressed
git commit -m "fix: address PR review feedback

$(for each FIX item: "- [one-line summary] (requested by @reviewer)")"

git push
```

---

### Step 10: Post GitHub Replies

After pushing, post replies in triage order so they reference the latest committed code.

**For inline review comments** (line-specific):
```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments \
  --method POST \
  --field body="[reply text]" \
  --field in_reply_to=[COMMENT_ID]
```

**For general PR issue comments** (bottom of PR):
```bash
gh api repos/OWNER/REPO/issues/PR_NUMBER/comments \
  --method POST \
  --field body="[reply text]"
```

Post all replies before offering to re-request review.

---

### Step 11: Re-request Review (Optional)

After posting all replies, offer to re-request review from the reviewers who left CHANGES_REQUESTED:

```
All replies posted! Would you like me to re-request review from the 
original reviewers? (@alice, @bob)
```

If yes:
```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/requested_reviewers \
  --method POST \
  --field 'reviewers[]=alice' \
  --field 'reviewers[]=bob'
```

---

### Step 12: Summary

```
PR update complete!

PR:
[PR_URL]

Results:
- [X] code changes committed and pushed (FIX)
- [Y] explanation replies posted (REPLY)
- [Z] polite declines posted (DECLINE)

Review re-requested from: @alice, @bob
(or "Review re-request skipped")
```

---

## Critical Rules

| Rule | Description |
|------|-------------|
| 1 | **TRIAGE GATE (Step 4)** — No code changes before user approves triage — NEVER skip |
| 2 | **REPLY GATE (Step 8)** — No push or posting before user approves replies — NEVER skip |
| 3 | **Work in current worktree** — Do NOT create a new worktree or switch branches |
| 4 | **Read actual code** — Validate every comment against the real file, not just the diff |
| 5 | **Minimal changes only** — Fix exactly what was requested, no additional refactoring |
| 6 | **Reply to every comment** — Even declined items get a polite, reasoned response |
| 7 | **Push before posting replies** — Code should be live before replies reference it |
| 8 | **Skip resolved threads** — Don't re-reply to already-addressed comment chains |
| 9 | **Ignore self-comments and bots** — Only peer human reviewer feedback counts |

---

## Edge Cases

- **No unresolved feedback**: Report to user — "All comments appear resolved. Nothing to address."
- **PR already approved**: Still fetch comments — there may be non-blocking suggestions worth addressing
- **Multiple reviewers with conflicting feedback**: Flag the conflict in the triage step and ask user to decide
- **Comment already replied to by author**: Skip unless the reviewer has replied again after the author's reply
- **Outdated inline comments** (file changed since comment): Note in triage as "outdated — file has changed" and still draft a reply acknowledging and explaining the current state
- **Draft PR**: Do not re-request review if the PR is still in draft state

---

## Integration with Existing Workflows

- **execute actionable pr** → finds which PRs need attention → then run this command
- **execute pr review** → reviewer posts feedback → then run this command to respond
- **execute [ticket]** → creates the PR → reviewers comment → then run this command

---

*This workflow ensures reviewer feedback is addressed systematically, with full human oversight at every step that touches code or GitHub.*
