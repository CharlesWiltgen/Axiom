---
name: workouts
description: Use when building live workout tracking with HKWorkoutSession and HKLiveWorkoutBuilder — session state machine, end sequence, recovery after termination, multi-device mirroring, multi-activity workouts, iOS 26 iPhone origination, and Always On.
---

# HealthKit Workouts

Live workout tracking with `HKWorkoutSession` and `HKLiveWorkoutBuilder` — collecting sensor data in your own app, saving a finished `HKWorkout`, and coordinating across watch and iPhone.

## When to Use This Skill

Use this skill when you're:
- Building a workout tracking app on watchOS, iOS, or iPadOS
- Deciding between a live session (`HKWorkoutSession`) and logging a finished `HKWorkout` retrospectively
- Implementing pause/resume, multi-activity triathlons, or watch-to-iPhone mirroring
- Recovering an active workout after an app or process termination
- Adopting iOS 26's new ability to originate sessions from iPhone (previously watch-only)
- Supporting Always On display while a workout is running

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "My workout isn't saving when the user taps Done — what's wrong?"
- "How do I recover an active workout session after my app is killed?"
- "What's the right way to transition from swim to bike in a triathlon workout?"
- "How do I mirror a watch workout to the iPhone companion app?"
- "How do I keep the workout view updating during Always On without draining the battery?"

## What This Skill Provides

### Session Lifecycle
- The six `HKWorkoutSessionState` values and what each means
- Why `.stopped` is not `.ended` — the most common bug
- Canonical end sequence: `stopActivity` → `.stopped` → `endCollection` → `finishWorkout` → `end`
- `prepare()` vs `startActivity(with:)` for fast-start sensor warmup

### Setup and Data Collection
- Canonical `HKWorkoutSession` + `HKLiveWorkoutBuilder` setup for iOS 26+ and watchOS
- Configuring `HKLiveWorkoutDataSource` (default types per activity, `enableCollection`, `disableCollection`)
- Delegate isolation: mark methods `nonisolated` and hop to `@MainActor` internally
- Writing retrospective workouts with `HKWorkout.init(...)` + `HKHealthStore.save` for server or manual entry

### Recovery and Multi-Device
- `recoverActiveWorkoutSession` on watchOS and iOS 26+ with separate entry points
- Watch-to-iPhone mirroring with `startMirroringToCompanionDevice`
- The 10-second iPhone wake budget — register `workoutSessionMirroringStartHandler` at app launch
- Multi-activity workouts (triathlons) with `beginNewActivity` and `.transition` segments
- Reading per-activity stats via `HKWorkoutActivity.statistics(for:)`

### Always On and Background
- 1 Hz maximum refresh rate when the watch is locked
- `TimelineView` with `mode == .lowFrequency` branches for simplified views
- `workout-processing` background mode requirement on watchOS

## Key Pattern

The end sequence is the single most load-bearing pattern in this skill. Calling `session.end()` too early loses the workout:

```swift
// 1. UI event finishes the workout:
session.stopActivity(with: .now)

// 2. Session delegate reacts to .stopped:
func workoutSession(_ session: HKWorkoutSession,
                    didChangeTo toState: HKWorkoutSessionState,
                    from fromState: HKWorkoutSessionState,
                    date: Date) {
    guard toState == .stopped, let builder = self.builder else { return }
    Task {
        try await builder.endCollection(at: date)
        let finishedWorkout = try await builder.finishWorkout()
        session.end()
    }
}
```

`.stopped` means "activity halted, builder still needs to finish." `.ended` is the terminal state.

## Documentation Scope

This page documents the `workouts` skill in the `axiom-health` suite. The skill file contains comprehensive guidance Claude uses when answering your questions.

**For planned or scheduled workouts** — Use [workoutkit](/skills/health/workoutkit) when you're composing custom workouts for the Apple Watch Workout app rather than tracking live sessions in your own app.

## Related

- [workoutkit](/skills/health/workoutkit) — Complementary API for planned/scheduled workouts that run in the Workout app instead of your own
- [authorization-and-privacy](/skills/health/authorization-and-privacy) — Required read/write permissions for workouts and Info.plist purpose strings
- [queries](/skills/health/queries) — Reading completed `HKWorkout` samples after the session ends
- [platform-basics](/skills/watchos/platform-basics) — Watch-specific presentation concerns (Always On, Smart Stack, background modes)
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Actor isolation rules that apply to session and builder delegate callbacks

## Resources

**WWDC**: 2021-10009, 2022-10005, 2023-10023, 2025-322

**Docs**: /healthkit/hkworkoutsession, /healthkit/hkliveworkoutbuilder, /healthkit/hkliveworkoutbuilderdelegate, /healthkit/hkliveworkoutdatasource, /healthkit/hkworkoutconfiguration, /healthkit/hkworkout, /healthkit/hkworkoutactivity, /healthkit/build-a-workout-app-for-apple-watch, /healthkit/building-a-workout-app-for-iphone-and-ipad

**Skills**: axiom-health, axiom-watchos, axiom-concurrency, axiom-swiftui
