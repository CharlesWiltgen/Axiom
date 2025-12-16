---
name: haptics
description: Use when implementing haptic feedback, Core Haptics patterns, audio-haptic synchronization, or debugging haptic issues - covers UIFeedbackGenerator, CHHapticEngine, AHAP patterns, and Apple's Causality-Harmony-Utility design principles
skill_type: reference
version: 1.0
---

# Haptics & Audio Feedback

Comprehensive guide to implementing haptic feedback on iOS with Core Haptics and UIFeedbackGenerator. Based on WWDC 2021 session 10278 (Practice audio haptic design).

## Overview

This reference covers haptic feedback implementation from simple patterns to advanced audio-haptic synchronization:

- **Design Principles** — Causality, Harmony, Utility framework from WWDC 2021
- **UIFeedbackGenerator** — Simple haptic feedback for common interactions (iOS 10+)
- **Core Haptics** — Custom haptic patterns and audio-haptic synchronization (iOS 13+)
- **AHAP Files** — Apple Haptic Audio Pattern JSON format
- **Testing & Debugging** — Simulator limitations and device-specific behavior

## System Requirements

- **iOS 10+** for UIFeedbackGenerator (basic haptics)
- **iOS 13+** for Core Haptics (CHHapticEngine)
- **iPhone 8+** for Core Haptics hardware support

**Simulator Limitation**: Haptics only work on physical devices. Always test on hardware.

---

## Design Principles (WWDC 2021/10278)

### Causality — What caused the feedback?

Haptic feedback should have a clear relationship to what triggered it.

**Good**: Button tap generates haptic when finger touches screen
**Poor**: Haptic triggered half a second after interaction

### Harmony — Senses work together

Combine visual, audio, and haptic feedback that reinforce each other.

**Good**: Sound + haptic for success confirmation
**Poor**: Haptic alone with no visual/audio context

### Utility — Provide clear value

Haptics should enhance understanding or provide information the user needs.

**Good**: Different haptic patterns for success vs error
**Poor**: Same haptic for everything

---

## Quick Start

### Simple Haptics with UIFeedbackGenerator

For basic interactions, use `UIFeedbackGenerator`:

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

### Custom Haptics with Core Haptics

For complex patterns and audio-haptic synchronization:

```swift
import CoreHaptics

var engine: CHHapticEngine?

func initializeHaptics() {
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
        return
    }

    do {
        engine = try CHHapticEngine()
        try engine?.start()
    } catch {
        print("Failed to create haptic engine: \(error)")
    }
}
```

---

## Common Patterns

### Button Tap
```swift
let impactGenerator = UIImpactFeedbackGenerator(style: .medium)
impactGenerator.impactOccurred()
```

### Selection Change (Picker, Segmented Control)
```swift
let selectionGenerator = UISelectionFeedbackGenerator()
selectionGenerator.selectionChanged()
```

### Success/Error/Warning
```swift
let notificationGenerator = UINotificationFeedbackGenerator()
notificationGenerator.notificationOccurred(.success)  // or .error, .warning
```

---

## When to Use Core Haptics

Use **Core Haptics** when you need:

1. **Custom haptic patterns** beyond basic impact/selection/notification
2. **Audio-haptic synchronization** for games or creative apps
3. **Looping haptic patterns** for continuous feedback
4. **Fine control** over intensity, sharpness, and timing

Otherwise, stick with **UIFeedbackGenerator** for simplicity.

---

## Troubleshooting

### Haptics not working

**Check**: Are you testing on a physical device (iPhone 8+)?
- Simulator doesn't support haptics
- Some older devices don't have Taptic Engine

**Check**: Is the ringer/silent switch on?
- Device must not be in silent mode (check Settings → Sounds & Haptics → System Haptics)

### Engine fails to start

**Solution**: Handle engine stopped/reset events:

```swift
engine?.stoppedHandler = { reason in
    print("Engine stopped: \(reason)")
    self.restartEngine()
}

engine?.resetHandler = {
    print("Engine reset")
    self.restartEngine()
}
```

### Haptics feel weak or inconsistent

**Check**: Did you call `prepare()` before triggering?
- Call `prepare()` 0.1-0.5 seconds before expected use
- Reduces latency and ensures consistent response

---

## WWDC Sessions

- [Practice audio haptic design (2021/10278)](https://developer.apple.com/videos/play/wwdc2021/10278/) — Causality-Harmony-Utility principles
- [Introducing Core Haptics (2019/520)](https://developer.apple.com/videos/play/wwdc2019/520/) — CHHapticEngine architecture
- [Expanding the Sensory Experience (2019/223)](https://developer.apple.com/videos/play/wwdc2019/223/) — Audio-haptic design

## Related Skills

- **haptics** — Complete reference with AHAP patterns, advanced Core Haptics, audio synchronization

## Related Documentation

- [Core Haptics Framework](https://developer.apple.com/documentation/corehaptics)
- [UIFeedbackGenerator](https://developer.apple.com/documentation/uikit/uifeedbackgenerator)
- [Human Interface Guidelines — Playing Haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)
