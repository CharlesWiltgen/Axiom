# Controls and Live Activities on Apple Watch

## When to Use This Skill

Use when:
- Building a control (button or toggle) that lands in Control Center, Smart Stack, or the Apple Watch Ultra Action button
- Deciding whether an iPhone-only control is enough or whether the Watch app needs its own `ControlWidget`
- Choosing between `StaticControlConfiguration` and `AppIntentControlConfiguration`
- Surfacing an existing iOS Live Activity on a paired Apple Watch (Dynamic Island → Smart Stack)
- Supporting Double Tap for the primary action on watchOS 11+
- Debugging why a control works in the gallery but doesn't fire on watch

#### Related Skills

- Use `smart-stack-and-complications.md` for widget vs control decision-making and RelevanceKit
- Use `platform-basics.md` for app structure and Info.plist keys
- Use `axiom-integration` for ActivityKit setup on the iOS side and general App Intents patterns
- Use `axiom-accessibility/skills/watchos-a11y.md` for Double Tap accessibility interactions
- Use `watch-connectivity.md` when the control's state needs to sync with a paired iPhone

## Core Principle

**Controls execute actions; widgets display information; Live Activities track bounded events.** watchOS 26 brought the Smart Stack's three-surface unification — pick the right one by primary purpose:

| If the user wants to... | Use |
|---|---|
| Change a setting or toggle a device | Control (`ControlWidgetToggle`) |
| Trigger an action without opening the app | Control (`ControlWidgetButton`) |
| Open the app at a specific screen | Control with `OpenIntent` |
| Glance at info throughout the day | Widget (see `smart-stack-and-complications.md`) |
| Follow an event with start + end (flight, match, timer) | Live Activity |

## Controls on Apple Watch (watchOS 26)

Controls arrived on Apple Watch in watchOS 26. People can place your controls in:

- **Control Center** on the watch
- **Smart Stack** alongside widgets and Live Activities
- **Action button** on Apple Watch Ultra
- **Double Tap** bound to the primary action (watchOS 11+)

### Two ways a control reaches the watch

| Setup | Where action runs | Watch app required |
|---|---|---|
| Control ships in the iPhone app only | iPhone (wakes companion via relay) | **No** — iPhone-side control appears on the watch automatically |
| Control ships in the Watch app | Apple Watch | Yes |

> "People can add the controls from your iPhone app to system spaces on Apple Watch, even if you don't have a Watch app." — Apple, What's new in watchOS 26

> "When the control is tapped on the Apple Watch, the action is performed on the companion iPhone. Since the action is performed on iPhone, controls whose actions foreground the iPhone app will not appear on Apple Watch." — Apple, What's new in watchOS 26

Controls whose intent brings the iPhone app to the foreground — e.g., `OpenIntent` for "Open My App to the Timer screen" — are filtered out of watch placement. Use `OpenIntent` only on iPhone; use an `AppIntent` with no foregrounding on watch-visible controls.

## Anatomy of a Control

Three pieces bolt together:

1. **`ControlWidget`** — your concrete control type, declared in the widget extension
2. **`StaticControlConfiguration` or `AppIntentControlConfiguration`** — the body structure; Static for non-configurable, AppIntent for configurable
3. **`AppIntent` / `OpenIntent` / `SetValueIntent`** — the action that runs when tapped

Add `.displayName(_:)` and `.description(_:)` so the controls gallery shows your control properly.

### Control toggle (on/off with state)

```swift
struct TimerToggle: ControlWidget {
    static let kind: String = "com.example.MyApp.TimerToggle"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(
            kind: Self.kind,
            provider: Provider()
        ) { value in
            ControlWidgetToggle(
                "Productivity Timer",
                isOn: value,
                action: ToggleTimerIntent(),
                valueLabel: { isOn in
                    Label(isOn ? "Running" : "Stopped", systemImage: "timer")
                }
            )
        }
        .displayName("Productivity Timer")
        .description("Start and stop a productivity timer.")
    }
}

extension TimerToggle {
    struct Provider: ControlValueProvider {
        var previewValue: Bool { false }

        func currentValue() async throws -> Bool {
            TimerService.shared.isRunning
        }
    }
}

struct ToggleTimerIntent: SetValueIntent {
    static var title: LocalizedStringResource = "Productivity Timer"

    @Parameter(title: "Timer is running")
    var value: Bool

    func perform() async throws -> some IntentResult {
        TimerService.shared.setRunning(value)
        return .result()
    }
}
```

