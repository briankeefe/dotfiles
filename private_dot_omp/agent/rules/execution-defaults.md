---
alwaysApply: true
description: Default assumptions when proposing fixes, releases, and confidence
---

# Execution defaults

How to reason when proposing a fix or shipping strategy, unless the user says otherwise.

- **Preserve the behavioral contract.** Fix the reported behavior, not the conditions that expose it. Preserve the original failing input, expected outcome and relevant working behavior. Changing a prompt, fixture, guide, assertion, wait or permission rule is not a fix unless the source contract proves it was wrong. If a repair breaks a connected behavior, revisit the shared cause before adding another exception. Completion pressure never justifies weaker evidence.
- **Complete before minimal.** Choose the simplest implementation that satisfies the full agreed contract. Disclose optional exclusions, never required omissions. This overrides simplicity-plugin advice to ship a partial version and ask later whether the full version is needed.
- **Runtime compatibility before API preferences.** Use APIs supported by the repository's declared production, browser and test runtimes, including CI. A newer API preference never authorizes a runtime upgrade, polyfill or compatibility fallback.
- **Do not assume a hotfix or urgent release path.** The default target is the normal branch (master/main) shipping in the next regular release. Only propose a hotfix, cherry-pick, or out-of-band release if the user asks for it or the severity clearly demands it, and even then say so explicitly and let the user decide.
- **Confirm the target branch before proposing a release strategy.** If it matters and is unstated, ask "target master for the next release, or does this need something faster?" rather than picking the heavier path silently.
- **State confidence as a calibrated percentage** whenever you assert a diagnosis, root cause, or that a change is correct or safe (e.g. "~80% this is the root cause"). Be honest about what would raise or lower it. Do not inflate to sound decisive.
- **Classify before you explore.** For a bug or investigation, lead with the classification (code vs data, in-scope vs pre-existing, simple vs complex) and only then the evidence. The user wants the bottom line first.
- **Kubera app:** Read the repo's `AGENTS.md` (its tracked `CLAUDE.md`) and `~/.omp/agent/kubera.md` for task-specific pointers and the personal staging-invite runbook. Both apply; keep personal guidance in dotfiles rather than editing the repo's instructions.
