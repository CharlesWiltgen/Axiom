---
name: foundation-models-ref
description: Apple Intelligence Foundation Models framework — LanguageModelSession, @Generable, streaming, tool calling, context management, and the 27-release additions (Private Cloud Compute, image input, reasoning)
---

# Foundation Models Reference

API reference for Apple's Foundation Models framework: `LanguageModelSession`, `@Generable` structured output, streaming, the `Tool` protocol, context management, and the 27-release additions such as the larger Private Cloud Compute model. API names are verified against the Xcode 27 SDK and drawn from the WWDC 2025 and 2026 sessions.

## When to Use This Reference

Use this reference when you're:

- Running an on-device prompt with `LanguageModelSession`
- Defining `@Generable` output types with `@Guide` constraints
- Streaming a response to update UI progressively
- Building a `Tool` for the model to call
- Choosing a `SystemLanguageModel` use case, such as content tagging
- Managing the context window or handling generation errors
- Moving to the Private Cloud Compute model, image input, or reasoning in the 27 releases
- Running the on-device model on Apple TV (tvOS 27.3)

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "How do I run an on-device prompt with Foundation Models?"
- "How do I get structured output from the model with `@Generable`?"
- "How do I stream a response and update the UI as it generates?"
- "How do I let the model call one of my functions?"
- "Which `SystemLanguageModel` use case do I pick for content tagging?"
- "How do I handle a guardrail violation or an exceeded context window?"
- "How do I check model availability before using it?"
- "How do I use the larger Private Cloud Compute model in iOS 27 for a bigger context window?"
- "How do I send an image into a Foundation Models prompt?"
- "How do I set a reasoning level and read token usage on a response?"
- "How do I use the built-in barcode, OCR, or Spotlight search tools?"
- "Can I use Foundation Models on Apple TV?"
- "How does a tool keep state across turns with `@SessionState` and `@SessionBinding`?"

## What's Covered

### LanguageModelSession
- `SystemLanguageModel(useCase:)` – `.general`, `.contentTagging`, …
- Text: `respond(to:)` → `Response<String>` (`.content`)
- Structured: `respond(to:generating:)` → `Response<Content>` (`.content`)
- Streaming: `streamResponse(to:generating:)` → `ResponseStream<Content>`
- Instructions vs. prompts; multi-turn context, `transcript`, `isResponding`
- `GenerationOptions` (`samplingMode`, `temperature`, `maximumResponseTokens`)

### @Generable Structured Output
- `@Generable` macro; `@Guide(description:_:)` constraints, enums, regex
- Nested generables, arrays, constrained decoding, property order
- `GenerationSchema` and dynamic schemas

### Streaming
- `ResponseStream<Content>` is an `AsyncSequence` of **partial snapshots**, not an enum
- Progressive UI, cancellation, mid-stream error handling

### Tool Calling
- `Tool` protocol: `associatedtype Arguments: ConvertibleFromGeneratedContent` (a `@Generable`), `func call(arguments:) async throws -> Output`
- Stateful tools, tool output, naming, multiple tools
- No `@Tool` or `@Parameter` macros; conform to the protocol

### Errors and Availability
- `LanguageModelError` cases with typed payloads (`.contextSizeExceeded`, `.guardrailViolation`, `.rateLimited`, `.refusal`, `.timeout`, `.unsupportedCapability`, …)
- `.refusal` vs. `.guardrailViolation`
- Errors split out of the old enum: `SystemLanguageModel.Error`, `LanguageModelSession.Error`, `GeneratedContent.ParsingError`, `ToolCallError`
- Migrating from the deprecated `LanguageModelSession.GenerationError`
- Preflight checks: `availability`, `supportsLocale(_:)`, `capabilities`, `contextSize`
- Context window management: fresh session, condensed session, fallback architecture
- Supported languages, token counting, and the 8,192-token on-device context window in the 27 releases

### Performance
- Foundation Models Instrument, including the Xcode 27 version
- Prewarming, `includeSchemaInPrompt`, property order

### Additions in the 27 Releases
- `LanguageModel` protocol + `LanguageModelCapabilities` (`.vision`/`.guidedGeneration`/`.reasoning`/`.toolCalling`); generic `model: some LanguageModel` sessions
- Private Cloud Compute: `PrivateCloudComputeLanguageModel` (availability, quota, 32K context, typed errors, entitlement; reaches watchOS 27)
- Multimodal: `Attachment<ImageAttachmentContent>` image input in a prompt builder
- Reasoning + usage: `ContextOptions(reasoningLevel:)`, `session.usage`/`response.usage`
- Dynamic Profiles: `LanguageModelSession.DynamicProfile` / `Profile` / `init(profile:)`, full modifier surface + `@SessionProperty`
- Dynamic Instructions: `DynamicInstructions` builder that re-derives instructions + tools per request (distinct from Dynamic Profiles)
- Custom model providers: `LanguageModel` / `LanguageModelExecutor` back a session with your own model (MLX, Core AI, server)
- `ImageReference` – `@Generable` tool argument that references an image already in the conversation
- `GenerationOptions.ToolCallingMode`
- Built-in system tools: `BarcodeReaderTool`, `OCRTool`, `SpotlightSearchTool` (local RAG)
- `@Generable(name:)` explicit schema name
- tvOS 27.3: the on-device model, sessions, `@Generable`, guardrails, image input and Dynamic Profiles on Apple TV (not Private Cloud Compute, custom adapters, or the barcode and OCR tools)

### Xcode 27.3 SDK Additions
- `Group { … }` (`DynamicInstructionsGroup`) and `.onActivate` / `.onDeactivate` on `DynamicInstructions`
- `@SessionState` / `@SessionBinding` session-lifetime state, and the Swift 6 `Sendable` workaround for tools that store a binding
- `.onDataEntry` on a `DynamicProfile` (`Transcript.DataEntry`, `supportsDataEntryType(_:)`)
- `@Guide(key:description:)` overloads

### Also Covered
- Feedback to Apple with `logFeedbackAttachment`
- Xcode Playgrounds (`#Playground`)
- Migrating from server LLMs and from manual JSON parsing
- The wider ecosystem: the open-source framework, MLX and Core AI models, the `fm` command-line tool, and the Python SDK

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

## Documentation Scope

This page documents the `foundation-models-ref` skill (in the `axiom-ai` suite): the API names, signatures, and the two most fundamental patterns. The discipline workflows, anti-patterns, and complete code for streaming, tools, and errors live in the [foundation-models](/skills/integration/foundation-models) skill. Troubleshooting lives in [foundation-models-diag](/diagnostic/foundation-models-diag).

## Related

- [foundation-models-adapters-ref](/reference/foundation-models-adapters-ref) – Training and loading custom adapters when the built-in content-tagging adapter falls short
- [foundation-models-evaluations-ref](/reference/foundation-models-evaluations-ref) – Measuring a Foundation Models feature's quality as you change prompts or models

## Resources

**WWDC**: 2025-286, 2025-259, 2025-301, 2026-237, 2026-241, 2026-242, 2026-243, 2026-319, 2026-339, 2026-347

**Docs**: /foundationmodels, /foundationmodels/privatecloudcomputelanguagemodel, /foundationmodels/attachment
