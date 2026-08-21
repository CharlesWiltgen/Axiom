
# Foundation Models Evaluations Reference

## Overview

The **Evaluations** framework (`import Evaluations`, `OS27` — all Apple platforms except tvOS) is a Swift-native harness for measuring the quality of a generative-AI feature as you iterate on its prompts, instructions, schema, or model. You define an `Evaluation` — a dataset of inputs with expected outputs, plus `Evaluator`s that score each result into named `Metric`s — and run it from a Swift Testing test or directly. It works with any `LanguageModel` (the on-device `SystemLanguageModel`, `PrivateCloudComputeLanguageModel`, or a custom provider).

**It is a Developer framework.** `Evaluations.framework` ships under `Developer/Library/Frameworks` alongside XCTest and Swift Testing, so it links into **test targets**, not app targets. To generate samples from a non-test target (a CLI that writes a dataset to disk), set `ENABLE_TESTING_SEARCH_PATHS = YES` and add `$(DEVELOPER_DIR)/..` to `LD_RUNPATH_SEARCH_PATHS`.

For the *discipline* — how to design a dataset, calibrate a judge, and hill-climb without fooling yourself — see `axiom-ai (skills/foundation-models-evaluations.md)`. When the suite is misbehaving (a metric reading `-1`, a SIGABRT, a green run that measured nothing), see `axiom-ai (skills/foundation-models-evaluations-diag.md)`. This page is the API surface.

## When to Use This Reference

Use when:
- Measuring whether a prompt/instruction/schema change improved or regressed a Foundation Models feature
- Building a regression suite for an AI feature (run it in CI via Swift Testing)
- Scoring open-ended output where pass/fail isn't mechanical — use a model-as-judge
- Evaluating an **agentic** feature's tool-calling trajectory
- Synthesizing a larger evaluation dataset from a handful of seed examples
- Digging into *which* samples failed and why

## The shape of an Evaluation

```swift
@available(anyAppleOS 27, *)
public protocol Evaluation: Sendable {
    associatedtype Sample where Sample == SampleLoader.Sample, Sample.ExpectedValue == Subject.Value
    associatedtype Subject: EvaluationSubject
    associatedtype SampleLoader: Loader

    var dataset: SampleLoader { get }                          // inputs + expected outputs
    func subject(from sample: Sample) async throws -> Subject  // run your feature on one input
    @EvaluatorsBuilder var evaluators: Evaluators { get }      // score the result into Metrics
    func aggregateMetrics(using aggregator: inout MetricsAggregator)  // required — no default
}
```

`subject(from:)` is where you invoke the feature under test. Call the **real service you ship**, not a copy of its prompt.

⚠️ **Do not let it throw for a failure your users will hit.** A throwing `subject(from:)` doesn't fail the sample — it makes every metric for that sample `.ignore`, and `.ignore` is excluded from aggregation. So the sample *leaves the denominator* and your pass rate goes **up**. A feature that trips guardrails on 20% of real inputs reports a better score than one that struggles through them. Catch, and score a sentinel.

### A complete example

