---
name: axiom-swiftui-gestures
description: Use when implementing SwiftUI gestures (tap, drag, long press, magnification, rotation), composing gestures, managing gesture state, or debugging gesture conflicts - comprehensive patterns for gesture recognition, composition, accessibility, and cross-platform support
user-invocable: true
skill_type: discipline
version: 1.0.0
last_updated: 2025-12-07
apple_platforms: iOS 13+, macOS 10.15+, iPadOS 13+, axiom-visionOS 1.0+
xcode_version: Xcode 16+
---

# SwiftUI Gestures

Comprehensive guide to SwiftUI gesture recognition with composition patterns, state management, and accessibility integration.

## When to Use This Skill

- Implementing tap, drag, long press, magnification, or rotation gestures
- Composing multiple gestures (simultaneously, sequenced, exclusively)
- Managing gesture state with GestureState
- Creating custom gesture recognizers
- Debugging gesture conflicts or unresponsive gestures
- Making gestures accessible with VoiceOver
- Cross-platform gesture handling (iOS, macOS, axiom-visionOS)

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

#### 1. "My drag gesture isn't working - the view doesn't move when I drag it. How do I debug this?"
→ The skill covers DragGesture state management patterns and shows how to properly update view offset with @GestureState

#### 2. "I have both a tap gesture and a drag gesture on the same view. The tap works but the drag doesn't. How do I fix this?"
→ The skill demonstrates gesture composition with .simultaneously, .sequenced, and .exclusively to resolve gesture conflicts

#### 3. "I want users to long press before they can drag an item. How do I chain gestures together?"
→ The skill shows the .sequenced pattern for combining LongPressGesture with DragGesture in the correct order

#### 4. "My gesture state isn't resetting when the gesture ends. The view stays in the wrong position."
→ The skill covers @GestureState automatic reset behavior and the updating parameter for proper state management

#### 5. "VoiceOver users can't access features that require gestures. How do I make gestures accessible?"
→ The skill demonstrates .accessibilityAction patterns and providing alternative interactions for VoiceOver users

---

## Choosing the Right Gesture (Decision Tree)

```
What interaction do you need?

├─ Single tap/click?
│  └─ Use Button (preferred) or TapGesture
│
├─ Drag/pan movement?
│  └─ Use DragGesture
│
├─ Hold before action?
│  └─ Use LongPressGesture
│
├─ Pinch to zoom?
│  └─ Use MagnificationGesture
│
├─ Two-finger rotation?
│  └─ Use RotationGesture
│
├─ Multiple gestures together?
│  ├─ Both at same time? → .simultaneously
│  ├─ One after another? → .sequenced
│  └─ One OR the other? → .exclusively
│
└─ Complex custom behavior?
   └─ Create custom Gesture conforming to Gesture protocol
```

---

## Pattern 1: Basic Gesture Recognition

### TapGesture

#### ❌ WRONG (Custom tap on non-semantic view)
```swift
Text("Submit")
  .onTapGesture {
    submitForm()
  }
```

**Problems**:
- Not announced as button to VoiceOver
- No visual press feedback
- Doesn't respect accessibility settings

#### ✅ CORRECT (Use Button for tap actions)
```swift
Button("Submit") {
  submitForm()
}
.buttonStyle(.bordered)
```

**When to use TapGesture**: Only when you need tap *data* (location, count) or non-standard tap behavior:

```swift
Image("map")
  .onTapGesture(count: 2) { // Double-tap for details
    showDetails()
  }
  .onTapGesture { location in // Single tap to pin
    addPin(at: location)
  }
```

---

### DragGesture

#### ❌ WRONG (Direct state mutation in gesture)
```swift
@State private var offset = CGSize.zero

var body: some View {
  Circle()
    .offset(offset)
    .gesture(
      DragGesture()
        .onChanged { value in
          offset = value.translation // ❌ Updates every frame, causes jank
        }
    )
}
```

**Problems**:
- View updates on every drag event (60-120 times per second)
- No way to reset to original position
- Loses intermediate state if drag cancelled

#### ✅ CORRECT (Use GestureState for temporary state)
```swift
@GestureState private var dragOffset = CGSize.zero
@State private var position = CGSize.zero

var body: some View {
  Circle()
    .offset(x: position.width + dragOffset.width,
            y: position.height + dragOffset.height)
    .gesture(
      DragGesture()
        .updating($dragOffset) { value, state, _ in
          state = value.translation // Temporary during drag
        }
        .onEnded { value in
          position.width += value.translation.width // Commit final
          position.height += value.translation.height
        }
    )
}
```

