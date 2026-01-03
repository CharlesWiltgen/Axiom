---
name: core-location-ref
description: CLLocationUpdate, CLMonitor, CLServiceSession, CLBackgroundActivitySession APIs for iOS 17+
---

# Core Location Reference

Complete API reference for modern Core Location (iOS 17+). Covers CLLocationUpdate, CLMonitor, CLServiceSession, CLBackgroundActivitySession, authorization patterns, and legacy API migration.

## When to Use This Reference

Use this reference when you need:
- CLLocationUpdate AsyncSequence patterns
- CLMonitor geofencing implementation
- CLServiceSession declarative authorization (iOS 18+)
- CLBackgroundActivitySession for background updates
- Authorization state handling
- Legacy CLLocationManager migration patterns

**For troubleshooting:** See [core-location-diag](/diagnostic/core-location-diag) for location issues.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I use CLLocationUpdate with async/await?"
- "What is CLMonitor and how do I set up geofencing?"
- "How do I implement CLServiceSession for authorization?"
- "What's the modern way to do background location updates?"
- "How do I handle the 20-geofence limit?"
- "What are the diagnostic properties on CLLocationUpdate?"
- "How do I migrate from CLLocationManager delegates?"

## What's Covered

### Modern APIs (iOS 17+)
- CLLocationUpdate with AsyncSequence
- LiveConfiguration options
- isStationary for automatic pause/resume
- CLMonitor for geofencing and beacons
- CircularGeographicCondition and BeaconIdentityCondition
- 20-condition limit management

### CLServiceSession (iOS 18+)
- Declarative authorization goals
- fullAccuracyPurposeKey for temporary precision
- Implicit sessions from liveUpdates iteration
- Diagnostic properties (authorizationDenied, insufficientlyInUse)
- Session layering patterns

### Background Location
- CLBackgroundActivitySession setup
- Background mode capability requirements
- App lifecycle through suspend/terminate
- Session recovery on relaunch

### Authorization
- Authorization levels and state machine
- Accuracy authorization (full vs reduced)
- Required Info.plist keys
- Legacy requestWhenInUseAuthorization patterns

### Legacy APIs (iOS 12-16)
- CLLocationManager delegate pattern
- Accuracy constants
- Region monitoring (deprecated)
- Significant location changes
- Visit monitoring

## Key Pattern

### iOS 17+ Location Updates

```swift
for try await update in CLLocationUpdate.liveUpdates() {
    if update.authorizationDenied {
        showLocationDeniedUI()
        break
    }
    if let location = update.location {
        processLocation(location)
    }
    if update.isStationary {
        // Updates pause automatically, resume when device moves
    }
}
```

### iOS 17+ Geofencing

```swift
let monitor = await CLMonitor("MyApp")
let condition = CLMonitor.CircularGeographicCondition(
    center: CLLocationCoordinate2D(latitude: 37.33, longitude: -122.01),
    radius: 100
)
await monitor.add(condition, identifier: "ApplePark")

for try await event in monitor.events {
    switch event.state {
    case .satisfied: handleEntry(event.identifier)
    case .unsatisfied: handleExit(event.identifier)
    case .unknown: break
    }
}
```

## Documentation Scope

This page documents the `core-location-ref` reference skill—complete API coverage Claude uses when you need specific Core Location APIs or implementation patterns.

**For architecture decisions:** See [core-location](/skills/integration/core-location) for when to use different monitoring approaches.

**For troubleshooting:** See [core-location-diag](/diagnostic/core-location-diag) for debugging location issues.

## Related

- [core-location](/skills/integration/core-location) — Authorization and monitoring strategy decisions
- [core-location-diag](/diagnostic/core-location-diag) — Location troubleshooting
- [energy-ref](/reference/energy-ref) — Location as battery subsystem

## Resources

**WWDC**: 2023-10180 (CLLocationUpdate), 2023-10147 (CLMonitor), 2024-10212 (CLServiceSession)

**Docs**: /corelocation, /corelocation/clmonitor, /corelocation/cllocationupdate, /corelocation/clservicesession
