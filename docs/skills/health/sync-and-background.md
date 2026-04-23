---
name: sync-and-background
description: Use when tracking HealthKit changes across launches, responding to changes in the background, syncing health data to a server, handling deletions, or using anchored queries, observer queries, and the background-delivery entitlement.
---

# HealthKit Sync and Background Delivery

Anchored queries, observer queries, and sync identifiers — the three APIs you combine so your app handles HealthKit changes correctly without re-reading the whole store on every launch.

## When to Use This Skill

Use this skill when you're:
- Reading from HealthKit across app launches without re-reading the entire history every time
- Responding to HealthKit changes in the background without polling
- Syncing HealthKit data to a server without creating duplicates
- Handling sample deletions correctly (not just additions)
- Adding the `com.apple.developer.healthkit.background-delivery` entitlement
- Deciding between `HKObserverQuery`, `HKAnchoredObjectQuery`, and their descriptor variants

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I stop re-reading every step sample on every app launch?"
- "I need to sync HealthKit to my server without duplicates — what's the pattern?"
- "My app still shows samples the user deleted in the Health app. How do I handle deletions?"
- "How do I wake my app when new heart rate samples arrive?"
- "Why isn't my observer query firing in the Simulator?"

## What This Skill Provides

### The Sync Architecture
- Why re-reading the whole store on every launch is wrong (battery, correctness, duplicates)
- How observer queries, anchored queries, and sync identifiers work together
- The "wake-up signal + payload + de-duplicator" three-API pattern

### HKAnchoredObjectQuery Details
- `HKQueryAnchor` persistence with `NSKeyedArchiver` (one anchor per type)
- Classic callback signature vs modern descriptor (`result(for:)` for one-shot, `results(for:)` for streaming)
- When to use one-shot vs streaming variants
- Canonical delta-read implementation

### Observer Queries and Background Delivery
- The three-strikes rule for the `HKObserverQueryCompletionHandler`
- Why you must always call completion, including in error paths
- `HKUpdateFrequency` semantics on iOS vs watchOS
- Why `HKCorrelationType` isn't supported for background delivery
- Simulator limitations

### Deletions — The Easy-to-Miss Piece
- `HKDeletedObject` semantics and why observer-only architectures leak tombstones
- Why Apple's "deleted objects are temporary" warning matters for long-offline cases
- How to use metadata on deleted objects for server-side sync identifier cleanup

### Sync Identifiers
- `HKMetadataKeySyncIdentifier` and `HKMetadataKeySyncVersion`
- The conflict rule — newer version replaces older with matching identifier
- How to design identifiers that are stable across devices and sessions

## Key Pattern

The canonical delta read — run at startup and from inside the observer's handler — replaces the naive "read everything on launch" approach.

```swift
let anchor = loadAnchor()  // nil on first launch

let predicate = HKSamplePredicate<HKQuantitySample>.quantitySample(
    type: HKQuantityType(.stepCount),
    predicate: nil
)

let descriptor = HKAnchoredObjectQueryDescriptor(
    predicates: [predicate],
    anchor: anchor
)

let result = try await descriptor.result(for: store)

apply(additions: result.addedSamples, deletions: result.deletedObjects)
try persist(anchor: result.newAnchor)  // save for next launch
```

Same three moves every time — load anchor, fetch delta, persist new anchor. Deletions flow automatically.

## Documentation Scope

This page documents the `sync-and-background` skill in the `axiom-health` suite. The skill file contains comprehensive guidance Claude uses when answering your questions — a decision map of "what goes where," a pressure scenario walking through a battery-drain fix, and a common-mistakes table with concrete consequences.

**For one-shot reads** — Use [queries](/skills/health/queries) when you just need today's data or a single aggregate, not change tracking across launches.

**For watchOS-specific background behavior** — Use [background-and-networking](/skills/watchos/background-and-networking) for watch-specific wake-up budgets that layer on top of the HealthKit background-delivery model.

## Related

- [fundamentals](/skills/health/fundamentals) — Prerequisite for `HKHealthStore` setup and the sample-type system
- [authorization-and-privacy](/skills/health/authorization-and-privacy) — Background reads have authorization constraints documented there; read before any background workflow
- [queries](/skills/health/queries) — Complementary skill for foreground one-shot reads; many anchored-query call sites share the same predicate patterns
- [background-and-networking](/skills/watchos/background-and-networking) — Watch-specific background task budgets that apply when running this pattern on Apple Watch
- [cloud-sync](/skills/persistence/cloud-sync) — Alternative sync mechanism for app-level data that isn't health data; compare trade-offs when designing a full sync stack

## Resources

**WWDC**: 2020-10184

**Docs**: /healthkit/executing-anchored-object-queries, /healthkit/executing-observer-queries, /healthkit/hkanchoredobjectquery, /healthkit/hkobserverquery, /healthkit/hkdeletedobject, /healthkit/hkanchoredobjectquerydescriptor, /healthkit/hkqueryanchor, /healthkit/hkupdatefrequency, /healthkit/hkmetadatakeysyncidentifier, /healthkit/hkmetadatakeysyncversion, /bundleresources/entitlements/com.apple.developer.healthkit.background-delivery

**Skills**: axiom-health, fundamentals, authorization-and-privacy, queries, axiom-concurrency, axiom-data