**Why**: GestureState automatically resets to initial value when gesture ends, preventing state corruption.

---

### LongPressGesture

```swift
@GestureState private var isDetectingLongPress = false
@State private var completedLongPress = false

var body: some View {
  Text("Press and hold")
    .foregroundStyle(isDetectingLongPress ? .red : .blue)
    .gesture(
      LongPressGesture(minimumDuration: 1.0)
        .updating($isDetectingLongPress) { currentState, gestureState, _ in
          gestureState = currentState // Visual feedback during press
        }
        .onEnded { _ in
          completedLongPress = true // Action after hold
        }
    )
}
```

**Key parameters**:
- `minimumDuration`: How long to hold (default 0.5 seconds)
- `maximumDistance`: How far finger can move before cancelling (default 10 points)

---

### MagnificationGesture

```swift
@GestureState private var magnificationAmount = 1.0
@State private var currentZoom = 1.0

var body: some View {
  Image("photo")
    .scaleEffect(currentZoom * magnificationAmount)
    .gesture(
      MagnificationGesture()
        .updating($magnificationAmount) { value, state, _ in
          state = value.magnification
        }
        .onEnded { value in
          currentZoom *= value.magnification
        }
    )
}
```

**Platform notes**:
- iOS: Pinch gesture with two fingers
- macOS: Trackpad pinch
- visionOS: Pinch gesture in 3D space

---

### RotationGesture

```swift
@GestureState private var rotationAngle = Angle.zero
@State private var currentRotation = Angle.zero

var body: some View {
  Rectangle()
    .fill(.blue)
    .frame(width: 200, height: 200)
    .rotationEffect(currentRotation + rotationAngle)
    .gesture(
      RotationGesture()
        .updating($rotationAngle) { value, state, _ in
          state = value.rotation
        }
        .onEnded { value in
          currentRotation += value.rotation
        }
    )
}
```

---

## Pattern 2: Gesture Composition

### Simultaneous Gestures

#### Use when: Two gestures should work *at the same time*

```swift
@GestureState private var dragOffset = CGSize.zero
@GestureState private var magnificationAmount = 1.0

var body: some View {
  Image("photo")
    .offset(dragOffset)
    .scaleEffect(magnificationAmount)
    .gesture(
      DragGesture()
        .updating($dragOffset) { value, state, _ in
          state = value.translation
        }
        .simultaneously(with:
          MagnificationGesture()
            .updating($magnificationAmount) { value, state, _ in
              state = value.magnification
            }
        )
    )
}
```

**Use case**: Photo viewer where you can drag AND pinch-zoom at the same time.

---

### Sequenced Gestures

#### Use when: One gesture must *complete* before the next starts

```swift
@State private var isLongPressing = false
@GestureState private var dragOffset = CGSize.zero

var body: some View {
  Circle()
    .offset(dragOffset)
    .gesture(
      LongPressGesture(minimumDuration: 0.5)
        .onEnded { _ in
          isLongPressing = true
        }
        .sequenced(before:
          DragGesture()
            .updating($dragOffset) { value, state, _ in
              state = value.translation
            }
            .onEnded { _ in
              isLongPressing = false
            }
        )
    )
}
```

**Use case**: iOS Home Screen — long press to enter edit mode, *then* drag to reorder.

---

### Exclusive Gestures

#### Use when: Only *one* gesture should win, not both

```swift
var body: some View {
  Rectangle()
    .gesture(
      TapGesture(count: 2) // Double-tap
        .onEnded { _ in
          zoom()
        }
        .exclusively(before:
          TapGesture(count: 1) // Single tap
            .onEnded { _ in
              select()
            }
        )
    )
}
```

**Why**: Without `.exclusively`, double-tap triggers *both* single and double tap handlers.

**How it works**: SwiftUI waits to see if second tap comes. If yes → double tap wins. If no → single tap wins.

---

## Pattern 3: GestureState vs State

### When to Use Each

| Use Case | State Type | Why |
|----------|-----------|-----|
| Temporary feedback during gesture | `@GestureState` | Auto-resets when gesture ends |
| Final committed value | `@State` | Persists after gesture |
| Animation during gesture | `@GestureState` | Smooth transitions |
| Data persistence | `@State` | Survives view updates |

### Full Example: Draggable Card

