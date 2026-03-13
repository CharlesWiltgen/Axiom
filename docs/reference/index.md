# Reference

Comprehensive guides and documentation for Apple platform development. Reference skills provide detailed information without enforcing specific workflows.

## UI & Design

| Skill | Description |
|-------|-------------|
| [**hig-ref**](./hig-ref) | Comprehensive Apple HIG coverage — color, typography, shapes, materials, accessibility, platform-specific patterns |
| [**liquid-glass-ref**](./liquid-glass-ref) | Liquid Glass adoption guide — app icons, controls, navigation, menus, windows, search, platform considerations |
| [**sf-symbols-ref**](./sf-symbols-ref) | SF Symbols API reference — rendering modes, symbol effects, variable values, UIKit equivalents |
| [**swiftui-26-ref**](./swiftui-26-ref) | All iOS 26 SwiftUI features — Liquid Glass, @Animatable macro, WebView, rich text, 3D charts, spatial layout, scene bridging |
| [**swiftui-animation-ref**](./swiftui-animation-ref) | SwiftUI animation reference — VectorArithmetic, Animatable protocol, @Animatable macro, springs vs timing, CustomAnimation (iOS 13-26) |
| [**swiftui-containers-ref**](./swiftui-containers-ref) | SwiftUI stacks, grids, outlines — LazyVGrid, Grid, OutlineGroup, container patterns |
| [**swiftui-layout-ref**](./swiftui-layout-ref) | SwiftUI adaptive layout API — ViewThatFits, AnyLayout, Layout protocol, onGeometryChange, size classes, iOS 26 window APIs |
| [**swiftui-nav-ref**](./swiftui-nav-ref) | SwiftUI navigation API — NavigationStack, NavigationSplitView, NavigationPath, deep linking (iOS 16-26) |
| [**swiftui-search-ref**](./swiftui-search-ref) | SwiftUI search APIs — .searchable, isSearching, suggestions, scopes, tokens, programmatic control (iOS 15-18) |
| [**textkit-ref**](./textkit-ref) | TextKit 2 reference — architecture, migration from TextKit 1, Writing Tools integration, SwiftUI TextEditor (iOS 26) |
| [**transferable-ref**](./transferable-ref) | CoreTransferable — Transferable protocol, TransferRepresentation, ShareLink, drag and drop, UTType declarations (iOS 16+) |
| [**typography-ref**](./typography-ref) | Apple platform typography — San Francisco fonts, text styles, Dynamic Type, tracking, leading, internationalization |

## Persistence & Storage

| Skill | Description |
|-------|-------------|
| [**storage**](./storage) | iOS storage decision framework — database vs files, local vs cloud, SwiftData/CloudKit/iCloud Drive selection |
| [**cloudkit-ref**](./cloudkit-ref) | Modern CloudKit sync — SwiftData integration, CKSyncEngine (WWDC 2023), database scopes, conflict resolution |
| [**icloud-drive-ref**](./icloud-drive-ref) | File-based iCloud sync — ubiquitous containers, NSFileCoordinator, conflict resolution, NSUbiquitousKeyValueStore |
| [**file-protection-ref**](./file-protection-ref) | iOS file encryption and data protection — FileProtectionType levels, background access, Keychain comparison |
| [**sqlitedata-ref**](./sqlitedata-ref) | SQLiteData advanced patterns — @Select, @Join, batch operations, CloudKit sync, query optimization |
| [**storage-management-ref**](./storage-management-ref) | Storage management and purge priorities — disk space APIs, backup exclusion, cache management, URL resource values |
| [**realm-migration-ref**](./realm-migration-ref) | Migration guide from Realm to SwiftData — pattern equivalents, threading models, schema strategies, CloudKit sync transition |

## Concurrency

| Skill | Description |
|-------|-------------|
| [**swift-concurrency-ref**](./swift-concurrency-ref) | Swift concurrency API — actors, Sendable, Task/TaskGroup, AsyncStream, continuations, migration patterns |
| [**energy-ref**](./energy-ref) | Energy optimization API — Power Profiler, timer/network/location efficiency, background execution, MetricKit |

## Integration

