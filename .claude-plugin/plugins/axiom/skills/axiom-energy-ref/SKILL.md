---
name: axiom-energy-ref
description: Complete energy optimization API reference - Power Profiler workflows, timer/network/location/background APIs, iOS 26 BGContinuedProcessingTask, MetricKit monitoring, with all WWDC code examples
license: MIT
metadata:
  version: "1.0.0"
---

# Energy Optimization Reference

Complete API reference for iOS energy optimization, with code examples from WWDC sessions and Apple documentation.

**Related skills**: `axiom-energy` (decision trees, patterns), `axiom-energy-diag` (troubleshooting)

---

## Part 1: Power Profiler Workflow

### Recording a Trace with Instruments

#### Tethered Recording (Connected to Mac)

```
1. Connect iPhone wirelessly to Xcode
   - Xcode → Window → Devices and Simulators
   - Enable "Connect via network" for your device

2. Profile your app
   - Xcode → Product → Profile (Cmd+I)
   - Select Blank template
   - Click "+" → Add "Power Profiler"
   - Optionally add "CPU Profiler" for correlation

3. Record
   - Select your app from target dropdown
   - Click Record (red button)
   - Use app normally for 2-3 minutes
   - Click Stop

4. Analyze
   - Expand Power Profiler track
   - Examine per-app lanes: CPU, GPU, Display, Network
```

**Important**: Use wireless debugging. When device is charging via cable, system power usage shows 0.

#### On-Device Recording (Without Mac)

From WWDC25-226: Capture traces in real-world conditions.

```
1. Enable Developer Mode
   Settings → Privacy & Security → Developer Mode → Enable

2. Enable Performance Trace
   Settings → Developer → Performance Trace → Enable
   Set tracing mode to "Power Profiler"
   Toggle ON your app in the app list

3. Add Control Center shortcut
   Control Center → Tap "+" → Add a Control → Performance Trace

4. Record
   Swipe down → Tap Performance Trace icon → Start
   Use app (can record up to 10 hours)
   Tap Performance Trace icon → Stop

5. Share trace
   Settings → Developer → Performance Trace
   Tap Share button next to trace file
   AirDrop to Mac or email to developer
```

### Interpreting Power Profiler Metrics

| Lane | Meaning | What High Values Indicate |
|------|---------|--------------------------|
| System Power | Overall battery drain rate | General energy consumption |
| CPU Power Impact | Processor activity score | Computation, timers, parsing |
| GPU Power Impact | Graphics rendering score | Animations, blur, Metal |
| Display Power Impact | Screen power usage | Brightness, content type |
| Network Power Impact | Radio activity score | Requests, downloads, polling |

**Key insight**: Values are scores for comparison, not absolute measurements. Compare before/after traces on the same device.

### Comparing Before/After (Example from WWDC25-226)

```swift
// Before optimization: CPU Power Impact = 21
VStack {
    ForEach(videos) { video in
        VideoCardView(video: video)
    }
}

// After optimization: CPU Power Impact = 4.3
LazyVStack {
    ForEach(videos) { video in
        VideoCardView(video: video)
    }
}
```

---

## Part 2: Timer Efficiency APIs

### NSTimer with Tolerance

```swift
// Basic timer with tolerance
let timer = Timer.scheduledTimer(
    withTimeInterval: 1.0,
    repeats: true
) { [weak self] _ in
    self?.updateUI()
}
timer.tolerance = 0.1  // 10% minimum recommended

// Add to run loop (if not using scheduledTimer)
RunLoop.current.add(timer, forMode: .common)

// Always invalidate when done
deinit {
    timer.invalidate()
}
```

### Combine Timer Publisher

```swift
import Combine

class ViewModel: ObservableObject {
    private var cancellables = Set<AnyCancellable>()

    func startPolling() {
        Timer.publish(every: 1.0, tolerance: 0.1, on: .main, in: .default)
            .autoconnect()
            .sink { [weak self] _ in
                self?.refresh()
            }
            .store(in: &cancellables)
    }

    func stopPolling() {
        cancellables.removeAll()
    }
}
```

### Dispatch Timer Source (Low-Level)

From Energy Efficiency Guide:

