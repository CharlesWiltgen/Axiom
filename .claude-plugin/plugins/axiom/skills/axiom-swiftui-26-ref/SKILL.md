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
        ToolbarSpacer(.fixed)

        Button("Settings") { }
    }
}
```

#### ToolbarItemGroup for Visual Grouping

Items within a `ToolbarItemGroup` share a single Liquid Glass background, creating a visual "pill" for related actions:

```swift
.toolbar {
    ToolbarItem(placement: .cancellationAction) {
        Button("Cancel", systemImage: "xmark") {}
    }

    ToolbarItemGroup(placement: .primaryAction) {
        Button("Draw", systemImage: "pencil") {}
        Button("Erase", systemImage: "eraser") {}
    }

    ToolbarSpacer(.flexible)

    ToolbarItem(placement: .confirmationAction) {
        Button("Save", systemImage: "checkmark") {}
    }
}
```

**Key insight**: `ToolbarItemPlacement` now controls visual appearance, not just position. `confirmationAction` automatically applies `glassProminent` styling; `cancellationAction` uses standard glass.

#### Prominent Tinted Buttons in Liquid Glass

```swift
Button("Add Trip") {
    addTrip()
}
.buttonStyle(.borderedProminent)
.tint(.blue)
// Liquid Glass toolbars support tinting for prominence
```

Toolbar items also support `.badge()` for notification counts:

```swift
ToolbarItem(placement: .confirmationAction) {
    Button("Done", systemImage: "checkmark") { }
        .badge(3)  // Badge count on glass toolbar item
}
```

#### Removing Items from Group Background

Some toolbar items should appear without the shared group background, like an avatar or standalone icon. Apply `sharedBackgroundVisibility(.hidden)` to separate an item visually:

```swift
.toolbar {
    ToolbarItem(placement: .topBarTrailing) {
        // Avatar appears without glass background pill
        Image(systemName: "person.crop.circle")
            .sharedBackgroundVisibility(.hidden)
    }
}
```

#### Monochrome Icon Rendering

Icons use monochrome rendering in more places, including toolbars. This reduces visual noise, emphasizes content, and maintains legibility. You can still tint icons with `.tint()`, but use it to convey meaning (call to action, next step) — not just for visual effect.

### Toolbar Transitions & Morphing

iOS 26 toolbars automatically morph between screens during NavigationStack push/pop transitions. The key insight: attach `.toolbar {}` to individual views inside NavigationStack, not to NavigationStack itself.

#### DefaultToolbarItem

**iOS 26+**. A toolbar item representing a system component. Use it to reposition system-provided items (like search) within your toolbar layout.

```swift
struct DefaultToolbarItem {
    init(kind: ToolbarDefaultItemKind, placement: ToolbarItemPlacement = .automatic)
}
```

**Key semantic**: If the system has already placed a matching item `kind` in the toolbar, `DefaultToolbarItem` implicitly replaces the default-placed instance. This lets you move system items to different placements or reposition them relative to your own toolbar content.

##### Repositioning search between toolbar items

```swift
NavigationSplitView {
    AllCalendarsView()
} detail: {
    SelectedCalendarView()
        .searchable(text: $query)
        .toolbar {
            ToolbarItem(placement: .bottomBar) {
                CalendarPicker()
            }
            ToolbarItem(placement: .bottomBar) {
                Invites()
            }
            DefaultToolbarItem(kind: .search, placement: .bottomBar)
            ToolbarSpacer(placement: .bottomBar)
            ToolbarItem(placement: .bottomBar) { NewEventButton() }
        }
}
```

##### Specifying search column in collapsed NavigationSplitView

Place `DefaultToolbarItem` with `.search` kind in the column that should display search when the split view collapses to compact (iPhone):

```swift
NavigationSplitView {
    SidebarView()
        .toolbar {
            DefaultToolbarItem(kind: .search, placement: .bottomBar)
        }
} content: {
    ContentView()
} detail: {
    DetailView()
}
.searchable(text: $text)
```

This only applies when `.searchable()` is placed on the `NavigationSplitView` itself (not a child view).

##### Availability check for backward compatibility

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

#### Basic Morphing Setup

Each view declares its own toolbar. iOS 26 morphs between them during navigation:

```swift
struct MailboxList: View {
    var body: some View {
        List(mailboxes) { mailbox in
            NavigationLink(mailbox.name, value: mailbox)
        }
        .toolbar {  // ← Attached to this view, not NavigationStack
            ToolbarItem(placement: .bottomBar) {
                Button("Filter", systemImage: "line.3.horizontal.decrease") { }
            }
            ToolbarSpacer(.flexible, placement: .bottomBar)
            ToolbarItem(placement: .bottomBar) {
                Button("New Message", systemImage: "square.and.pencil") { }
            }
        }
    }
}

