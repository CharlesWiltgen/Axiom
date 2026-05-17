---
name: ios-ml
description: Router for on-device machine learning and speech-to-text work — CoreML conversion and deployment, model compression, stateful models for LLMs, MLTensor pipeline stitching, and SpeechAnalyzer transcription
---

# iOS Machine Learning

Navigation hub for on-device machine learning and speech-to-text work. Routes to the right specialized skill based on whether you're converting models, optimizing inference, debugging, or transcribing audio.

## When to Use

Use this skill when you're:
- Converting a PyTorch or TensorFlow model to CoreML
- Deploying a custom ML model on iOS, iPadOS, macOS, watchOS, or tvOS
- Compressing a model with quantization, palettization, or pruning
- Implementing KV-cache for a custom large language model
- Stitching multiple models together with MLTensor
- Adding live or file-based speech transcription
- Debugging slow inference, load failures, or accuracy drops after compression

## Boundary with Foundation Models

ML and AI sound interchangeable but route to different skills:

| What you're doing | Skill |
|---|---|
| Running your own model on-device | This skill (CoreML) |
| Using Apple's built-in on-device LLM | [Foundation Models](/skills/integration/foundation-models) |
| Specializing the built-in LLM with a custom adapter | [Foundation Models Adapters](/skills/integration/foundation-models-adapters) |
| Image analysis, pose detection, text recognition | axiom-vision skills |

**Rule of thumb** — if you're converting, compressing, or deploying your own model, you want CoreML. If you're calling Apple's `LanguageModelSession`, you want Foundation Models.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I convert my PyTorch model to CoreML?"
- "My model is 5 GB. How do I compress it to fit on iPhone?"
- "Should I use CoreML or Foundation Models for text generation?"
- "How do I implement KV-cache for my LLM?"
- "Why is my CoreML inference slow on the first call?"
- "What's MLTensor and when should I use it?"
- "Add live transcription with SpeechAnalyzer to my app."
- "My compressed model has bad accuracy. What went wrong?"

## What This Skill Provides

This skill routes to four specialized resources depending on your task:

- **CoreML implementation patterns** — model conversion, compression strategies, stateful models with KV-cache, multi-function models (LoRA adapters), MLTensor pipeline stitching, async concurrent prediction, compute unit selection
- **CoreML API reference** — CoreML Tools Python API, MLModel lifecycle, MLTensor operations, MLComputeDevice availability, state management APIs, performance reports
- **CoreML diagnostics** — load failures, slow inference, memory pressure, accuracy degradation after compression, compute unit problems
- **Speech transcription** — SpeechAnalyzer setup (iOS 26+), SpeechTranscriber configuration, live vs file transcription, volatile vs finalized results, AssetInventory model management

## Related

- [coreml](/skills/machine-learning/coreml) — implementation patterns for model conversion, compression, and deployment
- [coreml-ref](/reference/coreml-ref) — comprehensive CoreML API reference with method signatures
- [coreml-diag](/diagnostic/coreml-diag) — troubleshooting when models fail to load, predict slowly, or lose accuracy after compression
- [speech](/skills/machine-learning/speech) — SpeechAnalyzer and SpeechTranscriber patterns for live and file transcription
- [foundation-models](/skills/integration/foundation-models) — use Apple's built-in on-device LLM instead of a custom model when the task fits
- [foundation-models-adapters](/skills/integration/foundation-models-adapters) — train a custom adapter on Apple's base model instead of deploying a separate CoreML LLM

## Resources

**WWDC**: 2023-10047, 2023-10049, 2024-10159, 2024-10161, 2025-256

**Docs**: /coreml, /coreml/mlmodel, /coreml/mltensor, /speech, /speech/speechanalyzer
