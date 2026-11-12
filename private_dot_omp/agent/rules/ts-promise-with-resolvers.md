---
description: Choose Promise APIs supported by the repository's production and test runtimes
condition: '\b(?:new\s+Promise|Promise\.withResolvers)\b'
scope: "tool:edit(*.ts), tool:edit(*.tsx), tool:write(*.ts), tool:write(*.tsx)"
interruptMode: never
---

Runtime compatibility takes precedence over API preferences, including in tests. Check the
repository's declared production, browser and CI targets before using `Promise.withResolvers()`;
local runtime support or available TypeScript types alone do not establish target support.

Use the existing `new Promise` executor pattern when a supported target lacks the API or support
is unverified. When every target supports it, follow the existing repository pattern; a preference
for newer APIs alone is not a reason to rewrite working code. Do not upgrade runtimes, add a
polyfill or introduce a fallback merely to satisfy this preference.
