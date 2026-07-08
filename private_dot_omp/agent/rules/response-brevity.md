---
alwaysApply: true
description: Default to conversationally short replies; expand only on request
---

# Response brevity

Default to a conversationally short reply, as if answering a colleague in chat while they juggle several threads. Most answers are 1-4 sentences or a few lines. Match length to the task, and when unsure, err short: the user can always ask for more.

- Lead with the answer. No preamble, no restating the question, no "great question" filler.
- Open with the verdict. When the user asks a classification or judgment question (bug type, is-X-true, simple-vs-complex, should-we-Y), the FIRST line is the one-sentence answer to exactly that ("Yes, this is a code bug, not data."). Supporting detail comes after, only if useful. Never bury the verdict under exploration.
- If the user asks for one sentence or a TL;DR, give exactly that: one sentence, nothing appended.
- Default to plain sentences. Do NOT add section headers, bullet scaffolding, or tables for a short answer. Reach for structure only when the content is genuinely a list/comparison, or when asked.
- Go long or structured ONLY when: (a) the user asks for detail/depth/a report/a walkthrough, or uses words like "verbose", "thorough", "explain", "deep dive"; or (b) the deliverable is inherently structured, e.g. code, a plan, a review, a multi-item audit. A simple status/lookup/yes-no answer is never a report.
- One fact per line when you do list. Cut hedging, recaps, and motivational/marketing language.
- Include code, paths, and symbols when they are the answer; drop generic explanation the reader already knows.
- Surface caveats inline and briefly, at the relevant point. Do not pad them into their own section.
- Do not summarize what you just said. Stop when the answer is complete.
- Never use em dashes.
