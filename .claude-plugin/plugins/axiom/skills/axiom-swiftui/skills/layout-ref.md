
# SwiftUI Layout API Reference

Comprehensive API reference for SwiftUI adaptive layout tools. For decision guidance and anti-patterns, see the `skills/layout.md` skill.

## Overview

This reference covers all SwiftUI layout APIs for building adaptive interfaces:

- **ViewThatFits** — Automatic variant selection
- **AnyLayout** — Type-erased animated layout switching
- **Layout Protocol** — Custom layout algorithms
- **onGeometryChange** — Efficient geometry reading
- **GeometryReader** — Layout-phase geometry access
- **Safe Area Padding** — .safeAreaPadding() vs .padding()
- **Size Classes** — Coarse trait-context semantics (NOT a width sensor — see below)
- **Window APIs** — Resizable windows everywhere, menu bar, resize anchors, live-resize signal

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
            ? AnyLayout(VStackLayout())
            : AnyLayout(HStackLayout())
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
AnyLayout(HStackLayout(alignment: .top))
AnyLayout(VStackLayout(alignment: .leading))
AnyLayout(ZStackLayout(alignment: .center))
AnyLayout(GridLayout(alignment: .leading))
```

Each stack layout also accepts `spacing:` (and `GridLayout` takes `horizontalSpacing:`/`verticalSpacing:`), all typed `CGFloat?`. Omitting them — as above — yields system spacing, which is the correct default. Pass a value only for the exceptions in axiom-design (skills/hig.md).

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
FlowLayout() {
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

Efficient geometry reading without layout side effects.

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

**Which edge to pad is a layout question (this file). How much to pad is a design question — see axiom-design (skills/hig.md), "What spacing, padding, or margin value should I use?". Short version: omit the length. Both modifiers take `CGFloat?` and `nil` means system-determined; the literals below would be inventing values Apple never published.**

### The Critical Difference

```swift
// ❌ WRONG - Ignores safe areas, content hits notch/home indicator
ScrollView {
    content
}
.padding(.horizontal)

// ✅ CORRECT - Respects safe areas, adds padding beyond them
ScrollView {
    content
}
.safeAreaPadding(.horizontal)
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
        .padding(.horizontal)  // ✅ Internal spacing, system-sized

    Divider()

    content
        .padding(.horizontal)  // ✅ Internal spacing
}
```

#### Use `.safeAreaPadding()` when

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
.safeAreaPadding(.horizontal)  // System margin, beyond safe areas

// ✅ Full-screen content with proper margins
ZStack {
    Color.blue.ignoresSafeArea()

    VStack {
        content
    }
    .safeAreaPadding()  // Respects notch, home indicator
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
    LazyVStack {
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
.safeAreaPadding(.horizontal)  // Beyond safe areas

// Inner: Regular padding for internal spacing
VStack {
    Text("Title")
        .padding(.bottom)  // Internal spacing
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
// Visualize safe area padding
content
    .safeAreaPadding(.horizontal, 20)
    .background(.red.opacity(0.2))  // Shows padding area
    .border(.blue)  // Shows content bounds
```

### Migration from Manual Safe Area Handling

