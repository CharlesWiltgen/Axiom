---
name: energy
description: Use when app drains battery, device gets hot, or you need to optimize energy consumption — Power Profiler workflows, subsystem diagnosis (CPU/GPU/Network/Location/Display), anti-pattern fixes, and background execution optimization
version: 1.0.0
last_updated: Complete skill suite based on 15+ Apple sources including WWDC25-226, WWDC25-227, WWDC22-10083, and Apple Energy Efficiency Guides
---

# Energy Optimization

## Overview

iOS energy problems fall into distinct subsystem categories: CPU, GPU, Network, Location, Display, and Background. This skill helps you **identify the dominant subsystem**, **fix anti-patterns**, and **verify improvements** using Power Profiler.

**Core principle**: Measure before optimizing. Use Power Profiler to identify which subsystem dominates, then apply targeted fixes.

**Requires**: iOS 26+, Xcode 26+
**Related skills**: `energy-ref` (complete API reference), `energy-diag` (symptom-based troubleshooting)

## When to Use Energy Optimization

#### Use this skill when
- App appears at top of Battery Settings
- Device gets hot during normal use
- Users report battery drain in reviews
- Xcode Energy Gauge shows sustained high impact
- Background runtime exceeds expectations
- Preparing for App Store release

#### Use `energy-diag` instead when
- You have a specific symptom ("phone gets hot", "background drain")
- You want decision trees with time-cost analysis

#### Use `energy-ref` instead when
- You need complete code examples from WWDC
- You want API reference for timers, network, location
- You're implementing from scratch

## Energy Decision Tree

Before optimizing, identify which subsystem dominates.

### Step 1: Run Power Profiler Baseline (5 min)

```bash
# Open Instruments
open -a Instruments
# Select "Power Profiler" template
# Record for 2-3 minutes of typical app usage
```

### Step 2: Identify Dominant Subsystem

Look at the 5 power impact lanes:
- **CPU** — Computation, timers, parsing
- **GPU** — Animations, blur effects, rendering
- **Network** — API calls, downloads, polling
- **Location** — GPS, significant-change monitoring
- **Display** — Screen brightness, light backgrounds

### Step 3: Branch to Subsystem

```
Power Profiler shows high impact in:
├─ CPU lane?
│  ├─ Continuous processing → Timer leak or polling loop
│  ├─ Spikes during actions → Eager loading or repeated parsing
│  └─ Background CPU → BGTasks running too long
│
├─ GPU lane?
│  ├─ Animations running → Check visibility, frame rate
│  ├─ Blur effects → Over dynamic content
│  └─ Shadows/masks → Complex compositing
│
├─ Network lane?
│  ├─ Frequent activity → Polling instead of push
│  ├─ Many small requests → Batching issue
│  └─ Background network → Missing discretionary flag
│
├─ Location lane?
│  ├─ Continuous updates → Not using significant-change
│  ├─ High accuracy → kCLLocationAccuracyBest when not needed
│  └─ Background location → Evaluate if truly required
│
└─ Display lane?
   └─ High display power → Light backgrounds on OLED
      └─ Implement Dark Mode (up to 70% OLED savings)
```

## Common Anti-Patterns

### Pattern 1: Timer Without Tolerance (CRITICAL)

```swift
// ❌ WRONG: No tolerance, prevents CPU coalescing
let timer = Timer.scheduledTimer(
    timeInterval: 5.0,
    target: self,
    selector: #selector(refresh),
    userInfo: nil,
    repeats: true
)

// ✅ RIGHT: 10% tolerance minimum
let timer = Timer.scheduledTimer(
    timeInterval: 5.0,
    target: self,
    selector: #selector(refresh),
    userInfo: nil,
    repeats: true
)
timer.tolerance = 0.5  // 10% tolerance
```

**Why**: Without tolerance, system can't coalesce wake-ups with other timers.

### Pattern 2: Polling Instead of Push (CRITICAL)

```swift
// ❌ WRONG: Polling keeps network radio active
Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
    self.fetchLatestData()
}

// ✅ RIGHT: Push notifications, system schedules wake-up
func application(_ application: UIApplication,
                 didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                 fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    fetchLatestData()
    completionHandler(.newData)
}
```

