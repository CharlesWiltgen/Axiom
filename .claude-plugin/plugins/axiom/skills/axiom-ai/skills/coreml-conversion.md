# Core ML Conversion (coremltools)

Converting an **already-trained** PyTorch / TensorFlow / Keras model into Core ML format with the Python `coremltools` package. This is the bridge step between "I have a trained model" and "I can run it on device" — it does not train, compress (see `coreml-compression.md`), or update (see `coreml-training.md`) anything.

## When to Use

- You have a `.pt` / TorchScript / `torch.export` PyTorch model, or a TensorFlow/Keras SavedModel, and need a `.mlpackage` to ship.
- A conversion "succeeded" but the Core ML model's outputs don't match the source.
- You hit `coremltools` import or op-support errors and need to know whether it's a version mismatch or an unsupported layer.

## Boundary: conversion vs everything adjacent

| Intent | Go to |
|--------|-------|
| Convert a trained PyTorch/TF model to Core ML | This page |
| Shrink the converted model (quantize / palettize / prune) | `coreml-compression.md` |
| Train a new model from scratch | `coreml-training.md` (Create ML) |
| Personalize a deployed model on-device | `coreml-training.md` (`MLUpdateTask`) |
| Fine-tune Apple's on-device LLM | `foundation-models-adapters.md` |
| Deploy / run the converted model | `skills/ios-ml.md` |

**Rule of thumb**: `coremltools` converts a model you already trained elsewhere. If you're producing the weights, that's training, not conversion.

## The unified converter

One entry point: **`coremltools.convert(model, ...)`**. The conversion target is decided by `convert_to` / `minimum_deployment_target`:

- **`.mlpackage` (ML Program)** — the modern format and the **default**. Use this for anything new.
- **`.mlmodel` (NeuralNetwork)** — legacy NN-spec. Only relevant if you specifically need NN-spec (e.g. you intend on-device personalization via `MLUpdateTask`, which is NN-spec-only — see `coreml-training.md`).

```python
import coremltools as ct

mlmodel = ct.convert(
    traced_model,                              # source model (see capture modes below)
    convert_to="mlprogram",                    # default; "neuralnetwork" only for NN-spec needs
    minimum_deployment_target=ct.target.iOS26, # pin to the OS you actually ship
    compute_precision=ct.precision.FLOAT16,    # FP16 is the default; set FLOAT32 only if accuracy demands
    inputs=[ct.TensorType(name="x", shape=(1, 3, 224, 224))],
)
mlmodel.save("Model.mlpackage")
```

### Supported source formats

| Source | Status |
|--------|--------|
| PyTorch | TorchScript (`torch.jit.trace`) — **stable, recommended for production**; `torch.export` (ExportedProgram) — beta, added in coremltools 8 |
| TensorFlow 1.x / 2.x | Supported (frozen graph, SavedModel, concrete functions) |
| Keras | Supported via the TensorFlow path (`tf.keras.Model`, `.h5`) |
| ONNX | **Removed.** `onnx-coreml` is frozen and unmaintained. Convert ONNX → PyTorch or TF first. |
| JAX | **Not a direct source.** Route JAX → TF (`jax2tf`) → Core ML. |

### PyTorch capture: trace vs export

- **`torch.jit.trace`** — the stable, well-supported path. Traces one forward pass, so control flow that depends on input values won't be captured. This is still the right default for production conversions.
- **`torch.export.export`** — newer (coremltools 8+), still maturing/beta. Preferred long-term, but verify parity carefully before relying on it.

Either way, pass concrete `inputs` (`ct.TensorType` / `ct.ImageType`); for variable sizes use `ct.RangeDim` or `ct.EnumeratedShapes`.

## Always validate parity

Conversion can succeed and still produce a subtly different model. Before you trust it, run the **same representative inputs** through the source model and the Core ML model and compare outputs (max abs/relative error, and — for classifiers — top-k agreement). Do this on a real input distribution, not random noise.

## Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Converts fine, outputs diverge | Precision drop or an op mapped imperfectly | Compare layer-level outputs; try `compute_precision=FLOAT32` to isolate precision vs op-mapping |
| `coremltools` import errors (e.g. `libmilstoragepython`) | Version mismatch between `coremltools` and the source framework | Match versions — coremltools 9.0 expects current PyTorch (2.7) / TF; pin in a clean venv |
| "Op not supported" during convert | Source graph uses an op with no MIL lowering | Refactor the model to supported ops, or supply a custom op; check the coremltools op-support list |
| Tracing warns about control flow | `torch.jit.trace` can't capture data-dependent branches | Use `torch.export`, or script the dynamic submodule |

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Conversion succeeded, so the model is correct" | A successful convert only means the graph lowered. Outputs can still diverge — validate parity on representative inputs before shipping. |
| "I'll just convert my ONNX model directly" | The ONNX path is removed. Go ONNX → PyTorch/TF first; don't waste time on `onnx-coreml`. |
| "FP32 to be safe" | FP16 is the default and usually fine on Apple silicon; FP32 doubles size and memory. Measure accuracy before defaulting to FP32. |
| "I'll target the latest OS so I get all the features" | `minimum_deployment_target` gates your install base. Pin it to what you actually ship, not the newest SDK. |
| "Trace and export are interchangeable" | Trace is stable; `torch.export` is still beta in coremltools. For production, trace unless you've verified export parity. |

## Resources

**WWDC**: 2024-10159

**Docs**: /coreml (runtime side); coremltools 9.0 guide at apple.github.io/coremltools (Unified Conversion API, `convert-pytorch-workflow`)

**Skills**: coreml-compression (shrink the converted model), coreml-training (Create ML / `MLUpdateTask`), `skills/ios-ml.md` (deploy + run), axiom-ai (Foundation Models), axiom-apple-docs
