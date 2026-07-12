---
name: foundation-models-evaluations
description: Discipline for evaluation-driven development of Apple Intelligence features — dataset design, guardrails vs optimization targets, model-judge calibration with Cohen's kappa, hill-climbing as a controlled experiment
---

# Evaluation-Driven Development

Discipline-enforcing skill for building intelligence-powered features you can actually measure. A generative feature breaks the assumption every unit test rests on: the same input produces different output on every run, so `#expect(result == expected)` fails on a synonym and passes on a fluent lie.

This skill replaces "I tried a few prompts and the output looked good" with a dataset, a score, and a gate — and it covers the ways that process quietly fools you even after you adopt it.

## When to Use

Use this skill when:

- You changed a prompt, instruction, schema, tool, or model and want to know whether the feature actually got better
- You're about to ship an AI feature on the strength of eyeballed outputs
- You need a regression suite so quality can't silently degrade when Apple updates the model underneath you
- You're designing an evaluation dataset and don't know how many samples you need, or which ones
- You're using a model as a judge and don't know whether to trust its scores
- Your agentic feature returns plausible answers and you can't tell whether it took the right path

## Example Prompts

- "How do I know if my prompt change actually improved the summarizer?"
- "We're shipping the AI tagging feature Friday — the outputs look good, is that enough?"
- "My model judge keeps giving everything a 3. What's wrong?"
- "How many samples do I need in my evaluation dataset?"
- "All my metrics pass but the output still feels bad. What am I missing?"
- "Should I generate my adversarial test cases synthetically?"

## What This Skill Provides

**The loop.** Evaluation-driven development: plan what "correct" means before you build, run the feature over a dataset, score it, gate on an aggregate, then change *one* variable and watch the number move. Apple calls it hill-climbing, and the skill treats each round as a controlled experiment with a baseline and exactly one changed variable.

**Dataset design.** The four categories every suite needs — golden set, edge cases, adversarial inputs, and known failures (the regression ratchet that makes quality monotonic). Plus the numbers: how many samples to start with, when to expand, and why a well-built 100–500 sample set discriminates better than a noisy 5,000-sample one. And the trap in synthetic data: it's excellent for coverage, and bad at exactly the things you most want it for — adversarial attacks and domain expertise.

**Guardrails vs the optimization target.** The distinction most teams miss, and the reason a suite can be entirely green on the day the feature is at its worst. A range check on tag count passes at 100% when the model emits the maximum every single time — passing metrics can be lying metrics.

**Judge calibration.** If you grade open-ended output with a model, that judge carries four measurable biases (verbosity, leniency, self-enhancement, position) and quietly disagrees with you in ways that widen as your dataset grows. The skill covers the calibration protocol: human annotators, Cohen's kappa rather than raw agreement, and a gate at 0.6 before you trust a single score. Apple's own sample judge starts at kappa −0.037 — worse than chance.

**Trajectory evaluation.** For agentic features, why scoring only the final answer is blind to the most common bug: the right answer reached the wrong way.

**Pressure scenarios and an anti-rationalization table** for the arguments that actually come up — "no time for an eval suite", "the judge agreed with me on the ten I checked", "all our metrics are green", "scores dropped when we grew the dataset, so revert".

## Related

- [foundation-models-evaluations-ref](/reference/foundation-models-evaluations-ref) – the API surface. This skill tells you *what* to measure and how not to fool yourself; the reference tells you which types to call.
- [foundation-models-evaluations-diag](/diagnostic/foundation-models-evaluations-diag) – for when the suite itself misbehaves. This skill helps you avoid the traps; the diagnostic helps once you've hit one (a metric reading `-1`, a pass rate that rose when you added hard samples, a green suite that measured nothing).
- [foundation-models](/skills/integration/foundation-models) – builds the feature that this skill measures.
- [foundation-models-adapters](/skills/integration/foundation-models-adapters) – the four-axis eval discipline for custom adapters predates this framework; on the 27 cycle, express those axes as metrics here.
- [agentic-security](/skills/security/agentic-security) – a red-team prompt set *is* an adversarial evaluation dataset. Encoding it turns a manual afternoon into a CI gate.
- [swift-testing](/skills/testing/swift-testing) – Evaluations runs *inside* Swift Testing via the `.evaluates` trait; it doesn't replace it.
- [foundation-models-auditor](/agents/foundation-models-auditor) – scans a codebase for AI features shipping with no eval suite, uncalibrated judges, and evaluations that assert nothing.
