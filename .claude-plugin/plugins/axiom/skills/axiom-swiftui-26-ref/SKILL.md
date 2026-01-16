---
name: axiom-swiftui-26-ref
description: Use when implementing iOS 26 SwiftUI features - covers Liquid Glass design system, performance improvements, @Animatable macro, 3D spatial layout, scene bridging, WebView/WebPage, AttributedString rich text editing, drag and drop enhancements, and visionOS integration for iOS 26+
user-invocable: true
skill_type: reference
version: 1.0.0
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

#### iOS 26+, iPadOS 26+, macOS Tahoe+, watchOS 26+, axiom-visionOS 26+

---

## Liquid Glass Design System

#### For comprehensive Liquid Glass coverage, see
- `axiom-liquid-glass` skill — Design principles, implementation, variants, design review pressure
- `axiom-liquid-glass-ref` skill — App-wide adoption guide (app icons, controls, navigation, menus, windows)

### Overview

The new design system provides "a bright and fluid experience that's consistent across Apple platforms." Apps automatically adopt the new appearance upon recompilation - navigation containers, tab bars, and toolbars update automatically.

#### Key visual elements
- Glassy sidebars on iPad/macOS that reflect surrounding content
- Compact tab bars on iPhone
- Liquid Glass toolbar items with morphing transitions
- Blur effects on scroll edges

### Automatic Adoption

```swift
// No code changes required - recompile and get new design
NavigationSplitView {
    List {
        // Sidebar automatically gets glassy appearance on iPad/macOS
    }
} detail: {
    // Detail view
}

// Tab bars automatically compact on iPhone
TabView {
    // Tabs get new appearance
}
```

### Toolbar Customization

#### Toolbar Spacer API

```swift
.toolbar {
    ToolbarItemGroup(placement: .topBarTrailing) {
        Button("Up") { }
        Button("Down") { }

        // Fixed spacer separates button groups
        Spacer(.fixed)

        Button("Settings") { }
    }
}
```

#### Prominent Tinted Buttons in Liquid Glass

```swift
Button("Add Trip") {
    addTrip()
}
.buttonStyle(.borderedProminent)
.tint(.blue)
// Liquid Glass toolbars support tinting for prominence
```

### Scroll Edge Effects

#### Automatic blur on scroll edges

```swift
ScrollView {
    // When content scrolls under toolbar/navigation bar,
    // blur effect automatically ensures bar content remains legible
    ForEach(trips) { trip in
        TripRow(trip: trip)
    }
}
// No code required - automatic scroll edge blur
```

### Bottom-Aligned Search

#### iPhone ergonomics

```swift
NavigationSplitView {
    List { }
        .searchable(text: $searchText)
}
// Placement on NavigationSplitView automatically:
// - Bottom-aligned on iPhone (more ergonomic)
// - Top trailing corner on iPad
```

#### Search Tab Role

See swiftui-nav-ref skill Section 5.5 (iOS 26 Tab Features) for `Tab(role: .search)` patterns.

### Glass Effect for Custom Views

```swift
struct PhotoGalleryView: View {
    var body: some View {
        CustomPhotoGrid()
            .glassBackgroundEffect() // Reflects surrounding content
    }
}
```

### System Controls Updates

Controls now have the new design automatically:
- Toggles
- Segmented pickers
- Sliders

**Reference** "Build a SwiftUI app with the new design" (WWDC 2025) for adoption best practices and advanced customizations.

---

## Slider Enhancements

iOS 26 introduces major enhancements to `Slider`: custom tick marks, constrained selection ranges, current value labels, and thumb visibility control.

### Slider Ticks API

#### Core Types

| Type | Purpose |
|------|---------|
| `SliderTick<V>` | Individual tick at a specific value with optional label |
| `SliderTickContentForEach` | Iterate over collection to create multiple ticks |
| `SliderTickBuilder` | Result builder for composing tick content |
| `TupleSliderTickContent` | Internal type for multiple inline ticks |
| `SliderTickContent` | Protocol that all tick types conform to |

### Basic Ticks

#### Static tick marks

```swift
struct SpeedSlider: View {
    @State private var speed: Double = 0.5

    var body: some View {
        Slider(value: $speed) {
            Text("Speed")
        } ticks: {
            SliderTick(0.2)
            SliderTick(0.5)
            SliderTick(0.8)
        }
    }
}
```

