> Ported from /Users/brian/code/EXECUTE_TICKET.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# Execute Ticket Workflow

When the user types `execute [ticket-name]` or `execute DRI-XXX`:

---

## Workflow Overview

```
[Fetch] → [Context] → [Branch] → [Plan] → [Validate] → [Approve] → [Write Tests] → [Implement] → [Verify Tests] → [Review] → [Scope Check] → [E2E Test] → [PR] → [Docs]
   │          │          │          │          │           │            │              │             │             │           │            │          │        │
 Linear    Validate     Git    subagent   subagent     User        Jest/TDD       direct        Jest        subagent    self-check  browser    GitHub   Markdown
   CLI     Context     Setup    (plan)    (validate)               (RED)          edits       (GREEN)     (codereview) (challenge)    tool       CLI      File
```

### Tool Reference

| Step | Tool | Purpose |
|------|------|---------|
| 4. Plan | `task` subagent (`agent: "planner"`) | Break down ticket into phases and tasks |
| 5. Validate | `task` subagent (`agent: "critic"`) | Critical analysis and gap identification |
| 10. Review | `task` subagent (`agent: "code-reviewer"`) | Code quality, security, patterns |
| 11. Scope | Do-it-yourself self-challenge | Verify requirements met, zero scope creep |

---

## Workflow Steps

### Step 1: Fetch Ticket

**Tool**: Linear CLI

Use Linear CLI to retrieve ticket details:

```bash
linear issue view <TICKET-ID> --no-comments --no-pager
```

- Ticket ID format: `DRI-XXX` (e.g., `DRI-758`)
- Parse: title, description, acceptance criteria
- **Note**: Linear CLI is already configured and authenticated

---

### Step 2: Validate Ticket Context

**CRITICAL**: Verify the ticket has sufficient context before proceeding.

**Check for:**
- [ ] Clear problem statement or feature description
- [ ] Defined acceptance criteria or success metrics
- [ ] Enough technical detail for implementation approach
- [ ] Context about related systems or dependencies

#### If Context is INSUFFICIENT:

1. **DO NOT PROCEED** to branch creation or planning
2. Generate a polite, professional message (2-4 sentences) requesting clarification
3. Output the message for user to paste into Linear chat
4. **STOP workflow** until ticket is updated

**Message Template:**
```
Hey! I took a look at DRI-XXX and want to make sure I'm on the right track
before diving in. [Specific question about unclear aspect]. Could you provide
a bit more detail on [specific area]? Just want to make sure I nail this on
the first try.
```

#### If Context is SUFFICIENT:
Proceed to Step 3

---

### Step 3: Prepare Clean Worktree & Branch

**CRITICAL**: Must happen BEFORE any planning or implementation work.

#### Why Worktrees?
Using git worktrees allows multiple agents to work on different tickets in parallel without conflicts. Each ticket gets its own isolated working directory with its own `node_modules`.

#### Pre-Step: Determine Project Context

**BEFORE creating a worktree**, check if the ticket belongs to a project:

```bash
# Check ProjectInfo directory for related project
ls /Users/brian/code/ProjectInfo/

# Read project file to find:
# 1. Which project-release branch to use (if any)
# 2. Which repository the ticket belongs to
# 3. Any special instructions
```

**If ticket is in a project doc:**
- Use the project-release branch as base (e.g., `origin/project-release/payroll-dashboard`)
- Target PRs to that project-release branch

**If ticket is NOT in any project:**
- Use `origin/master` as base
- Target PRs to `master`

#### Step-by-Step Verification:

```bash
# 1. Navigate to main repository
cd /Users/brian/code/[repository-name]

# 2. Fetch latest from remote
git fetch origin

# 3. Check for project-release branch (if ticket is part of a project)
git branch -a | grep project-release

# 4. Create worktree with new branch
#    Format: git worktree add <path> -b <branch-name> <base-branch>

# If using project-release branch:
git worktree add ../[repository-name]-dri-XXX -b briankeefe/dri-XXX-short-description origin/project-release/[project-name]

# OR if no project-release (use master):
git worktree add ../[repository-name]-dri-XXX -b briankeefe/dri-XXX-short-description origin/master

# 5. Navigate to worktree
cd ../[repository-name]-dri-XXX

# 6. VERIFY branch created and location
git branch --show-current  # MUST match new branch name
pwd  # MUST be in worktree directory

# 7. Install dependencies
yarn install  # or npm install
```

