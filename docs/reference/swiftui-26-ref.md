---
name: swiftui-26-ref
description: iOS 26 and iOS 27 SwiftUI features — Liquid Glass, @Animatable, WebView, rich text, 3D charts
---

# SwiftUI 26 Reference

Complete API reference for the SwiftUI features introduced in iOS 26, plus the 27-cycle additions that build on them. Covers Liquid Glass, performance, the `@Animatable` macro, WebView, rich text editing, 3D charts, and spatial layout.

## When to Use This Reference

Use this reference when you need:
- Liquid Glass APIs and toolbar patterns
- Concentric corners that follow their container or the device's screen
- Toolbar transitions and morphing during navigation
- Performance improvements in iOS 26
- The `@Animatable` macro for custom animation
- `WebView` and `WebPage` integration
- `TextEditor` with `AttributedString`
- `Chart3D` for 3D data visualization
- Spatial layout and scene bridging
- Tappable links, phone numbers, and addresses in text (27 cycle)
- A hook for observing `WebView` form submissions (27 cycle)
- List section index and section margins
- Slider ticks, safe area bars, or line height control
- Multi-item drag and drop (27 cycle)
- A checklist for moving an app to the iOS 26 SDK

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "What Liquid Glass APIs are available in iOS 26?"
- "How do I keep nested corners concentric with their container in iOS 26?"
- "How should a custom bottom sheet's corners match the iPhone's screen corners?"
- "How do I use the `@Animatable` macro?"
- "How do I embed web content with `WebView` in SwiftUI?"
- "How do I intercept form submissions in a SwiftUI `WebView`?"
- "Why does my `WebView` scroll wrong inside a `NavigationStack`?"
- "How do I use `TextEditor` with `AttributedString`?"
- "How do I make links, phone numbers, and addresses tappable in SwiftUI text?"
- "How do I create 3D charts in SwiftUI?"
- "What performance improvements does iOS 26 bring to SwiftUI?"
- "How do I make toolbars morph during navigation transitions?"
- "Why isn't my toolbar morphing when I push a new view?"
- "How do I add the A–Z index strip to a SwiftUI `List`?"
- "Why isn't my section index showing up?"
- "How do I change the margins around a `List` section?"

## What's Covered

### Liquid Glass Design
- Automatic adoption on recompile
- `ToolbarSpacer`, `ToolbarItemGroup` shared glass backgrounds, `sharedBackgroundVisibility(_:)`
- Toolbar morphing during `NavigationStack` push and pop; `toolbar(id:)` stable items
- `DefaultToolbarItem`, and `DefaultToolbarItem` + `ToolbarSpacer` bottom bar patterns
- User-customizable toolbars (`CustomizableToolbarContent`)
- `navigationSubtitle(_:)`, `.badge()` on toolbar items, monochrome icons, scroll edge blur
- Bottom-aligned search fields (with the `.sidebar` placement escape hatch)
- `searchToolbarBehavior(.minimize)` with a backward-compatible wrapper
- Search tab with `Tab(role: .search)` (iOS 18+), and the `.onGeometryChange` bug that breaks its morph
- `.glassEffect()`, `GlassEffectContainer`, `glassEffectID(_:in:)`, sheet morphing
- Button changes: `.glass` / `.glassProminent` styles, `Button(role: .close)` / `.confirm`, `buttonSizing(_:)`, `.controlSize(.extraLarge)`

### Corner Concentricity
- `ConcentricRectangle` shape and `.rect(corners:isUniform:)` sugar
- `Edge.Corner.Style` (`.fixed`, `.concentric`, `.concentric(minimum:)`)
- Per-corner and per-edge initializer variants
- `RoundedRectangularShape` protocol
- `GeometryProxy.containerCornerInsets`; `concentricCornerRadii` (iOS 27)
- Matching the device's screen corners without a hard-coded radius; custom bottom sheets (fixed top corners, concentric bottom corners)

### Sliders, Text and View Modifiers
- `SliderTick`, `SliderTickContentForEach`, `enabledBounds`, `neutralValue`, `sliderThumbVisibility(_:)`
- `safeAreaBar(edge:)` with `scrollEdgeEffectStyle(_:for:)`
- `openURL(_:prefersInApp:)`
- `lineHeight(_:)` presets and precise values, including on `AttributedString`

### Lists
- `sectionIndexLabel(_:)` – per-section entry in the A–Z index
- `listSectionIndexVisibility(_:)` – override the index strip's visibility
- Default visibility behavior, and excluding sections from the index
- Deriving index labels across languages (`UILocalizedIndexedCollation`)
- `listSectionMargins(_:_:)` – override a section's margins
- Platform availability, including where each API is unavailable

### Data Detection (27 Cycle)
- `.dataDetection(_:options:)` – makes links, phone numbers, addresses, dates, and money in a view's text tappable (iOS, watchOS, and visionOS 27, and macOS 27.3 when built with the Xcode 27.3 SDK; not Mac Catalyst or tvOS)
- `DataDetector.MatchType` options from the DataDetection framework (iOS 26+), and `String.dataDetectorMatches(_:options:)` for detection without UI

### Performance Improvements
- Lists of 100,000+ items on macOS load 6x faster and update 16x faster, with gains on every platform
- Fewer dropped frames while scrolling
- Nested `ScrollView`s with lazy stacks
- The new SwiftUI instrument (long view body updates, platform view updates)

### @Animatable Macro
- Automatic `animatableData` synthesis
- `@AnimatableIgnored` for excluded properties
- Which property types the macro can synthesize, and the error when one can't be

