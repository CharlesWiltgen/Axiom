# Core AI

**Core AI** is the on-device inference framework that powers Apple Intelligence — new in the 27 platform releases and now open to your apps. It is the modern successor path for running your **own** advanced models — large language models, vision transformers, diarization models — locally across CPU, GPU, and Neural Engine, with no server and no per-token cost. It is a *complete set of technologies*: a Python authoring/conversion/optimization toolchain, a `.aimodel` on-device format, a memory-safe Swift runtime, and a developer toolchain (ahead-of-time compilation, Core AI Instruments, the Core AI Debugger).

This page owns the **Core AI** path. Core ML still exists for classic models — see `skills/ios-ml.md` for the Core ML lifecycle and the boundary below. For Apple's *built-in* on-device LLM (you don't ship a model), use Foundation Models in `axiom-ai`.

## When to Use

- Bringing a PyTorch model (LLM, SAM-style segmentation, custom architecture) to device via the Core AI format
- Optimizing/quantizing a large model to fit on-device memory and run fast on Apple silicon
- Loading and running a `.aimodel` from Swift (`AIModel`, `InferenceFunction`, `NDArray`)
- A transformer decode loop that slows down over time → KV-cache via Core AI **states**
- First-launch stalls from model **specialization**; planning model download/caching
- Backing a Foundation Models `LanguageModelSession` with your own custom model

## Boundary — Core AI vs Core ML vs Foundation Models

| Developer intent | Go to |
|------------------|-------|
| Run Apple's built-in LLM (`@Generable`, no model to ship) | `axiom-ai` Foundation Models |
| Back a `LanguageModelSession` with **my own** LLM | This page (FM bridge) + `foundation-models-ref` Ecosystem |
| Bring a large/LLM/transformer PyTorch model on-device (27-cycle) | **This page** — Core AI |
| Convert/compress a classic Core ML model (`.mlpackage`, `MLModel`) | `skills/ios-ml.md` → `coreml-conversion.md` / `coreml-compression.md` |
| Custom Metal-shader tensor ops / `MTLTensor` quantization | `axiom-graphics` metal-migration-ref Part 6 |
| Computer vision with Apple's models (no model to ship) | `axiom-vision` |

**Rule of thumb**: Core ML is the established path for classic models; Core AI is the 27-cycle path built for modern/LLM-scale workloads and deep customization (custom kernels, multi-function assets, ahead-of-time compilation). Both convert from PyTorch; pick Core AI when you need its runtime, its optimization library, or LLM-scale execution.

## The Deployment Lifecycle

Core AI spans five stages. Authoring/optimization/debugging happen **off-device in Python**; integration/deployment happen **in your app in Swift**.

| Stage | Tooling | Where |
|-------|---------|-------|
| **Convert** PyTorch → `.aimodel` | `coreai-torch` (`TorchConverter`) | Python (off-device) |
| **Optimize** (quantize, palettize, reauthor) | `coreai-opt` | Python (off-device) |
| **Debug** numerics & structure | Core AI Debugger (standalone app) | Mac |
| **Integrate** (load + run) | `CoreAI` Swift framework (`OS27`) | App |
| **Deploy** (specialize, cache, AOT compile) | `AIModelCache`, `coreai-build` | App + dev machine |

A model ships as a `.aimodel` **asset** — a source representation that runs on any Apple device. Before it can execute, it is **specialized** for the specific device (see Specialization & Caching).

## Python Authoring Toolchain

The authoring side reuses the Python/PyTorch workflow you already know. These are **pip packages, not OS-gated framework APIs** — they run on your Mac, not on device, so they carry no `OS27` marker and are not SDK-verifiable. Signatures below are from WWDC 2026 sessions 324/325; treat the `coreai-models` package APIs as illustrative and verify against the repository.

**`coreai-torch` — conversion** (`pip install coreai-torch` pulls in `coreai`):

```python
import torch, coreai_torch

exported = torch.export.export(pt_model, args=(example,),
    dynamic_shapes={"features": {1: torch.export.Dim("seq", min=1, max=256)}})
exported = exported.run_decompositions(coreai_torch.get_decomp_table())  # preserve attention etc.

ai_program = coreai_torch.TorchConverter().add_exported_program(
    exported, input_names=["features"], output_names=["logits"]).to_coreai()
ai_program.save_asset("Model.aimodel")
```

- `dynamic_shapes` keeps a dimension dynamic (e.g. sequence length) instead of tracing it to the static sample size.
- `state_names=[...]` on `add_exported_program` turns PyTorch `register_buffer` tensors into Core AI **states** (in-place KV-cache — see below).
- Multiple `add_exported_program` calls with distinct entrypoint names → **one asset, multiple callable functions** (e.g. `image_encode` / `text_encode` / `detect`), each runnable at a different cadence and compressed independently.
- Verify converted numerics in Python: load both models, assert a small delta on a sample input.

