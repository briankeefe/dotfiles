> Ported from /Users/brian/code/EXECUTE_SANITY_CHECK.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# Execute Sanity Check

## Command
```bash
execute sanity check
```

## Purpose
Performs a comprehensive sanity check on recently completed work to ensure quality, adherence to requirements, and best practices compliance.

## What It Does
Runs a native self-challenge to critically evaluate:
1. **Requirement Fulfillment**: Verify we accomplished exactly what was requested
2. **Scope Adherence**: Confirm no scope creep occurred (no unrequested features or changes)
3. **Best Practices Compliance**: Validate code follows established patterns and guidelines

## When to Use
- After completing a ticket or feature implementation
- Before creating a pull request
- After making significant changes to ensure quality
- When you want a critical review of recent work

## Workflow

### Step 1: Gather Context
Collect information about what was just completed:
- Original requirements or ticket description
- Files that were modified
- Changes that were made
- Any commit messages or PR descriptions

### Step 2: Self-Challenge
Apply a native self-challenge rubric to the completed work. No external tool needed — do this yourself:

```
CRITICAL REASSESSMENT – Do not automatically agree with your own work.

ORIGINAL REQUIREMENTS:
[Insert the original ticket description, user request, or requirements]

CHANGES MADE:
[List all files modified and summarize the changes]

EVALUATION CRITERIA:

1. Did we accomplish exactly what was requested?
   - For EACH requirement, answer: done ✓ or missing ✗?

2. Did we avoid scope creep?
   - Any features added that weren’t requested?
   - Any refactors that weren’t necessary?
   - Did we follow the minimal diff philosophy?

3. Does the implementation follow established best practices?
   - Functional components with hooks (no class components)
   - No inline conditionals in JSX/TSX
   - No mutable array operations (push/unshift/pop/shift/splice)
   - Proper error handling
   - Consistent code formatting
   - No let/var with reassignment (use const + ternary)

FINDINGS:
- What was done well:
- Any scope creep concerns:
- Any best practice violations:
- Recommended fixes before PR:
```

### Step 3: Review Results
Analyze the self-challenge findings:
- ✅ **PASS**: If all criteria are met, work is ready for PR
- ⚠️ **WARNING**: If minor issues exist, document them and consider fixing
- ❌ **FAIL**: If critical issues exist, address them before proceeding

### Step 4: Take Action
Based on the results:
- **No issues**: Proceed with confidence to PR creation
- **Minor issues**: Document in PR description or fix if time permits
- **Critical issues**: Fix immediately before creating PR

## Example Usage

### Example 1: After Ticket Completion
```
User: execute sanity check
