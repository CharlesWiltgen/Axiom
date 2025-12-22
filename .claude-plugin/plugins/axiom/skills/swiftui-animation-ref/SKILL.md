---
name: swiftui-animation-ref
description: Use when implementing SwiftUI animations, understanding VectorArithmetic, using @Animatable macro, choosing between spring and timing curve animations, or debugging animation behavior - comprehensive animation reference from iOS 13 through iOS 26
skill_type: reference
version: 1.0.0
---

# SwiftUI Animation

## Overview

Comprehensive guide to SwiftUI's animation system, from foundational concepts to advanced techniques. This skill covers the Animatable protocol, the iOS 26 @Animatable macro, animation types, and the Transaction system.

**Core principle** Animation in SwiftUI is mathematical interpolation over time, powered by the VectorArithmetic protocol. Understanding this foundation unlocks the full power of SwiftUI's declarative animation system.

## When to Use This Skill

- Implementing custom animated views or shapes
- Understanding why a property doesn't animate (Int vs Float/Double)
- Choosing between spring and timing curve animations
- Using the @Animatable macro (iOS 26+)
- Conforming views to the Animatable protocol
- Debugging animation merging behavior
- Optimizing animation performance
- Creating multi-step or complex animations
- Understanding model vs presentation values
- Implementing custom animation algorithms

## System Requirements

#### iOS 13+ for Animatable protocol
#### iOS 17+ for default spring animations, scoped animations
#### iOS 26+ for @Animatable macro

---

## Part 1: Understanding Animation

### What Is Interpolation

Animation is the process of generating intermediate values between a start and end state.

#### Example: Opacity animation

```swift
.opacity(0) → .opacity(1)
```

While this animation runs, SwiftUI computes intermediate values:

```
0.0 → 0.02 → 0.05 → 0.1 → 0.25 → 0.4 → 0.6 → 0.8 → 1.0
```

**How values are distributed**
- Determined by the animation's timing curve or velocity function
- Spring animations use physics simulation
- Timing curves use bezier curves
- Each animation type calculates values differently

### VectorArithmetic Protocol

SwiftUI requires animated data to conform to `VectorArithmetic`, which provides:

```swift
protocol VectorArithmetic {
    // Compute difference between two values
    static func - (lhs: Self, rhs: Self) -> Self

    // Scale values
    static func * (lhs: Self, rhs: Double) -> Self

    // Add values
    static func + (lhs: Self, rhs: Self) -> Self

    // Zero value
    static var zero: Self { get }
}
```

**Built-in conforming types**
- **1-dimensional**: `CGFloat`, `Double`, `Float`, `Angle`
- **2-dimensional**: `CGPoint`, `CGSize`
- **4-dimensional**: `CGRect`

**Key insight** Vector arithmetic abstracts over the dimensionality of animated data. SwiftUI can animate all these types with a single generic implementation.

### Why Int Can't Be Animated

`Int` does not conform to VectorArithmetic because:

1. **No fractional intermediate values** — There is no "3.5" between 3 and 4
2. **Not continuous** — Integers are discrete values
3. **Scaling doesn't make sense** — What does 5 × 0.5 mean for an integer?

#### What happens when you try

```swift
struct CounterView: View {
    @State private var count: Int = 0

    var body: some View {
        Text("\(count)")
            .animation(.spring, value: count)
    }
}
```

**Result**: SwiftUI simply replaces the old text with the new one. No interpolation occurs.

#### Solution: Use Float or Double

```swift
struct AnimatedCounterView: View {
    @State private var count: Float = 0

    var body: some View {
        Text("\(Int(count))")
            .animation(.spring, value: count)
    }
}
```

**Result**: SwiftUI interpolates `0.0 → ... → 100.0`, and you display the rounded integer at each frame.

### Model vs Presentation Values

Animatable attributes conceptually have two values:

#### Model Value
- The target value set by your code
- Updated immediately when state changes
- What you write in your view's body

#### Presentation Value
- The current interpolated value being rendered
- Updates frame-by-frame during animation
- What the user actually sees

