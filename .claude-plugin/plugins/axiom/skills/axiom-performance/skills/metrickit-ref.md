# MetricKit API Reference

Complete API reference for collecting field performance metrics and diagnostics using MetricKit.

## Overview

MetricKit provides aggregated, on-device performance and diagnostic data from users who opt into sharing analytics. Metric reports arrive daily; diagnostic reports arrive immediately when captured for in-session events (hangs, CPU/disk-write exceptions) — crash diagnostics necessarily arrive on the app's next run (or on-demand in development).

The framework has two API generations. The 27 cycle rebuilt it as a Swift-first API (`MetricManager`, `AsyncSequence` streams, `Codable` reports) — Part 1. The legacy `MX*` Objective-C surface (Parts 2–6, with legacy-API integration examples in Part 7) is soft-deprecated in the 27 SDK ("Use MetricResult instead", `API_TO_BE_DEPRECATED`) but remains the only API before 27.

## When to Use This Reference

Use this reference when:
- Setting up MetricKit collection in your app (new `MetricManager` or legacy subscriber)
- Migrating from the legacy `MX*` subscriber API to the 27 `MetricManager` API
- Parsing `MetricReport`/`DiagnosticReport` (27) or MXMetricPayload/MXDiagnosticPayload (legacy)
- Splitting metrics by app state (tab, mode, experiment) with the StateReporting framework
- Symbolicating MetricKit call-stack crash data
- Understanding background exit reasons (jetsam, watchdog)
- Integrating MetricKit with existing crash reporters

For hang diagnosis workflows, see `axiom-performance (skills/hang-diagnostics.md)`.
For general profiling with Instruments, see `axiom-performance (skills/performance-profiling.md)`.
For memory debugging including jetsam, see `axiom-performance (skills/memory-debugging.md)`.

## Common Gotchas

1. **Metrics are daily, not real-time** — metric reports arrive once a day; diagnostic reports are delivered immediately when captured for in-session events (hangs, exceptions), while crash diagnostics arrive on the next run
2. **Call stacks require symbolication** — call-stack frames are unsymbolicated; keep dSYMs
3. **Opt-in only** — Only users who enable "Share with App Developers" contribute data
4. **Aggregated, not individual** — You get counts and averages, not per-user traces
5. **Simulator doesn't work** — MetricKit only collects on physical devices
6. **Keep the manager alive** — both `MetricManager` (27) and a legacy subscriber must outlive the subscription; subscribe at app startup or you lose reports
7. **State reporting is rate-limited** — transitions reported faster than user-interaction timescales can go unlogged

### Version Support

| Feature | Available |
|---------|-----------|
| Basic metrics (battery, CPU, memory) | iOS 13+ |
| Diagnostic payloads | iOS 14+ |
| Hang diagnostics | iOS 14+ |
| Immediate diagnostic delivery | iOS 15+ |
| Launch diagnostics | iOS 16+ |
| Swift-first API (`MetricManager`, typed metrics/diagnostics) | `OS27` (not watchOS/tvOS; visionOS = diagnostics subset) |
| Per-state metrics (StateReporting framework) | `OS27` (the StateReporting framework itself spans all platforms) |
| Metal frame rate metric, launch-task tracking | `OS27` |
| Memory exception diagnostics | `iOS27` |

## Part 1: The New Swift API `OS27`

Available on iOS 27, iPadOS 27, macOS 27, and Mac Catalyst 27; visionOS 27 receives the diagnostics subset only; not available on watchOS or tvOS. The companion StateReporting framework is available on **all** platforms at 27, including watchOS and tvOS. Apple's guidance (WWDC 2026-222): migrate from `MXMetricManager` to `MetricManager` — all new capabilities are exclusive to the new API.

### MetricManager Setup

`MetricManager` replaces the subscriber/delegate model with `AsyncSequence` streams. Create it at app startup and keep it alive for the app's lifetime — a deallocated manager stops delivering, and a late subscription loses reports.

```swift
import MetricKit

let manager = MetricManager()

// At startup, in a detached task or a dedicated service class:
for await report in manager.metricReports {
    let json = try JSONEncoder().encode(report)   // MetricReport is Codable
    sendToServer(json)
}
```

