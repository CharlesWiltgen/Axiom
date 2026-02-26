---
name: axiom-timer-patterns-ref
description: Timer, DispatchSourceTimer, Combine Timer.publish, AsyncTimerSequence, Task.sleep API reference with lifecycle diagrams, RunLoop modes, and platform availability
license: MIT
metadata:
  version: "1.0.0"
  last-updated: "2026-02-26"
---

# Timer Patterns Reference

Complete API reference for iOS timer mechanisms. For decision trees and crash prevention, see `axiom-timer-patterns`.

---

## Part 1: Timer API

### Timer.scheduledTimer (Block-Based)

```swift
// Most common — block-based, auto-added to current RunLoop
let timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
    self?.updateProgress()
}
```

**Key detail**: Added to `.default` RunLoop mode. Stops during scrolling. See Part 1 RunLoop modes table below.

### Timer.scheduledTimer (Selector-Based)

```swift
// Objective-C style — RETAINS TARGET (leak risk)
let timer = Timer.scheduledTimer(
    timeInterval: 1.0,
    target: self,       // Timer retains self!
    selector: #selector(update),
    userInfo: nil,
    repeats: true
)
```

**Danger**: This API retains `target`. If `self` also holds the timer, you have a retain cycle. The block-based API with `[weak self]` is always safer.

### Timer.init (Manual RunLoop Addition)

```swift
// Create timer without adding to RunLoop
let timer = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in
    self?.updateProgress()
}

// Add to specific RunLoop mode
RunLoop.current.add(timer, forMode: .common)  // Survives scrolling
```

### timer.tolerance

```swift
timer.tolerance = 0.1  // Allow 100ms flexibility for system coalescing
```

System batches timers with similar fire dates when tolerance is set. Minimum recommended: 10% of interval. Reduces CPU wakes and energy consumption.

### RunLoop Modes

| Mode | Constant | When Active | Timer Fires? |
|------|----------|-------------|--------------|
| Default | `.default` / `RunLoop.Mode.default` | Normal user interaction | Yes |
| Tracking | `.tracking` / `RunLoop.Mode.tracking` | Scroll/drag gesture active | Only if added to `.common` |
| Common | `.common` / `RunLoop.Mode.common` | Pseudo-mode (default + tracking) | Yes (always) |

### timer.invalidate()

```swift
timer.invalidate()  // Stops timer, removes from RunLoop
// Timer is NOT reusable after invalidate — create a new one
timer = nil          // Release reference
```

**Key detail**: `invalidate()` must be called from the same thread that created the timer (usually main thread).

### timer.isValid

```swift
if timer.isValid {
    // Timer is still active
}
```

Returns `false` after `invalidate()` or after a non-repeating timer fires.

### Timer.publish (Combine)

```swift
Timer.publish(every: 1.0, tolerance: 0.1, on: .main, in: .common)
    .autoconnect()
    .sink { [weak self] _ in
        self?.updateProgress()
    }
    .store(in: &cancellables)
```

See Part 3 for full Combine timer details.

---

## Part 2: DispatchSourceTimer API

### Creation

```swift
// Create timer source on a specific queue
let queue = DispatchQueue(label: "com.app.timer")
let timer = DispatchSource.makeTimerSource(flags: [], queue: queue)
```

**flags**: Usually empty (`[]`). Use `.strict` for precise timing (disables system coalescing, higher energy cost).

### Schedule

```swift
// Relative deadline (monotonic clock)
timer.schedule(
    deadline: .now() + 1.0,     // First fire
    repeating: .seconds(1),     // Interval
    leeway: .milliseconds(100)  // Tolerance (like Timer.tolerance)
)

// Wall clock deadline (survives device sleep)
timer.schedule(
    wallDeadline: .now() + 1.0,
    repeating: .seconds(1),
    leeway: .milliseconds(100)
)
```

