---
name: axiom-hang-diagnostics
description: Use when app freezes, UI unresponsive, main thread blocked, watchdog termination, or diagnosing hang reports from Xcode Organizer or MetricKit
license: MIT
---

# Hang Diagnostics

Systematic diagnosis and resolution of app hangs. A hang occurs when the main thread is blocked for more than 1 second, making the app unresponsive to user input.

## Red Flags — Check This Skill When

| Symptom | This Skill Applies |
|---------|-------------------|
| App freezes briefly during use | Yes — likely hang |
| UI doesn't respond to touches | Yes — main thread blocked |
| "App not responding" system dialog | Yes — severe hang |
| Xcode Organizer shows hang diagnostics | Yes — field hang reports |
| MetricKit MXHangDiagnostic received | Yes — aggregated hang data |
| Animations stutter or skip | Maybe — could be hitch, not hang |
| App feels slow but responsive | No — performance issue, not hang |

## What Is a Hang

A **hang** is when the main runloop cannot process events for more than 1 second. The user taps, but nothing happens.

```
User taps → Main thread busy/blocked → Event queued → 1+ second delay → HANG
```

**Key distinction**: The main thread handles ALL user input. If it's busy or blocked, the entire UI freezes.

### Hang vs Hitch vs Lag

| Issue | Duration | User Experience | Tool |
|-------|----------|-----------------|------|
| **Hang** | >1 second | App frozen, unresponsive | Time Profiler, System Trace |
| **Hitch** | 1-3 frames (16-50ms) | Animation stutters | Animation Hitches instrument |
| **Lag** | 100-500ms | Feels slow but responsive | Time Profiler |

**This skill covers hangs.** For hitches, see `axiom-swiftui-performance`. For general lag, see `axiom-performance-profiling`.

## The Two Causes of Hangs

Every hang has one of two root causes:

### 1. Main Thread Busy

The main thread is doing work instead of processing events.

**Subcategories**:

| Type | Example | Fix |
|------|---------|-----|
| **Proactive work** | Pre-computing data user hasn't requested | Lazy initialization, compute on demand |
| **Irrelevant work** | Processing all notifications, not just relevant ones | Filter notifications, targeted observers |
| **Suboptimal API** | Using blocking API when async exists | Switch to async API |

### 2. Main Thread Blocked

The main thread is waiting for something else.

**Subcategories**:

| Type | Example | Fix |
|------|---------|-----|
| **Synchronous IPC** | Calling system service synchronously | Use async API variant |
| **File I/O** | `Data(contentsOf:)` on main thread | Move to background queue |
| **Network** | Synchronous URL request | Use URLSession async |
| **Lock contention** | Waiting for lock held by background thread | Reduce critical section, use actors |
| **Semaphore/dispatch_sync** | Blocking on background work | Restructure to async completion |

## Decision Tree — Diagnosing Hangs

```
START: App hangs reported
  │
  ├─→ Do you have hang diagnostics from Organizer or MetricKit?
  │     │
  │     ├─→ YES: Examine stack trace
  │     │     │
  │     │     ├─→ Stack shows your code running
  │     │     │     → BUSY: Main thread doing work
  │     │     │     → Profile with Time Profiler
  │     │     │
  │     │     └─→ Stack shows waiting (semaphore, lock, dispatch_sync)
  │     │           → BLOCKED: Main thread waiting
  │     │           → Profile with System Trace
  │     │
  │     └─→ NO: Can you reproduce?
  │           │
  │           ├─→ YES: Profile with Time Profiler first
  │           │     │
  │           │     ├─→ High CPU on main thread
  │           │     │     → BUSY: Optimize the work
  │           │     │
  │           │     └─→ Low CPU, thread blocked
  │           │           → Use System Trace to find what's blocking
  │           │
  │           └─→ NO: Enable MetricKit in app
  │                 → Wait for field reports
  │                 → Check Organizer > Hangs
```

## Tool Selection

| Scenario | Primary Tool | Why |
|----------|-------------|-----|
| **Reproduces locally** | Time Profiler | See exactly what main thread is doing |
| **Blocked thread suspected** | System Trace | Shows thread state, lock contention |
| **Field reports only** | Xcode Organizer | Aggregated hang diagnostics |
| **Want in-app data** | MetricKit | MXHangDiagnostic with call stacks |
| **Need precise timing** | System Trace | Nanosecond-level thread analysis |

## Time Profiler Workflow for Hangs

1. **Launch Instruments** → Select Time Profiler template
2. **Record during hang** → Reproduce the freeze
3. **Stop recording** → Find the hang period in timeline
4. **Select hang region** → Drag to select frozen timespan
5. **Examine call tree** → Look for main thread work