```swift
// ❌ Manual calculation — wraps the view in a GeometryReader for no reason
GeometryReader { geo in
    content
        .padding(.top, geo.safeAreaInsets.top)
        .padding(.bottom, geo.safeAreaInsets.bottom)
}

// ✅ .safeAreaPadding() does it without the GeometryReader
content
    .safeAreaPadding(.vertical)
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

Hand-rolling safe area math with a `GeometryReader` is verbose, forces an extra layout pass, and is easy to get wrong (one forgotten edge). `.safeAreaPadding()` is declarative, safe-area-aware by construction, type-safe per edge, and adds no layout pass.

**Real-world impact**: Using `.padding()` instead of `.safeAreaPadding()` causes content to:
- Hit the Dynamic Island (top)
- Overlap the home indicator (bottom)
- Get cut off by screen corners (rounded edges)

---

## Size Classes

Environment values indicating horizontal and vertical size characteristics.

### Size Class Is Not a Width Sensor

This is the single most misread layout fact of the 27 cycle. `horizontalSizeClass` expresses the **coarse semantics of the current trait environment**, not the window's width. It answers "does the system consider this a roomy or constrained context?" — not "how many points wide am I?"

At iOS 27 Apple deliberately separated **host semantics** (idiom + size class) from **available geometry**. An iPhone app now runs in resizable windows — iPhone Mirroring on a Mac, and iPhone-only apps on iPad. In those windows the **idiom stays `.phone`** and `horizontalSizeClass` stays **`.compact` no matter how wide you drag the window**. A `.phone`-idiom app is no longer equivalent to a narrow-screen layout.

| Decision | Driver | Why |
|----------|--------|-----|
| Should menus collapse, are system Tabs/Sidebars offered | `horizontalSizeClass` | This is what the trait reliably expresses |
| "Switch to two columns past 700pt", "show side nav" | Geometry of the root/container view | Size class won't change with width on a `.phone` host |
| Branch on device type | Neither — never `userInterfaceIdiom` | Idiom is host semantics, decoupled from layout space |

Read your own breakpoints from geometry — `onGeometryChange` (above) or `containerRelativeFrame` (see `containers-ref.md`) — and reserve size class for system-container semantics. `UIScreen.main` / screen bounds are also unreliable here (your window is a fraction of the screen); see `axiom-uikit (skills/uikit-modernization.md)` for the UIKit side (`effectiveGeometry`, `isInteractivelyResizing`).

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

#### iPhone
| Orientation | Horizontal | Vertical |
|-------------|------------|----------|
| Portrait | `.compact` | `.regular` |
| Landscape (small) | `.compact` | `.compact` |
| Landscape (Plus/Max) | `.regular` | `.compact` |

#### iPad
| Configuration | Horizontal | Vertical |
|--------------|------------|----------|
| Any full screen | `.regular` | `.regular` |
| 70% Split View | `.regular` | `.regular` |
| 50% Split View | `.regular` | `.regular` |
| 33% Split View | `.compact` | `.regular` |
| Slide Over | `.compact` | `.regular` |

These tables describe an app running under its **native** idiom. They do **not** describe an iPhone app in a resizable window on a Mac (mirroring) or iPad: there the idiom stays `.phone` and `horizontalSizeClass` stays `.compact` at every width. Don't read the iPad table as "wide ⇒ `.regular`" for a `.phone`-idiom app.

### Overriding Size Classes

```swift
content
    .environment(\.horizontalSizeClass, .compact)
```

**This is not a strategy for making a wide iPhone window look like iPad.** Injecting `.regular` into a `.phone`-idiom subtree based on scene geometry flips every environment reader below it, and components do not respond consistently: `NavigationSplitView` may expand its sidebar, but `TabView(.sidebarAdaptable)` will **not** become an iPad-style sidebar from injected `.regular` alone. A wide iPhone window is still an adaptive iPhone presentation, not an iPad product interface. If you want a sidebar on a wide iPhone, drive your **own** layout from geometry (show a custom sidebar, hide the tab bar, keep tab switching in state) — see the anti-pattern in `layout.md`. Valid uses of the override are narrow and local (forcing a specific child into compact chrome, previews), not a global "fake iPad" switch.

---

## Dynamic Type Size

Reading `dynamicTypeSize` to drive layout is covered here. Whether your layout is *accessible* at those sizes — reflow, truncation, tap targets, VoiceOver order — is axiom-accessibility's domain.

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

## Window APIs

By the 27 cycle every app is resizable — iPhone apps included (iPhone Mirroring on Mac, iPhone-only apps on iPad). Assume an arbitrary, changing scene size; don't assume a fixed aspect ratio or canvas. Express *preferences* (minimum size, content resizability), not absolute control. The UIKit-side scene migration (`UIScreen.main` → scene geometry, `UIRequiresFullScreen` → `sizeRestrictions`, scene-lifecycle mandate) and iPhone Mirroring compatibility (indirect trackpad/mouse input to custom gestures, companion Face ID approval on the Mac, the always-portrait orientation trap) live in `axiom-uikit (skills/uikit-modernization.md)`.

### onInteractiveResizeChange

Distinguishes the *interactive resize gesture* from the settled final size, so you can drop expensive work (high frame-rate animation, live previews, heavy recomputation) while the user is dragging and restore it when they finish. iOS 26+, all platforms.

```swift
@State private var isResizing = false

content
    .onInteractiveResizeChange { resizing in   // (_ isResizing: Bool) -> Void
        isResizing = resizing
    }
    // pause/throttle work while isResizing == true; settle on false
```

The UIKit equivalent is `UIWindowSceneGeometry.isInteractivelyResizing`. To read the final geometry itself, use `onGeometryChange` (above) — `onInteractiveResizeChange` reports only the in-progress/settled *state*, not the size.

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

// Typed coordinate space
extension CoordinateSpaceProtocol where Self == NamedCoordinateSpace {
    static var scroll: Self { .named("scroll") }
}
```