```swift
import Evaluations
import FoundationModels

@Generable
struct BookTags: Codable {
    @Guide(description: "Themes, genres, moods, and topics", .count(3...8))
    var tags: [String]
}

// A wrapper so a refusal stays IN the dataset as a scored failure.
struct TaggingOutcome: Codable, Sendable, Equatable {
    var tags: [String] = []
    var failure: String? = nil      // non-nil == the user saw nothing
}

@available(anyAppleOS 27, *)
struct BookTaggingEvaluation: Evaluation {
    let produced = Metric("Produced")       // guardrail: did the user get anything at all?
    let tagCount = Metric("TagCountInRange")
    let tagTotal = Metric("TagCountRaw")    // distribution BESIDE the range check

    var dataset: ArrayLoader<ModelSample<TaggingOutcome>> {
        ArrayLoader(samples: Book.sampleBooks.map { book in
            ModelSample(prompt: book.review, expected: TaggingOutcome(tags: book.tags))
        })
    }

    func subject(from sample: ModelSample<TaggingOutcome>) async throws -> ModelSubject<TaggingOutcome> {
        do {
            // The SHIPPED service. Greedy sampling for a stable regression signal.
            let tags = try await BookTaggingService.generateTags(for: sample.promptDescription)
            return ModelSubject(value: TaggingOutcome(tags: tags.tags))
        } catch {
            // BARE catch, deliberately. `catch let e as LanguageModelError` looks tighter but
            // RETHROWS SystemLanguageModel.Error.assetsUnavailable — a *separate* enum — and
            // that's the model-unavailable case you most need to trap. A typed catch leaves
            // the biggest hole open while looking like it closed it.
            return ModelSubject(value: TaggingOutcome(failure: "\(error)"))
        }
    }

    // Spell the concrete element type. Using the `Evaluators` typealias here compiles in
    // isolation but blows up with "unsupported recursion for reference to type alias
    // 'Evaluators'" as soon as anything in the module touches inputColumn/responseColumn —
    // which is exactly what result triage does. (Declaring `typealias Sample`/`Subject` on
    // the struct also fixes it.)
    @EvaluatorsBuilder<ModelSample<TaggingOutcome>, ModelSubject<TaggingOutcome>>
    var evaluators: [any EvaluatorProtocol<ModelSample<TaggingOutcome>, ModelSubject<TaggingOutcome>>] {
        Evaluator { _, subject in
            subject.value.failure == nil
                ? produced.passing()
                : produced.failing(rationale: subject.value.failure!)
        }
        Evaluator { _, subject in
            let count = subject.value.tags.count
            return (3...8).contains(count)
                ? tagCount.passing(rationale: "\(count) tags")
                : tagCount.failing(rationale: "Got \(count) tags, expected 3–8")
        }
        Evaluator { _, subject in tagTotal.scoring(Double(subject.value.tags.count)) }
    }

    // Required by Evaluation (no default).
    func aggregateMetrics(using aggregator: inout MetricsAggregator) {
        aggregator.computeMean(of: produced)     // pass/fail → the mean IS the pass rate
        aggregator.computeMean(of: tagCount)
        aggregator.group("Tag count distribution") { g in
            g.computeMean(of: tagTotal)
            g.computeStandardDeviation(of: tagTotal)   // ≈0 at 8.0 == degenerate output
        }
    }
}
```

## Metrics & Evaluators

```swift
public struct Metric: Sendable, Equatable {
    public let name: String
    public let value: Metric.Value
    public let rationale: String?
    public enum Value: Equatable, Sendable { case passing, failing, scoring(Double), ignore }

    public init(_ name: String)
    public func passing(rationale: String? = nil) -> Metric
    public func failing(rationale: String? = nil) -> Metric
    public func scoring(_ value: Double, rationale: String? = nil) -> Metric   // numeric outcome
    public func ignore(rationale: String? = nil) -> Metric                     // exclude this sample
    public var doubleValue: Double? { get }
}
```

The `Evaluator` closure receives `(Input, Subject)` and returns a `Metric`. It's `async throws`, so an evaluator can call a service, look up a reference set, or run another model.

```swift
Evaluator { input, subject in
    guard let expected = input.expected else { return exactMatch.ignore() }   // no ground truth → don't score
    return subject.value == expected ? exactMatch.passing() : exactMatch.failing()
}
```

### Metric gotchas

| Trap | Reality |
|---|---|
| A bare `Metric("Accuracy")` | Has `value == .ignore` and `doubleValue == nil`. It's a **name token**, not a result — declare it once, use it both to produce results and to look them up. |
| `Metric.==` | Compares name **and** value, so `Metric("A") != Metric("A").passing()`. Never use `==` to find a metric in a collection. |
| `[Metric]` subscript and `DataFrame[metric:]` | Match by **name only** — these are what you look up with. |
| `doubleValue` | `.passing → 1.0`, `.failing → 0.0`, `.scoring(x) → x`, `.ignore → nil`. |
| `.ignore` | Excluded from every aggregation. Use it for samples with no ground truth. |
| Conditionals or loops inside an `evaluators` block | **None of them compile.** `@EvaluatorsBuilder` has only `buildExpression`, a variadic `buildBlock`, and a `buildOptional` that returns an array nothing consumes. So no `if`, no `if/else`, no `for`, no `if #available`. Build the evaluator list outside the builder if you need branching. |

## Datasets & Loaders

```swift
ModelSample(prompt: "okay I am OBSESSED…", expected: BookTags(tags: ["classic", "romance"]))
ArrayLoader(samples: [sample1, sample2, /* … */])
```

`ModelSample(prompt:expected:instructions:generationSchema:expectations:)` — `instructions`/`generationSchema` override per-sample, and `expectations:` carries a `TrajectoryExpectation` for tool-call evaluation. Read the prompt back with `.promptDescription`.

⚠️ **You cannot just *omit* `expected`.** Its default argument is hard-typed `Optional<String>`, so `ModelSample<BookTags>(prompt: "x")` fails to compile (`cannot convert value of type 'BookTags?' to expected argument type 'Optional<String>'`). For any non-`String` expected type you must pass **`expected: nil` explicitly and name the generic**: `ModelSample<BookTags>(prompt: "x", expected: nil)`.

