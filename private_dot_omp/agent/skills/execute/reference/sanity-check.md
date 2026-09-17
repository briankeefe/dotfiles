# Execute Sanity Check

Use for `execute sanity check [scope]` to assess completed work against its requirements. Apply shared defaults from `skill://execute`. This is a review, not automatic authorization to edit or publish.

## 1. Establish what is being checked

Read the original request/ticket, approved plan and subsequent decisions, relevant repository instructions, the complete in-scope change, and available verification evidence. Derive the comparison base and files from the current assignment or PR; do not assume the last commit is the whole change.

If requirements or the intended scope cannot be established from available context, **STOP** and ask for the specific missing information. Do not invent acceptance criteria or report a pass based only on code style.

## 2. Check requirements, correctness, and scope

- Account for **every acceptance criterion** as satisfied, missing, or unverified, with a source location or observed evidence. Distinguish implementation inspection from runtime proof.
- Check relevant happy paths, boundaries, failures, and preserved behavior. Review security and authorization boundaries, state ownership, data integrity, and performance-sensitive paths where affected.
- Compare with existing repository patterns and instructions, not universal preferences about languages, frameworks, mutation, component styles, or syntax. Separate genuine defects from stylistic suggestions.
- Identify unnecessary features, abstractions, dependencies, refactors, or unrelated edits. Do not revert user work or silently expand the approved scope.
- Separate in-scope defects from pre-existing issues. Ground findings in affected files and explain the observable impact; give calibrated confidence for diagnoses rather than presenting guesses as facts.

A checklist or reviewer opinion is not runtime evidence.

## 3. Assess verification

Reuse current, applicable results without repeating checks just to reconfirm reported observations. If evidence is missing or invalidated by later edits, run the smallest relevant check in a safe, isolated environment and report the exact outcome. Use documented project commands and installed CLI help, not assumed package managers or test runners.

For bug fixes, check that the original failure is prevented. For UI changes, inspect the actual surface and relevant screenshots; passing logic tests alone do not prove appearance or interaction.

Do not force a browser, E2E test generation, or a new test suite for changes they cannot meaningfully verify. Report unavailable runtime access or missing required CI-equivalent checks as gaps, not passes.

## 4. Give the verdict

Lead with **PASS**, **WARNING**, or **FAIL**, followed by only material findings:

- **PASS:** all requirements have evidence, relevant checks passed, and no blocking correctness or scope issue was found within the inspected scope.
- **WARNING:** non-blocking concerns or explicit verification gaps remain; name what is not established.
- **FAIL:** required behavior is missing, a blocking defect exists, or required verification failed or is blocked.

List each finding with its location/evidence, impact and smallest recommended action. Include exact checks and unverified criteria. This command reports findings; apply fixes only when requested or already authorized.
