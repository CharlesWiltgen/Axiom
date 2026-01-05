---
name: swiftui-26-ref
description: iOS 26 SwiftUI features — Liquid Glass, @Animatable, WebView, rich text, 3D charts
---

# SwiftUI 26 Reference

Complete API reference for iOS 26 SwiftUI features. Covers Liquid Glass design system, performance improvements, @Animatable macro, WebView, rich text editing, 3D charts, and spatial layout.

## When to Use This Reference

Use this reference when you need:
- Liquid Glass APIs and toolbar patterns
- Performance improvements in iOS 26
- @Animatable macro for custom animation
- WebView and WebPage integration
- TextEditor with AttributedString
- Chart3D for 3D data visualization
- Spatial layout and scene bridging

**For Liquid Glass implementation:** See [liquid-glass](/skills/ui-design/liquid-glass) for adoption patterns.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What Liquid Glass APIs are available in iOS 26?"
- "How do I use the @Animatable macro?"
- "How do I embed web content with WebView in SwiftUI?"
- "How do I use TextEditor with AttributedString?"
- "How do I create 3D charts in SwiftUI?"
- "What performance improvements does iOS 26 bring to SwiftUI?"

## What's Covered

### Liquid Glass Design
- .glassBackgroundEffect() modifier
- Toolbar spacers and roles
- Bottom-aligned search fields
- Tab bar with .tabRole(.search)
- Material-aware backgrounds

### Performance Improvements
- 6x faster simple lists
- 16x faster complex lists
- Nested ScrollView optimization
- SwiftUI Instrument in Instruments 26
- Cause & Effect Graph

### @Animatable Macro
- Automatic animatableData synthesis
- @AnimatableIgnored for excluded properties
- Custom animation interpolation

### WebView Integration
- WebView for URL content
- WebPage for custom HTML
- Navigation and load status handling
- JavaScript interaction

### Rich Text Editing
- TextEditor with AttributedString
- .textFormatting() modifier
- Character-level styling
- Markdown export

### 3D Charts
- Chart3D container
- BarMark3D, LineMark3D, PointMark3D
- Perspective options
- Data visualization in 3D

### Scene Bridging
- UIKit ↔ SwiftUI transitions
- .sceneBridge() modifier
- Shared state management

## Key Pattern

### Liquid Glass Navigation

```swift
NavigationStack {
    ContentView()
        .navigationTitle("Home")
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button("Add", systemImage: "plus") { }
            }
        }
        .searchable(text: $searchText)
        .searchFieldPlacement(.navigationBarDrawer(displayMode: .always))
}
```

### @Animatable Macro

```swift
@Animatable
struct ProgressView: View {
    var progress: Double  // Automatically animatable

    var body: some View {
        Circle()
            .trim(from: 0, to: progress)
            .stroke(lineWidth: 4)
    }
}
```

### WebView

```swift
WebView(url: URL(string: "https://example.com")!)
    .onNavigationAction { action in
        // Handle navigation
    }
    .onLoadStatusChanged { status in
        // Track loading state
    }
```

## Documentation Scope

This page documents the `axiom-swiftui-26-ref` reference skill—complete API coverage Claude uses when you need specific iOS 26 SwiftUI APIs or feature details.

**For Liquid Glass adoption:** See [liquid-glass](/skills/ui-design/liquid-glass) for implementation workflows.

**For performance profiling:** See [swiftui-performance](/skills/ui-design/swiftui-performance) for Instruments workflows.

## Related

- [liquid-glass](/skills/ui-design/liquid-glass) — Liquid Glass implementation patterns
- [swiftui-performance](/skills/ui-design/swiftui-performance) — Performance optimization
- [swiftui-animation-ref](/reference/swiftui-animation-ref) — Animation API reference
- [swiftui-debugging](/skills/ui-design/swiftui-debugging) — View update debugging

## Resources

**WWDC**: 2025-256 (What's New in SwiftUI), 2025-268 (Swift Concurrency)

**Docs**: /swiftui, /swiftui/animation
