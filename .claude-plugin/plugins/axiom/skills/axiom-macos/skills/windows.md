
# macOS Window Management

## When to Use This Skill

Use when:
- Choosing between WindowGroup, Window, UtilityWindow, MenuBarExtra, or Settings scenes
- Opening or dismissing windows programmatically
- Setting default window size, position, or resizability
- Building a multi-window macOS app from an iOS-first codebase
- Customizing window toolbar style or removing default menu commands
- Adding a menu bar extra (standalone utility or companion to main app)
- Debugging windows that won't open, open duplicates, or lose state on relaunch

#### Related Skills

- Use `skills/menus-and-commands.md` for menu bar customization, keyboard shortcuts, CommandMenu, and CommandGroup
- Use `axiom-swiftui` for SwiftUI view layout, navigation, and architecture within a window

## Red Flags — Anti-Patterns to Prevent

### 1. Using WindowGroup when you need exactly one window

```swift
// WRONG — Creates "New Window" menu item, allows duplicates
WindowGroup("Activity") {
    ActivityView()
}
```

**Why this fails**: WindowGroup allows multiple instances. Users can Cmd+N to create duplicates of a window that represents global app state. Use `Window` for singleton windows. The Window scene automatically adds a menu item in the Window menu to show/focus it.

### 2. Passing full model objects as window presentation values

```swift
// WRONG — Copies value type, duplicates state
openWindow(value: book)  // Book is a struct
```

**Why this fails**: Value types get copied. Edits in the new window don't reflect in the original. The value also gets persisted for state restoration — large objects degrade app launch time. Pass identifiers (e.g., `book.id`) and resolve from your model store. Presentation values must conform to both `Hashable` and `Codable` (WWDC 2022-10061).

### 3. Missing .commandsRemoved() on data-driven WindowGroup

```swift
// WRONG — Adds unwanted "Book Details" item to File > New menu
WindowGroup("Book Details", for: Book.ID.self) { $bookId in
    BookDetail(id: $bookId)
}
```

**Why this fails**: Every WindowGroup adds a "New [Title] Window" item to the File menu by default. For windows that should only open programmatically (e.g., via context menu), apply `.commandsRemoved()` to suppress the menu item.

### 4. Using Window as the app's primary scene

```swift
// WRONG — App quits when window closes
Window("My App", id: "main") {
    ContentView()
}
```

**Why this fails**: A `Window` used as the primary scene causes the app to terminate when closed. Use `WindowGroup` for primary scenes — it supports multi-window, tabbing, and standard lifecycle.

### 5. Forgetting that defaultSize is ignored on state restoration

```swift
// Misleading — Users expect this to always apply
.defaultSize(width: 800, height: 600)
```

**Why this matters**: `defaultSize` only applies when no previous window state exists. Once the user resizes the window, SwiftUI persists their choice and ignores defaultSize on subsequent launches. This is correct behavior — don't fight it.

---

## Scene Types

Pick the right scene type first. Getting this wrong costs 30+ minutes of refactoring.

| Scene Type | Instances | Use Case | Menu Integration |
|---|---|---|---|
| `WindowGroup` | Multiple | Primary app content, data-driven detail windows | File > New Window |
| `Window` | Single | Singleton auxiliary windows (activity monitor, console) | Window menu item |
| `UtilityWindow` | Single | Floating panels (inspectors, formatters) — stays above main windows | View menu toggle |
| `MenuBarExtra` | Single | Menu bar utility (standalone or companion) | System menu bar |
| `Settings` | Single | App preferences | App menu > Settings (auto) |
| `DocumentGroup` | Multiple | Document-based apps with file I/O | File > New/Open |

#### Decision Tree

```
What kind of window?
├─ App's main content?
│  ├─ Document-based (files on disk)? → DocumentGroup
│  └─ Non-document? → WindowGroup
├─ Auxiliary window showing app state?
│  ├─ Should float above other windows? → UtilityWindow (macOS 15+)
│  ├─ Exactly one instance? → Window
│  └─ Multiple instances (e.g., detail per item)? → WindowGroup (with .commandsRemoved())
├─ Menu bar control?
│  └─ MenuBarExtra
└─ Preferences?
   └─ Settings
```

#### Platform Availability

| Scene | macOS | iOS/iPadOS | visionOS |
|---|---|---|---|
| WindowGroup | 11.0+ | 14.0+ | 1.0+ |
| Window | 13.0+ | — | 26.0+ |
| UtilityWindow | 15.0+ | — | — |
| MenuBarExtra | 13.0+ | — | — |
| Settings | 11.0+ | — | — |

---

## Window Lifecycle

### Opening Windows

Access `openWindow` from the environment. It matches by scene ID or by presentation value type.

```swift
struct ContentView: View {
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button("Show Activity") {
            openWindow(id: "activity")
        }

        // Data-driven: opens or focuses existing window for this ID
        Button("Open Book") {
            openWindow(value: book.id)
        }
    }
}
```

The data-driven form requires a matching WindowGroup with a `for:` parameter:

```swift
WindowGroup("Book Details", for: Book.ID.self) { $bookId in
    BookDetail(id: $bookId)
}
.commandsRemoved()  // Only open via openWindow, not File menu
```

SwiftUI uses the value's equality to decide: if a window for that value exists, it focuses it. Otherwise it creates a new one.

### Dismissing Windows

```swift
@Environment(\.dismissWindow) private var dismissWindow

Button("Close Panel") {
    dismissWindow(id: "auxiliary")
}
```

For the current window, use `@Environment(\.dismiss)`.

### Settings

```swift
// App definition
Settings {
    SettingsView()
}

// Open programmatically from anywhere
@Environment(\.openSettings) private var openSettings

Button("Preferences...") {
    openSettings()
}
```