**`coreai-opt` — optimization/compression**: config-driven, choose a different scheme per platform (macOS vs iOS). Supports int4/int8/FP4/FP8 weight compression with flexible granularity. `Quantizer` (calibration or quantization-aware training) and `KMeansPalettizer` (lookup-table palettization, power-efficient on iOS) take a config + example inputs, then `prepare`/`finalize`. `ExecutionMode.EAGER` for weight compression, `GRAPH` for activations. Presets like `presets.w4` give 4-bit per-channel in one line.

**Custom Metal 4 kernels**: register a `coreai_torch.dsl.TorchMetalKernel` (Metal Shading Language source + a PyTorch reference + input/output names + `result_shapes`) with the converter via `register_custom_kernels([...])`. The MSL is embedded directly in the `.aimodel` — the kernel ships with the model. For writing efficient kernels and the `MTLTensor` side, see `axiom-graphics` metal-migration-ref Part 6 (`TorchMetalKernel`, WWDC 330) — this page does not duplicate the shader surface.

**Model reauthoring** (advanced, especially for iOS): rewrite the PyTorch implementation for the target — convolutional projections instead of linear layers, static tensor shapes, channels-first layouts, explicit in-place KV-cache updates — so Core AI maps to native hardware primitives. Unit- and integration-test each module. The **Core AI Models repository** ships reusable components, conversion recipes for popular models (LLMs, SAM 3, Qwen families), a Swift runtime package, and **Core AI Skills** you install into a coding agent to get expert conversion/optimization guidance from day one.

## Swift Runtime API (`OS27`)

`import CoreAI` re-exports the whole surface (the framework is split into `CoreAIRuntime`/`CoreAIAsset`/`CoreAIDelegates` subframeworks plus empty shells — you never import them directly). All types are available on **all Apple platforms at 27** (iOS/iPadOS/macOS/watchOS/tvOS/visionOS). The API uses non-escapable/`~Copyable` types and lifetime dependence for memory safety without copies.

```swift
import CoreAI

@available(anyAppleOS 27, *)
func run(modelURL: URL) async throws {
    let model = try await AIModel(contentsOf: modelURL)        // loads the .aimodel
    guard let fn = try model.loadFunction(named: "main") else { return }  // throws -> InferenceFunction?

    var input = NDArray(shape: [seqLen, hiddenDim], scalarType: .float32)
    writeFeatures(into: input.mutableView(as: Float.self))     // MutableView<Float> is ~Escapable

    var outputs = try await fn.run(inputs: ["features": input])
    guard let logits = outputs.remove("logits")?.ndArray else { throw ModelError.missingOutput }
    use(logits.view(as: Float.self))
}
```

Core types (all SDK-verified against Xcode 27.0 beta, compile-checked):

- **`AIModel`** — `init(contentsOf:options:) async throws`, `functionNames: [String]`, `functionDescriptor(for:) -> InferenceFunctionDescriptor?`, `loadFunction(named:) throws -> InferenceFunction?`, `static var deviceArchitectureName`. (`AIModel`, `InferenceFunction` are `Sendable`.)
- **`InferenceFunction`** — `descriptor`, `run(inputs:states:outputViews:) async throws -> Outputs` (overloads accept `[String: NDArray]` or a built `Inputs`). For Metal command-stream pipelining there is `encode(inputs:states:outputViews:to:)` + `ComputeStream`.
- **`InferenceFunctionDescriptor`** — `name`, `inputCount`/`outputCount`, `inputNames`/`stateNames`/`outputNames`, `inputDescriptor(of:)`/`stateDescriptor(of:)`/`outputDescriptor(of:)`.
- **`NDArray`** (`@unchecked Sendable`) — `init(shape:scalarType:)` (+ `strides:`/`interleaveLayout:`/`scalars:shape:`/`descriptor:` overloads), `scalarType`/`shape`/`strides`/`interleaveLayout`. Access via `mutableView(as:)` (`MutableView<Element>`), `view(as:)` (`View<Element>`), or raw `rawView()`/`mutableRawView()`. The mutable views (`MutableView`, `MutableRawView`, `MutableViews`) are `~Escapable, ~Copyable`; the read-only `View`/`RawView` are `~Escapable` (still copyable). Write through them in place; don't store or return them.
- **`NDArray.ScalarType`** (`CaseIterable`) — covers low-bit and modern ML dtypes: `bool`, `int2`…`int128`, `uint1`…`uint128`, `float8e5m2`/`float8e4m3fn`/`float8e8m0fn`/`float4e2m1fn`, `float16`/`float32`/`float64`, `bfloat16`, `cfloat16/32/64`.
- **`AIModelAsset`** (inspection, no run) — `init(contentsOf:)`, `static isValid(at:)`, `metadata` (author/license/description + typed `creatorDefinedMetadata`), `summary(includingStatistics:)` (functions, storage types, compute types, operation distribution), `updateMetadata(_:)`. `AssetError.Kind`: `unsupportedVersion`/`invalidFeatureType`/`corruptedMetadata`/`invalidName`/`duplicateName`.