```swift
let queue = DispatchQueue(label: "com.app.timer")
let timer = DispatchSource.makeTimerSource(queue: queue)

// Set interval with leeway (tolerance)
timer.schedule(
    deadline: .now(),
    repeating: .seconds(1),
    leeway: .milliseconds(100)  // 10% tolerance
)

timer.setEventHandler { [weak self] in
    self?.performWork()
}

timer.resume()

// Cancel when done
timer.cancel()
```

### Event-Driven Alternative to Timers

From Energy Efficiency Guide: Prefer dispatch sources over polling.

```swift
// Monitor file changes instead of polling
let fileDescriptor = open(filePath.path, O_EVTONLY)
let source = DispatchSource.makeFileSystemObjectSource(
    fileDescriptor: fileDescriptor,
    eventMask: [.write, .delete],
    queue: .main
)

source.setEventHandler { [weak self] in
    self?.handleFileChange()
}

source.setCancelHandler {
    close(fileDescriptor)
}

source.resume()
```

---

## Part 3: Network Efficiency APIs

### URLSession Configuration

```swift
// Standard configuration with energy-conscious settings
let config = URLSessionConfiguration.default
config.waitsForConnectivity = true  // Don't fail immediately
config.allowsExpensiveNetworkAccess = false  // Prefer WiFi
config.allowsConstrainedNetworkAccess = false  // Respect Low Data Mode

let session = URLSession(configuration: config)
```

### Discretionary Background Downloads

From WWDC22-10083:

```swift
// Background session for non-urgent downloads
let config = URLSessionConfiguration.background(
    withIdentifier: "com.app.downloads"
)
config.isDiscretionary = true  // System chooses optimal time
config.sessionSendsLaunchEvents = true

// Set timeouts
config.timeoutIntervalForResource = 24 * 60 * 60  // 24 hours
config.timeoutIntervalForRequest = 60

let session = URLSession(configuration: config, delegate: self, delegateQueue: nil)

// Create download task with scheduling hints
let task = session.downloadTask(with: url)
task.earliestBeginDate = Date(timeIntervalSinceNow: 2 * 60 * 60)  // 2 hours from now
task.countOfBytesClientExpectsToSend = 200  // Small request
task.countOfBytesClientExpectsToReceive = 500_000  // 500KB response

task.resume()
```

### Background Session Delegate

```swift
class DownloadDelegate: NSObject, URLSessionDownloadDelegate {
    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        // Move file from temp location
        let destination = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("downloaded.data")

        try? FileManager.default.moveItem(at: location, to: destination)
    }

    func urlSessionDidFinishEvents(
        forBackgroundURLSession session: URLSession
    ) {
        // Notify app delegate to call completion handler
        DispatchQueue.main.async {
            if let handler = AppDelegate.shared.backgroundCompletionHandler {
                handler()
                AppDelegate.shared.backgroundCompletionHandler = nil
            }
        }
    }
}
```

---

## Part 4: Location Efficiency APIs

### CLLocationManager Configuration

```swift
import CoreLocation

class LocationService: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    func configure() {
        manager.delegate = self

        // Use appropriate accuracy
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters

        // Reduce update frequency
        manager.distanceFilter = 100  // Update every 100 meters

        // Allow indicator pause when stationary
        manager.pausesLocationUpdatesAutomatically = true

        // For background updates (if needed)
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
    }

    func startTracking() {
        manager.requestWhenInUseAuthorization()
        manager.startUpdatingLocation()
    }

    func startSignificantChangeTracking() {
        // Much more energy efficient for background
        manager.startMonitoringSignificantLocationChanges()
    }

    func stopTracking() {
        manager.stopUpdatingLocation()
        manager.stopMonitoringSignificantLocationChanges()
    }
}
```

### iOS 26+ CLLocationUpdate (Modern Async API)

```swift
import CoreLocation

func trackLocation() async throws {
    for try await update in CLLocationUpdate.liveUpdates() {
        // Check if device became stationary
        if update.stationary {
            // System pauses updates automatically
            // Consider switching to region monitoring
            break
        }

        if let location = update.location {
            handleLocation(location)
        }
    }
}
```

### CLMonitor for Significant Changes

