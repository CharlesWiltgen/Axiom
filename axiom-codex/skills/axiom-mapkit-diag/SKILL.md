---
name: axiom-mapkit-diag
description: MapKit troubleshooting — annotations not appearing, region jumping, clustering not working, search failures, overlay rendering issues, user location problems
license: MIT
metadata:
  version: "1.0.0"
  last-updated: "2026-02-26"
---

# MapKit Diagnostics

Symptom-based MapKit troubleshooting. Start with the symptom you're seeing, follow the diagnostic path.

## Related Skills

- `axiom-mapkit` — Patterns, decision trees, anti-patterns
- `axiom-mapkit-ref` — API reference, code examples

---

## Quick Reference

| Symptom | Check First | Common Fix |
|---|---|---|
| Annotations not appearing | Coordinate values (lat/lng swapped?) | Verify coordinate, check viewFor delegate |
| Map region jumps/loops | updateUIView guard | Add region equality check |
| Slow with many annotations | Annotation count, view reuse | Enable clustering, implement view reuse |
| Clustering not working | clusteringIdentifier set? | Set same identifier on all views |
| Overlays not rendering | renderer delegate method | Return correct MKOverlayRenderer subclass |
| Search returns no results | resultTypes, region bias | Set appropriate resultTypes and region |
| User location not showing | Authorization status | Request CLLocationManager authorization first |
| Coordinates appear wrong | lat/lng order | MapKit uses (latitude, longitude) — verify data source |

---

## Symptom 1: Annotations Not Appearing

### Decision Tree

```
Q1: Are coordinates valid?
├─ 0,0 or NaN → Data source returning default/empty values
│   Fix: Validate coordinates before adding annotations
│   Debug: print("\(annotation.coordinate.latitude), \(annotation.coordinate.longitude)")
│
└─ Valid numbers → Check next

Q2: Are lat/lng swapped?
├─ YES (common with GeoJSON which uses [longitude, latitude]) → Swap values
│   GeoJSON: [lng, lat] — MapKit: CLLocationCoordinate2D(latitude:, longitude:)
│   Fix: CLLocationCoordinate2D(latitude: json[1], longitude: json[0])
│
└─ NO → Check next

Q3: (MKMapView) Is mapView(_:viewFor:) delegate returning nil for your annotations?
├─ Not implemented → System uses default pin (should appear)
├─ Returns nil → System uses default pin (should appear)
├─ Returns wrong view → Check implementation
│
└─ Check delegate is set

Q4: (MKMapView) Is delegate set?
├─ NO → mapView.delegate = self (or context.coordinator in UIViewRepresentable)
│   Without delegate: default pins appear. But if viewFor returns nil, check annotation type
│
└─ YES → Check next

Q5: (SwiftUI) Are annotations in Map content builder?
├─ NO → Annotations must be inside Map { ... } content closure
│   Fix: Map(position: $pos) { Marker("Name", coordinate: coord) }
│
└─ YES → Check next

Q6: Is the map region showing the annotation coordinates?
├─ Map centered elsewhere → Adjust camera/region to include annotation coordinates
│   Debug: Compare mapView.region with annotation coordinates
│   Fix: Use .automatic camera position or set region to fit annotations
│
└─ Region includes annotations → Check displayPriority

Q7: (MKMapView) Is displayPriority too low?
├─ .defaultLow → System may hide annotations at certain zoom levels
│   Fix: view.displayPriority = .required for must-show annotations
│
└─ .required → Annotation should appear — file a bug report with minimal repro
```

---

## Symptom 2: Map Region Jumping / Infinite Loops

### Decision Tree

