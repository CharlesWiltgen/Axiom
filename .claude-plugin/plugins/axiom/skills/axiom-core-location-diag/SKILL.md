---
name: axiom-core-location-diag
description: Use for Core Location troubleshooting - no location updates, background location broken, authorization denied, geofence not triggering
license: MIT
compatibility: iOS 17+, iPadOS 17+, macOS 14+, watchOS 10+
metadata:
  version: "1.0.0"
  last-updated: "2026-01-03"
---

# Core Location Diagnostics

Symptom-based troubleshooting for Core Location issues.

## When to Use

- Location updates never arrive
- Background location stops working
- Authorization always denied
- Location accuracy unexpectedly poor
- Geofence events not triggering
- Location icon won't go away

## Related Skills

- `axiom-core-location` — Implementation patterns, decision trees
- `axiom-core-location-ref` — API reference, code examples
- `axiom-energy-diag` — Battery drain from location

---

## Symptom 1: Location Updates Never Arrive

### Quick Checks

```swift
// 1. Check authorization
let status = CLLocationManager().authorizationStatus
print("Authorization: \(status.rawValue)")
// 0=notDetermined, 1=restricted, 2=denied, 3=authorizedAlways, 4=authorizedWhenInUse

// 2. Check if location services enabled system-wide
print("Services enabled: \(CLLocationManager.locationServicesEnabled())")

// 3. Check accuracy authorization
let accuracy = CLLocationManager().accuracyAuthorization
print("Accuracy: \(accuracy == .fullAccuracy ? "full" : "reduced")")
```

### Decision Tree

```
Q1: What does authorizationStatus return?
├─ .notDetermined → Authorization never requested
│   Fix: Add CLServiceSession(authorization: .whenInUse) or requestWhenInUseAuthorization()
│
├─ .denied → User denied access
│   Fix: Show UI explaining why location needed, link to Settings
│
├─ .restricted → Parental controls block access
│   Fix: Inform user, offer manual location input
│
└─ .authorizedWhenInUse / .authorizedAlways → Check next

Q2: Is locationServicesEnabled() returning true?
├─ NO → Location services disabled system-wide
│   Fix: Show UI prompting user to enable in Settings → Privacy → Location Services
│
└─ YES → Check next

Q3: Are you iterating the AsyncSequence?
├─ NO → Updates only arrive when you await
│   Fix: Task { for try await update in CLLocationUpdate.liveUpdates() { ... } }
│
└─ YES → Check next

Q4: Is the Task cancelled or broken?
├─ YES → Task cancelled before updates arrived
│   Fix: Ensure Task lives long enough (store in property, not local)
│
└─ NO → Check next

Q5: Is location available? (iOS 17+)
├─ Check update.locationUnavailable
│   If true: Device cannot determine location (indoors, airplane mode, no GPS)
│   Fix: Wait or inform user to move to better location
│
└─ Check update.authorizationDenied / update.authorizationDeniedGlobally
    If true: Handle denial gracefully
```

### Info.plist Checklist

```xml
<!-- Required for any location access -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Your clear explanation here</string>

<!-- Required for Always authorization -->
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Your clear explanation here</string>
```

Missing these keys = silent failure with no prompt.

---

## Symptom 2: Background Location Not Working

### Quick Checks

1. **Background mode capability**: Xcode → Signing & Capabilities → Background Modes → Location updates
2. **Info.plist**: Should have `UIBackgroundModes` with `location` value
3. **CLBackgroundActivitySession**: Must be created AND held

### Decision Tree

```
Q1: Is "Location updates" checked in Background Modes?
├─ NO → Background location silently disabled
│   Fix: Xcode → Signing & Capabilities → Background Modes → Location updates
│
└─ YES → Check next

Q2: Are you holding CLBackgroundActivitySession?
├─ NO / Using local variable → Session deallocates, background stops
│   Fix: Store in property: var backgroundSession: CLBackgroundActivitySession?
│
└─ YES → Check next

Q3: Was session started from foreground?
├─ NO → Cannot start new session from background
│   Fix: Create CLBackgroundActivitySession while app in foreground
│
└─ YES → Check next

Q4: Is app being terminated and not recovering?
├─ YES → Not recreating session on relaunch
│   Fix: In didFinishLaunchingWithOptions:
│         if wasTrackingLocation {
│             backgroundSession = CLBackgroundActivitySession()
│             startLocationUpdates()
│         }
│
└─ NO → Check authorization level

Q5: What is authorization level?
├─ .authorizedWhenInUse → This is fine with CLBackgroundActivitySession
│   The blue indicator allows background access
│
├─ .authorizedAlways → Should work, check session lifecycle
│
└─ .denied → No background access possible
```

### Common Mistakes

```swift
// ❌ WRONG: Local variable deallocates immediately
func startTracking() {
    let session = CLBackgroundActivitySession()  // Dies at end of function!
    startLocationUpdates()
}

// ✅ RIGHT: Property keeps session alive
var backgroundSession: CLBackgroundActivitySession?

func startTracking() {
    backgroundSession = CLBackgroundActivitySession()
    startLocationUpdates()
}
```

---

