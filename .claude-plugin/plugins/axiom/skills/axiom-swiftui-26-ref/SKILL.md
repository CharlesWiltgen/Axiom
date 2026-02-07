---
name: axiom-swiftui-26-ref
description: Use when implementing iOS 26 SwiftUI features - covers Liquid Glass design system, performance improvements, @Animatable macro, 3D spatial layout, scene bridging, WebView/WebPage, AttributedString rich text editing, drag and drop enhancements, and visionOS integration for iOS 26+
license: MIT
metadata:
  version: "1.0.0"
---

# SwiftUI 26 Features

## Overview

Comprehensive guide to new SwiftUI features in iOS 26, iPadOS 26, macOS Tahoe, watchOS 26, and visionOS 26. From the Liquid Glass design system to rich text editing, these enhancements make SwiftUI more powerful across all Apple platforms.

**Core principle** From low level performance improvements all the way up through the buttons in your user interface, there are some major improvements across the system.

## When to Use This Skill

- Adopting the Liquid Glass design system
- Implementing rich text editing with AttributedString
- Embedding web content with WebView
- Optimizing list and scrolling performance
- Using the @Animatable macro for custom animations
- Building 3D spatial layouts on visionOS
- Bridging SwiftUI scenes to UIKit/AppKit apps
- Implementing drag and drop with multiple items
- Creating 3D charts with Chart3D
- Adding widgets to visionOS or CarPlay
- Adding custom tick marks to sliders (chapter markers, value indicators)
- Constraining slider selection ranges with `enabledBounds`
- Customizing slider appearance (thumb visibility, current value labels)
- Creating sticky safe area bars with blur effects
- Opening URLs in in-app browser
- Using system-styled close and confirm buttons
- Applying glass button styles (iOS 26.1+)
- Controlling button sizing behavior
- Implementing compact search toolbars

## System Requirements

#### iOS 26+, iPadOS 26+, macOS Tahoe+, watchOS 26+, visionOS 26+

---

## Liquid Glass Design System

**For comprehensive coverage**, see `axiom-liquid-glass` (design principles, variants, review pressure) and `axiom-liquid-glass-ref` (app-wide adoption guide). This section covers WWDC 256-specific APIs only.

### Automatic Adoption

Recompile with iOS 26 SDK — navigation containers, tab bars, toolbars, toggles, segmented pickers, and sliders automatically adopt the new design. Bordered buttons default to capsule shape. Sheets get Liquid Glass background (remove any `presentationBackground` customizations).

### Toolbar APIs (iOS 26)

#### ToolbarSpacer

```swift
.toolbar {
    ToolbarItem(placement: .bottomBar) { Button("Archive", systemImage: "archivebox") { } }
    ToolbarSpacer(.flexible, placement: .bottomBar)  // Push items apart
    ToolbarItem(placement: .bottomBar) { Button("Compose", systemImage: "square.and.pencil") { } }
}
// .fixed separates groups visually; .flexible pushes apart (like Spacer in HStack)
```

#### ToolbarItemGroup (Visual Grouping)

Items in a `ToolbarItemGroup` share a single glass background "pill". `ToolbarItemPlacement` controls visual appearance: `confirmationAction` → `glassProminent` styling, `cancellationAction` → standard glass. Use `.sharedBackgroundVisibility(.hidden)` to exclude items (e.g., avatars) from group background.

#### Toolbar Morphing

Attach `.toolbar {}` to individual views inside NavigationStack (not to NavigationStack itself). iOS 26 morphs between per-view toolbars during push/pop. Use `toolbar(id:)` with matching `ToolbarItem(id:)` across screens for items that should stay stable (no bounce):

```swift
// MailboxList
.toolbar(id: "main") {
    ToolbarItem(id: "filter", placement: .bottomBar) { Button("Filter") { } }
    ToolbarSpacer(.flexible, placement: .bottomBar)
    ToolbarItem(id: "compose", placement: .bottomBar) { Button("New Message") { } }
}
// MessageList — "filter" absent (animates out), "compose" stays stable
.toolbar(id: "main") {
    ToolbarSpacer(.flexible, placement: .bottomBar)
    ToolbarItem(id: "compose", placement: .bottomBar) { Button("New Message") { } }
}
```

