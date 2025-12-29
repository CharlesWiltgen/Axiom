---
name: swiftui-layout-ref
description: Reference — Complete SwiftUI adaptive layout API guide covering ViewThatFits, AnyLayout, Layout protocol, onGeometryChange, GeometryReader, size classes, and iOS 26 window APIs
skill_type: reference
version: 1.0.0
---

# SwiftUI Layout API Reference

Comprehensive API reference for SwiftUI adaptive layout tools. For decision guidance and anti-patterns, see the `swiftui-layout` skill.

## Overview

This reference covers all SwiftUI layout APIs for building adaptive interfaces:

- **ViewThatFits** — Automatic variant selection (iOS 16+)
- **AnyLayout** — Type-erased animated layout switching (iOS 16+)
- **Layout Protocol** — Custom layout algorithms (iOS 16+)
- **onGeometryChange** — Efficient geometry reading (iOS 16+ backported)
- **GeometryReader** — Layout-phase geometry access (iOS 13+)
- **Safe Area Padding** — .safeAreaPadding() vs .padding() (iOS 17+)
- **Size Classes** — Trait-based adaptation
- **iOS 26 Window APIs** — Free-form windows, menu bar, resize anchors

---

## ViewThatFits

Evaluates child views in order and displays the first one that fits in the available space.

### Basic Usage

```swift
ViewThatFits {
    // First choice
    HStack {
        icon
        title
        Spacer()
        button
    }

    // Second choice
    HStack {
        icon
        title
        button
    }

    // Fallback
    VStack {
        HStack { icon; title }
        button
    }
}
```

### With Axis Constraint

```swift
// Only consider horizontal fit
ViewThatFits(in: .horizontal) {
    wideVersion
    narrowVersion
}

// Only consider vertical fit
ViewThatFits(in: .vertical) {
    tallVersion
    shortVersion
}
```

### How It Works

1. Applies `fixedSize()` to each child
2. Measures ideal size against available space
3. Returns first child that fits
4. Falls back to last child if none fit

### Limitations

- Does not expose which variant was selected
- Cannot animate between variants (use AnyLayout instead)
- Measures all variants (performance consideration for complex views)

---

## AnyLayout

Type-erased layout container enabling animated transitions between layouts.

### Basic Usage

```swift
struct AdaptiveView: View {
    @Environment(\.horizontalSizeClass) var sizeClass

    var layout: AnyLayout {
        sizeClass == .compact
            ? AnyLayout(VStackLayout(spacing: 12))
            : AnyLayout(HStackLayout(spacing: 20))
    }

    var body: some View {
        layout {
            ForEach(items) { item in
                ItemView(item: item)
            }
        }
        .animation(.default, value: sizeClass)
    }
}
```

### Available Layout Types

```swift
AnyLayout(HStackLayout(alignment: .top, spacing: 10))
AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
AnyLayout(ZStackLayout(alignment: .center))
AnyLayout(GridLayout(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 10))
```

### Custom Conditions

```swift
// Based on Dynamic Type
@Environment(\.dynamicTypeSize) var typeSize

var layout: AnyLayout {
    typeSize.isAccessibilitySize
        ? AnyLayout(VStackLayout())
        : AnyLayout(HStackLayout())
}

// Based on geometry
@State private var isWide = true

var layout: AnyLayout {
    isWide
        ? AnyLayout(HStackLayout())
        : AnyLayout(VStackLayout())
}
```

### Why Use Over Conditional Views

```swift
// ❌ Loses view identity, no animation
if isCompact {
    VStack { content }
} else {
    HStack { content }
}

// ✅ Preserves identity, smooth animation
let layout = isCompact ? AnyLayout(VStackLayout()) : AnyLayout(HStackLayout())
layout { content }
```

---

## Layout Protocol

Create custom layout containers with full control over positioning.

### Basic Custom Layout

