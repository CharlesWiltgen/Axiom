---
name: axiom-mapkit-ref
description: MapKit API reference — SwiftUI Map, MKMapView, Marker, Annotation, MKLocalSearch, MKDirections, Look Around, MKMapSnapshotter, clustering, overlays
license: MIT
metadata:
  version: "1.0.0"
  last-updated: "2026-02-26"
---

# MapKit API Reference

Complete MapKit API reference for iOS development. Covers both SwiftUI Map (iOS 17+) and MKMapView (UIKit).

## Related Skills

- `axiom-mapkit` — Decision trees, anti-patterns, pressure scenarios
- `axiom-mapkit-diag` — Symptom-based troubleshooting

---

## Part 1: Modern API Overview

| Feature | SwiftUI Map (iOS 17+) | MKMapView |
|---|---|---|
| Declaration | `Map(position:) { content }` | `MKMapView()` |
| Camera control | `MapCameraPosition` binding | `setRegion(_:animated:)` |
| Annotations | `Marker`, `Annotation` in content | `addAnnotation(_:)` + delegate |
| Overlays | `MapCircle`, `MapPolyline`, `MapPolygon` | `addOverlay(_:)` + renderer delegate |
| User location | `UserAnnotation()` | `showsUserLocation = true` |
| Selection | `.mapSelection($selection)` | delegate `didSelect` |
| Controls | `.mapControls { }` | `showsCompass`, `showsScale` |
| Interaction modes | `.mapInteractionModes([])` | delegate methods |
| Clustering | Built-in via `.mapItemClusteringIdentifier` | `MKClusterAnnotation` |

---

## Part 2: SwiftUI Map API

### Basic Map

```swift
@State private var cameraPosition: MapCameraPosition = .automatic

Map(position: $cameraPosition) {
    Marker("Home", coordinate: homeCoord)
    Annotation("Custom", coordinate: coord) {
        Image(systemName: "star.fill")
            .foregroundStyle(.yellow)
            .padding(4)
            .background(.blue, in: Circle())
    }
    UserAnnotation()
    MapCircle(center: coord, radius: 500)
        .foregroundStyle(.blue.opacity(0.3))
    MapPolyline(coordinates: routeCoords)
        .stroke(.blue, lineWidth: 3)
}
.mapStyle(.standard(elevation: .realistic))
.mapControls {
    MapUserLocationButton()
    MapCompass()
    MapScaleView()
}
```

### MapCameraPosition

Controls where the camera is positioned:

```swift
// System manages camera to show all content
.automatic

// Specific region
.region(MKCoordinateRegion(
    center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
    span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
))

// Specific camera with pitch and heading
.camera(MapCamera(
    centerCoordinate: coordinate,
    distance: 1000,    // meters from center
    heading: 90,       // degrees from north
    pitch: 60          // degrees from vertical (0 = top-down)
))

// Follow user location
.userLocation(followsHeading: true, fallback: .automatic)

// Show specific item
.item(mapItem)

// Show specific rect
.rect(MKMapRect(...))
```

#### Programmatic Camera Changes

```swift
// Animate to new position
withAnimation {
    cameraPosition = .region(newRegion)
}

// Keyframe animation (iOS 17+)
Map(position: $cameraPosition)
    .mapCameraKeyframeAnimator(trigger: flyToTrigger) { initialCamera in
        KeyframeTrack(\.centerCoordinate) {
            LinearKeyframe(destination, duration: 2.0)
        }
        KeyframeTrack(\.distance) {
            CubicKeyframe(5000, duration: 1.0)
            CubicKeyframe(1000, duration: 1.0)
        }
    }
```

### Map Selection

```swift
@State private var selectedItem: MKMapItem?

Map(position: $cameraPosition, selection: $selectedItem) {
    ForEach(mapItems, id: \.self) { item in
        Marker(item: item)
    }
}
.onChange(of: selectedItem) { _, newItem in
    if let newItem {
        // Handle selection
    }
}
```

### Camera Change Callback

```swift
Map(position: $cameraPosition) { ... }
    .onMapCameraChange { context in
        // context.region — visible MKCoordinateRegion
        // context.camera — current MapCamera
        // context.rect — visible MKMapRect
        fetchAnnotations(in: context.region)
    }
    .onMapCameraChange(frequency: .continuous) { context in
        // Called during gesture (not just at end)
    }
```

### Map Styles