## Symptom 3: Authorization Always Denied

### Decision Tree

```
Q1: Is this a fresh install or returning user?
├─ FRESH INSTALL with immediate denial → Check Info.plist strings
│   Missing/empty NSLocationWhenInUseUsageDescription = automatic denial
│
└─ RETURNING USER → Check previous denial

Q2: Did user previously deny?
├─ YES → User must manually re-enable in Settings
│   Fix: Show UI explaining value, with button to open Settings:
│        UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)
│
└─ NO → Check next

Q3: Are you requesting authorization at wrong time?
├─ Requesting when app not "in use" → insufficientlyInUse
│   Check: update.insufficientlyInUse or diagnostic.insufficientlyInUse
│   Fix: Only request authorization from foreground, during user interaction
│
└─ NO → Check next

Q4: Is device in restricted mode?
├─ YES → .restricted status (parental controls, MDM)
│   Fix: Cannot override. Offer manual location input.
│
└─ NO → Check Info.plist again

Q5: Are Info.plist strings compelling?
├─ Generic string → Users more likely to deny
│   Bad: "This app needs your location"
│   Good: "Your location helps us show restaurants within walking distance"
│
└─ Review: Look at string from user's perspective
```

### Info.plist String Best Practices

```xml
<!-- ❌ BAD: Vague, no value proposition -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location.</string>

<!-- ✅ GOOD: Specific benefit to user -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Your location helps show restaurants, coffee shops, and attractions within walking distance.</string>

<!-- ❌ BAD: No explanation for Always -->
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location always.</string>

<!-- ✅ GOOD: Explains background benefit -->
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Enable background location to receive reminders when you arrive at saved places, even when the app is closed.</string>
```

---

## Symptom 4: Location Accuracy Unexpectedly Poor

### Quick Checks

```swift
// 1. Check accuracy authorization
let accuracy = CLLocationManager().accuracyAuthorization
print("Accuracy auth: \(accuracy == .fullAccuracy ? "full" : "reduced")")

// 2. Check update's accuracy flag (iOS 17+)
for try await update in CLLocationUpdate.liveUpdates() {
    if update.accuracyLimited {
        print("Accuracy limited - updates every 15-20 min")
    }
    if let location = update.location {
        print("Horizontal accuracy: \(location.horizontalAccuracy)m")
    }
}
```

### Decision Tree

```
Q1: What is accuracyAuthorization?
├─ .reducedAccuracy → User chose approximate location
│   Options:
│   1. Accept reduced accuracy (weather, city-level features)
│   2. Request temporary full accuracy:
│      CLServiceSession(authorization: .whenInUse, fullAccuracyPurposeKey: "Navigation")
│   3. Explain value and link to Settings
│
└─ .fullAccuracy → Check environment and configuration

Q2: What is horizontalAccuracy on locations?
├─ > 100m → Likely using WiFi/cell only (no GPS)
│   Causes: Indoors, airplane mode, dense urban canyon
│   Fix: User needs to move to better location, or wait for GPS lock
│
├─ 10-100m → Normal for most use cases
│   If need better: Use .automotiveNavigation or .otherNavigation config
│
└─ < 10m → Good GPS accuracy
    Note: .automotiveNavigation can achieve ~5m

Q3: What LiveConfiguration are you using?
├─ .default or none → System manages, may prioritize battery
│   If need more accuracy: Use .fitness, .otherNavigation, or .automotiveNavigation
│
├─ .fitness → Good for pedestrian activities
│
└─ .automotiveNavigation → Highest accuracy, axiom-highest battery
    Only use for actual navigation

Q4: Is the location stale?
├─ Check location.timestamp
│   If old: Device hasn't moved, or updates paused (isStationary)
│
└─ If timestamp recent but accuracy poor: Environmental issue
```

### Requesting Temporary Full Accuracy (iOS 18+)

```swift
// Requires Info.plist entry:
// NSLocationTemporaryUsageDescriptionDictionary
//   NavigationPurpose: "Precise location enables turn-by-turn directions"

let session = CLServiceSession(
    authorization: .whenInUse,
    fullAccuracyPurposeKey: "NavigationPurpose"
)
```

---

## Symptom 5: Geofence Events Not Triggering

### Quick Checks

```swift
let monitor = await CLMonitor("MyMonitor")

// 1. Check condition count (max 20)
let count = await monitor.identifiers.count
print("Conditions: \(count)/20")

// 2. Check specific condition
if let record = await monitor.record(for: "MyGeofence") {
    let lastEvent = record.lastEvent
    print("State: \(lastEvent.state)")
    print("Date: \(lastEvent.date)")

    if let geo = record.condition as? CLMonitor.CircularGeographicCondition {
        print("Center: \(geo.center)")
        print("Radius: \(geo.radius)m")
    }
}
```

### Decision Tree

