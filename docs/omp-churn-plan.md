# Plan: `execute-churn` OMP extension

**Disabled on 2026-10-13 at Brian's request.** The implementation and tests are
preserved in `private_dot_omp/agent/disabled-extensions/execute-churn/`, outside
OMP's extension discovery directory. This document is historical; the paths and
activation instructions below describe the former active installation.

An observe-only progress and churn monitor for `execute <task>` implementation workflows, shown in the
Oh My Pi TUI. Its job is to make token-wasting loops on one concept visible early, give a cheap
evidence-based next experiment, and let the user steer explicitly with `/churn nudge`. It never aborts
work, never resumes work on its own and never starts a turn.

Source evidence is OMP 18.8.4 at `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent`
(written below as `OMP/`). Anything not proven by source is marked **runtime-proof** and must be
observed during the smoke run.

## Source findings that shape the design

1. **Activation hook is `before_agent_start`, not `input` and not `/skill:` parsing.**
   - `input` fires only for interactive or RPC editor submissions (`OMP/src/modes/controllers/input-controller.ts:927`,
     `rpc-mode.ts:1767`). The CLI initial message (`omp "execute X"`) goes straight to `session.prompt`
     (`OMP/src/main.ts:768`) and never emits `input`.
   - `before_agent_start` fires for every user-containing dispatch with the *already transformed* prompt
     (`OMP/src/session/agent-session.ts:7632`, type doc at `types.ts:845`). That covers all three entry
     shapes:
     - plain `execute X` arrives verbatim;
     - `/execute X` is expanded by `expandSlashCommand` (`agent-session.ts:7199`) from
       `~/.omp/agent/commands/execute.md` into ``Run the `execute` toolkit for: `X` `` followed by
       ``Read `skill://execute`…``;
     - `/skill:execute X` becomes a custom message rendered from `OMP/src/prompts/skills/user-invocation.md`:
       `[IMPORTANT: User invoked the "execute" skill; …]` + body + `[Skill directory: …]` + a final
       `User: X` line. Its text content is the `prompt` passed to `#prepareAgentStart`
       (`agent-session.ts` `#dispatchCustomPrompt` to `#promptWithMessage(…, textContent)`).
   - The existing `herdr-workspace-namer.ts:270` already classifies plain `execute …` from
     `before_agent_start`, so this is the established local pattern.
   - Queued batches join user messages with blank lines (`types.ts:847`). Match only at the start of
     the prompt.
2. **Status text is invisible in this user's TUI.** `private_dot_omp/agent/config.yml` sets
   `statusLine.showHookStatus: false`, and `pi-tui/src/status-line/component.ts:3554,3726,3753` then
   drops every `setStatus` value. The **widget** (`ctx.ui.setWidget`, `extension-ui-controller.ts:344`)
   is not gated. It replaces by key and truncates past 10 lines (`MAX_WIDGET_LINES`). Use exactly one
   widget key and no status text.
3. **Usage fields** (`pi-catalog/src/types.ts:197`): `input` is non-cached input, plus `output`,
   `cacheRead`, `cacheWrite` and `cost.{input,output,cacheRead,cacheWrite,total}`. `totalTokens` sums
   all buckets including cache reads, so don't display it as spend. `cost.total` can be 0 for
   subscription or unpriced models. Show "n/a" in that case, not "$0".
4. **Side-model call:** `complete(model, context, {apiKey, headers, signal, maxTokens})` from
   `@oh-my-pi/pi-ai` (`pi-ai/src/stream.ts:1119`), as `examples/hooks/qna.ts` does. Credentials come
   from `ctx.modelRegistry.getApiKeyAndHeaders(model)` (`config/model-registry.ts:2998`), which
   returns `{ok:false,error}` instead of throwing. Model choice uses `ctx.models.resolve(spec)`
   (`extensions/model-api.ts`), which follows core role resolution and expands `@role` aliases. The
   user's config has `smol: anthropic/claude-haiku-4-5:minimal`, so `@smol` should resolve. Proving
   it resolves and that Anthropic subscription auth works through `complete()` is **runtime-proof**.
   `runEphemeralTurn` (`types.ts:536`) is rejected: it replays the full session context, which is
   the cost this feature is meant to avoid.