### Labeled Ticks

#### Ticks with custom labels

```swift
Slider(value: $value, in: 0...10) {
    Text("Rating")
} ticks: {
    SliderTick(0) { Text("Min") }
    SliderTick(5) { Text("Mid") }
    SliderTick(10) { Text("Max") }
}
```

### Dynamic Ticks with SliderTickContentForEach

#### Iterate over values to create ticks

```swift
struct TemperatureSlider: View {
    @State private var temp: Float = 70

    var body: some View {
        let stops: [Float] = stride(from: 60, through: 80, by: 5).map { Float($0) }

        Slider(value: $temp, in: 60...80) {
            Text("Temperature")
        } ticks: {
            SliderTickContentForEach(stops, id: \.self) { value in
                SliderTick(value) {
                    Text("\(Int(value))°")
                        .font(.caption2)
                }
            }
        }
    }
}
```

### Custom Data with Ticks (API Constraint)

**Important** `SliderTickContentForEach` requires `Data.Element` to match the `SliderTick<V>` value type. You cannot iterate directly over custom structs.

#### ❌ This won't compile

```swift
struct Chapter {
    let time: Double
    let name: String
    let id: UUID
}

// ERROR: Data.Element (Chapter) doesn't match SliderTick value type (Double)
SliderTickContentForEach(chapters, id: \.id) { chapter in
    SliderTick(chapter.time) { Text(chapter.name) }
}
```

#### ✅ Workaround: Extract values, look up labels

```swift
struct ChapterSlider: View {
    @Binding var currentTime: Double
    let chapters: [Chapter]
    let duration: Double

    var body: some View {
        Slider(value: $currentTime, in: 0...duration) {
            Text("Time")
        } ticks: {
            // Iterate over Double values, not Chapter structs
            SliderTickContentForEach(chapters.map(\.time), id: \.self) { time in
                SliderTick(time) {
                    // Look up chapter name for label
                    if let chapter = chapters.first(where: { $0.time == time }) {
                        Text(chapter.name)
                            .font(.caption2)
                    }
                }
            }
        }
    }
}
```

**Why** The API ties tick positions to slider values (`BinaryFloatingPoint`). The type system enforces this so ticks align correctly with the slider's value range.

### Advanced Slider Initializers

#### Full-featured slider with ticks

```swift
Slider(
    value: $rating,
    in: 0...100,
    neutralValue: 50,           // Starting point / center value
    enabledBounds: 20...80,     // Restrict selectable range
    label: { Text("Rating") },
    currentValueLabel: { Text("\(Int(rating))") },
    minimumValueLabel: { Text("0") },
    maximumValueLabel: { Text("100") },
    ticks: {
        SliderTick(20) { Text("Min") }
        SliderTick(50) { Text("Neutral") }
        SliderTick(80) { Text("Max") }
    },
    onEditingChanged: { editing in
        print(editing ? "Started" : "Ended")
    }
)
```

#### Parameters

| Parameter | Type | Purpose |
|-----------|------|---------|
| `value` | `Binding<V>` | Current slider value |
| `bounds` | `ClosedRange<V>` | Full value range (default: `0...1`) |
| `step` | `V.Stride` | Increment between valid values |
| `neutralValue` | `V?` | Starting/center point |
| `enabledBounds` | `ClosedRange<V>?` | Restrict which values are selectable |
| `ticks` | `@SliderTickBuilder` | Custom tick marks |
| `currentValueLabel` | `@ViewBuilder` | Shows current value |
| `onEditingChanged` | `(Bool) -> Void` | Called when editing starts/ends |

### Step-Based Ticks

#### Automatic ticks at each step

```swift
Slider(
    value: $volume,
    in: 0...10,
    step: 2,
    label: { Text("Volume") },
    tick: { value in
        // Called for each step value (0, 2, 4, 6, 8, 10)
        SliderTick(value) {
            Text("\(Int(value))")
        }
    }
)
```

### sliderThumbVisibility

#### Hide slider thumb for minimal interfaces

```swift
struct MediaControlView: View {
    @State private var progress: CGFloat = 0.5

    var body: some View {
        Slider(value: $progress)
            .sliderThumbVisibility(.hidden)
            .padding(.horizontal, 16)
    }
}
```

