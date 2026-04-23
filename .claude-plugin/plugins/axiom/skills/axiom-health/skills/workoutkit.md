# WorkoutKit

## When to Use This Skill

Use when:
- Creating custom or planned workouts for the Apple Watch Workout app
- Scheduling workouts to run on the user's watch at specific times
- Building intervals, warmups, cooldowns, and pacer workouts
- Authoring swimming workouts (pool distance + time goals, stroke-aware)
- Previewing a workout from within your app before the user runs it

#### Not This Skill

- Live workout tracking inside your own app → `workouts.md` (`HKWorkoutSession` + `HKLiveWorkoutBuilder`)
- Reading completed workouts from HealthKit → `queries.md`

#### Related Skills

- Use `workouts.md` for live session tracking inside your app
- Use `authorization-and-privacy.md` for HealthKit permissions that cover WorkoutKit results
- Use `axiom-watchos` for Smart Stack placement of workout widgets

## WorkoutKit vs HealthKit Workouts

| | WorkoutKit | `HKWorkoutSession` |
|---|---|---|
| Purpose | Compose and schedule workouts | Track live workouts |
| Executes in | Apple Watch Workout app | Your own app |
| Produces | `HKWorkout` result (written to HealthKit) | `HKWorkout` result (saved by your app) |
| Scope | Structured intervals, pacer workouts, pool swims, scheduling | Real-time sensor collection |

They're complementary: you can author a WorkoutKit plan for the user to run in the Workout app, then later query the resulting `HKWorkout` from HealthKit to display a summary in your app.

## Platform Availability

All core WorkoutKit types: **iOS 17.0+, iPadOS 17.0+, Mac Catalyst 18.0+, macOS 15.0+, watchOS 10.0+**.

Swimming additions (WWDC 2024-10084): iOS 18+ / watchOS 11+.

Unlike `HKLiveWorkoutBuilder`, WorkoutKit was cross-platform from day one — your iOS app can compose and schedule watch workouts directly without a companion watch app.

## Composing a Custom Workout

A `CustomWorkout` is three phases: optional warmup → repeatable interval blocks → optional cooldown.

```swift
import WorkoutKit
import HealthKit

let warmup = WorkoutStep(
    goal: .time(5, .minutes),
    alert: nil,
    displayName: "Easy jog"
)

let work = IntervalStep(
    .work,
    step: WorkoutStep(goal: .distance(400, .meters))
)

let recover = IntervalStep(
    .recovery,
    step: WorkoutStep(goal: .time(90, .seconds))
)

let block = IntervalBlock(steps: [work, recover], iterations: 6)

let cooldown = WorkoutStep(
    goal: .time(5, .minutes),
    displayName: "Easy jog"
)

let workout = CustomWorkout(
    activity: .running,
    location: .outdoor,
    displayName: "6×400m",
    warmup: warmup,
    blocks: [block],
    cooldown: cooldown
)
```

## Goals

`WorkoutGoal` — what finishes a step:

| Goal | Meaning |
|---|---|
| `.open` | No automatic completion; user ends step manually |
| `.time(_:_:)` | Finish after a duration |
| `.distance(_:_:)` | Finish after a distance |
| `.energy(_:_:)` | Finish after kilocalories burned |
| `.poolSwimDistanceWithTime(_:_:)` | iOS 18+: finish only when **both** distance and time are met |

The pool-swim goal is specifically for structured pool workouts where the user's pool length is set at runtime — the watch scales distances to actual laps.

## Alerts

Alerts trigger during a step to nudge the user back to target. Nine concrete alert types:

| Alert | Use |
|---|---|
| `HeartRateRangeAlert`, `HeartRateZoneAlert` | Keep HR in a band or zone |
| `PowerRangeAlert`, `PowerThresholdAlert`, `PowerZoneAlert` | Running or cycling power |
| `CadenceRangeAlert`, `CadenceThresholdAlert` | Steps/revs per minute |
| `SpeedRangeAlert`, `SpeedThresholdAlert` | Pace by speed (named "Speed" in the shipping API) |

```swift
let alert = HeartRateRangeAlert(
    target: 140...160,
    unit: .count().unitDivided(by: .minute())
)

let step = WorkoutStep(
    goal: .distance(5, .kilometers),
    alert: alert,
    displayName: "Tempo"
)
```

Check `WorkoutAlert.supports(activity:location:)` before attaching — not every alert works with every activity (e.g., power alerts are meaningless for swimming).

## Other Workout Shapes

For simpler compositions, use these built-in types instead of `CustomWorkout`:

```swift
// One goal, no intervals
SingleGoalWorkout(
    activity: .cycling,
    location: .outdoor,
    goal: .distance(50, .kilometers)
)

// Pacer: watch paces you against a reference time
PacerWorkout(
    activity: .running,
    location: .outdoor,
    distance: 5.0.kilometers,
    time: 22.0.minutes
)

// Triathlon: contiguous activities
SwimBikeRunWorkout(
    activities: [...],
    displayName: "Sprint triathlon"
)
```