5. **Import resolution:** the extension loader maps `@oh-my-pi/pi-ai` for extensions
   (`extensibility/plugins/legacy-pi-compat.ts:819`). That mapping does not exist under `bun test` in
   this repo, which has no `node_modules`, so import `complete` lazily inside the assessor
   (`await import("@oh-my-pi/pi-ai")`). Tests then only need `import type`, the same convention as
   `herdr-workspace-namer.test.ts`.
6. **Handler budget:** extension handlers time out at 30 s (`runner.ts:130`). The assessment must be
   fire-and-forget from `turn_end` and must never be awaited in a handler. Use `ctx.setTimeout`
   only if a timer is needed; it is contained and cleared on shutdown (`managed-timers.ts`).
7. **Nudge delivery** (`agent-session.ts` `#dispatchCustomPrompt` ~8665–8760):
   `pi.sendMessage(msg, {deliverAs:"steer"})` *without* `triggerTurn` behaves as follows:
   - while streaming, it goes to `agent.steer` and is consumed at the next step. Queued steering can
     interrupt an `interruptible` tool (`pi-agent-core/src/agent-loop.ts:185`);
   - while idle, it is appended to context and the session file, and **no turn starts**.

   That is the only option that cannot start a turn under the streaming-to-idle race. `aside`
   starts a turn when idle unless an Esc interrupt is still in effect, and `triggerTurn` always
   starts one. Use `steer` without `triggerTurn`.
8. **Identity gating:** subagents and advisor tool calls also reach extension handlers.
   `ctx.agent.kind` is `"main"` only for the top-level session (`types.ts:466`). Gate every handler
   on it.
9. **Existing loop guard:** the primary session has an *exact identical tool-call* guard
   (`session/settings.ts:313`, `model.toolCallLoopGuard.*`, default on, threshold 5, wired via
   `session/stream-guards.ts`). The advisor's `advisor/loop-guard.ts` covers only the advisor's own
   loop. Neither catches semantic churn, such as different commands chasing the same hypothesis.
   This extension complements the guard and does not duplicate it.
10. **Lifecycle events** (`extensibility/shared-events.ts`):
    - `session_start`;
    - `session_switch{reason:"new"|"resume"|"fork"}`;
    - `session_branch`;
    - `session_tree`;
    - `session_compact`;
    - `auto_compaction_start`;
    - `turn_end{message, toolResults}`;
    - `agent_end{messages, willContinue}`;
    - `message_end{message}`;
    - `session_shutdown`.

    Assistant `stopReason` is one of `stop|length|toolUse|error|aborted`. `pi.appendEntry(type, data)`
    persists non-LLM state and `ctx.sessionManager.getBranch()` reads it back, which is the herdr
    rehydrate pattern.
11. **Isolated launch:** `--no-extensions` switches discovery to `"explicit-only"` (`main.ts:1784`),
    and `-e <path>` adds a single extension. `--trusted-extension` cannot be combined with `-e`
    (`cli/args.ts:393`). Extension directories load only `index.ts`/`index.js`
    (`extensions/loader.ts:527`), so a test file beside `index.ts` is not loaded as an extension.

## Acceptance criteria

1. **Activation.** These start a new tracked task (widget appears, counters reset):
   - `execute <ticket|free text>`;
   - `/execute <…>`;
   - `/skill:execute <…>`;
   - the CLI initial message `omp "execute …"`;
   - the implementation commands `update-pr`, `shepherd-pr` and `e2e test`.

   These do **not** start one: empty args, `help`, `pr summary`, `pr review`, a bare PR URL,
   `actionable pr`, `sanity check`, `init project`, `next task`, `update project`, `docs`,
   `release-check`, `local-repro` and `ops`. A non-implementation execute invocation ends any
   active task and clears the widget.
2. **Persistence.** Ordinary follow-up prompts, steering and `.`/`c` continues keep the task.
   A new execute task replaces it. `/new` (`session_switch` with reason `new`) clears it.
   Resume, fork, branch and tree rehydrate the latest persisted snapshot on that branch.
