# Reference

Comprehensive guides and documentation for Apple platform development. Reference skills provide detailed information without enforcing specific workflows.

## Reference Skills

| Skill | Description |
|-------|-------------|
| [**liquid-glass-ref**](./liquid-glass-ref) | Comprehensive Liquid Glass adoption guide — app icons, controls, navigation, menus, windows, search, platform considerations |
| [**realm-migration-ref**](./realm-migration-ref) | Complete migration guide from Realm to SwiftData — pattern equivalents, threading models, schema strategies, CloudKit sync transition |
| [**network-framework-ref**](./network-framework-ref) | Comprehensive Network.framework API reference — NWConnection (iOS 12-25), NetworkConnection (iOS 26+), TLV framing, Coder protocol, migration strategies |
| [**swiftui-26-ref**](./swiftui-26-ref) | All iOS 26 SwiftUI features — Liquid Glass, @Animatable macro, WebView, rich text, 3D charts, spatial layout, scene bridging |
| [**app-intents-ref**](./app-intents-ref) | App Intents framework for Siri, Apple Intelligence, Shortcuts, Spotlight — AppIntent, AppEntity, parameters, queries, debugging |
| [**avfoundation-ref**](./avfoundation-ref) | AVFoundation audio APIs — AVAudioSession, AVAudioEngine, bit-perfect DAC output, iOS 26+ spatial audio capture, ASAF/APAC, Audio Mix |
| [**foundation-models-ref**](./foundation-models-ref) | Apple Intelligence Foundation Models framework — LanguageModelSession, @Generable, streaming, tool calling, context management (iOS 26+) |
| [**swiftui-layout-ref**](./swiftui-layout-ref) | Complete SwiftUI adaptive layout API guide — ViewThatFits, AnyLayout, Layout protocol, onGeometryChange, size classes, iOS 26 window APIs |
| [**storage-strategy**](./storage-strategy) | Complete iOS storage decision framework — database vs files, local vs cloud, SwiftData/CloudKit/iCloud Drive selection |
| [**cloudkit-ref**](./cloudkit-ref) | Modern CloudKit sync — SwiftData integration, CKSyncEngine (WWDC 2023), database scopes, conflict resolution, monitoring |
| [**icloud-drive-ref**](./icloud-drive-ref) | File-based iCloud sync — ubiquitous containers, NSFileCoordinator, conflict resolution, NSUbiquitousKeyValueStore |
| [**file-protection-ref**](./file-protection-ref) | iOS file encryption and data protection — FileProtectionType levels, background access, Keychain comparison |
| [**storage-management-ref**](./storage-management-ref) | Storage management and purge priorities — disk space APIs, backup exclusion, cache management, URL resource values |

## Diagnostic Skills

| Skill | Description |
|-------|-------------|
| [**accessibility-diag**](./accessibility-diag) | VoiceOver, Dynamic Type, color contrast, touch targets — WCAG compliance with App Store rejection defense |
| [**cloud-sync-diag**](./cloud-sync-diag) | CloudKit errors, iCloud Drive sync failures, quota exceeded — systematic cloud sync diagnostics with production crisis defense |
| [**core-data-diag**](./core-data-diag) | Schema migrations, thread-confinement, N+1 queries — Core Data diagnostics with production crisis defense |
| [**foundation-models-diag**](./foundation-models-diag) | Context exceeded, guardrail violations, slow generation — Foundation Models diagnostics with production crisis defense |
| [**networking-diag**](./networking-diag) | Connection timeouts, TLS failures, data arrival issues — Network.framework diagnostics with production crisis defense |
| [**storage-diag**](./storage-diag) | Files disappeared, backup too large, file access errors — systematic local storage diagnostics with production crisis defense |

## Quality Standards

All reference skills are reviewed against 4 criteria:

1. **Accuracy** — Every claim cited to official sources, code tested
2. **Completeness** — 80%+ coverage, edge cases documented, troubleshooting sections
3. **Clarity** — Examples first, scannable structure, jargon defined
4. **Practical Value** — Copy-paste ready, expert checklists, real-world impact

Diagnostic skills add mandatory workflows and pressure scenario defense for production crisis situations.

## Related Resources

- [Skills](/skills/) — Discipline-enforcing TDD-tested workflows
- [Commands](/commands/) — Quick automated scans
- [WWDC 2025 Sessions](https://developer.apple.com/videos/wwdc2025)
