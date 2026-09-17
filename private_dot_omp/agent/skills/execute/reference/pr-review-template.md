# PR Review Template

Use with `skill://execute/reference/pr-review.md`; its publication boundary applies.

```text
# Review: <repository> #<number> - <title>
<PR URL>
Reviewed head: <SHA>
Recommendation: <request changes | approve | comment>
Findings: <N> (<B> blocking, <U> non-blocking)

## <HIGH | MEDIUM | LOW>
1. issue (blocking): <specific defect>
   <path>:<line or range> [<head/base SHA>, <RIGHT/LEFT>]
   Evidence: <short exact excerpt and triggering condition>
   Impact: <observable consequence>; confidence: <calibrated %>.
   Fix: <smallest concrete correction>
```

Omit empty severity groups. Use HIGH for serious correctness/security/data-loss risks, MEDIUM for meaningful lower-impact defects, LOW only for worthwhile non-blocking improvements. Severity and blocking status are separate judgments.

Conventional Comments labels: `issue`, `suggestion`, `question`, `nitpick`, `thought`, `praise`; decorate with `blocking`, `non-blocking`, `security` or `performance` when useful. Do not inflate questions into defects. Every finding needs exact verified location and evidence, not a guessed line or generic checklist. A finding outside an inline-addressable diff hunk stays in the review body with its real location.

Keep only actionable, in-scope findings. No filler, linter nits, speculative abstractions or forced praise. State “No actionable findings” when appropriate, without implying tests ran or the change is proven safe. Record review coverage or verification limits briefly. Counts must match the actual enumerated comments; follow the review workflow's posting limit and approval gate.