**#1 gotcha**: Toolbar on NavigationStack = nothing to morph between.

#### DefaultToolbarItem

Reposition system-provided items (like search) within your toolbar layout:

```swift
DefaultToolbarItem(kind: .search, placement: .bottomBar)
// Replaces system's default placement of matching kind
```

Use in collapsed `NavigationSplitView` sidebar to specify which column shows search on iPhone. Wrap in `if #available(iOS 26.0, *)` for backward compatibility.

#### User-Customizable Toolbars

`toolbar(id:)` enables user customization (rearrange, show/hide). Only `.secondaryAction` items support customization on iPadOS. Use `showsByDefault: false` for optional items. Add `ToolbarCommands()` for macOS menu item.

#### Other Toolbar Features

- `.navigationSubtitle("3 unread")` — Secondary line below title
- `.badge(3)` on toolbar items — Notification counts
- Monochrome icon rendering — Reduces visual noise; tint for meaning, not decoration
- Scroll edge blur — Automatic, no code required

### Bottom-Aligned Search

**Foundational search APIs**: See `axiom-swiftui-search-ref`. This section covers iOS 26 refinements only.

```swift
NavigationSplitView {
    List { }.searchable(text: $searchText)
}
// Bottom-aligned on iPhone, top trailing on iPad (automatic)
// Use placement: .sidebar to restore sidebar-embedded search on iPad
```

- `searchToolbarBehavior(.minimize)` — Compact search that expands on tap
- `Tab(role: .search)` — Dedicated search tab; search field replaces tab bar. See swiftui-nav-ref Section 5.7

### Glass Effect for Custom Views

```swift
Button("To Top", systemImage: "chevron.up") { scrollToTop() }
    .padding()
    .glassEffect()  // Add .interactive for custom controls on iOS
```

