# watchOS Platform Basics

## When to Use This Skill

Use when:
- Starting a new watchOS app and need the project template, target structure, and `Info.plist` keys
- Deciding between a watch-only app, a companion iOS app, or an independent app that ships in both forms
- Setting up the app entry point — `@main`, `App`, `WindowGroup`, `NavigationStack`, delegate adoption
- Preparing for the April 2026 watchOS 26 SDK and ARM64 submission deadlines
- Adding a `WKApplicationDelegate` to handle workouts, Now Playing, extended runtime, or remote notifications
- Wiring a custom notification long-look with `WKUserNotificationHostingController`
- Debugging types that behave differently on arm64 (`Float`, `Int`, pointer math)

#### Related Skills

- Use `design-for-watchos.md` for watchOS HIG, navigation model, and glanceable UX
- Use `watch-connectivity.md` when coordinating state with a paired iPhone app
- Use `background-and-networking.md` for `backgroundTask(_:action:)`, URLSession background, and TN3135 networking limits
- Use `smart-stack-and-complications.md` for WidgetKit complications, Smart Stack widgets, and RelevanceKit
- Use `controls-and-live-activities.md` for controls that land in Control Center and the Smart Stack
- Use `modernization.md` for WatchKit → SwiftUI and ClockKit → WidgetKit migration
- Use `axiom-shipping` for App Store Connect submission specifics beyond the watchOS SDK gate
- Use `axiom-health` when the app records workouts with HealthKit; Smart Stack suggests workout apps from routine

## Core Principle

**Ship a SwiftUI-first, independent, 64-bit app built with the watchOS 26 SDK.** That is the supported path as of watchOS 26 (April 2026 submission rule). Every other path — WatchKit storyboards, 32-bit builds, companion-only apps — is either deprecated or blocked at submission.

## Submission Requirements (watchOS 26, April 2026)

Both rules are already announced by Apple:

| Rule | Effective | Details |
|---|---|---|
| 64-bit / ARM64 support required | April 2026 | Apple news, July 22, 2025. Use Xcode's default `Standard Architectures` build setting. |
| Built with watchOS 26 SDK or later | April 28, 2026 | Apple news, February 3, 2026. Same rule applies across iOS/iPadOS/tvOS/visionOS 26 SDKs. |

> "Apple Watch Series 9 and later, and Apple Watch Ultra 2 now use the arm64 architecture on watchOS 26." — Apple, What's new in watchOS 26

> "Xcode has supported building Apple Watch apps for the arm64 architecture since Xcode 14… If you're already building with standard architectures, you're already building for arm64." — Apple, What's new in watchOS 26

#### What to verify before submission

- Build setting on every Watch target is `Standard Architectures`, not a locked legacy setting
- Audit `Float`, `Int`, and pointer-based math — behavior differs on arm64 vs armv7k
- Run on a device (Apple Watch Series 9, Series 10, Ultra 2) in addition to the simulator; the simulator always uses arm64 on Apple Silicon and can hide device-only issues

## Project Structure — Three Models

Apple ships one Xcode template with three valid configurations. Pick the right one once; switching later means editing deployment info and resigning.

| Model | Template | `WKRunsIndependentlyOfCompanionApp` | When to use |
|---|---|---|---|
| Watch-only | "Watch-only App" | Auto (no companion exists) | Wrist-first apps with no iPhone surface |
| Paired companion | "App" + watchOS target added to iOS project | `false` | Existing iPhone app where the watch is a remote UI |
| Independent + companion | Same as above, with box checked | `true` | Paired-or-alone — the safe default for new work |

**"Independent + companion" is the recommended default.** It gives users the choice, works in Family Setup, and matches the Smart Stack workflow where people add controls from an iPhone app onto a Watch without having a Watch app installed.

> "Independent watchOS apps can't rely on the Watch Connectivity framework to transfer data or files from a companion iOS app." — Apple, Creating independent watchOS apps

What an independent app must handle itself:

- Account creation and sign-in on the watch
- System permission prompts on the watch
- Data downloads over the network — no Watch Connectivity fallback
- Push notification registration, including complication pushes

Enable independence on an existing target: project editor → Watch App target → General → Deployment Info → check "Supports Running Without iOS App Installation".

## Canonical App Entry Point

**SwiftUI App protocol, no storyboard, no WatchKit Extension.** Every new watchOS app should start from this shape:

```swift
import SwiftUI

@main
struct MyWatch_Watch_App: App {
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ContentView()
            }
        }
    }
}
```

The `@main` attribute marks the entry point — an app has exactly one. The `WindowGroup` wraps a `NavigationStack` that provides the stack + title area. SwiftUI automatically composes scenes into a compound scene. (`NavigationView` is deprecated since watchOS 9 — use `NavigationStack`.)

#### Why SwiftUI over WatchKit

> "On watchOS, SwiftUI gives you considerably more freedom, power, and control than user interfaces laid out and designed in a storyboard. For example, List has a number of features that aren't supported by WKInterfaceTable, such as the platter style, swipe actions, and row reordering." — Apple, Building a watchOS app

Start new projects on SwiftUI. Use `modernization.md` if an existing WatchKit app needs a migration plan.

## Adding Notification Scenes

Every notification category that needs a custom long-look gets a `WKNotificationScene` in the `App`'s body:

```swift
var body: some Scene {
    WindowGroup {
        NavigationStack {
            ContentView()
        }
    }
    WKNotificationScene(controller: NotificationController.self, category: "myCategory")
}
```

The controller subclasses `WKUserNotificationHostingController` and drives a SwiftUI view with the notification's content:

```swift
import SwiftUI
import UserNotifications

class NotificationController: WKUserNotificationHostingController<NotificationLongLook> {
    var content: UNNotificationContent!
    var date: Date!

    override var body: NotificationLongLook {
        NotificationLongLook(content: content, date: date)
    }

    override class var isInteractive: Bool { true }

    override func didReceive(_ notification: UNNotification) {
        content = notification.request.content
        date = notification.date
    }
}
```

`isInteractive` decides whether the system shows action buttons. `didReceive(_:)` is the only hand-off point from `UNNotification` to your SwiftUI state.

## SwiftUI Event Handling — What It Covers

For most lifecycle work, SwiftUI's environment values and view modifiers replace the old app-delegate callbacks:

| Need | SwiftUI hook |
|---|---|
| Foreground / background / inactive transitions | `@Environment(\.scenePhase)` + `.onChange(of: scenePhase)` |
| Handoff / `NSUserActivity` | `.onContinueUserActivity(_:perform:)` |
| Background refresh, snapshot, URLSession background delivery | `.backgroundTask(_:action:)` |

Reach for an `App` delegate only when SwiftUI can't cover the need — the list is specific.

## When You Still Need an App Delegate

Adopt `WKApplicationDelegate` and wire it with `@WKApplicationDelegateAdaptor`:

```swift
import SwiftUI
import WatchKit

@main
struct MyWatch_Watch_App: App {
    @WKApplicationDelegateAdaptor var appDelegate: MyAppDelegate

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ContentView()
            }
        }
        WKNotificationScene(controller: NotificationController.self, category: "myCategory")
    }
}
```

The delegate is the only path for these events — SwiftUI doesn't expose them:

- `applicationDidFinishLaunching()` (when truly needed — most apps don't need it)
- `userInfo` dictionaries from handoff or complications
- Remote Now Playing activity
- Workout configurations and recovery (crash-resilient workout continuation)
- Extended runtime sessions
- Registration of remote notifications (APNs device token)

If none of those apply, skip the delegate entirely. Do not add an empty delegate "just in case" — it's one more thing to break on arm64.

## Info.plist Keys That Matter

The Xcode template sets these; know what they mean when reviewing an existing project:

| Key | Purpose |
|---|---|
| `WKWatchKitApp` (Bool) | Marks this bundle as a watchOS app |
| `WKAppBundleIdentifier` | Bundle ID of the watchOS app |
| `WKCompanionAppBundleIdentifier` | Paired iOS app bundle ID (companion configs only) |
| `WKExtensionDelegateClassName` | Legacy WatchKit Extension delegate class name — SwiftUI apps usually don't need it |
| `WKRunsIndependentlyOfCompanionApp` (Bool) | Set `true` for independent or independent+companion apps |
| `WKWatchOnly` (Bool) | Set `true` for watch-only apps with no iOS target |

`WKRunsIndependentlyOfCompanionApp = YES` + `WKWatchOnly = NO` is the "independent + companion" shape. `WKWatchOnly = YES` is the watch-only shape.

## Common Mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Leaving the target on `armv7k` after enabling `Standard Architectures` via project-level settings | App Store submission rejected starting April 2026; crashes on device because the build links the wrong binary | Confirm `Standard Architectures` is set on every Watch target individually, not just at project level; rebuild |
| Treating the simulator as sufficient arm64 testing | Device crashes that never reproduce in the simulator — the simulator always uses arm64 on Apple Silicon and masks armv7k-only defects in legacy code | Test on a physical Apple Watch Series 9 / 10 / Ultra 2 running watchOS 26 before submission |
| Forcing pointer arithmetic through `Int` casts | Misaligned reads, intermittent crashes on device | Audit `Float`, `Int`, and pointer-based math per Apple's arm64 guidance; use typed pointer APIs |
| Starting a new app as "Watch App with Companion iOS App" without checking "Supports Running Without iOS App Installation" | App fails Family Setup; won't install on a watch whose paired iPhone lacks the iPhone app | Check the box at project creation — independent+companion is the safe default |
| Building an independent app that still relies on `WCSession.transferFile` as the primary data path | No data on Family Setup watches or unpaired watches; silent sync failures | Use URLSession + auth token directly from the watch; reserve Watch Connectivity for optimization when a paired iPhone is online |
| Empty `WKApplicationDelegate` adopted "just in case" | Nothing breaks immediately, but obscures whether the app needs delegate callbacks and costs one more build-target dependency | Remove the delegate until a specific event (workout recovery, remote notifications, Now Playing) actually requires it |
| Custom toolbar/control styles that haven't been audited against Liquid Glass | Inconsistent appearance against watchOS 26 system style; hard-to-read elements on new materials | Run the app on watchOS 26 and verify every custom style, or drop the custom styling and adopt the new defaults |
| Assuming WWDC 2025-334's "Controls on Apple Watch" story means you must build a Watch app | Time spent building a Watch target for an action that works fine as an iPhone-side control surfaced on the watch | Controls from iPhone apps appear on Apple Watch even without a Watch app — see `controls-and-live-activities.md` |

## Resources

**WWDC**: 2025-334, 2025-219, 2024-10205, 2023-10138, 2022-10133

**Docs**: /watchos-apps/building_a_watchos_app, /watchos-apps/setting-up-a-watchos-project, /watchos-apps/creating-independent-watchos-apps, /swiftui/app, /swiftui/scene, /swiftui/windowgroup, /watchkit/wkapplicationdelegate, /swiftui/wkapplicationdelegateadaptor, /swiftui/wknotificationscene, /watchkit/wkusernotificationhostingcontroller

**Skills**: axiom-watchos (design-for-watchos, watch-connectivity, background-and-networking, smart-stack-and-complications, controls-and-live-activities, modernization), axiom-shipping, axiom-health
