
# Mutex & Synchronization — Thread-Safe Primitives

Low-level synchronization primitives for when actors are too slow or heavyweight.

## When to Use Mutex vs Actor

| Need | Use | Reason |
|------|-----|--------|
| Microsecond operations | Mutex | No async hop overhead |
| Protect single property | Mutex | Simpler, faster |
| Complex async workflows | Actor | Proper suspension handling |
| Suspension points needed | Actor | Mutex can't suspend |
| Shared across modules | Mutex | Sendable, no await needed |
| High-frequency counters | Atomic | Lock-free performance |

## API Reference

### Mutex (iOS 18+ / Swift 6)

```swift
import Synchronization

let mutex = Mutex<Int>(0)

// Read
let value = mutex.withLock { $0 }

// Write
mutex.withLock { $0 += 1 }

// Non-blocking attempt
if let value = mutex.withLockIfAvailable({ $0 }) {
    // Got the lock
}
```

**Properties**:
- Generic over protected value
- `Sendable` — safe to share across concurrency boundaries
- Closure-based access only (no lock/unlock methods)

### OSAllocatedUnfairLock (iOS 16+)

```swift
import os

let lock = OSAllocatedUnfairLock(initialState: 0)

// Closure-based (recommended)
lock.withLock { state in
    state += 1
}

// Traditional (same-thread only)
lock.lock()
defer { lock.unlock() }
// access protected state
```

