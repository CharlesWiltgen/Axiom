---
name: axiom-display-performance
description: Use when app runs at unexpected frame rate, stuck at 60fps on ProMotion, frame pacing issues, or configuring render loops. Covers MTKView, CADisplayLink, CAMetalDisplayLink, frame pacing, hitches, system caps.
user-invocable: true
skill_type: discipline
version: 1.0.0
---

# Display Performance

Systematic diagnosis for frame rate issues on variable refresh rate displays (ProMotion, iPad Pro, future devices). Covers render loop configuration, frame pacing, hitch mechanics, and production telemetry.

**Key insight**: "ProMotion available" does NOT mean your app automatically runs at 120Hz. You must configure it correctly, account for system caps, and ensure proper frame pacing.

---

## Part 1: Why You're Stuck at 60fps

### Diagnostic Order

Check these in order when stuck at 60fps on ProMotion:

1. **Info.plist key missing?** (iPhone only) → Part 2
2. **Render loop configured for 60?** (MTKView defaults, CADisplayLink) → Part 3
3. **System caps enabled?** (Low Power Mode, Limit Frame Rate, Thermal) → Part 5
4. **Frame time > 8.33ms?** (Can't sustain 120fps) → Part 6
5. **Frame pacing issues?** (Micro-stuttering despite good FPS) → Part 7
6. **Measuring wrong thing?** (UIScreen vs actual presentation) → Part 9

---

## Part 2: Enabling ProMotion on iPhone

**Critical**: Core Animation won't access frame rates above 60Hz on iPhone unless you add this key.

```xml
<!-- Info.plist -->
<key>CADisableMinimumFrameDurationOnPhone</key>
<true/>
```

Without this key:
- Your `preferredFrameRateRange` hints are ignored above 60Hz
- Other animations may affect your CADisplayLink callback rate
- iPad Pro does NOT require this key

**When to add**: Any iPhone app that needs >60Hz for games, animations, or smooth scrolling.

---

## Part 3: Render Loop Configuration

### MTKView Defaults to 60fps

**This is the most common cause.** MTKView's `preferredFramesPerSecond` defaults to 60.

```swift
// ❌ WRONG: Implicit 60fps (default)
let mtkView = MTKView(frame: frame, device: device)
mtkView.delegate = self
// Running at 60fps even on ProMotion!

// ✅ CORRECT: Explicit 120fps request
let mtkView = MTKView(frame: frame, device: device)
mtkView.preferredFramesPerSecond = 120
mtkView.isPaused = false
mtkView.enableSetNeedsDisplay = false  // Continuous, not on-demand
mtkView.delegate = self
```

**Critical settings for continuous high-rate rendering:**

| Property | Value | Why |
|----------|-------|-----|
| `preferredFramesPerSecond` | `120` | Request max rate |
| `isPaused` | `false` | Don't pause the render loop |
| `enableSetNeedsDisplay` | `false` | Continuous mode, not on-demand |

### CADisplayLink Configuration (iOS 15+)

Apple explicitly recommends CADisplayLink (not timers) for custom render loops.

```swift
// ❌ WRONG: Timer-based render loop (drifts, wastes frame time)
Timer.scheduledTimer(withTimeInterval: 1.0/120.0, repeats: true) { _ in
    self.render()
}

// ❌ WRONG: Default CADisplayLink (may hint 60)
let displayLink = CADisplayLink(target: self, selector: #selector(render))
displayLink.add(to: .main, forMode: .common)

// ✅ CORRECT: Explicit frame rate range
let displayLink = CADisplayLink(target: self, selector: #selector(render))
displayLink.preferredFrameRateRange = CAFrameRateRange(
    minimum: 80,      // Minimum acceptable
    maximum: 120,     // Preferred maximum
    preferred: 120    // What you want
)
displayLink.add(to: .main, forMode: .common)
```

**Special priority for games**: iOS 15+ gives 30Hz and 60Hz special priority. If targeting these rates:

```swift
// 30Hz and 60Hz get priority scheduling
let prioritizedRange = CAFrameRateRange(
    minimum: 30,
    maximum: 60,
    preferred: 60
)
displayLink.preferredFrameRateRange = prioritizedRange
```

### Suggested Frame Rates by Content Type

| Content Type | Suggested Rate | Notes |
|--------------|----------------|-------|
| Video playback | 24-30 Hz | Match content frame rate |
| Scrolling UI | 60-120 Hz | Higher = smoother |
| Fast games | 60-120 Hz | Match rendering capability |
| Slow animations | 30-60 Hz | Save power |
| Static content | 10-24 Hz | Minimal updates needed |

---

## Part 4: CAMetalDisplayLink (iOS 17+)

For Metal apps needing precise timing control, `CAMetalDisplayLink` provides more control than CADisplayLink.

```swift
class MetalRenderer: NSObject, CAMetalDisplayLinkDelegate {
    var displayLink: CAMetalDisplayLink?
    var metalLayer: CAMetalLayer!

    func setupDisplayLink() {
        displayLink = CAMetalDisplayLink(metalLayer: metalLayer)
        displayLink?.delegate = self
        displayLink?.preferredFrameRateRange = CAFrameRateRange(
            minimum: 60,
            maximum: 120,
            preferred: 120
        )
        // Control render latency (in frames)
        displayLink?.preferredFrameLatency = 2
        displayLink?.add(to: .main, forMode: .common)
    }

    func metalDisplayLink(_ link: CAMetalDisplayLink, needsUpdate update: CAMetalDisplayLink.Update) {
        // update.drawable - The drawable to render to
        // update.targetTimestamp - Deadline to finish rendering
        // update.targetPresentationTimestamp - When frame will display

        guard let drawable = update.drawable else { return }

        let workingTime = update.targetTimestamp - CACurrentMediaTime()
        // workingTime = seconds available before deadline

        // Render to drawable...
        renderFrame(to: drawable)
    }
}
```

**Key differences from CADisplayLink:**

| Feature | CADisplayLink | CAMetalDisplayLink |
|---------|---------------|-------------------|
| Drawable access | Manual via layer | Provided in callback |
| Latency control | None | `preferredFrameLatency` |
| Target timing | timestamp/targetTimestamp | + targetPresentationTimestamp |
| Use case | General animation | Metal-specific rendering |

**When to use CAMetalDisplayLink:**
- Need precise control over render timing window
- Want to minimize input latency
- Building games or intensive Metal apps
- iOS 17+ only deployment

---

## Part 5: System Caps

System states can force 60fps even when your code requests 120:

### Low Power Mode

**Caps ProMotion devices to 60fps.**

```swift
// Check programmatically
if ProcessInfo.processInfo.isLowPowerModeEnabled {
    // System caps display to 60Hz
}

// Observe changes
NotificationCenter.default.addObserver(
    forName: .NSProcessInfoPowerStateDidChange,
    object: nil,
    queue: .main
) { _ in
    let isLowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
    self.adjustRenderingForPowerState(isLowPower)
}
```

### Limit Frame Rate (Accessibility)

**Settings → Accessibility → Motion → Limit Frame Rate** caps to 60fps.

No API to detect. If user reports 60fps despite configuration, have them check this setting.

### Thermal Throttling

System restricts 120Hz when device overheats.

```swift
// Check thermal state
switch ProcessInfo.processInfo.thermalState {
case .nominal, .fair:
    preferredFramesPerSecond = 120
case .serious, .critical:
    preferredFramesPerSecond = 60  // Reduce proactively
@unknown default:
    break
}

// Observe thermal changes
NotificationCenter.default.addObserver(
    forName: ProcessInfo.thermalStateDidChangeNotification,
    object: nil,
    queue: .main
) { _ in
    self.adjustForThermalState()
}
```

### Adaptive Power (iOS 26+, iPhone 17)

**New in iOS 26**: Adaptive Power is ON by default on iPhone 17/17 Pro. Can throttle even at 60% battery.

**User action for testing**: Settings → Battery → Power Mode → disable **Adaptive Power**.

No public API to detect Adaptive Power state.

---

## Part 6: Performance Budget

### Frame Time Budgets

| Target FPS | Frame Budget | Vsync Interval |
|------------|--------------|----------------|
| 120 | 8.33ms | Every vsync |
| 90 | 11.11ms | — |
| 60 | 16.67ms | Every 2nd vsync |
| 30 | 33.33ms | Every 4th vsync |

**If you consistently exceed budget, system drops to next sustainable rate.**

### Measuring GPU Frame Time

```swift
func draw(in view: MTKView) {
    guard let commandBuffer = commandQueue.makeCommandBuffer() else { return }

    // Your rendering code...

    commandBuffer.addCompletedHandler { buffer in
        let gpuTime = buffer.gpuEndTime - buffer.gpuStartTime
        let gpuMs = gpuTime * 1000

        if gpuMs > 8.33 {
            print("⚠️ GPU: \(String(format: "%.2f", gpuMs))ms exceeds 120Hz budget")
        }
    }

    commandBuffer.commit()
}
```

### Can't Sustain 120? Target Lower Rate Evenly

**Critical**: Uneven frame pacing looks worse than consistent lower rate.

```swift
// If you can't sustain 8.33ms, explicitly target 60 for smooth cadence
if averageGpuTime > 8.33 && averageGpuTime <= 16.67 {
    mtkView.preferredFramesPerSecond = 60
}
```

---

## Part 7: Frame Pacing

### The Micro-Stuttering Problem

Even with good average FPS, inconsistent frame timing causes visible jitter.

```
// BAD: Inconsistent intervals despite ~40 FPS average
Frame 1: 25ms
Frame 2: 40ms  ← stutter
Frame 3: 25ms
Frame 4: 40ms  ← stutter

// GOOD: Consistent intervals at 30 FPS
Frame 1: 33ms
Frame 2: 33ms
Frame 3: 33ms
Frame 4: 33ms
```

**Presenting immediately after rendering causes this.** Use explicit timing control.

### Frame Pacing APIs

#### present(afterMinimumDuration:) — Recommended

Ensures consistent spacing between frames:

```swift
func draw(in view: MTKView) {
    guard let commandBuffer = commandQueue.makeCommandBuffer(),
          let drawable = view.currentDrawable else { return }

    // Render to drawable...

    // Present with minimum 33ms between frames (30 FPS target)
    commandBuffer.present(drawable, afterMinimumDuration: 0.033)
    commandBuffer.commit()
}
```

#### present(at:) — Precise Timing

Schedule presentation at specific time:

```swift
// Present at specific Mach absolute time
let presentTime = CACurrentMediaTime() + 0.033
commandBuffer.present(drawable, atTime: presentTime)
```

#### presentedTime — Verify Actual Presentation

Check when frames actually appeared:

```swift
drawable.addPresentedHandler { drawable in
    let actualTime = drawable.presentedTime
    if actualTime == 0.0 {
        // Frame was dropped!
        print("⚠️ Frame dropped")
    } else {
        print("Frame presented at: \(actualTime)")
    }
}
```

### Frame Pacing Pattern

```swift
class SmoothRenderer: NSObject, MTKViewDelegate {
    private var targetFrameDuration: CFTimeInterval = 1.0 / 60.0  // 60 FPS target

    func draw(in view: MTKView) {
        guard let commandBuffer = commandQueue.makeCommandBuffer(),
              let drawable = view.currentDrawable else { return }

        renderScene(to: drawable)

        // Use frame pacing to ensure consistent intervals
        commandBuffer.present(drawable, afterMinimumDuration: targetFrameDuration)
        commandBuffer.commit()
    }

    func adjustTargetFrameRate(canSustain fps: Int) {
        switch fps {
        case 90...:
            targetFrameDuration = 1.0 / 120.0
        case 50...:
            targetFrameDuration = 1.0 / 60.0
        default:
            targetFrameDuration = 1.0 / 30.0
        }
    }
}
```

---

## Part 8: Understanding Hitches

### Render Loop Phases

Frame lifecycle: **Begin Time → Commit Deadline → Presentation Time**

1. **App Process (CPU)**: Handle events, compute UI updates, Core Animation commit
2. **Render Server (CPU+GPU)**: Transform UI to bitmap, render to buffer
3. **Display Driver**: Swap buffer to screen at vsync

At 120Hz, each phase has ~8.33ms. Miss any deadline = hitch.

### Commit Hitch vs Render Hitch

**Commit Hitch**: App process misses commit deadline
- Cause: Main thread work takes too long
- Fix: Move work off main thread, reduce view complexity

**Render Hitch**: Render server misses presentation deadline
- Cause: GPU work too complex (blur, shadows, layers)
- Fix: Simplify visual effects, reduce overdraw

### Double vs Triple Buffering

**Double Buffer (default)**:
- Frame lifetime: 2 vsync intervals
- Tighter deadlines
- Lower latency

**Triple Buffer (system may enable)**:
- Frame lifetime: 3 vsync intervals
- Render server gets 2 vsync intervals
- Higher latency but more headroom

The system automatically switches to triple buffering to recover from render hitches.

### Hitch Duration

```
Expected Frame Lifetime = Begin Time → Presentation Time
Actual Frame Lifetime = Begin Time → Actual Vsync

Hitch Duration = Actual - Expected
```

If hitch duration > 0, the frame was late and previous frame stayed onscreen longer.

---

## Part 9: Measurement

### UIScreen Lies, Actual Presentation Tells Truth

```swift
// ❌ This says 120 even when system caps you to 60
let maxFPS = UIScreen.main.maximumFramesPerSecond
// Reports capability, not actual rate!

// ✅ Measure from CADisplayLink timing
@objc func displayLinkCallback(_ link: CADisplayLink) {
    // Time available to prepare next frame
    let workingTime = link.targetTimestamp - CACurrentMediaTime()

    // Actual interval since last callback
    if lastTimestamp > 0 {
        let interval = link.timestamp - lastTimestamp
        let actualFPS = 1.0 / interval
    }
    lastTimestamp = link.timestamp
}
```

### Metal Performance HUD

Enable on-device real-time performance overlay:

**Via Xcode scheme:**
1. Edit Scheme → Run → Diagnostics
2. Enable "Show Graphics Overview"
3. Optionally enable "Log Graphics Overview"

**Via environment variable:**
```bash
MTL_HUD_ENABLED=1
```

**Via device settings:**
Settings → Developer → Graphics HUD → Show Graphics HUD

**HUD shows:**
- FPS (average)
- GPU time per frame
- Frame interval chart (last 120 frames)
- Memory usage

### Production Telemetry with MetricKit

Monitor hitches in production:

```swift
import MetricKit

class MetricsManager: NSObject, MXMetricManagerSubscriber {
    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            if let animationMetrics = payload.animationMetrics {
                // Ratio of time spent hitching during scroll
                let scrollHitchRatio = animationMetrics.scrollHitchTimeRatio

                // Ratio of time spent hitching in all animations
                if #available(iOS 17.0, *) {
                    let hitchRatio = animationMetrics.hitchTimeRatio
                }

                analyzeHitchMetrics(scrollHitchRatio: scrollHitchRatio)
            }
        }
    }
}

// Register for metrics
MXMetricManager.shared.add(metricsManager)
```

**What to track:**
- `scrollHitchTimeRatio`: Time spent hitching while scrolling (UIScrollView only)
- `hitchTimeRatio` (iOS 17+): Time spent hitching in all tracked animations

---

## Part 10: Quick Diagnostic Checklist

When debugging frame rate issues:

| Step | Check | Fix |
|------|-------|-----|
| 1 | Info.plist key present? (iPhone) | Add `CADisableMinimumFrameDurationOnPhone` |
| 2 | Limit Frame Rate off? | Settings → Accessibility → Motion |
| 3 | Low Power Mode off? | Settings → Battery |
| 4 | Adaptive Power off? (iPhone 17+) | Settings → Battery → Power Mode |
| 5 | preferredFramesPerSecond = 120? | Set explicitly on MTKView |
| 6 | preferredFrameRateRange set? | Configure on CADisplayLink |
| 7 | GPU frame time < 8.33ms? | Profile with Metal HUD or Instruments |
| 8 | Frame pacing consistent? | Use present(afterMinimumDuration:) |
| 9 | Hitches in production? | Monitor with MetricKit |

---

## Part 11: Common Patterns

### Pattern: Adaptive Frame Rate with Thermal Awareness

```swift
class AdaptiveRenderer: NSObject, MTKViewDelegate {
    private var recentFrameTimes: [Double] = []
    private let sampleCount = 30
    private var targetFrameDuration: CFTimeInterval = 1.0 / 60.0

    func draw(in view: MTKView) {
        guard let commandBuffer = commandQueue.makeCommandBuffer(),
              let drawable = view.currentDrawable else { return }

        let startTime = CACurrentMediaTime()
        renderScene(to: drawable)
        let frameTime = (CACurrentMediaTime() - startTime) * 1000

        updateTargetRate(frameTime: frameTime, view: view)

        commandBuffer.present(drawable, afterMinimumDuration: targetFrameDuration)
        commandBuffer.commit()
    }

    private func updateTargetRate(frameTime: Double, view: MTKView) {
        recentFrameTimes.append(frameTime)
        if recentFrameTimes.count > sampleCount {
            recentFrameTimes.removeFirst()
        }

        let avgFrameTime = recentFrameTimes.reduce(0, +) / Double(recentFrameTimes.count)
        let thermal = ProcessInfo.processInfo.thermalState
        let lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled

        // Constrain based on what we can sustain AND system state
        if lowPower || thermal >= .serious {
            view.preferredFramesPerSecond = 30
            targetFrameDuration = 1.0 / 30.0
        } else if avgFrameTime < 7.0 && thermal == .nominal {
            view.preferredFramesPerSecond = 120
            targetFrameDuration = 1.0 / 120.0
        } else if avgFrameTime < 14.0 {
            view.preferredFramesPerSecond = 60
            targetFrameDuration = 1.0 / 60.0
        } else {
            view.preferredFramesPerSecond = 30
            targetFrameDuration = 1.0 / 30.0
        }
    }
}
```

### Pattern: Frame Drop Detection

```swift
class FrameDropMonitor {
    private var expectedPresentTime: CFTimeInterval = 0
    private var dropCount = 0

    func trackFrame(drawable: MTLDrawable, expectedInterval: CFTimeInterval) {
        drawable.addPresentedHandler { [weak self] drawable in
            guard let self = self else { return }

            if drawable.presentedTime == 0.0 {
                self.dropCount += 1
                print("⚠️ Frame dropped (total: \(self.dropCount))")
            } else if self.expectedPresentTime > 0 {
                let actualInterval = drawable.presentedTime - self.expectedPresentTime
                let variance = abs(actualInterval - expectedInterval)

                if variance > expectedInterval * 0.5 {
                    print("⚠️ Frame timing variance: \(variance * 1000)ms")
                }
            }

            self.expectedPresentTime = drawable.presentedTime
        }
    }
}
```

---

## Resources

**WWDC**: 2021-10147, 2018-612, 2022-10083, 2023-10123

**Tech Talks**: 10855, 10856, 10857 (Hitch deep dives)

**Docs**: /quartzcore/cadisplaylink, /quartzcore/cametaldisplaylink, /quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays, /xcode/understanding-hitches-in-your-app, /metal/mtldrawable/present(afterminimumduration:), /metrickit/mxanimationmetric

**Skills**: axiom-energy, axiom-ios-graphics, axiom-metal-migration-ref, axiom-performance-profiling
