# SwiftUI 26 Features

Comprehensive guide to new SwiftUI features in iOS 26, iPadOS 26, macOS Tahoe, watchOS 26, and visionOS 26. From the Liquid Glass design system to rich text editing, these enhancements make SwiftUI more powerful across all Apple platforms.

## When to Use

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

## What It Covers

### Liquid Glass Design System

**Automatic Adoption**
- Glassy sidebars on iPad/macOS
- Compact tab bars on iPhone
- Liquid Glass toolbar items with morphing transitions
- Blur effects on scroll edges

**Customization APIs**
- Toolbar spacer API (`.fixed`)
- Tinted prominent buttons in toolbars
- Glass effect for custom views (`.glassBackgroundEffect()`)
- Bottom-aligned search on iPhone
- Search tab role (`.tabRole(.search)`)

### iPad & macOS Enhancements

**iPad**
- Menu bar with `.commands` API (swipe-down access)
- Resizable windows (deprecates `UIRequiresFullscreen`)
- Automatic column showing/hiding in split views

**macOS**
- Window resize anchor (`.windowResizeAnchor()`)
- Synchronized content/window animations
- 6x faster list loading, 16x faster updates (100k+ items)

### Performance Improvements

**List Performance**
- 6x faster loading for 100,000+ item lists on macOS
- 16x faster updates for large lists
- Benefits all platforms (iOS, iPadOS, watchOS)

**Scrolling**
- Improved frame scheduling reduces dropped frames
- Nested ScrollViews with lazy stacks now properly delay loading
- Great for photo carousels and multi-axis scrolling

**SwiftUI Performance Instrument**
- New profiling tool in Xcode
- Lanes for long view body updates, platform view updates

### @Animatable Macro

Simplifies custom animations by automatically synthesizing `animatableData`:

```swift
@Animatable
struct HikingRouteShape: Shape {
    var startPoint: CGPoint
    var endPoint: CGPoint
    var elevation: Double

    @AnimatableIgnored
    var drawingDirection: Bool // Excluded from animation
}
```

### 3D Spatial Layout (visionOS)

**New APIs**
- `Alignment3D` for depth-based layouts
- `.spatialOverlay()` modifier
- `.manipulable()` for interactive 3D objects
- Scene snapping APIs

### Scene Bridging

**UIKit/AppKit → SwiftUI scenes**
- Use `MenuBarExtra`, `ImmersiveSpace`, `RemoteImmersiveSpace`, `AssistiveAccess`
- Apply scene modifiers like `.windowStyle()`, `.immersiveEnvironmentBehavior()`
- RemoteImmersiveSpace: Mac app renders stereo content on Vision Pro

### WebView & WebPage

**Native web content in SwiftUI**

```swift
import WebKit

// Simple URL display
WebView(url: articleURL)

// Rich interaction with WebPage
@State private var webPage = WebPage()
WebView(page: webPage)

// Access: webPage.title, webPage.canGoBack, webPage.goForward()
```

### TextView with AttributedString

**Rich text editing**

```swift
@State private var comment = AttributedString("Enter your comment")

TextEditor(text: $comment)
// Built-in formatting controls: bold, italic, underline, colors
```

### Drag and Drop Enhancements

**Multiple items**
- `.dragContainer` for selection-based dragging
- `DragConfiguration` for supported operations
- `.onDragSessionUpdated` for event observation
- `.dragPreviewFormation(.stack)` for visual grouping

### 3D Charts

```swift
import Charts

Chart3D {
    ForEach(hikingData) { point in
        LineMark3D(
            x: .value("Distance", point.distance),
            y: .value("Elevation", point.elevation),
            z: .value("Time", point.timestamp)
        )
    }
}
.chartZScale(domain: startTime...endTime)
```

### Widgets & Controls

**New platforms**
- Controls on watchOS 26 and macOS (Control Center)
- Widgets on visionOS with `levelOfDetail` environment
- Widgets on CarPlay with Live Activities

**Additional features**
- Push-based updating API
- New relevance APIs for watchOS

## Requirements

iOS 26+, iPadOS 26+, macOS Tahoe+, watchOS 26+, visionOS 26+

## Resources

### WWDC Sessions
- [What's new in SwiftUI (WWDC 2025-256)](https://developer.apple.com/videos/play/wwdc2025/256/)
- Build a SwiftUI app with the new design
- Optimize SwiftUI performance with instruments
- Meet WebKit for SwiftUI
- Cook up a rich text experience in SwiftUI with AttributedString
- Bring Swift Charts to the third dimension

### Apple Documentation
- [SwiftUI Overview](https://developer.apple.com/documentation/swiftui)
- [WebKit Framework](https://developer.apple.com/documentation/webkit)
- [AttributedString](https://developer.apple.com/documentation/foundation/attributedstring)
- [Swift Charts](https://developer.apple.com/documentation/charts)

## Example Patterns

### Liquid Glass Toolbar

```swift
.toolbar {
    ToolbarItemGroup(placement: .topBarTrailing) {
        Button("Up") { }
        Button("Down") { }

        Spacer(.fixed) // Separate button groups

        Button("Settings") { }
            .buttonStyle(.borderedProminent)
            .tint(.blue) // Prominent in Liquid Glass
    }
}
```

### Rich Text Comments

```swift
struct CommentView: View {
    @State private var comment = AttributedString("Enter your comment")

    var body: some View {
        VStack {
            TextEditor(text: $comment)
                // Built-in formatting controls

            Button("Submit") {
                submitComment(comment)
            }
        }
    }
}
```

### Multi-Item Drag and Drop

```swift
struct PhotoGrid: View {
    @State private var selection: Set<Photo.ID> = []

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

## See Also

- **[SwiftUI Performance](/skills/ui-design/swiftui-performance)** — Master the SwiftUI Instrument
- **[Liquid Glass](/skills/ui-design/liquid-glass)** — Apple's material design system
- **[Swift Concurrency](/skills/concurrency/swift-concurrency)** — Swift 6 strict concurrency
- **[App Intents Integration](/skills/integration/app-intents-ref)** — AttributedString for Apple Intelligence
