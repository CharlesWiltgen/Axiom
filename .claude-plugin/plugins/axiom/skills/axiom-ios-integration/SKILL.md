---
name: axiom-ios-integration
description: Use when integrating ANY iOS system feature - Siri, Shortcuts, Apple Intelligence, widgets, IAP, camera, photo library, photos picker, audio, axiom-haptics, axiom-localization, privacy. Covers App Intents, WidgetKit, StoreKit, AVFoundation, PHPicker, PhotosPicker, Core Haptics, App Shortcuts, Spotlight.
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
- Background processing (BGTaskScheduler)
- Location services (Core Location)

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

### Camera & Photos

**Camera capture implementation** → `/skill axiom-camera-capture`
**Camera API reference** → `/skill axiom-camera-capture-ref`
**Camera debugging** → `/skill axiom-camera-capture-diag`
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

### Background Processing

**BGTaskScheduler implementation** → `/skill axiom-background-processing`
**Background task debugging** → `/skill axiom-background-processing-diag`
**Background task API reference** → `/skill axiom-background-processing-ref`

### Location Services

**Implementation patterns** → `/skill axiom-core-location`
**API reference** → `/skill axiom-core-location-ref`
**Debugging location issues** → `/skill axiom-core-location-diag`

## Decision Tree

1. App Intents / Siri / Apple Intelligence? → app-intents-ref
2. App Shortcuts? → app-shortcuts-ref
3. App discoverability / Spotlight? → app-discoverability, core-spotlight-ref
4. Widgets / Live Activities? → extensions-widgets, extensions-widgets-ref
5. In-app purchases / StoreKit? → in-app-purchases, storekit-ref
6. Camera capture? → camera-capture (patterns), camera-capture-diag (debugging), camera-capture-ref (API)
7. Photo pickers / library? → photo-library (patterns), photo-library-ref (API)
8. Audio / AVFoundation? → avfoundation-ref
9. Now Playing? → now-playing, now-playing-carplay, now-playing-musickit
10. Haptics? → haptics
11. Localization? → localization
12. Privacy / permissions? → privacy-ux
13. Background processing? → background-processing (patterns), background-processing-diag (debugging), background-processing-ref (API)
14. Location services? → core-location (patterns), core-location-diag (debugging), core-location-ref (API)

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "App Intents are just a protocol conformance" | App Intents have parameter validation, entity queries, and background execution. app-intents-ref covers all. |
| "Widgets are simple, I've done them before" | Widgets have timeline, interactivity, and Live Activity patterns that evolve yearly. extensions-widgets is current. |
| "I'll add haptics with a simple API call" | Haptic design has patterns for each interaction type. haptics skill matches HIG guidelines. |
| "Localization is just String Catalogs" | Xcode 26 has type-safe localization, generated symbols, and #bundle macro. localization skill is current. |
| "Camera capture is just AVCaptureSession setup" | Camera has interruption handlers, rotation, and threading requirements. camera-capture covers all. |

## Example Invocations

User: "How do I add Siri support for my app?"
→ Invoke: `/skill axiom-app-intents-ref`

User: "My widget isn't updating"
→ Invoke: `/skill axiom-extensions-widgets`

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
