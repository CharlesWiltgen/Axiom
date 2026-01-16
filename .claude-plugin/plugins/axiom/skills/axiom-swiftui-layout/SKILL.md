---
name: axiom-swiftui-layout
description: Use when layouts need to adapt to different screen sizes, iPad multitasking, or iOS 26 free-form windows — decision trees for ViewThatFits vs AnyLayout vs onGeometryChange, size class limitations, and anti-patterns preventing device-based layout mistakes
user-invocable: true
skill_type: discipline
version: 1.0.0
---

# SwiftUI Adaptive Layout

## Overview

Discipline-enforcing skill for building layouts that respond to available space rather than device assumptions. Covers tool selection, size class limitations, iOS 26 free-form windows, and common anti-patterns.

**Core principle:** Your layout should work correctly if Apple ships a new device tomorrow, or if iPadOS adds a new multitasking mode next year. Respond to your container, not your assumptions about the device.

## When to Use This Skill

- "How do I make this layout work on iPad and iPhone?"
- "Should I use GeometryReader or ViewThatFits?"
- "My layout breaks in Split View / Stage Manager"
- "Size classes aren't giving me what I need"
- "Designer wants different layout for portrait vs landscape"
- "Preparing app for iOS 26 window resizing"

## Decision Tree

```
"I need my layout to adapt..."
│
├─ TO AVAILABLE SPACE (container-driven)
│   │
│   ├─ "Pick best-fitting variant"
│   │   → ViewThatFits
│   │
│   ├─ "Animated switch between H↔V"
│   │   → AnyLayout + condition
│   │
│   ├─ "Read size for calculations"
│   │   → onGeometryChange (iOS 16+)
│   │
│   └─ "Custom layout algorithm"
│       → Layout protocol
│
├─ TO PLATFORM TRAITS
│   │
│   ├─ "Compact vs Regular width"
│   │   → horizontalSizeClass (⚠️ iPad limitations)
│   │
│   ├─ "Accessibility text size"
│   │   → dynamicTypeSize.isAccessibilitySize
│   │
│   └─ "Platform differences"
│       → #if os() / Environment
│
└─ TO WINDOW SHAPE (aspect ratio)
    │
    ├─ "Portrait vs Landscape semantics"
    │   → Geometry + custom threshold
    │
    ├─ "Auto show/hide columns"
    │   → NavigationSplitView (automatic in iOS 26)
    │
    └─ "Window lifecycle"
        → @Environment(\.scenePhase)
```

## Tool Selection

### Quick Decision

```
Do you need a calculated value (width, height)?
├─ YES → onGeometryChange
└─ NO → Do you need animated transitions?
         ├─ YES → AnyLayout + condition
         └─ NO → ViewThatFits
```

### When to Use Each Tool

| I need to... | Use this | Not this |
|-------------|----------|----------|
| Pick between 2-3 layout variants | `ViewThatFits` | `if size > X` |
| Switch H↔V with animation | `AnyLayout` | Conditional HStack/VStack |
| Read container size | `onGeometryChange` | `GeometryReader` |
| Adapt to accessibility text | `dynamicTypeSize` | Fixed breakpoints |
| Detect compact width | `horizontalSizeClass` | `UIDevice.idiom` |
| Detect narrow window on iPad | Geometry + threshold | Size class alone |
| Hide/show sidebar | `NavigationSplitView` | Manual column logic |
| Custom layout algorithm | `Layout` protocol | Nested GeometryReaders |

---

## Pattern 1: ViewThatFits

**Use when:** You have 2-3 layout variants and want SwiftUI to pick the first that fits.

```swift
ViewThatFits {
    // First choice: horizontal
    HStack {
        Image(systemName: "star")
        Text("Favorite")
        Spacer()
        Button("Add") { }
    }

    // Fallback: vertical
    VStack {
        HStack {
            Image(systemName: "star")
            Text("Favorite")
        }
        Button("Add") { }
    }
}
```

**Limitation:** ViewThatFits doesn't expose which variant was chosen. If you need that state for other views, use AnyLayout instead.

---

## Pattern 2: AnyLayout for Animated Switching

**Use when:** You need animated transitions between layouts, or need to know current layout state.

```swift
struct AdaptiveStack<Content: View>: View {
    @Environment(\.horizontalSizeClass) var sizeClass

    let content: Content

    var layout: AnyLayout {
        sizeClass == .compact
            ? AnyLayout(VStackLayout(spacing: 12))
            : AnyLayout(HStackLayout(spacing: 20))
    }

    var body: some View {
        layout {
            content
        }
        .animation(.default, value: sizeClass)
    }
}
```

**For Dynamic Type:**

```swift
@Environment(\.dynamicTypeSize) var dynamicTypeSize

var layout: AnyLayout {
    dynamicTypeSize.isAccessibilitySize
        ? AnyLayout(VStackLayout())
        : AnyLayout(HStackLayout())
}
```

---

## Pattern 3: onGeometryChange (Preferred for Geometry)

**Use when:** You need actual dimensions for calculations. Preferred over GeometryReader.

```swift
struct ResponsiveGrid: View {
    @State private var columnCount = 2

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: columnCount)) {
            ForEach(items) { item in
                ItemView(item: item)
            }
        }
        .onGeometryChange(for: Int.self) { proxy in
            max(1, Int(proxy.size.width / 150))
        } action: { newCount in
            columnCount = newCount
        }
    }
}
```

**For aspect ratio detection (iPad "orientation"):**

