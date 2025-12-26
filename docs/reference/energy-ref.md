---
name: energy-ref
description: Complete energy optimization API reference — Power Profiler, timer efficiency, network efficiency, location efficiency, background execution, display/GPU optimization, disk I/O, MetricKit integration, with WWDC code examples
version: 1.0.0
---

# Energy Optimization Reference

Complete API reference for iOS energy efficiency. Based on WWDC 2025-226, WWDC 2025-227, WWDC 2022-10083, and Apple Energy Efficiency Guides.

**Related skills**: `energy` (discipline skill with decision trees), `energy-diag` (symptom-based troubleshooting)

## Part 1: Power Profiler Workflow

Power Profiler in Instruments 26 provides real-time power impact measurement across 5 subsystems.

### Recording a Trace

```swift
// 1. Launch Instruments
// Xcode → Product → Profile → Power Profiler

// 2. Select your device (iOS 26+ required for on-device)
// 3. Select your app
// 4. Click Record
// 5. Perform typical user actions for 2-3 minutes
// 6. Stop recording
```

### Interpreting the Lanes

The Power Profiler shows 5 power impact lanes:

| Lane | What It Measures | High Impact Indicates |
|------|------------------|----------------------|
| **CPU** | Computation, timers | Timer abuse, polling, parsing |
| **GPU** | Rendering, animations | Blur effects, complex views |
| **Network** | Radio activity | Polling, many requests |
| **Location** | GPS usage | Continuous updates, high accuracy |
| **Display** | Screen power | Light backgrounds on OLED |

### On-Device Profiling (iOS 26+)

```
Settings → Developer → Power Profiler → Record
```

Captures real-world power usage without Xcode tethering. Export traces for offline analysis.

### Comparing Implementations

```swift
// Record baseline with current implementation
// Make optimization changes
// Record again with same user actions
// Compare power impact in each lane
```

## Part 2: Timer Efficiency

From Apple Energy Efficiency Guide: "Minimize Timer Use"

### Dispatch Sources vs NSTimer

```swift
// Preferred for <1 second intervals
let source = DispatchSource.makeTimerSource(queue: .main)
source.schedule(deadline: .now(), repeating: .milliseconds(100), leeway: .milliseconds(10))
source.setEventHandler { [weak self] in
    self?.update()
}
source.resume()

// Don't forget to cancel
deinit {
    source.cancel()
}
```

### Timer Tolerance

```swift
// ❌ No tolerance
let timer = Timer.scheduledTimer(timeInterval: 5.0, repeats: true) { _ in }

// ✅ 10% tolerance minimum
let timer = Timer.scheduledTimer(timeInterval: 5.0, repeats: true) { _ in }
timer.tolerance = 0.5  // System can coalesce with other timers

// ✅ Combine timer with tolerance
Timer.publish(every: 5.0, tolerance: 0.5, on: .main, in: .common)
    .autoconnect()
    .sink { _ in }
    .store(in: &cancellables)
```

### Event-Driven vs Polling

```swift
// ❌ Polling for state changes
Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
    if someCondition { doWork() }
}

// ✅ Event-driven with NotificationCenter
NotificationCenter.default.addObserver(
    forName: .someConditionChanged,
    object: nil,
    queue: .main
) { _ in
    doWork()
}

// ✅ Event-driven with Combine
publisher
    .sink { value in doWork() }
    .store(in: &cancellables)
```

## Part 3: Network Efficiency

From Apple Energy Efficiency Guide: "Reducing networking power"

### URLSession Configurations

```swift
// ✅ Configure for efficiency
let config = URLSessionConfiguration.default

// Don't use cellular for non-urgent requests
config.allowsExpensiveNetworkAccess = false

// Wait for good connection instead of failing
config.waitsForConnectivity = true

// Reduce connection overhead
config.httpMaximumConnectionsPerHost = 4

let session = URLSession(configuration: config)
```

### Discretionary Background Downloads

```swift
// ✅ Let system decide when to download
let config = URLSessionConfiguration.background(withIdentifier: "com.app.sync")
config.isDiscretionary = true  // System schedules for optimal battery

// Task will run when:
// - Device is charging
// - Connected to WiFi
// - System has capacity
```

### Low Data Mode Handling

```swift
// Check Low Data Mode
if ProcessInfo.processInfo.isLowDataModeEnabled {
    // Reduce payload sizes
    // Defer non-essential transfers
    // Use lower quality images
}

// Or let URLSession handle it
config.allowsConstrainedNetworkAccess = false  // Respect Low Data Mode
```

