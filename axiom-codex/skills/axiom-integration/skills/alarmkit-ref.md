
# AlarmKit Reference

Complete API reference for AlarmKit, Apple's framework for scheduling alarms and countdown timers with system-level alerting, Dynamic Island integration, and focus/silent mode override.

## Overview

AlarmKit lets apps create alarms and timers that behave like the built-in Clock app -- they override Do Not Disturb, appear in the Dynamic Island, and show on the Lock Screen. The framework handles scheduling, snooze, pause/resume, and UI presentation through a small set of types centered on `AlarmManager`.

## System Requirements

- **iOS 26+** (AlarmKit introduced in iOS 26). Not available on macCatalyst.
- **Widget Extension** required for Live Activity / Dynamic Island presentation
- **Physical device** recommended for alarm sound and notification testing

---

## Part 1: Key Components

### AlarmManager

Singleton entry point for all alarm operations.

```swift
import AlarmKit

let manager = AlarmManager.shared
```

All scheduling, cancellation, and observation flows through this shared instance.

### Alarm

Describes an alarm that can alert once or on a repeating schedule. `Schedule`, `CountdownDuration`, and `State` are nested types.

```swift
struct Alarm: Identifiable, Codable, Sendable {
    var id: UUID
    var schedule: Alarm.Schedule?
    var countdownDuration: Alarm.CountdownDuration?
    var state: Alarm.State   // .scheduled | .countdown | .paused | .alerting
}
```

### AlarmButton

Every custom button in an alarm presentation is an `AlarmButton`. There is **no** convenience initializer or static helper (`.stopButton`, `.snoozeButton`, etc. do not exist) -- always supply text, a tint color, and an SF Symbol name.

```swift
struct AlarmButton: Codable, Sendable {
    var text: LocalizedStringResource
    var textColor: Color
    var systemImageName: String

    init(text: LocalizedStringResource, textColor: Color, systemImageName: String)
}

let snooze = AlarmButton(text: "Snooze", textColor: .white, systemImageName: "zzz")
```

### AlarmPresentation

Content for the alarm UI across three states -- alerting, counting down, and paused.

```swift
struct AlarmPresentation {
    var alert: Alert           // Required: shown when alarm fires
    var countdown: Countdown?  // Optional: shown during countdown
    var paused: Paused?        // Optional: shown when paused
}
```

### AlarmAttributes

Generic container pairing presentation with app-specific metadata and tint color. Used to configure the Live Activity widget. Its `ContentState` is `AlarmPresentationState`.

```swift
struct AlarmAttributes<Metadata: AlarmMetadata>: ActivityAttributes {
    var presentation: AlarmPresentation
    var metadata: Metadata?   // Optional
    var tintColor: Color

    init(presentation: AlarmPresentation, metadata: Metadata? = nil, tintColor: Color)
}
```

### AlarmMetadata

Protocol for app-specific data attached to an alarm. Conform an empty struct for minimal usage, or add properties for richer UI. Requires `Codable`, `Hashable`, `Sendable`.

```swift
struct RecipeMetadata: AlarmMetadata {
    let recipeName: String
    let cookingStep: String
}
```

---

## Part 2: Authorization

Apps must request permission before scheduling alarms. Add `NSAlarmKitUsageDescription` to Info.plist.

### Requesting Authorization

`requestAuthorization()` is `async throws` and returns the resulting state.

```swift
func requestAlarmAuthorization() async -> Bool {
    do {
        let state = try await AlarmManager.shared.requestAuthorization()
        return state == .authorized
    } catch {
        print("Authorization error: \(error)")
        return false
    }
}
```

### Checking Current State

`authorizationState` is a **synchronous** property -- read it directly, no `await`:

```swift
let state = AlarmManager.shared.authorizationState
// .notDetermined | .denied | .authorized
```

### Observing Authorization Changes

```swift
for await authState in AlarmManager.shared.authorizationUpdates {
    switch authState {
    case .authorized: enableAlarmUI()
    case .denied:     showPermissionPrompt()
    case .notDetermined: break
    @unknown default: break
    }
}
```

---

## Part 3: Scheduling Alarms

Every alarm requires a `UUID`, an `AlarmManager.AlarmConfiguration`, and a call to `schedule(id:configuration:)` (which is `async throws` and returns the scheduled `Alarm`).

