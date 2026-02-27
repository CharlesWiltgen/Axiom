---
name: axiom-alarmkit-ref
description: Use when implementing alarm functionality, scheduling wake alarms, or integrating AlarmKit with Live Activities. Covers AlarmKit authorization, alarm configuration, SwiftUI views, and Live Activity integration.
license: MIT
---

# AlarmKit Reference

Complete API reference for AlarmKit, Apple's framework for scheduling alarms and countdown timers with system-level alerting, Dynamic Island integration, and focus/silent mode override.

## Overview

AlarmKit lets apps create alarms and timers that behave like the built-in Clock app -- they override Do Not Disturb, appear in the Dynamic Island, and show on the Lock Screen. The framework handles scheduling, snooze, pause/resume, and UI presentation through a small set of types centered on `AlarmManager`.

## System Requirements

- **iOS 26+** (AlarmKit introduced in iOS 26)
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

Describes an alarm that can alert once or on a repeating schedule.

```swift
struct Alarm {
    var id: UUID
    var schedule: Schedule?
    var countdownDuration: CountdownDuration?
    var state: AlarmState
}
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

Generic container pairing presentation with app-specific metadata and tint color. Used to configure the Live Activity widget.

```swift
struct AlarmAttributes<Metadata: AlarmMetadata> {
    var presentation: AlarmPresentation
    var metadata: Metadata
    var tintColor: Color
}
```

### AlarmMetadata

Protocol for app-specific data attached to an alarm. Conform an empty struct for minimal usage, or add properties for richer UI.

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

Use `authorizationState` (not `authorizationStatus`) to read the current value:

```swift
let state = await AlarmManager.shared.authorizationState
// .authorized | .denied | .notDetermined
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

Every alarm requires a `UUID`, an `AlarmManager.AlarmConfiguration`, and a call to `schedule(id:configuration:)`.

### One-Time Alarm

```swift
let id = UUID()
let time = Alarm.Schedule.Relative.Time(hour: 7, minute: 30)
let schedule = Alarm.Schedule.relative(.init(
    time: time,
    repeats: .never
))

let alert = AlarmPresentation.Alert(
    title: "Wake Up",
    stopButton: .stopButton,
    secondaryButton: .snoozeButton,
    secondaryButtonBehavior: .countdown
)

struct EmptyMetadata: AlarmMetadata {}
let config = AlarmManager.AlarmConfiguration(
    countdownDuration: nil,
    schedule: schedule,
    attributes: AlarmAttributes(
        presentation: AlarmPresentation(alert: alert),
        metadata: EmptyMetadata(),
        tintColor: .blue
    ),
    sound: .default
)

let alarm = try await AlarmManager.shared.schedule(id: id, configuration: config)
```

### Repeating Alarm

Use `.weekly(Array(weekdays))` for specific days:

```swift
let time = Alarm.Schedule.Relative.Time(hour: 6, minute: 0)
let schedule = Alarm.Schedule.relative(.init(
    time: time,
    repeats: .weekly([.monday, .tuesday, .wednesday, .thursday, .friday])
))
```

### Countdown Timer

Set `schedule: nil` and provide `countdownDuration` with a `preAlert` interval:

```swift
let countdown = Alarm.CountdownDuration(
    preAlert: 300,  // 5 minutes
    postAlert: 10   // Optional post-alert snooze window
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

Snooze uses `CountdownDuration.postAlert` combined with a `.snoozeButton` secondary action:

```swift
let alert = AlarmPresentation.Alert(
    title: "Alarm",
    stopButton: .stopButton,
    secondaryButton: .snoozeButton,
    secondaryButtonBehavior: .countdown  // Starts post-alert countdown
)

let countdownDuration = Alarm.CountdownDuration(
    preAlert: nil,
    postAlert: 9 * 60  // 9-minute snooze
)
```

---

## Part 4: Customizing Alarm UI

### Alert Presentation

The alert state is shown when the alarm fires. The stop button is required; secondary button is optional.

```swift
// Minimal
let basic = AlarmPresentation.Alert(
    title: "Alarm",
    stopButton: .stopButton
)

