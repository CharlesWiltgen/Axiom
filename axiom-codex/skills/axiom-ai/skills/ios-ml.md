# iOS Machine Learning

The **hub** for custom on-device ML — converting, compressing, training, and deploying your own models with Core ML — plus on-device speech-to-text. For Apple's built-in on-device LLM (Foundation Models, `@Generable`), stay in `axiom-ai`. For computer vision (image analysis, detection, segmentation), use `axiom-vision`.

This page owns **deployment/runtime** and **speech**. The lifecycle stages have dedicated files:

| Stage | File |
|-------|------|
| Convert a trained PyTorch/TF model → Core ML | `coreml-conversion.md` |
| Compress it (QAT vs PTQ, palettize/quantize/prune) | `coreml-compression.md` |
| Train from scratch (Create ML) or personalize on-device (`MLUpdateTask`) | `coreml-training.md` |
| Deploy / run / speech-to-text | **this page** |

## When to Use

- Converting PyTorch/TensorFlow models to Core ML
- Compressing models (quantization, palettization, pruning)
- Deploying / running custom models on device (including LLMs, KV-cache, `MLTensor` stitching)
- Building speech-to-text / transcription features

## Boundary: ML (custom models) vs AI (Apple Intelligence) vs Vision

| Developer intent | Go to |
|------------------|-------|
| "Use Apple Intelligence / Foundation Models" | `axiom-ai` — Apple's on-device LLM |
| "Add text generation with `@Generable`" | `axiom-ai` — structured output |
| "Run / convert / compress my OWN model" | This page — Core ML |
| "Deploy a custom LLM with KV-cache" | This page — Core ML stateful models |
| "Use the Vision framework for image analysis" | `axiom-vision` |
| "Use pre-trained Apple NLP models" | `axiom-ai` |

**Rule of thumb**: converting/compressing/deploying your own model → Core ML (this page). Using Apple's built-in AI → `axiom-ai` Foundation Models. Computer vision → `axiom-vision`.

## Core ML — Decision Framework

### Conversion & compression → dedicated files

- **Converting** a PyTorch/TF/Keras model → `coreml-conversion.md` (`coremltools.convert`, ML Program vs NN-spec, trace vs export, parity validation).
- **Compressing** the result → `coreml-compression.md` (the PTQ-vs-QAT decision, palettization/quantization/pruning).

### Deployment / runtime

- **Compute units** — set `MLModelConfiguration.computeUnits` deliberately (`.all`, `.cpuAndNeuralEngine`, `.cpuAndGPU`, `.cpuOnly`). `.all` lets the system choose; pin a narrower set only when profiling shows a win.
- **Stateful models / KV-cache** (iOS 18+) — declare model state so a transformer's KV-cache persists across predictions instead of being re-allocated per token.
- **`MLTensor`** (iOS 18+) — stitch pre/post-processing and multiple models into one typed-tensor pipeline.
- **Async prediction** — use the async `prediction(from:)`; for batches use the synchronous `predictions(fromBatch:)`.
- Run inference **off the main thread**, and pre-warm: first load compiles/caches the model (`.mlmodelc`), so warm it before the user needs it. See `axiom-concurrency`.

### Core AI — the 27-cycle path for modern/LLM-scale models (OS27)

**Core AI** (`OS27`) is the new on-device inference framework that powers Apple Intelligence, now open to your apps. It is built for modern/LLM-scale workloads (large language models, vision transformers) with deep customization — custom Metal kernels, multi-function assets, ahead-of-time compilation, KV-cache states, and a specialization/caching deployment model. It has its own Python conversion toolchain (`coreai-torch`/`coreai-opt`), `.aimodel` format, and Swift runtime (`import CoreAI` → `AIModel`/`InferenceFunction`/`NDArray`).

**Division of labor**: Core ML (this page) is the established path for classic models (`.mlpackage`, `MLModel`, `MLUpdateTask`); Core AI is the 27-cycle path for LLM-scale models and deep customization. Both convert from PyTorch — pick Core AI when you need its runtime, optimization library, or LLM execution.

