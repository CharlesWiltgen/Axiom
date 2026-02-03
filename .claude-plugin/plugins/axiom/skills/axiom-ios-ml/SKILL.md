---
name: axiom-ios-ml
description: Use when deploying ANY machine learning model on-device, converting models to CoreML, compressing models, or implementing speech-to-text. Covers CoreML conversion, MLTensor, model compression (quantization/palettization/pruning), stateful models, KV-cache, multi-function models, async prediction, SpeechAnalyzer, SpeechTranscriber.
license: MIT
---

# iOS Machine Learning Router

**You MUST use this skill for ANY on-device machine learning or speech-to-text work.**

## When to Use

Use this router when:
- Converting PyTorch/TensorFlow models to CoreML
- Deploying ML models on-device
- Compressing models (quantization, palettization, pruning)
- Working with large language models (LLMs)
- Implementing KV-cache for transformers
- Using MLTensor for model stitching
- Building speech-to-text features
- Transcribing audio (live or recorded)

## Routing Logic

### CoreML Work

**Implementation patterns** → `/skill coreml`
- Model conversion workflow
- MLTensor for model stitching
- Stateful models with KV-cache
- Multi-function models (adapters/LoRA)
- Async prediction patterns
- Compute unit selection

**API reference** → `/skill coreml-ref`
- CoreML Tools Python API
- MLModel lifecycle
- MLTensor operations
- MLComputeDevice availability
- State management APIs
- Performance reports

**Diagnostics** → `/skill coreml-diag`
- Model won't load
- Slow inference
- Memory issues
- Compression accuracy loss
- Compute unit problems

### Speech Work

**Implementation patterns** → `/skill speech`
- SpeechAnalyzer setup (iOS 26+)
- SpeechTranscriber configuration
- Live transcription
- File transcription
- Volatile vs finalized results
- Model asset management

## Decision Tree

1. Implementing / converting ML models? → coreml
2. CoreML API reference? → coreml-ref
3. Debugging ML issues (load, inference, compression)? → coreml-diag
4. Speech-to-text / transcription? → speech

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "CoreML is just load and predict" | CoreML has compression, stateful models, compute unit selection, and async prediction. coreml covers all. |
| "My model is small, no optimization needed" | Even small models benefit from compute unit selection and async prediction. coreml has the patterns. |
| "I'll just use SFSpeechRecognizer" | iOS 26 has SpeechAnalyzer with better accuracy and offline support. speech skill covers the modern API. |

## Critical Patterns

**coreml**:
- Model conversion (PyTorch → CoreML)
- Compression (palettization, quantization, pruning)
- Stateful KV-cache for LLMs
- Multi-function models for adapters
- MLTensor for pipeline stitching
- Async concurrent prediction

**coreml-diag**:
- Load failures and caching
- Inference performance issues
- Memory pressure from models
- Accuracy degradation from compression

**speech**:
- SpeechAnalyzer + SpeechTranscriber setup
- AssetInventory model management
- Live transcription with volatile results
- Audio format conversion

## Example Invocations

User: "How do I convert a PyTorch model to CoreML?"
→ Invoke: `/skill coreml`

User: "Compress my model to fit on iPhone"
→ Invoke: `/skill coreml`

User: "Implement KV-cache for my language model"
→ Invoke: `/skill coreml`

User: "Model loads slowly on first launch"
→ Invoke: `/skill coreml-diag`

User: "My compressed model has bad accuracy"
→ Invoke: `/skill coreml-diag`

User: "Add live transcription to my app"
→ Invoke: `/skill speech`

User: "Transcribe audio files with SpeechAnalyzer"
→ Invoke: `/skill speech`

User: "What's MLTensor and how do I use it?"
→ Invoke: `/skill coreml-ref`
