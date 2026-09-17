# Execute E2E Test

Use for `execute e2e test [flow]`. This command requests durable E2E test generation, not just a screenshot walkthrough. Apply shared defaults from `skill://execute`.

## 1. Resolve the flow and runner

Read the user's request, relevant acceptance criteria, repository instructions, existing E2E tests, runner configuration, and fixtures. Establish the starting surface, expected outcome, required scenarios, and test location from that context. Ask only for unresolved requirements; **STOP** if the intended behavior remains ambiguous.

Use the repository's existing runner, language, selectors, and test conventions. Discover execution syntax from project scripts and installed CLI help. If there is no suitable runner or access to the actual surface, report the missing prerequisite and obtain direction rather than installing a framework or fabricating selectors. Browser-only tests are not a substitute for native application coverage.

The command authorizes the requested test files, not product changes, new infrastructure, publication, or tracker updates. Follow any existing ticket plan approval gate. Stop for approval if the work requires a substantial scope change.

## 2. Prepare a safe environment

- Reuse an assigned worktree and existing local environment. Start required services through `hub` (`op: "start"`) and observe readiness.
- Use an isolated development/test database or tenant with deterministic fixtures and task-owned records. Never run the flow against production, shared customer data, or live payment/email/SMS integrations.
- Reuse documented test authentication and secrets handling. Do not hardcode credentials, commit session state, invent tokens, or bypass authorization. Missing safe authentication is a blocker for the affected flow.
- Ensure each test can run independently, including parallel runs supported by the repository. Follow existing setup/teardown helpers; cleanup must affect only data created by the test.

## 3. Observe and exercise the actual surface

For web flows, use `functions.eval` to open a named tab via `browser.open({ name, url })`, then inspect it with `tab.observe()`. Use direct tab helpers for interactions and `tab.run` only when custom page execution is needed. Observe again after navigation or re-render before acting on IDs/refs; they are not persistent test selectors. Use `tab.select` for native select elements.

Walk the specified flow, checking expected outcomes and relevant failure states. Ask the user about genuinely unspecified choices, not for permission at every already-authorized click. Derive selectors from observed elements and confirm they uniquely identify the intended controls. Prefer accessible roles/names, labels, or existing stable test IDs using the runner's supported APIs. Avoid generated CSS chains, positional selectors, guessed text, and fallback selectors that conceal a changed UI.

Capture screenshots when appearance or interaction state matters, using representative data and no secrets. For non-web E2E, use the project's actual surface and runner rather than forcing browser tooling. If the application contradicts the requirements, report the product defect instead of changing the expected result to match it.

## 4. Generate the smallest useful test

Extend an existing suitable test or add a file in the established test location. Reuse fixtures/helpers rather than creating a selector registry or parallel test framework.

Cover all requested scenarios with assertions on observable outcomes, including persistence or rejection when part of the contract. Use condition-based waits and the runner's retrying assertions, not arbitrary sleeps. Keep tests independent and deterministic; include only meaningful edge cases. Do not include walkthrough transcripts, selector fallback tables, transient browser IDs, credentials, or boilerplate comments in generated code.

## 5. Run and report

Run the generated tests through the existing runner in the isolated environment. Diagnose whether a failure is in the product, test, auth, or environment; fix only authorized test issues. Never weaken assertions, skip a case, or replace an observed selector merely to get green. For a regression test, establish that it detects the original failure and passes after the fix when practicable; disclose any missing pre-fix proof.

Report test paths, covered scenarios, the exact run command and result, relevant screenshots, and any blocked or unverified criteria. Do not claim success until the generated tests have actually passed. Close owned browser tabs when finished, but retain an environment needed for an agreed user review; clean up only owned resources. No commit, push, PR publication, external review posting, or tracker update is implied by this command.
