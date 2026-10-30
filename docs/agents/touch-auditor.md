# touch-auditor

Scans a Mac app for touch readiness on touch-display Macs and Sidecar iPads. It finds the custom mouse handling that AppKit can only emulate, the gesture recognizers that can freeze an app, and the actions that a finger can't reach.

## What It Does

- Finds custom gesture recognizers that can miss a terminal state, which freezes the app after a touch, and gesture debug defaults left on in release builds
- Flags control subclasses that override `mouseDown`, which AppKit treats as a tracking loop, and container drags started from `mouseDragged`
- Lists event-tracking loops (`nextEvent(matching:)`, `trackEvents(matching:)`) that touch only reaches through single-finger emulation
- Checks gesture actions for missing `.cancelled` handling, context menus shown from `mouseDown`, and `currentEvent` reads in action methods
- Finds hover-only actions, overlays that block controls, event interception, and small custom hit targets
- Checks games for pointer positions built from movement deltas, which drift under touch
- Reasons about completeness: exclusive views, simultaneous controls, scroll-view relationships, `NSIsTouchNative`, and system-gesture opt-outs
- Produces a Touch Readiness Score (TOUCH-NATIVE / EMULATED / AT-RISK)

## How to Use

**Natural language:**
- "Audit my Mac app for touch readiness"
- "Is my Mac app ready for the touchscreen MacBook Pro?"
- "Find the mouseDown overrides and tracking loops I need to migrate for touch"

**Explicit command:**
```bash
/axiom:audit touch
```

## Related

- [touch](/skills/macos/touch) – The migration recipes and design rules behind every finding
- [appkit-modernization](/skills/macos/appkit-modernization) – Control events and the `mouseDown` replacement map
- [game-input](/skills/games/game-input) – The game-specific touch guidance the game checks point to
- [accessibility-auditor](/agents/accessibility-auditor) – Checks the VoiceOver and keyboard alternatives that hover-only and touch-only actions need
