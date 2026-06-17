> Ported from /Users/brian/code/EXECUTE_INIT_PROJECT.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# Execute Init Project

## Command
`execute init project [ProjectName]`

## Purpose
Creates a comprehensive project execution plan by analyzing all Linear tasks in a project, mapping dependencies, and determining an intelligent task execution order.

## Workflow

### Step 1: Gather Project Information
1. Prompt user for project name if not provided
2. Use Linear CLI to list all projects and find matching project ID
3. Fetch all issues/tasks associated with the project

### Step 2: Map Tasks and Dependencies
1. For each task, extract:
   - Task ID (e.g., DRI-XXX)
   - Task title
   - Task description
   - Current status
   - Labels/tags
   - Related issues (blocking/blocked by)
   - Assignees
   - Priority

2. Build dependency graph:
   - Identify which tasks block which other tasks
   - Note tasks that can be parallelized
   - Flag tasks that need clarification
   - Identify tasks on hold or blocked by external factors

### Step 3: Intelligent Task Ordering with Deep Analysis
Spawn an `analyst` subagent (via the `task` tool, synchronously — wait for it to finish) to produce a dependency-aware execution order. Pass the full prompt below verbatim, substituting the project name and the gathered task list:

- Architecture: Which tasks affect core structure?
- Database: Which tasks modify schemas or data models?
- API: Which tasks change interfaces or contracts?
- UI/UX: Which tasks are purely frontend?
- Testing: What verification is needed for each task?
- Risk assessment for each task ordering decision
- Opportunities for parallel development

Subagent prompt:

```
You are a senior engineering collaborator and systems architect. Analyze the following project tasks and produce an intelligent, dependency-aware execution order.

ANALYSIS AREAS:
- Architecture: Which tasks affect core structure?
- Database: Which tasks modify schemas or data models?
- API: Which tasks change interfaces or contracts?
- UI/UX: Which tasks are purely frontend?
- Testing: What verification is needed for each task?

For each ordering decision:
- Explain the dependency reasoning
- Flag parallelization opportunities
- Identify risks in the proposed order
- Note any assumptions that should be validated

---

Project: [ProjectName]
Tasks:
[paste full task list with descriptions, statuses, and known dependencies]
```

**Analysis Areas:**
- Architecture: Which tasks affect core structure?
- Database: Which tasks modify schemas or data models?
- API: Which tasks change interfaces or contracts?
- UI/UX: Which tasks are purely frontend?
- Testing: What verification is needed for each task?

### Step 4: Create Project Document
Generate a markdown file in `ProjectInfo/[ProjectName].md` following the PAYOUTS.md template:

**Template Structure:**
```markdown
# [Project Name] - Task Execution Order

## Project: [project-id] ([Project Name])

[Brief project description and goals]

---

## ⚠️ NEEDS CLARIFICATION
[Tasks with missing info or unclear scope]

---

## Phase 1: Foundation & Infrastructure
[Tasks that establish core structure]

## Phase 2: [Feature Category] (Parallel Tracks)
[Tasks grouped by feature area with parallelization opportunities]

### Track A: [Category Name]
[Related tasks that form a sequential track]

### Track B: [Category Name]
[Parallel track of related tasks]

---

## Phase N: [Final Category]
[Final polish and comprehensive updates]

---

## Execution Summary

### Recommended Sequential Order (with parallel opportunities):
[High-level execution plan]

---

## Parallelization Opportunities

### Maximum Parallelization Strategy:
[How multiple developers can work simultaneously]

### Timeline Impact:
[Sequential vs parallel approach comparison]

---

## Key Dependencies Map

```
[Visual dependency graph using ASCII art]
```

---

## Engineering Notes from Tickets
[Technical considerations extracted from ticket descriptions]

---

## Risk Assessment

### High Risk:
[Tasks or decisions with high risk]

### Medium Risk:
[Tasks or decisions with medium risk]

### Low Risk:
[Tasks or decisions with low risk]

---

## Validation Notes

### Step 5: Validate with Self-Challenge
**Validation Method:** Critic subagent deep analysis + native self-challenge

**Key Insights:**
[Important discoveries from the analysis]

---

## Current Status Summary

| Ticket | Status | PR | Notes |
|--------|--------|----|----|
| [TASK-ID] | [STATUS] | [PR#] | [Notes] |

### Next Available Tasks:
[Tasks that can be started immediately]

### Progress Summary:
- ✅ **Complete**: X/Y tickets (Z%)
- 🔄 **In Review**: X/Y tickets (Z%)
- ⏸️ **Blocked**: X/Y tickets (Z%)
- ❌ **Not Started**: X/Y tickets (Z%)
- 🚫 **On Hold**: X/Y tickets (Z%)

---

*Last Updated: [Date]*
```

### Step 5: Validate with Self-Challenge
Spawn a `critic` subagent (via the `task` tool, synchronously — wait for it to finish) to critically evaluate the ordering plan. Pass the full prompt below verbatim:

```
CRITICAL REASSESSMENT – Do not automatically agree with your own analysis.

Critically evaluate this project execution plan:
1. The dependency ordering — are there better sequences?
2. The parallelization strategy — can we do more in parallel?
3. The risk assessment — are risks properly identified?
4. The phase grouping — do these logical groupings make sense?
5. Any assumptions that might be incorrect?
6. Are there circular dependencies that were missed?
7. Are foundation tasks truly foundational, or could they be deferred?

Be brutally honest. Update the plan with any corrections before presenting to user.
```

### Step 6: Present Results
1. Display the project file location
2. Show high-level execution summary
3. Highlight any clarification needs
4. List next available tasks to start
5. Note any tasks on hold or blocked

## Linear CLI Commands Used

```bash
# List all projects
linear project list

# Find project by name/partial match
linear project list | grep -i "[ProjectName]"

# List all issues in a project
linear issue list --project "[project-id]" --all-states

# Get detailed issue information
linear issue view [TICKET-ID] --no-comments --no-pager

# Get issue relationships
linear issue view [TICKET-ID] | grep -E "(Blocks|Blocked by|Related to)"
```

## Example Usage

```bash
# Initialize a new project plan
execute init project PAYOUTS

# Initialize with exact project name
execute init project "Payouts Page Rework"
```

## Output
- Creates `ProjectInfo/[ProjectName].md` with comprehensive execution plan
- Shows validation results from the self-challenge step
- Lists immediate next steps

## Notes
- The analysis uses deep reasoning to understand task relationships
- Manual review of the generated plan is recommended
- Update the plan as tasks are completed or new information emerges
- Use `execute update project [ProjectName]` to refresh status later

---

*This command combines Linear API integration, dependency analysis, AI-powered reasoning, and critical validation to create robust project execution plans.*
