---
name: coreml-diag
description: CoreML diagnostics - model load failures, slow inference, memory issues, compression accuracy loss, compute unit problems, conversion errors.
version: 1.0.0
---

# CoreML Diagnostics

## Quick Reference

| Symptom | First Check | Pattern |
|---------|-------------|---------|
| Model won't load | Deployment target | 1a-1c |
| Slow first load | Cache miss | 2a |
| Slow inference | Compute units | 2b-2c |
| High memory | Concurrent predictions | 3a-3b |
| Bad accuracy after compression | Granularity | 4a-4c |
| Conversion fails | Operation support | 5a-5b |

## Decision Tree

```
CoreML issue
├─ Load failure?
│   ├─ "Unsupported model version" → 1a
│   ├─ "Failed to create compute plan" → 1b
│   └─ Other load error → 1c
├─ Performance issue?
│   ├─ First load slow, subsequent fast? → 2a
│   ├─ All predictions slow? → 2b
│   └─ Slow only on specific device? → 2c
├─ Memory issue?
│   ├─ Memory grows during predictions? → 3a
│   └─ Out of memory on load? → 3b
├─ Accuracy degraded?
│   ├─ After palettization? → 4a
│   ├─ After quantization? → 4b
│   └─ After pruning? → 4c
└─ Conversion issue?
    ├─ Operation not supported? → 5a
    └─ Wrong output? → 5b
```

---

## Pattern 1a - "Unsupported model version"

**Symptom**: Model fails to load with version error.

**Cause**: Model compiled for newer OS than device supports.

**Diagnosis**:
```python
# Check model's minimum deployment target
import coremltools as ct
model = ct.models.MLModel("Model.mlpackage")
print(model.get_spec().specificationVersion)
```

| Spec Version | Minimum iOS |
|--------------|-------------|
| 4 | iOS 13 |
| 5 | iOS 14 |
| 6 | iOS 15 |
| 7 | iOS 16 |
| 8 | iOS 17 |
| 9 | iOS 18 |

**Fix**: Re-convert with lower deployment target:
```python
mlmodel = ct.convert(
    traced,
    minimum_deployment_target=ct.target.iOS16  # Lower target
)
```

**Tradeoff**: Loses newer optimizations (SDPA fusion, per-block quantization, MLTensor).

---

## Pattern 1b - "Failed to create compute plan"

**Symptom**: Model loads on some devices but not others.

**Cause**: Unsupported operations for target compute unit.

**Diagnosis**:
1. Open model in Xcode
2. Create Performance Report
3. Check "Unsupported" operations
4. Hover for hints

**Fix**:
```swift
// Force CPU-only to bypass unsupported GPU/NE operations
let config = MLModelConfiguration()
config.computeUnits = .cpuOnly
let model = try MLModel(contentsOf: url, configuration: config)
```

**Better fix**: Update model precision or operations during conversion:
```python
# Float16 often better supported
mlmodel = ct.convert(traced, compute_precision=ct.precision.FLOAT16)
```

---

## Pattern 1c - General Load Failures

**Symptom**: Model fails to load with unclear error.

**Checklist**:
1. Check file exists and is readable
2. Check compiled vs source model (runtime needs `.mlmodelc`)
3. Check available disk space (cache needs room)
4. Check model isn't corrupted (re-convert)

```swift
// Debug logging
let config = MLModelConfiguration()
config.parameters = [.reporter: { print($0) }]  // iOS 17+
```

---

## Pattern 2a - Slow First Load (Cache Miss)

**Symptom**: First prediction after install/update is slow, subsequent are fast.

**Cause**: Device specialization not cached.

**Diagnosis**:
1. Profile with Core ML Instrument
2. Look at Load event label:
   - "prepare and cache" = cache miss (slow)
   - "cached" = cache hit (fast)

**Why cache misses**:
- First launch after install
- System update invalidated cache
- Low disk space cleared cache
- Model file was modified

**Mitigation**:
```swift
// Warm cache in background at app launch
Task.detached(priority: .background) {
    _ = try? await MLModel.load(contentsOf: modelURL)
}
```

**Note**: Cache is tied to (model path + configuration + device). Different configs = different cache entries.

