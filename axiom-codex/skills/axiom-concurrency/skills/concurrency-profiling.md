
# Concurrency Profiling — Instruments Workflows

Profile and optimize Swift async/await code using Instruments.

## When to Use

✅ **Use when:**
- UI stutters during async operations
- Suspecting actor contention
- Tasks queued but not executing
- Main thread blocked during async work
- Need to visualize task execution flow

❌ **Don't use when:**
- Issue is pure CPU performance (use Time Profiler)
- Memory issues unrelated to concurrency (use Allocations)
- Haven't confirmed concurrency is the bottleneck

## Swift Concurrency Template

### What It Shows

| Track | Information |
|-------|-------------|
| **Swift Tasks** | Task lifetimes, parent-child relationships |
| **Swift Actors** | Actor access, contention visualization |
| **Thread States** | Blocked vs running vs suspended |

### Statistics

- **Running Tasks**: Tasks currently executing
- **Alive Tasks**: Tasks present at a point in time
- **Total Tasks**: Cumulative count created

### Color Coding

- **Blue**: Task executing
- **Red**: Task waiting (contention)
- **Gray**: Task suspended (awaiting)

## Workflow 1: Diagnose Main Thread Blocking

**Symptom**: UI freezes, main thread timeline full

1. Profile with Swift Concurrency template
2. Look at main thread → "Swift Tasks" lane
3. Find long blue bars (task executing on main)
4. Check if work could be offloaded

**Solution patterns**:

```swift
// ❌ Heavy work on MainActor
@MainActor
class ViewModel: ObservableObject {
    func process() {
        let result = heavyComputation()  // Blocks UI
        self.data = result
    }
}

// ✅ Offload heavy work
@MainActor
class ViewModel: ObservableObject {
    func process() async {
        // `Task.detached` is correct for the synchronous `heavyComputation()` above —
        // `Task {}` would inherit @MainActor and run it ON the main thread.
        let result = await Task.detached {
            heavyComputation()
        }.value
        self.data = result
    }
}

// ✅ Preferred in Swift 6.2+ when the work can become `async`: `@concurrent` runs it
// off the caller's actor, so the detached task isn't needed. Both halves matter —
// `@concurrent` is only valid on an `async` function, so mark it *and* make it async.
@concurrent
func heavyComputation() async -> Int {
    // heavy work, off the main actor
}

@MainActor
class BackgroundViewModel: ObservableObject {
    func process() async {
        self.data = await heavyComputation()
    }
}
```

## Workflow 2: Find Actor Contention

**Symptom**: Tasks serializing unexpectedly, parallel work running sequentially

1. Enable "Swift Actors" instrument
2. Look for serialized access patterns
3. Red = waiting, Blue = executing
4. High red:blue ratio = contention problem

**Solution patterns**:

```swift
// ❌ All work serialized through actor
actor DataProcessor {
    func process(_ data: Data) -> Result {
        heavyProcessing(data)  // All callers wait
    }
}

// ✅ Mark heavy work as nonisolated
actor DataProcessor {
    nonisolated func process(_ data: Data) -> Result {
        heavyProcessing(data)  // Runs in parallel
    }

    func storeResult(_ result: Result) {
        // Only actor state access serialized
    }
}
```

**More fixes**:
- Split actor into multiple (domain separation)
- Use Mutex for hot paths (faster than actor hop)
- Reduce actor scope (fewer isolated properties)

## Workflow 3: Thread Pool Exhaustion

**Symptom**: Tasks queued but not executing, gaps in task execution

**Cause**: Blocking calls exhaust cooperative pool

1. Look for gaps in task execution across all threads
2. Check for blocking primitives
3. Replace with async equivalents

**Common culprits**:

```swift
// ❌ Blocks cooperative thread
// `wait()` inside a `Task` is unavailable from async contexts — it doesn't compile
// in Swift 6 mode. The reachable hazard is a *synchronous* helper that blocks, which
// the compiler allows and which occupies a cooperative thread for the whole wait.
func waitForSignal(_ semaphore: DispatchSemaphore) {
    semaphore.wait()
}

Task {
    waitForSignal(semaphore)  // NEVER do this
    // ...
    semaphore.signal()
}

// ❌ Synchronous file I/O in async context
Task {
    let data = Data(contentsOf: fileURL)  // Blocks
}

// ✅ Use async APIs
Task {
    let (data, _) = try await URLSession.shared.data(from: fileURL)
}
```