struct MessageList: View {
    let mailbox: Mailbox

    var body: some View {
        List(mailbox.messages) { message in
            MessageRow(message: message)
        }
        .toolbar {  // ← Different toolbar — iOS 26 morphs between them
            ToolbarSpacer(.flexible, placement: .bottomBar)
            ToolbarItem(placement: .bottomBar) {
                Button("New Message", systemImage: "square.and.pencil") { }
            }
        }
    }
}
```

**#1 gotcha**: If you attach `.toolbar {}` to the NavigationStack itself, iOS 26 has nothing to morph between — the toolbar stays static across all pushes.

#### Stable Items with `toolbar(id:)` and `ToolbarItem(id:)`

Items with matching IDs across screens stay in place during morphing (no bounce). Unmatched items animate in/out:

```swift
struct MailboxList: View {
    var body: some View {
        List(mailboxes) { mailbox in
            NavigationLink(mailbox.name, value: mailbox)
        }
        .toolbar(id: "main") {
            ToolbarItem(id: "filter", placement: .bottomBar) {
                Button("Filter", systemImage: "line.3.horizontal.decrease") { }
            }
            ToolbarSpacer(.flexible, placement: .bottomBar)
            ToolbarItem(id: "compose", placement: .bottomBar) {
                Button("New Message", systemImage: "square.and.pencil") { }
            }
        }
    }
}

struct MessageList: View {
    let mailbox: Mailbox

    var body: some View {
        List(mailbox.messages) { message in
            MessageRow(message: message)
        }
        .toolbar(id: "main") {
            // "filter" absent — animates out during push
            ToolbarSpacer(.flexible, placement: .bottomBar)
            ToolbarItem(id: "compose", placement: .bottomBar) {
                // Same ID as MailboxList — stays stable during morph
                Button("New Message", systemImage: "square.and.pencil") { }
            }
        }
    }
}
```

#### Complete Mail-Style Example

Combines DefaultToolbarItem, ToolbarSpacer, and stable compose button:

```swift
struct MailApp: View {
    var body: some View {
        NavigationStack {
            MailboxList()
                .navigationDestination(for: Mailbox.self) { mailbox in
                    MessageList(mailbox: mailbox)
                }
                .navigationDestination(for: Message.self) { message in
                    MessageDetail(message: message)
                }
        }
    }
}

// Each destination defines its own toolbar — NavigationStack morphs between them
```

#### ToolbarSpacer(.flexible)

Pushes toolbar items apart (like Spacer in HStack). Complements `.fixed` for visual separation:

```swift
.toolbar {
    ToolbarItem(placement: .bottomBar) {
        Button("Archive", systemImage: "archivebox") { }
    }
    ToolbarSpacer(.flexible, placement: .bottomBar)  // Push apart
    ToolbarItem(placement: .bottomBar) {
        Button("Compose", systemImage: "square.and.pencil") { }
    }
}
```

#### .navigationSubtitle()

Add a secondary line below the navigation title:

```swift
.navigationTitle("Inbox")
.navigationSubtitle("3 unread messages")
```

### User-Customizable Toolbars

`toolbar(id:content:)` also enables **user customization** — letting people rearrange, show, and hide toolbar items. This is the original purpose of the identified toolbar API (iOS 14+, iPadOS 16+ for customization).

#### Setup

```swift
TextEditor(text: $text)
    .toolbar(id: "editingtools") {
        ToolbarItem(id: "bold", placement: .secondaryAction) {
            Toggle(isOn: $bold) { Image(systemName: "bold") }
        }
        ToolbarItem(id: "italic", placement: .secondaryAction) {
            Toggle(isOn: $italic) { Image(systemName: "italic") }
        }
    }
