---
name: foundation-models-adapters-diag
description: Adapter-specific Foundation Models failure modes — compatibleAdapterNotFound, invalidAdapterName hyphen regex, tool calls silent from adapter, context window over-consumed, accuracy drops after OS update, coremltools.libmilstoragepython missing
---

# Foundation Models Custom Adapter Diagnostics

Systematic troubleshooting for adapter-specific Foundation Models failures — distinct from base-model failures covered in [Foundation Models Diagnostics](foundation-models-diag).

> On a 27 build, the first thing to check is the obsoletion: the adapter runtime is deprecated 26.4 and **obsoleted in 27.0**, so a compile error (`'Adapter' was obsoleted in iOS 27.0`) or an adapter that never loads on a 27 device is the obsoletion, not a bug. The runtime diagnostics here apply to 26.x deployments.

## Symptoms This Diagnoses

Use when you're experiencing any of these:

- `SystemLanguageModel.Adapter.AssetError.compatibleAdapterNotFound` at runtime (the adapter no longer matches the device's current base-model version)
- `SystemLanguageModel.Adapter.AssetError.invalidAdapterName` at load (typically caused by a hyphen in the adapter name violating the runtime regex `/fmadapter-\w+-\w+/`)
- `SystemLanguageModel.Adapter.AssetError.invalidAsset` (corrupted or schema-incompatible asset pack)
- The trained adapter loads, but tool calls never fire even though the prompt clearly requires them (works on the base model, fails on the adapter)
- Trivial user prompts consume 30-90% of the context window; multi-turn conversations exceed `exceededContextWindowSize` after 2-3 turns
- Adapter accuracy drops noticeably after an OS minor update (e.g., 26.0 → 26.1), with no code change
- `ModuleNotFoundError: coremltools.libmilstoragepython` during `python -m export.export_fmadapter` on a developer Mac
- `BAErrorCode.downloadBackgroundActivityProhibited` during adapter download from Background Assets
- Production-only entitlement-related load failure (adapter works in development, fails in TestFlight / App Store)
- Apple Developer Forums radar **FB18924722** ("no public version-pinning API") affects your release planning

## Example Prompts

Questions developers ask that this diagnostic answers:

- "Why is my adapter throwing `compatibleAdapterNotFound` after the iOS 26.1 update?"
- "Why don't tool calls fire from my trained adapter? The base model calls them fine."
- "What's the 'no underlying assets for asset set com.apple.MobileAsset.UAF.FM.Overrides' error?"
- "My adapter's accuracy dropped after the OS update — is that a bug or expected?"
- "Why is `python -m export.export_fmadapter` failing with `coremltools.libmilstoragepython missing`?"
- "Why is my asset pack failing with `downloadBackgroundActivityProhibited`?"
- "Why does my adapter work in development but fail on TestFlight?"

## Diagnostic Workflow

The skill provides nine numbered diagnostic patterns, each with symptom, causes, diagnosis steps, fix, and a time-cost estimate.

| # | Pattern | Headline cause |
|---|---------|----------------|
| 1 | `compatibleAdapterNotFound` at runtime | OS-update without a retrained variant uploaded; runtime fallback to base model is the expected behavior |
| 2 | `invalidAdapterName` (hyphen in adapter name) | Runtime regex `/fmadapter-\w+-\w+/` rejects hyphens; re-export with underscores |
| 3 | `invalidAsset` (corrupted or schema-incompatible pack) | Toolkit `export/` folder was modified, or toolkit version mismatches target OS |
| 4 | Entitlement missing (production-only load failure) | `com.apple.developer.foundation-model-adapter` absent from signed provisioning profile |
| 5 | Background Assets download fails | Cross-reference to [Background Assets](/skills/integration/background-assets); `BAErrorCode.downloadBackgroundActivityProhibited`, `.downloadWouldExceedAllowance`, `ManagedBackgroundAssetsError.assetPackNotFound` |
| 6 | Tool calls never fire from trained adapter | Training data missing complete `tool_calls` schema (`id` / `type: "function"` / `function.name` / `function.arguments` as JSON-encoded string) |
| 7 | Adapter consumes context window with trivial prompts | Verbose multi-paragraph system prompts in training data; adapter learns to expect them at inference time |
| 8 | Accuracy drops after OS update | Silent base-model change with new system-model OS; per-OS-variant retrain is the documented workflow (FB18924722 tracks the version-pinning API gap) |
| 9 | `coremltools.libmilstoragepython` missing | Python 3.12/3.13 (toolkit pins 3.11) or Linux export (export must run on Apple silicon Mac) |

The skill also cross-references three general `@Generable` macro/schema issues to [Foundation Models Diagnostics](foundation-models-diag) Patterns 6a/6b/6c:

- `@Generable` macro not resolved in Swift Playgrounds
- Recursive `@Generable` types crash at `SchemaAugmentor.swift:209`
- `GenerationSchema.SchemaError.undefinedReferences`

Each pattern walks through the **mandatory first steps**: capture `compatibleAdapterIdentifiers(name:)`, asset pack status via `AssetPackManager.shared.status(ofAssetPackWithID:)`, base model availability, and (for toolkit failures) Python version, architecture, and active environment.

## Related

- [Foundation Models Adapters](/skills/integration/foundation-models-adapters) — discipline file with decision tree, maintenance contract, pressure scenarios, audit checklists
- [Foundation Models Adapters Reference](/reference/foundation-models-adapters-ref) — toolkit CLIs, runtime API, compatibility matrix
- [Foundation Models Diagnostics](foundation-models-diag) — base Foundation Models diagnostics (`@Generable` macro issues, context overflow, guardrails)
- [Foundation Models](/skills/integration/foundation-models) — Approach Triage (rungs 1-4 before adapter training)
- [Background Assets](/skills/integration/background-assets) — asset pack delivery, `BAErrorCode` patterns; the delivery half of the adapter workflow
- [foundation-models-auditor agent](/agents/foundation-models-auditor) — automated scanning for Foundation Models anti-patterns