**Debug flag**:
```
LIBDISPATCH_COOPERATIVE_POOL_STRICT=1
```
Forces the cooperative pool to a single thread, so with only one worker a blocked task
stalls everything instead of merely occupying one of several threads. Measured on
macOS 27 / Swift 6.4: 8 concurrent CPU-bound tasks ran on 8 threads without the flag,
on 1 thread with it. The identifier is present in the libdispatch shipped with the
iOS 27 simulator runtime.

## Workflow 4: Priority Inversion

**Symptom**: High-priority task waits for low-priority

1. Inspect task priorities in Instruments
2. Follow wait chains
3. Ensure critical paths use appropriate priority

```swift
// ✅ Explicit priority for critical work
Task(priority: .userInitiated) {
    await criticalUIUpdate()
}
```

## Thread Pool Model

Swift uses a **cooperative thread pool** matching CPU core count:

| Aspect | GCD | Swift Concurrency |
|--------|-----|-------------------|
| Threads | Grows unbounded | Fixed to core count |
| Blocking | Creates new threads | Suspends, frees thread |
| Dependencies | Hidden | Runtime-tracked |
| Context switch | Full kernel switch | Lightweight continuation |

**Why blocking is catastrophic**:
- Each blocked thread holds memory + kernel structures
- Limited threads means blocked = no progress
- Pool exhaustion deadlocks the app

## Quick Checks (Before Profiling)

Run these checks first:

1. **Is work actually async?**
   - Look for suspension points (`await`)
   - Sync code in async function still blocks

2. **Holding locks across await?**
   ```swift
   // ❌ Holding a lock across `await` — not expressible with `Mutex`: `withLock` takes
   // a synchronous body, so `await` inside it is a compile error. The primitives that
   // could hold a lock across a suspension (`NSLock.lock()`, `os_unfair_lock_lock()`,
   // `DispatchSemaphore.wait()`) are all unavailable from async contexts, so the
   // compiler prevents this rather than deadlocking on it.

   // ✅ Keep lock scope synchronous and short
   mutex.withLock { state in
       state += 1
   }
   ```

3. **Tasks in tight loops?**
   ```swift
   // ❌ Overhead may exceed benefit
   for item in items {
       Task { process(item) }
   }

   // ✅ Structured concurrency
   await withTaskGroup(of: Void.self) { group in
       for item in items {
           group.addTask { process(item) }
       }
   }
   ```

4. **DispatchSemaphore in async context?**
   - `wait()` is unavailable from async contexts — in Swift 6 mode the compiler rejects
     it outright, so the hazard is a synchronous helper that blocks a cooperative thread
   - Bridge with `withCheckedContinuation` instead

## Common Issues Summary

| Issue | Symptom in Instruments | Fix |
|-------|------------------------|-----|
| MainActor overload | Long blue bars on main | `Task.detached`, `nonisolated` |
| Actor contention | High red:blue ratio | Split actors, use `nonisolated` |
| Thread exhaustion | Gaps in all threads | Remove blocking calls |
| Priority inversion | High-pri waits for low-pri | Check task priorities |
| Too many tasks | Task creation overhead | Use task groups |

## Safe vs Unsafe Primitives

**Safe with cooperative pool**:
- `await`, actors, task groups
- `os_unfair_lock`, `NSLock` (short critical sections)
- `Mutex` (iOS 18+)

**Unsafe (violate forward progress)**:
- `DispatchSemaphore.wait()`
- `pthread_cond_wait`
- Sync file/network I/O
- `Thread.sleep()` in Task

## Resources

**WWDC**: 2022-110350, 2021-10254

**Docs**: /xcode/improving-app-responsiveness

**Skills**: See `skills/swift-concurrency.md`, axiom-performance (skills/performance-profiling.md), see `skills/synchronization.md`, axiom-build (skills/lldb.md) (interactive thread state inspection)
