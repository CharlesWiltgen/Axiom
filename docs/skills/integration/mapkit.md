# MapKit

Map implementation patterns preventing common mistakes with annotations, search, and performance.

## When to Use

Use this skill when:
- Adding a map to your SwiftUI or UIKit app
- Implementing map annotations, markers, or custom pins
- Adding search with autocomplete (MKLocalSearchCompleter)
- Implementing directions and routing
- Debugging map display or performance issues
- Deciding between SwiftUI Map and MKMapView

## Example Prompts

- "How do I add a map to my SwiftUI app?"
- "Should I use SwiftUI Map or MKMapView?"
- "My map has 5,000 annotations and scrolling is slow"
- "How do I add search to my map?"
- "My annotations aren't appearing on the map"
- "How do I show directions between two points?"

## What This Skill Provides

- SwiftUI Map vs MKMapView decision tree
- Annotation strategy by count (direct, clustering, server-side)
- Search and directions implementation patterns
- 8 anti-patterns with time costs
- Core Location integration gotchas
- 3 pressure scenarios for common mistakes
- Pre-release checklist

## Related

- [MapKit Reference](/reference/mapkit-ref) — Complete API reference for SwiftUI Map, MKMapView, search, directions, Look Around
- [MapKit Diagnostics](/diagnostic/mapkit-diag) — Symptom-based troubleshooting for annotations, region jumping, clustering, search failures
- [Core Location](/skills/integration/core-location) — Location authorization and monitoring (MapKit implicitly requests authorization)

## Resources

**WWDC**: 2023-10043, 2024-10094

**Skills**: axiom-mapkit-ref, axiom-mapkit-diag, axiom-core-location
