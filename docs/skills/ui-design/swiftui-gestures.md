# swiftui-gestures

Comprehensive SwiftUI gesture patterns with composition, state management, and accessibility integration.

## When to Use

- Implementing tap, drag, long press, magnification, or rotation gestures
- Composing multiple gestures (simultaneously, sequenced, exclusively)
- Managing gesture state with GestureState
- Creating custom gesture recognizers
- Debugging gesture conflicts or unresponsive gestures
- Making gestures accessible with VoiceOver
- Cross-platform gesture handling (iOS, macOS, visionOS)

## Key Features

### Gesture Types
- **TapGesture** — Single and multi-tap recognition
- **DragGesture** — Pan and swipe interactions
- **LongPressGesture** — Press and hold actions
- **MagnificationGesture** — Pinch to zoom
- **RotationGesture** — Two-finger rotation

### Gesture Composition
- **Simultaneously** — Multiple gestures at once (drag + pinch)
- **Sequenced** — One after another (long press → drag)
- **Exclusively** — Only one wins (double-tap OR single-tap)

### State Management
- **GestureState** — Temporary state during gesture (auto-resets)
- **State** — Permanent committed values
- **Transaction** — Animation customization during gestures

### Advanced Patterns
- Custom gesture creation conforming to Gesture protocol
- Velocity and predicted end location
- Coordinate space handling (local, global, named)
- Performance optimization (minimize work in .onChanged)

### Accessibility
- VoiceOver integration with accessibilityAdjustableAction
- Keyboard alternatives for macOS
- Touch target size compliance
- Proper accessibility traits for custom gestures

### Cross-Platform
- iOS touch gestures
- macOS mouse and trackpad
- visionOS spatial gestures
- Platform-specific threshold tuning

## Common Pitfalls

1. **Using .onTapGesture instead of Button** — Prefer Button for standard tap actions
2. **Forgetting GestureState auto-reset** — Use GestureState for temporary state
3. **Gesture conflicts with ScrollView** — Use .simultaneousGesture appropriately
4. **Missing accessibility** — Add VoiceOver and keyboard support
5. **Wrong coordinate space** — Specify coordinateSpace for accurate locations

## Examples

### Basic Drag with GestureState
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
          state = value.translation
        }
        .onEnded { value in
          position.width += value.translation.width
          position.height += value.translation.height
        }
    )
}
```

### Composed Gestures (Drag + Pinch)
```swift
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
```

### Accessible Custom Gesture
```swift
Image("slider")
  .gesture(
    DragGesture()
      .onChanged { value in
        updateVolume(value.translation.width)
      }
  )
  .accessibilityElement()
  .accessibilityLabel("Volume")
  .accessibilityValue("\(Int(volume))%")
  .accessibilityAdjustableAction { direction in
    switch direction {
    case .increment: volume = min(100, volume + 5)
    case .decrement: volume = max(0, volume - 5)
    @unknown default: break
    }
  }
```

## Related Skills

- **accessibility-diag** — Making gestures accessible with VoiceOver
- **swiftui-performance** — Optimizing gesture performance
- **ui-testing** — Testing gesture interactions

## Resources

- [Composing SwiftUI Gestures](https://developer.apple.com/documentation/swiftui/composing-swiftui-gestures)
- [GestureState Documentation](https://developer.apple.com/documentation/swiftui/gesturestate)
- WWDC 2019-237: Building Custom Views with SwiftUI
