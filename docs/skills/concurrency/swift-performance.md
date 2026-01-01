---
name: swift-performance
description: Swift 6 language-level performance optimization — noncopyable types, COW, ARC, generics
---

# Swift Performance Optimization

Language-level performance patterns for memory efficiency, runtime speed, and zero-cost abstractions. **Profile first, optimize later** — use this skill after Instruments identifies Swift code as the bottleneck.

## When to Use

Use this skill when:
- Time Profiler shows Swift code as hotspot
- Excessive memory allocations or retain/release traffic
- Implementing performance-critical algorithms
- Writing framework code with performance requirements
- Optimizing tight loops or frequently called methods

**Do NOT use for**:
- First-step optimization (use performance-profiling first)
- SwiftUI performance (use swiftui-performance)
- Premature optimization

## Example Prompts

- "Profiler shows excessive copying — how do I eliminate it?"
- "Retain/release overhead in Time Profiler — how to reduce?"
- "Generic code is slow in hot path"
- "Actor overhead causing UI jank"

## What This Skill Provides

### Core Topics

1. **Noncopyable Types** — Swift 6 `~Copyable` for types that should never be copied
2. **Copy-on-Write** — Use `isKnownUniquelyReferenced()` and `reserveCapacity()`
3. **Value vs Reference** — Structs under 64 bytes are fast; larger need indirect storage
4. **ARC Optimization** — `unowned` is ~2x faster than `weak`
5. **Generics** — Use `some` over `any` for static dispatch
6. **Collection Performance** — `ContiguousArray` is ~15% faster than `Array`
7. **Concurrency** — Actor hops cost ~100μs; batch calls

### Eliminate Copying

```swift
// ❌ Expensive copy
func process(_ data: ImageData) { ... }

// ✅ Zero-cost borrowing
func process(borrowing data: ImageData) { ... }
```

### Actor Batching

```swift
// ❌ 10,000 actor hops (~1 second)
for _ in 0..<10000 {
    await counter.increment()
}

// ✅ Single hop (~0.1ms)
await counter.incrementBatch(10000)
```

### Generic Specialization

```swift
// ❌ Dynamic dispatch
func render(shapes: [any Shape]) { ... }

// ✅ Static dispatch (10x faster)
func render<S: Shape>(shapes: [S]) { ... }
```

### Code Review Checklist

- Large structs (>64 bytes) use indirect storage
- Collections use `reserveCapacity` when size known
- Prefer `unowned` over `weak` when lifetime guaranteed
- Use `some` instead of `any` where possible
- Batch actor calls in loops

## Related

- [performance-profiling](/skills/debugging/performance-profiling) — Use this first to identify bottlenecks
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Correctness-focused concurrency
- [swiftui-performance](/skills/ui-design/swiftui-performance) — SwiftUI-specific optimization

## Resources

**WWDC**: 2024-10229 (Swift performance), 2016-416 (Understanding Swift Performance)
