---
name: axiom-haptics
description: Use when implementing haptic feedback, Core Haptics patterns, audio-haptic synchronization, or debugging haptic issues - covers UIFeedbackGenerator, CHHapticEngine, AHAP patterns, and Apple's Causality-Harmony-Utility design principles from WWDC 2021
user-invocable: true
skill_type: reference
version: 1.0.0
---

# Haptics & Audio Feedback

Comprehensive guide to implementing haptic feedback on iOS. Every Apple Design Award winner uses excellent haptic feedback - Camera, Maps, Weather all use haptics masterfully to create delightful, responsive experiences.

## Overview

Haptic feedback provides tactile confirmation of user actions and system events. When designed thoughtfully using the Causality-Harmony-Utility framework, axiom-haptics transform interfaces from functional to delightful.

This skill covers both simple haptics (`UIFeedbackGenerator`) and advanced custom patterns (`Core Haptics`), with real-world examples and audio-haptic synchronization techniques.

## When to Use This Skill

- Adding haptic feedback to user interactions
- Choosing between UIFeedbackGenerator and Core Haptics
- Designing audio-haptic experiences that feel unified
- Creating custom haptic patterns with AHAP files
- Synchronizing haptics with animations and audio
- Debugging haptic issues (simulator vs device)
- Optimizing haptic performance and battery impact

## System Requirements

- **iOS 10+** for UIFeedbackGenerator
- **iOS 13+** for Core Haptics (CHHapticEngine)
- **iPhone 8+** for Core Haptics hardware support
- **Physical device required** - haptics cannot be felt in Simulator

---

## Part 1: Design Principles (WWDC 2021/10278)

Apple's audio and haptic design teams established three core principles for multimodal feedback:

### Causality - Make it obvious what caused the feedback

**Problem**: User can't tell what triggered the haptic
**Solution**: Haptic timing must match the visual/interaction moment

**Example from WWDC**:
- ✅ Ball hits wall → haptic fires at collision moment
- ❌ Ball hits wall → haptic fires 100ms later (confusing)

**Code pattern**:
```swift
// ✅ Immediate feedback on touch
@objc func buttonTapped() {
    let generator = UIImpactFeedbackGenerator(style: .medium)
    generator.impactOccurred()  // Fire immediately
    performAction()
}

// ❌ Delayed feedback loses causality
@objc func buttonTapped() {
    performAction()
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()  // Too late!
    }
}
```

### Harmony - Senses work best when coherent

**Problem**: Visual, audio, and haptic don't match
**Solution**: All three senses should feel like a unified experience

**Example from WWDC**:
- Small ball → light haptic + high-pitched sound
- Large ball → heavy haptic + low-pitched sound
- Shield transformation → continuous haptic + progressive audio

**Key insight**: A large object should **feel** heavy, **sound** low and resonant, and **look** substantial. All three senses reinforce the same experience.

### Utility - Provide clear value

**Problem**: Haptics used everywhere "just because we can"
**Solution**: Reserve haptics for significant moments that benefit the user

**When to use haptics**:
- ✅ Confirming an important action (payment completed)
- ✅ Alerting to critical events (low battery)
- ✅ Providing continuous feedback (scrubbing slider)
- ✅ Enhancing delight (app launch flourish)

**When NOT to use haptics**:
- ❌ Every single tap (overwhelming)
- ❌ Scrolling through long lists (battery drain)
- ❌ Background events user can't see (confusing)
- ❌ Decorative animations (no value)

---

## Part 2: UIFeedbackGenerator (Simple Haptics)

For most apps, `UIFeedbackGenerator` provides 3 simple haptic types without custom patterns.

### UIImpactFeedbackGenerator

Physical collision or impact sensation.

**Styles** (ordered light → heavy):
- `.light` - Small, delicate tap
- `.medium` - Standard tap (most common)
- `.heavy` - Strong, solid impact
- `.rigid` - Firm, precise tap
- `.soft` - Gentle, cushioned tap

