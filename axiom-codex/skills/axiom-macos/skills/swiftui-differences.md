# macOS SwiftUI Differences

## When to Use This Skill

Use when:
- Bringing an iOS SwiftUI app to macOS
- Building a macOS-first SwiftUI app
- Choosing between List and Table for structured data
- Implementing three-column NavigationSplitView layouts
- Adding Inspector panels for selection details
- Adding keyboard shortcuts, menu bar commands, or focus-driven interactions
- Configuring toolbar styles for macOS windows
- Debugging macOS-specific SwiftUI layout or behavior

## Related Skills

- Use `skills/settings.md` for macOS Settings windows
- Use `nav.md` (axiom-swiftui) for NavigationSplitView fundamentals shared across platforms
- Use `architecture.md` (axiom-swiftui) for SwiftUI app architecture patterns

---

## The Mental Model Shift

macOS is NOT "iPhone on a bigger screen." Three differences change everything:

1. **Multi-window.** Users run several windows of your app simultaneously. Each window has independent state. Use `@SceneStorage` to persist per-window state like sidebar expansion, column visibility, and selection.

2. **Focus-driven.** The focused window determines which menu commands apply. Use `focusedSceneValue` to expose data from the active window to the menu bar. Commands target the front-most window, not a global singleton.

3. **Keyboard-first.** macOS users expect every action to have a keyboard shortcut. The menu bar must contain ALL actions your app supports, with the toolbar providing a convenient subset. If an action only exists in a toolbar button, keyboard-only users cannot reach it.

Skipping any of these three creates an app that feels like a ported iPad app rather than a native Mac app.

---

## Red Flags -- Anti-Patterns to Prevent

If you are doing ANY of these, STOP and use the patterns in this skill:

### 1. Using List when Table is appropriate

```swift
// WRONG -- List for multi-column structured data on macOS
List(plants) { plant in
    HStack {
        Text(plant.name)
        Spacer()
        Text(plant.daysToMaturity, format: .number)
        Spacer()
        Text(plant.datePlanted, format: .date)
    }
}
```
**Why this fails**: No column headers, no sorting, no column resizing, no column reordering. Users cannot customize their view of the data. Use Table when you have multiple sortable text properties.

### 2. Ignoring keyboard navigation

```swift
// WRONG -- toolbar-only action with no menu bar equivalent
.toolbar {
    Button("Mark as Watered", systemImage: "drop.fill") {
        markSelectedAsWatered()
    }
}
```
**Why this fails**: No keyboard shortcut, no menu bar entry. Keyboard-only users cannot perform this action. Every action must appear in the menu bar with a shortcut.

### 3. Using sheets for detail instead of Inspector

```swift
// WRONG -- modal sheet for non-modal detail on macOS
.sheet(item: $selectedItem) { item in
    ItemDetailView(item: item)
}
```
**Why this fails**: Sheets are modal -- they block interaction with the main content. Inspector shows detail alongside content, letting users edit while viewing the list. Use Inspector for selection-dependent detail panels.

### 4. Hardcoding single-window assumptions

```swift
// WRONG -- global singleton for window state
class AppState: ObservableObject {
    static let shared = AppState()
    @Published var selectedGarden: Garden?
}
```
**Why this fails**: All windows share the same selection. Selecting a garden in one window changes the other. Use `@SceneStorage` and per-scene state instead.

### 5. Missing SidebarCommands and InspectorCommands

```swift
// WRONG -- no system command support
WindowGroup {
    ContentView()
}
// Missing .commands { SidebarCommands(); InspectorCommands() }
```
**Why this fails**: Users cannot toggle sidebar or inspector from the View menu or keyboard shortcuts. These are expected standard behaviors on macOS.

---

## Table

**When to use Table instead of List**: You have 2+ text/numeric columns AND users benefit from sorting, column reordering, or column resizing. For visual content (images, complex cells), prefer List.

### Basic sortable Table

```swift
struct PlantTable: View {
    @State private var plants: [Plant]
    @State private var selection: Set<Plant.ID> = []
    @State private var sortOrder: [KeyPathComparator<Plant>] = [
        .init(\.name, order: .forward)
    ]

    var body: some View {
        Table(plants, selection: $selection, sortOrder: $sortOrder) {
            TableColumn("Name", value: \.name)
            TableColumn("Days to Maturity", value: \.daysToMaturity) {
                Text($0.daysToMaturity, format: .number)
            }
            TableColumn("Date Planted") {
                Text($0.datePlanted, format: .date)
            }
        }
        .onChange(of: sortOrder) { _, newOrder in
            plants.sort(using: newOrder)
        }
    }
}
```

Key points:
- Provide `selection` binding for single or multi-select (`Set<ID>` for multi)
- Provide `sortOrder` binding and key paths on each column for sorting
- Table handles header display and sort indicators automatically
- You must sort the data yourself in `onChange(of: sortOrder)`

### Column customization (macOS 14+, iOS 17+)

