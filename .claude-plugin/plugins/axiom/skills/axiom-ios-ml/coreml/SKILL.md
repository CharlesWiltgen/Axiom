---
name: coreml
description: Use when deploying custom ML models on-device, converting PyTorch models, compressing models, implementing LLM inference, or optimizing CoreML performance. Covers model conversion, compression, stateful models, KV-cache, multi-function models, MLTensor.
version: 1.0.0
---

# CoreML On-Device Machine Learning

## Overview

CoreML enables on-device machine learning inference across all Apple platforms. It abstracts hardware details while leveraging Apple Silicon's CPU, GPU, and Neural Engine for high-performance, private, and efficient execution.

**Key principle**: Start with the simplest approach, then optimize based on profiling. Don't over-engineer compression or caching until you have real performance data.

## Decision Tree - CoreML vs Foundation Models

```
Need on-device ML?
  ├─ Text generation (LLM)?
  │   ├─ Simple prompts, structured output? → Foundation Models (ios-ai skill)
  │   └─ Custom model, fine-tuned, specific architecture? → CoreML
  ├─ Custom trained model?
  │   └─ Yes → CoreML
  ├─ Image/audio/sensor processing?
  │   └─ Yes → CoreML
  └─ Apple's built-in intelligence?
      └─ Yes → Foundation Models (ios-ai skill)
```

## Red Flags

Use this skill when you see:
- "Convert PyTorch model to CoreML"
- "Model too large for device"
- "Slow inference performance"
- "LLM on-device"
- "KV-cache" or "stateful model"
- "Model compression" or "quantization"
- MLModel, MLTensor, or coremltools in context

## Pattern 1 - Basic Model Conversion

The standard PyTorch → CoreML workflow.

```python
import coremltools as ct
import torch

# Trace the model
model.eval()
traced_model = torch.jit.trace(model, example_input)

# Convert to CoreML
mlmodel = ct.convert(
    traced_model,
    inputs=[ct.TensorType(shape=example_input.shape)],
    minimum_deployment_target=ct.target.iOS18
)

# Save
mlmodel.save("MyModel.mlpackage")
```

**Critical**: Always set `minimum_deployment_target` to enable latest optimizations.

## Pattern 2 - Model Compression (Post-Training)

Three techniques, each with different tradeoffs:

### Palettization (Best for Neural Engine)

Clusters weights into lookup tables. Use per-grouped-channel for better accuracy.

```python
from coremltools.optimize.coreml import (
    OpPalettizerConfig,
    OptimizationConfig,
    palettize_weights
)

# 4-bit with grouped channels (iOS 18+)
op_config = OpPalettizerConfig(
    mode="kmeans",
    nbits=4,
    granularity="per_grouped_channel",
    group_size=16
)

config = OptimizationConfig(global_config=op_config)
compressed_model = palettize_weights(model, config)
```

| Bits | Compression | Accuracy Impact |
|------|-------------|-----------------|
| 8-bit | 2x | Minimal |
| 6-bit | 2.7x | Low |
| 4-bit | 4x | Moderate (use grouped channels) |
| 2-bit | 8x | High (requires training-time) |

### Quantization (Best for GPU on Mac)

Linear mapping to INT8/INT4. Use per-block for better accuracy.

```python
from coremltools.optimize.coreml import (
    OpLinearQuantizerConfig,
    OptimizationConfig,
    linear_quantize_weights
)

# INT4 per-block quantization (iOS 18+)
op_config = OpLinearQuantizerConfig(
    mode="linear",
    dtype="int4",
    granularity="per_block",
    block_size=32
)

config = OptimizationConfig(global_config=op_config)
compressed_model = linear_quantize_weights(model, config)
```

### Pruning (Combine with other techniques)

Sets weights to zero for sparse representation. Can combine with palettization.

```python
from coremltools.optimize.coreml import (
    OpMagnitudePrunerConfig,
    OptimizationConfig,
    prune_weights
)

op_config = OpMagnitudePrunerConfig(
    target_sparsity=0.4  # 40% zeros
)

config = OptimizationConfig(global_config=op_config)
sparse_model = prune_weights(model, config)
```

## Pattern 3 - Training-Time Compression

When post-training compression loses too much accuracy, fine-tune with compression.

