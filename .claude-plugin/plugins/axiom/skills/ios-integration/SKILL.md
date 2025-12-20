---
name: ios-integration
description: Use when integrating ANY iOS system feature - Siri, Shortcuts, Apple Intelligence, widgets, IAP, audio, haptics, localization, privacy. Covers App Intents, WidgetKit, StoreKit, AVFoundation, Core Haptics, App Shortcuts, Spotlight.
---

# iOS System Integration Router

**You MUST use this skill for ANY iOS system integration including Siri, Shortcuts, widgets, in-app purchases, audio, haptics, and more.**

## When to Use

Use this router for:
- Siri & Shortcuts (App Intents)
- Apple Intelligence integration
- Widgets & Live Activities
- In-app purchases (StoreKit)
- Audio & haptics
- Localization
- Privacy & permissions
- Spotlight search
- App discoverability

## Routing Logic

### Apple Intelligence & Siri

**App Intents** → `/skill app-intents-ref`
**App Shortcuts** → `/skill app-shortcuts-ref`
**App discoverability** → `/skill app-discoverability`
**Core Spotlight** → `/skill core-spotlight-ref`

### Widgets & Extensions

**Widgets/Live Activities** → `/skill extensions-widgets`
**Widget reference** → `/skill extensions-widgets-ref`

### In-App Purchases

**IAP implementation** → `/skill in-app-purchases`
**StoreKit 2 reference** → `/skill storekit-ref`

### Audio & Haptics

**Audio (AVFoundation)** → `/skill avfoundation-ref`
**Haptics** → `/skill haptics`
**Now Playing** → `/skill now-playing`

### Localization & Privacy

**Localization** → `/skill localization`
**Privacy UX** → `/skill privacy-ux`

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
  ├─ Audio?
  │  ├─ AVFoundation? → avfoundation-ref
  │  └─ Now Playing? → now-playing
  │
  ├─ Haptics? → haptics
  │
  ├─ Localization? → localization
  │
  └─ Privacy? → privacy-ux
```

## Example Invocations

User: "How do I add Siri support for my app?"
→ Invoke: `/skill app-intents-ref`

User: "My widget isn't updating"
→ Invoke: `/skill extensions-widgets`

User: "Implement in-app purchases with StoreKit 2"
→ Invoke: `/skill in-app-purchases`

User: "How do I localize my app strings?"
→ Invoke: `/skill localization`

User: "Implement haptic feedback for button taps"
→ Invoke: `/skill haptics`
