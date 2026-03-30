# Apple Intelligence & Integration

Skills for integrating your app with Apple's system-level experiences: Siri, Apple Intelligence, Shortcuts, Spotlight, and more.

```mermaid
flowchart LR
    classDef router fill:#6f42c1,stroke:#5a32a3,color:#fff
    classDef discipline fill:#d4edda,stroke:#28a745,color:#1b4332
    classDef reference fill:#cce5ff,stroke:#0d6efd,color:#003366
    classDef diagnostic fill:#fff3cd,stroke:#ffc107,color:#664d03
    classDef agent fill:#f8d7da,stroke:#dc3545,color:#58151c

    axiom_ios_integration["ios-integration router"]:::router

    subgraph skills_d["Skills"]
        extensions_widgets["extensions-widgets"]:::discipline
        in_app_purchases["in-app-purchases"]:::discipline
        camera_capture["camera-capture"]:::discipline
        photo_library["photo-library"]:::discipline
        now_playing["now-playing"]:::discipline
        background_processing["background-processing"]:::discipline
        push_notifications["push-notifications"]:::discipline
        shazamkit["shazamkit"]:::discipline
        core_location["core-location"]:::discipline
        haptics["haptics"]:::discipline
        localization["localization"]:::discipline
        privacy_ux["privacy-ux"]:::discipline
    end
    axiom_ios_integration --> skills_d

    subgraph skills_r["References"]
        app_intents_ref["app-intents-ref"]:::reference
        storekit_ref["storekit-ref"]:::reference
        avfoundation_ref["avfoundation-ref"]:::reference
        extensions_widgets_ref["extensions-widgets-ref"]:::reference
        push_notifications_ref["push-notifications-ref"]:::reference
        core_location_ref["core-location-ref"]:::reference
        shazamkit_ref["shazamkit-ref"]:::reference
    end
    axiom_ios_integration --> skills_r

    subgraph agents_sg["Agents"]
        agent_iap["iap-auditor"]:::agent
        agent_iapi["iap-implementation"]:::agent
        agent_cam["camera-auditor"]:::agent
    end
    axiom_ios_integration --> agents_sg
```

## Available Skills

### [Foundation Models](./foundation-models)

On-device AI with Apple's Foundation Models framework (iOS 26+):
- **LanguageModelSession** — Text generation and conversations
- **@Generable** — Structured output with Swift types
- **Streaming** — Progressive response display
- **Tool calling** — Extend model capabilities

**When to use** Implementing on-device AI features, structured output, preventing context overflow

**Requirements** iOS 26+, A17+ or M-series chip

---

### [Background Processing](./background-processing)

BGTaskScheduler implementation and debugging:
- **BGAppRefreshTask** — Keep content fresh (~30s)
- **BGProcessingTask** — Maintenance work (overnight, charging)
- **BGContinuedProcessingTask** — User-initiated continuation (iOS 26+)
- **Debugging** — "Task never runs" decision trees, LLDB commands

**When to use** Implementing background tasks, debugging execution issues, understanding scheduling factors

**Requirements** iOS 13+, iOS 26+ for BGContinuedProcessingTask

---

### [ShazamKit](./shazamkit)

Audio recognition and custom audio matching:
- **Song identification** — Recognize songs via Shazam catalog with SHManagedSession (iOS 17+)
- **Custom catalogs** — Match against your own audio (podcasts, TV, lessons)
- **Second-screen sync** — Timed media items for content synchronized to audio
- **Library management** — SHLibrary for reading, adding, removing recognized songs
- **Signature generation** — From AVAsset, audio buffers, or Shazam CLI at scale

**When to use** Adding song recognition, building audio-synced experiences, creating custom audio catalogs, managing Shazam library

**Requirements** iOS 15+ (SHSession), iOS 17+ (SHManagedSession, SHLibrary)

---

### [Push Notifications](./push-notifications)

