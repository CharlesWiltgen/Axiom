
# Background Processing Diagnostics

Symptom-based troubleshooting for background task issues.

**Related skills**: `skills/background-processing.md` (patterns, checklists), `skills/background-processing-ref.md` (API reference)

---

## Symptom 1: Task Never Runs

Handler never called despite successful `submit()`.

### Quick Diagnosis (5 minutes)

```
Task never runs?
│
├─ Step 1: Check Info.plist (2 min)
│  ├─ BGTaskSchedulerPermittedIdentifiers contains EXACT identifier?
│  │  └─ NO → Add identifier, rebuild
│  ├─ UIBackgroundModes includes "fetch" or "processing"?
│  │  └─ NO → Add required mode
│  └─ Identifiers case-sensitive match code?
│     └─ NO → Fix typo, rebuild
│
├─ Step 2: Check registration timing (2 min)
│  ├─ Registered in didFinishLaunchingWithOptions?
│  │  └─ NO → Move registration before return true
│  └─ Registration before first submit()?
│     └─ NO → Ensure register() precedes submit()
│
└─ Step 3: Check app state (1 min)
   ├─ App swiped away from App Switcher?
   │  └─ YES → No background until user opens app
   └─ Background App Refresh disabled in Settings?
      └─ YES → Enable or inform user
```

### Time-Cost Analysis

| Approach | Time | What it establishes |
|----------|------|---------------------|
| Check Info.plist + registration | 5 min | Rules out the two most common causes — identifier not permitted, handler registered after launch |
| Add console logging | 15 min | How far the launch actually got: registration, submit, run request |
| LLDB simulate launch | 5 min | Separates a broken handler from a request the system never granted |
| Random code changes | 2+ hours | Nothing — it cannot tell the two failure sites above apart |

### LLDB Quick Test

Verify handler is correctly registered:

```lldb
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.yourapp.refresh"]
```

If breakpoint hits → Registration correct, issue is scheduling/system factors.
If nothing happens → Registration broken.

---

## Symptom 2: Task Terminates Unexpectedly

Handler called but work doesn't complete before termination.

### Quick Diagnosis (5 minutes)

```
Task terminates early?
│
├─ Step 1: Check expiration handler (1 min)
│  ├─ Expiration handler set FIRST in handler?
│  │  └─ NO → Move to very first line
│  └─ Expiration handler actually cancels work?
│     └─ NO → Add cancellation logic
│
├─ Step 2: Check setTaskCompleted (2 min)
│  ├─ Called in success path?
│  ├─ Called in failure path?
│  ├─ Called after expiration?
│  └─ ANY path missing → Task never signals completion
│
├─ Step 3: Check work duration (2 min)
│  ├─ BGAppRefreshTask work > 30 seconds?
│  │  └─ YES → Chunk work or use BGProcessingTask
│  └─ BGProcessingTask work > system limit?
│     └─ YES → Save progress, resume on next launch
```

### Common Causes

| Cause | Fix |
|-------|-----|
| Missing expiration handler | Set handler as first line |
| setTaskCompleted not called | Add to ALL code paths |
| Work takes too long | Chunk and checkpoint |
| Network timeout > task time | Use background URLSession |
| Async callback after expiration | Check shouldContinue flag |

**No expirationHandler = complete and unsuccessful.** A `nil` expirationHandler on a multi-minute sync does NOT buy more time: "Not setting an expiration handler results in the system marking your task as complete and unsuccessful instead of sending a warning." Always set it, and have it cancel in-flight work so a checkpoint can be saved. The kill risk sits on the other call — not calling `setTaskCompleted` before the task's time expires may result in the system killing your app.

### Swift 6 Expiration Bridge

Map expiration to cooperative cancellation. Do NOT reach for `Operation`/`isCancelled` polling — bridge `expirationHandler` to `Task.cancel()` and checkpoint on `CancellationError`.

