# Local Reproduction

`execute local-repro <ticket/PR>` brings up and exercises the relevant stack. Apply `skill://execute`; `e2e-test.md` generates a reusable test from an observed flow.

1. Read the ticket, diff and repository setup instructions. Identify the affected layer and the observable result that confirms or falsifies the bug. Follow other repositories only when the reproduction depends on them.
2. Reuse the assigned worktree and isolated environment. Discover runtime versions, startup commands, ports, health probes and environment selection from the repo. Verify database/API/external-service targets before any mutation: local or explicitly approved test systems only, never production.
3. Start only needed services and confirm actual readiness, not just process/container existence. Avoid occupied ports and other workers' services. Use documented simulator/device tooling for native flows; report missing runtime capabilities.
4. Use documented seeded credentials or test login. Retrieve an OTP only through authorized test tooling if needed; missing test accounts or access block that step, not permission to invent credentials or bypass auth.
5. Exercise the affected web, native or terminal path and capture evidence. Verify persisted writes rather than only success messages. Compare pre-fix failure with post-fix success unless the user already supplied the failure. Label controlled demo data and unexercised dependencies.
6. Report the layer, local/test targets, commands, steps, expected versus observed result and evidence. Keep the environment through requested visual review; clean up only task-owned resources when no longer needed.
