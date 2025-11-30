# Axiom

Battle-tested Claude Code skills for modern xOS (iOS, iPadOS, watchOS, tvOS) development, updated with the latest iOS 26.x guidance from Apple.

> **Preview Release**: This is an early preview of Axiom. Feedback welcome on what's working well and what's missing. Report issues or suggestions at [GitHub Issues](https://github.com/yourusername/Axiom/issues).

## What's New in 0.1.2 (WWDC 2025 Update)

✨ **New Skills:**
- **Liquid Glass** - Apple's new material design system (iOS 26+) with comprehensive design principles, API patterns, and expert review checklist for validating implementations
- **SwiftUI Performance** - Master the new SwiftUI Instrument in Instruments 26, identify long view body updates, eliminate unnecessary updates with the Cause & Effect Graph

🔄 **Updated Skills:**
- **UI Testing** - Now includes Recording UI Automation (Xcode 26) for recording interactions, replaying across devices/languages, and reviewing video recordings of test runs. Original condition-based waiting patterns preserved and enhanced.

## Structure

- `plugins/` - Claude Code plugins for iOS development workflows
- `docs/` - VitePress documentation site
- `scratch/` - Local development files (not tracked in git)
- `notes/` - Personal notes (not tracked in git)

## Quick Start

### Prerequisites

- macOS (Darwin 25.2.0 or later recommended)
- [Claude Code](https://claude.ai/download) installed
- Xcode 26+ (for WWDC 2025 features like Liquid Glass, Recording UI Automation)
- iOS 26+ SDK (for latest SwiftUI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Axiom.git
cd Axiom

# Install the axiom plugin
claude-code plugin add ./plugins/axiom
```

### Verify Installation

```bash
# List installed plugins
claude-code plugin list

# You should see: axiom@0.1.2
```

### Using Skills

Skills are automatically suggested by Claude Code based on context, or invoke them directly:

```bash
# UI & Design
/skill axiom:liquid-glass
/skill axiom:swiftui-performance
/skill axiom:ui-testing

# Debugging & Performance
/skill axiom:xcode-debugging
/skill axiom:memory-debugging
/skill axiom:build-troubleshooting

# Concurrency & Async
/skill axiom:swift-concurrency

# Data & Persistence
/skill axiom:database-migration
/skill axiom:sqlitedata
/skill axiom:grdb
/skill axiom:swiftdata
```

## Skills Overview

### 🎨 UI & Design

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
Master SwiftUI performance optimization using the new SwiftUI Instrument in Instruments 26 (WWDC 2025).

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

### 🐛 Debugging & Performance

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

### ⚡ Concurrency & Async

#### `swift-concurrency`
Swift 6 strict concurrency patterns - async/await, MainActor, Sendable, actor isolation, and data race prevention.

**When to use:** Debugging Swift 6 concurrency errors, implementing @MainActor classes, converting delegate callbacks to async-safe patterns

---

### 💾 Data & Persistence

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
SwiftData with iOS 26+ features, @Model definitions, @Query patterns, Swift 6 concurrency with @MainActor.

**When to use:** Working with SwiftData @Model definitions, @Query in SwiftUI, @Relationship macros, ModelContext patterns, CloudKit integration

---

## Documentation

Full documentation available at [https://yourusername.github.io/Axiom](https://yourusername.github.io/Axiom)

Run documentation locally:

```bash
npm install
npm run docs:dev
```

Visit http://localhost:5173

## Contributing

This is a preview release. Feedback is welcome!

- **Issues**: Report bugs or request features at [GitHub Issues](https://github.com/yourusername/Axiom/issues)
- **Discussions**: Share usage patterns and ask questions at [GitHub Discussions](https://github.com/yourusername/Axiom/discussions)

## Related Resources

- [Claude Code Documentation](https://docs.claude.ai/code)
- [WWDC 2025 Sessions](https://developer.apple.com/videos/wwdc2025)
  - [Meet Liquid Glass (Session 219)](https://developer.apple.com/videos/play/wwdc2025/219/)
  - [Optimize SwiftUI performance with Instruments (Session 306)](https://developer.apple.com/videos/play/wwdc2025/306/)
  - [Recording UI Automation (Session 344)](https://developer.apple.com/videos/play/wwdc2025/344/)

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

Built with guidance from WWDC 2025 sessions and the iOS development community. Skills tested using the [Superpowers](https://github.com/superpowers-marketplace/superpowers) TDD framework for Claude Code skills.
