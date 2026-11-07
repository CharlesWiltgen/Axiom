---
name: fundamentals
description: Use when starting any HealthKit feature and you need the framework mental model — HKHealthStore setup, characteristic vs sample data, quantity sample subclasses, platform availability, and completion-handler threading rules.
---

# HealthKit Fundamentals

The mental model behind every HealthKit feature: how the store works, which data types exist, and why HealthKit behaves the way it does.

## When to Use

Use this skill when you're:
- Starting your first HealthKit feature and need the framework mental model
- Deciding between characteristic data and sample data for a new type
- Confused about `HKQuantitySample` vs. `HKCumulativeQuantitySample` vs. `HKDiscreteQuantitySample`
- Figuring out which platforms support HealthKit read and write access
- Setting up `HKHealthStore` correctly for the first time
- Debugging completion-handler threading issues

## Example Prompts

Questions you can ask your assistant that will draw from this skill:

- "What's the difference between a characteristic type and a sample type in HealthKit?"
- "Should I cast heart rate samples as `HKDiscreteQuantitySample` or `HKQuantitySample`?"
- "Why does my HealthKit code compile on macOS but never return data?"
- "Where should I store my `HKHealthStore` instance in a SwiftUI app?"
- "Why is my UI freezing after a HealthKit query completes?"
- "Can HealthKit give me RMSSD heart rate variability, or only SDNN?"
- "Should I use `biologicalSex` or `referenceSex` to pick a clinical reference range?"

## What This Skill Provides

### Core Concepts
- Why HealthKit is a store shared with other apps, not your app's private database
- The three properties that shape every API: per-type authorization, shared contributors, and immutable samples
- Why samples can't be edited, only deleted and replaced

### HKHealthStore Setup
- The one-instance-per-app rule, with a canonical `@MainActor` singleton pattern
- Device availability gating with `isHealthDataAvailable()`
- The required `Info.plist` usage keys (a missing key crashes the app when you request authorization)

### Data Type Hierarchy
- The `HKObjectType` tree: characteristic types versus sample types
- The sample kinds (quantity, category, correlation, workout, series, clinical, audiogram, electrocardiogram, activity summary)
- Why `HKQuantitySample` became abstract in iOS 13, and when to cast to the cumulative or discrete subclass
- The aggregation styles that govern statistics queries (cumulative, discrete arithmetic, temporally weighted, equivalent continuous level)
- The `heartRateVariabilityRMSSD` quantity type (OS 27, every platform), HealthKit's second heart rate variability metric alongside SDNN
- The `hipCircumference` quantity type and the `referenceSex` characteristic (the 27.3 releases), and how reference sex differs from biological sex

### Platform Availability and Threading
- Which platforms have a full HealthKit store (iOS, iPadOS 17+, watchOS, visionOS) and which only compile against it (macOS, Mac Catalyst, iPadOS 16 and earlier)
- Why completion handlers run on private background queues, and how to hop to the main actor safely
- Which queries keep running until you stop them

### Common Mistakes
- Reading a successful `requestAuthorization` as "the user said yes"
- Casting a quantity sample to the wrong subclass, which yields `nil` or a crash
- Hand-summing samples that iPhone and Apple Watch both recorded, which double-counts the same activity

## Key Pattern

The characteristic-versus-sample distinction is the most important thing to internalize.

| Aspect | Characteristic | Sample |
|--------|----------------|--------|
| Shape | Single value, static per user | Time-windowed event with value(s) |
| Examples | birthday, biological sex, blood type | step count, heart rate, workout, sleep stage |
| Access | Synchronous getters on `HKHealthStore` | Queries (sample, statistics, anchored, observer) |
| Authorization | Read-only | Read and write are separate permissions |

If a data type has one answer per user, it's a characteristic. If its value changes over time, it's a sample.

## Documentation Scope

This page documents the `fundamentals` skill (in the `axiom-health` suite). The skill holds the full type hierarchy, the sample-kind and platform tables, and the setup code your assistant draws on.

## Related

- [Authorization and Privacy](/skills/health/authorization-and-privacy) – The required next step before any read or write; covers the permission model built on these data types
- [Queries](/skills/health/queries) – How to read the quantity, category, and workout samples described here
- [Sync and Background](/skills/health/sync-and-background) – Lifecycles for the long-running queries mentioned under threading
- [Workouts](/skills/health/workouts) – Live workout sessions, which build on `HKHealthStore` and the workout sample type
- [Clinical and Mobility](/skills/health/clinical-and-mobility) – Clinical record types and mobility metrics
- [Swift 6 Concurrency](/skills/concurrency/swift-concurrency) – General Swift 6 actor isolation rules that apply to HealthKit completion handlers

## Resources

**WWDC**: 2019-218 (Exploring New Data Representations in HealthKit), 2020-10664 (Getting started with HealthKit), 2020-10182 (What's new in HealthKit), 2022-10005 (What's new in HealthKit)

**Docs**: /healthkit, /healthkit/about-the-healthkit-framework, /healthkit/data-types, /healthkit/hkhealthstore, /healthkit/hkobjecttype, /healthkit/hksampletype
