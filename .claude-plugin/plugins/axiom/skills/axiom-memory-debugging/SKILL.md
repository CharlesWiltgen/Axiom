---
name: axiom-memory-debugging
description: Use when you see memory warnings, 'retain cycle', app crashes from memory pressure, or when asking 'why is my app using so much memory', 'how do I find memory leaks', 'my deinit is never called', 'Instruments shows memory growth', 'app crashes after 10 minutes' - systematic memory leak detection and fixes for iOS/macOS
license: MIT
metadata:
  version: "1.0.0"
---

# Memory Debugging

## Overview

Memory issues manifest as crashes after prolonged use. **Core principle** 90% of memory leaks follow 3 patterns (retain cycles, timer/observer leaks, collection growth). Diagnose systematically with Instruments, never guess.

## Example Prompts

- "My app crashes after 10-15 minutes with no error messages"
- "Memory jumps from 50MB to 200MB+ on a specific action — leak or cache?"
- "View controllers don't deallocate after dismiss"
- "Timers/observers causing memory leaks — how to verify?"
- "App uses 200MB and I don't know if that's normal"

---

## Red Flags — Memory Leak Likely

- Progressive memory growth: 50MB → 100MB → 200MB (not plateauing)
- App crashes after 10-15 minutes with no error in Xcode console
- Memory warnings appear repeatedly in device logs
- View controllers don't deallocate after dismiss (visible in Memory Graph Debugger)
- Same operation run multiple times causes linear memory growth

**Leak vs normal**: Normal = stays at 100MB. Leak = 50MB → 100MB → 150MB → 200MB → CRASH.

## Mandatory First Steps

**ALWAYS diagnose FIRST** (before reading code):

1. Check device logs for "Memory pressure critical", "Jetsam killed", "Low Memory"
2. Use Memory Graph Debugger (below) — shows object count growth
3. Xcode → Product → Profile → Memory. Perform action 5 times, note if memory keeps growing

**What this tells you**: Flat = not a leak. Linear growth = classic leak. Spike then flat = normal cache. Spikes stacking = compound leak.

**Why diagnostics first**: Finding leak with Instruments: 5-15 min. Guessing: 45+ min.

## Detecting Leaks — Step by Step

### Step 1: Memory Graph Debugger (Fastest)

1. Open app in simulator
2. Debug → Memory Graph Debugger (or toolbar icon)
3. Look for PURPLE/RED circles with "⚠" badge
4. Click them → Xcode shows retain cycle chain

### Step 2: Instruments (Detailed Analysis)

1. Product → Profile (Cmd+I) → "Memory" template
2. Perform action 5-10 times
3. Memory line goes UP for each action? = Leak confirmed

Key instruments: Heap Allocations (object count), Leaked Objects (direct detection), VM Tracker (by type).

### Step 3: Deallocation Check

```swift
// Add deinit logging to suspect classes
class MyViewController: UIViewController {
    deinit { print("✅ MyViewController deallocated") }
}

@MainActor
class ViewModel: ObservableObject {
    deinit { print("✅ ViewModel deallocated") }
}
```

Navigate to view, navigate away. See "✅ deallocated"? Yes = no leak. No = retained somewhere.

## Jetsam (Memory Pressure Termination)

**Jetsam is not a bug** — iOS terminates background apps to free memory. Not a crash (no crash log), but frequent kills hurt UX.

| Termination | Cause | Solution |
|-------------|-------|----------|
| **Memory Limit Exceeded** | Your app used too much memory | Reduce peak footprint |
| **Jetsam** | System needed memory for other apps | Reduce background memory to <50MB |

### Reducing Jetsam Rate

Clear caches on backgrounding:

```swift
// SwiftUI
.onChange(of: scenePhase) { _, newPhase in
    if newPhase == .background {
        imageCache.clearAll()
        URLCache.shared.removeAllCachedResponses()
    }
}
```

### State Restoration

Users shouldn't notice jetsam. Use `@SceneStorage` (SwiftUI) or `stateRestorationActivity` (UIKit) to restore navigation position, drafts, and scroll position.

### Monitoring with MetricKit