```swift
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        return calculateSize(for: sizes, in: proposal.width ?? .infinity)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var point = bounds.origin
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)

            if point.x + size.width > bounds.maxX {
                point.x = bounds.origin.x
                point.y += lineHeight + spacing
                lineHeight = 0
            }

            subview.place(at: point, proposal: .unspecified)
            point.x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}

// Usage
FlowLayout(spacing: 12) {
    ForEach(tags) { tag in
        TagView(tag: tag)
    }
}
```

### With Cache

```swift
struct CachedLayout: Layout {
    struct CacheData {
        var sizes: [CGSize] = []
    }

    func makeCache(subviews: Subviews) -> CacheData {
        CacheData(sizes: subviews.map { $0.sizeThatFits(.unspecified) })
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout CacheData) -> CGSize {
        // Use cache.sizes instead of measuring again
    }
}
```

### Layout Values

```swift
// Define custom layout value
struct Rank: LayoutValueKey {
    static let defaultValue: Int = 0
}

extension View {
    func rank(_ value: Int) -> some View {
        layoutValue(key: Rank.self, value: value)
    }
}

// Read in layout
func placeSubviews(...) {
    let sorted = subviews.sorted { $0[Rank.self] < $1[Rank.self] }
}
```

---

## onGeometryChange

Efficient geometry reading without layout side effects. Backported to iOS 16+.

### Basic Usage

```swift
@State private var size: CGSize = .zero

var body: some View {
    content
        .onGeometryChange(for: CGSize.self) { proxy in
            proxy.size
        } action: { newSize in
            size = newSize
        }
}
```

### Reading Specific Values

```swift
// Width only
.onGeometryChange(for: CGFloat.self) { proxy in
    proxy.size.width
} action: { width in
    columnCount = max(1, Int(width / 150))
}

// Frame in coordinate space
.onGeometryChange(for: CGRect.self) { proxy in
    proxy.frame(in: .global)
} action: { frame in
    globalFrame = frame
}

// Aspect ratio
.onGeometryChange(for: Bool.self) { proxy in
    proxy.size.width > proxy.size.height
} action: { isWide in
    self.isWide = isWide
}
```

### Coordinate Spaces

```swift
// Named coordinate space
ScrollView {
    content
        .onGeometryChange(for: CGFloat.self) { proxy in
            proxy.frame(in: .named("scroll")).minY
        } action: { offset in
            scrollOffset = offset
        }
}
.coordinateSpace(name: "scroll")
```

### Comparison with GeometryReader

| Aspect | onGeometryChange | GeometryReader |
|--------|------------------|----------------|
| Layout impact | None | Greedy (fills space) |
| When evaluated | After layout | During layout |
| Use case | Side effects | Layout calculations |
| iOS version | 16+ (backported) | 13+ |

---

## GeometryReader

Provides geometry information during layout phase. Use sparingly due to greedy sizing.

### Basic Usage (Constrained)

```swift
// ✅ Always constrain GeometryReader
GeometryReader { proxy in
    let width = proxy.size.width
    HStack(spacing: 0) {
        Rectangle().frame(width: width * 0.3)
        Rectangle().frame(width: width * 0.7)
    }
}
.frame(height: 100)  // Required constraint
```

### GeometryProxy Properties

```swift
GeometryReader { proxy in
    // Container size
    let size = proxy.size  // CGSize

    // Safe area insets
    let insets = proxy.safeAreaInsets  // EdgeInsets

    // Frame in coordinate space
    let globalFrame = proxy.frame(in: .global)
    let localFrame = proxy.frame(in: .local)
    let namedFrame = proxy.frame(in: .named("container"))
}
```

### Common Patterns

```swift
// Proportional sizing
GeometryReader { geo in
    VStack {
        header.frame(height: geo.size.height * 0.2)
        content.frame(height: geo.size.height * 0.8)
    }
}

// Centering with offset
GeometryReader { geo in
    content
        .position(x: geo.size.width / 2, y: geo.size.height / 2)
}
```

### Avoiding Common Mistakes