**Usage pattern**:
```swift
class MyViewController: UIViewController {
    let impactGenerator = UIImpactFeedbackGenerator(style: .medium)

    override func viewDidLoad() {
        super.viewDidLoad()
        // Prepare reduces latency for next impact
        impactGenerator.prepare()
    }

    @objc func userDidTap() {
        impactGenerator.impactOccurred()
    }
}
```

**Intensity variation** (iOS 13+):
```swift
// intensity: 0.0 (lightest) to 1.0 (strongest)
impactGenerator.impactOccurred(intensity: 0.5)
```

**Common use cases**:
- Button taps (`.medium`)
- Toggle switches (`.light`)
- Deleting items (`.heavy`)
- Confirming selections (`.rigid`)

### UISelectionFeedbackGenerator

Discrete selection changes (picker wheels, segmented controls).

**Usage**:
```swift
class PickerViewController: UIViewController {
    let selectionGenerator = UISelectionFeedbackGenerator()

    func pickerView(_ picker: UIPickerView, didSelectRow row: Int,
                    inComponent component: Int) {
        selectionGenerator.selectionChanged()
    }
}
```

**Feels like**: Clicking a physical wheel with detents

**Common use cases**:
- Picker wheels
- Segmented controls
- Page indicators
- Step-through interfaces

### UINotificationFeedbackGenerator

System-level success/warning/error feedback.

**Types**:
- `.success` - Task completed successfully
- `.warning` - Attention needed, but not critical
- `.error` - Critical error occurred

**Usage**:
```swift
let notificationGenerator = UINotificationFeedbackGenerator()

func submitForm() {
    // Validate form
    if isValid {
        notificationGenerator.notificationOccurred(.success)
        saveData()
    } else {
        notificationGenerator.notificationOccurred(.error)
        showValidationErrors()
    }
}
```

**Best practice**: Match haptic type to user outcome
- ✅ Payment succeeds → `.success`
- ✅ Form validation fails → `.error`
- ✅ Approaching storage limit → `.warning`

### Performance: prepare()

Call `prepare()` before the haptic to reduce latency:

```swift
// ✅ Good - prepare before user action
@IBAction func buttonTouchDown(_ sender: UIButton) {
    impactGenerator.prepare()  // User's finger is down
}

@IBAction func buttonTouchUpInside(_ sender: UIButton) {
    impactGenerator.impactOccurred()  // Immediate haptic
}

// ❌ Bad - unprepared haptic may lag
@IBAction func buttonTapped(_ sender: UIButton) {
    let generator = UIImpactFeedbackGenerator()
    generator.impactOccurred()  // May have 10-20ms delay
}
```

**Prepare timing**: System keeps engine ready for ~1 second after `prepare()`.

---

## Part 3: Core Haptics (Custom Haptics)

For apps needing custom patterns, `Core Haptics` provides full control over haptic waveforms.

### Four Fundamental Elements

1. **Engine** (`CHHapticEngine`) - Link to the phone's actuator
2. **Player** (`CHHapticPatternPlayer`) - Playback control
3. **Pattern** (`CHHapticPattern`) - Collection of events over time
4. **Events** (`CHHapticEvent`) - Building blocks specifying the experience

### CHHapticEngine Lifecycle

```swift
import CoreHaptics

class HapticManager {
    var engine: CHHapticEngine?

    func initializeHaptics() {
        // Check device support
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            print("Device doesn't support haptics")
            return
        }

        do {
            // Create engine
            engine = try CHHapticEngine()

            // Handle interruptions (calls, Siri, etc.)
            engine?.stoppedHandler = { reason in
                print("Engine stopped: \(reason)")
                self.restartEngine()
            }

            // Handle reset (audio session changes)
            engine?.resetHandler = {
                print("Engine reset")
                self.restartEngine()
            }

            // Start engine
            try engine?.start()

        } catch {
            print("Failed to create haptic engine: \(error)")
        }
    }

    func restartEngine() {
        do {
            try engine?.start()
        } catch {
            print("Failed to restart engine: \(error)")
        }
    }
}
```

**Critical**: Always set `stoppedHandler` and `resetHandler` to handle system interruptions.

### CHHapticEvent Types

#### Transient Events

Short, discrete feedback (like a tap).

