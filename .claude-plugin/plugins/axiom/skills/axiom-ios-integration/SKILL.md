---
name: axiom-ios-integration
description: Use when integrating ANY iOS system feature - Siri, Shortcuts, Apple Intelligence, widgets, IAP, camera, photo library, photos picker, audio, axiom-haptics, axiom-localization, privacy, alarms. Covers App Intents, WidgetKit, StoreKit, AVFoundation, PHPicker, PhotosPicker, Core Haptics, App Shortcuts, Spotlight, AlarmKit.
license: MIT
---

# iOS System Integration Router

**You MUST use this skill for ANY iOS system integration including Siri, Shortcuts, widgets, in-app purchases, camera, photo library, audio, axiom-haptics, and more.**

## When to Use

Use this router for:
- Siri & Shortcuts (App Intents)
- Apple Intelligence integration
- Widgets & Live Activities
- In-app purchases (StoreKit)
- Camera capture (AVCaptureSession)
- Photo library & pickers (PHPicker, PhotosPicker)
- Audio & haptics
- Localization
- Privacy & permissions
- Spotlight search
- App discoverability
- Alarms (AlarmKit)
- Background processing (BGTaskScheduler)
- Location services (Core Location)
- Maps & MapKit (Map, MKMapView, annotations, search, directions)

## Cross-Domain Routing

When integration issues overlap with other domains:

**Widget + data sync issues** (widget not showing updated data):
- Widget timeline not refreshing → **stay in ios-integration** (extensions-widgets)
- SwiftData/Core Data not shared with extension → **also invoke ios-data** — App Groups and shared containers are data-layer concerns
- Background refresh timing → **also invoke ios-concurrency** if async patterns are involved

**Live Activity + push notification issues**:
- ActivityKit push token setup, Live Activity not updating → **stay in ios-integration** (extensions-widgets)
- Push notification delivery failures, APNs errors → **also invoke ios-networking** (networking-diag)
- Entitlements/certificates misconfigured → **also invoke ios-build** (xcode-debugging)

**Camera + permissions + privacy**:
- Camera code issues → **stay in ios-integration** (camera-capture)
- Privacy manifest or Info.plist issues → **stay in ios-integration** (privacy-ux)
- Build/entitlement errors → **also invoke ios-build**

**MapKit + location issues** (user location not showing on map):
- Map display, annotations, search → **stay in ios-integration** (mapkit)
- Location authorization, monitoring, background location → **also invoke ios-performance** or **ios-integration** (core-location)
- Map performance with many annotations → **also invoke ios-performance** if profiling needed

## Routing Logic

### Apple Intelligence & Siri

**App Intents** → `/skill axiom-app-intents-ref`
**App Shortcuts** → `/skill axiom-app-shortcuts-ref`
**App discoverability** → `/skill axiom-app-discoverability`
**Core Spotlight** → `/skill axiom-core-spotlight-ref`

### Widgets & Extensions

**Widgets/Live Activities** → `/skill axiom-extensions-widgets`
**Widget reference** → `/skill axiom-extensions-widgets-ref`

### In-App Purchases

**IAP implementation** → `/skill axiom-in-app-purchases`
**StoreKit 2 reference** → `/skill axiom-storekit-ref`
**IAP audit** → Launch `iap-auditor` agent (missing transaction.finish(), weak receipt validation, missing restore, subscription tracking)
**IAP full implementation** → Launch `iap-implementation` agent (StoreKit config, StoreManager, transaction handling, restore purchases)

### Camera & Photos

**Camera capture implementation** → `/skill axiom-camera-capture`
**Camera API reference** → `/skill axiom-camera-capture-ref`
**Camera debugging** → `/skill axiom-camera-capture-diag`
**Camera audit** → Launch `camera-auditor` agent or `/axiom:audit camera` (deprecated APIs, missing interruption handlers, threading violations, permission anti-patterns)
**Photo pickers & library** → `/skill axiom-photo-library`
**Photo library API reference** → `/skill axiom-photo-library-ref`

### Audio & Haptics

**Audio (AVFoundation)** → `/skill axiom-avfoundation-ref`
**Haptics** → `/skill axiom-haptics`
**Now Playing** → `/skill axiom-now-playing`
**CarPlay Now Playing** → `/skill axiom-now-playing-carplay`
**MusicKit integration** → `/skill axiom-now-playing-musickit`

### Localization & Privacy

**Localization** → `/skill axiom-localization`
**Privacy UX** → `/skill axiom-privacy-ux`

### Alarms

**AlarmKit (iOS 26+)** → `/skill axiom-alarmkit-ref`
- Alarm scheduling and authorization
- Live Activity integration
- SwiftUI alarm management views

### Background Processing

**BGTaskScheduler implementation** → `/skill axiom-background-processing`
**Background task debugging** → `/skill axiom-background-processing-diag`
**Background task API reference** → `/skill axiom-background-processing-ref`

### Location Services

**Implementation patterns** → `/skill axiom-core-location`
**API reference** → `/skill axiom-core-location-ref`
**Debugging location issues** → `/skill axiom-core-location-diag`

### Maps & MapKit

**MapKit implementation patterns** → `/skill axiom-mapkit`
- SwiftUI Map vs MKMapView decision
- Annotation strategies by count
- Search and directions
- 8 anti-patterns

**MapKit API reference** → `/skill axiom-mapkit-ref`
- SwiftUI Map API
- MKMapView delegates
- MKLocalSearch, MKDirections, Look Around
- Platform availability matrix

**MapKit troubleshooting** → `/skill axiom-mapkit-diag`
- Annotations not appearing
- Region jumping / infinite loops
- Clustering issues
- Search failures