```swift
// ❌ Unconstrained in VStack
VStack {
    GeometryReader { ... }  // Takes ALL space
    Button("Next") { }       // Invisible
}

// ✅ Constrained
VStack {
    GeometryReader { ... }
        .frame(height: 200)
    Button("Next") { }
}

// ❌ Causing layout loops
GeometryReader { geo in
    content
        .frame(width: geo.size.width)  // Can cause infinite loop
}
```

---

## Safe Area Padding

SwiftUI provides two primary approaches for handling spacing around content: `.padding()` and `.safeAreaPadding()`. Understanding when to use each is critical for proper layout on devices with safe areas (notch, Dynamic Island, home indicator).

### The Critical Difference

```swift
// ❌ WRONG - Ignores safe areas, content hits notch/home indicator
ScrollView {
    content
}
.padding(.horizontal, 20)

// ✅ CORRECT - Respects safe areas, adds padding beyond them
ScrollView {
    content
}
.safeAreaPadding(.horizontal, 20)
```

**Key insight**: `.padding()` adds fixed spacing from the view's edges. `.safeAreaPadding()` adds spacing beyond the safe area insets.

### When to Use Each

#### Use `.padding()` when

- Adding spacing between sibling views within a container
- Creating internal spacing that should be consistent everywhere
- Working with views that already respect safe areas (like List, Form)
- Adding decorative spacing on macOS (no safe area concerns)

```swift
VStack(spacing: 0) {
    header
        .padding(.horizontal, 16)  // ✅ Internal spacing

    Divider()

    content
        .padding(.horizontal, 16)  // ✅ Internal spacing
}
```

#### Use `.safeAreaPadding()` when (iOS 17+)

- Adding margin to full-width content that extends to screen edges
- Implementing edge-to-edge scrolling with proper insets
- Creating custom containers that need safe area awareness
- Working with Liquid Glass or full-screen materials

```swift
// ✅ Edge-to-edge list with custom padding
List(items) { item in
    ItemRow(item)
}
.listStyle(.plain)
.safeAreaPadding(.horizontal, 20)  // Adds 20pt beyond safe areas

// ✅ Full-screen content with proper margins
ZStack {
    Color.blue.ignoresSafeArea()

    VStack {
        content
    }
    .safeAreaPadding(.all, 16)  // Respects notch, home indicator
}
```

### Platform Availability

**iOS 17+, iPadOS 17+, macOS 14+, visionOS 1.0+**

For earlier iOS versions, use manual safe area handling:

```swift
// iOS 13-16 fallback
GeometryReader { geo in
    content
        .padding(.horizontal, 20 + geo.safeAreaInsets.leading)
}
```

Or conditional compilation:

```swift
if #available(iOS 17, *) {
    content.safeAreaPadding(.horizontal, 20)
} else {
    content.padding(.horizontal, 20)
        .padding(.leading, safeAreaInsets.leading)
}
```

### Edge-Specific Usage

```swift
// Top only (below status bar/notch)
.safeAreaPadding(.top, 8)

// Bottom only (above home indicator)
.safeAreaPadding(.bottom, 16)

// Horizontal (left/right of safe areas)
.safeAreaPadding(.horizontal, 20)

// All edges
.safeAreaPadding(.all, 16)

// Individual edges
.safeAreaPadding(EdgeInsets(top: 8, leading: 20, bottom: 16, trailing: 20))
```

### Common Patterns

#### Edge-to-Edge ScrollView

```swift
ScrollView {
    LazyVStack(spacing: 12) {
        ForEach(items) { item in
            ItemCard(item)
        }
    }
}
.safeAreaPadding(.horizontal, 16)  // Content inset from edges + safe areas
.safeAreaPadding(.vertical, 8)
```

#### Full-Screen Background with Safe Content

```swift
ZStack {
    // Background extends edge-to-edge
    LinearGradient(...)
        .ignoresSafeArea()

    // Content respects safe areas + custom padding
    VStack {
        header
        Spacer()
        content
        Spacer()
        footer
    }
    .safeAreaPadding(.all, 20)
}
```

#### Nested Padding (Combined Approach)