```swift
.mapStyle(.standard)                              // Default
.mapStyle(.standard(elevation: .realistic))        // 3D buildings
.mapStyle(.standard(emphasis: .muted))             // Muted colors
.mapStyle(.standard(pointsOfInterest: .including([.restaurant, .cafe])))
.mapStyle(.imagery)                                // Satellite
.mapStyle(.imagery(elevation: .realistic))         // 3D satellite
.mapStyle(.hybrid)                                 // Satellite + labels
.mapStyle(.hybrid(elevation: .realistic))          // 3D hybrid
```

### Interaction Modes

```swift
// Allow all interactions (default)
.mapInteractionModes(.all)

// Read-only map (no interaction)
.mapInteractionModes([])

// Pan only, no zoom
.mapInteractionModes([.pan])

// Pan and zoom, no rotate/pitch
.mapInteractionModes([.pan, .zoom])
```

---

## Part 3: Map Content

### Marker

System-styled map marker with callout:

```swift
// Basic marker
Marker("Coffee Shop", coordinate: coord)

// With system image
Marker("Coffee Shop", systemImage: "cup.and.saucer.fill", coordinate: coord)

// With monogram (2 characters max)
Marker("Coffee Shop", monogram: Text("CS"), coordinate: coord)

// Color
Marker("Coffee Shop", coordinate: coord)
    .tint(.brown)

// From MKMapItem
Marker(item: mapItem)
```

### Annotation

Fully custom view at a coordinate:

```swift
Annotation("Custom Pin", coordinate: coord) {
    VStack {
        Image(systemName: "mappin.circle.fill")
            .font(.title)
            .foregroundStyle(.red)
        Text("Here")
            .font(.caption)
    }
}

// Anchor point (default is bottom center)
Annotation("Pin", coordinate: coord, anchor: .center) {
    Circle()
        .fill(.blue)
        .frame(width: 20, height: 20)
}
```

### UserAnnotation

Current user location indicator:

```swift
UserAnnotation()

// Custom appearance
UserAnnotation(anchor: .center) {
    Image(systemName: "location.circle.fill")
        .foregroundStyle(.blue)
}
```

### Shape Overlays

```swift
// Circle
MapCircle(center: coord, radius: 1000)  // radius in meters
    .foregroundStyle(.blue.opacity(0.2))
    .stroke(.blue, lineWidth: 2)

// Polygon
MapPolygon(coordinates: polygonCoords)
    .foregroundStyle(.green.opacity(0.3))
    .stroke(.green, lineWidth: 2)

// Polyline
MapPolyline(coordinates: routeCoords)
    .stroke(.blue, lineWidth: 4)

// From MKRoute
MapPolyline(route.polyline)
    .stroke(.blue, lineWidth: 5)
```

### Clustering

```swift
ForEach(locations) { location in
    Marker(location.name, coordinate: location.coordinate)
        .tag(location.id)
}
.mapItemClusteringIdentifier("locations")
```

---

## Part 4: MKMapView Lifecycle and Delegates

### Creating MKMapView in SwiftUI

```swift
struct MapViewWrapper: UIViewRepresentable {
    @Binding var region: MKCoordinateRegion
    let annotations: [MKAnnotation]

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator
        mapView.showsUserLocation = true
        mapView.register(
            MKMarkerAnnotationView.self,
            forAnnotationViewWithReuseIdentifier: "marker"
        )
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        // Guard against infinite loops
        if !regionsAreEqual(mapView.region, region) {
            mapView.setRegion(region, animated: true)
        }

        // Diff annotations instead of removing all
        let current = Set(mapView.annotations.compactMap { $0 as? MyAnnotation })
        let desired = Set(annotations.compactMap { $0 as? MyAnnotation })
        let toAdd = desired.subtracting(current)
        let toRemove = current.subtracting(desired)
        mapView.addAnnotations(Array(toAdd))
        mapView.removeAnnotations(Array(toRemove))
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    static func dismantleUIView(_ mapView: MKMapView, coordinator: Coordinator) {
        mapView.removeAnnotations(mapView.annotations)
        mapView.removeOverlays(mapView.overlays)
    }
}
```

### Key MKMapViewDelegate Methods

