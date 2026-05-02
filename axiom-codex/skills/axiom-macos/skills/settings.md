---
name: macos-settings
description: Use when adding a macOS Settings (Preferences) scene to a SwiftUI app — Settings scene declaration, TabView pane structure, sizing, SettingsLink, @AppStorage persistence, and iOS adjacency (opening system Settings).
license: MIT
---

# macOS Settings Scene

## When to Use This Skill

Use when:
- Adding the standard macOS Preferences window (the one ⌘, opens) to a SwiftUI app
- Organizing preferences into tabbed panes
- Sizing the Settings window correctly per macOS HIG
- Using `SettingsLink` to open Settings programmatically from the app
- Persisting preferences with `@AppStorage` / `UserDefaults`
- Sharing one codebase across iOS and macOS where macOS needs a Settings scene
- Implementing the iOS counterpart: opening the system Settings app for the current app's prefs

#### Related Skills

- Use `skills/windows.md` for WindowGroup, Window, MenuBarExtra, and other Scene types
- Use `skills/menus-and-commands.md` for the Settings menu item placement, keyboard shortcuts
- Use `skills/sandbox-and-file-access.md` for where preference defaults are stored under sandbox
- Use axiom-swiftui (skills/architecture.md) for `@AppStorage` and overall state architecture

## Red Flags — Anti-Patterns to Prevent

| Symptom | Cause | Fix |
|---|---|---|
| Settings menu item missing from app menu | No `Settings { }` scene declared | Add a `Settings` scene to the App body (macOS only) |
| iOS build fails: "'Settings' is unavailable" | `Settings { }` declared without `#if os(macOS)` | Wrap in `#if os(macOS)` for cross-platform apps |
| Settings window opens at tiny size | No `.frame()` constraint | Set `.frame(width: 450, minHeight: 200)` (or per-tab if sizes differ) |
| Layout cramped against window edge | Missing `.scenePadding()` | Add `.scenePadding()` to the root SettingsView |
| Settings window resizable when it shouldn't be | macOS auto-allows resize when content is flexible | Set fixed `.frame(width:height:)` per tab (no min/max) |
| Tab icons missing | Forgot `systemImage:` on `Tab` | Add SF Symbols to every tab — required by macOS HIG |
| Tabs jump in size when switched | Each tab has different intrinsic content size | Set the same `.frame()` on every tab body, OR let tabs resize via `.frame(idealWidth:idealHeight:)` |
| `SettingsLink` in iOS code | Used `SettingsLink` thinking it opens the iOS system Settings app | macOS 14+ only — opens the app's own Settings scene. Use `UIApplication.openSettingsURLString` for iOS system Settings |
| Settings UI shows no values | `@AppStorage` keys differ from where the rest of the app reads them | Centralize keys in a `PreferenceKey` enum; never hardcode strings twice |

---

## The Settings Scene

`Settings` is a macOS-only `Scene` type (macOS 11+) that declares the standard Preferences window. SwiftUI wires up the Settings menu item and ⌘, keyboard shortcut automatically — you supply the content view.

### Minimal declaration

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        #if os(macOS)
        Settings {
            SettingsView()
        }
        #endif
    }
}
```

**Why `#if os(macOS)`** `Settings` does not exist on iOS, iPadOS, watchOS, or tvOS. Without the conditional, cross-platform apps fail to compile on non-Mac targets.

---

## Pattern 1: Single-Pane Settings

For apps with few preferences (a handful of toggles, no logical grouping needed).

```swift
struct SettingsView: View {
    @AppStorage("showPreviews") private var showPreviews = true
    @AppStorage("autoSaveInterval") private var autoSaveInterval = 30.0

    var body: some View {
        Form {
            Toggle("Show previews on hover", isOn: $showPreviews)
            Stepper(
                "Auto-save every \(Int(autoSaveInterval)) seconds",
                value: $autoSaveInterval,
                in: 10...300,
                step: 10
            )
        }
        .formStyle(.grouped)
        .scenePadding()
        .frame(width: 450, height: 180)
    }
}
```

**Sizing rationale** Fixed `width: 450, height: 180`. macOS HIG: preferences windows are typically not user-resizable. A fixed frame produces a window that opens consistently and cannot be dragged to weird sizes. Choose the size that fits the content snugly.

---

## Pattern 2: Tabbed Settings (General + Advanced)

The standard pattern for any Settings UI with > ~5 preferences. Each tab is a focused subset.

```swift
struct SettingsView: View {
    var body: some View {
        TabView {
            GeneralSettings()
                .tabItem { Label("General", systemImage: "gear") }

            AppearanceSettings()
                .tabItem { Label("Appearance", systemImage: "paintbrush") }

            AdvancedSettings()
                .tabItem { Label("Advanced", systemImage: "slider.horizontal.3") }
        }
        .scenePadding()
        .frame(width: 450, height: 280)
    }
}

struct GeneralSettings: View {
    @AppStorage("openAtLogin") private var openAtLogin = false
    @AppStorage("showInDock") private var showInDock = true

    var body: some View {
        Form {
            Toggle("Open at login", isOn: $openAtLogin)
            Toggle("Show in Dock", isOn: $showInDock)
        }
        .formStyle(.grouped)
    }
}
```

