---
name: uikit-animation-debugging
description: Systematic CAAnimation diagnosis — completion handlers, spring physics, and device-specific behavior
---

# UIKit Animation Debugging

Systematic CAAnimation diagnosis covering completion handlers, spring physics, timing mismatches, and gesture conflicts. CAAnimation behavior differs significantly between simulator and device.

## When to Use

Use this skill when:
- CAAnimation completion handler never fires
- Spring animation looks wrong on real device (but fine in simulator)
- Animation duration doesn't match specified value
- Animation stutters during pan gesture
- Multiple animations interfere with each other

## Example Prompts

- "My CAAnimation completion handler never fires"
- "Spring animation looks perfect in simulator but bounces wrong on iPhone"
- "Animation duration is 0.3 but actually takes 0.5 seconds"
- "When I pan a gesture and trigger animation, it's janky"

## What This Skill Provides

### Pattern 1: Completion Handler That Never Fires

CABasicAnimation has no completion property — use CATransaction:

```swift
CATransaction.begin()
CATransaction.setCompletionBlock {
    print("Animation finished")  // This fires reliably
}
let animation = CABasicAnimation(keyPath: "position")
// ... configure animation
view.layer.add(animation, forKey: "move")
CATransaction.commit()
```

### Pattern 2: Spring Physics Device Differences

Simulator runs at 60 FPS, iPhone Pro at 120 FPS (ProMotion). Spring physics need 1.5-2x higher damping/stiffness for ProMotion:

```swift
// Tuned for ProMotion
spring.damping = 15    // Not 10
spring.stiffness = 150 // Not 100
```

### Pattern 3: Duration Mismatch

Don't mix UIView.animate and CAAnimation durations:

```swift
CATransaction.begin()
CATransaction.setAnimationDuration(0.3)  // Single source of truth
// ... add animations
CATransaction.commit()
```

### Pattern 4: Gesture + Animation Jank

Use CADisplayLink with `.common` mode for gesture-driven animation:

```swift
displayLink.add(to: .main, forMode: .common)  // Runs during gesture
```

### Debugging Tools

```swift
view.layer.animationKeys()           // List active animations
view.layer.presentation()?.position  // Get animated value (not final)
view.layer.speed = 0.1               // Slow down 10x for debugging
```

## Related

- [swiftui-debugging](/skills/ui-design/swiftui-debugging) — SwiftUI animation issues
- [performance-profiling](/skills/debugging/performance-profiling) — Animation performance

## Resources

**Docs**: /quartzcore, /caanimation