### Push vs Poll Decision Matrix

| Scenario | Use Push | Use Poll |
|----------|----------|----------|
| Real-time chat | ✅ | ❌ |
| Social feed updates | ✅ | ❌ |
| Stock prices | ✅ | ❌ |
| Weather updates | ✅ | ❌ |
| Offline-first sync | Depends | ✅ (discretionary) |
| User-initiated refresh | N/A | ✅ (on-demand) |

## Part 4: Location Efficiency

From Apple Developer Documentation: Location efficiency

### CLLocationUpdate (iOS 26+)

```swift
// Modern async location updates
let updates = CLLocationUpdate.liveUpdates()

for try await update in updates {
    if let location = update.location {
        processLocation(location)
    }

    // Stop when no longer needed
    if update.isStationary {
        break  // User stopped moving
    }
}
```

### Significant-Change Monitoring

```swift
// ✅ 90%+ power savings vs continuous GPS
locationManager.startMonitoringSignificantLocationChanges()

// Fires only when user moves ~500m
// Uses cell towers, not GPS
// Perfect for: geo-fencing, regional content
```

### Accuracy Levels

| Accuracy | Power | Use Case |
|----------|-------|----------|
| `kCLLocationAccuracyBest` | Highest | Turn-by-turn navigation |
| `kCLLocationAccuracyNearestTenMeters` | High | Walking directions |
| `kCLLocationAccuracyHundredMeters` | Medium | Nearby search |
| `kCLLocationAccuracyKilometer` | Low | Weather by region |
| `kCLLocationAccuracyThreeKilometers` | Lowest | Country/state detection |

### Distance Filter

```swift
// Only update when user moves significant distance
locationManager.distanceFilter = 100  // 100 meters
```

### Stopping Updates

```swift
// ✅ Always stop when done
locationManager.stopUpdatingLocation()

// ✅ Pause automatically when stationary
locationManager.pausesLocationUpdatesAutomatically = true
```

## Part 5: Background Execution

From WWDC 2025-227: "Keep your app running efficiently in the background"

### EMRCA Principles

**E**fficient, **M**inimal, **R**esilient, **C**ourteous, **A**daptive

- **Efficient**: Complete work quickly
- **Minimal**: Request only needed resources
- **Resilient**: Handle interruptions gracefully
- **Courteous**: Respect system resources
- **Adaptive**: Adjust to conditions

### BGAppRefreshTask

```swift
// Register in app delegate
BGTaskScheduler.shared.register(
    forTaskWithIdentifier: "com.app.refresh",
    using: nil
) { task in
    handleAppRefresh(task: task as! BGAppRefreshTask)
}

func handleAppRefresh(task: BGAppRefreshTask) {
    // Schedule next refresh
    scheduleAppRefresh()

    // Set expiration handler
    task.expirationHandler = {
        // Clean up partial work
    }

    // Do work
    Task {
        await refreshData()
        task.setTaskCompleted(success: true)
    }
}

func scheduleAppRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.app.refresh")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)  // 15 min
    try? BGTaskScheduler.shared.submit(request)
}
```

### BGProcessingTask

```swift
// For longer background work
BGTaskScheduler.shared.register(
    forTaskWithIdentifier: "com.app.process",
    using: nil
) { task in
    handleProcessing(task: task as! BGProcessingTask)
}

func handleProcessing(task: BGProcessingTask) {
    task.expirationHandler = { /* cleanup */ }

    Task {
        await processLargeDataset()
        task.setTaskCompleted(success: true)
    }
}

func scheduleProcessing() {
    let request = BGProcessingTaskRequest(identifier: "com.app.process")
    request.requiresExternalPower = true  // Only when charging
    request.requiresNetworkConnectivity = true
    try? BGTaskScheduler.shared.submit(request)
}
```

### BGContinuedProcessingTask (iOS 26+)

```swift
// For user-initiated work that should continue in background
let task = BGContinuedProcessingTask(identifier: "com.app.upload")

task.expirationHandler = {
    // Save progress for resumption
}

BGTaskScheduler.shared.submit(task)

// Work continues even when app backgrounds
await uploadLargeFile()

task.setTaskCompleted(success: true)
```

### beginBackgroundTask Patterns

