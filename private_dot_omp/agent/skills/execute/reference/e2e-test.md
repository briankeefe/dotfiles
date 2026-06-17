> Ported from /Users/brian/code/EXECUTE_E2E_TEST.md for the Oh My Pi `execute` toolkit. See `skill://execute` for tool conventions.

# Execute E2E Test Generation

## Command
```bash
execute e2e test
```

## Purpose
Interactively walk through a user flow using the Oh My Pi `browser` tool, capturing all selectors and interactions, then automatically generate a complete E2E test file with all discovered selectors.

## Workflow Overview

```
[Ask/Receive] → [Setup] → [Walk Flow] → [Capture] → [Generate] → [Validate]
     │             │           │            │            │            │
   User         Browser     browser tool Selectors    Test File    Run Test
  Defines       Launch      observe/act   Tracking     Creation     Verify
```

---

## Step 1: Gather Test Requirements

**Ask the user** (or receive from command) what needs to be tested:

```
What user flow would you like to create an E2E test for?

Please describe:
1. The feature/flow to test (e.g., "login flow", "add item to cart", "submit payroll")
2. Starting URL or page (e.g., "/payroll", "/settings")
3. Expected outcome (e.g., "success message appears", "redirected to dashboard")
4. Any specific scenarios or edge cases to cover

Example: "Test the bonus payroll flow - start from payroll dashboard, click Bonus Payroll, 
add an employee bonus, submit, and verify success message"
```

**Capture:**
- `testName`: Descriptive name for the test (kebab-case for filename)
- `testDescription`: Human-readable description for test block
- `startingUrl`: Where to begin the flow
- `expectedOutcome`: Success criteria
- `repository`: Which project this test belongs to

---

## Step 2: Initialize Selector Tracking

**Create internal tracking structure:**

```javascript
// Internal state to maintain during walkthrough
const selectorLog = {
  testName: "",
  repository: "",
  startingUrl: "",
  interactions: [], // Ordered list of all interactions
  assertions: [],   // Expected states/validations
};

// Each interaction captures:
{
  step: 1,
  action: "click" | "fill" | "select" | "hover" | "navigate" | "wait",
  description: "Human-readable description of what this does",
  selector: {
    // Primary selector (most reliable)
    primary: "page.getByRole('button', {name: 'Run Payroll'})",
    // Fallback selectors in order of preference
    fallbacks: [
      "page.getByText('Run Payroll')",
      "page.locator('[data-testid=\"run-payroll-btn\"]')"
    ],
    // Raw element id from the most recent tab.observe() snapshot (for reference)
    rawRef: "id=12"
  },
  value: null, // For fill/select actions
  waitAfter: null, // Optional wait condition after action
}
```

---

## Step 3: Launch Browser & Navigate

**Use the `browser` tool to start the session.** Open a named tab once and reuse it across all subsequent `run` calls — the tab survives between calls.

> **Agent-lock (Playwright):** Before launching, ensure no other agent or Playwright session is driving the same browser. Only one active browser/Playwright session should run at a time — acquire the lock, and verify no other Playwright sessions are active before proceeding (see Troubleshooting).

1. **Open a tab and navigate to the starting URL:**
```
browser open  { name: "e2e", url: startingUrl }
```
(Or, in a `run` call against an already-open tab, `await tab.goto(startingUrl)`.)

2. **Take an initial accessibility snapshot:**
```
browser run  { name: "e2e", code: "const obs = await tab.observe(); display(obs); return obs.elements.length;" }
```
`tab.observe()` returns `{ url, title, viewport, scroll, elements: [{ id, role, name, value, states, … }] }`. Element `id`s are stable until the next `observe`/`goto`.

3. **Log initial state:**
```javascript
selectorLog.interactions.push({
  step: 0,
  action: "navigate",
  description: `Navigate to ${startingUrl}`,
  selector: { primary: `await page.goto("${startingUrl}")` },
  value: startingUrl,
});
```

**Authentication Note:** If the flow requires authentication, check if the repository has auth fixtures (like `e2e/fixtures/auth.js`) and note that the generated test should use `authenticatedPage` fixture.

---

## Step 4: Interactive Flow Walkthrough

**CRITICAL**: This is the core of the workflow. Walk through each step WITH the user.

### For Each Step:

#### 4.1 Take Snapshot
```
browser run  { name: "e2e", code: "const obs = await tab.observe(); display(obs);" }
```

#### 4.2 Present Current State
Show the user what's visible and ask:
```
Current page state: [describe visible elements]

What action should we take next?
- Click an element (describe which one)
- Fill a form field (which field, what value)
- Select from dropdown (which dropdown, which option)
- Wait for something (what condition)
- Assert something is visible (what element)
- Done (flow is complete)
```

#### 4.3 Execute Action & Capture Selector

**For CLICK actions** — resolve the observed element by id, or use a selector directly:
```
browser run  { name: "e2e", code: "const obs = await tab.observe(); const el = obs.elements.find(e => e.role === 'button' && e.name === 'Run Payroll'); await (await tab.id(el.id)).click();" }
```
(Equivalently, `await tab.click("aria/Run Payroll")` or any CSS/`text/`/`xpath/` selector.)

