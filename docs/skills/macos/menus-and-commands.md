---
name: menus-and-commands
description: Use when adding custom menus or menu items, wiring keyboard shortcuts, building context menus, connecting menu commands to the focused window via focusedSceneValue, extending system command groups, or debugging menu items that appear disabled.
---

# macOS Menus and Commands

The single menu bar, many windows model — using `CommandMenu`, `CommandGroup`, `focusedSceneValue`, and `@FocusedBinding` to route commands to the right window.

## When to Use This Skill

Use this skill when you're:
- Adding custom menus or menu items to the macOS menu bar
- Implementing keyboard shortcuts on menu commands
- Building context menus for macOS views (secondary-click)
- Connecting menu commands to the focused window via `focusedSceneValue`
- Extending or replacing system command groups (`.newItem`, `.pasteboard`, etc.)
- Debugging menu items that appear disabled or don't affect the right window

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Why is my menu item always disabled even when a window is focused?"
- "How do I add 'New Plant' before the standard 'New' group in the File menu?"
- "When should I use `focusedValue` vs `focusedSceneValue`?"
- "I'm putting `.commands` on a `View` and getting a compiler error. What's wrong?"
- "How do I add a custom context menu with a destructive Delete action?"

## What This Skill Provides

### Menu Architecture
- The "one menu bar, many windows" routing model
- Why commands belong on the scene, not on views
- The `Commands` flow — menu bar → `Commands` struct → `@FocusedValue` → `focusedSceneValue` → focused window

### Command Patterns
- `CommandMenu` for new top-level menus (positioned between View and Window)
- `CommandGroup(before: .newItem)`, `.after(...)`, `.replacing(...)` for system menu extension
- System-provided groups — `SidebarCommands`, `InspectorCommands`, `ToolbarCommands`, `TextEditingCommands`, `TextFormattingCommands`
- Standard `CommandGroupPlacement` values (`.newItem`, `.saveItem`, `.pasteboard`, `.undoRedo`, `.sidebar`, `.toolbar`, `.appSettings`, etc.)

### Focus-Based Routing
- Defining focused-value keys with the `@Entry` macro (iOS 17+ / macOS 14+)
- Publishing values with `.focusedSceneValue` from the view
- Reading values with `@FocusedValue` (read-only) or `@FocusedBinding` (read-write)
- The critical difference: `focusedSceneValue` works across the whole window; `focusedValue` only when a specific view has keyboard focus

### Keyboard Shortcuts and Context Menus
- `.keyboardShortcut(_, modifiers:)` syntax and HIG-conformant shortcut choices
- `.contextMenu { ... }` for secondary-click menus tied to a specific item
- `.commandsRemoved()` to suppress unwanted defaults

## Key Pattern

`@FocusedValue` is silently `nil` until something publishes the value. The single most common bug is forgetting `.focusedSceneValue` on the view side:

```swift
// View side — publishes
struct GardenDetail: View {
    @Binding var garden: Garden
    var body: some View {
        Content()
            .focusedSceneValue(\.garden, $garden)
    }
}

// Commands side — reads
struct GardenCommands: Commands {
    @FocusedBinding(\.garden) var garden
    var body: some Commands {
        CommandMenu("Garden") {
            Button("Water All") { garden?.waterAll() }
                .disabled(garden == nil)
        }
    }
}
```

Default to `focusedSceneValue`, not `focusedValue`. The scene-level variant publishes regardless of which view inside the window has focus — exactly what menu commands need.

## Documentation Scope

This page documents the `menus-and-commands` skill in the `axiom-macos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions about menu architecture, focus routing, and command groups.

**For window scenes** — Use [windows](/skills/macos/windows) for the scene types that `.commands` attaches to.

## Related

- [windows](/skills/macos/windows) — Commands modify scenes; this covers `WindowGroup`, `Window`, `UtilityWindow`, `MenuBarExtra`, `Settings`
- [swiftui-differences](/skills/macos/swiftui-differences) — Where `focusedSceneValue` fits into the broader macOS focus model, including Table, Inspector, and toolbar commands
- [settings](/skills/macos/settings) — Settings menu item placement and the ⌘, shortcut wiring
- [swiftui-toolbars](/skills/ui-design/) — Cross-platform `.toolbar`, `ToolbarItem`, and `ToolbarSpacer` placement

## Resources

**WWDC**: 2021-10062

**Docs**: /swiftui/commandmenu, /swiftui/commandgroup, /swiftui/commandgroupplacement, /swiftui/focusedvalues, /swiftui/building-and-customizing-the-menu-bar-with-swiftui

**HIG**: The Menu Bar, Menus, Context Menus

**Skills**: axiom-macos, windows, swiftui-differences, settings
