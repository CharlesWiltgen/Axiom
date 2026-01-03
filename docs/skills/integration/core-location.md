---
name: core-location
description: Core Location implementation patterns - authorization strategy, monitoring approach, accuracy selection, background location
---

# Core Location

Implementation patterns for Core Location. Covers authorization strategy, monitoring approach selection, accuracy optimization, and background location setup.

## When to Use This Skill

Use this skill when you're:
- Choosing between When In Use vs Always authorization
- Deciding on monitoring approach (continuous, significant-change, CLMonitor)
- Implementing geofencing or region monitoring
- Setting up background location updates
- Reviewing location code for anti-patterns

**Note:** For API details and code examples, see [core-location-ref](/reference/core-location-ref). For troubleshooting, see [core-location-diag](/diagnostic/core-location-diag).

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Should I use When In Use or Always authorization?"
- "How should I implement geofencing in my app?"
- "What's the best way to track user location in background?"
- "Why is my location code draining battery?"
- "How do I upgrade from When In Use to Always authorization?"
- "What accuracy level should I use for a store finder?"
- "How do I handle location authorization denial gracefully?"

## What's Covered

### Anti-Patterns Prevented
- Premature Always authorization (30-60% denial rate)
- Continuous updates for geofencing (10x battery drain vs CLMonitor)
- Ignoring stationary detection (wasted battery)
- No graceful denial handling
- Wrong accuracy for use case
- Not stopping updates when done
- Ignoring CLServiceSession (iOS 18+)

### Decision Trees
- Authorization strategy (When In Use vs Always, upgrade flow)
- Monitoring strategy (continuous vs significant-change vs CLMonitor)
- Accuracy selection (navigation vs fitness vs store finder)

### Pressure Scenarios
- "Just use Always authorization" pushback
- "Location isn't working in background" debugging
- "Geofence events aren't firing" production issues

### Checklists
- Pre-release location checklist
- Background location setup checklist

## Key Pattern

### Progressive Authorization (Recommended)

```swift
// Start minimal - When In Use
let baseSession = CLServiceSession(authorization: .whenInUse)

// Later, when user creates a location reminder:
let alwaysSession = CLServiceSession(authorization: .always)

// For features needing full accuracy:
let navSession = CLServiceSession(
    authorization: .whenInUse,
    fullAccuracyPurposeKey: "Navigation"
)
```

**Why**: Starting with Always authorization has 30-60% denial rate. Progressive upgrade when user understands value has 5-10% denial rate.

## Documentation Scope

This page documents the `core-location` skill—implementation patterns and decision frameworks Claude uses when helping you design location features.

**For API reference:** See [core-location-ref](/reference/core-location-ref) for CLLocationUpdate, CLMonitor, CLServiceSession APIs.

**For troubleshooting:** See [core-location-diag](/diagnostic/core-location-diag) for debugging location issues.

## Related

- [core-location-ref](/reference/core-location-ref) — Complete API reference for modern Core Location
- [core-location-diag](/diagnostic/core-location-diag) — Symptom-based troubleshooting
- [energy](/skills/debugging/energy) — Location as battery subsystem

## Resources

**WWDC**: 2023-10180, 2023-10147, 2024-10212

**Docs**: /corelocation, /corelocation/clmonitor, /corelocation/cllocationupdate