## Decision Tree

1. App Intents / Siri / Apple Intelligence? → app-intents-ref
2. App Shortcuts? → app-shortcuts-ref
3. App discoverability / Spotlight? → app-discoverability, core-spotlight-ref
4. Widgets / Live Activities? → extensions-widgets, extensions-widgets-ref
5. In-app purchases / StoreKit? → in-app-purchases, storekit-ref
6. Want IAP audit (missing finish, receipt validation)? → iap-auditor (Agent)
7. Want full IAP implementation? → iap-implementation (Agent)
8. Camera capture? → camera-capture (patterns), camera-capture-diag (debugging), camera-capture-ref (API)
9. Want camera code audit? → camera-auditor (Agent)
10. Photo pickers / library? → photo-library (patterns), photo-library-ref (API)
11. Audio / AVFoundation? → avfoundation-ref
12. Now Playing? → now-playing, now-playing-carplay, now-playing-musickit
13. Haptics? → haptics
14. Localization? → localization
15. Privacy / permissions? → privacy-ux
16. Background processing? → background-processing (patterns), background-processing-diag (debugging), background-processing-ref (API)
17. Location services? → core-location (patterns), core-location-diag (debugging), core-location-ref (API)
18. Maps / MapKit / annotations / directions? → mapkit (patterns), mapkit-ref (API), mapkit-diag (debugging)
19. Alarms / AlarmKit? → alarmkit-ref

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "App Intents are just a protocol conformance" | App Intents have parameter validation, entity queries, and background execution. app-intents-ref covers all. |
| "Widgets are simple, I've done them before" | Widgets have timeline, interactivity, and Live Activity patterns that evolve yearly. extensions-widgets is current. |
| "I'll add haptics with a simple API call" | Haptic design has patterns for each interaction type. haptics skill matches HIG guidelines. |
| "Localization is just String Catalogs" | Xcode 26 has type-safe localization, generated symbols, and #bundle macro. localization skill is current. |
| "Camera capture is just AVCaptureSession setup" | Camera has interruption handlers, rotation, and threading requirements. camera-capture covers all. |
| "I'll just use MKMapView, I know it already" | SwiftUI Map is 10x less code for standard map features. mapkit has the decision tree. |
| "MapKit search doesn't work, I'll use Google Maps SDK" | MapKit search needs region bias and resultTypes configuration. mapkit-diag fixes this in 5 minutes. |
| "Alarm scheduling is just UNNotificationRequest" | AlarmKit (iOS 26+) has dedicated alarm UI, authorization, and Live Activity integration. alarmkit-ref covers the framework. |

## Example Invocations

User: "How do I add Siri support for my app?"
→ Invoke: `/skill axiom-app-intents-ref`

User: "My widget isn't updating"
→ Invoke: `/skill axiom-extensions-widgets`

User: "My widget isn't showing updated SwiftData content"
→ Invoke: `/skill axiom-extensions-widgets` + also invoke `ios-data` router for App Group/shared container setup

User: "My Live Activity isn't updating and I'm getting push notification errors"
→ Invoke: `/skill axiom-extensions-widgets` for ActivityKit + also invoke `ios-networking` router for push delivery

User: "Implement in-app purchases with StoreKit 2"
→ Invoke: `/skill axiom-in-app-purchases`

User: "How do I localize my app strings?"
→ Invoke: `/skill axiom-localization`

User: "Implement haptic feedback for button taps"
→ Invoke: `/skill axiom-haptics`

User: "How do I set up a camera preview?"
→ Invoke: `/skill axiom-camera-capture`

User: "Camera freezes when I get a phone call"
→ Invoke: `/skill axiom-camera-capture-diag`

User: "What is RotationCoordinator?"
→ Invoke: `/skill axiom-camera-capture-ref`

User: "How do I let users pick photos in SwiftUI?"
→ Invoke: `/skill axiom-photo-library`

User: "User can't see their photos after granting access"
→ Invoke: `/skill axiom-photo-library`

User: "How do I save a photo to the camera roll?"
→ Invoke: `/skill axiom-photo-library`

User: "My background task never runs"
→ Invoke: `/skill axiom-background-processing-diag`

User: "How do I implement BGTaskScheduler?"
→ Invoke: `/skill axiom-background-processing`

User: "What's the difference between BGAppRefreshTask and BGProcessingTask?"
→ Invoke: `/skill axiom-background-processing-ref`

User: "How do I implement geofencing?"
→ Invoke: `/skill axiom-core-location`

User: "Location updates not working in background"
→ Invoke: `/skill axiom-core-location-diag`

User: "What is CLServiceSession?"
→ Invoke: `/skill axiom-core-location-ref`

User: "Review my in-app purchase implementation"
→ Invoke: `iap-auditor` agent

User: "Implement in-app purchases for my app"
→ Invoke: `iap-implementation` agent

User: "Check my camera code for issues"
→ Invoke: `camera-auditor` agent

User: "How do I add a map to my SwiftUI app?"
→ Invoke: `/skill axiom-mapkit`

User: "My annotations aren't showing on the map"
→ Invoke: `/skill axiom-mapkit-diag`

User: "How do I implement search with autocomplete on a map?"
→ Invoke: `/skill axiom-mapkit-ref`

User: "My map region keeps jumping when I scroll"
→ Invoke: `/skill axiom-mapkit-diag`

User: "How do I add directions between two points?"
→ Invoke: `/skill axiom-mapkit-ref`

User: "How do I schedule alarms in iOS 26?"
→ Invoke: `/skill axiom-alarmkit-ref`

User: "How do I integrate AlarmKit with Live Activities?"
→ Invoke: `/skill axiom-alarmkit-ref`
