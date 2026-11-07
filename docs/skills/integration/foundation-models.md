---
name: foundation-models
description: On-device AI with Apple's Foundation Models framework (iOS 26+) — prevents context overflow, concurrent requests, wrong model use cases
---

# Foundation Models

Discipline-enforcing skill for Apple's Foundation Models framework covering LanguageModelSession, @Generable structured output, streaming, and tool calling.

## Overview

On-device AI patterns for iOS 26+ that prevent context overflow, concurrent requests, wrong model use cases, and manual JSON parsing when @Generable should be used.

## When to Use

Use this skill when:
- Implementing on-device AI features
- Using LanguageModelSession for text generation
- Defining @Generable output types
- Building tools for the model
- Streaming responses to UI
- Using the Private Cloud Compute model or sending images into a prompt (iOS 27)
- Setting reasoning levels, reading token usage, or using Dynamic Profiles (iOS 27)
- Running the on-device model on Apple TV (tvOS 27.3)

## Anti-Patterns Prevented

### Manual JSON Parsing
```swift
// ❌ WRONG: Manual JSON parsing
let response = try await session.respond(to: "Return JSON...")
let data = response.content.data(using: .utf8)!
let result = try JSONDecoder().decode(MyType.self, from: data)

// ✅ CORRECT: @Generable
@Generable
struct MyType {
    var field: String
}
let result: MyType = try await session.respond(
    to: prompt,
    generating: MyType.self
)
```

### Starting a Second Request While One Is Running
```swift
// ❌ WRONG: a second tap starts a second request on the same session,
// which throws concurrentRequests
Button("Generate") {
    Task { result = try await session.respond(to: prompt).content }
}

// ✅ CORRECT: no second request while the first is running
Button("Generate") {
    Task {
        do { result = try await session.respond(to: prompt).content }
        catch { errorMessage = error.localizedDescription }
    }
}
.disabled(session.isResponding)
```

### One Giant Prompt
```swift
// ❌ WRONG: Stuffing everything in one prompt
let response = try await session.respond(
    to: entireDocumentPlusAllInstructions  // Context exceeded!
)

// ✅ CORRECT: Chunking
let chunks = document.chunked(maxTokens: 2000)
for chunk in chunks {
    let summary = try await session.respond(to: "Summarize: \(chunk)")
    // Combine summaries
}
```

## Key Patterns

### Basic Generation
```swift
let session = LanguageModelSession()
let response = try await session.respond(to: "Your prompt")
```

### Structured Output
```swift
@Generable
struct Analysis {
    @Guide(description: "Sentiment: positive, negative, or neutral")
    var sentiment: String
    var confidence: Double
    var keyPoints: [String]
}

let response = try await session.respond(
    to: "Analyze this review...",
    generating: Analysis.self
)
let analysis = response.content   // Response<Analysis>.content
```

### Streaming
```swift
for try await snapshot in session.streamResponse(to: prompt) {
    updateUI(with: snapshot.content)
}
```

### Tool Calling
```swift
struct SearchTool: Tool {
    let name = "search"
    let description = "Search for information"

    @Generable
    struct Arguments {
        @Guide(description: "Search query")
        var query: String
    }

    func call(arguments: Arguments) async throws -> String {
        // Perform search using arguments.query
    }
}
```

## Pressure Scenarios

### ChatGPT API Pressure
**Scenario**: Team wants to use ChatGPT API instead of Foundation Models

**Response**:
- Foundation Models: On-device, private, no API costs
- ChatGPT: Requires network, data leaves device, ongoing costs
- Foundation Models: Works offline
- Use Foundation Models for privacy-sensitive features

### One Big Prompt Pressure
**Scenario**: "Just put everything in one prompt"

**Response**:
- Context limits exist (check documentation)
- Large prompts = slow generation
- Chunking provides better results
- Progressive disclosure improves UX

## Related Resources

- [foundation-models-ref](/reference/foundation-models-ref) – Complete API reference
- [foundation-models-diag](/diagnostic/foundation-models-diag) – Troubleshooting
- [WWDC 2025/286](https://developer.apple.com/videos/play/wwdc2025/286/) – Introduction
