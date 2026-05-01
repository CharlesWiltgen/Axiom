# macOS Menus and Commands

## When to Use This Skill

Use when:
- Adding custom menus or menu items to a macOS app's menu bar
- Implementing keyboard shortcuts for menu commands
- Building context menus for macOS views
- Connecting menu commands to the focused window via focusedSceneValue
- Extending or replacing system-provided menu bar commands
- Debugging menu items that appear disabled or don't affect the right window

#### Related Skills
- Use `skills/windows.md` for WindowGroup, Window, UtilityWindow, and multi-window management
- Use `skills/toolbars.md` for toolbar customization and toolbar items

---

## Red Flags — Anti-Patterns to Prevent

If you're doing ANY of these, STOP and use the patterns in this skill:

### 1. Putting commands directly in a view instead of the scene

```swift
// WRONG — commands belong on the scene, not inside a view
struct ContentView: View {
    var body: some View {
        Text("Hello")
            .commands {  // This modifier doesn't exist on View
                CommandMenu("Tools") { ... }
            }
    }
}
```

**Why this fails**: The `.commands` modifier is a scene-level modifier. It goes on `WindowGroup` or `Window` in your `App` body, not on views. Attempting this produces a compiler error.

### 2. Reading @State directly from command menus

```swift
// WRONG — commands can't access a specific window's @State
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            EditorView()
        }
        .commands {
            CommandMenu("Editor") {
                // How do you access the focused window's document?
                Button("Save") { document.save() }  // No access to document
            }
        }
    }
}
```

**Why this fails**: There's one menu bar but potentially many windows. Commands have no direct reference to any window's state. You must use `@FocusedValue` or `@FocusedBinding` to bridge data from the focused window to the menu bar. This is the single most common mistake iOS developers make when building for macOS.

### 3. Forgetting to publish focusedSceneValue from the view

```swift
// WRONG — @FocusedValue is nil because nothing publishes the value
struct EditorCommands: Commands {
    @FocusedValue(\.document) var document  // Always nil

    var body: some Commands {
        CommandMenu("Editor") {
            Button("Save") { document?.save() }
                .disabled(document == nil)  // Always disabled
        }
    }
}
```

**Why this fails**: `@FocusedValue` only receives values if a view in the focused scene publishes them via `.focusedSceneValue`. Without the publishing side, every `@FocusedValue` reads `nil` and every menu item stays disabled.

### 4. Using focusedValue when you mean focusedSceneValue

```swift
// WRONG for most cases — focusedValue tracks individual focus, not the window
TableView()
    .focusedValue(\.selection, selectedItems)  // Only works when table has focus
```

**Why this fails**: `.focusedValue` publishes only when the specific view has keyboard focus. Click a toolbar button or sidebar, and the value becomes nil. Use `.focusedSceneValue` to publish values that represent the entire window's state regardless of which view has focus within it.

---

## Menu Architecture

Mac menu commands are NOT just buttons. They're a **routing system** that connects the single, shared menu bar to whichever window is currently focused.

### The Command Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Menu Bar   │────>│  Commands struct  │────>│  @FocusedValue  │
│ (one, shared)│     │ (reads focused   │     │  (bridges to    │
│             │     │  values)         │     │   active window) │
└─────────────┘     └──────────────────┘     └─────────────────┘
                                                      │
                                              .focusedSceneValue
                                                      │
                                              ┌───────▼─────────┐
                                              │  Focused Window  │
                                              │  (publishes its  │
                                              │   state)         │
                                              └─────────────────┘
```

Key insight from WWDC 2021-10062: "We have multiple windows, but only ever one menu bar. I don't want to put carrots in my flower bed, so how can the menu know which garden to send the action to?" The answer is `focusedSceneValue` — it tells the system to expose values for a given key path when the entire scene is in focus.

### Where Commands Are Declared

Commands are added via the `.commands` modifier on scene types in the `App` body:

```swift
@main
struct GardenApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .commands {
            SidebarCommands()          // System-provided
            PlantCommands()            // Your custom commands
        }
    }
}
```

---

## Command Patterns

### CommandMenu — New Top-Level Menu

Creates a new menu in the menu bar, positioned between the View and Window menus:

```swift
struct PlantCommands: Commands {
    @FocusedBinding(\.garden) var garden
    @FocusedValue(\.selectedPlants) var selectedPlants

    var body: some Commands {
        CommandMenu("Plants") {
            Button("Water Selected") {
                guard let plants = selectedPlants else { return }
                garden?.water(plants)
            }
            .keyboardShortcut("w", modifiers: [.command, .shift])
            .disabled(selectedPlants?.isEmpty ?? true)

            Divider()

            Button("Add Plant") {
                garden?.addPlant()
            }
            .keyboardShortcut("n", modifiers: [.command, .option])
        }
    }
}
```

Per the HIG, custom menus appear between View and Window. Use short, one-word titles.

### CommandGroup — Extend or Replace Existing Menus

Add items to system menus using `CommandGroupPlacement`:

```swift
struct FileCommands: Commands {
    @FocusedBinding(\.garden) var garden

