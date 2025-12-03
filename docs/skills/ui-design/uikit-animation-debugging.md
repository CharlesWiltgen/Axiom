---
name: uikit-animation-debugging
description: Use when CAAnimation completion handler doesn't fire, spring physics look wrong on device, animation duration mismatches actual time, gesture + animation interaction causes jank, or timing differs between simulator and real hardware — systematic CAAnimation diagnosis
---

# UIKit Animation Debugging

Systematic CAAnimation diagnosis with CATransaction patterns, frame rate awareness, and device-specific behavior handling.

## Overview

Debug UIKit animation issues including completion handlers that never fire, incorrect spring physics, timing mismatches, and gesture conflicts. **Core principle**: CAAnimation behavior differs significantly between simulator and device, especially for spring physics and completion timing.

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

#### 1. "My CAAnimation completion handler never fires. The animation plays but the code after never executes. Why?"
→ The skill shows CATransaction commit completion pattern and explains implicit vs explicit animations

#### 2. "Spring animation looks perfect in simulator but bounces wrong on real iPhone. What's different?"
→ The skill demonstrates frame rate differences (120Hz ProMotion vs simulator) and device-specific tuning

#### 3. "Animation duration is 0.3 seconds but actually takes 0.5 seconds. Where's the extra time coming from?"
→ The skill reveals CATransaction duration wrapping and nested animation timing

#### 4. "When I pan a gesture and trigger animation, it's janky. Works fine without gesture."
→ The skill covers gesture-animation interaction patterns and RunLoop mode issues

## Red Flags — Check Animation Layer First

If you see ANY of these, suspect CAAnimation layer issues not code logic:
- "Completion handler never fires"
- "Animation works in simulator, broken on device"
- "Duration parameter ignored"
- "Spring physics feel wrong on real hardware"
- "Animation stutters during gesture"
- "Multiple animations interfere with each other"

## Mandatory First Steps

**ALWAYS check these before debugging code**:

```swift
// 1. Enable Core Animation debugging
// Product → Scheme → Edit Scheme → Run → Options
// ✓ Core Animation Instrument

// 2. Check actual animation state
view.layer.presentation()?.position  // Actual animated position
view.layer.position  // Final destination (not animated value!)

// 3. Verify animation added to layer
view.layer.animationKeys()  // Lists active animations

// 4. Check CATransaction state
CATransaction.setCompletionBlock {
    print("Transaction completed")  // When ALL animations finish
}
```

## Common Animation Patterns

### Pattern 1: Completion Handler That Never Fires

```swift
// ❌ PROBLEM: Completion handler never called
let animation = CABasicAnimation(keyPath: "position")
animation.fromValue = startPoint
animation.toValue = endPoint
animation.duration = 0.3
animation.completion = {
    print("Never prints!")  // CABasicAnimation has no completion property!
}
view.layer.add(animation, forKey: "move")

// ✅ SOLUTION: Use CATransaction completion
CATransaction.begin()
CATransaction.setCompletionBlock {
    print("Animation finished")  // This fires reliably
}
let animation = CABasicAnimation(keyPath: "position")
animation.fromValue = startPoint
animation.toValue = endPoint
animation.duration = 0.3
view.layer.add(animation, forKey: "move")
CATransaction.commit()
```

### Pattern 2: Spring Physics Device Differences

```swift
// ❌ PROBLEM: Spring looks wrong on device
let spring = CASpringAnimation(keyPath: "transform.scale")
spring.damping = 10  // Looks perfect in simulator
spring.stiffness = 100
spring.mass = 1
spring.initialVelocity = 0

// ✅ SOLUTION: Tune for device frame rate
let spring = CASpringAnimation(keyPath: "transform.scale")
spring.damping = 15  // Increase damping for ProMotion (120Hz)
spring.stiffness = 150  // Increase stiffness for faster response
spring.mass = 1
// Test on real device, not simulator!
```

**Key insight**: Simulator runs at 60 FPS, iPhone Pro devices at 120 FPS (ProMotion). Spring physics need 1.5-2x higher damping/stiffness values for ProMotion devices.

### Pattern 3: Duration Mismatch

