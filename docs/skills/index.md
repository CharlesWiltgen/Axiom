# Skills

Axiom provides 18 skills and 3 commands for xOS (iOS, iPadOS, watchOS, tvOS) development.

**Breakdown:**
- **15 TDD-tested skills** – Discipline-enforcing workflows tested with RED-GREEN-REFACTOR methodology
- **3 reference skills** – Comprehensive guides reviewed for accuracy, completeness, clarity, and practical value
- **3 commands** – Quick automated scans for common issues

## Skill Categories

### UI & Design

Build beautiful, performant interfaces with expert guidance on the latest Apple design systems and testing practices.

- [Liquid Glass](/skills/ui-design/liquid-glass) – Apple's new material design system (iOS 26+)
- [SwiftUI Performance](/skills/ui-design/swiftui-performance) – Master the new SwiftUI Instrument in Instruments 26
- [SwiftUI Debugging](/skills/ui-design/swiftui-debugging) – View updates, preview crashes, and layout issues with decision trees
- [UI Testing](/skills/ui-design/ui-testing) – Recording UI Automation (Xcode 26) and condition-based waiting

### Debugging & Troubleshooting

Systematic debugging strategies to solve issues faster and prevent common problems before they happen.

- [Accessibility Debugging](/skills/debugging/accessibility-debugging) – WCAG compliance, VoiceOver testing, App Store Review prep
- [Xcode Debugging](/skills/debugging/xcode-debugging) – Environment-first diagnostics for mysterious issues
- [Memory Debugging](/skills/debugging/memory-debugging) – Systematic leak diagnosis with proven patterns
- [Build Troubleshooting](/skills/debugging/build-troubleshooting) – Dependency resolution for CocoaPods and SPM
- [Performance Profiling](/skills/debugging/performance-profiling) – Instruments decision trees and profiling workflows for CPU, memory, battery

### Concurrency & Async

Master Swift's concurrency model and catch data races at compile time with strict concurrency patterns.

- [Swift Concurrency](/skills/concurrency/swift-concurrency) – Swift 6 strict concurrency, async/await, MainActor, Sendable

### Persistence

Comprehensive database patterns for safe schema evolution and choosing the right persistence framework.

- [Database Migration](/skills/persistence/database-migration) – Safe schema evolution for SQLite/GRDB/SwiftData
- [SQLiteData](/skills/persistence/sqlitedata) – Point-Free's SQLiteData patterns and CloudKit sync
- [GRDB](/skills/persistence/grdb) – Raw SQL queries and ValueObservation patterns
- [SwiftData](/skills/persistence/swiftdata) – iOS 26+ features, @Model definitions, and @Query patterns

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

## Related Resources

- [WWDC 2025 Sessions](https://developer.apple.com/videos/wwdc2025)
- [Claude Code Documentation](https://docs.claude.ai/code)
- [Superpowers TDD Framework](https://github.com/superpowers-marketplace/superpowers)

## Contributing

This is a preview release. Feedback welcome!

- **Issues**: [Report bugs or request features](https://github.com/yourusername/Axiom/issues)
- **Discussions**: [Share usage patterns and ask questions](https://github.com/yourusername/Axiom/discussions)
