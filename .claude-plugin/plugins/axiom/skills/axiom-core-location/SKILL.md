---
name: axiom-core-location
description: Use for Core Location implementation patterns - authorization strategy, monitoring strategy, accuracy selection, background location
license: MIT
compatibility: iOS 17+, iPadOS 17+, macOS 14+, watchOS 10+
metadata:
  version: "1.0.0"
  last-updated: "2026-01-03"
---

# Core Location Patterns

Discipline skill for Core Location implementation decisions. Prevents common authorization mistakes, battery drain, and background location failures.

## When to Use

- Choosing authorization strategy (When In Use vs Always)
- Deciding monitoring approach (continuous vs significant-change vs CLMonitor)
- Implementing geofencing or background location
- Debugging "location not working" issues
- Reviewing location code for anti-patterns

## Related Skills

- `axiom-core-location-ref` — API reference, code examples
- `axiom-core-location-diag` — Symptom-based troubleshooting
- `axiom-energy` — Location as battery subsystem

---

## Part 1: Anti-Patterns (with Time Costs)

### Anti-Pattern 1: Premature Always Authorization

**Wrong** (30-60% denial rate):
```swift
// First launch: "Can we have Always access?"
manager.requestAlwaysAuthorization()
```

**Right** (5-10% denial rate):
```swift
// Start with When In Use
CLServiceSession(authorization: .whenInUse)

// Later, when user triggers background feature:
CLServiceSession(authorization: .always)
```

**Time cost**: 15 min to fix code, but 30-60% of users permanently denied = feature adoption destroyed.

**Why**: Users deny aggressive requests. Start minimal, upgrade when user understands value.

---

### Anti-Pattern 2: Continuous Updates for Geofencing

**Wrong** (10x battery drain):
```swift
for try await update in CLLocationUpdate.liveUpdates() {
    if isNearTarget(update.location) {
        triggerGeofence()
    }
}
```

**Right** (system-managed, low power):
```swift
let monitor = await CLMonitor("Geofences")
let condition = CLMonitor.CircularGeographicCondition(
    center: target, radius: 100
)
await monitor.add(condition, identifier: "Target")

for try await event in monitor.events {
    if event.state == .satisfied { triggerGeofence() }
}
```

**Time cost**: 5 min to refactor, saves 10x battery.

---

### Anti-Pattern 3: Ignoring Stationary Detection

**Wrong** (wasted battery):
```swift
for try await update in CLLocationUpdate.liveUpdates() {
    processLocation(update.location)
    // Never stops, even when device stationary
}
```

**Right** (automatic pause/resume):
```swift
for try await update in CLLocationUpdate.liveUpdates() {
    if let location = update.location {
        processLocation(location)
    }
    if update.isStationary, let location = update.location {
        // Device stopped moving - updates pause automatically
        // Will resume when device moves again
        saveLastKnownLocation(location)
    }
}
```

**Time cost**: 2 min to add check, saves significant battery.

---

### Anti-Pattern 4: No Graceful Denial Handling

**Wrong** (broken UX):
```swift
for try await update in CLLocationUpdate.liveUpdates() {
    guard let location = update.location else { continue }
    // User denied - silent failure, no feedback
}
```

**Right** (graceful degradation):
```swift
for try await update in CLLocationUpdate.liveUpdates() {
    if update.authorizationDenied {
        showManualLocationPicker()
        break
    }
    if update.authorizationDeniedGlobally {
        showSystemLocationDisabledMessage()
        break
    }
    if let location = update.location {
        processLocation(location)
    }
}
```

**Time cost**: 10 min to add handling, prevents confused users.

---

### Anti-Pattern 5: Wrong Accuracy for Use Case

**Wrong** (battery drain for weather app):
```swift
// Weather app using navigation accuracy
CLLocationUpdate.liveUpdates(.automotiveNavigation)
```

**Right** (match accuracy to need):
```swift
// Weather: city-level is fine
CLLocationUpdate.liveUpdates(.default)  // or .fitness for runners

// Navigation: needs high accuracy
CLLocationUpdate.liveUpdates(.automotiveNavigation)
```

| Use Case | Configuration | Accuracy | Battery |
|----------|---------------|----------|---------|
| Navigation | `.automotiveNavigation` | ~5m | Highest |
| Fitness tracking | `.fitness` | ~10m | High |
| Store finder | `.default` | ~10-100m | Medium |
| Weather | `.default` | ~100m+ | Low |

**Time cost**: 1 min to change, significant battery savings.

---

### Anti-Pattern 6: Not Stopping Updates

**Wrong** (battery drain, location icon persists):
```swift
func viewDidLoad() {
    Task {
        for try await update in CLLocationUpdate.liveUpdates() {
            updateMap(update.location)
        }
    }
}
// User navigates away, updates continue forever
```

**Right** (cancel when done):
```swift
private var locationTask: Task<Void, Error>?

func startTracking() {
    locationTask = Task {
        for try await update in CLLocationUpdate.liveUpdates() {
            if Task.isCancelled { break }
            updateMap(update.location)
        }
    }
}

func stopTracking() {
    locationTask?.cancel()
    locationTask = nil
}
```

