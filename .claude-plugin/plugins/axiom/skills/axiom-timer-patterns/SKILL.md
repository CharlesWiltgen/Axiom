---
name: axiom-timer-patterns
description: Use when implementing timers, debugging timer crashes (EXC_BAD_INSTRUCTION), Timer stops during scrolling, or choosing between Timer/DispatchSourceTimer/Combine/async timer APIs
license: MIT
metadata:
  version: "1.0.0"
  last-updated: "2026-02-26"
---

# Timer Safety Patterns

## Overview

Timer-related crashes are among the hardest to diagnose because they're often intermittent and the crash log points to GCD internals, not your code. **Core principle**: DispatchSourceTimer has a state machine — violating it causes deterministic EXC_BAD_INSTRUCTION crashes that look random. Timer (NSTimer) has a RunLoop mode trap that silently stops your timer during scrolling. Both are preventable with the patterns in this skill.

## Example Prompts

- "My timer stops when the user scrolls"
- "EXC_BAD_INSTRUCTION crash in my timer code"
- "Should I use Timer or DispatchSourceTimer?"
- "How do I safely cancel a DispatchSourceTimer?"
- "My DispatchSourceTimer crashes on dealloc"
- "Timer keeps running after I dismiss the view controller"

---

## Part 1: Timer vs DispatchSourceTimer Decision Tree

| Feature | Timer | DispatchSourceTimer | AsyncTimerSequence |
|---------|-------|--------------------|--------------------|
| Thread safety | Main thread only (RunLoop-bound) | Any queue (you choose) | Task-bound (structured concurrency) |
| Scrolling survival | Only in `.common` mode | Always (no RunLoop dependency) | Always (no RunLoop dependency) |
| Precision | Low (RunLoop coalescing) | High (GCD scheduling) | Medium (clock-dependent) |
| Lifecycle complexity | Low (invalidate + nil) | High (state machine, 4 crash patterns) | Low (task cancellation) |
| iOS version | 2.0+ | 8.0+ (GCD) | 16.0+ |
| Use case | UI updates on main thread | Background work, precise timing, custom queues | Modern async code, structured concurrency |

### Quick Decision

```
Need a simple UI update timer?
├─ Yes → Timer (with .common RunLoop mode)
│
Need precise timing or background queue?
├─ Yes → DispatchSourceTimer (with SafeDispatchTimer wrapper)
│
Writing modern async/await code on iOS 16+?
├─ Yes → AsyncTimerSequence (ContinuousClock.timer)
│
Need Combine integration?
└─ Yes → Timer.publish
```

---

## Part 2: RunLoop Mode Gotcha

Timer stops firing during scrolling. This is the single most common timer bug in iOS development.

### Why It Happens

`Timer.scheduledTimer` adds the timer to the current RunLoop in `.default` mode. When the user scrolls (UIScrollView, SwiftUI ScrollView, List), the RunLoop switches to `.tracking` mode. The timer doesn't fire in `.tracking` mode because it was only registered for `.default`.

**Time cost**: Timer mysteriously stops during scroll → 30+ min debugging if you don't know about RunLoop modes.

### ❌ Broken — Timer stops during scrolling

```swift
// BAD: Timer added to .default mode (implicit)
let timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
    self?.updateProgress()
}
// Timer STOPS when user scrolls any UIScrollView or SwiftUI List
```

### ✅ Fixed — Timer survives scrolling

```swift
// GOOD: Explicitly add to .common mode (includes both .default and .tracking)
let timer = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in
    self?.updateProgress()
}
RunLoop.current.add(timer, forMode: .common)
```

### ✅ Fixed — Combine Timer survives scrolling

```swift
// GOOD: Timer.publish with .common mode — survives scrolling in SwiftUI
Timer.publish(every: 1.0, tolerance: 0.1, on: .main, in: .common)
    .autoconnect()
    .sink { [weak self] _ in
        self?.updateProgress()
    }
    .store(in: &cancellables)
```

**Key**: The `in:` parameter defaults to `.default` if omitted — always specify `.common` explicitly.

### RunLoop Modes