3. **Measured counters.** For main-session assistant messages since task start, show turns, output
   tokens, non-cached input (`input + cacheWrite`), `cacheRead` (shown separately and labelled as
   cache, not spend) and `cost.total`, or `n/a` when every message reports 0. Assessment spend is
   shown on its own line. Subagent and task-tool spend is excluded and `/churn` says so.
4. **Bounded assessment.** At most one assessment is in flight. Assessments start only on the
   cadence triggers, a settled `agent_end`, or `/churn check`. Each assessment's input is a bounded
   digest, never the transcript. There is a per-task cap and a per-call output cap.
5. **Evidence-only progress.** A criterion counts as verified only when it has cited evidence from
   tool results. Progress is shown as a range labelled `est.`, with confidence and "as of turn N".
   Edits and todos alone never raise it. Eliminated hypotheses and new reproduction evidence count
   as progress.
6. **Failure handling.** None of the following change the last accepted assessment:
   - unresolved model;
   - auth failure;
   - provider error;
   - empty response;
   - invalid JSON;
   - schema violation;
   - timeout.

   Each failure shows as a visible assessor line, such as `assessor unavailable: …` or
   `assessment failed: …`. A failure never shows a fake estimate.
7. **Staleness.** Compaction, session switch, a new task, `/churn off` or an Esc abort cancels the
   in-flight call (AbortController) and bumps an epoch. A late result is discarded, but its usage
   still counts toward assessment spend.
8. **Off means off.** After `/churn off`, zero side-model calls happen, the widget is cleared and
   the state is persisted. `/churn on` re-enables tracking for the current task.
9. **Explicit intervention only.** `/churn nudge` sends one user-requested, displayed steering
   message built from the last accepted assessment (stall reason, eliminated hypotheses, next
   cheapest experiment):
   - while streaming, it uses `deliverAs:"steer"`;
   - while idle or after an abort, it appends to context **without starting a turn** and tells the
     user it will ride along with their next prompt.

   No automatic abort, nudge or resume ever happens.
10. **Verification.** The deterministic `bun test` passes, and a live isolated TUI smoke shows the
    widget plus a real-provider assessment.

## Files and ownership

| Path | Change |
|---|---|
| `private_dot_omp/agent/extensions/execute-churn/index.ts` | New. The default export registers handlers and the command. It also exports pure helpers for tests: `classifyExecutePrompt`, `parseAssessment`, `renderWidget`, and `register(pi, assess)` with an injectable assessor. |
| `private_dot_omp/agent/extensions/execute-churn/index.test.ts` | New. One behavior test file using the Bun convention of `herdr-workspace-namer.test.ts`. |
| `README.md` | One line in the OMP section (lines ~172 and ~342), added after the runtime proof. |

Do not touch: `AGENTS.md`, `herdr-omp-agent-state.ts`, `kubera.md`, `mcp.json`, `kubera-runtime.md`,
`config.yml`, or the installed OMP package. Add no dependencies and no new settings files. The only
knob is the optional env var `OMP_EXECUTE_CHURN_MODEL` (default `@smol`). It exists because the role
may be missing on other machines and the smoke needs a forced-failure case.

## Design

### Activation: `classifyExecutePrompt(prompt) → {task: string} | "other-execute" | undefined`

Extract the arguments by shape, tried in this order on the trimmed prompt:

1. **Skill:** the prompt starts with `[IMPORTANT: User invoked the "execute" skill;`. The arguments
   are the text after the last `\nUser: ` that follows the last `[Skill directory:`, or `""` if
   there is none.
2. **Command template:** ``/^Run the `execute` toolkit for: `([\s\S]*)`\s*\n+\s*Read `skill:\/\/execute`/``.
3. **Plain:** `/^execute(?:\s+([\s\S]*))?$/i`.
4. Anything else returns `undefined`, so the active task is kept.

Then route the arguments:

- empty or `help` returns `"other-execute"`;
- `/^(pr summary|pr review|actionable pr|sanity check|init project|next task|update project|docs|release-check|local-repro|ops)\b/i`
  or a bare `https?://…/pull/N` URL returns `"other-execute"`;