---

## ScrollView Geometry

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

## Alignment Guides

### alignmentGuide

Shift where one view aligns within its stack — no nesting, no manual offsets:

```swift
HStack(alignment: .firstTextBaseline) {
    Image(systemName: "quote.opening")
        .alignmentGuide(.firstTextBaseline) { d in d[.bottom] * 0.8 }
    Text("Quoted text")
}
```

The closure receives `ViewDimensions`: read existing guides (`d[.leading]`, `d[.firstTextBaseline]`, `d[VerticalAlignment.center]`) plus `d.width`/`d.height`, and return the offset (in the view's own coordinates) where *this view's* guide should sit. Only the modified view moves — siblings keep their defaults.

**Gotcha:** the modifier only participates in the alignment the container is actually using. `.alignmentGuide(.leading) { ... }` inside `HStack(alignment: .top)` does nothing *in that stack* — `HStack` aligns vertically; leading/trailing guides matter in `VStack`/`ZStack`. (An outer `.leading`-aligned container still picks the explicit guide up — explicit guides propagate upward through nesting.)

### Custom Alignments

A **custom alignment** expresses your own semantic line with its own `defaultValue(in:)` — like the built-ins it propagates through nested containers, so views in different subtrees can line up along a line the built-ins don't name:

```swift
extension VerticalAlignment {
    private struct ValueRow: AlignmentID {
        static func defaultValue(in d: ViewDimensions) -> CGFloat {
            d[.firstTextBaseline]
        }
    }
    static let valueRow = VerticalAlignment(ValueRow.self)
}

// Container opts in:
HStack(alignment: .valueRow) {
    VStack { icon; Text(label).alignmentGuide(.valueRow) { $0[.firstTextBaseline] } }
    Text(value)   // uses defaultValue — its first baseline
}
```

`defaultValue(in:)` supplies the guide for views that don't set it explicitly. This is the tool for "align the value column across unrelated rows" and "align a detail pane element with a sidebar element" — cases where the views don't share an immediate parent.

---

## Text Under Width Pressure

When a window narrows, text is what gives. These modifiers control *how* it gives — they are the difference between a title that truncates sensibly and a layout where the wrong view collapses:

| Modifier | Effect | Default |
|---|---|---|
| `layoutPriority(_:)` | which sibling keeps its space when width runs out | `0` |
| `lineLimit(_:)` | cap wrapping before truncation kicks in | unlimited |
| `truncationMode(_:)` | which end drops: `.head` / `.middle` / `.tail` | `.tail` |
| `allowsTightening(_:)` | permit slight inter-character compression before truncating | `false` |
| `minimumScaleFactor(_:)` | shrink the font down to the factor before truncating | `1.0` |

```swift
HStack {
    Text(document.title)
        .layoutPriority(1)            // the title wins the space fight
    Spacer()
    Text(document.path)
        .lineLimit(1)
        .truncationMode(.middle)      // both ends of a path carry signal
        .allowsTightening(true)
}
```

- Without `layoutPriority`, an HStack squeezes children roughly equally — the label you care about truncates while a timestamp keeps its full width. Priority is relative among siblings; `1` vs the default `0` is all it takes.
- `.middle` truncation is for identifiers whose ends both matter (paths, URLs, account numbers). `.head` is for values where the tail matters ("…/Invoices/March").
- `minimumScaleFactor` trades legibility for fit — use small reductions and never as a substitute for supporting Dynamic Type: if accessibility text sizes routinely trigger scaling, the layout needs a different arrangement (see skills/layout.md Pattern 2), not smaller text.

---

## Lazy Container Gotchas

### What Happens to a Row After It Scrolls Away

Lazy containers create rows on demand on every OS. What the 27 cycle changed is what happens to a row *after* it leaves the screen — and the two cycles fail in opposite directions, so unversioned advice is wrong on one of them. The symptoms diverge; the fix does not.

| Runtime | Off-screen row | Symptom |
|---|---|---|
| iOS 26 | Kept alive; freed only when scrolled back over | Footprint grows with rows visited |
| iOS 27 | Released continuously | Per-row state is rebuilt, so it silently resets |

Measured: 800 rows, 100 KB each held in per-row state, scrolled top to bottom.

| Runtime | Container | Rows alive at bottom | Footprint delta |
|---|---|---|---|
| 26.5 | LazyVStack | 800 of 800 | +95 MB |
| 26.5 | List | 800 of 800 | +88 MB |
| 27.0 | LazyVStack | 50 of 800 | +1.5 MB |
| 27.0 | List | 59 of 800 | ~0 |
| either | VStack (non-lazy) | 800, all built at launch | 168 MB before a single scroll |

iPhone 17 simulator, iOS 26.5 and iOS 27.0 (build 24A5408d), Xcode 27. Deltas are against a baseline taken with the first screenful already realized, so they run below the raw payload arithmetic. **This 26-vs-27 comparison is simulator-only.** The 27 behavior on its own is separately confirmed on device below; macOS and visionOS are untested.

**The 27 behavior is not gated on the SDK you build against.** The same source linked against the 26.5 SDK evicts identically on the 27 runtime. Shipped binaries change behavior when a user updates the OS — there is no rebuild to opt into, and no deployment target that opts out.

#### Row lifecycle, both cycles

`onAppear`/`onDisappear` fire repeatedly as rows scroll, so neither is a place for one-time setup. View identity still matters — if rows flash during fast scrolling, identity is unstable:

```swift
// ❌ Items flash during fast scroll — unstable identity
LazyVStack {
    ForEach(Array(items.enumerated()), id: \.offset) { index, item in
        ItemRow(item: item)  // Identity changes when array mutates
    }
}

// ✅ Stable identity prevents flash/disappear
LazyVStack {
    ForEach(items) { item in  // Uses item.id (Identifiable)
        ItemRow(item: item)
    }
}
```

#### iOS 26 — the row stops rendering, its state stays

`onDisappear` fires for 786 of the 800 rows, yet not one row's state is freed. Waiting does not help: 8 seconds idle at the bottom frees zero rows. Only scrolling back *over* a region releases it.

Reaching for `List` does not help either — +88 MB, same shape, and it too releases only on the return trip. The container is not the problem; per-row state is. `@State` and `@StateObject` were measured separately, with the same result.

The arithmetic is what makes this dangerous rather than untidy: a 3 MB decoded image per row, across the few hundred rows a user scrolls past, is hundreds of MB resident that never comes back.

```swift
// ❌ Every row the user scrolls past keeps its image alive for the life of the list
@MainActor @Observable
final class RowImage {
    var image: Image?
    func load(_ url: URL) async { image = await decodeThumbnail(url) }
}

struct PhotoRow: View {
    let photo: Photo
    @State private var loaded = RowImage()

    var body: some View {
        thumbnail(loaded.image)
            .task { await loaded.load(photo.url) }
    }
}

// ✅ One bounded store above the list; the row reads through it and holds nothing
@MainActor @Observable
final class ThumbnailStore {
    // NSCache constrains both parameters to AnyObject — CachedImage must be a class
    @ObservationIgnored private let cache = NSCache<NSNumber, CachedImage>()

    init(limit: Int = 60) { cache.countLimit = limit }

    func image(for id: Int) -> Image {
        if let hit = cache.object(forKey: NSNumber(value: id)) { return hit.value }
        let made = CachedImage(id: id)
        cache.setObject(made, forKey: NSNumber(value: id))
        return made.value
    }
}

struct PhotoFeed: View {
    let photos: [Photo]
    @State private var store = ThumbnailStore()

    var body: some View {
        ScrollView {
            LazyVStack {
                ForEach(photos) { CachedPhotoRow(photo: $0) }
            }
        }
        .environment(store)
    }
}

struct CachedPhotoRow: View {
    let photo: Photo
    @Environment(ThumbnailStore.self) private var store

    // Read through the store on each body pass rather than parking the result in
    // @State — a strong reference held in row state is precisely what 26 never frees.
    var body: some View { thumbnail(store.image(for: photo.id)) }
}
```

Verified on 26.5 against the same 800-row scroll: **+6.5 MB instead of +95 MB**, with live rows held near the cache limit. `countLimit` is a hint rather than a hard cap, and `NSCache` also purges under memory pressure — both are what you want here.

#### iOS 27 — per-row state does not survive a scroll-away

Scroll far enough and back and the row is rebuilt: fresh `@State`, fresh `@StateObject`, initializers run again.

Do not treat the threshold as a contract. Bisection puts it between roughly one and three screens for 60pt rows, and between five and seven screens for 300pt rows — but it also moved when only the scroll *step* changed, so it fits neither a point-distance nor a row-count model cleanly. Row height is itself a moving target: the same list re-laid-out at an accessibility text size has different row heights, and therefore different eviction geometry, for the same content. What reproduces is the outcome: **a user who scrolls a few screens away and comes back gets a rebuilt row.**

What that costs is an expanded/collapsed flag, a nested carousel's offset, a per-row loaded image, an in-row player's position. Code that shipped correctly on 26 forgets on 27 — and per the SDK note above, it forgets for users who never installed a new build. It will not reproduce in a preview or a short test list.

Rebuilding is not free either. Every evicted row the user returns to is built again, re-running whatever its initializer does — and the return trip is where it concentrates. Measured on device (iPad Pro, iOS 27.0), 300 rows whose construction decodes a JPEG:

| Figure | Value |
|---|---|
| Row constructions for 300 rows | 539 |
| Footprint at rest after scrolling | 81 MB |
| What polling every scroll step recorded | 86 MB |
| Peak (`ledger_phys_footprint_peak`), minus its 36 MB pre-test baseline | 261 MB |

iPad Pro 12.9-inch (M1), iOS 27.0 build 24A5418b. That device reported 5 GB of headroom, so nothing here came close to a kill — **read the multiple, not the megabytes**: the same shape on a phone, or in an app extension, has far less room.

**Resting footprint can understate the peak by multiples**, and sampling does not close the gap — polling on every scroll step still saw 86 MB. If you judge a list by the memory gauge at rest, this is invisible, and a per-process limit kill is checked against the instantaneous figure rather than the resting one. How to read peak and headroom: `axiom-performance (skills/memory-debugging.md)` — Measure Peak, Not Resting.

So 27 does not make heavy rows safe; it moves the cost from retention to churn, and hides it from the measurement most people take. Rows whose construction decodes an image, reads a file, or builds a formatter should get that work moved out regardless of cycle.

```swift
// ❌ Collapses itself once the user scrolls away and back
struct CommentRow: View {
    let comment: Comment
    @State private var isExpanded = false

    var body: some View {
        DisclosureGroup(comment.author, isExpanded: $isExpanded) {
            Text(comment.body)
        }
    }
}

// ✅ Expansion owned above the row, so eviction cannot take it
struct ExpandableCommentRow: View {
    let comment: Comment
    @Binding var expanded: Set<Comment.ID>

    var body: some View {
        DisclosureGroup(comment.author, isExpanded: binding) {
            Text(comment.body)
        }
    }

    private var binding: Binding<Bool> {
        Binding(
            get: { expanded.contains(comment.id) },
            set: { isOn in
                if isOn { expanded.insert(comment.id) } else { expanded.remove(comment.id) }
            }
        )
    }
}
```

Lifting the flag does cost a parent invalidation per toggle where the in-row `@State` invalidated one row. In a lazy container that is bounded by the realized rows, so it is the right trade — but do not lift *frequently* changing per-row state this way without measuring.

#### The rule

**Lift per-row state above the row, and bound whatever holds the weight.** Both halves are load-bearing, and each covers a different cycle:

| Change | Fixes the 26 growth | Fixes the 27 reset |
|---|---|---|
| Lift state to a parent or model | No — 800 payloads in a parent dictionary is the same +95 MB | Yes |
| Bound the store (`NSCache`, LRU, windowed fetch) | Yes | No — a bounded store still lets the row rebuild |

Detection: a `@State` or `@StateObject` declaration inside a view used as a `ForEach` row under a lazy container or `List`. The `swiftui-performance-analyzer` agent flags this as rule 11.

### When NOT to Use Lazy Containers

| Scenario | Use Instead | Why |
|---|---|---|
| < 50 items | `VStack` / `HStack` | Below the window either cycle would evict, so laziness buys nothing back |
| Nested in another lazy container | `VStack` (inner) | Nested lazy causes layout issues |
| Need all items measured upfront | `VStack` | Lazy containers don't know total size |

---

## Resources

**WWDC**: 2025-208, 2024-10074, 2023-10057, 2022-10056, 2026-278

**Docs**: /swiftui/lazyvstack, /swiftui/layout, /swiftui/viewthatfits, /swiftui/view/oninteractiveresizechange(_:), /swiftui/view/alignmentguide(_:computevalue:), /swiftui/alignmentid, /swiftui/view/layoutpriority(_:), /technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key

**Skills**: skills/layout.md, skills/debugging.md, axiom-uikit (skills/uikit-modernization.md)
