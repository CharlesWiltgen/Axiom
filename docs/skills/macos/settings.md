---
name: settings
description: Use when adding a macOS Settings (Preferences) scene — Settings scene declaration, TabView pane structure, sizing, SettingsLink, @AppStorage persistence, and the iOS adjacency (opening the system Settings app).
---

# macOS Settings Scene

The standard macOS Preferences window: declaring the `Settings` scene, organizing panes with `TabView`, sizing it to the HIG, opening it with `SettingsLink`, and persisting values with `@AppStorage`.

## When to Use

Use this skill when you're:
- Adding the standard macOS Preferences window (the one ⌘, opens) to a SwiftUI app
- Organizing preferences into tabbed panes
- Sizing the Settings window the way the macOS HIG recommends
- Using `SettingsLink` to open Settings from anywhere in the app
- Persisting preferences with `@AppStorage` and `UserDefaults`
- Sharing one codebase across iOS and macOS where macOS needs a Settings scene
- Opening the iOS system Settings app for the current app's preferences

## Example Prompts

Questions you can ask your assistant that will draw from this skill:

- "Where does the `.frame()` go on a tabbed Settings window?"
- "How do I share one codebase across iOS and macOS where macOS needs a Settings scene?"
- "Why does my iOS build fail with `'Settings' is unavailable`?"
- "How do I open the iOS system Settings app pointed at my app's preferences?"
- "Why are my Settings tabs showing without icons?"
- "How do I share `@AppStorage` values with a Widget extension?"

## What This Skill Provides

### The Settings Scene
- `Settings { ... }` as a macOS-only `Scene` type (macOS 11+)
- Why `#if os(macOS)` is required in cross-platform apps
- Automatic wiring of the Settings menu item and ⌘, keyboard shortcut

### Pane Patterns
- **Single-pane** – A fixed `.frame(width: 450, height: 180)` with `.scenePadding()` for small preference sets
- **Tabbed** – The standard pattern: `TabView` with `Tab("...", systemImage: "...") { ... }`
- **Per-tab sizing** – When tabs legitimately need different sizes, attach a `.frame` to each tab and let the window animate
- **Cross-platform** – Wrapping the `SettingsView` definition in `#if os(macOS)` when it references macOS-only APIs

### SettingsLink and openSettings
- `SettingsLink` (macOS 14+) for opening the app's own Settings from any view
- `@Environment(\.openSettings)` as the action-based alternative
- Why `SettingsLink` does **not** open the iOS system Settings app

### iOS Adjacency
- `UIApplication.openSettingsURLString` via `@Environment(\.openURL)` to deep-link into the iOS Settings app
- On macOS, an `x-apple.systempreferences:` link to System Settings when a user must re-enable a denied permission
- A cross-platform `OpenSettingsButton` with conditional compilation, for when "settings" means your app's own preferences

### Persistence with @AppStorage
- `@AppStorage(key)` backed by `UserDefaults`
- Centralizing keys in a `PreferenceKey` enum so a typo can't split state
- `@AppStorage(_:store:)` with `UserDefaults(suiteName:)` for App Group-shared preferences

## Key Pattern

A tabbed Settings window that follows the HIG: a fixed `.frame` on the `TabView`, an SF Symbol on every tab, and `.scenePadding()` to keep content off the window edge:

```swift
struct SettingsView: View {
    var body: some View {
        TabView {
            Tab("General", systemImage: "gear") { GeneralSettings() }
            Tab("Advanced", systemImage: "slider.horizontal.3") { AdvancedSettings() }
        }
        .scenePadding()
        .frame(width: 450, height: 280)
    }
}
```

Tab labels must use `Label("Title", systemImage: "...")`; text-only tabs look unfinished and violate the HIG. Centralize `@AppStorage` keys in an enum so a typo doesn't silently split state between the Settings UI and the rest of the app.

## Documentation Scope

This page documents the `settings` skill (in the `axiom-macos` suite), which your assistant uses when you build a Settings window, size its panes, or persist preferences with `@AppStorage`.

## Related

- [windows](/skills/macos/windows) – `Settings` is one scene type alongside `WindowGroup`, `Window`, `UtilityWindow`, and `MenuBarExtra`
- [menus-and-commands](/skills/macos/menus-and-commands) – Settings menu item placement, the ⌘, shortcut, and `CommandGroup(replacing: .appSettings)`
- [sandbox-and-file-access](/skills/macos/sandbox-and-file-access) – App Group container setup for sharing preferences with extensions
- [swiftui-architecture](/skills/ui-design/swiftui-architecture) – `@AppStorage` and the broader SwiftUI state model across platforms

## Resources

**WWDC**: 2020-10119, 2022-10059, 2023-10148

**Docs**: /swiftui/settings, /swiftui/settingslink, /swiftui/scene, /uikit/uiapplication/opensettingsurlstring, /swiftui/appstorage
