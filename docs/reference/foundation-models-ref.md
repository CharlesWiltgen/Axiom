---
name: foundation-models-ref
description: Apple Intelligence Foundation Models framework — LanguageModelSession, @Generable, streaming, tool calling, context management (iOS 26+)
---

# Foundation Models Reference

Complete API reference for Apple's Foundation Models framework covering on-device AI with LanguageModelSession, @Generable structured output, streaming, tool calling, and context management.

## Overview

Comprehensive guide to Apple Intelligence based on WWDC 2025 sessions 286, 259, and 301, covering all 26 official code examples, @Generable structured output, streaming with PartiallyGenerated, Tool protocol, and dynamic schemas.

## What This Reference Covers

### LanguageModelSession
- Session creation and configuration
- Text generation with respond()
- Streaming with respond(stream:)
- Context management and limits
- Generation options (temperature, sampling)

### @Generable Structured Output
- Automatic Swift type generation
- @Guide constraints and enums
- Nested generable types
- Custom descriptions
- Array generation

### Streaming
- AsyncSequence patterns
- PartiallyGenerated for progressive UI
- Error handling mid-stream
- Cancellation

### Tool Calling
- Tool protocol implementation
- Parameter passing
- Tool result handling
- Multi-turn conversations

### Dynamic Schemas
- Runtime schema construction
- Conditional field inclusion
- Validation patterns

## When to Use This Reference

Use this reference when:
- Implementing on-device AI features
- Defining @Generable output types
- Adding streaming responses to UI
- Building tools for the model
- Managing context window limits
- Debugging guardrail violations

## Key Patterns

### Basic Text Generation

```swift
import FoundationModels

let session = LanguageModelSession()
let response = try await session.respond(to: "Summarize this article...")
print(response.content)
```

### @Generable Structured Output

```swift
@Generable
struct MovieReview {
    @Guide(description: "1-5 star rating")
    var rating: Int

    var summary: String
    var pros: [String]
    var cons: [String]
}

let review: MovieReview = try await session.respond(
    to: "Review the movie Inception",
    generating: MovieReview.self
)
```

### Streaming Responses

```swift
for try await partial in session.respond(
    to: prompt,
    generating: Summary.self,
    stream: true
) {
    if case .partial(let summary) = partial {
        // Update UI with partial.content
    }
}
```

### Tool Protocol

```swift
@Tool
struct SearchTool: Tool {
    static let description = "Search the web"

    @Parameter(description: "Search query")
    var query: String

    func call() async throws -> String {
        // Perform search, return results
    }
}
```

## Complete API Coverage

This reference includes:
- All 26 WWDC 2025 code examples with annotations
- Complete LanguageModelSession API
- @Generable macro with all options
- @Guide constraints and validation
- Tool protocol implementation
- Streaming patterns with PartiallyGenerated
- Context management strategies
- Error handling and guardrails
- Performance profiling with Instruments

## Built-in Use Cases

```swift
// Content tagging
let tags = try await session.contentTagging(for: article)

// Summarization
let summary = try await session.summarize(content)
```

## Error Handling

```swift
do {
    let response = try await session.respond(to: prompt)
} catch let error as LanguageModelError {
    switch error {
    case .contextExceeded:
        // Reduce input size
    case .guardrailViolation:
        // Content not allowed
    case .unavailable:
        // Model not ready
    }
}
```

## Related Resources

- [foundation-models](/skills/integration/foundation-models) — Discipline-enforcing skill with anti-patterns
- [foundation-models-diag](/diagnostic/foundation-models-diag) — Systematic troubleshooting
- [WWDC 2025/286](https://developer.apple.com/videos/play/wwdc2025/286/) — Introducing Foundation Models
- [WWDC 2025/259](https://developer.apple.com/videos/play/wwdc2025/259/) — Build intelligent apps
- [WWDC 2025/301](https://developer.apple.com/videos/play/wwdc2025/301/) — Advanced Foundation Models

## Documentation Scope

This is a **reference skill** — comprehensive API guide without mandatory workflows.

#### Reference includes
- Complete Foundation Models API (iOS 26+)
- All WWDC 2025 code examples
- @Generable and @Guide documentation
- Tool protocol patterns
- Streaming and context management

**Vs Diagnostic**: Reference skills provide information. Diagnostic skills enforce workflows and handle pressure scenarios.