```swift
import CoreLocation

func setupRegionMonitoring() async {
    let monitor = CLMonitor("significant-changes")

    // Add condition to monitor
    let condition = CLMonitor.CircularGeographicCondition(
        center: currentLocation.coordinate,
        radius: 500  // 500 meter radius
    )
    await monitor.add(condition, identifier: "home-region")

    // React to events
    for try await event in monitor.events {
        switch event.state {
        case .satisfied:
            // Entered region
            handleRegionEntry()
        case .unsatisfied:
            // Exited region
            handleRegionExit()
        default:
            break
        }
    }
}
```

### Location Accuracy Options

| Constant | Accuracy | Battery Impact | Use Case |
|----------|----------|----------------|----------|
| `kCLLocationAccuracyBestForNavigation` | ~1m | Extreme | Turn-by-turn only |
| `kCLLocationAccuracyBest` | ~10m | Very High | Fitness tracking |
| `kCLLocationAccuracyNearestTenMeters` | ~10m | High | Precise positioning |
| `kCLLocationAccuracyHundredMeters` | ~100m | Medium | Store locators |
| `kCLLocationAccuracyKilometer` | ~1km | Low | Weather, general |
| `kCLLocationAccuracyThreeKilometers` | ~3km | Very Low | Regional content |

---

## Part 5: Background Execution APIs

### beginBackgroundTask (Short Tasks)

```swift
class AppDelegate: UIResponder, UIApplicationDelegate {
    var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    func applicationDidEnterBackground(_ application: UIApplication) {
        backgroundTask = application.beginBackgroundTask(withName: "Save State") {
            // Expiration handler - clean up
            self.endBackgroundTask()
        }

        // Perform quick work
        saveState()

        // End immediately when done
        endBackgroundTask()
    }

    private func endBackgroundTask() {
        guard backgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }
}
```

### BGAppRefreshTask

```swift
import BackgroundTasks

// Register at app launch
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "com.app.refresh",
        using: nil
    ) { task in
        self.handleAppRefresh(task: task as! BGAppRefreshTask)
    }

    return true
}

// Schedule refresh
func scheduleAppRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.app.refresh")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)  // 15 min

    try? BGTaskScheduler.shared.submit(request)
}

// Handle refresh
func handleAppRefresh(task: BGAppRefreshTask) {
    scheduleAppRefresh()  // Schedule next refresh

    let fetchTask = Task {
        do {
            let hasNewData = try await fetchLatestData()
            task.setTaskCompleted(success: hasNewData)
        } catch {
            task.setTaskCompleted(success: false)
        }
    }

    task.expirationHandler = {
        fetchTask.cancel()
    }
}
```

### BGProcessingTask

```swift
import BackgroundTasks

// Register
BGTaskScheduler.shared.register(
    forTaskWithIdentifier: "com.app.maintenance",
    using: nil
) { task in
    self.handleMaintenance(task: task as! BGProcessingTask)
}

// Schedule with requirements
func scheduleMaintenance() {
    let request = BGProcessingTaskRequest(identifier: "com.app.maintenance")
    request.requiresNetworkConnectivity = true
    request.requiresExternalPower = true  // Only when charging

    try? BGTaskScheduler.shared.submit(request)
}

// Handle
func handleMaintenance(task: BGProcessingTask) {
    let operation = MaintenanceOperation()

    task.expirationHandler = {
        operation.cancel()
    }

    operation.completionBlock = {
        task.setTaskCompleted(success: !operation.isCancelled)
    }

    OperationQueue.main.addOperation(operation)
}
```

### iOS 26+ BGContinuedProcessingTask

From WWDC25-227: Continue user-initiated tasks with system UI.

```swift
import BackgroundTasks

// Info.plist: Add identifier to BGTaskSchedulerPermittedIdentifiers
// "com.app.export" or "com.app.exports.*" for wildcards

// Register handler (can be dynamic, not just at launch)
func setupExportHandler() {
    BGTaskScheduler.shared.register("com.app.export") { task in
        let continuedTask = task as! BGContinuedProcessingTask

        var shouldContinue = true
        continuedTask.expirationHandler = {
            shouldContinue = false
        }

        // Report progress
        continuedTask.progress.totalUnitCount = 100
        continuedTask.progress.completedUnitCount = 0

        // Perform work
        for i in 0..<100 {
            guard shouldContinue else { break }

            performExportStep(i)
            continuedTask.progress.completedUnitCount = Int64(i + 1)
        }

        continuedTask.setTaskCompleted(success: shouldContinue)
    }
}

// Submit request
func startExport() {
    let request = BGContinuedProcessingTaskRequest(
        identifier: "com.app.export",
        title: "Exporting Photos",
        subtitle: "0 of 100 photos"
    )

    // Submission strategy
    request.strategy = .fail  // Fail if can't start immediately
    // or default: queue if can't start

    do {
        try BGTaskScheduler.shared.submit(request)
    } catch {
        // Handle submission failure
        showExportNotAvailable()
    }
}
```

