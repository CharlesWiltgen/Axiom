---
name: axiom-background-processing
description: Use when implementing BGTaskScheduler, debugging background tasks that never run, understanding why tasks terminate early, or testing background execution - systematic task lifecycle management with proper registration, expiration handling, and Swift 6 cancellation patterns
license: MIT
metadata:
  version: "1.0.0"
---

# Background Processing

## Overview

Background execution is a **privilege**, not a right. iOS actively limits background work to protect battery life and user experience. **Core principle**: Treat background tasks as discretionary jobs — you request a time window, the system decides when (or if) to run your code.

**Key insight**: Most "my task never runs" issues stem from registration mistakes or misunderstanding the 7 scheduling factors that govern execution. This skill provides systematic debugging, not guesswork.

**Energy optimization**: For reducing battery impact of background tasks, see `axiom-energy` skill. This skill focuses on task **mechanics** — making tasks run correctly and complete reliably.

**Requirements**: iOS 13+ (BGTaskScheduler), iOS 26+ (BGContinuedProcessingTask), Xcode 15+

## Example Prompts

Real questions developers ask that this skill answers:

#### 1. "My background task never runs. I register it, schedule it, but nothing happens."
→ The skill covers the registration checklist and debugging decision tree for "task never runs" issues

#### 2. "How do I test background tasks? They don't seem to trigger in the simulator."
→ The skill covers LLDB debugging commands and simulator limitations

#### 3. "My task gets terminated before it completes. How do I extend the time?"
→ The skill covers task types (BGAppRefresh 30s vs BGProcessing minutes), expiration handlers, and incremental progress saving

#### 4. "Should I use BGAppRefreshTask or BGProcessingTask? What's the difference?"
→ The skill provides decision tree for choosing the correct task type based on work duration and system requirements

#### 5. "How do I integrate Swift 6 concurrency with background task expiration?"
→ The skill covers withTaskCancellationHandler patterns for bridging BGTask expiration to structured concurrency

#### 6. "My background task works in development but not in production."
→ The skill covers the 7 scheduling factors, throttling behavior, and production debugging

---

## Red Flags — Task Won't Run or Terminates

If you see ANY of these, suspect registration or scheduling issues:

- **Task never runs**: Handler never called despite successful `submit()`
- **Task terminates immediately**: Handler called but work doesn't complete
- **Works in dev, not prod**: Task runs with debugger but not in release builds
- **Console shows no launch**: No "BackgroundTask" entries in unified logging
- **Identifier mismatch errors**: Task identifier not matching Info.plist
- **"No handler registered"**: Handler not registered before first scheduling

#### Difference from energy issues
- **Energy issue**: Task runs but drains battery (see `axiom-energy` skill)
- **This skill**: Task doesn't run, or terminates before completing work

---

## Mandatory First Steps

**ALWAYS verify these before debugging code**:

### Step 1: Verify Info.plist Configuration (2 minutes)

```xml
<!-- Required in Info.plist -->
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>com.yourapp.refresh</string>
    <string>com.yourapp.processing</string>
</array>

<!-- For BGAppRefreshTask -->
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
</array>

<!-- For BGProcessingTask (add to UIBackgroundModes) -->
<array>
    <string>fetch</string>
    <string>processing</string>
</array>
```

**Common mistake**: Identifier in code doesn't EXACTLY match Info.plist. Check for typos, case sensitivity.

### Step 2: Verify Registration Timing (2 minutes)

Registration MUST happen before app finishes launching:

```swift
// ✅ CORRECT: Register in didFinishLaunchingWithOptions
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "com.yourapp.refresh",
        using: nil
    ) { task in
        // Safe force cast: identifier guarantees BGAppRefreshTask type
        self.handleAppRefresh(task: task as! BGAppRefreshTask)
    }

    return true  // Register BEFORE returning
}

// ❌ WRONG: Registering after launch or on-demand
func someButtonTapped() {
    // TOO LATE - registration won't work
    BGTaskScheduler.shared.register(...)
}
```

**Exception**: BGContinuedProcessingTask (iOS 26+) uses dynamic registration when user initiates the action.

### Step 3: Check Console Logs (5 minutes)

Filter Console.app for background task events:

```
subsystem:com.apple.backgroundtaskscheduler
```

Look for:
- "Registered handler for task with identifier"
- "Scheduling task with identifier"
- "Starting task with identifier"
- "Task completed with identifier"
- Error messages about missing handlers or identifiers

### Step 4: Verify App Not Swiped Away (1 minute)

**Critical**: If user force-quits app from App Switcher, NO background tasks will run.

Check in App Switcher: Is your app still visible? Swiping away = no background execution until user launches again.

---

## Background Task Decision Tree

```
Need to run code in the background?
│
├─ User initiated the action explicitly (button tap)?
│  ├─ iOS 26+? → BGContinuedProcessingTask (Pattern 4)
│  └─ iOS 13-25? → beginBackgroundTask + save progress (Pattern 5)
│
├─ Keep content fresh throughout the day?
│  ├─ Runtime needed ≤ 30 seconds? → BGAppRefreshTask (Pattern 1)
│  └─ Need several minutes? → BGProcessingTask with constraints (Pattern 2)
│
├─ Deferrable maintenance work (DB cleanup, ML training)?
│  └─ BGProcessingTask with requiresExternalPower (Pattern 2)
│
├─ Large downloads/uploads?
│  └─ Background URLSession (Pattern 6)
│
├─ Triggered by server data changes?
│  └─ Silent push notification → fetch data → complete handler (Pattern 7)
│
└─ Short critical work when app backgrounds?
   └─ beginBackgroundTask (Pattern 5)
```

### Task Type Comparison

| Type | Runtime | When Runs | Use Case |
|------|---------|-----------|----------|
| BGAppRefreshTask | ~30 seconds | Based on user app usage patterns | Fetch latest content |
| BGProcessingTask | Several minutes | Device charging, idle (typically overnight) | Maintenance, ML training |
| BGContinuedProcessingTask | Extended | System-managed with progress UI | User-initiated export/publish |
| beginBackgroundTask | ~30 seconds | Immediately when backgrounding | Save state, finish upload |
| Background URLSession | As needed | System-friendly time, even after termination | Large transfers |

---

## Common Patterns

### Pattern 1: BGAppRefreshTask — Keep Content Fresh

**Use when**: You need to fetch new content so app feels fresh when user opens it.

**Runtime**: ~30 seconds

**When system runs it**: Predicted based on user's app usage patterns. If user opens app every morning, system learns and refreshes before then.

#### Registration (at app launch)

```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "com.yourapp.refresh",
        using: nil
    ) { task in
        self.handleAppRefresh(task: task as! BGAppRefreshTask)
    }

    return true
}
```

#### Scheduling (when app backgrounds)

```swift
func scheduleAppRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.yourapp.refresh")

    // earliestBeginDate = MINIMUM delay, not exact time
    // System may run hours later based on usage patterns
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)  // At least 15 min

    do {
        try BGTaskScheduler.shared.submit(request)
    } catch {
        print("Failed to schedule refresh: \(error)")
    }
}

// Call when app enters background
func applicationDidEnterBackground(_ application: UIApplication) {
    scheduleAppRefresh()
}

// Or with SceneDelegate / SwiftUI
.onChange(of: scenePhase) { newPhase in
    if newPhase == .background {
        scheduleAppRefresh()
    }
}
```

#### Handler

```swift
func handleAppRefresh(task: BGAppRefreshTask) {
    // 1. IMMEDIATELY set expiration handler
    task.expirationHandler = { [weak self] in
        // Cancel any in-progress work
        self?.currentOperation?.cancel()
    }

    // 2. Schedule NEXT refresh (continuous refresh pattern)
    scheduleAppRefresh()

    // 3. Do the work
    fetchLatestContent { [weak self] result in
        switch result {
        case .success:
            task.setTaskCompleted(success: true)
        case .failure:
            task.setTaskCompleted(success: false)
        }
    }
}
```

**Key points**:
- Set expiration handler FIRST
- Schedule next refresh inside handler (continuous pattern)
- Call `setTaskCompleted` in ALL code paths (success AND failure)
- Keep work under 30 seconds

---

### Pattern 2: BGProcessingTask — Deferrable Maintenance

**Use when**: Maintenance work that can wait for optimal system conditions (charging, WiFi, idle).

