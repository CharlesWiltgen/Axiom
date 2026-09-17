
# Timer Safety Patterns

## Overview

Timer-related crashes are among the hardest to diagnose because they're often intermittent and the crash log points to GCD internals, not your code. **Core principle**: DispatchSourceTimer has a state machine — violating it traps the process deterministically, in a way that looks random. On arm64 that trap reads **EXC_BREAKPOINT (SIGTRAP)** with a `BUG IN CLIENT OF LIBDISPATCH: …` message; `EXC_BAD_INSTRUCTION` is the same trap on Intel. Timer (NSTimer) has a RunLoop mode trap that silently stops your timer during scrolling. Both are preventable with the patterns in this skill.

## Example Prompts

- "My timer stops when the user scrolls"
- "EXC_BREAKPOINT (SIGTRAP) crash in my timer code — BUG IN CLIENT OF LIBDISPATCH"
- "Should I use Timer or DispatchSourceTimer?"
- "How do I safely cancel a DispatchSourceTimer?"
- "My DispatchSourceTimer crashes on dealloc"
- "Timer keeps running after I dismiss the view controller"

---

## Part 1: Timer vs DispatchSourceTimer Decision Tree

| Feature | Timer | DispatchSourceTimer | AsyncTimerSequence |
|---------|-------|--------------------|--------------------|
| Thread safety | Run-loop-bound — any thread whose run loop runs (UI callers use the main run loop) | Any queue (you choose) | Task-bound (structured concurrency) |
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
// RunLoop.main, not RunLoop.current — `current` is unavailable from async contexts
RunLoop.main.add(timer, forMode: .common)
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

**Key**: `in:` has no default — `Timer.publish(every:on:)` does not compile without it. Pass `.common` so the timer keeps firing while the user scrolls. (`Timer.scheduledTimer` is the route that silently lands in `.default`.)

### RunLoop Modes

| Mode | When Active | Timer Fires? |
|------|-------------|--------------|
| `.default` | Normal interaction | Yes |
| `.tracking` | During scrolling | Only if added to `.common` |
| `.common` | Pseudo-mode: includes `.default` + `.tracking` | Yes (always) |

---

## Part 3: The 4 DispatchSourceTimer Crash Patterns

Each of these traps the process. On arm64 the crash report shows **EXC_BREAKPOINT (SIGTRAP)** with a `BUG IN CLIENT OF LIBDISPATCH: …` message — the trap points at GCD internals, making it hard to trace back to your timer code. (Older Intel crash logs show the same trap as EXC_BAD_INSTRUCTION.)

### Crash Message → Pattern Mapping

When you see EXC_BREAKPOINT (SIGTRAP) and a `BUG IN CLIENT OF LIBDISPATCH` message, match the message:

| Crash Log Signal (arm64) | Crash Pattern | Fix |
|---|---|---|
| `Release of a suspended object` | Crash 1: Unbalanced suspend | Track state, only suspend if running |
| `Release of a suspended object` after `cancel()` | Crash 2: Cancel while suspended | `resume()` before dropping the last reference |
| `Release of a suspended object` on dealloc | Crash 3: Dealloc while suspended | Resume before releasing |
| `Over-resume of an object` | Crash 4: Over-resume | Resume only as many times as you suspended |

The `Release of …` messages are raised from `_dispatch_queue_xref_dispose` on the release path; `Over-resume of an object` comes from `dispatch_resume`. Neither is raised by `dispatch_source_cancel` — cancelling a suspended source is legal (Crash 2's trap is the release that follows). A fifth message, `Release of an inactive object`, fires when a source is released that was never activated; Part 4's wrapper handles that case.

### DispatchSourceTimer State Machine

```
                    activate()
        idle ──────────────► running
                               │  ▲
                    suspend()  │  │  resume()
                               ▼  │
                            suspended
                               │
                    cancel()
                               │
                               ▼
                           cancelled (no more firing)

CRASH ZONES (libdispatch traps — EXC_BREAKPOINT on arm64):
  release while suspended         = "Release of a suspended object"
  release without activate()      = "Release of an inactive object"
  resume() with nothing suspended = "Over-resume of an object"
  cancel() while suspended        = legal — the cancel handler waits for a resume;
                                    the trap is the release that follows
```

### Crash 1: Suspend While Already Suspended

Calling `suspend()` multiple times without matching `resume()` calls. Each `suspend()` increments an internal counter, and that counter must be back at zero before the last reference is released — releasing a still-suspended source traps with `Release of a suspended object`. Track your own suspends and resume exactly as many times as you suspended.

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
// Released with suspend count = 1 → libdispatch trap: "Release of a suspended object"
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

Cancelling a suspended source is legal: `cancel()` marks the source cancelled, its cancel handler is deferred until the source is resumed, and nothing traps at the call. What traps is treating `cancel()` as if it cleared the suspension — the source is still suspended, so the release that follows raises `Release of a suspended object`.

#### ❌ Crash

```swift
let timer = DispatchSource.makeTimerSource(queue: queue)
timer.schedule(deadline: .now(), repeating: 1.0)
timer.setEventHandler { doWork() }
timer.activate()

timer.suspend()
timer.cancel()  // Legal — the cancel handler waits for a resume

// timer released at end of scope, still suspended:
// libdispatch trap — "Release of a suspended object"
```

#### ✅ Safe

```swift
// Resume before the reference goes away, then cancel
timer.resume()   // Clears the suspension — this is what makes the release legal
timer.cancel()   // Cancel handler is delivered, then the source is disposed
```

### Crash 3: Dealloc While Suspended

Setting the timer to nil (or letting it go out of scope) while suspended. The release itself is the trap — libdispatch sees a source whose suspend count is non-zero going away and raises `Release of a suspended object`. The neighbouring case is a source that was never activated: releasing that one raises `Release of an inactive object`, which is what a wrapper that is created and then discarded without ever being scheduled hits.

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
    timer = nil  // Released while suspended → libdispatch trap
}
```

#### ✅ Safe

```swift
func cleanup() {
    // Resume before releasing
    timer?.resume()
    timer?.cancel()
    timer = nil  // Safe now — the suspension was consumed above
}
```

### Crash 4: Over-Resume

`resume()` is not "start the timer" — it consumes a suspension. Calling it on a source with nothing suspended (suspend count already 0) underflows the count and libdispatch terminates the process with `Over-resume of an object`. Cancellation is a separate axis: `cancel()` ends the timer's firing for good, but it does not touch the suspend count, so an `isCancelled` flag does not make `resume()` safe.

#### ❌ Crash

```swift
let timer = DispatchSource.makeTimerSource(queue: queue)
timer.schedule(deadline: .now(), repeating: 1.0)
timer.setEventHandler { doWork() }
timer.activate()   // suspend count 0 — the source is running