| Mode | When Active | Timer Fires? |
|------|-------------|--------------|
| `.default` | Normal interaction | Yes |
| `.tracking` | During scrolling | Only if added to `.common` |
| `.common` | Pseudo-mode: includes `.default` + `.tracking` | Yes (always) |

---

## Part 3: The 4 DispatchSourceTimer Crash Patterns

Each of these causes **EXC_BAD_INSTRUCTION** — a crash that points to GCD internals, making it hard to trace back to your timer code.

### Crash Frame → Pattern Mapping

When you see EXC_BAD_INSTRUCTION in a crash log, match the top frame:

| Top Crash Frame | Crash Pattern | Fix |
|---|---|---|
| `dispatch_source_cancel` | Crash 2: Cancel while suspended | `resume()` before `cancel()` |
| `_dispatch_source_dispose` | Crash 3: Dealloc while suspended | Resume + cancel before releasing |
| `dispatch_resume` | Crash 4: Resume after cancel | Check `isCancelled` before operating |
| `_dispatch_source_refs_t` / `suspend count` | Crash 1: Unbalanced suspend | Track state, only suspend if running |

### DispatchSourceTimer State Machine

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
                           cancelled (terminal)

CRASH ZONES:
  suspended → cancel()  = EXC_BAD_INSTRUCTION
  suspended → dealloc   = EXC_BAD_INSTRUCTION
  suspended → suspend() = suspend count underflow on dealloc
  cancelled → resume()  = EXC_BAD_INSTRUCTION
```

### Crash 1: Suspend While Already Suspended

Calling `suspend()` multiple times without matching `resume()` calls. Each `suspend()` increments an internal counter. On dealloc, if the suspend count isn't zero, GCD crashes.

#### ❌ Crash

```swift
let timer = DispatchSource.makeTimerSource(queue: queue)
timer.schedule(deadline: .now(), repeating: 1.0)
timer.setEventHandler { doWork() }
timer.activate()

// User triggers pause twice rapidly
timer.suspend()  // suspend count = 1
timer.suspend()  // suspend count = 2

timer.resume()   // suspend count = 1
// Timer deallocated with suspend count = 1 → EXC_BAD_INSTRUCTION
```

#### ✅ Safe

```swift
// Track state — only suspend if running
var isRunning = true

func pause() {
    guard isRunning else { return }
    timer.suspend()
    isRunning = false
}

func unpause() {
    guard !isRunning else { return }
    timer.resume()
    isRunning = true
}
```

### Crash 2: Cancel While Suspended

GCD requires a dispatch source to be in a non-suspended state before cancellation. Cancelling a suspended timer crashes immediately.

#### ❌ Crash

```swift
let timer = DispatchSource.makeTimerSource(queue: queue)
timer.schedule(deadline: .now(), repeating: 1.0)
timer.setEventHandler { doWork() }
timer.activate()

timer.suspend()
timer.cancel()  // EXC_BAD_INSTRUCTION — can't cancel while suspended
```

#### ✅ Safe

```swift
// ALWAYS resume before cancelling
timer.resume()   // Move out of suspended state
timer.cancel()   // Now safe to cancel
```

### Crash 3: Dealloc While Suspended

Setting the timer to nil (or letting it go out of scope) while suspended. Deallocation internally attempts cleanup that fails on a suspended source.

#### ❌ Crash

```swift
var timer: DispatchSourceTimer?

func startTimer() {
    timer = DispatchSource.makeTimerSource(queue: queue)
    timer?.schedule(deadline: .now(), repeating: 1.0)
    timer?.setEventHandler { [weak self] in self?.doWork() }
    timer?.activate()
}

func pauseTimer() {
    timer?.suspend()
}

func cleanup() {
    timer = nil  // Dealloc while suspended → EXC_BAD_INSTRUCTION
}
```

#### ✅ Safe

```swift
func cleanup() {
    // Resume before releasing
    timer?.resume()
    timer?.cancel()
    timer = nil  // Now safe — timer is in cancelled state
}
```

### Crash 4: Operate After Cancel

Calling `resume()` or `suspend()` on a cancelled timer. Cancellation is a terminal state — the timer cannot be reused.

#### ❌ Crash

```swift
timer.cancel()
timer.resume()  // EXC_BAD_INSTRUCTION — can't resume a cancelled source
```

#### ✅ Safe

```swift
// Track cancellation state
var isCancelled = false