---

## Pattern 2b - All Predictions Slow

**Symptom**: Predictions consistently slow, not just first one.

**Diagnosis**:
1. Create Xcode Performance Report
2. Check compute unit distribution
3. Look for high-cost operations

**Common causes**:

| Cause | Fix |
|-------|-----|
| Running on CPU when GPU/NE available | Check `computeUnits` config |
| Model too large for Neural Engine | Compress model |
| Frequent CPU↔GPU↔NE transfers | Adjust segmentation |
| Dynamic shapes recompiling | Use fixed/enumerated shapes |

**Profile compute unit usage**:
```swift
let plan = try await MLComputePlan.load(contentsOf: modelURL)
for op in plan.modelStructure.operations {
    let info = plan.computeDeviceInfo(for: op)
    print("\(op.name): \(info.preferredDevice)")
}
```

---

## Pattern 2c - Slow on Specific Device

**Symptom**: Fast on Mac, slow on iPhone (or vice versa).

**Cause**: Different hardware characteristics.

**Diagnosis**:
```swift
// Check available compute
let devices = MLModel.availableComputeDevices
print(devices)  // Different per device
```

**Common issues**:

| Scenario | Cause | Fix |
|----------|-------|-----|
| Fast on M-series Mac, slow on iPhone | Model optimized for GPU | Use palettization (Neural Engine) |
| Fast on iPhone, slow on Intel Mac | No Neural Engine | Use quantization (GPU) |
| Slow on older devices | Less compute power | Use more aggressive compression |

**Recommendation**: Profile on target devices, not just development Mac.

---

## Pattern 3a - Memory Grows During Predictions

**Symptom**: Memory increases with each prediction, doesn't release.

**Cause**: Input/output buffers accumulating from concurrent predictions.

**Diagnosis**:
```
Instruments → Allocations + Core ML template
Look for: Many concurrent prediction intervals
Check: MLMultiArray allocations growing
```

**Fix**: Limit concurrent predictions:
```swift
actor PredictionLimiter {
    private let maxConcurrent = 2
    private var inFlight = 0

    func predict(_ model: MLModel, input: MLFeatureProvider) async throws -> MLFeatureProvider {
        while inFlight >= maxConcurrent {
            await Task.yield()
        }
        inFlight += 1
        defer { inFlight -= 1 }
        return try await model.prediction(from: input)
    }
}
```

---

## Pattern 3b - Out of Memory on Load

**Symptom**: App crashes or model fails to load on memory-constrained devices.

**Cause**: Model too large for device memory.

**Diagnosis**:
```bash
# Check model size
ls -lh Model.mlpackage/Data/com.apple.CoreML/weights/
```

**Fix options**:

| Approach | Compression | Memory Impact |
|----------|-------------|---------------|
| 8-bit palettization | 2x smaller | 2x less memory |
| 4-bit palettization | 4x smaller | 4x less memory |
| Pruning (50%) | ~2x smaller | ~2x less memory |

**Note**: Compressed weights are decompressed just-in-time (iOS 17+), so smaller on-disk = smaller in memory.

---

## Pattern 4a - Bad Accuracy After Palettization

**Symptom**: Model output degraded after palettization.

**Diagnosis**:
1. What bit depth? (2-bit most likely to fail)
2. What granularity? (per-tensor loses more than per-grouped-channel)

**Fix progression**:

```python
# Step 1: Try grouped channels (iOS 18+)
config = OpPalettizerConfig(
    nbits=4,
    granularity="per_grouped_channel",
    group_size=16
)

# Step 2: If still bad, try more bits
config = OpPalettizerConfig(nbits=6, ...)

# Step 3: If still need 4-bit, use calibration
from coremltools.optimize.torch.palettization import DKMPalettizer
# ... training-time compression
```

**Key insight**: 4-bit per-tensor has only 16 clusters for entire weight matrix. Grouped channels = 16 clusters per 16 channels = much better granularity.

---

## Pattern 4b - Bad Accuracy After Quantization

**Symptom**: Model output degraded after INT8/INT4 quantization.

**Diagnosis**:
1. What bit depth?
2. What granularity?

**Fix progression**:

```python
# Step 1: Use per-block (iOS 18+)
config = OpLinearQuantizerConfig(
    dtype="int4",
    granularity="per_block",
    block_size=32
)

# Step 2: Use calibration data
from coremltools.optimize.torch.quantization import LayerwiseCompressor
compressor = LayerwiseCompressor(model, config)
quantized = compressor.compress(calibration_loader)
```

**Note**: INT4 quantization works best on Mac GPU. For Neural Engine, prefer palettization.

---

## Pattern 4c - Bad Accuracy After Pruning

**Symptom**: Model output degraded after weight pruning.

**Diagnosis**:
1. What sparsity level?
2. Post-training or training-time?

**Thresholds** (model-dependent):
- 0-30% sparsity: Usually safe
- 30-50% sparsity: May need calibration
- 50%+ sparsity: Usually needs training-time

**Fix**:
```python
# Use calibration-based pruning
from coremltools.optimize.torch.pruning import LayerwiseCompressor

config = MagnitudePrunerConfig(
    target_sparsity=0.4,
    n_samples=128
)
compressor = LayerwiseCompressor(model, config)
sparse = compressor.compress(calibration_loader)
```

---

## Pattern 5a - Operation Not Supported

**Symptom**: Conversion fails with unsupported operation error.

**Diagnosis**:
```
Error: "Op 'custom_op' is not supported for conversion"
```

**Options**:

1. **Check if op is in coremltools**: May need newer version
```bash
pip install --upgrade coremltools
```

2. **Use composite ops**: Split into supported primitives
```python
# Instead of custom_op(x)
# Use: supported_op1(supported_op2(x))
```

3. **Register custom op**: Advanced, requires MIL programming
```python
from coremltools.converters.mil import Builder as mb

@mb.register_torch_op
def custom_op(context, node):
    # Map to MIL operations
    ...
```

---

## Pattern 5b - Conversion Succeeds but Wrong Output

**Symptom**: Model converts but predictions differ from PyTorch.

**Diagnosis checklist**:

1. **Input normalization**: Ensure preprocessing matches
```python
# PyTorch often uses ImageNet normalization
# CoreML may need explicit preprocessing
```

2. **Shape ordering**: PyTorch (NCHW) vs CoreML (NHWC for some ops)
```python
# Check shapes in conversion
ct.convert(..., inputs=[ct.ImageType(shape=(1, 3, 224, 224))])
```

3. **Precision differences**: Float16 may differ from Float32
```python
# Force Float32 to match PyTorch
ct.convert(..., compute_precision=ct.precision.FLOAT32)
```

4. **Random ops**: Dropout, random initialization differ
```python
# Ensure eval mode
model.eval()
```

**Debug**:
```python
# Compare outputs layer by layer
import numpy as np

torch_output = model(input).detach().numpy()
coreml_output = mlmodel.predict({"input": input.numpy()})["output"]

print(f"Max diff: {np.max(np.abs(torch_output - coreml_output))}")
```

---

## Pressure Scenario - "Model works on simulator but not device"

**Wrong approach**: Assume simulator bug, ignore.

**Right approach**:
1. Check model spec version vs device iOS version (Pattern 1a)
2. Check compute unit availability (Pattern 2c)
3. Profile on actual device, not simulator
4. Simulator uses host Mac's GPU/CPU, not device Neural Engine

---

## Pressure Scenario - "Ship now, optimize later"

**Wrong approach**: Compress to smallest possible size without testing.

**Right approach**:
1. Ship Float16 baseline first
2. Profile on target devices
3. Apply compression incrementally with accuracy testing
4. Document compression settings for future optimization

---

## Diagnostic Checklist

When CoreML isn't working:

- [ ] Check deployment target matches device iOS
- [ ] Check model file is compiled (.mlmodelc)
- [ ] Profile load: cached vs uncached
- [ ] Profile prediction: which compute units
- [ ] Check memory: concurrent predictions limited
- [ ] For compression issues: try higher granularity
- [ ] For conversion issues: check op support, precision

## Resources

**WWDC**: 2023-10047, 2023-10049, 2024-10159, 2024-10161

**Docs**: /coreml, /coreml/mlmodel

**Skills**: coreml, coreml-ref
