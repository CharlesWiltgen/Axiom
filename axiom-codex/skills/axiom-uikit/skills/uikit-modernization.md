# UIKit App Modernization — Scene Lifecycle & Resizability

The 27 cycle makes the **scene-based life cycle mandatory** and assumes every app is resizable. This is the highest-impact UIKit change in years: it is a launch-time breaking change, not an opt-in.

## The breaking change — UIScene is required at 27

When you build against the 27 SDKs, **an app with only a `UIApplicationDelegate` (no `UISceneDelegate`) will no longer launch.** You must adopt the scene-based life cycle.

- Migration path: WWDC 2025 "Make your UIKit app more flexible" + Apple's doc "Transitioning to the UIKit scene-based life cycle."
- The SDK reflects this: `UIApplicationDelegate.application(_:supportedInterfaceOrientationsForWindow:)` and `UIApplication.supportedInterfaceOrientationsForWindow(_:)` are **deprecated at iOS 27** in favor of `UIWindowSceneDelegate.supportedInterfaceOrientations(for:)`.

This is a behavior/requirement change, so it carries no additive `OS27` marker — but it gates launch. Treat it as a must-fix before building against the 27 SDK.

## Every app is now resizable

iPhone apps resize freely (iPhone Mirroring on Mac; an iPhone-only app on iPad). Your UI must adapt to **any** scene size at runtime.

#### Stop reading the screen and the idiom

| Don't (wrong in resizable / external-display contexts) | Do |
|---|---|
| `UIScreen.main` | `window.windowScene?.screen` |
| `screen.scale` | `traitCollection.displayScale` |
| `screen.bounds` | the view's own `bounds`, or `windowScene.effectiveGeometry.coordinateSpace.bounds` |
| `UIDevice.userInterfaceIdiom` for layout | **size classes** (`traitCollection.horizontalSizeClass`) |
| `supportedInterfaceOrientations` for layout | size classes — orientation is only a *preference* at 27 and is ignored in resizable environments |

`effectiveGeometry` (iOS 16) and the `windowScene(_:didUpdateEffectiveGeometry:)` delegate (iOS 26) are the adaptive-geometry APIs to adopt — they predate 27, but 27 is where ignoring them breaks. `UIRequiresFullScreen` is now honored on iPhone but only enables *discrete* resizing that snaps to orientation-honoring configurations (for games); it no longer fully opts out of resizing.

```swift
override func layoutSubviews() {
    super.layoutSubviews()
    let displayScale = traitCollection.displayScale     // not UIScreen.main.scale
    // size from self.bounds, not the screen
}

func windowScene(_ windowScene: UIWindowScene,
                 didUpdateEffectiveGeometry previous: UIWindowScene.Geometry) {
    let bounds = windowScene.effectiveGeometry.coordinateSpace.bounds
}
```

#### Express preferences, not a fixed canvas

You no longer own a fixed canvas — you express preferences the user and system honor.

- **Minimum size** — the documented replacement for the old `UIRequiresFullScreen` opt-out (TN3192). Set it on the scene's `UISceneSizeRestrictions` so users can't shrink the window below a usable size:
  ```swift
  windowScene.sizeRestrictions?.minimumSize = CGSize(width: 400, height: 600)
  ```
- **Orientation lock** — a *preference*, not a guarantee, in resizable environments. Override `UIViewController.prefersInterfaceOrientationLocked` (returns `Bool`) and call `setNeedsUpdateOfPrefersInterfaceOrientationLocked()` when it changes; read the resolved state from `windowScene.effectiveGeometry.isInterfaceOrientationLocked` (iOS 26).
- **Interactive vs settled resize** — `UIWindowSceneGeometry.isInteractivelyResizing` (iOS 26) is `true` while the user drags; throttle expensive work during the drag and settle when it clears. SwiftUI's equivalent is `.onInteractiveResizeChange(_:)` (see axiom-swiftui (skills/layout-ref.md)).

## New 27 additive APIs

| API | Scope | Use |
|-----|-------|-----|
| `UITabBarController.prominentTabIdentifier` | `iOS27`/`visionOS27` | mark one tab always-visible/prominent |
| `UITabBarControllerSidebar.preferredPlacement` (`.sidebar`) + `Placement` | `iOS27`/`visionOS27` | iPhone can now opt a tab bar into a sidebar (the `sidebar` object itself is iOS 18) |
| `UINavigationItem.barMinimizationSafeAreaAdjustment` | `iOS27`/`tvOS27`/`visionOS27` | tune safe-area behavior when the bar minimizes |
| `UIMenuElement.preferredImageVisibility` | `iOS27` | Liquid Glass may hide menu images by default; opt an item back in |
| `CMMotionManager.deviceMotionBody` | `iOS27`/`watchOS27`/`visionOS27` | assign a `UIView` as the motion reference frame (Body protocols) |
| `CLLocationManager.headingBody` | `iOS27`/`macOS27`/`watchOS27` | replaces the deprecated `headingOrientation` |

`UIView` conforms to the CoreMotion/CoreLocation Body protocols, so you set `motionManager.deviceMotionBody = view` / `locationManager.headingBody = view` directly.

## Apple Intelligence touchpoints

Menus gain an automatic "Ask Siri" affordance, and UIKit adds a View Annotations API to annotate views with `AppEntity`s for Siri context (see WWDC 2026-278). If you support drag and drop, Siri may load resources via your drag handlers — avoid animations/modal UI in `sessionWillBegin` (a drag can start without a gesture); put stateful drag UI in `sessionDidMove`.

## Let Xcode do the mechanical migration

Xcode 27 ships an app-modernization agent skill that rewrites `UIScreen.main` calls → `traitCollection`/scene bounds, orientation checks → size classes, and can migrate to the scene life cycle. Export the skill for other tools with `xcrun agent skills export`. See `axiom-xcode-mcp` for the agentic-Xcode workflow.

## Resources

**WWDC**: 2025-243, 2026-278

**Docs**: /uikit/app-and-environment, /uikit/uiscenedelegate, /uikit/uiwindowscene, /uikit/uiscenesizerestrictions, /uikit/transitioning-to-the-uikit-scene-based-life-cycle, /uikit/uitabbarcontroller, /uikit/uitabbarcontrollersidebar, /uikit/uimenuelement, /technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key

**Skills**: skills/uikit-bridging.md, axiom-xcode-mcp, axiom-swiftui (size-class-driven adaptive layout)
