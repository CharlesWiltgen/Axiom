---
name: coreml-ref
description: CoreML API reference - MLModel lifecycle, MLTensor operations, coremltools conversion, compression APIs, state management, compute device availability, performance profiling.
version: 1.0.0
---

# CoreML API Reference

## Part 1 - Model Lifecycle

### MLModel Loading

```swift
// Synchronous load (blocks thread)
let model = try MLModel(contentsOf: compiledModelURL)

// Async load (preferred)
let model = try await MLModel.load(contentsOf: compiledModelURL)

// With configuration
let config = MLModelConfiguration()
config.computeUnits = .all  // .cpuOnly, .cpuAndGPU, .cpuAndNeuralEngine
let model = try await MLModel.load(contentsOf: url, configuration: config)
```

### Model Asset Types

| Type | Extension | Purpose |
|------|-----------|---------|
| Source | `.mlmodel`, `.mlpackage` | Development, editing |
| Compiled | `.mlmodelc` | Runtime execution |

**Note**: Xcode compiles source models automatically. At runtime, use compiled models.

### Caching Behavior

First load triggers device specialization (can be slow). Subsequent loads use cache.

```
Load flow:
  ├─ Check cache for (model path + configuration + device)
  │   ├─ Found → Cached load (fast)
  │   └─ Not found → Device specialization
  │       ├─ Parse model
  │       ├─ Optimize operations
  │       ├─ Segment for compute units
  │       ├─ Compile for each unit
  │       └─ Cache result
```

Cache invalidated by: system updates, low disk space, model modification.

### Multi-Function Models

```swift
// Load specific function
let config = MLModelConfiguration()
config.functionName = "sticker"  // Function name from model

let model = try MLModel(contentsOf: url, configuration: config)
```

---

## Part 2 - Compute Availability

### MLComputeDevice (iOS 17+)

```swift
// Check available compute devices
let devices = MLModel.availableComputeDevices

// Check for Neural Engine
let hasNeuralEngine = devices.contains { device in
    if case .neuralEngine = device { return true }
    return false
}

// Check for specific GPU
for device in devices {
    switch device {
    case .cpu:
        print("CPU available")
    case .gpu(let gpu):
        print("GPU: \(gpu.name)")
    case .neuralEngine(let ne):
        print("Neural Engine: \(ne.totalCoreCount) cores")
    @unknown default:
        break
    }
}
```

### MLModelConfiguration.ComputeUnits

| Value | Behavior |
|-------|----------|
| `.all` | Best performance (default) |
| `.cpuOnly` | CPU only |
| `.cpuAndGPU` | Exclude Neural Engine |
| `.cpuAndNeuralEngine` | Exclude GPU |

---

## Part 3 - Prediction APIs

### Synchronous Prediction

```swift
// Single prediction (NOT thread-safe)
let output = try model.prediction(from: input)

// Batch prediction
let outputs = try model.predictions(from: batch)
```

### Async Prediction (iOS 17+)

```swift
// Single prediction (thread-safe, supports concurrency)
let output = try await model.prediction(from: input)

// With cancellation
let output = try await withTaskCancellationHandler {
    try await model.prediction(from: input)
} onCancel: {
    // Prediction will be cancelled
}
```

### State-Based Prediction

```swift
// Create state from model
let state = model.makeState()

// Prediction with state (state updated in-place)
let output = try model.prediction(from: input, using: state)

// Async with state
let output = try await model.prediction(from: input, using: state)
```

---

## Part 4 - MLTensor (iOS 18+)

### Creating Tensors

```swift
import CoreML

// From MLShapedArray
let shapedArray = MLShapedArray<Float>(scalars: [1, 2, 3, 4], shape: [2, 2])
let tensor = MLTensor(shapedArray)

// From nested collections
let tensor = MLTensor([[1.0, 2.0], [3.0, 4.0]])

// Zeros/ones
let zeros = MLTensor(zeros: [3, 3], scalarType: Float.self)
```

### Math Operations

```swift
// Element-wise
let sum = tensor1 + tensor2
let product = tensor1 * tensor2
let scaled = tensor * 2.0

// Reductions
let mean = tensor.mean()
let sum = tensor.sum()
let max = tensor.max()

// Comparison
let mask = tensor .> mean  // Boolean mask

// Softmax
let probs = tensor.softmax()
```

### Indexing and Reshaping

```swift
// Slicing (Python-like syntax)
let row = tensor[0]           // First row
let col = tensor[.all, 0]     // First column
let slice = tensor[0..<2, 1..<3]

// Reshaping
let reshaped = tensor.reshaped(to: [4])
let expanded = tensor.expandingShape(at: 0)
```

### Materialization

**Critical**: Tensor operations are async. Must materialize to access data.

```swift
// Materialize to MLShapedArray (blocks until complete)
let array = await tensor.shapedArray(of: Float.self)

// Access scalars
let values = array.scalars
```

---

## Part 5 - Core ML Tools (Python)

### Basic Conversion

```python
import coremltools as ct
import torch

# Trace PyTorch model
model.eval()
traced = torch.jit.trace(model, example_input)

# Convert
mlmodel = ct.convert(
    traced,
    inputs=[ct.TensorType(shape=example_input.shape)],
    outputs=[ct.TensorType(name="output")],
    minimum_deployment_target=ct.target.iOS18
)

mlmodel.save("Model.mlpackage")
```

### Dynamic Shapes