**Worktree path**: `/Users/brian/code/[repository-name]-dri-XXX`
**Branch naming**: `briankeefe/dri-{ticket-number}-{short-kebab-case-description}`

#### Example:
```bash
# For DRI-1490 in Dripos-React-Partner with project-release branch:
cd /Users/brian/code/Dripos-React-Partner
git fetch origin
git worktree add ../Dripos-React-Partner-dri-1490 -b briankeefe/dri-1490-quick-links-info origin/project-release/payroll-dashboard
cd ../Dripos-React-Partner-dri-1490
yarn install
```

**Validation Checkpoint:**
- [ ] Worktree created at correct path
- [ ] Currently on a NEW branch (not master/main/project-release)
- [ ] Branch created from correct base (project-release if exists, else master)
- [ ] Dependencies installed in worktree's own `node_modules`
- [ ] Working directory is the worktree, NOT the main repo

**If ANY validation fails, STOP and fix before planning**

---

#### Parallel Execution Considerations

When multiple agents work in parallel on the same project:

**1. Dependency Installation (CRITICAL)**
Multiple agents running `yarn install` simultaneously will cause hangs/failures due to:
- Yarn global cache lock contention
- Network bottlenecks
- CPU competition

**Solution - Install sequentially:**
```bash
# BEFORE spawning parallel agents, pre-install in main repo:
cd /Users/brian/code/[repository-name]
yarn install

# This populates the yarn cache. Then each worktree install is faster.
```

**If agents are already stuck:**
- Kill stuck install processes
- Run `yarn install --frozen-lockfile` one worktree at a time
- Wait for each to complete before starting the next

**2. Port Conflicts (Dev Servers)**
Each worktree needs a different port if running dev servers simultaneously:
```bash
# Agent 1 (default)
yarn start  # runs on port 3000

# Agent 2 (specify different port)
PORT=3001 yarn start

# Agent 3
PORT=3002 yarn start
```

**3. Shared Backend/Database**
All worktrees hit the same local/QE backend. Avoid tests that modify shared state if other agents are running.

**4. PR Base Branch**
All PRs for the same project should target the SAME project-release branch. Store this in the project doc.

---

#### Recommended Parallel Agent Workflow

1. **User pre-installs** in main repo before spawning agents
2. **Agents create worktrees** (fast - no install needed if cache warm)
3. **Agents acquire yarn_install lock, run install, release lock** (see below)
4. **Agents work in parallel** on separate ports if needed
5. **Agents acquire playwright lock before E2E testing, release when done**

---

#### Agent Lock Coordination (CRITICAL FOR PARALLEL EXECUTION)

**Lock file:** `/Users/brian/code/.agent-locks.json`
**Full documentation:** `/Users/brian/code/AGENT_LOCKS.md`

Two resources require exclusive access:

| Lock | Max Hold Time | Used For |
|------|---------------|----------|
| `yarn_install` | 10 min | `yarn install` commands |
| `playwright` | 30 min | All `browser` tool interactions |

**Before yarn install:**
1. Read `.agent-locks.json`
2. If `yarn_install` is held and not stale (< 10 min old), wait 30s and retry
3. Acquire lock (write your ticket ID + timestamp)
4. Run `yarn install --frozen-lockfile`
5. Release lock (set back to `null`)

**Before using the `browser` tool:**
1. Read `.agent-locks.json`
2. If `playwright` is held and not stale (< 30 min old), wait 30s and retry
3. Acquire lock (write your ticket ID + timestamp)
4. Do ALL browser work (navigate, click, screenshot, etc.)
5. Release lock (set back to `null`) when done with ALL browser work

**Lock format when held:**
```json
{
  "yarn_install": {
    "holder": "DRI-1490",
    "acquired": 1736874234,
    "worktree": "/Users/brian/code/Dripos-React-Partner-dri-1490"
  },
  "playwright": null
}
```

> **FAILURE TO COORDINATE LOCKS WILL CAUSE AGENT HANGS AND FAILURES**

---

#### Cleanup (after PR merged):
```bash
# Remove worktree when done
cd /Users/brian/code/[repository-name]
git worktree remove ../[repository-name]-dri-XXX
```

---

### Step 4: Create Plan

**Tool**: `task` subagent (`agent: "planner"`)

