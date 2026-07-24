# resize-auditor

Scans your app for resize readiness under the iOS 27 windowing model — where every window resizes, iPhone apps included — sweeping UIKit code, Info.plist, and the scene manifest for the assumptions that break (or block launch) when the canvas stops being fixed.

## What It Does

- Detects launch-blocking configuration: app-delegate-only lifecycle (no scene delegate), which no longer launches when built against the iOS 27 SDK
- Finds deprecated geometry sources — `UIScreen.main` bounds/scale, `UIRequiresFullScreen`, orientation- and idiom-derived layout
- Flags cached window geometry and hardcoded device-size constants
- Checks rendering surfaces (Metal `drawableSize`, SpriteKit scale modes) for live-resize handling
- Checks iPhone Mirroring input compatibility (scroll-type masks, touch-type assumptions in custom gestures)
- Reasons about completeness: minimum window size, resize throttling, per-scene state restoration, multi-window opt-in
- Produces a Resize Readiness Score (RESIZE-READY / PARTIAL / FIXED-CANVAS)

## How to Use

**Natural language:**
- "Audit my app for screen resizing support"
- "Is my app ready for resizable windows on iOS 27?"
- "Check whether my app will work in iPhone Mirroring"

**Explicit command:**
```bash
/axiom:audit resize
```

## Related

- [UIKit Modernization](/skills/ui-design/uikit-modernization) – the migration content behind every fix: scene lifecycle, geometry replacements, Mirroring compatibility
- [UIKit Adaptive Layout](/skills/ui-design/uikit-adaptive-layout) – building the layouts that pass this audit
- [swiftui-layout-auditor](/agents/swiftui-layout-auditor) – the SwiftUI-side counterpart; run both on mixed codebases
- [spritekit-auditor](/agents/spritekit-auditor) – deeper SpriteKit findings beyond the resize strategy