### EMRCA Principles (from WWDC25-227)

Background tasks must be:

| Principle | Meaning | Implementation |
|-----------|---------|----------------|
| **E**fficient | Lightweight, purpose-driven | Do one thing well |
| **M**inimal | Keep work to minimum | Don't expand scope |
| **R**esilient | Save progress, handle expiration | Checkpoint frequently |
| **C**ourteous | Honor preferences | Check Low Power Mode |
| **A**daptive | Work with system | Don't fight constraints |

---

## Part 6: Display & GPU Efficiency APIs

### Dark Mode Support

```swift
// Check current appearance
let isDarkMode = traitCollection.userInterfaceStyle == .dark

// React to appearance changes
override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)

    if traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
        updateColorsForAppearance()
    }
}

// Use dynamic colors
let dynamicColor = UIColor { traitCollection in
    switch traitCollection.userInterfaceStyle {
    case .dark:
        return UIColor.black  // OLED: True black = pixels off = 0 power
    default:
        return UIColor.white
    }
}
```

### Frame Rate Control with CADisplayLink

From WWDC22-10083:

```swift
class AnimationController {
    private var displayLink: CADisplayLink?

    func startAnimation() {
        displayLink = CADisplayLink(target: self, selector: #selector(update))

        // Control frame rate
        displayLink?.preferredFrameRateRange = CAFrameRateRange(
            minimum: 10,   // Minimum acceptable
            maximum: 30,   // Maximum needed
            preferred: 30  // Ideal rate
        )

        displayLink?.add(to: .current, forMode: .default)
    }

    @objc private func update(_ displayLink: CADisplayLink) {
        // Update animation
        updateAnimationFrame()
    }

    func stopAnimation() {
        displayLink?.invalidate()
        displayLink = nil
    }
}
```

### Stop Animations When Not Visible

```swift
class AnimatedViewController: UIViewController {
    private var animator: UIViewPropertyAnimator?

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        startAnimations()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopAnimations()  // Critical for energy
    }

    private func stopAnimations() {
        animator?.stopAnimation(true)
        animator = nil
    }
}
```

---

## Part 7: Disk I/O Efficiency APIs

### Batch Writes

```swift
// BAD: Multiple small writes
for item in items {
    let data = try JSONEncoder().encode(item)
    try data.write(to: fileURL)  // Writes each item separately
}

// GOOD: Single batched write
let allData = try JSONEncoder().encode(items)
try allData.write(to: fileURL)  // One write operation
```

### SQLite WAL Mode

```swift
import SQLite3

// Enable Write-Ahead Logging
var db: OpaquePointer?
sqlite3_open(dbPath, &db)

var statement: OpaquePointer?
sqlite3_prepare_v2(db, "PRAGMA journal_mode=WAL", -1, &statement, nil)
sqlite3_step(statement)
sqlite3_finalize(statement)
```

### XCTStorageMetric for Testing

```swift
import XCTest

class DiskWriteTests: XCTestCase {
    func testDiskWritePerformance() {
        measure(metrics: [XCTStorageMetric()]) {
            // Code that writes to disk
            saveUserData()
        }
    }
}
```

---

## Part 8: Low Power Mode & Thermal Response APIs

### Low Power Mode Detection

```swift
import Foundation

class PowerStateManager {
    private var cancellables = Set<AnyCancellable>()

    init() {
        // Check initial state
        updateForPowerState()

        // Observe changes
        NotificationCenter.default.publisher(
            for: .NSProcessInfoPowerStateDidChange
        )
        .sink { [weak self] _ in
            self?.updateForPowerState()
        }
        .store(in: &cancellables)
    }

    private func updateForPowerState() {
        if ProcessInfo.processInfo.isLowPowerModeEnabled {
            reduceEnergyUsage()
        } else {
            restoreNormalOperation()
        }
    }

    private func reduceEnergyUsage() {
        // Increase timer intervals
        // Reduce animation frame rates
        // Defer network requests
        // Stop location updates if not critical
        // Reduce refresh frequency
    }
}
```