**Visibility options**
- `.automatic` — System default (usually visible)
- `.visible` — Always show thumb
- `.hidden` — Hide thumb

**Use cases**
- Media player progress indicators
- Read-only value displays
- Minimal UI designs where slider acts as progress view
- Interactive sliders where visual focus should be on track, not thumb

**Note** On watchOS, the slider thumb is always visible regardless of this setting.

### Complete Media Player Example

```swift
struct MediaPlayerControls: View {
    @State private var currentTime: Double = 0
    let duration: Double = 300 // 5 minutes
    let chapters: [Chapter] = [
        Chapter(time: 0, name: "Intro", id: UUID()),
        Chapter(time: 60, name: "Verse 1", id: UUID()),
        Chapter(time: 120, name: "Chorus", id: UUID()),
        Chapter(time: 180, name: "Verse 2", id: UUID()),
        Chapter(time: 240, name: "Outro", id: UUID())
    ]

    var body: some View {
        VStack {
            // Time display
            HStack {
                Text(formatTime(currentTime))
                Spacer()
                Text(formatTime(duration))
            }
            .font(.caption)

            // Slider with chapter ticks
            Slider(
                value: $currentTime,
                in: 0...duration,
                label: { Text("Playback") },
                currentValueLabel: {
                    if let chapter = currentChapter {
                        Text(chapter.name)
                            .font(.caption)
                    }
                },
                ticks: {
                    SliderTickContentForEach(chapters.map(\.time), id: \.self) { time in
                        SliderTick(time)
                    }
                }
            )
            .sliderThumbVisibility(.hidden)
        }
        .padding()
    }

    var currentChapter: Chapter? {
        chapters.last { $0.time <= currentTime }
    }

    func formatTime(_ seconds: Double) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }
}
```

---

## New View Modifiers

### safeAreaBar

#### Sticky bars with progressive blur

```swift
struct ContentView: View {
    var body: some View {
        NavigationStack {
            List {
                ForEach(1...20, id: \.self) { index in
                    Text("\(index). Item")
                }
            }
            .safeAreaBar(edge: .bottom) {
                Text("Bottom Action Bar")
                    .padding(.vertical, 15)
            }
            .scrollEdgeEffectStyle(.soft, for: .bottom)
            // Alternative: .scrollEdgeEffectStyle(.hard, for: .bottom)
        }
    }
}
```

**Features**
- Works like `safeAreaInset` but with integrated blur
- Progressive blur (`.soft`) or hard blur (`.hard`) via `scrollEdgeEffectStyle`
- Automatically respects safe areas
- Bar remains fixed while content scrolls beneath

**Use cases**
- Action bars that remain visible while scrolling
- Fixed controls at screen edges
- Bottom toolbars with scroll blur

### onOpenURL Enhancement

#### Open links in in-app browser

```swift
struct LinkView: View {
    @Environment(\.openURL) var openURL

    var body: some View {
        let website = URL(string: "https://example.com")!

        VStack {
            // Old style - opens in Safari
            Link(destination: website) {
                Text("Open in Safari")
            }

            // New style - opens in-app (iOS 26+)
            Button("Open In-App") {
                openURL(website, prefersInApp: true)
            }
            .buttonStyle(.borderedProminent)
        }
    }
}
```

**Key difference**
- Default `Link` opens in Safari app
- `openURL(url, prefersInApp: true)` opens in SFSafariViewController-style in-app browser
- Keeps users in your app
- Preserves navigation flow

### Button Roles (.close and .confirm)

#### System-styled close and confirm buttons

```swift
struct ModalView: View {
    @State private var showSheet = false

    var body: some View {
        Button("Show Sheet") {
            showSheet.toggle()
        }
        .sheet(isPresented: $showSheet) {
            NavigationStack {
                VStack {}
                    .navigationTitle("Info")
                    .toolbar {
                        ToolbarSpacer(.flexible, placement: .topBarTrailing)

                        ToolbarItem(placement: .topBarTrailing) {
                            Button(role: .close) {
                                showSheet = false
                            }
                        }
                    }
            }
            .presentationDetents([.medium])
        }
    }
}
```

**Features**
- `Button(role: .close)` renders as X icon with glass effect in toolbars
- `Button(role: .confirm)` provides system-styled confirmation button
- No custom label needed
- Consistent with system modals and sheets

