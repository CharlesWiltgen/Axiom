
# Foundation Models Custom Adapter Diagnostics

> **First diagnostic on a 27 build: the adapter runtime is obsoleted in 27.0.** If the failure is a compile error (`'Adapter' was obsoleted in iOS 27.0`, `'init(name:)' is unavailable`) or the adapter silently never loads on a 27 device, the cause is the obsoletion, not a bug — `SystemLanguageModel.Adapter` and friends are `deprecated: 26.4, obsoleted: 27.0` (iOS/iPadOS/macOS/visionOS) with no replacement in the 27 SDK. The runtime patterns below apply only to 26.x deployments. See `axiom-ai (skills/foundation-models-adapters.md)` for the 27 pivot.

## Overview

Adapter-specific failure modes — distinct from base Foundation Models failures covered in `axiom-ai (skills/foundation-models-diag.md)`. **Core principle**: most adapter failures are toolkit setup mismatches, per-base-model-version compatibility breakage, or training-data schema gaps — not framework bugs. For decision discipline see `axiom-ai (skills/foundation-models-adapters.md)`; for the API and toolkit reference see `axiom-ai (skills/foundation-models-adapters-ref.md)`.

---

## Red Flags

If any of these appear, treat as adapter-specific, not generic Foundation Models:

- `SystemLanguageModel.Adapter.AssetError.compatibleAdapterNotFound` at runtime
- `SystemLanguageModel.Adapter.AssetError.invalidAdapterName` at load
- Adapter accuracy regression after an OS minor update
- Tool calls work for the base model but never fire from the adapter
- Trivial user prompts consume disproportionate context window
- `ModuleNotFoundError: coremltools.libmilstoragepython` during export
- `BAErrorCode.downloadBackgroundActivityProhibited` during adapter download
- Entitlement-related load failure in production (works in development)

---

## Mandatory First Steps

Before changing any code, capture:

```swift
// 1. Adapter compatibility for current device
let name = "my_adapter"
let ids = SystemLanguageModel.Adapter.compatibleAdapterIdentifiers(name: name)
print("Compatible variant count: \(ids.count)")
print("Variants: \(ids)")
// Record: empty array? non-empty? which IDs?

// 2. Asset pack state for the expected variant
if let preferredID = ids.first {
    let pack = try await AssetPackManager.shared.assetPack(withID: preferredID)
    let status = try await AssetPackManager.shared.status(relativeTo: pack)
    print("Pack status: \(status)")
}
// status(ofAssetPackWithID:) is deprecated as of iOS 26.4 in favor of
// status(relativeTo:), which takes an AssetPack instead of an ID string.
// Record: downloadAvailable / downloading / downloaded / upToDate / outOfDate / obsolete?

// 3. Base model availability (rule out non-adapter issue)
let availability = SystemLanguageModel.default.availability
print("Base availability: \(availability)")
// Record: available / unavailable(reason)?
```

For toolkit-setup failures (export errors, missing modules) on the developer Mac:

```bash
python --version          # MUST be 3.11.x — record exact
which python              # MUST be inside the active conda/venv env
python -c "import coremltools; print(coremltools.__version__)"
                          # Must succeed; record version
uname -m                  # arm64 expected for Apple silicon Mac export
```

---

## Decision Tree

```
Adapter problem?
│
├─ Adapter won't load
│  ├─ AssetError.compatibleAdapterNotFound → Pattern 1
│  ├─ AssetError.invalidAdapterName → Pattern 2
│  ├─ AssetError.invalidAsset → Pattern 3
│  └─ Entitlement-related crash on production build → Pattern 4
│
├─ Background Assets download fails
│  └─ Pattern 5 (cross-references axiom-integration)
│
├─ Adapter loads but behaves wrong
│  ├─ Tool calls never fire → Pattern 6
│  ├─ Context window over-consumed by trivial prompts → Pattern 7
│  └─ Accuracy regressed after OS update → Pattern 8
│
├─ Draft model stops speeding up inference (iOS only, never macOS)
│  └─ Pattern 10 (draft-model compilation rate-limited: 3/app/day)
│
├─ Toolkit / export fails on developer Mac
│  └─ Pattern 9 (coremltools / Python version / Linux export)
│
└─ Generic @Generable schema issues (recursive types, Playgrounds macro)
   └─ Cross-reference to axiom-ai (skills/foundation-models-diag.md) Patterns 6a-6c
```

---

## Diagnostic Patterns

### Pattern 1: `compatibleAdapterNotFound` at Runtime

**Symptom**:

