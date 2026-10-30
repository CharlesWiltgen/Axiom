---
name: iphone-duo
description: Use when preparing an app for iPhone Duo, Apple's two-display foldable iPhone — poses, vertical bars, the fold, arrangements, the hinge, and scene accessories
---

# iPhone Duo

Adapt your app to iPhone Duo, Apple's first two-display iPhone: a compact outer display and a large inner display that folds. This skill explains how the device changes your layout, which system behavior you get for free, and the new layout, hinge, and scene tools Apple shipped in the iOS 27.1 SDK.

## When to Use

Use this skill when:
- You're preparing an app for iPhone Duo or a foldable iPhone
- Your layout breaks when the device opens, closes, rotates, or folds
- Toolbar, tab bar, or navigation bar items should move to the side of the screen
- A button lands in the fold or under the inner camera
- You're deciding how custom UI should avoid the fold, split into two views, or respond to the fold angle
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
- **Readiness today** – per-side safe areas, the tab sidebar, window-request handling, and Split View testing, none of which needs a 27.1 API
- **Vertical bars** – which bars move to the side, item order, overflow priorities, and when to turn the behavior off
- **The fold and the inner camera** – rules for keeping controls clear of both without hiding them, and for spacing and sizing custom grids around the fold
- **27.1 APIs** – vertical-bar overrides, reserved regions, arrangements, the hinge, and the camera accessory, with iOS 27.1 availability and `@available` gating; the camera-direction types build with Xcode 27.1 or the Xcode 27.2 RC and release but are missing from Xcode 27.2 beta 2
- **Simulator testing** – which runtime carries the Duo device type, why only Xcode's Device Hub can change poses, and how to capture each display
- **Bar metrics** – the vertical bar's measured width, and why a symbol's point size in the bar doesn't match the same symbol elsewhere

## Documentation Scope

This page documents the `iphone-duo` skill (in the `axiom-swiftui` suite), which your assistant draws on when you adapt an app's layout, bars, and scenes to iPhone Duo.

## Related

- [UIKit Modernization](/skills/ui-design/uikit-modernization) – the resizing baseline iPhone Duo builds on: scene lifecycle, geometry, size classes
- [SwiftUI Layout](/skills/ui-design/swiftui-layout) – adaptive layout techniques and the size-class truth tables
- [Toolbars](/skills/ui-design/toolbars) – SwiftUI placements and overflow priorities, which also drive Duo's vertical bars
- [Camera Capture](/skills/integration/camera-capture) – Duo's two front cameras, the virtual front camera that works today, and why camera position no longer tells you which way a camera faces
- [Camera Capture Reference](/reference/camera-capture-ref) – exact names for the front-camera and camera-direction APIs that Duo camera code calls
- [resize-auditor](/agents/resize-auditor) – scans UIKit code for Duo problems such as symmetric inset math and hand-built bars
- [swiftui-layout-auditor](/agents/swiftui-layout-auditor) – flags SwiftUI controls under `.ignoresSafeArea()` and hand-built toolbar rows

## Resources

**Tech Talks**: 111461, 111462, 111463, 111464, 111465, 111466
