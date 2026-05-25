
# Live Activities (ActivityKit) — Discipline

Live Activities show glanceable, persistent, current-state information about an ongoing event on the Lock Screen, in the Dynamic Island, and in StandBy — plus Apple Watch Smart Stack (one modifier) and, automatically, CarPlay and the Mac menu bar. They are built *in* a widget extension (they share WidgetKit rendering), but the runtime lifecycle is driven by **ActivityKit** from your app and your server.

## Core mental model

A Live Activity has two halves:
- **Static `ActivityAttributes`** — set once at start, never change (order number, team names).
- **Dynamic `ContentState`** — the changing data (score, ETA), delivered via `update(_:)` or a push payload.

The widget extension only *renders* what it receives. It cannot fetch network state itself. Every change must arrive through ActivityKit (local `update`) or a push notification.

## When to Use This Skill

- Starting, updating, or ending a Live Activity (delivery, rideshare, sports, workouts, flights)
- Designing the `ActivityAttributes` / `ContentState` split
- Choosing an update mechanism: local, per-activity push, push-to-start, or broadcast
- Hitting the 4KB limit, authorization failures, or "zombie" activities that won't dismiss
- Building Dynamic Island presentations or adding interactivity (App Intents)
- Surfacing a Live Activity on Apple Watch, CarPlay, or the Mac menu bar

For static/timeline widgets and Control Center controls, use `skills/extensions-widgets.md` instead. For APNs auth, payload mechanics, and token management, see `skills/push-notifications.md`/`-ref.md`. For AlarmKit (which renders alarms/timers *as* Live Activities), see `skills/alarmkit-ref.md`.

## System Requirements

| Capability | Minimum |
|------------|---------|
| Live Activities (Lock Screen + Dynamic Island) | iOS 16.1+ |
| `ActivityContent` (`staleDate`, `relevanceScore`) | iOS 16.2+ |
| App Intents interactivity in a Live Activity | iOS 17+ |
| Push-to-start (`pushToStartTokenUpdates`) | iOS 17.2+ |
| Broadcast push channels (`.channel`) | iOS 18+ |
| Frequent updates (`NSSupportsLiveActivitiesFrequentUpdates`) | iOS 18.2+ |
| Apple Watch Smart Stack surfacing | watchOS 11 (paired with iOS 18) |
| AlarmKit-backed alarms/timers | iOS 26+ |

Dynamic Island is hardware-specific (iPhone 14 Pro and later); Live Activities still render on the Lock Screen on every supported device. `NSSupportsLiveActivities` must be `YES` in the app target's Info.plist — without it, nothing starts.

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| `ContentState` uses a custom Codable strategy | Custom `CodingKeys` / encoder strategies serialize on-device but **silently fail to decode** push payloads | Keep `ContentState` on default `Codable` key names |
| `ActivityAttributes` + `ContentState` > 4KB | `Activity.request`/`update` fails (`dataTooLarge`) | Store IDs/references, use asset-catalog images, keep state minimal |
| Activity never dismisses | Activities persist until you call `end(_:dismissalPolicy:)` | Always `end` with an explicit policy when the event completes |
| `dismissed` ≠ gone | A dismissed activity reappears if you send another `update` | Call `end`, not just expect dismissal |
| Widget tries to fetch data | Widget extension can't make arbitrary network calls | Deliver every change via `update` or push |
| `Activity.request` from the background | Requires foreground unless using push-to-start (iOS 17.2+) | Start in foreground, or use push-to-start tokens |

## Authorization and starting

Always check authorization first. `Activity.request` is **throwing, not async**; `update`/`end` are async.

```swift
import ActivityKit

guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

let attributes = PizzaDeliveryAttributes(orderNumber: "12345", pizzaType: "Pepperoni")
let initial = PizzaDeliveryAttributes.ContentState(status: .preparing,
                                                   eta: .now.addingTimeInterval(1800))

let activity = try Activity.request(
    attributes: attributes,
    content: ActivityContent(state: initial, staleDate: nil),
    pushType: nil          // nil = local updates; .token = per-activity push; .channel(id) = broadcast
)
```

See `skills/live-activities-ref.md` for the full `ActivityAttributes`/`ContentState` definition and error catalog.

## Lifecycle

`ActivityState` has five states: `.pending` (scheduled or push-to-started, not yet displayed), `.active`, `.stale` (past its `staleDate`, still visible), `.ended` (finished, still visible until dismissed), `.dismissed` (removed). Observe them with `activity.activityStateUpdates`.

End with an explicit dismissal policy:
- `.immediate` — transient events (timer done, song finished)
- `.default` — most activities (lingers ~4 hours showing the completed state)
- `.after(date)` — a known end time (meeting ends, flight lands)

```swift
await activity.end(ActivityContent(state: finalState, staleDate: nil),
                   dismissalPolicy: .default)
```

Set a `staleDate` so the system shows a stale indicator when your data is too old to trust, and a `relevanceScore` to rank concurrent activities for Dynamic Island/Smart Stack placement.

## Updating — local first, push second

Push-notification entitlement approval takes days. Ship local updates first, add push when approved. This phased path is the difference between shipping on time and blocking a launch on Apple review.

**Phase 1 — local (no entitlement).** Call `await activity.update(_:)` whenever your app has fresh data (foreground, pull-to-refresh). Acceptable for v1.

