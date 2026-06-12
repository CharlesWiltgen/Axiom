---
name: appkit-interop
description: Use when embedding AppKit views inside SwiftUI (NSViewRepresentable, NSViewControllerRepresentable), hosting SwiftUI inside an AppKit app (NSHostingController/NSHostingView), bridging NSToolbar or NSOpenPanel, or debugging responder-chain or focus issues across the boundary.
---

# macOS AppKit Interoperability

The two-directional bridge — `NSViewRepresentable` and `NSViewControllerRepresentable` for embedding AppKit in SwiftUI; `NSHostingController` and `NSHostingView` for hosting SwiftUI in AppKit. Plus the responder chain, NSToolbar, NSOpenPanel, and drag-and-drop bridging.

## When to Use This Skill

Use this skill when you're:
- Embedding an AppKit view or view controller inside SwiftUI
- Hosting SwiftUI views inside an AppKit app
- Working around SwiftUI gaps — `NSToolbar` customization, `NSOpenPanel` options, `NSTextView` rich text
- Debugging menu commands, copy/paste, or keyboard shortcuts that don't cross the SwiftUI/AppKit boundary
- Bridging drag-and-drop between SwiftUI's `Transferable` model and AppKit's `NSDraggingDestination`
- Diagnosing responder chain or focus behavior that breaks when mixing frameworks
- Optimizing SwiftUI cells inside `NSCollectionView` or `NSTableView` for scroll performance
- Updating NSViews automatically from `@Observable` models (observation tracking — no SwiftUI required)
- Reusing an existing `NSGestureRecognizer` in a SwiftUI view (`NSGestureRecognizerRepresentable`, macOS 26)
- Building main-menu items in SwiftUI (`NSHostingMenu`) or adding SwiftUI scenes like `MenuBarExtra` and `Settings` to an AppKit app delegate (`NSHostingSceneRepresentation`, macOS 26)

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I host an `NSTextView` inside SwiftUI and keep bindings synced?"
- "My SwiftUI cells inside `NSCollectionView` cause scroll jank. What's wrong?"
- "When should I drop from `.fileImporter` to `NSOpenPanel`?"
- "My `.onCommand` modifier is silently ignored. What did I miss?"
- "Why are my writes from the AppKit delegate not reaching the SwiftUI binding?"
- "Can my NSView redraw automatically when my @Observable model changes?"
- "How do I add a SwiftUI MenuBarExtra to my existing AppKit app?"

## What This Skill Provides

### Direction Decision
- SwiftUI host + AppKit guest → `NSViewRepresentable` (raw view) or `NSViewControllerRepresentable` (controller with lifecycle)
- AppKit host + SwiftUI guest → `NSHostingController` (controller contexts) or `NSHostingView` (raw view contexts)
- When to bridge at all — start with SwiftUI; cross only when SwiftUI lacks the capability

### NSViewRepresentable Lifecycle
- `makeCoordinator()` → `makeNSView(context:)` → `updateNSView(_:context:)` → `dismantleNSView(_:coordinator:)`
- The coordinator pattern for delegate callbacks writing back to bindings
- Refreshing `context.coordinator.parent = self` in `updateNSView` so bindings stay current
- Guarding redundant property sets to avoid unnecessary AppKit work
- Reading `context.environment` (e.g., `isEnabled`) and applying it to the AppKit view
- The never-set-frame rule — SwiftUI owns layout; use `.frame()` on the SwiftUI side

### NSHostingController vs NSHostingView
- `NSHostingController` for view-controller contexts (`NSSplitViewItem`, sheets, popovers, modal windows, tabs)
- `NSHostingView` for raw view contexts (collection cells, sidebars, table cells)
- `sizingOptions` on the controller for Auto Layout constraint generation
- Critical reuse rule: create the hosting view once, then update `rootView` on reuse — never new-hosting-view-per-cell

