# CoreML API Reference

Comprehensive API reference for CoreML model integration, MLTensor operations, coremltools conversion, and state management.

## Overview

This reference covers the complete CoreML API surface for on-device machine learning:
- **MLModel** - Model loading, prediction, lifecycle
- **MLTensor** - Pipeline stitching between models (iOS 18+)
- **coremltools** - Python package for conversion and compression
- **State management** - KV-cache for LLM inference
- **MLComputeDevice** - Runtime compute availability

## When to Use This Reference

Use when you need:
- ☑ API details for MLModel, MLTensor, or coremltools
- ☑ State management patterns for LLMs
- ☑ Compute device availability checking
- ☑ Model conversion and compression APIs
- ☑ Performance profiling APIs

## Example Prompts

- "What are the MLModelConfiguration options?"
- "How do I use MLTensor for post-processing?"
- "What's the API for checking Neural Engine availability?"
- "How do I create an MLComputePlan?"
- "What compression APIs does coremltools provide?"

## Documentation Scope

This reference documents the `coreml-ref` skill. Use it when you need precise API signatures and configuration options.

- For implementation patterns and decision trees, see [CoreML skill](/skills/machine-learning/coreml)
- For troubleshooting model issues, see [CoreML Diagnostics](/diagnostic/coreml-diag)

## Key APIs

### MLModel Loading

```swift
// Async load (preferred)
let model = try await MLModel.load(contentsOf: url)

// With configuration
let config = MLModelConfiguration()
config.computeUnits = .all
let model = try await MLModel.load(contentsOf: url, configuration: config)
```

### MLTensor Operations (iOS 18+)

```swift
let tensor = MLTensor([[1.0, 2.0], [3.0, 4.0]])
let result = (tensor * 2.0).softmax()
let array = await result.shapedArray(of: Float.self)
```

### State for KV-Cache

```swift
let state = model.makeState()
let output = try await model.prediction(from: input, using: state)
```

### Compute Availability

```swift
let hasNeuralEngine = MLModel.availableComputeDevices.contains {
    if case .neuralEngine = $0 { return true }
    return false
}
```

## Related

- [CoreML Skill](/skills/machine-learning/coreml) — decision trees and patterns for common workflows
- [CoreML Diagnostics](/diagnostic/coreml-diag) — troubleshooting when things go wrong
- [Foundation Models](/skills/integration/foundation-models) — Apple's built-in LLM when you don't need custom models

### Apple Documentation

- [Core ML](https://developer.apple.com/documentation/coreml)
- [Core ML Tools](https://apple.github.io/coremltools/docs-guides/)