```swift
struct WindowShapeReader: View {
    @State private var isWide = true

    var body: some View {
        content
            .onGeometryChange(for: Bool.self) { proxy in
                proxy.size.width > proxy.size.height * 1.2
            } action: { newValue in
                isWide = newValue
            }
    }
}
```

---

## Pattern 4: GeometryReader (When Necessary)

**Use when:** You need geometry AND are on iOS 15 or earlier, OR need geometry during layout phase (not just as side effect).

```swift
// ✅ CORRECT: Constrained GeometryReader
VStack {
    GeometryReader { geo in
        Text("Width: \(geo.size.width)")
    }
    .frame(height: 44)  // MUST constrain!

    Button("Next") { }
}

// ❌ WRONG: Unconstrained (greedy)
VStack {
    GeometryReader { geo in
        Text("Width: \(geo.size.width)")
    }
    // Takes all available space, crushes siblings
    Button("Next") { }
}
```

---

## Size Class Truth Table (iPad)

| Configuration | Horizontal | Vertical |
|--------------|------------|----------|
| Full screen portrait | `.regular` | `.regular` |
| Full screen landscape | `.regular` | `.regular` |
| 70% Split View | `.regular` | `.regular` |
| 50% Split View | `.regular` | `.regular` |
| 33% Split View | `.compact` | `.regular` |
| Slide Over | `.compact` | `.regular` |
| With keyboard | (unchanged) | (unchanged) |

**Key insight:** Size class only goes `.compact` on iPad at ~33% width or Slide Over. For finer control, use geometry.

---

## iOS 26 Free-Form Windows

### What Changed

| Before iOS 26 | iOS 26+ |
|---------------|---------|
| Fixed Split View sizes | Free-form drag-to-resize |
| `UIRequiresFullScreen` allowed | **Deprecated** |
| No menu bar on iPad | Menu bar via `.commands` |
| Manual column visibility | `NavigationSplitView` auto-adapts |

### Apple's Guideline

> "Resizing an app should not permanently alter its layout. Be opportunistic about reverting back to the starting state whenever possible."

**Translation:** Don't save layout state based on window size. When window returns to original size, layout should too.

### NavigationSplitView Auto-Adaptation

```swift
// iOS 26: Columns automatically show/hide
NavigationSplitView {
    Sidebar()
} content: {
    ContentList()
} detail: {
    DetailView()
}
// No manual columnVisibility management needed
```

### Migration Checklist

- [ ] Remove `UIRequiresFullScreen` from Info.plist
- [ ] Test at arbitrary window sizes (not just 33/50/66%)
- [ ] Verify layout doesn't "stick" after resize
- [ ] Add menu bar commands for common actions
- [ ] Test Window Controls don't overlap toolbar items

---

## Anti-Patterns

### ❌ Device Orientation Observer

```swift
// ❌ WRONG: Reports device, not window
NotificationCenter.default.addObserver(
    forName: UIDevice.orientationDidChangeNotification, ...
)

let orientation = UIDevice.current.orientation
if orientation.isLandscape { ... }
```

**Why it fails:** Reports physical device orientation, not window shape. Wrong in Split View, Stage Manager, iOS 26.

**Fix:** Use `onGeometryChange` to read actual window dimensions.

### ❌ Screen Bounds

```swift
// ❌ WRONG: Returns full screen, not your window
let width = UIScreen.main.bounds.width
if width > 700 { useWideLayout() }
```

**Why it fails:** In multitasking, your app may only have 40% of the screen.

**Fix:** Read your view's actual container size.

### ❌ Device Model Checks

```swift
// ❌ WRONG: Breaks on new devices, wrong in multitasking
if UIDevice.current.userInterfaceIdiom == .pad {
    useWideLayout()
}
```

**Why it fails:** iPad in 1/3 Split View is narrower than iPhone 14 Pro Max landscape.

**Fix:** Respond to available space, not device identity.

### ❌ Unconstrained GeometryReader

```swift
// ❌ WRONG: GeometryReader is greedy
VStack {
    GeometryReader { geo in
        Text("Size: \(geo.size)")
    }
    Button("Next") { }  // Crushed
}
```

**Fix:** Constrain with `.frame()` or use `onGeometryChange`.

### ❌ Size Class as Orientation Proxy

```swift
// ❌ WRONG: iPad is .regular in both orientations
var isLandscape: Bool {
    horizontalSizeClass == .regular  // Always true on iPad!
}
```

**Fix:** Calculate from actual geometry if you need aspect ratio.

---

## Pressure Scenarios

### "Designer wants iPhone-specific layout"

**Temptation:** `if UIDevice.current.userInterfaceIdiom == .phone`

**Response:** "I'll implement these as 'compact' and 'regular' layouts that switch based on available space. The iPhone layout will appear on iPad when the window is narrow. This future-proofs us for Stage Manager and iOS 26."

### "Just use GeometryReader, it's fine"

**Temptation:** Wrap everything in GeometryReader.

**Response:** "GeometryReader has known layout side effects — it expands greedily. `onGeometryChange` reads the same data without affecting layout. It's backported to iOS 16."

### "Size classes worked before"

**Temptation:** Force everything through size class.

**Response:** "Size classes are coarse. iPad is `.regular` in both orientations. I'll use size class for broad categories and geometry for precise thresholds."

### "We don't support iPad multitasking"

**Temptation:** `UIRequiresFullScreen = true`

**Response:** "Apple deprecated full-screen-only in iOS 26. Even without active Split View support, the app can't break when resized. Space-based layout costs the same."

---

## Resources

**WWDC**: 2025-208, 2024-10074, 2022-10056

**Skills**: axiom-swiftui-layout-ref, axiom-swiftui-debugging, axiom-liquid-glass
