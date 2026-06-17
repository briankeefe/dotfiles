> Ported from /Users/brian/code/PR_REVIEW_TEMPLATE.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# PR Review Template

Use this template for all PR reviews in the Dripos ecosystem.

## Template Structure

```markdown
# Code Review: PR #[NUMBER] - [TITLE]

**Status:** [✅ APPROVED | ⚠️ APPROVED with suggestions | ❌ REQUEST CHANGES]

## Issues

### HIGH Priority
[Critical issues that must be fixed before merge. Use Conventional Comments format]

**[label]:** `[file:line]` - [description]
```[language]
[code example if needed]
```

### MEDIUM Priority
[Important but non-blocking issues]

1. **[label]:** `[file:line]` - [description]

### LOW Priority
[Nice-to-haves, nitpicks, future improvements]

- `[file:line]` - [description]
```

## Conventional Comment Labels

Use these labels consistently:

- **issue:** Problems that need to be fixed
- **suggestion:** Improvements or better approaches
- **nitpick:** Minor style/formatting issues
- **question:** Asking for clarification
- **thought:** General observation

## Guidelines

1. **Be Concise:** Keep reviews short and actionable
2. **Prioritize:** Use HIGH/MEDIUM/LOW to indicate urgency
3. **Include file:line:** Always reference specific locations
4. **Code Examples:** Show, don't just tell (when helpful)
5. **Status Clarity:** Use clear emoji indicators for status
6. **No Fluff:** Skip summary, praise, and preamble - get straight to the issues

## Example

```markdown
# Code Review: PR #1443 - POS Tips on Reader

**Status:** ⚠️ APPROVED with suggestions

## Issues

### HIGH Priority
*None*

### MEDIUM Priority

1. **issue:** `src/screens/checkout/steps/payment-step.js:74` - `sendDisplay("cart")` in `componentDidMount` may execute before state is ready. Consider moving to `componentDidUpdate` with guards.

2. **nitpick:** `src/screens/checkout/steps/payment-step.js:739` - `display` added to redux connection but never used in component.

### LOW Priority

- `src/redux/checkout.js:1599` - Extract `"receipt"` string to constant
- `src/redux/display.js:242` - Add error handling for `dispatch(fetchAllTipObjects())`
```
