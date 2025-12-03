---
name: swiftui-layout
description: Use when layouts need to adapt to different screen sizes, iPad multitasking, or iOS 26 free-form windows — decision trees for ViewThatFits vs AnyLayout vs onGeometryChange
---

# SwiftUI Adaptive Layout

Discipline-enforcing skill for building layouts that respond to available space rather than device assumptions.

## Overview

Covers tool selection (ViewThatFits vs AnyLayout vs onGeometryChange), size class limitations on iPad, iOS 26 free-form windows, and common anti-patterns that break in multitasking.

## When to Use This Skill

- "How do I make this layout work on iPad and iPhone?"
- "Should I use GeometryReader or ViewThatFits?"
- "My layout breaks in Split View / Stage Manager"
- "Size classes aren't giving me what I need"
- "Designer wants different layout for portrait vs landscape"
- "Preparing app for iOS 26 window resizing"

## Key Patterns

### Tool Selection

| I need to... | Use this |
|-------------|----------|
| Pick between 2-3 layout variants | `ViewThatFits` |
| Switch H↔V with animation | `AnyLayout` |
| Read container size | `onGeometryChange` |
| Custom layout algorithm | `Layout` protocol |

### Anti-Patterns Prevented

- `UIDevice.current.orientation` — Reports device, not window
- `UIScreen.main.bounds` — Wrong in multitasking
- `UIDevice.current.userInterfaceIdiom == .pad` — iPad in 1/3 Split View is narrower than iPhone
- Unconstrained `GeometryReader` — Greedy sizing breaks siblings
- Size class as orientation proxy — iPad is `.regular` in both orientations

## iOS 26 Changes

- **Free-form window resizing** — Users can drag to resize windows anywhere
- **`UIRequiresFullScreen` deprecated** — Apps must handle resizing
- **Menu bar on iPad** — Via SwiftUI `.commands`
- **NavigationSplitView auto-adapts** — Columns show/hide automatically

## Related Resources

- [swiftui-layout-ref](/reference/swiftui-layout-ref) — Complete API reference
- [swiftui-debugging](/skills/ui-design/swiftui-debugging) — View update diagnostics
- [WWDC 2025: Elevate the design of your iPad app](https://developer.apple.com/videos/play/wwdc2025/208/)
- [WWDC 2024: Get started with Dynamic Type](https://developer.apple.com/videos/play/wwdc2024/10074/)