**Phase 2 — per-activity push (`.token`).** Each activity has a unique push token; send it to your server and push updates to APNs. Right when each viewer needs *different* data (your delivery, your ride).

```swift
for await token in activity.pushTokenUpdates {   // tokens rotate — always use the latest
    await sendToServer(activityID: activity.id, token: token.hexString)
}
```

**Phase 3 — push-to-start (iOS 17.2+).** Start an activity from a push without the app running. Observe the static `pushToStartTokenUpdates` sequence, send that token to your server, and push with `event: "start"`.

```swift
for await token in Activity<PizzaDeliveryAttributes>.pushToStartTokenUpdates {
    await sendStartTokenToServer(token.hexString)
}
```

## Broadcast push channels (iOS 18)

When *many* people watch the *same* event (a game, a flight), don't manage thousands of tokens. Create a **channel** (a base64 channel ID); every activity subscribes; one push to the channel fans out to all subscribers via APNs.

1. Enable the **broadcast** capability in the developer portal (Push Notifications → broadcast toggle).
2. Create a channel — Push Notifications Console (Channels → New Channel) for testing, or your server via the APNs channel-management API in production. Pick a storage policy: **No Storage** (only currently-connected devices; higher publishing budget) or **Most Recent Message** (stores the latest deferred message per device).
3. Subscribe by passing the channel ID as the push type:

```swift
let activity = try Activity.request(
    attributes: attributes,
    content: ActivityContent(state: initial, staleDate: nil),
    pushType: .channel(channelID)   // channelID fetched from your server for this event
)
```

4. Send one broadcast push on the channel; APNs delivers to everyone.

Channel lifecycle is **independent** of the activities — a channel ID stays valid with zero subscribers. The number of active channels is limited, so delete channels you no longer need via the channel-management API (e.g. when the game ends). You cannot *start* an activity via broadcast — push-to-start uses per-app tokens, not channels.

## Frequent updates budget (iOS 18.2+)

Standard push updates are budgeted (~10-12/hour). For genuinely live data (sports, stocks):

- Add `NSSupportsLiveActivitiesFrequentUpdates` = `YES` to Info.plist.
- Check `ActivityAuthorizationInfo().frequentPushesEnabled` before relying on it (users can disable it).
- Use `apns-priority: 10` for immediate, budget-counting delivery; `apns-priority: 5` for low-priority updates that don't count against the budget.

Don't promise "instant" — push latency is ~1-3 seconds and the budget exists to protect battery. Position as "near real-time".

## Interactivity (iOS 17+)

Buttons and toggles inside a Live Activity must use `Button(intent:)` / `Toggle(intent:)` with an `AppIntent` — not closures. The intent's `perform()` updates shared state; the activity re-renders. See `skills/app-intents-ref.md` for the intent definition.

## Other surfaces

- `.supplementalActivityFamilies([.small])` on your `ActivityConfiguration` → Apple Watch Smart Stack (watchOS 11+)
- CarPlay Dashboard (iOS 18+) and the Mac menu bar (macOS Sequoia+) surface a paired iPhone's Live Activity **automatically** — no code or modifier

Adapt layout with `@Environment(\.activityFamily)` and simplify for Always On Display via `@Environment(\.isLuminanceReduced)`.

## Common Mistakes

- Custom `Codable` strategy on `ContentState` — works locally, silently fails to decode pushes.
- Never calling `end(_:dismissalPolicy:)` → activities linger for hours (negative reviews).
- Treating `.dismissed` as terminal — a later `update` revives it; use `end`.
- Embedding image `Data` or unbounded arrays in `ContentState` → blows the 4KB limit.
- Promising "real-time"/"instant" to stakeholders — it's near-real-time with a battery-protecting budget.
- Using broadcast push to *start* an activity — broadcast updates only; use push-to-start tokens.
- Fetching data inside the widget view — deliver it via `update`/push.

## Debugging Checklist

- ☐ `NSSupportsLiveActivities` = `YES` in the app Info.plist
- ☐ `ActivityAuthorizationInfo().areActivitiesEnabled` is `true`
- ☐ `ActivityAttributes` + `ContentState` encode to < 4KB (`try JSONEncoder().encode(...).count`)
- ☐ `ContentState` uses default `Codable` (no custom `CodingKeys`/strategies) so pushes decode
- ☐ `pushType` matches your server integration (`nil`/`.token`/`.channel`)
- ☐ Every `end` specifies a dismissal policy
- ☐ For frequent updates: `NSSupportsLiveActivitiesFrequentUpdates` set and `frequentPushesEnabled` checked
- ☐ Tested on a physical device (push and Dynamic Island don't work in Simulator)

## Resources

**WWDC**: 2023-10184, 2023-10194, 2023-10185, 2024-10069, 2024-10068, 2025-230

**Docs**: /activitykit, /activitykit/activity, /activitykit/activityattributes, /activitykit/activitycontent, /widgetkit/activityconfiguration, /widgetkit/dynamicisland

**Skills**: skills/live-activities-ref.md, skills/extensions-widgets.md (static/timeline widgets, Control Center), skills/push-notifications.md (APNs setup), skills/alarmkit-ref.md (alarms/timers as Live Activities), axiom-watchos (Smart Stack)