- everything else returns `{task}`, which covers ticket, free text, `update-pr`, `shepherd-pr` and
  `e2e test`.

`ponytail:` the template and skill-wrapper text are coupled to the OMP and user templates. The tests
pin them. If either template changes, activation silently degrades to no widget, and the smoke
catches that.

### State (closure per extension instance, main session only)

```ts
type Snapshot = {
  taskId: string; task: string; enabled: boolean;
  main: { turns: number; output: number; uncachedIn: number; cacheRead: number; cost: number };
  assess: { calls: number; failures: number; discarded: number; input: number; output: number; cacheRead: number; cost: number };
  last?: Assessment & { atTurn: number };   // last ACCEPTED assessment only
  lastError?: string;                        // shown in the widget, never mixed into `last`
};
```

Volatile fields:

- `epoch`, which is bumped on compaction, switch, new task, off and abort;
- `inflight?: {controller, epoch, taskId}`;
- `sinceAssess: {turns, output, startedAt}`;
- `events`, a ring of at most 60 compact digest entries, kept in memory and not persisted.

Persist the `Snapshot` with `pi.appendEntry("execute-churn", snap)` on task start, accepted
assessment, off/on and task end. Rehydrate from the latest entry on the branch in `session_start`,
`session_switch` (`resume`/`fork`), `session_branch` and `session_tree`. On `session_switch` with
`new`, clear the state. A rehydrated task restarts with an empty event ring. Say so in the widget
(`digest resets after resume`) instead of re-reading the transcript.

### Handlers (all return early unless `ctx.agent.kind === "main"`)

| Event | Action |
|---|---|
| `before_agent_start` | Run `classifyExecutePrompt`. `{task}` aborts in-flight work and starts a new snapshot. `"other-execute"` aborts and clears. `undefined` adds a `user` digest entry (first 300 chars of the follow-up) when a task is active. |
| `message_end` (assistant) | Add the usage buckets to `main`. |
| `turn_end` | Push digest entries. For each `toolCall`, record the name and an argument summary of at most 160 chars (`command`/`path`/`pattern`/first string arg). For each tool result, record `isError` plus the first 200 chars of errors or the last 200 chars of output. Record the final assistant text (first 300 chars). Increment `sinceAssess`. If `stopReason === "aborted"`, cancel in-flight work, show `paused (aborted)` and return. Otherwise call `maybeAssess("cadence")`. |
| `agent_end` | If `!willContinue`, the last assistant message is not aborted or errored, and `sinceAssess.turns >= 3`, call `maybeAssess("settled")`. |
| `auto_compaction_start`, `session_compact` | Abort in-flight work and bump the epoch. Counters and events are kept because they are extension-side and unaffected by compaction. |
| `session_shutdown` | Abort in-flight work. |

### Triggers (heuristic defaults as `const`s at the top of the file, tune after real use)

| Constant | Value |
|---|---|
| `EVERY_TURNS` | 8 |
| `EVERY_OUTPUT_TOKENS` | 40_000 |
| `MIN_INTERVAL_MS` | 90_000 (cadence only, `check` bypasses it) |
| `MAX_ASSESSMENTS_PER_TASK` | 12 (`check` also counts) |
| `ASSESS_MAX_OUTPUT_TOKENS` | 700 |
| `ASSESS_TIMEOUT_MS` | 45_000 |
| `DIGEST_MAX_CHARS` | 12_000 (newest events win, the task text is capped at 1_500) |

`maybeAssess` returns without assessing when:

- the state is disabled or has no task;
- an assessment is in flight;
- the cap is reached (the widget shows `assessor cap reached`);
- cadence and interval are not yet met.

Otherwise it calls `void runAssessment(...)`, never awaited.

### `runAssessment(ctx, reason)`

1. Capture `epoch` and `taskId`, create an `AbortController`, and combine its signal with
   `AbortSignal.timeout(ASSESS_TIMEOUT_MS)`.
2. Resolve the model with `ctx.models.resolve(process.env.OMP_EXECUTE_CHURN_MODEL ?? "@smol")`.
   If that returns `undefined`, set `lastError = "assessor unavailable: <spec> unresolved"`, count a
   failure, render and return.