### MetricReport Structure

A daily `MetricReport` contains `intervalEntries` — one full-day aggregate (`entries.fullDayEntry`) plus smaller breakdown windows (typically a few hours each, present only when they have data). Each entry's `values` is `[MetricResult]`, filterable by `metricGroup`:

```swift
for await report in manager.metricReports {
    let entries = report.intervalEntries

    for entry in entries {
        let memoryMetrics = entry.values.filter { $0.metricGroup == .memory }
        for metric in memoryMetrics {
            if case .peakMemory(let peak) = metric {
                processPeakMemory(peak.value)   // Measurement<UnitInformationStorage>
            }
        }
    }
}
```

`MetricReport.environment` carries `osVersion`, `deviceType`, `lowPowerModeEnabled`, `isTestFlightApp`, `bundleIdentifier`, `latestApplicationVersion`, `includesMultipleApplicationVersions`, and `hasExceededStateLimit` (see States below).

### Metric Inventory (MetricResult cases)

Typed metric structs use `Measurement`, generic `Histogram<DimensionType>` (buckets with typed bounds), and `AverageStatistics<DimensionType>` (average/count/standardDeviation). Cases without a platform note are available wherever the API is (iOS/macOS/Catalyst).

| Case | Payload | Notes |
|------|---------|-------|
| `.hangTime` | `Histogram<UnitDuration>` | |
| `.hitchTime` | ratio + totalHitchTime + totalAnimationTime | animation hitches beyond scrolling |
| `.scrollHitchTime` | ratio + totalHitchTime + totalScrollTime | |
| `.timeToFirstDraw`, `.optimizedTimeToFirstDraw`, `.applicationResumeTime`, `.extendedLaunch` | `Histogram<UnitDuration>` | launch family |
| `.foregroundTermination`, `.backgroundTermination` | per-category counts | both include watchdog; background adds taskTimeout, fileLock, highCPU, systemPressure |
| `.cpuTime`, `.cpuInstructionsCount` | duration / count | |
| `.gpuTime` | duration | |
| `.peakMemory`, `.suspendedMemory` | storage / `AverageStatistics` | iOS only |
| `.totalWiFiUpload`, `.totalWiFiDownload` | storage | |
| `.totalCellularUpload`, `.totalCellularDownload` | storage | iOS only |
| `.logicalDiskWrites` | storage | |
| `.totalDiskSpaceCapacity`, `.totalFileCount`, `.totalFileSize` | capacity/spaceUsed; binary/data file counts; binary/data/cache/clone sizes | iOS only — the same storage breakdown the Xcode 27 Organizer's Storage metric reports |
| `.pixelLuminance` | `AverageStatistics<AveragePixelLuminance>` | iOS only |
| `.cellularConditionTime` | `Histogram<SignalBars>` | iOS only |
| `.locationActivityTime` | per-accuracy-bucket durations | iOS only |
| `.totalForegroundTime`, `.totalBackgroundTime`, `.totalBackgroundAudioTime`, `.totalBackgroundLocationTime` | durations | iOS only |
| `.metalFrameRate` | framesPerSecond, frameCount, activeDrawingDuration, layerName | new capability — render performance for games |
| `.signpostInterval` | duration histogram + optional averageMemory, cpuTime, logicalWrites, hitch ratios | per signpost name/category |

`MetricGroup` constants for filtering: `.cpu`, `.memory`, `.diskIO`, `.networkTransfer`, `.display`, `.animation`, `.applicationResponsiveness`, `.cellularCondition`, `.locationActivity`, `.gpu`, `.signpost`, `.appLaunch`, `.appRuntime`, `.appTermination`, `.diskSpaceUsage`, `.frameStatistics`.

### Launch Task Tracking

`trackLaunchTask` instruments named work that contributes to your extended launch (feeds the `.extendedLaunch` metric family). It is `@MainActor`, has sync and async overloads, propagates the operation's typed error, and reports tracking problems via `onTrackingError` (`LaunchTaskError.Reason`: `.invalidID`, `.maxCountExceeded`, `.pastDeadline`, `.duplicateTask`, `.taskUnknown`, `.internalFailure`):