**Runtime**: Several minutes

**When system runs it**: Typically overnight when device is charging. May not run daily.

#### Registration

```swift
BGTaskScheduler.shared.register(
    forTaskWithIdentifier: "com.yourapp.maintenance",
    using: nil
) { task in
    self.handleMaintenance(task: task as! BGProcessingTask)
}
```

#### Scheduling with Constraints

```swift
func scheduleMaintenanceIfNeeded() {
    // Be conscientious — only schedule when work is actually needed
    guard needsMaintenance() else { return }

    let request = BGProcessingTaskRequest(identifier: "com.yourapp.maintenance")

    // CRITICAL: Set requiresExternalPower for CPU-intensive work
    request.requiresExternalPower = true

    // Optional: Require network for cloud sync
    request.requiresNetworkConnectivity = true

    // Don't set earliestBeginDate too far — max ~1 week
    // If user doesn't return to app, task won't run

    do {
        try BGTaskScheduler.shared.submit(request)
    } catch BGTaskScheduler.Error.unavailable {
        print("Background processing not available")
    } catch {
        print("Failed to schedule: \(error)")
    }
}
```

#### Handler with Progress Checkpointing

```swift
func handleMaintenance(task: BGProcessingTask) {
    var shouldContinue = true

    task.expirationHandler = { [weak self] in
        shouldContinue = false
        self?.saveProgress()  // Save partial progress!
    }

    Task {
        do {
            // Process in chunks, checking for expiration
            for chunk in workChunks {
                guard shouldContinue else {
                    // Expiration called — stop gracefully
                    break
                }

                try await processChunk(chunk)
                saveProgress()  // Checkpoint after each chunk
            }

            task.setTaskCompleted(success: true)
        } catch {
            task.setTaskCompleted(success: false)
        }
    }
}
```

**Key points**:
- Set `requiresExternalPower = true` for CPU-intensive work (prevents battery drain)
- Save progress incrementally — task may be interrupted
- Work may never run if user doesn't charge device
- Don't set `earliestBeginDate` more than a week ahead

---

### Pattern 3: SwiftUI backgroundTask Modifier

**Use when**: SwiftUI app using modern async/await patterns.

```swift
@main
struct MyApp: App {
    @Environment(\.scenePhase) var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .onChange(of: scenePhase) { newPhase in
            if newPhase == .background {
                scheduleAppRefresh()
            }
        }
        // Handle app refresh
        .backgroundTask(.appRefresh("com.yourapp.refresh")) {
            // Schedule next refresh
            scheduleAppRefresh()

            // Async work — task completes when closure returns
            await fetchLatestContent()
        }
        // Handle background URLSession events
        .backgroundTask(.urlSession("com.yourapp.downloads")) {
            // Called when background URLSession completes
            await processDownloadedFiles()
        }
    }
}
```

**SwiftUI advantages**:
- Implicit task completion when closure returns (no `setTaskCompleted` needed)
- Native Swift Concurrency support
- Task automatically cancelled on expiration

---

### Pattern 4: BGContinuedProcessingTask (iOS 26+)

**Use when**: User explicitly initiates work (button tap) that should continue after backgrounding, with visible progress.

**NOT for**: Automatic tasks, maintenance, syncing

```swift
// 1. Info.plist — use wildcard for dynamic suffix
// BGTaskSchedulerPermittedIdentifiers:
// "com.yourapp.export.*"

// 2. Register WHEN user initiates action (not at launch)
func userTappedExportButton() {
    BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "com.yourapp.export.photos"
    ) { task in
        let continuedTask = task as! BGContinuedProcessingTask
        self.handleExport(task: continuedTask)
    }

    // Submit immediately
    let request = BGContinuedProcessingTaskRequest(
        identifier: "com.yourapp.export.photos",
        title: "Exporting Photos",
        subtitle: "0 of 100 photos"
    )

    // Optional: Fail if can't start immediately
    request.strategy = .fail  // or .enqueue (default)

    do {
        try BGTaskScheduler.shared.submit(request)
    } catch {
        showError("Cannot export in background right now")
    }
}

// 3. Handler with mandatory progress reporting
func handleExport(task: BGContinuedProcessingTask) {
    var shouldContinue = true

    task.expirationHandler = {
        shouldContinue = false
    }

    // MANDATORY: Report progress (tasks with no progress auto-expire)
    task.progress.totalUnitCount = 100
    task.progress.completedUnitCount = 0

    Task {
        for (index, photo) in photos.enumerated() {
            guard shouldContinue else { break }

            await exportPhoto(photo)

            // Update progress — system shows this to user
            task.progress.completedUnitCount = Int64(index + 1)
        }

        task.setTaskCompleted(success: shouldContinue)
    }
}
```

