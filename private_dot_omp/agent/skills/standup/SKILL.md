---
name: standup
description: Prepare a concise standup update from evidence of the user's recent work. Use when the user asks to prep for standup, asks what they worked on since the previous weekday at 11:00 AM, asks what they are working on today, or invokes /standup.
argument-hint: "[optional scope]"
---

# Standup

Produce a standup-ready update covering:

1. completed or materially advanced work since 11:00 AM on the previous weekday, in the user's local timezone;
2. work currently in progress today;
3. blockers that are evidenced by the available sources.

Do the research. Do not ask the user to remember their own work.

## Time window

Calculate the start in local time:

- Monday: previous Friday at 11:00 AM.
- Tuesday through Friday: previous calendar day at 11:00 AM.
- Saturday or Sunday: previous Friday at 11:00 AM.

The end is now. “Today” starts at local midnight.

## Evidence

Use available authenticated and local sources, preferring direct evidence:

1. Recent OMP conversation/session context and durable memories.
2. Git commits, uncommitted changes, and active worktrees under the current code directory.
3. Pull requests authored, reviewed, commented on, merged, or updated by the user during the window.
4. Assigned or recently updated issue-tracker work, including status changes and comments.

Discover repository hosts, issue providers, identities, and supported CLI flags from the environment. Reuse authenticated integrations. Do not assume a specific organization, repository, tracker, default branch, or CLI syntax.

Use timestamps to enforce the window. Repository directory modification time is discovery evidence only, never proof of work. An assigned issue alone is not proof that the user worked on it. An open worktree alone is not proof that it is today's focus.

## Synthesis

- Deduplicate commits, PRs, tickets, and sessions that describe the same work into one outcome-oriented item.
- Prefer user-visible or engineering outcomes over commit-by-commit narration.
- Include ticket or PR links when available.
- Put unfinished work under **Today**, even if it began before today.
- Put merged, shipped, completed, or materially advanced work under **Since last standup**.
- Report a blocker only when evidence shows progress is blocked. Do not turn uncertainty, pending review, or ordinary follow-up into a blocker.
- If evidence conflicts, prefer the newest direct evidence and state the uncertainty briefly.
- Omit categories with no supported items. Never invent activity to make the update look complete.

Before drafting, read `skill://brian-voice` and write the update in Brian's voice. Keep the evidence requirements and compact standup format below; do not add unsupported claims or forced slang.

## Output

Use this compact format:

**Since last standup**
- <past-tense outcome, with ticket/PR link when useful>

**Today**
- <current focus and next concrete step>

**Blockers**
- <blocker and what is needed>

Keep it speakable in under one minute. Use first person, plain language, and at most five bullets total unless the user asks for detail. End with one short evidence note naming the sources checked and the exact local-time window.
