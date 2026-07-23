# UIKit App Modernization — Scene Lifecycle & Resizability

The 27 cycle makes the **scene-based life cycle mandatory** and assumes every app is resizable. This is the highest-impact UIKit change in years: it is a launch-time breaking change, not an opt-in.

## The breaking change — UIScene is required at 27

When you build against the 27 SDKs, **an app with only a `UIApplicationDelegate` (no `UISceneDelegate`) will no longer launch.** You must adopt the scene-based life cycle.

- Migration path: WWDC 2025 "Make your UIKit app more flexible" + Apple's doc "Transitioning to the UIKit scene-based life cycle."
- The SDK reflects this: `UIApplicationDelegate.application(_:supportedInterfaceOrientationsForWindow:)` and `UIApplication.supportedInterfaceOrientationsForWindow(_:)` are **deprecated at iOS 27** in favor of `UIWindowSceneDelegate.supportedInterfaceOrientations(for:)`.

This is a behavior/requirement change, so it carries no additive `OS27` marker — but it gates launch. Treat it as a must-fix before building against the 27 SDK.

#### The Info.plist side of the migration

- **Scene manifest** — `UIApplicationSceneManifest` declares the scenes. `UIApplicationSupportsMultipleScenes` (Bool) opts into simultaneous scenes (iPad multi-window, macOS windows); `UISceneConfigurations` holds the default configuration the system uses to create new scenes — under the `UIWindowSceneSessionRoleApplication` role, each entry carries `UISceneConfigurationName` and, conventionally, `UISceneDelegateClassName` (`UISceneStoryboardFile` for storyboard apps):
  ```xml
  <key>UIApplicationSceneManifest</key>
  <dict>
      <key>UIApplicationSupportsMultipleScenes</key><true/>
      <key>UISceneConfigurations</key>
      <dict>
          <key>UIWindowSceneSessionRoleApplication</key>
          <array>
              <dict>
                  <key>UISceneConfigurationName</key><string>Default</string>
                  <key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
              </dict>
          </array>
      </dict>
  </dict>
  ```
- **Launch screen is validated at upload** — apps built with the iOS 27 SDK or later must declare one of `UILaunchScreen`, `UILaunchStoryboardName`, `UILaunchScreens`, `UILaunchStoryboards` or the build fails validation at App Store Connect upload (TN3208; iPhone and iPad, App Store and alternative marketplaces). The storyboard-free path is a `UILaunchScreen` dict with `UIColorName`/`UIImageName`. Submission checklist: axiom-shipping (skills/app-store-submission.md).
- **Destinations, not device checks** — supported destinations/device families are target settings (`TARGETED_DEVICE_FAMILY`); runtime code adapts via size classes and scene geometry, never by re-deriving "what device am I on". Mac availability for iOS apps is an App Store Connect setting — see axiom-macos (skills/ios-apps-on-mac.md).

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

## iPhone Mirroring compatibility

Under iPhone Mirroring the app keeps running on the iPhone; the Mac supplies indirect mouse/trackpad/keyboard input and, from the 27 cycle, a freely resizable window. Standard UIKit and SwiftUI controls receive translated input correctly — the compatibility work is in custom gestures, biometric auth, and orientation assumptions.

#### The orientation trap

A mirrored app **always reports portrait interface orientation, regardless of the window's aspect ratio**. A landscape-shaped mirrored window is still "portrait". Never derive layout from `interfaceOrientation` — use size classes and the scene's `effectiveGeometry` (see the table above).

#### Indirect input reaches custom gestures differently

With `UIApplicationSupportsIndirectInputEvents` in effect (Info.plist key, iOS 13.4; treated as enabled when built against iOS 17+ SDKs):

- Pointer clicks arrive as `UITouch` of type `.indirectPointer`, not `.direct`.
- Trackpad pinch and rotate arrive as `UIEvent.EventType.transform` events that drive **only** `UIPinchGestureRecognizer` and `UIRotationGestureRecognizer`. For these events `numberOfTouches` is `0` and `location(ofTouch:in:)` raises — a custom recognizer that reads individual touches must detect non-touch events first (e.g. in `shouldReceive(_:)`).
- Scroll input is not touch: `allowedScrollTypesMask` (iOS 13.4) controls which scroll types a custom pan recognizer receives. `.discrete` is wheel-mouse scrolling, `.continuous` is trackpad — Mirroring users bring either device, so set `.all` explicitly:
  ```swift
  panRecognizer.allowedScrollTypesMask = .all   // wheel mice AND trackpads
  ```
  `UIScrollView` handles both automatically; this is only for custom pan handling.

#### Biometric auth needs a companion path

Biometric requests fail by default under Mirroring — the iPhone's Face ID/Touch ID sensors are not accessible from the Mac (TN3210). Use the companion-capable Local Authentication policy (iOS 18) so people can approve on the Mac (or a paired Apple Watch) instead:

```swift
let context = LAContext()
try await context.evaluatePolicy(
    .deviceOwnerAuthenticationWithBiometricsOrCompanion,
    localizedReason: "Unlock your vault")
```

With no companion nearby it behaves exactly like `.deviceOwnerAuthenticationWithBiometrics`, so it is safe as the default policy. On iOS the companion types are the Mac (iOS 18) and Vision Pro (iOS 26) — `LACompanionType` has no Watch case on iOS. A companion-only request with no companion available throws `LAError.companionNotAvailable`. For keychain items gated by `SecAccessControl`, add the `.companion` flag (iOS 18) alongside biometry — see axiom-security (skills/keychain.md).

