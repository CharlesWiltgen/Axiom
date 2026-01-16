---
name: axiom-metrickit-ref
description: MetricKit API reference for field diagnostics - MXMetricPayload, MXDiagnosticPayload, MXCallStackTree parsing, crash and hang collection
user-invocable: false
---

# MetricKit API Reference

Complete API reference for collecting field performance metrics and diagnostics using MetricKit.

## Overview

MetricKit provides aggregated, on-device performance and diagnostic data from users who opt into sharing analytics. Data is delivered daily (or on-demand in development).

## When to Use This Reference

Use this reference when:
- Setting up MetricKit subscriber in your app
- Parsing MXMetricPayload or MXDiagnosticPayload
- Symbolicating MXCallStackTree crash data
- Understanding background exit reasons (jetsam, watchdog)
- Integrating MetricKit with existing crash reporters

For hang diagnosis workflows, see `axiom-hang-diagnostics`.
For general profiling with Instruments, see `axiom-performance-profiling`.
For memory debugging including jetsam, see `axiom-memory-debugging`.

## Common Gotchas

1. **24-hour delay** — MetricKit data arrives once daily; it's not real-time debugging
2. **Call stacks require symbolication** — MXCallStackTree frames are unsymbolicated; keep dSYMs
3. **Opt-in only** — Only users who enable "Share with App Developers" contribute data
4. **Aggregated, not individual** — You get counts and averages, not per-user traces
5. **Simulator doesn't work** — MetricKit only collects on physical devices

**iOS Version Support**:
| Feature | iOS Version |
|---------|-------------|
| Basic metrics (battery, CPU, memory) | iOS 13+ |
| Diagnostic payloads | iOS 14+ |
| Hang diagnostics | iOS 14+ |
| Launch diagnostics | iOS 16+ |
| Immediate delivery in dev | iOS 15+ |

## Part 1: Setup

### Basic Integration

```swift
import MetricKit

class AppMetricsSubscriber: NSObject, MXMetricManagerSubscriber {

    override init() {
        super.init()
        MXMetricManager.shared.add(self)
    }

    deinit {
        MXMetricManager.shared.remove(self)
    }

    // MARK: - MXMetricManagerSubscriber

    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            processMetrics(payload)
        }
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            processDiagnostics(payload)
        }
    }
}
```

### Registration Timing

Register subscriber early in app lifecycle:

```swift
@main
struct MyApp: App {
    @StateObject private var metricsSubscriber = AppMetricsSubscriber()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

Or in AppDelegate:

```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    metricsSubscriber = AppMetricsSubscriber()
    return true
}
```

### Development Testing

In iOS 15+, trigger immediate delivery via Debug menu:

**Xcode > Debug > Simulate MetricKit Payloads**

Or programmatically (debug builds only):

```swift
#if DEBUG
// Payloads delivered immediately in development
// No special code needed - just run and wait
#endif
```

## Part 2: MXMetricPayload

`MXMetricPayload` contains aggregated performance metrics from the past 24 hours.

### Payload Structure

```swift
func processMetrics(_ payload: MXMetricPayload) {
    // Time range for this payload
    let start = payload.timeStampBegin
    let end = payload.timeStampEnd

    // App version that generated this data
    let version = payload.metaData?.applicationBuildVersion

    // Access specific metric categories
    if let cpuMetrics = payload.cpuMetrics {
        processCPU(cpuMetrics)
    }

    if let memoryMetrics = payload.memoryMetrics {
        processMemory(memoryMetrics)
    }

    if let launchMetrics = payload.applicationLaunchMetrics {
        processLaunches(launchMetrics)
    }

    // ... other categories
}
```

### CPU Metrics (MXCPUMetric)

```swift
func processCPU(_ metrics: MXCPUMetric) {
    // Cumulative CPU time
    let cpuTime = metrics.cumulativeCPUTime  // Measurement<UnitDuration>

    // iOS 14+: CPU instruction count
    if #available(iOS 14.0, *) {
        let instructions = metrics.cumulativeCPUInstructions  // Measurement<Unit>
    }
}
```

### Memory Metrics (MXMemoryMetric)

```swift
func processMemory(_ metrics: MXMemoryMetric) {
    // Peak memory usage
    let peakMemory = metrics.peakMemoryUsage  // Measurement<UnitInformationStorage>

    // Average suspended memory
    let avgSuspended = metrics.averageSuspendedMemory  // MXAverage<UnitInformationStorage>
}
```

### Launch Metrics (MXAppLaunchMetric)

```swift
func processLaunches(_ metrics: MXAppLaunchMetric) {
    // First draw (cold launch) histogram
    let firstDrawHistogram = metrics.histogrammedTimeToFirstDraw

    // Resume time histogram
    let resumeHistogram = metrics.histogrammedApplicationResumeTime

    // Optimized time to first draw (iOS 15.2+)
    if #available(iOS 15.2, *) {
        let optimizedLaunch = metrics.histogrammedOptimizedTimeToFirstDraw
    }

    // Parse histogram buckets
    for bucket in firstDrawHistogram.bucketEnumerator {
        if let bucket = bucket as? MXHistogramBucket<UnitDuration> {
            let start = bucket.bucketStart  // e.g., 0ms
            let end = bucket.bucketEnd      // e.g., 100ms
            let count = bucket.bucketCount  // Number of launches in this range
        }
    }
}
```

### Application Exit Metrics (MXAppExitMetric) — iOS 14+

```swift
@available(iOS 14.0, *)
func processExits(_ metrics: MXAppExitMetric) {
    let fg = metrics.foregroundExitData
    let bg = metrics.backgroundExitData

    // Foreground (onscreen) exits
    let fgNormal = fg.cumulativeNormalAppExitCount
    let fgWatchdog = fg.cumulativeAppWatchdogExitCount
    let fgMemoryLimit = fg.cumulativeMemoryResourceLimitExitCount
    let fgMemoryPressure = fg.cumulativeMemoryPressureExitCount
    let fgBadAccess = fg.cumulativeBadAccessExitCount
    let fgIllegalInstruction = fg.cumulativeIllegalInstructionExitCount
    let fgAbnormal = fg.cumulativeAbnormalExitCount

    // Background exits
    let bgSuspended = bg.cumulativeSuspendedWithLockedFileExitCount
    let bgTaskTimeout = bg.cumulativeBackgroundTaskAssertionTimeoutExitCount
    let bgCPULimit = bg.cumulativeCPUResourceLimitExitCount
}
```

### Scroll Hitch Metrics (MXAnimationMetric) — iOS 14+

```swift
@available(iOS 14.0, *)
func processHitches(_ metrics: MXAnimationMetric) {
    // Scroll hitch rate (hitches per scroll)
    let scrollHitchRate = metrics.scrollHitchTimeRatio  // Double (0.0 - 1.0)
}
```

### Disk I/O Metrics (MXDiskIOMetric)

```swift
func processDiskIO(_ metrics: MXDiskIOMetric) {
    let logicalWrites = metrics.cumulativeLogicalWrites  // Measurement<UnitInformationStorage>
}
```

### Network Metrics (MXNetworkTransferMetric)

```swift
func processNetwork(_ metrics: MXNetworkTransferMetric) {
    let cellUpload = metrics.cumulativeCellularUpload
    let cellDownload = metrics.cumulativeCellularDownload
    let wifiUpload = metrics.cumulativeWifiUpload
    let wifiDownload = metrics.cumulativeWifiDownload
}
```

### Signpost Metrics (MXSignpostMetric)

Track custom operations with signposts:

```swift
// In your code: emit signposts
import os.signpost

let log = MXMetricManager.makeLogHandle(category: "ImageProcessing")

func processImage(_ image: UIImage) {
    mxSignpost(.begin, log: log, name: "ProcessImage")
    // ... do work ...
    mxSignpost(.end, log: log, name: "ProcessImage")
}

