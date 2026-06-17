> Ported from /Users/brian/code/EXECUTE_PR_REVIEW.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# Execute PR Review - Automated Pull Request Review Workflow

## Command
```bash
execute pr review [PR_LINK]
```

## Overview
This workflow automates comprehensive pull request reviews and formats feedback using the **PR Review Template** (see `skill://execute/reference/pr-review-template.md`). Reviews follow a consistent, concise format with HIGH/MEDIUM/LOW priority organization and Conventional Comments labels.

## Workflow Steps

### 1. Parse PR Link
- Accept PR link in format: `https://github.com/owner/repo/pull/NUMBER`
- Extract repository owner, name, and PR number
- Validate that the link is a valid GitHub PR URL

### 2. Fetch PR Information and Create Review Worktree
**CRITICAL: Never checkout branches in the user's main working directory.** Use a separate worktree to avoid disrupting ongoing development.

```bash
# Get PR info to determine branches
gh pr view [PR_NUMBER] --repo [OWNER/REPO] --json title,body,author,headRefName,baseRefName,files

# Fetch the PR branch from remote
git -C [REPO_PATH] fetch origin [headRefName]

# Create a worktree for the review in /tmp (isolated from main repo)
# Remove existing worktree if present, then create fresh
git -C [REPO_PATH] worktree remove /tmp/pr-review-[REPO]-[PR_NUMBER] --force 2>/dev/null || true
git -C [REPO_PATH] worktree add /tmp/pr-review-[REPO]-[PR_NUMBER] origin/[headRefName]
```

Then fetch the diff:
```bash
gh pr diff [PR_NUMBER] --repo [OWNER/REPO]
```

**Why worktrees:** This ensures the review process never touches the user's current branch, staged changes, or working directory. All file reads during review should use the worktree path (`/tmp/pr-review-[REPO]-[PR_NUMBER]/...`).

**Cleanup:** After the review is complete (posted or cancelled), remove the worktree:
```bash
git -C [REPO_PATH] worktree remove /tmp/pr-review-[REPO]-[PR_NUMBER] --force
```

### 3. Identify Changed Files
- Parse the diff to identify all changed files
- Group files by type (source code, tests, config, docs)
- Determine the primary language(s) and frameworks involved

### 3.1 CRITICAL: Understand What the Diff Shows
**The diff shows changes FROM the base branch TO the PR branch.** This is crucial for accurate review:

- Lines starting with `-` are being **removed** (exist in base, not in PR)
- Lines starting with `+` are being **added** (new in PR, not in base)
- Lines without prefix are **unchanged context**

**Common Mistake to Avoid:**
When reviewing, do NOT confuse the current state of a file with what the PR is changing. For example:
- If you read a file and see `request(url, "POST")` on line 161
- But the diff shows `+exportRows = await request(exportRoute, "POST", exportBody);`
- The PR IS adding `exportBody` - the `+` means this is the NEW code being introduced

**Verification Process:**
1. When claiming code is missing or wrong, check if the diff shows it being added with `+`
2. When claiming something should be removed, verify the diff shows it with `-`
3. If unsure, re-read the diff output focusing on the `+`/`-` prefixes
4. The base branch state is irrelevant - only the final PR state matters for review

### 4. Perform Code Review via Subagent
Spawn a `task` tool subagent with `agent: "code-reviewer"` and the code review system prompt below embedded inline as the assignment. (For a security-focused review, use `agent: "security-reviewer"` instead.) Spawn synchronously and wait for the subagent's findings before continuing.

Pass the full prompt below to the subagent, substituting the PR title, description, branches, changed-file list, and diff:

```
You are an expert code reviewer, combining the deep architectural knowledge of a principal engineer with the
precision of a sophisticated static analysis tool. Your task is to review the user's code and deliver precise, actionable
feedback covering architecture, maintainability, performance, and implementation correctness.

CRITICAL GUIDING PRINCIPLES
- **User-Centric Analysis:** Align your review with the user's specific goals and constraints. Tailor your analysis to what matters for their use case.
- **Scoped & Actionable Feedback:** Focus strictly on the provided code. Offer concrete, actionable fixes for issues within it. Avoid suggesting architectural overhauls, technology migrations, or unrelated improvements.
- **Pragmatic Solutions:** Prioritize practical improvements. Do not suggest solutions that add unnecessary complexity or abstraction for hypothetical future problems.
- **DO NOT OVERSTEP**: Do not suggest wholesale changes, technology migrations, or improvements unrelated to the specific issues found. Remain grounded in the immediate task of reviewing the provided code for quality, security, and correctness.

CRITICAL LINE NUMBER INSTRUCTIONS
Code is presented with line number markers "LINE│ code". These markers are for reference ONLY and MUST NOT be included in any code you generate.
Always reference specific line numbers in your replies to locate exact positions. Include a very short code excerpt alongside each finding for clarity.
Never include "LINE│" markers in generated code snippets.

Your review approach:
1.  First, understand the user's context, expectations, constraints, and objectives.
2.  Identify issues in order of severity (Critical > High > Medium > Low).
3.  Provide specific, actionable, and precise fixes with concise code snippets where helpful.
4.  Evaluate security, performance, and maintainability as they relate to the user's goals.
5.  Acknowledge well-implemented aspects to reinforce good practices.
6.  Remain constructive and unambiguous—do not downplay serious flaws.
7.  Especially look for high-level architectural and design issues:
    - Over-engineering or unnecessary complexity.
    - Potentially serious performance bottlenecks.
    - Design patterns that could be simplified or decomposed.
    - Areas where the architecture might not scale well.
    - Missing abstractions that would make future extensions much harder.
    - Ways to reduce overall complexity while retaining functionality.
8.  Simultaneously, perform a static analysis for common low-level pitfalls:
    - **Concurrency:** Race conditions, deadlocks, incorrect usage of async/await, thread-safety violations.
    - **Resource Management:** Memory leaks, unclosed file handles or network connections, retain cycles.
    - **Error Handling:** Swallowed exceptions, overly broad catch blocks, incomplete error paths.
    - **API Usage:** Use of deprecated or unsafe functions, incorrect parameter passing, off-by-one errors.
    - **Security:** Potential injection flaws (SQL, command), insecure data storage, hardcoded secrets, improper handling of sensitive data.
    - **Performance:** Inefficient loops, unnecessary object allocations in tight loops, blocking I/O on critical threads.
    - **Type Safety:** Unnecessary `as` casts that paper over upstream type issues. If a cast exists, investigate whether the root type (e.g., a repo return type) can be fixed instead.
    - **Timezone Handling:** Date/time formatting (especially with moment/dayjs) that assumes server timezone. Flag any `.format()` calls in business-critical code (accounting, payments, reporting) that don't explicitly handle timezones.
    - **Logging Standards:** Flag usage of `console.log`/`console.error`/`throw new Error` where the codebase has a structured or context-based logger available. Suggest the team's preferred logging pattern.
    - **DRY / Constant Extraction:** Repeated literal arrays or strings (e.g., `["PAYMENT", "AR"]`) used in multiple places that should be extracted to named constants.
9.  Where further investigation is required, be direct and suggest which specific code or related file needs to be reviewed.
10. Remember: Overengineering is an anti-pattern. Avoid suggesting solutions that introduce unnecessary abstraction or indirection.

SEVERITY DEFINITIONS
🔴 CRITICAL: Security flaws, defects that cause crashes, data loss, or undefined behavior (e.g., race conditions).
🟠 HIGH: Bugs, performance bottlenecks, or anti-patterns that significantly impair usability, scalability, or reliability.
🟡 MEDIUM: Maintainability concerns, code smells, test gaps, or non-idiomatic code that increases cognitive load.
🟢 LOW: Style nits, minor improvements, or opportunities for code clarification.

EVALUATION AREAS (apply as relevant to the project or code)
- **Security:** Authentication/authorization flaws, input validation (SQLi, XSS), cryptography, sensitive-data handling, hardcoded secrets.
- **Performance & Scalability:** Algorithmic complexity, resource leaks, concurrency issues, caching strategies, blocking I/O on critical threads.
- **Code Quality & Maintainability:** Readability, structure, idiomatic usage of the language, error handling patterns, documentation, modularity, separation of concerns.
- **Testing:** Unit/integration test coverage, handling of edge cases, reliability and determinism of the test suite.
- **Dependencies:** Version health, known vulnerabilities, maintenance burden, transitive dependencies.
- **Architecture:** Design patterns, modularity, data flow, state management.
- **Operations:** Logging, monitoring, configuration management, feature flagging.

OUTPUT FORMAT
For each issue use:

[SEVERITY] File:Line – Issue description
→ Fix: Specific solution (code example only if appropriate, and only as much as needed)

After listing all issues, add:
• **Overall Code Quality Summary:** (one short paragraph)
• **Top 3 Priority Fixes:** (quick bullets)
• **Positive Aspects:** (what was done well and should be retained)

---

PR Title: [title]
PR Description: [body]
Branch: [headRefName] -> [baseRefName]

Files changed:
[list of changed files with full worktree paths from /tmp/pr-review-[REPO]-[PR_NUMBER]/]

Diff:
[full output of: gh pr diff [PR_NUMBER] --repo [OWNER/REPO]]
```