**States (KV-cache).** A transformer that re-feeds full history is O(n²) per step — latency grows with sequence length. Declare key/value caches as **states** (PyTorch `register_buffer` → `state_names` at conversion). At runtime they are read **and updated in-place** each inference, so you pass only the newest input:

```swift
var keyCache = NDArray(shape: [layers, maxContext, hiddenDim], scalarType: .float32)
var valueCache = NDArray(shape: [layers, maxContext, hiddenDim], scalarType: .float32)

var states = InferenceFunction.MutableViews()
states.insert(&keyCache, for: "keyCache")
states.insert(&valueCache, for: "valueCache")
let outputs = try await fn.run(inputs: ["features": input], states: states)
```

**Tight-loop / pipeline optimizations** (reach for only when profiling demands): allocate `NDArray`s in the function's optimal memory layout to avoid layout conversions; pre-allocate output values (`outputViews:`) so the framework writes into them; use `AsyncValue` / `ComputeStream` to pipeline multiple inference functions. The higher-level `run(inputs:)` is correct for most apps.

## Specialization & Caching (`OS27`)

A `.aimodel` is a portable source representation. To run, it must be **specialized** for the device: (1) a core set of **compilation** steps (segment/plan/optimize compute — the expensive part), then (2) **executable-artifact** generation tied to that device + OS version. First specialization of a large model can take a long time; subsequent loads come from cache and are fast.

**Discipline: never let specialization happen inside an interactive flow.** Apple's explicit guidance. Move it to a dedicated first-run experience, a feature opt-in, or right after asset download — with progress UI — so the user never waits mid-task.

```swift
// Gate a feature: is the model already specialized & cached?
let cache = AIModelCache.default
guard let model = try cache.model(for: modelURL, options: .default) else {
    informUser("Preparing AI features…")          // specialize ahead of time instead
    return
}

// Explicitly specialize ahead of time (after download / on opt-in); returns a ready-to-run AIModel
let prepared = try await AIModel.specialize(contentsOf: modelURL,
    options: .default, cache: .default, cachePolicy: .persistent)
_ = prepared
```

- **`AIModelCache`** — `.default`; `init?(appGroup:)` to **share one cache across apps in an app group**; `model(for:options:) throws -> AIModel?` (nil = not specialized yet); `deleteEntry(for:options:)`/`deleteEntries(for:)`/`deleteAll()`; `Policy` (`.default`/`.persistent`) with `PurgeConditions` (`.storagePressure`, `.sourceAssetChangedOrDeleted`).
- **`SpecializationOptions`** — `.default`, `.cpuOnly`, `init(preferredComputeUnitKind:)`, `expectFrequentReshapes`. `ComputeUnitKind` is `.cpu`/`.gpu`/`.neuralEngine` with `static var availableKinds`.
- **Ahead-of-time compilation** — move the expensive compilation step to your dev machine with the `coreai-build` CLI: `xcrun coreai-build compile MyModel.aimodel --platform iOS` (emit per-architecture compiled models). The device still specializes, but with far less work, so it finishes much faster. See the *Compiling Core AI models ahead of time* article. Detect the device architecture (`AIModel.deviceArchitectureName`) and fetch the matching compiled asset.
- **Large models** (>1 GB) — don't bundle them into the app download (it taxes every user, including those who never use the feature). Deliver on demand with **Background Assets**, triggered when the user opts in — see `axiom-integration` (skills/background-assets.md).

## Foundation Models Bridge

You can back a Foundation Models `LanguageModelSession` with your **own** model, reusing `respond` / `@Generable` / tools / streaming. This is done via the **open-source `coreai-models` Swift package** (`CoreAILanguageModel`), **not** a system-framework type — `CoreAILanguageModel` is not in the CoreAI SDK. The package's type conforms to FoundationModels' `LanguageModel` protocol.

```swift
import FoundationModels
import CoreAILanguageModels   // module CoreAILanguageModels, type CoreAILanguageModel — open-source coreai-models package (WWDC 326 code sample); verify names vs repo

let model = try await CoreAILanguageModel(resourcesAt: modelURL)
let session = LanguageModelSession(model: model)

@Generable struct VocabCard { let word: String; let translation: String; let example: String }
let card = try await session.respond(to: "Create a vocab card for flower",
                                     generating: VocabCard.self).content
```

Same session API, your model underneath — guided generation, streaming, and structured output all work. For the `LanguageModel` / `LanguageModelExecutor` protocol surface and the MLX provider, see `foundation-models-ref` (Custom Model Providers + Ecosystem). The package also ships task libraries (e.g. an image segmenter wrapping SAM 3) that abstract tensor pre/post-processing behind clean Swift APIs.