```
SystemLanguageModel.Adapter.AssetError.compatibleAdapterNotFound
```

`compatibleAdapterIdentifiers(name:)` returns an empty array even though an adapter is expected.

**Causes** (most common first):

1. Device's base-model version has no matching adapter variant uploaded yet (typical after an OS minor update where the team hasn't shipped a retrained adapter)
2. Asset pack containing the matching variant has not yet downloaded (`AssetPack.Status == .downloadAvailable`)
3. The adapter was trained against a different OS minor than the device runs
4. Apple-hosted asset pack still in App Store review

**Diagnosis**:

```swift
let ids = SystemLanguageModel.Adapter.compatibleAdapterIdentifiers(name: name)
if ids.isEmpty {
    // Case 1, 3, or 4 — no compatible variant uploaded for this OS
    print("No compatible adapter variant; current OS may lack a trained adapter")
} else {
    // Case 2 — variant exists but may not be local
    let preferredID = ids[0]
    let pack = try await AssetPackManager.shared.assetPack(withID: preferredID)
    let status = try await AssetPackManager.shared.status(relativeTo: pack)
    // status(ofAssetPackWithID:) is deprecated as of iOS 26.4 in favor of status(relativeTo:).
    print("Variant exists but status: \(status)")
}
```

**Fix**:

- For an empty-array result: train a new adapter against the toolkit version matching the device's OS; upload the resulting asset pack; ship. Until then, the runtime fallback to the base model must keep the feature functional.
- For a pending download: ensure local availability before consuming.

```swift
guard let preferredID = ids.first else {
    // Fall back to base model
    let session = LanguageModelSession()
    return session
}

let pack = try await AssetPackManager.shared.assetPack(withID: preferredID)
// ensureLocalAvailability(of:) (single-arg) is deprecated as of iOS 26.4 in favor of
// ensureLocalAvailability(of:requireLatestVersion:).
try await AssetPackManager.shared.ensureLocalAvailability(of: pack, requireLatestVersion: false)
let adapter = try SystemLanguageModel.Adapter(name: name)
```

**Time cost**: 10 minutes to add fallback path; days/weeks to retrain and ship a new variant.

---

### Pattern 2: `invalidAdapterName` (Hyphen in Adapter Name)

**Symptom**:

```
SystemLanguageModel.Adapter.AssetError.invalidAdapterName
```

Adapter fails to load at `SystemLanguageModel.Adapter(name:)` despite a present, downloaded asset pack.

**Cause**:

The runtime identifier regex is `/fmadapter-\w+-\w+/`. `\w` matches word characters (alphanumerics + underscore) but **not hyphens**. The framework constructs the full identifier as `fmadapter-{name}-{variant}`; if `name` contains a hyphen, the identifier has three hyphens and the regex matches only the first segment.

**Diagnosis**:

Inspect the adapter name passed to the toolkit's `--adapter-name` flag and at the Swift call site:

```swift
let adapter = try SystemLanguageModel.Adapter(name: "my-summarizer")
// ❌ Hyphen will fail the regex
```

**Fix**:

Re-export with underscores:

```bash
python -m export.export_fmadapter \
    --checkpoint checkpoints/run_001/step_5000.pt \
    --adapter-name my_summarizer \
    --output-dir exports/
```

Re-upload the asset pack with the new ID. Update Swift call sites to use the underscored name.

✅ Valid: `my_summarizer`, `restaurant_summary_v2`
❌ Invalid: `my-summarizer`, `restaurant-summary`

**Time cost**: 30 minutes (re-export + re-upload + Swift edit). Not a retrain.

---

### Pattern 3: `invalidAsset` (Corrupted or Schema-Incompatible Pack)

**Symptom**:

```
SystemLanguageModel.Adapter.AssetError.invalidAsset
```

The asset pack downloaded successfully but the framework rejects it at load time.

**Causes**:

1. Toolkit `export/` folder was modified (most common — see `axiom-ai (skills/foundation-models-adapters-ref.md)`)
2. Toolkit version mismatch between training and the target OS
3. Asset pack files corrupted in upload pipeline
4. Adapter package missing required metadata files

**Diagnosis**:

```bash
# Check the export folder is unmodified
diff -r toolkit-26.0.0/export/ working-toolkit/export/

# Verify toolkit version against target OS
cat toolkit-26.0.0/VERSION
# Should match the device's system-model OS line
```

**Fix**:

1. Restore unmodified `export/` from the toolkit archive
2. Re-export the adapter
3. Re-upload the asset pack
4. If the toolkit version doesn't match the target OS, switch to the matching toolkit and retrain

