---
name: axiom-energy
description: Use when app drains battery, device gets hot, users report energy issues, or auditing power consumption - systematic Power Profiler diagnosis, subsystem identification (CPU/GPU/Network/Location/Display), anti-pattern fixes for iOS/iPadOS
user-invocable: true
skill_type: discipline
version: 1.0.0
# MCP annotations (ignored by Claude Code)
mcp:
  category: performance
  tags: [energy, battery, power, instruments, profiling, optimization]
  related: [performance-profiling, axiom-memory-debugging, axiom-networking]
---

# Energy Optimization

## Overview

Energy issues manifest as battery drain, hot devices, and poor App Store reviews. **Core principle**: Measure before optimizing. Use Power Profiler to identify the dominant subsystem (CPU/GPU/Network/Location/Display), then apply targeted fixes.

**Key insight**: Developers often don't know where to START auditing. This skill provides systematic diagnosis, not guesswork.

**Requirements**: iOS 26+, Xcode 26+, Power Profiler in Instruments

## Example Prompts

Real questions developers ask that this skill answers:

#### 1. "My app is always at the top of Battery Settings. How do I find what's draining power?"
→ The skill covers Power Profiler workflow to identify dominant subsystem and targeted fixes

#### 2. "Users report my app makes their phone hot. Where do I start debugging?"
→ The skill provides decision tree: CPU vs GPU vs Network diagnosis with specific patterns

#### 3. "I have timers and location updates. Are they causing battery drain?"
→ The skill covers timer tolerance, location accuracy trade-offs, and audit checklists

#### 4. "My app drains battery in the background even when users aren't using it."
→ The skill covers background execution patterns, BGTasks, and EMRCA principles

#### 5. "How do I measure if my optimization actually improved battery life?"
→ The skill demonstrates before/after Power Profiler comparison workflow

---

## Red Flags — High Energy Likely

If you see ANY of these, suspect energy inefficiency:

- **Battery Settings**: Your app consistently at top of battery consumers
- **Device temperature**: Phone gets warm during normal app use
- **User reviews**: Mentions of "battery drain", "hot phone", "kills my battery"
- **Xcode Energy Gauge**: Shows sustained high or very high impact
- **Background runtime**: App runs longer than expected when not visible
- **Network activity**: Frequent small requests instead of batched operations
- **Location icon**: Appears in status bar when app shouldn't need location

#### Difference from normal energy use
- **Normal**: App uses energy during active use, minimal when backgrounded
- **Problem**: App uses significant energy even when user isn't interacting

## Mandatory First Steps

**ALWAYS run Power Profiler FIRST** before optimizing code:

### Step 1: Record a Power Trace (5 minutes)

```
1. Connect iPhone wirelessly to Xcode (wireless debugging)
2. Xcode → Product → Profile (Cmd+I)
3. Select Blank template
4. Click "+" → Add "Power Profiler" instrument
5. Optional: Add "CPU Profiler" for correlation
6. Click Record
7. Use your app normally for 2-3 minutes
8. Click Stop
```

**Why wireless**: When device is charging via cable, power metrics show 0. Use wireless debugging for accurate readings.

### Step 2: Identify Dominant Subsystem

Expand the Power Profiler track and examine per-app metrics:

| Lane | Meaning | High Value Indicates |
|------|---------|---------------------|
| CPU Power Impact | Processor activity | Computation, timers, parsing |
| GPU Power Impact | Graphics rendering | Animations, blur, Metal |
| Display Power Impact | Screen usage | Brightness, always-on content |
| Network Power Impact | Radio activity | Requests, downloads, polling |

**Look for**: Which subsystem shows highest sustained values during your app's usage.

### Step 3: Branch to Subsystem-Specific Fixes

Once you identify the dominant subsystem, use the decision trees below.

#### What this tells you
- **CPU dominant** → Check timers, polling, JSON parsing, eager loading
- **GPU dominant** → Check animations, blur effects, frame rates
- **Network dominant** → Check request frequency, polling vs push
- **Display dominant** → Check Dark Mode, brightness, screen-on time
- **Location** (shown in CPU) → Check accuracy, update frequency