```swift
class Coordinator: NSObject, MKMapViewDelegate {
    var parent: MapViewWrapper

    init(_ parent: MapViewWrapper) {
        self.parent = parent
    }

    // Annotation view customization
    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        guard !(annotation is MKUserLocation) else { return nil }  // Use default for user

        let view = mapView.dequeueReusableAnnotationView(
            withIdentifier: "marker",
            for: annotation
        ) as! MKMarkerAnnotationView
        view.markerTintColor = .systemRed
        view.glyphImage = UIImage(systemName: "mappin")
        view.clusteringIdentifier = "poi"
        view.canShowCallout = true
        return view
    }

    // Overlay rendering
    func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
        if let circle = overlay as? MKCircle {
            let renderer = MKCircleRenderer(circle: circle)
            renderer.fillColor = UIColor.systemBlue.withAlphaComponent(0.2)
            renderer.strokeColor = .systemBlue
            renderer.lineWidth = 2
            return renderer
        }
        if let polyline = overlay as? MKPolyline {
            let renderer = MKPolylineRenderer(polyline: polyline)
            renderer.strokeColor = .systemBlue
            renderer.lineWidth = 4
            return renderer
        }
        if let polygon = overlay as? MKPolygon {
            let renderer = MKPolygonRenderer(polygon: polygon)
            renderer.fillColor = UIColor.systemGreen.withAlphaComponent(0.3)
            renderer.strokeColor = .systemGreen
            renderer.lineWidth = 2
            return renderer
        }
        return MKOverlayRenderer(overlay: overlay)
    }

    // Region change tracking
    func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
        parent.region = mapView.region
    }

    // Annotation selection
    func mapView(_ mapView: MKMapView, didSelect annotation: MKAnnotation) {
        // Handle tap
    }

    // Cluster annotation
    func mapView(
        _ mapView: MKMapView,
        clusterAnnotationForMemberAnnotations memberAnnotations: [MKAnnotation]
    ) -> MKClusterAnnotation {
        MKClusterAnnotation(memberAnnotations: memberAnnotations)
    }
}
```

---

## Part 5: Annotation Types and Customization

### MKMarkerAnnotationView (iOS 11+)

Balloon-shaped marker with glyph:

```swift
let view = MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: "marker")
view.markerTintColor = .systemPurple
view.glyphImage = UIImage(systemName: "star.fill")
view.glyphText = "A"                    // Text glyph (overrides image)
view.displayPriority = .required        // Always visible
view.clusteringIdentifier = "category"  // Enable clustering
view.canShowCallout = true
view.titleVisibility = .adaptive        // Show title based on space
view.subtitleVisibility = .hidden
```

### MKAnnotationView

Fully custom annotation view:

```swift
let view = MKAnnotationView(annotation: annotation, reuseIdentifier: "custom")
view.image = UIImage(named: "custom-pin")
view.centerOffset = CGPoint(x: 0, y: -view.image!.size.height / 2)
view.canShowCallout = true
view.leftCalloutAccessoryView = UIImageView(image: thumbnail)
view.rightCalloutAccessoryView = UIButton(type: .detailDisclosure)
```

### Custom Callout

```swift
func mapView(
    _ mapView: MKMapView,
    annotationView view: MKAnnotationView,
    calloutAccessoryControlTapped control: UIControl
) {
    guard let annotation = view.annotation as? MyAnnotation else { return }
    // Navigate to detail view
}
```

### Annotation View Reuse

Always use `dequeueReusableAnnotationView(withIdentifier:for:)`:

```swift
// Register in makeUIView (once)
mapView.register(MKMarkerAnnotationView.self, forAnnotationViewWithReuseIdentifier: "marker")

// Dequeue in delegate (every time)
func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
    let view = mapView.dequeueReusableAnnotationView(withIdentifier: "marker", for: annotation)
    // Configure...
    return view
}
```

Without reuse: 1000 annotations = 1000 views in memory.
With reuse: ~20-30 views recycled as user scrolls.

---

## Part 6: MKLocalSearch and MKLocalSearchCompleter

### MKLocalSearchCompleter — Real-Time Autocomplete

```swift
let completer = MKLocalSearchCompleter()
completer.delegate = self
completer.resultTypes = [.pointOfInterest, .address]
completer.region = visibleMapRegion    // Bias results to visible area

// Update on each keystroke
completer.queryFragment = "coffee"

// Delegate receives results
func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    let results = completer.results  // [MKLocalSearchCompletion]
    for result in results {
        // result.title — "Starbucks"
        // result.subtitle — "123 Main St, San Francisco, CA"
        // result.titleHighlightRanges — Ranges matching query
    }
}

func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
    // Network error, rate limit, etc.
}
```

### MKLocalSearch — Full Search