```python
from coremltools.optimize.torch.palettization import (
    DKMPalettizerConfig,
    DKMPalettizer
)

# Configure 4-bit palettization
config = DKMPalettizerConfig(global_config={"n_bits": 4})

# Prepare model
palettizer = DKMPalettizer(model, config)
prepared_model = palettizer.prepare()

# Fine-tune (your training loop)
for epoch in range(num_epochs):
    train_epoch(prepared_model, data_loader)
    palettizer.step()

# Finalize
final_model = palettizer.finalize()
```

**Tradeoff**: Better accuracy than post-training, but requires training data and time.

## Pattern 4 - Calibration-Based Compression (iOS 18+)

Middle ground: uses calibration data without full training.

```python
from coremltools.optimize.torch.pruning import (
    MagnitudePrunerConfig,
    LayerwiseCompressor
)

# Configure
config = MagnitudePrunerConfig(
    target_sparsity=0.4,
    n_samples=128  # Calibration samples
)

# Create pruner
pruner = LayerwiseCompressor(model, config)

# Calibrate
sparse_model = pruner.compress(calibration_data_loader)
```

## Pattern 5 - Stateful Models (KV-Cache for LLMs)

For transformer models, use state to avoid recomputing key/value vectors.

### PyTorch Model with State

```python
class StatefulLLM(nn.Module):
    def __init__(self):
        super().__init__()
        # Register state buffers
        self.register_buffer("keyCache", torch.zeros(batch, heads, seq_len, dim))
        self.register_buffer("valueCache", torch.zeros(batch, heads, seq_len, dim))

    def forward(self, input_ids, causal_mask):
        # Update caches in-place during forward
        # ... attention with KV-cache ...
        return logits
```

### Conversion with State

```python
import coremltools as ct

mlmodel = ct.convert(
    traced_model,
    inputs=[
        ct.TensorType(name="input_ids", shape=(1, ct.RangeDim(1, 2048))),
        ct.TensorType(name="causal_mask", shape=(1, 1, ct.RangeDim(1, 2048), ct.RangeDim(1, 2048)))
    ],
    states=[
        ct.StateType(name="keyCache", ...),
        ct.StateType(name="valueCache", ...)
    ],
    minimum_deployment_target=ct.target.iOS18
)
```

### Using State at Runtime

```swift
// Create state from model
let state = model.makeState()

// Run prediction with state (updated in-place)
let output = try model.prediction(from: input, using: state)
```

**Performance**: 1.6x speedup on Mistral-7B (M3 Max) compared to manual KV-cache I/O.

## Pattern 6 - Multi-Function Models (Adapters/LoRA)

Deploy multiple adapters in a single model, sharing base weights.

```python
from coremltools.models import MultiFunctionDescriptor
from coremltools.models.utils import save_multifunction

# Convert individual models
sticker_model = ct.convert(sticker_adapter_model, ...)
storybook_model = ct.convert(storybook_adapter_model, ...)

# Save individually
sticker_model.save("sticker.mlpackage")
storybook_model.save("storybook.mlpackage")

# Merge with shared weights
desc = MultiFunctionDescriptor()
desc.add_function("sticker", "sticker.mlpackage")
desc.add_function("storybook", "storybook.mlpackage")

save_multifunction(desc, "MultiAdapter.mlpackage")
```

### Loading Specific Function

```swift
let config = MLModelConfiguration()
config.functionName = "sticker"  // or "storybook"

let model = try MLModel(contentsOf: modelURL, configuration: config)
```

## Pattern 7 - MLTensor for Pipeline Stitching (iOS 18+)

Simplifies computation between models (decoding, post-processing).

```swift
import CoreML

// Create tensors
let scores = MLTensor(shape: [1, vocab_size], scalars: logits)

// Operations (executed asynchronously on Apple Silicon)
let topK = scores.topK(k: 10)
let probs = (topK.values / temperature).softmax()

// Sample from distribution
let sampled = probs.multinomial(numSamples: 1)

// Materialize to access data (blocks until complete)
let shapedArray = await sampled.shapedArray(of: Int32.self)
```

**Key insight**: MLTensor operations are async. Call `shapedArray()` to materialize results.

## Pattern 8 - Async Prediction for Concurrency

Thread-safe concurrent predictions for throughput.

