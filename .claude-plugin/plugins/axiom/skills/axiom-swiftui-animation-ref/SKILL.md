---
name: axiom-swiftui-animation-ref
description: Use when implementing SwiftUI animations, understanding VectorArithmetic, using @Animatable macro, zoom transitions, UIKit/AppKit animation bridging, choosing between spring and timing curve animations, or debugging animation behavior - comprehensive animation reference from iOS 13 through iOS 26
license: MIT
metadata:
  version: "1.1.0"
---

# SwiftUI Animation

## Overview

Comprehensive guide to SwiftUI's animation system, from foundational concepts to advanced techniques. This skill covers the Animatable protocol, the iOS 26 @Animatable macro, animation types, and the Transaction system.

**Core principle** Animation in SwiftUI is mathematical interpolation over time, powered by the VectorArithmetic protocol. Understanding this foundation unlocks the full power of SwiftUI's declarative animation system.

## System Requirements

- iOS 13+: Animatable protocol, timing/spring animations
- iOS 17+: Default spring animations, scoped animations, PhaseAnimator, KeyframeAnimator
- iOS 18+: Zoom transitions, UIKit/AppKit animation bridging
- iOS 26+: @Animatable macro

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

SwiftUI requires animated data to conform to `VectorArithmetic` — providing subtraction, scaling, addition, and a zero value. This enables SwiftUI to interpolate between any two values.

**Built-in conforming types**: `CGFloat`, `Double`, `Float`, `Angle` (1D), `CGPoint`, `CGSize` (2D), `CGRect` (4D).

**Key insight** Vector arithmetic abstracts over dimensionality. SwiftUI animates all these types with a single generic implementation.

### Why Int Can't Be Animated

`Int` doesn't conform to VectorArithmetic — no fractional intermediates exist between 3 and 4. SwiftUI simply snaps the value.

**Solution**: Use `Float`/`Double` and display as `Int`:

```swift
@State private var count: Float = 0
// ...
Text("\(Int(count))")
    .animation(.spring, value: count)
```

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

When animating multiple properties, use `AnimatablePair` to combine vectors. For example, `scaleEffect` combines `CGSize` (2D) and `UnitPoint` (2D) into a 4D vector via `AnimatablePair<CGSize.AnimatableData, UnitPoint.AnimatableData>`. Access components via `.first` and `.second`. The `@Animatable` macro (iOS 26+) eliminates this boilerplate entirely.

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

**Custom Animatable conformance is expensive** — SwiftUI calls `body` for every frame on the main thread. Built-in effects (`.scaleEffect()`, `.opacity()`) run off-main-thread and don't call `body`. Use custom conformance only when built-in modifiers can't achieve the effect (e.g., animating a custom `Layout` that repositions subviews per-frame).

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

### Real-World Use Case

@Animatable works for any numeric display — stock prices, heart rate, scores, timers, progress bars:

```swift
@MainActor
@Animatable
struct AnimatedValueView: View {
    var value: Double
    var changePercent: Double

    @AnimatableIgnored
    var label: String

    var body: some View {
        VStack(alignment: .trailing) {
            Text("\(value, format: .number.precision(.fractionLength(2)))")
                .font(.title)
            Text("\(changePercent > 0 ? "+" : "")\(changePercent, format: .percent)")
                .foregroundStyle(changePercent > 0 ? .green : .red)
        }
    }
}

// Usage
AnimatedValueView(value: currentPrice, changePercent: 0.025, label: "Price")
    .animation(.spring(duration: 0.8), value: currentPrice)
```

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