```swift
// From autocomplete completion
let request = MKLocalSearch.Request(completion: selectedCompletion)

// From natural language
let request = MKLocalSearch.Request()
request.naturalLanguageQuery = "coffee shops"
request.region = mapRegion                        // Bias results
request.resultTypes = .pointOfInterest            // Filter type
request.pointOfInterestFilter = MKPointOfInterestFilter(
    including: [.cafe, .restaurant]
)

let search = MKLocalSearch(request: request)
let response = try await search.start()

for item in response.mapItems {
    // item.name — "Starbucks"
    // item.placemark — MKPlacemark with address
    // item.placemark.coordinate — CLLocationCoordinate2D
    // item.phoneNumber — optional phone
    // item.url — optional website
    // item.pointOfInterestCategory — .cafe, .restaurant, etc.
}
```

### Result Types

```swift
// Filter what kind of results to return
request.resultTypes = .address           // Street addresses only
request.resultTypes = .pointOfInterest   // Businesses, landmarks
request.resultTypes = .physicalFeature   // Mountains, lakes, parks
request.resultTypes = .query             // Suggested search queries (iOS 18+)
request.resultTypes = [.pointOfInterest, .address]  // Multiple types
```

### Rate Limiting

- `MKLocalSearchCompleter` handles its own throttling — safe to call on every keystroke
- `MKLocalSearch` — Apple rate-limits these; don't fire more than ~1/second
- If rate-limited, you'll get an error in the completion handler
- Reuse `MKLocalSearchCompleter` instances — don't create new ones per query

---

## Part 7: MKDirections and MKRoute

### Calculate Directions

```swift
let request = MKDirections.Request()
request.source = MKMapItem.forCurrentLocation()
request.destination = destinationMapItem
request.transportType = .automobile
request.requestsAlternateRoutes = true   // Get multiple routes

let directions = MKDirections(request: request)
let response = try await directions.calculate()

for route in response.routes {
    route.polyline                  // MKPolyline — display on map
    route.expectedTravelTime       // TimeInterval in seconds
    route.distance                 // CLLocationDistance in meters
    route.name                     // "I-280 S" — route name
    route.advisoryNotices          // [String] — warnings
    route.steps                    // [MKRoute.Step] — turn-by-turn
}
```

### Transport Types

```swift
.automobile    // Driving directions
.walking       // Pedestrian directions
.transit       // Public transit (where available)
.any           // All modes
```

### ETA Only (Faster)

```swift
let directions = MKDirections(request: request)
let eta = try await directions.calculateETA()
eta.expectedTravelTime     // TimeInterval
eta.distance               // CLLocationDistance
eta.expectedArrivalDate    // Date
eta.expectedDepartureDate  // Date
eta.transportType          // MKDirectionsTransportType
```

### Turn-by-Turn Steps

```swift
for step in route.steps {
    step.instructions    // "Turn right onto Main St"
    step.distance        // CLLocationDistance in meters
    step.polyline        // MKPolyline for this step's segment
    step.transportType   // May change for transit routes
    step.notice          // Optional advisory
}
```

---

## Part 8: Look Around

### Check Availability

```swift
let request = MKLookAroundSceneRequest(coordinate: coordinate)
do {
    let scene = try await request.scene
    // scene is non-nil — Look Around available at this coordinate
} catch {
    // Look Around not available here
}
```

### SwiftUI

```swift
@State private var lookAroundScene: MKLookAroundScene?

LookAroundPreview(scene: $lookAroundScene)
    .frame(height: 200)

// Load scene
func loadLookAround(for coordinate: CLLocationCoordinate2D) async {
    let request = MKLookAroundSceneRequest(coordinate: coordinate)
    lookAroundScene = try? await request.scene
}
```

### UIKit

```swift
let controller = MKLookAroundViewController(scene: scene)
// Present modally or embed as child view controller
```

### Static Snapshot

```swift
let snapshotter = MKLookAroundSnapshotter(scene: scene, options: .init())
let snapshot = try await snapshotter.snapshot
let image = snapshot.image  // UIImage
```

---

## Part 9: Overlays and Renderers

### Adding Overlays (MKMapView)

