> Ported from /Users/brian/code/EXECUTE_DOCS.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# Execute Docs Workflow

When you type `execute docs`, follow this workflow to identify and create internal documentation for Notion.

---

## Phase 1: Ticket Selection

### Step 1: Gather Candidate PRs

Query merged PRs from the last 3 months across all repositories:

```bash
gh pr list --author="@me" --state=merged --limit=50 \
  --json number,title,body,mergedAt,additions,deletions,changedFiles
```

### Step 2: Evaluate Each PR Against Selection Criteria

**DOCUMENT these types of PRs:**

| Type | Why It Matters | Example |
|------|----------------|---------|
| **Tribal Knowledge** | Information that isn't obvious from code | "OT settings must be in Partner_Settings, not Payroll_Location_Groups" |
| **Cross-Platform Features** | Affects multiple repos/systems | Backend + web + mobile error handling |
| **Architecture Decisions** | Explains WHY, not just WHAT | "Why we migrated from MongoDB to MySQL" |
| **Support-Facing Features** | Customers will contact support about this | Error codes, new admin tools |
| **Infrastructure/Onboarding** | New developers need this | Local dev setup, QE environment guides |
| **Complex Business Logic** | Non-obvious rules, edge cases | Payroll OT across multi-location groups |

**DO NOT DOCUMENT these types of PRs:**

| Type | Why Skip It |
|------|-------------|
| **Self-Documenting Code** | Pure functions with JSDoc + comprehensive tests already explain themselves |
| **Small Bug Fixes** | One-line fixes with obvious cause/solution |
| **Dependency Bumps** | Version updates without behavior changes |
| **Formatting/Linting** | No behavioral impact |
| **Simple CRUD** | Standard patterns don't need explanation |

### Step 3: Rank and Select Top 5

Prioritize by:
1. **Support impact** - Will support get tickets about this?
2. **Onboarding value** - Would a new dev struggle without this?
3. **Tribal knowledge density** - How much "hidden" knowledge exists?
4. **Cross-team relevance** - Does it affect multiple teams/systems?

**Ask the user to confirm selections before proceeding.**

---

## Phase 2: Research

For each selected PR:

### Step 1: Get Full PR Context
```bash
gh pr view [NUMBER] --json body,title,files
```

### Step 2: Read the Actual Code
- Read the modified files to understand implementation
- Look for comments, error codes, constants
- Identify integration points with other systems

### Step 3: Check for Related Context
- Are there related PRs in other repos?
- Is there existing documentation to reference?
- Are there database tables or API endpoints involved?

---

## Phase 3: Document Structure

### Required Sections

```markdown
# [Descriptive Title - No Ticket Numbers]

**Linear Ticket:** DRI-XXXX  
**PR:** [Repo #Number](url)  
**Author:** [Name]  
**Date:** [Month Year]

---

## Overview
[2-3 sentences: What is this and why does it matter?]

## Problem Statement
[What was broken/missing? Include specific scenarios.]

## Solution
[How was it fixed? Include architecture diagrams if complex.]

## Key Files
| File | Purpose |
|------|---------|
| `path/to/file.js` | Brief description |

## Support Runbook (if customer-facing)
### "[Symptom customer describes]"
1. Step to diagnose
2. Step to verify
3. Resolution or escalation path

## Impact
- Bullet points on business/technical impact
```

### Optional Sections (include when relevant)

- **When to Use / When NOT to Use** - For tools or features
- **FAQ** - Common questions
- **Related Documentation** - Links to other docs
- **Known Gotchas** - Edge cases, common mistakes

---

## Phase 4: Content Guidelines

### Tone
- **Professional and direct** - No fluff, no emojis
- **Factual** - State what is, not what should be
- **Action-oriented** - Support runbooks should be step-by-step

### Length
- **Overview**: 2-3 sentences max
- **Problem/Solution**: As long as needed, but prefer bullet points
- **Support Runbooks**: Numbered steps, one action per step
- **Total doc**: Aim for 100-250 lines

### What to EXCLUDE
- **Unit test documentation** - Tests are for engineers, not Notion readers
- **Testing checklists** - These belong in PRs, not permanent docs
- **Code snippets longer than 20 lines** - Reference the file instead
- **Implementation details that will change** - Focus on concepts

### What to INCLUDE
- **Error codes and messages** - Support needs to recognize these
- **Database tables and columns** - Where data lives
- **Which settings/tables are authoritative** - Source of truth
- **Why decisions were made** - Not just what was done

---

## Phase 5: Diagrams

### When to Include Diagrams
- Multi-component architectures
- Data flow between systems
- State machines or workflows
- Relationships between tables

### Diagram Rules

1. **Use ASCII box drawing characters only:**
   ```
   ┌ ┐ └ ┘ ─ │ ├ ┤ ┬ ┴ ┼ ▼ ▶
   ```

2. **Verify alignment:**
   - Count characters in each row
   - All `│` on the same column must align
   - All `─` on the same row must be continuous

3. **Keep width under 65 characters** for readability

4. **No emojis in diagrams** - They have variable width

### Example Diagram Structure
```
┌─────────────────────────────────────────────────────────────┐
│                        Title                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐       ┌─────────────┐                     │
│  │  Component  │──────▶│  Component  │                     │
│  └─────────────┘       └─────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 6: File Naming

### Format
```
[topic-in-kebab-case].md
```

### Rules
- **NO ticket numbers** in filenames (DRI-1234)
- **NO dates** in filenames
- **Use descriptive names** that explain the content
- **Keep under 50 characters**

### Examples
| Good | Bad |
|------|-----|
| `stripe-subscription-statuses.md` | `DRI-1404-stripe-fix.md` |
| `local-development-docker.md` | `docker-setup-dec-2024.md` |
| `off-cycle-payroll-overtime.md` | `payroll-ot-bug.md` |

---

## Phase 7: Output Location

All docs go in:
```
/Users/brian/code/docs/notion-exports/
```

---

## Phase 8: Review Checklist

Before finalizing each doc:

- [ ] Title is descriptive (no ticket numbers)
- [ ] Overview explains why this matters in 2-3 sentences
- [ ] Support runbook included if customer-facing
- [ ] No unit test documentation
- [ ] No testing checklists
- [ ] Diagrams are aligned (if present)
- [ ] File links are relative (`./other-doc.md`)
- [ ] Key files table has actual file paths
- [ ] No emojis anywhere

---

## Quick Reference: Questions to Ask

When evaluating a PR for documentation:

1. **"Would support need this?"** → Add support runbook
2. **"Would a new dev be confused?"** → Add to onboarding docs
3. **"Is this obvious from the code?"** → Maybe skip it
4. **"Did I learn something non-obvious?"** → That's tribal knowledge, document it
5. **"Does this affect multiple systems?"** → Cross-platform, document it
6. **"Will this decision seem arbitrary later?"** → Document the WHY