**Key points**:
- Dynamic registration (when user acts, not at launch)
- Progress reporting is MANDATORY — tasks with no updates auto-expire
- User can monitor and cancel from system UI
- Use `.fail` strategy when work is only useful if it starts immediately

---

### Pattern 5: beginBackgroundTask — Short Critical Work

**Use when**: App is backgrounding and you need ~30 seconds to finish critical work (save state, complete upload).

```swift
var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid

func applicationDidEnterBackground(_ application: UIApplication) {
    // Start background task
    backgroundTaskID = application.beginBackgroundTask(withName: "Save State") { [weak self] in
        // Expiration handler — clean up and end task
        self?.saveProgress()
        if let taskID = self?.backgroundTaskID {
            application.endBackgroundTask(taskID)
        }
        self?.backgroundTaskID = .invalid
    }

    // Do critical work
    saveEssentialState { [weak self] in
        // End task as soon as done — DON'T wait for expiration
        if let taskID = self?.backgroundTaskID, taskID != .invalid {
            UIApplication.shared.endBackgroundTask(taskID)
            self?.backgroundTaskID = .invalid
        }
    }
}
```

**Key points**:
- Call `endBackgroundTask` AS SOON as work completes (not just in expiration handler)
- Failing to end task may cause system to terminate your app and impact future launches
- ~30 seconds max, not guaranteed
- Use for state saving, not ongoing work

---

### Pattern 6: Background URLSession

**Use when**: Large downloads/uploads that should continue even if app terminates.

```swift
// 1. Create background configuration
lazy var backgroundSession: URLSession = {
    let config = URLSessionConfiguration.background(
        withIdentifier: "com.yourapp.downloads"
    )
    config.sessionSendsLaunchEvents = true  // App relaunched when complete
    config.isDiscretionary = true  // System chooses optimal time

    return URLSession(configuration: config, delegate: self, delegateQueue: nil)
}()

// 2. Start download
func downloadFile(from url: URL) {
    let task = backgroundSession.downloadTask(with: url)
    task.resume()
}

// 3. Handle app relaunch for session events (AppDelegate)
func application(_ application: UIApplication,
                 handleEventsForBackgroundURLSession identifier: String,
                 completionHandler: @escaping () -> Void) {

    // Store completion handler — call after processing events
    backgroundSessionCompletionHandler = completionHandler

    // Session delegate methods will be called
}

// 4. URLSessionDelegate
func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    // All events processed — call stored completion handler
    DispatchQueue.main.async {
        self.backgroundSessionCompletionHandler?()
        self.backgroundSessionCompletionHandler = nil
    }
}

func urlSession(_ session: URLSession,
                downloadTask: URLSessionDownloadTask,
                didFinishDownloadingTo location: URL) {
    // Move file from temp location before returning
    let destinationURL = getDestinationURL(for: downloadTask)
    try? FileManager.default.moveItem(at: location, to: destinationURL)
}
```

**Key points**:
- Work handed off to system daemon (`nsurlsessiond`) — continues after app termination
- `isDiscretionary = true` for non-urgent (system waits for WiFi, charging)
- Must handle `handleEventsForBackgroundURLSession` for app relaunch
- Move downloaded files immediately — temp location deleted after delegate returns

---

### Pattern 7: Silent Push Notification Trigger

**Use when**: Server needs to wake app to fetch new data.

#### Server Payload

```json
{
    "aps": {
        "content-available": 1
    },
    "custom-data": "fetch-new-messages"
}
```

Use `apns-priority: 5` (not 10) for energy efficiency.

#### App Handler

```swift
func application(_ application: UIApplication,
                 didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                 fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {

    Task {
        do {
            let hasNewData = try await fetchLatestData()
            completionHandler(hasNewData ? .newData : .noData)
        } catch {
            completionHandler(.failed)
        }
    }
}
```

