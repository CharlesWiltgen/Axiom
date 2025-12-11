---
name: swiftui-26-ref
description: All iOS 26 SwiftUI features — Liquid Glass, @Animatable macro, WebView, rich text, 3D charts, spatial layout, scene bridging
---

# SwiftUI 26 Features Reference

Comprehensive guide to iOS 26 SwiftUI features from WWDC 2025-256.

## Overview

Complete reference for new SwiftUI APIs, modifiers, and capabilities introduced in iOS 26. Covers Liquid Glass design system, performance improvements, WebView integration, rich text editing, 3D charts, and more.

## What's New in iOS 26

### Liquid Glass Design System

#### Material Design Evolution
- `.glassBackgroundEffect()` - New glass material modifier
- Regular vs Clear variants
- Dynamic tinting and vibrancy
- Replaces `UIVisualEffectView` and blur effects

#### Toolbar Enhancements
- `.toolbarRole(.navigationStack)` - Smart spacing
- Bottom-aligned search fields
- Drawer-style search placement
- `.searchFieldPlacement(.navigationBarDrawer(displayMode: .always))`

#### Tab Bar Improvements
- `.tabRole(.search)` - Search tab role
- Enhanced tab item customization
- Material-aware tab backgrounds

### Performance Improvements

#### Framework Optimizations
- 6x faster simple lists
- 16x faster complex lists
- Improved scrolling performance
- Nested ScrollView optimization
- Reduced memory footprint

#### SwiftUI Instrument (Instruments 26)
- Long view body detection
- Cause & Effect Graph
- Per-view performance metrics
- Update frequency tracking

### @Animatable Macro (iOS 26+)

```swift
@Animatable
struct CustomView: View {
    var progress: Double  // Auto-animatable!

    var body: some View {
        // View updates smoothly with .animation()
    }
}
```

#### Benefits
- Auto-generates animatable conformance
- Eliminates boilerplate
- Type-safe animation interpolation
- Works with custom property wrappers

### WebView Integration

#### Native WebView in SwiftUI
```swift
WebView(url: URL(string: "https://example.com")!)
    .onNavigationAction { action in
        // Handle navigation
    }
    .onLoadStatusChanged { status in
        // Track loading state
    }
```

#### WebPage for Custom HTML
```swift
WebPage(html: """
    <html><body>
        <h1>Hello SwiftUI</h1>
    </body></html>
""")
```

### Rich Text Editing

#### AttributedString Editing
```swift
TextEditor(text: $attributedString)
    .textFormatting([.bold, .italic, .underline])
    .textColor(\.foreground, color: .blue)
```

#### Features
- Inline formatting controls
- Character-level styling
- Markdown export
- Custom attributes

### 3D Charts

#### Spatial Chart Types
```swift
Chart3D {
    ForEach(data) { item in
        BarMark3D(x: .value("X", item.x),
                  y: .value("Y", item.y),
                  z: .value("Z", item.z))
    }
}
.chartPerspective(.orthographic)
```

#### Supported Types
- BarMark3D
- LineMark3D
- PointMark3D
- SurfaceMark3D

### Spatial Layout

#### 3D Layout System
```swift
SpatialStack {
    ForEach(items) { item in
        CardView(item)
            .offset3D(x: item.x, y: item.y, z: item.z)
    }
}
.perspective(.default)
```

#### Capabilities
- True 3D positioning
- Perspective transforms
- Depth sorting
- Touch interaction in 3D space

### Scene Bridging

#### UIKit-SwiftUI Integration
```swift
// Embed UIKit in SwiftUI
UIViewControllerRepresenting {
    MyViewController()
}
.sceneBridge()  // Smoother transitions

// Embed SwiftUI in UIKit
hostingController.view.sceneBridge = true
```

#### Benefits
- Seamless animation transitions
- Shared state management
- Reduced memory overhead
- Better gesture handling

### Other Enhancements

#### Drag and Drop
- Multi-item drag support
- Custom drag previews
- Drop destination customization
- System integration

#### visionOS Integration
- Window groups for spatial apps
- Immersive spaces
- RealityView enhancements
- Hand tracking support

## When to Use This Reference

Use this reference when:
- Adopting iOS 26 features
- Planning modern SwiftUI architecture
- Migrating from UIKit to SwiftUI
- Reviewing new API capabilities
- Building iOS 26+ exclusive features

## Migration Checklist

### From iOS 18 → iOS 26

#### Liquid Glass Adoption
- [ ] Replace `.blur()` with `.glassBackgroundEffect()`
- [ ] Update navigation bars with `.toolbarRole()`
- [ ] Migrate search to drawer placement
- [ ] Review tab bar for glass materials

#### Performance
- [ ] Profile with new SwiftUI Instrument
- [ ] Identify long view bodies
- [ ] Optimize with `@Animatable` macro
- [ ] Test nested ScrollView performance

#### New Capabilities
- [ ] Consider WebView for web content
- [ ] Replace AttributedText with TextEditor enhancements
- [ ] Explore 3D charts for data visualization
- [ ] Review spatial layout opportunities

## Related Skills

- [liquid-glass](/skills/ui-design/liquid-glass) — Implementation skill for Liquid Glass
- [swiftui-performance](/skills/ui-design/swiftui-performance) — Performance optimization
- [swiftui-debugging](/skills/ui-design/swiftui-debugging) — Debugging view updates
- [liquid-glass-ref](/reference/liquid-glass-ref) — Comprehensive Liquid Glass adoption

## WWDC 2025 Sessions

- WWDC 2025-256: What's New in SwiftUI
- WWDC 2025-268: Swift Concurrency Updates
- WWDC 2025-260: App Intents Integration

## Documentation Scope

This is a **reference skill** — comprehensive API catalog without mandatory workflows.

#### Reference includes
- Complete feature list
- API examples
- Migration strategies
- Performance characteristics
- Platform considerations

## Size

32 KB - Complete iOS 26 SwiftUI reference