Loaders: `ArrayLoader(samples:)`, `JSONLoader(url:)`, `StreamLoader(stream:)`, or conform your own type to `Loader`.

**`JSONLoader` fails quietly.** It auto-detects JSON-array vs JSONL from the first non-whitespace character, and **logs-and-skips malformed entries via OSLog** rather than throwing. Only a file-open failure throws — so a dataset that silently shrinks is a real possibility. Check the count you loaded.

## Synthesizing more samples

`makeSamples` is an extension on the **array** of seed samples (not on the `Loader`). `SampleGenerator` is the configurable form.

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
    samplingStrategy: .random(),   // or .slidingWindow
    validator: { sample in sample.promptDescription.count >= 100 }
)
for try await sample in generator.run() { expanded.append(sample) }
let rejected = await generator.invalidSamples
```

| Behavior | Detail |
|---|---|
| `targetCount` | Size of the **whole resulting set including your seeds**. 13 seeds + `targetCount: 100` ⇒ 87 new ones. |
| `makeSamples` + `validator` | **Silently discards** rejected samples. Construct a `SampleGenerator` directly to read `invalidSamples`. |
| `sessionProvider` | Called **once** at the start and reused across batches. If the context window is exhausted mid-run it is called **again** for a fresh session with no prior context — so its instructions must be **self-contained**. |
| `validator` | Sees **one sample in isolation**. Cross-sample properties (diversity, length *variation*) cannot be checked here. |
| `samplingStrategy` | `.random(retries:)` (default) or `.slidingWindow` (every seed gets a turn as an example). `makeSamples` always uses `.random`. |
| Batching | Up to 10 samples per model call; not configurable. |

`SampleGenerator` is an `actor` — iterate `run()`, then read `samples` / `invalidSamples`.

## Running an evaluation

### From Swift Testing (regression suite)

```swift
@available(anyAppleOS 27, *)
@Test("Book tagging quality", .evaluates(BookTaggingEvaluation()))
func bookTagging() async throws {
    let e = BookTaggingEvaluation()
    let result = EvaluationContext.current.result

    // Wiring gate FIRST — otherwise everything below is computed over a phantom denominator.
    #expect(!result.detailed.containsColumn("SubjectInferenceError", SubjectInferenceError.self))
    #expect(!result.detailed.containsColumn("EvaluatorErrors", [EvaluatorError].self))

    #expect(result.aggregateValue(.mean(of: e.produced)) == 1.0)          // guardrail
    #expect(result.aggregateValue(.mean(of: e.tagCount)) >= 0.8)          // target
    #expect(result.aggregateValue(.standardDeviation(of: e.tagTotal)) > 0.5)  // not degenerate
}
```

`.evaluates(_ evaluation:info:)` takes an `info: [String: String]` dictionary that labels the run (model, prompt version, dataset version) — it's what makes runs identifiable in Xcode's **Compare** view. The trait records the result as test **attachments**, which is also how you extract the raw input/response pairs for judge calibration.

**`EvaluationContext.current` outside an evaluation scope is a fatal error**, not an optional.

### Directly

```swift
let result = try await BookTaggingEvaluation().run(info: ["build": "1234"])
```

**There are no run options.** No batch size, parallelism, timeout, or retry parameter exists anywhere on `Evaluation`, `EvaluationResult`, or `EvaluationTrait`. (The only `retries` in the framework is `SamplingStrategy.random(retries:)`, which is about *synthesizing* samples.) Don't invent them.

## Determinism, and where it runs

A model is not a pure function, so an eval used as a CI gate flaps unless you pin what you can.

**Pin the subject to greedy sampling.** `GenerationOptions(samplingMode: .greedy)` "always results in the same output for a given input" — verified byte-identical across runs on both device and simulator. This is set in *your* `subject(from:)`, since that's where you build the session:

```swift
let response = try await session.respond(
    to: sample.prompt,
    generating: BookTags.self,
    options: GenerationOptions(samplingMode: .greedy)   // stable regression signal
)
```

`GenerationOptions.sampling` is deprecated — the property is now **`samplingMode`**. Seeded sampling (`.random(top:seed:)`) is explicitly **"best effort"** per Apple and is *not* a determinism guarantee; use `.greedy` when you want reproducibility.

⚠️ **You cannot pin the judge.** `ModelJudgeEvaluator` and `ToolCallEvaluator` accept only a `LanguageModel` — there is no public API to pass `GenerationOptions`, so a model-as-judge remains a nondeterminism source even when the subject is greedy. Report `computeStandardDeviation` on judge dimensions and size your gate above the noise.

**Where it runs:**

| Environment | Status |
|---|---|
| Physical device with Apple Intelligence | Works. |
| iOS Simulator | **Works — live inference**, using the *host Mac's* model (greedy output matches the Mac byte-for-byte). Requires the host Mac to have Apple Intelligence enabled. Claims that the Simulator can only compile, not run, models are wrong on Xcode 27. |
| Xcode Cloud / hosted CI | **Unknown.** Apple documents nothing — the Xcode Cloud docs and Xcode 26/27 release notes never mention Apple Intelligence or Foundation Models. Assume unavailable until proven on your runner, and make the eval **skip** rather than fail. |

⚠️ **`PrivateCloudComputeLanguageModel` will crash an unentitled process.** PCC requires the **managed** entitlement `com.apple.developer.private-cloud-compute`, which you must apply for — it is not self-serve. Worse, `availability` **reports `.available` without it**, and the subsequent `respond()` is a hard `Fatal error: Process is missing required entitlement` (SIGTRAP), not a thrown error. An availability check does not protect you. Its quota is also per-*person*, tied to the signed-in Apple Account, so a CI runner with no user signed in is a further unknown. Apple's own sample uses PCC for **offline dataset generation**, not as the model under test in CI.

## Aggregating metrics

```swift
public struct MetricsAggregator {
    public mutating func group(_ name: String, _ body: (inout MetricsAggregator.Group) -> Void)
    public mutating func computeMean(of: Metric)     // + Median, Mode, Minimum, Maximum,
                                                     //   StandardDeviation, Variance
    public mutating func custom(of metric: Metric, label: String, _ body: ([Double]) -> Double)
}
```

`custom(of:label:)` hands you `[Double]` — that metric's scores across all samples — and you return one number. This is the hook for any statistic the framework doesn't ship, notably **Cohen's kappa** for judge calibration.

```swift
func aggregateMetrics(using aggregator: inout MetricsAggregator) {
    aggregator.computeMean(of: tagCount)
    aggregator.group("Tag totals") { g in
        g.computeStandardDeviation(of: tagTotal)
        g.custom(of: relevance.metric, label: "Relevance Alignment") { judgeScores in
            // Statistics is YOUR type — the framework ships no kappa. expertScores is your
            // human-rated column, captured from the dataset.
            Statistics.cohensKappa(expertScores, judgeScores) ?? 0
        }
    }
}
```

⚠️ **The `[Double]` you receive excludes `.ignore`d samples.** So aligning it *positionally* against a separately-built expert-score array — which is what Apple's own Book Tracker sample does — silently misaligns the two vectors the moment any sample is ignored, and yields a garbage kappa that still looks like a plausible number. In a calibration evaluation, guarantee every sample produces a real score (no `.ignore`, no throwing subject), or key the scores by sample instead of by position.

`AggregationOperation` mirrors these for reading back: `.mean(of:)`, `.median(of:)`, `.mode(of:)`, `.minimum(of:)`, `.maximum(of:)`, `.standardDeviation(of:)`, `.variance(of:)`, `.custom(label:)`.

⚠️ **`aggregateValue(_:)` returns `-1` when the operation isn't found** — it is non-optional `Double`, not `Double?`. A typo in a `.custom(label:)` string silently yields `-1`, which will sail through `#expect(x > 0.6)` as a failure that looks like a quality problem rather than a wiring bug. **Use the same label string in the aggregator and the assertion.**

