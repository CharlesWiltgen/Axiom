---
name: axiom-core-location-ref
description: Use for Core Location API reference - CLLocationUpdate, CLMonitor, CLServiceSession, authorization, background location, geofencing
user-invocable: true
skill_type: reference
version: 1.0.0
apple_platforms: iOS 17+, iPadOS 17+, macOS 14+, watchOS 10+
last_updated: 2026-01-03
---

# Core Location Reference

Comprehensive API reference for modern Core Location (iOS 17+).

## When to Use

- Need API signatures for CLLocationUpdate, CLMonitor, CLServiceSession
- Implementing geofencing or region monitoring
- Configuring background location updates
- Understanding authorization patterns
- Debugging location service issues

## Related Skills

- `axiom-core-location` — Anti-patterns, decision trees, pressure scenarios
- `axiom-core-location-diag` — Symptom-based troubleshooting
- `axiom-energy-ref` — Location as battery subsystem (accuracy vs power)

---

## Part 1: Modern API Overview (iOS 17+)

Four key classes replace legacy CLLocationManager patterns:

| Class | Purpose | iOS |
|-------|---------|-----|
| `CLLocationUpdate` | AsyncSequence for location updates | 17+ |
| `CLMonitor` | Condition-based geofencing/beacons | 17+ |
| `CLServiceSession` | Declarative authorization goals | 18+ |
| `CLBackgroundActivitySession` | Background location support | 17+ |

**Migration path**: Legacy CLLocationManager still works, but new APIs provide:
- Swift concurrency (async/await)
- Automatic pause/resume
- Simplified authorization
- Better battery efficiency

---

## Part 2: CLLocationUpdate API

### Basic Usage

```swift
import CoreLocation

Task {
    do {
        for try await update in CLLocationUpdate.liveUpdates() {
            if let location = update.location {
                // Process location
            }
            if update.isStationary {
                break // Stop when user stops moving
            }
        }
    } catch {
        // Handle location errors
    }
}
```

### LiveConfiguration Options

```swift
CLLocationUpdate.liveUpdates(.default)
CLLocationUpdate.liveUpdates(.automotiveNavigation)
CLLocationUpdate.liveUpdates(.otherNavigation)
CLLocationUpdate.liveUpdates(.fitness)
CLLocationUpdate.liveUpdates(.airborne)
```

Choose based on use case. If unsure, use `.default` or omit parameter.

### Key Properties

| Property | Type | Description |
|----------|------|-------------|
| `location` | `CLLocation?` | Current location (nil if unavailable) |
| `isStationary` | `Bool` | True when device stopped moving |
| `authorizationDenied` | `Bool` | User denied location access |
| `authorizationDeniedGlobally` | `Bool` | Location services disabled system-wide |
| `authorizationRequestInProgress` | `Bool` | Awaiting user authorization decision |
| `accuracyLimited` | `Bool` | Reduced accuracy (updates every 15-20 min) |
| `locationUnavailable` | `Bool` | Cannot determine location |
| `insufficientlyInUse` | `Bool` | Can't request auth (not in foreground) |

### Automatic Pause/Resume

When device becomes stationary:
1. Final update delivered with `isStationary = true` and valid `location`
2. Updates pause (saves battery)
3. When device moves, updates resume with `isStationary = false`

No action required—happens automatically.

### AsyncSequence Operations

```swift
// Get first location with speed > 10 m/s
let fastUpdate = try await CLLocationUpdate.liveUpdates()
    .first { $0.location?.speed ?? 0 > 10 }

// WARNING: Avoid filters that may never match (e.g., horizontalAccuracy < 1)
```

---

## Part 3: CLMonitor API

Swift actor for monitoring geographic conditions and beacons.

### Basic Geofencing

```swift
let monitor = await CLMonitor("MyMonitor")

// Add circular region
let condition = CLMonitor.CircularGeographicCondition(
    center: CLLocationCoordinate2D(latitude: 37.33, longitude: -122.01),
    radius: 100
)
await monitor.add(condition, identifier: "ApplePark")

// Await events
for try await event in monitor.events {
    switch event.state {
    case .satisfied:  // User entered region
        handleEntry(event.identifier)
    case .unsatisfied:  // User exited region
        handleExit(event.identifier)
    case .unknown:
        break
    @unknown default:
        break
    }
}
```