#### Why diagnostics first
- Finding root cause with Power Profiler: **15-20 minutes**
- Guessing and testing random optimizations: **4+ hours, often wrong subsystem**

---

## Energy Decision Tree

```
User reports energy issue?
│
├─ CPU Power Impact dominant?
│  ├─ Continuous high impact?
│  │  ├─ Timers running? → Pattern 1: Timer Efficiency
│  │  ├─ Polling data? → Pattern 2: Push vs Poll
│  │  └─ Processing in loop? → Pattern 3: Lazy Loading
│  ├─ Spikes during specific actions?
│  │  ├─ JSON parsing? → Cache parsed results
│  │  ├─ Image processing? → Move to background, cache
│  │  └─ Database queries? → Index, batch, prefetch
│  └─ High background CPU?
│     ├─ Location updates? → Pattern 4: Location Efficiency
│     ├─ BGTasks running too long? → Pattern 5: Background Execution
│     └─ Audio session active? → Stop when not playing
│
├─ Network Power Impact dominant?
│  ├─ Many small requests?
│  │  └─ Batch into fewer large requests
│  ├─ Polling pattern detected?
│  │  └─ Convert to push notifications → Pattern 2
│  ├─ Downloads in foreground?
│  │  └─ Use discretionary background URLSession
│  └─ High cellular usage?
│     └─ Defer to WiFi when possible
│
├─ GPU Power Impact dominant?
│  ├─ Continuous animations?
│  │  └─ Stop when view not visible
│  ├─ Blur effects (UIVisualEffectView)?
│  │  └─ Reduce or remove, use solid colors
│  ├─ High frame rate animations?
│  │  └─ Audit secondary frame rates → Pattern 6
│  └─ Metal rendering?
│     └─ Implement frame limiting
│
├─ Display Power Impact dominant?
│  ├─ Light backgrounds on OLED?
│  │  └─ Implement Dark Mode (up to 70% savings)
│  ├─ High brightness content?
│  │  └─ Use darker UI elements
│  └─ Screen always on?
│     └─ Allow screen to sleep when appropriate
│
└─ Location causing drain? (check CPU lane + location icon)
   ├─ Continuous updates?
   │  └─ Switch to significant-change monitoring
   ├─ High accuracy (kCLLocationAccuracyBest)?
   │  └─ Reduce to kCLLocationAccuracyHundredMeters
   └─ Background location?
      └─ Evaluate if truly needed → Pattern 4
```

---

## Common Energy Patterns (With Fixes)

### Pattern 1: Timer Efficiency

**Problem**: Timers wake the CPU from idle states, consuming significant energy.

#### ❌ Anti-Pattern — Timer without tolerance
```swift
// BAD: Timer fires exactly every 1.0 seconds
// Prevents system from batching with other timers
Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
    self.updateUI()
}
```

#### ✅ Fix — Set tolerance for timer batching
```swift
// GOOD: 10% tolerance allows system to batch timers
let timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
    self.updateUI()
}
timer.tolerance = 0.1  // 10% tolerance minimum

// BETTER: Use Combine Timer with tolerance
Timer.publish(every: 1.0, tolerance: 0.1, on: .main, in: .default)
    .autoconnect()
    .sink { [weak self] _ in
        self?.updateUI()
    }
    .store(in: &cancellables)
```

#### ✅ Best — Use event-driven instead of polling
```swift
// BEST: Don't use timer at all — react to events
NotificationCenter.default.publisher(for: .dataDidUpdate)
    .sink { [weak self] _ in
        self?.updateUI()
    }
    .store(in: &cancellables)
```

**Key points**:
- Set tolerance to **at least 10%** of interval
- Timer tolerance allows system to batch multiple timers into single wake
- Prefer event-driven patterns over polling timers
- Always invalidate timers when no longer needed

---