`MetricsAggregator` has no public init — you only ever receive it `inout`.

## Inspecting results

`EvaluationResult` is how you answer "*which* samples failed, and what did the model actually say?"

```swift
public struct EvaluationResult: Sendable {
    public let resultID: UUID
    public let evaluationID: String            // the evaluation's type name
    public var summary: DataFrame { get }      // one row; columns are AggregateMetric
    public var detailed: DataFrame { get }     // one row per sample
    public let evaluationInfo: [String: String]
    public let startTime: Date
    public let endTime: Date
    public var duration: TimeInterval { get }
    public var groupedSummary: String { get }  // preformatted aggregates, by group
    public func aggregateValue(_ operation: AggregationOperation) -> Double
}
```

`ResultColumn<Value>` is a **typed column descriptor** — a name plus a phantom type. It has no public initializer and no subscript of its own; you obtain one from the `Evaluation` and use it as a **key into the DataFrame**:

```swift
extension Evaluation {
    public var inputColumn: ResultColumn<Sample> { get }                    // "Input"
    public var responseColumn: ResultColumn<Subject> { get }                // "Response"
    public var expectedColumn: ResultColumn<Sample.ExpectedValue> { get }   // "Expected"
}

extension TabularData.DataFrame {
    public subscript<T>(column: ResultColumn<T>) -> Column<T> { get }
    public subscript(metric metric: Metric) -> Column<Metric> { get }       // matches by name
}
```