Remote and local notification implementation for iOS:
- **Permission flow** — Standard, provisional, contextual timing
- **Token management** — APNs device token lifecycle, server sync
- **Payload design** — Alert, silent, localized, custom data
- **Rich notifications** — Service extensions, media attachments
- **Communication notifications** — Avatars, Focus integration (iOS 15+)
- **Live Activity push** — Push-start, push-update, push-end transport

**When to use** Setting up APNs, designing notification payloads, implementing actionable or rich notifications, debugging delivery issues

**Requirements** iOS 10+ (core), iOS 15+ (communication/time-sensitive), iOS 18+ (broadcast push)

---

### [Networking](./networking)

Network.framework patterns for custom protocols:
- **NWConnection** — iOS 12-25 completion-based API
- **NetworkConnection** — iOS 26+ async/await API
- **TLV Framing** — Message boundaries
- **Service Discovery** — Bonjour and Wi-Fi Aware

**When to use** UDP/TCP connections, peer-to-peer, custom protocols (NOT HTTP — use URLSession)

**Requirements** iOS 12+

---

### [Core Location](./core-location)

Implementation patterns for location services:
- **Authorization Strategy** — When In Use vs Always, progressive upgrade
- **Monitoring Approach** — CLLocationUpdate, CLMonitor, significant-change
- **Background Location** — CLBackgroundActivitySession, relaunch recovery
- **Geofencing** — 20-condition limit, radius requirements

**When to use** Implementing location features, choosing authorization strategy, debugging background location, geofencing

**Requirements** iOS 14+ (iOS 17+ for modern APIs)

---

### [MapKit](./mapkit)

Map implementation patterns for SwiftUI and UIKit:
- **SwiftUI Map vs MKMapView** — Decision tree based on requirements
- **Annotation Strategy** — Direct, clustering, or server-side by count
- **Search & Directions** — MKLocalSearch, MKLocalSearchCompleter, MKDirections
- **8 Anti-Patterns** — Common mistakes with time costs

**When to use** Adding maps, implementing annotations, search, directions, debugging map issues

**Requirements** iOS 17+ for SwiftUI Map, iOS 3+ for MKMapView

---

### [App Intents Integration](/reference/app-intents-ref)

Comprehensive guide to the App Intents framework for exposing app functionality to:
- **Siri & Apple Intelligence** — Voice commands and intelligent automation
- **Shortcuts** — User-created workflows and automations
- **Spotlight** — System-wide search integration
- **Focus Filters** — Context-aware content filtering
- **Widgets & Live Activities** — Dynamic system UI

#### Key Features
- Three building blocks: AppIntent, AppEntity, AppEnum
- Parameter validation and natural language summaries
- Entity queries for content discovery
- Background vs foreground execution patterns
- Authentication policies and security
- WWDC 2025 updates: IndexedEntity, Apple Intelligence integration, Mac Automations

**When to use** Exposing app functionality to system experiences, implementing Shortcuts support, debugging intent resolution failures

**Requirements** iOS 16+

---

### [Apple Documentation Access](./apple-docs)

Direct access to Apple's official for-LLM markdown documentation bundled in Xcode:
- **20 Guide Topics** -- Liquid Glass, Foundation Models, Swift Charts 3D, SwiftData, concurrency
- **32 Compiler Diagnostics** -- Swift compiler errors with official explanations and code fixes
- **MCP Integration** -- Auto-detected from Xcode, stays current with updates

**When to use** Authoritative API details, Swift compiler error explanations, official code examples

**Requirements** Xcode installed locally

---

## Integration Categories

### System Services
- **Siri & Voice Control** — Natural language command handling
- **Apple Intelligence** — AI-powered automation and reasoning
- **Shortcuts** — Custom workflow creation
- **Spotlight** — System-wide search
- **Background Processing** — BGTaskScheduler, background URLSession

### Context & Personalization
- **Focus Filters** — Context-aware content filtering
- **Live Activities** — Dynamic Lock Screen updates
- **Widgets** — Home/Lock Screen content