```swift
@preconcurrency import BackgroundTasks  // BGTask is not Sendable-annotated

func handleSync(task: BGProcessingTask) {
    let work = Task {
        var completed = false
        do {
            try await withTaskCancellationHandler {
                for batch in pendingBatches {
                    try Task.checkCancellation()  // exits at expiration
                    try await sync(batch)
                    saveCheckpoint(after: batch)  // resume here next launch
                }
            } onCancel: {
                // Runs on arbitrary thread at expiration — keep lightweight
            }
            completed = true
        } catch {
            // CancellationError — the checkpoint from the previous batch stands
        }
        // REQUIRED on both paths: a success-only call is skipped by the throw above
        task.setTaskCompleted(success: completed)
    }

    task.expirationHandler = { work.cancel() }  // expiration → cancellation
}
```

Two Swift 6 constraints this pattern has to respect: the type owning the work must be `Sendable` (or an actor), since the work task captures it; and the register closure — not this handler — must be defined in a `nonisolated` context, because a closure formed inside a `@MainActor` method inherits MainActor isolation and the system calls it on a background queue (`dispatch_assert_queue_fail` before the body runs).

`Task.checkCancellation()` throws `CancellationError` the moment the system expires the task, so the next launch resumes from the last checkpoint instead of redoing the whole sync.

### Test Expiration Handling

```lldb
// First simulate launch
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.yourapp.refresh"]

// Then force expiration
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateExpirationForTaskWithIdentifier:@"com.yourapp.refresh"]
```

Verify expiration handler runs and work stops gracefully.

---

## Symptom 3: Background URLSession Delegate Not Called

Download completes but `didFinishDownloadingTo` never fires.

### Quick Diagnosis (5 minutes)

```
URLSession delegate not called?
│
├─ Step 1: Check session configuration (2 min)
│  ├─ Using URLSessionConfiguration.background(withIdentifier:)?
│  │  └─ NO → Must use background config
│  ├─ Session identifier unique?
│  │  └─ NO → Use unique bundle-prefixed ID
│  └─ sessionSendsLaunchEvents = true?
│     └─ NO → Set for app relaunch on completion
│
├─ Step 2: Check AppDelegate handler (2 min)
│  ├─ handleEventsForBackgroundURLSession implemented?
│  │  └─ NO → Required for session events
│  └─ Completion handler stored and called later?
│     └─ NO → Store handler, call after events processed
│
└─ Step 3: Check delegate assignment (1 min)
   ├─ Session created with delegate?
   └─ Delegate not nil when task completes?
```

### Required AppDelegate Code

```swift
// Store completion handler
var backgroundSessionCompletionHandler: (() -> Void)?

func application(_ application: UIApplication,
                 handleEventsForBackgroundURLSession identifier: String,
                 completionHandler: @escaping () -> Void) {
    backgroundSessionCompletionHandler = completionHandler
}

// Call after all events processed
func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    DispatchQueue.main.async {
        self.backgroundSessionCompletionHandler?()
        self.backgroundSessionCompletionHandler = nil
    }
}
```

---

## Symptom 4: Works in Development, Not Production

Task runs with debugger but fails in release builds or for users.

### Quick Diagnosis (10 minutes)

```
Works in dev, not prod?
│
├─ Step 1: Check system constraints (3 min)
│  ├─ Low Power Mode enabled?
│  │  └─ Check ProcessInfo.isLowPowerModeEnabled
│  ├─ Background App Refresh disabled?
│  │  └─ Check UIApplication.backgroundRefreshStatus
│  └─ Battery critically low?
│     └─ System pauses discretionary work
│
├─ Step 2: Check app state (2 min)
│  ├─ App force-quit from App Switcher?
│  │  └─ YES → No background until foreground launch
│  └─ App recently used?
│     └─ Rarely used apps get lower priority
│
├─ Step 3: Check build differences (3 min)
│  ├─ Debug vs Release optimization differences?
│  ├─ #if DEBUG code excluding production?
│  └─ Different bundle identifier in release?
│
└─ Step 4: Add production logging (2 min)
   └─ Log task schedule/launch/complete to analytics
```

### The 7 Scheduling Factors

All affect task execution in production:

| Factor | Check |
|--------|-------|
| Critically Low Battery | Battery very low (no threshold published)? |
| Low Power Mode | ProcessInfo.isLowPowerModeEnabled |
| App Usage | User opens app frequently? |
| App Switcher | App NOT swiped away? |
| Background App Refresh | Settings enabled? |
| System Budgets | Many recent background launches? |
| Rate Limiting | Requests too frequent? |

