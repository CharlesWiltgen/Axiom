# Getting Started

Welcome to Axiom — battle-tested Claude Code skills, commands, and references for modern xOS (iOS, iPadOS, tvOS, watchOS) development — Swift 6, SwiftUI, Liquid Glass, Apple Intelligence, and more.

## What is Axiom?

Axiom provides comprehensive iOS development workflows:

- **16 skills** — Discipline-enforcing workflows tested using ["red/green/refactor" methodology](https://en.wikipedia.org/wiki/Test-driven_development)
- **3 reference skills** — Comprehensive guides without mandatory workflows
- **3 diagnostic skills** — Systematic troubleshooting with pressure defense
- **6 commands** — Quick automated scans for common issues

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
- **Realm Migration** — Migrate from Realm to a supported data persistence system
- **Core Data Debugging** – Fix migration crashes and thread-confinement errors

### 🌐 Networking
- **Networking** – Network.framework patterns for UDP/TCP with NWConnection (iOS 12-25) and NetworkConnection (iOS 26+)
- **Networking Diagnostics** – Fix connection timeouts, TLS failures, data arrival issues
- **Network.framework Reference** – Complete API guide covering iOS 12-26+ with all WWDC examples

### 🔄 UIKit & Legacy
- **UIKit Animation Debugging** – Fix animations that don't fire or behave differently on device
- **Objective-C Block Retain Cycles** – Find and fix memory leaks from blocks

## Prerequisites

- **Claude Code** ([download here](https://claude.com/product/claude-code))
- **Xcode 26+** (for Liquid Glass, Recording UI Automation, and latest iOS features)
- **iOS 26 SDK** (comes with Xcode 26)

## Quick Start

### 1. Add the Marketplace

In Claude Code, run:

```
/plugin marketplace add CharlesWiltgen/Axiom
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
- **Data & Persistence**: database-migration, sqlitedata, grdb, swiftdata, realm-migration-ref, core-data-debugging
- **Networking**: networking, networking-diag, network-framework-ref
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

## Troubleshooting

### Plugin Not Showing in Claude Code

If Axiom doesn't appear after installation:

1. **Verify installation**: Run `/plugin` and check "Manage and install" list
2. **Reload Claude Code**: Restart the application
3. **Check marketplace**: Ensure you added the correct marketplace: `CharlesWiltgen/Axiom`

### Skills Not Being Suggested

If Claude Code isn't suggesting Axiom skills:

1. **Be specific**: Use keywords from skill descriptions (e.g., "BUILD FAILED", "actor isolation", "memory leak")
2. **Manual invocation**: Type `/skill axiom:` to see available skills
3. **Check context**: Skills are suggested based on your question and code context

### Skills Not Found

If you get "skill not found" errors:

1. **Use correct syntax**: `/skill axiom:skill-name` (not `/axiom:skill-name`)
2. **Check spelling**: Skill names use dashes (e.g., `swift-concurrency`, not `swift_concurrency`)
3. **List available skills**: Use `/plugin` to see which skills are installed

### Commands Not Working

If `/audit-*` commands don't execute:

1. **Verify command syntax**: Commands start with `/audit-` or `/axiom:`
2. **Check file access**: Ensure Claude Code has access to your project files
3. **Run manually**: Try using the command via `/command` menu

### Getting Help

- **Issues**: [Report bugs on GitHub](https://github.com/CharlesWiltgen/Axiom/issues)
- **Discussions**: [Ask questions and share patterns](https://github.com/CharlesWiltgen/Axiom/discussions)
- **Claude Code docs**: [Official documentation](https://docs.claude.ai/code)

## What's Next?

- [View all skills →](/skills/)
- [Contributing guide →](https://github.com/CharlesWiltgen/Axiom/blob/main/CONTRIBUTING.md)