```python
# Fixed shape
ct.TensorType(shape=(1, 3, 224, 224))

# Range dimension
ct.TensorType(shape=(1, ct.RangeDim(1, 2048)))

# Enumerated shapes
ct.TensorType(shape=ct.EnumeratedShapes(shapes=[(1, 256), (1, 512), (1, 1024)]))
```

### State Types

```python
# For stateful models (KV-cache)
states = [
    ct.StateType(
        name="keyCache",
        wrapped_type=ct.TensorType(shape=(1, 32, 2048, 128))
    ),
    ct.StateType(
        name="valueCache",
        wrapped_type=ct.TensorType(shape=(1, 32, 2048, 128))
    )
]

mlmodel = ct.convert(traced, inputs=inputs, states=states, ...)
```

---

## Part 6 - Compression APIs (coremltools.optimize)

### Post-Training Palettization

```python
from coremltools.optimize.coreml import (
    OpPalettizerConfig,
    OptimizationConfig,
    palettize_weights
)

# Per-tensor (iOS 17+)
config = OpPalettizerConfig(mode="kmeans", nbits=4)

# Per-grouped-channel (iOS 18+, better accuracy)
config = OpPalettizerConfig(
    mode="kmeans",
    nbits=4,
    granularity="per_grouped_channel",
    group_size=16
)

opt_config = OptimizationConfig(global_config=config)
compressed = palettize_weights(model, opt_config)
```

### Post-Training Quantization

```python
from coremltools.optimize.coreml import (
    OpLinearQuantizerConfig,
    OptimizationConfig,
    linear_quantize_weights
)

# INT8 per-channel (iOS 17+)
config = OpLinearQuantizerConfig(mode="linear", dtype="int8")

# INT4 per-block (iOS 18+)
config = OpLinearQuantizerConfig(
    mode="linear",
    dtype="int4",
    granularity="per_block",
    block_size=32
)

opt_config = OptimizationConfig(global_config=config)
compressed = linear_quantize_weights(model, opt_config)
```

### Post-Training Pruning

```python
from coremltools.optimize.coreml import (
    OpMagnitudePrunerConfig,
    OptimizationConfig,
    prune_weights
)

config = OpMagnitudePrunerConfig(target_sparsity=0.5)
opt_config = OptimizationConfig(global_config=config)
sparse = prune_weights(model, opt_config)
```

### Training-Time Palettization (PyTorch)

```python
from coremltools.optimize.torch.palettization import (
    DKMPalettizerConfig,
    DKMPalettizer
)

config = DKMPalettizerConfig(global_config={"n_bits": 4})
palettizer = DKMPalettizer(model, config)

# Prepare (inserts palettization layers)
prepared = palettizer.prepare()

# Training loop
for epoch in range(epochs):
    train_one_epoch(prepared, data_loader)
    palettizer.step()

# Finalize
final = palettizer.finalize()
```

### Calibration-Based Compression

```python
from coremltools.optimize.torch.pruning import (
    MagnitudePrunerConfig,
    LayerwiseCompressor
)

config = MagnitudePrunerConfig(
    target_sparsity=0.4,
    n_samples=128
)

compressor = LayerwiseCompressor(model, config)
compressed = compressor.compress(calibration_loader)
```

---

## Part 7 - Multi-Function Models

### Merging Models

```python
from coremltools.models import MultiFunctionDescriptor
from coremltools.models.utils import save_multifunction

# Create descriptor
desc = MultiFunctionDescriptor()
desc.add_function("function_a", "model_a.mlpackage")
desc.add_function("function_b", "model_b.mlpackage")

# Merge (deduplicates shared weights)
save_multifunction(desc, "merged.mlpackage")
```

### Inspecting Functions (Xcode)

Open model in Xcode → Predictions tab → Functions listed above inputs.

---

## Part 8 - Performance Profiling

### MLComputePlan (iOS 18+)

```swift
let plan = try await MLComputePlan.load(contentsOf: modelURL)

// Inspect operations
for op in plan.modelStructure.operations {
    let info = plan.computeDeviceInfo(for: op)
    print("Op: \(op.name)")
    print("  Preferred: \(info.preferredDevice)")
    print("  Estimated cost: \(info.estimatedCost)")
}
```

### Xcode Performance Reports

1. Open model in Xcode
2. Select Performance tab
3. Click + to create report
4. Select device and compute units
5. Click "Run Test"

**New in iOS 18**: Shows estimated time per operation, compute device support hints.

### Core ML Instrument

```
Instruments → Core ML template
  ├─ Load events: "cached" vs "prepare and cache"
  ├─ Prediction intervals
  ├─ Compute unit usage
  └─ Neural Engine activity
```

---

## Part 9 - Deployment Targets

| Target | Key Features |
|--------|--------------|
| iOS 16 | Weight compression (palettization, quantization, pruning) |
| iOS 17 | Async prediction, MLComputeDevice, activation quantization |
| iOS 18 | MLTensor, State, SDPA fusion, per-block quantization, multi-function |

**Recommendation**: Always set `minimum_deployment_target=ct.target.iOS18` for best optimizations.

---

## Part 10 - Conversion Pass Pipelines

```python
# Default pipeline
mlmodel = ct.convert(traced, ...)

# With palettization support
mlmodel = ct.convert(
    traced,
    pass_pipeline=ct.PassPipeline.DEFAULT_PALETTIZATION,
    ...
)
```

## Resources

**WWDC**: 2023-10047, 2023-10049, 2024-10159, 2024-10161

**Docs**: /coreml, /coreml/mlmodel, /coreml/mltensor, /documentation/coremltools

**Skills**: coreml, coreml-diag
