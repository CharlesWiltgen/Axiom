---
name: settings
description: Use when adding a macOS Settings (Preferences) scene — Settings scene declaration, TabView pane structure, sizing, SettingsLink, @AppStorage persistence, and the iOS adjacency (opening the system Settings app).
---

# macOS Settings Scene

The standard Preferences window — declaring the `Settings` scene, organizing panes with `TabView`, sizing per HIG, opening with `SettingsLink`, and persisting with `@AppStorage`.

## When to Use This Skill

Use this skill when you're:
- Adding the standard macOS Preferences window (the one ⌘, opens) to a SwiftUI app
- Organizing preferences into tabbed panes
- Sizing the Settings window correctly per macOS HIG
- Using `SettingsLink` to open Settings from anywhere in the app
- Persisting preferences with `@AppStorage` / `UserDefaults`
- Sharing one codebase across iOS and macOS where macOS needs a Settings scene
- Opening the iOS system Settings app for the current app's preferences

## Example Prompts

Questions you can ask Claude that will draw from this skill:

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
- **Single-pane** — fixed `.frame(width: 450, height: 180)` with `.scenePadding()` for small preference sets
- **Tabbed** — `TabView` with `.tabItem { Label("...", systemImage: "...") }` for the standard pattern
- **Per-tab sizing** — when tabs have legitimately different sizes, attach `.frame` per tab and let the window animate
- **Cross-platform** — wrapping `SettingsView` definition in `#if os(macOS)` when it references macOS-only APIs

### SettingsLink and openSettings
- `SettingsLink` (macOS 14+) for opening the app's own Settings from any view
- `@Environment(\.openSettings)` as the action-based alternative
- Why `SettingsLink` does NOT open the iOS system Settings app

### iOS Adjacency
- `UIApplication.openSettingsURLString` via `@Environment(\.openURL)` to deep-link into the iOS Settings app
- Cross-platform `OpenSettingsButton` pattern with conditional compilation

### Persistence with @AppStorage
- `@AppStorage(key)` backed by `UserDefaults`
- Centralizing keys in a `PreferenceKey` enum to prevent string-drift bugs
- `@AppStorage(_:store:)` with `UserDefaults(suiteName:)` for App Group-shared preferences

## Key Pattern

The HIG-conforming tabbed Settings — fixed `.frame` on the `TabView`, SF Symbol on every tab, `.scenePadding()` to keep content off the window edge:

```swift
struct SettingsView: View {
    var body: some View {
        TabView {
            GeneralSettings()
                .tabItem { Label("General", systemImage: "gear") }
            AdvancedSettings()
                .tabItem { Label("Advanced", systemImage: "slider.horizontal.3") }
        }
        .scenePadding()
        .frame(width: 450, height: 280)
    }
}
```

Tab labels must use `Label("Title", systemImage: "...")` — text-only tabs look unfinished and violate the HIG. Centralize `@AppStorage` keys in an enum so a typo doesn't silently split state between the Settings UI and the rest of the app.

## Documentation Scope

This page documents the `settings` skill in the `axiom-macos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions about the Settings scene, sizing, and `@AppStorage`.

**For where preferences live under sandbox** — Use [sandbox-and-file-access](/skills/macos/sandbox-and-file-access) for the container layout and App Group `UserDefaults(suiteName:)` patterns.

## Related

- [windows](/skills/macos/windows) — `Settings` is one scene type alongside `WindowGroup`, `Window`, `UtilityWindow`, and `MenuBarExtra`
- [menus-and-commands](/skills/macos/menus-and-commands) — Settings menu item placement, the ⌘, shortcut, and `CommandGroup(replacing: .appSettings)`
- [sandbox-and-file-access](/skills/macos/sandbox-and-file-access) — App Group container setup for sharing preferences with extensions
- [swiftui-architecture](/skills/ui-design/) — `@AppStorage` and the broader SwiftUI state model across platforms

## Resources

**WWDC**: 2020-10119, 2022-10059, 2023-10148

**Docs**: /swiftui/settings, /swiftui/settingslink, /swiftui/scene, /uikit/uiapplication/opensettingsurlstring, /swiftui/appstorage

**Skills**: axiom-macos, windows, menus-and-commands, sandbox-and-file-access