```swift
struct DraggableCard: View {
  @GestureState private var dragOffset = CGSize.zero // Temporary
  @State private var position = CGSize.zero          // Permanent

  var body: some View {
    RoundedRectangle(cornerRadius: 12)
      .fill(.blue)
      .frame(width: 300, height: 200)
      .offset(
        x: position.width + dragOffset.width,
        y: position.height + dragOffset.height
      )
      .gesture(
        DragGesture()
          .updating($dragOffset) { value, state, transaction in
            state = value.translation

            // Enable animation for smooth feedback
            transaction.animation = .interactiveSpring()
          }
          .onEnded { value in
            // Commit final position with animation
            withAnimation(.spring()) {
              position.width += value.translation.width
              position.height += value.translation.height
            }
          }
      )
  }
}
```

**Key insight**: GestureState's third parameter `transaction` lets you customize animation during the gesture.

---

## Pattern 4: Custom Gestures

### When to Create Custom Gestures

- Need gesture behavior not provided by built-in gestures
- Want to encapsulate complex gesture logic
- Reusing gesture across multiple views

### Example: Swipe Gesture with Direction

```swift
struct SwipeGesture: Gesture {
  enum Direction {
    case left, right, up, down
  }

  let minimumDistance: CGFloat
  let coordinateSpace: CoordinateSpace

  init(minimumDistance: CGFloat = 50, coordinateSpace: CoordinateSpace = .local) {
    self.minimumDistance = minimumDistance
    self.coordinateSpace = coordinateSpace
  }

  // Value is the direction
  typealias Value = Direction

  // Body builds on DragGesture
  var body: AnyGesture<Direction> {
    DragGesture(minimumDistance: minimumDistance, coordinateSpace: coordinateSpace)
      .map { value in
        let horizontal = value.translation.width
        let vertical = value.translation.height

        if abs(horizontal) > abs(vertical) {
          return horizontal < 0 ? .left : .right
        } else {
          return vertical < 0 ? .up : .down
        }
      }
      .eraseToAnyGesture()
  }
}

// Usage
Text("Swipe me")
  .gesture(
    SwipeGesture()
      .onEnded { direction in
        switch direction {
        case .left: deleteItem()
        case .right: archiveItem()
        default: break
        }
      }
  )
```

---

## Pattern 5: Gesture Velocity and Prediction

### Accessing Velocity

```swift
@State private var velocity: CGSize = .zero

var body: some View {
  Circle()
    .gesture(
      DragGesture()
        .onEnded { value in
          // value.velocity is deprecated in iOS 18+
          // Use value.predictedEndLocation and time

          let timeDelta = value.time.timeIntervalSince(value.startLocation.time)
          let distance = value.translation

          velocity = CGSize(
            width: distance.width / timeDelta,
            height: distance.height / timeDelta
          )

          // Animate with momentum
          withAnimation(.interpolatingSpring(stiffness: 100, damping: 15)) {
            applyMomentum(velocity: velocity)
          }
        }
    )
}
```

### Predicted End Location (iOS 16+)

```swift
DragGesture()
  .onChanged { value in
    // Where gesture will likely end based on velocity
    let predicted = value.predictedEndLocation

    // Show preview of where item will land
    showPreview(at: predicted)
  }
```

**Use case**: Springy physics, momentum scrolling, throw animations.

---

## Pattern 6: Accessibility Integration

### Making Custom Gestures Accessible

#### ❌ WRONG (Gesture-only, no VoiceOver support)
```swift
Image("slider")
  .gesture(
    DragGesture()
      .onChanged { value in
        updateVolume(value.translation.width)
      }
  )
```

**Problem**: VoiceOver users can't adjust the slider.

#### ✅ CORRECT (Add accessibility actions)
```swift
@State private var volume: Double = 50

var body: some View {
  Image("slider")
    .gesture(
      DragGesture()
        .onChanged { value in
          volume = calculateVolume(from: value.translation.width)
        }
    )
    .accessibilityElement()
    .accessibilityLabel("Volume")
    .accessibilityValue("\(Int(volume))%")
    .accessibilityAdjustableAction { direction in
      switch direction {
      case .increment:
        volume = min(100, volume + 5)
      case .decrement:
        volume = max(0, volume - 5)
      @unknown default:
        break
      }
    }
}
```

**Why**: VoiceOver users can now swipe up/down to adjust volume without seeing or using the gesture.

### Keyboard Alternatives (macOS)

```swift
Rectangle()
  .gesture(
    DragGesture()
      .onChanged { value in
        move(by: value.translation)
      }
  )
  .onKeyPress(.upArrow) {
    move(by: CGSize(width: 0, height: -10))
    return .handled
  }
  .onKeyPress(.downArrow) {
    move(by: CGSize(width: 0, height: 10))
    return .handled
  }
  .onKeyPress(.leftArrow) {
    move(by: CGSize(width: -10, height: 0))
    return .handled
  }
  .onKeyPress(.rightArrow) {
    move(by: CGSize(width: 10, height: 0))
    return .handled
  }
```