**Why**: Cellular radio costs 50mW+ to power up, stays active for "tail time."

### Pattern 3: Continuous Location (CRITICAL)

```swift
// ❌ WRONG: GPS active continuously
locationManager.desiredAccuracy = kCLLocationAccuracyBest
locationManager.startUpdatingLocation()

// ✅ RIGHT: Significant-change monitoring
locationManager.startMonitoringSignificantLocationChanges()

// Or stop when done
locationManager.stopUpdatingLocation()
```

**Why**: GPS is 50mW+ active, one of the most power-hungry sensors.

### Pattern 4: Animation Not Stopped (HIGH)

```swift
// ❌ WRONG: Animation runs even when view not visible
struct AnimatedView: View {
    @State private var isAnimating = true

    var body: some View {
        Circle()
            .scaleEffect(isAnimating ? 1.0 : 0.5)
            .animation(.easeInOut.repeatForever(), value: isAnimating)
    }
}

// ✅ RIGHT: Stop animation when not visible
struct AnimatedView: View {
    @State private var isAnimating = false

    var body: some View {
        Circle()
            .scaleEffect(isAnimating ? 1.0 : 0.5)
            .animation(.easeInOut.repeatForever(), value: isAnimating)
            .onAppear { isAnimating = true }
            .onDisappear { isAnimating = false }
    }
}
```

### Pattern 5: Audio Session Always Active (HIGH)

```swift
// ❌ WRONG: Audio session never deactivated
try AVAudioSession.sharedInstance().setActive(true)
player.play()
// ... never calls setActive(false)

// ✅ RIGHT: Deactivate when not playing
func stop() {
    player?.stop()
    try? AVAudioSession.sharedInstance().setActive(false,
        options: .notifyOthersOnDeactivation)
}
```

### Pattern 6: Network Without Efficiency Settings (MEDIUM)

```swift
// ❌ WRONG: Default settings, uses cellular freely
let session = URLSession.shared

// ✅ RIGHT: Configure for efficiency
let config = URLSessionConfiguration.default
config.allowsExpensiveNetworkAccess = false  // Prefer WiFi
config.waitsForConnectivity = true  // Don't fail on poor connection
let session = URLSession(configuration: config)
```

## Audit Checklists

### Timer Audit

- [ ] All timers have tolerance ≥ 10%
- [ ] Repeating timers have `invalidate()` in deinit/onDisappear
- [ ] Timer.publish uses `.tolerance()` modifier
- [ ] No timers under 1-second interval unless truly needed
- [ ] Consider dispatch source for <1s intervals

### Network Audit

- [ ] No polling patterns (use push notifications)
- [ ] Discretionary flag for background downloads
- [ ] `allowsExpensiveNetworkAccess = false` for non-urgent
- [ ] `waitsForConnectivity = true` to avoid retries
- [ ] Low Data Mode handled (`isLowDataModeEnabled`)
- [ ] Requests batched where possible

### Location Audit

- [ ] Significant-change monitoring used when appropriate
- [ ] Accuracy reduced when high precision not needed
- [ ] `stopUpdatingLocation()` called when done
- [ ] Background location truly required
- [ ] `pausesLocationUpdatesAutomatically = true` set

### Background Audit

- [ ] Unused background modes removed from Info.plist
- [ ] `setTaskCompleted(success:)` always called
- [ ] `expirationHandler` implemented for BGTasks
- [ ] Audio session deactivated when not playing
- [ ] `requiresExternalPower = true` for non-urgent processing

### Display/GPU Audit

- [ ] Dark Mode implemented (70% OLED savings)
- [ ] Blur effects over static content only
- [ ] Animations stop in onDisappear/viewWillDisappear
- [ ] CADisplayLink uses `preferredFrameRateRange`
- [ ] `drawingGroup()` used for complex view hierarchies

## Pressure Scenarios

### Scenario 1: "Just poll every 5 seconds for real-time updates"

**The temptation**: "Push notifications are complicated, polling is simpler"

**The reality**:
- Polling every 5 seconds = 12 wake-ups/minute × 60 min = 720 wake-ups/hour
- Each wake-up powers radio (50mW+) for 2-10 seconds
- Result: 15-40% battery drain per hour from polling alone

**What to do instead**:

1. **Use push notifications** (10-30 min setup)
   - Server sends notification when data changes
   - App wakes only when needed
   - No continuous polling

2. **If push not possible**, use discretionary:
   ```swift
   let config = URLSessionConfiguration.background(withIdentifier: "com.app.sync")
   config.isDiscretionary = true  // System decides when to run
   ```

**Time cost**: 30 min (push setup) vs 15-40%/hour battery penalty (polling)

### Scenario 2: "Use continuous location for best accuracy"

**The temptation**: "Users need precise location"

**The reality**:
- GPS: 50mW+ active continuously
- Most apps need: "Is user near store X?" not "User is at 37.7749°N 122.4194°W"
- Significant-change: 90%+ power savings, still usable accuracy

**What to do instead**:

1. **Use significant-change monitoring**:
   ```swift
   locationManager.startMonitoringSignificantLocationChanges()
   ```

2. **If high accuracy truly needed**, limit duration:
   ```swift
   // High accuracy only when user actively using location feature
   locationManager.desiredAccuracy = kCLLocationAccuracyBest
   locationManager.startUpdatingLocation()

   // Stop after getting fix
   DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
       locationManager.stopUpdatingLocation()
   }
   ```

**Time cost**: 5 min (change API) vs 20-50% battery penalty

### Scenario 3: "Ship now, optimize later"

**The temptation**: "We can fix battery in next release"

**The reality**:
- Users see battery drain immediately
- 1-star reviews mention battery in first week
- App Store reviews persist, hard to recover reputation
- Fix takes same time now vs later

**What to do instead**:

1. **Run Power Profiler** (15 min)
   - Record 3 min of typical usage
   - Identify dominant subsystem

2. **Fix critical patterns** (30 min)
   - Timer tolerance
   - Location accuracy
   - Audio session

3. **Ship with confidence**

**Time cost**: 45 min (audit + quick fixes) vs bad reviews + emergency hotfix

## Testing and Verification

### On-Device Power Profiler (iOS 26+)

```
Settings → Developer → Power Profiler → Record
```

Captures real-world power usage without Xcode tethering.

### MetricKit Integration

```swift
import MetricKit

class MetricsManager: NSObject, MXMetricManagerSubscriber {
    func receiveReports(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            // Battery metrics
            if let cpuMetrics = payload.cpuMetrics {
                print("CPU time: \(cpuMetrics.cumulativeCPUTime)")
            }
            if let cellularMetrics = payload.cellularConditionMetrics {
                print("Cellular: \(cellularMetrics)")
            }
        }
    }
}
```

### Quick Verification

```swift
// 30-second baseline test
1. Launch app, leave idle 30 seconds
2. Check CPU lane in Power Profiler
3. Should be minimal (near zero)
4. If spikes: timer running, polling, or animation leak
```

## External Resources

#### WWDC Sessions
- [WWDC 2025-226: Analyze app power and performance with Power Profiler](https://developer.apple.com/videos/play/wwdc2025/226/)
- [WWDC 2025-227: Keep your app running efficiently in the background](https://developer.apple.com/videos/play/wwdc2025/227/)
- [WWDC 2022-10083: Power down: Improve battery consumption](https://developer.apple.com/videos/play/wwdc2022/10083/)

#### Apple Documentation
- [Energy Efficiency Guide for iOS Apps](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/)
- [Power Profiler Documentation](https://developer.apple.com/documentation/xcode/gathering-information-about-your-app-s-power-consumption)

#### Related Axiom Skills
- `energy-ref` — Complete API reference with WWDC code examples
- `energy-diag` — Symptom-based diagnostic decision trees
- `performance-profiling` — Time Profiler, Allocations, Core Data profiling

---

## Version History

- **1.0.0**: Initial skill based on WWDC 2025-226, WWDC 2025-227, WWDC 2022-10083, and Apple Energy Efficiency Guides. Covers Power Profiler workflow, 6 common anti-patterns, 5 audit checklists, 3 pressure scenarios, testing/verification, and on-device profiling for iOS 26+.

---

**Created** 2025-12-26
**Targets** iOS 26+, Swift 6
**Framework** Power Profiler, MetricKit, URLSession, CoreLocation, BGTaskScheduler