- `GlassEffectContainer` — Required when multiple glass elements are nearby (glass can't sample glass)
- `glassEffectID(_:in:)` — Fluid morphing transitions between glass elements using a namespace
- Sheet morphing — Use `.matchedTransitionSource` + `.navigationTransition(.zoom(...))` to morph sheets from buttons

### Button & Control Changes

- Capsule shape default for bordered buttons (override with `.buttonBorderShape(.roundedRectangle)`)
- `.controlSize(.extraLarge)` — New extra-large button size
- `.controlSize(.small)` on containers — Preserve pre-iOS 26 density
- `GlassButtonStyle(.clear/.glass/.tint)` — Glass button variants (iOS 26.1+)
- `.buttonSizing(.fit/.stretch/.flexible)` — Control button layout behavior
- `Button(role: .close)` / `Button(role: .confirm)` — System-styled close/confirm
- `.clipShape(.rect(cornerRadius: 12, style: .containerConcentric))` — Corner concentricity
- Menus: icons on leading edge, consistent iOS/macOS

---

## Slider Enhancements

iOS 26 adds custom tick marks, constrained selection ranges, current value labels, and thumb visibility control.

### Slider Ticks

Core types: `SliderTick<V>`, `SliderTickContentForEach`, `SliderTickBuilder`

```swift
// Static ticks with labels
Slider(value: $value, in: 0...10) {
    Text("Rating")
} ticks: {
    SliderTick(0) { Text("Min") }
    SliderTick(5) { Text("Mid") }
    SliderTick(10) { Text("Max") }
}

// Dynamic ticks from collection
SliderTickContentForEach(stops, id: \.self) { value in
    SliderTick(value) { Text("\(Int(value))°").font(.caption2) }
}

// Step-based ticks (called for each step value)
Slider(value: $volume, in: 0...10, step: 2, label: { Text("Volume") }, tick: { value in
    SliderTick(value) { Text("\(Int(value))") }
})
```

**API constraint**: `SliderTickContentForEach` requires `Data.Element` to match `SliderTick<V>` value type. For custom structs, extract numeric values: `chapters.map(\.time)` then look up labels via `chapters.first(where: { $0.time == time })`.

### Full-Featured Slider

```swift
Slider(
    value: $rating, in: 0...100,
    neutralValue: 50,           // Starting point / center value
    enabledBounds: 20...80,     // Restrict selectable range
    label: { Text("Rating") },
    currentValueLabel: { Text("\(Int(rating))") },
    minimumValueLabel: { Text("0") },
    maximumValueLabel: { Text("100") },
    ticks: { SliderTick(50) { Text("Mid") } },
    onEditingChanged: { editing in print(editing ? "Started" : "Ended") }
)
```

### sliderThumbVisibility

`.sliderThumbVisibility(.hidden)` — Hide thumb for media progress indicators and minimal UI. Options: `.automatic`, `.visible`, `.hidden`. Always visible on watchOS.

---

## New View Modifiers

### safeAreaBar

Sticky bars with integrated progressive blur:

```swift
List { ForEach(1...20, id: \.self) { Text("\($0). Item") } }
    .safeAreaBar(edge: .bottom) {
        Text("Bottom Action Bar").padding(.vertical, 15)
    }
    .scrollEdgeEffectStyle(.soft, for: .bottom) // or .hard
```

Works like `safeAreaInset` but with blur. Bar remains fixed while content scrolls beneath.

### onOpenURL Enhancement

```swift
@Environment(\.openURL) var openURL
// openURL(url, prefersInApp: true) — Opens in SFSafariViewController-style in-app browser
// Default Link opens in Safari; prefersInApp keeps users in your app
```

### searchToolbarBehavior

See `axiom-swiftui-search-ref` for foundational `.searchable` APIs. iOS 26 adds:

```swift
.searchable(text: $searchText)
.searchToolbarBehavior(.minimize)  // Compact button, expands on tap
```

Also: `.searchPresentationToolbarBehavior(.avoidHidingContent)` (iOS 17.1+) keeps title visible during search.

**Backward-compatible wrapper** for apps targeting iOS 18+26:

```swift
extension View {
    @ViewBuilder func minimizedSearch() -> some View {
        if #available(iOS 26.0, *) {
            self.searchToolbarBehavior(.minimize)
        } else { self }
    }
}

// Usage
.searchable(text: $searchText)
.minimizedSearch()
```

**Availability pattern for toolbar items**:

```swift
.toolbar {
    if #available(iOS 26.0, *) {
        DefaultToolbarItem(kind: .search, placement: .bottomBar)
        ToolbarSpacer(.flexible, placement: .bottomBar)
    }
    ToolbarItem(placement: .bottomBar) {
        NewNoteButton()
    }
}
.searchable(text: $searchText)
```

**Button roles, GlassButtonStyle, buttonSizing** — See Liquid Glass Design System section above.

---

## iPad Enhancements

### Menu Bar

#### Access common actions via swipe-down menu

```swift
.commands {
    TextEditingCommands() // Same API as macOS menu bar

    CommandGroup(after: .newItem) {
        Button("Add Note") {
            addNote()
        }
        .keyboardShortcut("n", modifiers: [.command, .shift])
    }
}
// Creates menu bar on iPad when people swipe down
```

### Resizable Windows

#### Fluid resizing on iPad

```swift
// MIGRATION REQUIRED:
// Remove deprecated property list key in iPadOS 26:
// UIRequiresFullscreen (entire key deprecated, all values)

// For split view navigation, system automatically shows/hides columns
// based on available space during resize
NavigationSplitView {
    Sidebar()
} detail: {
    Detail()
}
// Adapts to resizing automatically
```

**Reference** "Elevate the design of your iPad app" (WWDC 2025)

---

## macOS Window Enhancements

### Synchronized Window Resize Animations

```swift
.windowResizeAnchor(.topLeading) // Tailor where animation originates

// SwiftUI now synchronizes animation between content view size changes
// and window resizing - great for preserving continuity when switching tabs
```

---

## Performance Improvements

### List Performance (macOS Focus)

#### Massive gains for large lists

- **6x faster loading** for lists of 100,000+ items on macOS
- **16x faster updates** for large lists
- Even bigger gains for larger lists
- Improvements benefit all platforms (iOS, iPadOS, watchOS)

```swift
List(trips) { trip in // 100k+ items
    TripRow(trip: trip)
}
// Loads 6x faster, updates 16x faster on macOS (iOS 26+)
```

### Scrolling Performance

#### Reduced dropped frames

SwiftUI has improved scheduling of user interface updates on iOS and macOS. This improves responsiveness and lets SwiftUI do even more work to prepare for upcoming frames. All in all, it reduces the chance of your app dropping a frame while scrolling quickly at high frame rates.

### Nested ScrollViews with Lazy Stacks

#### Photo carousels and multi-axis scrolling

```swift
ScrollView(.horizontal) {
    LazyHStack {
        ForEach(photoSets) { photoSet in
            ScrollView(.vertical) {
                LazyVStack {
                    ForEach(photoSet.photos) { photo in
                        PhotoView(photo: photo)
                    }
                }
            }
        }
    }
}
// Nested scrollviews now properly delay loading with lazy stacks
// Great for building photo carousels
```

### SwiftUI Performance Instrument

#### New profiling tool in Xcode

Available lanes:
- **Long view body updates** — Identify expensive body computations
- **Platform view updates** — Track UIKit/AppKit bridging performance
- Other performance problem areas

**Reference** "Optimize SwiftUI performance with instruments" (WWDC 2025)

**Cross-reference** [SwiftUI Performance](/skills/ui-design/swiftui-performance) — Master the SwiftUI Instrument

---

## Swift Concurrency Integration

### Compile-Time Data Race Safety

```swift
@Observable
class TripStore {
    var trips: [Trip] = []

    func loadTrips() async {
        trips = await TripService.fetchTrips()
        // Swift 6 verifies data race safety at compile time
    }
}
```

**Benefits** Find bugs in concurrent code before they affect your app

#### References
- "Embracing Swift concurrency" (WWDC 2025)
- "Explore concurrency in SwiftUI" (WWDC 2025)

**Cross-reference** [Swift Concurrency](/skills/concurrency/swift-concurrency) — Swift 6 strict concurrency patterns

---

## @Animatable Macro

### Overview

Simplifies custom animations by automatically synthesizing `animatableData` property.

#### Before (@Animatable macro)

```swift
struct HikingRouteShape: Shape {
    var startPoint: CGPoint
    var endPoint: CGPoint
    var elevation: Double
    var drawingDirection: Bool // Don't want to animate this

    // Tedious manual animatableData declaration
    var animatableData: AnimatablePair<CGPoint.AnimatableData,
                        AnimatablePair<Double, CGPoint.AnimatableData>> {
        get {
            AnimatablePair(startPoint.animatableData,
                          AnimatablePair(elevation, endPoint.animatableData))
        }
        set {
            startPoint.animatableData = newValue.first
            elevation = newValue.second.first
            endPoint.animatableData = newValue.second.second
        }
    }
}
```

#### After (@Animatable macro)

```swift
@Animatable
struct HikingRouteShape: Shape {
    var startPoint: CGPoint
    var endPoint: CGPoint
    var elevation: Double

    @AnimatableIgnored
    var drawingDirection: Bool // Excluded from animation

    // animatableData automatically synthesized!
}
```

#### Key benefits
- Delete manual `animatableData` property
- Use `@AnimatableIgnored` for properties to exclude
- SwiftUI automatically synthesizes animation data

**Cross-reference** SwiftUI Animation (swiftui-animation-ref skill) — Comprehensive animation guide covering VectorArithmetic, Animatable protocol, @Animatable macro, animation types, Transaction system, and performance optimization

---

## 3D Spatial Layout (visionOS)

### Alignment3D

#### Depth-based layout

```swift
struct SunPositionView: View {
    @State private var timeOfDay: Double = 12.0

    var body: some View {
        HikingRouteView()
            .overlay(alignment: sunAlignment) {
                SunView()
                    .spatialOverlay(alignment: sunAlignment)
            }
    }

    var sunAlignment: Alignment3D {
        // Align sun in 3D space based on time of day
        Alignment3D(
            horizontal: .center,
            vertical: .top,
            depth: .back
        )
    }
}
```

### Manipulable Modifier

#### Interactive 3D objects

```swift
Model3D(named: "WaterBottle")
    .manipulable() // People can pick up and move the object
```

### Surface Snapping APIs

```swift
@Environment(\.surfaceSnappingInfo) var snappingInfo: SurfaceSnappingInfo

var body: some View {
    VStackLayout().depthAlignment(.center) {
        Model3D(named: "waterBottle")
            .manipulable()

        Pedestal()
            .opacity(snappingInfo.classification == .table ? 1.0 : 0.0)
    }
}
```

#### References
- "Meet SwiftUI spatial layout" (WWDC 2025)
- "Set the scene with SwiftUI in visionOS" (WWDC 2025)
- "What's new in visionOS" (WWDC 2025)

---

## Scene Bridging

### Overview

Scene bridging allows your UIKit and AppKit lifecycle apps to interoperate with SwiftUI scenes. Apps can use it to open SwiftUI-only scene types or use SwiftUI-exclusive features right from UIKit or AppKit code.

### Supported Scene Types

#### From UIKit/AppKit apps, you can now use

- `MenuBarExtra` (macOS)
- `ImmersiveSpace` (visionOS)
- `RemoteImmersiveSpace` (macOS → Vision Pro)
- `AssistiveAccess` (iOS 26)

### Scene Modifiers

Works with scene modifiers like:
- `.windowStyle()`
- `.immersiveEnvironmentBehavior()`

### RemoteImmersiveSpace

#### Mac app renders stereo content on Vision Pro

```swift
// In your macOS app
@main
struct MyMacApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }

        RemoteImmersiveSpace(id: "stereoView") {
            // Render stereo content on Apple Vision Pro
            // Uses CompositorServices
        }
    }
}
```

#### Features
- Mac app renders stereo content on Vision Pro
- Hover effects and input events supported
- Uses CompositorServices and Metal

**Reference** "What's new in Metal rendering for immersive apps" (WWDC 2025)

### AssistiveAccess Scene

#### Special mode for users with cognitive disabilities

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }

        AssistiveAccessScene {
            SimplifiedUI() // UI shown when iPhone is in AssistiveAccess mode
        }
    }
}
```

**Reference** "Customize your app for Assistive Access" (WWDC 2025)

---

## AppKit Integration Enhancements

### SwiftUI Sheets in AppKit

```swift
// Show SwiftUI view in AppKit sheet
let hostingController = NSHostingController(rootView: SwiftUISettingsView())
presentAsSheet(hostingController)
// Great for incremental SwiftUI adoption
```

### NSGestureRecognizerRepresentable

```swift
// Bridge AppKit gestures to SwiftUI
struct AppKitPanGesture: NSGestureRecognizerRepresentable {
    func makeNSGestureRecognizer(context: Context) -> NSPanGestureRecognizer {
        NSPanGestureRecognizer()
    }