### 5. Transform Findings to Conventional Comments
For each issue found by the code review subagent, convert to Conventional Comments format:

**Mapping Severity to Labels:**
- 🔴 CRITICAL → `issue (blocking):`
- 🟠 HIGH → `issue (blocking):` or `suggestion (security/performance):`
- 🟡 MEDIUM → `suggestion (non-blocking):` or `todo (non-blocking):`
- 🟢 LOW → `nitpick (if-minor):` or `polish (non-blocking):`

**Additional Labels:**
- Security issues → `issue (security):`
- Performance issues → `suggestion (performance):`
- Questions/clarifications → `question:`
- Style/formatting → `nitpick (non-blocking):`
- Well-written code → `kudos:` (max one per PR, only if genuinely impressive)

**Format Template:**
```
### [label] [decorations]: [subject]
**File: `path/to/file.js:line_number`**

[Detailed explanation from code review]

[Suggested fix or improvement if applicable]
```

**CRITICAL REQUIREMENTS:**
- **EVERY suggestion MUST specify the exact file path and line number** (e.g., `src/redux/checkout.js:740`). The line number must correspond to the line in the diff so it can be posted as an inline comment.
- **Keep the review concise** - aim for brevity while maintaining clarity
- **Maximum ~15-20 lines per issue** unless complexity requires more detail
- **No testing recommendations or verification checklists** - focus on code analysis only
- **No follow-up requests or recommendations** - provide complete feedback in one pass
- **No summary sections** - just the individual comments organized by severity
- **One kudos allowed** - if something is genuinely well-written or clever, include at most ONE `kudos:` comment per PR. Keep it brief and specific (e.g., "kudos: elegant deduplication pattern"). Do not force it — only include if something truly stands out.

### 6. Format Final Review
**MUST** follow the template from `skill://execute/reference/pr-review-template.md`:

```markdown
# Code Review: PR #[NUMBER] - [TITLE]

**Status:** [✅ APPROVED | ⚠️ APPROVED with suggestions | ❌ REQUEST CHANGES]

## Issues

### HIGH Priority
[Critical issues with file:line references]

### MEDIUM Priority
[Important but non-blocking issues]

### LOW Priority
[Nice-to-haves, nitpicks]
```