3. Get credentials with `ctx.modelRegistry.getApiKeyAndHeaders(model)`. On `!ok`, set
   `lastError = "assessor auth failed: <error>"`.
4. Call `assess(model, {systemPrompt, messages:[{role:"user", content: digest, timestamp}]}, {apiKey, headers, signal, maxTokens})`.
   The production `assess` lazily imports `complete`.
5. Always add `response.usage` to `assess.*`, even if the result is later discarded.
6. Discard the result if the epoch or task changed, or if the signal aborted. Count it in
   `discarded`, make no state change and do nothing else.
7. Treat `stopReason` `error` or `aborted`, or empty text, as a failure that sets `lastError`.
8. Otherwise run `parseAssessment(text)`. Failure sets
   `lastError = "assessment rejected: <reason>"`. Success sets
   `last = {...a, atTurn: main.turns}`, clears `lastError`, resets `sinceAssess`, persists and
   renders.

Any throw is caught, counted as a failure, sets `lastError` and renders.

### Digest sent to the side model (never the transcript)

The digest contains:

- the task text;
- the previous accepted assessment JSON, which carries eliminated hypotheses forward cheaply;
- main counters;
- the event lines since the last assessment, newest first, up to `DIGEST_MAX_CHARS`.

The system prompt is short and fixed. It states these rules:

- infer the phase (`understand|reproduce|plan|implement|verify|review|blocked`) and the current
  objective;
- list acceptance criteria, at most 8;
- `verified` requires quoting the passing tool evidence, and edits or todos are never evidence;
- list hypotheses eliminated by evidence;
- set `newEvidence` if this window produced reproduction, verification or elimination evidence;
- give a progress range that is an estimate, not a bound;
- set `stalled` only when the same concept or hypothesis is revisited without new evidence,
  stating which one;
- `nextExperiment` is the cheapest discriminating check;
- output JSON only.

### `parseAssessment(text) → {ok:true, value} | {ok:false, reason}` (trust boundary)

Hand-written validation, with no schema dependency:

- strip code fences and parse the first `{…}`;
- require these fields:
  - `phase` must be in the enum;
  - `objective` is a string of at most 160 chars, truncated otherwise;
  - `criteria` is an array of at most 8 items, each `{text ≤120, status ∈ verified|pending|failed|unknown, evidence ≤160}`;
  - `eliminated` is an array of at most 6 strings, each at most 100 chars;
  - `newEvidence`, `stalled` and `confidence` are typed;
  - `progressLow` and `progressHigh` are integers from 0 to 100 with `low ≤ high`;
  - `stallReason` and `nextExperiment` are strings.
- downgrade `verified` without evidence to `unknown`;
- reject on any other type mismatch, and never partially accept.

### Widget (`renderWidget(snapshot, state) → string[]`, key `execute-churn`, `aboveEditor`, at most 4 lines)

```
execute ▸ <task ≤40> · turn 23 · out 48k · new-in 12k · cache-read 1.9M · $0.84|n/a
est. 40–60% (low conf, as of turn 20) · phase reproduce · criteria 1/4 verified · 2 hypotheses eliminated
⚠ possible churn: <stallReason> → cheapest next check: <nextExperiment>  (/churn nudge)
assessor smol/claude-haiku-4-5 · 3 calls · $0.01 | assessor unavailable: … | paused (aborted)
```

- Line 2 reads `no assessment yet` before the first accepted assessment.
- Line 3 appears only when `last.stalled` is set.
- The warning text uses `ctx.ui.theme.fg("warning", …)`. The theme is available on the UI context
  (`extension-ui-controller.ts:151`).
- The widget is cleared with `setWidget(key, undefined)` when there is no task or the state is off.
- Guard every UI call with `ctx.hasUI`. Print and RPC modes still count, but do not render.

### Command: `/churn [status|check|off|on [task]|nudge]`

- `status` (the default): `ctx.ui.notify` the full assessment, with each criterion and its
  evidence, eliminated hypotheses and accounting. It includes the caveat that counters cover main
  session assistant messages since task start, exclude subagent and task-tool spend, and that
  cache reads are shown separately and are not spend.