Define custom `TransactionKey` types to propagate context through the transaction system. Use `withTransaction` to set values and `.transaction` modifier to read them. This enables applying different animations based on how a state change was triggered (tap vs programmatic).

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
        time: TimeInterval,
        context: inout AnimationContext<V>
    ) -> V? {
        if time >= duration { return nil }
        return value.scaled(by: time / duration)
    }
}
```

**Critical understanding**: `value` is the **delta vector** (target - current), not the target. Return `nil` when done. SwiftUI adds the scaled delta to the current value automatically.

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

---

## Part 7: Multi-Step Animations (iOS 17+)

### PhaseAnimator

Cycles through a sequence of phases, applying different modifiers at each phase. Each phase transition is independently animated.

```swift
PhaseAnimator([false, true]) { phase in
    Image(systemName: "star.fill")
        .scaleEffect(phase ? 1.5 : 1.0)
        .opacity(phase ? 1.0 : 0.5)
        .rotationEffect(.degrees(phase ? 360 : 0))
} animation: { phase in
    phase ? .spring(duration: 0.8, bounce: 0.3) : .easeInOut(duration: 0.4)
}
```

**How it works**: Begins at first phase, animates to second, then loops. The `animation` closure returns the animation used to transition INTO that phase. Phases can be any `Equatable` type — use an enum for complex multi-step sequences:

```swift
enum PulsePhase: CaseIterable { case idle, expand, contract }

PhaseAnimator(PulsePhase.allCases) { phase in
    Circle()
        .scaleEffect(phase == .expand ? 1.3 : phase == .contract ? 0.9 : 1.0)
}
```

**Trigger**: Add a `trigger` parameter to run the animation only when a value changes (instead of looping continuously).

### KeyframeAnimator

Provides per-property keyframe tracks for precise, timeline-based animations. More control than PhaseAnimator.

```swift
struct AnimationValues {
    var scale: Double = 1.0
    var rotation: Angle = .zero
    var yOffset: Double = 0
}

KeyframeAnimator(initialValue: AnimationValues()) { values in
    Image(systemName: "heart.fill")
        .scaleEffect(values.scale)
        .rotationEffect(values.rotation)
        .offset(y: values.yOffset)
} keyframes: { _ in
    KeyframeTrack(\.scale) {
        SpringKeyframe(1.5, duration: 0.3)
        SpringKeyframe(1.0, duration: 0.3)
    }
    KeyframeTrack(\.rotation) {
        LinearKeyframe(.degrees(15), duration: 0.15)
        LinearKeyframe(.degrees(-15), duration: 0.3)
        LinearKeyframe(.zero, duration: 0.15)
    }
    KeyframeTrack(\.yOffset) {
        CubicKeyframe(-20, duration: 0.3)
        CubicKeyframe(0, duration: 0.3)
    }
}
```

**Keyframe types**: `LinearKeyframe` (constant velocity), `SpringKeyframe` (spring physics), `CubicKeyframe` (bezier curves), `MoveKeyframe` (instant jump, no interpolation).

**vs PhaseAnimator**: Use PhaseAnimator for simple state cycling. Use KeyframeAnimator when different properties need independent timing.

### .transition()

Defines how a view animates when inserted/removed from the view hierarchy.

```swift
if showDetail {
    DetailView()
        .transition(.slide)                          // Slide in/out
        .transition(.scale.combined(with: .opacity)) // Combine transitions
        .transition(.move(edge: .bottom))            // Move from edge
        .transition(.asymmetric(                     // Different in/out
            insertion: .scale.combined(with: .opacity),
            removal: .opacity
        ))
}
```

**Requires animation context** — wrap the state change in `withAnimation` or use `.animation()` modifier. Without animation, the view appears/disappears instantly.

### matchedGeometryEffect

Smoothly animate a view's frame between two positions in the hierarchy. Commonly used for hero transitions and shared element animations.

```swift
@Namespace private var animation

// Source
if !isExpanded {
    RoundedRectangle(cornerRadius: 10)
        .matchedGeometryEffect(id: "card", in: animation)
        .frame(width: 100, height: 100)
}

