---
name: swiftui-differences
description: Use when bringing an iOS SwiftUI app to macOS, choosing between List and Table, building three-column NavigationSplitView layouts, adding Inspector panels, wiring focus-driven commands, or configuring macOS toolbar styles.
---

# macOS SwiftUI Differences

The three mental-model shifts iOS developers must make for macOS — multi-window, focus-driven, keyboard-first — plus Table, NavigationSplitView, Inspector, and toolbar styles.

## When to Use This Skill

Use this skill when you're:
- Bringing an iOS SwiftUI app to macOS
- Building a macOS-first SwiftUI app
- Choosing between `List` and `Table` for structured data
- Implementing a three-column `NavigationSplitView` with sidebar, content, and detail
- Adding an `Inspector` panel for selection-dependent detail
- Wiring keyboard commands, menu bar actions, and focus-driven interactions
- Configuring `.toolbarStyle` (`.unified`, `.unifiedCompact`, `.expanded`)
- Debugging macOS-specific SwiftUI layout or behavior

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "My iPad-style sheet for showing detail feels wrong on Mac. What should I use?"
- "My table headers show sort indicators but the rows don't reorder. What's missing?"
- "How do I make each window remember its own sidebar visibility and column widths?"
- "Should this be a `List` or a `Table`?"
- "How do I make Control-Command-I toggle my Inspector?"
- "Why does my menu command only fire when a specific text field has focus?"

## What This Skill Provides

### The Three Mental-Model Shifts
- **Multi-window** — Users open many windows; each has independent state. Use `@SceneStorage` for per-window persistence, not global singletons.
- **Focus-driven** — Menu commands target the focused window. Use `focusedSceneValue` so commands work whenever the window is frontmost.
- **Keyboard-first** — Every action must appear in the menu bar with a shortcut. Toolbar-only actions strand keyboard users.

### Table
- When `Table` beats `List` — multiple sortable columns, headers, column reordering, column resizing
- Sortable tables with `KeyPathComparator` and the `onChange(of: sortOrder)` sorting step you must implement yourself
- `TableColumnCustomization` + `@SceneStorage` for persisting column order and visibility per window
- `DisclosureTableRow` for hierarchical rows (Finder-style)
- Cross-platform behavior: macOS shows all columns; iPhone collapses to the first column

### NavigationSplitView on macOS
- True multi-column layouts with resizable dividers
- `.navigationSplitViewColumnWidth(min:ideal:max:)` for sidebar sizing
- `NavigationSplitViewVisibility` and the macOS rule that the content column is always shown

### Inspector
- When Inspector beats sheet, popover, or `openWindow`
- `.inspector(isPresented:)` + `.inspectorColumnWidth(...)`
- `InspectorCommands()` for the Control-Command-I toggle

### Focus and Toolbars
- `.onDeleteCommand`, `.onExitCommand`, `.onCommand(#selector(...))` and the focus requirement (`.focusable()`)
- `@FocusedBinding` + `focusedSceneValue` for menu-bar to active-window data flow
- `.toolbarStyle(.unified / .unifiedCompact / .expanded)` and when each fits
- Toolbar item placements — `.navigation`, `.primaryAction`, `.secondaryAction`

## Key Pattern

Always pair toolbar buttons with menu bar commands. Keyboard-only users cannot reach toolbar-only actions:

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
            .commands {
                SidebarCommands()
                InspectorCommands()
                PlantCommands()  // Your domain commands, mirroring toolbar
            }
    }
}
```

For per-window state (sidebar visibility, selection, column widths), use `@SceneStorage`. Global singletons cause all windows to share state.

## Documentation Scope

This page documents the `swiftui-differences` skill in the `axiom-macos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions about Mac-specific SwiftUI patterns.

**For cross-platform SwiftUI fundamentals** — Use [swiftui-nav](/skills/ui-design/swiftui-nav) and [swiftui-layout](/skills/ui-design/swiftui-layout) for `NavigationSplitView`, layout primitives, and state management that apply across iOS, iPadOS, and macOS.

## Related

- [windows](/skills/macos/windows) — Per-window state and `@SceneStorage` make sense once you're running multiple windows
- [menus-and-commands](/skills/macos/menus-and-commands) — The focus model used here is the foundation for command routing
- [settings](/skills/macos/settings) — The Settings scene is one of the patterns mentioned here in more depth
- [appkit-interop](/skills/macos/appkit-interop) — When SwiftUI lacks a capability (`NSToolbar` customization, `NSOpenPanel` options), bridge to AppKit
- [swiftui-nav](/skills/ui-design/) — Cross-platform `NavigationSplitView` and `NavigationStack` fundamentals

## Resources

**WWDC**: 2021-10062, 2023-10148

**Docs**: /swiftui/table, /swiftui/navigationsplitview, /swiftui/inspectorcommands, /swiftui/focusedvalues

**Skills**: axiom-macos, windows, menus-and-commands, settings, appkit-interop