### CircularGeographicCondition

```swift
CLMonitor.CircularGeographicCondition(
    center: CLLocationCoordinate2D,
    radius: CLLocationDistance  // meters, minimum ~100m effective
)
```

### BeaconIdentityCondition

Three granularity levels:

```swift
// All beacons with UUID (any site)
CLMonitor.BeaconIdentityCondition(uuid: myUUID)

// Specific site (UUID + major)
CLMonitor.BeaconIdentityCondition(uuid: myUUID, major: 100)

// Specific beacon (UUID + major + minor)
CLMonitor.BeaconIdentityCondition(uuid: myUUID, major: 100, minor: 5)
```

### Condition Limit

**Maximum 20 conditions per app.** Prioritize what to monitor. Swap regions dynamically based on user location if needed.

### Adding with Assumed State

```swift
// If you know initial state
await monitor.add(condition, identifier: "Work", assuming: .unsatisfied)
```

Core Location will correct if assumption wrong.

### Accessing Records

```swift
// Get single record
if let record = await monitor.record(for: "ApplePark") {
    let condition = record.condition
    let lastEvent = record.lastEvent
    let state = lastEvent.state
    let date = lastEvent.date
}

// Get all identifiers
let allIds = await monitor.identifiers
```

### Event Properties

| Property | Description |
|----------|-------------|
| `identifier` | String identifier of condition |
| `state` | `.satisfied`, `.unsatisfied`, `.unknown` |
| `date` | When state changed |
| `refinement` | For wildcard beacons, actual UUID/major/minor detected |
| `conditionLimitExceeded` | Too many conditions (max 20) |
| `conditionUnsupported` | Condition type not available |
| `accuracyLimited` | Reduced accuracy prevents monitoring |

### Critical Requirements

1. **One monitor per name** — Only one instance with given name at a time
2. **Always await events** — Events only become `lastEvent` after handling
3. **Reinitialize on launch** — Recreate monitor in `didFinishLaunchingWithOptions`

---

## Part 4: CLServiceSession API (iOS 18+)

Declarative authorization—tell Core Location what you need, not what to do.

### Basic Usage

```swift
// Hold session for duration of feature
let session = CLServiceSession(authorization: .whenInUse)

for try await update in CLLocationUpdate.liveUpdates() {
    // Process updates
}
```

### Authorization Requirements

```swift
CLServiceSession(authorization: .none)       // No auth request
CLServiceSession(authorization: .whenInUse)  // Request When In Use
CLServiceSession(authorization: .always)     // Request Always (must start in foreground)
```

### Full Accuracy Request

```swift
// For features requiring precise location (e.g., navigation)
CLServiceSession(
    authorization: .whenInUse,
    fullAccuracyPurposeKey: "NavigationPurpose"  // Key in Info.plist
)
```

Requires `NSLocationTemporaryUsageDescriptionDictionary` in Info.plist.

### Implicit Sessions

Iterating `CLLocationUpdate.liveUpdates()` or `CLMonitor.events` creates implicit session with `.whenInUse` goal.

To disable implicit sessions:
```xml
<!-- Info.plist -->
<key>NSLocationRequireExplicitServiceSession</key>
<true/>
```

### Session Layering

Don't replace sessions—layer them:

```swift
// Base session for app
let baseSession = CLServiceSession(authorization: .whenInUse)

// Additional session when navigation feature active
let navSession = CLServiceSession(
    authorization: .whenInUse,
    fullAccuracyPurposeKey: "Nav"
)
// Both sessions active simultaneously
```

### Diagnostic Properties

```swift
for try await diagnostic in session.diagnostics {
    if diagnostic.authorizationDenied {
        // User denied—offer alternative
    }
    if diagnostic.authorizationDeniedGlobally {
        // Location services off system-wide
    }
    if diagnostic.insufficientlyInUse {
        // Can't request auth (not foreground)
    }
    if diagnostic.alwaysAuthorizationDenied {
        // Always auth specifically denied
    }
    if !diagnostic.authorizationRequestInProgress {
        // Decision made (granted or denied)
        break
    }
}
```