Persist column order and visibility across launches:

```swift
@SceneStorage("plantTableColumns")
private var columnCustomization: TableColumnCustomization<Plant>

Table(plants, selection: $selection, columnCustomization: $columnCustomization) {
    TableColumn("Name", value: \.name)
        .customizationID("name")
    TableColumn("Days to Maturity", value: \.daysToMaturity) {
        Text($0.daysToMaturity, format: .number)
    }
    .customizationID("maturity")
    TableColumn("Date Planted") {
        Text($0.datePlanted, format: .date)
    }
    .customizationID("planted")
}
```

Every column needs a stable `.customizationID`. Combined with `@SceneStorage`, column preferences persist per-window.

### Hierarchical rows with DisclosureTableRow

```swift
Table(of: FileItem.self) {
    TableColumn("Name", value: \.name)
    TableColumn("Size") { Text($0.size, format: .byteCount(style: .file)) }
} rows: {
    ForEach(topLevelItems) { item in
        DisclosureTableRow(item) {
            ForEach(item.children) { child in
                TableRow(child)
            }
        }
    }
}
```

Use `DisclosureTableRow` for parent-child relationships. Children appear nested with disclosure triangles, like Finder's list view.

### Platform behavior

| Platform | Columns shown | Scrolling | Headers |
|----------|--------------|-----------|---------|
| macOS | All columns | Vertical + horizontal | Visible, clickable for sort |
| iPadOS (regular) | All columns | Vertical + horizontal | Visible |
| iPadOS (compact) / iPhone | First column only | Vertical | Hidden |

On compact sizes, Table collapses to show only the first column. Design your first column to be meaningful on its own, or use `horizontalSizeClass` to provide an alternative layout.

### Table styling

```swift
Table(items) { /* columns */ }
    .tableStyle(.bordered)           // macOS only -- adds visible borders
    .tableColumnHeaders(.hidden)     // hide headers for small data sets
```

Available styles: `.automatic`, `.inset`, `.bordered` (macOS only).

---

## NavigationSplitView on macOS

On macOS, NavigationSplitView renders as a true multi-column layout with resizable dividers. All columns are visible simultaneously.

### Three-column layout

```swift
NavigationSplitView {
    // Sidebar -- garden list
    List(gardens, selection: $selectedGarden) { garden in
        Label(garden.name, systemImage: "leaf")
    }
    .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 300)
} content: {
    // Content -- plant table for selected garden
    if let garden = selectedGarden {
        PlantTable(garden: garden)
    } else {
        ContentUnavailableView("Select a Garden", systemImage: "leaf")
    }
} detail: {
    // Detail -- selected plant info
    if let plant = selectedPlant {
        PlantDetailView(plant: plant)
    } else {
        ContentUnavailableView("Select a Plant", systemImage: "leaf.circle")
    }
}
```

### Column visibility

```swift
@State private var columnVisibility: NavigationSplitViewVisibility = .all

NavigationSplitView(columnVisibility: $columnVisibility) {
    Sidebar()
} content: {
    ContentColumn()
} detail: {
    DetailColumn()
}
```

Visibility options:
- `.all` -- all three columns visible
- `.doubleColumn` -- content + detail (sidebar hidden)
- `.detailOnly` -- detail only
- `.automatic` -- system default for current platform

Note: macOS always shows the content column regardless of visibility setting.

### macOS-specific behaviors

- Columns have resizable dividers -- users drag to resize
- Sidebar can be toggled via View menu when `SidebarCommands()` is added
- Each window maintains independent column visibility via `@SceneStorage`
- `NavigationStack` inside the detail column enables drill-down within the rightmost pane

---

## Inspector

Inspector is the macOS-native way to show detail about the current selection. It appears as a trailing column alongside your content -- not modal, not a separate window.

### When to use Inspector vs sheet vs popover

| Need | Use |
|------|-----|
| Editable detail for current selection | Inspector |
| One-time confirmation or input | Sheet (alert/dialog) |
| Brief contextual info | Popover |
| Separate editing window | Window (openWindow) |

### Basic Inspector (macOS 14+, iOS 17+)

```swift
struct DocumentEditor: View {
    @State private var inspectorPresented = true
    @State private var selectedItem: Item?

    var body: some View {
        ContentView(selection: $selectedItem)
            .inspector(isPresented: $inspectorPresented) {
                if let item = selectedItem {
                    ItemInspector(item: item)
                } else {
                    Text("No Selection")
                        .foregroundStyle(.secondary)
                }
            }
            .inspectorColumnWidth(min: 200, ideal: 280, max: 400)
    }
}
```

On macOS, Inspector renders as a trailing sidebar. On iPadOS regular, it also renders as a trailing column. On compact sizes, it falls back to a sheet.

