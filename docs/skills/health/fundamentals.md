---
name: fundamentals
description: Use when starting any HealthKit feature and you need the framework mental model — HKHealthStore setup, characteristic vs sample data, quantity sample subclasses, platform availability, and completion-handler threading rules.
---

# HealthKit Fundamentals

The mental model for every HealthKit feature — how the store works, what data types exist, and why HealthKit behaves the way it does.

## When to Use This Skill

Use this skill when you're:
- Starting your first HealthKit feature and need the framework mental model
- Deciding between characteristic data and sample data for a new type
- Confused about `HKQuantitySample` vs `HKCumulativeQuantitySample` vs `HKDiscreteQuantitySample`
- Figuring out which platforms support HealthKit read and write access
- Setting up `HKHealthStore` correctly for the first time
- Debugging completion-handler threading issues

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "What's the difference between a characteristic type and a sample type in HealthKit?"
- "Should I cast heart rate samples as `HKDiscreteQuantitySample` or `HKQuantitySample`?"
- "Why does my HealthKit code compile on macOS but never return data?"
- "Where should I store my `HKHealthStore` instance in a SwiftUI app?"
- "Why is my UI freezing after a HealthKit query completes?"

## What This Skill Provides

### Core Concepts
- Why HealthKit is a shared store across third-party apps, not your app's private database
- The three properties that shape every API (per-type authorization, shared contributors, immutable samples)
- Why samples can't be edited — only deleted and replaced

### HKHealthStore Setup
- One-instance-per-app rule with a canonical `@MainActor` singleton pattern
- Device availability gating with `isHealthDataAvailable()`
- `Info.plist` usage-key requirements (missing keys crash the app)

### Data Type Hierarchy
- The `HKObjectType` tree — characteristic types versus sample types
- The seven sample kinds (quantity, category, correlation, workout, series, clinical, audiogram, electrocardiogram, activity summary)
- Why `HKQuantitySample` became abstract in iOS 13 and when to cast to cumulative or discrete subclasses
- Aggregation styles that govern statistics queries (cumulative, discrete arithmetic, temporally weighted, equivalent continuous level)

### Platform Availability and Threading
- "Full" vs "Limited" HealthKit store support per platform (iOS, iPadOS 17+, watchOS, visionOS have full; macOS and Mac Catalyst are compile-only)
- Why completion handlers run on private background queues and how to hop to the main actor safely
- Which queries keep running until explicitly stopped

## Key Pattern

The characteristic-vs-sample distinction is the most important thing to internalize.

| Aspect | Characteristic | Sample |
|--------|----------------|--------|
| Shape | Single value, static per user | Time-windowed event with value(s) |
| Examples | birthday, biological sex, blood type | step count, heart rate, workout, sleep stage |
| Access | Synchronous getters on `HKHealthStore` | Queries (sample, statistics, anchored, observer) |
| Authorization | Read-only | Read and write are separate permissions |

If a data type has one answer per user, it's a characteristic. If it has a value that changes over time, it's a sample.

## Documentation Scope

This page documents the `fundamentals` skill in the `axiom-health` suite. The skill file contains comprehensive guidance Claude uses when answering your questions about HealthKit's data model and store setup.

**For authorization and privacy** — Use [authorization-and-privacy](/skills/health/authorization-and-privacy) when you're requesting permissions, writing purpose strings, or handling read-access asymmetry.

**For actually reading and writing data** — Use [queries](/skills/health/queries) for one-shot reads, rollups, and sample writes.

## Related

- [authorization-and-privacy](/skills/health/authorization-and-privacy) — Required follow-up before any read or write flow; covers the permission model built on top of these data types
- [queries](/skills/health/queries) — How to actually read the quantity, category, and workout samples described here
- [sync-and-background](/skills/health/sync-and-background) — Long-running query lifecycles referenced in the threading section
- [swift-concurrency](/skills/concurrency/swift-concurrency) — General Swift 6 actor isolation rules that apply to HealthKit completion handlers

## Resources

**WWDC**: 2019-218, 2020-10664, 2020-10182, 2022-10005

**Docs**: /healthkit, /healthkit/about-the-healthkit-framework, /healthkit/data-types, /healthkit/hkhealthstore, /healthkit/hkobjecttype, /healthkit/hksampletype

**Skills**: axiom-health, authorization-and-privacy, queries, sync-and-background, axiom-concurrency
