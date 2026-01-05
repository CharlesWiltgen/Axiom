---
name: swiftui-animation-ref
description: Comprehensive SwiftUI animation API reference from iOS 13 through iOS 26
skill_type: reference
version: 1.1
---

# SwiftUI Animation Reference

Comprehensive API reference for SwiftUI animation. Covers VectorArithmetic, Animatable protocol, @Animatable macro, animation types, zoom transitions, and UIKit bridging.

## When to Use This Reference

Use this reference when you need:
- Understanding VectorArithmetic and Animatable requirements
- @Animatable macro usage (iOS 26+)
- Animation type options (spring, timing curves)
- Zoom transition implementation
- UIKit/AppKit animation bridging
- Custom animation algorithms

**For debugging:** See [swiftui-debugging](/skills/ui-design/swiftui-debugging) for animation issues.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "Why can't I animate an Int property?"
- "How do I use the @Animatable macro in iOS 26?"
- "What's the difference between Animation.spring and Animation.bouncy?"
- "How do I implement a zoom navigation transition?"
- "How do I use SwiftUI animations with UIView?"
- "What is VectorArithmetic and why does it matter?"

## What's Covered

### VectorArithmetic Protocol
- Required operations for interpolation
- Built-in conforming types (CGFloat, Double, CGPoint, etc.)
- Why Int can't be animated
- Creating custom animatable types

### Animatable Protocol (iOS 13+)
- animatableData property requirement
- AnimatablePair for multiple values
- Manual conformance patterns

### @Animatable Macro (iOS 26+)
- Automatic animatableData synthesis
- @AnimatableIgnored for excluded properties
- When to use macro vs manual conformance

### Animation Types
- Spring animations (default since iOS 17)
- Timing curves (linear, easeIn, easeOut, easeInOut)
- Custom timing with UnitCurve
- Higher-order animations (repeatForever, delay)

### Transaction System
- withAnimation and explicit animations
- Scoped animations (iOS 17+)
- Transaction customization

### Zoom Transitions (iOS 18+)
- NavigationTransition.zoom
- matchedTransitionSource modifier
- Full-screen zoom presentations

### UIKit/AppKit Bridging (iOS 18+)
- animate(with:) for UIView
- Applying SwiftUI animation curves to UIKit
- Gesture-driven animations

### Performance
- Off-main-thread rendering
- Complex shape optimization
- When to use drawingGroup

## Key Pattern

### Custom Animatable Type

```swift
// iOS 13-25: Manual conformance
struct GradientPosition: Animatable {
    var startX: CGFloat
    var startY: CGFloat

    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(startX, startY) }
        set {
            startX = newValue.first
            startY = newValue.second
        }
    }
}

// iOS 26+: Automatic with macro
@Animatable
struct GradientPosition {
    var startX: CGFloat
    var startY: CGFloat
    @AnimatableIgnored var name: String  // Not animated
}
```

### Animation Types

```swift
// Default spring (iOS 17+)
.animation(.spring, value: isExpanded)

// Bouncy spring
.animation(.bouncy, value: isExpanded)

// Smooth spring
.animation(.smooth, value: isExpanded)

// Timing curve
.animation(.easeInOut(duration: 0.3), value: isExpanded)
```

### Zoom Transition

```swift
// Source view
Image(item.image)
    .matchedTransitionSource(id: item.id, in: namespace)

// Destination with zoom
NavigationStack {
    DetailView()
}
.navigationTransition(.zoom(sourceID: item.id, in: namespace))
```

## Documentation Scope

This page documents the `axiom-swiftui-animation-ref` reference skill—comprehensive animation API coverage Claude uses when you need specific animation implementation details.

**For debugging:** See [swiftui-debugging](/skills/ui-design/swiftui-debugging) for animation-related issues.

## Related

- [swiftui-debugging](/skills/ui-design/swiftui-debugging) — View update and animation debugging
- [swiftui-performance](/skills/ui-design/swiftui-performance) — Animation performance optimization

## Resources

**WWDC**: 2023-10156 (Animate with springs), 2024-10145 (Enhance your animations), 2025-256 (SwiftUI 26)

**Docs**: /swiftui/animation, /swiftui/animatable