**Tab icon convention** Every tab must have a `systemImage:` (SF Symbol). macOS HIG mandates icons on preference tabs — text-only tabs look unfinished.

**Frame placement** The frame goes on the `TabView`, not on each tab body. This locks the window to one size across all tabs. If different tabs need different sizes, see Pattern 4.

---

## Pattern 3: macOS-Only Settings in a Cross-Platform App

A typical iOS+macOS app: most code is shared, Settings exists only on macOS.

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        #if os(macOS)
        Settings {
            SettingsView()
        }
        #endif
    }
}

#if os(macOS)
struct SettingsView: View {
    var body: some View {
        TabView { ... }
            .scenePadding()
            .frame(width: 450, height: 280)
    }
}
#endif
```

**Why wrap the View definition too** If `SettingsView` references macOS-only types (`Settings`, `SettingsLink`, certain modifiers), the file must be conditionally compiled. Otherwise the iOS build fails on the non-conditional view declaration.

**iOS users still need preferences** — they go in the app's main UI (a sheet, a navigation route, a Settings tab in TabView), not in a `Settings { }` scene. See Pattern 6 for opening the iOS system Settings app.

---

## Pattern 4: Per-Tab Sizing

When tabs have legitimately different content sizes, attach the frame to each tab body and let the window resize.

```swift
TabView {
    GeneralSettings()
        .frame(width: 450, height: 200)
        .tabItem { Label("General", systemImage: "gear") }

    LongPreferenceList()
        .frame(width: 450, height: 500)
        .tabItem { Label("Library", systemImage: "books.vertical") }
}
.scenePadding()
```

**Trade-off** Per-tab sizing means the window animates between sizes when the user switches tabs. Smooth on modern Macs but visible. If you want stable sizing, pick the largest needed size and pad shorter tabs.

---

## Pattern 5: SettingsLink (macOS 14+)

`SettingsLink` opens the app's own Settings scene from anywhere in the UI — useful for "Open Settings" buttons in onboarding, error states, or inline help.

```swift
struct WelcomeView: View {
    var body: some View {
        VStack {
            Text("Welcome to MyApp")
            Text("Configure your preferences to get started.")

            SettingsLink {
                Label("Open Settings", systemImage: "gear")
            }
            .buttonStyle(.borderedProminent)
        }
    }
}
```

**Default label** `SettingsLink()` with no closure produces a system-styled "Settings…" button.

**What it does NOT do** `SettingsLink` does not exist on iOS and does not open the iOS system Settings app. It is purely a shortcut to the app's own `Settings { }` scene on macOS 14+.

**Pre-macOS 14** Use `openSettings` environment action (macOS 14+ also) or `NSApplication.shared.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil, for: nil)` for older targets. Most apps can require macOS 14+.

---

## Pattern 6: iOS Adjacency — Opening System Settings

Different concept, often confused with `SettingsLink`. On iOS/iPadOS, your app cannot define a `Settings` scene, but you can deep-link to the **system Settings app** showing your app's bundled preferences.

```swift
import UIKit

struct PermissionDeniedView: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        Button("Open Settings") {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                openURL(url)
            }
        }
    }
}
```

**Where this opens** The iOS Settings app, scrolled to the section for the current app. Useful for permission denial flows ("camera access denied → user must enable in Settings").

**Cross-platform unification** If you want a single `OpenSettingsAction` that works on both platforms, use conditional compilation:

```swift
struct OpenSettingsButton: View {
    var body: some View {
        #if os(macOS)
        SettingsLink { Label("Settings…", systemImage: "gear") }
        #else
        OpenSystemSettingsButton()
        #endif
    }
}
```

---

## Pattern 7: Persistence with @AppStorage

The standard SwiftUI way to persist preferences. Backed by `UserDefaults` under the hood.

```swift
// Centralize keys to avoid string drift
enum PreferenceKey {
    static let showPreviews = "showPreviews"
    static let autoSaveInterval = "autoSaveInterval"
    static let theme = "theme"
}

struct GeneralSettings: View {
    @AppStorage(PreferenceKey.showPreviews) private var showPreviews = true
    @AppStorage(PreferenceKey.autoSaveInterval) private var autoSaveInterval = 30.0

    var body: some View {
        Form {
            Toggle("Show previews", isOn: $showPreviews)
            Stepper("Auto-save: \(Int(autoSaveInterval))s", value: $autoSaveInterval, in: 10...300, step: 10)
        }
    }
}