```swift
class ImageProcessor {
    let model: MLModel

    func processImages(_ images: [CGImage]) async throws -> [Output] {
        try await withThrowingTaskGroup(of: Output.self) { group in
            for image in images {
                group.addTask {
                    // Check cancellation before expensive work
                    try Task.checkCancellation()

                    let input = try self.prepareInput(image)
                    // Async prediction - thread safe!
                    return try await self.model.prediction(from: input)
                }
            }

            return try await group.reduce(into: []) { $0.append($1) }
        }
    }
}
```

**Warning**: Limit concurrent predictions to avoid memory pressure from multiple input/output buffers.

```swift
// Limit concurrency
let semaphore = AsyncSemaphore(value: 2)

for image in images {
    group.addTask {
        await semaphore.wait()
        defer { semaphore.signal() }
        return try await process(image)
    }
}
```

## Anti-Patterns

### Don't - Load models on main thread at launch

```swift
// BAD - blocks UI
class AppDelegate {
    let model = try! MLModel(contentsOf: url)  // Blocks!
}

// GOOD - lazy async loading
class ModelManager {
    private var model: MLModel?

    func getModel() async throws -> MLModel {
        if let model { return model }
        model = try await Task.detached {
            try MLModel(contentsOf: url)
        }.value
        return model!
    }
}
```

### Don't - Reload model for each prediction

```swift
// BAD - reloads every time
func predict(_ input: Input) throws -> Output {
    let model = try MLModel(contentsOf: url)  // Expensive!
    return try model.prediction(from: input)
}

// GOOD - keep model loaded
class Predictor {
    private let model: MLModel

    func predict(_ input: Input) throws -> Output {
        try model.prediction(from: input)
    }
}
```

### Don't - Compress without profiling first

```swift
// BAD - blind compression
let compressed = palettize_weights(model, 2bit_config)  // May break accuracy!

// GOOD - profile, then compress iteratively
// 1. Profile Float16 baseline
// 2. Try 8-bit → check accuracy
// 3. Try 6-bit → check accuracy
// 4. Try 4-bit with grouped channels → check accuracy
// 5. Only use 2-bit with training-time compression
```

### Don't - Ignore deployment target

```python
# BAD - misses optimizations
mlmodel = ct.convert(traced_model, inputs=[...])

# GOOD - enables SDPA fusion, per-block quantization, etc.
mlmodel = ct.convert(
    traced_model,
    inputs=[...],
    minimum_deployment_target=ct.target.iOS18
)
```

## Pressure Scenarios

### Scenario 1 - "Model is 5GB, need it under 2GB for iPhone"

**Wrong approach**: Jump straight to 2-bit palettization.

**Right approach**:
1. Start with 8-bit palettization → check accuracy
2. Try 6-bit → check accuracy
3. Try 4-bit with `per_grouped_channel` → check accuracy
4. If still too large, use calibration-based compression
5. If still losing accuracy, use training-time compression

### Scenario 2 - "LLM inference is too slow"

**Wrong approach**: Try different compute units randomly.

**Right approach**:
1. Profile with Core ML Instrument
2. Check if load is cached (look for "cached" vs "prepare and cache")
3. Enable stateful KV-cache
4. Check SDPA optimization is enabled (iOS 18+ deployment target)
5. Consider INT4 quantization for GPU on Mac

### Scenario 3 - "Need multiple LoRA adapters in one app"

**Wrong approach**: Ship separate models for each adapter.

**Right approach**:
1. Convert each adapter model separately
2. Use `MultiFunctionDescriptor` to merge with shared base
3. Load specific function via `config.functionName`
4. Weights are deduplicated automatically

## Checklist

Before deploying a CoreML model:

- [ ] Set `minimum_deployment_target` to latest supported iOS
- [ ] Profile baseline Float16 performance
- [ ] Check if model load is cached
- [ ] Consider compression only if size/performance requires it
- [ ] Test accuracy after each compression step
- [ ] Use async prediction for concurrent workloads
- [ ] Limit concurrent predictions to manage memory
- [ ] Use state for transformer KV-cache
- [ ] Use multi-function for adapter variants

## Resources

**WWDC**: 2023-10047, 2023-10049, 2024-10159, 2024-10161

**Docs**: /coreml, /coreml/mlmodel, /coreml/mltensor

**Skills**: coreml-ref, coreml-diag, axiom-ios-ai (Foundation Models)
