---
name: windows
description: Use when picking a macOS scene type (WindowGroup, Window, UtilityWindow, MenuBarExtra, Settings), opening or dismissing windows programmatically, setting default size or position, building a multi-window app, or adding a menu bar extra.
---

# macOS Window Management

Foundations of multi-window macOS apps — picking the right scene type, opening and dismissing windows, default sizing and placement, toolbar styles, MenuBarExtra, and UtilityWindow.

## When to Use This Skill

Use this skill when you're:
- Choosing between `WindowGroup`, `Window`, `UtilityWindow`, `MenuBarExtra`, and `Settings`
- Opening or dismissing windows programmatically via `openWindow`/`dismissWindow`
- Setting default window size, position, or resizability
- Building a multi-window macOS app from an iOS-first codebase
- Adding a data-driven detail WindowGroup that should only open programmatically
- Customizing window toolbar style or removing default menu commands
- Adding a menu bar extra (standalone utility or companion to a main app)
- Building a document-based Mac app (DocumentGroup shell and File menu integration)
- Debugging windows that won't open, open duplicates, or lose state on relaunch

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Should I use `WindowGroup` or `Window` for my activity monitor panel?"
- "How do I open a detail window from a context menu without adding a 'New Detail Window' item to the File menu?"
- "Why does my app quit when I close the main window?"
- "My `.defaultSize` is ignored on relaunch — is that a bug?"
- "How do I make a floating Inspector window that stays above the main app?"

## What This Skill Provides

### Scene Type Selection
- Decision tree across `WindowGroup`, `Window`, `UtilityWindow`, `MenuBarExtra`, `Settings`, and `DocumentGroup`
- Platform availability matrix (macOS, iOS/iPadOS, visionOS)
- Why `Window` as the primary scene causes the app to quit when closed
- The DocumentGroup shell — free File menu, document menu, tabs, and per-document restoration (and why `DocumentGroupLaunchScene` doesn't apply on the Mac)

### Window Lifecycle
- `@Environment(\.openWindow)` and `@Environment(\.dismissWindow)`
- Data-driven WindowGroups with `for:` parameter — `Hashable + Codable` presentation values
- Why you pass IDs, not full model objects, to `openWindow(value:)`
- `@Environment(\.openSettings)` for opening the Settings scene programmatically

### Default Size, Position, and Resizability
- `.defaultSize`, `.defaultPosition` (macOS 13+), `.defaultWindowPlacement` (macOS 15+)
- Why `defaultSize` is ignored once the user has resized — and why that's correct
- `.windowResizability(.automatic / .contentSize / .contentMinSize)`

### Toolbar and Window Styles
- `.windowStyle(.automatic / .hiddenTitleBar / .titleBar)`
- `.windowToolbarStyle(.unified / .unifiedCompact / .expanded)` and when each fits
- `.commandsRemoved()` for suppressing the auto-generated "New Window" item

### MenuBarExtra
- Standalone utility apps (`LSUIElement = true` in Info.plist)
- `.menuBarExtraStyle(.menu)` vs `.menuBarExtraStyle(.window)` for richer content

### UtilityWindow (macOS 15+)
- Floating panels that stay above main windows and receive FocusedValues
- Auto-toggle in the View menu, Escape-to-dismiss, hide-when-app-loses-focus

## Key Pattern

Use `Window` for singletons and `WindowGroup` for everything else. For data-driven detail windows that should open only via code, suppress the auto-generated File menu item with `.commandsRemoved()`.

```swift
WindowGroup("Book Details", for: Book.ID.self) { $bookId in
    BookDetail(id: $bookId)
}
.commandsRemoved()  // Only open via openWindow(value:)
```

Pass identifiers, never struct values — value types get copied and edits won't sync.

## Documentation Scope

This page documents the `windows` skill in the `axiom-macos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions about scene types, lifecycle, and window styling.

**For menu integration** — Use [menus-and-commands](/skills/macos/menus-and-commands) for the menu bar wiring that goes alongside multi-window scenes.

## Related

- [menus-and-commands](/skills/macos/menus-and-commands) — Once windows exist, this covers `CommandMenu`/`CommandGroup` and routing commands to the focused window
- [settings](/skills/macos/settings) — The `Settings` scene is a special-purpose window covered in its own skill
- [swiftui-differences](/skills/macos/swiftui-differences) — Multi-window state via `@SceneStorage` and the focus model that windows participate in
- [appkit-interop](/skills/macos/appkit-interop) — When `NSHostingController` is the right way to host SwiftUI inside an AppKit window or modal

## Resources

**WWDC**: 2022-10061, 2024-10149

**Docs**: /swiftui/windowgroup, /swiftui/window, /swiftui/utilitywindow, /swiftui/menubarextra, /swiftui/settings, /swiftui/documentgroup, /swiftui/openwindowaction, /swiftui/dismisswindowaction, /swiftui/windowstyle, /swiftui/windowtoolbarstyle

**Skills**: axiom-macos, menus-and-commands, settings, swiftui-differences