```swift
class JetsamMonitor: NSObject, MXMetricManagerSubscriber {
    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            guard let exitData = payload.applicationExitMetrics else { continue }
            let bgData = exitData.backgroundExitData
            if bgData.cumulativeMemoryPressureExitCount > 0 {
                // Send to analytics
            }
        }
    }
}
```

```
App memory grows while in USE? → Memory leak (fix retention)
App killed in BACKGROUND? → Jetsam (reduce bg memory)
```

## Common Memory Leak Patterns (With Fixes)

### Pattern 1: Timer Leaks (Most Common — 50% of leaks)

**Why `[weak self]` alone doesn't fix timer leaks**: The RunLoop retains scheduled timers. `[weak self]` only prevents the closure from retaining `self` — the Timer object itself continues to exist and fire. You must explicitly `invalidate()` to break the RunLoop's retention.

#### ❌ Leak — Timer never invalidated
```swift
progressTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
    self?.updateProgress()
}
// Timer never stopped → RunLoop keeps it alive and firing forever
```

#### ✅ Best fix: Combine (auto-cleanup)
```swift
cancellable = Timer.publish(every: 1.0, tolerance: 0.1, on: .main, in: .default)
    .autoconnect()
    .sink { [weak self] _ in self?.updateProgress() }
// No deinit needed — cancellable auto-cleans when released
```

**Alternative**: Call `timer?.invalidate(); timer = nil` in both the appropriate teardown method (`viewWillDisappear`, stop method, etc.) AND `deinit`.

### Pattern 2: Observer/Notification Leaks (25% of leaks)

#### ❌ Leak — No removeObserver
```swift
NotificationCenter.default.addObserver(self, selector: #selector(handle),
    name: AVAudioSession.routeChangeNotification, object: nil)
// No matching removeObserver → accumulates listeners
```

#### ✅ Best fix: Combine publisher
```swift
NotificationCenter.default.publisher(for: AVAudioSession.routeChangeNotification)
    .sink { [weak self] _ in self?.handleChange() }
    .store(in: &cancellables)  // Auto-cleanup with viewModel
```

**Alternative**: `NotificationCenter.default.removeObserver(self)` in `deinit`.

### Pattern 3: Closure Capture Leaks (15% of leaks)

#### ❌ Leak — Closure in array captures self
```swift
updateCallbacks.append { [self] track in
    self.refreshUI(with: track)  // Strong capture → cycle
}
```

#### ✅ Fix: Use [weak self]
```swift
updateCallbacks.append { [weak self] track in
    self?.refreshUI(with: track)
}
```

Clear callback arrays in `deinit`. Use `[unowned self]` only when certain self outlives the closure.

### Pattern 4: Strong Reference Cycles

#### ❌ Leak — Mutual strong references
```swift
player?.onPlaybackEnd = { [self] in self.playNextTrack() }
// self → player → closure → self (cycle)
```

#### ✅ Fix: [weak self] in closure
```swift
player?.onPlaybackEnd = { [weak self] in self?.playNextTrack() }
```

### Pattern 5: View/Layout Callback Leaks

Use the delegation pattern with `AnyObject` protocol (enables weak references) instead of closures that capture view controllers.

### Pattern 6: PhotoKit Image Request Leaks

`PHImageManager.requestImage()` returns a `PHImageRequestID` that must be cancelled. Without cancellation, pending requests queue up and hold memory when scrolling.

```swift
class PhotoCell: UICollectionViewCell {
    private var imageRequestID: PHImageRequestID = PHInvalidImageRequestID

    func configure(with asset: PHAsset, imageManager: PHImageManager) {
        if imageRequestID != PHInvalidImageRequestID {
            imageManager.cancelImageRequest(imageRequestID)
        }
        imageRequestID = imageManager.requestImage(for: asset, targetSize: PHImageManagerMaximumSize,
            contentMode: .aspectFill, options: nil) { [weak self] image, _ in
            self?.imageView.image = image
        }
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        if imageRequestID != PHInvalidImageRequestID {
            PHImageManager.default().cancelImageRequest(imageRequestID)
            imageRequestID = PHInvalidImageRequestID
        }
        imageView.image = nil
    }
}
```

