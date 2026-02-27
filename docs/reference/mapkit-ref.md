# MapKit Reference

Complete MapKit API reference covering SwiftUI Map, MKMapView, annotations, search, directions, Look Around, and snapshots.

## When to Use This Reference

Use this reference when:
- Looking up SwiftUI Map content builder API
- Configuring MapCameraPosition for programmatic camera control
- Implementing MKLocalSearch or MKLocalSearchCompleter
- Setting up MKDirections for routing
- Working with Look Around scenes
- Checking iOS version requirements for MapKit features

## Example Prompts

- "What's the SwiftUI Map API for annotations?"
- "How do I use MapCameraPosition?"
- "What's the MKLocalSearch API for autocomplete?"
- "How do I calculate directions between two points?"
- "What iOS version added SwiftUI Map?"
- "How do I create a map snapshot image?"

## What's Covered

- SwiftUI Map API (content builder, camera position, map controls, styles, selection)
- Map content types (Marker, Annotation, UserAnnotation, shapes)
- MKMapView lifecycle and delegate methods
- Annotation customization and clustering
- MKLocalSearch and MKLocalSearchCompleter
- MKDirections and MKRoute
- Look Around (MKLookAroundScene, LookAroundPreview)
- Overlays and renderers
- Map snapshots (MKMapSnapshotter)
- iOS version feature matrix
- GeoToolbox framework and PlaceDescriptor (iOS 26+)
- MKGeocodingRequest and MKReverseGeocodingRequest
- MKAddress type

## Documentation Scope

This page documents the `axiom-mapkit-ref` skill — the API reference Claude uses for MapKit syntax and configuration.

**For decision trees and anti-patterns:** See [MapKit](/skills/integration/mapkit) for when to use SwiftUI Map vs MKMapView and annotation strategies.
**For troubleshooting:** See [MapKit Diagnostics](/diagnostic/mapkit-diag) for symptom-based diagnosis.

## Related

- [MapKit](/skills/integration/mapkit) — Decision trees, anti-patterns, and pressure scenarios
- [MapKit Diagnostics](/diagnostic/mapkit-diag) — Troubleshooting annotations, region jumping, search failures
- [Core Location Reference](/reference/core-location-ref) — Location API reference

## Resources

**WWDC**: 2023-10043, 2024-10094

**Skills**: axiom-mapkit, axiom-mapkit-diag, axiom-core-location-ref