**MANDATORY**: Spawn a planning subagent to break down the ticket into a structured implementation plan.

**BEFORE planning, find existing patterns:**
1. Ask user: "Which existing page/component has similar functionality you want to match?"
2. Search codebase for 2-3 similar implementations
3. Document which patterns to follow in the plan

**Spawn the planning subagent** synchronously (wait for its result) using the `task` tool with `agent: "planner"`. Pass a single task whose `assignment` is the full prompt below, with all ticket details filled in:

```
You are an expert planning consultant and systems architect with deep expertise in plan structuring, risk assessment, and software development strategy.

Your task is to produce a complete, implementation-ready plan for the ticket below.

PLANNING METHODOLOGY:
1. DECOMPOSITION: Break down the main objective into logical, sequential steps
2. DEPENDENCIES: Identify which steps depend on others and order them appropriately
3. BRANCHING: When multiple valid approaches exist, note alternatives clearly
4. COMPLETENESS: Ensure all aspects of the task are covered without gaps

For each phase/step include:
- Clear, actionable description
- Prerequisites or dependencies
- Expected outcomes
- Potential challenges or considerations
- Alternative approaches (when applicable)

PLANNING PRINCIPLES:
- Start with high-level strategy, then add implementation details
- Consider technical and resource constraints
- Include validation and testing steps
- Plan for error handling and rollback scenarios
- Overengineering is an anti-pattern — avoid unnecessary abstraction or indirection
- Do NOT use emojis. Use clear text formatting, ASCII, and symbols only.
- Do NOT mention time estimates or costs.

Produce the COMPLETE plan in a single response. If critical context is missing, ask one focused question.

---

Ticket: [TICKET-ID] — [title]

Description:
[ticket description]

Acceptance Criteria:
[acceptance criteria]

Existing patterns to follow (from codebase search):
[patterns found above]
```

**YOU MUST:**
1. Spawn the subagent with all ticket details filled in
2. Present complete plan to user in structured format
3. Reference existing patterns that will be followed

**DO NOT:**
- Skip directly to implementation
- Create ad-hoc plans without a structured planning subagent
- Proceed without completing the planning step
- Invent new patterns when existing ones exist

> **FAILURE TO PLAN BEFORE IMPLEMENTATION IS FORBIDDEN**

---

### Step 5: Validate Plan

**Tool**: `task` subagent (`agent: "critic"`)

**MANDATORY**: Spawn a deep analysis subagent to validate and refine the plan.

**Spawn the validation subagent** synchronously (wait for its result) using the `task` tool with `agent: "critic"`. Pass a single task whose `assignment` is the full prompt below, with the Step 4 plan and ticket requirements filled in:

```
You are a senior engineering collaborator. Critically analyze the following implementation plan and surface gaps, risks, and improvements.

GUIDELINES:
1. Stay on scope — keep suggestions practical and grounded in the codebase
2. Challenge and enrich — find gaps, question assumptions, surface hidden complexities or risks
3. Provide actionable next steps — specific advice, trade-offs, implementation strategies
4. Overengineering is an anti-pattern — avoid suggesting unnecessary abstraction or complexity
5. Prioritize depth over breadth

KEY FOCUS AREAS:
- Architecture & Design: modularity, boundaries, abstraction layers, dependencies
- Performance & Scalability: algorithmic efficiency, concurrency, caching, bottlenecks
- Security & Safety: validation, authentication/authorization, error handling, vulnerabilities
- Quality & Maintainability: readability, testing, monitoring, refactoring

---

Plan to validate:
[paste the complete plan from Step 4]

Ticket requirements:
[ticket acceptance criteria]
```

**YOU MUST:**
1. Spawn the subagent with the Step 4 plan and ticket requirements filled in
2. Address any gaps or risks identified
3. Refine approach based on deep analysis
4. Ensure plan covers all acceptance criteria

> **FAILURE TO VALIDATE PLAN IS FORBIDDEN**

---

### Step 6: Present & Wait for Approval

**MANDATORY STOP POINT**

**YOU MUST:**
1. Present complete validated plan in clear, structured format
2. **STOP and WAIT for explicit user approval**
3. Do NOT proceed to ANY implementation steps
4. Do NOT make ANY code changes
5. Do NOT create ANY commits