### Production Debugging

Add logging to track what's happening:

```swift
func scheduleRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.app.refresh")
    do {
        // `submit(_:)` is deprecated in iOS 27 (still functional, and it is the only
        // form below iOS 27). On iOS 27 use `try await submitTaskRequest(_:)`.
        try BGTaskScheduler.shared.submit(request)
        Analytics.log("background_task_scheduled")
    } catch {
        Analytics.log("background_task_schedule_failed", error: error)
    }
}

func handleRefresh(task: BGAppRefreshTask) {
    Analytics.log("background_task_started")
    // ... work ...
    Analytics.log("background_task_completed")
    task.setTaskCompleted(success: true)
}
```

---

## Symptom 5: Inconsistent Task Scheduling

Task runs sometimes but not predictably.

### Quick Diagnosis (5 minutes)

```
Inconsistent scheduling?
│
├─ Step 1: Understand earliestBeginDate (2 min)
│  ├─ This is MINIMUM delay, not scheduled time
│  │  └─ System runs when convenient AFTER this date
│  └─ Set far in the future?
│     └─ It is a floor — the system runs later, never earlier
│
├─ Step 2: Check scheduling pattern (2 min)
│  ├─ Does the handler reschedule as its FIRST line?
│  │  └─ NO → Runs once, never again — fix this first
│  ├─ Scheduling same task multiple times?
│  │  └─ Call getPendingTaskRequests to check
│  └─ Scheduling in handler for continuity?
│     └─ Required for continuous refresh
│
└─ Step 3: Understand system behavior (1 min)
   ├─ BGAppRefreshTask runs based on USER patterns
   │  └─ User rarely opens app = rare runs
   └─ BGProcessingTask runs when charging
      └─ User doesn't charge overnight = no runs
```

**Reschedule is the FIRST line of the handler.** BGTask requests are one-shot — the system consumes the request when it launches you. If you reschedule at the end, any early `return`, thrown error, or expiration skips it and the task never runs again. Submit the next request before doing any work.

### Prove the "Never Reschedules" Bug

`getPendingTaskRequests` is the direct diagnostic: query it shortly after a launch. If the queue is empty, the handler launched but never re-submitted — the bug is confirmed, not a system-throttling guess.

```swift
BGTaskScheduler.shared.getPendingTaskRequests { requests in
    print("Pending after launch: \(requests.map(\.identifier))")
    // [] → handler ran but never rescheduled
}
```

### Expected Behavior

| Task Type | Scheduling Behavior |
|-----------|---------------------|
| BGAppRefreshTask | Runs before predicted app usage times |
| BGProcessingTask | Runs when charging + idle (typically overnight) |
| Silent Push | Coalesced and rate-limited (see below) |

### Silent Push Is Not a Polling Hammer

A "send a silent push every minute" / "60s Timer" plan does NOT yield per-minute background runs. Silent pushes (`content-available: 1`, `apns-priority: 5`) are low priority: the system may throttle delivery if the total number becomes excessive, and "the number of background notifications allowed by the system depends on current conditions, but don't try to send more than two or three per hour". Apple publishes no coalescing ratio, launch count, or interval floor, and the budget depletes with each launch and refills over the day, so a high-frequency cadence buys fewer total launches, not more. For genuinely time-sensitive delivery, use a visible notification (`apns-priority: 10`) — not a silent-push flood.

**Key insight**: You request a time window. System decides when (or if) to run.

---

## Symptom 6: App Crashes on Background Launch

App crashes when launched by system for background task.

### Quick Diagnosis (5 minutes)

```
Crash on background launch?
│
├─ Step 1: Check launch initialization (2 min)
│  ├─ UI setup before task handler?
│  │  └─ Background launch may not have UI context
│  ├─ Accessing files before first unlock?
│  │  └─ Use completeUntilFirstUserAuthentication protection
│  └─ Force unwrapping optionals that may be nil?
│     └─ Guard against nil in background context
│
├─ Step 2: Check handler safety (2 min)
│  ├─ Handler captures self strongly?
│  │  └─ Use [weak self] to prevent retain cycles
│  └─ Handler accesses UI on non-main thread?
│     └─ Dispatch UI work to main queue
│
└─ Step 3: Check data protection (1 min)
   └─ Files accessible when device locked?
      └─ Use .completeUnlessOpen or .completeUntilFirstUserAuthentication
```

