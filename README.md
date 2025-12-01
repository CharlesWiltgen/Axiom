# Axiom

Battle-tested Claude Code skills for modern xOS (iOS, iPadOS, watchOS, tvOS) development, updated with the latest iOS 26.x guidance from Apple.

## What's New Recently

**Latest Skills**
- **Realm to SwiftData Migration** - Migrate before Device Sync sunset (Sept 30, 2025) without losing user data or breaking threading patterns
- **SwiftData** - Prevents CloudKit sync failures that lose data, catches N+1 queries before they slow your app, safely migrates from Realm/Core Data
- **Swift Concurrency** - Prevents data races when accessing databases in background, handles CloudKit sync without blocking UI

**Recently Added**
- **SwiftUI Debugging** - Solve intermittent view updates and preview crashes with diagnostic decision trees
- **Performance Profiling** - Find CPU bottlenecks, memory growth, and N+1 queries before users complain
- **Liquid Glass** - Implement Apple's glass effects correctly and get expert validation
- **SwiftUI Performance** - Find what's making your views slow and fix it
- **UI Testing** - Record tests that work reliably across devices and languages

## Structure

- `plugins/` - Claude Code plugins for iOS development workflows
- `docs/` - VitePress documentation site
- `scratch/` - Local development files (not tracked in git)
- `notes/` - Personal notes (not tracked in git)

## Quick Start

### Prerequisites