    func updateNSGestureRecognizer(_ recognizer: NSPanGestureRecognizer, context: Context) {
        // Update configuration
    }
}
```

### NSHostingView in Interface Builder

NSHostingView can now be used directly in Interface Builder for gradual SwiftUI adoption.

---

## RealityKit Integration

### Observable Entities

```swift
@Observable
class RealityEntity {
    var position: SIMD3<Float>
    var rotation: simd_quatf
}

struct MyView: View {
    @State private var entity = RealityEntity()

    var body: some View {
        // SwiftUI views automatically observe changes
        Text("Position: \(entity.position.x)")
    }
}
```

### PresentationComponent

Present SwiftUI popovers, alerts, and sheets directly from RealityKit entities.

```swift
// Present SwiftUI popovers from RealityKit entities
let popover = Entity()
mapEntity.addChild(popover)
popover.components[PresentationComponent.self] = PresentationComponent(
    isPresented: $popoverPresented,
    configuration: .popover(arrowEdge: .bottom),
    content: DetailsView()
)
```

### Additional Improvements

- `ViewAttachmentComponent` — add SwiftUI views to entities
- `GestureComponent` — entity touch and gesture responsiveness
- Enhanced coordinate conversion API
- Synchronizing animations, binding to components
- New sizing behaviors for RealityView

**Reference** "Better Together: SwiftUI & RealityKit" (WWDC 2025)

---

## WebView & WebPage

### Overview

WebKit now provides full SwiftUI APIs for embedding web content, eliminating the need to drop down to UIKit.

### WebView

#### Display web content

```swift
import WebKit

