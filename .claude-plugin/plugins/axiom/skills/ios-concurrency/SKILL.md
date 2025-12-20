---
name: ios-concurrency
description: Use when writing ANY code with async, actors, threads, or seeing ANY concurrency error. Covers Swift 6 concurrency, @MainActor, Sendable, data races, async/await patterns, performance optimization.
---

# iOS Concurrency Router

**You MUST use this skill for ANY concurrency, async/await, threading, or Swift 6 concurrency work.**

## When to Use

Use this router when:
- Writing async/await code
- Seeing concurrency errors (data races, actor isolation)
- Working with @MainActor
- Dealing with Sendable conformance
- Optimizing Swift performance
- Migrating to Swift 6 concurrency

## Routing Logic

### Swift Concurrency Issues

**Swift 6 concurrency patterns** → `/skill swift-concurrency`
- async/await patterns
- @MainActor usage
- Actor isolation
- Sendable conformance
- Data race prevention
- Swift 6 migration

**Swift performance** → `/skill swift-performance`
- Value vs reference types
- Copy-on-write optimization
- ARC overhead
- Generic specialization
- Collection performance

## Decision Tree

```
User asks about concurrency
  ├─ Concurrency errors?
  │  ├─ Data races? → swift-concurrency
  │  ├─ Actor isolation? → swift-concurrency
  │  ├─ @MainActor? → swift-concurrency
  │  └─ Sendable? → swift-concurrency
  │
  ├─ Writing async code? → swift-concurrency
  │
  └─ Performance optimization? → swift-performance
```

## Critical Patterns

**Swift 6 Concurrency** (swift-concurrency):
- Progressive journey: single-threaded → async → concurrent → actors
- @concurrent attribute for forced background execution
- Isolated conformances
- Main actor mode for approachable concurrency
- 11 copy-paste patterns

**Swift Performance** (swift-performance):
- ~Copyable for non-copyable types
- Copy-on-write (COW) patterns
- Value vs reference type decisions
- ARC overhead reduction
- Generic specialization

## Example Invocations

User: "I'm getting 'data race' errors in Swift 6"
→ Invoke: `/skill swift-concurrency`

User: "How do I use @MainActor correctly?"
→ Invoke: `/skill swift-concurrency`

User: "My app is slow due to unnecessary copying"
→ Invoke: `/skill swift-performance`

User: "Should I use async/await for this network call?"
→ Invoke: `/skill swift-concurrency`