### Pattern 2: Push vs Poll

**Problem**: Polling (checking server every N seconds) keeps radios active and drains battery.

#### ❌ Anti-Pattern — Polling every 5 seconds
```swift
// BAD: Polls server every 5 seconds
// Radio stays active, massive battery drain
Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
    self?.fetchLatestData()  // Network request every 5 seconds
}
```

#### ✅ Fix — Use background push notifications
```swift
// GOOD: Server pushes when data changes
// Radio only active when there's actual new data

// 1. Register for remote notifications
UIApplication.shared.registerForRemoteNotifications()

// 2. Handle background notification
func application(_ application: UIApplication,
                 didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                 fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {

    guard let _ = userInfo["content-available"] else {
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

**Server payload for background push**:
```json
{
    "aps": {
        "content-available": 1
    },
    "custom-data": "your-payload"
}
```

**Key points**:
- Background pushes are **discretionary** — system delivers at optimal time
- Use `apns-priority: 5` for non-urgent updates (energy efficient)
- Use `apns-priority: 10` only for time-sensitive alerts
- Polling every 5 seconds uses **100x more energy** than push

---

### Pattern 3: Lazy Loading & Caching

**Problem**: Loading all data upfront causes CPU spikes and memory pressure.

#### ❌ Anti-Pattern — Eager loading (from WWDC25-226)
```swift
// BAD: Creates and renders ALL views upfront
// From WWDC25-226: This caused CPU spike and hang
VStack {
    ForEach(videos) { video in
        VideoCardView(video: video)  // Creates ALL thumbnails immediately
    }
}
```

#### ✅ Fix — Lazy loading
```swift
// GOOD: Only creates visible views
// From WWDC25-226: Reduced CPU power impact from 21 to 4.3
LazyVStack {
    ForEach(videos) { video in
        VideoCardView(video: video)  // Creates on-demand
    }
}
```

#### ❌ Anti-Pattern — Repeated parsing (from WWDC25-226)
```swift
// BAD: Parses JSON file on every location update
// From WWDC25-226: Caused continuous CPU drain during commute
func videoSuggestionsForLocation(_ location: CLLocation) -> [Video] {
    // Called every location change!
    let data = try? Data(contentsOf: rulesFileURL)
    let rules = try? JSONDecoder().decode([RecommendationRule].self, from: data)
    return filteredVideos(using: rules)
}
```

#### ✅ Fix — Cache parsed data
```swift
// GOOD: Parse once, reuse cached result
// From WWDC25-226: Eliminated CPU drain
private lazy var cachedRules: [RecommendationRule] = {
    let data = try? Data(contentsOf: rulesFileURL)
    return (try? JSONDecoder().decode([RecommendationRule].self, from: data)) ?? []
}()

func videoSuggestionsForLocation(_ location: CLLocation) -> [Video] {
    return filteredVideos(using: cachedRules)  // No parsing!
}
```

**Key points**:
- Use `LazyVStack`, `LazyHStack`, `LazyVGrid` for large collections
- Cache parsed JSON, decoded data, computed results
- Move expensive operations out of frequently-called methods

---

### Pattern 4: Location Efficiency

**Problem**: Continuous location updates keep GPS active, draining battery rapidly.

#### ❌ Anti-Pattern — Continuous high-accuracy updates
```swift
// BAD: Continuous updates with best accuracy
// GPS stays active constantly, massive battery drain
let locationManager = CLLocationManager()
locationManager.desiredAccuracy = kCLLocationAccuracyBest
locationManager.startUpdatingLocation()  // Never stops!
```

#### ✅ Fix — Appropriate accuracy and significant-change
```swift
// GOOD: Reduced accuracy, significant-change monitoring
let locationManager = CLLocationManager()

// Use appropriate accuracy (100m is fine for most apps)
locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters

// Use distance filter to reduce updates
locationManager.distanceFilter = 100  // Only update every 100 meters

// For background: Use significant-change monitoring
locationManager.startMonitoringSignificantLocationChanges()

