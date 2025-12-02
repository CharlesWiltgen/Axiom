# Axiom Plugin

Comprehensive iOS development skills for Claude Code with the latest WWDC 2025 guidance — Liquid Glass, SwiftUI Performance, Recording UI Automation, systematic debugging, Swift concurrency, and safe persistence patterns.

**Version**: 0.8.12
**Status**: Preview Release
**Skills**: 21 | **Commands**: 6

## Installation

In Claude Code, run:

```bash
/plugin marketplace add CharlesWiltgen/Axiom
```

Then search for "axiom" in the `/plugin` menu and install.

## Skills

### 🆕 WWDC 2025 Skills

#### `axiom:liquid-glass`
Apple's new material design system (iOS 26+) with expert review checklist for validating implementations.

**Use when**: Implementing Liquid Glass effects, reviewing UI for adoption, debugging visual artifacts, requesting expert review

**Key features**:
- Expert Review Checklist (7 sections)
- Regular vs Clear variant decision criteria
- Layered system architecture
- Troubleshooting and migration patterns

**Requirements**: iOS 26+, Xcode 26+

---

#### `axiom:swiftui-performance`
Master the new SwiftUI Instrument in Instruments 26, eliminate long view body updates and unnecessary updates.

**Use when**: App feels sluggish, animations stutter, scrolling performance issues, SwiftUI bottlenecks

**Key features**:
- New SwiftUI Instrument walkthrough
- Cause & Effect Graph for data flow visualization
- Long view body updates diagnosis
- Unnecessary updates elimination
- Performance optimization checklist

**Requirements**: Xcode 26+, iOS 26+ SDK

---

#### `axiom:ui-testing`
Recording UI Automation (Xcode 26) with condition-based waiting patterns.

**Use when**: Writing UI tests, recording interactions, flaky tests, race conditions

**Key features**:
- Recording UI Automation (Record → Replay → Review)
- Condition-based waiting (eliminates sleep() timeouts)
- Accessibility-first testing
- Real-world impact: 15 min → 5 min test suite

**Requirements**: Xcode 26+ for Recording UI Automation

---

### 🔧 Debugging & Troubleshooting

#### `axiom:xcode-debugging`
Environment-first diagnostics for mysterious Xcode issues. Prevents 30+ minute rabbit holes.

**Use when**: BUILD FAILED, simulator hangs, zombie processes, "No such module" errors, mysterious test failures

**Key features**:
- Mandatory environment checks
- Quick fix workflows
- Decision tree for diagnosing problems
- Time cost transparency

**TDD Tested**: 6 refinements from pressure testing

---

#### `axiom:memory-debugging`
Systematic memory leak diagnosis with 5 patterns covering 90% of real-world issues.

**Use when**: App memory grows over time, multiple instances of same class, retain cycles

**Key features**:
- 5 comprehensive leak patterns
- Instruments workflow (Leaks + Allocations)
- Reduces debugging from 2-3 hours to 15-30 min

---

#### `axiom:build-troubleshooting`
Dependency resolution for CocoaPods and Swift Package Manager conflicts.

**Use when**: Dependency conflicts, "Multiple commands produce" errors, framework version mismatches

---

### ⚡ Swift & Concurrency

#### `axiom:swift-concurrency`
Swift 6 strict concurrency patterns - async/await, MainActor, Sendable, actor isolation.

**Use when**: Actor isolation errors, data race warnings, converting delegate callbacks to async-safe patterns

**Key features**:
- Copy-paste templates for common patterns
- Decision tree for concurrency errors
- Anti-patterns to avoid
- Code review checklist

**TDD Tested**: Critical checklist contradiction found and fixed

---

### 💾 Persistence

#### `axiom:database-migration`
Safe database schema evolution for SQLite/GRDB/SwiftData. Prevents data loss.

**Use when**: Adding/modifying database columns, "FOREIGN KEY constraint failed", "no such column" errors

**Key features**:
- Safe migration patterns (additive, idempotent, transactional)
- Testing checklist (fresh install + migration paths)
- Multi-layered prevention for 100k+ user apps

**TDD Tested**: Validated under pressure

---

#### `axiom:sqlitedata`
SQLiteData (Point-Free) patterns, batch performance, CloudKit sync.

**Use when**: Working with SQLiteData @Table models, @FetchAll/@FetchOne queries, batch imports

---

#### `axiom:grdb`
Raw GRDB for complex queries, ValueObservation, DatabaseMigrator patterns.

**Use when**: Writing raw SQL queries, complex joins, reactive queries, dropping down from SQLiteData

---

#### `axiom:swiftdata`
SwiftData with iOS 26+ features, @Model definitions, Swift 6 concurrency.

**Use when**: Working with SwiftData, @Query in SwiftUI, @Relationship macros, CloudKit integration

---

### 🌐 Networking