The returned `Column<T>` has `Element == T?`, so `column[i]` is `T?`. Note `responseColumn` is typed as the **`Subject`** (e.g. `ModelSubject<BookTags>`), so read `.value` off it.

### Triaging failures

```swift
let result = try await eval.run()
let df = result.detailed

let inputs    = df[eval.inputColumn]      // Column<ModelSample<BookTags>>
let responses = df[eval.responseColumn]   // Column<ModelSubject<BookTags>>
let expected  = df[eval.expectedColumn]   // Column<BookTags>
let scores    = df[metric: eval.tagCount] // Column<Metric>

for i in 0..<df.shape.rows {
    guard let metric = scores[i], metric.value == .failing else { continue }
    print("input:    \(inputs[i]?.promptDescription ?? "-")")
    print("actual:   \(responses[i]?.value.tags ?? [])")   // nil if subject(from:) threw
    print("expected: \(expected[i]?.tags ?? [])")
    print("why:      \(metric.rationale ?? "-")")
}
```

`result.summary` is the aggregate view; `result.groupedSummary` is a preformatted string of aggregates by group (ungrouped ones land under a trailing `Other Metrics:` heading).

## Error surface

```swift
public enum EvaluationError: Error, LocalizedError {
    case missingTranscript(evaluatorType: String)
}
public enum SubjectInferenceError: Error, LocalizedError, Codable, Sendable, Hashable {
    case failed(reason: String)
}
public enum EvaluatorError: Error, LocalizedError, Codable, Sendable, Hashable {
    case failed(evaluatorType: String, reason: String)
}
public enum EvaluationResultsError: LocalizedError, Equatable {
    case fileNotFound(URL), emptyJSONFile, invalidJSONFormat
}
public enum ModelJudgeError: LocalizedError {
    case invalidScore(dimension: String, value: String)
    case invalidResponse(String)
    case jsonDecodingFailed(response: String, underlying: any Error)
    case missingDimension(String, response: String)
    case noScaleValues(dimension: String)
}
```

**A throwing `subject(from:)` does not abort the run.** The framework logs and skips inference errors. For that sample:
- `Response` is `nil`
- every metric becomes `.ignore` (rationale: "No inference was produced for this sample…"), so the sample drops out of the aggregates
- a `SubjectInferenceError` is recorded in the detailed DataFrame

A throwing **evaluator** only nullifies *its own* metric for that row — the other evaluators still score it.

⚠️ **A throwing evaluator fails silently, and the wreckage *looks healthy*.** `EvaluationError.missingTranscript` and `ModelJudgeError` are **not** thrown out of `run()` — they're thrown from inside the evaluator, and the runner catches them like any other evaluator throw and records them in the `EvaluatorErrors` column.

The deceptive part: the evaluator's metric column **still materializes** — as an all-`.ignore` column. So `containsColumn("ToolsAllPass", Metric.self)` returns **true** and everything looks fine. But an all-`.ignore` metric aggregates over an empty set, so **no aggregate row is emitted**, and `aggregateValue(.mean(of: toolsAllPass))` returns the not-found sentinel **-1**. Your suite goes green with no trajectory coverage whatsoever.

Don't check for a missing column — check `EvaluatorErrors`. The only thing that reliably throws out of `run()` is the **loader** (a missing dataset file).

**Assert the error columns are absent** if you want a loud failure — see below.

The two recorded errors surface as **conditionally present columns** in `result.detailed` (which is why they're `Codable`/`Sendable`/`Hashable` — they're cell values). They exist only if at least one failure occurred, and the string-typed TabularData subscript **traps on a missing column**, so guard:

```swift
if df.containsColumn("SubjectInferenceError", SubjectInferenceError.self) {
    let errors = df["SubjectInferenceError", SubjectInferenceError.self]
    for i in 0..<errors.count where errors[i] != nil {
        print("no response for sample \(i): \(errors[i]!.errorDescription ?? "")")
    }
}
if df.containsColumn("EvaluatorErrors", [EvaluatorError].self) {   // an ARRAY — several can fail per row
    let errors = df["EvaluatorErrors", [EvaluatorError].self]
    // …
}
```

There is **no typed `ResultColumn` accessor for either error column** — use the literal names `"SubjectInferenceError"` and `"EvaluatorErrors"`.

The division: **`SubjectInferenceError` = your feature produced no output at all** (hence no `evaluatorType`). **`EvaluatorError` = your feature produced output but the scoring code blew up** (hence it carries `evaluatorType`).

