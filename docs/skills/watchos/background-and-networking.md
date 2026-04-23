---
name: background-and-networking
description: Use when scheduling watchOS background refresh, choosing between SwiftUI .backgroundTask and WKApplicationDelegate handle(_:), picking URLSession configurations, hitting ENETDOWN from NWConnection, or debugging EXC_CRASH (SIGKILL) after a background wake.
---

# Background Tasks and Networking on watchOS

Background refresh, URLSession on the watch, and the TN3135 rule that blocks low-level networking for most apps — plus the task-completion contract that prevents mystery `SIGKILL` crashes.

## When to Use This Skill

Use this skill when you're:
- Picking between SwiftUI `.backgroundTask(_:action:)` and a WatchKit-style `handle(_:)` implementation
- Scheduling app refresh with `scheduleBackgroundRefresh(withPreferredDate:userInfo:scheduledCompletion:)`
- Choosing between default, ephemeral, and background URLSession configurations on a Watch target
- Hitting `ENETDOWN` when starting `NWConnection` on watchOS and wondering why it "works in the simulator"
- Handling `WKURLSessionRefreshBackgroundTask` or `WKWatchConnectivityRefreshBackgroundTask` wake-ups
- Debugging `EXC_CRASH (SIGKILL)` crashes shortly after a background wake

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Why does NWConnection return ENETDOWN on my Apple Watch but work in the simulator?"
- "My watch app crashes with SIGKILL a minute after waking in the background — what's the cause?"
- "Should I use .backgroundTask or implement handle(_:) for my refresh?"
- "Which URLSession configuration should I use for a download that might outlive the app?"
- "My scheduled background refresh never fires — what am I missing?"

## What This Skill Provides

### URLSession Over Everything
- The TN3135 policy — `NWConnection`, `NWPathMonitor`, `URLSessionStreamTask`, `URLSessionWebSocketTask`, `NWBrowser`, `NetService`, and BSD sockets are blocked for normal apps
- The three narrow exceptions (background audio, VoIP + CallKit, tvOS pairing) and their minimum versions
- Why the simulator doesn't enforce the rule and masks device-only failures

### URLSession Configuration Matrix
- Default, ephemeral, and background configurations and when each is appropriate
- Why `URLSession.shared` is wrong for anything that might outlive the app
- Avoiding `Data(contentsOf:)` and similar synchronous loaders that are unsupported on watchOS

### The New Way — SwiftUI `.backgroundTask`
- Named `appRefresh` identifiers that pair with scheduled `userInfo` strings
- Wrapping long work in `withTaskCancellationHandler` for clean cancellation before budget exhaustion

### The Delegate Path — `handle(_:)`
- How to branch on `WKApplicationRefreshBackgroundTask`, `WKSnapshotRefreshBackgroundTask`, `WKURLSessionRefreshBackgroundTask`, and `WKWatchConnectivityRefreshBackgroundTask`
- Completing every task — the contract that prevents `EXC_CRASH (SIGKILL)`
- Using `expirationHandler` to convert in-flight work into a background URLSession before suspension

### Background URLSession Wake-Up Flow
- The full sequence — system wake, `handle(_:)` receives task, session delegate callbacks, then complete
- Moving the downloaded file out of the temp location inside the delegate before returning

### Budget Reality
- What boosts background priority (complication on active face, app in Dock) and what throttles it (workouts, navigation, low battery)
- Why you must design for missed refreshes and always refresh on foregrounding

## Key Pattern

Every background task branch must reach `setTaskCompletedWithSnapshot(_:)`, and URLSession/WatchConnectivity tasks must complete **after** the session delegate finishes, not inside `handle(_:)`:

```swift
func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
    for task in backgroundTasks {
        switch task {
        case let t as WKURLSessionRefreshBackgroundTask:
            savedURLSessionTasks.append(t)  // complete after session delegate fires
        case let t as WKWatchConnectivityRefreshBackgroundTask:
            savedWCTasks.append(t)          // complete after WCSession settles
        default:
            task.setTaskCompletedWithSnapshot(false)
        }
    }
}
```

Skipping a branch burns the background-time budget. When the budget runs out, the app crashes with `EXC_CRASH (SIGKILL)` — often minutes or hours after the missing completion.

## Documentation Scope

This page documents the `background-and-networking` skill in the `axiom-watchos` suite. The skill file contains comprehensive guidance Claude uses when answering questions about `.backgroundTask`, background URLSession, TN3135 networking limits, and the task-completion contract.

**For Watch Connectivity wake-ups** — Use [watch-connectivity](/skills/watchos/watch-connectivity) for the `WKWatchConnectivityRefreshBackgroundTask` side of the completion contract.

## Related

- [platform-basics](/skills/watchos/platform-basics) — Covers the SwiftUI `.backgroundTask` hook in the `App` body and when to adopt a delegate
- [watch-connectivity](/skills/watchos/watch-connectivity) — Pair with this skill when the background wake is a Watch Connectivity delivery rather than a URLSession finish
- [background-processing](/skills/integration/background-processing) — iOS-side `BGTaskScheduler` patterns; this skill covers what's watchOS-specific
- [swift-concurrency](/skills/concurrency/swift-concurrency) — `withTaskCancellationHandler` and async cancellation semantics used inside `.backgroundTask` closures

## Resources

**WWDC**: 2019-716

**Docs**: /technotes/tn3135-low-level-networking-on-watchos, /watchkit/using-background-tasks, /watchos-apps/making-background-requests, /watchos-apps/keeping-your-watchos-app-s-content-up-to-date, /swiftui/scene/backgroundtask(_:action:), /watchkit/wkapplication/schedulebackgroundrefresh(withpreferreddate:userinfo:scheduledcompletion:), /watchkit/wkrefreshbackgroundtask, /watchkit/wkurlsessionrefreshbackgroundtask, /foundation/urlsession, /foundation/urlsessionconfiguration/background(withidentifier:)

**Skills**: axiom-watchos, platform-basics, watch-connectivity, smart-stack-and-complications