SwiftUI automatically adds the Settings item to the app menu and binds Cmd+, to it.

---

## Default Size, Position, and Resizability

### Default Size

Applied only on first launch or when no saved state exists:

```swift
Window("Activity", id: "activity") {
    ActivityView()
}
.defaultSize(width: 400, height: 800)
```

### Default Position

Screen-relative positioning, respects current locale for leading/trailing:

```swift
.defaultPosition(.topTrailing)
```

### Programmatic Placement

For calculated positions based on display geometry (macOS 14+):

```swift
.defaultWindowPlacement { content, context in
    let displayBounds = context.defaultDisplay.visibleRect
    let size = content.sizeThatFits(.unspecified)
    let position = CGPoint(
        x: displayBounds.midX - (size.width / 2),
        y: displayBounds.maxY - size.height - 20
    )
    return WindowPlacement(position, size: size)
}
```

### Resizability

Control whether and how users can resize:

```swift
// Window size tracks content min/max constraints
.windowResizability(.contentSize)

// Content view defines the bounds
MovieView()
    .frame(minWidth: 680, maxWidth: 2720, minHeight: 680, maxHeight: 1020)
```

| Resizability | Behavior |
|---|---|
| `.automatic` | Default platform behavior |
| `.contentSize` | Constrained to content's min/max frame |
| `.contentMinSize` | Can grow beyond content max, respects min |

---

## Window and Toolbar Styles

### Window Style

```swift
WindowGroup {
    ContentView()
}
.windowStyle(.hiddenTitleBar)  // Removes title bar and backing
```

| Style | Effect |
|---|---|
| `.automatic` | Standard window appearance |
| `.hiddenTitleBar` | No title bar or backing material |
| `.titleBar` | Explicit title bar |

### Toolbar Style

```swift
WindowGroup {
    ContentView()
}
.windowToolbarStyle(.unified)
```

| Style | Effect |
|---|---|
| `.automatic` | Platform default |
| `.expanded` | Title bar above toolbar |
| `.unified` | Title and toolbar inline |
| `.unified(showsTitle: false)` | Inline, title hidden |
| `.unifiedCompact` | Compact inline toolbar |

---

## Patterns

### Multi-Window App with Auxiliary Window

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            MainView()
        }

        Window("Activity", id: "activity") {
            ActivityView()
        }
        #if os(macOS)
        .defaultPosition(.topTrailing)
        .defaultSize(width: 400, height: 600)
        .keyboardShortcut("0", modifiers: [.option, .command])
        #endif
    }
}
```

### Data-Driven Detail Windows

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentListView()
        }

        WindowGroup("Item Detail", for: Item.ID.self) { $itemId in
            DetailView(itemId: $itemId)
        }
        .commandsRemoved()
    }
}

// In any view:
@Environment(\.openWindow) private var openWindow

Button("Open in Window") {
    openWindow(value: item.id)  // Hashable + Codable
}
```

### Menu Bar Extra — Standalone Utility

```swift
@main
struct StatusApp: App {
    var body: some Scene {
        MenuBarExtra("Status", systemImage: "gauge.medium") {
            StatusMenu()
        }
    }
}
```

Set `LSUIElement = true` in Info.plist to hide Dock icon for menu-bar-only apps.

### Menu Bar Extra — Window Style

For richer content than a simple menu:

```swift
MenuBarExtra("Dashboard", systemImage: "chart.bar") {
    DashboardView()
}
.menuBarExtraStyle(.window)
```

### Floating Utility Panel (macOS 15+)

```swift
UtilityWindow("Inspector", id: "inspector") {
    InspectorView()
}
```

UtilityWindow automatically:
- Floats above main windows
- Receives FocusedValues from the focused main scene
- Adds a show/hide toggle in the View menu
- Hides when the app loses focus
- Dismisses on Escape

Use `.commandsRemoved()` + `WindowVisibilityToggle` for custom menu placement.

### Settings with Tabs

```swift
#if os(macOS)
Settings {
    TabView {
        GeneralSettings()
            .tabItem { Label("General", systemImage: "gear") }
        AccountSettings()
            .tabItem { Label("Account", systemImage: "person") }
    }
    .scenePadding()
    .frame(width: 450, height: 300)
}
#endif
```

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| WindowGroup for singleton window | Duplicate windows via Cmd+N | Use `Window` instead |
| Missing `.commandsRemoved()` | Unwanted File menu item | Add `.commandsRemoved()` to programmatic-only WindowGroup |
| Passing struct as openWindow value | Edits don't sync between windows | Pass ID, resolve from model store |
| Presentation value not Codable | Compiler error or no state restoration | Conform to both `Hashable` and `Codable` |
| defaultSize not working on relaunch | User resized previously | Expected behavior — defaultSize only applies without saved state |
| Window closes → app quits | `Window` used as primary scene | Use `WindowGroup` for primary scene |
| Menu bar extra not visible | Missing `LSUIElement` or wrong style | Check Info.plist; use `.menuBarExtraStyle(.window)` for rich content |
| UtilityWindow not floating | Using plain `Window` | Use `UtilityWindow` (macOS 15+) for floating panels |
| Keyboard shortcut not working | Applied at view level | Apply `.keyboardShortcut()` at scene level for window-opening shortcuts |

---

## Resources

**WWDC**: 2022-10061, 2024-10149

**Docs**: /swiftui/windowgroup, /swiftui/window, /swiftui/utilitywindow, /swiftui/menubarextra, /swiftui/settings, /swiftui/openwindowaction, /swiftui/dismisswindowaction, /swiftui/windowstyle, /swiftui/windowtoolbarstyle

**HIG**: /windows, /designing-for-macos

**Skills**: skills/menus-and-commands.md, axiom-swiftui