Because both failures are recorded rather than thrown, a wiring bug looks identical to a healthy run. Gate on it:

```swift
// Run this FIRST — otherwise every assertion below is computed over a phantom denominator.
#expect(!result.detailed.containsColumn("SubjectInferenceError", SubjectInferenceError.self))
#expect(!result.detailed.containsColumn("EvaluatorErrors", [EvaluatorError].self))
```

## Persistence — and a trap

```swift
// On a single result
public func saveJSON(to directory: URL, includeReportMetadata: Bool = false) throws -> URL
public func jsonData(includeReportMetadata: Bool = false, jsonOptions: …) throws -> Data
public init(jsonData: Data) throws
public static func loadJSON(from url: URL) throws -> EvaluationResult
public static func loadJSONLines(from url: URL) async throws -> [EvaluationResult]   // async

// On a COLLECTION of results — not on a single one
extension Collection where Element == EvaluationResult {
    public func saveJSONLines(to url: URL, includeReportMetadata: Bool = false) throws -> URL
}
```

`saveJSON(to:)` takes a **directory** and returns the file URL it chose, naming the file `<evaluationID>-<resultID>.xcevalresult`. `loadJSON(from:)` takes a **file** URL and is static.

⚠️ **JSON persistence is lossy, and the typed API traps on a reloaded result.** After `saveJSON` → `loadJSON` (or `init(jsonData:)` / `loadJSONLines`), *every* column comes back typed as `String`. Calling `aggregateValue(_:)`, `groupedSummary`, `detailed[metric:]`, or `detailed[someResultColumn]` on a reloaded result is an **uncatchable trap (SIGABRT)**, not a thrown error:

```
Could not cast Column<Swift.String> to Column<Evaluations.AggregateMetric>
```

On a reloaded result, only `resultID`, `evaluationID`, `evaluationInfo`, `startTime`, `endTime`, and `duration` are safe; cells must be read as `String` (each holds the JSON text of the original value). **The typed inspection API works only on the in-memory result returned by `run()`.** This looks like a beta defect — for now, do cross-run comparison in **Xcode's Compare view**, not by reloading persisted results in code.

## Model-as-judge (open-ended output)

Levels must name **observable features**, and the scale must be **even-numbered** — see the discipline skill for why. A 4-level scale with feature-based labels:

```swift
let coverage = ScoreDimension(
    "Coverage",
    description: "How completely the tags capture what a reader would browse by.",
    scale: .numeric([
        4.0: "Names the genre and every salient theme in the review",
        3.0: "Names the genre and most themes; one salient element missing",
        2.0: "Names the genre but little else, or misses the genre",
        1.0: "Names nothing a reader would browse by",
    ])
)

ModelJudgeEvaluator(
    judge: PrivateCloudComputeLanguageModel(),   // default is SystemLanguageModel()
    dimensions: [coverage, groundedness],
    scoringMode: .discrete
)
```

- **`ScoringScale`**: `.numeric([Double: String])`, `.passFail(passDescription:failDescription:)`, `.custom(SomeScoreLevel.self)`, or `init(options: [ScaleOption])`.
- **`ScoringMode`**: `.discrete` constrains the judge structurally to the scale's values; `.continuous` allows any `Double` and treats the scale as a guide. **Cohen's kappa needs discrete categories, so calibration evaluations must use `.discrete`.**
- **Multi-axis**: pass `dimensions: [ScoreDimension(_:description:scale:)]` instead of a single scale. `ScoreDimension.metric` is how a dimension's scores reach the aggregator. All dimensions score in **one** model call.
- **Custom rubric**: the `prompt:`-taking inits drop the default judge, so name the judge explicitly. Both `ModelJudgePrompt` members are **closures**, not values:

```swift
public struct ModelJudgePrompt<Input: ModelSampleProtocol>: Sendable {
    public static var defaultInstructions: String { get }
    public let instructions: String
    public let evaluationTarget: (@Sendable (Input.ExpectedValue) -> String)?
    public let reference: (@Sendable (Input, Input.ExpectedValue) async throws -> [String: String])?
}
```

Note `evaluationTarget` receives the **`ExpectedValue`**, not the `Subject`, and `reference` is `async throws` and returns a **`[String: String]`** of labelled context (source material, expected values). Omit `evaluationTarget` and the response is JSON-serialized for the judge.

