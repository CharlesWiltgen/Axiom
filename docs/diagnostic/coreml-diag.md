# CoreML Diagnostics

Troubleshooting guide for CoreML model loading, inference, and compression issues.

## Symptoms This Diagnoses

Use when you're experiencing:
- Model fails to load with "unsupported version" or "failed to create compute plan"
- First prediction is slow but subsequent ones are fast
- All predictions are consistently slow
- Memory grows during predictions
- Accuracy drops after compression

## Example Prompts

- "Why won't my CoreML model load?"
- "My model works on simulator but fails on device"
- "Why is my first CoreML prediction slow?"
- "My model accuracy is bad after quantization"
- "How do I check if Neural Engine is being used?"

## Quick Reference

| Symptom | First Check | Pattern |
|---------|-------------|---------|
| Model won't load | Deployment target | 1a |
| Slow first load | Cache miss | 2a |
| Slow inference | Compute units | 2b |
| High memory | Concurrent predictions | 3a |
| Bad accuracy after compression | Granularity | 4a |

## Decision Tree

```
CoreML issue
├─ Load failure?
│   ├─ "Unsupported model version" → Check deployment target
│   └─ "Failed to create compute plan" → Check op support
├─ Performance issue?
│   ├─ First load slow? → Cache miss (normal)
│   └─ All predictions slow? → Profile compute units
├─ Memory issue?
│   └─ Growing during predictions? → Limit concurrency
└─ Accuracy degraded?
    └─ After compression? → Try higher granularity
```

## Common Issues

### Model Won't Load

**Cause**: Model compiled for newer OS than device supports.

**Fix**: Re-convert with lower deployment target:
```python
mlmodel = ct.convert(
    traced,
    minimum_deployment_target=ct.target.iOS16
)
```

### Slow First Load

**Cause**: Device specialization not cached (normal for first launch).

**Mitigation**: Warm cache in background at app launch:
```swift
Task.detached(priority: .background) {
    _ = try? await MLModel.load(contentsOf: modelURL)
}
```

### Bad Accuracy After Compression

**Cause**: Too aggressive compression or wrong granularity.

**Fix**: Try per-grouped-channel palettization (iOS 18+):
```python
config = OpPalettizerConfig(
    nbits=4,
    granularity="per_grouped_channel",
    group_size=16
)
```

## Related

- [CoreML Skill](/skills/machine-learning/coreml) — implementation patterns once you've diagnosed the issue
- [CoreML API Reference](/reference/coreml-ref) — API details for the fixes suggested here

### Apple Documentation

- [Core ML](https://developer.apple.com/documentation/coreml)