```swift
// ❌ PROBLEM: Animation takes longer than specified duration
UIView.animate(withDuration: 0.3) {
    let animation = CABasicAnimation(keyPath: "opacity")
    animation.duration = 0.5  // Which duration wins?
    self.view.layer.add(animation, forKey: "fade")
}

// ✅ SOLUTION: Don't mix UIView and CAAnimation durations
CATransaction.begin()
CATransaction.setAnimationDuration(0.3)  // Single source of truth
let animation = CABasicAnimation(keyPath: "opacity")
view.layer.add(animation, forKey: "fade")
CATransaction.commit()
```

### Pattern 4: Gesture + Animation Jank

```swift
// ❌ PROBLEM: Animation stutters during pan gesture
@objc func handlePan(_ gesture: UIPanGestureRecognizer) {
    if gesture.state == .ended {
        UIView.animate(withDuration: 0.3) {
            self.view.center = self.targetPosition
        }
    }
}

// ✅ SOLUTION: Use CADisplayLink for gesture-driven animation
let displayLink = CADisplayLink(target: self, selector: #selector(updateAnimation))
displayLink.add(to: .main, forMode: .common)  // Runs during gesture tracking

@objc func updateAnimation() {
    // Update animation based on gesture state
    // Smooth because runs every frame
}
```

## Decision Tree

```
CAAnimation not working as expected?
├─ Completion handler never fires?
│  └─ Use CATransaction.setCompletionBlock instead
├─ Animation works in simulator, broken on device?
│  └─ Spring physics: Increase damping 1.5-2x for ProMotion
├─ Duration doesn't match specified value?
│  └─ Check for nested CATransaction or UIView animation wrapper
├─ Animation stutters during gesture?
│  └─ Use CADisplayLink for gesture-driven animation
├─ Multiple animations interfere?
│  └─ Use unique animation keys, remove old before adding new
└─ Animation stops mid-way?
   └─ Check layer.presentation() vs layer.position mismatch
```

## Common Error Patterns

| Symptom | Cause | Fix |
|---------|-------|-----|
| Completion never fires | No CATransaction completion | Wrap in CATransaction |
| Spring feels wrong on device | Simulator vs ProMotion (60 vs 120 FPS) | Increase damping 1.5-2x |
| Duration ignored | Nested animation contexts | Single CATransaction |
| Jank during gesture | RunLoop mode incompatibility | CADisplayLink with .common mode |
| Animation "jumps" at end | Forgot to update model layer | Set `view.layer.position = endValue` |

## Useful Debugging Tools

```swift
// 1. Print all active animations
print("Active animations:", view.layer.animationKeys() ?? [])

// 2. Get animated value (not final value)
if let presentation = view.layer.presentation() {
    print("Animated position:", presentation.position)
}

// 3. Enable animation debugging
CATransaction.setDisableActions(true)  // Temporarily disable animations
// ... make changes ...
CATransaction.setDisableActions(false)

// 4. Slow down all animations for debugging
view.layer.speed = 0.1  // 10x slower (great for debugging)
```

## Device-Specific Testing

**CRITICAL**: Always test animations on real devices, not just simulator:

- iPhone 16 Pro / Pro Max (120 FPS ProMotion)
- iPhone SE 4 (60 FPS standard)
- iPad Pro (120 FPS ProMotion)

Spring physics require device-specific tuning. Simulator testing is insufficient.

## Common Mistakes

❌ **Expecting CABasicAnimation to have completion closure** — Use CATransaction instead

❌ **Tuning spring physics in simulator only** — ProMotion devices need higher damping/stiffness

❌ **Mixing UIView.animate and CAAnimation durations** — Use one animation system consistently

❌ **Not updating model layer after animation** — Animation is presentation-only, update actual values

## Real-World Impact

**Before** 2-4 hours debugging "why completion handler never fires"
**After** 5-15 minutes applying CATransaction pattern

**Key insight** CAAnimation behavior differs dramatically between simulator and device. Test on real hardware.

## Related Skills

- [swiftui-debugging](/skills/ui-design/swiftui-debugging) — For SwiftUI animation debugging
- [performance-profiling](/skills/debugging/performance-profiling) — For animation performance issues

## Size

25 KB - Comprehensive UIKit animation debugging patterns