### Thermal State Response

```swift
import Foundation

class ThermalManager {
    init() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(thermalStateChanged),
            name: ProcessInfo.thermalStateDidChangeNotification,
            object: nil
        )
    }

    @objc private func thermalStateChanged() {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal:
            // Normal operation
            restoreFullFunctionality()

        case .fair:
            // Slightly elevated, minor reduction
            reduceNonEssentialWork()

        case .serious:
            // Significant reduction needed
            suspendBackgroundTasks()
            reduceAnimationQuality()

        case .critical:
            // Maximum reduction
            minimizeAllActivity()
            showThermalWarningIfAppropriate()

        @unknown default:
            break
        }
    }
}
```

---

## Part 9: MetricKit Monitoring APIs

### Basic Setup

```swift
import MetricKit

class MetricsManager: NSObject, MXMetricManagerSubscriber {
    static let shared = MetricsManager()

    func startMonitoring() {
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
}
```

### Processing Energy Metrics

```swift
func processPayload(_ payload: MXMetricPayload) {
    // CPU metrics
    if let cpu = payload.cpuMetrics {
        let foregroundTime = cpu.cumulativeCPUTime
        let backgroundTime = cpu.cumulativeCPUInstructions
        logMetric("cpu_foreground", value: foregroundTime)
    }

    // Location metrics
    if let location = payload.locationActivityMetrics {
        let backgroundLocationTime = location.cumulativeBackgroundLocationTime
        logMetric("background_location_seconds", value: backgroundLocationTime)
    }

    // Network metrics
    if let network = payload.networkTransferMetrics {
        let cellularUpload = network.cumulativeCellularUpload
        let cellularDownload = network.cumulativeCellularDownload
        let wifiUpload = network.cumulativeWiFiUpload
        let wifiDownload = network.cumulativeWiFiDownload

        logMetric("cellular_upload", value: cellularUpload)
        logMetric("cellular_download", value: cellularDownload)
    }

    // Disk metrics
    if let disk = payload.diskIOMetrics {
        let writes = disk.cumulativeLogicalWrites
        logMetric("disk_writes", value: writes)
    }

    // GPU metrics
    if let gpu = payload.gpuMetrics {
        let gpuTime = gpu.cumulativeGPUTime
        logMetric("gpu_time", value: gpuTime)
    }
}
```

### Xcode Organizer Integration

View field metrics in Xcode:
1. Window → Organizer
2. Select your app
3. Click "Battery Usage" in sidebar
4. Compare versions, filter by device/OS

Categories shown:
- Audio
- Networking
- Processing (CPU + GPU)
- Display
- Bluetooth
- Location
- Camera
- Torch
- NFC
- Other

---

## Part 10: Push Notifications APIs

### Alert Notifications Setup

From WWDC20-10095:

```swift
import UserNotifications

class NotificationManager: NSObject, UNUserNotificationCenterDelegate {

    func setup() {
        UNUserNotificationCenter.current().delegate = self
        UIApplication.shared.registerForRemoteNotifications()
    }

    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { granted, error in
            print("Permission granted: \(granted)")
        }
    }
}

// AppDelegate
func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
) {
    let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
    sendTokenToServer(token)
}

func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
) {
    print("Failed to register: \(error)")
}
```

### Background Push Notifications

```swift
// Handle background notification
func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
) {
    // Check for content-available flag
    guard let aps = userInfo["aps"] as? [String: Any],
          aps["content-available"] as? Int == 1 else {
        completionHandler(.noData)
        return
    }

    Task {
        do {
            let hasNewData = try await fetchLatestContent()
            completionHandler(hasNewData ? .newData : .noData)
        } catch {
            completionHandler(.failed)
        }
    }
}
```

### Server Payload Examples

```json
// Alert notification (user-visible)
{
    "aps": {
        "alert": {
            "title": "New Message",
            "body": "You have a new message from John"
        },
        "sound": "default",
        "badge": 1
    },
    "message_id": "12345"
}

// Background notification (silent)
{
    "aps": {
        "content-available": 1
    },
    "update_type": "new_content"
}
```

