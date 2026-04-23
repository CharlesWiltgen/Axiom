---
name: platform-basics
description: Use when starting a new watchOS app, choosing between watch-only/companion/independent models, setting up the @main entry point, adopting WKApplicationDelegate, or preparing for the April 2026 watchOS 26 SDK and ARM64 submission deadlines.
---

# watchOS Platform Basics

Foundations of a modern watchOS app — project templates, entry-point structure, delegate adoption, and the submission requirements that take effect in April 2026.

## When to Use This Skill

Use this skill when you're:
- Starting a new watchOS app and picking between watch-only, companion, and independent templates
- Setting up the SwiftUI `@main` entry point with `App`, `WindowGroup`, and `NavigationStack`
- Preparing a project for the April 2026 watchOS 26 SDK and ARM64 submission rules
- Adopting `WKApplicationDelegate` to handle workouts, Now Playing, extended runtime, or remote notifications
- Wiring a custom notification long-look with `WKNotificationScene` and `WKUserNotificationHostingController`
- Auditing `Info.plist` keys like `WKRunsIndependentlyOfCompanionApp` and `WKWatchOnly`

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Should my new watch app be independent, companion, or both?"
- "What do I need to fix before the April 2026 watchOS 26 submission deadline?"
- "Do I need a WKApplicationDelegate in a SwiftUI watchOS app?"
- "How do I add a custom long-look notification view on watchOS?"
- "Why is my watch app being rejected for architecture reasons?"

## What This Skill Provides

### Project Models and Templates
- The three valid target configurations (watch-only, paired companion, independent+companion) and when to pick each
- Why "independent+companion" is the recommended default for new work
- `Info.plist` keys that distinguish the three models (`WKRunsIndependentlyOfCompanionApp`, `WKWatchOnly`, `WKWatchKitApp`)

### Submission Requirements (April 2026)
- ARM64 / 64-bit support required starting April 2026
- Built-with-watchOS-26-SDK requirement starting April 28, 2026
- What to verify before submission (build settings, device testing on Series 9/10/Ultra 2, arm64 audit of `Float`/`Int`/pointer math)

### App Entry Point and Scenes
- Canonical SwiftUI `@main` shape with `WindowGroup` and `NavigationStack`
- Adding `WKNotificationScene` for custom long-look notifications
- Why `NavigationView` is deprecated and what replaces it

### When You Still Need a Delegate
- The specific events SwiftUI doesn't expose (remote notification registration, workout recovery, extended runtime, Now Playing handoff)
- How to wire `WKApplicationDelegate` with `@WKApplicationDelegateAdaptor`
- Why an empty delegate "just in case" is an anti-pattern

## Key Pattern

The canonical SwiftUI-first watchOS entry point — no storyboard, no WatchKit Extension:

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

Add `WKNotificationScene` only when a category needs a custom long-look. Add `@WKApplicationDelegateAdaptor` only when a specific event (workouts, APNs registration, Now Playing, extended runtime) requires it.

## Documentation Scope

This page documents the `platform-basics` skill in the `axiom-watchos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions about project structure, entry points, and submission gating.

**For watchOS-specific design and navigation** — Use [design-for-watchos](/skills/watchos/design-for-watchos) once the project is structured and you're laying out screens.

## Related

- [design-for-watchos](/skills/watchos/design-for-watchos) — Once the project compiles, pick the right navigation primitive and design for Always On
- [watch-connectivity](/skills/watchos/watch-connectivity) — Relevant when a companion iPhone app coordinates state with the watch
- [background-and-networking](/skills/watchos/background-and-networking) — Covers `.backgroundTask(_:action:)`, URLSession background sessions, and TN3135 networking limits
- [modernization](/skills/watchos/modernization) — Follow this when migrating an existing WatchKit + ClockKit app to SwiftUI + WidgetKit
- [app-store-submission](/skills/shipping/app-store-submission) — Submission specifics beyond the watchOS-26-SDK gate

## Resources

**WWDC**: 2025-334, 2025-219, 2024-10205, 2023-10138, 2022-10133

**Docs**: /watchos-apps/building-a-watchos-app, /watchos-apps/creating-independent-watchos-apps, /swiftui/app, /swiftui/windowgroup, /watchkit/wkapplicationdelegate, /swiftui/wkapplicationdelegateadaptor, /swiftui/wknotificationscene, /watchkit/wkusernotificationhostingcontroller

**Skills**: axiom-watchos, design-for-watchos, watch-connectivity, background-and-networking, modernization