**Example**

```swift
.scaleEffect(selected ? 1.5 : 1.0)
```

When `selected` becomes `true`:
- **Model value**: Immediately becomes `1.5`
- **Presentation value**: Interpolates `1.0 → 1.1 → 1.2 → 1.3 → 1.4 → 1.5` over time

---

## Part 2: Animatable Protocol

### Overview

The `Animatable` protocol allows views to animate their properties by defining which data should be interpolated.

```swift
protocol Animatable {
    associatedtype AnimatableData: VectorArithmetic

    var animatableData: AnimatableData { get set }
}
```

SwiftUI builds an animatable attribute for any view conforming to this protocol.

### Built-in Animatable Views

Many SwiftUI modifiers conform to Animatable:

#### Visual Effects
- `.scaleEffect()` — Animates scale transform
- `.rotationEffect()` — Animates rotation
- `.offset()` — Animates position offset
- `.opacity()` — Animates transparency
- `.blur()` — Animates blur radius
- `.shadow()` — Animates shadow properties

#### All Shape types
- `Circle`, `Rectangle`, `RoundedRectangle`
- `Capsule`, `Ellipse`, `Path`
- Custom `Shape` implementations

### AnimatablePair for Multi-Dimensional Data

When animating multiple properties, use `AnimatablePair` to combine vectors.

#### Example: scaleEffect implementation

```swift
struct ScaleEffectModifier: ViewModifier, Animatable {
    var scale: CGSize
    var anchor: UnitPoint

    // Combine two 2D vectors into one 4D vector
    var animatableData: AnimatablePair<CGSize.AnimatableData, UnitPoint.AnimatableData> {
        get {
            AnimatablePair(scale.animatableData, anchor.animatableData)
        }
        set {
            scale.animatableData = newValue.first
            anchor.animatableData = newValue.second
        }
    }

    func body(content: Content) -> some View {
        content.scaleEffect(scale, anchor: anchor)
    }
}
```

**How it works**
- `CGSize` is 2-dimensional (width, height)
- `UnitPoint` is 2-dimensional (x, y)
- `AnimatablePair` fuses them into a 4-dimensional vector
- SwiftUI interpolates all 4 values together

### Custom Animatable Conformance

#### When to use
- Animating custom layout (like RadialLayout)
- Animating custom drawing code
- Animating properties that affect shape paths

#### Example: Animated number view

```swift
struct AnimatableNumberView: View, Animatable {
    var number: Double

    var animatableData: Double {
        get { number }
        set { number = newValue }
    }

    var body: some View {
        Text("\(Int(number))")
            .font(.largeTitle)
    }
}

// Usage
AnimatableNumberView(number: value)
    .animation(.spring, value: value)
```

**How it works**
1. `number` changes from 0 to 100
2. SwiftUI calls `body` for every frame of the animation
3. Each frame gets a new `number` value: 0 → 5 → 15 → 30 → 55 → 80 → 100
4. Text updates to show the interpolated integer

### Performance Warning

**Custom Animatable conformance can be expensive.**

When you conform a view to Animatable:
- SwiftUI calls your view's `body` **for every frame of the animation**
- Layout is rerun every frame
- This happens on the main thread

**Built-in animatable effects** (like `.scaleEffect()`, `.opacity()`) are much more efficient:
- They run off the main thread
- They don't call your view's body
- They update only the rendering layer

**Guideline**
- Use built-in effects whenever possible
- Only use custom Animatable conformance if you can't achieve the effect with built-in modifiers
- Profile with Instruments if you have performance issues

#### Example: Circular layout animation

```swift
// This is expensive but necessary for animating along a circular path
@Animatable
struct RadialLayout: Layout {
    var offsetAngle: Angle

    var animatableData: Angle.AnimatableData {
        get { offsetAngle.animatableData }
        set { offsetAngle.animatableData = newValue }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        proposal.replacingUnspecifiedDimensions()
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let radius = min(bounds.width, bounds.height) / 2
        let center = CGPoint(x: bounds.midX, y: bounds.midY)
        let angleStep = Angle.degrees(360.0 / Double(subviews.count))

        for (index, subview) in subviews.enumerated() {
            let angle = offsetAngle + angleStep * Double(index)
            let x = center.x + radius * cos(angle.radians)
            let y = center.y + radius * sin(angle.radians)

            subview.place(at: CGPoint(x: x, y: y), anchor: .center, proposal: .unspecified)
        }
    }
}
```