**Key requirements:**
- Use status emoji indicators (✅/⚠️/❌)
- Organize by HIGH/MEDIUM/LOW priority
- Include file:line for every issue
- **No summary section** - get straight to the issues
- **One kudos max** - at most one `kudos:` comment if something genuinely stands out
- Use Conventional Comment labels (issue, suggestion, question, kudos, etc.)

### 7. Critical Self-Review (Native Challenge)
**CRITICAL STEP - DO NOT SKIP**: Before presenting the review to the user, perform a self-challenge pass over each comment yourself. Apply this rubric to every draft comment:

```
CRITICAL REASSESSMENT – Do not automatically agree with your own findings.

For EACH comment, answer honestly:
1. Is the issue real or imagined? (re-read the actual diff lines — verify with + prefixes)
2. Is it actually in scope of this PR, or is it pre-existing code this PR didn't touch?
3. Does the suggested fix make sense given the rest of the codebase?
4. Am I overlooking a legitimate reason for the current implementation?
5. Is this a genuine concern, or a style nitpick that adds no real value?

Identify and mark comments as:
- INVALID: wrong, based on misunderstanding, or missing context → REMOVE
- WEAK: technically true but not worth flagging → REMOVE unless blocking
- VALID: real concern, in scope, actionable → KEEP
```

**Actions based on self-challenge:**
- **Remove** all INVALID and WEAK comments
- **Revise** any comment that needs clearer justification
- **Keep only** genuinely VALID concerns with accurate analysis
- **Verify** each remaining comment by re-reading the actual diff if needed

### 8. Present Review to User
Display the complete review (after validation):
1. List all comments organized by priority
2. Display blocking vs non-blocking counts
3. Highlight any critical security or bug issues

Ask user:
```
Review prepared with [X] comments ([Y] blocking, [Z] non-blocking).

Would you like me to:
1. Post this review to GitHub
2. Make adjustments to the comments
3. Cancel the review
```

### 9. Post Review to GitHub (if approved)
**Use the helper script** at `/Users/brian/code/scripts/gh-pr-review-post.sh`. This handles HEAD SHA lookup, the `comfort-fade` preview header (required for line-pinned inline comments), and JSON construction automatically.

```bash
/Users/brian/code/scripts/gh-pr-review-post.sh \
  --repo OWNER/REPO \
  --pr PR_NUMBER \
  --event [APPROVE|REQUEST_CHANGES|COMMENT] \
  --body "Short review summary" \
  --comment "src/path/to/file.js:LINE:**label:** Comment body" \
  --comment "src/other/file.ts:LINE:**label:** Another comment"
```

**`--comment` format:** `PATH:LINE:BODY` where:
- `PATH` is the repo-root-relative file path (must match the diff)
- `LINE` is the **new-file line number** that appears in a diff hunk
- `BODY` is the full comment text (Conventional Comments label included)
- Use `--comment-left` for comments on removed lines (LEFT side)

**CRITICAL — line numbers must be in a diff hunk:**
- Lines that exist in the file but are NOT part of any diff hunk will be silently dropped (`line: null`)
- Only lines that appear in a `@@` hunk (context, additions, or deletions) are valid
- For new files (`@@ -0,0 +1,N @@`), all N lines are valid
- Use `gh pr diff PR_NUMBER --repo OWNER/REPO` to identify valid lines

**Do NOT use the reviews API directly without the comfort-fade header** — inline comments will be accepted but silently become file-level comments with `line: null`.

**Dry-run before posting:**
```bash
/Users/brian/code/scripts/gh-pr-review-post.sh --repo ... --pr ... --comment ... --dry-run
```

**Event types** (based on blocking issues):
- `APPROVE` — no blocking issues
- `REQUEST_CHANGES` — has blocking issues
- `COMMENT` — only suggestions/questions

### 10. Confirmation
After posting:
```
✅ Review posted successfully!

View the review: [PR_LINK]

Summary:
- [X] total comments
- [Y] blocking issues
- [Z] suggestions
- Review status: [Approved/Changes Requested/Commented]
```