// Stop when done
func stopTracking() {
    locationManager.stopUpdatingLocation()
    locationManager.stopMonitoringSignificantLocationChanges()
}
```

#### ✅ Better — iOS 26+ CLLocationUpdate with stationary detection
```swift
// BEST: Modern async API with automatic stationary detection
for try await update in CLLocationUpdate.liveUpdates() {
    if update.stationary {
        // Device stopped moving — system pauses updates automatically
        // Switch to CLMonitor for region monitoring
        break
    }
    handleLocation(update.location)
}
```

**Accuracy comparison (battery impact)**:
| Accuracy | Battery Impact | Use Case |
|----------|---------------|----------|
| `kCLLocationAccuracyBest` | Very High | Navigation apps only |
| `kCLLocationAccuracyNearestTenMeters` | High | Fitness tracking |
| `kCLLocationAccuracyHundredMeters` | Medium | Store locators |
| `kCLLocationAccuracyKilometer` | Low | Weather apps |
| Significant-change | Very Low | Background updates |

---

### Pattern 5: Background Execution (EMRCA)

**Problem**: Background tasks that run too long or too often drain battery.

#### EMRCA Principles (from WWDC25-227)

Your background work must be:
- **E**fficient — Design lightweight, purpose-driven tasks
- **M**inimal — Keep background work to a minimum
- **R**esilient — Save incremental progress; respond to expiration signals
- **C**ourteous — Honor user preferences and system conditions
- **A**daptive — Understand and adapt to system priorities

#### ❌ Anti-Pattern — Long-running background task
```swift
// BAD: Requests unlimited background time
// System will terminate after ~30 seconds anyway
var backgroundTask: UIBackgroundTaskIdentifier = .invalid

func applicationDidEnterBackground(_ application: UIApplication) {
    backgroundTask = application.beginBackgroundTask {
        // Expiration handler — but task runs too long
    }

    // Long operation that may not complete
    performLongOperation()
}
```

#### ✅ Fix — Proper background task handling
```swift
// GOOD: Finish quickly, save progress, notify system
var backgroundTask: UIBackgroundTaskIdentifier = .invalid

func applicationDidEnterBackground(_ application: UIApplication) {
    backgroundTask = application.beginBackgroundTask(withName: "Save State") { [weak self] in
        // Expiration handler — clean up immediately
        self?.saveProgress()
        if let task = self?.backgroundTask {
            application.endBackgroundTask(task)
        }
        self?.backgroundTask = .invalid
    }

    // Quick operation
    saveEssentialState()

    // End task as soon as done — don't wait for expiration
    application.endBackgroundTask(backgroundTask)
    backgroundTask = .invalid
}
```

#### ✅ For Long Operations — Use BGProcessingTask
```swift
// BEST: Let system schedule at optimal time (charging, WiFi)
func scheduleBackgroundProcessing() {
    let request = BGProcessingTaskRequest(identifier: "com.app.maintenance")
    request.requiresNetworkConnectivity = true
    request.requiresExternalPower = true  // Only when charging

    try? BGTaskScheduler.shared.submit(request)
}

// Register handler at app launch
BGTaskScheduler.shared.register(
    forTaskWithIdentifier: "com.app.maintenance",
    using: nil
) { task in
    self.handleMaintenance(task: task as! BGProcessingTask)
}
```

#### ✅ iOS 26+ — BGContinuedProcessingTask for user-initiated work
```swift
// NEW iOS 26: Continue user-initiated tasks with progress UI
let request = BGContinuedProcessingTaskRequest(
    identifier: "com.app.export",
    title: "Exporting Photos",
    subtitle: "23 of 100 photos"
)

