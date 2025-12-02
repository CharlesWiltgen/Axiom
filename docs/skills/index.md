# Skills

Discipline-enforcing workflows tested with ["red/green/refactor" methodology](https://en.wikipedia.org/wiki/Test-driven_development) to prevent common mistakes under pressure.

### UI & Design

| Skill | When to Use |
|-------|-------------|
| [**liquid-glass**](/skills/ui-design/liquid-glass) | Implementing Liquid Glass effects, debugging visual artifacts, design review pressure |
| [**swiftui-performance**](/skills/ui-design/swiftui-performance) | App feels sluggish, animations stutter, SwiftUI Instrument profiling |
| [**swiftui-debugging**](/skills/ui-design/swiftui-debugging) | View doesn't update, preview crashes, layout issues |
| [**ui-testing**](/skills/ui-design/ui-testing) | Recording UI tests, flaky tests, race conditions |

### Debugging

| Skill | When to Use |
|-------|-------------|
| [**xcode-debugging**](/skills/debugging/xcode-debugging) | BUILD FAILED, simulator hangs, zombie processes |
| [**memory-debugging**](/skills/debugging/memory-debugging) | Memory leaks, retain cycles, progressive memory growth |
| [**build-troubleshooting**](/skills/debugging/build-troubleshooting) | Dependency conflicts, CocoaPods/SPM failures |
| [**performance-profiling**](/skills/debugging/performance-profiling) | App feels slow, profiling with Instruments |

### Concurrency

| Skill | When to Use |
|-------|-------------|
| [**swift-concurrency**](/skills/concurrency/swift-concurrency) | Swift 6 actor isolation, Sendable errors, data races |

### Persistence

| Skill | When to Use |
|-------|-------------|
| [**database-migration**](/skills/persistence/database-migration) | Adding database columns, schema changes, migration errors |
| [**swiftdata**](/skills/persistence/swiftdata) | @Model, @Query, CloudKit integration |
| [**sqlitedata**](/skills/persistence/sqlitedata) | SQLiteData patterns, batch imports, CloudKit sync |
| [**grdb**](/skills/persistence/grdb) | Raw SQL queries, complex joins, ValueObservation |

### Legacy

| Skill | When to Use |
|-------|-------------|
| [**uikit-animation-debugging**](/skills/ui-design/uikit-animation-debugging) | CAAnimation issues, completion handlers, spring physics |
| [**objc-block-retain-cycles**](/skills/debugging/objc-block-retain-cycles) | Block memory leaks, weak-strong patterns |

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
- `build-troubleshooting` – Resolves dependency conflicts under production crisis pressure
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

**Current reference skills:**
- `accessibility-debugging` – WCAG compliance, VoiceOver testing, Accessibility Inspector workflows
- `app-intents-integration` – Siri, Apple Intelligence, Shortcuts, Spotlight integration (WWDC 2025-260)
- `swiftui-26-features` – iOS 26 SwiftUI: Liquid Glass, WebView, rich text, 3D charts (WWDC 2025-256)
- `core-data-debugging` – Core Data troubleshooting and optimization
- `realm-to-swiftdata-migration` – Migration patterns from Realm to SwiftData

## Related Resources

- [WWDC 2025 Sessions](https://developer.apple.com/videos/wwdc2025)
- [Claude Code Documentation](https://docs.claude.ai/code)
- [Superpowers TDD Framework](https://github.com/superpowers-marketplace/superpowers)

## Contributing

This is a preview release. Feedback welcome!

- **Issues**: [Report bugs or request features](https://github.com/CharlesWiltgen/Axiom/issues)
- **Discussions**: [Share usage patterns and ask questions](https://github.com/CharlesWiltgen/Axiom/discussions)
