
# Foundation Models Custom Adapter Reference

## Overview

This reference documents the Foundation Models Adapter Training Toolkit (Python) and the runtime API (`SystemLanguageModel.Adapter`) for loading custom-trained adapters in Swift. For when-and-why decisions, see `axiom-ai (skills/foundation-models-adapters.md)`. For delivery API (`AssetPackManager`, `StoreDownloaderExtension`), see `axiom-integration (skills/background-assets-ref.md)` — this file owns training and runtime selection, the background-assets reference owns asset pack delivery.

### Two halves of the workflow

- **Build-time (Python toolkit)**: dataset preparation, training, evaluation, export. Runs on a developer Mac (Apple silicon, ≥32 GB) or Linux GPU machine. Produces `.fmadapter` packages.
- **Runtime (Swift framework)**: adapter loading, compatibility checking, asset pack lookup, session creation. Runs on the user's device under `FoundationModels`.

### Toolkit version

- **Current**: `26.0.0` (matches iOS / iPadOS / macOS / tvOS / visionOS 26)
- **Cadence**: a new toolkit ships per system-model OS release; adapters trained against an older toolkit are not guaranteed compatible with a newer base model

---

## When to Use This Reference

Use this reference when:
- Setting up the Foundation Models Adapter Training Toolkit Python environment
- Authoring the training dataset JSONL (chat-turn or tool-calling schema)
- Looking up `examples.train_adapter`, `examples.train_draft_model`, `examples.generate`, or `export.export_fmadapter` CLI signatures
- Looking up `SystemLanguageModel.Adapter` method signatures
- Looking up `SystemLanguageModel.Adapter.AssetError` cases
- Wiring an adapter into a `LanguageModelSession`
- Implementing the per-base-model lifecycle (`removeObsoleteAdapters()`, `compatibleAdapterIdentifiers(name:)`, `isCompatible(_:)`)
- Configuring the `com.apple.developer.foundation-model-adapter` entitlement

**Related skills**:
- `axiom-ai (skills/foundation-models-adapters.md)` — discipline file with decision tree, when-not-to-train, pressure scenarios, eval discipline
- `axiom-ai (skills/foundation-models-adapters-diag.md)` — diagnostic patterns for adapter-specific failures
- `axiom-integration (skills/background-assets-ref.md)` — `AssetPackManager`, `StoreDownloaderExtension`, manifest schema (the delivery half)
- `axiom-ai (skills/foundation-models-ref.md)` — base Foundation Models API (`LanguageModelSession`, `@Generable`, `Tool` protocol)

---

## Toolkit Setup

### Hardware requirements

- **Mac**: Apple silicon (M1 or later) with **≥32 GB unified memory**. Mac Studio and Mac Pro recommended for longer training runs.
- **Linux GPU**: CUDA-capable machine; specific GPU memory requirements depend on adapter rank and batch size. Apple's docs do not pin a minimum.
- **Storage**: ≥100 GB free for toolkit assets, dataset, checkpoints, and exported adapter packs.

### Software requirements

- **Python**: exactly **3.11**. The toolkit's `export/` folder pins `coremltools` versions that are not available for Python 3.12 / 3.13. Using a newer Python silently fails at export time with `ModuleNotFoundError: coremltools.libmilstoragepython`.
- **Apple Developer Program membership**: required for toolkit download. Sign in to the developer site, accept the toolkit license, then download.

### Environment setup

```bash
# Create a clean 3.11 environment (conda or venv equivalent)
conda create -n fm-adapter python=3.11
conda activate fm-adapter

# Install toolkit dependencies
pip install -r requirements.txt
```

The toolkit ships a `requirements.txt` against pinned versions; do not loosen pins without understanding the export folder's expectations.

### License constraint

The toolkit ships model assets used during training. The license is explicit: *"You are only permitted to use these model assets for training adapters."* These assets are not redistributable, not usable for analysis beyond training, and not usable for other ML projects.

### Folder layout

```
foundation-models-adapter-toolkit-26.0.0/
├── examples/              # User-editable training scripts
│   ├── train_adapter.py
│   ├── train_draft_model.py
│   ├── generate.py
│   └── end_to_end_example.ipynb
├── export/                # SEALED — do not modify
│   └── export_fmadapter.py
├── requirements.txt
└── README.md
```