| Skill | Description |
|-------|-------------|
| [**alarmkit-ref**](./alarmkit-ref) | AlarmKit API — alarm scheduling, authorization, Live Activity integration (iOS 26+) |
| [**app-discoverability**](./app-discoverability) | Discoverability strategy — App Intents, App Shortcuts, Core Spotlight, NSUserActivity for Spotlight and Siri |
| [**app-intents-ref**](./app-intents-ref) | App Intents framework — AppIntent, AppEntity, parameters, queries, Siri, Apple Intelligence, Shortcuts, Spotlight |
| [**app-shortcuts-ref**](./app-shortcuts-ref) | App Shortcuts — AppShortcutsProvider, suggested phrases, Siri/Spotlight availability, debugging |
| [**avfoundation-ref**](./avfoundation-ref) | AVFoundation audio APIs — AVAudioSession, AVAudioEngine, bit-perfect DAC, iOS 26+ spatial audio, ASAF/APAC |
| [**background-processing-ref**](./background-processing-ref) | Background processing API — BGTaskScheduler, BGAppRefreshTask, BGProcessingTask, BGContinuedProcessingTask |
| [**camera-capture-ref**](./camera-capture-ref) | Camera capture API — AVCaptureSession, AVCaptureDevice, photo/video recording, preview layers |
| [**core-location-ref**](./core-location-ref) | Core Location APIs — CLLocationUpdate, CLMonitor, CLServiceSession (iOS 18+), geofencing, background location |
| [**core-spotlight-ref**](./core-spotlight-ref) | Core Spotlight indexing — CSSearchableItem, IndexedEntity, NSUserActivity integration, search and prediction |
| [**extensions-widgets-ref**](./extensions-widgets-ref) | Extensions & Widgets API — WidgetKit, ActivityKit, Control Center widgets, timeline providers |
| [**foundation-models-ref**](./foundation-models-ref) | Foundation Models framework — LanguageModelSession, @Generable, streaming, tool calling, context management (iOS 26+) |
| [**haptics**](./haptics) | Haptic feedback and Core Haptics — UIFeedbackGenerator, CHHapticEngine, AHAP patterns (WWDC 2021) |
| [**localization**](./localization) | App localization — String Catalogs (.xcstrings), type-safe symbols (Xcode 26+), #bundle macro, plurals, RTL layouts |
| [**mapkit-ref**](./mapkit-ref) | MapKit API — SwiftUI Map, MKMapView, annotations, search, directions |
| [**network-framework-ref**](./network-framework-ref) | Network.framework API — NWConnection (iOS 12-25), NetworkConnection (iOS 26+), TLV framing, Coder protocol |
| [**networking-migration**](./networking-migration) | Network framework migration guide — NWConnection to NetworkConnection transition patterns |
| [**now-playing-carplay**](./now-playing-carplay) | CarPlay Now Playing integration — MPNowPlayingInfoCenter, transport controls, CarPlay framework |
| [**now-playing-musickit**](./now-playing-musickit) | MusicKit Now Playing — MusicPlayer, queue management, system integration |
| [**photo-library-ref**](./photo-library-ref) | Photo Library API — PHPickerViewController, PhotosPicker, PHAsset, photo selection patterns |
| [**privacy-ux**](./privacy-ux) | Privacy manifests and permission UX — just-in-time permissions, App Tracking Transparency, Required Reason APIs |
| [**push-notifications-ref**](./push-notifications-ref) | Push notifications — APNs HTTP/2, UserNotifications framework, silent push, rich media, service extensions |
| [**storekit-ref**](./storekit-ref) | StoreKit 2 API — Product, Transaction, subscription management, receipts, testing |

## Computer Vision

| Skill | Description |
|-------|-------------|
| [**vision-ref**](./vision-ref) | Vision framework API — subject segmentation, hand/body pose, text recognition, barcode scanning |

## Machine Learning

| Skill | Description |
|-------|-------------|
| [**coreml-ref**](./coreml-ref) | CoreML API — MLTensor, coremltools conversion, model compression, state management |

## Games

| Skill | Description |
|-------|-------------|
| [**spritekit-ref**](./spritekit-ref) | SpriteKit API — all 16 node types, physics bodies, action catalog, texture atlases, SKRenderer |
| [**metal-migration-ref**](./metal-migration-ref) | Metal migration API — OpenGL/DirectX conversion, shader translation, rendering pipeline |
| [**realitykit-ref**](./realitykit-ref) | RealityKit API — Entity-Component-System, RealityView, materials, animations, AR |
| [**scenekit-ref**](./scenekit-ref) | SceneKit API — scene graphs, materials, animations, SceneKit migration to RealityKit |

## Tools & Profiling

| Skill | Description |
|-------|-------------|
| [**app-store-connect-ref**](./app-store-connect-ref) | App Store Connect API — builds, beta testing, metadata management |
| [**asc-mcp-ref**](./asc-mcp-ref) | App Store Connect MCP — automated submission workflows |
| [**app-store-ref**](./app-store-ref) | App Store submission — review guidelines, metadata requirements, rejection troubleshooting |
| [**axe-ref**](./axe-ref) | AXe (Simulator Automation) — automated iOS Simulator interaction and testing |
| [**code-signing-ref**](./code-signing-ref) | Code signing CLI — certificates, provisioning profiles, entitlements, Keychain, fastlane match, error codes |
| [**lldb-ref**](./lldb-ref) | LLDB command reference — variable inspection, breakpoints, thread navigation, expression evaluation |
| [**metrickit-ref**](./metrickit-ref) | MetricKit API — field performance metrics, diagnostics, crash reporting |
| [**timer-patterns-ref**](./timer-patterns-ref) | Timer patterns — invalidation, memory-safe usage, dispatch timers, CADisplayLink |
| [**xctrace-ref**](./xctrace-ref) | xctrace CLI — automated Instruments profiling, trace recording, data export |

## Quality Standards

All reference skills are reviewed against 4 criteria:

1. **Accuracy** — Every claim cited to official sources, code tested
2. **Completeness** — 80%+ coverage, edge cases documented, troubleshooting sections
3. **Clarity** — Examples first, scannable structure, jargon defined
4. **Practical Value** — Copy-paste ready, expert checklists, real-world impact

## Related Resources

- [Diagnostic](/diagnostic/) — Systematic diagnostics with mandatory workflows
- [Skills](/skills/) — Discipline-enforcing TDD-tested workflows
- [Commands](/commands/) — Quick automated scans
- [WWDC 2025 Sessions](https://developer.apple.com/videos/wwdc2025)
