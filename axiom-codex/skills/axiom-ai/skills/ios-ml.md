# iOS Machine Learning

Guidance for **custom** on-device ML — converting, compressing, and deploying your own models with Core ML — plus on-device speech-to-text. For Apple's built-in on-device LLM (Foundation Models, `@Generable`), stay in `axiom-ai`. For computer vision (image analysis, detection, segmentation), use `axiom-vision`.

> **Coverage note**: Axiom does not yet ship dedicated Core ML / Speech *discipline* skills. This page is the decision framework plus the authoritative Apple sources to work from — use `axiom-apple-docs` and the paths in Resources for the API surface. (Deeper Core ML coverage is on the backlog: coremltools conversion, Create ML, `MLUpdateTask` personalization, and quantization-aware vs post-training compression.)

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

### Conversion (PyTorch / TensorFlow → Core ML)

Use **`coremltools`** (Python). Trace/export the source model, then `coremltools.convert(...)` targeting an `.mlpackage` (ML Program). Set `minimum_deployment_target` to the OS you ship and pin `compute_precision` deliberately (FP16 is the default). Validate output parity against the source model on representative inputs before you trust the conversion.

### Compression (`coremltools.optimize`)

Three families, increasing aggressiveness:

- **Palettization** — cluster weights into an N-bit lookup table (2/4/6/8-bit). Usually the best size/accuracy trade-off.
- **Quantization** — linear weight (and optionally activation) quantization to int8.
- **Pruning** — zero out low-magnitude weights (magnitude or structured).

Post-training compression is fast but lossy; **calibration-time / training-time** compression recovers accuracy. Always re-measure accuracy after compressing — don't assume it held.

### Deployment / runtime

- **Compute units** — set `MLModelConfiguration.computeUnits` deliberately (`.all`, `.cpuAndNeuralEngine`, `.cpuAndGPU`, `.cpuOnly`). `.all` lets the system choose; pin a narrower set only when profiling shows a win.
- **Stateful models / KV-cache** (iOS 18+) — declare model state so a transformer's KV-cache persists across predictions instead of being re-allocated per token.
- **`MLTensor`** (iOS 18+) — stitch pre/post-processing and multiple models into one typed-tensor pipeline.
- **Async prediction** — use the async `prediction(from:)`; batch with `predictions(from:)` where supported.
- Run inference **off the main thread**, and pre-warm: first load compiles/caches the model (`.mlmodelc`), so warm it before the user needs it. See `axiom-concurrency`.

### Common failure modes

- Conversion succeeds but outputs diverge → precision or op-mapping mismatch; compare layer outputs.
- Slow first inference → on-device compile/caching cost; pre-warm the model.
- `coremltools` import errors (e.g. `libmilstoragepython`) → environment/version mismatch; match `coremltools` to the source-framework versions.
- Accuracy drop after compression → mode too aggressive; switch to calibration-time compression.

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

**Docs**: /coreml, /coreml/mlmodelconfiguration, /coreml/mltensor, /speech, /speech/speechanalyzer, /speech/speechtranscriber, /speech/sfspeechrecognizer — plus the `coremltools` guide (apple.github.io/coremltools) for conversion + `coremltools.optimize`

**Skills**: axiom-ai (Foundation Models — Apple's built-in LLM), axiom-vision (computer vision), axiom-apple-docs (Apple API doc lookup), axiom-concurrency (off-main-thread inference)