**Why necessary**: Animating `offsetAngle` requires recalculating positions every frame. No built-in modifier can do this.

---

## Part 3: @Animatable Macro (iOS 26+)

### Overview

The `@Animatable` macro eliminates the boilerplate of manually conforming to the Animatable protocol.

**Before iOS 26**, you had to:
1. Manually conform to `Animatable`
2. Write `animatableData` getter and setter
3. Use `AnimatablePair` for multiple properties
4. Exclude non-animatable properties manually

**iOS 26+**, you just add `@Animatable`:

```swift
@MainActor
@Animatable
struct MyView: View {
    var scale: CGFloat
    var opacity: Double

    var body: some View {
        // ...
    }
}
```

The macro automatically:
- Generates `Animatable` conformance
- Inspects all stored properties
- Creates `animatableData` from VectorArithmetic-conforming properties
- Handles multi-dimensional data with `AnimatablePair`

### Before/After Comparison

#### Before @Animatable macro

```swift
struct HikingRouteShape: Shape {
    var startPoint: CGPoint
    var endPoint: CGPoint
    var elevation: Double
    var drawingDirection: Bool // Don't want to animate this

    // Tedious manual animatableData declaration
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

    func path(in rect: CGRect) -> Path {
        // Drawing code
    }
}
```

#### After @Animatable macro

```swift
@Animatable
struct HikingRouteShape: Shape {
    var startPoint: CGPoint
    var endPoint: CGPoint
    var elevation: Double

    @AnimatableIgnored
    var drawingDirection: Bool // Excluded from animation

    func path(in rect: CGRect) -> Path {
        // Drawing code
    }
}
```

**Lines of code**: 20 → 12 (40% reduction)

### @AnimatableIgnored

Use `@AnimatableIgnored` to exclude properties from animation.

#### When to use
- **Debug values** — Flags for development only
- **IDs** — Identifiers that shouldn't animate
- **Timestamps** — When the view was created/updated
- **Internal state** — Non-visual bookkeeping
- **Non-VectorArithmetic types** — Colors, strings, booleans

#### Example

```swift
@MainActor
@Animatable
struct ProgressView: View {
    var progress: Double // Animated
    var totalItems: Int // Animated (if Float, not if Int)

    @AnimatableIgnored
    var title: String // Not animated

    @AnimatableIgnored
    var startTime: Date // Not animated

    @AnimatableIgnored
    var debugEnabled: Bool // Not animated

    var body: some View {
        VStack {
            Text(title)
            ProgressBar(value: progress)
            if debugEnabled {
                Text("Started: \(startTime.formatted())")
            }
        }
    }
}
```

### Real-World Use Cases

Numeric animations are extremely common across app categories:

#### Fintech Apps
```swift
@MainActor
@Animatable
struct StockPriceView: View {
    var price: Double
    var changePercent: Double

    var body: some View {
        VStack(alignment: .trailing) {
            Text("$\(price, format: .number.precision(.fractionLength(2)))")
                .font(.title)
            Text("\(changePercent > 0 ? "+" : "")\(changePercent, format: .percent)")
                .foregroundColor(changePercent > 0 ? .green : .red)
        }
    }
}
```

**Use case**: Animate stock price changes, portfolio value, account balance transitions

#### Health & Fitness
```swift
@MainActor
@Animatable
struct HeartRateView: View {
    var bpm: Double

    @AnimatableIgnored
    var timestamp: Date

    var body: some View {
        VStack {
            Text("\(Int(bpm))")
                .font(.system(size: 60, weight: .bold))
            Text("BPM")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}
```

**Use case**: Heart rate indicators, step counters, calorie calculations, distance traveled