struct ArticleView: View {
    let articleURL: URL

    var body: some View {
        WebView(url: articleURL)
    }
}
```

### WebPage (Observable Model)

#### Rich interaction with web content

```swift
import WebKit

struct InAppBrowser: View {
    @State private var page = WebPage()

    var body: some View {
        VStack {
            Text(page.title ?? "Loading...")

            WebView(page)
                .ignoresSafeArea()
                .onAppear {
                    page.load(URLRequest(url: articleURL))
                }

            HStack {
                Button("Back") { page.goBack() }
                    .disabled(!page.canGoBack)
                Button("Forward") { page.goForward() }
                    .disabled(!page.canGoForward)
            }
        }
    }
}
```

#### WebPage features
- Programmatic navigation (`goBack()`, `goForward()`)
- Access page properties (`title`, `url`, `canGoBack`, `canGoForward`)
- Observable — SwiftUI views update automatically

### Advanced WebKit Features

- Custom user agents
- JavaScript execution
- Custom URL schemes
- And more

**Reference** "Meet WebKit for SwiftUI" (WWDC 2025)

---

## TextEditor with AttributedString

### Overview

SwiftUI's new support for rich text editing is great for experiences like commenting on photos. TextView now supports AttributedString!

**Note** The WWDC transcript uses "TextView" as editorial language. The actual SwiftUI API is `TextEditor` which now supports `AttributedString` binding for rich text editing.

### Rich Text Editing

```swift
struct CommentView: View {
    @State private var comment = AttributedString("Enter your comment")