// In metrics subscriber: read signpost data
func processSignposts(_ metrics: MXSignpostMetric) {
    let name = metrics.signpostName
    let category = metrics.signpostCategory

    // Histogram of durations
    let histogram = metrics.signpostIntervalData.histogrammedSignpostDurations

    // Total count
    let count = metrics.totalCount
}
```

### Exporting Payload as JSON

```swift
func exportPayload(_ payload: MXMetricPayload) {
    // JSON representation for upload to analytics
    let jsonData = payload.jsonRepresentation()

    // Or as Dictionary
    if let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
        uploadToAnalytics(json)
    }
}
```

## Part 3: MXDiagnosticPayload — iOS 14+

`MXDiagnosticPayload` contains diagnostic reports for crashes, hangs, disk write exceptions, and CPU exceptions.

### Payload Structure

```swift
@available(iOS 14.0, *)
func processDiagnostics(_ payload: MXDiagnosticPayload) {
    // Crash diagnostics
    if let crashes = payload.crashDiagnostics {
        for crash in crashes {
            processCrash(crash)
        }
    }

    // Hang diagnostics
    if let hangs = payload.hangDiagnostics {
        for hang in hangs {
            processHang(hang)
        }
    }

    // Disk write exceptions
    if let diskWrites = payload.diskWriteExceptionDiagnostics {
        for diskWrite in diskWrites {
            processDiskWriteException(diskWrite)
        }
    }

    // CPU exceptions
    if let cpuExceptions = payload.cpuExceptionDiagnostics {
        for cpuException in cpuExceptions {
            processCPUException(cpuException)
        }
    }
}
```

### MXCrashDiagnostic

```swift
@available(iOS 14.0, *)
func processCrash(_ diagnostic: MXCrashDiagnostic) {
    // Call stack tree (needs symbolication)
    let callStackTree = diagnostic.callStackTree

    // Crash metadata
    let signal = diagnostic.signal              // e.g., SIGSEGV
    let exceptionType = diagnostic.exceptionType  // e.g., EXC_BAD_ACCESS
    let exceptionCode = diagnostic.exceptionCode
    let terminationReason = diagnostic.terminationReason

    // Virtual memory info
    let virtualMemoryRegionInfo = diagnostic.virtualMemoryRegionInfo

    // Unique identifier for grouping similar crashes
    // (not available - use call stack signature)
}
```

### MXHangDiagnostic

```swift
@available(iOS 14.0, *)
func processHang(_ diagnostic: MXHangDiagnostic) {
    // How long the hang lasted
    let duration = diagnostic.hangDuration  // Measurement<UnitDuration>

    // Call stack when hang occurred
    let callStackTree = diagnostic.callStackTree
}
```

### MXDiskWriteExceptionDiagnostic

```swift
@available(iOS 14.0, *)
func processDiskWriteException(_ diagnostic: MXDiskWriteExceptionDiagnostic) {
    // Total bytes written that triggered exception
    let totalWrites = diagnostic.totalWritesCaused  // Measurement<UnitInformationStorage>

    // Call stack of writes
    let callStackTree = diagnostic.callStackTree
}
```

### MXCPUExceptionDiagnostic

```swift
@available(iOS 14.0, *)
func processCPUException(_ diagnostic: MXCPUExceptionDiagnostic) {
    // Total CPU time that triggered exception
    let totalCPUTime = diagnostic.totalCPUTime  // Measurement<UnitDuration>

    // Total sampled time
    let totalSampledTime = diagnostic.totalSampledTime

    // Call stack of CPU-intensive code
    let callStackTree = diagnostic.callStackTree
}
```

## Part 4: MXCallStackTree

`MXCallStackTree` contains stack frames from diagnostics. Frames are NOT symbolicated—you must symbolicate using your dSYM.

### Structure

```swift
@available(iOS 14.0, *)
func parseCallStackTree(_ tree: MXCallStackTree) {
    // JSON representation
    let jsonData = tree.jsonRepresentation()

    // Parse the JSON
    guard let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
          let callStacks = json["callStacks"] as? [[String: Any]] else {
        return
    }

    for callStack in callStacks {
        guard let threadAttributed = callStack["threadAttributed"] as? Bool,
              let frames = callStack["callStackRootFrames"] as? [[String: Any]] else {
            continue
        }

        // threadAttributed = true means this thread caused the issue
        if threadAttributed {
            parseFrames(frames)
        }
    }
}

