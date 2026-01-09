---
name: axiom-ios-concurrency
description: Use when writing ANY code with async, actors, threads, or seeing ANY concurrency error. Covers Swift 6 concurrency, @MainActor, Sendable, data races, async/await patterns, performance optimization.
user-invocable: false
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

**Swift 6 concurrency patterns** → `/skill axiom-swift-concurrency`
- async/await patterns
- @MainActor usage
- Actor isolation
- Sendable conformance
- Data race prevention
- Swift 6 migration

**Swift performance** → `/skill axiom-swift-performance`
- Value vs reference types
- Copy-on-write optimization
- ARC overhead
- Generic specialization
- Collection performance

**Synchronous actor access** → `/skill axiom-assume-isolated`
- MainActor.assumeIsolated
- @preconcurrency protocol conformances
- Legacy delegate callbacks
- Testing MainActor code synchronously

**Thread-safe primitives** → `/skill axiom-synchronization`
- Mutex (iOS 18+)
- OSAllocatedUnfairLock (iOS 16+)
- Atomic types
- Lock vs actor decision

**Parameter ownership** → `/skill axiom-ownership-conventions`
- borrowing/consuming modifiers
- Noncopyable types (~Copyable)
- ARC traffic reduction
- consume operator

**Concurrency profiling** → `/skill axiom-concurrency-profiling`
- Swift Concurrency Instruments template
- Actor contention diagnosis
- Thread pool exhaustion
- Task visualization

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
  ├─ assumeIsolated questions? → assume-isolated
  │
  ├─ Mutex/lock/synchronization? → synchronization
  │
  ├─ borrowing/consuming/ownership? → ownership-conventions
  │
  ├─ Profile async performance? → concurrency-profiling
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
→ Invoke: `/skill axiom-swift-concurrency`

User: "How do I use @MainActor correctly?"
→ Invoke: `/skill axiom-swift-concurrency`

User: "My app is slow due to unnecessary copying"
→ Invoke: `/skill axiom-swift-performance`

User: "Should I use async/await for this network call?"
→ Invoke: `/skill axiom-swift-concurrency`

User: "How do I use assumeIsolated?"
→ Invoke: `/skill axiom-assume-isolated`

User: "My delegate callback runs on main thread, how do I access MainActor state?"
→ Invoke: `/skill axiom-assume-isolated`

User: "Should I use Mutex or actor?"
→ Invoke: `/skill axiom-synchronization`

User: "What's the difference between os_unfair_lock and OSAllocatedUnfairLock?"
→ Invoke: `/skill axiom-synchronization`

User: "What does borrowing do in Swift?"
→ Invoke: `/skill axiom-ownership-conventions`

User: "How do I use ~Copyable types?"
→ Invoke: `/skill axiom-ownership-conventions`

User: "My async code is slow, how do I profile it?"
→ Invoke: `/skill axiom-concurrency-profiling`

User: "I think I have actor contention, how do I diagnose it?"
→ Invoke: `/skill axiom-concurrency-profiling`