- `check`: `maybeAssess("manual")`. It bypasses cadence but not the in-flight or cap limits.
- `off`/`on`: toggle `enabled`, abort in-flight work and persist. `on <text>` starts a manual task
  when none is active, so tracking is possible outside execute.
- `nudge`: requires `last`, otherwise it notifies `no assessment to nudge from`. It calls
  `pi.sendMessage({customType:"execute-churn-nudge", content, display:true, attribution:"user"}, {deliverAs:"steer"})`
  with no `triggerTurn`. When idle it also notifies
  `nudge added to context; it will be sent with your next prompt`.

## Ordered steps

1. **Red.** Write `index.test.ts`, importing from `./index` (which does not exist yet). Run it and
   confirm it fails because the module is missing:
   `bun test /Users/brian/code/dotfiles/private_dot_omp/agent/extensions/execute-churn/index.test.ts`.
   The tests are:
   - **classify:** plain, template and skill-wrapper shapes all yield `{task}`, using the real
     `user-invocation.md` text with a dummy body. `help`, empty, `pr review <url>`, a bare PR URL
     and `ops x` yield `"other-execute"`. `"also check the logs"` yields `undefined`.
   - **parseAssessment:**
     - valid JSON is accepted;
     - fenced JSON is accepted;
     - `verified` without evidence is downgraded;
     - `progressHigh < progressLow` is rejected;
     - non-JSON is rejected;
     - an empty string is rejected.
   - **lifecycle with fake `pi`/`ctx` and an injected deferred `assess`.** The fake records
     handlers and command, the `setWidget` calls and `sendMessage` options, with
     `agent:{kind:"main"}`, `isIdle`, `models.resolve` and
     `modelRegistry.getApiKeyAndHeaders`. The test steps are:
     1. A `/skill:execute` prompt shows the widget.
     2. Push turns until the cadence triggers once, then trigger again while it is in flight.
        Expect exactly one `assess` call.
     3. Fire `session_compact`, then resolve the call. Expect `last` undefined, `discarded` 1 and
        spend counted.
     4. A provider-error response leaves the previous `last` intact and shows `lastError`.
     5. A follow-up non-execute prompt keeps the task.
     6. `/churn off` followed by 20 turns makes zero further `assess` calls.
     7. `resolve` returning `undefined` shows `assessor unavailable`.
     8. `/churn nudge` with `isIdle()=true` calls `sendMessage` with `deliverAs:"steer"` and no
        `triggerTurn`, and never calls `sendUserMessage`.
     9. `execute help` clears the widget.
2. **Green.** Implement `index.ts` to the design. Keep it as one file and add no new abstractions
   beyond the pure helpers and the injectable `assess`.
3. Run the test until it passes. Run `bun build --target=bun --no-bundle` or
   `bunx tsc --noEmit` only if already available. Do not install a type checker.
4. **Install only this target:** `chezmoi diff ~/.omp/agent/extensions/execute-churn`, then
   `chezmoi apply --parent-dirs ~/.omp/agent/extensions/execute-churn`. Before and after, check that
   `chezmoi diff ~/.omp/agent/AGENTS.md ~/.omp/agent/mcp.json` output is unchanged. The user's
   pending edits must remain unapplied, since applying them is not ours to do.
5. Run the runtime smoke below and capture the widget text for each case.
6. Make a manual review pass for scope, staleness paths and trust-boundary validation.
7. Update the `README.md` lines. Report results. Do not commit or push without explicit user
   authorization.

## Runtime and TUI smoke (parent runs it; isolated from Herdr and Foreman extensions)

Setup for a scratch repo with a real failing test:

```sh
S=$(mktemp -d /tmp/churn-smoke.XXXX); cd "$S"; git init -q
printf 'export const sum=(a:number,b:number)=>a-b;\n' > sum.ts
printf 'import {expect,test} from "bun:test";import {sum} from "./sum";test("sum",()=>expect(sum(2,3)).toBe(5));\n' > sum.test.ts
X=/Users/brian/.omp/agent/extensions/execute-churn/index.ts
tmux new -d -s churn -x 200 -y 50 "cd $S && command omp --no-extensions -e $X"
# drive: tmux send-keys -t churn '<text>' Enter ; observe: tmux capture-pane -p -t churn | tail -25
```