**Time cost**: 1-4 hours depending on cause (re-export only) or weeks (retrain against correct toolkit).

---

### Pattern 4: Entitlement Missing (Production Load Failure)

**Symptom**:

Adapter loads in development builds but fails in production / TestFlight / App Store with an entitlement-related error.

**Cause**:

`com.apple.developer.foundation-model-adapter` is required for deployment but is **not** required for local training or development testing. The entitlement must be:

1. Requested by the Account Holder via Apple's developer portal
2. Granted by Apple
3. Included in the provisioning profile used to sign the production build

**Diagnosis**:

```bash
# Inspect the entitlements in the signed production .ipa or .xcarchive
codesign -d --entitlements - /path/to/YourApp.app
# Look for com.apple.developer.foundation-model-adapter
```

If the key is absent, the entitlement is missing from the profile.

**Fix**:

1. Account Holder opens Apple Developer Account → Account → Membership → request the Foundation Models Framework Adapter Entitlement
2. Wait for Apple to grant (timeline varies)
3. Regenerate provisioning profiles after the entitlement is granted
4. Re-sign the build with the updated profile

**Time cost**: Apple's review (hours to days) + minutes to re-sign.

---

### Pattern 5: Background Assets Download Fails

**Symptom**:

The adapter asset pack never downloads, downloads partially, or surfaces a `BAErrorCode` during `ensureLocalAvailability` or in `statusUpdates`.

**Cross-reference**: this lives in `axiom-integration (skills/background-assets.md)` — full diagnostic patterns there. Adapter-specific notes:

| Error | Adapter-specific implication |
|-------|------------------------------|
| `BAErrorCode.downloadBackgroundActivityProhibited` | User disabled "Background Activity" in Settings; adapter feature should prompt the user or offer a foreground download path |
| `BAErrorCode.downloadWouldExceedAllowance` | App is hitting per-user storage quota across all asset packs; `remove(assetPackWithID:)` obsolete adapter variants first |
| `ManagedBackgroundAssetsError.assetPackNotFound` | Adapter asset pack ID mismatch between manifest and runtime call; verify both use the same `fmadapter-{name}-{variant}` form |

**Fix**: see `axiom-integration (skills/background-assets.md)` "Pressure Scenarios" and "Audit Checklists" sections.

---

### Pattern 6: Tool Calls Never Fire From Trained Adapter

**Symptom**:

A `LanguageModelSession(model:)` initialized with an adapter loads successfully, but the adapter never invokes attached `Tool` implementations even when the prompt clearly requires them. The base-model session (no adapter) calls the tools as expected.

**Cause**:

Training data schema is incomplete. The toolkit's training JSONL must encode:

1. A system message that describes available tools (mirroring how the runtime presents tools to the model)
2. Assistant turns with the full `tool_calls` array structure

Common missing pieces:

| Missing field | Effect |
|---------------|--------|
| `id` on each tool call | Subsequent `tool` role response can't match the call |
| `type: "function"` literal | Framework rejects the malformed call |
| `function.name` | Adapter learns no tool names |
| `function.arguments` as a JSON-encoded string | Adapter learns to emit malformed structured args |

**Diagnosis**:

Inspect training JSONL for assistant turns:

```bash
jq -c '.messages[] | select(.role == "assistant" and .tool_calls != null)' train.jsonl | head -5
```

Each match should have the full shape:

```json
{
  "role": "assistant",
  "tool_calls": [
    {
      "id": "call_1",
      "type": "function",
      "function": {
        "name": "getRestaurants",
        "arguments": "{\"cuisine\":\"Italian\",\"openNow\":true}"
      }
    }
  ]
}
```

**Fix**:

Regenerate training JSONL with complete tool-call schema (see `axiom-ai (skills/foundation-models-adapters-ref.md)` "Tool-calling schema extension"). Retrain. Re-evaluate. Re-export. Re-upload.

**Time cost**: days (full retrain cycle).

---

### Pattern 7: Adapter Over-Consumes Context Window

**Symptom**:

Trivial user prompts (a few words) consume 30-90% of the 4096-token context window. Multi-turn conversations exceed `exceededContextWindowSize` after only 2-3 turns.

**Cause**:

Training data used multi-paragraph system prompts. The adapter learns to expect verbose preamble at inference time and behaves as if it's present even when the runtime caller omits it. The internal tokenizer state effectively reserves space for the learned verbose context.

**Diagnosis**:

```bash
# Check system-message length distribution across training samples
jq '.messages[] | select(.role == "system") | .content | length' train.jsonl | sort -n | uniq -c
```

