# ML Training Paths — Which One Applies

"Train," "fine-tune," and "personalize" get used interchangeably, but on Apple platforms they map to six distinct toolchains — each with a different output file, runtime, and maintenance contract. Picking the wrong one routinely wastes weeks, most often by building an MLX or `.mlpackage` pipeline whose output turns out not to be loadable where you need it. This page helps you pick the right path before you build.

## When to Use

Use this when:
- You are about to start a training, fine-tuning, or personalization pipeline and want to confirm its output will load on your target.
- You are unsure how Foundation Models adapters, Create ML, `MLUpdateTask`, coremltools conversion, and MLX relate.
- A trained artifact will not load and you suspect a format or toolchain mismatch.

## Example Prompts

- "What's the difference between training a Foundation Models adapter, fine-tuning with MLX, and personalizing with `MLUpdateTask`?"
- "I fine-tuned a model with MLX — how do I load it into Foundation Models?"
- "Can I personalize my `.mlpackage` on device?"
- "Which training path ships to iPhone, and which are Mac-only?"

## The Six Paths

| Path | What it produces | Use when |
|------|------------------|----------|
| FM custom adapter | `.fmadapter` for Apple's on-device LLM | App-specific LLM behavior, after simpler approaches fail |
| Core ML personalization (`MLUpdateTask`) | Updated `.mlmodelc` | Per-user tuning of an existing NN-spec (not `.mlpackage`) model, on device |
| Create ML | A new `.mlmodel` | Training a task model from scratch |
| coremltools convert | `.mlpackage` | Bringing an already-trained PyTorch/TF model to Apple platforms |
| MLX LM | `adapters.safetensors` (Mac-only, not an iOS path) | Research and on-Mac experimentation |
| Server LLM fine-tune | A cloud artifact | Vendor cloud-model customization |

## The Traps That Cost Weeks

- **MLX output is not a Foundation Models adapter** – `mlx_lm.lora` emits `adapters.safetensors`; the on-device LLM loads only `.fmadapter`. Different toolchains — MLX cannot feed `SystemLanguageModel(adapter:)`.
- **`MLUpdateTask` is NN-spec only** – it does not apply to ML Program (`.mlpackage`) models, which is what modern conversion produces. Decide the format before building.
- **FM adapters pin to one base-model version** – they must be retrained and re-shipped each OS minor that changes the base model; Core ML, Create ML, and MLX models carry no such pin.

The skill walks each path end to end, with a decision tree and the full trap list.

## Related

- [CoreML](/skills/machine-learning/coreml) – the toolchain behind the Create ML, `MLUpdateTask`, and coremltools-conversion paths
- [Foundation Models](/skills/integration/foundation-models) – start here for on-device LLM work; adapter training is the last resort
- [Foundation Models Adapters](/skills/integration/foundation-models-adapters) – the how-to for the `.fmadapter` path
- [iOS ML deployment overview](/skills/machine-learning/ios-ml) – where each artifact actually runs on device