---

## Pattern 7: Cross-Platform Gestures

### iOS vs macOS vs visionOS

| Gesture | iOS | macOS | visionOS |
|---------|-----|-------|----------|
| TapGesture | Tap with finger | Click with mouse/trackpad | Look + pinch |
| DragGesture | Drag with finger | Click and drag | Pinch and move |
| LongPressGesture | Long press | Click and hold | Long pinch |
| MagnificationGesture | Two-finger pinch | Trackpad pinch | Pinch with both hands |
| RotationGesture | Two-finger rotate | Trackpad rotate | Rotate with both hands |

### Platform-Specific Gestures

```swift
var body: some View {
  Image("photo")
    .gesture(
      #if os(iOS)
      DragGesture(minimumDistance: 10) // Smaller threshold for touch
      #elseif os(macOS)
      DragGesture(minimumDistance: 1) // Precise mouse control
      #else
      DragGesture(minimumDistance: 20) // Larger for spatial gestures
      #endif
        .onChanged { value in
          updatePosition(value.translation)
        }
    )
}
```

---

## Common Pitfalls

### Pitfall 1: Forgetting to Reset GestureState

#### ❌ WRONG
```swift
@State private var offset = CGSize.zero // Should be GestureState

var body: some View {
  Circle()
    .offset(offset)
    .gesture(
      DragGesture()
        .onChanged { value in
          offset = value.translation
        }
    )
}
```

**Problem**: When drag ends, offset stays at last value instead of resetting.

**Fix**: Use `@GestureState` for temporary state, or manually reset in `.onEnded`.

---

### Pitfall 2: Gesture Conflicts with ScrollView

#### ❌ WRONG (Drag gesture blocks scrolling)
```swift
ScrollView {
  ForEach(items) { item in
    ItemView(item)
      .gesture(
        DragGesture()
          .onChanged { _ in
            // Prevents scroll!
          }
      )
  }
}
```

**Fix**: Use `.highPriorityGesture()` or `.simultaneousGesture()` appropriately:

```swift
ScrollView {
  ForEach(items) { item in
    ItemView(item)
      .simultaneousGesture( // Allows both scroll and drag
        DragGesture()
          .onChanged { value in
            // Only trigger if horizontal swipe
            if abs(value.translation.width) > abs(value.translation.height) {
              handleSwipe(value)
            }
          }
      )
  }
}
```

---

### Pitfall 3: Using .gesture() Instead of Button

#### ❌ WRONG (Reimplementing button)
```swift
Text("Submit")
  .padding()
  .background(.blue)
  .foregroundStyle(.white)
  .clipShape(RoundedRectangle(cornerRadius: 8))
  .onTapGesture {
    submit()
  }
```

**Problems**:
- No press animation
- No accessibility traits
- Doesn't respect system button styling
- More code

#### ✅ CORRECT
```swift
Button("Submit") {
  submit()
}
.buttonStyle(.borderedProminent)
```

**When TapGesture is OK**: When you need tap *location* or multiple tap counts:
```swift
Canvas { context, size in
  // Draw canvas
}
.onTapGesture { location in
  addShape(at: location) // Need location data
}
```

---

### Pitfall 4: Not Handling Gesture Cancellation

#### ❌ WRONG (Assumes gesture always completes)
```swift
DragGesture()
  .onChanged { value in
    showPreview(at: value.location)
  }
  .onEnded { value in
    hidePreview()
    commitChange(at: value.location)
  }
```

**Problem**: If user drags outside bounds and gesture cancels, preview stays visible.

#### ✅ CORRECT (GestureState auto-resets)
```swift
@GestureState private var isDragging = false

var body: some View {
  content
    .gesture(
      DragGesture()
        .updating($isDragging) { _, state, _ in
          state = true
        }
        .onChanged { value in
          if isDragging {
            showPreview(at: value.location)
          }
        }
        .onEnded { value in
          commitChange(at: value.location)
        }
    )
    .onChange(of: isDragging) { _, newValue in
      if !newValue {
        hidePreview() // Cleanup when cancelled
      }
    }
}
```

---

### Pitfall 5: Forgetting coordinateSpace

#### ❌ WRONG (Location relative to view, not screen)
```swift
DragGesture()
  .onChanged { value in
    // value.location is relative to the gesture's view
    addAnnotation(at: value.location)
  }
```