```

**Platform constraint**: Only `.secondaryAction` items support customization on iPadOS. Other placements follow normal rules and cannot be customized by the user.

#### Controlling visibility

```swift
ToolbarItem(id: "advanced", placement: .secondaryAction, showsByDefault: false) {
    // Hidden by default — user can add from customization editor
    AdvancedFormattingControls()
}
```

#### macOS toolbar customization menu

Add `ToolbarCommands()` to enable the Customize Toolbar menu item:

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .commands {
            ToolbarCommands()
        }
    }
}
```

Users can also Control-click the toolbar to access the customization editor.

#### Related types

- `CustomizableToolbarContent` — Protocol for content that supports customization
- `ToolbarCustomizationBehavior` — Control whether items can be added/removed
- `ToolbarCustomizationOptions` — Options for the customization experience

#### ToolbarSpacer in customizable toolbars

Spacers are customizable items too — users can add, remove, and rearrange them from the customization panel. If a customizable toolbar supports a spacer of a given type, users can also add multiple copies:

```swift
ContentView()
    .toolbar(id: "main-toolbar") {
        ToolbarItem(id: "tag") { TagButton() }
        ToolbarItem(id: "share") { ShareButton() }
        ToolbarSpacer(.fixed)
        ToolbarItem(id: "more") { MoreButton() }
    }
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

**Foundational search APIs** For `.searchable`, `isSearching`, suggestions, scopes, tokens, and programmatic search control, see `axiom-swiftui-search-ref`. This section covers iOS 26 refinements only.

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

To restore pre-iOS 26 sidebar-embedded search on iPad, specify `placement: .sidebar`:

```swift
NavigationSplitView {
    List { }
        .searchable(text: $searchText, placement: .sidebar)
        // Search field embedded in sidebar instead of floating glass container
}
```

#### System Auto-Minimization

Depending on device size, number of toolbar buttons, and other factors, the system may choose to minimize the search field into a toolbar button automatically. When tapped, a full-width search field appears above the keyboard. Use `searchToolbarBehavior(.minimize)` to explicitly opt in to this behavior when search isn't the main part of your experience.

#### Search Tab Role

Searching in multi-tab apps is often done as a dedicated page. Set a search role on one of your tabs and place `.searchable` on the TabView:

```swift
TabView {
    BrowseView()
        .tabItem { Label("Browse", systemImage: "square.grid.2x2") }

    Tab(role: .search) {
        SearchView()
    }
}
.searchable(text: $searchText)
```

When someone selects the search tab, the search field takes the place of the tab bar. People can interact with browsing suggestions or tap the search field to bring up the keyboard.

On iPad and Mac, when someone selects the search tab, the search field appears **centered above the app's browsing suggestions** — a different layout than iPhone's tab-bar replacement.

See swiftui-nav-ref skill Section 5.5 (iOS 26 Tab Features) for full `Tab(role: .search)` patterns.

### Glass Effect for Custom Views

```swift
struct ToTopButton: View {
    var body: some View {
        Button("To Top", systemImage: "chevron.up") {
            scrollToTop()
        }
        .padding()
        .glassEffect() // Reflects surrounding content
    }

    func scrollToTop() { }
}
```

SwiftUI automatically uses a **vibrant text color** that adapts to maintain legibility against colorful backgrounds. Tints also use vibrant color that adapts to the content behind them.

On iOS, add the `.interactive` modifier to the glass effect for custom controls or containers with interactive elements. Glass reacts to user interaction by scaling, bouncing, and shimmering.

#### GlassEffectContainer

Combine multiple glass elements with `GlassEffectContainer`. This is **essential for visual correctness** — glass samples content from an area larger than itself, but glass cannot sample other glass. Nearby glass elements in different containers produce inconsistent behavior:

```swift
GlassEffectContainer {
    HStack(spacing: 12) {
        ForEach(badges) { badge in
            BadgeView(badge: badge)
                .glassEffect()
        }
    }
}
```

#### glassEffectID for Morphing Transitions

Use `glassEffectID` with a namespace to create fluid morphing transitions between glass elements:

```swift
@Namespace private var badgeNamespace