```swift
// ✅ Correct usage
var backgroundTask: UIBackgroundTaskIdentifier = .invalid

backgroundTask = UIApplication.shared.beginBackgroundTask {
    // Expiration handler - clean up
    UIApplication.shared.endBackgroundTask(backgroundTask)
    backgroundTask = .invalid
}

// Do work
await finishWork()

// End immediately when done - don't wait for expiration
UIApplication.shared.endBackgroundTask(backgroundTask)
backgroundTask = .invalid
```

## Part 6: Display & GPU Efficiency

From WWDC 2022-10083: "Power down: Improve battery consumption"

### Dark Mode (70% OLED Savings)

```swift
// System automatically provides dark variants
// Just provide dark assets in asset catalog

// Or programmatically
UIColor { traitCollection in
    traitCollection.userInterfaceStyle == .dark
        ? UIColor.black
        : UIColor.white
}
```

### Frame Rate Auditing

```swift
// ✅ Specify acceptable frame rate range
let displayLink = CADisplayLink(target: self, selector: #selector(update))
displayLink.preferredFrameRateRange = CAFrameRateRange(
    minimum: 30,
    maximum: 60,
    preferred: 60  // Up to 20% savings vs 120fps
)
displayLink.add(to: .main, forMode: .common)
```

### Stop Animations When Not Visible

```swift
// SwiftUI
.onDisappear {
    isAnimating = false
}

// UIKit
override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    animationTimer?.invalidate()
}
```

### Blur Effect Optimization

```swift
// ❌ Blur over dynamic content (continuous GPU work)
ZStack {
    VideoPlayer(player: player)
    Text("Overlay").background(.ultraThinMaterial)
}

// ✅ Blur over static content
ZStack {
    Image("background")
    Text("Overlay").background(.ultraThinMaterial)
}

// ✅ Or pre-render the blur
let blurredImage = originalImage.applyBlur(radius: 20)
```

## Part 7: Disk I/O Efficiency

From Apple Energy Efficiency Guide: "Reducing disk writes"

### Batch Writes

```swift
// ❌ Many small writes
for item in items {
    try item.data.write(to: itemURL)
}

// ✅ Single batched write
let allData = items.map { $0.data }
try JSONEncoder().encode(allData).write(to: cacheURL)
```

### WAL Journaling for SQLite

```swift
// Enable WAL mode for better write performance
try db.execute(sql: "PRAGMA journal_mode=WAL")

// Reduces fsync calls
// Better concurrent read performance
```

### Async I/O

```swift
// ❌ Synchronous on main thread
let data = try Data(contentsOf: fileURL)

// ✅ Async with Task
Task {
    let data = try await Data(reading: fileURL)
    await MainActor.run {
        updateUI(with: data)
    }
}
```

## Part 8: Low Power Mode & Thermal Response

From Apple Developer Documentation: Power notifications

### Low Power Mode Detection

```swift
// Check current state
if ProcessInfo.processInfo.isLowPowerModeEnabled {
    reduceWorkload()
}

// Observe changes
NotificationCenter.default.addObserver(
    forName: .NSProcessInfoPowerStateDidChange,
    object: nil,
    queue: .main
) { _ in
    if ProcessInfo.processInfo.isLowPowerModeEnabled {
        reduceWorkload()
    }
}
```

### Thermal State Response

```swift
NotificationCenter.default.addObserver(
    forName: ProcessInfo.thermalStateDidChangeNotification,
    object: nil,
    queue: .main
) { _ in
    switch ProcessInfo.processInfo.thermalState {
    case .nominal:
        // Full performance
        break
    case .fair:
        // Slightly reduce work
        reduceFrameRate(to: 30)
    case .serious:
        // Significantly reduce
        pauseNonEssentialWork()
    case .critical:
        // Minimum possible work
        pauseAllBackgroundWork()
    @unknown default:
        break
    }
}
```

## Part 9: MetricKit Integration

From WWDC 2019-417: "Improving Battery Life and Performance"

### Setup

```swift
import MetricKit

class MetricsManager: NSObject, MXMetricManagerSubscriber {
    static let shared = MetricsManager()

    override init() {
        super.init()
        MXMetricManager.shared.add(self)
    }

    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            processPayload(payload)
        }
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            processDiagnostic(payload)
        }
    }

    private func processPayload(_ payload: MXMetricPayload) {
        // CPU metrics
        if let cpu = payload.cpuMetrics {
            print("CPU time: \(cpu.cumulativeCPUTime)")
        }

        // Cellular metrics
        if let cellular = payload.cellularConditionMetrics {
            print("Cellular: \(cellular)")
        }

        // GPU metrics
        if let gpu = payload.gpuMetrics {
            print("GPU time: \(gpu.cumulativeGPUTime)")
        }
    }
}
```