    var body: some View {
        TextEditor(text: $comment)
            // Built-in text formatting controls included
            // Users can apply bold, italic, underline, etc.
    }
}
```

#### Features
- Built-in text formatting controls (bold, italic, underline, colors, etc.)
- Binding to `AttributedString` preserves formatting
- Automatic toolbar with formatting options

### Advanced AttributedString Features

#### Customization options
- Paragraph styles
- Attribute transformations
- Constrain which attributes users can apply

**Reference** "Cook up a rich text experience in SwiftUI with AttributedString" (WWDC 2025)

**Cross-reference** App Intents Integration (app-intents-ref skill) — AttributedString for Apple Intelligence Use Model action

---

## Drag and Drop Enhancements

### Multiple Item Dragging

#### Drag multiple items based on selection

```swift
struct PhotoGrid: View {
    @State private var selectedPhotos: [Photo.ID] = []

    var body: some View {
        ScrollView {
            LazyVGrid(columns: gridColumns) {
                ForEach(model.photos) { photo in
                    view(photo: photo)
                        .draggable(containerItemID: photo.id)
                }
            }
        }
        .dragContainer(for: Photo.self, selection: selectedPhotos) { draggedIDs in
            photos(ids: draggedIDs)
        }
    }
}
```

**Key APIs**:
- `.draggable(containerItemID:containerNamespace:)` marks each item as part of a drag container (namespace defaults to `nil`)
- `.dragContainer(for:selection:)` provides the typed items lazily when a drop occurs

### DragConfiguration

#### Customize supported operations

```swift
.dragConfiguration(DragConfiguration(allowMove: false, allowDelete: true))
```

### Observing Drag Events

```swift
.onDragSessionUpdated { session in
    let ids = session.draggedItemIDs(for: Photo.ID.self)
    if session.phase == .ended(.delete) {
        trash(ids)
        deletePhotos(ids)
    }
}
```

### Drag Preview Formations

```swift
.dragPreviewsFormation(.stack) // Items stack nicely on top of one another

// Other formations:
// - .default
// - .grid
// - .stack
```

Combine all modifiers (`.dragContainer`, `.dragConfiguration`, `.dragPreviewsFormation`, `.onDragSessionUpdated`) on the same scroll view for a complete multi-item drag experience.

---

## 3D Charts

### Overview

Swift Charts now supports three-dimensional plotting with `Chart3D`.

### Basic Usage

#### From WWDC 256:21:35

```swift
import Charts