func cancel() {
    guard !isCancelled else { return }
    timer.cancel()
    isCancelled = true
}

func resume() {
    guard !isCancelled else { return }  // Check before operating
    timer.resume()
}
```

---

## Part 4: SafeDispatchTimer Wrapper

Copy-paste this class to prevent all 4 crash patterns. State machine enforces valid transitions.

```swift
final class SafeDispatchTimer {
    enum State { case idle, running, suspended, cancelled }

    private(set) var state: State = .idle
    private let timer: DispatchSourceTimer

    init(queue: DispatchQueue = DispatchQueue(label: "safe-dispatch-timer")) {
        timer = DispatchSource.makeTimerSource(queue: queue)
    }

    func schedule(interval: TimeInterval, handler: @escaping () -> Void) {
        guard state == .idle else { return }
        timer.schedule(deadline: .now() + interval, repeating: interval)
        timer.setEventHandler(handler: handler)
        timer.activate()
        state = .running
    }

    func suspend() {
        guard state == .running else { return }
        timer.suspend()
        state = .suspended
    }

    func resume() {
        guard state == .suspended else { return }
        timer.resume()
        state = .running
    }

    func cancel() {
        switch state {
        case .suspended:
            timer.resume()  // Must resume before cancel
            timer.cancel()
        case .running:
            timer.cancel()
        case .idle, .cancelled:
            return
        }
        state = .cancelled
    }

    deinit {
        cancel()  // Safe cleanup regardless of current state
    }
}
```

### Usage

```swift
class BackgroundPoller {
    private var timer: SafeDispatchTimer?

    func start() {
        timer = SafeDispatchTimer()
        timer?.schedule(interval: 5.0) { [weak self] in
            self?.fetchData()
        }
    }

    func pause() {
        timer?.suspend()  // Safe — no-op if not running
    }

    func unpause() {
        timer?.resume()  // Safe — no-op if not suspended
    }

