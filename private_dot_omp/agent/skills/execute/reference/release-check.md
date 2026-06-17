# Release Check Instructions

When the user asks **"is DRI-XXX / PR #N / commit X in release-NN?"**, **"which of my merged PRs aren't in release-NN?"**, or needs to **merge master into a release branch and resolve conflicts**, follow this. Triggered by `execute release-check <args>` or recognized in free text.

The recurring failure this prevents: re-deriving git plumbing every time, and the two-dot vs three-dot diff mistake.

## Environment

- Org: `Frostbyte-Technologies`. The 7 ecosystem repos:
  `Dripos`, `Dripos-React-Partner`, `Dripos-POS-React-Native`, `Dripos-Dashboard-React-Native`, `Dripos-React-Native`, `Dripos-React-Order`, `Lets-Go-Reader`.
- Release branches are named `release-NN` (e.g. `release-87`, `release-88`). **Release numbers are per-repo and not synchronized** — POS's `release-87` is unrelated to Dripos's `release-87`.
- **Always `git fetch -q origin release-NN master` first.** Compare against `origin/release-NN`, never a stale local branch.

## Core checks (memorize these four)

### 1. Is commit `<sha>` in release-NN?
```bash
git fetch -q origin release-NN
git merge-base --is-ancestor <sha> origin/release-NN && echo "IN release-NN" || echo "NOT in release-NN"
```
`merge-base --is-ancestor A B` exits 0 iff A is reachable from B. This is the authoritative inclusion test.

### 2. Which branches contain `<sha>`?
```bash
git branch -a --contains <sha> | grep -iE 'release|master'
```

### 3. Is ticket DRI-XXXX in release-NN?
A ticket maps to one or more merge commits. Two independent signals — use both, they can disagree:
```bash
# (a) commit-message grep — only finds it if the message mentions the ticket
git log origin/release-NN --oneline -i --grep="DRI-XXXX"
# (b) find the PR + its merge SHA, then run check #1 on that SHA
gh pr list --repo Frostbyte-Technologies/<repo> --search "DRI-XXXX in:title" --state all \
  --json number,title,state,mergedAt,mergeCommit
```
If grep is empty but the PR merged, the message just omits the ID — fall back to `--is-ancestor` on the merge commit. Never conclude "not included" from grep alone.

### 4. Commits / changes in B not in A
```bash
git log origin/master..origin/release-NN --oneline      # commits on release-NN not on master
```
**Two-dot vs three-dot — the classic trap:**
- `A..B` (two-dot): commits reachable from B but not A. Use for "what does B have that A lacks".
- `A...B` (three-dot): symmetric difference from the merge-base. **GitHub's PR/compare "Files changed" uses three-dot** (`git diff origin/master...origin/<branch>` = what the branch adds since it forked). When reproducing what a PR shows, use three-dot; when listing genuinely-missing commits, use two-dot.

## "My merged PRs not in release-NN" (cross-repo)

```bash
for repo in Dripos Dripos-React-Partner Dripos-POS-React-Native \
            Dripos-Dashboard-React-Native Dripos-React-Native Dripos-React-Order Lets-Go-Reader; do
  echo "=== $repo ==="
  gh pr list --repo Frostbyte-Technologies/$repo --author @me --state merged --base master --limit 50 \
    --json number,title,mergedAt,mergeCommit --jq '.[] | "\(.mergeCommit.oid) #\(.number) \(.title)"'
done
```
Then in each repo's local clone/worktree: `git fetch -q origin release-NN`, and for each merge SHA run check #1. A PR is "missing from release-NN" only if its merge commit is **not** an ancestor of `origin/release-NN`. Present a per-repo table: `#PR | title | mergedAt | in release-NN? (Y/N)`.

Skip a repo with no release-NN branch (`git branch -a --list 'origin/release-NN'` empty) — note it as "no release-NN branch".

## Merging master into a release branch (conflict resolution)

```bash
git fetch -q origin release-NN master
git worktree add -b release-NN-conflict-resolve /tmp/<repo>-release-NN-merge origin/release-NN
cd /tmp/<repo>-release-NN-merge
git merge origin/master            # resolve conflicts
# verify which side a contested commit is on before choosing:
git show -s --format='%ci %s' <sha-release> ; git show -s --format='%ci %s' <sha-master>
git merge-base --is-ancestor <sha> HEAD && echo "already here"
grep -rn '^<<<<<<<\|^=======\|^>>>>>>>' src/ | grep -v node_modules && echo "MARKERS REMAIN" || echo "clean"
```
Resolve **in favor of whichever side already shipped to release-NN** when a feature was intentionally gated/reverted there. Commit with `--no-verify` only if release hooks block, then push to the real branch: `git push origin release-NN-conflict-resolve:release-NN`. **STOP and confirm with the user before that push** — it writes to a shared release branch.

## Output

A short table answering exactly what was asked. For a single ticket/PR: one line per repo touched, `IN` / `NOT IN` with the deciding merge SHA. For a sweep: the per-repo merged-PR table above. State any grep/ancestor disagreement explicitly.