Build the configuration with the `.alarm(...)` / `.timer(...)` factory methods, or the full `AlarmConfiguration(...)` initializer when you need both a schedule and a countdown (for snooze).

### One-Time Alarm

The system supplies the stop button automatically; you only configure the title and any secondary action. (The `stopButton` parameter was deprecated in iOS 26.1 and is no longer used.)

```swift
let id = UUID()
let time = Alarm.Schedule.Relative.Time(hour: 7, minute: 30)
let schedule = Alarm.Schedule.relative(.init(time: time, repeats: .never))

let alert = AlarmPresentation.Alert(
    title: "Wake Up",
    secondaryButton: AlarmButton(text: "Snooze", textColor: .white, systemImageName: "zzz"),
    secondaryButtonBehavior: .countdown
)

struct EmptyMetadata: AlarmMetadata {}
let attributes = AlarmAttributes(
    presentation: AlarmPresentation(alert: alert),
    metadata: EmptyMetadata(),
    tintColor: .blue
)

let config = AlarmManager.AlarmConfiguration.alarm(
    schedule: schedule,
    attributes: attributes,
    sound: .default
)

let alarm = try await AlarmManager.shared.schedule(id: id, configuration: config)
```

### Fixed-Date Alarm

Use `.fixed(Date)` for an absolute one-shot alarm:

```swift
let schedule = Alarm.Schedule.fixed(Date.now.addingTimeInterval(3600))
```

### Repeating Alarm

Use `.weekly([Locale.Weekday])` for specific days:

```swift
let time = Alarm.Schedule.Relative.Time(hour: 6, minute: 0)
let schedule = Alarm.Schedule.relative(.init(
    time: time,
    repeats: .weekly([.monday, .tuesday, .wednesday, .thursday, .friday])
))
```

### Countdown Timer

Use the `.timer(duration:attributes:...)` factory for a countdown:

```swift
let config = AlarmManager.AlarmConfiguration.timer(
    duration: 300,  // 5 minutes
    attributes: attributes,
    sound: .default
)
```

For finer control (e.g. a post-alert window), use the full initializer with an `Alarm.CountdownDuration`:

```swift
let countdown = Alarm.CountdownDuration(
    preAlert: 300,  // 5 minutes until it fires
    postAlert: 10   // post-alert window (e.g. snooze)
)

let config = AlarmManager.AlarmConfiguration(
    countdownDuration: countdown,
    schedule: nil,
    attributes: attributes,
    sound: .default
)
```

Timers support pause/resume and show a countdown presentation when `AlarmPresentation.countdown` is provided.

### Snooze Configuration

Snooze uses `CountdownDuration.postAlert` combined with a secondary action whose behavior is `.countdown`. Because snooze pairs a schedule with a countdown, use the full initializer:

```swift
let alert = AlarmPresentation.Alert(
    title: "Alarm",
    secondaryButton: AlarmButton(text: "Snooze", textColor: .white, systemImageName: "zzz"),
    secondaryButtonBehavior: .countdown  // Starts the post-alert countdown
)

let config = AlarmManager.AlarmConfiguration(
    countdownDuration: Alarm.CountdownDuration(preAlert: nil, postAlert: 9 * 60),
    schedule: schedule,
    attributes: AlarmAttributes(
        presentation: AlarmPresentation(alert: alert),
        metadata: EmptyMetadata(),
        tintColor: .blue
    ),
    sound: .default
)
```

### Custom Stop / Secondary Actions

To run your own code when the user stops or taps the secondary button, pass a `LiveActivityIntent` as `stopIntent` or `secondaryIntent`. A `.custom` secondary behavior fires `secondaryIntent` (for example, to open your app):

```swift
let config = AlarmManager.AlarmConfiguration.alarm(
    schedule: schedule,
    attributes: attributes,
    stopIntent: StopWorkoutIntent(),        // any LiveActivityIntent
    secondaryIntent: OpenWorkoutIntent(),   // fired when secondaryButtonBehavior == .custom
    sound: .default
)
```

---

## Part 4: Customizing Alarm UI

### Alert Presentation

The alert state is shown when the alarm fires. The system provides the stop button; the secondary button is optional.