// Destination
if isExpanded {
    RoundedRectangle(cornerRadius: 20)
        .matchedGeometryEffect(id: "card", in: animation)
        .frame(width: 300, height: 400)
}
```

**Key rules**: Same `id` + same `Namespace` = matched pair. Only one view with a given ID should be `isSource: true` (default) at a time. Wrap state change in `withAnimation` for smooth interpolation.

### contentTransition

Animates changes to text and symbol content within a view (iOS 16+).

```swift
Text(value, format: .number)
    .contentTransition(.numericText(countsDown: value < previous))

Image(systemName: isFavorite ? "heart.fill" : "heart")
    .contentTransition(.symbolEffect(.replace))
```

---

## Part 8: Zoom Transitions (iOS 18+)

### Overview

iOS 18 introduces the zoom transition, where a tapped cell morphs into the incoming view. This transition is continuously interactive—users can grab and drag the view during or after the transition begins.

**Key benefit** In parts of your app where you transition from a large cell, zoom transitions increase visual continuity by keeping the same UI elements on screen across the transition.

### SwiftUI Implementation

Two steps to adopt zoom transitions:

#### Step 1: Declare the transition style on the destination

```swift
NavigationLink {
    BraceletEditor(bracelet)
        .navigationTransition(.zoom(sourceID: bracelet.id, in: namespace))
} label: {
    BraceletPreview(bracelet)
}
```

#### Step 2: Mark the source view

```swift
BraceletPreview(bracelet)
    .matchedTransitionSource(id: bracelet.id, in: namespace)
```

#### Complete example

```swift
struct BraceletListView: View {
    @Namespace private var braceletList
    let bracelets: [Bracelet]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))]) {
                    ForEach(bracelets) { bracelet in
                        NavigationLink {
                            BraceletEditor(bracelet: bracelet)
                                .navigationTransition(
                                    .zoom(sourceID: bracelet.id, in: braceletList)
                                )
                        } label: {
                            BraceletPreview(bracelet: bracelet)
                        }
                        .matchedTransitionSource(id: bracelet.id, in: braceletList)
                    }
                }
            }
        }
    }
}
```

### UIKit Implementation

Set `preferredTransition = .zoom { context in ... }` on the pushed view controller. The closure returns the source view and is called on both zoom in and zoom out — capture a stable identifier (model object), not a view directly.

### Presentations

Zoom transitions also work with `fullScreenCover` and `sheet`:

```swift
.fullScreenCover(item: $selectedBracelet) { bracelet in
    BraceletEditor(bracelet: bracelet)
        .navigationTransition(.zoom(sourceID: bracelet.id, in: namespace))
}
```

### Styling the Source View

```swift
.matchedTransitionSource(id: bracelet.id, in: namespace) { source in
    source.cornerRadius(8.0).shadow(radius: 4)
}
```

### Fluid Transition Lifecycle

Push transitions cannot be cancelled — when interrupted, they convert to pop transitions. The view controller always reaches the Appeared state. Don't guard against overlapping transitions; let the system handle them.

---

## Part 9: UIKit/AppKit Animation Bridging (iOS 18+)

### Overview

iOS 18 enables using SwiftUI `Animation` types to animate UIKit and AppKit views. This provides access to the full suite of SwiftUI animations, including custom animations.

### Basic Usage

```swift
// Old way
UIView.animate(withDuration: 0.5, delay: 0,
               usingSpringWithDamping: 0.7, initialSpringVelocity: 0.5) {
    bead.center = endOfBracelet
}

// New way: Use SwiftUI Animation type
UIView.animate(.spring(duration: 0.5)) {
    bead.center = endOfBracelet
}
```

All SwiftUI animations work: `.linear`, `.easeIn/Out`, `.spring`, `.smooth`, `.snappy`, `.bouncy`, `.repeatForever()`, and custom animations.

**Architecture note**: Unlike old UIKit APIs, no `CAAnimation` is generated — presentation values are animated directly.

---

## Part 10: UIViewRepresentable Animation Bridging (iOS 18+)

### The Problem

When wrapping UIKit views in SwiftUI, animations don't automatically bridge:

```swift
struct BeadBoxWrapper: UIViewRepresentable {
    @Binding var isOpen: Bool