**Problem**: If view is offset/scrolled, coordinates are wrong.

#### ✅ CORRECT (Specify coordinate space)
```swift
DragGesture(coordinateSpace: .named("container"))
  .onChanged { value in
    addAnnotation(at: value.location) // Relative to "container"
  }

// In parent:
ScrollView {
  content
}
.coordinateSpace(name: "container")
```

**Options**:
- `.local` — Relative to gesture's view (default)
- `.global` — Relative to screen
- `.named("name")` — Relative to named coordinate space

---

## Performance Considerations

### Minimize Work in .onChanged

#### ❌ SLOW
```swift
DragGesture()
  .onChanged { value in
    // Called 60-120 times per second!
    let position = complexCalculation(value.translation)
    updateDatabase(position) // ❌ I/O in gesture
    reloadAllViews() // ❌ Heavy work
  }
```

#### ✅ FAST
```swift
@GestureState private var dragOffset = CGSize.zero

var body: some View {
  content
    .offset(dragOffset) // Cheap - just layout
    .gesture(
      DragGesture()
        .updating($dragOffset) { value, state, _ in
          state = value.translation // Minimal work
        }
        .onEnded { value in
          // Heavy work once, not 120 times/second
          let finalPosition = complexCalculation(value.translation)
          updateDatabase(finalPosition)
        }
    )
}
```

### Use Transaction for Smooth Animations

```swift
DragGesture()
  .updating($dragOffset) { value, state, transaction in
    state = value.translation

    // Disable implicit animations during drag
    transaction.animation = nil
  }
  .onEnded { value in
    // Enable spring animation for final position
    withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
      commitPosition(value.translation)
    }
  }
```

**Why**: Animations during gesture can feel sluggish. Disable during drag, enable for final snap.

---

## Troubleshooting

### Gesture Not Recognizing

**Check**:
1. Is view interactive? (Some views like `Text` ignore gestures unless wrapped)
2. Is another gesture taking priority? (Use `.highPriorityGesture()` or `.simultaneousGesture()`)
3. Is view clipped? (Use `.contentShape()` to define tap area)
4. Is gesture too restrictive? (Check `minimumDistance`, `minimumDuration`)

```swift
// Fix unresponsive gesture
Text("Tap me")
  .frame(width: 100, height: 100)
  .contentShape(Rectangle()) // Define full tap area
  .onTapGesture {
    handleTap()
  }
```

### Gesture Conflicts with Navigation

```swift
NavigationLink(destination: DetailView()) {
  ItemRow(item)
    .simultaneousGesture( // Don't block navigation
      LongPressGesture()
        .onEnded { _ in
          showContextMenu()
        }
    )
}
```

### Gesture Breaking ScrollView

**Use horizontal-only gesture detection**:
```swift
ScrollView {
  ForEach(items) { item in
    ItemView(item)
      .simultaneousGesture(
        DragGesture()
          .onEnded { value in
            // Only trigger on horizontal swipe
            if abs(value.translation.width) > abs(value.translation.height) * 2 {
              if value.translation.width < 0 {
                deleteItem(item)
              }
            }
          }
      )
  }
}
```

---

## Testing Gestures

### UI Testing with Gestures

```swift
func testDragGesture() throws {
  let app = XCUIApplication()
  app.launch()

  let element = app.otherElements["draggable"]

  // Get start and end coordinates
  let start = element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
  let finish = element.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5))

  // Perform drag
  start.press(forDuration: 0.1, thenDragTo: finish)

  // Verify result
  XCTAssertTrue(app.staticTexts["Dragged"].exists)
}
```

### Manual Testing Checklist

- [ ] Gesture works on first interaction (no "warmup" needed)
- [ ] Gesture can be cancelled (drag outside bounds)
- [ ] Multiple rapid gestures work correctly
- [ ] Gesture works with VoiceOver enabled
- [ ] Gesture works on all target platforms (iOS/macOS/visionOS)
- [ ] Gesture doesn't block scrolling or navigation
- [ ] Gesture provides visual feedback during interaction
- [ ] Gesture respects accessibility settings (Reduce Motion)

---

## Resources

**WWDC**: 2019-237, 2020-10043, 2021-10018

**Docs**: /swiftui/composing-swiftui-gestures, /swiftui/gesturestate, /swiftui/gesture

**Skills**: axiom-accessibility-diag, axiom-swiftui-performance, axiom-ui-testing

---

**Remember**: Prefer built-in controls (Button, Slider) over custom gestures whenever possible. Gestures should enhance interaction, not replace standard controls.
