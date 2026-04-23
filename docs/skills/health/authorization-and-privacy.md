---
name: authorization-and-privacy
description: Use when requesting HealthKit permissions, writing purpose strings, handling the read-access asymmetry, investigating empty Health tabs, or preparing HealthKit features for App Store review.
---

# HealthKit Authorization and Privacy

HealthKit's authorization model is asymmetric by design — the API tells you about write status but deliberately hides read status. Most "my Health tab is empty" bugs come from misunderstanding this one rule.

## When to Use This Skill

Use this skill when you're:
- Implementing the first authorization request for any HealthKit feature
- Investigating "my Health tab is empty for some users" (usually the read asymmetry, not a bug)
- Deciding between `requestAuthorization` and `getRequestStatusForAuthorization`
- Handling `HKAuthorizationStatus.notDetermined` vs `.sharingDenied` vs `.sharingAuthorized`
- Writing purpose strings for `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription`
- Adding clinical records, vision prescriptions, or other per-object authorization types
- Preparing for App Store submission with Health data

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I tell whether the user granted read access to step count?"
- "Why does `authorizationStatus(for:)` return `.sharingAuthorized` even though my queries return no data?"
- "What purpose string should I use for reading workouts?"
- "Users say they denied permission but the sheet keeps not appearing — what's happening?"
- "Should I enable Clinical Health Records capability if I might use it later?"

## What This Skill Provides

### The One Rule You Must Internalize
- Why HealthKit deliberately hides whether reads were denied (privacy leak prevention)
- Why every denied read returns an empty result indistinguishable from "no data exists"
- What this means for UI design — empty is a valid state, not an error

### Authorization API Reference
- `HKAuthorizationStatus` is write-only — all three cases describe share (write) state
- `getRequestStatusForAuthorization` is a sheet gate, not a grant check
- `requestAuthorization` throws only on system errors, never on user denial
- Per-object authorization for vision prescriptions (iOS 16+)

### Info.plist and Entitlement Setup
- Which usage-description keys are required and which operations crash without them
- HealthKit, Clinical Health Records, and Background Delivery capabilities in Xcode
- Why enabling Clinical Health Records "just in case" is an App Review rejection

### Privacy Discipline
- The four WWDC rules for when to request (in context, every time, only what's needed, never assume granted)
- Guest User session trap on iPad
- Background-read limitations and Privacy Manifest expectations
- App Store rules prohibiting HealthKit data in advertising or resale

## Key Pattern

**Success is not consent.** A `requestAuthorization` call that returns without throwing means *the request was delivered*, not that the user approved anything. To know whether you can actually read data, run the query and accept that empty results are a valid state — never treat them as an error.

```swift
// Correct — attempt the work, handle what comes back
try await store.requestAuthorization(toShare: toWrite, read: toRead)
let samples = try await descriptor.result(for: store)
// samples may be empty because user denied OR because no data exists.
// You cannot tell which. Show an empty-state UI, not an error.
```

## Documentation Scope

This page documents the `authorization-and-privacy` skill in the `axiom-health` suite. The skill file contains comprehensive guidance Claude uses when answering your questions, including a decision tree, a verbatim reproduction of the "empty Health tab" pressure scenario, and a full common-mistakes table.

**For the data model** — Use [fundamentals](/skills/health/fundamentals) for the `HKHealthStore` setup and data-type hierarchy this skill builds on.

**For App Store submission specifics** — Use [privacy-ux](/reference/privacy-ux) alongside this skill when writing purpose strings and preparing for App Review.

## Related

- [fundamentals](/skills/health/fundamentals) — Prerequisite for this skill; covers the data types you're requesting permission for
- [queries](/skills/health/queries) — Describes how queries behave after authorization (including why empty results are valid)
- [sync-and-background](/skills/health/sync-and-background) — Background reads have additional restrictions documented here
- [privacy-ux](/reference/privacy-ux) — Cross-framework guidance on purpose strings and privacy UX that applies to HealthKit purpose strings
- [security-privacy-scanner](/agents/security-privacy-scanner) — Automated scan for privacy issues including missing HealthKit usage strings

## Resources

**WWDC**: 2020-10664, 2022-10005

**Docs**: /healthkit/authorizing-access-to-health-data, /healthkit/protecting-user-privacy, /healthkit/setting-up-healthkit, /healthkit/hkauthorizationstatus, /healthkit/hkauthorizationrequeststatus, /healthkit/hkhealthstore/requestauthorization(toshare:read:), /healthkit/hkhealthstore/statusforauthorizationrequest(toshare:read:)

**Skills**: axiom-health, fundamentals, queries, sync-and-background, axiom-shipping
