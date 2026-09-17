# Execute E2E Test

Use for `execute e2e test [flow]`. This command requests durable E2E test generation, not just a screenshot walkthrough. Apply shared defaults from `skill://execute`.

## 1. Resolve the flow and runner

Read the user's request, relevant acceptance criteria, repository instructions, existing E2E tests, runner configuration, and fixtures. Establish the starting surface, expected outcome, required scenarios, and test location from that context. Ask only for unresolved requirements; **STOP** if the intended behavior remains ambiguous.

Use the repository's existing runner, language, selectors, and test conventions. Discover execution syntax from project scripts and installed CLI help. If there is no suitable runner or access to the actual surface, report the missing prerequisite and obtain direction rather than installing a framework or fabricating selectors. Browser-only tests are not a substitute for native application coverage.

The command authorizes test generation, not product changes or new infrastructure. Raise material scope changes before proceeding.

## 2. Prepare a safe environment

- Reuse the assigned worktree and local environment; confirm service readiness.
- Use an isolated development/test database or tenant with deterministic fixtures and task-owned records. Never run the flow against production, shared customer data, or live payment/email/SMS integrations.
- Reuse documented test authentication and secrets handling. Do not hardcode credentials, commit session state, invent tokens, or bypass authorization. Missing safe authentication is a blocker for the affected flow.
- Ensure each test can run independently, including parallel runs supported by the repository. Follow existing setup/teardown helpers; cleanup must affect only data created by the test.

## 3. Observe and exercise the actual surface

Observe the actual surface before interacting; transient browser element IDs are not persistent test selectors.

Walk the specified flow, checking expected outcomes and relevant failure states. Ask the user about genuinely unspecified choices, not for permission at every already-authorized click. Derive selectors from observed elements and confirm they uniquely identify the intended controls. Prefer accessible roles/names, labels, or existing stable test IDs using the runner's supported APIs. Avoid generated CSS chains, positional selectors, guessed text, and fallback selectors that conceal a changed UI.

Capture screenshots when appearance or interaction state matters, using representative data and no secrets. For non-web E2E, use the project's actual surface and runner rather than forcing browser tooling. If the application contradicts the requirements, report the product defect instead of changing the expected result to match it.

## 4. Generate the smallest useful test

Extend an existing suitable test or add a file in the established test location. Reuse fixtures/helpers rather than creating a selector registry or parallel test framework.

Cover all requested scenarios with assertions on observable outcomes, including persistence or rejection when part of the contract. Use condition-based waits and the runner's retrying assertions, not arbitrary sleeps. Keep tests independent and deterministic; include only meaningful edge cases. Do not include walkthrough transcripts, selector fallback tables, transient browser IDs, credentials, or boilerplate comments in generated code.

## 5. Run and report

Run the generated tests through the existing runner in the isolated environment. Diagnose whether a failure is in the product, test, auth, or environment; fix only authorized test issues. Never weaken assertions, skip a case, or replace an observed selector merely to get green. For a regression test, establish that it detects the original failure and passes after the fix when practicable; disclose any missing pre-fix proof.

Report test paths, covered scenarios, exact run command/result, screenshots and unverified criteria. Keep an environment needed for user review; clean up only task-owned resources.