```swift
// Outer: Safe area padding for device insets
VStack(spacing: 0) {
    content
}
.safeAreaPadding(.horizontal, 16)  // Beyond safe areas

// Inner: Regular padding for internal spacing
VStack {
    Text("Title")
        .padding(.bottom, 8)  // Internal spacing
    Text("Subtitle")
}
```

### Decision Tree

```
Does your content extend to screen edges?
├─ YES → Use .safeAreaPadding()
│   ├─ Is it scrollable? → .safeAreaPadding(.horizontal/.vertical)
│   └─ Is it full-screen? → .safeAreaPadding(.all)
│
└─ NO (contained within a safe container like List/Form)
    └─ Use .padding() for internal spacing
```

### Visual Debugging

```swift
// Visualize safe area padding (iOS 17+)
content
    .safeAreaPadding(.horizontal, 20)
    .background(.red.opacity(0.2))  // Shows padding area
    .border(.blue)  // Shows content bounds
```

### Migration from Manual Safe Area Handling

```swift
// ❌ OLD: Manual calculation (iOS 13-16)
GeometryReader { geo in
    content
        .padding(.top, geo.safeAreaInsets.top + 16)
        .padding(.bottom, geo.safeAreaInsets.bottom + 16)
        .padding(.horizontal, 20)
}

// ✅ NEW: .safeAreaPadding() (iOS 17+)
content
    .safeAreaPadding(.vertical, 16)
    .safeAreaPadding(.horizontal, 20)
```

### Related APIs

**`.safeAreaInset(edge:)`** - Adds persistent content that shrinks the safe area:
```swift
ScrollView {
    content
}
.safeAreaInset(edge: .bottom) {
    // This REDUCES the safe area, content scrolls under it
    toolbarButtons
        .padding()
        .background(.ultraThinMaterial)
}
```

**`.ignoresSafeArea()`** - Opts out of safe area completely:
```swift
Color.blue
    .ignoresSafeArea()  // Extends to absolute screen edges
```

### Why It Matters

**Before iOS 17**: Developers had to manually calculate safe area insets with GeometryReader, leading to:
- Verbose code
- Performance overhead (GeometryReader forces extra layout pass)
- Easy mistakes (forgetting to check all edges)

**iOS 17+**: `.safeAreaPadding()` provides:
- Declarative API (matches SwiftUI philosophy)
- Automatic safe area awareness
- Better performance (no extra layout passes)
- Type-safe edge specification

**Real-world impact**: Using `.padding()` instead of `.safeAreaPadding()` on iPhone 15 Pro causes content to:
- Hit the Dynamic Island (top)
- Overlap the home indicator (bottom)
- Get cut off by screen corners (rounded edges)

---

## Size Classes

Environment values indicating horizontal and vertical size characteristics.

### Reading Size Classes

```swift
struct AdaptiveView: View {
    @Environment(\.horizontalSizeClass) var horizontalSizeClass
    @Environment(\.verticalSizeClass) var verticalSizeClass

    var body: some View {
        if horizontalSizeClass == .compact {
            compactLayout
        } else {
            regularLayout
        }
    }
}
```

### Size Class Values

```swift
enum UserInterfaceSizeClass {
    case compact    // Constrained space
    case regular    // Ample space
}
```

### Platform Behavior

**iPhone:**
| Orientation | Horizontal | Vertical |
|-------------|------------|----------|
| Portrait | `.compact` | `.regular` |
| Landscape (small) | `.compact` | `.compact` |
| Landscape (Plus/Max) | `.regular` | `.compact` |

**iPad:**
| Configuration | Horizontal | Vertical |
|--------------|------------|----------|
| Any full screen | `.regular` | `.regular` |
| 70% Split View | `.regular` | `.regular` |
| 50% Split View | `.regular` | `.regular` |
| 33% Split View | `.compact` | `.regular` |
| Slide Over | `.compact` | `.regular` |

### Overriding Size Classes

```swift
content
    .environment(\.horizontalSizeClass, .compact)
```

---

## Dynamic Type Size

Environment value for user's preferred text size.