try? BGTaskScheduler.shared.submit(request)
```

---

### Pattern 6: Frame Rate Auditing

**Problem**: Secondary animations running at higher frame rates than needed increase GPU power.

#### ❌ Anti-Pattern — Uncontrolled frame rates
```swift
// BAD: Secondary animation runs at 60fps
// When primary content only needs 30fps, this wastes power
UIView.animate(withDuration: 2.0, delay: 0, options: [.repeat]) {
    self.subtitleLabel.alpha = 0.5
} completion: { _ in
    self.subtitleLabel.alpha = 1.0
}
```

#### ✅ Fix — Control frame rate with CADisplayLink
```swift
// GOOD: Explicitly set preferred frame rate
let displayLink = CADisplayLink(target: self, selector: #selector(updateAnimation))
displayLink.preferredFrameRateRange = CAFrameRateRange(
    minimum: 10,
    maximum: 30,  // Match primary content
    preferred: 30
)
displayLink.add(to: .current, forMode: .default)
```

**From WWDC22-10083**: Up to **20% battery savings** by aligning secondary animation frame rates with primary content.

---

## Audit Checklists

### Timer Audit
- [ ] All timers have tolerance set (≥10% of interval)?
- [ ] Timers invalidated when no longer needed?
- [ ] Using Combine Timer instead of NSTimer where possible?
- [ ] No polling patterns that could use push notifications?
- [ ] Timers stopped when app enters background?

### Network Audit
- [ ] Requests batched instead of many small requests?
- [ ] Using discretionary URLSession for non-urgent downloads?
- [ ] `waitsForConnectivity` set to avoid failed connection attempts?
- [ ] `allowsExpensiveNetworkAccess` set to false for deferrable work?
- [ ] Push notifications instead of polling?

### Location Audit
- [ ] Using appropriate accuracy (not `kCLLocationAccuracyBest` unless navigation)?
- [ ] `distanceFilter` set to reduce update frequency?
- [ ] Stopping updates when no longer needed?
- [ ] Using significant-change for background updates?
- [ ] Background location justified and explained to users?

### Background Execution Audit
- [ ] `endBackgroundTask` called promptly when work completes?
- [ ] Long operations use `BGProcessingTask` with `requiresExternalPower`?
- [ ] Background modes in Info.plist limited to what's actually needed?
- [ ] Audio session deactivated when not playing?
- [ ] EMRCA principles followed?

### Display/GPU Audit
- [ ] Dark Mode supported (70% OLED power savings)?
- [ ] Animations stopped when view not visible?
- [ ] Secondary animations use appropriate frame rates?
- [ ] Blur effects minimized or removed?
- [ ] Metal rendering has frame limiting?

### Disk I/O Audit
- [ ] Writes batched instead of frequent small writes?
- [ ] SQLite using WAL journaling mode?
- [ ] Avoiding rapid file creation/deletion?
- [ ] Using SwiftData/Core Data instead of serialized files for frequent updates?

---

## Pressure Scenarios

### Scenario 1: "Just poll every 5 seconds for real-time updates"

**The temptation**: "Push notifications are complex. Polling is simpler."

**The reality**:
- Polling every 5 seconds: Radio active **100% of time**
- Push notifications: Radio active **only when data changes**
- Users WILL see your app at top of Battery Settings
- App Store reviews WILL mention "battery hog"

**Time cost comparison**:
- Implement polling: 30 minutes
- Implement push: 2-4 hours
- Fix bad reviews + reputation damage: Weeks

**Pushback template**: "Push notification setup takes a few hours, but polling will guarantee we're at the top of Battery Settings. Users actively uninstall apps that drain battery. The 2-hour investment prevents ongoing reputation damage."

---

### Scenario 2: "Use continuous location for best accuracy"

**The temptation**: "Users expect accurate location. Let's use `kCLLocationAccuracyBest`."

**The reality**:
- `kCLLocationAccuracyBest`: GPS + WiFi + Cellular triangulation = **massive drain**
- `kCLLocationAccuracyHundredMeters`: Good enough for 95% of use cases
- Location icon in status bar = users checking Battery Settings

**Time cost comparison**:
- Implement high accuracy: 10 minutes
- Debug "why does my app drain battery" complaints: Hours
- Refactor to appropriate accuracy: 30 minutes

**Pushback template**: "100-meter accuracy is sufficient for [use case]. Navigation apps like Google Maps need best accuracy, but we're showing [store locations / weather / general area]. The accuracy difference is imperceptible to users, but battery difference is massive."

---

### Scenario 3: "Keep animations running, users expect smooth UI"

**The temptation**: "Animations make the app feel alive and polished."

**The reality**:
- Animations running when view not visible = pure waste
- High frame rate secondary animations = GPU drain
- GPU power is significant portion of total device power

**Time cost comparison**:
- Add animation: 15 minutes
- Add visibility checks: 5 minutes extra
- Debug "phone gets hot" reports: Hours

**Pushback template**: "We can keep the animation, but should pause it when the view isn't visible. This is a 5-minute change that prevents GPU drain when users aren't looking at the screen."

---

### Scenario 4: "Ship now, optimize later"

**The temptation**: "Energy optimization is polish. We can do it in v1.1."

**The reality**:
- Battery drain is **immediately visible** to users
- First impressions drive reviews
- "Battery hog" reputation is hard to shake
- Power Profiler baseline takes **15 minutes**

**Time cost comparison**:
- Power Profiler check before launch: 15 minutes
- Fix energy issues post-launch: Days (plus reputation damage)
- Regain user trust: Months

**Pushback template**: "A 15-minute Power Profiler session before launch catches major energy issues. If we ship with battery problems, users will see us at top of Battery Settings on day one and leave 1-star reviews. Let me do a quick check — it's faster than damage control."

---

## Real-World Examples

### Example 1: Video Streaming App with Eager Loading (WWDC25-226)

**Symptom**: CPU power impact jumped from 1 to 21 when opening Library pane. UI hung.

**Diagnosis using Power Profiler**:
1. Recorded trace while opening Library pane
2. CPU Power Impact lane showed massive spike
3. Time Profiler showed `VideoCardView` body called hundreds of times
4. Root cause: `VStack` creating ALL video thumbnails upfront

**Fix**:
```swift
// Before: VStack (eager)
VStack {
    ForEach(videos) { video in
        VideoCardView(video: video)
    }
}

// After: LazyVStack (on-demand)
LazyVStack {
    ForEach(videos) { video in
        VideoCardView(video: video)
    }
}
```

**Result**: CPU power impact dropped from 21 to 4.3. UI no longer hung.

---

### Example 2: Location-Based Suggestions with Repeated Parsing (WWDC25-226)

**Symptom**: User commuting reported massive battery drain. Developer couldn't reproduce at desk.

**Diagnosis using on-device Power Profiler**:
1. User collected trace during commute (Settings → Developer → Performance Trace)
2. Trace showed periodic CPU spikes correlating with movement
3. Time Profiler showed `videoSuggestionsForLocation` consuming CPU
4. Root cause: JSON file parsed on EVERY location update

**Fix**:
```swift
// Before: Parse on every call
func videoSuggestionsForLocation(_ location: CLLocation) -> [Video] {
    let data = try? Data(contentsOf: rulesFileURL)
    let rules = try? JSONDecoder().decode([RecommendationRule].self, from: data)
    return filteredVideos(using: rules)
}

// After: Parse once, cache
private lazy var cachedRules: [RecommendationRule] = {
    let data = try? Data(contentsOf: rulesFileURL)
    return (try? JSONDecoder().decode([RecommendationRule].self, from: data)) ?? []
}()

func videoSuggestionsForLocation(_ location: CLLocation) -> [Video] {
    return filteredVideos(using: cachedRules)
}
```

**Result**: Eliminated CPU spikes during movement. Battery drain resolved.

---

### Example 3: Music App with Always-Active Audio Session

**Symptom**: App drains battery even when not playing music.

**Diagnosis**:
1. Power Profiler showed sustained background CPU activity
2. Audio session remained active after playback stopped
3. System kept audio hardware powered on

**Fix**:
```swift
// Before: Never deactivate
func playTrack(_ track: Track) {
    try? AVAudioSession.sharedInstance().setActive(true)
    player.play()
}

func stopPlayback() {
    player.stop()
    // Audio session still active!
}

// After: Deactivate when done
func stopPlayback() {
    player.stop()
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
}

// Even better: Use AVAudioEngine auto-shutdown
let engine = AVAudioEngine()
engine.isAutoShutdownEnabled = true  // Automatically powers down when idle
```

**Result**: Background audio hardware powered down. Battery drain eliminated.

---

## Responding to Low Power Mode

Detect and adapt when user enables Low Power Mode:

```swift
// Check current state
if ProcessInfo.processInfo.isLowPowerModeEnabled {
    reduceEnergyUsage()
}

// React to changes
NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)
    .sink { [weak self] _ in
        if ProcessInfo.processInfo.isLowPowerModeEnabled {
            self?.reduceEnergyUsage()
        } else {
            self?.restoreNormalOperation()
        }
    }
    .store(in: &cancellables)

