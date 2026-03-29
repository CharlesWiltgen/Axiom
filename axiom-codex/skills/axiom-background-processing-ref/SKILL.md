---
name: axiom-background-processing-ref
description: Complete background task API reference - BGTaskScheduler, BGAppRefreshTask, BGProcessingTask, BGContinuedProcessingTask (iOS 26), beginBackgroundTask, background URLSession, with all WWDC code examples
license: MIT
metadata:
  version: "1.0.0"
---

# Background Processing Reference

Complete API reference for iOS background execution, with code examples from WWDC sessions.

**Related skills**: `axiom-background-processing` (decision trees, patterns), `axiom-background-processing-diag` (troubleshooting)

---

## Part 1: BGTaskScheduler Registration

### Info.plist Configuration

```xml
<!-- Required: List all task identifiers -->
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>com.yourapp.refresh</string>
    <string>com.yourapp.maintenance</string>
    <!-- Wildcard for dynamic identifiers (iOS 26+) -->
    <string>com.yourapp.export.*</string>
</array>

<!-- Required: Enable background modes -->
<key>UIBackgroundModes</key>
<array>
    <!-- For BGAppRefreshTask -->
    <string>fetch</string>
    <!-- For BGProcessingTask -->
    <string>processing</string>
</array>
```

### Register Handler

```swift
import BackgroundTasks

func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
) -> Bool {

    // Register BEFORE returning from didFinishLaunching
    BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "com.yourapp.refresh",
        using: nil  // nil = system creates serial background queue
    ) { task in
        self.handleAppRefresh(task: task as! BGAppRefreshTask)
    }

    BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "com.yourapp.maintenance",
        using: nil
    ) { task in
        self.handleMaintenance(task: task as! BGProcessingTask)
    }

    return true
}
```

**Parameters**:
- `forTaskWithIdentifier`: Must match Info.plist exactly (case-sensitive)
- `using`: DispatchQueue for handler callback; nil = system creates one
- `launchHandler`: Called when task is launched; receives BGTask subclass

### Registration Timing

From WWDC 2019-707:
> "You do this by registering a launch handler **before your application finishes launching**"

Register in:
- ✅ `application(_:didFinishLaunchingWithOptions:)` before `return true`
- ❌ Not in viewDidLoad, button handlers, or async callbacks

---

## Part 2: BGAppRefreshTask

### Purpose

Keep app content fresh throughout the day. System launches app based on **user usage patterns**.

### Runtime

~30 seconds (same as legacy background fetch)

### Scheduling

```swift
func scheduleAppRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.yourapp.refresh")

    // earliestBeginDate = MINIMUM delay (not exact time)
    // System decides actual time based on usage patterns
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)

    do {
        try BGTaskScheduler.shared.submit(request)
    } catch BGTaskScheduler.Error.notPermitted {
        // Background App Refresh disabled in Settings
    } catch BGTaskScheduler.Error.tooManyPendingTaskRequests {
        // Too many pending requests for this identifier
    } catch BGTaskScheduler.Error.unavailable {
        // Background tasks not available (Simulator, etc.)
    } catch {
        print("Schedule failed: \(error)")
    }
}

// Schedule when app enters background
func applicationDidEnterBackground(_ application: UIApplication) {
    scheduleAppRefresh()
}
```

### Handler

```swift
func handleAppRefresh(task: BGAppRefreshTask) {
    // 1. Set expiration handler FIRST
    task.expirationHandler = { [weak self] in
        self?.currentOperation?.cancel()
    }

    // 2. Schedule NEXT refresh (continuous pattern)
    scheduleAppRefresh()

    // 3. Perform work
    let operation = fetchLatestContentOperation()
    currentOperation = operation

    operation.completionBlock = {
        // 4. Signal completion (REQUIRED)
        task.setTaskCompleted(success: !operation.isCancelled)
    }

    operationQueue.addOperation(operation)
}
```

### BGAppRefreshTaskRequest Properties

| Property | Type | Description |
|----------|------|-------------|
| `identifier` | String | Must match Info.plist |
| `earliestBeginDate` | Date? | Minimum delay before execution |

---

## Part 3: BGProcessingTask

### Purpose

Deferrable maintenance work (database cleanup, ML training, backups). Runs at **system-friendly times**, typically overnight when charging.

### Runtime

Several minutes (significantly longer than refresh tasks)

### Scheduling with Constraints