### Xcode Organizer

```
Xcode → Window → Organizer → Energy Reports

Shows:
- Battery drain percentile
- Foreground vs background time
- Audio/Location/Bluetooth usage
- Comparison to similar apps
```

## Part 10: Push Notifications

From WWDC 2020-10095: "Pushing updates to your app silently"

### Alert vs Background Notifications

| Type | User Sees | App Wakes | Use Case |
|------|-----------|-----------|----------|
| Alert | Yes | Yes | User-relevant updates |
| Background | No | Yes (limited) | Silent data sync |

### Background Notification Handling

```swift
func application(_ application: UIApplication,
                 didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                 fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {

    // Must call completion handler within 30 seconds
    Task {
        do {
            let hasNewData = await fetchLatestData()
            completionHandler(hasNewData ? .newData : .noData)
        } catch {
            completionHandler(.failed)
        }
    }
}
```

### Content-Available Payload

```json
{
  "aps": {
    "content-available": 1
  },
  "data": {
    "type": "sync",
    "timestamp": "2025-12-26T00:00:00Z"
  }
}
```

## Expert Review Checklist

### Timer Efficiency (10 items)

- [ ] All timers have ≥10% tolerance
- [ ] No timers under 1 second unless truly needed
- [ ] DispatchSource used for <1s intervals
- [ ] Repeating timers invalidated in deinit
- [ ] Timer.publish uses .tolerance() modifier
- [ ] Event-driven patterns preferred over polling
- [ ] GCD sync points instead of polling loops
- [ ] Background timers stopped when app backgrounds
- [ ] Timer leeway set appropriately for wake coalescing
- [ ] No tight polling loops in background

### Network Efficiency (10 items)

- [ ] Push notifications instead of polling
- [ ] Discretionary flag for background downloads
- [ ] allowsExpensiveNetworkAccess = false for non-urgent
- [ ] waitsForConnectivity = true set
- [ ] Low Data Mode handled
- [ ] Requests batched where possible
- [ ] Images/data appropriately compressed
- [ ] HTTP/2 or HTTP/3 enabled
- [ ] Connection pooling used
- [ ] Retry with exponential backoff

### Location Efficiency (10 items)

- [ ] Significant-change when full GPS not needed
- [ ] Accuracy appropriate for use case
- [ ] distanceFilter set appropriately
- [ ] stopUpdatingLocation called when done
- [ ] pausesLocationUpdatesAutomatically = true
- [ ] Background location truly required
- [ ] CLLocationUpdate async API used (iOS 26+)
- [ ] isStationary flag checked
- [ ] CLMonitor for geofencing
- [ ] allowsBackgroundLocationUpdates only if needed

### Background Execution (10 items)

- [ ] Unused background modes removed
- [ ] setTaskCompleted always called
- [ ] expirationHandler implemented
- [ ] Work completes quickly
- [ ] requiresExternalPower for heavy processing
- [ ] BGContinuedProcessingTask for user-initiated
- [ ] Audio session deactivated when not playing
- [ ] beginBackgroundTask ended promptly
- [ ] No overlapping background tasks
- [ ] EMRCA principles followed

### Display/GPU Efficiency (10 items)

- [ ] Dark Mode implemented
- [ ] Blur effects over static content only
- [ ] Animations stop when not visible
- [ ] Frame rate range specified
- [ ] shouldRasterize for complex layers
- [ ] drawingGroup() for complex SwiftUI
- [ ] No hidden animations running
- [ ] ProMotion appropriately utilized
- [ ] Metal frame limiting implemented
- [ ] Shadows/masks cached

---

## Version History

- **1.0.0**: Initial reference based on WWDC 2025-226, WWDC 2025-227, WWDC 2022-10083, and Apple Energy Efficiency Guides. Covers Power Profiler, timer efficiency, network efficiency, location efficiency, background execution including BGContinuedProcessingTask (iOS 26), display/GPU efficiency, disk I/O, Low Power Mode, thermal response, MetricKit, push notifications, and 50+ item expert review checklist.

---

**Created** 2025-12-26
**Targets** iOS 26+, Swift 6
**Framework** Power Profiler, MetricKit, URLSession, CoreLocation, BGTaskScheduler