**Use cases**
- Modal dismissal
- Sheet close buttons
- Confirmation dialogs
- Native-looking dismiss actions

### GlassButtonStyle (iOS 26.1+)

#### Glass button variations

```swift
struct GlassButtonExample: View {
    var body: some View {
        ZStack {
            Image(.background)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Button("Clear Glass") {}
                    .buttonStyle(GlassButtonStyle(.clear))

                Button("Regular Glass") {}
                    .buttonStyle(GlassButtonStyle(.glass))

                Button("Tinted Glass") {}
                    .buttonStyle(GlassButtonStyle(.tint))
                    .tint(.blue)
            }
            .fontWeight(.bold)
            .foregroundStyle(.white)
            .buttonSizing(.flexible)
            .font(.title)
            .padding()
        }
    }
}
```

**Variants**
- `.clear` — Transparent glass effect
- `.glass` — Standard glass appearance
- `.tint` — Colored glass (use with `.tint()` modifier)

**Requires** iOS 26.1+ (not available in initial iOS 26.0 release)

### buttonSizing

#### Control button layout behavior

```swift
struct ButtonLayoutExample: View {
    var body: some View {
        VStack(spacing: 16) {
            Button("Fit Content") {}
                .buttonSizing(.fit)
            // Button shrinks to label size

            Button("Stretch Full Width") {}
                .buttonSizing(.stretch)
            // Button expands to fill available space

            Button("Flexible") {}
                .buttonSizing(.flexible)
            // Balanced between fit and stretch
        }
        .padding()
    }
}
```

**Options**
- `.fit` — Button fits label size
- `.stretch` — Button fills available width
- `.flexible` — Balanced sizing (context-dependent)

**Works with**
- Plain text buttons
- Custom labels (icon + text, HStack/VStack)
- All button styles

### searchToolbarBehavior

#### Compact search that expands on focus

```swift
struct SearchView: View {
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            List {
                Text("User 1")
                Text("User 2")
                Text("User 3")
            }
            .navigationTitle("Search Users")
            .searchable(text: $searchText)
            .searchToolbarBehavior(.minimize)
            .toolbar {
                ToolbarSpacer(.flexible, placement: .bottomBar)
                DefaultToolbarItem(kind: .search, placement: .bottomBar)
            }
        }
    }
}
```

**Behavior**
- `.minimize` — Search field compact when unfocused, expands on tap
- Similar to Tab Bar search pattern
- Saves toolbar space
- Cleaner UI when search not in use

**Use cases**
- List/content-heavy screens
- Crowded navigation bars
- Tab bar style search on regular screens

### searchPresentationToolbarBehavior (iOS 17.1+)

#### Prevent title hiding during search

```swift
.searchable(text: $searchText)
.searchPresentationToolbarBehavior(.avoidHidingContent)
```

**Behavior**
- By default, navigation title hides when search becomes active
- `.avoidHidingContent` keeps title visible during search
- Maintains context while searching

**Note** This modifier was introduced in iOS 17.1, not iOS 26, but complements the new `searchToolbarBehavior` modifier.

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

### Scene Snapping APIs

```swift
@Environment(\.sceneSnapping) var sceneSnapping

var body: some View {
    Model3D(named: item.modelName)
        .overlay(alignment: .bottom) {
            if sceneSnapping.isSnapped {
                Pedestal() // Show pedestal for items snapped to table
            }
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

### SwiftUI Popovers from RealityKit

```swift
// New component allows presenting SwiftUI popovers from RealityKit entities
entity.components[PopoverComponent.self] = PopoverComponent {
    VStack {
        Text("Next photo location")
        Button("Mark Favorite") { }
    }
}
```

### Additional Improvements

- Enhanced coordinate conversion API
- Attachment components
- Synchronizing animations
- Binding to components
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

struct BrowserView: View {
    @State private var webPage = WebPage()

    var body: some View {
        VStack {
            // Show page title
            Text(webPage.title ?? "Loading...")

            WebView(page: webPage)

            HStack {
                Button("Back") {
                    webPage.goBack()
                }
                .disabled(!webPage.canGoBack)

                Button("Forward") {
                    webPage.goForward()
                }
                .disabled(!webPage.canGoForward)
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
    @State private var selection: Set<Photo.ID> = []
    let photos: [Photo]

    var body: some View {
        LazyVGrid(columns: columns) {
            ForEach(photos) { photo in
                PhotoCell(photo: photo)
                    .draggable(photo) // Individual item
            }
        }
        .dragContainer { // Container for multiple items
            // Return items based on selection
            selection.map { id in
                photos.first { $0.id == id }
            }
            .compactMap { $0 }
        }
    }
}
```