## Usage Examples

### Basic PR Review
```bash
execute pr review https://github.com/Frostbyte-Technologies/Dripos/pull/123
```

### Review with Specific Model
```bash
execute pr review https://github.com/Frostbyte-Technologies/Dripos-React-Partner/pull/456 using gemini-2.5-flash
```

### Security-Focused Review
```bash
execute pr review https://github.com/Frostbyte-Technologies/Dripos/pull/789 focus on security
```

## Review Quality Guidelines

### Comment Structure
Each comment should include:
1. **Clear label and decoration** (e.g., `issue (blocking):`)
2. **Specific file and line reference**
3. **Detailed explanation** of the issue/suggestion
4. **Actionable recommendation** when applicable
5. **Context and reasoning** in discussion section

### Best Practices
- ✅ **DO**: Be specific with file paths and line numbers for EVERY suggestion
- ✅ **DO**: Keep reviews concise (aim for brevity while maintaining clarity)
- ✅ **DO**: Provide code examples for suggestions
- ✅ **DO**: Explain the "why" behind feedback
- ✅ **DO**: Self-challenge all comments before posting (Step 7)
- ✅ **DO**: Read actual code to verify claims, not just diffs
- ✅ **DO**: Ensure all suggestions are within the PR diff scope
- ❌ **DON'T**: Use vague or generic comments
- ❌ **DON'T**: Include testing recommendations or verification checklists
- ❌ **DON'T**: Include summary sections, recommendations, or follow-up requests
- ❌ **DON'T**: Write overly verbose reviews (keep each issue to ~15-20 lines max)
- ❌ **DON'T**: Post without user approval
- ❌ **DON'T**: Skip the critical self-review step

### Blocking vs Non-Blocking Criteria

**Blocking Issues:**
- Security vulnerabilities
- Critical bugs or logic errors
- Breaking changes without migration path
- Data corruption risks
- Missing critical tests
- Failed builds or test suites

**Non-Blocking Suggestions:**
- Performance optimizations
- Code style improvements
- Refactoring opportunities
- Documentation enhancements
- Optional test additions
- Best practice recommendations

## Special Cases

### Large PRs
For PRs with many files:
1. Group comments by concern area
2. Prioritize most critical issues first
3. Consider suggesting breaking into smaller PRs
4. Focus review on high-risk changes

### Documentation/Config PRs
- Verify accuracy of documentation
- Check for broken links or references
- Validate configuration syntax
- Ensure examples are correct

### Test-Only PRs
- Verify test coverage improvements
- Check for flaky or brittle tests
- Validate test assertions
- Ensure tests are maintainable

### Dependency Updates
- Review changelog for breaking changes
- Check for security vulnerabilities
- Verify compatibility with codebase
- Ensure tests pass with new versions

## Integration with Existing Workflows

This command integrates with:
- **execute actionable pr**: Find PRs needing review
- **execute [ticket]**: Review PR created by ticket workflow
- **execute pr summary**: See all PRs across ecosystem

## Notes

- **CRITICAL**: Always self-challenge review comments before presenting to user (Step 7 — do it yourself, no subagent required)
- **CRITICAL**: Never checkout branches in the user's main repo - always use the `/tmp/pr-review-*` worktree
- Always show review comments to user before posting (after self-validation)
- Use appropriate model based on PR complexity
- For security-critical code, note it in the subagent prompt to focus extra attention on security evaluation areas (or use `agent: "security-reviewer"`)
- Include context from PR description in review
- Reference related issues/PRs when relevant
- Follow team's coding standards and conventions
- Read actual code from the worktree to verify claims, not just diffs
- Question your own assumptions - be brutally honest about invalid comments
- Always clean up the worktree after the review is complete

---

*This workflow combines automated code review with human judgment to provide high-quality, actionable feedback using industry-standard Conventional Comments format.*
