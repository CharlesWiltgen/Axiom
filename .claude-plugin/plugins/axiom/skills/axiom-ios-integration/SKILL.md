---
name: axiom-ios-integration
description: Use when integrating ANY iOS system feature - Siri, Shortcuts, Apple Intelligence, widgets, IAP, camera, photo library, photos picker, audio, axiom-haptics, axiom-localization, privacy. Covers App Intents, WidgetKit, StoreKit, AVFoundation, PHPicker, PhotosPicker, Core Haptics, App Shortcuts, Spotlight.
user-invocable: false
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

```
User asks about system integration
  ├─ Siri/Shortcuts?
  │  ├─ App Intents? → app-intents-ref
  │  ├─ App Shortcuts? → app-shortcuts-ref
  │  └─ Discovery? → app-discoverability
  │
  ├─ Widgets/Extensions? → extensions-widgets
  │
  ├─ In-app purchases? → in-app-purchases
  │
  ├─ Camera/Photos?
  │  ├─ Camera capture (AVCaptureSession)?
  │  │  ├─ Implementation patterns? → camera-capture
  │  │  ├─ Not working/debugging? → camera-capture-diag
  │  │  └─ API reference? → camera-capture-ref
  │  └─ Photo picking/library?
  │     ├─ Implementation patterns? → photo-library
  │     └─ API reference? → photo-library-ref
  │
  ├─ Audio?
  │  ├─ AVFoundation? → avfoundation-ref
  │  ├─ Now Playing? → now-playing
  │  ├─ CarPlay? → now-playing-carplay
  │  └─ MusicKit? → now-playing-musickit
  │
  ├─ Haptics? → haptics
  │
  ├─ Localization? → localization
  │
  ├─ Privacy? → privacy-ux
  │
  ├─ Background processing?
  │  ├─ Implementation patterns? → background-processing
  │  ├─ Task not running/debugging? → background-processing-diag
  │  └─ API reference? → background-processing-ref
  │
  └─ Location services?
     ├─ Implementation patterns? → core-location
     ├─ Not working/debugging? → core-location-diag
     └─ API reference? → core-location-ref
```

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
