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
- **App freezes during loading** (likely main thread blocking)

## Conflict Resolution

**ios-concurrency vs ios-performance**: When app freezes or feels slow:
1. **Try ios-concurrency FIRST** — Main thread blocking is the #1 cause of UI freezes. Check for synchronous work on @MainActor before profiling.
2. **Only use ios-performance** if concurrency fixes don't help — Profile after ruling out obvious blocking.

**ios-concurrency vs ios-build**: When seeing Swift 6 concurrency errors:
- **Use ios-concurrency, NOT ios-build** — Concurrency errors are CODE issues, not environment issues
- ios-build is for "No such module", simulator issues, build failures unrelated to Swift language errors

**Rationale**: A 2-second freeze during data loading is almost always `await` on main thread or missing background dispatch. Domain knowledge solves this faster than Time Profiler.

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