```swift
func scheduleMaintenanceIfNeeded() {
    // Only schedule if work is needed
    guard Date().timeIntervalSince(lastMaintenanceDate) > 7 * 24 * 3600 else {
        return
    }

    let request = BGProcessingTaskRequest(identifier: "com.yourapp.maintenance")

    // CRITICAL for CPU-intensive work
    request.requiresExternalPower = true

    // Optional: Need network for cloud sync
    request.requiresNetworkConnectivity = true

    // Keep within 1 week — longer may be skipped
    // request.earliestBeginDate = ...

    do {
        try BGTaskScheduler.shared.submit(request)
    } catch {
        print("Schedule failed: \(error)")
    }
}
```

### Handler with Progress Checkpointing

```swift
func handleMaintenance(task: BGProcessingTask) {
    var shouldContinue = true

    task.expirationHandler = {
        shouldContinue = false
    }

    Task {
        for item in workItems {
            guard shouldContinue else {
                // Expiration called — save progress and exit
                saveProgress()
                break
            }

            await processItem(item)
            saveProgress()  // Checkpoint after each item
        }

        task.setTaskCompleted(success: shouldContinue)
    }
}
```

### BGProcessingTaskRequest Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `identifier` | String | — | Must match Info.plist |
| `earliestBeginDate` | Date? | nil | Minimum delay |
| `requiresNetworkConnectivity` | Bool | false | Wait for network |
| `requiresExternalPower` | Bool | false | Wait for charging |

### CPU Monitor Disabling

> "For the first time ever, we're giving you the ability to turn that off for the duration of your processing task so you can take full advantage of the hardware while the device is plugged in."

When `requiresExternalPower = true`, CPU Monitor (which normally terminates CPU-heavy background apps) is disabled.

---

## Part 4: BGContinuedProcessingTask (iOS 26+)

### Purpose

Continue **user-initiated work** after app backgrounds, with system UI showing progress. From WWDC 2025-227.

**NOT for**: Automatic tasks, maintenance, syncing — user must explicitly initiate.

### Use Cases

- Photo/video export
- Publishing content
- Updating connected accessories
- File compression

### Info.plist (Wildcard Pattern)

```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <!-- Wildcard for dynamic suffix -->
    <string>com.yourapp.export.*</string>
</array>
```

### Dynamic Registration

Unlike other tasks, register **when user initiates action**:

```swift
func userTappedExportButton() {
    // Register dynamically
    BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "com.yourapp.export.photos"
    ) { task in
        let continuedTask = task as! BGContinuedProcessingTask
        self.handleExport(task: continuedTask)
    }

    // Submit immediately
    submitExportRequest()
}
```

### Submission with Progress UI

```swift
func submitExportRequest() {
    let request = BGContinuedProcessingTaskRequest(
        identifier: "com.yourapp.export.photos",
        title: "Exporting Photos",           // Shown in system UI
        subtitle: "0 of 100 photos complete"  // Shown in system UI
    )

    // Strategy: .fail = reject if can't start now; .enqueue = queue (default)
    request.strategy = .fail

    do {
        try BGTaskScheduler.shared.submit(request)
    } catch {
        // Show error — can't run in background now
        showError("Cannot export in background right now")
    }
}
```

### Handler with Mandatory Progress Reporting

```swift
func handleExport(task: BGContinuedProcessingTask) {
    var shouldContinue = true

    task.expirationHandler = {
        shouldContinue = false
    }

    // MANDATORY: Report progress
    // Tasks with no progress updates are AUTO-EXPIRED
    task.progress.totalUnitCount = Int64(photos.count)
    task.progress.completedUnitCount = 0

    Task {
        for (index, photo) in photos.enumerated() {
            guard shouldContinue else { break }

            await exportPhoto(photo)

            // Update progress — system displays to user
            task.progress.completedUnitCount = Int64(index + 1)
        }

        task.setTaskCompleted(success: shouldContinue)
    }
}
```

### BGContinuedProcessingTaskRequest Properties

| Property | Type | Description |
|----------|------|-------------|
| `identifier` | String | With wildcard, can have dynamic suffix |
| `title` | String | Shown in system progress UI |
| `subtitle` | String | Shown in system progress UI |
| `strategy` | Strategy | `.fail` or `.enqueue` (default) |

### Strategy Options

```swift
// .fail — Reject if can't start immediately
request.strategy = .fail

// .enqueue — Queue if can't start (default)
// Task may run later
```

### GPU Access (iOS 26+)

```swift
// Check if GPU available for background task
let supportedResources = BGTaskScheduler.shared.supportedResources
if supportedResources.contains(.gpu) {
    // GPU is available
}
```