func parseFrames(_ frames: [[String: Any]]) {
    for frame in frames {
        // Binary image UUID (match to dSYM)
        let binaryUUID = frame["binaryUUID"] as? String

        // Address offset within binary
        let offsetIntoBinaryTextSegment = frame["offsetIntoBinaryTextSegment"] as? Int

        // Binary name (e.g., "MyApp", "UIKitCore")
        let binaryName = frame["binaryName"] as? String

        // Address (for symbolication)
        let address = frame["address"] as? Int

        // Sample count (how many times this frame appeared)
        let sampleCount = frame["sampleCount"] as? Int

        // Sub-frames (tree structure)
        let subFrames = frame["subFrames"] as? [[String: Any]]
    }
}
```

### JSON Structure Example

```json
{
  "callStacks": [
    {
      "threadAttributed": true,
      "callStackRootFrames": [
        {
          "binaryUUID": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
          "offsetIntoBinaryTextSegment": 123456,
          "binaryName": "MyApp",
          "address": 4384712345,
          "sampleCount": 10,
          "subFrames": [
            {
              "binaryUUID": "F1E2D3C4-B5A6-7890-1234-567890ABCDEF",
              "offsetIntoBinaryTextSegment": 78901,
              "binaryName": "UIKitCore",
              "address": 7234567890,
              "sampleCount": 10
            }
          ]
        }
      ]
    }
  ]
}
```

### Symbolication

MetricKit call stacks are **unsymbolicated**. To symbolicate:

1. **Keep your dSYM files** for every App Store build
2. **Match UUID** from `binaryUUID` to your dSYM
3. **Use atos** to symbolicate:

```bash
# Find dSYM for binary UUID
mdfind "com_apple_xcode_dsym_uuids == A1B2C3D4-E5F6-7890-ABCD-EF1234567890"

# Symbolicate address
atos -arch arm64 -o MyApp.app.dSYM/Contents/Resources/DWARF/MyApp -l 0x100000000 0x105234567
```

Or use a crash reporting service that handles symbolication (Crashlytics, Sentry, etc.).

## Part 5: MXBackgroundExitData

Track why your app was terminated in the background:

```swift
@available(iOS 14.0, *)
func analyzeBackgroundExits(_ data: MXBackgroundExitData) {
    // Normal exits (user closed, system reclaimed)
    let normal = data.cumulativeNormalAppExitCount

    // Memory issues
    let memoryLimit = data.cumulativeMemoryResourceLimitExitCount  // Exceeded memory limit
    let memoryPressure = data.cumulativeMemoryPressureExitCount    // Jetsam

    // Crashes
    let badAccess = data.cumulativeBadAccessExitCount        // SIGSEGV
    let illegalInstruction = data.cumulativeIllegalInstructionExitCount  // SIGILL
    let abnormal = data.cumulativeAbnormalExitCount          // Other crashes

    // System terminations
    let watchdog = data.cumulativeAppWatchdogExitCount       // Timeout during transition
    let taskTimeout = data.cumulativeBackgroundTaskAssertionTimeoutExitCount  // Background task timeout
    let cpuLimit = data.cumulativeCPUResourceLimitExitCount  // Exceeded CPU quota
    let lockedFile = data.cumulativeSuspendedWithLockedFileExitCount  // File lock held
}
```

### Exit Type Interpretation

| Exit Type | Meaning | Action |
|-----------|---------|--------|
| `normalAppExitCount` | Clean exit | None (expected) |
| `memoryResourceLimitExitCount` | Used too much memory | Reduce footprint |
| `memoryPressureExitCount` | Jetsam (system reclaimed) | Reduce background memory to <50MB |
| `badAccessExitCount` | SIGSEGV crash | Check null pointers, invalid memory |
| `illegalInstructionExitCount` | SIGILL crash | Check invalid function pointers |
| `abnormalExitCount` | Other crash | Check crash diagnostics |
| `appWatchdogExitCount` | Hung during transition | Reduce launch/background work |
| `backgroundTaskAssertionTimeoutExitCount` | Didn't end background task | Call `endBackgroundTask` properly |
| `cpuResourceLimitExitCount` | Too much background CPU | Move to BGProcessingTask |
| `suspendedWithLockedFileExitCount` | Held file lock while suspended | Release locks before suspend |

## Part 6: Integration Patterns

### Upload to Analytics Service

```swift
class MetricsUploader {
    func upload(_ payload: MXMetricPayload) {
        let jsonData = payload.jsonRepresentation()

        var request = URLRequest(url: analyticsEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData

        URLSession.shared.dataTask(with: request) { _, response, error in
            if let error = error {
                // Queue for retry
                self.queueForRetry(jsonData)
            }
        }.resume()
    }
}
```

### Combine with Crash Reporter

```swift
class HybridCrashReporter: MXMetricManagerSubscriber {
    let crashlytics: Crashlytics // or Sentry, etc.

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            // MetricKit captures crashes that traditional reporters might miss
            // (e.g., watchdog kills, memory pressure exits)

