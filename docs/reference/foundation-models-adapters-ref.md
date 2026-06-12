---
name: foundation-models-adapters-ref
description: Apple's Foundation Models Adapter Training Toolkit (Python) + SystemLanguageModel.Adapter runtime API — toolkit setup, dataset JSONL schema, training/eval/export CLIs, runtime types, AssetError cases, entitlement flow, compatibility matrix (iOS 26+)
---

# Foundation Models Custom Adapter Reference

Complete reference for the Adapter Training Toolkit (Python 3.11, build-time) and the `SystemLanguageModel.Adapter` runtime API (Swift, on-device) for training and loading custom adapters on top of Apple's on-device Foundation Models.

## When to Use This Reference

Use this reference when:
- Setting up the Foundation Models Adapter Training Toolkit Python environment (Python 3.11, Apple silicon Mac ≥32 GB or Linux GPU)
- Authoring the training dataset JSONL (basic chat-turn schema or the tool-calling extension)
- Looking up `examples.train_adapter`, `examples.train_draft_model`, `examples.generate`, or `export.export_fmadapter` CLI signatures and hyperparameters
- Looking up `SystemLanguageModel.Adapter` initializers, instance methods (`compile()`), and static lifecycle methods (`removeObsoleteAdapters()`, `compatibleAdapterIdentifiers(name:)`)
- Looking up `SystemLanguageModel.Adapter.AssetError` cases
- Wiring an adapter into a `LanguageModelSession` and composing it with `SystemLanguageModel(adapter:guardrails:)`
- Configuring the `com.apple.developer.foundation-model-adapter` deployment entitlement
- Mapping a system-model OS release to its matching toolkit version

## Example Prompts

Questions developers ask that this reference answers:

- "What Python version does the adapter training toolkit require?"
- "What's the JSONL schema for adapter training data, and how do I add tool-calling examples?"
- "What are the CLI arguments for `examples.train_adapter`?"
- "What LoRA rank does the toolkit use, and is it tunable?"
- "How do I export a trained adapter, and what does the export folder do that I shouldn't modify?"
- "What's the runtime API for picking the right adapter variant on a device?"
- "What `AssetError` cases should I handle when loading an adapter?"
- "How do I request the `com.apple.developer.foundation-model-adapter` entitlement?"
- "How does an adapter trained on one OS version interact with a device running a later OS?"

## What's Covered

- **Toolkit setup** — Hardware requirements (32 GB Apple silicon Mac OR Linux GPU), Python 3.11 (3.12/3.13 break the `coremltools` pin in `export/`), Apple Developer Program gating, conda/venv environment, the **sealed** `export/` folder (modifying it breaks runtime compatibility)
- **Dataset JSONL schema** — basic chat-turn `{"messages": [{"role": ..., "content": ...}]}` shape, and the tool-calling extension with required `id` / `type: "function"` / `function.name` / `function.arguments` fields on assistant turns
- **Sample volume guidance** — Apple's explicit table (100-1,000 for basic, 5,000+ for complex; "quality over quantity")
- **Training CLI** — `examples.train_adapter` with `--train-data`, `--eval-data`, `--epochs`, `--learning-rate`, `--batch-size`, `--checkpoint-dir`; LoRA rank-32 architecture (fixed by toolkit); target modules and trainable parameter ratio
- **Checkpoint discipline** — retention conventions, run-config tagging, avoiding premature deletion
- **Optional draft model** — `examples.train_draft_model` for speculative decoding; rate limit (3 compilations per app per day on non-macOS); caching implications
- **Evaluation** — `examples.generate` CLI; the four-axis eval requirement (quantitative + human grading + larger-model grading + safety); locale-specific eval groupings (English-US, English-outside-US, PFIGSCJK: Portuguese, French, Italian, German, Spanish, Chinese-Simplified, Japanese, Korean)
- **Export** — `export.export_fmadapter` with `--adapter-name` (underscore-only per runtime regex `/fmadapter-\w+-\w+/`), output `.fmadapter` package shape
- **Entitlement flow** — `com.apple.developer.foundation-model-adapter` (Account Holder request via developer portal, deployment-only, not required for local training)
- **Runtime API** — `SystemLanguageModel.Adapter` struct: `init(name:)`, `init(fileURL:)`, `compile() async throws`, `removeObsoleteAdapters() throws`, `compatibleAdapterIdentifiers(name:) -> [String]`; composition via `SystemLanguageModel(adapter:)` / `SystemLanguageModel(adapter:guardrails:)` (the whole adapter runtime is deprecated 26.4 / obsoleted 27.0 in the 27 SDK)
- **AssetError cases** — `.compatibleAdapterNotFound(_)`, `.invalidAdapterName(_)`, `.invalidAsset(_)` with `Context` payload and `errorDescription`
- **Compatibility matrix** — per-base-model-version pinning; system-model OS to toolkit version mapping; per-OS variant strategy (`fmadapter-{name}-base26_0`, `fmadapter-{name}-base26_1`, etc.); install-base coverage decision table
- **End-to-end pattern** — build-time CLI sequence (author dataset → train → train draft → eval → export → package for Background Assets) plus runtime Swift example wiring `removeObsoleteAdapters() → compatibleAdapterIdentifiers(name:) → ensureLocalAvailability → init(name:) → compile() → SystemLanguageModel(adapter:) → LanguageModelSession`

## Documentation Scope

This page documents the `foundation-models-adapters-ref` skill — the API reference half of the trio.

- For **when to train a custom adapter** (decision discipline, maintenance contract, pressure scenarios), see [Foundation Models Adapters](/skills/integration/foundation-models-adapters)
- For **failure modes** (`compatibleAdapterNotFound` post-OS-update, hyphen-in-adapter-name, tool calls silent from adapter, context-window over-consumption), see [Foundation Models Adapters Diagnostics](/diagnostic/foundation-models-adapters-diag)
- For **delivery API** (`AssetPackManager`, `StoreDownloaderExtension`, manifest schema), see [Background Assets Reference](/reference/background-assets-ref)
- For **base Foundation Models API** (`LanguageModelSession`, `@Generable`, `Tool` protocol, streaming), see [Foundation Models Reference](/reference/foundation-models-ref)
