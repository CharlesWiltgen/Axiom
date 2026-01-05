---
name: synchronization
description: Thread-safe primitives for performance-critical code — Mutex (iOS 18+), OSAllocatedUnfairLock (iOS 16+), Atomic types, lock vs actor decisions
---

# Mutex & Synchronization — Thread-Safe Primitives

**Purpose**: Low-level synchronization primitives for when actors are too slow or heavyweight
**Swift Version**: Swift 6 for Mutex, Swift 5+ for OSAllocatedUnfairLock
**iOS Version**: iOS 18+ for Mutex, iOS 16+ for OSAllocatedUnfairLock

## When to Use This Skill

✅ **Use this skill when**:
- Microsecond operations where actor hop is too slow
- Protecting single property access
- Shared state across modules (Mutex is Sendable)
- High-frequency counters (use Atomic)

❌ **Do NOT use this skill for**:
- Complex async workflows (use actors)
- Need suspension points (use actors)
- Simple cases where actor is sufficient

## When to Use Mutex vs Actor

| Need | Use | Reason |
|------|-----|--------|
| Microsecond operations | Mutex | No async hop overhead |
| Protect single property | Mutex | Simpler, faster |
| Complex async workflows | Actor | Proper suspension handling |
| Suspension points needed | Actor | Mutex can't suspend |
| High-frequency counters | Atomic | Lock-free performance |

## Key APIs

### Mutex (iOS 18+ / Swift 6)

```swift
import Synchronization

let mutex = Mutex<Int>(0)

// Read
let value = mutex.withLock { $0 }

// Write
mutex.withLock { $0 += 1 }
```

### OSAllocatedUnfairLock (iOS 16+)

```swift
import os

let lock = OSAllocatedUnfairLock(initialState: 0)

lock.withLock { state in
    state += 1
}
```

## Critical Warning: Never Hold Locks Across Await

```swift
// ❌ DEADLOCK RISK
mutex.withLock {
    await someAsyncWork()  // Task suspends while holding lock!
}

// ✅ SAFE: Release before await
let value = mutex.withLock { $0 }
let result = await process(value)
mutex.withLock { $0 = result }
```

## Related Skills

- [Swift Concurrency](./swift-concurrency) — Actor-based concurrency
- [Concurrency Profiling](./concurrency-profiling) — Diagnose contention issues

## Resources

- **Swift Evolution**: [SE-0433: Mutex](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0433-mutex.md)
- **Docs**: [Synchronization Framework](https://developer.apple.com/documentation/axiom-synchronization)