### Lazy Drag Item Loading

```swift
.dragContainer {
    // Items loaded lazily when drop occurs
    // Great for expensive operations like image encoding
    selectedPhotos.map { photo in
        photo.transferRepresentation
    }
}
```

### DragConfiguration

#### Customize supported operations

```swift
.dragConfiguration(.init(supportedOperations: [.copy, .move, .delete]))
```

### Observing Drag Events

```swift
.onDragSessionUpdated { session in
    if case .ended(let operation) = session.phase {
        if operation == .delete {
            deleteSelectedPhotos()
        }
    }
}
```

### Drag Preview Formations

```swift
.dragPreviewFormation(.stack) // Items stack nicely on top of one another

// Other formations:
// - .default
// - .grid
// - .stack
```

### Complete Example

```swift
struct PhotoLibrary: View {
    @State private var selection: Set<Photo.ID> = []
    let photos: [Photo]

    var body: some View {
        LazyVGrid(columns: columns) {
            ForEach(photos) { photo in
                PhotoCell(photo: photo)
            }
        }
        .dragContainer {
            selectedPhotos
        }
        .dragConfiguration(.init(supportedOperations: [.copy, .delete]))
        .dragPreviewFormation(.stack)
        .onDragSessionUpdated { session in
            if case .ended(.delete) = session.phase {
                deleteSelectedPhotos()
            }
        }
    }
}
```

---

## 3D Charts

### Overview

Swift Charts now supports three-dimensional plotting with `Chart3D`.

### Basic Usage

```swift
import Charts

struct ElevationChart: View {
    let hikingData: [HikeDataPoint]

    var body: some View {
        Chart3D {
            ForEach(hikingData) { point in
                LineMark3D(
                    x: .value("Distance", point.distance),
                    y: .value("Elevation", point.elevation),
                    z: .value("Time", point.timestamp)
                )
            }
        }
        .chartXScale(domain: 0...10)
        .chartYScale(domain: 0...3000)
        .chartZScale(domain: startTime...endTime) // Z-specific modifier
    }
}
```

#### Features
- `Chart3D` container
- Z-axis specific modifiers (`.chartZScale()`, `.chartZAxis()`, etc.)
- All existing chart marks with 3D variants

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

struct CountdownView: View {
    @Environment(\.levelOfDetail) var levelOfDetail
    let entry: CountdownEntry