- **Pairwise**: `ModelJudgeEvaluator.pairwise(_:scale:judge:scoringMode:evaluationTarget:)` compares against the sample's `expected` value as a baseline. It builds its own prompt, so `instructions:`/`reference:` don't apply. There is **no default scale** — you supply it, so the neutral point is whatever your scale's midpoint is. On the recommended 1–4 scale, mean **> 2.5** = better than baseline, **< 2.5** = regression. Run comparisons in **both orderings** and trust only verdicts that agree — pairwise judges carry position bias.
- **`judgePrompt(for:output:)`** dumps the exact prompt the judge will receive — use it when a judge is behaving inexplicably.

A judge produces a numeric `Metric.scoring(_:rationale:)`, not pass/fail. **Calibrate it before trusting it** — see `axiom-ai (skills/foundation-models-evaluations.md)`.

## Agentic / tool-call evaluation

⚠️ **The subject must capture the transcript — and forgetting is silent.** `ToolCallEvaluator` throws `EvaluationError.missingTranscript`, but that throw is *caught by the runner and recorded*, not propagated. The `ToolsAllPass` / `ToolsPercentagePass` columns still appear — as all-`.ignore` columns, so they look present and healthy — but they aggregate over an empty set, `aggregateValue` on them returns **-1**, and the suite goes green with zero trajectory coverage. Assert the `EvaluatorErrors` column is absent; do not check for a missing column.

```swift
func subject(from sample: ModelSample<String>) async throws -> ModelSubject<String> {
    let session = LanguageModelSession(tools: [SearchBooks(), GetBookDetails()], instructions: "…")
    let response = try await session.respond(to: sample.prompt, generating: String.self)
    return ModelSubject(value: response.content,
                        transcript: session.transcript.structuredTranscript)   // required
}
```

`structuredTranscript` is an extension Evaluations adds to FoundationModels' `Transcript`. `ModelSubject.toolCalls` is a convenience over it.

Tool evaluation measures **selection, not execution** — stub tools are correct and expected.

```swift
// Declare metrics once, as properties — an inline Metric("…") can't be referenced from aggregateMetrics.
let toolsAllPass = Metric("ToolsAllPass")
let toolsPercentagePass = Metric("ToolsPercentagePass")

let sample = ModelSample<String>(       // name the generic: `expected: nil` can't infer ExpectedValue
    prompt: "Find gothic books and show details on the first",
    expected: nil,
    expectations: TrajectoryExpectation(
        ordered: [
            ToolExpectation("searchBooks", arguments: [.exact(argumentName: "tag", value: .string("gothic"))]),
            ToolExpectation("getBookDetails", arguments: [.keyOnly(argumentName: "bookId")]),
        ]
    )
)

// In the evaluation's evaluators:
ToolCallEvaluator(allPass: toolsAllPass, percentagePass: toolsPercentagePass)
```

The initializers — there are four, and **`disallowed:` and `allowsAdditionalToolCalls:` are on different ones**:

```swift
init(ordered: [ToolExpectation] = [], unordered: [ToolExpectation] = [], allowsAdditionalToolCalls: Bool = true)
init(ordered: [ToolExpectation] = [], unordered: [ToolExpectation] = [], disallowed: [ToolExpectation])
init(unordered: [ToolExpectation])
init(expected toolName: String, arguments: [ArgumentMatcher] = [])
```

Note the init label is **`allowsAdditionalToolCalls:`** while the stored property is `allowsAdditionalCalls`. To get *both* `disallowed:` and no-additional-calls, use the `disallowed:` init and set the property afterward:

```swift
var expectation = TrajectoryExpectation(unordered: [...], disallowed: [ToolExpectation("sendEmail")])
expectation.allowsAdditionalCalls = false
```

| API | Detail |
|---|---|
| `ordered:` / `unordered:` | Ordered are matched sequentially; unordered anywhere in the transcript; both sets must be satisfied. |
| `disallowed:` | With argument matchers, flags **only** calls matching those arguments — the model may still call the tool with different ones. Omit the matchers to ban a tool outright. |
| `allowsAdditionalCalls` | **Defaults to `true`** (extra calls permitted). Setting it `false` makes unmatched calls **inflate the `ToolsPercentagePass` denominator** — 2 expected + 1 unexpected reports **0.67**, not 1.0. |
| `ToolExpectation(_ name:arguments:)` | One expected call. `.anyOrder(_:)` groups several tools at one position in an ordered sequence. Accessing `ToolExpectation.name` on an `.anyOrder` group **traps** (SIGTRAP). |
| `ToolsAllPass` vs `ToolsPercentagePass` | The strict gate vs the **progress signal**. The percentage still moves while the strict metric fails — that's what you hill-climb against. |