`command omp` skips the alias's auto-update. `--no-extensions` puts discovery in explicit-only mode.
**Runtime-proof:** confirm that installed plugins from `~/.omp/plugins` are also excluded. If they
are not, note it, since they could add their own widgets.

| # | Drive | Expect |
|---|---|---|
| 1 | `/skill:execute fix the failing sum test`, then `/churn check` mid-run or after | Widget appears at once. Within about 45 s line 2 shows `est. a–b%` with a phase, and line 4 shows `assessor …haiku… · 1 call`. This proves `@smol` resolution, subscription or API auth through `complete()`, and the schema round trip. |
| 2 | Follow-up `also run it twice` | Turn counter continues and the task text is unchanged. |
| 3 | `/execute fix sum again`, then plain `execute fix sum again` (each after `/new`) | Both activate. `/new` alone clears the widget. |
| 4 | `execute help`, `execute pr summary` | Widget cleared. `/churn status` shows no new calls. |
| 5 | `/churn off`, then a prompt that runs about 10 turns, then `/churn status` | No widget and the assessment call count is unchanged. |
| 6 | Start a long task, `/churn check`, then press Esc right away | Widget shows `paused (aborted)`. No assessment line updates later. The agent stays idle. |
| 7 | `/churn nudge` while idle (after an accepted assessment) | Nudge message is rendered. **No turn starts** (no working spinner, and the editor stays editable for at least 10 s). |
| 8 | `/churn nudge` while streaming | The steer is consumed at the next step. Note whether an interruptible tool was cut short (expected behaviour, document it). |
| 9 | `/churn check`, then `/compact` immediately | `/churn status` shows `discarded ≥1`, assessment spend still counted, and no estimate change from the stale call. |
| 10 | Quit, then `command omp --no-extensions -e $X -c` | Widget rehydrates task and counters, with `digest resets after resume` shown. |
| 11 | Relaunch with `OMP_EXECUTE_CHURN_MODEL=nope/none` and `/churn check` on a task | `assessor unavailable: nope/none unresolved`. No estimate line is fabricated. |
| 12 | `omp -p "execute fix sum"` (print mode, same flags) | No crash. Counters are tracked but no UI is drawn. Optional. |

The parent's acceptance gate is passing `bun test` plus cases 1, 4, 5, 6, 7, 9 and 11 observed in
the captured pane text.

## Known ceilings (state these in `/churn status` and the README, not as hidden caveats)

- **Semantic churn is model inference.** `stalled` is an opinion of a small model reading a lossy
  digest. Counters are measured and the estimate is not.
- **Progress ranges are estimates.** They are not bounds on remaining effort, and verified-criteria
  ratios say nothing about remaining tokens.
- **Spend scope.** Spend covers main-session assistant messages since task start. Subagents,
  task-tool and advisor spend are excluded, and provider-reported `cost.total` may be 0 for
  subscription models.
- **Template coupling.** Activation depends on the user command template and OMP's skill wrapper
  text. Tests pin both, and a change degrades to "not tracked", not to a false activation.
- **Digest after restart.** The event digest is in memory. After a resume, the first assessment
  sees only the previous assessment plus new events.
- **Plain-text false positives.** A casual message starting with "execute …" activates tracking.
  `/churn off` is the escape hatch.
- **Not a loop breaker.** Exact repeated tool calls are already handled by OMP's
  `model.toolCallLoopGuard`. This extension is not a second loop breaker and never aborts.

## Execution record

Implemented in `private_dot_omp/agent/extensions/execute-churn/index.ts`, with
behavior checks in `index.test.ts` and usage in the root README. No dependencies,
OMP package edits, automatic steering, or automatic aborts were added.

### Decisions that supersede the initial plan