```swift
// Minimal -- system-provided stop button only
let basic = AlarmPresentation.Alert(title: "Alarm")

// With a custom secondary action
let custom = AlarmPresentation.Alert(
    title: "Medication Reminder",
    secondaryButton: AlarmButton(text: "Remind Later", textColor: .white, systemImageName: "clock"),
    secondaryButtonBehavior: .countdown
)

// Secondary action that runs a custom intent (e.g. open the app)
let openApp = AlarmPresentation.Alert(
    title: "Workout Time",
    secondaryButton: AlarmButton(text: "Open", textColor: .white, systemImageName: "figure.run"),
    secondaryButtonBehavior: .custom  // Pair with a secondaryIntent in the configuration
)
```

### Countdown Presentation

Shown while a timer counts down. Only relevant for alarms with a countdown. `pauseButton` is optional.

```swift
let countdown = AlarmPresentation.Countdown(
    title: "Timer Running",
    pauseButton: AlarmButton(text: "Pause", textColor: .white, systemImageName: "pause.fill")
)
```

### Paused Presentation

Shown when a countdown timer is paused. `resumeButton` is required.

```swift
let paused = AlarmPresentation.Paused(
    title: "Timer Paused",
    resumeButton: AlarmButton(text: "Resume", textColor: .white, systemImageName: "play.fill")
)
```

### Full Three-State Presentation

Combine all three for a complete timer experience:

```swift
let presentation = AlarmPresentation(
    alert: AlarmPresentation.Alert(
        title: "Timer Complete",
        secondaryButton: AlarmButton(text: "Repeat", textColor: .white, systemImageName: "repeat"),
        secondaryButtonBehavior: .countdown
    ),
    countdown: AlarmPresentation.Countdown(
        title: "Cooking Timer",
        pauseButton: AlarmButton(text: "Pause", textColor: .white, systemImageName: "pause.fill")
    ),
    paused: AlarmPresentation.Paused(
        title: "Timer Paused",
        resumeButton: AlarmButton(text: "Resume", textColor: .white, systemImageName: "play.fill")
    )
)
```

---

## Part 5: Managing Alarms

### Retrieve All Alarms

`alarms` is a throwing property (no `await`):

```swift
let alarms = try AlarmManager.shared.alarms
```

### Countdown / Pause / Resume / Stop / Cancel

These mutating operations are **synchronous** `throws` functions -- do not call them with `await`:

```swift
try AlarmManager.shared.countdown(id: alarmID)  // Start the countdown
try AlarmManager.shared.pause(id: alarmID)
try AlarmManager.shared.resume(id: alarmID)
try AlarmManager.shared.stop(id: alarmID)       // Stop a ringing alarm
try AlarmManager.shared.cancel(id: alarmID)     // Remove the alarm entirely
```

### Handling the Alarm Limit

Scheduling can throw `AlarmManager.AlarmError.maximumLimitReached` when the app exceeds the system cap:

```swift
do {
    _ = try await AlarmManager.shared.schedule(id: id, configuration: config)
} catch AlarmManager.AlarmError.maximumLimitReached {
    showTooManyAlarmsMessage()
}
```

### Observe Alarm Updates

Use `alarmUpdates` to keep UI in sync. An alarm absent from the emitted array is no longer scheduled.

```swift
for await alarms in AlarmManager.shared.alarmUpdates {
    self.alarms = alarms
}
```

---

## Part 6: Live Activity Integration

AlarmKit alarms appear in the Dynamic Island and Lock Screen through `ActivityConfiguration`. Add a Widget Extension target and implement the widget using `AlarmAttributes`.

The content state is `AlarmPresentationState`, whose `mode` is an enum with associated values -- pattern-match it with `if case`. Countdown details (including `fireDate`) live on `mode`'s `.countdown` payload; there is no `countdownEndDate` property. `Text(timerInterval:countsDown:)` takes a `ClosedRange<Date>`.