**Key points**:
- Silent pushes are rate-limited — don't expect launch on every push
- System coalesces multiple pushes (14 pushes may result in 7 launches)
- Budget depletes with each launch and refills throughout day
- ~30 seconds runtime per launch

---

## Swift 6 Cancellation Integration

When using structured concurrency, bridge BGTask expiration to task cancellation:

```swift
func handleAppRefresh(task: BGAppRefreshTask) {
    // Create a Task that respects expiration
    let workTask = Task {
        try await withTaskCancellationHandler {
            // Your async work
            try await fetchAndProcessData()
            task.setTaskCompleted(success: true)
        } onCancel: {
            // Called synchronously when task.cancel() is invoked
            // Note: Runs on arbitrary thread, keep lightweight
        }
    }

    // Bridge expiration to cancellation
    task.expirationHandler = {
        workTask.cancel()  // Triggers onCancel block
    }
}

// Checking cancellation in your work
func fetchAndProcessData() async throws {
    for item in items {
        // Check if we should stop
        try Task.checkCancellation()

        // Or non-throwing check
        guard !Task.isCancelled else {
            saveProgress()
            return
        }

        try await process(item)
    }
}
```

**Key points**:
- `withTaskCancellationHandler` handles cancellation while task is suspended
- `Task.checkCancellation()` throws `CancellationError` if cancelled
- `Task.isCancelled` for non-throwing check
- Cancellation is cooperative — your code must check and respond

---

## Testing Background Tasks

### Simulator Limitations

Background tasks **do not run automatically** in simulator. You must manually trigger them.

### LLDB Debugging Commands

While app is running with debugger attached, pause execution and run:

```lldb
// Trigger task launch
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.yourapp.refresh"]

// Trigger task expiration (test expiration handler)
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateExpirationForTaskWithIdentifier:@"com.yourapp.refresh"]
```

### Testing Workflow

1. Set breakpoint in task handler
2. Run app, let it background
3. Pause in debugger
4. Run `_simulateLaunchForTaskWithIdentifier` command
5. Resume — breakpoint should hit
6. Test expiration with `_simulateExpirationForTaskWithIdentifier`

### Testing Checklist

- [ ] Task handler breakpoint hits when simulated?
- [ ] Expiration handler called when simulated?
- [ ] `setTaskCompleted` called in all code paths?
- [ ] Works on real device (not just simulator)?
- [ ] Works in release build (not just debug)?
- [ ] App not swiped away from App Switcher?

---

## The 7 Scheduling Factors

From WWDC 2020-10063 "Background execution demystified":

| Factor | Description | Impact |
|--------|-------------|--------|
| **Critically Low Battery** | <20% battery | All discretionary work paused |
| **Low Power Mode** | User-enabled | Background activity limited |
| **App Usage** | How often user launches app | More usage = higher priority |
| **App Switcher** | App still visible? | Swiped away = no background |
| **Background App Refresh** | System setting | Off = no BGAppRefresh tasks |
| **System Budgets** | Energy/data budgets | Deplete with launches, refill over day |
| **Rate Limiting** | System spacing | Prevents too-frequent launches |

### Responding to System Constraints

```swift
// Check Low Power Mode
if ProcessInfo.processInfo.isLowPowerModeEnabled {
    // Reduce background work
}

// Listen for changes
NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)
    .sink { _ in
        // Adapt behavior
    }

// Check Background App Refresh status
let status = UIApplication.shared.backgroundRefreshStatus
switch status {
case .available:
    break  // Good to schedule
case .denied:
    // User disabled — prompt to enable in Settings
case .restricted:
    // Parental controls or MDM — can't enable
}
```

---

## Audit Checklists

### Registration Checklist

- [ ] Identifier in Info.plist exactly matches code (case-sensitive)?
- [ ] Correct background mode enabled (`fetch`, `processing`)?
- [ ] Registration happens in `didFinishLaunchingWithOptions` BEFORE return?
- [ ] Not registering same identifier multiple times?
- [ ] Handler closure doesn't capture self strongly?

### Scheduling Checklist