```swift
let intensity = CHHapticEventParameter(
    parameterID: .hapticIntensity,
    value: 1.0  // 0.0 to 1.0
)

let sharpness = CHHapticEventParameter(
    parameterID: .hapticSharpness,
    value: 0.5  // 0.0 (dull) to 1.0 (sharp)
)

let event = CHHapticEvent(
    eventType: .hapticTransient,
    parameters: [intensity, sharpness],
    relativeTime: 0.0  // Seconds from pattern start
)
```

**Parameters**:
- `hapticIntensity`: Strength (0.0 = barely felt, 1.0 = maximum)
- `hapticSharpness`: Character (0.0 = dull thud, 1.0 = crisp snap)

#### Continuous Events

Sustained feedback over time (like a vibration motor).

```swift
let intensity = CHHapticEventParameter(
    parameterID: .hapticIntensity,
    value: 0.8
)

let sharpness = CHHapticEventParameter(
    parameterID: .hapticSharpness,
    value: 0.3
)

let event = CHHapticEvent(
    eventType: .hapticContinuous,
    parameters: [intensity, sharpness],
    relativeTime: 0.0,
    duration: 2.0  // Seconds
)
```

**Use cases**:
- Rolling texture as object moves
- Motor running
- Charging progress
- Long press feedback

### Creating and Playing Patterns

```swift
func playCustomPattern() {
    // Create events
    let tap1 = CHHapticEvent(
        eventType: .hapticTransient,
        parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.5),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)
        ],
        relativeTime: 0.0
    )

    let tap2 = CHHapticEvent(
        eventType: .hapticTransient,
        parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.7),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.7)
        ],
        relativeTime: 0.3
    )

    let tap3 = CHHapticEvent(
        eventType: .hapticTransient,
        parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: 1.0)
        ],
        relativeTime: 0.6
    )

    do {
        // Create pattern from events
        let pattern = try CHHapticPattern(
            events: [tap1, tap2, tap3],
            parameters: []
        )

        // Create player
        let player = try engine?.makePlayer(with: pattern)

        // Play
        try player?.start(atTime: CHHapticTimeImmediate)

    } catch {
        print("Failed to play pattern: \(error)")
    }
}
```

### CHHapticAdvancedPatternPlayer - Looping

For continuous feedback (rolling textures, motors), use advanced player:

```swift
func startRollingTexture() {
    let event = CHHapticEvent(
        eventType: .hapticContinuous,
        parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.4),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.2)
        ],
        relativeTime: 0.0,
        duration: 0.5
    )

    do {
        let pattern = try CHHapticPattern(events: [event], parameters: [])

        // Use advanced player for looping
        let player = try engine?.makeAdvancedPlayer(with: pattern)

        // Enable looping
        try player?.loopEnabled = true

        // Start
        try player?.start(atTime: CHHapticTimeImmediate)

        // Update intensity dynamically based on ball speed
        updateTextureIntensity(player: player)

    } catch {
        print("Failed to start texture: \(error)")
    }
}

func updateTextureIntensity(player: CHHapticAdvancedPatternPlayer?) {
    let newIntensity = calculateIntensityFromBallSpeed()

    let intensityParam = CHHapticDynamicParameter(
        parameterID: .hapticIntensityControl,
        value: newIntensity,
        relativeTime: 0
    )

    try? player?.sendParameters([intensityParam], atTime: CHHapticTimeImmediate)
}
```

**Key difference**: `CHHapticPatternPlayer` plays once, `CHHapticAdvancedPatternPlayer` supports looping and dynamic parameter updates.

---

## Part 4: AHAP Files (Apple Haptic Audio Pattern)

AHAP (Apple Haptic Audio Pattern) files are JSON files combining haptic events and audio.

### Basic AHAP Structure

```json
{
  "Version": 1.0,
  "Metadata": {
    "Project": "My App",
    "Created": "2024-01-15"
  },
  "Pattern": [
    {
      "Event": {
        "Time": 0.0,
        "EventType": "HapticTransient",
        "EventParameters": [
          {
            "ParameterID": "HapticIntensity",
            "ParameterValue": 1.0
          },
          {
            "ParameterID": "HapticSharpness",
            "ParameterValue": 0.5
          }
        ]
      }
    }
  ]
}
```

