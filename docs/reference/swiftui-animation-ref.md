---
name: swiftui-animation-ref
description: Use when implementing SwiftUI animations, understanding VectorArithmetic, using @Animatable macro, choosing between spring and timing curve animations, or debugging animation behavior - comprehensive animation reference from iOS 13 through iOS 26
skill_type: reference
version: 1.0
---

# SwiftUI Animation API Reference

Comprehensive API reference for SwiftUI animation from iOS 13 through iOS 26. Covers the Animatable protocol, @Animatable macro, animation types, and advanced patterns.

## Overview

This reference covers all SwiftUI animation APIs and patterns:

- **VectorArithmetic Protocol** — Foundation for all animated types
- **Animatable Protocol** — Manual animation conformance (iOS 13+)
- **@Animatable Macro** — Automatic synthesis (iOS 26+)
- **Animation Types** — Springs, timing curves, and higher-order animations
- **Transaction System** — withAnimation, scoped animations (iOS 17+)
- **CustomAnimation Protocol** — Build custom animation algorithms
- **Performance** — Off-main-thread optimization patterns

---

## Understanding Animation

### What Is Interpolation

Animation generates intermediate values between start and end states. SwiftUI requires animated data to conform to `VectorArithmetic`:

```swift
protocol VectorArithmetic {
    static func - (lhs: Self, rhs: Self) -> Self
    static func + (lhs: Self, rhs: Self) -> Self
    mutating func scale(by: Double)
    static var zero: Self { get }
}
```

**Built-in conforming types**: `CGFloat`, `Double`, `Float`, `Angle`, `CGPoint`, `CGSize`, `CGRect`

### Why Int Can't Be Animated