```swift
@MainActor
func loadInitialFeed() async {
    let feed = await manager.trackLaunchTask(id: "load-feed") {
        await feedStore.loadCachedFeed()
    }
    render(feed)
}
```

### Diagnostics (DiagnosticReport)

Each `DiagnosticReport` carries **one** typed `result` (legacy payloads bundled arrays), plus `timeRange` and an `environment` that includes `signpostData: [SignpostRecord]` (subsystem/category/name/interval of signposts captured with the diagnostic) and `states` (active reported states — neither on visionOS). Delivery is immediate when the event is captured (for crashes, on the app's next run — the crashed process can't receive its own report):

```swift
for await report in manager.diagnosticReports {
    switch report.result {
    case .crash(let crash):
        let category = crash.terminationCategory   // how this crash is accounted in metrics
        process(crash.callStackTree, crash.terminationReason, category)
    case .hang(let hang):
        process(hang.callStackTree, hang.hangDuration)
    case .memoryException(let memory):             // iOS27 only: app/extension killed over memory limit
        process(memory.callStackTree)
    case .cpuException(let cpu):
        process(cpu.callStackTree, cpu.totalCPUTime)
    case .diskWriteException(let diskWrite):
        process(diskWrite.callStackTree, diskWrite.totalBytesWritten)
    case .appLaunch(let launch):                   // not visionOS
        process(launch.callStackTree, launch.launchDuration)
    default: break
    }
}
```

`CrashDiagnostic.TerminationCategory` (`.badAccess`, `.abnormal`, `.illegalInstruction`, `.watchdog`, `.taskTimeout`, `.fileLock`) ties each crash to the corresponding termination-metric count, so a trend in `.foregroundTermination`/`.backgroundTermination` correlates directly with individual diagnostics. `CrashDiagnostic` also exposes `signal`, `exceptionType`/`exceptionCode`, `virtualMemoryRegionInfo`, and a typed `ObjectiveCExceptionReason` (composedMessage, className, exceptionName).

### CallStackTree (typed)

The new `CallStackTree` is a Swift struct — no JSON spelunking. `callStackThreads` holds `CallStackThread` values (`rootFrames`, `threadAttributed`); frames expose `binaryUUID`, `address`, `offsetIntoBinaryTextSegment`, `sampleCount`, `subFrames`. `forEachFrame` walks the tree; `binaryInfo` maps UUIDs to binary names:

```swift
crash.callStackTree.forEachFrame { frame in
    let binary = frame.binaryName(from: crash.callStackTree)
    record(binary, frame.offsetIntoBinaryTextSegment, frame.sampleCount)
}
```

Frames are still unsymbolicated — the dSYM workflow in Part 5 applies unchanged, and `CallStackTree` is `Codable` so you can persist it for xcsym.

### Per-State Metrics (StateReporting framework)

