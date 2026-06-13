---
name: appkit-modernization
description: Modernizing AppKit apps — replacing mouseDown overrides, control events, status-item expanded interface sessions, graceful termination, state restoration, concentric corners, interactive glass, touch input
---

# AppKit Modernization

Guidance for bringing an existing AppKit app up to modern macOS conventions: input handling without `mouseDown` overrides, keyboard navigation, graceful quit and state restoration, and the macOS 27 look-and-feel.

## When to Use

Use this skill when you're:
- Replacing `mouseDown` overrides used for selection, context menus, drag-and-drop, or text selection
- Reacting to control interactions with control events instead of tracking loops
- Showing custom windows from a menu bar status item (expanded interface sessions)
- Making your app quit gracefully during system restarts and restore its windows on relaunch
- Adopting the macOS 27 look: concentric corners, interactive Liquid Glass
- Handling touch input on the Mac (touch scrolling, pull-to-refresh)

## Example Prompts

- "How do I modernize my AppKit app's mouseDown handling?"
- "My status item shows a custom window — how do I handle keyboard focus?"
- "My app blocks the overnight software update restart"
- "How do I restore my windows after relaunch with NSWindowRestoration?"
- "How do I make my view's corners concentric with the window?"
- "Are UIControl-style control events available in AppKit?"

## What This Skill Provides

### Modern Input
- A replacement map for common `mouseDown` overrides (selection observation, context-menu APIs, modern dragging delegates, NSTextSelectionManager on macOS 27)
- Control events in AppKit — target/action back-deploys to macOS 11; the semantic cases (`.valueChanged`, `.primaryActionTriggered`) are new in macOS 27
- The overlapping-sibling hit-testing gotcha and the `hitTest` fall-through fix

### Keyboard Navigation and Status Items
- Key view loop maintenance with `autorecalculatesKeyViewLoop`
- Expanded interface sessions for status items that show custom windows (macOS 27)

### Continuity
- Graceful termination (`preventsApplicationTerminationWhenModal`)
- The full three-step `NSWindowRestoration` workflow with encode/decode examples

### macOS 27 Look and Feel
- Automatic Liquid Glass refinements, interactive glass (`effectIsInteractive`)
- Concentric corner configuration (`cornerConfiguration`, `NSViewCornerRadius.containerConcentric`)
- The touch-input SDK surface (touch scrolling, `NSRefreshController` pull-to-refresh)

## Documentation Scope

This page documents the `appkit-modernization` skill in the `axiom-macos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions about modernizing AppKit input handling, restoration, and the macOS 27 look-and-feel.

**For SwiftUI hosting** — Use [appkit-interop](/skills/macos/appkit-interop) when the modernization step is adopting SwiftUI itself.

## Related

- [appkit-interop](/skills/macos/appkit-interop) – hosting SwiftUI in AppKit (observation tracking, NSHostingMenu, SwiftUI scenes from an app delegate)
- [windows](/skills/macos/windows) – scene types, window lifecycle, and document apps
- [menus-and-commands](/skills/macos/menus-and-commands) – menu bar and command patterns
- [uikit-modernization](/skills/ui-design/uikit-modernization) – the UIKit sibling skill

## Resources

**WWDC**: 2026-289

**Docs**: /appkit/nscontrol/events, /appkit/nswindowrestoration, /appkit/nsviewcornerconfiguration
