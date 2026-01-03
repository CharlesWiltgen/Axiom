---
name: core-location-diag
description: Location updates not arriving, background location broken, authorization denied, geofence not triggering
---

# Core Location Diagnostics

Systematic Core Location troubleshooting for location failures, background issues, authorization problems, and geofence debugging.

## Overview

Diagnostic workflows for debugging Core Location using CLLocationUpdate (iOS 17+) and CLMonitor (iOS 17+). Includes systematic troubleshooting, decision trees, and common mistake patterns.

## What This Diagnostic Covers

### Location Update Issues
- Updates never arrive — authorization, Info.plist, iteration
- Location unavailable — indoor, airplane mode, GPS lock
- Accuracy unexpectedly poor — reduced accuracy, configuration
- Updates stop randomly — Task cancellation, isStationary

### Background Location Issues
- Stops when backgrounded — capability, session, authorization
- Doesn't resume after suspend — session recovery, relaunch
- Blue indicator missing — session not held, wrong setup

### Authorization Problems
- Always denied on fresh install — Info.plist strings
- insufficientlyInUse — requesting from background
- Reduced accuracy forced — user choice, temporary override

### Geofencing Issues
- Events not triggering — condition limit, radius too small
- Stale lastEvent — not awaiting events
- Monitor not persisting — not reinitializing on launch

## When to Use This Diagnostic

Use this diagnostic when:
- Location updates never arrive
- Background location stops working
- Users always deny authorization
- Location accuracy is unexpectedly poor
- Geofence events don't trigger
- Location icon won't go away

## Diagnostic Workflow

```
1. Check Authorization (2 min)
   ├─ authorizationStatus value
   ├─ locationServicesEnabled()
   ├─ accuracyAuthorization
   └─ Info.plist keys present

2. Verify Iteration (2 min)
   ├─ Task actually running
   ├─ Not cancelled prematurely
   ├─ Stored in property (not local)
   └─ Awaiting updates

3. Check Background Setup (5 min)
   ├─ Background mode capability
   ├─ CLBackgroundActivitySession held
   ├─ Session started from foreground
   └─ Recovery on relaunch

4. Inspect Diagnostic Properties (3 min)
   ├─ update.authorizationDenied
   ├─ update.locationUnavailable
   ├─ update.accuracyLimited
   └─ update.isStationary
```

## Diagnostic Patterns

### Pattern 1: No Location Updates
**Symptom**: `for try await update in CLLocationUpdate.liveUpdates()` never yields
**Diagnosis**: Check authorizationStatus and Info.plist
**Fix**: Add NSLocationWhenInUseUsageDescription, request authorization

### Pattern 2: Background Stops Working
**Symptom**: Updates stop when app backgrounded
**Diagnosis**: Missing CLBackgroundActivitySession or background mode
**Fix**: Add capability, hold session in property (not local variable)

### Pattern 3: Geofence Never Triggers
**Symptom**: CLMonitor events never fire
**Diagnosis**: At 20-condition limit, radius < 100m, or not awaiting events
**Fix**: Check condition count, increase radius, ensure Task awaits events

### Pattern 4: Authorization Always Denied
**Symptom**: Fresh install immediately denied
**Diagnosis**: Missing or empty Info.plist usage strings
**Fix**: Add compelling NSLocationWhenInUseUsageDescription

### Pattern 5: Location Icon Persists
**Symptom**: Arrow icon stays after feature done
**Diagnosis**: Task not cancelled, session not invalidated, or CLMonitor still active
**Fix**: Cancel Task, invalidate session, remove conditions

## Quick Reference

| Symptom | Check First | Common Fix |
|---------|-------------|------------|
| No updates | authorizationStatus | Add Info.plist key |
| Background stops | Background mode | Add capability + session |
| Always denied | Info.plist strings | Write compelling reason |
| Poor accuracy | accuracyAuthorization | Request temporary full |
| Geofence silent | condition count | Stay under 20 |
| Icon persists | Task/session state | Cancel/invalidate |

## Related Resources

- [core-location](/skills/integration/core-location) — Implementation patterns and decision trees
- [core-location-ref](/reference/core-location-ref) — Complete API reference
- [energy-diag](/diagnostic/energy-diag) — Location as battery drain source

## Documentation Scope

This is a **diagnostic skill** — systematic troubleshooting workflows for Core Location issues.

#### Diagnostic includes
- 6 symptom-based decision trees
- 5 common mistake patterns with fixes
- Quick reference table for fast diagnosis
- Console debugging commands

**Vs Reference**: Diagnostic skills provide symptom-based troubleshooting. Reference skills provide comprehensive API information.

## Resources

**WWDC**: 2023-10180, 2023-10147, 2024-10212

**Docs**: /corelocation, /corelocation/clmonitor, /corelocation/cllocationupdate