#### Games
```swift
@MainActor
@Animatable
struct ScoreView: View {
    var score: Float
    var multiplier: Float

    var body: some View {
        HStack {
            Text("\(Int(score))")
                .font(.largeTitle)
            Text("×\(multiplier, format: .number.precision(.fractionLength(1)))")
                .font(.title2)
                .foregroundColor(.orange)
        }
    }
}
```

**Use case**: Score animations, XP transitions, level progress, combo multipliers

#### Productivity Apps
```swift
@MainActor
@Animatable
struct TimerView: View {
    var remainingSeconds: Double

    var body: some View {
        let minutes = Int(remainingSeconds) / 60
        let seconds = Int(remainingSeconds) % 60

        Text(String(format: "%02d:%02d", minutes, seconds))
            .font(.system(.largeTitle, design: .monospaced))
    }
}
```

**Use case**: Progress bars, countdown timers, percentage indicators, task completion metrics

### Complete Example

```swift
struct ContentView: View {
    @State private var stockPrice: Double = 142.50

    var body: some View {
        VStack(spacing: 20) {
            StockPriceView(price: stockPrice, changePercent: 0.025)
                .animation(.spring(duration: 0.8), value: stockPrice)

            Button("Simulate Price Change") {
                stockPrice = Double.random(in: 130...160)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

@MainActor
@Animatable
struct StockPriceView: View {
    var price: Double
    var changePercent: Double

    var body: some View {
        VStack(alignment: .trailing) {
            Text("$\(price, format: .number.precision(.fractionLength(2)))")
                .font(.title)
                .fontWeight(.semibold)

            Text("\(changePercent > 0 ? "+" : "")\(changePercent, format: .percent.precision(.fractionLength(2)))")
                .font(.subheadline)
                .foregroundColor(changePercent > 0 ? .green : .red)
        }
    }
}
```

**Result**: Smooth, natural animation of stock price changes that feels professional and polished.

---

## Part 4: Animation Types

### Timing Curve Animations

Timing curve animations use bezier curves to control the speed of animation over time.

#### Built-in presets

```swift
.animation(.linear)          // Constant speed
.animation(.easeIn)          // Starts slow, ends fast
.animation(.easeOut)         // Starts fast, ends slow
.animation(.easeInOut)       // Slow start and end, fast middle
```

#### Custom timing curves

```swift
let customCurve = UnitCurve(
    startControlPoint: CGPoint(x: 0.2, y: 0),
    endControlPoint: CGPoint(x: 0.8, y: 1)
)

.animation(.timingCurve(customCurve, duration: 0.5))
```

#### Duration

All timing curve animations accept an optional duration:

```swift
.animation(.easeInOut(duration: 0.3))
.animation(.linear(duration: 1.0))
```

**Default**: 0.35 seconds

### Spring Animations

Spring animations use physics simulation to create natural, organic motion.

#### Built-in presets

```swift
.animation(.smooth)     // No bounce (default since iOS 17)
.animation(.snappy)     // Small amount of bounce
.animation(.bouncy)     // Larger amount of bounce
```

#### Custom springs

```swift
.animation(.spring(duration: 0.6, bounce: 0.3))
```

**Parameters**
- `duration` — Perceived animation duration
- `bounce` — Amount of bounce (0 = no bounce, 1 = very bouncy)

**Much more intuitive** than traditional spring parameters (mass, stiffness, damping).

### Higher-Order Animations

Modify base animations to create complex effects.

#### Delay

```swift
.animation(.spring.delay(0.5))
```

Waits 0.5 seconds before starting the animation.

#### Repeat

```swift
.animation(.easeInOut.repeatCount(3, autoreverses: true))
.animation(.linear.repeatForever(autoreverses: false))
```

Repeats the animation multiple times or infinitely.

#### Speed

```swift
.animation(.spring.speed(2.0))  // 2x faster
.animation(.spring.speed(0.5))  // 2x slower
```

Multiplies the animation speed.

### Default Animation Changes (iOS 17+)