timer.cancel()
timer.resume()  // Nothing was suspended → libdispatch trap: "Over-resume of an object"
```

#### ✅ Safe

```swift
// Track the suspend balance — not the cancellation state
var isSuspended = false

func cancel() {
    if isSuspended {          // An outstanding suspension must be consumed before release
        timer.resume()
        isSuspended = false
    }
    timer.cancel()            // Ends firing; a cancelled source never fires again
}

func resume() {
    guard isSuspended else { return }   // Resume only what you suspended
    timer.resume()
    isSuspended = false
}
```

`suspend()` on a cancelled source is not a trap in itself — it increments the counter like any other suspension — but it leaves the source suspended at release, which is Crash 1 and Crash 3.

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
        case .idle:
            // Never scheduled: the source is still inactive, and releasing an
            // inactive source traps ("Release of an inactive object").
            // Activate it first so the release is legal.
            timer.activate()
            timer.cancel()
        case .suspended:
            timer.resume()  // Clear the suspension — releasing a suspended source traps
            timer.cancel()
        case .running:
            timer.cancel()
        case .cancelled:
            return
        }
        state = .cancelled
    }

    deinit {
        cancel()  // Safe cleanup in any state, including never-scheduled
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

DispatchSourceTimer fires its event handler on the queue you specify at creation. A source's handler never overlaps itself: libdispatch is not reentrant, and events that arrive while the handler is running are coalesced and delivered after it returns — on a concurrent queue exactly as on a serial one. A dedicated serial queue is still the right default, because it serializes the handler against the *other* work that touches the same state, instead of running alongside it.

#### ❌ Race Condition

```swift
// BAD: handler runs on a global concurrent queue, racing every other
// thread that touches count
let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global())
timer.setEventHandler {
    self.count += 1          // Race condition
    self.processItem(self.count)
}
```

#### ✅ Serial Queue

```swift
// GOOD: Dedicated serial queue — this handler cannot run at the same time as
// other work you submit to the same queue
let timerQueue = DispatchQueue(label: "com.app.timer-queue")
let timer = DispatchSource.makeTimerSource(queue: timerQueue)
timer.setEventHandler { [weak self] in
    guard let self else { return }
    self.count += 1            // Safe if every access to count is serialized on timerQueue
    self.processItem(self.count)
}
```

### Main Queue for UI Updates

If your timer handler updates UI, dispatch to main:

```swift
let timer = DispatchSource.makeTimerSource(queue: timerQueue)
timer.setEventHandler { [weak self] in
    guard let result = self?.computeResult() else { return }
    DispatchQueue.main.async {
        self?.updateUI(with: result)
    }
}
```

**The enclosing type must be main-actor-isolated** (a view controller or any `@MainActor` type — UIKit's classes are). Under Swift 6 a plain non-`Sendable` class cannot hand `self` to that `@Sendable` main-queue closure: the compiler rejects it with `sending 'self' risks causing data races`. Annotate the type `@MainActor` and keep the UI work inside it, or hop by sending a `Sendable` payload instead of `self`.

---

## Part 6: Anti-Patterns

| Anti-Pattern | Time Cost | Fix |
|---|---|---|
| Timer in `.default` RunLoop mode | 30+ min debugging scroll freeze | Use `.common` mode |
| No state tracking on DispatchSourceTimer | libdispatch trap (EXC_BREAKPOINT on arm64), hours to diagnose | Use SafeDispatchTimer wrapper |
| Releasing a suspended source (including after `cancel()`) | Production crash — `Release of a suspended object` | `resume()` before the last reference goes away |
| Timer on `.global()` queue | Race conditions with the rest of your code | Dedicated serial queue |
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

**Setup**: EXC_BREAKPOINT (SIGTRAP) in production crash logs, with a `BUG IN CLIENT OF LIBDISPATCH` message. Can't reproduce reliably in development.

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

- `skills/timer-patterns-ref.md` — API reference for Timer, DispatchSourceTimer, Combine Timer.publish, AsyncTimerSequence with lifecycle diagrams and platform availability
- `axiom-performance (skills/memory-debugging.md)` — Timer as Pattern 1 memory leak (Timer retains target, RunLoop retains Timer)
- `axiom-performance (skills/energy.md)` — Timer as energy drain pattern (tolerance, coalescing, event-driven alternatives)

## Resources

**WWDC**: 2017-706

**Skills**: timer-patterns-ref, memory-debugging, energy, energy-ref