    var body: some View {
        VStack {
            Text(entry.date, style: .timer)

            if levelOfDetail == .expanded {
                // Show photos when close to widget
                PhotoCarousel(photos: entry.recentPhotos)
            }
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

### Manual Adoptions (Code Changes)

🔧 Toolbar spacers (`.fixed`)
🔧 Tinted prominent buttons in toolbars
🔧 Glass effect for custom views (`.glassBackgroundEffect()`)
🔧 Search tab role (`.tabRole(.search)`)
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
🔧 Compact search toolbar (`.searchToolbarBehavior(.minimize)`)

---

## Best Practices

### Performance

#### DO
- Profile with new SwiftUI performance instrument
- Use lazy stacks in nested ScrollViews
- Trust automatic list performance improvements

#### DON'T
- Over-optimize - let framework improvements help first
- Ignore long view body updates in profiler

### Liquid Glass Design

#### DO
- Recompile and test automatic appearance
- Use toolbar spacers for logical grouping
- Apply glass effect to custom views that benefit from reflections

#### DON'T
- Fight the automatic design - embrace consistency
- Over-tint toolbars (use for prominence only)

### Layout & Spacing

#### DO
- Use `.safeAreaPadding()` for edge-to-edge content (iOS 17+)
- Combine `.safeAreaPadding()` with Liquid Glass materials extending edge-to-edge
- Use `.padding()` for internal spacing between views

#### DON'T
- Use `.padding()` when content extends to screen edges (ignores notch/home indicator)
- Manually calculate safe area insets with GeometryReader on iOS 17+ (use `.safeAreaPadding()` instead)

**Reference**: See `axiom-swiftui-layout-ref` skill for complete `.safeAreaPadding()` vs `.padding()` guide, or `axiom-liquid-glass-ref` for Liquid Glass-specific safe area patterns.

### Rich Text

#### DO
- Use `AttributedString` binding for `TextEditor`
- Constrain attributes if needed for your use case
- Consider localization with rich text

#### DON'T
- Use plain `String` and lose formatting
- Allow all attributes without considering UX

### Spatial Layout (visionOS)

#### DO
- Use `Alignment3D` for depth-based layouts
- Enable `.manipulable()` for objects users should interact with
- Check scene snapping state for context-aware UI

#### DON'T
- Use 2D alignment APIs for 3D layouts
- Make all objects manipulable (only what makes sense)

---

## Troubleshooting

### Issue: Liquid Glass appearance not showing

**Symptom** App still has old design after updating to iOS 26 SDK

#### Solution
1. Clean build folder (Shift-Cmd-K)
2. Rebuild with Xcode 16+ targeting iOS 26 SDK
3. Check deployment target is iOS 26+

### Issue: Bottom-aligned search not appearing on iPhone

**Symptom** Search remains at top on iPhone

#### Solution
```swift
// ✅ CORRECT: searchable on NavigationSplitView
NavigationSplitView {
    List { }
        .searchable(text: $query)
}

// ❌ WRONG: searchable on List directly in non-navigation context
List { }
    .searchable(text: $query)
```

### Issue: @Animatable macro not synthesizing animatableData

**Symptom** Compile error "Type does not conform to Animatable"

#### Solution
```swift
// Ensure all properties are either:
// 1. VectorArithmetic conforming types (Double, CGFloat, CGPoint, etc.)
// 2. Marked with @AnimatableIgnored

@Animatable
struct MyShape: Shape {
    var radius: Double // ✅ VectorArithmetic
    var position: CGPoint // ✅ VectorArithmetic

    @AnimatableIgnored
    var fillColor: Color // ✅ Ignored (Color is not VectorArithmetic)
}
```

### Issue: AttributedString formatting lost in TextEditor

**Symptom** Rich text formatting disappears

#### Solution
```swift
// ✅ CORRECT: Binding to AttributedString
@State private var text = AttributedString("Hello")
TextEditor(text: $text)

// ❌ WRONG: Binding to String
@State private var text = "Hello"
TextEditor(text: $text) // Plain String loses formatting
```

### Issue: Drag and drop delete not working

**Symptom** Dragging to Dock trash doesn't delete items

#### Solution
```swift
// Must include .delete in supported operations
.dragConfiguration(.init(supportedOperations: [.copy, .delete]))

// And observe the delete event
.onDragSessionUpdated { session in
    if case .ended(.delete) = session.phase {
        deleteItems()
    }
}
```

### Issue: SliderTickContentForEach won't compile with custom structs

**Symptom** Compile error when iterating over custom types like `[Chapter]`

```swift
// ERROR: Cannot convert value of type 'Chapter' to expected argument type
SliderTickContentForEach(chapters, id: \.id) { chapter in
    SliderTick(chapter.time) { ... }
}
```

#### Solution

`SliderTickContentForEach` requires `Data.Element` to match the `SliderTick<V>` value type. Extract the numeric values and look up metadata separately:

```swift
// ✅ CORRECT: Iterate over Double values
SliderTickContentForEach(chapters.map(\.time), id: \.self) { time in
    SliderTick(time) {
        if let chapter = chapters.first(where: { $0.time == time }) {
            Text(chapter.name)
        }
    }
}
```

**Why** The API enforces type safety between tick positions and slider values. This is an API design constraint, not a bug.

---

## Resources

**WWDC**: 2025-256

**Docs**: /swiftui, /swiftui/slider, /swiftui/slidertick, /swiftui/slidertickcontentforeach, /webkit, /foundation/attributedstring, /charts

**Skills**: axiom-swiftui-performance, axiom-liquid-glass, axiom-swift-concurrency, axiom-app-intents-ref

---

**Last Updated** Based on WWDC 2025-256 "What's new in SwiftUI"
**Version** iOS 26+, iPadOS 26+, macOS Tahoe+, watchOS 26+, axiom-visionOS 26+