**Time cost**: 5 min to add cancellation, stops battery drain.

---

### Anti-Pattern 7: Ignoring CLServiceSession (iOS 18+)

**Wrong** (procedural authorization juggling):
```swift
func requestAuth() {
    switch manager.authorizationStatus {
    case .notDetermined:
        manager.requestWhenInUseAuthorization()
    case .authorizedWhenInUse:
        if needsFullAccuracy {
            manager.requestTemporaryFullAccuracyAuthorization(...)
        }
    // Complex state machine...
    }
}
```

**Right** (declarative goals):
```swift
// Just declare what you need - Core Location handles the rest
let session = CLServiceSession(authorization: .whenInUse)

// For feature needing full accuracy
let navSession = CLServiceSession(
    authorization: .whenInUse,
    fullAccuracyPurposeKey: "Navigation"
)

// Monitor diagnostics if needed
for try await diag in session.diagnostics {
    if diag.authorizationDenied { handleDenial() }
}
```

**Time cost**: 30 min to migrate, simpler code, fewer bugs.

---

## Part 2: Decision Trees

### Authorization Strategy

```
Q1: Does your feature REQUIRE background location?
├─ NO → Use .whenInUse
│   └─ Q2: Does any feature need precise location?
│       ├─ ALWAYS → Add fullAccuracyPurposeKey to session
│       └─ SOMETIMES → Layer full-accuracy session when feature active
│
└─ YES → Start with .whenInUse, upgrade to .always when user triggers feature
    └─ Q3: When does user first need background location?
        ├─ IMMEDIATELY (e.g., fitness tracker) → Request .always on first relevant action
        └─ LATER (e.g., geofence reminders) → Add .always session when user creates first geofence
```

### Monitoring Strategy

```
Q1: What are you monitoring for?
├─ USER POSITION (continuous tracking)
│   └─ Use CLLocationUpdate.liveUpdates()
│       └─ Q2: What activity?
│           ├─ Driving navigation → .automotiveNavigation
│           ├─ Walking/cycling nav → .otherNavigation
│           ├─ Fitness tracking → .fitness
│           ├─ Airplane apps → .airborne
│           └─ General → .default or omit
│
├─ ENTRY/EXIT REGIONS (geofencing)
│   └─ Use CLMonitor with CircularGeographicCondition
│       └─ Note: Maximum 20 conditions per app
│
├─ BEACON PROXIMITY
│   └─ Use CLMonitor with BeaconIdentityCondition
│       └─ Choose granularity: UUID only, UUID+major, UUID+major+minor
│
└─ SIGNIFICANT CHANGES ONLY (lowest power)
    └─ Use startMonitoringSignificantLocationChanges() (legacy)
        └─ Updates ~500m movements, works in background
```

### Accuracy Selection

```
Q1: What's the minimum accuracy that makes your feature work?
├─ TURN-BY-TURN NAV needs 5-10m → .automotiveNavigation / .otherNavigation
├─ FITNESS TRACKING needs 10-20m → .fitness
├─ STORE FINDER needs 100m → .default
├─ WEATHER/CITY needs 1km+ → .default (reduced accuracy acceptable)
└─ GEOFENCING uses system determination → CLMonitor handles it

Q2: Will user be moving fast?
├─ DRIVING (high speed) → .automotiveNavigation (extra processing for speed)
├─ CYCLING/WALKING → .otherNavigation
└─ STATIONARY/SLOW → .default

Always start with lowest acceptable accuracy. Higher accuracy = higher battery drain.
```

---

## Part 3: Pressure Scenarios

### Scenario 1: "Just Use Always Authorization"

**Context**: PM says "Users want location reminders. Just request Always access on first launch so it works."

**Pressure**: Ship fast, seems simpler.

