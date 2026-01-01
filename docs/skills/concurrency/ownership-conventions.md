---
name: ownership-conventions
description: Parameter ownership modifiers for performance optimization — borrowing, consuming, inout, ~Copyable types, ARC traffic reduction
---

# borrowing & consuming — Parameter Ownership

**Purpose**: Explicit ownership modifiers for performance optimization and noncopyable type support
**Swift Version**: Swift 5.9+
**iOS Version**: iOS 13+

## When to Use This Skill

✅ **Use this skill when**:
- Large value types being passed read-only (avoid copies)
- Working with noncopyable types (`~Copyable`)
- Reducing ARC retain/release traffic
- Factory methods that consume builder objects
- Performance-critical code where copies show in profiling

❌ **Do NOT use this skill for**:
- Simple types (Int, Bool, small structs)
- Compiler optimization is sufficient (most cases)
- You're not certain about the performance impact

## Quick Reference

| Modifier | Ownership | Copies | Use Case |
|----------|-----------|--------|----------|
| (default) | Compiler chooses | Implicit | Most cases |
| `borrowing` | Caller keeps | Explicit `copy` only | Read-only, large types |
| `consuming` | Caller transfers | None needed | Final use, factories |
| `inout` | Caller keeps, mutable | None | Modify in place |

## Key Patterns

### Read-Only Large Struct

```swift
// ✅ Explicit borrow — no copy
func process(_ buffer: borrowing LargeBuffer) -> Int {
    buffer.data.count
}
```

### Consuming Factory

```swift
struct Builder {
    consuming func build() -> Product {
        Product(config: config)
    }
}

let product = builder.build()
// builder is now invalid
```

### Noncopyable Type

```swift
struct FileHandle: ~Copyable {
    borrowing func read(count: Int) -> Data { /* ... */ }
    consuming func close() { /* ... */ }
}
```

## Related Skills

- [Swift Performance](/skills/concurrency/swift-performance) — Value type optimization
- [Swift Concurrency](./swift-concurrency) — Sendable types

## Resources

- **Swift Evolution**: [SE-0377: borrowing and consuming](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0377-parameter-ownership-modifiers.md)
- **WWDC**: [Consume noncopyable types in Swift (10170)](https://developer.apple.com/videos/play/wwdc2024/10170/)