---

## Part 5: beginBackgroundTask

### Purpose

Finish critical work (~30 seconds) when app transitions to background. For state saving, completing uploads.

### Basic Pattern

```swift
var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid

func applicationDidEnterBackground(_ application: UIApplication) {
    backgroundTaskID = application.beginBackgroundTask(withName: "Save State") {
        // Expiration handler — clean up immediately
        self.saveProgress()
        application.endBackgroundTask(self.backgroundTaskID)
        self.backgroundTaskID = .invalid
    }

    // Do critical work
    saveEssentialState { [weak self] in
        guard let self = self,
              self.backgroundTaskID != .invalid else { return }

        // End task AS SOON AS work completes
        UIApplication.shared.endBackgroundTask(self.backgroundTaskID)
        self.backgroundTaskID = .invalid
    }
}
```

### Key Points

- Call `endBackgroundTask` immediately when done — don't wait for expiration
- Failing to end may cause system to terminate app
- ~30 seconds max, not guaranteed
- Use for finalization, not ongoing work

### SwiftUI / SceneDelegate

```swift
.onChange(of: scenePhase) { newPhase in
    if newPhase == .background {
        startBackgroundTask()
    }
}
```

---

## Part 6: Background URLSession

### Purpose

Large downloads/uploads that continue **even after app termination**. Work handed off to system daemon.

### Configuration

```swift
lazy var backgroundSession: URLSession = {
    let config = URLSessionConfiguration.background(
        withIdentifier: "com.yourapp.downloads"
    )

    // App relaunched when task completes
    config.sessionSendsLaunchEvents = true

    // System chooses optimal time (WiFi, charging)
    config.isDiscretionary = true

    // Timeout for requests (not the download itself)
    config.timeoutIntervalForRequest = 60

    return URLSession(configuration: config, delegate: self, delegateQueue: nil)
}()
```

### Starting Download

```swift
func downloadFile(from url: URL) {
    let task = backgroundSession.downloadTask(with: url)
    task.resume()
    // Work continues even if app terminates
}
```

### AppDelegate Handler

```swift
var backgroundSessionCompletionHandler: (() -> Void)?

func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
) {
    // Store — call after all events processed
    backgroundSessionCompletionHandler = completionHandler
}
```

### URLSessionDelegate Implementation

```swift
extension AppDelegate: URLSessionDelegate, URLSessionDownloadDelegate {

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        // MUST move file immediately — temp location deleted after return
        let destination = getDestinationURL(for: downloadTask)
        try? FileManager.default.moveItem(at: location, to: destination)
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        // All events processed — call stored completion handler
        DispatchQueue.main.async {
            self.backgroundSessionCompletionHandler?()
            self.backgroundSessionCompletionHandler = nil
        }
    }
}
```

### Configuration Properties

| Property | Default | Description |
|----------|---------|-------------|
| `sessionSendsLaunchEvents` | false | Relaunch app on completion |
| `isDiscretionary` | false | Wait for optimal conditions |
| `allowsCellularAccess` | true | Allow cellular network |
| `allowsExpensiveNetworkAccess` | true | Allow expensive networks |
| `allowsConstrainedNetworkAccess` | true | Allow Low Data Mode |

---

## Part 7: Testing Background Tasks

### LLDB Debugging Commands

Pause app in debugger, then execute:

```lldb
// Trigger task launch
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.yourapp.refresh"]

// Trigger task expiration
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateExpirationForTaskWithIdentifier:@"com.yourapp.refresh"]
```

### Testing Workflow

1. Set breakpoint in task handler
2. Run app, let it enter background
3. Pause execution (Debug → Pause)
4. Execute simulate launch command
5. Resume — breakpoint should hit
6. Test expiration handling with simulate expiration

### Console Logging

Filter Console.app:

```
subsystem:com.apple.backgroundtaskscheduler
```

### getPendingTaskRequests

Check what's scheduled:

```swift
BGTaskScheduler.shared.getPendingTaskRequests { requests in
    for request in requests {
        print("Pending: \(request.identifier)")
        print("  Earliest: \(request.earliestBeginDate ?? Date())")
    }
}
```

---

## Part 8: Throttling & System Constraints

### The 7 Scheduling Factors

