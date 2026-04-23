---
name: workoutkit
description: Use when composing or scheduling custom workouts for the Apple Watch Workout app — CustomWorkout, intervals, alerts, pacer workouts, pool swimming, scheduling with WorkoutScheduler, and previewing plans.
---

# WorkoutKit

Composing and scheduling custom workouts that run in the Apple Watch Workout app — complementary to, and distinct from, the live-tracking `HKWorkoutSession` API.

## When to Use This Skill

Use this skill when you're:
- Creating custom or planned workouts for the Apple Watch Workout app
- Scheduling workouts to appear on the user's watch at specific times
- Building intervals, warmups, cooldowns, and pacer workouts
- Authoring pool swimming workouts with distance-and-time goals (iOS 18+)
- Previewing a workout from your app before the user runs it
- Composing a triathlon (`SwimBikeRunWorkout`) with contiguous activities

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I schedule a workout to appear on the user's watch tomorrow morning?"
- "What's the difference between WorkoutKit and HKWorkoutSession?"
- "How do I build a 6×400m interval workout with heart-rate alerts?"
- "How do I compose a pool swim workout that enforces a send-off interval?"
- "Why does my scheduled workout not appear on the watch?"

## What This Skill Provides

### WorkoutKit vs HealthKit Workouts
- Side-by-side comparison of WorkoutKit plans and `HKWorkoutSession` live tracking
- When to use each — authoring vs tracking, Workout app execution vs your own app
- How they cooperate: author a plan, later query the resulting `HKWorkout` from HealthKit

### Composing Workouts
- `CustomWorkout` structure — warmup, repeatable `IntervalBlock`s, cooldown
- `WorkoutStep` and `IntervalStep` with `.work` / `.recovery` roles
- `WorkoutGoal` types: `.open`, `.time`, `.distance`, `.energy`, `.poolSwimDistanceWithTime`
- Built-in shapes: `SingleGoalWorkout`, `PacerWorkout`, `SwimBikeRunWorkout`
- Nine `WorkoutAlert` types (heart rate, power, cadence, speed — no "pace alert" in the shipping API)
- Checking alert compatibility with `WorkoutAlert.supports(activity:location:)`

### Scheduling and Previewing
- `WorkoutScheduler.shared` authorization — separate from HealthKit authorization
- Scheduling a `WorkoutPlan` at a future date with `schedule(_:at:)`
- Scheduler limits: max 15 plans, ±7 days window
- Listing, removing, and marking scheduled workouts complete
- Opening a plan immediately in the Workout app with `plan.openInWorkoutApp()`

### Swimming Workouts (iOS 18+)
- `.poolSwimDistanceWithTime` goal for send-off-interval semantics
- Pool-length awareness — watch converts your meters to laps at runtime

## Key Pattern

WorkoutKit plans and live sessions are different APIs with different purposes. A plan is authored and handed to the Workout app; a session runs inside your own app and collects sensor data directly. The single most common mistake is conflating them.

```swift
// WorkoutKit: author a plan, schedule or open it
let plan = WorkoutPlan(.custom(workout))
try await WorkoutScheduler.shared.schedule(plan, at: tomorrowMorning)
```

## Documentation Scope

This page documents the `workoutkit` skill in the `axiom-health` suite. The skill file contains comprehensive guidance Claude uses when answering your questions.

**For live sensor-driven workouts inside your own app** — Use [workouts](/skills/health/workouts) when you need `HKWorkoutSession` with real-time heart rate, distance, and energy collection.

## Related

- [workouts](/skills/health/workouts) — Complementary live-tracking API for workouts that run inside your own app
- [authorization-and-privacy](/skills/health/authorization-and-privacy) — HealthKit permissions the resulting `HKWorkout` will need; WorkoutKit scheduler authorization is separate
- [queries](/skills/health/queries) — Reading the `HKWorkout` produced by the Workout app after a plan runs
- [smart-stack-and-complications](/skills/watchos/smart-stack-and-complications) — Watch surfaces where scheduled workouts may be promoted

## Resources

**WWDC**: 2023-10016, 2024-10084

**Docs**: /workoutkit, /workoutkit/customizing-workouts-with-workoutkit, /workoutkit/customworkout, /workoutkit/singlegoalworkout, /workoutkit/pacerworkout, /workoutkit/swimbikerunworkout, /workoutkit/workoutplan, /workoutkit/workoutstep, /workoutkit/intervalblock, /workoutkit/intervalstep, /workoutkit/workoutgoal, /workoutkit/workoutalert, /workoutkit/workoutscheduler

**Skills**: axiom-health, axiom-watchos