var body: some View {
    if isExpanded {
        // Expanded badge stack
        GlassEffectContainer {
            VStack {
                ForEach(badges) { badge in
                    BadgeView(badge: badge)
                        .glassEffect()
                        .glassEffectID(badge.id, in: badgeNamespace)
                }
            }
        }
    } else {
        // Collapsed into toolbar button
        Button("Badges", systemImage: "star.fill") {
            isExpanded.toggle()
        }
        .glassEffect()
        .glassEffectID("collapsed", in: badgeNamespace)
    }
}
// Tapping the button expands badges with fluid glass morphing;
// tapping again re-absorbs them into the button
```

### Sheets with Liquid Glass

#### Remove presentationBackground

Partial height sheets are inset by default with a Liquid Glass background. At smaller heights, bottom edges pull in, nesting in the curved edges of the display. When transitioning to full height, the glass gradually becomes opaque and anchors to the screen edge.

If you've used `presentationBackground` to apply a custom background to sheets, consider removing it and let the new material shine:

```swift
// ❌ Custom background interferes with Liquid Glass sheet material
.sheet(isPresented: $showDetail) {
    DetailView()
        .presentationBackground(.thinMaterial)  // Remove this
}

// ✅ System applies Liquid Glass automatically
.sheet(isPresented: $showDetail) {
    DetailView()
}
```

#### Sheet Morphing from Buttons

Sheets can morph directly out of the buttons that present them. Use `navigationZoomTransition` to connect the source view to the sheet content:

```swift
.toolbar {
    ToolbarItem(placement: .topBarTrailing) {
        Button("Details", systemImage: "info.circle") {
            showDetails = true
        }
        .matchedTransitionSource(id: "details", in: namespace)
    }
}
.sheet(isPresented: $showDetails) {
    DetailsSheet()
        .navigationTransition(.zoom(sourceID: "details", in: namespace))
}
```

Menus, alerts, and popovers also flow smoothly out of Liquid Glass controls. Dialogs automatically morph out of the buttons that present them — no additional code needed.

### System Controls Updates

Controls now have the new design automatically:
- Toggles
- Segmented pickers
- Sliders

**Reference** "Build a SwiftUI app with the new design" (WWDC 2025-323) for adoption best practices and advanced customizations.

### Button Shape Changes

Bordered buttons now have a **capsule shape** by default, harmonious with the curved corners of the new design. On macOS, mini, small, and medium size controls retain a rounded-rectangle shape to preserve horizontal density.

```swift
// Capsule is now the default bordered shape on iOS
Button("Action") { }
    .buttonStyle(.bordered)  // Capsule shape on iOS 26

// Override with buttonBorderShape if needed
Button("Action") { }
    .buttonStyle(.bordered)
    .buttonBorderShape(.roundedRectangle)  // Force rounded rectangle
```

#### Extra Large Buttons

For prominent actions, iOS 26 adds support for extra large sized buttons:

```swift
Button("Get Started") { startOnboarding() }
    .buttonStyle(.borderedProminent)
    .controlSize(.extraLarge)  // New extra-large size
```

### Updated Control Heights

Control heights are updated for the new design. Most controls on macOS are slightly taller, providing more breathing room around labels and enhancing click targets.

For compatibility with existing high-density layouts (complex inspectors, popovers), apply `controlSize` to a single control or an entire container:

```swift
// Preserve density in complex inspectors
Form {
    // controls here
}
.controlSize(.small)  // Maintains pre-iOS 26 density
```

### Menu Cross-Platform Consistency

Menus across platforms have a new design and more consistent layout. Icons are consistently on the leading edge and are now used on macOS too. The same API using `Label` or standard control initializers now creates the same result on both platforms:

```swift
Menu("Actions") {
    Button("Copy", systemImage: "doc.on.doc") { copy() }
    Button("Paste", systemImage: "doc.on.clipboard") { paste() }
    Button("Delete", systemImage: "trash", role: .destructive) { delete() }
}
// Same result on iOS and macOS — icons on leading edge
```

### Concentric Rectangle Shape

Controls align their corners perfectly within their containers — even the device itself. This is **corner concentricity**. A button at the bottom of a sheet should share the same corner center with the sheet.

```swift
// Automatic concentricity with container
Button("Confirm") { confirm() }
    .clipShape(.rect(cornerRadius: 12, style: .containerConcentric))
    // Shape automatically matches container across displays and window shapes