### Responder Chain and Focus
- The "they don't live in separate worlds" mental model — SwiftUI views participate in the AppKit responder chain
- SwiftUI command modifiers — `.copyable`, `.cuttable`, `.pasteDestination`, `.onMoveCommand`, `.onExitCommand`, `.onCommand(#selector(...))`
- The `.focusable()` requirement for command receivers
- Full Keyboard Navigation testing (System Settings toggle on and off)

### Incremental SwiftUI Adoption
- Automatic observation tracking — AppKit redraws NSViews when `@Observable` properties accessed in draw/layout methods change; back-deploys to macOS 15
- `NSGestureRecognizerRepresentable` (macOS 26) and `NSHostingMenu` (macOS 14.4) — existing gestures and SwiftUI-built menus across the boundary
- `NSHostingSceneRepresentation` + `addSceneRepresentation` — `MenuBarExtra`/`Settings` scenes from an app delegate (macOS 26)

### Bridging Other AppKit APIs
- NSToolbar for capabilities `.toolbar` doesn't cover (item validation, user customization, centered groups)
- `NSOpenPanel` for capabilities `.fileImporter` doesn't cover (directories, accessory views, ubiquitous content)
- Drag and drop — `Transferable` + `.draggable`/`.dropDestination` for SwiftUI-native; `NSDraggingDestination` on the AppKit view inside a representable
- Shared state via `@Observable` (or `ObservableObject`) accessible to both sides

## Key Pattern

The most common performance bug — creating a new `NSHostingView` on every cell reuse instead of updating `rootView`:

```swift
class ShortcutItemView: NSCollectionViewItem {
    private var hostingView: NSHostingView<ShortcutView>?

    func displayShortcut(_ shortcut: Shortcut) {
        let view = ShortcutView(shortcut: shortcut)
        if let hostingView {
            hostingView.rootView = view  // reuse — SwiftUI diffs internally
        } else {
            let newHosting = NSHostingView(rootView: view)
            self.view.addSubview(newHosting)
            setupConstraints(for: newHosting)
            hostingView = newHosting
        }
    }
}
```

In `updateNSView`, always refresh `context.coordinator.parent = self` so coordinator-held bindings stay current — stale references silently swallow writes back to SwiftUI state.

## Documentation Scope

This page documents the `appkit-interop` skill in the `axiom-macos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions about bridging SwiftUI and AppKit.

**For UIKit-SwiftUI bridging** — Use [uikit-bridging](/skills/ui-design/uikit-bridging) for the same `Representable` pattern with `UIView`/`UIViewController` types.

## Related

- [appkit-modernization](/skills/macos/appkit-modernization) — Modernizing the AppKit side itself (input, restoration, macOS 27 look)
- [swiftui-differences](/skills/macos/swiftui-differences) — Drop to AppKit only when these macOS SwiftUI primitives don't cover the need
- [windows](/skills/macos/windows) — `NSHostingController` is the right way to host SwiftUI inside an AppKit-managed window or sheet
- [sandbox-and-file-access](/skills/macos/sandbox-and-file-access) — Reasons to drop from `.fileImporter` to `NSOpenPanel`
- [menus-and-commands](/skills/macos/menus-and-commands) — Where SwiftUI's command modifiers meet AppKit's responder chain
- [uikit-bridging](/skills/ui-design/uikit-bridging) — Same representable pattern, UIKit edition

## Resources

**WWDC**: 2022-10075, 2026-272

**Docs**: /swiftui/nsviewrepresentable, /swiftui/nsviewcontrollerrepresentable, /swiftui/nshostingcontroller, /swiftui/nshostingview, /swiftui/nshostingmenu, /swiftui/nsgesturerecognizerrepresentable, /swiftui/nshostingscenerepresentation, /appkit/nstoolbar, /appkit/nsopenpanel

**Skills**: axiom-macos, swiftui-differences, windows, sandbox-and-file-access, menus-and-commands