**Before iOS 17**
```swift
withAnimation {
    // Used timing curve by default
}
```

**iOS 17+**
```swift
withAnimation {
    // Uses .smooth spring by default
}
```

**Why the change**: Spring animations feel more natural and preserve velocity when interrupted.

**Recommendation**: Embrace springs. They make your UI feel more responsive and polished.

---

## Part 5: Transaction System

### withAnimation

The most common way to trigger an animation.

```swift
Button("Scale Up") {
    withAnimation(.spring) {
        scale = 1.5
    }
}
```

**How it works**
1. `withAnimation` opens a transaction
2. Sets the animation in the transaction dictionary
3. Executes the closure (state changes)
4. Transaction propagates down the view hierarchy
5. Animatable attributes check for animation and interpolate

#### Explicit animation

```swift
withAnimation(.spring(duration: 0.6, bounce: 0.4)) {
    isExpanded.toggle()
}
```

#### No animation

```swift
withAnimation(nil) {
    // Changes happen immediately, no animation
    resetState()
}
```

### animation() View Modifier

Apply animations to specific values within a view.

#### Basic usage

```swift
Circle()
    .fill(isActive ? .blue : .gray)
    .animation(.spring, value: isActive)
```

**How it works**: Animation only applies when `isActive` changes. Other state changes won't trigger this animation.

#### Multiple animations on same view

```swift
Circle()
    .scaleEffect(scale)
    .animation(.bouncy, value: scale)
    .opacity(opacity)
    .animation(.easeInOut, value: opacity)
```

Different animations for different properties.

### Scoped Animations (iOS 17+)

Narrowly scope animations to specific animatable attributes.

#### Problem with old approach

```swift
struct AvatarView: View {
    var selected: Bool

    var body: some View {
        Image("avatar")
            .scaleEffect(selected ? 1.5 : 1.0)
            .animation(.spring, value: selected)
            // ⚠️ If image also changes when selected changes,
            //    image transition gets animated too (accidental)
    }
}
```

#### Solution: Scoped animation

```swift
struct AvatarView: View {
    var selected: Bool

    var body: some View {
        Image("avatar")
            .animation(.spring, value: selected) {
                $0.scaleEffect(selected ? 1.5 : 1.0)
            }
            // ✅ Only scaleEffect animates, image transition doesn't
    }
}
```

**How it works**
- Animation only applies to attributes in the closure
- Other attributes are unaffected
- Prevents accidental animations

### Custom Transaction Keys

Define your own transaction values to propagate custom context.

#### Define a key

```swift
struct AvatarTappedKey: TransactionKey {
    static let defaultValue: Bool = false
}

extension Transaction {
    var avatarTapped: Bool {
        get { self[AvatarTappedKey.self] }
        set { self[AvatarTappedKey.self] = newValue }
    }
}
```

#### Set value in transaction

```swift
var transaction = Transaction()
transaction.avatarTapped = true

withTransaction(transaction) {
    isSelected.toggle()
}
```

#### Read value in view

```swift
.transaction { transaction in
    if transaction.avatarTapped {
        transaction.animation = .bouncy
    } else {
        transaction.animation = .smooth
    }
}
```

**Use case**: Apply different animations based on how the state change was triggered (tap vs programmatic).

---

## Part 6: Advanced Topics

### CustomAnimation Protocol

Implement your own animation algorithms.

```swift
protocol CustomAnimation {
    // Calculate current value
    func animate<V: VectorArithmetic>(
        value: V,
        time: TimeInterval,
        context: inout AnimationContext<V>
    ) -> V?

    // Optional: Should this animation merge with previous?
    func shouldMerge<V>(previous: Animation, value: V, time: TimeInterval, context: inout AnimationContext<V>) -> Bool

    // Optional: Current velocity
    func velocity<V: VectorArithmetic>(
        value: V,
        time: TimeInterval,
        context: AnimationContext<V>
    ) -> V?
}
```

#### Example: Linear timing curve

