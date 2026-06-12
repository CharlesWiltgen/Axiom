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

- **iOS 26+** — **`SpeechAnalyzer`** + **`SpeechTranscriber`**: the modern, on-device, offline-capable API. Manage model assets with **`AssetInventory`** (download/reserve locales). Handle **volatile** results (fast, may change) vs **finalized** results (stable) in your UI, and convert input audio to the analyzer's expected format.
- **Pre-iOS 26** — **`SFSpeechRecognizer`** (`Speech` framework): request authorization, check the recognizer's `supportsOnDeviceRecognition`, and set `requiresOnDeviceRecognition` on your `SFSpeechRecognitionRequest` to force on-device processing; server recognition has duration limits and privacy implications.
- Both require the `NSSpeechRecognitionUsageDescription` Info.plist string, and live audio also needs microphone permission (`NSMicrophoneUsageDescription`).

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Core ML is just load and predict" | Real apps need compute-unit selection, async/off-main-thread inference, model pre-warming, and (for LLMs) stateful KV-cache. |
| "My model is small, no optimization needed" | Even small models benefit from compute-unit choice and async prediction; large ones need compression to fit memory. |
| "Compression is free accuracy" | Post-training compression is lossy — always re-measure; move to calibration-/training-time compression if accuracy drops. |
| "I'll just use `SFSpeechRecognizer`" | On iOS 26+, `SpeechAnalyzer` is the modern on-device API with better accuracy and offline support. Use `SFSpeechRecognizer` only for pre-26 targets. |

## Resources

**WWDC**: 2024-10161, 2024-10159, 2025-277

**Docs**: /coreml, /coreml/mlmodelconfiguration, /coreml/mltensor, /CoreAI, /speech, /speech/speechanalyzer, /speech/speechtranscriber, /speech/sfspeechrecognizer — plus the `coremltools` guide (apple.github.io/coremltools) for conversion + `coremltools.optimize`

**Skills**: coreml-conversion, coreml-compression, coreml-training (the Core ML lifecycle stages), core-ai (the 27-cycle Core AI path for LLM-scale models), axiom-ai (Foundation Models — Apple's built-in LLM), axiom-vision (computer vision), axiom-apple-docs (Apple API doc lookup), axiom-concurrency (off-main-thread inference)