```swift
// Circle
let circle = MKCircle(center: coordinate, radius: 1000)
mapView.addOverlay(circle)

// Polygon
let polygon = MKPolygon(coordinates: &coords, count: coords.count)
mapView.addOverlay(polygon)

// Polyline
let polyline = MKPolyline(coordinates: &coords, count: coords.count)
mapView.addOverlay(polyline, level: .aboveRoads)

// Custom tile overlay
let template = "https://tile.example.com/{z}/{x}/{y}.png"
let tileOverlay = MKTileOverlay(urlTemplate: template)
tileOverlay.canReplaceMapContent = true  // Hides Apple Maps base layer
mapView.addOverlay(tileOverlay, level: .aboveLabels)
```

### Renderer Delegate

```swift
func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
    switch overlay {
    case let circle as MKCircle:
        let renderer = MKCircleRenderer(circle: circle)
        renderer.fillColor = UIColor.systemBlue.withAlphaComponent(0.2)
        renderer.strokeColor = .systemBlue
        renderer.lineWidth = 2
        return renderer

    case let polyline as MKPolyline:
        let renderer = MKPolylineRenderer(polyline: polyline)
        renderer.strokeColor = .systemBlue
        renderer.lineWidth = 4
        return renderer

    case let polygon as MKPolygon:
        let renderer = MKPolygonRenderer(polygon: polygon)
        renderer.fillColor = UIColor.systemGreen.withAlphaComponent(0.3)
        renderer.strokeColor = .systemGreen
        renderer.lineWidth = 2
        return renderer

    case let tile as MKTileOverlay:
        return MKTileOverlayRenderer(tileOverlay: tile)

    default:
        return MKOverlayRenderer(overlay: overlay)
    }
}
```

### Overlay Levels

```swift
mapView.addOverlay(overlay, level: .aboveRoads)    // Above roads, below labels
mapView.addOverlay(overlay, level: .aboveLabels)   // Above everything
```

### Gradient Polyline

```swift
let renderer = MKGradientPolylineRenderer(polyline: polyline)
renderer.setColors([.green, .yellow, .red], locations: [0.0, 0.5, 1.0])
renderer.lineWidth = 6
```

---

## Part 10: Map Snapshots

Generate static map images for sharing, thumbnails, or offline display:

```swift
let options = MKMapSnapshotter.Options()
options.region = MKCoordinateRegion(
    center: coordinate,
    span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
)
options.size = CGSize(width: 300, height: 200)
options.scale = UIScreen.main.scale           // Retina support
options.mapType = .standard
options.showsBuildings = true
options.pointOfInterestFilter = .excludingAll  // Clean map

let snapshotter = MKMapSnapshotter(options: options)
let snapshot = try await snapshotter.start()
let image = snapshot.image

// Draw custom annotations on snapshot
UIGraphicsBeginImageContextWithOptions(image.size, true, image.scale)
image.draw(at: .zero)

let pinImage = UIImage(systemName: "mappin.circle.fill")!
let point = snapshot.point(for: coordinate)
pinImage.draw(at: CGPoint(
    x: point.x - pinImage.size.width / 2,
    y: point.y - pinImage.size.height
))

let finalImage = UIGraphicsGetImageFromCurrentImageContext()
UIGraphicsEndImageContext()
```

#### Snapshot Coordinate Conversion

```swift
// Convert coordinate to point in snapshot image
let point = snapshot.point(for: coordinate)

// Check if coordinate is in snapshot bounds
let isVisible = CGRect(origin: .zero, size: snapshot.image.size).contains(point)
```

---

## Part 11: iOS Version Feature Matrix

| Feature | iOS Version |
|---|---|
| MKMapView | 3.0+ |
| MKLocalSearch | 6.1+ |
| MKDirections | 7.0+ |
| MKMarkerAnnotationView | 11.0+ |
| MKMapSnapshotter | 7.0+ |
| MKLookAroundSceneRequest | 16.0+ |
| LookAroundPreview (SwiftUI) | 17.0+ |
| SwiftUI Map (content builder) | 17.0+ |
| MapCameraPosition | 17.0+ |
| .mapSelection | 17.0+ |
| .mapCameraKeyframeAnimator | 17.0+ |
| .onMapCameraChange | 17.0+ |
| MapUserLocationButton | 17.0+ |
| MapCompass | 17.0+ |
| MapScaleView | 17.0+ |
| .mapInteractionModes | 17.0+ |
| MKLocalSearch.ResultType.query | 18.0+ |

---

## Resources

**WWDC**: 2023-10043, 2024-10094

**Docs**: /mapkit, /mapkit/map, /mapkit/mklocalsearch, /mapkit/mkdirections

**Skills**: mapkit, mapkit-diag, core-location-ref
