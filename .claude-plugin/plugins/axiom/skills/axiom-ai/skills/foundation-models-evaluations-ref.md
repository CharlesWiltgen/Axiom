
# Foundation Models Evaluations Reference

## Overview

The **Evaluations** framework (`import Evaluations`, `OS27` — all Apple platforms except tvOS) is a Swift-native harness for measuring the quality of a generative-AI feature as you iterate on its prompts, instructions, schema, or model. You define an `Evaluation` — a dataset of inputs with expected outputs, plus `Evaluator`s that score each result into named `Metric`s — and run it from a Swift Testing test or directly. It works with any `LanguageModel` (the on-device `SystemLanguageModel`, `PrivateCloudComputeLanguageModel`, or a custom provider), so it is the measurement half of the Foundation Models workflow: `axiom-ai (skills/foundation-models.md)` builds the feature, this skill proves it got better (or didn't regress).

This is the disciplined alternative to "eyeball a few outputs and ship." The custom-adapter four-axis eval discipline in `axiom-ai (skills/foundation-models-adapters.md)` predates this framework; for 27-cycle features, express those axes as `Metric`s here.

## When to Use This Reference

Use when:
- Measuring whether a prompt/instruction/schema change improved or regressed a Foundation Models feature
- Building a regression suite for an AI feature (run it in CI via Swift Testing)
- Scoring open-ended output where pass/fail isn't mechanical — use a model-as-judge
- Evaluating an **agentic** feature's tool-calling trajectory (did it call the right tools, in the right order, with the right arguments?)
- Synthesizing a larger evaluation dataset from a handful of seed examples

## The shape of an Evaluation

An `Evaluation` is a protocol with four moving parts:

```swift
@available(anyAppleOS 27, *)
public protocol Evaluation: Sendable {
    var dataset: SampleLoader { get }                          // inputs + expected outputs
    func subject(from sample: Sample) async throws -> Subject  // run your feature on one input
    @EvaluatorsBuilder var evaluators: Evaluators { get }      // score the result into Metrics
    func aggregateMetrics(using aggregator: inout MetricsAggregator)  // optional; has a default
}
```

`subject(from:)` is where you invoke the feature under test (e.g. start a `LanguageModelSession` and call `respond`) and return its output as the `Subject`. The framework runs every sample through it, feeds each result to every `Evaluator`, and aggregates the `Metric`s.

### A complete example

```swift
import Evaluations
import FoundationModels

@Generable
struct BookTags: Codable {
    @Guide(description: "Themes, genres, moods, and topics", .count(3...8))
    var tags: [String]
}

@available(anyAppleOS 27, *)
struct BookTaggingEvaluation: Evaluation {
    let tagCount = Metric("TagCount")

    var dataset: ArrayLoader<ModelSample<BookTags>> {
        ArrayLoader(samples: Book.sampleBooks.map { book in
            ModelSample(prompt: book.review, expected: BookTags(tags: book.tags))
        })
    }

    func subject(from sample: ModelSample<BookTags>) async throws -> ModelSubject<BookTags> {
        let session = LanguageModelSession(instructions: "Tag this book review.")
        let tags = try await session.respond(to: sample.prompt, generating: BookTags.self).content
        return ModelSubject(value: tags)
    }

    @EvaluatorsBuilder<ModelSample<BookTags>, ModelSubject<BookTags>>
    var evaluators: Evaluators {
        Evaluator { _, subject in
            let count = subject.value.tags.count
            return (3...8).contains(count)
                ? tagCount.passing(rationale: "\(count) tags")
                : tagCount.failing(rationale: "Got \(count) tags, expected 3–8")
        }
    }
}
```

## Metrics & Evaluators

A `Metric` is a named score channel. An `Evaluator`'s closure receives the original `(input, subject)` and returns a `Metric` carrying the outcome:

```swift
public struct Metric {
    public init(_ name: String)
    public func passing(rationale: String? = nil) -> Metric
    public func failing(rationale: String? = nil) -> Metric
    public func scoring(_ value: Double, rationale: String? = nil) -> Metric   // numeric outcome
    public func ignore(rationale: String? = nil) -> Metric                     // exclude this sample
}

// Evaluator's closure: (Input, ModelSubject<ExpectedValue>) async throws -> Metric
Evaluator { input, subject in
    subject.value.tags.allSatisfy { !$0.contains(" ") }
        ? wordCount.passing()
        : wordCount.failing(rationale: "a tag had multiple words")
}
```

The closure is `async throws`, so an evaluator can call a service, look up a reference set, or run another model. Use `.passing()`/`.failing()` for boolean checks, `.scoring(_:)` for a numeric judgment (model-as-judge produces these), and `.ignore()` to drop a sample from a metric's aggregate. Each distinct `Metric` name becomes a column in the result. `subject.value` is the model output you returned from `subject(from:)`.

## Datasets & Loaders

`ModelSample` pairs a prompt with the expected output; `ArrayLoader` is the in-memory `Loader`:

```swift
ModelSample(prompt: "okay I am OBSESSED…", expected: BookTags(tags: ["classic", "romance"]))
ArrayLoader(samples: [sample1, sample2, /* … */])
```

`ModelSample(prompt:expected:instructions:generationSchema:expectations:)` — `expected` is optional (omit it for unsupervised judging), `instructions`/`generationSchema` override per-sample, and `expectations:` carries a `TrajectoryExpectation` for tool-call evaluation (below). For large or streamed corpora use `JSONLoader` / `StreamLoader`, or conform your own type to `Loader`.

## Synthesizing more samples

Grow a seed dataset with the model itself. `makeSamples` is the convenience — it's an extension on the **array** of seed samples (not on the `Loader`), so call it on `[ModelSample]`, not on `ArrayLoader`. `SampleGenerator` is the configurable form:

```swift
let prompt = Prompt("Generate diverse book reviews and matching tags across genres and eras.")
let seeds = Book.sampleBooks.map { ModelSample(prompt: $0.review, expected: BookTags(tags: $0.tags)) }

var expanded = seeds
for try await sample in seeds.makeSamples(prompt, targetCount: 100) {
    expanded.append(sample)
}

// Full control over the generating session, sampling strategy, and a validator:
let generator = SampleGenerator<ModelSample<BookTags>>(
    prompt, samples: seeds, targetCount: 100,
    sessionProvider: { LanguageModelSession(model: PrivateCloudComputeLanguageModel(),
                                            instructions: "Generate realistic, diverse book reviews…") },
    samplingStrategy: .random(),
    validator: { sample in sample.promptDescription.count >= 100 }   // promptDescription, not prompt.description
)
for try await sample in generator.run() { expanded.append(sample) }
```

The `validator` rejects samples that don't meet your bar (e.g. minimum length); a larger model via `PrivateCloudComputeLanguageModel` makes a stronger generator. `SampleGenerator` is an `actor` — iterate its `run()` async sequence.

## Running an evaluation

### From Swift Testing (regression suite)

The `.evaluates(_:info:)` trait runs the evaluation; read the result from `EvaluationContext.current` and assert on an **optimization target** — the metric you're trying to move:

```swift
@Test("Book tagging quality", .evaluates(BookTaggingEvaluation()))
func bookTagging() async throws {
    let result = EvaluationContext.current.result
    #expect(result.aggregateValue(.mean(of: BookTaggingEvaluation().tagCount)) >= 0.8)
}
```

`result.aggregateValue(_ operation: AggregationOperation) -> Double` reads an aggregate back out. This turns "is the feature good enough?" into a CI gate.

### Directly

```swift
let result = try await BookTaggingEvaluation().run(info: ["build": "1234"])
```

## Aggregating metrics

Override `aggregateMetrics(using:)` to compute statistics across all samples. `MetricsAggregator` offers `computeMean/Median/Mode/Minimum/Maximum/StandardDeviation/Variance(of:)` and `group(_:_:)` for nested sections:

```swift
func aggregateMetrics(using aggregator: inout MetricsAggregator) {
    aggregator.computeMean(of: tagCount)
    aggregator.group("Tag totals") { a in
        a.computeStandardDeviation(of: tagTotal)
        a.computeVariance(of: tagTotal)
    }
}
```

`AggregationOperation` mirrors these (`.mean(of:)`, `.median(of:)`, `.mode(of:)`, `.minimum(of:)`, `.maximum(of:)`, `.standardDeviation(of:)`, `.variance(of:)`, `.custom(label:)`) for `aggregateValue`.

## Model-as-judge (open-ended output)

When correctness isn't mechanical, score with another model. `ModelJudgeEvaluator` runs a judge `LanguageModel` against a `ScoringScale`:

```swift
ModelJudgeEvaluator(
    "Helpfulness",
    scale: .numeric([1.0: "unhelpful", 3.0: "adequate", 5.0: "excellent"]),
    judge: SystemLanguageModel(),         // or PrivateCloudComputeLanguageModel() for a tougher judge
    scoringMode: .discrete                 // .discrete or .continuous
)
```

`ScoringScale` factories: `.numeric([Double: String])`, `.passFail(passDescription:failDescription:)`, `.custom(SomeScoreLevel.self)` (your `ScoreLevel`-conforming enum). For multi-axis judging pass `dimensions: [ScoreDimension(_ name:description:scale:)]` instead of a single scale. A judge produces a numeric `Metric.scoring(_:rationale:)` rather than pass/fail. To customize the rubric, use the `prompt:`-taking init — `ModelJudgeEvaluator(_:scale:judge:scoringMode:prompt:)` (the `prompt:` overloads drop the default judge, so name the judge explicitly) — passing `ModelJudgePrompt(instructions:evaluationTarget:reference:)`. **Judge alignment matters**: validate the judge against human grades before trusting it, and re-check for drift each model release (WWDC 335).

## Agentic / tool-call evaluation

For a feature that calls tools, evaluate the **trajectory**, not just the final text. Attach a `TrajectoryExpectation` to each sample and score with `ToolCallEvaluator`:

```swift
let sample = ModelSample(
    prompt: "What hikes have I gone on near Big Sur?",
    expected: nil,
    expectations: TrajectoryExpectation(
        unordered: [ ToolExpectation("searchSpotlight",
                                     arguments: [.keyOnly(argumentName: "query")]) ]
    )
)

// In the evaluation's evaluators:
ToolCallEvaluator(allPass: Metric("AllToolsMatched"),
                  percentagePass: Metric("ToolMatchRate"))
```

`TrajectoryExpectation` inits: `(ordered:unordered:allowsAdditionalToolCalls:)`, `(ordered:unordered:disallowed:)`, or `(unordered:)`. `ToolExpectation(_ name: String, arguments: [ArgumentMatcher])` declares one expected call. `ArgumentMatcher` has nine cases for matching a tool argument: `.exact(argumentName:value:)`, `.keyOnly(argumentName:)`, `.oneOf(argumentName:allowedValues:)`, `.range(argumentName:minimum:maximum:)` (both bounds `Double?`), `.pattern(argumentName:regex:)`, `.contains(argumentName:substring:)`, `.hasPrefix(argumentName:prefix:)`, `.hasSuffix(argumentName:suffix:)`, and `.naturalLanguage(argumentName:criteria:)`. `ToolCallEvaluator(allPass:percentagePass:argumentMatchModel:)` takes a model to judge `.naturalLanguage` argument matches.

## Hill-climbing workflow

WWDC 335's loop: pick one optimization-target metric, change one thing (instructions, prompt, schema, or model), re-run the suite, keep the change only if the target moved up without regressing the guardrail metrics. The Evaluations report makes each round measurable instead of vibes-based. Persist each round's result to compare across runs — `EvaluationResult.saveJSON(to:)` / `loadJSON(from:)` (and `saveJSONLines(to:)` / `loadJSONLines(from:)` for an appended history). Watch for **judge drift** when a model-as-judge is part of the loop — a judge that shifts between releases silently moves your baseline.

## API Quick Reference

- **`Evaluation`** (protocol) — `dataset: some Loader`, `subject(from:) async throws -> Subject`, `@EvaluatorsBuilder var evaluators`, `aggregateMetrics(using:)`; `run(info:) async throws -> EvaluationResult`.
- **`Metric`** — `init(_:)`, `.passing(rationale:)`, `.failing(rationale:)`, `.scoring(_:rationale:)`, `.ignore(rationale:)`.
- **`Evaluator { (input, subject) async throws -> Metric }`**; `subject.value` is the output.
- **`ModelSample(prompt:expected:instructions:generationSchema:expectations:)`**, `.promptDescription`; loaders `ArrayLoader`, `JSONLoader`, `StreamLoader`, `Loader`.
- **`[ModelSample].makeSamples(_:targetCount:sessionProvider:validator:)`** (on the array) / **`SampleGenerator(_:samples:targetCount:sessionProvider:samplingStrategy:validator:)`** (`actor`; iterate `run()`).
- **Swift Testing**: `.evaluates(_:info:)` trait, `EvaluationContext.current.result`, `result.aggregateValue(.mean(of:))`; persist via `EvaluationResult.saveJSON(to:)`/`loadJSON(from:)`/`saveJSONLines(to:)`/`loadJSONLines(from:)`.
- **`MetricsAggregator`** — `computeMean/Median/Mode/Minimum/Maximum/StandardDeviation/Variance(of:)`, `group(_:_:)`; `AggregationOperation` cases mirror these + `.custom(label:)`.
- **`ModelJudgeEvaluator(_:scale:judge:scoringMode:)`** / `(judge:dimensions:scoringMode:)` / `prompt:`-taking overloads; `ScoringScale.numeric/.passFail/.custom`; `ScoreDimension`; `ScoringMode.discrete/.continuous`; `ModelJudgePrompt`.
- **`ToolCallEvaluator(allPass:percentagePass:argumentMatchModel:)`**; `TrajectoryExpectation`, `ToolExpectation(_:arguments:)`, `ArgumentMatcher` (9 cases: `.exact/.keyOnly/.oneOf/.range/.pattern/.contains/.hasPrefix/.hasSuffix/.naturalLanguage`).

## Resources

**WWDC**: 2026-298, 2026-299, 2026-335, 2026-246

**Docs**: /Evaluations, /Evaluations/designing-effective-evaluations, /Evaluations/generating-synthetic-evaluation-datasets, /foundationmodels

**Skills**: axiom-ai (skills/foundation-models.md), axiom-ai (skills/foundation-models-ref.md), axiom-ai (skills/foundation-models-adapters.md)

---

**Last Updated**: 2026-06-11
**Platforms**: iOS / iPadOS / macOS / watchOS / visionOS 27+ (not tvOS)
**Skill Type**: Reference