**Properties**:
- Heap-allocated, stable memory address
- Non-recursive (can't re-lock from same thread)
- `Sendable`

### Atomic Types (iOS 18+)

```swift
import Synchronization

let counter = Atomic<Int>(0)

// Atomic increment
counter.wrappingAdd(1, ordering: .relaxed)

// Compare-and-swap
let (exchanged, original) = counter.compareExchange(
    expected: 0,
    desired: 42,
    ordering: .acquiringAndReleasing
)
```

## Patterns

### Pattern 1: Thread-Safe Counter

```swift
final class Counter: Sendable {
    private let mutex = Mutex<Int>(0)

    var value: Int { mutex.withLock { $0 } }
    func increment() { mutex.withLock { $0 += 1 } }
}
```

### Pattern 2: Sendable Wrapper

```swift
final class ThreadSafeValue<T: Sendable>: @unchecked Sendable {
    private let mutex: Mutex<T>

    init(_ value: T) { mutex = Mutex(value) }

    var value: T {
        get { mutex.withLock { $0 } }
        set { mutex.withLock { $0 = newValue } }
    }
}
```

### Pattern 3: Fast Sync Access in Actor

```swift
actor ImageCache {
    // Mutex for fast sync reads without actor hop
    private let mutex = Mutex<[URL: Data]>([:])

    nonisolated func cachedSync(_ url: URL) -> Data? {
        mutex.withLock { $0[url] }
    }

    func cacheAsync(_ url: URL, data: Data) {
        mutex.withLock { $0[url] = data }
    }
}
```

### Pattern 4: Lock-Free Counter with Atomic

```swift
final class FastCounter: Sendable {
    private let _value = Atomic<Int>(0)

    var value: Int { _value.load(ordering: .relaxed) }

    func increment() {
        _value.wrappingAdd(1, ordering: .relaxed)
    }
}
```

### Pattern 5: iOS 16 Fallback

```swift
#if compiler(>=6.0)
import Synchronization
typealias Lock<T> = Mutex<T>
#else
import os
// Use OSAllocatedUnfairLock for iOS 16-17
#endif
```

## Danger: Mixing with Swift Concurrency

### Never Hold Locks Across Await

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

### Why Semaphores/RWLocks Are Unsafe

Swift's cooperative thread pool has **limited threads**. Blocking primitives exhaust the pool:

```swift
// ❌ DANGEROUS: Blocks cooperative thread
let semaphore = DispatchSemaphore(value: 0)
Task {
    semaphore.wait()  // Thread blocked, can't run other tasks!
}

// ✅ Use async continuation instead
await withCheckedContinuation { continuation in
    // Non-blocking callback
    callback { continuation.resume() }
}
```

### Sync Lifecycle Callbacks with Async Cleanup

**First: are you in the right callback?** `applicationWillTerminate` is rarely the right place to flush async work, because **it's not called for the common termination paths**:
- User swiping the app away from the app switcher → not called
- System jetsam under memory pressure → not called
- Backgrounded app silently killed → not called

`applicationWillTerminate` only fires when the app is running in the foreground and the system kills it, or when the app calls `exit()` directly. If you're using it as your "wrap up before termination" hook, you've already lost most terminations. **Use `applicationDidEnterBackground` (or `sceneDidEnterBackground`) paired with `UIApplication.beginBackgroundTask(expirationHandler:)`** to get a ~30-second guaranteed window for cleanup; that callback fires for every transition out of foreground including the user-swipe-away case.

If you genuinely need to bridge an async cleanup from a synchronous OS callback — even if you've picked the right one — read on. The pattern below applies to any sync lifecycle callback that hands you a deadline.

OS lifecycle callbacks like `applicationWillTerminate`, `sceneWillResignActive`, and `applicationDidEnterBackground` are **synchronous** — they expect cleanup to complete before they return. If your cleanup logic is async, you cannot bridge with a `DispatchSemaphore` without risking deadlock: the cooperative thread pool may already be saturated, and blocking the main thread on a semaphore can leave the signal nowhere to come from.

```swift
// ❌ DEADLOCK RISK — sync callback waiting on async work via semaphore
func applicationWillTerminate(_ application: UIApplication) {
    let semaphore = DispatchSemaphore(value: 0)
    Task {
        await persistAllChanges()
        semaphore.signal()
    }
    semaphore.wait()  // ❌ Main thread blocked; the Task may need main to make progress
}
```

**What to do instead:**

1. **Refactor cleanup to be synchronous where possible.** Most teardown work (writing to disk, in-memory cleanup, Core Data `save()`) has synchronous APIs. Extract a sync code path for the lifecycle callback.

2. **Use background tasks for work that must finish later.** For network flushes or other genuinely async work, request a `BGTaskScheduler` task to complete on the next launch (or backgrounded continuation). The OS will resume your app briefly to finish.

3. **Design for graceful partial completion.** Mark state as "unclean" at the start of a session and run recovery logic on next launch. This is more reliable than racing the OS's termination window — and the window is so short (a few seconds) that even successful async cleanup is risky.

```swift
// ✅ Sync path for what can be sync, defer the rest
func applicationWillTerminate(_ application: UIApplication) {
    saveUnsavedDocumentsSynchronously()       // Sync
    markSessionAsUnclean()                    // Sync flag for recovery
    scheduleBackgroundFlush()                 // BGTaskScheduler for async work
}
```

The hard truth: **the OS does not guarantee you enough time to complete async work in lifecycle callbacks.** Design for cleanup failure being possible rather than trying to force completion.

### os_unfair_lock Danger

**Never use `os_unfair_lock` directly in Swift** — it can be moved in memory:

```swift
// ❌ UNDEFINED BEHAVIOR: Lock may move
var lock = os_unfair_lock()
os_unfair_lock_lock(&lock)  // Address may be invalid

// ✅ Use OSAllocatedUnfairLock (heap-allocated, stable address)
let lock = OSAllocatedUnfairLock()
```

## Decision Tree

```
Need synchronization?
├─ Lock-free operation needed?
│  └─ Simple counter/flag? → Atomic
│  └─ Complex state? → Mutex
├─ iOS 18+ available?
│  └─ Yes → Mutex
│  └─ No, iOS 16+? → OSAllocatedUnfairLock
├─ Need suspension points?
│  └─ Yes → Actor (not lock)
├─ Cross-await access?
│  └─ Yes → Actor (not lock)
└─ Performance-critical hot path?
   └─ Yes → Mutex/Atomic (not actor)
```

## Common Mistakes

### Mistake 1: Using Lock for Async Coordination

```swift
// ❌ Locks don't work with async
let mutex = Mutex<Bool>(false)
Task {
    await someWork()
    mutex.withLock { $0 = true }  // Race condition still possible
}

// ✅ Use actor or async state
actor AsyncState {
    var isComplete = false
    func complete() { isComplete = true }
}
```

### Mistake 2: Recursive Locking Attempt

```swift
// ❌ Deadlock — OSAllocatedUnfairLock is non-recursive
lock.withLock {
    doWork()  // If doWork() also calls withLock → deadlock
}

// ✅ Refactor to avoid nested locking
let data = lock.withLock { $0.copy() }
doWork(with: data)
```

### Mistake 3: Mixing Lock Styles

```swift
// ❌ Don't mix lock/unlock with withLock
lock.lock()
lock.withLock { /* ... */ }  // Deadlock!
lock.unlock()

// ✅ Pick one style
lock.withLock { /* all work here */ }
```

## Memory Ordering Quick Reference

| Ordering | Read | Write | Use Case |
|----------|------|-------|----------|
| `.relaxed` | Yes | Yes | Counters, no dependencies |
| `.acquiring` | Yes | - | Load before dependent ops |
| `.releasing` | - | Yes | Store after dependent ops |
| `.acquiringAndReleasing` | Yes | Yes | Read-modify-write |
| `.sequentiallyConsistent` | Yes | Yes | Strongest guarantee |

**Default choice**: `.relaxed` for counters, `.acquiringAndReleasing` for read-modify-write.

## Resources

**Docs**: /synchronization, /synchronization/mutex, /os/osallocatedunfairlock

**Swift Evolution**: SE-0433

**Skills**: See `skills/swift-concurrency.md`, axiom-performance (skills/swift-performance.md)
