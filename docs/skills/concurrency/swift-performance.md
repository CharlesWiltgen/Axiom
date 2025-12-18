---
name: swift-performance
description: Swift 6 performance optimization — language-level patterns for memory efficiency, runtime speed, and zero-cost abstractions with noncopyable types, COW, ARC optimization, and generic specialization
---

# Swift Performance Optimization

**Purpose**: Optimize Swift code by understanding language-level performance characteristics
**Swift Version**: Swift 6.0+ (Swift 6.2 for `@concurrent`)
**iOS Version**: iOS 18+
**Xcode**: Xcode 16+
**Context**: Profile-guided optimization for memory, runtime, and allocation efficiency

## When to Use This Skill

✅ **Use this skill when**:
- App profiling shows Swift code as the bottleneck (Time Profiler hotspots)
- Excessive memory allocations or retain/release traffic
- Implementing performance-critical algorithms or data structures
- Writing framework or library code with performance requirements
- Optimizing tight loops or frequently called methods
- Dealing with large data structures or collections
- Code review identifying performance anti-patterns

❌ **Do NOT use this skill for**:
- **First step optimization** — Use `performance-profiling` first to measure
- **SwiftUI performance** — Use `swiftui-performance` skill instead
- **Build time optimization** — Use `build-performance` skill instead
- **Premature optimization** — Profile first, optimize later

## Core Topics

### 1. Noncopyable Types (~Copyable)
Swift 6.0+ introduces noncopyable types for performance-critical scenarios where implicit copies are expensive. Use for large types that should never be copied (file handles, GPU buffers).

### 2. Copy-on-Write (COW)
Swift collections use COW for efficient memory sharing. Understanding when copies happen is critical—use `isKnownUniquelyReferenced()` before mutations and `reserveCapacity()` to avoid unnecessary copies.

### 3. Value vs Reference Semantics
Structs under 64 bytes are fast (register-based), larger structs should use indirect storage or be classes. The decision affects both performance and memory usage.

### 4. ARC Optimization
Reduce retain/release overhead by using `unowned` instead of `weak` where lifetime is guaranteed (~2x faster), and capturing only needed values in closures instead of entire `self`.

### 5. Generics & Specialization
Generic code with concrete types specializes to fast static dispatch. Protocol types with `any` create existential containers with witness table overhead. Use `some` or `@_specialize` for performance.

### 6. Inlining
Small, frequently called functions benefit from `@inlinable` for cross-module optimization. Large functions marked `@inlinable` cause code bloat—inline selectively.

### 7. Collection Performance
Use `ContiguousArray` instead of `Array` for pure Swift (~15% faster), call `reserveCapacity()` before batch appends, and optimize `hash(into:)` implementations for Dictionary keys.

### 8. Concurrency Performance
Actor isolation adds overhead (~100μs per hop). Batch actor calls, keep synchronous operations synchronous, use `@concurrent` (Swift 6.2) to force background execution, and avoid creating tasks in tight loops.

### 9. Memory Layout
Struct field ordering affects size due to padding—order fields largest to smallest. Cache-friendly data structures (contiguous arrays) outperform pointer-chasing structures ~10x.

### 10. Typed Throws
Swift 6 typed throws avoid existential container overhead for error types (~5-10% faster than untyped). Use in hot paths with well-defined error types.

## Common Anti-Patterns

### ❌ Premature Optimization
Don't optimize without measurement. Profile first with Instruments Time Profiler to find actual bottlenecks, then optimize with data.

### ❌ Weak Everywhere
Using `weak` adds atomic operation overhead (~2x slower than `unowned`). Use `unowned` when lifetime guarantees exist (child lifetime < parent lifetime).

### ❌ Actor for Everything
Actors add overhead for simple synchronous operations. Use actors for shared mutable state, not simple counters or synchronous-only data.

### ❌ Inline Everything
Marking everything `@inlinable` causes code bloat and slower app launch. Inline only small (<10 lines), frequently called functions.

## Quick Decision Tree

```
Performance issue identified?
│
├─ Profiler shows excessive copying?
│  └─ → Noncopyable Types / Copy-on-Write
│
├─ Retain/release overhead in Time Profiler?
│  └─ → ARC Optimization
│
├─ Generic code in hot path?
│  └─ → Generics & Specialization
│
├─ Collection operations slow?
│  └─ → Collection Performance
│
├─ Async/await overhead visible?
│  └─ → Concurrency Performance
│
├─ Struct vs class decision?
│  └─ → Value vs Reference
│
└─ Memory layout concerns?
   └─ → Memory Layout
```

## Example: Eliminate Copying Overhead

**Problem**: Large struct copied on every function call

```swift
// ❌ Expensive copy
struct ImageData {
    var pixels: [UInt8]  // Large array
    var metadata: String
}

func process(_ data: ImageData) {  // Copies entire array!
    // ...
}
```

**Solution**: Use borrowing for read-only access

```swift
// ✅ No copy
func process(borrowing data: ImageData) {  // Zero-cost
    // ...
}
```

## Example: Actor Batching

**Problem**: Actor in tight loop causes UI jank

```swift
// ❌ 10,000 actor hops
for _ in 0..<10000 {
    await counter.increment()  // ~100μs each = 1 second!
}
```

**Solution**: Batch operations

```swift
// ✅ Single actor hop
await counter.incrementBatch(10000)  // 0.1ms
```

## Example: Generic Specialization

**Problem**: Protocol type overhead

```swift
// ❌ Existential container overhead
func render(shapes: [any Shape]) {
    for shape in shapes {
        shape.draw()  // Dynamic dispatch
    }
}
```

**Solution**: Use generic with constraint

```swift
// ✅ Static dispatch after specialization
func render<S: Shape>(shapes: [S]) {
    for shape in shapes {
        shape.draw()  // 10x faster
    }
}
```

## Code Review Checklist

### Memory Management
- [ ] Large structs (>64 bytes) use indirect storage or are classes
- [ ] COW types use `isKnownUniquelyReferenced` before mutation
- [ ] Collections use `reserveCapacity` when size is known
- [ ] Weak references only where needed (prefer unowned when safe)

### Generics
- [ ] Protocol types use `some` instead of `any` where possible
- [ ] Hot paths use concrete types or `@_specialize`

### Collections
- [ ] Pure Swift code uses `ContiguousArray` over `Array`
- [ ] Dictionary keys have efficient `hash(into:)` implementations

### Concurrency
- [ ] Synchronous operations don't use `async`
- [ ] Actor calls are batched when possible
- [ ] CPU-intensive work uses `@concurrent` (Swift 6.2)

## Automated Scanning

Use `/axiom:audit-swift-performance` to scan your codebase for:
- Unnecessary copies (large structs passed by value)
- Excessive ARC traffic (weak where unowned works)
- Unspecialized generics (any instead of some)
- Collection inefficiencies (missing reserveCapacity)
- Actor isolation overhead (tight loops)
- Memory layout problems (poor field ordering)

## WWDC Sessions

- **WWDC 2024-10229**: Explore Swift performance
- **WWDC 2023-10227**: What's new in Swift
- **WWDC 2022-110363**: Eliminate data races using Swift Concurrency
- **WWDC 2016-416**: Understanding Swift Performance

## Related Skills

- `performance-profiling` — Instruments workflows (use this first!)
- `swift-concurrency` — Correctness-focused concurrency patterns
- `swiftui-performance` — SwiftUI-specific optimizations
- `build-performance` — Compilation speed optimization

---

**Remember**: Profile first, optimize later. Readability > micro-optimizations. Use data to guide decisions.