**deadline vs wallDeadline**: `deadline` uses monotonic clock (pauses when device sleeps). `wallDeadline` uses wall clock (continues across sleep). Use `deadline` for most cases.

### Event Handler

```swift
timer.setEventHandler { [weak self] in
    self?.performWork()
}
```

**Before cancel**: Set handler to nil to break retain cycles:

```swift
timer.setEventHandler(handler: nil)
timer.cancel()
```

### Lifecycle Methods

```swift
timer.activate()   // Start — can only call ONCE (idle → running)
timer.suspend()    // Pause (running → suspended)
timer.resume()     // Unpause (suspended → running)
timer.cancel()     // Stop permanently (must NOT be suspended)
```

### State Machine Lifecycle

```
                    activate()
        idle ──────────────► running
                               │  ▲
                    suspend()  │  │  resume()
                               ▼  │
                            suspended
                               │
                    resume() + cancel()
                               │
                               ▼
                           cancelled
```

**Critical rules**:
- `activate()` can only be called once (idle → running)
- `cancel()` requires non-suspended state (resume first if suspended)
- `cancelled` is terminal — no further operations allowed
- Dealloc requires non-suspended state (cancel first if needed)

### Leeway (Tolerance)

```swift
// Leeway values
timer.schedule(deadline: .now(), repeating: 1.0, leeway: .milliseconds(100))
timer.schedule(deadline: .now(), repeating: 1.0, leeway: .seconds(1))
timer.schedule(deadline: .now(), repeating: 1.0, leeway: .never)  // Strict — high energy
```

Leeway is the DispatchSourceTimer equivalent of `Timer.tolerance`. Allows system to coalesce timer firings for energy efficiency.

---

## Part 3: Combine Timer

### Timer.publish

```swift
import Combine

// Create publisher — RunLoop mode matters here too
let publisher = Timer.publish(
    every: 1.0,          // Interval
    tolerance: 0.1,      // Optional tolerance
    on: .main,           // RunLoop
    in: .common          // Mode — use .common to survive scrolling
)
```

### .autoconnect()

```swift
// Starts immediately when first subscriber attaches
Timer.publish(every: 1.0, on: .main, in: .common)
    .autoconnect()
    .sink { date in
        print("Fired at \(date)")
    }
    .store(in: &cancellables)
```

### .connect() (Manual Start)

```swift
// Manual control over when timer starts
let timerPublisher = Timer.publish(every: 1.0, on: .main, in: .common)
let cancellable = timerPublisher
    .sink { date in
        print("Fired at \(date)")
    }

// Start later
let connection = timerPublisher.connect()

// Stop
connection.cancel()
```

### Cancellation

```swift
// Via AnyCancellable storage — cancelled when Set is cleared or object deallocs
private var cancellables = Set<AnyCancellable>()

// Manual cancellation
cancellables.removeAll()  // Cancels all subscriptions
```

### SwiftUI Integration

```swift
class TimerViewModel: ObservableObject {
    @Published var elapsed: Int = 0
    private var cancellables = Set<AnyCancellable>()

    func start() {
        Timer.publish(every: 1.0, tolerance: 0.1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.elapsed += 1
            }
            .store(in: &cancellables)
    }

    func stop() {
        cancellables.removeAll()
    }
}
```

---

## Part 4: AsyncTimerSequence (Swift Concurrency)

### ContinuousClock.timer

```swift
// Monotonic clock — does NOT pause when app suspends
for await _ in ContinuousClock().timer(interval: .seconds(1)) {
    await updateData()
}
// Loop exits when task is cancelled
```

### SuspendingClock.timer

```swift
// Suspending clock — pauses when app suspends
for await _ in SuspendingClock().timer(interval: .seconds(1)) {
    await processItem()
}
```

**ContinuousClock vs SuspendingClock**:
- `ContinuousClock`: Time keeps advancing during app suspension. Use for absolute timing.
- `SuspendingClock`: Time pauses when app suspends. Use for "user-perceived" timing.

