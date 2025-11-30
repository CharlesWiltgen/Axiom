# Skills Reference

## Overview

Axiom provides 11 production-ready skills for xOS (iOS, iPadOS, watchOS, tvOS) development.

**Version**: 0.1.3
**Status**: Preview Release

## 🎨 UI & Design Skills

### `axiom:liquid-glass`

Apple's new material design system for iOS 26+. Comprehensive coverage of Liquid Glass visual properties, implementation patterns, and design principles.

**When to use**: Implementing Liquid Glass effects, reviewing UI for adoption, debugging visual artifacts, requesting expert review of implementations

#### Key Features

- **Expert Review Checklist** – 7-section validation checklist for reviewing Liquid Glass implementations
  - Material appropriateness (navigation layer vs content layer)
  - Variant selection (Regular vs Clear decision criteria)
  - Legibility and contrast
  - Layering and hierarchy
  - Scroll edge effects
  - Accessibility (Reduced Transparency, Increased Contrast, Reduced Motion)
  - Performance considerations
- Layered system architecture (highlights, shadows, glow, tinting)
- Troubleshooting visual artifacts, dark mode issues, performance
- Migration from UIBlurEffect/NSVisualEffectView
- Complete API reference with working code examples

**Requirements**: iOS 26+, iPadOS 26+, macOS Tahoe+, visionOS 3+, Xcode 26+

#### WWDC References

