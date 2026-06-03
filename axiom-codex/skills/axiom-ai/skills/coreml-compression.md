# Core ML Compression (QAT vs PTQ)

Shrinking a custom Core ML model so it fits in memory and runs fast on device — and the one decision that dominates the outcome: **post-training quantization (PTQ)** vs **quantization-aware training (QAT)**. Compression happens after conversion (`coreml-conversion.md`) and before deployment (`skills/ios-ml.md`).

## When to Use

- A converted model is too large or too slow, and you need to quantize / palettize / prune it.
- You compressed a model and accuracy dropped more than you can accept.
- You're deciding whether a cheap post-training pass is enough or whether you have to retrain.

## The core decision: PTQ vs QAT

| | Post-training (PTQ) | Quantization-aware training (QAT) |
|--|---------------------|-----------------------------------|
| **When applied** | After training is done | During training (simulates low precision in the loss) |
| **Cost** | Minutes, no retraining, often data-free | Full retraining loop with QAT-aware optimizers |
| **Accuracy hit** | Larger — worse on small models, low bit-widths, sensitive tasks | Smaller — the model learns weights robust to quantization |
| **coremltools module** | `optimize.coreml` (data-free, on the `.mlpackage`) **or** `optimize.torch` (calibration-based) | `optimize.torch` (hooks into the PyTorch training loop) |

**Decision rubric**:
1. Start with **PTQ** — it's free. Measure accuracy.
2. If PTQ accuracy holds at your target bit-width → ship it. Done.
3. If PTQ degrades too much (common at int4 / sub-4-bit, or on small models) → **calibration-based PTQ** first (uses a data sample), then **QAT** if that's still not enough.
4. If even QAT can't hold accuracy at the bit-width → the bit-width is too aggressive; back off.

Authority: Apple ships its own on-device foundation model at **2 bits per weight using QAT** (arXiv 2507.13575), with a balanced 2-bit weight set `{-1.5, -0.5, 0.5, 1.5}` chosen because it trained more smoothly than the unbalanced `{-2, -1, 0, 1}`. The lesson isn't "use 2-bit" — it's that **Apple reached for QAT, not PTQ, to survive aggressive quantization**. PTQ at 2-bit on a custom model will almost always fall apart; that regime requires QAT.

## The three compression families

Two modules, three method tiers. **`optimize.coreml`** runs *post-training on the `.mlpackage`* (data-free). **`optimize.torch`** is PyTorch-side and holds *both* QAT (training-time) *and* calibration-based PTQ — so "calibration PTQ" lives in `optimize.torch`, not `optimize.coreml`. Don't conflate "post-training" with "`optimize.coreml`."

- **Palettization** — cluster weights into an N-bit lookup table. Usually the best size/accuracy trade-off. Bit-widths `{1,2,3,4,6,8}`.
  - PTQ, data-free (`optimize.coreml`): `palettize_weights()` / `OpPalettizerConfig`
  - PTQ, calibration (`optimize.torch`): `SKMPalettizer` (sensitive k-means), `PostTrainingPalettizer`
  - QAT (`optimize.torch`): `DKMPalettizer` (differentiable k-means)
- **Quantization** — linear weight (and optionally activation) quantization. int8 / int4 weights, int8 activations; W8A8 runs on the Neural Engine (A17 Pro+, M4).
  - PTQ, data-free (`optimize.coreml`): `linear_quantize_weights()` / `OpLinearQuantizerConfig`
  - PTQ, calibration (`optimize.torch`): `linear_quantize_activations()`, `PostTrainingQuantizer`, `LayerwiseCompressor` (GPTQ-style)
  - QAT (`optimize.torch`): `LinearQuantizer`
- **Pruning** — zero out low-magnitude weights (magnitude threshold, target sparsity, block-structured, N:M). Orthogonal to the above and **composable** — coremltools supports joint sparse-palettization and sparse-quantization.
  - PTQ, data-free (`optimize.coreml`): `prune_weights()` / `OpMagnitudePrunerConfig`
  - PTQ, calibration (`optimize.torch`): `SparseGPT`
  - QAT (`optimize.torch`): `MagnitudePruner`

## Always re-measure after compressing

Compression is **lossy by definition**. Never assume accuracy held — run your eval set before and after every compression pass, on a realistic input distribution. A model that looks fine on synthetic inputs can collapse on real ones. This is the single most-skipped step and the most expensive to discover in production.

## Boundary

- QAT/PTQ are **deployment-stage decisions for custom Core ML models** you train or convert yourself.
- **Apple's Foundation Models are already 2-bit-quantized at the framework level** — you do not quantize them. FM adapters are LoRA deltas that inherit the base model's quantization. If you're working with Apple's on-device LLM, this page does not apply — see `axiom-ai`.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Compression is free accuracy savings" | It's lossy. PTQ especially. Always re-measure on real inputs — accuracy can drop silently. |
| "PTQ is enough, QAT is overkill" | True at int8 on big models; false at int4/sub-4-bit or on small models. Apple needed QAT for 2-bit. Match the method to the bit-width. |
| "2-bit worked for Apple, I'll do 2-bit PTQ" | Apple used 2-bit *QAT* with a hand-tuned weight set and recovery adapters. 2-bit PTQ on a custom model will almost certainly fail. |
| "I'll quantize Apple's Foundation Model to save space" | You can't and shouldn't — it's already 2-bit at the framework level. This page is for *your* models. |
| "Pruning or quantization, pick one" | They compose. Joint sparse-palettization / sparse-quantization is supported and often beats either alone. |

## Resources

**WWDC**: 2024-10159

**Docs**: coremltools 9.0 guide at apple.github.io/coremltools (`opt-overview`, `opt-quantization-api`, `opt-palettization-api`, `opt-pruning-api`); Apple Intelligence Foundation Language Models Tech Report 2025 (arXiv 2507.13575) for the 2-bit QAT specifics

**Skills**: coreml-conversion (produce the model first), `skills/ios-ml.md` (deploy the compressed model), coreml-training (train from scratch / personalize), axiom-ai (Foundation Models — already quantized)