**Explicit Approval Required:**
- User will type "approved", "looks good", "proceed", "go ahead", or similar
- User may request modifications - incorporate feedback and re-present
- Only proceed to Step 7 after receiving explicit textual approval

> **FAILURE TO WAIT FOR APPROVAL IS FORBIDDEN**

---

### Step 7: Write Failing Tests (TDD - RED Phase)

**TDD IS MANDATORY FOR ALL LOGIC CHANGES - NO EXCEPTIONS**

#### Skip ONLY if change is:
- Purely cosmetic (colors, spacing, layout)
- Simple string/text update with no logic
- Constant value change with no business rules

#### TDD Workflow:

**7.1 Assess if tests are required**

Ask: "Does this change modify ANY logic, conditions, calculations, or business rules?"
- **YES** → Tests MANDATORY - proceed to 7.2
- **NO** (purely cosmetic/text) → Skip to Step 8

**Examples requiring tests:**
- Adding/modifying validation rules
- Changing calculation logic
- Adding error handling
- Modifying control flow (if/else, loops, switch)
- Adding new functions/methods
- Changing conditional rendering logic
- Updating business rule conditions
- Modifying API integrations
- Changing data transformations

**7.2 Identify test requirements**

Document:
1. What functions/modules will be modified?
2. What are ALL possible input combinations?
3. What edge cases need testing (null, undefined, empty, boundary)?
4. What error conditions should be handled?
5. What success scenarios need verification?
6. What existing behavior must NOT break?

**7.3 Write comprehensive tests BEFORE implementation**

- Use Jest (or existing test framework)
- Create files in appropriate `__tests__/` directories
- Naming: `[ModuleName].test.js` or `[ModuleName].spec.js`

**Test Coverage Checklist:**
- [ ] Happy path (normal successful case)
- [ ] Edge cases (boundary values, empty, null, undefined)
- [ ] Error cases (invalid inputs, failure conditions)
- [ ] Existing behavior (regression prevention)
- [ ] All code paths (every if/else branch)

**7.4 Run tests to verify they FAIL**

```bash
yarn test [test-file-path]
```

**Verification:**
- [ ] ALL new tests MUST fail initially
- [ ] Failure messages are clear
- [ ] Failures are for the RIGHT reason (missing implementation)
- [ ] If ANY test passes before implementation, fix the test

**Why This Matters:**
If tests pass before implementation, they are NOT testing anything useful. They give false confidence. A proper test MUST fail when the feature doesn't exist, then pass when correctly implemented.

**7.5 Document in TodoWrite**
- Add todo: "Write failing tests for [module/function]"
- Mark `completed` once tests written and confirmed failing

#### Common TDD Mistakes:
| Wrong | Right |
|-------|-------|
| Writing implementation before tests | Write tests FIRST |
| Tests that pass immediately | Tests should FAIL initially |
| Skipping tests for "simple" logic | When in doubt, write tests |
| Only testing happy path | Test all edge cases |
| Writing tests after implementation | TDD means tests FIRST |

#### Correct TDD Flow:
1. ✅ Write test defining expected behavior → Run → See it **FAIL** (RED)
2. ✅ Write minimal code to make test pass → Run → See it **PASS** (GREEN)
3. ✅ Refactor if needed → Run → Ensure still **PASS** (REFACTOR)

> **IF IN DOUBT, WRITE TESTS. BETTER TO HAVE TESTS YOU DON'T NEED THAN SKIP TESTS YOU DO NEED.**

---

### Step 8: Implementation

Execute the plan systematically with direct file edits:

- **ALWAYS use TodoWrite** to track progress
- Mark tasks `in_progress` when starting
- Mark tasks `completed` immediately after finishing
- Follow the plan step-by-step
- Make minimal, focused changes
- **Implement code to make failing tests pass**

---

### Step 9: Verify Tests Pass (GREEN Phase)

**MANDATORY after implementation**

**1. Run all tests:**
```bash
yarn test
# OR specific tests:
yarn test [test-file-path]
```

**2. Verify all new tests pass:**
- All tests from Step 7 must pass
- No existing tests broken
- Fix any failures before proceeding

**3. Run full test suite (if available):**
```bash
yarn test:coverage
```

**4. Document in TodoWrite:**
- Add: "Run tests to verify implementation"
- Mark `completed` once all pass

**If tests fail:** Fix issues and re-run. Do NOT proceed until all pass.