If median system-message length exceeds ~200 characters, this pattern is likely.

**Fix**:

1. Rewrite training JSONL with short, consistent system messages (≤100 characters, ideally a single sentence)
2. Retrain
3. Re-evaluate token efficiency: `Transcript` is a `RandomAccessCollection` of `Transcript.Entry` (iterate it directly — there is no `.entries` property). On iOS 26.4+ measure its size with `session.tokenCount(for: Array(transcript))`, which accepts `some Collection<Transcript.Entry>`; capture this for a representative single-turn baseline and compare against the previous adapter's measurements

**Time cost**: days (dataset rewrite + retrain).

---

### Pattern 8: Adapter Accuracy Drops After OS Update

**Symptom**:

An adapter that passed evaluation at ship-time produces noticeably worse outputs after an OS minor update (e.g., 26.0 → 26.1). No code changed. Telemetry shows quality regression across user metrics.

**Cause**:

The base model changed silently with the OS update. Apple does not provide a public version-pinning API; the runtime always uses the system-model version installed on the device. Apple Developer Forums radar **FB18924722** tracks the request for explicit version pinning; as of 2026-05-16, no public API exists.

**Diagnosis**:

```swift
// Check whether the adapter's expected base model still matches
let ids = SystemLanguageModel.Adapter.compatibleAdapterIdentifiers(name: name)
// If empty → adapter is now incompatible (Pattern 1)
// If non-empty → adapter loads but trained against a stale base model
```

If `compatibleAdapterIdentifiers(name:)` is non-empty but eval metrics dropped:

```bash
# Re-run the eval suite against the production adapter on the new OS
python -m examples.generate \
    --checkpoint exports/my_summarizer.fmadapter \
    --input eval_set.jsonl \
    --output predictions_after_os_update.jsonl
# Compare to predictions captured at ship time
```

**Fix**:

1. Train a fresh adapter against the new toolkit version matching the updated OS
2. Re-run the four-axis eval suite
3. Ship the new adapter as a new asset pack variant
4. Old variant remains available for devices not yet on the new OS

**Treat as recurring engineering work**, not a one-time incident. Plan the next OS update's retrain as a known calendar item.

**Time cost**: 1-2 weeks per retrain cycle once the training pipeline is automated.

---

### Pattern 9: `coremltools.libmilstoragepython` Missing on Export

**Symptom**:

```
ModuleNotFoundError: No module named 'coremltools.libmilstoragepython'
```

Or other `coremltools`-related import errors during `python -m export.export_fmadapter`.

**Causes**:

1. Python version is 3.12 or 3.13 (toolkit `export/` pins `coremltools` versions only available on Python 3.11)
2. Export running on Linux (the `export/` step requires Apple silicon Mac for the `coremltools` compilation path)
3. Active virtual environment is not the one used to `pip install -r requirements.txt`

**Diagnosis**:

```bash
python --version
# MUST report 3.11.x

uname -m
# arm64 on Apple silicon

which python
# Should be inside the active conda/venv environment

python -c "import coremltools; print(coremltools.__version__)"
# Should succeed and report a version matching the toolkit's pin
```

**Fix**:

```bash
# Recreate the environment with Python 3.11 on an Apple silicon Mac
conda create -n fm-adapter python=3.11
conda activate fm-adapter
pip install -r requirements.txt
```

Training and evaluation can run on Linux GPU machines; **export must run on Apple silicon Mac**.

**Time cost**: 15-30 minutes (recreate environment, re-run export only — no retrain).

---

### Pattern 10: Draft Model Compilation Rate-Limited

**Symptom**:

An adapter that uses a draft model loads and works initially, then after several launches (or several adapter switches) on a device, the draft model stops compiling — inference falls back to the slower non-speculative path, or draft-model setup fails outright. Reproduces on iPhone/iPad/Vision Pro but **never on macOS**.

**Cause**:

Apple rate-limits draft-model compilation to **three compilations per app, per day, on all platforms except macOS** (`/foundationmodels/loading-and-using-a-custom-adapter-with-foundation-models`). Something is triggering recompilation instead of reusing a cached compiled draft model. Common triggers:

1. The compiled draft model isn't cached/persisted, so it recompiles every launch (3 launches → quota exhausted for the day)
2. The app switches the active adapter repeatedly in one session; each switch can force a new draft-model compilation
3. Defensive "recompile to be safe" logic on a code path that runs more than three times a day

macOS never reproduces because the limit excludes it — which is exactly why this slips through Mac-based testing.