    func updateUIView(_ box: BeadBox, context: Context) {
        // ❌ Animation on binding doesn't affect UIKit
        box.lid.center.y = isOpen ? -100 : 100
    }
}

// Usage
BeadBoxWrapper(isOpen: $isOpen)
    .animation(.spring, value: isOpen)  // No effect on UIKit view
```

### The Solution: context.animate()

Use `context.animate()` to bridge SwiftUI animations:

```swift
struct BeadBoxWrapper: UIViewRepresentable {
    @Binding var isOpen: Bool

    func makeUIView(context: Context) -> BeadBox {
        BeadBox()
    }

    func updateUIView(_ box: BeadBox, context: Context) {
        // ✅ Bridges animation from Transaction to UIKit
        context.animate {
            box.lid.center.y = isOpen ? -100 : 100
        }
    }
}
```

### How It Works

1. SwiftUI stores animation info in the current `Transaction`
2. `context.animate()` reads the Transaction's animation
3. Applies that animation to UIView changes in the closure
4. If no animation in Transaction, changes happen immediately (no animation)

### Key Behavior

```swift
context.animate {
    // Changes here
} completion: {
    // Called when animation completes
    // If not animated, called immediately inline
}
```

**Works whether animated or not** — safe to always use this pattern.

### Perfect Synchronization

A single animation running across SwiftUI Views and UIViews runs **perfectly in sync**. This enables seamless mixed hierarchies.

---

## Part 11: Gesture-Driven Animations (iOS 18+)

### Automatic Velocity Preservation

SwiftUI animations automatically preserve velocity through animation merging — no manual velocity calculation needed:

```swift
// UIKit with SwiftUI animations
func handlePan(_ gesture: UIPanGestureRecognizer) {
    switch gesture.state {
    case .changed:
        UIView.animate(.interactiveSpring) {
            bead.center = gesture.location(in: view)
        }
    case .ended:
        UIView.animate(.spring) {  // Inherits velocity automatically
            bead.center = endOfBracelet
        }
    default: break
    }
}

// Pure SwiftUI equivalent
DragGesture()
    .onChanged { value in
        withAnimation(.interactiveSpring) { position = value.location }
    }
    .onEnded { _ in
        withAnimation(.spring) { position = targetPosition }
    }
```

Each `.interactiveSpring` retargets the previous animation, and the final `.spring` inherits the accumulated velocity for smooth deceleration.

---

---

## Troubleshooting

### Property Not Animating

Check in order:
1. **Type conforms to VectorArithmetic?** — `Int` can't animate; use `Double`/`Float`
2. **Animation modifier present?** — Need `.animation(.spring, value: x)` or `withAnimation`
3. **Correct value tracked?** — `.animation(.spring, value: progress)` not `.animation(.spring, value: title)`
4. **View conforms to Animatable?** — Custom views need `@Animatable` (iOS 26+) or manual `animatableData`

### Animation Stuttering

Custom `Animatable` conformance calls `body` every frame on main thread. Use built-in effects (`.opacity()`, `.scaleEffect()`) when possible — they run off-main-thread. Profile with Instruments for complex cases.

### Unexpected Animation Merging

Spring animations merge by default, preserving velocity. Use timing curve animations (`.easeInOut`) if you don't want merging behavior. See **Animation Merging Behavior** section above.

---

## Resources

**WWDC**: 2023-10156, 2023-10157, 2023-10158, 2024-10145, 2025-256

**Docs**: /swiftui/animatable, /swiftui/animation, /swiftui/vectorarithmetic, /swiftui/transaction, /swiftui/view/navigationtransition(_:), /swiftui/view/matchedtransitionsource(id:in:configuration:), /uikit/uiview/animate(_:changes:completion:)

**Skills**: axiom-swiftui-26-ref, axiom-swiftui-nav-ref, axiom-swiftui-performance, axiom-swiftui-debugging, axiom-sf-symbols-ref

