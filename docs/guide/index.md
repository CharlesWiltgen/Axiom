# Getting Started

Welcome to Axiom, battle-tested Claude Code skills for modern xOS (iOS, iPadOS, watchOS, tvOS) development.

## What is Axiom?

Axiom provides 17 production-ready TDD-tested skills covering:

### 🎨 UI & Design Skills
- **Liquid Glass** – Implement Apple's glass effects correctly and get expert validation
- **SwiftUI Performance** – Find what's making your views slow and fix it
- **UI Testing** – Record tests that work reliably across devices and languages

### 🐛 Debugging & Performance
- **Xcode Debugging** – Fix mysterious build failures and zombie processes fast
- **Memory Debugging** – Find memory leaks before users complain about crashes
- **Build Troubleshooting** – Resolve dependency conflicts under production pressure

### ⚡ Concurrency & Async
- **Swift Concurrency** – Prevent data races and fix actor isolation errors in Swift 6

### 💾 Data & Persistence
- **Database Migration** – Add columns without losing user data
- **SQLiteData** – Handle batch imports and CloudKit sync without performance issues
- **GRDB** – Optimize complex queries and prevent N+1 query problems
- **SwiftData** – Prevent CloudKit sync failures and handle concurrent access safely
- **Realm to SwiftData Migration** – Migrate before Device Sync sunset (Sept 30, 2025) without breaking threading
- **Core Data Debugging** – Fix migration crashes and thread-confinement errors

### 🔄 UIKit & Legacy
- **UIKit Animation Debugging** – Fix animations that don't fire or behave differently on device
- **Objective-C Block Retain Cycles** – Find and fix memory leaks from blocks

## Prerequisites

- **macOS 15+** (Sequoia or later)
- **Claude Code** ([download here](https://claude.ai/download))
- **Xcode 26+** (for Liquid Glass, Recording UI Automation, and latest iOS features)
- **iOS 26 SDK** (comes with Xcode 26)

## Quick Start

### 1. Add the Marketplace

In Claude Code, run:

```
/plugin marketplace add https://charleswiltgen.github.io/Axiom/
```

### 2. Install the Plugin

Once you've added the marketplace in Claude Code:

1. Use `/plugin` to open the plugin menu
2. Search for "axiom"
3. Click "Install"

### 3. Verify Installation

Use `/plugin` and select "Manage and install" to see installed plugins. Axiom should be listed.

### 4. Use Skills

Skills are **automatically suggested by Claude Code** based on your questions and context. Simply ask questions that match the skill's purpose:

**Examples:**
- "I'm getting BUILD FAILED in Xcode with stale builds" → activates `xcode-debugging`
- "How do I fix actor isolation errors in Swift 6?" → activates `swift-concurrency`
- "I need to add a column to my database safely" → activates `database-migration`
- "My app has memory leaks, where should I look?" → activates `memory-debugging`

Skills available in Axiom:
- **UI & Design**: liquid-glass, swiftui-performance, ui-testing, swiftui-debugging
- **Debugging**: xcode-debugging, memory-debugging, build-troubleshooting, performance-profiling
- **Concurrency**: swift-concurrency
- **Data & Persistence**: database-migration, sqlitedata, grdb, swiftdata, realm-to-swiftdata-migration, core-data-debugging
- **Legacy**: objc-block-retain-cycles, uikit-animation-debugging

## Common Workflows

### Implementing Liquid Glass

When adding Liquid Glass to your app:

1. Use `axiom:liquid-glass` skill
2. Review Regular vs Clear variant decision criteria
3. Apply `.glassEffect()` to navigation layer elements
4. Run the Expert Review Checklist (7 sections) to validate implementation
5. Test across light/dark modes and accessibility settings

### Optimizing SwiftUI Performance

When app feels sluggish or animations stutter:

1. Use `axiom:swiftui-performance` skill
2. Profile with Instruments 26 using SwiftUI template
3. Check Long View Body Updates lane for expensive operations
4. Use Cause & Effect Graph to identify unnecessary updates
5. Apply formatter caching or granular dependencies patterns

### Recording UI Tests

When writing UI tests for new features:

1. Use `axiom:ui-testing` skill
2. Record interactions with Recording UI Automation (Xcode 26)
3. Replay across devices, languages, and configurations
4. Review video recordings to debug failures
5. Apply condition-based waiting for reliable tests

### Debugging Xcode Build Failures

When you encounter BUILD FAILED or mysterious Xcode issues:

1. Use `axiom:xcode-debugging` skill
2. Run mandatory environment checks (Derived Data, processes, simulators)
3. Follow the decision tree for your specific error
4. Apply quick fixes before debugging code

### Fixing Swift Concurrency Errors

When you see actor isolation or Sendable errors:

1. Use `axiom:swift-concurrency` skill
2. Match your error to the decision tree
3. Copy the relevant pattern template (delegate capture, weak self, etc.)
4. Run the code review checklist

### Creating Safe Database Migrations

When adding database columns or changing schema:

1. Use `axiom:database-migration` skill
2. Follow safe patterns (additive, idempotent, transactional)
3. Write tests for both fresh install and migration paths
4. Test manually on device before shipping

## What's Next?

- [View all skills →](/skills/)
- [Contributing guide →](https://github.com/CharlesWiltgen/Axiom/blob/main/CONTRIBUTING.md)