// Other parts of the app read the same key
struct DocumentView: View {
    @AppStorage(PreferenceKey.showPreviews) private var showPreviews = true
    // ...
}
```

**Why centralize keys** `@AppStorage("showPreviews")` in two files with one typo'd as `"showPreview"` produces a silent split: the Settings UI updates one key, the rest of the app reads the other. Keys live in one enum.

**Shared groups (App Group container)** If preferences need to sync across an app + extension (Widget, Share Extension), use `@AppStorage(_:store:)` with a shared `UserDefaults(suiteName:)`. See `skills/sandbox-and-file-access.md` for the App Group container setup.

---

## Anti-Patterns (DO NOT DO THIS)

### ❌ Using `Settings` without `#if os(macOS)` in a cross-platform app

```swift
// Compiles on macOS, fails on iOS with "'Settings' is unavailable"
var body: some Scene {
    WindowGroup { ContentView() }
    Settings { SettingsView() }
}
```

**Fix** Wrap in `#if os(macOS) ... #endif`.

### ❌ Confusing `SettingsLink` with iOS system Settings

```swift
// On iOS this won't compile; on Mac Catalyst it opens the Mac-style Settings, not iOS Settings
SettingsLink { Label("Settings", systemImage: "gear") }
```

**Fix** `SettingsLink` is macOS-only and opens the app's own `Settings { }` scene. For the iOS system Settings app, use `UIApplication.openSettingsURLString` (Pattern 6).

### ❌ Resizable Settings window for static content

```swift
// No frame → window resizes freely, looks weird
SettingsView()
```

**Fix** Add `.frame(width:height:)` for fixed sizing, or `.frame(width: 450, minHeight: 200)` for vertical-only resize on long preference lists.

### ❌ Tab labels without icons

```swift
// macOS HIG violation; tabs render text-only and look unfinished
.tabItem { Text("General") }
```

**Fix** `.tabItem { Label("General", systemImage: "gear") }`. Pick SF Symbols that match the tab's category.

### ❌ String-keyed @AppStorage scattered across files

```swift
// SettingsView.swift
@AppStorage("show_previews") private var showPreviews = true

// DocumentView.swift
@AppStorage("showPreviews") private var showPreviews = true  // Typo — different key!
```

**Fix** Define keys in a central enum (Pattern 7).

### ❌ Settings as a side door for app logic

```swift
// SettingsView containing business logic, network calls, side effects
struct SettingsView: View {
    @State var users: [User] = []
    var body: some View {
        Form {
            Button("Refresh users") {
                Task { users = try await fetchUsers() }
            }
        }
    }
}
```

**Fix** SettingsView is for displaying and toggling preferences. Business logic belongs in the app's main flow. If a setting triggers behavior, the behavior listens to the `@AppStorage` change elsewhere.

---

## Common Mistakes — Quick Reference

| Symptom | Most Likely Cause |
|---|---|
| `'Settings' is unavailable` on iOS | Missing `#if os(macOS)` |
| Settings menu item not in app menu | No `Settings { }` scene declared (or hidden by another scene's `commands`) |
| Window opens too small | No `.frame()` on SettingsView root |
| Window resizes weirdly | Frame uses `min` / `max` instead of fixed values |
| Tab content cramped | Missing `.scenePadding()` |
| Tabs render without icons | Used `Text` instead of `Label` for `.tabItem` |
| ⌘, doesn't open Settings | App is sandboxed AND another window is keyWindow with conflicting shortcut |
| `@AppStorage` doesn't sync to other view | Different key strings (typo) — use central enum |
| `SettingsLink` causes iOS build failure | `SettingsLink` is macOS 14+ only; needs `#if os(macOS)` |
| Settings opens but is empty | View body has `if`/`switch` returning `EmptyView` for current state |

---

## Code Review Checklist

Before merging Settings code:

- [ ] `Settings { }` is wrapped in `#if os(macOS)` (cross-platform apps)
- [ ] `SettingsView` itself is wrapped in `#if os(macOS)` if it references macOS-only APIs
- [ ] Root view has `.scenePadding()` AND a `.frame()` constraint
- [ ] All `Tab` labels use `Label("Title", systemImage: "...")` — never text-only
- [ ] `@AppStorage` keys come from a central enum, not inline string literals
- [ ] `SettingsLink` is only used on macOS 14+ (with appropriate availability check or `#if`)
- [ ] iOS code that opens system Settings uses `UIApplication.openSettingsURLString` via `@Environment(\.openURL)` — not `SettingsLink`
- [ ] No business logic / network calls / heavy state in SettingsView
- [ ] Keys persisted via `@AppStorage` use App Group `UserDefaults(suiteName:)` if shared with extensions

---

## Resources

**WWDC**: 2020-10119, 2022-10059, 2023-10148

**Docs**: /swiftui/settings, /swiftui/settingslink, /swiftui/scene, /uikit/uiapplication/opensettingsurlstring, /swiftui/appstorage

**Skills**: axiom-macos (skills/windows.md), axiom-macos (skills/menus-and-commands.md), axiom-macos (skills/sandbox-and-file-access.md), axiom-swiftui (skills/architecture.md)