func reduceEnergyUsage() {
    // Pause optional activities
    // Reduce animation frame rates
    // Increase timer intervals
    // Defer network requests
    // Stop location updates if not critical
}
```

---

## Monitoring Energy in Production

### MetricKit Setup

```swift
import MetricKit

class EnergyMetricsManager: NSObject, MXMetricManagerSubscriber {
    static let shared = EnergyMetricsManager()

    func startMonitoring() {
        MXMetricManager.shared.add(self)
    }

    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            if let cpuMetrics = payload.cpuMetrics {
                // Monitor CPU time
                let foregroundCPU = cpuMetrics.cumulativeCPUTime
                logMetric("foreground_cpu", value: foregroundCPU)
            }

            if let locationMetrics = payload.locationActivityMetrics {
                // Monitor location usage
                let backgroundLocation = locationMetrics.cumulativeBackgroundLocationTime
                logMetric("background_location", value: backgroundLocation)
            }
        }
    }
}
```

### Xcode Organizer

Check **Battery Usage** pane in Xcode Organizer for field data:
- Foreground vs background energy breakdown
- Category breakdown (Audio, Networking, Processing, Display, etc.)
- Version comparison to detect regressions

---

## Quick Reference

### Power Profiler Workflow
```
1. Connect device wirelessly
2. Product → Profile → Blank → Add Power Profiler
3. Record 2-3 minutes of usage
4. Identify dominant subsystem (CPU/GPU/Network/Display)
5. Apply targeted fix from patterns above
6. Record again to verify improvement
```

### Key Energy Savings
| Optimization | Potential Savings |
|--------------|------------------|
| Dark Mode on OLED | Up to 70% display power |
| Frame rate alignment | Up to 20% GPU power |
| Push vs poll | 100x network efficiency |
| Location accuracy reduction | 50-90% GPS power |
| Timer tolerance | Significant CPU savings |
| Lazy loading | Eliminates startup CPU spikes |

### Related Skills
- `axiom-energy-ref` — Complete API reference with all code examples
- `axiom-energy-diag` — Symptom-based troubleshooting decision trees
- `axiom-background-processing` — Background task mechanics (why tasks don't run)
- `axiom-performance-profiling` — General Instruments workflows
- `axiom-memory-debugging` — Memory leak diagnosis (often related to energy)
- `axiom-networking` — Network optimization patterns

---

## WWDC Sessions

- **WWDC25-226** "Profile and optimize power usage in your app" — Power Profiler workflow
- **WWDC25-227** "Finish tasks in the background" — BGContinuedProcessingTask, EMRCA
- **WWDC22-10083** "Power down: Improve battery consumption" — Dark Mode, frame rates, deferral
- **WWDC20-10095** "The Push Notifications primer" — Push vs poll
- **WWDC19-417** "Improving Battery Life and Performance" — MetricKit

---

**Last Updated**: 2025-12-26
**Platforms**: iOS 26+, iPadOS 26+
**Status**: Production-ready energy optimization patterns