### Adding Audio to AHAP

```json
{
  "Version": 1.0,
  "Pattern": [
    {
      "Event": {
        "Time": 0.0,
        "EventType": "AudioCustom",
        "EventParameters": [
          {
            "ParameterID": "AudioVolume",
            "ParameterValue": 0.8
          }
        ],
        "EventWaveformPath": "ShieldA.wav"
      }
    },
    {
      "Event": {
        "Time": 0.0,
        "EventType": "HapticContinuous",
        "EventDuration": 0.5,
        "EventParameters": [
          {
            "ParameterID": "HapticIntensity",
            "ParameterValue": 0.6
          }
        ]
      }
    }
  ]
}
```

### Loading AHAP Files

```swift
func loadAHAPPattern(named name: String) -> CHHapticPattern? {
    guard let url = Bundle.main.url(forResource: name, withExtension: "ahap") else {
        print("AHAP file not found")
        return nil
    }

    do {
        return try CHHapticPattern(contentsOf: url)
    } catch {
        print("Failed to load AHAP: \(error)")
        return nil
    }
}

// Usage
if let pattern = loadAHAPPattern(named: "ShieldTransient") {
    let player = try? engine?.makePlayer(with: pattern)
    try? player?.start(atTime: CHHapticTimeImmediate)
}
```

### Design Workflow (WWDC Example)

1. **Create visual animation** (e.g., shield transformation, 500ms)
2. **Design audio** (convey energy gain and robustness)
3. **Design haptic** (feel the transformation)
4. **Test harmony** - Do all three senses work together?
5. **Iterate** - Swap AHAP assets until coherent
6. **Implement** - Update code to use final assets

**Example iteration**: Shield initially used 3 transient pulses (haptic) + progressive continuous sound (audio) → no harmony. Solution: Switch to continuous haptic + ShieldA.wav audio → unified experience.

---

## Part 5: Audio-Haptic Synchronization

### Matching Animation Timing

```swift
class ViewController: UIViewController {
    let animationDuration: TimeInterval = 0.5

    func performShieldTransformation() {
        // Start haptic/audio simultaneously with animation
        playShieldPattern()

        UIView.animate(withDuration: animationDuration) {
            self.shieldView.transform = CGAffineTransform(scaleX: 1.2, y: 1.2)
            self.shieldView.alpha = 0.8
        }
    }

    func playShieldPattern() {
        if let pattern = loadAHAPPattern(named: "ShieldContinuous") {
            let player = try? engine?.makePlayer(with: pattern)
            try? player?.start(atTime: CHHapticTimeImmediate)
        }
    }
}
```

**Critical**: Fire haptic at the exact moment the visual change occurs, not before or after.

### Coordinating with Audio

```swift
import AVFoundation

class AudioHapticCoordinator {
    let audioPlayer: AVAudioPlayer
    let hapticEngine: CHHapticEngine

    func playCoordinatedExperience() {
        // Prepare both systems
        hapticEngine.notifyWhenPlayersFinished { _ in
            return .stopEngine
        }

        // Start at exact same moment
        let startTime = CACurrentMediaTime() + 0.05  // Small delay for sync

        // Start audio
        audioPlayer.play(atTime: startTime)

        // Start haptic
        if let pattern = loadAHAPPattern(named: "CoordinatedPattern") {
            let player = try? hapticEngine.makePlayer(with: pattern)
            try? player?.start(atTime: CHHapticTimeImmediate)
        }
    }
}
```

---

## Part 6: Common Patterns

### Button Tap

```swift
class HapticButton: UIButton {
    let impactGenerator = UIImpactFeedbackGenerator(style: .medium)

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesBegan(touches, with: event)
        impactGenerator.prepare()
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesEnded(touches, with: event)
        impactGenerator.impactOccurred()
    }
}
```

### Slider Scrubbing