**What to look for**:
- Functions with high "Self Time" on main thread
- Unexpectedly deep call stacks
- System calls that shouldn't be on main thread

## System Trace Workflow for Blocked Hangs

1. **Launch Instruments** → Select System Trace template
2. **Record during hang** → Capture thread states
3. **Find main thread** → Filter to main thread
4. **Look for red/orange** → Blocked states
5. **Examine blocking reason** → Lock, semaphore, IPC

**Thread states**:
- **Running (blue)**: Executing code
- **Preempted (orange)**: Runnable but not scheduled
- **Blocked (red)**: Waiting for resource

## Common Hang Patterns and Fixes

### Pattern 1: Synchronous File I/O

**Before (hangs)**:
```swift
// Main thread blocks on file read
func loadUserData() {
    let data = try! Data(contentsOf: largeFileURL)  // BLOCKS
    processData(data)
}
```

**After (async)**:
```swift
func loadUserData() {
    Task.detached {
        let data = try Data(contentsOf: largeFileURL)
        await MainActor.run {
            self.processData(data)
        }
    }
}
```

### Pattern 2: Unfiltered Notification Observer

**Before (processes all)**:
```swift
NotificationCenter.default.addObserver(
    self,
    selector: #selector(handleChange),
    name: .NSManagedObjectContextObjectsDidChange,
    object: nil  // Receives ALL contexts
)
```

**After (filtered)**:
```swift
NotificationCenter.default.addObserver(
    self,
    selector: #selector(handleChange),
    name: .NSManagedObjectContextObjectsDidChange,
    object: relevantContext  // Only this context
)
```

### Pattern 3: Expensive Formatter Creation

**Before (creates each time)**:
```swift
func formatDate(_ date: Date) -> String {
    let formatter = DateFormatter()  // EXPENSIVE
    formatter.dateStyle = .medium
    return formatter.string(from: date)
}
```

**After (cached)**:
```swift
private static let dateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    return formatter
}()

func formatDate(_ date: Date) -> String {
    Self.dateFormatter.string(from: date)
}
```

### Pattern 4: dispatch_sync to Main Thread

**Before (deadlock risk)**:
```swift
// From background thread
DispatchQueue.main.sync {  // BLOCKS if main is blocked
    updateUI()
}
```

**After (async)**:
```swift
DispatchQueue.main.async {
    self.updateUI()
}
```

### Pattern 5: Semaphore for Async Result

**Before (blocks main thread)**:
```swift
func fetchDataSync() -> Data {
    let semaphore = DispatchSemaphore(value: 0)
    var result: Data?

    URLSession.shared.dataTask(with: url) { data, _, _ in
        result = data
        semaphore.signal()
    }.resume()

    semaphore.wait()  // BLOCKS MAIN THREAD
    return result!
}
```

**After (async/await)**:
```swift
func fetchData() async throws -> Data {
    let (data, _) = try await URLSession.shared.data(from: url)
    return data
}
```

### Pattern 6: Lock Contention

**Before (shared lock)**:
```swift
class DataManager {
    private let lock = NSLock()
    private var cache: [String: Data] = [:]

    func getData(for key: String) -> Data? {
        lock.lock()  // Main thread waits for background
        defer { lock.unlock() }
        return cache[key]
    }
}
```

**After (actor)**:
```swift
actor DataManager {
    private var cache: [String: Data] = [:]

    func getData(for key: String) -> Data? {
        cache[key]  // Actor serializes access safely
    }
}
```

### Pattern 7: App Launch Hang (Watchdog)

**Before (too much work)**:
```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    loadAllUserData()      // Expensive
    setupAnalytics()       // Network calls
    precomputeLayouts()    // CPU intensive
    return true
}
```

**After (deferred)**:
```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // Only essential setup
    setupMinimalUI()
    return true
}

func applicationDidBecomeActive(_ application: UIApplication) {
    // Defer non-essential work
    Task {
        await loadUserDataInBackground()
    }
}
```

### Pattern 8: Image Processing on Main Thread

**Before (blocks UI)**:
```swift
func processImage(_ image: UIImage) {
    let filtered = applyExpensiveFilter(image)  // BLOCKS
    imageView.image = filtered
}
```

**After (background processing)**:
```swift
func processImage(_ image: UIImage) {
    imageView.image = placeholder

    Task.detached(priority: .userInitiated) {
        let filtered = applyExpensiveFilter(image)
        await MainActor.run {
            self.imageView.image = filtered
        }
    }
}
```

## Xcode Organizer Hang Diagnostics

**Window > Organizer > Select App > Hangs**

The Organizer shows aggregated hang data from users who opted into sharing diagnostics.