---

### Step 10: Code Review

**Tool**: `task` subagent (`agent: "code-reviewer"`)

Spawn a code review subagent to verify quality of all changes. Use the same full codereview system prompt from **`skill://execute/reference/pr-review.md` Step 4** — embed it in the assignment along with the ticket details. Spawn synchronously (wait for its result) using the `task` tool with `agent: "code-reviewer"`, passing a single task whose `assignment` is:

```
[Full codereview system prompt from skill://execute/reference/pr-review.md Step 4]

---

Ticket: [TICKET-ID] — [title]

Files changed:
[list of all modified files]

Diff (git diff HEAD or git diff --staged):
[diff output]
```

- Fix critical/high-severity issues before proceeding to Step 11
- Ensure changes follow established codebase patterns and best practices

---

### Step 11: Scope Validation

**Do-it-yourself self-challenge — no external tool needed**

Before proceeding to E2E testing, perform a self-challenge over the implementation:

```
CRITICAL REASSESSMENT – Do not automatically agree with your own implementation.

Challenge A: Requirements Complete
Compare ticket acceptance criteria against implementation:
- For EACH requirement, answer: accomplished ✓ or missing ✗?
- Are all edge cases and happy paths handled?
- Are error conditions covered?

Challenge B: Zero Scope Creep
- Did we add any features not explicitly requested? (if yes → remove them)
- Were any architectural changes made that weren’t necessary? (if yes → justify or revert)
- Did we follow the minimal change philosophy?
- Are all modified files actually needed for this ticket?

Be brutally honest. Scope creep must be reverted before proceeding.
```

> **FAILURE TO VALIDATE SCOPE IS FORBIDDEN**

---

### Step 12: E2E Testing & Screenshots (MANDATORY STOP POINT)

> **CRITICAL: DO NOT COMMIT OR CREATE PR UNTIL THIS STEP IS COMPLETE**
> 
> This is the MOST IMPORTANT step. Skipping E2E validation means bugs ship to users.
> You MUST test EVERY acceptance criterion with the `browser` tool before proceeding.

#### MANDATORY Checklist (All Must Be Checked):

- [ ] **Playwright lock acquired** (check `.agent-locks.json`)
- [ ] **Dev server running** (docker compose up or yarn start)
- [ ] **EVERY bug/feature tested** in browser with the `browser` tool
- [ ] **Screenshots taken** for each fix/feature
- [ ] **Playwright lock released**

#### For Web Applications (React, Next.js):

**YOU MUST use the `browser` tool to validate ALL UI/UX changes:**

1. **Acquire Playwright Lock**
   ```bash
   # Read lock file
   cat /Users/brian/code/.agent-locks.json
   # If playwright is null, acquire it by writing your ticket ID
   ```

2. **Start Dev Server**
   ```bash
   # In worktree directory
   docker compose up
   # OR
   yarn start
   ```

3. **Test EVERY Acceptance Criterion**
   - `open` a tab pointed at the affected page (or `run` with `tab.goto(url)`)
   - Inspect page state with `run` + `tab.observe()` to get structured elements
   - Click buttons, fill forms, test interactions with `tab.click`/`tab.fill`/`tab.type`
   - Verify expected behavior for EACH bug/feature
   - **DO NOT SKIP ANY ACCEPTANCE CRITERIA**

4. **Take Screenshots**
   - Use `run` + `tab.screenshot({ save: '<path>' })`
   - Save to `~/code/Pictures/[repository-name]/`
   - Format: `[ticket-number]-[XX].png` (e.g., `DRI-1675-00.png`)

5. **Release Playwright Lock**
   - Set `playwright` back to `null` in `.agent-locks.json`

#### Screenshot Documentation:

**CRITICAL Path**: `~/code/Pictures/[repository-name]/`

| Element | Format |
|---------|--------|
| Directory | `~/code/Pictures/[repository-name]/` |
| Filename | `[ticket-number]-[XX].png` |
| Example | `~/code/Pictures/Dripos-React-Partner/DRI-764-00.png` |

- **NOT** `~/Pictures/...` - must be `~/code/Pictures/...`
- XX is zero-padded: 00, 01, 02, etc.
- Capture before/after states when applicable
- Include screenshots showing EACH acceptance criterion completion

#### For React Native / Mobile Applications:

The `browser` tool cannot test React Native apps.
- **Write Playwright test files** (targeting the `@playwright/test` framework) to document test cases
- Create in appropriate test directory
- Document all scenarios from acceptance criteria
- Include happy path and edge cases
- Manual testing on device/simulator required

#### Validation Gate:

**BEFORE proceeding to Step 13, you MUST be able to answer YES to ALL:**

1. Did I test EVERY acceptance criterion in the browser? 
2. Did I take screenshots proving each fix/feature works?
3. Did I release the Playwright lock?

**If ANY answer is NO, GO BACK AND COMPLETE THIS STEP.**

> **FAILURE TO COMPLETE E2E TESTING IS FORBIDDEN**
> **COMMITTING WITHOUT E2E TESTING IS FORBIDDEN**
> **CREATING PR WITHOUT E2E TESTING IS FORBIDDEN**

---

### Step 13: Commit & Push

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "<type>(<scope>): <description> (DRI-XXX)"

# Push branch
git push -u origin [branch-name]
```

---

### Step 14: Create Draft PR

Use GitHub CLI:

```bash
# If ticket belongs to a project (target project-release branch):
gh pr create --draft --base project-release/[project-name] --title "<type>: <description> (DRI-XXX)" --body "..."

# If ticket is independent (target master):
gh pr create --draft --title "<type>: <description> (DRI-XXX)" --body "..."
```

**IMPORTANT**: The `--base` flag MUST match the base branch used when creating the worktree in Step 3.

**Include in PR body:**
- Summary of changes
- List of changes made
- Testing checklist
- Link to Linear ticket

> **ALWAYS create as draft, never ready for review**

---

### Step 15: Create Documentation

**MANDATORY**: Create a progress documentation file for the ticket.

**File Location**: `~/code/docs/[repository-name]/DRI-XXX.md`

> **CRITICAL**: Documentation goes in `~/code/docs/`, NOT inside the repository!
> 
> Example: `~/code/docs/Dripos-React-Partner/DRI-1005.md`
> 
> **DO NOT** commit documentation to the repository. It lives outside the repo.

**Required Sections:**
```markdown
# DRI-XXX: [Ticket Title]

## Status: Complete

## PR
[Link to PR]

## Problem
[Description of the problem being solved - written so someone unfamiliar can understand]

## Root Cause Analysis
[Technical analysis of why the problem occurred or why this feature was needed]

## Solution
[High-level description of the solution]

## Implementation

### Files Modified
[List of files changed with brief purpose]

### Architecture Context
[Explain the relevant systems/patterns for someone unfamiliar with this part of the codebase:
- How does the affected system work?
- What are the key data structures/models involved?
- What existing patterns does this change follow?]

### Changes
[Detailed description of code changes with snippets if helpful.
For logic changes, explain WHY the code works, not just WHAT it does.]

## Testing
[Step-by-step testing instructions to verify the fix/feature]

## Alternative Approaches Considered
[Table or list of other approaches and why they were rejected]

## Related Code
[Other files/systems that interact with this change - helps future developers understand dependencies]

## Files Reference
[Key files with line numbers for future reference]

## Linear Ticket
[Link to Linear ticket]
```

**Documentation Quality Checklist:**
- [ ] Could someone unfamiliar with this codebase understand the change?
- [ ] Are the key architectural patterns explained?
- [ ] Is the "why" explained, not just the "what"?
- [ ] Are related systems/settings mentioned for context?
- [ ] Would this help a future developer modify or debug this code?

**DO NOT commit documentation to the repository. Just create the file at the correct location.**

> **FAILURE TO CREATE DOCUMENTATION IS FORBIDDEN**

---

### Step 16: Summary Output

**Note:** This step comes AFTER creating documentation (Step 15).

Present concise summary:

```
## Ticket Complete: DRI-XXX

### PR Link
[Link to draft PR]

### Documentation
[repository]/docs/DRI-XXX.md

### What This Does (In Simple Terms)
[2-3 sentence explanation an intern could understand - describe user-facing
change and why it matters]