`ArgumentMatcher` (9 cases): `.exact(argumentName:value:)`, `.keyOnly(argumentName:)`, `.oneOf(argumentName:allowedValues:)`, `.range(argumentName:minimum:maximum:)`, `.pattern(argumentName:regex:)`, `.contains(argumentName:substring:)`, `.hasPrefix(argumentName:prefix:)`, `.hasSuffix(argumentName:suffix:)`, `.naturalLanguage(argumentName:criteria:)` (semantic match — `uplifting` / `happy` / `cheerful` all satisfy one criterion). `ToolCallEvaluator(allPass:percentagePass:argumentMatchModel:)` takes the model that judges `.naturalLanguage` matches.

⚠️ **watchOS**: the 2-argument `ToolCallEvaluator(allPass:percentagePass:)` is `@available(watchOS, unavailable)`. The 3-argument `argumentMatchModel:` initializer is available.

`TrajectoryExpectation` is `Generable`, so tool-eval samples can be synthesized — but the generator **doesn't know your tools exist**. Enumerate the tools, their purpose, the ordering rules, and which matchers to use, in its instructions.

## API Quick Reference

- **`Evaluation`** — `dataset: some Loader`, `subject(from:) async throws -> Subject`, `@EvaluatorsBuilder var evaluators`, `aggregateMetrics(using:)` (required, no default); `run(info:) async throws -> EvaluationResult`.
- **`Metric`** — `init(_:)`, `.passing/.failing/.scoring(_:)/.ignore(rationale:)`, `.value`, `.rationale`, `.doubleValue`.
- **`Evaluator { (input, subject) async throws -> Metric }`**; `subject.value` is the output. No `if/else` in the builder.
- **Samples/loaders** — `ModelSample(prompt:expected:instructions:generationSchema:expectations:)`, `.promptDescription`; `ArrayLoader`, `JSONLoader`, `StreamLoader`, `Loader`.
- **Synthesis** — `[ModelSample].makeSamples(_:targetCount:sessionProvider:validator:)`; `SampleGenerator` (`actor`; `run()`, `samples`, `invalidSamples`); `SamplingStrategy.random(retries:)` / `.slidingWindow`.
- **Swift Testing** — `.evaluates(_:info:)`, `EvaluationContext.current.result`.
- **Aggregation** — `MetricsAggregator.computeMean/Median/Mode/Minimum/Maximum/StandardDeviation/Variance(of:)`, `custom(of:label:_:)`, `group(_:_:)`; `AggregationOperation`; `aggregateValue(_:) -> Double` (**-1 if not found**).
- **Results** — `EvaluationResult.summary/.detailed/.groupedSummary/.evaluationInfo/.duration`; `ResultColumn` via `inputColumn`/`responseColumn`/`expectedColumn`; `DataFrame[column]` and `DataFrame[metric:]`.
- **Errors** — `EvaluationError.missingTranscript`, `SubjectInferenceError`, `EvaluatorError`, `EvaluationResultsError`, `ModelJudgeError`.
- **Judge** — `ModelJudgeEvaluator(_:scale:judge:scoringMode:)` / `(judge:dimensions:scoringMode:)` / `prompt:` overloads / `.pairwise(…)`; `ScoringScale.numeric/.passFail/.custom`; `ScoreDimension` (+ `.metric`); `ScoringMode.discrete/.continuous`; `ModelJudgePrompt`; `judgePrompt(for:output:)`.
- **Tool calls** — `ToolCallEvaluator(allPass:percentagePass:argumentMatchModel:)`; `TrajectoryExpectation` has four inits — `(ordered:unordered:allowsAdditionalToolCalls:)`, `(ordered:unordered:disallowed:)`, `(unordered:)`, `(expected:arguments:)` — and `allowsAdditionalCalls` is a settable **property**, not an init label (`disallowed:` and `allowsAdditionalToolCalls:` are on different inits); `ToolExpectation(_:arguments:)` + `.anyOrder(_:)`; `ArgumentMatcher` (9 cases); `StructuredTranscript` via `session.transcript.structuredTranscript`.

## Resources

**WWDC**: 2026-298, 2026-299, 2026-335, 2026-246

**Docs**: /evaluations, /evaluations/designing-effective-evaluations, /evaluations/evaluating-tool-calling-behavior, /evaluations/generating-synthetic-evaluation-datasets, /foundationmodels/generationoptions

**Skills**: axiom-ai (skills/foundation-models-evaluations.md), axiom-ai (skills/foundation-models-evaluations-diag.md), axiom-ai (skills/foundation-models.md), axiom-ai (skills/foundation-models-ref.md), axiom-ai (skills/foundation-models-adapters.md)

---

**Last Updated**: 2026-07-12
**Platforms**: iOS / iPadOS / macOS / watchOS / visionOS 27+ (not tvOS)
**Skill Type**: Reference