### Push Priority Headers

| Priority | Header | Use Case |
|----------|--------|----------|
| High (10) | `apns-priority: 10` | Time-sensitive alerts |
| Low (5) | `apns-priority: 5` | Deferrable updates |

**Energy tip**: Use priority 5 for all non-urgent notifications. System batches low-priority pushes for energy efficiency.

---

## Troubleshooting Checklist

### Issue: App at Top of Battery Settings

- [ ] Run Power Profiler to identify dominant subsystem
- [ ] Check for timers without tolerance
- [ ] Check for polling patterns
- [ ] Check for continuous location
- [ ] Check for background audio session
- [ ] Verify BGTasks complete promptly

### Issue: Device Gets Hot

- [ ] Check GPU Power Impact for sustained high values
- [ ] Look for continuous animations
- [ ] Check for blur effects over dynamic content
- [ ] Verify Metal frame limiting
- [ ] Check CPU for tight loops

### Issue: Background Battery Drain

- [ ] Audit background modes in Info.plist
- [ ] Verify audio session deactivated when not playing
- [ ] Check location accuracy and stop calls
- [ ] Verify beginBackgroundTask calls end promptly
- [ ] Review BGTask scheduling

### Issue: High Cellular Usage

- [ ] Check allowsExpensiveNetworkAccess setting
- [ ] Verify discretionary flag on background downloads
- [ ] Look for polling patterns
- [ ] Check for large automatic downloads

---

## Expert Review Checklist

### Timers (10 items)
- [ ] Tolerance ≥10% on all timers
- [ ] Timers invalidated in deinit
- [ ] No timers running when app backgrounded
- [ ] Using Combine Timer where possible
- [ ] No sub-second intervals without justification
- [ ] Event-driven alternatives considered
- [ ] No synchronization via timer polling
- [ ] Timer invalidated before creating new one
- [ ] Repeating timers have clear stop condition
- [ ] Background timer usage justified

### Network (10 items)
- [ ] waitsForConnectivity = true
- [ ] allowsExpensiveNetworkAccess appropriate
- [ ] allowsConstrainedNetworkAccess appropriate
- [ ] Non-urgent downloads use discretionary
- [ ] Push notifications instead of polling
- [ ] Requests batched where possible
- [ ] Payloads compressed
- [ ] Background URLSession for large transfers
- [ ] Retry logic has exponential backoff
- [ ] Connection reuse via single URLSession

### Location (10 items)
- [ ] Accuracy appropriate for use case
- [ ] distanceFilter set
- [ ] Updates stopped when not needed
- [ ] pausesLocationUpdatesAutomatically = true
- [ ] Background location only if essential
- [ ] Significant-change for background
- [ ] CLMonitor for region monitoring
- [ ] Location permission matches actual need
- [ ] Stationary detection utilized
- [ ] Location icon explained to users

### Background Execution (10 items)
- [ ] endBackgroundTask called promptly
- [ ] Expiration handlers implemented
- [ ] BGTasks use requiresExternalPower when possible
- [ ] EMRCA principles followed
- [ ] Background modes limited to needed
- [ ] Audio session deactivated when idle
- [ ] Progress saved incrementally
- [ ] Tasks complete within time limits
- [ ] Low Power Mode checked before heavy work
- [ ] Thermal state monitored

### Display/GPU (10 items)
- [ ] Dark Mode supported
- [ ] Animations stop when view hidden
- [ ] Frame rates appropriate for content
- [ ] Secondary animations lower priority
- [ ] Blur effects minimized
- [ ] Metal has frame limiting
- [ ] Brightness-independent design
- [ ] No hidden animations consuming power
- [ ] GPU-intensive work has visibility checks
- [ ] ProMotion considered in frame rate decisions

---

## WWDC Session Reference

| Session | Year | Topic |
|---------|------|-------|
| 226 | 2025 | Power Profiler workflow, on-device tracing |
| 227 | 2025 | BGContinuedProcessingTask, EMRCA principles |
| 10083 | 2022 | Dark Mode, frame rates, deferral |
| 10095 | 2020 | Push notifications primer |
| 707 | 2019 | Background execution advances |
| 417 | 2019 | Battery life, MetricKit |

---

**Last Updated**: 2025-12-26
**Platforms**: iOS 26+, iPadOS 26+
