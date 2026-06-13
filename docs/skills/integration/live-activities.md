---
name: live-activities
description: ActivityKit Live Activities, Dynamic Island, and push/broadcast updates with correct lifecycle and 4KB-limit patterns
skill_type: skill
version: 1.0
apple_platforms: iOS 16.1+ (push-to-start & broadcast iOS 18+, Smart Stack watchOS 11)
---

# Live Activities

Live Activities show glanceable, persistent, current-state information about an ongoing event on the Lock Screen, in the Dynamic Island, in StandBy, and (with one modifier) on Apple Watch Smart Stack, CarPlay, and the Mac menu bar. They render in a widget extension but the lifecycle is driven by **ActivityKit** from your app and your server.

Two skills in the **axiom-integration** suite: `skills/live-activities.md` (discipline) and `skills/live-activities-ref.md` (API reference).

## When to Use

Use this skill when you're:
- Starting, updating, or ending a Live Activity (delivery, rideshare, sports, flights, workouts)
- Designing the `ActivityAttributes` / `ContentState` split, or hitting the 4KB limit
- Choosing an update mechanism: local, per-activity push, push-to-start, or broadcast
- Building Dynamic Island presentations or adding interactivity with App Intents
- Fixing "zombie" activities that won't dismiss, or authorization failures
- Surfacing a Live Activity on Apple Watch, CarPlay, or the Mac menu bar

For static/timeline widgets and Control Center controls, see [extensions-widgets](/skills/integration/extensions-widgets). For APNs setup, see [push-notifications](/skills/integration/push-notifications).

## Example Prompts

- "How do I start and update a Live Activity?"
- "Why won't my Live Activity dismiss after the event ends?"
- "How do I build a Dynamic Island layout?"
- "How do I broadcast score updates to thousands of Live Activities with one push?"
- "How do I start a Live Activity from a push when my app isn't running?"
- "My Live Activity push updates aren't showing up — what's wrong?"

## Key Concepts

### The app/widget split

`ActivityAttributes` holds static data (set once at start); its nested `ContentState` holds the dynamic data that changes via `update(_:)` or a push. The widget extension only renders what it receives — it cannot fetch network state.

### Lifecycle and dismissal

`ActivityState` is `.pending`, `.active`, `.stale`, `.ended`, or `.dismissed`. Always `end(_:dismissalPolicy:)` when the event finishes (`.immediate`, `.default` ~4 hours, or `.after(date)`) — activities linger until you do.

### `Activity.request` is throwing, not async

```swift
guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
let activity = try Activity.request(attributes: attrs,
                                    content: ActivityContent(state: initial, staleDate: nil),
                                    pushType: nil)   // nil / .token / .channel(id)
await activity.update(ActivityContent(state: newState, staleDate: nil))
await activity.end(ActivityContent(state: final, staleDate: nil), dismissalPolicy: .default)
```

### Updates: local → push → broadcast

Ship local `update(_:)` first (no entitlement), add per-activity `.token` push when approved, use push-to-start to launch from a push (iOS 18), and broadcast `.channel(id)` when one event has a large audience (iOS 18).

### Keep `ContentState` on default Codable

Custom `CodingKeys`/encoder strategies serialize on-device but **silently fail to decode push payloads**.

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| Custom Codable strategy on `ContentState` | Pushes silently fail to decode | Use default `Codable` keys |
| Never calling `end(_:dismissalPolicy:)` | Activities linger for hours | End with an explicit policy |
| Treating `.dismissed` as terminal | A later `update` revives it | Call `end` |
| Image `Data` in `ContentState` | Blows the 4KB limit | Store IDs / asset-catalog names |
| Broadcast push to *start* an activity | Doesn't work | Use push-to-start tokens |

## Related

- [extensions-widgets](/skills/integration/extensions-widgets) – Static/timeline widgets and Control Center controls (shares the widget extension)
- [push-notifications](/skills/integration/push-notifications) – APNs auth and payload mechanics for push/broadcast updates
- [controls-and-live-activities](/skills/watchos/controls-and-live-activities) – The Apple Watch side of Live Activities

## Resources

**WWDC**: 2023-10184, 2023-10194, 2023-10185, 2024-10069, 2024-10068, 2025-230

**Docs**: /activitykit, /activitykit/activity, /widgetkit/activityconfiguration, /widgetkit/dynamicisland