            if let crashes = payload.crashDiagnostics {
                for crash in crashes {
                    crashlytics.recordException(
                        name: crash.exceptionType?.description ?? "Unknown",
                        reason: crash.terminationReason ?? "MetricKit crash",
                        callStack: parseCallStack(crash.callStackTree)
                    )
                }
            }
        }
    }
}
```

### Alert on Regressions

```swift
class MetricsMonitor: MXMetricManagerSubscriber {
    let thresholds = MetricThresholds(
        launchTime: 2.0,  // seconds
        hangRate: 0.01,   // 1% of sessions
        memoryPeak: 200   // MB
    )

    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            checkThresholds(payload)
        }
    }

    private func checkThresholds(_ payload: MXMetricPayload) {
        // Check launch time
        if let launches = payload.applicationLaunchMetrics {
            let p50 = calculateP50(launches.histogrammedTimeToFirstDraw)
            if p50 > thresholds.launchTime {
                sendAlert("Launch time regression: \(p50)s > \(thresholds.launchTime)s")
            }
        }

        // Check memory
        if let memory = payload.memoryMetrics {
            let peakMB = memory.peakMemoryUsage.converted(to: .megabytes).value
            if peakMB > Double(thresholds.memoryPeak) {
                sendAlert("Memory peak regression: \(peakMB)MB > \(thresholds.memoryPeak)MB")
            }
        }
    }
}
```

## Part 7: Best Practices

### Do

- **Register subscriber early** — In `application(_:didFinishLaunchingWithOptions:)` or App init
- **Keep dSYM files** — Required for symbolicating call stacks
- **Upload payloads to server** — Local processing loses data on uninstall
- **Set up alerting** — Detect regressions before users report them
- **Test with simulated payloads** — Xcode Debug menu in iOS 15+

### Don't

- **Don't rely solely on MetricKit** — 24-hour delay, requires user opt-in
- **Don't ignore background exits** — Jetsam and task timeouts affect UX
- **Don't skip symbolication** — Raw addresses are unusable
- **Don't process on main thread** — Payload processing can be expensive

### Privacy Considerations

- MetricKit data is **aggregated and anonymized**
- Data only from users who **opted into sharing analytics**
- No personally identifiable information
- Safe to upload to your servers

## Part 8: MetricKit vs Xcode Organizer

| Feature | MetricKit | Xcode Organizer |
|---------|-----------|-----------------|
| **Data source** | Devices running your app | App Store Connect aggregation |
| **Delivery** | Daily to your subscriber | On-demand in Xcode |
| **Customization** | Full access to raw data | Predefined views |
| **Symbolication** | You must symbolicate | Pre-symbolicated |
| **Historical data** | Only when subscriber active | Last 16 versions |
| **Requires code** | Yes | No |

**Use both**: Organizer for quick overview, MetricKit for custom analytics and alerting.

## Resources

**WWDC**: 2019-417, 2020-10081, 2021-10087

**Docs**: /metrickit, /metrickit/mxmetricmanager, /metrickit/mxdiagnosticpayload

**Skills**: axiom-hang-diagnostics, axiom-performance-profiling, axiom-testflight-triage
