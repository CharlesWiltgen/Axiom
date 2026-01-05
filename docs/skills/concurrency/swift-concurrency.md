---
name: swift-concurrency
description: Swift 6 strict concurrency patterns — progressive journey from single-threaded to concurrent code with @concurrent attribute (WWDC 2025), actor isolation, Sendable, async/await, and data race prevention
---

# Swift 6 Concurrency

Progressive journey from single-threaded to concurrent Swift code. Covers Swift 6 strict concurrency, `@concurrent` attribute (Swift 6.2+), actor isolation, and data race prevention.

## When to Use This Skill

Use this skill when you're:
- Starting a new project and deciding concurrency strategy
- Debugging Swift 6 concurrency errors (actor isolation, data races, Sendable)
- Deciding when to introduce async/await vs full concurrency
- Implementing `@MainActor` classes or async functions
- Converting delegate callbacks to async-safe patterns
- Resolving "Sending 'self' risks causing data races" errors
- Offloading CPU-intensive work to background threads

**Apple's guidance:** "Start single-threaded. Add complexity only when profiling shows you need it."

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "I'm getting 'Sending self risks causing data races'. How do I fix this?"
- "When should I use @MainActor vs nonisolated vs @concurrent?"
- "My UI freezes during image processing. How do I move it off the main thread?"
- "How do I make my type conform to Sendable?"
- "What's the difference between async/await and actual concurrency?"
- "How do I convert a delegate callback to async/await?"
- "When do I need an actor vs just @MainActor?"
- "My app compiles but crashes with data race. How do I debug?"

## What's Covered

### The Progressive Journey
```
Single-Threaded → Asynchronous → Concurrent → Actors
     ↓                ↓             ↓           ↓
   Start here    Hide latency   Background   Move data
                 (network)      CPU work     off main
```

### Core Concepts
- **@MainActor** — Isolate to main thread (UI code)
- **nonisolated** — Opt out of actor isolation
- **@concurrent** (Swift 6.2+) — Force background execution
- **Sendable** — Safe to pass between threads
- **Actor** — Isolated mutable state

### Common Patterns
- Async/await for network calls
- Task groups for parallel operations
- Actor-isolated data managers
- MainActor for SwiftUI state
- Continuation for bridging callbacks

### Error Resolution
- "Sending 'self' risks causing data races"
- "Non-sendable type cannot cross actor boundary"
- "Actor-isolated property cannot be mutated"
- "Call to main actor-isolated function in synchronous context"

### Xcode 26 Features
- Main Actor mode build settings
- Approachable concurrency defaults
- Isolated conformances

## Key Pattern

### The Progressive Decision

```swift
// Step 1: Start single-threaded (default)
@MainActor
class ImageLoader {
    func loadImage() -> UIImage { ... }  // ✅ Start here
}

// Step 2: Add async when I/O blocks UI
@MainActor
class ImageLoader {
    func loadImage() async -> UIImage {
        let data = await network.fetch(url)  // ✅ Hides latency
        return UIImage(data: data)!
    }
}

// Step 3: Add @concurrent when CPU work freezes UI
@MainActor
class ImageLoader {
    @concurrent  // Swift 6.2+
    func processImage(_ data: Data) -> UIImage {
        // ✅ Runs on background thread
        return expensiveProcessing(data)
    }
}
```

## Documentation Scope

This page documents the `axiom-swift-concurrency` skill—comprehensive Swift 6 concurrency guidance Claude uses when answering your questions. The skill contains the complete progressive journey, 11 copy-paste patterns, error resolution guides, and decision trees.

**For concurrency audits:** Use the [concurrency-auditor](/agents/concurrency-auditor) agent to scan for Swift 6 strict concurrency violations automatically.

## Related

- [concurrency-auditor](/agents/concurrency-auditor) — Autonomous agent scanning for concurrency violations
- [/axiom:audit-concurrency](/commands/concurrency/audit-concurrency) — Quick scan for unsafe patterns
- [swift-performance](/skills/concurrency/swift-performance) — CPU and threading performance optimization
- [swiftdata](/skills/persistence/swiftdata) — SwiftData's @MainActor requirements

## Resources

**WWDC**: 2025-268, 2024-10169, 2023-10164, 2022-10144

**Docs**: /swift/concurrency, /swift/sendable