### Session Lifecycle

Sessions persist through:
- App backgrounding
- App suspension
- App termination (Core Location tracks)

On relaunch, recreate sessions immediately in `didFinishLaunchingWithOptions`.

---

## Part 5: Authorization State Machine

### Authorization Levels

| Status | Description |
|--------|-------------|
| `.notDetermined` | User hasn't decided |
| `.restricted` | Parental controls prevent access |
| `.denied` | User explicitly refused |
| `.authorizedWhenInUse` | Access while app active |
| `.authorizedAlways` | Background access |

### Accuracy Authorization

| Value | Description |
|-------|-------------|
| `.fullAccuracy` | Precise location |
| `.reducedAccuracy` | Approximate (~5km), updates every 15-20 min |

### Required Info.plist Keys

```xml
<!-- Required for When In Use -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to show nearby places</string>

<!-- Required for Always -->
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We track your location to send arrival reminders</string>

<!-- Optional: default to reduced accuracy -->
<key>NSLocationDefaultAccuracyReduced</key>
<true/>
```

### Legacy Authorization Pattern

```swift
@MainActor
class LocationManager: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            enableLocationFeatures()
        case .denied, .restricted:
            disableLocationFeatures()
        @unknown default:
            break
        }
    }
}
```

---

## Part 6: Background Location

### Requirements

1. **Background mode capability**: Signing & Capabilities → Background Modes → Location updates
2. **Info.plist**: Adds `UIBackgroundModes` with `location` value
3. **CLBackgroundActivitySession** or **LiveActivity**

### CLBackgroundActivitySession

```swift
// Create and HOLD reference (deallocation invalidates session)
var backgroundSession: CLBackgroundActivitySession?

func startBackgroundTracking() {
    // Must start from foreground
    backgroundSession = CLBackgroundActivitySession()

    Task {
        for try await update in CLLocationUpdate.liveUpdates() {
            processUpdate(update)
        }
    }
}

func stopBackgroundTracking() {
    backgroundSession?.invalidate()
    backgroundSession = nil
}
```

### Background Indicator

Blue status bar/pill appears when:
- App authorized as "When In Use"
- App receiving location in background
- CLBackgroundActivitySession active

### App Lifecycle

1. **Foreground → Background**: Session continues
2. **Background → Suspended**: Session preserved, updates pause
3. **Suspended → Terminated**: Core Location tracks session
4. **Terminated → Background launch**: Recreate session immediately

```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // Recreate background session if was tracking
    if wasTrackingLocation {
        backgroundSession = CLBackgroundActivitySession()
        startLocationUpdates()
    }
    return true
}
```

---

## Part 7: Legacy APIs (iOS 12-16)

### CLLocationManager Delegate Pattern

```swift
class LocationManager: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 10 // meters
    }

    func startUpdates() {
        manager.startUpdatingLocation()
    }

    func stopUpdates() {
        manager.stopUpdatingLocation()
    }

    func locationManager(_ manager: CLLocationManager,
                        didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        // Process location
    }
}
```

### Accuracy Constants

| Constant | Accuracy | Battery Impact |
|----------|----------|----------------|
| `kCLLocationAccuracyBestForNavigation` | ~5m | Highest |
| `kCLLocationAccuracyBest` | ~10m | Very High |
| `kCLLocationAccuracyNearestTenMeters` | ~10m | High |
| `kCLLocationAccuracyHundredMeters` | ~100m | Medium |
| `kCLLocationAccuracyKilometer` | ~1km | Low |
| `kCLLocationAccuracyThreeKilometers` | ~3km | Very Low |
| `kCLLocationAccuracyReduced` | ~5km | Lowest |

### Legacy Region Monitoring

```swift
// Deprecated in iOS 17, use CLMonitor instead
let region = CLCircularRegion(
    center: coordinate,
    radius: 100,
    identifier: "MyRegion"
)
region.notifyOnEntry = true
region.notifyOnExit = true
manager.startMonitoring(for: region)
```

### Significant Location Changes