struct HikePlotView: View {
    var body: some View {
        Chart3D {
            SurfacePlot(x: "x", y: "y", z: "z") { x, y in
                sin(x) * cos(y)
            }
            .foregroundStyle(Gradient(colors: [.orange, .pink]))
        }
        .chartXScale(domain: -3...3)
        .chartYScale(domain: -3...3)
        .chartZScale(domain: -3...3)
    }
}
```

#### Features
- `Chart3D` container
- `SurfacePlot` for continuous surface rendering from a function
- Z-axis specific modifiers (`.chartZScale()`, `.chartZAxis()`, etc.)
- All existing chart marks with 3D variants (e.g., `LineMark3D`)

**Reference** "Bring Swift Charts to the third dimension" (WWDC 2025)

---

## Widgets & Controls

### Controls on watchOS and macOS

#### watchOS 26

```swift
struct FavoriteLocationControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "FavoriteLocation") {
            ControlWidgetButton(action: MarkFavoriteIntent()) {
                Label("Mark Favorite", systemImage: "star")
            }
        }
    }
}
// Access from watch face or Shortcuts
```

#### macOS

Controls now appear in Control Center on Mac.

### Widgets on visionOS

#### Level of detail customization

```swift
struct CountdownWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Countdown") { entry in
            CountdownView(entry: entry)
        }
    }
}

struct PhotoCountdownView: View {
    @Environment(\.levelOfDetail) var levelOfDetail: LevelOfDetail