```swift
struct LinearAnimation: CustomAnimation {
    let duration: TimeInterval

    func animate<V: VectorArithmetic>(
        value: V,              // Delta vector: target - current
        time: TimeInterval,    // Elapsed time since animation started
        context: inout AnimationContext<V>
    ) -> V? {
        // Animation is done when time exceeds duration
        if time >= duration {
            return nil
        }

        // Calculate linear progress (0.0 to 1.0)
        let progress = time / duration

        // Scale the delta vector by progress
        // This returns how much to move FROM current position
        // NOT the final target position
        return value.scaled(by: progress)
    }
}
```

**Critical understanding**: The `value` parameter is the **delta vector** (target - current), not the target value itself.

**Example in practice**:
- Current position: `10.0`
- Target position: `100.0`
- Delta vector passed to `animate()`: `90.0` (target - current)
- At 50% progress: `return value.scaled(by: 0.5)` → returns `45.0`
- SwiftUI adds this to current: `10.0 + 45.0 = 55.0` (halfway to target) ✅

**Common mistake**:
```swift
// ❌ WRONG: Treating value as the target
let progress = time / duration
return value.scaled(by: progress) // This assumes value is delta

// ❌ WRONG: Trying to interpolate manually
let target = value // No! value is already the delta
return current + (target - current) * progress // Incorrect

// ✅ CORRECT: Scale the delta
return value.scaled(by: progress) // SwiftUI handles the addition
```

### Animation Merging Behavior

What happens when a new animation starts before the previous one finishes?

#### Timing curve animations (default: don't merge)

```swift
func shouldMerge(...) -> Bool {
    return false // Default implementation
}
```

**Behavior**: Both animations run together, results are combined additively.

**Example**
- First tap: animate 1.0 → 1.5 (running)
- Second tap (before finish): animate 1.5 → 1.0
- Result: Both animations run, values combine

#### Spring animations (merge and retarget)

```swift
func shouldMerge(...) -> Bool {
    return true // Springs override this
}
```

**Behavior**: New animation incorporates state of previous animation, preserving velocity.

**Example**
- First tap: animate 1.0 → 1.5 with velocity V
- Second tap (before finish): retarget to 1.0, preserving current velocity V
- Result: Smooth transition, no sudden velocity change

**Why springs feel more natural**: They preserve momentum when interrupted.

### Off-Main-Thread Performance

Built-in animatable attributes run efficiently:

```swift
.scaleEffect(scale)
.opacity(opacity)
.rotationEffect(angle)
```

**Benefits**
- Runs off the main thread
- Doesn't call your view's `body`
- Minimal performance impact

**Custom Animatable conformance** runs on main thread:

```swift
@MainActor
@Animatable
struct MyView: View {
    var value: Double

    var animatableData: Double {
        get { value }
        set { value = newValue }
    }

    var body: some View {
        // Called every frame! (main thread)
    }
}
```

**Performance tip**: Profile with Instruments if you have many custom animatable views.

### Delta Vector Logic

SwiftUI animates the *difference* between values, not the values themselves.

#### Example: Scale effect

```swift
// User taps, scale changes from 1.0 to 1.5
.scaleEffect(isSelected ? 1.5 : 1.0)
```

**What SwiftUI actually animates**
- Delta vector: 1.5 - 1.0 = 0.5
- Animation interpolates: 0.0 → 0.1 → 0.2 → 0.3 → 0.4 → 0.5
- Final value: 1.0 + interpolated delta

**Why this matters**
- Makes animation merging easier
- Allows additive combination of animations
- Simplifies CustomAnimation implementations

---

## Troubleshooting

### Property Not Animating

**Symptom**: Property changes but doesn't animate.

#### Cause 1: Type doesn't conform to VectorArithmetic

```swift
@State private var count: Int = 0 // ❌ Int doesn't animate

// Solution
@State private var count: Double = 0 // ✅ Double animates
Text("\(Int(count))") // Display as Int
```

#### Cause 2: Missing animation modifier

```swift
// ❌ No animation specified
Text("\(value)")

// ✅ Add animation
Text("\(value)")
    .animation(.spring, value: value)
```

#### Cause 3: Wrong value in animation modifier