    var body: some Commands {
        // Add before the standard "New" group in the File menu
        CommandGroup(before: .newItem) {
            Button("New Plant") {
                garden?.addPlant()
            }
            .keyboardShortcut("n", modifiers: [.command])
        }

        // Replace the undo/redo group (if your app doesn't support undo)
        CommandGroup(replacing: .undoRedo) {
            EmptyView()
        }
    }
}
```

#### Standard Placement Locations

| Placement | Menu | Use For |
|-----------|------|---------|
| `.newItem` | File | Creating new items |
| `.saveItem` | File | Save-related actions |
| `.importExport` | File | Import/export actions |
| `.printItem` | File | Print actions |
| `.pasteboard` | Edit | Clipboard operations |
| `.undoRedo` | Edit | Undo/redo operations |
| `.textEditing` | Edit | Text manipulation |
| `.sidebar` | View | Sidebar visibility |
| `.toolbar` | View | Toolbar commands |
| `.windowList` | Window | Window management |
| `.help` | Help | Help content |
| `.appSettings` | App | Settings/preferences |

### System-Provided Command Groups

SwiftUI includes pre-built command groups that wire up standard functionality:

```swift
.commands {
    SidebarCommands()        // Toggle sidebar from View menu
    InspectorCommands()      // Show/Hide Inspector in View menu
    ToolbarCommands()        // Toolbar customization
    TextEditingCommands()    // Standard text editing
    TextFormattingCommands() // Bold, italic, underline
}
```

### Keyboard Shortcuts

```swift
Button("Refresh") { refresh() }
    .keyboardShortcut("r", modifiers: [.command])

Button("Delete") { delete() }
    .keyboardShortcut(.delete, modifiers: [.command])

Button("Select All") { selectAll() }
    .keyboardShortcut("a", modifiers: [.command])
```

Follow the HIG: support standard keyboard shortcuts for standard actions (Cmd+C, Cmd+V, Cmd+S, etc.). Only create custom shortcuts when necessary.

### Removing Default Commands

```swift
// Remove default commands from a specific scene
WindowGroup(id: "detail", for: Item.ID.self) { $itemID in
    DetailView(itemID: $itemID)
}
.commandsRemoved()  // No "New Window" in File menu for this group
```

---

## Context Menus

macOS context menus appear on secondary click (Control-click or right-click). They provide quick access to actions relevant to the clicked item.

```swift
struct ArticleRow: View {
    @Environment(\.openWindow) var openWindow
    let article: Article

    var body: some View {
        ArticleContent(article: article)
            .contextMenu {
                Button("Open in New Window") {
                    openWindow(value: article.id)
                }
                Button("Duplicate") {
                    duplicateArticle(article)
                }
                Divider()
                Button("Delete", role: .destructive) {
                    deleteArticle(article)
                }
            }
    }
}
```

Per the HIG: context menus should contain a small number of frequently used actions directly related to the item. Apply context menus consistently across all instances of the same item type.

---

## Focus-Based Command Routing

This is the mechanism that connects the shared menu bar to the correct window. It has two sides: **publishing** (from the view) and **reading** (from the commands).

### Step 1 — Define Focused Value Keys

Use the `@Entry` macro (iOS 17+ / macOS 14+) for value types:

```swift
extension FocusedValues {
    @Entry var document: Document?
    @Entry var selectedItems: Set<Item.ID>?
}
```

For binding access (read-write), use `@Entry` with a `Binding`:

```swift
extension FocusedValues {
    @Entry var garden: Binding<Garden>?
}
```

### Step 2 — Publish from the View

Use `.focusedSceneValue` to publish state from within the window:

```swift
struct GardenDetail: View {
    @Binding var garden: Garden
    @State private var selection: Set<Plant.ID> = []

    var body: some View {
        Table(garden.plants, selection: $selection) { ... }
            .focusedSceneValue(\.garden, $garden)
            .focusedSceneValue(\.selectedItems, selection)
    }
}
```

`focusedSceneValue` exposes these values whenever **any part** of this scene's window has focus — not just the table.

### Step 3 — Read from Commands

```swift
struct GardenCommands: Commands {
    @FocusedBinding(\.garden) var garden     // Read-write binding
    @FocusedValue(\.selectedItems) var selection  // Read-only value

    var body: some Commands {
        CommandMenu("Garden") {
            Button("Water Selected") {
                guard let plants = selection else { return }
                garden?.water(plants)
            }
            .disabled(selection?.isEmpty ?? true)
        }
    }
}
```

### focusedValue vs focusedSceneValue

| Modifier | Scope | Use When |
|----------|-------|----------|
| `.focusedSceneValue` | Entire window/scene | The value represents window-level state (document, selection) |
| `.focusedValue` | Individual focused view | The value is only meaningful when a specific view has keyboard focus |

**Default to `focusedSceneValue`**. Use `focusedValue` only for fine-grained focus tracking like text field state.

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `.commands` on a View | Compiler error | Move to scene level (WindowGroup/Window) |
| No `focusedSceneValue` published | Menu items always disabled | Add `.focusedSceneValue` to the publishing view |
| Using `focusedValue` instead of `focusedSceneValue` | Menu items disable when clicking toolbar/sidebar | Switch to `focusedSceneValue` |
| `@FocusedValue` without `@Entry` definition | Compiler error or nil values | Define the key in `extension FocusedValues` |
| Menu title too long | Truncated in menu bar, looks cluttered | Use short, one-word titles per HIG |
| Hiding unavailable menu items | Users can't discover what's possible | Disable items instead of hiding them per HIG |
| Custom keyboard shortcut conflicts with system | System shortcut overridden silently | Check standard shortcuts before assigning custom ones |
| Commands not appearing | Forgot to add Commands struct to `.commands {}` | Add all command types in the scene modifier |

---

## Resources

**WWDC**: 2021-10062

**Docs**: /swiftui/commandmenu, /swiftui/commandgroup, /swiftui/commandgroupplacement, /swiftui/focusedvalues, /swiftui/building-and-customizing-the-menu-bar-with-swiftui

**HIG**: The Menu Bar, Menus, Context Menus

**Skills**: skills/windows.md
