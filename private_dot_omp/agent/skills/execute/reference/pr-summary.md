> Ported from /Users/brian/code/PR_SUMMARY.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# PR Summary Instructions

When the user types `execute pr summary`, follow these steps:

## Step 1: Fetch All Open PRs

Run `gh pr list` for each Dripos ecosystem repo to get full status fields (search doesn't support all of them):

```bash
gh pr list --repo Frostbyte-Technologies/Dripos \
  --author @me --state open --limit 100 \
  --json number,title,url,isDraft,reviewDecision,latestReviews,reviewRequests,mergeable,statusCheckRollup,createdAt,comments

gh pr list --repo Frostbyte-Technologies/Dripos-React-Partner \
  --author @me --state open --limit 100 \
  --json number,title,url,isDraft,reviewDecision,latestReviews,reviewRequests,mergeable,statusCheckRollup,createdAt,comments

gh pr list --repo Frostbyte-Technologies/Dripos-POS-React-Native \
  --author @me --state open --limit 100 \
  --json number,title,url,isDraft,reviewDecision,latestReviews,reviewRequests,mergeable,statusCheckRollup,createdAt,comments

gh pr list --repo Frostbyte-Technologies/Dripos-Dashboard-React-Native \
  --author @me --state open --limit 100 \
  --json number,title,url,isDraft,reviewDecision,latestReviews,reviewRequests,mergeable,statusCheckRollup,createdAt,comments

gh pr list --repo Frostbyte-Technologies/Dripos-React-Native \
  --author @me --state open --limit 100 \
  --json number,title,url,isDraft,reviewDecision,latestReviews,reviewRequests,mergeable,statusCheckRollup,createdAt,comments

gh pr list --repo Frostbyte-Technologies/Dripos-React-Order \
  --author @me --state open --limit 100 \
  --json number,title,url,isDraft,reviewDecision,latestReviews,reviewRequests,mergeable,statusCheckRollup,createdAt,comments

gh pr list --repo Frostbyte-Technologies/Lets-Go-Reader \
  --author @me --state open --limit 100 \
  --json number,title,url,isDraft,reviewDecision,latestReviews,reviewRequests,mergeable,statusCheckRollup,createdAt,comments
```

Run all 7 in parallel.

---

## Step 2: Filter Out Drafts

After fetching, **exclude all PRs where `isDraft: true`**. Do not show draft PRs anywhere in the output.

---

## Step 3: Compute Status for Each PR

For each PR, derive the following display values:

### Review Status
| `reviewDecision` value | Condition | Display |
|------------------------|-----------|---------|
| `"APPROVED"` | — | ✅ Approved |
| `"CHANGES_REQUESTED"` | Reviewer is back in `reviewRequests` (re-requested after pushing updates) | ⏳ Awaiting re-review |
| `"CHANGES_REQUESTED"` | Reviewer is NOT in `reviewRequests` | ❌ Changes requested |
| `"REVIEW_REQUIRED"` or `null` | — | ⏳ Awaiting review |

**Stale review detection**: When a PR author pushes new commits after receiving "changes requested", GitHub moves the reviewer back into `reviewRequests`. This means the feedback has been addressed and the PR is awaiting re-review — treat it the same as "Awaiting review" for sorting purposes (not "Needs attention").

### CI Status
Aggregate the `statusCheckRollup` array:
- All `"SUCCESS"` → ✅ passing
- Any `"FAILURE"` or `"ERROR"` → ❌ failing
- Any `"PENDING"` or `"IN_PROGRESS"`, none failing → ⏳ pending
- Empty / no checks → — (no CI)

### Merge Status
| `mergeable` value | Display |
|-------------------|---------|
| `"MERGEABLE"` | ✅ clean |
| `"CONFLICTING"` | ⚠️ conflicts |
| `"UNKNOWN"` | — |

### Reviewer Names
Build a combined list of people who have interacted with the PR:

**From `latestReviews`** (formal review actions):
- `@username (approved)` if state is `APPROVED`
- `@username (changes requested)` if state is `CHANGES_REQUESTED`
- `@username (commented)` if state is `COMMENTED`

**From `reviewRequests`** (requested but haven't reviewed yet):
- `@username (requested)`

**From `comments`** (standalone PR comments, not formal reviews):
- For each comment where `author.login` is not already in the above lists, add `@username (commented)`
- Deduplicate — only show each person once, preferring their formal review state if they have both
- Skip comments authored by yourself (the PR author)

---

## Step 4: Sort PRs by Priority

Sort the full list so the most urgent PRs appear first:

1. **❌ Changes requested** (not stale) — needs your action
2. **CI failing** — needs your action (regardless of review state)
3. **⚠️ Merge conflicts** — needs your action
4. **✅ Approved + CI green** — ready to merge
5. **⏳ Awaiting review / Awaiting re-review** — waiting on reviewers

Within each group, sort oldest first (by `createdAt`).

---

## Step 5: Format Output

### Header summary (counts by status):
```
Your open PRs — {TOTAL} total

🔴 Needs attention:  {N}  (changes requested / CI failing / conflicts)
✅ Ready to merge:   {N}  (approved + CI passing)
⏳ Awaiting review:  {N}
```

### Per-PR block:

```
{n}. {REPO-SHORTNAME} — {PR title} (#{number}){DRAFT badge if applicable}
   URL:
   {pr_url}
   Review: {review status emoji + label}  |  CI: {ci emoji + label}  |  Merge: {merge emoji + label}
   Reviewers: {reviewer list, or "(none yet)" if empty}
```

**Repo short names:**
- `Dripos`
- `Dripos-React-Partner`
- `Dripos-POS`
- `Dripos-Dashboard`
- `Dripos-Customer`
- `Dripos-Order-Web`
- `Lets-Go-Reader`

**CRITICAL**: Always put URLs on their own line with a `URL:` label above, to prevent hyperlink bleeding in the Claude Code UI.

---

## Example Output

```
Your open PRs — 4 total

🔴 Needs attention:  2  (changes requested / CI failing / conflicts)
✅ Ready to merge:   1  (approved + CI passing)
⏳ Awaiting review:  1

─────────────────────────────────────────────────────────────────

1. Dripos-React-Partner — fix: null prices syncing to locations (#2166)
   URL:
   https://github.com/Frostbyte-Technologies/Dripos-React-Partner/pull/2166
   Review: ❌ Changes requested  |  CI: ✅ passing  |  Merge: ✅ clean
   Reviewers: @john (changes requested)

2. Dripos — feat: add withholding fields to payout API (#3688)
   URL:
   https://github.com/Frostbyte-Technologies/Dripos/pull/3688
   Review: ⏳ Awaiting review  |  CI: ❌ failing  |  Merge: ✅ clean
   Reviewers: @sarah (requested)

3. Dripos — feat: add withholding fields to legacy payout API (#3701)
   URL:
   https://github.com/Frostbyte-Technologies/Dripos/pull/3701
   Review: ✅ Approved  |  CI: ✅ passing  |  Merge: ✅ clean
   Reviewers: @sarah (approved)

4. Dripos-React-Partner — fix: overtime calculation (#2155)
   URL:
   https://github.com/Frostbyte-Technologies/Dripos-React-Partner/pull/2155
   Review: ⏳ Awaiting review  |  CI: ⏳ pending  |  Merge: ✅ clean
   Reviewers: (none yet)

─────────────────────────────────────────────────────────────────
```

---

## Edge Cases

- **Repo returns empty list**: Skip it silently (don't show the repo at all)
- **All repos return empty**: Output "No open PRs found."
- **`mergeable` is `UNKNOWN`**: GitHub hasn't computed it yet — show `— (unknown)` and note it may resolve on refresh
- **CI field is empty array**: Show `— no CI`
- **Multiple reviews from same reviewer**: Use only their latest review state
