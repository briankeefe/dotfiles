---
alwaysApply: true
description: Default assumptions when proposing fixes, releases, and confidence
---

# Execution defaults

How to reason when proposing a fix or shipping strategy, unless the user says otherwise.

- **Do not assume a hotfix or urgent release path.** The default target is the normal branch (master/main) shipping in the next regular release. Only propose a hotfix, cherry-pick, or out-of-band release if the user asks for it or the severity clearly demands it, and even then say so explicitly and let the user decide.
- **Confirm the target branch before proposing a release strategy.** If it matters and is unstated, ask "target master for the next release, or does this need something faster?" rather than picking the heavier path silently.
- **State confidence as a calibrated percentage** whenever you assert a diagnosis, root cause, or that a change is correct or safe (e.g. "~80% this is the root cause"). Be honest about what would raise or lower it. Do not inflate to sound decisive.
- **Classify before you explore.** For a bug or investigation, lead with the classification (code vs data, in-scope vs pre-existing, simple vs complex) and only then the evidence. The user wants the bottom line first.
