---
name: audit-resize
description: Scan UIKit code, Info.plist, and the scene manifest for iOS 27 resize readiness — scene lifecycle, UIScreen.main, fixed-canvas rendering, Mirroring input
---

# audit-resize

Scan your app for readiness under the iOS 27 windowing model, where every window resizes — iPhone apps included (iPhone Mirroring on the Mac, iPhone-only apps on iPad).

## What This Command Does

Launches the **resize-auditor** agent to sweep UIKit code, Info.plist, and the scene manifest for the assumptions that break — or block launch entirely — when the canvas stops being fixed.

## What It Checks

1. **Scene lifecycle** – app-delegate-only apps no longer launch when built against the iOS 27 SDK
2. **Deprecated geometry sources** – `UIScreen.main` bounds/scale, `UIRequiresFullScreen`, orientation- and idiom-derived layout
3. **Fixed-canvas assumptions** – cached window geometry, hardcoded device-size constants
4. **Rendering surfaces** – Metal `drawableSize` and SpriteKit scale modes without live-resize handling
5. **iPhone Mirroring input** – custom gestures missing scroll-type masks or making touch-type assumptions
6. **Completeness** – minimum window size, resize throttling, per-scene state restoration, multi-window opt-in

## Usage

```
/axiom:audit resize
```

## Related

- [resize-auditor](/agents/resize-auditor) – The agent that powers this command
- [UIKit Modernization](/skills/ui-design/uikit-modernization) – the migration content behind every fix
- [audit-swiftui-layout](/commands/ui-design/audit-swiftui-layout) – the SwiftUI-side layout audit; run both on mixed codebases