    var body: some View {
        switch levelOfDetail {
        case .default:
            RecentPhotosView() // Full detail when close
        case .simplified:
            CountdownView()   // Simplified when further away
        default:
            CountdownView()
        }
    }
}
```

### Widgets on CarPlay

#### Live Activities on CarPlay

Live Activities now appear on CarPlay displays for glanceable information while driving.

### Additional Widget Features

- Push-based updating API
- New relevance APIs for watchOS

**Reference** "What's new in widgets" (WWDC 2025)

---

## Migration Checklist

### Deprecated APIs

#### ❌ Remove in iPadOS 26
```xml
<key>UIRequiresFullscreen</key>
<!-- Entire property list key is deprecated (all values) -->
```

Apps must support resizable windows on iPad.

### Automatic Adoptions (Recompile Only)

✅ Liquid Glass design for navigation, tab bars, toolbars
✅ Bottom-aligned search on iPhone
✅ List performance improvements (6x loading, 16x updating)
✅ Scrolling performance improvements
✅ System controls (toggles, pickers, sliders) new appearance
✅ Bordered buttons default to capsule shape
✅ Updated control heights (slightly taller on macOS)
✅ Monochrome icon rendering in toolbars
✅ Menus: icons on leading edge, consistent across iOS and macOS
✅ Sheets morph out of dialogs automatically
✅ Scroll edge blur/fade under system toolbars

### Audit Items (Remove Old Customizations)

⚠️ Remove `presentationBackground` from sheets (let Liquid Glass material shine)
⚠️ Remove extra backgrounds/darkening effects behind toolbar areas
⚠️ Remove hard-coded control heights (use automatic sizing)
⚠️ Update section headers to title-style capitalization (no longer auto-uppercased)

### Manual Adoptions (Code Changes)

🔧 Toolbar spacers (`.fixed`)
🔧 Tinted prominent buttons in toolbars
🔧 Glass effect for custom views (`.glassEffect()`)
🔧 `glassEffectID` for morphing transitions between glass elements
🔧 `GlassEffectContainer` for multiple nearby glass elements
🔧 `sharedBackgroundVisibility(.hidden)` to remove toolbar item from group background
🔧 Sheet morphing from buttons (`navigationZoomTransition`)
🔧 Search tab role (`Tab(role: .search)`)
🔧 Compact search toolbar (`.searchToolbarBehavior(.minimize)`)
🔧 Extra large buttons (`.controlSize(.extraLarge)`)
🔧 Concentric rectangle shape (`.containerConcentric`)
🔧 iPad menu bar (`.commands`)
🔧 Window resize anchor (`.windowResizeAnchor()`)
🔧 @Animatable macro for custom shapes/modifiers
🔧 WebView for web content
🔧 TextEditor with AttributedString binding
🔧 Enhanced drag and drop with `.dragContainer`
🔧 Slider ticks (`SliderTick`, `SliderTickContentForEach`)
🔧 Slider thumb visibility (`.sliderThumbVisibility()`)
🔧 Safe area bars with blur (`.safeAreaBar()` + `.scrollEdgeEffectStyle()`)
🔧 In-app URL opening (`openURL(url, prefersInApp: true)`)
🔧 Close and confirm button roles (`Button(role: .close)`)
🔧 Glass button styles (`GlassButtonStyle` — iOS 26.1+)
🔧 Button sizing control (`.buttonSizing()`)
🔧 Toolbar morphing transitions (per-view `.toolbar {}` inside NavigationStack)
🔧 DefaultToolbarItem for system components in toolbars
🔧 Stable toolbar items (`toolbar(id:)` with matched IDs across screens)
🔧 User-customizable toolbars (`toolbar(id:)` with `CustomizableToolbarContent`)
🔧 Tab bar minimization (`.tabBarMinimizeBehavior(.onScrollDown)`)
🔧 Tab view bottom accessory (`.tabViewBottomAccessory(isEnabled:content:)` — iOS 26.1+)

---

## Best Practices

- **Performance**: Profile with new SwiftUI Instrument; use lazy stacks in nested ScrollViews; trust automatic list performance improvements
- **Liquid Glass**: Recompile and test first; use toolbar spacers; attach `.toolbar {}` to individual views (not NavigationStack); remove `presentationBackground` from sheets; use `GlassEffectContainer` for nearby glass elements
- **Layout**: Use `.safeAreaPadding()` for edge-to-edge (not `.padding()`). See `axiom-swiftui-layout-ref` for full guide
- **Rich Text**: Bind `AttributedString` to `TextEditor`; constrain attributes for your UX
- **Spatial (visionOS)**: Use `Alignment3D` for depth; `.manipulable()` only where it makes sense

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Old design after updating to iOS 26 SDK | Clean build (Shift-Cmd-K), rebuild targeting iOS 26 SDK, check deployment target |
| Search remains at top on iPhone | Place `.searchable` on `NavigationSplitView`, not on `List` directly |
| @Animatable "does not conform" | All properties must be `VectorArithmetic` or marked `@AnimatableIgnored` |
| Rich text formatting lost in TextEditor | Bind `AttributedString`, not `String` |
| Drag delete not working | Enable `.dragConfiguration(allowDelete: true)` AND observe `.onDragSessionUpdated` |
| SliderTickContentForEach won't compile | Iterate over numeric values (`chapters.map(\.time)`), not custom structs — see Slider section |
| Toolbar not morphing during navigation | Move `.toolbar {}` from NavigationStack to each view inside it — see Liquid Glass section |

---

## Resources

**WWDC**: 2025-256, 2025-278 (What's new in widgets), 2025-287 (Meet WebKit for SwiftUI), 2025-310 (Optimize SwiftUI performance with instruments), 2025-323 (Build a SwiftUI app with the new design), 2025-325 (Bring Swift Charts to the third dimension), 2025-341 (Cook up a rich text experience in SwiftUI with AttributedString)

**Docs**: /swiftui, /swiftui/defaulttoolbaritem, /swiftui/toolbarspacer, /swiftui/searchtoolbarbehavior, /swiftui/view/toolbar(id:content:), /swiftui/view/tabbarminimizebehavior(_:), /swiftui/view/tabviewbottomaccessory(isenabled:content:), /swiftui/slider, /swiftui/slidertick, /swiftui/slidertickcontentforeach, /webkit, /foundation/attributedstring, /charts, /realitykit/presentationcomponent, /swiftui/chart3d

**Skills**: axiom-swiftui-performance, axiom-liquid-glass, axiom-swift-concurrency, axiom-app-intents-ref, axiom-swiftui-search-ref

---

**Primary source** WWDC 2025-256 "What's new in SwiftUI". Additional content from 2025-323 (Build a SwiftUI app with the new design), 2025-287 (Meet WebKit for SwiftUI), and Apple documentation.
**Version** iOS 26+, iPadOS 26+, macOS Tahoe+, watchOS 26+, visionOS 26+
