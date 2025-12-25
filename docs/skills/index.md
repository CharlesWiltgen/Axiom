# Skills

Discipline-enforcing workflows tested with ["red/green/refactor" methodology](https://en.wikipedia.org/wiki/Test-driven_development) to prevent common mistakes under pressure.

### UI & Design

| Skill | When to Use |
|-------|-------------|
| [**hig**](/skills/ui-design/hig) | Quick design decisions, HIG compliance checklists, defending design choices |
| [**hig-ref**](/reference/hig-ref) | Comprehensive HIG reference with code examples and best practices |
| [**liquid-glass**](/skills/ui-design/liquid-glass) | Implementing Liquid Glass effects, debugging visual artifacts, design review pressure |
| [**liquid-glass-ref**](/reference/liquid-glass-ref) | Complete Liquid Glass adoption guide (icons, controls, navigation, windows) |
| [**swiftui-architecture**](/skills/ui-design/swiftui-architecture) | Separating logic from views, choosing architecture patterns (MVVM, TCA, Coordinator) |
| [**swiftui-performance**](/skills/ui-design/swiftui-performance) | App feels sluggish, animations stutter, SwiftUI Instrument profiling |
| [**swiftui-debugging**](/skills/ui-design/swiftui-debugging) | View doesn't update, preview crashes, layout issues |
| [**swiftui-debugging-diag**](/diagnostic/swiftui-debugging-diag) | Systematic SwiftUI debugging, intermittent issues, complex state dependencies |
| [**swiftui-gestures**](/skills/ui-design/swiftui-gestures) | Implementing tap, drag, long press, magnification, rotation gestures |
| [**swiftui-layout**](/skills/ui-design/swiftui-layout) | Adaptive layouts, iPad multitasking, iOS 26 free-form windows |
| [**swiftui-layout-ref**](/reference/swiftui-layout-ref) | ViewThatFits, AnyLayout, Layout protocol, iOS 26 window APIs |
| [**swiftui-nav**](/skills/ui-design/swiftui-nav) | NavigationStack vs NavigationSplitView, deep links, coordinator patterns |
| [**swiftui-nav-diag**](/diagnostic/swiftui-nav-diag) | Navigation not responding, unexpected pops, deep link failures |
| [**swiftui-nav-ref**](/reference/swiftui-nav-ref) | Comprehensive SwiftUI navigation API reference (iOS 16-26) |
| [**swiftui-26-ref**](/reference/swiftui-26-ref) | iOS 26 SwiftUI: Liquid Glass, WebView, AttributedString rich text, 3D charts |
| [**textkit-ref**](/reference/textkit-ref) | TextKit 2 architecture, migration, Writing Tools support |
| [**typography-ref**](/reference/typography-ref) | San Francisco fonts, text styles, Dynamic Type, tracking, leading |
| [**uikit-animation-debugging**](/skills/ui-design/uikit-animation-debugging) | CAAnimation issues, completion handlers, spring physics |

### Computer Vision

| Skill | When to Use |
|-------|-------------|
| [**vision**](/skills/computer-vision/vision) | Subject segmentation, hand/body pose detection, excluding hands from objects, VisionKit vs Vision |
| [**vision-ref**](/reference/vision-ref) | Complete Vision framework API reference with code examples |
| [**vision-diag**](/reference/vision-diag) | Subject not detected, low confidence landmarks, performance issues, coordinate conversion |

### Debugging

| Skill | When to Use |
|-------|-------------|
| [**accessibility-diag**](/diagnostic/accessibility-diag) | VoiceOver issues, Dynamic Type violations, WCAG compliance, App Store Review prep |
| [**auto-layout-debugging**](/skills/debugging/auto-layout-debugging) | Constraint conflicts, ambiguous layout warnings, Auto Layout errors |
| [**build-performance**](/skills/debugging/build-performance) | Slow builds, type checking bottlenecks, analyzing Build Timeline |
| [**build-debugging**](/skills/debugging/build-debugging) | Dependency conflicts, CocoaPods/SPM failures |
| [**core-data-diag**](/diagnostic/core-data-diag) | Schema migration crashes, thread-confinement errors, N+1 query performance |
| [**deep-link-debugging**](/skills/debugging/deep-link-debugging) | Debug-only deep links for testing, simulator navigation, automated testing |
| [**memory-debugging**](/skills/debugging/memory-debugging) | Memory leaks, retain cycles, progressive memory growth |
| [**objc-block-retain-cycles**](/skills/debugging/objc-block-retain-cycles) | Block memory leaks, weak-strong patterns |
| [**performance-profiling**](/skills/debugging/performance-profiling) | App feels slow, profiling with Instruments |
| [**xcode-debugging**](/skills/debugging/xcode-debugging) | BUILD FAILED, simulator hangs, zombie processes |

### Concurrency

| Skill | When to Use |
|-------|-------------|
| [**swift-concurrency**](/skills/concurrency/swift-concurrency) | Swift 6 actor isolation, Sendable errors, data races |

### Persistence & Storage

| Skill | When to Use |
|-------|-------------|
| [**cloud-sync**](/skills/persistence/cloud-sync) | CloudKit vs iCloud Drive, offline-first sync, conflict resolution |
| [**cloudkit-ref**](/reference/cloudkit-ref) | CloudKit sync, CKSyncEngine, CKRecord, shared database, conflict resolution |
| [**cloud-sync-diag**](/diagnostic/cloud-sync-diag) | File not syncing, CloudKit errors, sync conflicts, iCloud upload failures |
| [**codable**](/skills/persistence/codable) | JSON encoding/decoding, Codable conformance, handling decode errors, date strategies |
| [**core-data**](/skills/persistence/core-data) | Core Data stack, concurrency patterns, relationship modeling, iOS 16 support |
| [**database-migration**](/skills/persistence/database-migration) | Adding database columns, schema changes, migration errors |
| [**file-protection-ref**](/reference/file-protection-ref) | FileProtectionType, file encryption, data protection, secure storage |
| [**grdb**](/skills/persistence/grdb) | Raw SQL queries, complex joins, ValueObservation |
| [**icloud-drive-ref**](/reference/icloud-drive-ref) | iCloud Drive, ubiquitous containers, NSFileCoordinator, file sync |
| [**realm-migration-ref**](/reference/realm-migration-ref) | Migrating from Realm to SwiftData (Device Sync sunset Sept 2025) |
| [**sqlitedata**](/skills/persistence/sqlitedata) | SQLiteData patterns, batch imports, CloudKit sync |
| [**storage-diag**](/diagnostic/storage-diag) | Files disappeared, data missing, backup too large, file not found |
| [**storage-management-ref**](/reference/storage-management-ref) | Purge files, storage pressure, isExcludedFromBackup, cache management |
| [**storage**](/reference/storage) | Where to store data, SwiftData vs files, CloudKit vs iCloud Drive |
| [**swiftdata**](/skills/persistence/swiftdata) | @Model, @Query, CloudKit integration |
| [**swiftdata-migration**](/skills/persistence/swiftdata-migration) | SwiftData custom schema migrations, relationship preservation |
| [**swiftdata-migration-diag**](/diagnostic/swiftdata-migration-diag) | Migration crashes, relationship errors, device vs simulator failures |
| [**sqlitedata-migration**](/skills/persistence/sqlitedata-migration) | Migrating from SwiftData to SQLiteData |

### Integration

| Skill | When to Use |
|-------|-------------|
| [**app-discoverability**](/reference/app-discoverability) | App Intents, App Shortcuts, Core Spotlight, NSUserActivity for Spotlight/Siri suggestions |
| [**app-intents-ref**](/reference/app-intents-ref) | Siri, Apple Intelligence, Shortcuts, Spotlight integration (iOS 16+) |
| [**app-shortcuts-ref**](/reference/app-shortcuts-ref) | App Shortcuts, instant Siri availability, suggested phrases |
| [**apple-docs-research**](/skills/integration/apple-docs-research) | Researching Apple frameworks, getting WWDC transcripts, using sosumi.ai |
| [**avfoundation-ref**](/reference/avfoundation-ref) | AVAudioSession, AVAudioEngine, bit-perfect DAC output, iOS 26+ spatial audio capture |
| [**core-spotlight-ref**](/reference/core-spotlight-ref) | Core Spotlight search, NSUserActivity, CSSearchableItem, IndexedEntity |
| [**extensions-widgets**](/skills/integration/extensions-widgets) | Implementing widgets, Live Activities, Control Center controls |
| [**extensions-widgets-ref**](/reference/extensions-widgets-ref) | Complete WidgetKit/ActivityKit API reference |
| [**foundation-models**](/skills/integration/foundation-models) | On-device AI with Apple's Foundation Models framework (iOS 26+) |
| [**foundation-models-diag**](/diagnostic/foundation-models-diag) | Foundation Models troubleshooting (context exceeded, guardrails, slow generation) |
| [**foundation-models-ref**](/reference/foundation-models-ref) | Complete Foundation Models API reference with WWDC examples |
| [**in-app-purchases**](/skills/integration/in-app-purchases) | StoreKit 2 implementation, subscriptions, transaction handling |
| [**network-framework-ref**](/reference/network-framework-ref) | Network.framework API reference (iOS 12-26+), TLV framing, Wi-Fi Aware |
| [**networking**](/skills/integration/networking) | Implementing UDP/TCP connections, migrating from sockets, debugging connection failures |
| [**networking-diag**](/diagnostic/networking-diag) | Connection timeouts, TLS failures, data not arriving, performance issues |
| [**now-playing**](/skills/integration/now-playing) | Now Playing metadata, Lock Screen/Control Center integration, remote commands |
| [**storekit-ref**](/reference/storekit-ref) | Complete StoreKit 2 API reference with iOS 18.4 enhancements |

### Testing

| Skill | When to Use |
|-------|-------------|
| [**ui-testing**](/skills/ui-design/ui-testing) | Recording UI tests, flaky tests, race conditions |

## Skill Development Methodology

Skills in Axiom are developed using rigorous quality standards:

### TDD-Tested Skills

Battle-tested against real-world scenarios and pressure conditions:

- `xcode-debugging` – Handles mysterious build failures, zombie processes, and simulator hangs
- `swift-concurrency` – Prevents data races and actor isolation errors in Swift 6
- `database-migration` – Prevents data loss during schema changes with 100k+ users
- `swiftdata` – Handles CloudKit corruption, many-to-many relationships, and unfollow patterns
- `memory-debugging` – Finds PhotoKit leaks and diagnoses non-reproducible memory issues
- `ui-testing` – Handles flaky tests, network conditions, and App Store review blockers
- `build-debugging` – Resolves dependency conflicts under production crisis pressure
- `liquid-glass` – Navigates design review pressure and variant decision conflicts
- `swiftui-performance` – Diagnoses performance issues under App Store deadline pressure
- `swiftui-debugging` – Solves intermittent view updates and preview crashes
- `performance-profiling` – Identifies CPU bottlenecks, memory growth, and N+1 queries
- `sqlitedata` – Handles StructuredQueries migration crashes and data-loss scenarios
- `grdb` – Optimizes complex join queries and ValueObservation performance

### Reference Skills

All reference skills are reviewed against 4 quality criteria:

1. **Accuracy** – Every claim cited to official sources, code tested
2. **Completeness** – 80%+ coverage, edge cases documented, troubleshooting sections
3. **Clarity** – Examples first, scannable structure, jargon defined
4. **Practical Value** – Copy-paste ready, expert checklists, real-world impact

#### Current reference skills
- `accessibility-diag` – WCAG compliance, VoiceOver testing, Accessibility Inspector workflows
- `app-intents-ref` – Siri, Apple Intelligence, Shortcuts, Spotlight integration
- `swiftui-26-ref` – iOS 26 SwiftUI: Liquid Glass, WebView, rich text, 3D charts
- `core-data-diag` – Core Data troubleshooting and optimization
- `realm-migration-ref` – Migration patterns from Realm to SwiftData
- `network-framework-ref` – Network.framework API reference (iOS 12-26+)
- `avfoundation-ref` – AVFoundation audio APIs, iOS 26+ spatial audio, bit-perfect DAC
- `foundation-models-ref` – Apple Intelligence Foundation Models framework (iOS 26+)
- `foundation-models-diag` – Foundation Models troubleshooting and diagnostics
- `swiftui-layout-ref` – ViewThatFits, AnyLayout, Layout protocol, iOS 26 window APIs

## Related Resources

- [WWDC 2025 Sessions](https://developer.apple.com/videos/wwdc2025)
- [Claude Code Documentation](https://docs.claude.ai/code)
- [Superpowers TDD Framework](https://github.com/superpowers-marketplace/superpowers)

## Contributing

This is a preview release. Feedback welcome!

- **Issues**: [Report bugs or request features](https://github.com/CharlesWiltgen/Axiom/issues)
- **Discussions**: [Share usage patterns and ask questions](https://github.com/CharlesWiltgen/Axiom/discussions)
