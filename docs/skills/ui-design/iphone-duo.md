---
name: iphone-duo
description: Use when preparing an app for iPhone Duo, Apple's two-display foldable iPhone — poses, vertical bars, the fold, arrangements, the hinge, and scene accessories
---

# iPhone Duo

Adapt your app to iPhone Duo, Apple's first two-display iPhone: a compact outer display and a large inner display that folds. This skill explains how the device changes your layout, which system behavior you get for free, and the new layout and scene tools Apple shipped in the iOS 27.1 SDK.

## When to Use

Use this skill when:
- You're preparing an app for iPhone Duo or a foldable iPhone
- Your layout breaks when the device opens, closes, rotates, or folds
- Toolbar and tab bar buttons should move to the side of the screen
- A button lands in the fold or under the inner camera
- You want to show content on another display or open a second window

## Example Prompts

- "How do I prepare my app for iPhone Duo?"
- "Should I check for the Duo model to give it a special layout?"
- "My toolbar buttons don't move to the side on iPhone Duo."
- "How do I keep my controls out of the fold?"
- "Can I use the hinge angle to drive an animation?"

## What This Skill Provides

- **Device model** – the two displays, their size classes, and every pose
- **SDK behavior** – what your app does on Duo when built with older SDKs, iOS 27.0, and iOS 27.1
- **Readiness today** – per-side safe areas, the tab sidebar, and window-request handling that work with the current SDK
- **Vertical bars** – which bars move to the side, item order, overflow priorities, and when to turn the behavior off
- **The fold** – rules for keeping controls reachable without hiding them, and for spacing and sizing custom grids around it
- **27.1 APIs** – vertical-bar overrides, reserved regions, arrangements, the hinge, and the camera accessory, with iOS 27.1 availability and `@available` gating
- **Simulator testing** – which runtime carries the Duo device type, which poses only Device Hub can set, and how to capture each display

## Related

- [UIKit Modernization](/skills/ui-design/uikit-modernization) – the resizing baseline iPhone Duo builds on: scene lifecycle, geometry, size classes
- [SwiftUI Layout](/skills/ui-design/swiftui-layout) – adaptive layout techniques and the size-class truth tables
- [Toolbars](/skills/ui-design/toolbars) – SwiftUI placements and overflow priorities, which also drive Duo's vertical bars
- [Camera Capture](/skills/integration/camera-capture) – Duo's two front cameras, the virtual front camera that works today, and why camera position no longer tells you which way a camera faces
- [resize-auditor](/agents/resize-auditor) – scans UIKit code for Duo problems such as symmetric inset math and hand-built bars
- [swiftui-layout-auditor](/agents/swiftui-layout-auditor) – flags SwiftUI controls under `.ignoresSafeArea()` and hand-built toolbar rows

## Resources

**Tech Talks**: 111461, 111462, 111463, 111464, 111465, 111466