## Developer Tools (WWDC 2026)

- **Core AI Instruments** — a new Xcode instrument to profile inference intervals in your app (e.g. spot latency growing with sequence length → add states; spot a specialization event blocking launch).
- **Core AI debug gauge** — streaming Core AI activity in Xcode while the app runs; a quick first look before opening Instruments.
- **Core AI Debugger** — a standalone Mac app: visualize the model as a graph grouped by PyTorch module, ground every op in its original Python source line, run on real hardware to inspect intermediate tensors, and **compare** a specialized run against a PyTorch reference (`save intermediates` API) at automatically-identified **sync points** scored by PSNR — turning "which layer did quantization break?" from hours into minutes.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Core AI replaces Core ML" | Core ML still owns classic models (`.mlpackage`, `MLModel`, `MLUpdateTask`). Core AI is the 27-cycle path for modern/LLM-scale models and deep customization. Both convert from PyTorch — see the boundary table. |
| "`CoreAILanguageModel` is part of the Core AI framework" | It's in the **open-source `coreai-models` Swift package**, not the SDK. The system `CoreAI` framework has no `LanguageModel` type. Add the package as a dependency. |
| "There's a `CoreAICompiler` / `CoreAICache` Swift API" | Those subframeworks expose no public Swift API — `import` gets you nothing. AOT compilation is the `coreai-build` CLI; caching is `AIModelCache` in the runtime. |
| "Specialize the model when the user taps the feature" | First specialization of a large model can take a long time. Apple says keep it out of interactive flows — do it on a first-run screen / opt-in / after download, with progress UI. |
| "Bundle the 1 GB model in the app" | That hits every user on every update, including non-users of the feature. Ship it via Background Assets on opt-in. |
| "My decode loop is just slow, buy a bigger budget" | Transformer decode without a cache is O(n²) in sequence length. Add key/value **states** so they update in place — steady latency. |
| "Store the `NDArray.MutableView` and reuse it" | Views are `~Escapable`/`~Copyable`. Write through them in place within the call; don't capture or return them. |

## API Quick Reference (`OS27`)

```
import CoreAI                                            // re-exports everything

AIModel(contentsOf:options:) async throws                // load .aimodel
  .functionNames / .functionDescriptor(for:) / .loadFunction(named:) throws -> InferenceFunction?
  static .specialize(contentsOf:options:cache:cachePolicy:) async throws -> AIModel
  static .deviceArchitectureName
InferenceFunction.run(inputs:states:outputViews:) async throws -> Outputs   // inputs: [String:NDArray] or Inputs
  .descriptor : InferenceFunctionDescriptor (inputNames/stateNames/outputNames…)
  InferenceFunction.MutableViews().insert(&ndArray, for:)                    // states / output views
NDArray(shape:scalarType:[strides:][interleaveLayout:]) ; .scalarType/.shape/.strides
  .mutableView(as:) -> MutableView<T> ; .view(as:) -> View<T> ; .rawView()/.mutableRawView()
  NDArray.ScalarType: .float32/.float16/.bfloat16/.int4/.int8/.float8e4m3fn/… (CaseIterable)
AIModelAsset(contentsOf:) ; AIModelAsset.isValid(at:) ; .metadata ; .summary(includingStatistics:)
AIModelCache.default ; init?(appGroup:) ; .model(for:options:) ; .deleteAll() ; .Policy(.default/.persistent)
SpecializationOptions(.default/.cpuOnly/init(preferredComputeUnitKind:)) ; ComputeUnitKind(.cpu/.gpu/.neuralEngine)

# Python (off-device, pip — not OS-gated):
coreai_torch.TorchConverter().add_exported_program(…, input_names=, output_names=, state_names=).to_coreai()
coreai_torch.get_decomp_table() ; .register_custom_kernels([TorchMetalKernel(…)])
coreai-opt: Quantizer / KMeansPalettizer / presets.w4 ; int4/int8/FP4/FP8 ; EAGER|GRAPH
xcrun coreai-build compile Model.aimodel --platform iOS    # ahead-of-time compilation
```

## Resources

**WWDC**: 2026-324, 2026-325, 2026-326, 2026-330

**Docs**: /CoreAI, /CoreAI/compiling-core-ai-models-ahead-of-time, /CoreAI/integrating-on-device-ai-models-in-your-app-with-core-ai, /CoreAI/managing-model-specialization-and-caching

**Skills**: skills/ios-ml.md (Core ML lifecycle + boundary), foundation-models-ref (LanguageModel bridge + Ecosystem), axiom-graphics metal-migration-ref (custom Metal kernels / MTLTensor), axiom-integration background-assets (model delivery)