// With custom button labels
let custom = AlarmPresentation.Alert(
    title: "Medication Reminder",
    stopButton: AlarmButton(label: "Taken"),
    secondaryButton: AlarmButton(label: "Remind Later"),
    secondaryButtonBehavior: .countdown
)

// With open-app action
let openApp = AlarmPresentation.Alert(
    title: "Workout Time",
    stopButton: .stopButton,
    secondaryButton: .openAppButton,
    secondaryButtonBehavior: .custom
)
```

### Countdown Presentation

Shown while a timer counts down. Only relevant for alarms with `countdownDuration.preAlert`.

```swift
let countdown = AlarmPresentation.Countdown(
    title: "Timer Running",
    pauseButton: .pauseButton
)
```

### Paused Presentation

Shown when a countdown timer is paused.

```swift
let paused = AlarmPresentation.Paused(
    title: "Timer Paused",
    resumeButton: .resumeButton
)
```

### Full Three-State Presentation

Combine all three for a complete timer experience:

```swift
let presentation = AlarmPresentation(
    alert: AlarmPresentation.Alert(
        title: "Timer Complete",
        stopButton: .stopButton,
        secondaryButton: .repeatButton,
        secondaryButtonBehavior: .countdown
    ),
    countdown: AlarmPresentation.Countdown(
        title: "Cooking Timer",
        pauseButton: .pauseButton
    ),
    paused: AlarmPresentation.Paused(
        title: "Timer Paused",
        resumeButton: .resumeButton
    )
)
```

---

## Part 5: Managing Alarms

### Retrieve All Alarms

```swift
let alarms = try AlarmManager.shared.alarms
```

### Pause / Resume

```swift
try await AlarmManager.shared.pause(id: alarmID)
try await AlarmManager.shared.resume(id: alarmID)
```

### Cancel

```swift
try await AlarmManager.shared.cancel(id: alarmID)
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

```swift
struct AlarmWidgetView: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<YourMetadata>.self) { context in
            // Lock Screen presentation
            VStack {
                Text(context.attributes.presentation.alert.title)
                if context.state.mode == .countdown {
                    Text(
                        timerInterval: context.state.countdownEndDate
                            .timeIntervalSinceNow,
                        countsDown: true
                    )
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
                    if context.state.mode == .countdown {
                        Text(
                            timerInterval: context.state.countdownEndDate
                                .timeIntervalSinceNow,
                            countsDown: true
                        )
                    }
                }
            } compactLeading: {
                Image(systemName: "alarm")
            } compactTrailing: {
                if context.state.mode == .countdown {
                    Text(
                        timerInterval: context.state.countdownEndDate
                            .timeIntervalSinceNow,
                        countsDown: true
                    )
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
                stopButton: .stopButton,
                secondaryButton: .snoozeButton,
                secondaryButtonBehavior: .countdown
            )

            struct EmptyMetadata: AlarmMetadata {}
            let config = AlarmManager.AlarmConfiguration(
                countdownDuration: Alarm.CountdownDuration(
                    preAlert: nil, postAlert: 9 * 60
                ),
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
        Task { try? await manager.cancel(id: id) }
    }

    func togglePause(id: UUID, isPaused: Bool) {
        Task {
            if isPaused {
                try? await manager.resume(id: id)
            } else {
                try? await manager.pause(id: id)
            }
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
| Respect system limits | There is a system-imposed cap on alarms per app |
| Use `authorizationState` | Not `authorizationStatus` -- the correct property name is `authorizationState` |

---

## Resources

**WWDC**: 2025-230

**Docs**: /alarmkit, /alarmkit/alarmmanager, /alarmkit/alarm, /alarmkit/alarmpresentation, /alarmkit/alarmattributes

**Skills**: axiom-extensions-widgets-ref, axiom-swiftui-26-ref