```
Q1: (UIViewRepresentable) Is setRegion called in updateUIView without guard?
├─ YES → Classic infinite loop:
│   1. SwiftUI state changes → updateUIView called
│   2. updateUIView calls setRegion
│   3. setRegion triggers regionDidChangeAnimated delegate
│   4. Delegate updates SwiftUI state → back to step 1
│
│   Fix: Guard against unnecessary updates
│   if mapView.region.center.latitude != region.center.latitude
│      || mapView.region.center.longitude != region.center.longitude {
│       mapView.setRegion(region, animated: true)
│   }
│
│   Alternative: Use a flag in coordinator
│   coordinator.isUpdating = true
│   mapView.setRegion(region, animated: true)
│   coordinator.isUpdating = false
│   // In regionDidChangeAnimated: guard !isUpdating
│
└─ NO → Check next

Q2: Are multiple state sources fighting over the region?
├─ YES → Two bindings or state variables controlling the same region
│   Fix: Single source of truth for camera position
│   One @State var cameraPosition, not two conflicting values
│
└─ NO → Check next

Q3: (SwiftUI) Is MapCameraPosition properly bound?
├─ Using .constant() or recreating position on each render → Camera resets
│   Fix: @State private var cameraPosition: MapCameraPosition = .automatic
│   Use the binding: Map(position: $cameraPosition)
│
└─ Properly bound → Check next

Q4: Animation conflict?
├─ Using animated: true in updateUIView alongside SwiftUI animations → Double animation
│   Fix: Avoid animated: true in updateUIView, or disable SwiftUI animation for map
│
└─ NO → Check next

Q5: Is onMapCameraChange triggering state updates that move the camera?
├─ YES → Camera change → callback → state change → camera change
│   Fix: Only update non-camera state in the callback
│   Don't set cameraPosition inside onMapCameraChange
│
└─ NO → Check delegate implementation for unintended state mutations
```

---

## Symptom 3: Performance Issues

### Decision Tree

```
Q1: How many annotations?
├─ > 500 without clustering → Enable clustering
│   SwiftUI: .mapItemClusteringIdentifier("poi")
│   MKMapView: view.clusteringIdentifier = "poi"
│
├─ > 1000 → Consider visible-region filtering
│   Only load annotations within mapView.region
│   Use .onMapCameraChange to fetch when user scrolls
│
└─ < 500 → Check next

Q2: (MKMapView) Using dequeueReusableAnnotationView?
├─ NO → Every annotation creates a new view → memory spike
│   Fix: Register view class and dequeue in delegate
│   mapView.register(MKMarkerAnnotationView.self, forAnnotationViewWithReuseIdentifier: "marker")
│
└─ YES → Check next

Q3: Complex custom annotation views?
├─ YES → Rich SwiftUI views or complex UIViews per annotation
│   Fix: Pre-render to UIImage for MKAnnotationView.image
│   Or simplify to MKMarkerAnnotationView with glyph
│
└─ NO → Check next

Q4: Overlays with many coordinates?
├─ YES → Polylines/polygons with 10K+ points
│   Fix: Simplify geometry (Douglas-Peucker algorithm)
│   Or render at reduced detail for zoomed-out views
│
└─ NO → Check next

Q5: Geocoding in a loop?
├─ YES → CLGeocoder has rate limit (~1/second)
│   Fix: Batch geocoding, throttle requests, cache results
│   Use MKLocalSearch for batch lookups instead of per-item geocoding
│
└─ NO → Profile with Instruments → Time Profiler for CPU, Allocations for memory
```

---

## Symptom 4: Clustering Not Working

### Decision Tree

```
Q1: Is clusteringIdentifier set on annotation views?
├─ NO → Clustering requires an identifier on each annotation view
│   MKMapView: view.clusteringIdentifier = "poi" in viewFor delegate
│   SwiftUI: .mapItemClusteringIdentifier("poi") on content
│
└─ YES → Check next

Q2: Are ALL relevant views using the SAME identifier?
├─ NO → Different identifiers = different cluster groups
│   Fix: Use consistent identifier for annotations that should cluster together
│
└─ YES → Check next

Q3: (MKMapView) Is mapView(_:clusterAnnotationForMemberAnnotations:) needed?
├─ Not implemented → System creates default cluster
│   If you need custom cluster appearance, implement this delegate method
│
└─ Implemented → Check return value

Q4: Too few annotations in visible area?
├─ YES → Clustering only activates when annotations physically overlap
│   At low zoom (city level), 10 annotations might cluster
│   At high zoom (street level), same 10 might all be visible individually
│
└─ NO → Check next

Q5: (MKMapView) Are annotation views registered?
├─ NO → Register both individual and cluster view classes
│   mapView.register(MKMarkerAnnotationView.self, forAnnotationViewWithReuseIdentifier: "marker")
│
└─ YES → Verify viewFor delegate handles both MKClusterAnnotation and individual annotations
```