Similar patterns: `AVAssetImageGenerator` → `cancelAllCGImageGeneration()`, `URLSession.dataTask()` → `cancel()`.

## Systematic Debugging Workflow

### Phase 1: Confirm Leak (5 min)

Profile with Memory template, repeat action 10 times. Flat = not a leak (stop). Steady climb = leak (continue).

### Phase 2: Locate Leak (10-15 min)

Memory Graph Debugger → purple/red circles → click → read retain cycle chain.

Common locations: Timers (50%), Notifications/KVO (25%), Closures in collections (15%), Delegate cycles (10%).

### Phase 3: Fix and Verify (5 min)

Apply fix from patterns above. Add `deinit { print("✅ deallocated") }`. Run Instruments again — memory should stay flat.

### Compound Leaks

Real apps often have 2-3 leaks stacking. Fix the largest first, re-run Instruments, repeat until flat.

## Non-Reproducible / Intermittent Leaks

When Instruments prevents reproduction (Heisenbug) or leaks only happen with specific user data:

**Lightweight diagnostics** (when Instruments can't be attached):
1. **deinit logging as primary diagnostic** — Add `deinit { print("✅ ClassName deallocated") }` to all suspect classes. Run 20+ sessions. When the leak occurs (e.g., 1 in 5 runs), missing deinit messages reveal which objects are retained.
2. **Isolate the trigger** — Test each navigation path independently. Rapidly toggle background/foreground if timing-dependent. Narrow to the specific path that leaks.
3. **MetricKit for field diagnostics** — Monitor peak memory in production via `MXMetricPayload.memoryMetrics.peakMemoryUsage`. Alert when exceeding threshold (e.g., 400MB). This catches leaks that only manifest with real user data volumes.

**Common cause of intermittent leaks**: Notification observers added on lifecycle events (`viewWillAppear`, `applicationDidBecomeActive`) without removing duplicates first. Each re-registration accumulates a listener — timing determines whether the duplicate fires.

**TestFlight verification**: Ship diagnostic build to affected users. Add `os_log` memory milestones. Monitor MetricKit for 24-48 hours after fix deployment.

## Common Mistakes

- **[weak self] without invalidate()** — Timer keeps running, consuming CPU. ALWAYS call `invalidate()` or `cancel()`
- **Invalidate without nil** — `timer?.invalidate()` stops firing but reference remains. Always follow with `timer = nil`
- **Local AnyCancellable** — Goes out of scope immediately, subscription dies. Store in `Set<AnyCancellable>` property
- **deinit with only logging** — Add actual cleanup (invalidate timers, remove observers), not just print statements
- **Wrong Instruments template** — Memory shows usage. Leaks detects actual leaks. Use both

## Instruments Quick Reference

| Scenario | Tool | What to Look For |
|----------|------|------------------|
| Progressive memory growth | Memory | Line steadily climbing = leak |
| Specific object leaking | Memory Graph | Purple/red circles = leak objects |
| Direct leak detection | Leaks | Red "! Leak" badge = confirmed leak |
| Memory by type | VM Tracker | Objects consuming most memory |
| Cache behavior | Allocations | Objects allocated but not freed |

## Command Line Tools

```bash
xcrun xctrace record --template "Memory" --output memory.trace
xcrun xctrace dump memory.trace
leaks -atExit -excludeNoise YourApp
```

## Real-World Impact

**Before**: 50+ PlayerViewModel instances with uncleared timers → 50MB → 200MB → Crash (13min)
**After**: Timer properly invalidated → 50MB stable for hours

**Key insight** 90% of leaks come from forgetting to stop timers, observers, or subscriptions. Always clean up in `deinit` or use reactive patterns that auto-cleanup.

---

## Resources

**WWDC**: 2021-10180, 2020-10078, 2018-416

**Docs**: /xcode/gathering-information-about-memory-use, /metrickit/mxbackgroundexitdata

**Skills**: axiom-performance-profiling, axiom-objc-block-retain-cycles, axiom-metrickit-ref