- 2026-10-13: Replaced the four-row widget with one short task/progress/phase line
  and a brief churn/error notice. Detailed accounting, evidence, suggestions,
  and assessor errors remain in `/churn status`. Eight behavior tests passed;
  an isolated OMP 18.10.3 TUI at 80 columns showed one widget row, on-demand
  diagnostics, and removal via `/churn off`, without model calls.
- The user requested no Anthropic OMP models. Tracked and live configuration now
  disable Anthropic, use `openai-codex/gpt-6-luna:minimal` for `smol`, and use
  authenticated Codex models for advisor/task/sonic. Existing differing live UI
  and default-model settings were preserved.
- A real assessment initially claimed new evidence without a citation. Added a
  failing regression, then required exact observed tool-result excerpts for
  verification, eliminated hypotheses, and evidence-driven progress increases.
  Unsupported claims cannot reset the evidence gap.
- Compaction cancellation uses explicit typed hooks for both manual and automatic
  compaction. Provider responses that arrive late are charged to their originating
  task but cannot replace an accepted estimate.
- `@oh-my-pi/pi-ai` loads lazily because OMP supplies it to extensions; a static
  import prevents dependency-injected checks from running in this dotfiles repo.
- `tmux` was unavailable. Runtime verification used a Python-stdlib PTY at
  200 columns by 50 rows, launching OMP 18.8.4 directly with the production file
  as a trusted extension. Temporary tools ran real Bun checks and cancellable waits.
  Neither the alias's updater nor the user's visible terminal was used.

### Observed verification

- `bun test private_dot_omp/agent/extensions/execute-churn/index.test.ts`:
  7 passing tests, 59 assertions. Strict production TypeScript checking passed
  using an already-installed compiler and the installed OMP declarations.
- Plain execute, `/execute`, the actual `/skill:execute` wrapper, and a CLI initial
  prompt activated the widget. Follow-ups retained the task; `execute help` and
  `/new` cleared it.
- Luna completed real schema round trips. A real passing Bun result produced
  cited verification; an unrelated tool failure could not manufacture progress.
- Four repeated integer checks against a decimal requirement automatically
  produced a visible possible-churn warning and suggested the missing decimal
  assertion. No primary turn or steer was generated by the warning.
- Off mode preserved the side-call count through a subsequent main turn.
  The behavior check additionally exercised twenty turns while off.
- Escape canceled a real waiting tool and invalidated a concurrent assessment.
  Resume restored counters and the discarded-call count without accepting a stale result.
- Idle `/churn nudge` rendered a user-attributed message with no new turn for
  ten seconds. A streaming nudge was delivered after the non-interruptible waiting
  tool completed and consumed at the next step.
- Real manual compaction with a scratch-only small-window configuration retained
  the prior estimate and counters and recorded the canceled assessment as discarded.
- Forced `OMP_EXECUTE_CHURN_MODEL=nope/none` displayed an unresolved-model error,
  one failed attempt, zero side usage, and no fabricated estimate.
- Repeated manual checks stopped at twelve real assessments. Further checks
  displayed the cap; totals stayed at 5,929 input tokens, 2,300 output tokens,
  and $0.0017429 provider-reported cost for that scratch task.

Explicit trusted-extension loading excluded ambient Herdr/Foreman extensions.
`--no-tools` did not disable configured MCP tools: unrelated Paper-not-running
and Notion-auth errors appeared in some probes and were left unchanged.
Print-mode verification was optional and was not performed. These probes establish
the exercised behavior, not a measured reduction in token churn on real tickets.

### Installation

Installed only `~/.omp/agent/extensions/execute-churn/index.ts`; the source and
installed SHA-256 hashes match. The parent-directory apply encountered a chezmoi
conflict, so the new child directory was created explicitly and only the file
was applied without changing managed parent settings. Live `AGENTS.md`, `mcp.json`,
and `herdr-omp-agent-state.ts` retained their pre-install checksums.

A fresh OMP launch with normal auto-discovery, no explicit extension flag, and
Herdr integration disabled loaded `/churn` and completed a real Luna assessment:
393 input tokens, 236 output tokens, $0.0001573 reported cost, zero main turns.
Temporary smoke tools, fixtures, and compiler/compaction configurations were removed.
