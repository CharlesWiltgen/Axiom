# Swift Concurrency Reference

Complete API reference for Swift's concurrency model — actors, Sendable, Task management, async sequences, continuations, and migration patterns from GCD.

## When to Use This Reference

Use this reference when:
- Looking up actor definition syntax or reentrancy rules
- Implementing Sendable conformance for your types
- Creating TaskGroups for parallel work
- Working with AsyncStream or custom AsyncSequence
- Bridging callback-based APIs with continuations
- Migrating from DispatchQueue/DispatchGroup to actors/TaskGroup

## Example Prompts

- "How do I create a TaskGroup in Swift?"
- "What's the AsyncStream continuation API?"
- "How do I make a custom global actor?"
- "How do I convert a completion handler to async/await?"
- "What are the actor reentrancy rules?"
- "How do I make my class Sendable?"
- "What's the difference between Task and Task.detached?"

## What's Covered

- Actor patterns (definition, nonisolated, reentrancy, global actors, gotcha table)
- Sendable patterns (struct/enum, @Sendable closures, @unchecked, conditional, gotcha table)
- Task management (Task, Task.detached, cancellation, priority, @TaskLocal, gotcha table)
- Structured concurrency (async let, TaskGroup, task tree semantics, gotcha table)
- Async sequences (AsyncStream, continuation API, buffering, custom AsyncSequence, gotcha table)
- Isolation patterns (@MainActor, nonisolated, #isolation, sending, gotcha table)
- Continuations (withCheckedContinuation, resume-exactly-once, bridging, gotcha table)
- Migration patterns (DispatchQueue to actor, DispatchGroup to TaskGroup, callbacks to async, gotcha table)
- API quick reference table with Swift version requirements

## Documentation Scope

This page documents the `axiom-swift-concurrency-ref` skill — the API reference Claude uses for Swift concurrency syntax and patterns.

**For the progressive journey and decision trees:** See [Swift Concurrency](/skills/concurrency/swift-concurrency) for *when* and *why* to introduce concurrency, plus 11 copy-paste patterns.

## Related

- [Swift Concurrency](/skills/concurrency/swift-concurrency) — Progressive journey from single-threaded to concurrent code, decision trees, @concurrent and isolated conformances
- [Synchronization](/skills/concurrency/synchronization) — Mutex, OSAllocatedUnfairLock, atomic types (when you need locks instead of actors)
- [assumeIsolated](/skills/concurrency/assume-isolated) — Synchronous actor access patterns
- [Concurrency Profiling](/skills/concurrency/concurrency-profiling) — Instruments workflows for async performance

## Resources

**WWDC**: 2021-10132, 2021-10134, 2022-110350, 2025-268

**Skills**: axiom-swift-concurrency, axiom-synchronization, axiom-assume-isolated, axiom-concurrency-profiling