**`value` is system-managed.** Don't set it manually — the system populates it with the new desired state and your `perform()` mutates the underlying model to match.

### Control button (fire-and-forget)

```swift
struct PerformActionButton: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(
            kind: "com.example.myApp.performActionButton"
        ) {
            ControlWidgetButton(action: PerformAction()) {
                Label("Perform Action", systemImage: "checkmark.circle")
            }
        }
        .displayName("Perform Action")
        .description("An example control that performs an action.")
    }
}

struct PerformAction: AppIntent {
    static let title: LocalizedStringResource = "Perform action"

    func perform() async throws -> some IntentResult {
        MyService.shared.doWork()
        return .result()
    }
}
```

### Configurable control (watchOS 26)

For controls where users pick the target — which timer, which room light, which beach — use `AppIntentControlConfiguration` + `AppIntentControlValueProvider`:

```swift
struct ConfigurableMeditationControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(
            kind: WidgetKinds.configurableMeditationControl,
            provider: Provider()
        ) { value in
            ControlWidgetToggle(
                "Ocean Meditation",
                isOn: value.isActive,
                action: StartMeditationIntent(configuration: value.configuration),
                valueLabel: { _ in Label("Meditate", systemImage: "leaf") }
            )
        }
        .displayName("Ocean Meditation")
        .description("Meditation with optional ocean sounds.")
        .promptsForUserConfiguration()
    }
}

extension ConfigurableMeditationControl {
    struct Provider: AppIntentControlValueProvider {
        func previewValue(configuration: TimerConfiguration) -> Value {
            Value(configuration: configuration, isActive: false)
        }

        func currentValue(configuration: TimerConfiguration) async throws -> Value {
            Value(
                configuration: configuration,
                isActive: MeditationService.shared.isActive(for: configuration)
            )
        }
    }

    struct Value {
        let configuration: TimerConfiguration
        let isActive: Bool
    }
}
```

`.promptsForUserConfiguration()` tells the system to surface configuration when the user adds the control.

## Bundle All Controls in `WidgetBundle`

```swift
@main
struct MyControlsAndWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PerformActionButton()
        TimerToggle()
        ConfigurableMeditationControl()
        MyAppTimelineWidget()
    }
}
```

The order here is the order in the controls gallery — put the most useful first.

## Opening the App from a Control (iPhone-only)

`OpenIntent` brings the app to the foreground:

```swift
struct LaunchAppIntent: OpenIntent {
    static var title: LocalizedStringResource = "Launch App"

    @Parameter(title: "Target")
    var target: LaunchAppEnum
}

enum LaunchAppEnum: String, AppEnum {
    case timer
    case history

    static var typeDisplayRepresentation =
        TypeDisplayRepresentation("Productivity Timer's app screens")
    static var caseDisplayRepresentations = [
        LaunchAppEnum.timer: DisplayRepresentation("Timer"),
        LaunchAppEnum.history: DisplayRepresentation("History")
    ]
}
```

The intent's **Target Membership** must include both the app and the widget extension. If only the extension carries it, the system can't open the app.

**Remember the watch filter.** Controls whose action foregrounds the iPhone app don't appear on the watch — `OpenIntent` is iPhone-only territory.

## Double Tap (watchOS 11+)

Double Tap binds to the **primary action** of the frontmost surface. On a control, that's the intent you wired to `ControlWidgetToggle` or `ControlWidgetButton` — no extra wiring required. On a regular view, use the `handGestureShortcut(.primaryAction)` modifier on the primary button to opt it into Double Tap.

The user can disable Double Tap globally; don't build UI that requires it. Make the primary action tappable as well as Double Tappable.

## Live Activities on Apple Watch

Live Activities are authored once on iOS with ActivityKit + WidgetKit. Apple summarizes the watch hand-off:

> "Live Activities from your iOS app automatically appear at the top of the Smart Stack on a connected Apple Watch." — Apple, developer.apple.com/watchos/

The watch doesn't start its own Live Activities. iPhone creates, updates, and ends; the watch displays. What you control:

- The **Dynamic Island presentations** (compact, minimal, expanded) you author for iOS also drive what surfaces on watch. Test each presentation on a paired device.
- The watch uses the **minimal** presentation by default when multiple Live Activities are active.

### ActivityAttributes structure

One `ActivityAttributes` per activity kind — static data on the outer struct, dynamic data on `ContentState`:

```swift
import ActivityKit

struct OrderAttributes: ActivityAttributes {
    struct ContentState: Codable & Hashable {
        let estimatedArrival: Date
        let driverName: String
        let statusMessage: String
    }

    let orderID: String
    let restaurantName: String
}
```

Declare `NSSupportsLiveActivities = YES` in the iOS app's Info.plist. Add the widget extension with "Include Live Activity" checked at creation.

### ActivityConfiguration — the view layer

```swift
struct OrderLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: OrderAttributes.self) { context in
            // Lock Screen / watch Smart Stack presentation
            OrderLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { /* ... */ }
                DynamicIslandExpandedRegion(.trailing) { /* ... */ }
                DynamicIslandExpandedRegion(.center) { /* ... */ }
                DynamicIslandExpandedRegion(.bottom) { /* ... */ }
            } compactLeading: {
                Image(systemName: "bag")
            } compactTrailing: {
                Text(context.state.estimatedArrival, style: .timer)
            } minimal: {
                Text(context.state.estimatedArrival, style: .relative)
            }
        }
    }
}
```

### Constraints that apply on watch too

| Constraint | Value |
|---|---|
| Maximum active duration | 8 hours (system auto-ends); Lock Screen persists up to 4 more hours (total 12) |
| Max payload (static + dynamic combined) | 4 KB |
| Network / location access from the Live Activity view | None — update via ActivityKit or APNs |
| Image resolution limit | Must be ≤ presentation size; oversize images fail to start the activity |

The 4 KB cap bites fast when using strings like ETA descriptions — keep payloads tight, fetch details from the companion app when needed.

### Updating from a push (APNs)

Live Activities can receive dedicated APNs push tokens. See `Starting and updating Live Activities with ActivityKit push notifications` for the full server payload shape. The shared rule with widgets: APNs pushes propagate to the watch without any Watch Connectivity plumbing.

## Common Mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Using `OpenIntent` on a control you expect to appear on watch | Control missing from the watch controls gallery | Watch-visible controls cannot foreground the iPhone app — use a non-Open `AppIntent` and only surface the `OpenIntent` variant on iPhone |
| Manually setting `value` on a `SetValueIntent` in `perform()` | Control state drifts from system expectation; jitter between taps | Treat `value` as read-only input; mutate your model to match |
| App Intent target membership only on the widget extension | Control appears but intent fails silently | Add the intent file to **both** app and extension target memberships |
| Shipping a Live Activity without testing the minimal presentation | Watch Smart Stack card is illegible or truncated | The watch uses minimal most often — design and test minimal first, not last |
| Live Activity image assets sized for Dynamic Island leading slot (too large for minimal) | Live Activity fails to start | Provide presentation-sized assets; leading-slot image can't exceed the target presentation bounds |
| Relying on network or location access inside a Live Activity view | Views render stale data or crash | Live Activities can't access network/location — update via ActivityKit API or APNs |
| Static + dynamic payload > 4 KB | Update rejected; state frozen | Trim strings and numeric precision; fetch rich data from the app on tap |
| Forgetting `NSSupportsLiveActivities` in Info.plist | `Activity.request(attributes:...)` throws; Live Activities never appear | Add the key (set `YES`) on the iOS app target |
| Assuming Double Tap is always available | Primary action missing for users who disabled Double Tap or own older hardware | Always keep a tappable equivalent; Double Tap is an accelerator, not the only path |
| Putting controls in a separate `WidgetBundle` from the existing widgets | Controls don't appear in gallery | Bundle everything in one `@main WidgetBundle` |

## Resources

**WWDC**: 2025-334, 2024-10157, 2024-10098, 2024-10205, 2023-10027, 2023-10194

**Docs**: /widgetkit/creating-controls-to-perform-actions-across-the-system, /widgetkit/controlwidget, /widgetkit/staticcontrolconfiguration, /widgetkit/appintentcontrolconfiguration, /widgetkit/controlwidgetbutton, /widgetkit/controlwidgettoggle, /widgetkit/controlvalueprovider, /widgetkit/appintentcontrolvalueprovider, /appintents/appintent, /appintents/openintent, /appintents/setvalueintent, /activitykit, /activitykit/activityattributes, /activitykit/activity, /activitykit/activityconfiguration, /activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications

**Skills**: axiom-watchos (platform-basics, smart-stack-and-complications, watch-connectivity), axiom-integration, axiom-accessibility