### File Protection for Background Tasks

```swift
// Set appropriate protection when creating files
try data.write(to: url, options: .completeFileProtectionUntilFirstUserAuthentication)

// Or configure in entitlements for entire app
```

### Safe Handler Pattern

```swift
BGTaskScheduler.shared.register(
    forTaskWithIdentifier: "com.app.refresh",
    using: nil
) { [weak self] task in
    guard let self = self else {
        task.setTaskCompleted(success: false)
        return
    }

    // Don't access UI
    // Use background-safe APIs only
    self.performBackgroundWork(task: task)
}
```

---

## Symptom 7: Task Runs Multiple Times

Same task appears to run repeatedly or in parallel.

### Quick Diagnosis (5 minutes)

```
Task runs multiple times?
│
├─ Step 1: Check scheduling logic (2 min)
│  ├─ Scheduling on every app launch?
│  │  └─ Check getPendingTaskRequests first
│  ├─ Scheduling in handler AND elsewhere?
│  │  └─ Consolidate to single location
│  └─ Using same identifier for different purposes?
│     └─ Use unique identifiers per task type
│
├─ Step 2: Check for duplicate submissions (2 min)
│  └─ Multiple submit() calls for the same identifier?
│     └─ Each replaces the pending request; beyond 1 refresh /
│        10 processing requests the system throws
│        TooManyPendingTaskRequests
│
└─ Step 3: Check handler execution (1 min)
   └─ setTaskCompleted called promptly?
      └─ Delay may cause system to think task hung
```

### Prevent Duplicate Scheduling

```swift
func scheduleRefreshIfNeeded() {
    BGTaskScheduler.shared.getPendingTaskRequests { requests in
        let alreadyScheduled = requests.contains {
            $0.identifier == "com.app.refresh"
        }

        if !alreadyScheduled {
            self.scheduleRefresh()
        }
    }
}
```

---

## Quick Diagnostic Checklist

### 30-Second Check

- [ ] Info.plist has identifier?
- [ ] Registration in didFinishLaunchingWithOptions?
- [ ] App not swiped away?

### 5-Minute Check

- [ ] Identifiers exactly match (case-sensitive)?
- [ ] Background mode enabled (fetch/processing)?
- [ ] Handler reschedules as its FIRST line?
- [ ] setTaskCompleted called in all paths?
- [ ] Expiration handler set (and cancels work)?

### 15-Minute Investigation

- [ ] LLDB simulate launch works?
- [ ] LLDB simulate expiration handled?
- [ ] Console shows registration/scheduling logs?
- [ ] Real device (not just simulator)?
- [ ] Release build (not just debug)?
- [ ] Background App Refresh enabled in Settings?

---

## Console Log Filters

```
// All background task events
subsystem:com.apple.backgroundtasks

// Narrowed to one process
subsystem:com.apple.backgroundtasks AND process:"YourApp"
```

The subsystem literal is `com.apple.backgroundtasks` (category `framework`) — verified against the iOS 27.2 runtime's dyld shared cache and the live unified log, where the framework's own records read `[com.apple.backgroundtasks:framework]`. A filter naming a subsystem that does not exist matches nothing and reports clean, which is the worst failure mode for a diagnostic.

### Expected Log Sequence

The framework's own strings, in launch order:

1. `registerForTaskWithIdentifier: %{public}@` — handler registered
2. `submitTaskRequest for %{public}@ called before registering task` / `submitTaskRequest failed for %{public}@` — the submission never landed
3. `Processing pending event for %@` / `Received run request for %@` — the system launched you
4. `Received request to expire %@ with reason mask: 0x%llx` — expiration delivered
5. `Launch handler for task with identifier %@ has already been registered` — duplicate registration (the system kills the app on the second registration of one identifier)

Missing step 3 with step 1 present = the system never granted the request; go to the scheduling factors, not the handler.

---

## Resources

**WWDC**: 2019-707 (debugging commands), 2020-10063 (7 factors)

**Skills**: skills/background-processing.md, skills/background-processing-ref.md

---

**Platforms**: iOS 13+