```
Q1: How many conditions are monitored?
├─ 20 → At the limit, new conditions ignored
│   Fix: Prioritize important conditions, swap dynamically based on user location
│   Check: lastEvent.conditionLimitExceeded
│
└─ < 20 → Check next

Q2: What is the radius?
├─ < 100m → Unreliable, may not trigger
│   Fix: Use minimum 100m radius for reliable detection
│
└─ >= 100m → Check next

Q3: Is the app awaiting monitor.events?
├─ NO → Events not processed, lastEvent not updated
│   Fix: Always have a Task awaiting:
│        for try await event in monitor.events { ... }
│
└─ YES → Check next

Q4: Was monitor reinitialized on app launch?
├─ NO → Monitor conditions lost after termination
│   Fix: Recreate monitor with same name in didFinishLaunchingWithOptions
│
└─ YES → Check next

Q5: What does lastEvent show?
├─ state: .unknown → System hasn't determined state yet
│   Wait for determination, or check if monitoring is working
│
├─ state: .satisfied → Inside region, waiting for exit
│
├─ state: .unsatisfied → Outside region, waiting for entry
│
└─ Check lastEvent.date → When was last update?
    If very old: May not be monitoring correctly

Q6: Is accuracyLimited preventing monitoring?
├─ Check: lastEvent.accuracyLimited
│   If true: Reduced accuracy prevents geofencing
│   Fix: Request full accuracy or accept limitation
│
└─ NO → Check environment (device must have location access)
```

### Common Mistakes

```swift
// ❌ WRONG: Not awaiting events
let monitor = await CLMonitor("Test")
await monitor.add(condition, identifier: "Place")
// Nothing happens - no Task awaiting events!

// ✅ RIGHT: Always await events
let monitor = await CLMonitor("Test")
await monitor.add(condition, identifier: "Place")

Task {
    for try await event in monitor.events {
        switch event.state {
        case .satisfied: handleEntry(event.identifier)
        case .unsatisfied: handleExit(event.identifier)
        case .unknown: break
        @unknown default: break
        }
    }
}

// ❌ WRONG: Creating multiple monitors with same name
let monitor1 = await CLMonitor("App")  // OK
let monitor2 = await CLMonitor("App")  // UNDEFINED BEHAVIOR

// ✅ RIGHT: One monitor instance per name
class LocationService {
    private var monitor: CLMonitor?

    func setup() async {
        monitor = await CLMonitor("App")
    }
}
```

---

## Symptom 6: Location Icon Won't Go Away

### Quick Checks

The location arrow appears when:
- App actively receiving location updates
- CLMonitor is monitoring conditions
- Background activity session active

### Decision Tree

```
Q1: Is your app still iterating liveUpdates?
├─ YES → Updates continue until you break/cancel
│   Fix: Cancel the Task or break from loop:
│        locationTask?.cancel()
│
└─ NO → Check next

Q2: Is CLBackgroundActivitySession still held?
├─ YES → Session keeps location access active
│   Fix: Invalidate when done:
│        backgroundSession?.invalidate()
│        backgroundSession = nil
│
└─ NO → Check next

Q3: Is CLMonitor still monitoring conditions?
├─ YES → CLMonitor uses location for geofencing
│   Note: This is expected behavior - icon shows monitoring active
│   Fix: If truly done, remove all conditions:
│        for id in await monitor.identifiers {
│            await monitor.remove(id)
│        }
│
└─ NO → Check next

Q4: Is legacy CLLocationManager still running?
├─ Check: manager.stopUpdatingLocation() called?
│   Check: manager.stopMonitoring(for: region) for all regions?
│   Fix: Ensure all legacy APIs stopped
│
└─ NO → Check other location-using frameworks

Q5: Other frameworks using location?
├─ MapKit with showsUserLocation = true → Shows location
│   Fix: mapView.showsUserLocation = false when not needed
│
├─ Core Motion with location → Shows location
│
└─ Check all location-using code
```

### Force Stop All Location

```swift
// Stop modern APIs
locationTask?.cancel()
backgroundSession?.invalidate()
backgroundSession = nil

// Remove all CLMonitor conditions
for id in await monitor.identifiers {
    await monitor.remove(id)
}

// Stop legacy APIs
manager.stopUpdatingLocation()
manager.stopMonitoringSignificantLocationChanges()
manager.stopMonitoringVisits()

for region in manager.monitoredRegions {
    manager.stopMonitoring(for: region)
}
```

---

## Console Debugging

### Filter Location Logs

```bash
# View locationd logs
log stream --predicate 'subsystem == "com.apple.locationd"' --level debug

# View your app's location-related logs
log stream --predicate 'subsystem == "com.apple.CoreLocation"' --level debug

# Filter for specific process
log stream --predicate 'process == "YourAppName" AND subsystem == "com.apple.CoreLocation"'
```

### Common Log Messages

| Log Message | Meaning |
|-------------|---------|
| `Client is not authorized` | Authorization denied or not requested |
| `Location services disabled` | System-wide toggle off |
| `Accuracy authorization is reduced` | User chose approximate location |
| `Condition limit exceeded` | At 20-condition maximum |
| `Background location access denied` | Missing background capability or session |

---

## Resources

**WWDC**: 2023-10180, 2023-10147, 2024-10212

**Docs**: /corelocation, /corelocation/clmonitor, /corelocation/cllocationupdate

**Skills**: axiom-core-location, axiom-core-location-ref, axiom-energy-diag