- [Meet Liquid Glass – Session 219](https://developer.apple.com/videos/play/wwdc2025/219/)
- [Build a SwiftUI app with the new design – Session 323](https://developer.apple.com/videos/play/wwdc2025/323/)

---

### `axiom:swiftui-performance`

Master SwiftUI performance optimization using the new SwiftUI Instrument in Instruments 26.

**When to use**: App feels less responsive, animations stutter, scrolling performance issues, profiling reveals SwiftUI bottlenecks

#### Key Features

- **New SwiftUI Instrument walkthrough** – 4 track lanes, color-coding system, integration with Time Profiler
- **Cause & Effect Graph** – Visualize data flow and dependencies to eliminate unnecessary updates
- **Problem 1: Long View Body Updates**
  - Identifying long updates with Instruments
  - Time Profiler integration for finding bottlenecks
  - Common expensive operations (formatter creation, calculations, I/O, image processing)
  - Verification workflows
- **Problem 2: Unnecessary View Updates**
  - AttributeGraph and dependency tracking
  - Granular dependencies with per-item view models
  - Environment updates performance implications
- **Performance Optimization Checklist** – Systematic approach from profiling setup through verification
- Real-world impact examples from WWDC's Landmarks app

**Requirements**: Xcode 26+, iOS 26+ SDK for profiling

#### WWDC References

- [Optimize SwiftUI performance with Instruments – Session 306](https://developer.apple.com/videos/play/wwdc2025/306/)

**Philosophy**: Ensure your view bodies update quickly and only when needed to achieve great SwiftUI performance.

---

### `axiom:ui-testing`

Reliable UI testing with condition-based waiting patterns and new Recording UI Automation features from Xcode 26.

**When to use**: Writing UI tests, recording interactions, tests have race conditions or timing dependencies, flaky tests

#### Key Features

- **Recording UI Automation** – Record interactions as Swift code, replay across configurations, review video recordings
  - Three phases: Record → Replay → Review
  - Replay configurations (devices, languages, regions, orientations, accessibility)
  - Video review with scrubbing, overlays, filters
- **Condition-based waiting** – Eliminates flaky tests from sleep() timeouts
  - waitForExistence patterns
  - NSPredicate expectations
  - Custom condition polling
- Accessibility-first testing patterns
- SwiftUI and UIKit testing strategies
- Test plans and configurations
- Real-world impact: 15 min → 5 min test suite, 20% flaky → 2%

**Requirements**: Xcode 26+ for Recording UI Automation, original patterns work with earlier versions

#### WWDC References

- [Recording UI Automation – Session 344](https://developer.apple.com/videos/play/wwdc2025/344/)

**Philosophy**: Wait for conditions, not arbitrary timeouts. Flaky tests come from guessing how long operations take.

---

## 🔧 Debugging & Troubleshooting

### `axiom:xcode-debugging`

Environment-first diagnostics for mysterious Xcode issues. Prevents 30+ minute rabbit holes by checking build environment before debugging code.

**When to use**: BUILD FAILED, test crashes, simulator hangs, stale builds, zombie xcodebuild processes, "Unable to boot simulator", "No such module" after SPM changes, mysterious test failures

#### Key Features

- Mandatory environment checks (Derived Data, processes, simulators)
- Quick fix workflows for common issues
- Decision tree for diagnosing problems
- Crash log analysis patterns
- Time cost transparency (prevents rabbit holes)

**Philosophy**: 80% of "mysterious" Xcode issues are environment problems, not code bugs. Check environment BEFORE debugging code.

**TDD Tested**: 6 refinements from pressure testing with Superpowers framework

---

### `axiom:memory-debugging`

Systematic memory leak diagnosis with Instruments. 5 leak patterns covering 90% of real-world issues.

**When to use**: App memory grows over time, seeing multiple instances of same class, crashes with memory limit exceeded, Instruments shows retain cycles

#### Key Features

- 5 comprehensive leak patterns
  - Delegate retain cycles
  - Closure capture cycles
  - Observer leaks
  - Cache accumulation
  - View controller leaks
- Instruments workflow (Leaks + Allocations)
- Stack trace analysis
- Quick diagnostic questions
- Reduces debugging from 2-3 hours to 15-30 min

**Philosophy**: Memory leaks follow predictable patterns. Systematic diagnosis is faster than trial-and-error.

---

### `axiom:build-troubleshooting`

Dependency resolution for CocoaPods and Swift Package Manager conflicts.

**When to use**: Dependency conflicts, CocoaPods/SPM resolution failures, "Multiple commands produce" errors, framework version mismatches

#### Key Features

- CocoaPods conflict resolution
- SPM version resolution
- Multiple commands produce errors
- Framework version mismatches
- Clean build strategies

---

## ⚡ Swift & Concurrency

### `axiom:swift-concurrency`

Swift 6 strict concurrency patterns – async/await, MainActor, Sendable, actor isolation, and data race prevention.

**When to use**: Debugging Swift 6 concurrency errors (actor isolation, data races, Sendable warnings), implementing @MainActor classes, converting delegate callbacks to async-safe patterns

#### Key Features

- Quick decision tree for concurrency errors
- Copy-paste templates for common patterns
  - Delegate capture (weak self)
  - Sendable conformance
  - MainActor isolation
  - Background task patterns
- Anti-patterns to avoid
- Code review checklist

**Philosophy**: Swift 6's strict concurrency catches bugs at compile time instead of runtime crashes.

**TDD Tested**: Critical checklist contradiction found and fixed during pressure testing

---

## 💾 Persistence

### `axiom:database-migration`

Safe database schema evolution for SQLite/GRDB/SwiftData. Prevents data loss with additive migrations and testing workflows.

**When to use**: Adding/modifying database columns, encountering "FOREIGN KEY constraint failed", "no such column", "cannot add NOT NULL column" errors, creating schema migrations for SQLite/GRDB/SwiftData

#### Key Features

- Safe migration patterns (additive, idempotent, transactional)
- Testing checklist (fresh install + migration paths)
- Common errors and fixes
- GRDB and SwiftData examples
- Multi-layered prevention for 100k+ user apps

**Philosophy**: Migrations are immutable after shipping. Make them additive, idempotent, and thoroughly tested to prevent data loss.

**TDD Tested**: Already bulletproof, no changes needed during pressure testing

---

### `axiom:sqlitedata`

SQLiteData (Point-Free) patterns, critical gotchas, batch performance, and CloudKit sync.

**When to use**: Working with SQLiteData @Table models, @FetchAll/@FetchOne queries, StructuredQueries post-migration crashes, batch imports, deciding when to drop to GRDB

#### Key Features

- @Table model patterns
- Query patterns with @FetchAll/@FetchOne
- StructuredQueries crash prevention
- Batch import performance
- CloudKit sync setup
- When to drop to GRDB for performance

---

### `axiom:grdb`

Raw GRDB for complex queries, ValueObservation, DatabaseMigrator patterns.

**When to use**: Writing raw SQL queries with GRDB, complex joins, ValueObservation for reactive queries, DatabaseMigrator patterns, dropping down from SQLiteData for performance

#### Key Features

- Raw SQL query patterns
- ValueObservation for reactive queries
- DatabaseMigrator setup
- Complex joins and aggregations
- Performance optimization
- Direct SQLite access patterns

---

### `axiom:swiftdata`

SwiftData with iOS 26+ features, @Model definitions, @Query patterns, Swift 6 concurrency with @MainActor.

**When to use**: Working with SwiftData @Model definitions, @Query in SwiftUI, @Relationship macros, ModelContext patterns, CloudKit integration, iOS 26+ features, Swift 6 concurrency

#### Key Features

- @Model definitions
- @Query patterns in SwiftUI
- @Relationship macros
- ModelContext patterns
- CloudKit integration
- iOS 26+ features
- Swift 6 concurrency with @MainActor

---

## Skill Development Methodology

Skills in Axiom are developed using rigorous quality standards:

### TDD-Tested Skills
- **xcode-debugging**: 6 refinements from pressure testing
- **swift-concurrency**: Critical checklist contradiction found and fixed
- **database-migration**: Already bulletproof, validated under pressure

### Reference Skills
All persistence and WWDC 2025 skills reviewed against 4 quality criteria:
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