---

## Symptom 5: Overlays Not Rendering

### Decision Tree

```
Q1: (MKMapView) Is mapView(_:rendererFor:) delegate method implemented?
├─ NO → Overlays require a renderer — without this delegate method, nothing renders
│   Fix: Implement the delegate method, return appropriate renderer subclass
│
└─ YES → Check next

Q2: Is the correct renderer subclass returned?
├─ MKCircle → MKCircleRenderer
│   MKPolyline → MKPolylineRenderer
│   MKPolygon → MKPolygonRenderer
│   MKTileOverlay → MKTileOverlayRenderer
│   Mismatch → Crash or silent failure
│
└─ Correct → Check next

Q3: Is renderer styled?
├─ No strokeColor/fillColor/lineWidth set → Renderer exists but invisible
│   Fix: Set at minimum strokeColor and lineWidth
│   renderer.strokeColor = .systemBlue
│   renderer.lineWidth = 2
│
└─ Styled → Check next

Q4: Overlay level wrong?
├─ .aboveRoads → Overlay may be behind labels (hard to see)
│   Try: mapView.addOverlay(overlay, level: .aboveLabels)
│
└─ Check overlay coordinates match visible region

Q5: (SwiftUI) Using MapCircle/MapPolyline without styling?
├─ No .foregroundStyle or .stroke → May render transparent
│   Fix: MapCircle(center: coord, radius: 500)
│            .foregroundStyle(.blue.opacity(0.3))
│            .stroke(.blue, lineWidth: 2)
│
└─ Styled → Check coordinates are within visible map region
```

---

## Symptom 6: Search / Directions Failures

### Decision Tree

```
Q1: Network available?
├─ NO → MapKit search requires network connectivity
│   Fix: Check URLSession connectivity or NWPathMonitor
│
└─ YES → Check next

Q2: resultTypes too restrictive?
├─ Only .physicalFeature but searching for "Starbucks" → No results
│   Fix: Use .pointOfInterest for businesses, .address for streets
│   Or combine: [.pointOfInterest, .address]
│
└─ Appropriate → Check next

Q3: Region bias missing?
├─ NO region set → Results may be from anywhere in the world
│   Fix: request.region = mapView.region (or visible region)
│   This biases results to what the user can see
│
└─ Region set → Check next

Q4: Natural language query format?
├─ Structured format (lat/lng, codes) → Won't parse
│   Good: "coffee shops near San Francisco"
│   Good: "123 Main St"
│   Bad: "lat:37.7 lng:-122.4 coffee"
│   Bad: "POI_TYPE=cafe"
│
└─ Natural language → Check next

Q5: Rate limited?
├─ Getting errors after many requests → Apple rate-limits MapKit search
│   Fix: Throttle searches, use MKLocalSearchCompleter for autocomplete
│   Don't fire MKLocalSearch on every keystroke
│
└─ NO → Check next

Q6: (Directions) Source and destination valid?
├─ source or destination is nil → Request will fail
│   Fix: Verify both are valid MKMapItem instances
│   MKMapItem.forCurrentLocation() requires location authorization
│
└─ Both valid → Check transportType availability
    Transit directions not available in all regions
    Walking/driving available globally
```

---

## Symptom 7: User Location Not Showing

### Decision Tree