- [ ] Scheduling on main queue or background queue (if performance sensitive)?
- [ ] `earliestBeginDate` not too far in future (max ~1 week)?
- [ ] Handling `submit()` errors?
- [ ] Not scheduling duplicate tasks (check `getPendingTaskRequests`)?

### Handler Checklist

- [ ] Expiration handler set IMMEDIATELY at start of handler?
- [ ] `setTaskCompleted(success:)` called in ALL code paths?
- [ ] Next task scheduled (for continuous patterns)?
- [ ] Progress saved incrementally for long operations?
- [ ] Expiration handler actually cancels ongoing work?

### Production Readiness

- [ ] Tested on real device, not just simulator?
- [ ] Tested in release build, not just debug?
- [ ] Tested with Low Power Mode enabled?
- [ ] Tested after force-quit from App Switcher (should NOT run)?
- [ ] Console logs show expected "Task completed" messages?

---

## Pressure Scenarios

### Scenario 1: "Just poll the server every 30 seconds in background"

**The temptation**: "Polling is simpler than push notifications. We need real-time updates."

**The reality**:
- iOS will NOT give you 30-second background intervals
- BGAppRefreshTask runs based on USER behavior patterns, not your schedule
- If user rarely opens app, task may run once per day or less
- Polling burns budget quickly — fewer total launches

