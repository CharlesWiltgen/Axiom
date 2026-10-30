---
name: appkit-modernization
description: Modernizing AppKit apps — replacing mouseDown overrides, control events, status-item expanded interface sessions, graceful termination, state restoration, concentric corners, interactive glass
---

# AppKit Modernization

Bringing an existing AppKit app up to modern macOS conventions: input handling without `mouseDown` overrides, keyboard navigation, graceful quitting and state restoration, and the macOS 27 look and feel.

## When to Use

Use this skill when you're:
- Replacing `mouseDown` overrides used for selection, context menus, drag and drop, or text selection
- Reacting to control interactions with control events instead of tracking loops
- Fixing Full Keyboard Navigation that skips views or follows a stale key view loop
- Showing custom windows from a menu bar status item (expanded interface sessions)
- Making your app quit gracefully during system restarts and restore its windows on relaunch
- Adopting the macOS 27 look: concentric corners and interactive Liquid Glass

## Example Prompts

Questions you can ask your assistant that will draw from this skill:

- "How do I modernize my AppKit app's mouseDown handling?"
- "My status item shows a custom window — how do I handle keyboard focus?"
- "My app blocks the overnight software update restart"
- "How do I restore my windows after relaunch with NSWindowRestoration?"
- "How do I make my view's corners concentric with the window?"
- "Are UIControl-style control events available in AppKit?"

## What This Skill Provides

### Modern Input
- A replacement map for common `mouseDown` overrides (selection observation, context-menu APIs, modern dragging delegates, and `NSTextSelectionManager` on macOS 27)
- Control events in AppKit: `addTarget(_:action:for:)` works back to macOS 11, and the semantic cases (`.valueChanged`, `.primaryActionTriggered`, `.trackingRepeated`, `.menuActionTriggered`) are new in macOS 27
- The overlapping-sibling hit-testing gotcha and the `hitTest` fall-through fix

### Keyboard Navigation and Status Items
- Key view loop maintenance with `autorecalculatesKeyViewLoop`
- Expanded interface sessions for status items that show custom windows (macOS 27)

### Continuity
- Graceful termination: setting `preventsApplicationTerminationWhenModal` to `false` on sheets that don't need intervention
- The full three-step `NSWindowRestoration` workflow with encode and decode examples, restoring UI state rather than data

### macOS 27 Look and Feel
- The automatic Liquid Glass refinements, and interactive glass (`effectIsInteractive`)
- Concentric corner configuration (`cornerConfiguration`, `NSViewCornerRadius.containerConcentric`)
- Semantic roles for segmented controls and toolbar item groups

## Documentation Scope

This page documents the `appkit-modernization` skill (in the `axiom-macos` suite), which your assistant uses when you modernize AppKit input handling, state restoration, and your app's macOS 27 look and feel.

## Related

- [touch](/skills/macos/touch) – Touch input on touch-display Macs and Sidecar, which builds on this skill's input map
- [appkit-interop](/skills/macos/appkit-interop) – Hosting SwiftUI in AppKit (observation tracking, `NSHostingMenu`, SwiftUI scenes from an app delegate)
- [windows](/skills/macos/windows) – Scene types, window lifecycle, and document apps
- [menus-and-commands](/skills/macos/menus-and-commands) – Menu bar and command patterns
- [uikit-modernization](/skills/ui-design/uikit-modernization) – The UIKit counterpart to this skill

## Resources

**WWDC**: 2026-289

**Docs**: /appkit/nscontrol/events, /appkit/nstextselectionmanager, /appkit/nsstatusitem, /appkit/nswindowrestoration, /appkit/nsviewcornerconfiguration