`Int` doesn't conform to `VectorArithmetic` because:
- No fractional intermediate values (`1.5` doesn't exist for `Int`)
- Would require rounding (unpredictable results)

**Solution**: Use `Float` or `Double` and convert to `Int` for display:

```swift
@State private var count: Float = 0

var body: some View {
    Text("\(Int(count))")  // Display as Int
        .animation(.spring, value: count)
}
```

### Model vs Presentation Values

- **Model value**: Immediate state change
- **Presentation value**: Interpolated value during animation

When you animate `scale` from `1.0` to `1.5`:
- Model value: Instantly becomes `1.5`
- Presentation value: Smoothly interpolates over time

---

## Animatable Protocol

Views, shapes, and layouts can animate custom properties by conforming to `Animatable`:

```swift
protocol Animatable {
    associatedtype AnimatableData: VectorArithmetic
    var animatableData: AnimatableData { get set }
}
```

### Built-in Animatable Types

**Shapes**: `Circle`, `Rectangle`, `RoundedRectangle`, `Capsule`, `Ellipse`, `Path`

**Modifiers**: `.scaleEffect()`, `.rotationEffect()`, `.opacity()`, `.offset()`, `.blur()`

### Manual Conformance

For animating custom properties:

```swift
struct PieSlice: Shape {
    var startAngle: Angle
    var endAngle: Angle

    var animatableData: AnimatablePair<Double, Double> {
        get {
            AnimatablePair(startAngle.radians, endAngle.radians)
        }
        set {
            startAngle = Angle(radians: newValue.first)
            endAngle = Angle(radians: newValue.second)
        }
    }

    func path(in rect: CGRect) -> Path {
        // Draw pie slice using startAngle and endAngle
    }
}
```

### AnimatablePair for Multiple Properties

Nest `AnimatablePair` to animate more than 2 values:

```swift
// Animate 5 properties: startPoint (x,y), elevation, endPoint (x,y)
var animatableData: AnimatablePair<AnimatablePair<CGFloat, CGFloat>,
                    AnimatablePair<Double, AnimatablePair<CGFloat, CGFloat>>> {
    get {
        AnimatablePair(
            AnimatablePair(startPoint.x, startPoint.y),
            AnimatablePair(elevation, AnimatablePair(endPoint.x, endPoint.y))
        )
    }
    set {
        startPoint = CGPoint(x: newValue.first.first, y: newValue.first.second)
        elevation = newValue.second.first
        endPoint = CGPoint(x: newValue.second.second.first, y: newValue.second.second.second)
    }
}
```

---

## @Animatable Macro (iOS 26+)

Automatically synthesizes `animatableData` for views with simple numeric properties:

```swift
@MainActor
@Animatable
struct MyView: View {
    var scale: CGFloat
    var opacity: Double

    var body: some View {
        // Automatically animatable!
    }
}
```

### Excluding Properties with @AnimatableIgnored

```swift
@MainActor
@Animatable
struct ProgressView: View {
    var progress: Double  // ✅ Animated

    @AnimatableIgnored
    var title: String  // ❌ Not animated

    @AnimatableIgnored
    var startTime: Date  // ❌ Not animated
}
```

**What can be ignored**:
- Non-`VectorArithmetic` types (strings, dates, booleans, enums)
- Configuration that shouldn't animate (colors, labels, IDs)

### Real-World Use Cases

**Fintech**: Stock price animations, portfolio value transitions

```swift
@MainActor
@Animatable
struct StockPriceView: View {
    var price: Double
    var changePercent: Double

    var body: some View {
        VStack(alignment: .trailing) {
            Text("$\(price, format: .number.precision(.fractionLength(2)))")
            Text("\(changePercent > 0 ? "+" : "")\(changePercent, format: .percent)")
                .foregroundColor(changePercent > 0 ? .green : .red)
        }
    }
}
```

**Health & Fitness**: Heart rate indicators, step counters

```swift
@MainActor
@Animatable
struct HeartRateView: View {
    var bpm: Double

    @AnimatableIgnored
    var timestamp: Date
}
```

**Games**: Score animations, XP transitions, combo multipliers

**Productivity**: Timer countdowns, progress indicators

---

## Animation Types

### Timing Curve Animations

Control speed distribution with bezier curves:

```swift
.animation(.easeIn)        // Slow start
.animation(.easeOut)       // Slow end
.animation(.easeInOut)     // Slow start and end
.animation(.linear)        // Constant speed
```

**Custom duration**:

```swift
.animation(.easeInOut(duration: 0.8))
```

### Spring Animations

Physics-based animations with natural, organic motion:

```swift
.animation(.smooth)     // No bounce (default iOS 17+)
.animation(.snappy)     // Small bounce
.animation(.bouncy)     // Larger bounce
```

**Custom springs**:

```swift
.animation(.spring(duration: 0.6, bounce: 0.3))
```

**Parameters**:
- `duration`: Perceived animation duration
- `bounce`: Amount of bounce (0 = no bounce, 1 = very bouncy)

**Why springs**: Preserve velocity when interrupted, feel more natural and responsive

### Higher-Order Animations

Modify base animations:

```swift
// Delay
.animation(.spring.delay(0.5))

// Repeat
.animation(.easeInOut.repeatCount(3, autoreverses: true))
.animation(.linear.repeatForever(autoreverses: false))

// Speed
.animation(.spring.speed(2.0))  // 2x faster
```

---

## Transaction System

### withAnimation

Trigger animations with state changes:

```swift
withAnimation(.spring(duration: 0.6, bounce: 0.4)) {
    isExpanded.toggle()
    scale = 1.5
}
```

**Default animation (iOS 17+)**: `.smooth` spring

### Scoped Animations (iOS 17+)

Override parent animations for specific views:

```swift
Text("Fade")
    .opacity(isVisible ? 1 : 0)

Text("Scale")
    .scaleEffect(isVisible ? 1 : 0.5)
    .animation(.bouncy, value: isVisible) {
        $0.scaleEffect()  // Only animate scale, not opacity
    }
```

### Transaction Values

Read animation context:

```swift
.onChange(of: selected) {
    if Transaction.current.animation != nil {
        // Change was animated
    } else {
        // Change was immediate
    }
}
```

---

## Advanced Topics

### CustomAnimation Protocol

Implement custom animation algorithms:

```swift
protocol CustomAnimation {
    func animate<V: VectorArithmetic>(
        value: V,              // Delta vector: target - current
        time: TimeInterval,
        context: inout AnimationContext<V>
    ) -> V?

    func shouldMerge<V>(previous: Animation, value: V, time: TimeInterval, context: inout AnimationContext<V>) -> Bool
}
```

**Critical understanding**: The `value` parameter is the **delta vector** (target - current), not the target itself.

**Example**: Linear timing curve

```swift
struct LinearAnimation: CustomAnimation {
    let duration: TimeInterval

    func animate<V: VectorArithmetic>(
        value: V,
        time: TimeInterval,
        context: inout AnimationContext<V>
    ) -> V? {
        if time >= duration {
            return nil  // Animation finished
        }

        let progress = time / duration
        return value.scaled(by: progress)  // Scale the delta
    }
}
```

### Animation Merging Behavior

**Timing curves** (don't merge by default):
- New animation runs additively
- Both animations contribute to final value

**Springs** (merge and retarget):
- New animation incorporates current velocity
- Smooth transitions when interrupted
- Preserves momentum

**Why springs feel natural**: No sudden velocity changes when retargeting.

### Performance Optimization

**Built-in animatable attributes** run off main thread:
- `.scaleEffect()`, `.opacity()`, `.rotationEffect()`, `.offset()`
- Don't call view's `body`
- Minimal performance impact

**Custom `animatableData`** runs on main thread:
- Every intermediate value triggers `body` computation
- Can cause dropped frames if `body` is expensive
- Optimize by caching computed values

---

## Troubleshooting

### Property Doesn't Animate

**Cause**: Property type doesn't conform to `VectorArithmetic`

**Solution**:
```swift
// ❌ Int doesn't animate
@State private var count: Int = 0

// ✅ Use Float/Double
@State private var count: Float = 0
Text("\(Int(count))")  // Display as Int
```

### Wrong Property Animates

**Symptom**: Unexpected values trigger animation

**Solution**: Check `.animation(value:)` parameter matches animated property:

```swift
// ❌ Animates when title changes
.animation(.spring, value: title)

// ✅ Animates when progress changes
.animation(.spring, value: progress)
```

### Animation Stutters

**Cause 1**: Expensive `body` computation with custom `animatableData`

**Solution**: Cache heavy computations outside the animation path

**Cause 2**: Too many simultaneous animations

**Solution**: Profile with Instruments SwiftUI Instrument (iOS 26+)

### Unexpected Merging

**Symptom**: Spring animation behavior changes when interrupted

**Cause**: Springs merge by default, preserving velocity

**Solution**: Use timing curve if you don't want merging:

```swift
// ❌ Merges with previous
withAnimation(.spring) { scale = 1.0 }

// ✅ Starts fresh (additive)
withAnimation(.easeInOut(duration: 0.5)) { scale = 1.0 }
```

---

## Related WWDC Sessions

- [Animate with springs (2023/10158)](https://developer.apple.com/videos/play/wwdc2023/10158/) — Spring animation deep dive
- [Demystify SwiftUI performance (2023/10160)](https://developer.apple.com/videos/play/wwdc2023/10160/) — Animation performance patterns
- [What's new in SwiftUI (2023/10156)](https://developer.apple.com/videos/play/wwdc2023/10156/) — Animatable protocol, @Animatable macro preview
- [What's new in SwiftUI (2025/256)](https://developer.apple.com/videos/play/wwdc2025/256/) — @Animatable macro release

---

## See Also

- **swiftui-26-ref** — iOS 26 SwiftUI features including @Animatable macro
- **swiftui-performance** — SwiftUI performance optimization with Instruments
- **swiftui-debugging** — Debugging SwiftUI view updates and animation issues