**Critical**: the toolkit's `export/` folder is sealed. Apple's warning: *"Code in the `export` folder should not be modified, since the export logic must match exactly to make your adapter compatible with the system model and Xcode."* Modifications break runtime compatibility.

---

## Dataset Schema

The toolkit consumes JSONL files where each line is one training conversation.

### Basic chat-turn schema

```json
{"messages": [{"role": "system", "content": "You summarize restaurant reviews."}, {"role": "user", "content": "The pasta was bland but the tiramisu was incredible."}, {"role": "assistant", "content": "Mixed dinner — pasta underwhelmed, tiramisu standout."}]}
{"messages": [{"role": "user", "content": "Service was slow but the views from the patio were worth it."}, {"role": "assistant", "content": "Slow service, scenic patio worth the wait."}]}
```

**Roles**:
- `system` (optional): role / persona / task description. Keep short and consistent across samples.
- `user`: the prompt the adapter must learn to handle.
- `assistant`: the desired output for this prompt.

### Tool-calling schema extension

For adapters that must learn to invoke `Tool` protocol implementations, the assistant turn carries a `tool_calls` array:

```json
{
  "messages": [
    {"role": "system", "content": "You help the user find restaurants. Use the getRestaurants tool for live data."},
    {"role": "user", "content": "Italian near me, open now"},
    {
      "role": "assistant",
      "tool_calls": [
        {
          "id": "call_1",
          "type": "function",
          "function": {
            "name": "getRestaurants",
            "arguments": "{\"cuisine\":\"Italian\",\"openNow\":true,\"radius\":2000}"
          }
        }
      ]
    },
    {"role": "tool", "tool_call_id": "call_1", "content": "[{\"name\":\"Bella\",\"distance\":300},{\"name\":\"Trattoria\",\"distance\":900}]"},
    {"role": "assistant", "content": "Bella (300m) and Trattoria (900m) are open Italian options nearby."}
  ]
}
```

**Required fields on each tool call**:
- `id`: unique identifier for matching the subsequent tool response (`tool_call_id`)
- `type`: literal string `"function"`
- `function.name`: the `Tool.name` value the adapter should produce at inference time
- `function.arguments`: a JSON-encoded **string** containing the structured arguments matching the tool's `@Generable Arguments` type

### Sample volumes

| Task complexity | Sample count |
|-----------------|--------------|
| Basic (style transfer, narrow classification) | 100 – 1,000 |
| Complex (multi-step reasoning, domain extraction) | 5,000+ |

Apple's explicit framing: *"Focus on quality over quantity. A smaller dataset of clear, consistent, and well-structured samples may be more effective than a larger dataset of noisy, low-quality samples."*

### Dataset file conventions

- One conversation per line (`.jsonl`)
- UTF-8 encoded
- No empty lines
- Split into `train.jsonl` and `eval.jsonl` before training; the toolkit does not auto-split

---

## Training

### CLI signature

```bash
python -m examples.train_adapter \
    --train-data path/to/train.jsonl \
    --eval-data path/to/eval.jsonl \
    --epochs 3 \
    --learning-rate 1e-4 \
    --batch-size 8 \
    --checkpoint-dir checkpoints/run_001
```

### Hyperparameters

| Flag | Type | Notes |
|------|------|-------|
| `--train-data` | path | JSONL file of training conversations |
| `--eval-data` | path | JSONL file of held-out eval conversations (optional but strongly recommended) |
| `--epochs` | int | Typical range: 2-5. More epochs increase overfitting risk on small datasets. |
| `--learning-rate` | float | Typical: 1e-4 to 5e-4 for rank-32 LoRA |
| `--batch-size` | int | Limited by GPU memory; 4-16 on 32 GB Macs |
| `--checkpoint-dir` | path | Where periodic checkpoints are written |

### LoRA architecture

The toolkit trains **rank-32 LoRA adapters** against Apple's frozen on-device 3B-parameter base model. LoRA decomposes weight updates as `ΔW = BA` where `B ∈ ℝ^(d×r)` and `A ∈ ℝ^(r×k)` with rank `r = 32`. `B` is initialized to zero so the adapter starts as identity (`ΔW = 0` at step 0), ensuring training begins from the base model's exact behavior.