Log interaction:
```javascript
{
  step: currentStep,
  action: "click",
  description: "Click the Run Payroll button",
  selector: {
    primary: "page.getByRole('button', {name: 'Run Payroll'})",
    fallbacks: [
      "page.getByText('Run Payroll')",
      "page.locator('button:has-text(\"Run Payroll\")')"
    ],
    rawRef: "id=12"
  },
}
```

**For FILL actions:**
```
browser run  { name: "e2e", code: "await tab.fill('aria/Bonus Amount', '500.00');" }
```
(Use `tab.type(selector, text)` when you need per-keystroke input rather than a direct value set.)

Log interaction:
```javascript
{
  step: currentStep,
  action: "fill",
  description: "Enter bonus amount",
  selector: {
    primary: "page.getByLabel('Bonus Amount')",
    fallbacks: [
      "page.getByPlaceholder('Enter amount')",
      "page.locator('input[name=\"bonusAmount\"]')"
    ],
    rawRef: "id=27"
  },
  value: "500.00",
}
```

**For SELECT actions:**
```
browser run  { name: "e2e", code: "await tab.select('select[name=\"category\"]', 'Drinks');" }
```
(`tab.select(selector, ...values)` sets `<select>` options and returns the values that ended up selected. `tab.fill` does NOT work for selects.)

**For PRESS actions** (keyboard keys, e.g. Enter to submit):
```
browser run  { name: "e2e", code: "await tab.press('Enter', { selector: 'input[name=\"search\"]' });" }
```

**For WAIT actions:**
```
browser run  { name: "e2e", code: "await tab.waitFor('text/Payroll submitted successfully');" }
```
(`tab.waitFor(selector)` resolves once the element is attached. For text not tied to a stable selector, re-`tab.observe()` and confirm the text is present in the snapshot.)

Log interaction:
```javascript
{
  step: currentStep,
  action: "wait",
  description: "Wait for success message",
  selector: {
    primary: "await expect(page.getByText('Payroll submitted successfully')).toBeVisible()",
  },
  waitAfter: { text: "Payroll submitted successfully" },
}
```

#### 4.4 Capture Assertions

After key actions, ask:
```
Should we verify anything at this point?
- Element is visible
- Element contains specific text
- Element has specific value
- URL changed to expected path
- No assertion needed, continue
```

Verify the current state with `tab.observe()` (visibility/text/value via the matching element) or `tab.waitForUrl(pattern)` (URL changes, including SPA pushState). Capture a `tab.screenshot()` when the visual state matters.

Log assertions:
```javascript
selectorLog.assertions.push({
  afterStep: currentStep,
  type: "visible" | "text" | "value" | "url",
  description: "Verify success message appears",
  selector: {
    primary: "page.getByText('Successfully submitted')",
  },
  expected: "Successfully submitted",
});
```

#### 4.5 Selector Quality Guidelines

**Selector Priority (best to worst):**
1. `getByRole()` - Most resilient to UI changes
2. `getByLabel()` - Good for form fields
3. `getByText()` - Good for buttons, links with stable text
4. `getByTestId()` - Explicit test hooks (if available)
5. `getByPlaceholder()` - Form fields with placeholders
6. `locator()` with CSS - Last resort, most brittle

**Always capture multiple selector strategies** for each element to provide fallbacks. The `role` and `name` fields returned by `tab.observe()` map directly to `getByRole({ name })`; use them to derive the primary Playwright selector for the generated test file.

---

## Step 5: Generate Test File

Once the flow is complete, generate the test file.

### 5.1 Determine Test Location

```
Repository: [repository name]
Test Directory: [repository]/e2e/[feature-area]/
Test File: [test-name].spec.js
```

### 5.2 Generate Test Code

**Template** (the generated file targets the `@playwright/test` framework — NOT the interactive `browser` tool used during the walkthrough):
```javascript
const {test, expect} = require("../fixtures/auth");
// Add any helper imports if patterns match existing helpers

test.describe("[Test Description]", () => {
  test("[specific test case]", async ({authenticatedPage: page}) => {
    // Step 0: Navigate
    await page.goto("[startingUrl]");
    
    // Step 1: [description]
    // Selector: [primary selector]
    // Fallbacks: [list fallback selectors as comments]
    await [primary selector].click();
    
    // Step 2: [description]
    await [primary selector].fill("[value]");
    
    // Assertion: [description]
    await expect([selector]).toBeVisible();
    
    // ... continue for all steps
  });
});
```

### 5.3 Include Selector Reference

Add a comment block at the top of the file documenting all captured selectors:

```javascript
/**
 * E2E Test: [Test Name]
 * Generated: [timestamp]
 * 
 * Selector Reference:
 * -------------------
 * Step 1 - Click Run Payroll button:
 *   Primary: page.getByRole('button', {name: 'Run Payroll'})
 *   Fallback 1: page.getByText('Run Payroll')
 *   Fallback 2: page.locator('button:has-text("Run Payroll")')
 * 
 * Step 2 - Fill bonus amount:
 *   Primary: page.getByLabel('Bonus Amount')
 *   Fallback 1: page.getByPlaceholder('Enter amount')
 * 
 * ... etc
 */
```

