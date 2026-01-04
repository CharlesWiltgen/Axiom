# CoreML On-Device Machine Learning

Deploy custom machine learning models on Apple devices with CoreML. Covers model conversion, compression, stateful models for LLMs, and performance optimization.

## Overview

CoreML enables on-device machine learning inference across all Apple platforms:
- **Model conversion** - PyTorch/TensorFlow to CoreML format
- **Model compression** - Quantization, palettization, pruning for smaller models
- **Stateful models** - KV-cache for efficient LLM inference
- **Multi-function models** - Multiple LoRA adapters in one model
- **MLTensor** - Pipeline stitching between models (iOS 18+)
- **Async prediction** - Thread-safe concurrent inference

## When to Use This Skill

Use when you need to:
- ☑ Convert PyTorch or TensorFlow models to CoreML
- ☑ Compress models to fit on device (quantization, palettization)
- ☑ Deploy large language models with KV-cache
- ☑ Optimize inference performance
- ☑ Choose between CoreML and Foundation Models (ios-ai)
- ☑ Profile and debug CoreML models

## Example Prompts

- "How do I convert my PyTorch model to CoreML?"
- "My model is 5GB, how do I compress it for iPhone?"
- "Should I use CoreML or Foundation Models for text generation?"
- "How do I implement KV-cache for my LLM?"
- "Why is my CoreML inference slow?"

## Key Decision Trees

### CoreML vs Foundation Models

```
Need on-device ML?
├─ Text generation (LLM)?
│   ├─ Simple prompts, structured output? → Foundation Models
│   └─ Custom model, fine-tuned? → CoreML
├─ Custom trained model?
│   └─ Yes → CoreML
└─ Image/audio/sensor processing?
    └─ Yes → CoreML
```

### Compression Strategy

```
Model too large?
├─ Try 8-bit palettization first
│   ├─ Accuracy OK? → Ship it
│   └─ Too large still? ↓
├─ Try 6-bit palettization
│   ├─ Accuracy OK? → Ship it
│   └─ Too large still? ↓
├─ Try 4-bit with per-grouped-channel (iOS 18+)
│   ├─ Accuracy OK? → Ship it
│   └─ Accuracy degraded? ↓
└─ Use training-time compression
```

## Common Use Cases

### Basic Model Conversion

```python
import coremltools as ct
import torch

model.eval()
traced = torch.jit.trace(model, example_input)

mlmodel = ct.convert(
    traced,
    inputs=[ct.TensorType(shape=example_input.shape)],
    minimum_deployment_target=ct.target.iOS18
)

mlmodel.save("Model.mlpackage")
```

### Model Compression (4-bit)

```python
from coremltools.optimize.coreml import (
    OpPalettizerConfig,
    OptimizationConfig,
    palettize_weights
)

config = OpPalettizerConfig(
    mode="kmeans",
    nbits=4,
    granularity="per_grouped_channel",
    group_size=16
)

opt_config = OptimizationConfig(global_config=config)
compressed = palettize_weights(model, opt_config)
```

### Async Prediction

```swift
// Thread-safe concurrent predictions
let output = try await model.prediction(from: input)
```

## Common Pitfalls

- ❌ Loading models on main thread (blocks UI)
- ❌ Reloading model for each prediction (expensive)
- ❌ Compressing without profiling first
- ❌ Ignoring deployment target (misses optimizations)
- ❌ Not checking compute device availability

## Platform Support

| Feature | Minimum Version |
|---------|-----------------|
| Basic CoreML | iOS 11+ |
| MLProgram models | iOS 15+ |
| Async prediction | iOS 17+ |
| MLTensor | iOS 18+ |
| State (KV-cache) | iOS 18+ |
| Multi-function models | iOS 18+ |
| Per-block quantization | iOS 18+ |

## Related

- [CoreML API Reference](/reference/coreml-ref) — detailed API docs when you need exact method signatures or parameter options
- [CoreML Diagnostics](/diagnostic/coreml-diag) — troubleshooting when models fail to load, predictions are wrong, or performance is poor
- [Foundation Models](/skills/integration/foundation-models) — use instead when you need Apple's built-in LLM rather than custom models

### WWDC Sessions

- [WWDC24-10161: Deploy ML models on-device with Core ML](https://developer.apple.com/videos/play/wwdc2024/10161/)
- [WWDC24-10159: Bring your models to Apple silicon](https://developer.apple.com/videos/play/wwdc2024/10159/)
- [WWDC23-10049: Improve Core ML integration with async prediction](https://developer.apple.com/videos/play/wwdc2023/10049/)
- [WWDC23-10047: Use Core ML Tools for model compression](https://developer.apple.com/videos/play/wwdc2023/10047/)

### Apple Documentation

- [Core ML](https://developer.apple.com/documentation/coreml)
- [Core ML Tools](https://apple.github.io/coremltools/docs-guides/)
