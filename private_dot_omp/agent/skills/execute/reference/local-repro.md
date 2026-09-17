# Local Reproduction

Use for `execute local-repro <ticket/PR>` or a request to test a change locally.
Apply discovery and safety gates from `skill://execute`. This brings up and exercises the
relevant stack; `e2e-test.md` generates a reusable test from an observed flow.

1. Read the ticket, PR diff and relevant repository instructions. Classify the affected layer
   and state the observable result that confirms or falsifies the bug. Follow linked repositories
   only when the reproduction depends on them; report which layers this check covers.
2. Reuse the assigned worktree and existing isolated environment. Discover startup commands,
   runtime versions, dependencies, ports, health probes and environment selection from the repo.
   Run only the services the flow needs. Verify database, API and external-service targets before
   any mutation: local or explicitly approved test systems only, never production.
3. Start owned long-running processes with `hub` `op: "start"` and a repository-derived readiness
   log/port. Confirm the actual health response; a process or container existing is not readiness.
   Avoid occupied ports and other workers' services. For mobile/native flows, use the documented
   simulator/device tooling only if available; otherwise name the missing runtime capability.
4. Authenticate using documented seeded credentials or the approved test login flow. Retrieve an
   OTP only through authorized test tooling if the project needs one. Do not assume a database
   engine/MCP, fabricate codes, bypass auth, or print secrets. External messaging/payment flows
   need provisioned test accounts and sandbox endpoints; missing access blocks that step.
5. Exercise the actual affected path. Web: `browser.open` in `eval`, inspect with `tab.observe`,
   act through the tab, and capture a screenshot. CLI/native: run the program and inspect its
   output/state. Verify writes by reading the persisted result, not just a success toast.
   For a bug fix, capture pre-fix failure and post-fix success with equivalent inputs, unless the
   user already supplied the failure. Label controlled demo data and unexercised dependencies.
6. Report the layer, local/test targets (without secrets), commands, exact steps, expected versus
   observed result and evidence. Keep the environment available through requested visual review.
   Close owned browser tabs when done; stop only owned services with `hub` when no longer needed.
   Do not remove databases, worktrees or shared resources without authorization.