```

**Use case**: Buttons positioned at the edges of sheets, popovers, or cards that need their corners to feel visually nested within the container.

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

**Foundational search APIs** For the `.searchable` modifier, placement options, and search suggestions that `.searchToolbarBehavior` builds upon, see `axiom-swiftui-search-ref`.

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

**`SearchToolbarBehavior` options**:
- `.minimize` — Search field compact (button-like) when unfocused, expands on tap
- `.automatic` — System default behavior (full search field)

**Behavior**
- Similar to Tab Bar search pattern
- Saves toolbar space
- Cleaner UI when search not in use

**Use cases**
- List/content-heavy screens
- Crowded navigation bars
- Tab bar style search on regular screens

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

### Complete Example

```swift
struct PhotoLibrary: View {
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
        .dragConfiguration(DragConfiguration(allowMove: false, allowDelete: true))
        .dragPreviewsFormation(.stack)
        .onDragSessionUpdated { session in
            let ids = session.draggedItemIDs(for: Photo.ID.self)
            if session.phase == .ended(.delete) {
                trash(ids)
                deletePhotos(ids)
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
- Attach toolbars to individual views for automatic morphing transitions
- Use `toolbar(id:)` with matching IDs for items that should stay stable across screens

#### DON'T
- Fight the automatic design - embrace consistency
- Over-tint toolbars (use for prominence only, not decoration)
- Attach the toolbar to NavigationStack and expect morphing (attach to views inside it)
- Apply `presentationBackground` to sheets (remove it for Liquid Glass material)
- Place nearby glass elements in separate containers (use `GlassEffectContainer`)
- Add extra backgrounds or darkening effects behind system toolbar areas

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
- Check surface snapping state for context-aware UI

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
// Must enable delete in drag configuration
.dragConfiguration(DragConfiguration(allowMove: false, allowDelete: true))

// And observe the delete event
.onDragSessionUpdated { session in
    if session.phase == .ended(.delete) {
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

### Issue: Toolbar morphing not working

**Symptom** Toolbar stays static during NavigationStack push/pop — no morphing animation

#### Solution
```swift
// ❌ WRONG: Toolbar on NavigationStack — nothing to morph between
NavigationStack {
    ContentView()
}
.toolbar {
    ToolbarItem { Button("Action") { } }
}

// ✅ CORRECT: Toolbar on each destination view — iOS 26 morphs between them
NavigationStack {
    ListView()
        .toolbar {
            ToolbarItem { Button("Filter") { } }
        }
        .navigationDestination(for: Item.self) { item in
            DetailView(item: item)
                .toolbar {
                    ToolbarItem { Button("Edit") { } }
                }
        }
}
```

Move `.toolbar {}` from the NavigationStack to each view inside it. iOS 26 morphs between per-view toolbars during navigation transitions.

---

## Resources

**WWDC**: 2025-256, 2025-278 (What's new in widgets), 2025-287 (Meet WebKit for SwiftUI), 2025-310 (Optimize SwiftUI performance with instruments), 2025-323 (Build a SwiftUI app with the new design), 2025-325 (Bring Swift Charts to the third dimension), 2025-341 (Cook up a rich text experience in SwiftUI with AttributedString)

**Docs**: /swiftui, /swiftui/defaulttoolbaritem, /swiftui/toolbarspacer, /swiftui/searchtoolbarbehavior, /swiftui/view/toolbar(id:content:), /swiftui/view/tabbarminimizebehavior(_:), /swiftui/view/tabviewbottomaccessory(isenabled:content:), /swiftui/slider, /swiftui/slidertick, /swiftui/slidertickcontentforeach, /webkit, /foundation/attributedstring, /charts, /realitykit/presentationcomponent, /swiftui/chart3d

**Skills**: axiom-swiftui-performance, axiom-liquid-glass, axiom-swift-concurrency, axiom-app-intents-ref, axiom-swiftui-search-ref

---

**Primary source** WWDC 2025-256 "What's new in SwiftUI". Additional content from 2025-323 (Build a SwiftUI app with the new design), 2025-287 (Meet WebKit for SwiftUI), and Apple documentation.
**Version** iOS 26+, iPadOS 26+, macOS Tahoe+, watchOS 26+, visionOS 26+