### Reading Dynamic Type

```swift
@Environment(\.dynamicTypeSize) var dynamicTypeSize

var body: some View {
    if dynamicTypeSize.isAccessibilitySize {
        accessibleLayout
    } else {
        standardLayout
    }
}
```

### Size Categories

```swift
enum DynamicTypeSize: Comparable {
    case xSmall
    case small
    case medium
    case large           // Default
    case xLarge
    case xxLarge
    case xxxLarge
    case accessibility1  // isAccessibilitySize = true
    case accessibility2
    case accessibility3
    case accessibility4
    case accessibility5
}
```

### Scaled Metric

```swift
@ScaledMetric var iconSize: CGFloat = 24
@ScaledMetric(relativeTo: .largeTitle) var headerSize: CGFloat = 44

Image(systemName: "star")
    .frame(width: iconSize, height: iconSize)
```

---

## iOS 26 Window APIs

### Window Resize Anchor

```swift
WindowGroup {
    ContentView()
}
.windowResizeAnchor(.topLeading)  // Resize originates from top-left
.windowResizeAnchor(.center)      // Resize from center
```

### Menu Bar Commands (iPad)

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .commands {
            CommandMenu("View") {
                Button("Show Sidebar") {
                    showSidebar.toggle()
                }
                .keyboardShortcut("s", modifiers: [.command, .option])

                Divider()

                Button("Zoom In") { zoom += 0.1 }
                    .keyboardShortcut("+")
                Button("Zoom Out") { zoom -= 0.1 }
                    .keyboardShortcut("-")
            }
        }
    }
}
```

### NavigationSplitView Column Control

```swift
// iOS 26: Automatic column visibility
NavigationSplitView {
    Sidebar()
} content: {
    ContentList()
} detail: {
    DetailView()
}
// Columns auto-hide/show based on available width

// Manual control (when needed)
@State private var columnVisibility: NavigationSplitViewVisibility = .all

NavigationSplitView(columnVisibility: $columnVisibility) {
    Sidebar()
} detail: {
    DetailView()
}
```

### Scene Phase

```swift
@Environment(\.scenePhase) var scenePhase

var body: some View {
    content
        .onChange(of: scenePhase) { oldPhase, newPhase in
            switch newPhase {
            case .active:
                // Window is visible and interactive
            case .inactive:
                // Window is visible but not interactive
            case .background:
                // Window is not visible
            }
        }
}
```

---

## Coordinate Spaces

### Built-in Coordinate Spaces

```swift
// Global (screen coordinates)
proxy.frame(in: .global)

// Local (view's own bounds)
proxy.frame(in: .local)

// Named (custom)
proxy.frame(in: .named("mySpace"))
```

### Creating Named Spaces

```swift
ScrollView {
    content
        .onGeometryChange(for: CGFloat.self) { proxy in
            proxy.frame(in: .named("scroll")).minY
        } action: { offset in
            scrollOffset = offset
        }
}
.coordinateSpace(name: "scroll")

// iOS 17+ typed coordinate space
extension CoordinateSpaceProtocol where Self == NamedCoordinateSpace {
    static var scroll: Self { .named("scroll") }
}
```

---

## ScrollView Geometry (iOS 18+)

### onScrollGeometryChange

```swift
ScrollView {
    content
}
.onScrollGeometryChange(for: CGFloat.self) { geometry in
    geometry.contentOffset.y
} action: { offset in
    scrollOffset = offset
}
```

### ScrollGeometry Properties

```swift
.onScrollGeometryChange(for: ScrollGeometry.self) { $0 } action: { geo in
    let offset = geo.contentOffset      // Current scroll position
    let size = geo.contentSize          // Total content size
    let visible = geo.visibleRect       // Currently visible rect
    let insets = geo.contentInsets      // Content insets
}
```

---

## Resources

**WWDC**: 2025-208, 2024-10074, 2022-10056

**Docs**: /swiftui/layout, /swiftui/viewthatfits

**Skills**: swiftui-layout, swiftui-debugging
