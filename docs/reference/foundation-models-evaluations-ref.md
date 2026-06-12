# Foundation Models Evaluations Reference

How to use Apple's **Evaluations** framework (new in the iOS 27 cycle) to measure the quality of a generative-AI feature as you iterate — instead of eyeballing a few outputs and hoping. You define a dataset of inputs with expected outputs, score each result into named metrics, and run the whole thing from a Swift Testing test so it becomes a CI gate.

## When to Use This Reference

Use this reference when:

- You changed a prompt, instruction, schema, or model and want to know whether your AI feature actually got better (or quietly regressed)
- You want a regression suite for an AI feature that runs in CI
- The output is open-ended (a summary, a rewrite) where pass/fail isn't mechanical and you need a model to grade it
- Your feature is agentic and you need to check that it calls the right tools, in the right order, with the right arguments
- You have a handful of test cases and want to synthesize a larger evaluation dataset

## Example Prompts

Questions you can ask Claude that draw from this reference:

- "Write an evaluation suite that checks my book-tagging feature stays within 3–8 tags."
- "How do I measure if my prompt change improved summary quality?"
- "Set up a model-as-judge to score helpfulness on a 1–5 scale."
- "How do I evaluate that my agent called the search tool with the right query?"
- "Generate 100 synthetic test samples from my 5 seed examples."

## What's Covered

Index of the Evaluations API surface this reference documents (names only — see the skill for signatures, code, and discipline):

### Defining an evaluation
`Evaluation` protocol · `Metric` · `Evaluator` / `EvaluatorsBuilder` · `ModelSubject`

### Datasets
`ModelSample` · `ArrayLoader` · `JSONLoader` · `StreamLoader` · `Loader` · `makeSamples` · `SampleGenerator`

### Running & aggregating
`.evaluates` Swift Testing trait · `EvaluationContext` · `EvaluationResult.aggregateValue` · `MetricsAggregator` · `AggregationOperation`

### Model-as-judge
`ModelJudgeEvaluator` · `ScoringScale` (`.numeric` / `.passFail` / `.custom`) · `ScoreDimension` · `ScoringMode` · `ModelJudgePrompt`

### Agentic / tool-call evaluation
`ToolCallEvaluator` · `TrajectoryExpectation` · `ToolExpectation` · `ArgumentMatcher`

## Documentation Scope

This page documents the `foundation-models-evaluations-ref` skill, which Claude loads automatically when you ask about measuring or testing a Foundation Models feature.

- For building the feature itself, see [foundation-models](/skills/integration/foundation-models)
- For the core Foundation Models API, see [foundation-models-ref](/reference/foundation-models-ref)
- The four-axis eval discipline for custom adapters lives in [foundation-models-adapters](/skills/integration/foundation-models-adapters); on the 27 cycle, express those axes as metrics here

The Evaluations framework ships on iOS, iPadOS, macOS, watchOS, and visionOS 27 (not tvOS). It is a Developer/test-time framework — link it from your test target.