---

## Step 6: Write Test File

**File location:** `[repository]/e2e/[feature-area]/[test-name].spec.js`

1. Check if feature directory exists, create if needed
2. Write the generated test file
3. Format with Prettier if available

---

## Step 7: Validate Generated Test

### 7.1 Run the Test

```bash
cd [repository]
npx playwright test e2e/[feature-area]/[test-name].spec.js
```

### 7.2 Handle Failures

If test fails:
1. Identify which selector failed
2. Try fallback selectors
3. Update test with working selector
4. Re-run until passing

### 7.3 Success Output

```
## E2E Test Generated Successfully

### Test File
[repository]/e2e/[feature-area]/[test-name].spec.js

### Test Coverage
- Flow: [description of flow]
- Steps: [number] interactions captured
- Assertions: [number] validations

### Selectors Captured
| Step | Action | Primary Selector |
|------|--------|------------------|
| 1    | click  | page.getByRole('button', {name: 'Run Payroll'}) |
| 2    | fill   | page.getByLabel('Bonus Amount') |
| ...  | ...    | ... |

### Run Command
npx playwright test e2e/[feature-area]/[test-name].spec.js
```

---

## Best Practices

### Selector Reliability

| Strategy | Reliability | Use When |
|----------|-------------|----------|
| `getByRole` | ⭐⭐⭐⭐⭐ | Buttons, links, headings, form controls |
| `getByLabel` | ⭐⭐⭐⭐⭐ | Form fields with labels |
| `getByText` | ⭐⭐⭐⭐ | Static text content |
| `getByTestId` | ⭐⭐⭐⭐ | When data-testid exists |
| `getByPlaceholder` | ⭐⭐⭐ | Form fields without labels |
| CSS Selectors | ⭐⭐ | Last resort only |

### Wait Strategies

Always include appropriate waits:
- After navigation: `await page.waitForLoadState('domcontentloaded')`
- After clicks that trigger loads: `await expect([element]).toBeVisible({timeout: 10_000})`
- For animations: `await page.waitForTimeout(500)` (use sparingly)

### Test Isolation

- Each test should be independent
- Use `test.beforeEach` for common setup
- Clean up test data if needed (check for helper patterns in `e2e/fixtures/`)

---

## Example Session

```
User: execute e2e test

Agent: What user flow would you like to create an E2E test for?

User: Test adding a new menu item - start from menu page, click add item, 
fill in name and price, save, verify it appears in the list

Agent: Got it! Let me set up the test tracking and launch the browser.

[browser open { name: "e2e", url: "/menu" }]
[tab.observe()]

Agent: I'm on the menu page. I can see:
- "Add Item" button in the top right
- List of existing menu items
- Search/filter controls

The first step is to click "Add Item". Proceeding...

[tab.click("aria/Add Item")]
[Captures: page.getByRole('button', {name: 'Add Item'})]

Agent: A modal opened with form fields:
- Name input (required)
- Price input
- Category dropdown
- Description textarea

What should we fill in for the Name field?

User: "Test Latte"

[tab.fill("aria/Name", "Test Latte")]
[Captures: page.getByLabel('Name')]

... [continues through flow] ...

Agent: Flow complete! Generating test file...

[Writes test file to Dripos-React-Partner/e2e/menu/add-item.spec.js]

Agent: ## E2E Test Generated Successfully

### Test File
Dripos-React-Partner/e2e/menu/add-item.spec.js

### Selectors Captured
| Step | Action | Primary Selector |
|------|--------|------------------|
| 1    | click  | page.getByRole('button', {name: 'Add Item'}) |
| 2    | fill   | page.getByLabel('Name') |
| 3    | fill   | page.getByLabel('Price') |
| 4    | click  | page.getByRole('button', {name: 'Save'}) |
| 5    | assert | page.getByText('Test Latte') |

Running test to validate...
✓ Test passed!
```

---

## Troubleshooting

### Browser Not Launching
- Check if Playwright is installed: `npx playwright install chromium`
- Verify no other browser/Playwright sessions are active (only one active session is supported at a time)

### Selectors Not Found
- Take a fresh snapshot with `tab.observe()`
- Check if element is in viewport (may need `tab.scrollIntoView(selector)` or `tab.scroll(dx, dy)`)
- Check if element is inside an iframe
- Wait for element to be rendered (`tab.waitFor(selector)`)

### Auth Issues
- Verify auth fixtures exist for the repository
- Check if session token is still valid
- May need to refresh QE session token

### Flaky Tests
- Add explicit waits for async operations
- Use more specific selectors
- Increase timeouts for slow operations

---

## Related Commands

- `execute sanity check` - Validate implementation before committing
- `execute [ticket-name]` - Full ticket workflow (includes E2E in Step 12)

---

*This workflow combines interactive exploration with automated test generation to create maintainable, well-documented E2E tests.*
