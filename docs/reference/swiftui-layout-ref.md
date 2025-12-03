---
name: swiftui-layout-ref
description: Reference — Complete SwiftUI adaptive layout API guide covering ViewThatFits, AnyLayout, Layout protocol, onGeometryChange, GeometryReader, size classes, and iOS 26 window APIs
---

# SwiftUI Layout API Reference

Comprehensive API reference for SwiftUI adaptive layout tools.

## Overview

Complete guide to all SwiftUI layout APIs for building adaptive interfaces, based on WWDC 2022, 2024, and 2025 content.

## What This Reference Covers

### Container Selection
- **ViewThatFits** — Automatic variant selection (iOS 16+)
- **AnyLayout** — Type-erased animated layout switching (iOS 16+)
- **Layout Protocol** — Custom layout algorithms (iOS 16+)

### Geometry Reading
- **onGeometryChange** — Efficient geometry reading without layout side effects (iOS 16+ backported)
- **GeometryReader** — Layout-phase geometry access (iOS 13+)

### Trait-Based Adaptation
- **Size Classes** — horizontalSizeClass, verticalSizeClass
- **Dynamic Type** — dynamicTypeSize.isAccessibilitySize
- **ScaledMetric** — Scaled dimensions for accessibility

### iOS 26 Window APIs
- **Window resize anchor** — Control resize animation origin
- **Menu bar commands** — iPad menu bar via `.commands`
- **NavigationSplitView** — Automatic column visibility

## Key Patterns

### ViewThatFits
```swift
ViewThatFits {
    HStack { content }  // First choice
    VStack { content }  // Fallback
}
```

### AnyLayout
```swift
let layout = isCompact
    ? AnyLayout(VStackLayout())
    : AnyLayout(HStackLayout())
layout { content }
    .animation(.default, value: isCompact)
```

### onGeometryChange
```swift
.onGeometryChange(for: CGSize.self) { proxy in
    proxy.size
} action: { size in
    self.containerSize = size
}
```

## Size Class Truth Table (iPad)

| Configuration | Horizontal | Vertical |
|--------------|------------|----------|
| Full screen (any) | `.regular` | `.regular` |
| 70% Split View | `.regular` | `.regular` |
| 50% Split View | `.regular` | `.regular` |
| 33% Split View | `.compact` | `.regular` |
| Slide Over | `.compact` | `.regular` |

**Key insight:** Size class only goes `.compact` on iPad at ~33% width.

## Related Resources

- [swiftui-layout](/skills/ui-design/swiftui-layout) — Decision guidance and anti-patterns
- [Apple Documentation: Layout Protocol](https://developer.apple.com/documentation/swiftui/layout)
- [Apple Documentation: ViewThatFits](https://developer.apple.com/documentation/swiftui/viewthatfits)