Low-power alternative for coarse tracking:

```swift
manager.startMonitoringSignificantLocationChanges()
// Updates ~500m movements, works in background
```

### Visit Monitoring

Detect arrivals/departures:

```swift
manager.startMonitoringVisits()

func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
    let arrival = visit.arrivalDate
    let departure = visit.departureDate
    let coordinate = visit.coordinate
}
```

---

## Part 8: Geofencing Best Practices

### Region Size

- **Minimum effective radius**: ~100 meters
- **Smaller regions**: May not trigger reliably
- **Larger regions**: More reliable but less precise

### 20-Region Limit Strategy

```swift
// Dynamic region management
func updateMonitoredRegions(userLocation: CLLocation) async {
    let nearbyPOIs = fetchNearbyPOIs(around: userLocation, limit: 20)

    // Remove old regions
    for id in await monitor.identifiers {
        if !nearbyPOIs.contains(where: { $0.id == id }) {
            await monitor.remove(id)
        }
    }

    // Add new regions
    for poi in nearbyPOIs {
        let condition = CLMonitor.CircularGeographicCondition(
            center: poi.coordinate,
            radius: 100
        )
        await monitor.add(condition, identifier: poi.id)
    }
}
```

### Entry/Exit Timing

- **Entry**: Usually within seconds to minutes
- **Exit**: May take 3-5 minutes after leaving
- **Accuracy depends on**: Cell towers, WiFi, GPS availability

### Persistence

- Conditions persist across app launches
- Must reinitialize monitor with same name on launch
- Core Location wakes app for events

---

## Part 9: Testing and Simulation

### Xcode Location Simulation

1. Run on simulator
2. Debug → Simulate Location → Choose location
3. Or use custom GPX file

### Custom GPX Route

```xml
<?xml version="1.0"?>
<gpx version="1.1">
    <wpt lat="37.331686" lon="-122.030656">
        <time>2024-01-01T00:00:00Z</time>
    </wpt>
    <wpt lat="37.332686" lon="-122.031656">
        <time>2024-01-01T00:00:10Z</time>
    </wpt>
</gpx>
```

### Testing Authorization States

Settings → Privacy & Security → Location Services:
- Toggle app authorization
- Toggle system-wide location services
- Test reduced accuracy

### Console Filtering

```bash
# Filter location logs
log stream --predicate 'subsystem == "com.apple.locationd"'
```

---

## Part 10: Swift Concurrency Integration

### Task Cancellation

```swift
let locationTask = Task {
    for try await update in CLLocationUpdate.liveUpdates() {
        if Task.isCancelled { break }
        processUpdate(update)
    }
}

// Later
locationTask.cancel()
```

### MainActor Considerations

```swift
@MainActor
class LocationViewModel: ObservableObject {
    @Published var currentLocation: CLLocation?

    func startTracking() {
        Task {
            for try await update in CLLocationUpdate.liveUpdates() {
                // Already on MainActor, safe to update @Published
                self.currentLocation = update.location
            }
        }
    }
}
```

### Error Handling

```swift
Task {
    do {
        for try await update in CLLocationUpdate.liveUpdates() {
            if update.authorizationDenied {
                throw LocationError.authorizationDenied
            }
            processUpdate(update)
        }
    } catch {
        handleError(error)
    }
}
```

---

## Troubleshooting Quick Reference

| Symptom | Check |
|---------|-------|
| No location updates | Authorization status, Info.plist keys |
| Background not working | Background mode capability, CLBackgroundActivitySession |
| Always auth not effective | CLServiceSession with `.always`, started in foreground |
| Geofence not triggering | Region count (max 20), radius (min ~100m) |
| Reduced accuracy only | Check `accuracyAuthorization`, request temporary full accuracy |
| Location icon stays on | Ensure `stopUpdatingLocation()` or break from async loop |

---

## Resources

**WWDC**: 2023-10180, 2023-10147, 2024-10212

**Docs**: /corelocation, /corelocation/clmonitor, /corelocation/cllocationupdate, /corelocation/clservicesession

**Skills**: axiom-core-location, axiom-core-location-diag, axiom-energy-ref
