---
name: axiom-background-processing-diag
description: Symptom-based background task troubleshooting - decision trees for 'task never runs', 'task terminates early', 'works in dev not prod', 'handler not called', with time-cost analysis for each diagnosis path
license: MIT
metadata:
  version: "1.0.0"
---

# Background Processing Diagnostics

Symptom-based troubleshooting for background task issues.

**Related skills**: `axiom-background-processing` (patterns, checklists), `axiom-background-processing-ref` (API reference)

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

| Approach | Time | Success Rate |
|----------|------|--------------|
| Check Info.plist + registration | 5 min | 70% (catches most issues) |
| Add console logging | 15 min | 90% |
| LLDB simulate launch | 5 min | 95% (confirms handler works) |
| Random code changes | 2+ hours | Low |

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
│  ├─ Using URLSessionConfiguration.background()?
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
│  └─ Battery < 20%?
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
| Critically Low Battery | Battery < 20%? |
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
│  └─ Set too far in future (> 1 week)?
│     └─ System may skip task entirely
│
├─ Step 2: Check scheduling pattern (2 min)
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

### Expected Behavior

| Task Type | Scheduling Behavior |
|-----------|---------------------|
| BGAppRefreshTask | Runs before predicted app usage times |
| BGProcessingTask | Runs when charging + idle (typically overnight) |
| Silent Push | Rate-limited; 14 pushes may = 7 launches |

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
│  └─ Multiple submit() calls queued?
│     └─ System may batch into single execution
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
- [ ] setTaskCompleted called in all paths?
- [ ] Expiration handler set first?

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
subsystem:com.apple.backgroundtaskscheduler

// Specific to your app
subsystem:com.apple.backgroundtaskscheduler message:"com.yourapp"
```

### Expected Log Sequence

1. "Registered handler for task with identifier"
2. "Scheduling task with identifier"
3. "Starting task with identifier"
4. (your work executes)
5. "Task completed with identifier"

Missing any step = issue at that stage.

---

## Resources

**WWDC**: 2019-707 (debugging commands), 2020-10063 (7 factors)

**Skills**: axiom-background-processing, axiom-background-processing-ref

---

**Last Updated**: 2025-12-31
**Platforms**: iOS 13+