**Reality**:
- 30-60% of users will deny Always authorization when asked upfront
- Users who deny can only re-enable in Settings (most won't)
- Feature adoption destroyed before users understand value

**Response**:
> "Always authorization has 30-60% denial rates when requested upfront. We should start with When In Use, then request Always upgrade when the user creates their first location reminder. This gives us a 5-10% denial rate because users understand why they need it."

**Evidence**: Apple's own guidance in WWDC 2024-10212: "CLServiceSessions should be taken proactively... hold one requiring full-accuracy when people engage a feature that would warrant a special ask for it."

---

### Scenario 2: "Location Isn't Working in Background"

**Context**: QA reports "App stops getting location when backgrounded."

**Pressure**: Quick fix before release.

**Wrong fixes**:
- Add all background modes
- Use `allowsBackgroundLocationUpdates = true` without understanding
- Request Always authorization

**Right diagnosis**:
1. Check background mode capability exists
2. Check CLBackgroundActivitySession is held (not deallocated)
3. Check session started from foreground
4. Check authorization level (.whenInUse works with CLBackgroundActivitySession)

**Response**:
> "Background location requires specific setup. Let me check: (1) Background mode capability, (2) CLBackgroundActivitySession held during tracking, (3) session started from foreground. Missing any of these causes silent failure."

**Checklist**:
```swift
// 1. Signing & Capabilities → Background Modes → Location updates
// 2. Hold session reference (property, not local variable)
var backgroundSession: CLBackgroundActivitySession?

func startBackgroundTracking() {
    // 3. Must start from foreground
    backgroundSession = CLBackgroundActivitySession()
    startLocationUpdates()
}
```

---

### Scenario 3: "Geofence Events Aren't Firing"

**Context**: Geofences work in testing but not in production for some users.

**Pressure**: "It works on my device" dismissal.

**Common causes**:
1. **Too many conditions**: Maximum 20 per app
2. **Radius too small**: Minimum ~100m for reliable triggering
3. **Overlapping regions**: Can cause confusion
4. **Not awaiting events**: Events only become lastEvent after handled
5. **Not reinitializing on launch**: Monitor must be recreated

**Response**:
> "Geofencing has several system constraints. Check: (1) Are we within the 20-condition limit? (2) Are all radii at least 100m? (3) Is the app reinitializing CLMonitor on launch? (4) Is the app always awaiting on monitor.events?"

**Diagnostic code**:
```swift
// Check condition count
let count = await monitor.identifiers.count
if count >= 20 {
    print("At 20-condition limit!")
}

// Check all conditions
for id in await monitor.identifiers {
    if let record = await monitor.record(for: id) {
        let condition = record.condition
        if let geo = condition as? CLMonitor.CircularGeographicCondition {
            if geo.radius < 100 {
                print("Radius too small: \(id)")
            }
        }
    }
}
```

---

## Part 4: Checklists

### Pre-Release Location Checklist

**Info.plist**:
- [ ] `NSLocationWhenInUseUsageDescription` with clear explanation
- [ ] `NSLocationAlwaysAndWhenInUseUsageDescription` if using Always (clear why background needed)
- [ ] `NSLocationDefaultAccuracyReduced` if reduced accuracy acceptable
- [ ] `NSLocationTemporaryUsageDescriptionDictionary` if requesting temporary full accuracy
- [ ] `UIBackgroundModes` includes `location` if background tracking

**Authorization**:
- [ ] Start with minimal authorization (.whenInUse)
- [ ] Upgrade to .always only when user triggers background feature
- [ ] Handle authorization denial gracefully (offer alternatives)
- [ ] Handle global location services disabled
- [ ] Test with reduced accuracy authorization

**Updates**:
- [ ] Using appropriate LiveConfiguration for use case
- [ ] Handling isStationary for pause/resume
- [ ] Cancelling location tasks when feature inactive
- [ ] Not using continuous updates for geofencing

**Testing**:
- [ ] Tested authorization denial flow
- [ ] Tested reduced accuracy mode
- [ ] Tested background-to-foreground transitions
- [ ] Tested app termination and relaunch recovery

### Background Location Checklist

**Setup**:
- [ ] Background mode capability added (Location updates)
- [ ] CLBackgroundActivitySession created and HELD (not local variable)
- [ ] Session started from foreground
- [ ] Updates restarted on background launch in didFinishLaunchingWithOptions

**Authorization**:
- [ ] Using .whenInUse with CLBackgroundActivitySession, OR
- [ ] Using .always (but only if needed beyond background indicator)

**Lifecycle**:
- [ ] Persisting "was tracking" state for relaunch recovery
- [ ] Recreating CLBackgroundActivitySession on background launch
- [ ] Restarting CLLocationUpdate iteration on launch
- [ ] CLMonitor reinitialized with same name on launch

**Testing**:
- [ ] Blue background location indicator appears when backgrounded
- [ ] Updates continue when app backgrounded
- [ ] Updates resume after app suspended and resumed
- [ ] Updates resume after app terminated and relaunched

---

## Part 5: iOS Version Considerations

| Feature | iOS Version | Notes |
|---------|-------------|-------|
| CLLocationUpdate | iOS 17+ | AsyncSequence API |
| CLMonitor | iOS 17+ | Replaces CLCircularRegion |
| CLBackgroundActivitySession | iOS 17+ | Background with blue indicator |
| CLServiceSession | iOS 18+ | Declarative authorization |
| Implicit service sessions | iOS 18+ | From iterating liveUpdates |
| CLLocationManager | iOS 2+ | Legacy but still works |

**For iOS 14-16 support**: Use CLLocationManager delegate pattern (see core-location-ref Part 7).

**For iOS 17+**: Prefer CLLocationUpdate and CLMonitor.

**For iOS 18+**: Add CLServiceSession for declarative authorization.

---

## Resources

**WWDC**: 2023-10180, 2023-10147, 2024-10212

**Docs**: /corelocation, /corelocation/clmonitor, /corelocation/cllocationupdate, /corelocation/clservicesession

**Skills**: axiom-core-location-ref, axiom-core-location-diag, axiom-energy