### Add InspectorCommands for keyboard toggle

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .commands {
            SidebarCommands()
            InspectorCommands()  // Adds Control-Command-I toggle
        }
    }
}
```

Without `InspectorCommands()`, users have no keyboard shortcut or menu item to toggle the inspector.

---

## Focus and Keyboard

macOS apps are keyboard-driven. SwiftUI provides APIs for responding to keyboard commands within the focus system.

### Focus-dependent commands

```swift
// Respond to Delete key when view has focus
.onDeleteCommand {
    deleteSelectedItems()
}

// Respond to Escape key when view has focus
.onExitCommand {
    clearSelection()
}

// Respond to arbitrary selector
.onCommand(#selector(NSResponder.selectAll(_:))) {
    selectAllItems()
}
```

These only fire when the view (or a descendant) has focus. This matches AppKit's responder chain model.

### FocusedValues for menu bar communication

The menu bar needs to know what data is in the active window. FocusedValues bridge this gap:

```swift
// 1. Define focused value
extension FocusedValues {
    @Entry var selectedGarden: Binding<Garden>?
}

// 2. Publish from the active scene
struct GardenDetail: View {
    @Binding var garden: Garden

    var body: some View {
        PlantTable(garden: garden)
            .focusedSceneValue(\.selectedGarden, $garden)
    }
}

// 3. Read in commands
struct PlantCommands: Commands {
    @FocusedBinding(\.selectedGarden) var garden

    var body: some Commands {
        CommandMenu("Plants") {
            Button("Add Plant") {
                garden?.plants.append(Plant())
            }
            .keyboardShortcut("n", modifiers: [.command, .shift])
            .disabled(garden == nil)
        }
    }
}
```

Use `focusedSceneValue` (not `focusedValue`) so the value is available regardless of which specific view within the scene has focus. This is critical for menu bar commands that should work whenever the window is frontmost.

### Making views focusable

```swift
Table(items, selection: $selection) { /* columns */ }
    .focusable()  // allows the table to receive keyboard focus
```

Without `.focusable()`, keyboard commands like `onDeleteCommand` will not fire.

---

## Toolbars on macOS

macOS toolbars behave differently from iOS. They integrate with the title bar and support multiple styles.

### Toolbar styles

```swift
NavigationSplitView { /* ... */ }
    .toolbarStyle(.unified)          // Title and toolbar share the title bar (default)

NavigationSplitView { /* ... */ }
    .toolbarStyle(.unifiedCompact)   // Smaller toolbar height

NavigationSplitView { /* ... */ }
    .toolbarStyle(.expanded)         // Toolbar below the title bar (more space)
```

| Style | Appearance | When to use |
|-------|-----------|-------------|
| `.unified` | Title bar and toolbar merged | Most apps (default) |
| `.unifiedCompact` | Merged, reduced height | Utility windows, panels |
| `.expanded` | Toolbar below title bar | Apps with many toolbar items |

### Toolbar item placement on macOS

```swift
.toolbar {
    // Leading side of toolbar (after sidebar toggle)
    ToolbarItem(placement: .navigation) {
        Button("Back", systemImage: "chevron.left") { goBack() }
    }

    // Primary action area (trailing side)
    ToolbarItem(placement: .primaryAction) {
        Button("Add", systemImage: "plus") { addItem() }
    }

    // Customizable area (user can rearrange)
    ToolbarItem(placement: .secondaryAction) {
        Button("Filter", systemImage: "line.3.horizontal.decrease") { toggleFilter() }
    }
}
```

### Menu bar commands

Every action in your toolbar should also appear in the menu bar. The menu bar is the canonical location for all app actions:

```swift
@main
struct GardenApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .commands {
            SidebarCommands()
            InspectorCommands()
            PlantCommands()     // Custom commands for your domain
            ToolbarCommands()   // Standard toolbar customization
        }
    }
}
```

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Using `focusedValue` instead of `focusedSceneValue` for menu commands | Menu actions only work when a specific text field has focus | Use `focusedSceneValue` so the value is available when the entire scene is frontmost |
| Not sorting data in `onChange(of: sortOrder)` | Clicking column headers shows sort indicator but rows do not reorder | Table shows sort state in headers but YOU must sort the data |
| Forgetting `.customizationID` on Table columns | Column customization silently does nothing | Every column needs a unique stable ID string |
| Using NavigationStack instead of NavigationSplitView | App feels like an iPad app -- drill-in navigation instead of columns | Use NavigationSplitView for sidebar-content-detail layout |
| Not using `@SceneStorage` for per-window state | Opening a second window duplicates the first window's state | `@SceneStorage` gives each window independent persistence |
| Table first column not meaningful on its own | iPhone/compact layout shows cryptic single column | Design the first column to be the primary identifier |

---

## Resources

**WWDC**: 2021-10062, 2023-10148

**Docs**: /swiftui/table, /swiftui/navigationsplitview, /swiftui/inspectorcommands, /swiftui/focusedvalues

**Skills**: nav (axiom-swiftui), architecture (axiom-swiftui), settings (axiom-macos)