### Platform-Specific
- **Action Button** — Apple Watch Ultra quick actions
- **Mac Automations** — Automated workflows on macOS
- **Spotlight on Mac** — Desktop search integration

---

## Getting Started

1. **Define your app's capabilities** — What actions should users be able to perform?
2. **Choose building blocks** — AppIntent for actions, AppEntity for content
3. **Implement intents** — Create AppIntent conforming types
4. **Test with Shortcuts** — Verify intent appears and executes correctly
5. **Add to Siri** — Test voice command handling
6. **Integrate with Apple Intelligence** — Enable AI-powered automation

---

### [Apple Docs Research](./apple-docs-research)

Methodology for researching Apple frameworks using WWDC transcripts and sosumi.ai.

**When to use** Getting WWDC session transcripts, finding Apple documentation, researching framework APIs

---

### [Extensions & Widgets](./extensions-widgets)

WidgetKit, Live Activities, Control Center widgets for iOS 14-18+:
- **Standard widgets** — Timeline providers, intent configuration
- **Interactive widgets** — iOS 17+ button/toggle support
- **Live Activities** — Dynamic Island and Lock Screen

**When to use** Implementing widgets, Live Activities, Control Center widgets

**Requirements** iOS 14+ (iOS 17+ for interactive, iOS 18+ for Control Center)

---

### [Camera Capture](./camera-capture)

AVCaptureSession, photo/video recording, camera preview:
- **Session configuration** — Inputs, outputs, presets
- **Photo capture** — Still images, HDR, depth
- **Video recording** — Movie file output, frame processing

**When to use** Adding camera features, capturing photos/video

---

### [Photo Library](./photo-library)

PHPicker and PhotosPicker for photo selection:
- **PHPickerViewController** — UIKit photo picker
- **PhotosPicker** — SwiftUI photo picker (iOS 16+)
- **PHAsset** — Photo library access and management

**When to use** Selecting photos from library, managing photo assets

---

### [Now Playing](./now-playing)

MPNowPlayingInfoCenter for media apps:
- **Info display** — Title, artist, artwork on Lock Screen
- **Remote commands** — Play, pause, skip controls
- **MPNowPlayingSession** — Automatic management (iOS 16+)

**When to use** Audio/video apps needing Lock Screen controls and Now Playing display

---

### [In-App Purchases](./in-app-purchases)

StoreKit 2 implementation for consumables, subscriptions, and non-consumables:
- **Product configuration** — Store setup, pricing
- **Transaction handling** — Purchase flow, verification
- **Subscription management** — Renewal, upgrade/downgrade

**When to use** Adding purchases, subscriptions, or restoring transactions

---

### [Haptics](/reference/haptics)

UIFeedbackGenerator and Core Haptics for tactile feedback.

**When to use** Adding haptic feedback, designing custom haptic patterns

---

### [Localization](/reference/localization)

String Catalogs, type-safe symbols (Xcode 26+), plurals, RTL layouts.

**When to use** Localizing your app, supporting multiple languages

---

### [Privacy UX](/reference/privacy-ux)

Privacy Manifests, just-in-time permissions, App Tracking Transparency.

**When to use** Implementing privacy-first permission flows, preparing Privacy Manifests

---

### [Networking (Legacy)](./networking-legacy)

URLSession patterns and legacy networking code modernization.

**When to use** Working with URLSession, modernizing older networking code

---

### [tvOS](./tvos)

tvOS app development patterns — focus engine, top shelf, platform differences from iOS.

**When to use** Building a tvOS app, adapting an iOS app for Apple TV, implementing focus behavior

---

## See Also

- [Apple App Intents Documentation](https://developer.apple.com/documentation/appintents)
- [WWDC 2025-260: What's new in App Intents](https://developer.apple.com/videos/)
- [Human Interface Guidelines: Siri](https://developer.apple.com/design/human-interface-guidelines/siri)
