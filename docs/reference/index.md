# Reference

Comprehensive guides and documentation for Apple platform development. Reference skills provide detailed information without enforcing specific workflows.

## Reference Skills

| Skill | Description |
|-------|-------------|
| [**liquid-glass-ref**](./liquid-glass-ref) | Comprehensive Liquid Glass adoption guide — app icons, controls, navigation, menus, windows, search, platform considerations |
| [**realm-migration-ref**](./realm-migration-ref) | Complete migration guide from Realm to SwiftData — pattern equivalents, threading models, schema strategies, CloudKit sync transition |
| [**network-framework-ref**](./network-framework-ref) | Comprehensive Network.framework API reference — NWConnection (iOS 12-25), NetworkConnection (iOS 26+), TLV framing, Coder protocol, migration strategies |
| [**energy-ref**](./energy-ref) | Complete energy optimization API reference — Power Profiler, timer/network/location efficiency, background execution, BGContinuedProcessingTask (iOS 26), MetricKit |
| [**swiftui-26-ref**](./swiftui-26-ref) | All iOS 26 SwiftUI features — Liquid Glass, @Animatable macro, WebView, rich text, 3D charts, spatial layout, scene bridging |
| [**swiftui-animation-ref**](./swiftui-animation-ref) | Complete SwiftUI animation reference — VectorArithmetic, Animatable protocol, @Animatable macro, springs vs timing curves, CustomAnimation, performance optimization (iOS 13-26) |
| [**app-discoverability**](./app-discoverability) | Complete discoverability strategy — 6-step framework combining App Intents, App Shortcuts, Core Spotlight, NSUserActivity for Spotlight and Siri |
| [**app-intents-ref**](./app-intents-ref) | App Intents framework for Siri, Apple Intelligence, Shortcuts, Spotlight — AppIntent, AppEntity, parameters, queries, debugging |
| [**app-shortcuts-ref**](./app-shortcuts-ref) | App Shortcuts implementation guide — AppShortcutsProvider, suggested phrases, instant Siri/Spotlight availability, debugging |
| [**avfoundation-ref**](./avfoundation-ref) | AVFoundation audio APIs — AVAudioSession, AVAudioEngine, bit-perfect DAC output, iOS 26+ spatial audio capture, ASAF/APAC, Audio Mix |
| [**core-spotlight-ref**](./core-spotlight-ref) | Core Spotlight indexing — CSSearchableItem, IndexedEntity, NSUserActivity integration, Spotlight search and prediction |
| [**foundation-models-ref**](./foundation-models-ref) | Apple Intelligence Foundation Models framework — LanguageModelSession, @Generable, streaming, tool calling, context management (iOS 26+) |
| [**haptics**](./haptics) | Haptic feedback and Core Haptics — UIFeedbackGenerator, CHHapticEngine, AHAP patterns, Causality-Harmony-Utility design principles (WWDC 2021) |
| [**localization**](./localization) | App localization and i18n — String Catalogs (.xcstrings), type-safe symbols (Xcode 26+), #bundle macro, plurals, RTL layouts, locale-aware formatting |
| [**privacy-ux**](./privacy-ux) | Privacy manifests and permission UX — just-in-time permissions, App Tracking Transparency, Required Reason APIs, Privacy Nutrition Labels |
| [**swiftui-layout-ref**](./swiftui-layout-ref) | Complete SwiftUI adaptive layout API guide — ViewThatFits, AnyLayout, Layout protocol, onGeometryChange, size classes, iOS 26 window APIs |
| [**storage**](./storage) | Complete iOS storage decision framework — database vs files, local vs cloud, SwiftData/CloudKit/iCloud Drive selection |
| [**cloudkit-ref**](./cloudkit-ref) | Modern CloudKit sync — SwiftData integration, CKSyncEngine (WWDC 2023), database scopes, conflict resolution, monitoring |
| [**icloud-drive-ref**](./icloud-drive-ref) | File-based iCloud sync — ubiquitous containers, NSFileCoordinator, conflict resolution, NSUbiquitousKeyValueStore |
| [**file-protection-ref**](./file-protection-ref) | iOS file encryption and data protection — FileProtectionType levels, background access, Keychain comparison |
| [**storage-management-ref**](./storage-management-ref) | Storage management and purge priorities — disk space APIs, backup exclusion, cache management, URL resource values |
| [**textkit-ref**](./textkit-ref) | TextKit 2 complete reference — architecture, migration from TextKit 1, Writing Tools integration, SwiftUI TextEditor support (iOS 26) |
| [**typography-ref**](./typography-ref) | Apple platform typography — San Francisco fonts, text styles, Dynamic Type, tracking, leading, internationalization best practices |

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
