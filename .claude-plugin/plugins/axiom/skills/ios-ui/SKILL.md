---
name: ios-ui
description: Use when building, fixing, or improving ANY iOS UI including SwiftUI, UIKit, layout, navigation, animations, design guidelines. Covers view updates, layout bugs, navigation issues, performance, architecture, Apple design compliance.
---

# iOS UI Router

**You MUST use this skill for ANY iOS UI work including SwiftUI, UIKit, layout, navigation, animations, and design.**

## When to Use

Use this router when working with:
- SwiftUI views, state, bindings
- UIKit views and constraints
- Layout issues (Auto Layout, SwiftUI layout)
- Navigation (NavigationStack, deep linking)
- Animations and transitions
- Liquid Glass design (iOS 26+)
- Apple Human Interface Guidelines
- UI architecture and patterns
- Accessibility UI issues

## Conflict Resolution

**ios-ui vs ios-performance**: When UI is slow (e.g., "SwiftUI List slow"):
1. **Try ios-ui FIRST** — Domain-specific fixes (LazyVStack, view identity, @State optimization) often solve UI performance in 5 minutes
2. **Only use ios-performance** if domain fixes don't help — Profiling takes longer and may confirm what domain knowledge already knows

**Rationale**: Jumping to Instruments wastes time when the fix is a known SwiftUI pattern. Profile AFTER trying domain fixes, not before.

## Routing Logic

### SwiftUI Issues

**View not updating** → `/skill swiftui-debugging`
**Navigation issues** → `/skill swiftui-nav`
**Performance/lag** → `/skill swiftui-performance`
**Layout problems** → `/skill swiftui-layout`
**Animation issues** → `/skill swiftui-animation-ref`
**Gesture conflicts** → `/skill swiftui-gestures`
**Architecture/testability** → `/skill swiftui-architecture`
**iOS 26 features** → `/skill swiftui-26-ref`

### UIKit Issues

**Auto Layout conflicts** → `/skill auto-layout-debugging`
**Animation timing issues** → `/skill uikit-animation-debugging`

### Design & Guidelines

**Liquid Glass adoption** → `/skill liquid-glass`
**Design decisions** → `/skill hig`
**Typography** → `/skill typography-ref`
**TextKit/rich text** → `/skill textkit-ref`

### Accessibility

**VoiceOver, Dynamic Type** → `/skill accessibility-diag`

### Testing

**UI test flakiness** → `/skill ui-testing`

## Decision Tree

```
User asks about UI
  ├─ SwiftUI?
  │  ├─ View not updating? → swiftui-debugging
  │  ├─ Navigation? → swiftui-nav
  │  ├─ Performance? → swiftui-performance
  │  ├─ Layout? → swiftui-layout
  │  ├─ Architecture? → swiftui-architecture
  │  └─ Animations/gestures? → swiftui-animation-ref or swiftui-gestures
  │
  ├─ UIKit?
  │  ├─ Auto Layout? → auto-layout-debugging
  │  └─ Animations? → uikit-animation-debugging
  │
  ├─ Design guidelines?
  │  ├─ Liquid Glass? → liquid-glass
  │  ├─ HIG compliance? → hig
  │  └─ Typography? → typography-ref
  │
  └─ Accessibility? → accessibility-diag
```

## Example Invocations

User: "My SwiftUI view isn't updating when I change the model"
→ Invoke: `/skill swiftui-debugging`

User: "How do I implement Liquid Glass in my toolbar?"
→ Invoke: `/skill liquid-glass`

User: "NavigationStack is popping unexpectedly"
→ Invoke: `/skill swiftui-nav`

User: "Should I use MVVM for this SwiftUI app?"
→ Invoke: `/skill swiftui-architecture`