Without states, a metric is one blended number across all usage (WWDC 2026-222's example: a 15 ms/s scroll-hitch rate that hid a smooth 1 ms/s Spending tab and a critical 71 ms/s Reports tab). The StateReporting framework lets MetricKit aggregate metrics and diagnostics **per app state you define**.

Model: a **domain** (reverse-DNS string) covers one axis of app state and has at most one active state at a time; separate domains run concurrently (e.g. active-tab and experiment-arm). A state is identified by its **label + stable metadata**; reporting the same pair is a no-op. There are no begin/end pairs — report the state you're *entering*; `nil` clears the active state. **Volatile metadata** adds context within a state and is discarded at the next transition.

```swift
import MetricKit
import StateReporting

let tabs: StateReportingDomain = "com.example.app.tabs"
let manager = MetricManager(enabledStateReportingDomains: [tabs])

// Anywhere in the app — reporters are per-domain singletons:
let reporter = StateReporter.reporter(for: tabs.rawValue)
reporter.reportTransition(to: "Reports")   // entering the Reports tab
reporter.reportTransition(to: nil)         // no state active
```

To update volatile metadata mid-state without starting a new transition, call `reporter.reportVolatileMetadataUpdate(_:)` (no-op when no state is active; `nil` clears it).

Attach structured metadata with the `@ReportableMetadata` macro (values: string, date, integer, floating-point; `@ReportableMetadataKey("name")` renames a property, `@ReportableMetadataIgnored` excludes one):

```swift
@ReportableMetadata
struct ViewConfiguration {
    let listSize: String
    let isSorted: Bool
}

let configured = StateReporter.reporter(
    for: tabs.rawValue,
    stableMetadata: ViewConfiguration.self
)
configured.reportTransition(
    to: "Reports",
    stableMetadata: ViewConfiguration(listSize: "large", isSorted: false)
)
```

Read results from `MetricReport.stateEntries` (empty until you report states) — each `StateEntry` has `state` (`domain`, `label`, `duration`, `stableMetadata`) and `values: [MetricResult]` aggregated over time spent in that state. To group the encoded report by domain:

```swift
let encoder = JSONEncoder()
encoder.userInfo[MetricReport.encodingFormatKey] =
    MetricReport.EncodingFormat.byStateReportingDomain
let json = try encoder.encode(report)
```

State best practices:
- Scope domains narrowly — one app area or axis per domain
- States are stable, meaningful phases — not transient UI events
- Plan the state count: too many states fragments the data; there are upper limits (`environment.hasExceededStateLimit` tells you when you hit them)
- Transitions faster than user-interaction timescales get rate-limited and dropped
- Validate with the Points of Interest instrument before shipping

### Migration Map (MX* → 27 API)

| Legacy | New |
|--------|-----|
| `MXMetricManager.shared.add(subscriber)` | `MetricManager()` + `for await` on `metricReports`/`diagnosticReports` |
| `MXMetricPayload` | `MetricReport` (Codable) |
| `MXDiagnosticPayload` (arrays of diagnostics) | `DiagnosticReport` (one typed `result` each) |
| `payload.jsonRepresentation()` | `JSONEncoder().encode(report)` |
| `MXCallStackTree` (raw JSON) | `CallStackTree` structs (`forEachFrame`, typed frames) |
| `MXAppExitMetric` fg/bg exit counts | `.foregroundTermination` / `.backgroundTermination` |
| `MXCrashDiagnostic` | `CrashDiagnostic` + `terminationCategory` |
| `MXMetricManager.makeLogHandle(category:)` | `MetricManager.logHandle(category:)` (`mxSignpost` itself is unchanged) |
| `histogrammedTimeToFirstDraw` etc. | `.timeToFirstDraw`, `.optimizedTimeToFirstDraw`, `.applicationResumeTime`, `.extendedLaunch` |

## Part 2: Setup (Legacy)

The `MX*` API below is soft-deprecated in the 27 SDK but is the only MetricKit API on iOS 13–26.

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
    private let metricsSubscriber = AppMetricsSubscriber()

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

No code needed in debug builds — payloads are delivered immediately in development.

## Part 3: MXMetricPayload (Legacy)

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

    // Histogram of durations (signpostIntervalData is Optional — unwrap before use)
    // MXHistogram<NSUnitDuration>
    let histogram = metrics.signpostIntervalData?.histogrammedSignpostDuration

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

## Part 4: MXDiagnosticPayload (Legacy) — iOS 14+

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

## Part 5: MXCallStackTree (Legacy)

`MXCallStackTree` contains stack frames from diagnostics. Frames are NOT symbolicated—you must symbolicate using your dSYM.

### Symbolicating MetricKit crashes

Write the `MXCrashDiagnostic.jsonRepresentation()` bytes to a file, then:

```bash
xcsym crash crash.json --format=standard
```

xcsym auto-detects MetricKit format. Note that MetricKit crashes from users don't ship dSYMs — pair with `xcsym verify crash.json` to confirm your archive's dSYM matches the binary the user was running (keep dSYMs for every App Store build). See `axiom-tools (skills/xcsym-ref.md)` for the full subcommand reference.

Manual fallback — match each frame's `binaryUUID` to a dSYM and resolve the address with atos:

```bash
mdfind "com_apple_xcode_dsym_uuids == A1B2C3D4-E5F6-7890-ABCD-EF1234567890"
atos -arch arm64 -o MyApp.app.dSYM/Contents/Resources/DWARF/MyApp -l 0x100000000 0x105234567
```

Or use a crash reporting service that handles symbolication (Crashlytics, Sentry, etc.).

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

## Part 6: MXBackgroundExitData (Legacy)

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

## Part 7: Integration Patterns (Legacy examples)

The examples below use the legacy subscriber. The patterns themselves — analytics upload, crash-reporter merge, threshold alerting — carry over to the new API: encode `MetricReport` with `JSONEncoder` instead of `jsonRepresentation()`.

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

## Part 8: Best Practices

### Do

- **Subscribe early** — create `MetricManager` (or register the MX* subscriber) at launch; a late subscription loses reports
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

## Part 9: MetricKit vs Xcode Organizer

| Feature | MetricKit | Xcode Organizer |
|---------|-----------|-----------------|
| **Data source** | Devices running your app | App Store Connect aggregation |
| **Delivery** | Daily to your subscriber | On-demand in Xcode |
| **Customization** | Full access to raw data | Predefined views |
| **Symbolication** | You must symbolicate | Pre-symbolicated |
| **Historical data** | Only when subscriber active | Last 16 versions |
| **Requires code** | Yes | No |

**Use both**: Organizer for quick overview, MetricKit for custom analytics and alerting.

The Xcode 27 Organizer adds a redesigned Overview, Storage and animation-hitches metrics (fed by the corresponding 27 MetricKit metrics), calibrated Metric Goals, and agentic Generate Recommendations — see `axiom-performance (skills/performance-profiling.md)`.

## Part 10: CrashReportExtension — Crash Reporter Extensions `OS27`

A NEW framework (iOS 27/macOS 27; also in the visionOS 27 SDK; the extension protocol is explicitly unavailable on tvOS/watchOS) for shipping a crash reporter as an app extension. Where MetricKit delivers crash *diagnostics* on the app's next run (Part 1), a crash reporter extension is invoked by the system when a crash report is ready to be processed, in its own process separate from the crashed app — the extension point for third-party crash reporters. You can persist the report or send it to a server you control.

```swift
import CrashReportExtension
import ExtensionFoundation

@main
struct MyCrashReporter: CrashReporterExtension {
    init() {}

    func processCrashReport(process: CrashedProcess) {
        let reason = process.reason            // CrashReason: exception code + codes
        let images = process.binaryImages      // [BinaryImageInfo]
        let faultAddress: UInt64 = addressFromBacktrace()  // an address you pull from the crashed process
        let frames = process.symbolicateAddress(faultAddress)  // [SymbolicatedFrame]
        // persist or upload the report
    }
}
```

| Type | Members |
|------|---------|
| `CrashReporterExtension` | `AppExtension` protocol; implement `processCrashReport(process:)`; default `configuration` provided |
| `CrashedProcess` | `reason: CrashReason`, `corpsePort: mach_port_t`, `binaryImages: [BinaryImageInfo]`, `symbolicateAddress(_:) -> [SymbolicatedFrame]`, `symbolicateAddresses(_:)`, `symbolAddress(imageName:symbolName:)` |
| `CrashReason` | `exception: Int32`, `codes: [UInt64]` |
| `SymbolicatedFrame` | `symbol`, `symbolOffset`, `sourceFile?`, `sourceLine?`, `isInline` — `Codable`, `Sendable` |
| `BinaryImageInfo` | `path`, `uuid?`, `baseAddress`, `size`, `cpuType`, `cpuSubType` — `Codable`, `Sendable` |

Symbolication happens in the extension at crash time (`symbolicateAddress` returns multiple frames when inlining applies — note `isInline`), so reports can carry symbol names without shipping dSYMs to a server. For analyzing crash *files* on your Mac (`.ips`, MetricKit JSON), use Axiom's `xcsym` instead — see `axiom-tools (skills/xcsym-ref.md)`.

## Resources

**WWDC**: 2019-417, 2020-10081, 2021-10087, 2026-222

**Docs**: /metrickit, /metrickit/metricmanager, /statereporting, /crashreportextension, /metrickit/mxmetricmanager, /metrickit/mxdiagnosticpayload

**Skills**: axiom-performance (skills/hang-diagnostics.md), axiom-performance (skills/performance-profiling.md), axiom-performance (skills/app-launch.md), axiom-performance (skills/memory-debugging.md), axiom-shipping (skills/testflight-triage.md), axiom-tools (skills/xcsym-ref.md)