```swift
struct ProgressView: View {
    @State private var progress: Double = 0
    @State private var title: String = "Loading"

    var body: some View {
        VStack {
            Text(title)
            ProgressBar(value: progress)
        }
        .animation(.spring, value: title) // ❌ Animates when title changes, not progress
    }
}

// Solution
.animation(.spring, value: progress) // ✅
```

#### Cause 4: View doesn't conform to Animatable

If you have a custom view with animatable properties:

```swift
// ❌ Missing Animatable conformance
struct MyView: View {
    var value: Double
    var body: some View { ... }
}

// ✅ Add @Animatable macro (iOS 26+)
@MainActor
@Animatable
struct MyView: View {
    var value: Double
    var body: some View { ... }
}

// ✅ OR manual conformance (iOS 13+)
struct MyView: View, Animatable {
    var value: Double
    var animatableData: Double {
        get { value }
        set { value = newValue }
    }
    var body: some View { ... }
}
```

### Animation Stuttering

**Symptom**: Animation is choppy or drops frames.

#### Cause 1: Expensive body computation

```swift
@MainActor
@Animatable
struct ExpensiveView: View {
    var value: Double

    var animatableData: Double {
        get { value }
        set { value = newValue }
    }

    var body: some View {
        // ❌ Called every frame!
        let heavyComputation = performExpensiveWork(value)
        return Text("\(heavyComputation)")
    }
}
```

**Solution**: Use built-in effects instead

```swift
struct OptimizedView: View {
    @State private var value: Double = 0

    var body: some View {
        Text("\(computeOnce(value))")
            .opacity(value) // ✅ Built-in effect, off-main-thread
    }
}
```

#### Cause 2: Too many simultaneous animations

Profile with Instruments to identify bottlenecks.

### Unexpected Animation Merging

**Symptom**: Animation behavior changes when interrupted.

**Cause**: Spring animations merge by default, preserving velocity from the previous animation.

**Solution**: Use a timing curve animation if you don't want merging behavior:

```swift
// ❌ Spring merges with previous animation
withAnimation(.spring) {
    scale = 1.0
}

// ✅ Timing curve starts fresh (additive, no merge)
withAnimation(.easeInOut(duration: 0.5)) {
    scale = 1.0
}
```

See **Animation Merging Behavior** section above for detailed explanation of merge vs additive animations.

---

## Related WWDC Sessions

### Primary Source
- **Explore SwiftUI animation** (WWDC 2023/10156) — Comprehensive animation architecture

### Complementary
- **Animate with springs** (WWDC 2023/10158) — Spring animation deep dive
- **Wind your way through advanced animations** (WWDC 2023/10157) — Multi-step animations
- **What's new in SwiftUI** (WWDC 2025/256) — @Animatable macro introduction

---

## Cross-References

### Axiom Skills
- SwiftUI 26 Features (swiftui-26-ref skill) — @Animatable macro iOS 26 introduction
- [SwiftUI Performance](/skills/ui-design/swiftui-performance) — Animation performance optimization
- [SwiftUI Debugging](/skills/ui-design/swiftui-debugging) — Debugging view updates

---

## Resources

### Apple Documentation
- [Animatable Protocol](https://developer.apple.com/documentation/swiftui/animatable)
- [Animation Structure](https://developer.apple.com/documentation/swiftui/animation)
- [VectorArithmetic Protocol](https://developer.apple.com/documentation/swiftui/vectorarithmetic)
- [Transaction Structure](https://developer.apple.com/documentation/swiftui/transaction)

### WWDC 2023 Sessions
- [Explore SwiftUI animation (Session 10156)](https://developer.apple.com/videos/play/wwdc2023/10156/)
- [Animate with springs (Session 10158)](https://developer.apple.com/videos/play/wwdc2023/10158/)

---

**Last Updated** Based on WWDC 2023/10156, WWDC 2025/256, and iOS 26 Beta
**Version** iOS 13+ (Animatable protocol), iOS 17+ (scoped animations), iOS 26+ (@Animatable macro)