#### `axiom:networking`
Network.framework patterns for UDP/TCP with NWConnection (iOS 12-25) and NetworkConnection (iOS 26+) with structured concurrency.

**Use when**: Implementing network connections, migrating from sockets/URLSession streams, debugging connection failures

**Key features**:
- 8 patterns covering both iOS 12-25 and iOS 26+ APIs
- TLV framing and Coder protocol for iOS 26+
- Prevents deprecated API usage (SCNetworkReachability, CFSocket)
- Migration guides from BSD sockets

---

#### `axiom:networking-diag` (Diagnostic)
Systematic Network.framework troubleshooting for connection timeouts, TLS failures, data arrival issues.

**Use when**: Connection times out, TLS handshake fails, data not arriving, WiFi/cellular transitions

**Key features**:
- 8+ diagnostic patterns with symptom/diagnosis/fix
- Production crisis scenario defense
- Quick reference table for common errors
- Network logging interpretation guide

---

#### `axiom:network-framework-ref` (Reference)
Comprehensive Network.framework API reference covering all iOS 12-26+ networking APIs.

**Use when**: Planning network implementation, understanding API differences, migrating between versions

**Key features**:
- All 12 WWDC 2025 code examples
- Complete NWConnection and NetworkConnection coverage
- Migration strategies and testing checklist

---

### 📋 Audit Commands

#### `/axiom:audit-networking`
Scan codebase for deprecated networking APIs and anti-patterns with file:line references.

**Detects**: SCNetworkReachability, CFSocket, NSStream, hardcoded IPs, missing error handling

---

#### `/axiom:audit-concurrency`
Scan for Swift concurrency violations and unsafe patterns.

---

#### `/axiom:audit-accessibility`
Comprehensive accessibility audit for WCAG compliance.

---

#### `/axiom:audit-liquid-glass`
Scan for Liquid Glass adoption opportunities in SwiftUI codebase.

---

#### `/axiom:audit-core-data`
Quick Core Data safety audit for schema migrations, thread violations, N+1 queries.

---

#### `/axiom:audit-memory`
Scan for memory leak patterns across timer leaks, observer leaks, closure captures.

## Usage

Skills are automatically suggested by Claude Code based on context, or invoke them directly:

```bash
# WWDC 2025 skills
/skill axiom:liquid-glass
/skill axiom:swiftui-performance
/skill axiom:ui-testing

# Debugging
/skill axiom:xcode-debugging
/skill axiom:memory-debugging
/skill axiom:build-troubleshooting

# Swift & Concurrency
/skill axiom:swift-concurrency

# Persistence
/skill axiom:database-migration
/skill axiom:sqlitedata
/skill axiom:grdb
/skill axiom:swiftdata

# Networking
/skill axiom:networking
/skill axiom:networking-diag
/skill axiom:network-framework-ref

# Audit commands
/axiom:audit-networking
/axiom:audit-concurrency
/axiom:audit-accessibility
/axiom:audit-liquid-glass
/axiom:audit-core-data
/axiom:audit-memory
```

## Philosophy

Skills follow core principles:

1. **Examples first** — Working code before theory
2. **WWDC guidance** — Latest official Apple recommendations
3. **Expert review** — Built-in validation checklists
4. **Environment-first debugging** — Check build environment before code
5. **Safety by default** — Prevent data loss with tested patterns
6. **Compile-time safety** — Catch bugs at compile time with Swift 6
7. **Copy-paste ready** — Working templates, not just theory

## Quality Standards

- **TDD Tested**: Core debugging/concurrency skills tested with Superpowers framework
- **Reference Quality**: WWDC 2025 and persistence skills reviewed for accuracy, completeness, clarity, and practical value
- **Real-world Impact**: All skills include measurable improvements and troubleshooting workflows

## Documentation

Full documentation available at [https://yourusername.github.io/Axiom](https://yourusername.github.io/Axiom)

## Contributing

This is a preview release. Feedback welcome!

- **Issues**: [Report bugs or request features](https://github.com/yourusername/Axiom/issues)
- **Discussions**: [Share usage patterns and ask questions](https://github.com/yourusername/Axiom/discussions)

Skill contributions should follow these standards:
- YAML frontmatter with `name` and `description`
- Examples before theory throughout
- Clear "When to Use" section
- Decision trees for quick problem-solving
- Working code examples with ✅/❌ comparisons
- Troubleshooting sections
- Testing patterns where applicable

## Related Resources

- [WWDC 2025 Sessions](https://developer.apple.com/videos/wwdc2025)
- [Claude Code Documentation](https://docs.claude.ai/code)
- [Superpowers TDD Framework](https://github.com/superpowers-marketplace/superpowers)

## License

MIT - see [LICENSE](https://github.com/CharlesWiltgen/Axiom/blob/main/LICENSE) for details