**Diagnosis**:

- Count how many times your code path that loads/compiles the draft model runs per day on device. If it exceeds three, that's the bug.
- Check whether the compiled draft model is written to and read back from disk across launches, or regenerated each time.
- Reproduce on a real iOS device (not the Mac), launching the app 4+ times in a 24-hour window.

**Fix**:

- **Cache the compiled draft model and reuse it across launches.** Compile once; persist; load the cached form thereafter.
- Remove any speculative/defensive recompilation. Recompile only when the adapter (and therefore its draft model) actually changes.
- If the feature legitimately needs more than three distinct draft models per day (e.g. frequent adapter switching), reconsider whether a draft model is the right latency strategy for that flow — see `foundation-models-adapters.md` Pattern 5.

**Time cost**: hours (add caching, remove redundant compilation). The 24-hour window resets on its own; no retrain or re-export needed.

---

## Cross-Referenced @Generable Issues

The following appear in adapter contexts but are general Foundation Models macro/schema issues. Solutions live in `axiom-ai (skills/foundation-models-diag.md)`:

| Symptom | Pattern in foundation-models-diag.md |
|---------|--------------------------------------|
| `external macro implementation type 'FoundationModelsMacros.GenerableMacro' could not be found` (Playgrounds) | Pattern 6a |
| `Fatal error in SchemaAugmentor.swift:209` (recursive `@Generable`) | Pattern 6b |
| `GenerationSchema.SchemaError.undefinedReferences` | Pattern 6c |

These are not adapter-specific — they affect any `@Generable` usage. Apply the foundation-models-diag patterns directly.

---

## Quick Reference

| Symptom | Cause | Pattern | Time to fix |
|---------|-------|---------|-------------|
| `compatibleAdapterNotFound` at runtime | No matching variant for current base-model | 1 | 10 min fallback / days retrain |
| `invalidAdapterName` at load | Hyphen in adapter name | 2 | 30 min re-export |
| `invalidAsset` at load | Modified `export/` or corrupted pack | 3 | 1-4 hr re-export / weeks retrain |
| Production-only load failure | Missing entitlement | 4 | Apple review + re-sign |
| Background Assets download fails | See axiom-integration | 5 | Varies |
| Tool calls don't fire from adapter | Training data missing `tool_calls` schema | 6 | Days (retrain) |
| Trivial prompts eat context window | Verbose system prompts in training data | 7 | Days (rewrite + retrain) |
| Accuracy drops after OS update | Silent base-model change (FB18924722) | 8 | 1-2 weeks per retrain |
| `coremltools.libmilstoragepython` missing | Python 3.12/3.13 or Linux export | 9 | 15-30 min |
| Draft model stops speeding up inference (iOS only) | Draft-model compilation rate-limited (3/app/day); not cached | 10 | Hours (add caching) |
| `@Generable` Playgrounds / recursive / undefined refs | General macro issues | foundation-models-diag.md 6a/6b/6c | See cross-ref |

---

## Cross-References

- `axiom-ai (skills/foundation-models-adapters.md)` — discipline file (decision to train, pressure scenarios, audit checklists)
- `axiom-ai (skills/foundation-models-adapters-ref.md)` — toolkit CLIs, runtime API, compatibility matrix
- `axiom-ai (skills/foundation-models-diag.md)` — base Foundation Models diagnostics (`@Generable` macro issues, context overflow, guardrails)
- `axiom-ai (skills/foundation-models.md)` — Approach Triage (rungs 1-4 before adapter training)
- `axiom-ai (skills/foundation-models-ref.md)` — base Foundation Models API (`LanguageModelSession`, `@Generable`, `Tool` protocol)
- `axiom-integration (skills/background-assets.md)` — asset pack delivery, `BAErrorCode` patterns
- `axiom-integration (skills/background-assets-ref.md)` — `AssetPackManager` API surface

---

## Resources

**WWDC**: 2024-10159, 2025-286, 2025-301, 2025-325

**Docs**: /foundationmodels/loading-and-using-a-custom-adapter-with-foundation-models, /foundationmodels/systemlanguagemodel/adapter, /bundleresources/entitlements/com.apple.developer.foundation-model-adapter, /backgroundassets

**Skills**: axiom-ai (skills/foundation-models-adapters.md), axiom-ai (skills/foundation-models-adapters-ref.md), axiom-ai (skills/foundation-models-diag.md), axiom-integration (skills/background-assets.md)

---

**Last Updated**: 2026-05-16
**Toolkit Version**: 26.0.0
**Skill Type**: Diagnostic
