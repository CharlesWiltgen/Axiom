---
name: core-ai
description: Core AI (iOS 27) — the on-device inference framework that powers Apple Intelligence, now open to your apps. Convert PyTorch models to .aimodel, run them from Swift, manage specialization and caching, and back a LanguageModelSession with your own model.
---

# Core AI

Core AI (iOS 27) is the on-device inference framework that powers Apple Intelligence — now open to your apps. It is the modern path for running your **own** advanced models (large language models, vision transformers like SAM 3) locally across CPU, GPU, and Neural Engine, with no server and no per-token cost. It spans a Python conversion/optimization toolchain, a `.aimodel` format, a memory-safe Swift runtime, and developer tools (ahead-of-time compilation, Core AI Instruments, the Core AI Debugger).

This skill is part of the [axiom-ai](/skills/) suite. For Apple's *built-in* LLM (no model to ship), see [Foundation Models](/skills/integration/foundation-models). For classic Core ML models, see [iOS ML](/skills/machine-learning/ios-ml).

## When to Use

Use this skill when you're:

- Bringing a PyTorch LLM, segmentation model, or custom transformer on-device via Core AI (the 27-cycle path)
- Loading and running a `.aimodel` from Swift (`AIModel`, `InferenceFunction`, `NDArray`)
- Fixing a transformer decode loop that slows down over time (KV-cache via Core AI **states**)
- Diagnosing first-launch stalls caused by model **specialization**, or planning model download and caching
- Backing a Foundation Models `LanguageModelSession` with your own custom model

## Core AI vs Core ML vs Foundation Models

| What you're doing | Skill |
|---|---|
| Run Apple's built-in LLM (`@Generable`, no model to ship) | [Foundation Models](/skills/integration/foundation-models) |
| Bring an LLM-scale / transformer model on-device (27-cycle) | This skill (Core AI) |
| Convert/compress a classic Core ML model (`.mlpackage`) | [iOS ML](/skills/machine-learning/ios-ml) |
| Back a `LanguageModelSession` with your own model | This skill (the Foundation Models bridge) |

**Rule of thumb** — Core ML is the established path for classic models; Core AI is the 27-cycle path built for modern/LLM-scale workloads and deep customization (custom Metal kernels, multi-function assets, ahead-of-time compilation). Both convert from PyTorch.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I convert my PyTorch LLM to Core AI and run it from Swift?"
- "My Core AI model freezes the app on first launch — how do I handle specialization?"
- "How do I add a KV-cache to my Core AI transformer so it stops slowing down?"
- "How do I share a specialized model cache between my app and its extension?"
- "How do I back a `LanguageModelSession` with my own model?"
- "Should I bundle my 1 GB model in the app or download it?"
- "What's the difference between Core AI and Core ML?"

## What This Skill Provides

- **The deployment lifecycle** – convert (`coreai-torch`), optimize (`coreai-opt`), debug (Core AI Debugger), integrate (Swift `CoreAI` framework), deploy (specialization, caching, ahead-of-time compilation)
- **The Swift runtime API** – `AIModel`, `InferenceFunction`, `NDArray` and its scalar types, KV-cache states, `AIModelAsset` inspection — all SDK-verified and compile-checked against Xcode 27
- **Specialization & caching discipline** – why first-load is slow, why to keep it out of interactive flows, `AIModelCache` (including app-group sharing), and ahead-of-time compilation with `coreai-build`
- **The Foundation Models bridge** – using `CoreAILanguageModel` (from the open-source `coreai-models` Swift package) to reuse `respond` / `@Generable` / streaming with your own model
- **The developer tools** – Core AI Instruments, the Core AI debug gauge, and the standalone Core AI Debugger

## Related

- [iOS ML](/skills/machine-learning/ios-ml) – classic Core ML conversion, compression, and deployment; the boundary with Core AI
- [foundation-models-ref](/reference/foundation-models-ref) – the `LanguageModel` protocol and Ecosystem section that the Core AI bridge plugs into
- [Metal Migration](/skills/games/metal-migration) – writing the custom Metal kernels (`TorchMetalKernel`, `MTLTensor`) that Core AI embeds in a model
- [Background Assets](/skills/integration/background-assets) – delivering large models on demand instead of bundling them

## Resources

**WWDC**: 2026-324, 2026-325, 2026-326, 2026-330

**Docs**: /CoreAI, /CoreAI/compiling-core-ai-models-ahead-of-time, /CoreAI/managing-model-specialization-and-caching