### WebView Integration
- `WebView` for URL content
- `WebPage` observable model – title, URL, loading progress, back-forward list
- Navigation and load status handling
- JavaScript execution, custom user agents, and custom URL schemes
- Scroll control – `webViewScrollPosition(_:)`, `webViewOnScrollGeometryChange(for:of:action:)`, `webViewScrollInputBehavior(_:for:)` (available on iOS but not callable there — no `ScrollInputKind` value exists)
- Appearance and gestures – `webViewContentBackground(_:)`, `webViewBackForwardNavigationGestures(_:)`, `webViewMagnificationGestures(_:)`, `webViewLinkPreviews(_:)`, `webViewElementFullscreenBehavior(_:)`, `webViewTextSelection(_:)`, and the macOS-only `webViewContextMenu(_:)`
- WebView inside NavigationStack – safe-area and toolbar interaction, and why `.ignoresSafeArea()` is wrong there
- Form-submission hook (iOS, macOS, and visionOS 27) – `WebPage.FormInfo`, `willSubmit(formInfo:)`, `NavigationPreferences.alternateRequest` / `overrideReferrer` / `isGlobalPrivacyControlEnabled` / `allowsJSHandleCreationInPageWorld`
- No `WebView` or `WebPage` on tvOS

### Rich Text Editing
- `TextEditor` bound to `AttributedString`, with built-in formatting controls
- `TextField` with `axis: .vertical` for plain text
- Paragraph styles, attribute transformations, and constraining which attributes users can apply

### Drag and Drop (27 Cycle)
- `draggable(containerItemID:)`, `dragContainer(for:)`, `dragContainerSelection(_:)` (iOS and visionOS 27, macOS 26)
- `DragConfiguration` (`allowDelete` is macOS-only), `onDragSessionUpdated`, and the macOS-only `dragPreviewsFormation(_:)`

### 3D Charts
- `Chart3D` container, with closures or data collections
- `SurfacePlot`, surface styling (`.heightBased`, `.normalBased`, roughness)
- `Chart3DPose` camera control and `Chart3DCameraProjection`
- Z-axis modifiers (`chartZScale`, `chartZAxis`)

### Spatial Layout (visionOS)
- `Alignment3D` with `spatialOverlay(alignment:content:)`
- `.manipulable()` and surface snapping

### Scene Bridging and Framework Integration
- SwiftUI-only scenes from UIKit and AppKit apps: `MenuBarExtra`, `ImmersiveSpace`, `RemoteImmersiveSpace`, `AssistiveAccess`
- AppKit: SwiftUI sheets via `NSHostingController`, `NSGestureRecognizerRepresentable`, `NSHostingView` in Interface Builder
- RealityKit: observable entities, `PresentationComponent`, `ViewAttachmentComponent`, `GestureComponent`
- iPad menu bar (`.commands`) and resizable windows; macOS `windowResizeAnchor(_:)`

### Widgets and Controls
- Controls on watchOS and in the macOS Control Center
- visionOS widget `levelOfDetail`, Live Activities on CarPlay

### Migration and Troubleshooting
- Deprecated `UIRequiresFullScreen` (iPadOS 26), automatic adoptions, customizations to remove, manual adoptions
- Fixes for common symptoms, including `.toolbarBackground` ignored on `TabView`

## Key Patterns

### Liquid Glass Navigation

```swift
NavigationStack {
    ContentView()
        .navigationTitle("Home")
        .toolbar {   // On the view inside the stack, not on NavigationStack, so it morphs on push
            ToolbarItem(placement: .automatic) {
                Button("Add", systemImage: "plus") { }
            }
        }
        .searchable(text: $searchText)
}
```

### @Animatable Macro

```swift
@Animatable
struct ProgressRing: View {
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
struct ArticleReader: View {
    @State private var page = WebPage()
    let url: URL

    var body: some View {
        // WebPage is @Observable — read isLoading/estimatedProgress directly.
        WebView(page)
            .overlay(alignment: .top) {
                if page.isLoading {
                    ProgressView(value: page.estimatedProgress)
                }
            }
            .task { page.load(URLRequest(url: url)) }
    }
}
```

## Documentation Scope

This page documents the `26-ref` skill (in the `axiom-swiftui` suite), the API coverage your assistant uses when you need specific iOS 26 SwiftUI APIs or feature details. For Liquid Glass design principles and adoption patterns, see [liquid-glass](/skills/ui-design/liquid-glass).

## Related

- [liquid-glass-ref](/reference/liquid-glass-ref) – app-wide Liquid Glass adoption guide
- [swiftui-search-ref](/reference/swiftui-search-ref) – the foundational `.searchable` APIs that the iOS 26 search changes build on
- [swiftui-animation-ref](/reference/swiftui-animation-ref) – the full animation API, including `Animatable` and `VectorArithmetic`
- [swiftui-performance](/skills/ui-design/swiftui-performance) – profiling with the SwiftUI instrument
- [swiftui-debugging](/skills/ui-design/swiftui-debugging) – diagnosing views that don't update
- [typography-ref](/reference/typography-ref) – the typography system behind `lineHeight`
- [toolbars](/skills/ui-design/toolbars) – toolbar placements, overflow, and item priority beyond the iOS 26 additions here
- [iphone-duo](/skills/ui-design/iphone-duo) – how concentric corners fit both of iPhone Duo's displays without per-device radii

## Resources

**WWDC**: 2025-256, 2025-278, 2025-287, 2025-310, 2025-323, 2025-325, 2025-341

**Docs**: /swiftui, /webkit, /charts/chart3d, /foundation/attributedstring