## Scheduling Workouts to the Watch

`WorkoutScheduler.shared` schedules plans to appear in the Workout app at a future time.

### Authorization

```swift
let state = WorkoutScheduler.shared.authorizationState
switch state {
case .notDetermined:
    try await WorkoutScheduler.shared.requestAuthorization()
case .authorized:
    // Proceed.
    break
case .denied, .restricted:
    // Degrade — tell the user how to enable in Settings.
    break
}
```

Authorization is separate from HealthKit authorization. A user can grant HealthKit reads but deny WorkoutKit scheduling, or vice versa.

### Schedule a workout

```swift
guard WorkoutScheduler.shared.isSupported else { return }

let plan = WorkoutPlan(.custom(workout))
let scheduledDate = Date.now.addingTimeInterval(3600) // 1 hour from now

try await WorkoutScheduler.shared.schedule(plan, at: scheduledDate)
```

### Schedule rules

- **Max 15 scheduled workouts at a time** (WWDC 2023-10016).
- Schedules must be within ±7 days of now.
- Listing: `await WorkoutScheduler.shared.scheduledWorkouts`.
- Removing: `await WorkoutScheduler.shared.remove(plan, at: date)` or `removeAllWorkouts()`.
- Marking a scheduled workout complete (e.g., user did it in another way): `markComplete(_:at:)`.

## Previewing / Opening in Workout App

To open a plan directly in the Workout app without scheduling:

```swift
let plan = WorkoutPlan(.custom(workout))
try await plan.openInWorkoutApp()
```

This is the current shipping way to preview or hand off a plan for immediate execution.

## Swimming Workouts

iOS 18 / watchOS 11 added first-class pool swimming:

```swift
let warmup = WorkoutStep(goal: .time(3, .minutes), displayName: "Easy")

let interval = IntervalStep(
    .work,
    step: WorkoutStep(
        goal: .poolSwimDistanceWithTime(100, .meters, 2, .minutes),
        displayName: "100 @ 2:00"
    )
)

let block = IntervalBlock(steps: [interval], iterations: 8)

let workout = CustomWorkout(
    activity: .swimming,
    location: .indoor,
    displayName: "8×100 @ 2:00",
    warmup: warmup,
    blocks: [block]
)
```

The `.poolSwimDistanceWithTime` goal is unique to swimming — it advances only when the user has covered the distance *and* the time has elapsed, giving coach-style "swim 100m, arrive at the 2-minute mark" semantics.

The user's pool length is configured when they start the workout; the watch converts your distance goals to actual laps at runtime.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Mixing up `WorkoutSession` (HealthKit) and `WorkoutPlan` (WorkoutKit) | Sessions track live in your app; plans are authored and scheduled to run in the Workout app. Different APIs, different use cases. |
| Scheduling without checking `WorkoutScheduler.shared.isSupported` | Returns false on devices where WorkoutKit scheduling is not available; `schedule(_:at:)` throws. |
| Scheduling more than 15 workouts | Older plans silently fall off. Track your scheduled count and remove stale plans before scheduling new ones. |
| Scheduling beyond ±7 days | The scheduler rejects dates outside the window. Schedule closer to the time and re-schedule as needed. |
| Attaching an alert to an incompatible activity | `WorkoutAlert.supports(activity:location:)` returns false; runtime behavior is undefined. Check before attaching. |
| Using the term "pace alert" in code | The shipping API uses Speed, not Pace. `SpeedRangeAlert`, `SpeedThresholdAlert`. |
| Assuming WWDC 2023 sample code matches the shipping API | Early WWDC samples used `BlockStep`, `WarmupStep`, `CustomWorkoutComposition` — these are superseded. Use `IntervalStep`, `WorkoutStep`, `CustomWorkout`. |
| Expecting WorkoutKit to collect sensor data into a builder | It doesn't. Only `HKLiveWorkoutBuilder` does live collection. The Workout app handles WorkoutKit plans. |
| Forgetting WorkoutKit authorization is separate from HealthKit | Two separate permissions. Requesting HealthKit doesn't imply WorkoutKit. |

## Resources

**WWDC**: 2023-10016, 2024-10084

**Docs**: /workoutkit, /workoutkit/customizing-workouts-with-workoutkit, /workoutkit/customworkout, /workoutkit/singlegoalworkout, /workoutkit/pacerworkout, /workoutkit/swimbikerunworkout, /workoutkit/workoutplan, /workoutkit/workoutstep, /workoutkit/intervalblock, /workoutkit/intervalstep, /workoutkit/workoutgoal, /workoutkit/workoutalert, /workoutkit/workoutscheduler

**Skills**: axiom-health (workouts, authorization-and-privacy, queries), axiom-watchos
