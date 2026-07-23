# iOS Apps on Mac

Guidance for the two migration paths that bring an existing iOS codebase to the Mac — running unmodified on Apple silicon ("Designed for iPad" / "Designed for iPhone") and Mac Catalyst — and for choosing deliberately between them and a native Mac target.

## When to Use

Use this skill when:

- Deciding how your iOS or iPad app should reach the Mac
- Your compatible iOS app appeared on the Mac App Store and you need to manage (or opt out of) Mac availability
- Adding a Mac Catalyst destination and deciding between "Scale Interface to Match iPad" and "Optimize Interface for Mac"
- Making a Catalyst app feel like a Mac app — menu bar, titlebar toolbar, Settings window, pointer and keyboard
- Debugging platform-detection surprises (`isMacCatalystApp` is true for unmodified iOS apps on Mac too)
- Hardware-dependent features (Core Motion, ARKit) fail for Mac users of your iOS app

## Example Prompts

- "Should I ship my iPad app as Designed for iPad or build with Mac Catalyst?"
- "How do I opt my iOS app out of the Mac App Store?"
- "How do I add a menu bar and toolbar to my Mac Catalyst app?"
- "Why does my iOS app on Apple silicon report `isMacCatalystApp` as true?"
- "What breaks when my iPhone app runs on a Mac?"
- "Should I use Optimize Interface for Mac?"

## What This Skill Provides

- A **decision tree** across the three paths: run unmodified, Catalyst, or a native SwiftUI/AppKit target
- **Designed for iPad mechanics** – opt-out availability on the Mac App Store, single-touch synthesis, Touch Alternatives, hardware-gated frameworks that error at runtime, the idiom staying `.pad`/`.phone`
- **Catalyst adoption checklist** – interface-idiom choice (77% iPad scaling vs native Mac controls), `UIMenuBuilder` menu bar, `UITitlebar`/`NSToolbar` window chrome, Settings scene, hover and keyboard support
- The **three runtime checks** disambiguated — `targetEnvironment(macCatalyst)` vs `isMacCatalystApp` vs `isiOSAppOnMac`

## Related

- [Windows](/skills/macos/windows) – window scenes and lifecycle for the native-target path
- [Menus & Commands](/skills/macos/menus-and-commands) – what belongs in each Mac menu, for Catalyst and native apps alike
- [Settings](/skills/macos/settings) – the Settings scene Catalyst apps should adopt
- [Direct Distribution](/skills/macos/direct-distribution) – Developer ID and notarization for Catalyst apps outside the Mac App Store
- [UIKit Modernization](/skills/ui-design/uikit-modernization) – iPhone Mirroring, which puts your iPhone app on a Mac screen with no distribution work required
