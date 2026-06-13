---
name: foundation-models-adapters
description: Discipline for shipping app-specific custom adapters on top of Apple's on-device Foundation Models — when training is justified, the per-OS maintenance contract, four-axis eval, runtime lifecycle, HIG disclosure
---

# Foundation Models Custom Adapters

Discipline-enforcing skill for app-specific specialization of Apple's on-device Foundation Models via the Adapter Training Toolkit. Trains a rank-32 LoRA adapter, ships it via Background Assets, and loads it through the `SystemLanguageModel.Adapter` runtime API.

> **The custom-adapter runtime is a 26-cycle-only capability.** In the Xcode 27 SDK, `SystemLanguageModel.Adapter` and the rest of the adapter runtime are deprecated in 26.4 and **obsoleted in 27.0** — they do not compile on a 27.0+ deployment target, and the 27 SDK ships no replacement. If any deployment target you support is 27.0 or later, adapters are off the table; the skill covers the pivot (rungs 1-4 or a custom model provider).

## When to Use

Use this skill when:
- A developer wants to train a custom adapter and the base model's output isn't application-specific enough
- A team has reached rung 5 of the Approach Triage in `foundation-models.md` (prompt engineering, `@Generable`/`@Guide`, tool calling, and the built-in content-tagging adapter have each been tried and failed with a documented reason)
- A team is planning the year-1 / year-2 maintenance contract for an adapter-enhanced feature
- A team needs runtime lifecycle guidance (`compatibleAdapterIdentifiers(name:)`, `removeObsoleteAdapters()`, base-model fallback)
- An adapter-enhanced feature needs HIG-compliant disclosure and retry UX

## Example Prompts

Real questions developers ask that this skill answers:

- "Should we train a custom Foundation Models adapter for our restaurant-summarization feature?"
- "What does the maintenance contract for shipping an adapter look like in year 2?"
- "We trained one adapter on iOS 26.0. Can we ship it?"
- "What's the four-axis eval requirement before shipping?"
- "How do we ship one adapter per OS version without breaking devices on the older OS?"
- "Should we skip locale-specific eval if most of our users speak English?"
- "What does Apple's HIG say about adapter-enhanced features?"

## What This Skill Provides

- **Decision discipline** – the rules for when adapter training is justified vs. when rungs 1-4 of the Approach Triage will solve the problem at a fraction of the cost
- **Maintenance-contract framing** – year-1 vs year-2 cost (initial 1-2 weeks, retrains per OS minor, four-axis eval per retrain, per-locale eval, Background Assets integration)
- **Hardware and entitlements** – 32 GB Apple silicon Mac or Linux GPU; Python 3.11 (the `coremltools` pin breaks on 3.12/3.13); Apple Developer Program for toolkit; `com.apple.developer.foundation-model-adapter` entitlement for deployment
- **Per-OS coverage strategy** – newest-OS-with-fallback vs per-OS variants; rejection of single-adapter-no-plan
- **Dataset construction discipline** – sample volumes (100-1k basic, 5k+ complex); short consistent system messages; no verbose preambles
- **Four-axis eval requirement** – quantitative, human grading, larger-model grading, safety; PFIGSCJK locale grouping (Portuguese, French, Italian, German, Spanish, Chinese-Simplified, Japanese, Korean)
- **Runtime lifecycle** – `compatibleAdapterIdentifiers(name:)` for variant selection (never hardcode asset pack IDs), `removeObsoleteAdapters()` at launch, `checkForUpdates()` after OS upgrades, unconditional base-model fallback
- **HIG-compliant UX** – AI involvement disclosure, retry as first-class affordance, constructive coaching on `guardrailViolation`, feedback collection via `LanguageModelFeedbackAttachment` for next-retrain dataset growth
- **Pressure scenarios with pushback templates** – three canonical scenarios with model dialogue for pushing back on "train ASAP", "ship one adapter", "skip locale eval"

## Related

- [Foundation Models](foundation-models) – base framework; work the Approach Triage (rungs 1-4) here before reaching for adapter training
- [Foundation Models Adapters Reference](/reference/foundation-models-adapters-ref) – toolkit setup, dataset JSONL schema, training/eval/export CLIs, full `SystemLanguageModel.Adapter` API, `AssetError` cases, compatibility matrix, entitlement flow
- [Foundation Models Adapters Diagnostics](/diagnostic/foundation-models-adapters-diag) – adapter-specific failure modes (`compatibleAdapterNotFound`, hyphen-name regex violation, tool calls silent from adapter, context-window over-consumption, accuracy drops after OS update, `coremltools.libmilstoragepython` missing)
- [Background Assets](background-assets) – delivery half: Apple-hosted vs server-hosted asset packs, `xcrun ba-package`, the `onDemand` policy adapters require
- [Foundation Models](foundation-models) Approach Triage section — the deflection ladder developers should work through before deciding to train
- [foundation-models-auditor agent](/agents/foundation-models-auditor) – automated scanning for Foundation Models anti-patterns