```
Q1: What is CLLocationManager.authorizationStatus?
├─ .notDetermined → Authorization never requested
│   Fix: Request authorization first, then enable user location
│   CLServiceSession(authorization: .whenInUse)
│
├─ .denied → User denied location access
│   Fix: Show UI explaining value, link to Settings
│
├─ .restricted → Parental controls block access
│   Fix: Inform user, cannot override
│
└─ .authorizedWhenInUse / .authorizedAlways → Check next

Q2: (MKMapView) Is showsUserLocation set to true?
├─ NO → mapView.showsUserLocation = true
│
└─ YES → Check next

Q3: (SwiftUI) Using UserAnnotation() in Map content?
├─ NO → Add UserAnnotation() inside Map { ... }
│
└─ YES → Check next

Q4: Running in Simulator?
├─ YES, no custom location set → Simulator doesn't have GPS
│   Fix: Debug menu → Location → Custom Location (or Apple/City Bicycle Ride/etc.)
│   Xcode: Debug → Simulate Location → pick a location
│
└─ Physical device → Check next

Q5: MapKit implicitly requests authorization — was it previously denied?
├─ MapKit shows no prompt if already denied
│   Check: Settings → Privacy & Security → Location Services → Your App
│   If "Never": User must manually re-enable
│
└─ Authorized → Check if location services enabled system-wide
    Settings → Privacy & Security → Location Services → toggle at top

Q6: Location icon appearing but blue dot not on screen?
├─ User is outside the visible map region
│   Fix: Use MapCameraPosition.userLocation(fallback: .automatic)
│   Or add MapUserLocationButton() in .mapControls
│
└─ See axiom-core-location-diag for deeper location troubleshooting
```

---

## Symptom 8: Coordinate System Confusion

Common coordinate mistakes that cause annotations to appear in wrong locations.

### MapKit vs GeoJSON

| System | Order | Example |
|---|---|---|
| MapKit (CLLocationCoordinate2D) | latitude, longitude | `CLLocationCoordinate2D(latitude: 37.77, longitude: -122.42)` |
| GeoJSON | longitude, latitude | `[-122.42, 37.77]` |
| Google Maps | latitude, longitude | Same as MapKit |
| PostGIS ST_MakePoint | longitude, latitude | Same as GeoJSON |

**The #1 coordinate bug**: Swapping lat/lng when parsing GeoJSON.

```swift
// ❌ WRONG: Using GeoJSON order directly
let coord = CLLocationCoordinate2D(
    latitude: geoJson[0],    // This is longitude!
    longitude: geoJson[1]    // This is latitude!
)

// ✅ RIGHT: GeoJSON is [lng, lat], MapKit wants (lat, lng)
let coord = CLLocationCoordinate2D(
    latitude: geoJson[1],
    longitude: geoJson[0]
)
```

### MKMapPoint vs CLLocationCoordinate2D

- `CLLocationCoordinate2D` — geographic coordinates (lat/lng in degrees)
- `MKMapPoint` — projected coordinates for flat map rendering
- Convert: `MKMapPoint(coordinate)` and `coordinate` property on MKMapPoint
- Never use MKMapPoint x/y as lat/lng — they're completely different number spaces

### Validation

```swift
func isValidCoordinate(_ coord: CLLocationCoordinate2D) -> Bool {
    coord.latitude >= -90 && coord.latitude <= 90
        && coord.longitude >= -180 && coord.longitude <= 180
        && !coord.latitude.isNaN && !coord.longitude.isNaN
}
```

If latitude > 90 or longitude > 180, coordinates are likely swapped or in wrong format.

---

## Console Debugging

### MapKit Logs

```bash
# View MapKit-related logs
log stream --predicate 'subsystem == "com.apple.MapKit"' --level debug

# Filter for your app
log stream --predicate 'process == "YourApp" AND (subsystem == "com.apple.MapKit" OR subsystem == "com.apple.CoreLocation")'
```

### Common Console Messages

| Message | Meaning |
|---|---|
| `No renderer for overlay` | Missing rendererFor delegate method |
| `Reuse identifier not registered` | Call register before dequeue |
| `CLLocationManager authorizationStatus is denied` | User denied location |

---

## Resources

**WWDC**: 2023-10043, 2024-10094

**Docs**: /mapkit, /mapkit/mklocalsearch

**Skills**: axiom-mapkit, axiom-mapkit-ref, axiom-core-location-diag