#### Drag and drop crosses devices

Standard drag interactions (`UIDragInteraction`/`UIDropInteraction`, SwiftUI `Transferable`) participate in iPhone↔Mac drag and drop automatically (iOS 18.1/macOS 15.1). No Mirroring-specific API exists — apps that already implement standard drag and drop get the cross-device behavior for free. See axiom-swift (skills/transferable-ref.md).

#### Test it for real

Iterate in Device Hub's resizable simulator (see axiom-tools (skills/device-control-ref.md)), then validate in **actual iPhone Mirroring on macOS 27** — Apple's guidance is resizable simulator first, real devices and Mirroring to confirm. TN3210's checklist includes verifying that pinch, rotate, and scroll gestures work with a trackpad or mouse.

## Desktop-class input — pointer and hardware keyboard

The same environments that resize your windows also bring pointers and hardware keyboards (iPad, Catalyst, iOS-on-Mac, Mirroring). UIKit's opt-in surface:

- **Pointer effects** — `UIPointerInteraction` (iOS 13.4) gives views the system hover treatment; return a `UIPointerStyle` from the delegate to shape the region. `UIHoverGestureRecognizer` (iOS 13) tracks pointer movement over a view (plus Pencil hover `zOffset` from iOS 16.1).
- **Key commands** — register `UIKeyCommand`s on responders (or via `UIMenuBuilder`, which doubles as the iPad menu bar). The iPad hold-⌘ shortcut HUD shows each command's `discoverabilityTitle`, falling back to its `title`; a command with neither is invisible to discovery.
- SwiftUI equivalents (`onHover`, `hoverEffect`, `keyboardShortcut`) live in axiom-swiftui (skills/gestures.md Pattern 8).

```swift
button.addInteraction(UIPointerInteraction(delegate: self))

override var keyCommands: [UIKeyCommand]? {
    let find = UIKeyCommand(input: "f", modifierFlags: .command,
                            action: #selector(focusSearch))
    find.discoverabilityTitle = "Find"
    return [find]
}
```

## New 27 additive APIs

| API | Scope | Use |
|-----|-------|-----|
| `UITabBarController.prominentTabIdentifier` | `iOS27`/`visionOS27` | mark one tab always-visible/prominent |
| `UITabBarControllerSidebar.preferredPlacement` (`.sidebar`) + `Placement` | `iOS27`/`visionOS27` | iPhone can now opt a tab bar into a sidebar (the `sidebar` object itself is iOS 18) |
| `UINavigationItem.barMinimizationSafeAreaAdjustment` | `iOS27`/`tvOS27`/`visionOS27` | tune safe-area behavior when the bar minimizes |
| `UIMenuElement.preferredImageVisibility` | `iOS27` | Liquid Glass may hide menu images by default; opt an item back in |
| `CMMotionManager.deviceMotionBody` | `iOS27`/`watchOS27`/`visionOS27` | assign a `UIView` as the motion reference frame (Body protocols) |
| `CLLocationManager.headingBody` | `iOS27`/`macOS27`/`watchOS27` | replaces the deprecated `headingOrientation` |
| `UITraitCollection.systemPrefersReducedResourceUsage` (+ `UITraitSystemPrefersReducedResourceUsage`, `.systemPrefersReducedResourceUsageDidChange`) | `iOS27`/`tvOS27`/`visionOS27` | system asks the app to cut discretionary work under resource pressure — react via `registerForTraitChanges`; see `axiom-performance (energy.md)` for the response playbook |

`UIView` conforms to the CoreMotion/CoreLocation Body protocols, so you set `motionManager.deviceMotionBody = view` / `locationManager.headingBody = view` directly.

## Apple Intelligence touchpoints

Menus gain an automatic "Ask Siri" affordance, and UIKit adds a View Annotations API to annotate views with `AppEntity`s for Siri context (see WWDC 2026-278). If you support drag and drop, Siri may load resources via your drag handlers — avoid animations/modal UI in `sessionWillBegin` (a drag can start without a gesture); put stateful drag UI in `sessionDidMove`.

## Let Xcode do the mechanical migration

Xcode 27 ships an app-modernization agent skill that rewrites `UIScreen.main` calls → `traitCollection`/scene bounds, orientation checks → size classes, and can migrate to the scene life cycle. Export the skill for other tools with `xcrun agent skills export`. See `axiom-xcode-mcp` for the agentic-Xcode workflow.

## Resources

**WWDC**: 2025-243, 2026-278

**Docs**: /uikit/app-and-environment, /uikit/uiscenedelegate, /uikit/uiwindowscene, /uikit/uiscenesizerestrictions, /uikit/transitioning-to-the-uikit-scene-based-life-cycle, /uikit/uitabbarcontroller, /uikit/uitabbarcontrollersidebar, /uikit/uimenuelement, /technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key, /technotes/tn3210-optimizing-your-app-for-iphone-mirroring, /technotes/tn3208-preparing-your-apps-launch-screen-to-meet-app-store-requirements, /bundleresources/information-property-list/uiapplicationscenemanifest, /bundleresources/information-property-list/uilaunchscreen, /bundleresources/information-property-list/uiapplicationsupportsindirectinputevents, /uikit/uipangesturerecognizer/allowedscrolltypesmask, /localauthentication/lapolicy, /uikit/drag-and-drop

**Skills**: skills/uikit-bridging.md, axiom-xcode-mcp, axiom-swiftui (size-class-driven adaptive layout), axiom-security (skills/keychain.md), axiom-swift (skills/transferable-ref.md)