```swift
struct AlarmWidgetView: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<YourMetadata>.self) { context in
            // Lock Screen presentation
            VStack {
                Text(context.attributes.presentation.alert.title)
                if case .countdown(let countdown) = context.state.mode {
                    Text(timerInterval: countdown.startDate...countdown.fireDate, countsDown: true)
                        .bold()
                }
            }
            .padding()
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.attributes.presentation.alert.title)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if case .countdown(let countdown) = context.state.mode {
                        Text(timerInterval: countdown.startDate...countdown.fireDate, countsDown: true)
                    }
                }
            } compactLeading: {
                Image(systemName: "alarm")
            } compactTrailing: {
                if case .countdown(let countdown) = context.state.mode {
                    Text(timerInterval: countdown.startDate...countdown.fireDate, countsDown: true)
                }
            } minimal: {
                Image(systemName: "alarm")
            }
        }
    }
}
```

---

## Part 7: SwiftUI Integration

### ViewModel Pattern with @Observable

```swift
import AlarmKit

@Observable
class AlarmViewModel {
    var alarms: [Alarm] = []
    private let manager = AlarmManager.shared

    func requestAuthorization() {
        Task {
            _ = try? await manager.requestAuthorization()
        }
    }

    func loadAndObserve() {
        Task {
            alarms = (try? manager.alarms) ?? []
            for await updated in manager.alarmUpdates {
                alarms = updated
            }
        }
    }

    func addAlarm(hour: Int, minute: Int, weekdays: Set<Locale.Weekday>) {
        Task {
            let time = Alarm.Schedule.Relative.Time(hour: hour, minute: minute)
            let schedule = Alarm.Schedule.relative(.init(
                time: time,
                repeats: weekdays.isEmpty ? .never : .weekly(Array(weekdays))
            ))

            let alert = AlarmPresentation.Alert(
                title: "Alarm",
                secondaryButton: AlarmButton(text: "Snooze", textColor: .white, systemImageName: "zzz"),
                secondaryButtonBehavior: .countdown
            )

            struct EmptyMetadata: AlarmMetadata {}
            let config = AlarmManager.AlarmConfiguration(
                countdownDuration: Alarm.CountdownDuration(preAlert: nil, postAlert: 9 * 60),
                schedule: schedule,
                attributes: AlarmAttributes(
                    presentation: AlarmPresentation(alert: alert),
                    metadata: EmptyMetadata(),
                    tintColor: .blue
                ),
                sound: .default
            )

            _ = try? await manager.schedule(id: UUID(), configuration: config)
        }
    }

    func cancel(id: UUID) {
        try? manager.cancel(id: id)   // synchronous
    }

    func togglePause(id: UUID, isPaused: Bool) {
        if isPaused {
            try? manager.resume(id: id)
        } else {
            try? manager.pause(id: id)
        }
    }
}
```

### Alarm List View

```swift
struct AlarmListView: View {
    @State private var viewModel = AlarmViewModel()

    var body: some View {
        NavigationStack {
            List(viewModel.alarms, id: \.id) { alarm in
                AlarmRow(alarm: alarm, viewModel: viewModel)
            }
            .navigationTitle("Alarms")
            .onAppear {
                viewModel.requestAuthorization()
                viewModel.loadAndObserve()
            }
        }
    }
}
```

---

## Part 8: Best Practices

| Practice | Detail |
|----------|--------|
| Request authorization early | On first launch or first alarm creation attempt |
| Handle denial gracefully | Guide users to Settings if permission was denied |
| Persist alarm UUIDs | Store IDs to manage alarms across app launches |
| Implement widget extension | Required for countdown/Dynamic Island presentation |
| Use `alarmUpdates` | Keep UI in sync; don't poll or cache stale state |
| Test on physical device | Alarm sounds, notifications, and Live Activities require real hardware |
| Handle `maximumLimitReached` | Scheduling throws when the app's alarm cap is exceeded |
| Don't supply a `stopButton` | Deprecated in iOS 26.1; the system provides stop. Use `stopIntent` for custom stop logic |
| `authorizationState` is synchronous | Read it directly; only `requestAuthorization()` is `async` |

---

## Resources

**WWDC**: 2025-230

**Docs**: /alarmkit, /alarmkit/alarmmanager, /alarmkit/alarm, /alarmkit/alarmpresentation, /alarmkit/alarmattributes

**Skills**: skills/live-activities-ref.md (AlarmKit renders as a Live Activity), skills/extensions-widgets-ref.md, axiom-swiftui
