---
name: audit-touch
description: Scan a Mac app for touch readiness on touch-display Macs and Sidecar — custom recognizers, mouseDown overrides, tracking loops, hover-only actions
---

# audit-touch

Scan your Mac app for what breaks when someone touches it, on the touch-display MacBook Pro or an iPad connected over Sidecar.

## What This Command Does

Launches the **touch-auditor** agent to sweep AppKit, Mac Catalyst, and SwiftUI code and your Info.plist for the custom input handling that touch can't fully reach.

## What It Checks

1. **Freezes and crashes** – custom gesture recognizers that can miss a terminal state, and gesture debug defaults left on in release builds
2. **Tracking-loop fallbacks** – control subclasses that override `mouseDown`, container drags started from `mouseDragged`, and event-tracking loops
3. **Interrupted gestures** – actions that don't handle `.cancelled`, and `currentEvent` reads in action methods
4. **Reachability** – hover-only actions, context menus shown from `mouseDown`, overlays over controls, and small hit targets
5. **Games** – pointer positions built from movement deltas
6. **Completeness** – exclusive views, simultaneous controls, scroll-view relationships, `NSIsTouchNative`

## Usage

```
/axiom:audit touch
```

## Related

- [touch-auditor](/agents/touch-auditor) – The agent that powers this command
- [touch](/skills/macos/touch) – The fixes behind every finding
- [appkit-modernization](/skills/macos/appkit-modernization) – Control events and the `mouseDown` replacement map