```swift
class HapticSlider: UISlider {
    let selectionGenerator = UISelectionFeedbackGenerator()
    var lastValue: Float = 0

    @objc func valueChanged() {
        let threshold: Float = 0.1

        if abs(value - lastValue) >= threshold {
            selectionGenerator.selectionChanged()
            lastValue = value
        }
    }
}
```

### Pull-to-Refresh

```swift
class PullToRefreshController: UIViewController {
    let impactGenerator = UIImpactFeedbackGenerator(style: .medium)
    var isRefreshing = false

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        let threshold: CGFloat = -100
        let offset = scrollView.contentOffset.y

        if offset <= threshold && !isRefreshing {
            impactGenerator.impactOccurred()
            isRefreshing = true
            beginRefresh()
        }
    }
}
```

### Success/Error Feedback

```swift
func handleServerResponse(_ result: Result<Data, Error>) {
    let notificationGenerator = UINotificationFeedbackGenerator()

    switch result {
    case .success:
        notificationGenerator.notificationOccurred(.success)
        showSuccessMessage()
    case .failure:
        notificationGenerator.notificationOccurred(.error)
        showErrorAlert()
    }
}
```

---

## Part 7: Testing & Debugging

### Simulator Limitations

**Haptics DO NOT work in Simulator**. You will see:
- No haptic feedback
- No warnings or errors
- Code runs normally

**Solution**: Always test on physical device (iPhone 8 or newer).

### Device Testing Checklist

- [ ] Test with Haptics disabled in Settings → Sounds & Haptics
- [ ] Test with Low Power Mode enabled
- [ ] Test during incoming call (engine may stop)
- [ ] Test with audio playing in background
- [ ] Test with different intensity/sharpness values
- [ ] Verify battery impact (Instruments Energy Log)

### Debug Logging

```swift
func playHaptic() {
    #if DEBUG
    print("🔔 Playing haptic - Engine running: \(engine?.currentTime ?? -1)")
    #endif

    do {
        let player = try engine?.makePlayer(with: pattern)
        try player?.start(atTime: CHHapticTimeImmediate)

        #if DEBUG
        print("✅ Haptic started successfully")
        #endif
    } catch {
        #if DEBUG
        print("❌ Haptic failed: \(error.localizedDescription)")
        #endif
    }
}
```

---

## Troubleshooting

### Engine fails to start

**Symptom**: `CHHapticEngine.start()` throws error

**Causes**:
1. Device doesn't support Core Haptics (< iPhone 8)
2. Haptics disabled in Settings
3. Low Power Mode enabled

**Solution**:
```swift
func safelyStartEngine() {
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
        print("Device doesn't support haptics")
        return
    }

    do {
        try engine?.start()
    } catch {
        print("Engine start failed: \(error)")
        // Fall back to UIFeedbackGenerator
        useFallbackHaptics()
    }
}
```

### Haptics not felt

**Symptom**: Code runs but no haptic felt on device

**Debug steps**:
1. Check Settings → Sounds & Haptics → System Haptics is ON
2. Check Low Power Mode is OFF
3. Verify device is iPhone 8 or newer
4. Check intensity > 0.3 (values below may be too subtle)
5. Test with UIFeedbackGenerator to isolate Core Haptics vs system issue

### Audio out of sync with haptics

**Symptom**: Audio plays but haptic delayed or vice versa

**Causes**:
1. Not calling `prepare()` before haptic
2. Audio/haptic started at different times
3. Heavy main thread work blocking playback

**Solution**:
```swift
// ✅ Synchronized start
func playCoordinated() {
    impactGenerator.prepare()  // Reduce latency

    // Start both simultaneously
    audioPlayer.play()
    impactGenerator.impactOccurred()
}
```

### Audio file errors with AHAP

**Symptom**: AHAP pattern fails to load or play

**Cause**: Audio file > 4.2 MB or > 23 seconds

**Solution**: Keep audio files small and short. Use compressed formats (AAC) and trim to essential duration.

---

## Resources

**WWDC**: 2021-10278, 2019-520, 2019-223

**Docs**: /corehaptics, /corehaptics/chhapticengine

**Skills**: axiom-swiftui-animation-ref, axiom-ui-testing, axiom-accessibility-diag
