---
name: audit-swift-performance
description: Scan for Swift-language performance anti-patterns — ARC overhead, allocation hotspots, missing generic specialization
---

# audit-swift-performance

Scan for performance anti-patterns at the Swift language level — overhead from ARC, unnecessary allocations, and code that prevents the optimizer from specializing generics.

## What This Command Does

Launches the **swift-performance-analyzer** agent to surface Swift-language performance issues that show up in Time Profiler and Allocations traces.

## What It Checks

1. **ARC issues** – excessive retain/release in hot paths, `@inlinable` opportunities, missing `consume`/`borrow` ownership
2. **Allocation patterns** – `Array.append` in tight loops without `reserveCapacity`, repeated `String` concatenation, unnecessary boxing
3. **Generic specialization** – public generics without `@inlinable` that compile to slow witness-table dispatch
4. **Existential overhead** – `any Protocol` parameters where `some Protocol` would specialize
5. **COW pitfalls** – copy-on-write types being mutated through multiple references, defeating value semantics

## Related Agent

- [swift-performance-analyzer](/agents/swift-performance-analyzer) – The agent that powers this command