**Reading the report**:
1. **Hang Rate**: Hangs per day per device
2. **Call Stack**: Where the hang occurred
3. **Device/OS breakdown**: Which configurations affected

**Interpreting call stacks**:
- **Your code at top**: Main thread busy with your work
- **System API at top**: You called blocking API on main thread
- **pthread_mutex/semaphore**: Lock contention or explicit waiting

## MetricKit Hang Diagnostics

Adopt MetricKit to receive hang diagnostics in your app:

```swift
import MetricKit

class MetricsSubscriber: NSObject, MXMetricManagerSubscriber {
    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            if let hangDiagnostics = payload.hangDiagnostics {
                for diagnostic in hangDiagnostics {
                    analyzeHang(diagnostic)
                }
            }
        }
    }

    private func analyzeHang(_ diagnostic: MXHangDiagnostic) {
        // Duration of the hang
        let duration = diagnostic.hangDuration

        // Call stack tree (needs symbolication)
        let callStack = diagnostic.callStackTree

        // Send to your analytics
        uploadHangDiagnostic(duration: duration, callStack: callStack)
    }
}
```

**Key MXHangDiagnostic properties**:
- `hangDuration`: How long the hang lasted
- `callStackTree`: MXCallStackTree with frames
- `signatureIdentifier`: For grouping similar hangs

## Watchdog Terminations

The watchdog kills apps that hang during key transitions:

| Transition | Time Limit | Consequence |
|------------|-----------|-------------|
| **App launch** | ~20 seconds | App killed, crash logged |
| **Background transition** | ~5 seconds | App killed |
| **Foreground transition** | ~10 seconds | App killed |

**Watchdog disabled in**:
- Simulator
- Debugger attached
- Development builds (sometimes)

**Watchdog kills are logged as crashes** with exception type `EXC_CRASH (SIGKILL)` and termination reason `Namespace RUNNINGBOARD, Code 3735883980` (hex `0xDEAD10CC` — indicates app held a file lock or SQLite database lock while being suspended).

## Pressure Scenarios

### Scenario 1: Manager Says "Just Add a Loading Spinner"

**Situation**: App hangs during data load. Manager suggests adding spinner to "fix" it.

**Why this fails**: Adding a spinner doesn't prevent the hang—the UI still freezes, the spinner won't animate, and the app remains unresponsive.

**Correct response**: "A spinner won't animate during a hang because the main thread is blocked. We need to move this work off the main thread so the spinner can actually spin and the app stays responsive."

### Scenario 2: "It Works Fine in Testing"

**Situation**: QA can't reproduce the hang. Logs show it happens in production.

**Analysis**:
1. Field devices have different data sizes
2. Network conditions vary (slow connection = longer sync)
3. Background apps consume memory/CPU
4. Watchdog is disabled in debug builds

**Action**:
- Add MetricKit to capture field diagnostics
- Test with production-sized datasets
- Test without debugger attached
- Check Organizer for hang reports

### Scenario 3: "We've Always Done It This Way"

**Situation**: Legacy code calls synchronous API on main thread. Refactoring is "too risky."

**Why it matters**: Even if it worked before:
- Data may have grown larger
- OS updates may have changed timing
- New devices have different characteristics
- Users notice more as apps get faster

**Approach**:
1. Add metrics to measure current hang rate
2. Refactor incrementally with feature flags
3. A/B test to show improvement
4. Document risk of not fixing

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Wrong | Instead |
|--------------|----------------|---------|
| `DispatchQueue.main.sync` from background | Can deadlock, always blocks | Use `.async` |
| Semaphore to convert async to sync | Blocks calling thread | Stay async with completion/await |
| File I/O on main thread | Unpredictable latency | Background queue |
| Unfiltered notification observer | Processes irrelevant events | Filter by object/name |
| Creating formatters in loops | Expensive initialization | Cache and reuse |
| Synchronous network request | Blocks on network latency | URLSession async |

## Hang Prevention Checklist

Before shipping, verify:

- [ ] No `Data(contentsOf:)` or file reads on main thread
- [ ] No `DispatchQueue.main.sync` from background threads
- [ ] No semaphore.wait() on main thread
- [ ] Formatters (DateFormatter, NumberFormatter) are cached
- [ ] Notification observers filter appropriately
- [ ] Launch work is minimized (defer non-essential)
- [ ] Image processing happens off main thread
- [ ] Database queries don't run on main thread
- [ ] MetricKit adopted for field diagnostics

## Resources

**WWDC**: 2021-10258, 2022-10082

**Docs**: /xcode/analyzing-responsiveness-issues-in-your-shipping-app, /metrickit/mxhangdiagnostic

**Skills**: axiom-metrickit-ref, axiom-performance-profiling, axiom-swift-concurrency