### Screenshots
- ~/code/Pictures/[project-name]/[ticket-number]-00.png
- ~/code/Pictures/[project-name]/[ticket-number]-01.png
```

---

### Step 17: Feedback Loop

- **Changes requested**: Implement feedback and return to Step 8, update documentation
- **Approved**: User will convert PR from draft to ready for review

---

## Critical Rules

| Rule | Description |
|------|-------------|
| 1 | Validate ticket context FIRST (Step 2) - NO EXCEPTIONS |
| 2 | Worktree creation in Step 3, BEFORE planning - NO EXCEPTIONS |
| 3 | No code changes until plan approved (Step 6) |
| 4 | Always branch from correct base (project-release if exists, else master) |
| 5 | ALWAYS create draft PR, never ready PR |
| 6 | ALWAYS use TodoWrite to track implementation progress |
| 7 | Make minimal changes - ONLY the stated problem |
| 8 | Follow TDD for logic changes (RED → GREEN → REFACTOR) |
| 9 | Verify all tests pass before proceeding |
| 10 | Code review must verify repository patterns AND best practices |
| 11 | **E2E TEST WITH THE `browser` TOOL BEFORE COMMIT - NO EXCEPTIONS** |
| 12 | Wait for explicit approval before implementation |
| 13 | **ALWAYS create docs/DRI-XXX.md documentation file** |
| 14 | **Check ProjectInfo/ for project context BEFORE creating worktree** |
| 15 | **PR base branch MUST match worktree base branch** |
| 16 | **NO COMMIT until E2E testing complete (Step 12)** |

**WORKFLOW ORDER ENFORCEMENT:**
```
Step 11 (Scope Check) → Step 12 (E2E Test) → Step 13 (Commit)
                              ↑
                    CANNOT SKIP THIS STEP
```

**COMMON MISTAKES**:
- Creating branch from wrong base = PRs with unrelated commits
- PR targeting wrong branch = merge conflicts with project-release
- Running multiple dev servers on same port = connection refused errors
- Forgetting `yarn install` in worktree = missing dependencies
- **Running `yarn install` without acquiring lock = agent hangs**
- **Using the `browser` tool without acquiring the playwright lock = browser conflicts**
- **SKIPPING E2E TESTING = bugs ship to production**

---

## Quick Reference: Example Commands

```bash
# Step 1: Fetch ticket
linear issue view DRI-758 --no-comments --no-pager

# Step 3: Create worktree with clean branch
cd /Users/brian/code/Dripos-React-Partner
git fetch origin
# If project-release branch exists:
git worktree add ../Dripos-React-Partner-dri-758 -b briankeefe/dri-758-ticket-title origin/project-release/[project-name]
# OR if no project-release (use master):
git worktree add ../Dripos-React-Partner-dri-758 -b briankeefe/dri-758-ticket-title origin/master
cd ../Dripos-React-Partner-dri-758
yarn install
git branch --show-current  # verify: new branch
pwd  # verify: worktree path

# Step 7: Write & run failing tests
yarn test src/helpers/__tests__/MyModule.test.js
# Tests should FAIL

# Step 9: Verify tests pass
yarn test
# All tests should PASS

# Step 13: Commit and push
git add .
git commit -m "feat: Add feature (DRI-758)"
git push -u origin briankeefe/dri-758-ticket-title

# Step 14: Create draft PR (target project-release if exists)
gh pr create --draft --base project-release/[project-name] --title "feat: Add feature (DRI-758)" --body "..."
# OR if no project-release:
gh pr create --draft --title "feat: Add feature (DRI-758)" --body "..."

# Cleanup (after PR merged):
cd /Users/brian/code/Dripos-React-Partner
git worktree remove ../Dripos-React-Partner-dri-758
```

---

## Example: Scope Self-Challenge (Step 11)

```
CRITICAL REASSESSMENT – Do not automatically agree with your own implementation.

Ticket: DRI-764 — Add 'View Corresponding Payment Methods Report' button

Challenge A: Requirements Complete
Original requirements:
- Add button to payout breakdown page
- Button redirects to Payment Methods Report page
- Date/time ranges auto-filtered based on payout dates
- Use URL params or Zustand for state passing

Implementation review:
- Button added: ✓/✗
- Redirects to correct page: ✓/✗
- Auto-filtering works: ✓/✗
- URL params used for state passing: ✓/✗

Challenge B: Zero Scope Creep
- Added only the requested button? (no extra UI changes?)
- No unnecessary refactors to surrounding components?
- Minimal change philosophy followed?
- All modified files actually needed for this ticket?

Be brutally honest. Any scope creep must be reverted before proceeding to E2E testing.
```
