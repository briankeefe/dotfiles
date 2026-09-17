# Release Check

Use for `execute release-check <ticket/PR/sha> [target]`, missing-change sweeps, or an explicit
request to prepare a release-branch merge. Apply `skill://execute`. Membership checks are read-only.

## Resolve the comparison

Resolve the repository/host, remote, default/project base and target branch or tag from the request
and repository release docs. Release names are project-specific and need not align across repos.
If several targets are plausible, ask which one; never choose a hotfix path implicitly.
Fetch the specific refs before comparing and use the fetched remote-tracking branch or verified tag,
not a stale local branch. Inspect installed CLI help before unfamiliar provider commands.

For a GitHub PR, `gh pr view <URL> --json state,mergedAt,mergeCommit,baseRefName,url` identifies its
merge commit. For tickets, inspect linked PRs and search the actual repo in the configured provider;
a title or commit-message match is a clue, not proof of complete ticket coverage. Include all linked
PRs relevant to the requested scope. Unmerged PRs have no merge commit to check.

## Check membership

After resolving concrete commit objects, use:

```text
git merge-base --is-ancestor <commit> <fetched-target-ref>
git branch -r --contains <commit>
git log <fetched-target-ref>..<fetched-base-ref> --oneline
```

- `--is-ancestor` exit 0 means the exact commit is reachable, 1 means it is not, and other exits
  are errors. Missing objects, shallow history or failed fetches are unknown, not "NOT IN".
- Reachability is exact-commit membership, not proof that behavior is enabled: later reverts or
  feature gates can undo it. Conversely, cherry-picks/rebases may deliver equivalent changes under
  different SHAs. When evidence suggests either case, inspect the patch/history and report exact
  ancestry separately from equivalent content; do not declare a ticket missing from SHA alone.
- `git log A..B` lists commits reachable from B but not A. `git log A...B` is the symmetric
  difference. `git diff A...B` shows B's changes since the merge base, as PR diffs normally do;
  it is not a list of missing commits. `git diff A B` compares the endpoint trees.
- Never conclude absence from an empty ticket-name search. Use linked PR/commit evidence.

For a sweep, use the requested repository scope and author/date/base filters. Retrieve all pages
or label the result as bounded; never silently cap a supposedly complete sweep. Fetch each repo's
own target. A missing branch is "target absent", not an empty release. Report per PR and repo:
URL, merge SHA, target, exact inclusion and any revert/equivalence caveat.

## Preparing a release merge (only when requested)

1. Confirm the target and strategy before changing anything. Fetch the resolved base and release
   refs and use an isolated integration branch/worktree based on the release target; reuse an
   assigned worktree where appropriate. Preserve unrelated and failed worktrees.
2. Merge the requested source locally. For conflicts, inspect both sides and release history:
   preserve intentional release gates/reverts rather than blindly taking the newer side.
   Unclear release intent requires clarification. Search for conflict markers with `grep` or
   `read :conflicts`, then run the repo's relevant verification without bypassing hooks.
3. Present the resulting changes, verification and unresolved risks. **STOP before a push to a
   shared release branch and obtain explicit approval.** Prefer the repository's reviewed PR
   process; a membership question never authorizes a merge, push, deployment or release.

## Output

For one ticket/PR, one line per repo with target, deciding SHA and `IN`, `NOT REACHABLE`, or
`UNKNOWN`, plus content/revert caveats when relevant. For a sweep, use a compact per-PR table.
Branch membership is not proof of deployment; consult `ops-facts.md` for live-state questions.