| Factor | How to Check | Impact |
|--------|--------------|--------|
| Critically Low Battery | Battery < ~20% | Discretionary work paused |
| Low Power Mode | `ProcessInfo.isLowPowerModeEnabled` | Limited activity |
| App Usage | User opens app frequently? | Higher priority |
| App Switcher | Not swiped away? | Swiped = no background |
| Background App Refresh | `backgroundRefreshStatus` | Off = no BGAppRefresh |
| System Budgets | Many recent launches? | Budget depletes, refills daily |
| Rate Limiting | Requests too frequent? | System spaces launches |

### Checking Constraints

```swift
// Low Power Mode
if ProcessInfo.processInfo.isLowPowerModeEnabled {
    // Reduce background work
}

// Listen for changes
NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)
    .sink { _ in
        // Adapt behavior
    }

// Background App Refresh status
switch UIApplication.shared.backgroundRefreshStatus {
case .available:
    // Can schedule tasks
case .denied:
    // User disabled — prompt in Settings
case .restricted:
    // MDM or parental controls — cannot enable
@unknown default:
    break
}
```

### Thermal State

```swift
switch ProcessInfo.processInfo.thermalState {
case .nominal:
    break  // Normal operation
case .fair:
    // Reduce intensive work
case .serious:
    // Minimize all background activity
case .critical:
    // Stop non-essential work immediately
@unknown default:
    break
}

NotificationCenter.default.publisher(for: ProcessInfo.thermalStateDidChangeNotification)
    .sink { _ in
        // Respond to thermal changes
    }
```

---

## Part 9: Push Notifications for Background

### Silent Push Payload

```json
{
    "aps": {
        "content-available": 1
    },
    "custom-data": "your-payload"
}
```

### APNS Priority

```
apns-priority: 5   // Discretionary — energy efficient (recommended)
apns-priority: 10  // Immediate — only for time-sensitive
```

### Handler

```swift
func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
) {
    guard userInfo["aps"] as? [String: Any] != nil else {
        completionHandler(.noData)
        return
    }

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

### Rate Limiting Behavior

> "Receiving 14 pushes in a window may result in only 7 launches, maintaining a ~15-minute interval."

Silent pushes are rate-limited. Don't expect launch on every push.

---

## Part 10: SwiftUI Integration

### backgroundTask Modifier

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
        // App refresh handler
        .backgroundTask(.appRefresh("com.yourapp.refresh")) {
            scheduleAppRefresh()  // Schedule next
            await fetchLatestContent()
            // Task completes when closure returns (no setTaskCompleted needed)
        }
        // Background URLSession handler
        .backgroundTask(.urlSession("com.yourapp.downloads")) {
            await processDownloadedFiles()
        }
    }
}
```

### Cancellation with Swift Concurrency

```swift
.backgroundTask(.appRefresh("com.yourapp.refresh")) {
    await withTaskCancellationHandler {
        // Normal work
        try await fetchData()
    } onCancel: {
        // Called when task expires
        // Keep lightweight — runs synchronously
    }
}
```

### Background URLSession with SwiftUI

```swift
.backgroundTask(.urlSession("com.yourapp.weather")) {
    // Called when background URLSession completes
    // Handle completed downloads
}
```

---

## Quick Reference

### Task Types

| Type | Runtime | API | Use Case |
|------|---------|-----|----------|
| BGAppRefreshTask | ~30s | submit(BGAppRefreshTaskRequest) | Fresh content |
| BGProcessingTask | Minutes | submit(BGProcessingTaskRequest) | Maintenance |
| BGContinuedProcessingTask | Extended | submit(BGContinuedProcessingTaskRequest) | User-initiated |
| beginBackgroundTask | ~30s | beginBackgroundTask(withName:) | State saving |
| Background URLSession | As needed | URLSessionConfiguration.background | Downloads |
| Silent Push | ~30s | didReceiveRemoteNotification | Server trigger |

### Required Info.plist

```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>your.identifiers.here</string>
</array>

<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>      <!-- BGAppRefreshTask -->
    <string>processing</string> <!-- BGProcessingTask -->
</array>
```

### LLDB Commands

```lldb
// Launch
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"ID"]

// Expire
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateExpirationForTaskWithIdentifier:@"ID"]
```

---

## Resources

**WWDC**: 2019-707, 2020-10063, 2022-10142, 2023-10170, 2025-227

**Docs**: /backgroundtasks, /backgroundtasks/bgtaskscheduler, /foundation/urlsessionconfiguration

**Skills**: axiom-background-processing, axiom-background-processing-diag

---

**Last Updated**: 2025-12-31
**Platforms**: iOS 13+, iOS 26+ (BGContinuedProcessingTask)