    func stop() {
        timer?.cancel()  // Safe — handles any state
        timer = nil
    }
}
```

---

## Part 5: Thread Safety

### Always Use a Dedicated Serial Queue

DispatchSourceTimer fires its event handler on the queue you specify at creation. Using a concurrent queue creates race conditions when multiple firings overlap or when you modify shared state from the handler.

#### ❌ Race Condition

```swift
// BAD: Concurrent queue — handler can fire while previous invocation is still running
let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global())
timer.setEventHandler {
    self.count += 1          // Race condition
    self.processItem(count)  // Overlapping invocations
}
```

#### ✅ Serial Queue

```swift
// GOOD: Dedicated serial queue — handler invocations are serialized
let timerQueue = DispatchQueue(label: "com.app.timer-queue")
let timer = DispatchSource.makeTimerSource(queue: timerQueue)
timer.setEventHandler { [weak self] in
    self?.count += 1          // Safe — serial queue
    self?.processItem(count)  // No overlap
}
```

### Main Queue for UI Updates

If your timer handler updates UI, dispatch to main:

```swift
let timer = DispatchSource.makeTimerSource(queue: timerQueue)
timer.setEventHandler { [weak self] in
    let result = self?.computeResult()
    DispatchQueue.main.async {
        self?.updateUI(with: result)
    }
}
```

---

## Part 6: Anti-Patterns

| Anti-Pattern | Time Cost | Fix |
|---|---|---|
| Timer in `.default` RunLoop mode | 30+ min debugging scroll freeze | Use `.common` mode |
| No state tracking on DispatchSourceTimer | EXC_BAD_INSTRUCTION crash, hours to diagnose | Use SafeDispatchTimer wrapper |
| `timer.cancel()` while suspended | Production crash | `resume()` then `cancel()` |
| Timer on `.global()` queue | Race conditions, intermittent crashes | Dedicated serial queue |
| Force-unwrapping timer | Crash if timer already cancelled | Optional check or state enum |
| Not clearing event handler before cancel | Potential retain cycle | `timer.setEventHandler(handler: nil)` then cancel |
| Timer retains target (selector API) | Memory leak — deinit never called | Use block API with `[weak self]` |
| Creating timer without invalidating previous | Timer accumulation, CPU waste | Always invalidate/cancel before creating new |
| Timer on background thread without RunLoop | Timer silently never fires | Timer requires a RunLoop — use DispatchSourceTimer or AsyncTimerSequence for background work |

---

## Part 7: Pressure Scenarios

### Scenario 1: "Just use Timer.scheduledTimer and move on"

**Setup**: Deadline approaching, need a repeating update every second.

**Pressure**: Timer is simpler than DispatchSourceTimer. "It's just a UI update timer, no need for GCD complexity."

**Expected with skill**: Choose Timer for simple UI updates — but add it to `.common` RunLoop mode so it survives scrolling. Only reach for DispatchSourceTimer when you need precision, background execution, or a custom queue.

**Anti-pattern without skill**: Using `Timer.scheduledTimer` with default `.default` mode → timer stops during scrolling → user reports "progress bar freezes when I scroll" → 30+ min debugging.

**Pushback template**: "Timer is the right choice for a UI update, but we need to add it to `.common` RunLoop mode. Without that, the timer stops every time the user scrolls. It's a 2-line change that prevents a guaranteed bug report."

---

### Scenario 2: "The crash only happens sometimes, let's ship and fix later"

**Setup**: EXC_BAD_INSTRUCTION in production crash logs. Can't reproduce reliably in development.

**Pressure**: "It's rare. Users can reopen the app. We'll fix it in the next release."

**Expected with skill**: Recognize the crash signature as a DispatchSourceTimer state machine violation. All 4 crash patterns are deterministic — they happen every time the specific state transition occurs. The "intermittent" appearance comes from the state transition being timing-dependent, not the crash itself. Apply SafeDispatchTimer wrapper.

**Anti-pattern without skill**: Shipping without fix → crash rate compounds with user count → crash appears in App Store review metrics → rejection risk.

**Pushback template**: "This crash is deterministic — it happens every time the timer is in a specific state. The 'intermittent' part is just the timing of when that state occurs. SafeDispatchTimer is a drop-in replacement that eliminates all 4 crash patterns. It's a 15-minute fix that prevents a production crash."

---

### Scenario 3: "Timer.invalidate() handles cleanup"

**Setup**: Timer being used in a view controller, calling `invalidate()` in `deinit`.

**Pressure**: "invalidate() is the standard cleanup pattern. It's in every tutorial."

**Expected with skill**: Recognize the retain cycle: `Timer.scheduledTimer(timeInterval:target:selector:)` retains its target. If the target is `self` (the view controller), and the view controller holds a strong reference to the timer, you have a retain cycle. `deinit` never gets called because the timer keeps `self` alive. Solution: use `[weak self]` with the block API, and invalidate in `viewWillDisappear` (not `deinit`).

**Anti-pattern without skill**: Timer retains self → deinit never called → invalidate never called → timer keeps firing → memory leak + accumulating timers → eventual crash or battery drain.

**Pushback template**: "The block-based Timer API with `[weak self]` is the fix. The selector-based API retains its target, which means our `deinit` never fires and `invalidate()` never gets called. We also need to move `invalidate()` to `viewWillDisappear` as a safety net."

---

## Related Skills

- `axiom-timer-patterns-ref` — API reference for Timer, DispatchSourceTimer, Combine Timer.publish, AsyncTimerSequence with lifecycle diagrams and platform availability
- `axiom-memory-debugging` — Timer as Pattern 1 memory leak (Timer retains target, RunLoop retains Timer)
- `axiom-energy` — Timer as energy drain pattern (tolerance, coalescing, event-driven alternatives)

## Resources

**WWDC**: 2017-706

**Skills**: timer-patterns-ref, memory-debugging, energy, energy-ref
