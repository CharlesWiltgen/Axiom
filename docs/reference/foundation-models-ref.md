---
name: foundation-models-ref
description: Apple Intelligence Foundation Models framework — LanguageModelSession, @Generable, streaming, tool calling, context management (iOS 26+)
---

# Foundation Models Reference

API reference for Apple's on-device Foundation Models framework — `LanguageModelSession`, `@Generable` structured output, `streamResponse` streaming, the `Tool` protocol, and context management. API names verified against the Xcode 27 SDK; based on WWDC 2025 sessions 286, 259, and 301.

## When to Use This Reference

Use this reference when you're:

- Running an on-device prompt with `LanguageModelSession`
- Defining `@Generable` output types with `@Guide` constraints
- Streaming a response to update UI progressively
- Building a `Tool` for the model to call
- Choosing a `SystemLanguageModel` use case (e.g. content tagging)
- Managing the context window or handling generation errors

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I run an on-device prompt with Foundation Models?"
- "How do I get structured output from the model with `@Generable`?"
- "How do I stream a response and update the UI as it generates?"
- "How do I let the model call one of my functions (tool calling)?"
- "Which `SystemLanguageModel` use case do I pick for content tagging?"
- "How do I handle a guardrail violation or an exceeded context window?"
- "How do I check model availability before using it?"

## What's Covered

### LanguageModelSession
- `SystemLanguageModel(useCase:guardrails:)` — `.general`, `.contentTagging`, …
- Text: `respond(to:)` → `Response<String>` (`.content`)
- Structured: `respond(to:generating:)` → `Response<Content>` (`.content`)
- Streaming: `streamResponse(to:generating:)` → `ResponseStream<Content>`
- `GenerationOptions` (temperature, sampling); context management

### @Generable Structured Output
- `@Generable` macro; `@Guide(description:_:)` constraints, enums, regex
- Nested generables, arrays, `GenerationSchema`, dynamic schemas

### Streaming
- `ResponseStream<Content>` is an `AsyncSequence` of **partial snapshots** (not an enum)
- Progressive UI, cancellation, mid-stream error handling

### Tool Calling
- `Tool` protocol: `associatedtype Arguments: ConvertibleFromGeneratedContent` (a `@Generable`), `func call(arguments:) async throws -> Output`
- Multi-turn tool use *(no `@Tool`/`@Parameter` macros — conform to the protocol)*

### Errors & Availability
- `LanguageModelError` (`.contextSizeExceeded`, `.guardrailViolation`, `.rateLimited`, `.refusal`, `.unsupportedCapability`, …) and `LanguageModelSession.GenerationError`
- `SystemLanguageModel.availability` before use

## Key Patterns

### Basic text generation

```swift
import FoundationModels

let session = LanguageModelSession()
let response = try await session.respond(to: "Summarize this article…")
print(response.content)        // Response<String>.content
```

### Structured output with @Generable

```swift
@Generable
struct MovieReview {
    @Guide(description: "1–5 star rating")
    var rating: Int
    var summary: String
    var pros: [String]
    var cons: [String]
}

let review = try await session.respond(
    to: "Review the movie Inception",
    generating: MovieReview.self
).content                      // Response<MovieReview>.content
```

For **streaming** (`streamResponse(to:generating:)`), the **`Tool` protocol**, content-tagging use cases, and **error handling** — the full, pressure-tested code lives in the [foundation-models](/skills/integration/foundation-models) skill (a doc page is an index, not the code home).

## Documentation Scope

This page is the `foundation-models-ref` API map — names, signatures, and the two most fundamental patterns. The discipline-enforcing workflows, anti-patterns, and the complete code (streaming, tools, errors) live in the [foundation-models](/skills/integration/foundation-models) skill; systematic troubleshooting lives in [foundation-models-diag](/diagnostic/foundation-models-diag).

## Related Resources

- [foundation-models](/skills/integration/foundation-models) — discipline-enforcing skill with anti-patterns and the full code
- [foundation-models-diag](/diagnostic/foundation-models-diag) — systematic troubleshooting under pressure
- [foundation-models-adapters-ref](/reference/foundation-models-adapters-ref) — training and loading LoRA adapters
- [WWDC 2025/286](https://developer.apple.com/videos/play/wwdc2025/286/) — Meet the Foundation Models framework
- [WWDC 2025/259](https://developer.apple.com/videos/play/wwdc2025/259/) — Build intelligent apps with Apple Intelligence
- [WWDC 2025/301](https://developer.apple.com/videos/play/wwdc2025/301/) — Deep dive into Foundation Models