Target modules (per Apple's 2024 tech report): attention `W_q`, `W_v`, `W_k`, `W_o`, plus feed-forward and projection layers. The toolkit does not expose per-module rank tuning; rank 32 is fixed.

**Trainable parameter count**: ~0.1% of base-model parameters, which is why the resulting adapter pack is ~160 MB rather than the multi-gigabyte size of full fine-tuning.

### Checkpoint discipline

The trainer writes checkpoints periodically to `--checkpoint-dir`. Conventions:

- **Retain every checkpoint** for shipped-adapter training runs; required for rollback and ablation
- **Tag checkpoints with run config** in the filename or a sibling JSON (`run_001_lr1e4_e3_b8.pt`)
- **Do not delete intermediate checkpoints** until the final adapter passes all four eval axes; earlier checkpoints sometimes generalize better

### Per-base-model-version targeting

Each toolkit version targets exactly one base-model version. You cannot train a single adapter that works across OS versions — you train one adapter per supported OS, each with the matching toolkit version.

---

## Optional: Draft Model for Speculative Decoding

For latency-sensitive features, the toolkit can also train a smaller draft model used in speculative decoding to accelerate inference.

```bash
python -m examples.train_draft_model \
    --train-data path/to/train.jsonl \
    --epochs 3 \
    --learning-rate 1e-4 \
    --checkpoint-dir checkpoints/draft_001
```

### Compilation rate limit

When loaded at runtime, the draft model is compiled into a device-specific form. On non-macOS platforms, the system enforces **three draft model compilations per app per day**. Hitting this limit returns an error on subsequent compilation attempts; the previously compiled draft model continues to work.

**Implication**: do not regenerate / recompile draft models on every app launch. Cache the compiled form and reuse it across sessions.

---

## Evaluation

### CLI signature

```bash
python -m examples.generate \
    --checkpoint checkpoints/run_001/step_5000.pt \
    --draft-checkpoint checkpoints/draft_001/step_3000.pt \
    --input path/to/eval_prompts.jsonl \
    --output predictions.jsonl
```

| Flag | Notes |
|------|-------|
| `--checkpoint` | Path to a trained adapter checkpoint |
| `--draft-checkpoint` | Optional draft model checkpoint for speculative decoding during eval |
| `--input` | JSONL of eval prompts (`{"messages": [...]}` format, ending on a `user` turn) |
| `--output` | JSONL of `{"input": ..., "output": ...}` predictions |

### Four-axis eval requirement

Apple's docs: *"Evaluation needs to be a custom process that makes sense for your specific use case."* The toolkit provides `examples.generate` but does not provide eval metrics — you compute them against `predictions.jsonl`.

A complete eval covers:

1. **Quantitative**
   - Task-appropriate metric (accuracy, F1, ROUGE, BLEU, custom)
   - Defined before training, not after seeing results
   - Compared against the base-model baseline (no adapter)

2. **Qualitative — human grading**
   - Stratified sample of predictions
   - Grader sees pairs (base vs adapter) blind
   - Pick a small but defensible sample size (~100 pairs minimum)

3. **Qualitative — larger-model grading**
   - Server LLM (Claude, GPT-4o-class) grades the full eval set
   - Useful for catching regressions human graders miss at scale
   - Not a substitute for human grading

4. **Safety**
   - Re-run an internal red-team prompt set against the trained adapter
   - Task-specific training can erode the base model's guardrails on adjacent topics
   - You own safety eval for your task — Apple's base-model guardrails are necessary but not sufficient

### Locale-specific eval groupings

Per Apple's 2025 tech report, locale eval is grouped as:

| Group | Languages |
|-------|-----------|
| English-US | American English |
| English-outside-US | British, Australian, Indian, Canadian English |
| PFIGSCJK | Portuguese, French, Italian, German, Spanish, Chinese-Simplified, Japanese, Korean |

If the app ships in any non-US locale, run eval against the corresponding group. The base model supports 16 languages; the adapter's interaction with each is untested unless explicitly evaluated.

### Hard rule

If any axis regresses against the base-model baseline, do not ship the adapter. A "+5% on task quality, -8% on safety eval" adapter is a net loss — the safety regression is paid for by user trust.

---

## Export

### CLI signature

```bash
python -m export.export_fmadapter \
    --checkpoint checkpoints/run_001/step_5000.pt \
    --draft-checkpoint checkpoints/draft_001/step_3000.pt \
    --adapter-name my_summarizer \
    --output-dir exports/
```

| Flag | Notes |
|------|-------|
| `--checkpoint` | Final adapter checkpoint to export |
| `--draft-checkpoint` | Optional draft model checkpoint |
| `--adapter-name` | Identifier used at runtime; **underscores only**, no hyphens |
| `--output-dir` | Where the resulting `.fmadapter` package is written |

### Adapter name regex

The runtime identifier regex is `/fmadapter-\w+-\w+/` — the `\w+` matches word characters (alphanumeric + underscore) but **not hyphens**. The framework constructs the full identifier as `fmadapter-{name}-{variant}`; if your `--adapter-name` contains a hyphen, the resulting identifier has three hyphens, the regex matches only the first `\w+` between hyphens, and the adapter fails to load with `SystemLanguageModel.Adapter.AssetError.invalidAdapterName`.

✅ Valid: `my_summarizer`, `restaurant_summary_v2`, `tagger_v1`
❌ Invalid: `my-summarizer`, `restaurant-summary`, `tagger-v1`

### Output

The export step produces a `{adapter-name}.fmadapter` package — a structured directory containing the LoRA weight deltas, optional draft model, and metadata pinning the base-model version. This package is what you upload to Background Assets (Apple-hosted) or your CDN (server-hosted).

---

## Entitlement

### `com.apple.developer.foundation-model-adapter`

Required for **deployment** of apps that load custom adapters. Training and local testing do not require the entitlement.

**Acquisition flow**:
1. Account Holder (not just any team member) requests the entitlement from Apple via the developer portal
2. Apple reviews the request and grants the entitlement to the Account Holder's team
3. Provisioning profiles for apps that load adapters must include the entitlement
4. App Review verifies the entitlement is wired correctly

**Entitlement key**:

```xml
<key>com.apple.developer.foundation-model-adapter</key>
<true/>
```

Without the entitlement, the runtime `SystemLanguageModel.Adapter` initializers throw at app launch on production builds.

---

## Runtime API

### SystemLanguageModel.Adapter

```swift
import FoundationModels

public struct SystemLanguageModel.Adapter: Sendable {
    public init(name: String) throws
    public init(fileURL: URL) throws

    public func compile() async throws

    public static func removeObsoleteAdapters() throws
    public static func compatibleAdapterIdentifiers(name: String) -> [String]
    public static func isCompatible(_ assetPack: AssetPack) -> Bool
}
```

### init(name:)

```swift
let adapter = try SystemLanguageModel.Adapter(name: "my_summarizer")
```

Loads the adapter by name from a Background Assets-delivered asset pack. The framework picks the variant that matches the current base-model version using `compatibleAdapterIdentifiers(name:)` semantics internally.

**Throws**:
- `AssetError.compatibleAdapterNotFound` — no variant matches the device's base-model version
- `AssetError.invalidAdapterName` — name violates the `/fmadapter-\w+-\w+/` regex
- `AssetError.invalidAsset` — asset pack files are corrupted or malformed
- Underlying I/O errors if the asset pack is not locally available

### init(fileURL:)

```swift
let url = bundleURL.appendingPathComponent("my_summarizer.fmadapter")
let adapter = try SystemLanguageModel.Adapter(fileURL: url)
```

Loads from a direct file URL. Used primarily for testing — production adapters ship via Background Assets, not bundled file URLs.

### compile() async throws

```swift
try await adapter.compile()
```

Compiles the adapter to the device-specific form. Called automatically on first use; can be invoked early to warm the cache. Subject to the same draft-model compilation rate limit (three per app per day on non-macOS).

`@concurrent` per the function signature — safe to call from any actor.

### removeObsoleteAdapters()

```swift
try SystemLanguageModel.Adapter.removeObsoleteAdapters()
```

Removes adapter asset packs that no longer match any current base-model version. **Call at app launch** and after OS upgrades. Without this, obsolete adapter packs occupy storage indefinitely at ~160 MB per pack (three abandoned variants = ~480 MB).

### compatibleAdapterIdentifiers(name:)

```swift
let ids = SystemLanguageModel.Adapter
    .compatibleAdapterIdentifiers(name: "my_summarizer")
```

Returns asset pack identifiers whose adapter variants match the current device's base-model version, in **descending preference order**. The first element is the recommended variant.

**Return value**:
- Non-empty array → at least one compatible variant exists and has been uploaded for this app
- Empty array → no compatible variant has been uploaded (or the device is not Apple Intelligence-capable)

Use this for the runtime selection contract:

```swift
let ids = SystemLanguageModel.Adapter
    .compatibleAdapterIdentifiers(name: "my_summarizer")

guard let preferredID = ids.first else {
    // No compatible adapter — fall back to base model.
    let session = LanguageModelSession()
    return session
}
```

### isCompatible(_:)

```swift
let isCompatible = SystemLanguageModel.Adapter.isCompatible(assetPack)
```

Returns `true` if an `AssetPack`'s adapter variant matches the device's current base-model version. Used inside `StoreDownloaderExtension.shouldDownload(_:)` to gate adapter downloads to compatible variants only:

```swift
@main
struct AdapterDownloader: StoreDownloaderExtension {
    func shouldDownload(_ assetPack: AssetPack) -> Bool {
        if assetPack.id.hasPrefix("fmadapter-") {
            return SystemLanguageModel.Adapter.isCompatible(assetPack)
        }
        return true
    }
}
```

See `axiom-integration (skills/background-assets-ref.md)` "Foundation Models Adapter Bridge" for full context on the extension pattern.

---

## SystemLanguageModel.Adapter.AssetError

```swift
public enum SystemLanguageModel.Adapter.AssetError: Error, LocalizedError, Sendable {
    case compatibleAdapterNotFound(Context)
    case invalidAdapterName(Context)
    case invalidAsset(Context)
}
```

Each case carries a `Context` value with diagnostic detail; check `errorDescription` for a human-readable message.

| Case | Meaning | Diagnosis path |
|------|---------|----------------|
| `compatibleAdapterNotFound` | No adapter variant matches the current base-model version | Verify adapter was trained against the toolkit version matching the device's OS; verify the asset pack was uploaded and approved |
| `invalidAdapterName` | Adapter name violates `/fmadapter-\w+-\w+/` regex (typically contains a hyphen) | Re-export with underscores in `--adapter-name` |
| `invalidAsset` | Asset pack files are corrupted or schema-incompatible | Re-export the adapter; verify the toolkit version matches the target OS |

For the broader error space (`ManagedBackgroundAssetsError`, `BAErrorCode`), see `axiom-integration (skills/background-assets-ref.md)`. For diagnostic flows that combine adapter errors with their root causes, see `axiom-ai (skills/foundation-models-adapters-diag.md)`.

---

## SystemLanguageModel Initializer for Adapters

```swift
let adapter = try SystemLanguageModel.Adapter(name: "my_summarizer")

// Default guardrails
let model = SystemLanguageModel(adapter: adapter)

// Or override guardrails
let permissive = SystemLanguageModel.Guardrails.permissiveContentTransformations
let model = SystemLanguageModel(adapter: adapter, guardrails: permissive)
```

The adapter-aware initializer composes the trained adapter on top of the base model. Guardrails default to the base model's settings; override only with `permissiveContentTransformations` when your task requires looser content controls and you've completed the safety eval axis. See `axiom-ai (skills/foundation-models-ref.md)` for the full `Guardrails` API.

```swift
let session = LanguageModelSession(model: model)
let response = try await session.respond(to: "Summarize this restaurant review: ...")
```

---

## Compatibility Matrix

### Per-base-model-version pinning

Each adapter is bound to exactly one base-model version. The mapping is approximately:

| System-model OS release | Toolkit version | Notes |
|--------------------------|-----------------|-------|
| iOS 26.0 / iPadOS 26.0 / macOS 26.0 / visionOS 26.0 | 26.0.0 | Initial 26-series release |
| iOS 26.x minor updates | 26.x.0 | Each minor may ship a new base model; verify per Apple's release notes |
| Pre-26 (Apple Intelligence beta) | beta 0.1.0, beta 0.2.0 | Not supported for production adapter distribution |

**Lookup rule**: pick the toolkit version that matches the lowest system-model OS version you plan to support. Adapters trained against an older toolkit may or may not load on a newer OS — `compatibleAdapterIdentifiers(name:)` is the authoritative runtime answer.

### App install base strategy

| Install base | Strategy |
|--------------|----------|
| All on newest OS (e.g., newly launched app) | Train one adapter against current toolkit |
| Mixed OS versions, adapter is enhancement | Train per-OS adapter; fall back to base model on unsupported OS |
| Mixed OS versions, adapter is core | Train per-OS adapter; refuse feature on unsupported OS with clear messaging |

### Adapter asset pack naming convention

Apple recommends asset pack IDs of the form `fmadapter-{name}-{variant}` where `variant` encodes the base-model version (e.g., `fmadapter-my_summarizer-base26_0`). The framework uses the variant suffix to disambiguate at lookup time.

Concrete example with three adapter variants for the same logical adapter:

| Asset pack ID | Trained against | Used by |
|---------------|------------------|---------|
| `fmadapter-my_summarizer-base26_0` | iOS 26.0 base model | Devices on iOS 26.0.x |
| `fmadapter-my_summarizer-base26_1` | iOS 26.1 base model | Devices on iOS 26.1.x |
| `fmadapter-my_summarizer-base26_2` | iOS 26.2 base model | Devices on iOS 26.2.x |

The runtime resolves `compatibleAdapterIdentifiers(name: "my_summarizer")` to the appropriate ID for the device's current base model.

---

## Complete End-to-End Pattern

### Build-time

```bash
# 1. Author dataset
mkdir -p data
# write data/train.jsonl, data/eval.jsonl (see Dataset Schema)

# 2. Train
python -m examples.train_adapter \
    --train-data data/train.jsonl \
    --eval-data data/eval.jsonl \
    --epochs 3 \
    --learning-rate 1e-4 \
    --batch-size 8 \
    --checkpoint-dir checkpoints/summarizer_v1

# 3. (Optional) Train draft model for speculative decoding
python -m examples.train_draft_model \
    --train-data data/train.jsonl \
    --epochs 3 \
    --learning-rate 1e-4 \
    --checkpoint-dir checkpoints/summarizer_v1_draft

# 4. Evaluate
python -m examples.generate \
    --checkpoint checkpoints/summarizer_v1/step_5000.pt \
    --draft-checkpoint checkpoints/summarizer_v1_draft/step_3000.pt \
    --input data/eval.jsonl \
    --output predictions.jsonl
# Compute quantitative metrics, human grading, larger-model grading, safety,
# locale-specific eval against predictions.jsonl. See "Evaluation" section.

# 5. Export
python -m export.export_fmadapter \
    --checkpoint checkpoints/summarizer_v1/step_5000.pt \
    --draft-checkpoint checkpoints/summarizer_v1_draft/step_3000.pt \
    --adapter-name my_summarizer \
    --output-dir exports/

# 6. Package for Background Assets delivery
# See axiom-integration (skills/background-assets.md) for xcrun ba-package usage:
xcrun ba-package template -o Manifest.json
# Edit Manifest.json:
# {
#   "assetPackID": "fmadapter-my_summarizer-base26_0",
#   "downloadPolicy": {"onDemand": {}},
#   "fileSelectors": [{"file": "exports/my_summarizer.fmadapter"}],
#   "platforms": []
# }
xcrun ba-package Manifest.json -o my_summarizer.aar

# 7. Upload to App Store Connect (Apple-hosted) or push to CDN (server-hosted)
```

### Runtime

```swift
import FoundationModels
import BackgroundAssets

@MainActor
final class AdapterLifecycle {
    func session(forAdapter name: String) async throws -> LanguageModelSession {
        // Clean up adapters that don't match this OS.
        try SystemLanguageModel.Adapter.removeObsoleteAdapters()

        // Pick the compatible variant.
        let ids = SystemLanguageModel.Adapter
            .compatibleAdapterIdentifiers(name: name)

        guard let preferredID = ids.first else {
            // No compatible adapter — degrade to base model.
            return LanguageModelSession()
        }

        // Ensure the asset pack is local.
        let pack = try await AssetPackManager.shared.assetPack(withID: preferredID)
        try await AssetPackManager.shared.ensureLocalAvailability(of: pack)

        // Load and use.
        let adapter = try SystemLanguageModel.Adapter(name: name)
        try await adapter.compile()
        let model = SystemLanguageModel(adapter: adapter)
        return LanguageModelSession(model: model)
    }

    func handleOSUpgrade() async throws {
        try? SystemLanguageModel.Adapter.removeObsoleteAdapters()
        try await AssetPackManager.shared.checkForUpdates()
    }
}
```

### Extension (Apple-hosted)

```swift
import BackgroundAssets
import ExtensionFoundation
import StoreKit
import FoundationModels

@main
struct AdapterDownloader: StoreDownloaderExtension {
    func shouldDownload(_ assetPack: AssetPack) -> Bool {
        // For FM adapter packs, gate on compatibility with current base model.
        if assetPack.id.hasPrefix("fmadapter-") {
            return SystemLanguageModel.Adapter.isCompatible(assetPack)
        }
        // For non-adapter packs, allow the system to manage downloads.
        return true
    }
}
```

For server-hosted delivery (`BADownloaderExtension`), see `axiom-integration (skills/background-assets-ref.md)`.

---

## API Quick Reference

- **Toolkit CLI**: `examples.train_adapter`, `examples.train_draft_model`, `examples.generate`, `export.export_fmadapter`
- **Toolkit Python entry points**: documented in toolkit `README.md`; do not modify `export/`
- **Runtime types**: `SystemLanguageModel.Adapter` (struct, `Sendable`), `SystemLanguageModel.Adapter.AssetError` (enum)
- **Runtime initializers**: `init(name:)`, `init(fileURL:)`
- **Runtime instance methods**: `compile() async throws`
- **Runtime static methods**: `removeObsoleteAdapters() throws`, `compatibleAdapterIdentifiers(name:) -> [String]`, `isCompatible(_ assetPack: AssetPack) -> Bool`
- **Error cases**: `.compatibleAdapterNotFound(_)`, `.invalidAdapterName(_)`, `.invalidAsset(_)`
- **Composition**: `SystemLanguageModel(adapter:)`, `SystemLanguageModel(adapter:guardrails:)`, `LanguageModelSession(model:)`
- **Entitlement**: `com.apple.developer.foundation-model-adapter` (deployment only)
- **Rate limits**: 3 draft-model compilations per app per day on non-macOS platforms
- **Sizing**: ~160 MB per adapter pack; 200 GB / 100-pack Apple-hosted quota per app (shared with all asset packs); see `axiom-integration (skills/background-assets-ref.md)`

---

## Resources

**WWDC**: 2024-10159, 2024-10160, 2025-248, 2025-286, 2025-301, 2025-325

**Docs**: /apple-intelligence/foundation-models-adapter (toolkit hub article), /foundationmodels, /foundationmodels/loading-and-using-a-custom-adapter-with-foundation-models, /foundationmodels/systemlanguagemodel/adapter, /bundleresources/entitlements/com.apple.developer.foundation-model-adapter, /backgroundassets

**Apple ML Research**: apple-foundation-models-tech-report-2025 (arXiv 2507.13575), Apple Intelligence Foundation Language Models (arXiv 2407.21075)

**Background**: LoRA paper (Hu et al., arXiv 2106.09685)

**Skills**: axiom-ai (skills/foundation-models-adapters.md), axiom-ai (skills/foundation-models-adapters-diag.md), axiom-ai (skills/foundation-models.md), axiom-ai (skills/foundation-models-ref.md), axiom-integration (skills/background-assets.md), axiom-integration (skills/background-assets-ref.md)

---

**Last Updated**: 2026-05-16
**Toolkit Version**: 26.0.0
**Platforms**: iOS 26+, iPadOS 26+, macOS 26+, visionOS 26+ (deployment); macOS 14+ Apple silicon ≥32 GB or Linux GPU (training)
**Skill Type**: Reference
