# UIKit Modernization

Guidance for the scene-based life cycle and resizability changes that UIKit requires in the iOS 27 cycle — the highest-impact UIKit change in years, because it gates whether your app launches at all.

## When to Use

Use this skill when:

- Building against the iOS 27 SDK and your app uses only a `UIApplicationDelegate` (no scene delegate)
- Your app "won't launch" after updating to the latest SDK
- Making an iPhone app adapt to arbitrary window sizes (iPhone Mirroring on Mac, iPhone apps on iPad)
- Replacing `UIScreen.main`, interface idiom, or orientation checks with adaptive equivalents
- Adopting iOS 27 additive APIs — tab bar sidebar/prominent tab, nav bar minimization, menu image visibility, CoreMotion/CoreLocation Body protocols
- Planning a UIKit → scene-lifecycle migration

## Example Prompts

- "My UIKit app won't launch on iOS 27"
- "How do I adopt the scene-based life cycle?"
- "What replaces `UIScreen.main`?"
- "How do I make my iPhone app resizable?"
- "Should I use the interface idiom or size classes for layout?"
- "How do I put a tab bar in a sidebar on iPhone? (iOS 27)"
- "What's the View Annotations API for Siri?"

## What This Skill Provides

- The **scene-lifecycle requirement** at iOS 27 (apps without a `UISceneDelegate` no longer launch) and the migration path
- A **don't/do table** for replacing `UIScreen.main`, `screen.scale`, `screen.bounds`, idiom, and orientation with scene/trait/size-class equivalents
- The new iOS 27 additive APIs — `prominentTabIdentifier`, `UITabBarControllerSidebar.preferredPlacement`, `barMinimizationSafeAreaAdjustment`, `UIMenuElement.preferredImageVisibility`, `deviceMotionBody`/`headingBody`
- Apple Intelligence touchpoints (menu "Ask Siri", View Annotations, drag-and-drop resource loading)
- How to let Xcode 27's app-modernization agent do the mechanical rewrites

## Related

- [UIKit-SwiftUI Bridging](/skills/ui-design/uikit-bridging) – embedding SwiftUI in a modernized scene-based UIKit app
- [App Composition](/skills/ui-design/app-composition) – app-level integration and UIKit → SwiftUI migration priority
- [SwiftUI Layout](/skills/ui-design/swiftui-layout) – size-class-driven adaptive layout, the recommended replacement for idiom/orientation checks