- **macOS 15+** (Sequoia or later)
- **Claude Code** ([download here](https://claude.ai/download))
- **Xcode 26+** (for Liquid Glass, Recording UI Automation, and latest iOS features)
- **iOS 26 SDK** (comes with Xcode 26)

### Installation

In Claude Code, run:

```
/plugin marketplace add https://charleswiltgen.github.io/Axiom/
```

Then search for "axiom" in the `/plugin` menu and install.

### Verify Installation

Use `/plugin` and select "Manage and install" to see installed plugins. Axiom should be listed.

### Using Skills

Skills are **automatically suggested by Claude Code** based on your questions and context. Simply ask questions that match the skill's purpose:

**Examples:**
- "I'm getting BUILD FAILED in Xcode" → activates `xcode-debugging`
- "How do I fix Swift 6 concurrency errors?" → activates `swift-concurrency`
- "I need to add a database column safely" → activates `database-migration`
- "My app has memory leaks" → activates `memory-debugging`
- "Help me migrate from Realm to SwiftData" → activates `realm-to-swiftdata-migration`

## Skills Overview

### UI & Design

#### `liquid-glass`
Apple's new material design system for iOS 26+. Comprehensive coverage of Liquid Glass visual properties, implementation patterns, and design principles.

**Key Features:**
- **Expert Review Checklist** - 7-section validation checklist for reviewing Liquid Glass implementations (material appropriateness, variant selection, legibility, layering, accessibility, performance)
- Regular vs Clear variant decision criteria
- Layered system architecture (highlights, shadows, glow, tinting)
- Troubleshooting visual artifacts, dark mode issues, performance
- Migration from UIBlurEffect/NSVisualEffectView
- Complete API reference with code examples

**When to use:** Implementing Liquid Glass effects, reviewing UI for adoption, debugging visual artifacts, requesting expert review of implementations

**Requirements:** iOS 26+, Xcode 26+

---

#### `swiftui-performance`
Master SwiftUI performance optimization using the new SwiftUI Instrument in Instruments 26.

**Key Features:**
- New SwiftUI Instrument walkthrough (4 track lanes, color-coding, integration with Time Profiler)
- **Cause & Effect Graph** - Visualize data flow and dependencies to eliminate unnecessary updates
- Problem 1: Long View Body Updates (formatter caching, expensive operations)
- Problem 2: Unnecessary View Updates (granular dependencies, AttributeGraph)
- Performance optimization checklist
- Real-world impact examples from WWDC's Landmarks app

**When to use:** App feels less responsive, animations stutter, scrolling performance issues, profiling reveals SwiftUI bottlenecks

**Requirements:** Xcode 26+, iOS 26+ SDK

---

#### `ui-testing`
Reliable UI testing with condition-based waiting patterns and new Recording UI Automation features from Xcode 26.

**Key Features:**
- **Recording UI Automation** - Record interactions as Swift code, replay across devices/languages/configurations, review video recordings
- Three phases: Record → Replay → Review
- Condition-based waiting (eliminates flaky tests from sleep() timeouts)
- Accessibility-first testing patterns
- SwiftUI and UIKit testing strategies
- Test plans and configurations

**When to use:** Writing UI tests, recording interactions, tests have race conditions or timing dependencies, flaky tests

**Requirements:** Xcode 26+ for Recording UI Automation, original patterns work with earlier versions

---

#### `swiftui-debugging`
Diagnostic decision trees for SwiftUI view updates, preview crashes, and layout issues. Includes 3 real-world examples.

**Key Features:**
- **View Not Updating Decision Tree** - Diagnose struct mutation, binding identity, view recreation, missing observers
- **Preview Crashes Decision Tree** - Identify missing dependencies, state init failures, cache corruption
- **Layout Issues Quick Reference** - ZStack ordering, GeometryReader sizing, SafeArea, frame/fixedSize
- **Real-World Examples** - List items, preview dependencies, text field bindings with complete diagnosis workflows
- Pressure scenarios for intermittent bugs, App Store Review deadlines, authority pressure resistance

**When to use:** View doesn't update, preview crashes, layout looks wrong, intermittent rendering issues

**Requirements:** Xcode 15+, iOS 14+

---

#### `performance-profiling`
Instruments decision trees and profiling workflows for CPU, memory, and battery optimization. Includes 3 real-world examples.

**Key Features:**
- **Performance Decision Tree** - Choose the right tool (Time Profiler, Allocations, Core Data, Energy Impact)
- **Time Profiler Deep Dive** - CPU analysis, hot spots, Self Time vs Total Time distinction
- **Allocations Deep Dive** - Memory growth diagnosis, object counts, leak vs caching
- **Core Data Deep Dive** - N+1 query detection with SQL logging, prefetching, batch optimization
- **Real-World Examples** - N+1 queries, UI lag diagnosis, memory vs leak with complete workflows
- Pressure scenarios for App Store deadlines, manager authority pressure, misinterpretation prevention

**When to use:** App feels slow, memory grows over time, battery drains fast, want to profile proactively

**Requirements:** Xcode 15+, iOS 14+

---

### Debugging & Performance

#### `xcode-debugging`
Environment-first diagnostics for mysterious Xcode issues. Prevents 30+ minute rabbit holes by checking build environment before debugging code.

**When to use:** BUILD FAILED, test crashes, simulator hangs, stale builds, zombie xcodebuild processes, "Unable to boot simulator", "No such module" after SPM changes

---

#### `memory-debugging`
Systematic memory leak diagnosis with Instruments. 5 leak patterns covering 90% of real-world issues.

**When to use:** App memory grows over time, seeing multiple instances of same class, crashes with memory limit exceeded, Instruments shows retain cycles

---

#### `build-troubleshooting`
Dependency resolution for CocoaPods and Swift Package Manager conflicts.

**When to use:** Dependency conflicts, CocoaPods/SPM resolution failures, "Multiple commands produce" errors, framework version mismatches

---

### Concurrency & Async

#### `swift-concurrency`
Swift 6 strict concurrency patterns - async/await, MainActor, Sendable, actor isolation, and data race prevention.

**When to use:** Debugging Swift 6 concurrency errors, implementing @MainActor classes, converting delegate callbacks to async-safe patterns

---

### Data & Persistence

#### `database-migration`
Safe database schema evolution for SQLite/GRDB/SwiftData. Prevents data loss with additive migrations and testing workflows.

**When to use:** Adding/modifying database columns, encountering "FOREIGN KEY constraint failed", "no such column", "cannot add NOT NULL column" errors

---

#### `sqlitedata`
SQLiteData (Point-Free) patterns, critical gotchas, batch performance, and CloudKit sync.

**When to use:** Working with SQLiteData @Table models, @FetchAll/@FetchOne queries, StructuredQueries crashes, batch imports

---

#### `grdb`
Raw GRDB for complex queries, ValueObservation, DatabaseMigrator patterns.

**When to use:** Writing raw SQL queries, complex joins, ValueObservation for reactive queries, dropping down from SQLiteData for performance

---

#### `swiftdata`
SwiftData with iOS 26+ features, @Model definitions, @Query patterns, Swift 6 concurrency with @MainActor. Enhanced with CloudKit integration patterns, performance optimization, and migration strategies from Realm/Core Data.

**When to use:** Working with SwiftData @Model definitions, @Query in SwiftUI, @Relationship macros, ModelContext patterns, CloudKit integration, performance optimization

**What's New**: CloudKit constraints & conflict resolution, N+1 query prevention, batch operations, indexes (iOS 26+), migration patterns from Realm and Core Data

---

#### `realm-to-swiftdata-migration`
Comprehensive migration guide for Realm users facing Device Sync sunset (Sept 30, 2025). Complete path from Realm to SwiftData with pattern equivalents, threading model conversion, schema strategies, and testing checklist.

**When to use:** Migrating from Realm to SwiftData, planning data migration, understanding threading differences, handling CloudKit sync transition, testing for production readiness

**Urgency**: Realm Device Sync sunset September 30, 2025 - this skill is essential for affected developers

**Timeline**: 2-8 weeks depending on app complexity

---

## Documentation

Full documentation available at [https://charleswiltgen.github.io/Axiom](https://charleswiltgen.github.io/Axiom)

## Contributing

This is a preview release. Feedback is welcome!

- **Issues**: Report bugs or request features at [GitHub Issues](https://github.com/yourusername/Axiom/issues)
- **Discussions**: Share usage patterns and ask questions at [GitHub Discussions](https://github.com/yourusername/Axiom/discussions)

## Related Resources

- [Claude Code Documentation](https://docs.claude.ai/code)
- [Apple Developer Documentation](https://developer.apple.com/)
  - [Liquid Glass Design System](https://developer.apple.com/design/human-interface-guidelines/)
  - [SwiftUI Performance](https://developer.apple.com/videos/)