To back a Foundation Models `LanguageModelSession` with your own model, use the **open-source `coreai-models` Swift package** (`CoreAILanguageModel`, which conforms to FoundationModels' `LanguageModel` protocol) — this is a package, **not** a type in the CoreAI system framework.

Full coverage → **`core-ai.md`** (lifecycle, Swift runtime API, specialization & caching discipline, FM bridge, tools).

### Common runtime failure modes

- Slow first inference → on-device compile/caching cost; pre-warm the model before the user needs it.
- Main-thread stall during prediction → run inference off the main thread (see `axiom-concurrency`).
- Memory spike loading a large model → compress it first (`coreml-compression.md`).

For conversion-time failures (output divergence, `coremltools` import errors, unsupported ops) see `coreml-conversion.md`; for accuracy loss after compression see `coreml-compression.md`.

## Speech-to-Text — Decision Framework

- **iOS 26+** — **`SpeechAnalyzer`** + **`SpeechTranscriber`**: the modern, on-device, offline-capable API. Manage model assets with **`AssetInventory`** (download/reserve locales). Handle **volatile** results (fast, may change) vs **finalized** results (stable) in your UI.
- **Pre-iOS 26** — **`SFSpeechRecognizer`** (`Speech` framework): request authorization, check the recognizer's `supportsOnDeviceRecognition`, and set `requiresOnDeviceRecognition` on your `SFSpeechRecognitionRequest` to force on-device processing; server recognition has duration limits and privacy implications.
- Both require the `NSSpeechRecognitionUsageDescription` Info.plist string, and live audio also needs microphone permission (`NSMicrophoneUsageDescription`).

### Simultaneous analyses are capped — plan for it

`SpeechAnalyzer` limits how many active backing engine instances and models it will allocate. Exceed the limit and it **throws `SFSpeechError.Code.insufficientResources`**. This is true from iOS 26 — it is not a 27 change.

| Platform | Practical limit |
|----------|-----------------|
| iOS / visionOS | ~2 ongoing recognition instances (or 2 incompatible modules at once) |
| macOS | No limit currently |

Similarly-configured transcribers **share** backing engines and models — so the cap counts *incompatible* work, and a third similarly-configured analyzer may not throw at all. Making your analyzers alike (same locale, same settings) is the cheap fix; reach for it before overriding anything.

`insufficientResources` (rawValue 16) is a **Swift-only `static var`** on `SFSpeechError.Code` — `SFErrors.h`'s `NS_ERROR_ENUM` declares only 6 real ObjC cases, and this is not one of them. So Swift synthesizes no shorthand member on `SFSpeechError`, and the form you reach for first does **not** compile:

```swift
catch SFSpeechError.insufficientResources { … }        // ❌ no member 'insufficientResources'
```

It *does* pattern-match once you spell the `Code` type. Both of these compile and match at runtime:

```swift
catch SFSpeechError.Code.insufficientResources { … }
catch let error as SFSpeechError where error.code == .insufficientResources { … }
```

Same trap for `cannotConfigureAudioSystem` (`OS27`), also a Swift-only `static var`.

`SpeechAnalyzer.Options.ignoresResourceLimits` `OS27` opts out of the cap: the system then permits an *unlimited* number of analyzers. It stops **counting**, not managing — you trade an early, predictable `insufficientResources` throw for an **unpredictable error** at some later point once real hardware capacity is exceeded. Apple's examples of when this is safe are narrow: analyzers that share language and settings, or that receive audio on an interleaved schedule. Apple attaches an explicit warning — test across devices, and have a recovery path for when an analyzer fails.

The property is `let`, so it is settable only through the 27-only initializer. On a 26 deployment target you need both branches:

```swift
let options: SpeechAnalyzer.Options
if #available(anyAppleOS 27, *) {
    options = .init(priority: .userInitiated, modelRetention: .lingering, ignoresResourceLimits: true)
} else {
    options = .init(priority: .userInitiated, modelRetention: .lingering)
}
```

### Feeding audio to the analyzer

For mic and arbitrary-buffer input, 26 makes you build the input sequence yourself; 27 ships the plumbing. (File input was already covered on 26 by `SpeechAnalyzer(inputAudioFile:)` / `analyzeSequence(from:)`.) All the 27 types are watchOS-unavailable — as is `SpeechAnalyzer` itself, since 26.

| Input source | iOS 26 | `OS27` |
|--------------|--------|--------|
| Mic / capture device | Hand-rolled `AVAudioEngine` tap + `AVAudioConverter` → your own `AsyncStream` | `CaptureInputSequenceProvider` → `analyzerInputs` |
| Audio file | `AVAudioFile` convenience inits | Same, plus `AssetInputSequenceProvider` for an `AVAsset`/track (transcribe a video's audio track directly) |
| Arbitrary buffers | Your own `AVAudioConverter` to `bestAvailableAudioFormat` | `AnalyzerInputConverter.converter(compatibleWith:)` → `convert(_:at:)` / `flush()` |

Gate the 27 path as the SDK does, and keep the manual path as the pre-27 fallback — these are additions, not drop-in replacements. An `iOS 27`-only gate silently excludes macOS/visionOS/tvOS:

```swift
@available(anyAppleOS 27, *)
@available(watchOS, unavailable)
```

#### `providerWithSession` reconfigures your `AVAudioSession`

The two `CaptureInputSequenceProvider` entry points are not interchangeable, and the convenient one has a side effect:

| Entry point | Behavior |
|-------------|----------|
| `providerWithSession(from:compatibleWith:)` | Creates + configures a new `AVCaptureSession` **and automatically configures your app's default `AVAudioSession`**. Session init is slow — call it off the main actor. The only option on visionOS. |
| `provider(from:in:compatibleWith:)` | Joins a session you own. **Does not reconfigure or alter it** — but you must add its `captureAudioDataOutput` to your session yourself, or you get silence. visionOS-unavailable. |

If your app manages its own audio session (playback, VoIP, recording), `providerWithSession` will stomp it. Use `provider(from:in:)` — that is exactly what Apple offers it for. Don't touch `captureAudioDataOutput`'s sample-buffer delegate or callback queue.

**Swift 6 landmine on `provider(from:in:)`** — the factory is `@concurrent` and `AVCaptureDevice`/`AVCaptureSession` are **non-Sendable**, so calling it from inside an actor fails region-isolation checking. Take the device and session as `sending` parameters and call from a `nonisolated` context; the session local is *consumed*, so reach it back afterwards via `provider.captureSession`. A bare `swiftc -typecheck` will not surface this — it only appears under full strict-concurrency compilation.

#### `AnalyzerInput.buffer` is deprecated in 27

Every access to `.buffer` now returns *"a new copy of the audio data for this input"* — an allocation per read. Input may also be backed by a `CMReadySampleBuffer` rather than a PCM buffer. Read `bufferDuration` / `bufferFormat` instead of reaching into `.buffer` for duration or format. Both are 27-only, so on a 26 deployment target the deprecated `.buffer` remains your only path (deprecated but functional) — gate, don't blindly migrate.

New error `SFSpeechError.Code.cannotConfigureAudioSystem` `OS27` — "the audio source could not be configured." Handle it wherever you use the capture providers.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Core ML is just load and predict" | Real apps need compute-unit selection, async/off-main-thread inference, model pre-warming, and (for LLMs) stateful KV-cache. |
| "My model is small, no optimization needed" | Even small models benefit from compute-unit choice and async prediction; large ones need compression to fit memory. |
| "Compression is free accuracy" | Post-training compression is lossy — always re-measure; move to calibration-/training-time compression if accuracy drops. |
| "I'll just use `SFSpeechRecognizer`" | On iOS 26+, `SpeechAnalyzer` is the modern on-device API with better accuracy and offline support. Use `SFSpeechRecognizer` only for pre-26 targets. |
| "Two concurrent transcribers is fine — it's only two" | On iOS/visionOS that's roughly the cap, and a third *incompatible* one throws `insufficientResources`. Give them the same locale + settings so they share a backing engine, or handle the throw. |
| "`ignoresResourceLimits` removes the limit" | It removes the *counting*, not the hardware ceiling. Past real capacity an analyzer still fails — now with an unpredictable error instead of a clean `insufficientResources`. |
| "I'll write the mic → analyzer converter myself" | On 27 that code is already written: `CaptureInputSequenceProvider` and `AnalyzerInputConverter`. Hand-roll only as a pre-27 fallback. |
| "`providerWithSession` is the easy one, I'll use that" | It silently reconfigures your app's default `AVAudioSession`. If you manage your own audio session, use `provider(from:in:)` and add its `captureAudioDataOutput` to your session. |

## Resources

**WWDC**: 2024-10161, 2024-10159, 2025-277

**Docs**: /coreml, /coreml/mlmodelconfiguration, /coreml/mltensor, /coreai, /speech, /speech/speechanalyzer, /speech/speechanalyzer/options, /speech/speechtranscriber, /speech/analyzerinput, /speech/analyzerinputconverter, /speech/captureinputsequenceprovider, /speech/assetinputsequenceprovider, /speech/sfspeechrecognizer — plus the `coremltools` guide (apple.github.io/coremltools) for conversion + `coremltools.optimize`

**Skills**: coreml-conversion, coreml-compression, coreml-training (the Core ML lifecycle stages), core-ai (the 27-cycle Core AI path for LLM-scale models), axiom-ai (Foundation Models — Apple's built-in LLM), axiom-vision (computer vision), axiom-apple-docs (Apple API doc lookup), axiom-concurrency (off-main-thread inference)
