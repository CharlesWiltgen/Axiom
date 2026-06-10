
# Live Activities (ActivityKit) — API Reference

Comprehensive API reference for ActivityKit Live Activities, Dynamic Island, push/broadcast updates, and cross-device surfaces. For the discipline (gotchas, decision-making, debugging), see `skills/live-activities.md`.

## Key Terminology

- **ActivityAttributes** — Protocol your type adopts. Holds static data + a nested `ContentState`.
- **ContentState** — `Codable & Hashable` struct of dynamic data; the part that changes. Must keep total payload under 4KB.
- **ActivityContent** — Wrapper around a `ContentState` value plus `staleDate` and `relevanceScore`.
- **Activity** — Runtime handle returned by `Activity.request`.
- **ActivityState** — `.pending`, `.active`, `.stale`, `.ended`, `.dismissed`.
- **Dynamic Island** — iPhone 14 Pro+ presentation with compact, minimal, and expanded layouts.
- **Push type** — `nil` (local), `.token` (per-activity push), `.channel(String)` (broadcast, iOS 18+).
- **Channel** — APNs broadcast target; one push reaches all subscribed activities.

---

# Part 1: Defining a Live Activity

```swift
import ActivityKit

struct PizzaDeliveryAttributes: ActivityAttributes {
    // Dynamic data — updated throughout the lifecycle. Default Codable only.
    struct ContentState: Codable, Hashable {
        var status: DeliveryStatus
        var eta: Date
        var driverName: String?
    }
    // Static data — set once at start, never changes
    var orderNumber: String
    var pizzaType: String
}
```

Total encoded size of `ActivityAttributes` + `ContentState` must stay under **4KB**. Store IDs and asset-catalog image names, not `Data` blobs.

---

# Part 2: Authorization, Start, Update, End

```swift
// Authorization (synchronous property)
let info = ActivityAuthorizationInfo()
guard info.areActivitiesEnabled else { return }

// Start — throwing, NOT async
let activity = try Activity.request(
    attributes: PizzaDeliveryAttributes(orderNumber: "12345", pizzaType: "Pepperoni"),
    content: ActivityContent(state: initialState, staleDate: nil),
    pushType: nil
)

// Update — async
await activity.update(
    ActivityContent(state: newState, staleDate: .now.addingTimeInterval(60), relevanceScore: 100.0)
)

// Update with an alert banner
await activity.update(newContent, alertConfiguration: AlertConfiguration(
    title: "Pizza is here!", body: "Your pizza has arrived", sound: .default))

// End — async, with dismissal policy
await activity.end(ActivityContent(state: finalState, staleDate: nil), dismissalPolicy: .default)
```

## Finding active activities

```swift
for activity in Activity<PizzaDeliveryAttributes>.activities {
    // restore handles after relaunch
}
```

## Dismissal policies

- `.immediate` — remove now
- `.default` — linger ~4 hours showing the final state
- `.after(Date)` — remove at a specific time

## Errors from `Activity.request`

- `ActivityAuthorizationError` — Live Activities disabled or denied
- `ActivityContent`/attributes too large — exceeds the 4KB limit
- Too many activities — system concurrent limit reached (typically 2-3)

Always guard on `areActivitiesEnabled` and wrap `request` in `do/catch`.

---

# Part 3: Async observation sequences

```swift
// Content updates
for await content in activity.contentUpdates { /* content.state */ }

// State transitions
for await state in activity.activityStateUpdates {
    if state == .ended || state == .dismissed { /* clean up stored id */ }
}

// Per-activity push token (rotates — always use the latest)
for await token in activity.pushTokenUpdates {
    await send(token.map { String(format: "%02x", $0) }.joined())
}

// Push-to-start token (static, iOS 17.2+)
for await token in Activity<PizzaDeliveryAttributes>.pushToStartTokenUpdates {
    await sendStartToken(token.map { String(format: "%02x", $0) }.joined())
}
```

---

# Part 4: ActivityConfiguration (widget extension)

Declared in the widget extension's `@main` bundle. Provides the Lock Screen view and the Dynamic Island.

```swift
struct PizzaLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PizzaDeliveryAttributes.self) { context in
            // Lock Screen / banner presentation
            PizzaLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: "bicycle") }
                DynamicIslandExpandedRegion(.trailing) { Text(context.state.eta, style: .timer) }
                DynamicIslandExpandedRegion(.center) { Text(context.state.driverName ?? "") }
                DynamicIslandExpandedRegion(.bottom) {
                    Button(intent: CancelOrderIntent()) { Label("Cancel", systemImage: "xmark") }
                }
            } compactLeading: {
                Image(systemName: "bicycle")
            } compactTrailing: {
                Text(context.state.eta, style: .timer).frame(width: 40)
            } minimal: {
                Image(systemName: "bicycle").foregroundStyle(.tint)
            }
        }
        .supplementalActivityFamilies([.small])   // Apple Watch Smart Stack (watchOS 11+)
    }
}
```

`ActivityViewContext` exposes `attributes`, `state`, `isStale`, and `relevanceScore` to your views.

---

# Part 5: Dynamic Island layout

Four regions:

| Region | Shown when |
|--------|-----------|
| `compactLeading` / `compactTrailing` | Activity is foregrounded (compact form) |
| `expanded` (via `DynamicIslandExpandedRegion`) | User long-presses the island |
| `minimal` | Two+ concurrent activities from different apps |

Expanded sub-regions: `.leading`, `.trailing`, `.center`, `.bottom`. Modifiers on `DynamicIsland`: `keylineTint(_:)`, `contentMargins(_:_:for:)`, `widgetURL(_:)`.

Design (WWDC 2023-10194): nest content concentrically inside the rounded shape (`Circle()` / `RoundedRectangle`, never sharp `Rectangle()`); use elastic springs (`.spring(response: 0.6, dampingFraction: 0.7)`), not linear animations.

**Adapt to a narrow island — `\.isDynamicIslandLimitedInWidth` (`iOS27`)** A `Bool` `EnvironmentValue` (iPhone-only) that is `true` when the Dynamic Island renders with limited horizontal space — it applies to the `compactLeading`, `compactTrailing`, and `minimal` views (e.g. when another app's activity shares the island). Read it and trim content/spacing instead of letting the compact view clip:

```swift
struct CompactTrailing: View {
    @Environment(\.isDynamicIslandLimitedInWidth) private var isNarrow
    var body: some View {
        Text(eta).font(isNarrow ? .caption2 : .caption)
    }
}
```

---

# Part 6: Push update payloads

Per-activity and broadcast updates use the same payload shape. Required APNs headers:

- `apns-push-type: liveactivity`
- `apns-topic: <bundleID>.push-type.liveactivity`
- `apns-priority: 10` (immediate, counts against budget) or `5` (low priority, budget-exempt)

```json
{
  "aps": {
    "timestamp": 1633046400,
    "event": "update",
    "content-state": { "status": "onTheWay", "eta": 1633046700 },
    "stale-date": 1633046800,
    "relevance-score": 100,
    "dismissal-date": 1633050000,
    "alert": { "title": "On the way", "body": "Your driver is nearby" }
  }
}
```

`event` is `"update"`, `"end"`, or `"start"` (push-to-start). For push-to-start, include `attributes-type`, `attributes`, and `input-push-token: 1`.

---

# Part 7: Broadcast push channels (iOS 18+)

Reach a large audience watching one event with a single push.

1. Enable the **broadcast** capability (developer portal → Push Notifications).
2. Create a channel (Push Notifications Console for testing, or APNs channel-management API in production). Choose a storage policy:
   - **No Storage** — delivered only to currently-connected devices; higher publishing budget.
   - **Most Recent Message** — stores the latest deferred message per device.
   The channel ID is base64, randomly generated per channel.
3. Subscribe by starting the activity with `pushType: .channel(channelID)`.
4. Send one broadcast push to the channel; APNs fans out to all subscribers. Broadcast pushes route via the `apns-channel-id: <channelID>` header (with `apns-push-type: liveactivity`) instead of a per-device token.

Channel lifecycle is independent of activities — a channel ID stays valid with zero subscribers. Active channels are limited; delete unused ones via the channel-management API. Broadcast cannot **start** activities (updates only); use push-to-start tokens for that. Production servers send both channel-management and broadcast requests directly to APNs using the same cert/token auth as standard APNs.

---

# Part 8: Frequent updates (iOS 18.2+)

- Info.plist: `NSSupportsLiveActivitiesFrequentUpdates` = `YES`
- Runtime gate: `ActivityAuthorizationInfo().frequentPushesEnabled` (user-toggleable)
- Use `apns-priority: 5` for high-volume, non-urgent updates to stay within budget; `10` for urgent.

---

# Part 9: Cross-device surfaces

## Apple Watch (watchOS 11+)

`.supplementalActivityFamilies([.small])` on `ActivityConfiguration` surfaces the activity in the Smart Stack. Adapt with `@Environment(\.activityFamily)` (`.small` vs iPhone). Simplify for Always On Display via `@Environment(\.isLuminanceReduced)`. Watch updates sync from iPhone via push; they may lag if the watch is out of Bluetooth range.

## CarPlay and Mac menu bar (automatic)

CarPlay Dashboard (iOS 18+) and the macOS Sequoia+ menu bar surface a paired iPhone's Live Activity automatically — no modifier or code.

---

# Part 10: AlarmKit (iOS 26+)

AlarmKit renders alarms/timers *as* Live Activities. `AlarmPresentation` customizes the alert/countdown/paused appearances; `AlarmManager` schedules alarms with `LiveActivityIntent` parameters for stop/secondary actions; `AlarmPresentationState` feeds countdown progress back to the view. See `skills/alarmkit-ref.md`.

---

## Resources

**WWDC**: 2023-10184, 2023-10194, 2023-10185, 2024-10069, 2024-10068, 2025-230, 2026-223

**Docs**: /activitykit, /activitykit/activity, /activitykit/activityattributes, /activitykit/activitycontent, /activitykit/activityauthorizationinfo, /widgetkit/activityconfiguration, /widgetkit/dynamicisland, /swiftui/environmentvalues/isdynamicislandlimitedinwidth

**Skills**: skills/live-activities.md, skills/extensions-widgets-ref.md (static/timeline widgets, Control Center), skills/push-notifications-ref.md (APNs payloads), skills/alarmkit-ref.md
