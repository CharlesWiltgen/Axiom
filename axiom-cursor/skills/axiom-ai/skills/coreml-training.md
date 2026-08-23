# Core ML Training & Personalization

Two distinct on-device/on-Mac training paths that developers constantly conflate:

- **Create ML** — train a *new* Core ML model from scratch (or via transfer learning).
- **`MLUpdateTask`** — *personalize* an already-deployed model on the user's own data, at runtime.

Both produce or update a Core ML model. Neither has anything to do with fine-tuning Apple's Foundation Models (that's `foundation-models-adapters.md`) or converting an existing model (that's `coreml-conversion.md`).

## When to Use

- You want to train an image/sound/text/tabular model without writing a training loop → Create ML.
- You want each user's copy of a model to adapt to *their* data on-device → `MLUpdateTask`.
- You started building on-device personalization and hit a wall because your model is an `.mlpackage` → read the NN-spec limitation below before going further.

---

## Create ML — train from scratch

Two surfaces, same engine:

- **Create ML app** (macOS) — no-code GUI. Drag in training data, pick a template, train, export.
- **CreateML framework** (`import CreateML`) — programmatic training.

**Availability is per-type, not blanket-macOS.** `MLImageClassifier` and `MLSoundClassifier` train on iOS 15+/iPadOS/visionOS as well as macOS; others (e.g. `MLRecommender`) remain macOS-only. Don't assume "Create ML = Mac-only" — check the specific type.

### Model types (CreateML framework)

Image (`MLImageClassifier`, `MLObjectDetector`), sound (`MLSoundClassifier`), text (`MLTextClassifier`, `MLWordTagger`), pose/action (`MLHandPoseClassifier`, `MLActionClassifier`, `MLHandActionClassifier`), style (`MLStyleTransfer`), tabular (`MLRegressor`, `MLClassifier` — backed by boosted-tree / linear / random-forest), and `MLRecommender` (macOS-only).

> The Create ML *app* also offers a Tabular/Time-Series flow, but there is no confirmed `MLTimeSeriesForecaster` type in the framework — use the app for that workflow.

### Programmatic shape

```swift
import CreateML

let data = try MLImageClassifier.DataSource.labeledDirectories(at: trainingURL)
let model = try MLImageClassifier(trainingData: data)      // synchronous — BLOCKS the calling thread
try model.write(to: URL(filePath: "Classifier.mlmodel"))   // exports a .mlmodel
```

- Training data: **directory-of-label-folders** for image classifiers; `MLDataTable(contentsOf:)` from CSV/JSON for tabular.
- The throwing `init(trainingData:parameters:)` is **synchronous and blocking**. For UI apps use `makeTrainingSession(...)` / the async `train(...)` API and report progress; resume from a checkpoint with `init(checkpoint:)`.
- Export produces a **`.mlmodel`** (attach `MLModelMetadata` for author/version/description).
- Training is GPU-accelerated on Apple silicon (Metal).

---

## `MLUpdateTask` — on-device personalization

`MLUpdateTask` retrains the **last few updatable layers** of an already-deployed model on user-specific data, then saves an updated `.mlmodelc` to disk. This is per-user personalization at runtime — not training from scratch.

```swift
let task = try MLUpdateTask(
    forModelAt: compiledModelURL,
    trainingData: userBatchProvider,
    configuration: config,
    completionHandler: { context in
        try? context.model.write(to: updatedModelURL)   // persist the personalized model
    }
)
task.resume()
```

- Initializers come in `completionHandler:` and `progressHandlers:` variants (with/without `configuration:`); `MLUpdateContext` carries the updated model.
- Loss functions: **categorical cross-entropy, MSE**. Optimizers: **SGD, Adam**.
- Available since iOS 13.

### ⚠️ The NN-spec-only limitation (read before building)

**`MLUpdateTask` only works with NeuralNetwork-spec models — NOT ML Program (`.mlpackage`) models from modern PyTorch/TensorFlow conversion.** You make a model updatable with coremltools `NeuralNetworkBuilder.make_updatable(layer_names)`, which supports **only `innerProduct` (fully-connected) and `convolution` layers**, and exists only for the NN-spec format.

This is the single most important fact about on-device personalization, and the reason it's rarely used in new projects: if your pipeline converts a PyTorch/TF model the modern way, you get an `.mlpackage` that **cannot** be personalized with `MLUpdateTask`. Developers routinely discover this after building most of the pipeline. Surface it on day one:

- Modern conversion (`coremltools.convert` → `.mlpackage`) → **no `MLUpdateTask`**.
- On-device personalization required → you must build/convert to an **NN-spec** model and call `make_updatable()` — accepting NN-spec's constraints and legacy status.

### When `MLUpdateTask` is still the right tool

- A legacy NN-spec model you already ship.
- Very constrained per-user personalization (last-layer adaptation) where the NN-spec limitation matches the task.
- The personalization must stay **on-device** for privacy and run without a server round-trip.

If you need richer adaptation than last-layer updates, `MLUpdateTask` is the wrong tool — retrain with Create ML (server-side or on-Mac) and ship updated models, or rethink the architecture.

---

## Boundary recap

| Path | Trains | Output | Runs |
|------|--------|--------|------|
| Create ML | A new model from scratch / transfer learning | `.mlmodel` | macOS / iOS (per type) at build time |
| `MLUpdateTask` | Last updatable layers of an NN-spec model | Updated `.mlmodelc` | On device, at runtime, per-user |
| FM adapter | Apple's frozen on-device LLM (LoRA) | `.fmadapter` | See `foundation-models-adapters.md` |
| coremltools convert | Nothing (format conversion) | `.mlpackage` | See `coreml-conversion.md` |

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll personalize my converted `.mlpackage` with `MLUpdateTask`" | `MLUpdateTask` is **NN-spec only**. ML Program models can't be updated — you'd have to rebuild as NN-spec. Check this *before* building the pipeline. |
| "Create ML is just for the Mac app / prototyping" | The `CreateML` framework trains programmatically, and image/sound classifiers train on iOS/iPadOS/visionOS too. |
| "`MLUpdateTask` can retrain my whole model on-device" | It updates the *last* fully-connected/convolutional layers only. It's last-layer personalization, not full retraining. |
| "Personalization and fine-tuning an LLM are the same thing" | `MLUpdateTask` personalizes a small Core ML model; fine-tuning Apple's LLM is FM adapter training (`foundation-models-adapters.md`). Entirely different toolchains. |
| "Training blocks? I'll call `init(trainingData:)` on the main thread" | The synchronous initializer blocks. Use the async training session and report progress, or run off the main thread. |

## Resources

**WWDC**: 2018-703, 2019-430, 2019-704 (`MLUpdateTask` / on-device personalization), 2021-10037, 2024-10183

**Docs**: /createml, /createml/mlimageclassifier, /coreml/mlupdatetask, /coreml/mlupdatecontext — plus coremltools `NeuralNetworkBuilder.make_updatable` (apple.github.io/coremltools)

**Skills**: coreml-conversion (NN-spec vs ML Program), coreml-compression (shrink trained models), `skills/ios-ml.md` (deploy), foundation-models-adapters (fine-tune Apple's LLM, not a Core ML model), axiom-concurrency (off-main-thread training)
