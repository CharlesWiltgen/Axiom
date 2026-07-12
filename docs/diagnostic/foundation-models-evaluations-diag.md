---
name: foundation-models-evaluations-diag
description: Diagnose Evaluations framework failures — metrics reading -1, pass rates that rise when you add harder samples, green suites that measured nothing, SIGABRT after loadJSON, uncalibrated judges
---

# Evaluations Diagnostics

Apple's Evaluations framework fails **quietly**. Its characteristic failure isn't a red build — it's a green suite that measured nothing, a plausible-looking number computed from the wrong data, or a crash instead of an error. The runner deliberately records errors rather than propagating them, and skipped samples silently leave your aggregates, so the most dangerous bugs actually *raise* your score.

This page helps you tell a wiring bug apart from a real quality signal.

## Symptoms This Diagnoses

Use when you're experiencing:

- A metric that reads exactly **`-1`**
- A pass rate that went **up** after you added harder test cases
- A green suite where you're not convinced anything was measured
- CI passing without the model ever being available on the runner
- A **crash** (SIGABRT / SIGTRAP) instead of a thrown error
- Cohen's kappa coming back negative or nonsensical
- A model judge that scores nearly everything the same
- Eval scores that swing between runs on unchanged code
- A dataset that loaded fewer samples than you wrote
- `if/else` refusing to compile inside an `evaluators` block
- `unsupported recursion for reference to type alias 'Evaluators'`

## Example Prompts

- "My eval metric returns -1, what does that mean?"
- "Our pass rate went up when we added harder test cases — is that possible?"
- "The eval suite passes but I don't think it measured any tool calls."
- "Why does my process crash right after `loadJSON`?"
- "Cohen's kappa came back negative. Is my judge broken?"
- "My eval scores swing between runs. How do I make them stable?"

## Diagnostic Workflow

**Prove the run happened before you interpret any number.** Most "my eval is wrong" reports are a wiring bug wearing a decimal point.

The mandatory first check asserts that no sample silently vanished (`SubjectInferenceError`) and no evaluator silently died (`EvaluatorErrors`), then confirms the number you're about to gate on isn't the framework's not-found sentinel. Only then does the score mean anything.

From there the skill maps each symptom to a verified cause: samples laundered out of the denominator by a throwing subject, metric columns that look perfectly healthy but aggregate to nothing because a throw was recorded rather than raised, lossy JSON persistence that makes the typed API trap, a judge hiding in the middle of an odd-numbered scale, score vectors misaligned by excluded samples, and nondeterminism you can pin on the subject but *not* on the judge.

## Related

- [foundation-models-evaluations](/skills/integration/foundation-models-evaluations) – the discipline. Read this one to avoid the traps; read the diagnostic when you've already hit one.
- [foundation-models-evaluations-ref](/reference/foundation-models-evaluations-ref) – the API surface, including the exact signatures behind each trap.
- [foundation-models-diag](/diagnostic/foundation-models-diag) – for the *model* errors that throw out of your `subject(from:)` in the first place (guardrail violations, context exhaustion, refusals).
- [foundation-models-auditor](/agents/foundation-models-auditor) – scans a codebase for AI features shipping with no eval suite, uncalibrated judges, and evaluations that assert nothing.