**Time cost comparison**:
- Implement polling: 30 minutes (won't work as expected)
- Understand why it doesn't work: 2-4 hours debugging
- Implement proper push notifications: 3-4 hours

**What actually works**:
- Silent push notifications (server triggers, not polling)
- BGAppRefreshTask for predicted user behavior (not real-time)
- BGProcessingTask for deferrable work (overnight)

**Pushback template**: "iOS background execution doesn't support polling intervals. BGAppRefreshTask runs based on when iOS predicts the user will open our app, not on a fixed schedule. For real-time updates, we need server-side push notifications. Let me show you Apple's documentation on this."

---

### Scenario 2: "My task needs 5 minutes, not 30 seconds"

**The temptation**: "I'll just use beginBackgroundTask and do all my work."

**The reality**:
- beginBackgroundTask: ~30 seconds max
- BGAppRefreshTask: ~30 seconds
- BGProcessingTask: Several minutes, but only when charging
- No API gives you guaranteed 5-minute foreground-quality runtime

**What actually works**:
1. **Chunk your work** — Break into 30-second pieces, save progress
2. **Use BGProcessingTask** with `requiresExternalPower = true` (runs overnight)
3. **iOS 26+**: Use BGContinuedProcessingTask for user-initiated work

**Pushback template**: "iOS limits background runtime to protect battery. For work that needs several minutes, we have two options: (1) BGProcessingTask runs overnight when charging — great for maintenance, (2) Break work into chunks that complete in 30 seconds, saving progress between runs. Which fits our use case better?"

---

### Scenario 3: "It works on my device but not for users"

**The temptation**: "The code is correct — it must be a user device issue."

**The reality**: Debug builds with Xcode attached behave differently than release builds in the wild.

**Common causes**:
1. **Low Power Mode enabled** — limits background activity
2. **Background App Refresh disabled** — user or parental controls
3. **App swiped away** — kills all background tasks
4. **Budget exhausted** — too many recent launches
5. **Rarely used app** — system deprioritizes

**Debugging steps**:
1. Check `backgroundRefreshStatus` at launch, log it
2. Log when tasks are scheduled and completed
3. Use MetricKit to monitor background launches in production
4. Ask users: "Did you force-quit the app from App Switcher?"

**Pushback template**: "Background execution depends on 7 system factors including battery level, user app usage patterns, and whether they force-quit the app. Let me add logging to understand what's happening for affected users."

---

### Scenario 4: "Ship now, add background tasks later"

**The temptation**: "Background work is a nice-to-have feature."

**The reality**:
- Users expect content to be fresh when they open the app
- Competing apps that refresh in background feel more responsive
- Adding background tasks later requires careful registration timing
- First impression of stale content drives retention

**Time cost comparison**:
- Add BGAppRefreshTask now: 1-2 hours
- Retrofit later with proper testing: 4-6 hours
- Debug "why doesn't it work" issues: Additional hours

**Minimum viable background**:
```swift
// In didFinishLaunchingWithOptions
BGTaskScheduler.shared.register(
    forTaskWithIdentifier: "com.yourapp.refresh",
    using: nil
) { task in
    task.setTaskCompleted(success: true)  // Placeholder
    self.scheduleRefresh()
}
```

**Pushback template**: "Background refresh is a core expectation for [type of app]. The minimum implementation is 20 lines of code. If we ship without it and add later, we risk registration timing bugs. Let me add the scaffolding now so we can enhance it post-launch."

---

## Real-World Examples

### Example 1: Task Never Runs — Identifier Mismatch

**Symptom**: `submit()` succeeds but handler never called.

**Diagnosis**:
```swift
// Code uses:
BGTaskScheduler.shared.register(
    forTaskWithIdentifier: "com.myapp.Refresh",  // Capital R
    ...
)

// Info.plist has:
// "com.myapp.refresh"  // lowercase r
```

**Fix**: Identifiers must EXACTLY match (case-sensitive).

**Time wasted**: 2 hours debugging code logic when issue was typo.

---

### Example 2: Task Terminates — Missing setTaskCompleted

**Symptom**: Handler runs, work appears to complete, but next scheduled task never runs.

**Diagnosis**:
```swift
func handleRefresh(task: BGAppRefreshTask) {
    fetchData { result in
        switch result {
        case .success:
            task.setTaskCompleted(success: true)  // ✅ Called
        case .failure:
            // ❌ Missing setTaskCompleted!
            print("Failed")
        }
    }
}
```

**Fix**: Call `setTaskCompleted` in ALL code paths including errors.

```swift
case .failure:
    task.setTaskCompleted(success: false)  // ✅ Now called
```

**Impact**: Failing to call setTaskCompleted may cause system to penalize app's background budget.

---

### Example 3: Works in Dev, Not Production — Force Quit

**Symptom**: Users report background sync doesn't work. Developer can't reproduce.

**Diagnosis**:
```
User: "I close my apps every night to save battery."
Developer: "How do you close them?"
User: "Swipe up in the app switcher."
```

**Reality**: Swiping away from App Switcher = force quit = no background tasks until user opens app again.

**Fix**:
1. Educate users (not ideal)
2. Accept this is iOS behavior
3. Ensure good first-launch experience when app reopens

---

### Example 4: BGProcessingTask Never Runs — Missing Power Requirement

**Symptom**: BGProcessingTask scheduled but never executes.

**Diagnosis**: User has phone plugged in at night, but task has `requiresExternalPower = true` and user uses wireless charger.

Wait, that's not the issue. Real issue:
```swift
let request = BGProcessingTaskRequest(identifier: "com.app.maintenance")
// Missing: request.requiresExternalPower = true
```

Without `requiresExternalPower`, system STILL waits for charging but has less certainty. Setting it explicitly gives system clear signal.

Also: User must have launched app in foreground within ~2 weeks for processing tasks to be eligible.

---

## Quick Reference

### LLDB Debugging Commands

```lldb
// Trigger task
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"IDENTIFIER"]

// Trigger expiration
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateExpirationForTaskWithIdentifier:@"IDENTIFIER"]
```

### Console Filter

```
subsystem:com.apple.backgroundtaskscheduler
```

### Task Type Summary

| Need | Use | Runtime |
|------|-----|---------|
| Keep content fresh | BGAppRefreshTask | ~30s |
| Heavy maintenance | BGProcessingTask + requiresExternalPower | Minutes |
| User-initiated continuation | BGContinuedProcessingTask (iOS 26) | Extended |
| Finish on background | beginBackgroundTask | ~30s |
| Large downloads | Background URLSession | As needed |
| Server-triggered | Silent push notification | ~30s |

---

## Resources

**WWDC**: 2019-707, 2020-10063, 2022-10142, 2023-10170, 2025-227

**Docs**: /backgroundtasks/bgtaskscheduler, /backgroundtasks/starting-and-terminating-tasks-during-development

**Skills**: axiom-background-processing-ref, axiom-background-processing-diag, axiom-energy

---

**Last Updated**: 2025-12-31
**Platforms**: iOS 13+, iOS 26+ (BGContinuedProcessingTask)
**Status**: Production-ready background task patterns
