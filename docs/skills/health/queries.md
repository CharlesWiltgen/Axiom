---
name: queries
description: Use when reading or writing HealthKit data — choosing between sample, statistics, and statistics-collection queries; computing rollups; writing quantity and category samples; and modernizing callback code to async descriptors.
---

# HealthKit Queries and Sample Writes

One-shot reads, rollups for charts, and writing new samples — plus the descriptor-based Swift Concurrency APIs that replace the old callback-based query classes.

## When to Use This Skill

Use this skill when you're:
- Reading data from HealthKit for a one-shot display (today's steps, most recent heart rate)
- Computing daily, hourly, or weekly rollups for charts
- Writing new `HKQuantitySample`, `HKCategorySample`, or `HKWorkout` samples to the store
- Choosing between `HKSampleQuery`, `HKStatisticsQuery`, `HKStatisticsCollectionQuery`, and their descriptor variants
- Modernizing callback-based query code to Swift Concurrency descriptors

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I fetch today's total step count with Swift Concurrency?"
- "I need daily calorie rollups for the last 30 days — which query should I use?"
- "Why is `stats.sumQuantity()` returning nil when I asked for an average?"
- "How do I save a weight measurement and make sure it's marked as user-entered?"
- "My `HKStatisticsCollectionQuery` doesn't work with workouts — what's the alternative?"

## What This Skill Provides

### Query Selection
- Decision tree for `HKSampleQuery` vs `HKStatisticsQuery` vs `HKStatisticsCollectionQuery`
- When to stop reading this skill and switch to `sync-and-background` instead
- Why descriptors (iOS 15.4+) are preferred over the classic callback classes

### Canonical Patterns
- Reading raw samples with predicate, sort, and limit
- Single aggregate over a window (total steps today)
- Rollups over intervals for a chart (daily steps, last 30 days)
- Writing quantity samples with metadata

### HKStatisticsOptions Rules
- Which accessor goes with which option (`.cumulativeSum` → `sumQuantity()`, `.discreteAverage` → `averageQuantity()`, etc.)
- Why cumulative and discrete options can't be combined
- Why `HKStatisticsCollectionQuery` only accepts `HKQuantitySample` (and what to do for workouts or correlations)

### Writes and Performance
- Batch save rules and sample-granularity recommendations
- Why samples are immutable and how to "update" by delete-and-replace
- Memory-safe query practices (always set a `limit:` or date predicate)
- When to fall back to `HKAnchoredObjectQueryDescriptor` with pagination

## Key Pattern

Prefer async descriptors. They replace the entire callback-based query API with typed, cancellable, actor-aware variants.

```swift
let predicate = HKSamplePredicate<HKQuantitySample>.quantitySample(
    type: HKQuantityType(.stepCount),
    predicate: HKQuery.predicateForSamples(withStart: startOfDay, end: nil)
)

let descriptor = HKStatisticsQueryDescriptor(
    predicate: predicate,
    options: .cumulativeSum
)

let statistics = try await descriptor.result(for: store)
let steps = statistics?.sumQuantity()?.doubleValue(for: .count()) ?? 0
```

No completion handler, no manual `stop(query)` cleanup, generic typing catches wrong-sample-type bugs at compile time.

## Documentation Scope

This page documents the `queries` skill in the `axiom-health` suite. The skill file contains comprehensive guidance Claude uses when answering your questions — full decision tree, `HKStatisticsOptions` reference table, per-accessor nil behavior, and common mistakes.

**For change tracking over time** — Use [sync-and-background](/skills/health/sync-and-background) when you need deltas since last launch, observer queries, or background delivery. Those are long-running queries with different lifecycle rules.

**For workout sessions** — Use the `workouts` skill (covered in the [axiom-health suite](/skills/health/)) for `HKWorkoutSession` and `HKLiveWorkoutBuilder` lifecycle.

## Related

- [fundamentals](/skills/health/fundamentals) — Prerequisite for the `HKObjectType` hierarchy and quantity-vs-category distinction
- [authorization-and-privacy](/skills/health/authorization-and-privacy) — Empty query results can mean denied reads; authorization rules affect error handling here
- [sync-and-background](/skills/health/sync-and-background) — Escalate here when one-shot reads aren't enough and you need delta tracking
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Swift 6 actor isolation patterns that affect descriptor result handling
- [swiftui-architecture](/skills/ui-design/swiftui-architecture) — `@Observable` view model patterns for rendering `HKStatisticsCollection` results in charts

## Resources

**WWDC**: 2020-10664, 2022-10005

**Docs**: /healthkit/reading-data-from-healthkit, /healthkit/queries, /healthkit/running-queries-with-swift-concurrency, /healthkit/hksamplequerydescriptor, /healthkit/hkstatisticsquerydescriptor, /healthkit/hkstatisticscollectionquerydescriptor, /healthkit/hkstatisticsoptions, /healthkit/hkstatistics, /healthkit/hkstatisticscollection, /healthkit/saving-data-to-healthkit

**Skills**: axiom-health, fundamentals, authorization-and-privacy, sync-and-background, axiom-concurrency