### Task Cancellation

```swift
// Timer automatically stops when task is cancelled
let timerTask = Task {
    for await _ in ContinuousClock().timer(interval: .seconds(1)) {
        await fetchLatestData()
    }
}

// Later: cancel the timer
timerTask.cancel()
```

### Background Polling with Structured Concurrency

```swift
func startPolling() async {
    do {
        for try await _ in ContinuousClock().timer(interval: .seconds(30)) {
            try Task.checkCancellation()
            let data = try await api.fetchUpdates()
            await MainActor.run { updateUI(with: data) }
        }
    } catch is CancellationError {
        // Clean exit
    } catch {
        // Handle fetch error
    }
}
```

---

## Part 5: Task.sleep Alternatives

### One-Shot Delay

```swift
// Simple delay — NOT a timer
try await Task.sleep(for: .seconds(1))

// Deadline-based
try await Task.sleep(until: .now + .seconds(1), clock: .continuous)
```

### When to Use Sleep vs Timer

| Need | Use |
|------|-----|
| One-shot delay before action | `Task.sleep(for:)` |
| Repeating action | `ContinuousClock().timer(interval:)` |
| Delay with cancellation | `Task.sleep(for:)` in a Task |
| Retry with backoff | `Task.sleep(for:)` in a loop |

### Retry with Exponential Backoff

```swift
func fetchWithRetry(maxAttempts: Int = 3) async throws -> Data {
    var delay: Duration = .seconds(1)
    for attempt in 1...maxAttempts {
        do {
            return try await api.fetch()
        } catch where attempt < maxAttempts {
            try await Task.sleep(for: delay)
            delay *= 2  // Exponential backoff
        }
    }
    throw FetchError.maxRetriesExceeded
}
```

---

## Part 6: LLDB Timer Inspection

### Timer (NSTimer) Commands

```lldb
# Check if timer is still valid
po timer.isValid

# See next fire date
po timer.fireDate

# See timer interval
po timer.timeInterval

# Force RunLoop iteration (may trigger timer)
expression -l objc -- (void)[[NSRunLoop mainRunLoop] run]
```

### DispatchSourceTimer Commands

```lldb
# Inspect dispatch source
po timer

# Break on dispatch source cancel (all sources)
breakpoint set -n dispatch_source_cancel

# Break on EXC_BAD_INSTRUCTION to catch timer crashes
# (Xcode does this automatically for Swift runtime errors)

# Check if a DispatchSource is cancelled
expression -l objc -- (long)dispatch_source_testcancel((void*)timer)
```

### General Timer Debugging

```lldb
# List all timers on the main RunLoop
expression -l objc -- (void)CFRunLoopGetMain()

# Break when any Timer fires
breakpoint set -S "scheduledTimerWithTimeInterval:target:selector:userInfo:repeats:"
```

---

## Part 7: Platform Availability Matrix

| API | iOS | macOS | watchOS | tvOS |
|---|---|---|---|---|
| Timer | 2.0+ | 10.0+ | 2.0+ | 9.0+ |
| DispatchSourceTimer | 8.0+ (GCD) | 10.10+ | 2.0+ | 9.0+ |
| Timer.publish (Combine) | 13.0+ | 10.15+ | 6.0+ | 13.0+ |
| AsyncTimerSequence | 16.0+ | 13.0+ | 9.0+ | 16.0+ |
| Task.sleep | 13.0+ | 10.15+ | 6.0+ | 13.0+ |

---

## Related Skills

- `axiom-timer-patterns` — Decision trees, crash patterns, SafeDispatchTimer wrapper
- `axiom-energy` — Timer tolerance as energy optimization (Pattern 1)
- `axiom-energy-ref` — Timer efficiency APIs with WWDC code examples
- `axiom-memory-debugging` — Timer as Pattern 1 memory leak

## Resources

**Skills**: axiom-timer-patterns, axiom-energy-ref, axiom-memory-debugging
