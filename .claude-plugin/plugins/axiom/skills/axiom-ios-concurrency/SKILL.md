---
name: axiom-ios-concurrency
description: Use when writing ANY code with async, actors, threads, or seeing ANY concurrency error. Covers Swift 6 concurrency, @MainActor, Sendable, data races, async/await patterns, performance optimization.
license: MIT
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

**ios-concurrency vs ios-data**: When concurrency errors involve Core Data or SwiftData:
- Core Data threading (NSManagedObjectContext thread confinement, performBackgroundTask) → **use ios-data first** — Core Data has its own threading model distinct from Swift concurrency
- SwiftData + @MainActor ModelContext → **use ios-concurrency** — This is Swift concurrency isolation
- General "background saves losing data" → **use ios-data first** — Framework-specific threading rules take priority

**Rationale**: A 2-second freeze during data loading is almost always `await` on main thread or missing background dispatch. Domain knowledge solves this faster than Time Profiler. Core Data threading violations need Core Data-specific fixes, not generic concurrency patterns.

## Routing Logic

### Swift Concurrency Issues

**Swift 6 concurrency patterns** → `/skill axiom-swift-concurrency`
- async/await patterns
- @MainActor usage
- Actor isolation
- Sendable conformance
- Data race prevention
- Swift 6 migration

**Swift concurrency API reference** → `/skill axiom-swift-concurrency-ref`
- Actor definition, reentrancy, global actors
- Sendable patterns, @unchecked Sendable
- Task/TaskGroup/cancellation API
- AsyncStream, continuations
- DispatchQueue → actor migration

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

### Automated Scanning

**Concurrency audit** → Launch `concurrency-auditor` agent or `/axiom:audit concurrency` (Swift 6 strict concurrency violations, unsafe Task captures, missing @MainActor, Sendable violations, actor isolation problems)

## Decision Tree

1. Data races / actor isolation / @MainActor / Sendable? → swift-concurrency
1a. Need specific API syntax (actor definition, TaskGroup, AsyncStream, continuation)? → swift-concurrency-ref
2. Writing async/await code? → swift-concurrency
3. Swift 6 migration? → swift-concurrency
4. assumeIsolated / @preconcurrency? → assume-isolated
5. Mutex / lock / synchronization? → synchronization
6. borrowing / consuming / ~Copyable? → ownership-conventions
7. Profile async performance / actor contention? → concurrency-profiling
8. Value type / ARC / generic optimization? → swift-performance
9. Want automated concurrency scan? → concurrency-auditor (Agent)

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Just add @MainActor and it'll work" | @MainActor has isolation inheritance rules. swift-concurrency covers all patterns. |
| "I'll use nonisolated(unsafe) to silence the warning" | Silencing warnings hides data races. swift-concurrency shows the safe pattern. |
| "It's just one async call" | Even single async calls have cancellation and isolation implications. swift-concurrency covers them. |
| "I know how actors work" | Actor reentrancy and isolation rules changed in Swift 6.2. swift-concurrency is current. |
| "I'll fix the Sendable warnings later" | Sendable violations cause runtime crashes. swift-concurrency fixes them correctly now. |

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

User: "My Core Data saves lose data from background tasks"
→ Route to: `ios-data` router (Core Data threading is framework-specific)

User: "How do I create a TaskGroup?"
→ Invoke: `/skill axiom-swift-concurrency-ref`

User: "What's the AsyncStream API?"
→ Invoke: `/skill axiom-swift-concurrency-ref`

User: "How do I create a custom global actor?"
→ Invoke: `/skill axiom-swift-concurrency-ref`

User: "How do I convert a completion handler to async?"
→ Invoke: `/skill axiom-swift-concurrency-ref`

User: "What are the actor reentrancy rules?"
→ Invoke: `/skill axiom-swift-concurrency-ref`

User: "Check my code for Swift 6 concurrency issues"
→ Invoke: `concurrency-auditor` agent
