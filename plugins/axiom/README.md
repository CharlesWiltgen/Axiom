# Axiom Plugin

Comprehensive iOS development skills for Claude Code with the latest WWDC 2025 guidance — Apple Intelligence (Foundation Models), Liquid Glass, SwiftUI Performance, Recording UI Automation, systematic debugging, Swift concurrency, and safe persistence patterns.

**Version**: 0.9.27
**Status**: Preview Release
**Skills**: 38 | **Commands**: 12 | **Agents**: 11 | **Hooks**: 4

## Installation

In Claude Code, run:

```bash
/plugin marketplace add CharlesWiltgen/Axiom
```

Then search for "axiom" in the `/plugin` menu and install.

## Hooks

Axiom includes **4 automatic hooks** that trigger on specific events to enhance your workflow:

### 1. Build Failure Auto-Trigger
**Event**: After Bash command execution
**Trigger**: When `xcodebuild` fails with non-zero exit
**Action**: Suggests running `/axiom:fix-build` for automatic diagnostics

### 2. Session Environment Check
**Event**: Session start
**Action**: Checks for common environment issues:
- Zombie xcodebuild processes (warns if >5)
- Large Derived Data (warns if >10GB)

**Output**: Silent if no issues detected

### 3. Core Data Model Protection
**Event**: Before Edit/Write operations
**Trigger**: Editing `.xcdatamodeld` files
**Action**: Warns about migration planning risks, suggests running `/axiom:audit-core-data`

### 4. Swift Auto-Format
**Event**: After Write/Edit operations
**Trigger**: Swift files modified
**Action**: Runs `swiftformat` to ensure consistent code style
**Requirement**: [swiftformat](https://github.com/nicklockwood/SwiftFormat) must be installed (`brew install swiftformat`)

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

#### `axiom:build-performance`
Comprehensive build performance optimization with Build Timeline analysis, type checking improvements, and parallelization workflows.

**Use when**: Build times are slow, investigating build performance, analyzing Build Timeline, identifying type checking bottlenecks, optimizing incremental builds

**Key features**:
- Build Timeline analysis and critical path optimization
- Type checking performance improvements
- Build phase script optimization
- Compilation mode settings (incremental vs whole module)
- Build parallelization patterns
- Measurement and verification workflows

**Based on**: WWDC 2018-408, WWDC 2022-110364

**Quick win**: Use `/axiom:optimize-build` to scan for common issues automatically

**Expected impact**: 30-50% faster incremental debug builds, 5-10 seconds saved per build from conditional scripts

---

#### `axiom:deep-link-debugging`
Add debug-only deep links for automated testing and closed-loop debugging with visual verification.

**Use when**: Need to navigate to specific screens for testing, integrating with simulator automation, enabling visual debugging workflows

**Key features**:
- Debug-only URL scheme patterns for SwiftUI
- NavigationPath integration for iOS 16+
- Stripped from release builds automatically
- Enables closed-loop debugging (60-75% faster iteration)

**Requirements**: iOS 13+

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

### 🤖 Apple Intelligence

#### `axiom:foundation-models`
On-device AI with Apple's Foundation Models framework (iOS 26+) — @Generable structured output, streaming, tool calling.

**Use when**: Implementing on-device AI features, text summarization, classification, extraction, creating structured output from LLM

**Key features**:
- 6 comprehensive patterns covering all key APIs
- Anti-patterns preventing context overflow, blocking UI, manual JSON parsing
- Tool calling for external data integration
- Streaming with PartiallyGenerated for better UX
- 3 pressure scenarios defending against wrong approaches

**Requirements**: iOS 26+, macOS 26+, iPadOS 26+, visionOS 26+

---

#### `axiom:foundation-models-diag` (Diagnostic)
Systematic Foundation Models troubleshooting for context exceeded, guardrail violations, slow generation, availability issues.

**Use when**: Generation fails, output wrong/hallucinated, too slow, UI frozen, context window exceeded

**Key features**:
- 12 diagnostic patterns with symptom/diagnosis/fix
- Production crisis scenario defense
- Decision tree covering 5 failure categories
- Quick reference table for common errors

---

#### `axiom:foundation-models-ref` (Reference)
Complete Foundation Models framework API reference with all WWDC 2025 code examples (26 total).

**Use when**: Planning AI implementation, understanding API patterns, need complete code examples

**Key features**:
- All WWDC 2025 code examples (sessions 286, 259, 301)
- Complete LanguageModelSession, @Generable, Tool protocol coverage
- Dynamic schemas and generation options
- Performance profiling with Instruments

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

---

### 🎯 Simulator Testing

#### `simulator-tester` Agent

Automated simulator testing with visual verification for closed-loop debugging.

**Natural language triggers**:
- "Can you test my app with location simulation?"
- "Take a screenshot to verify the fix"
- "Check if the push notification handling works"
- "Navigate to Settings and take a screenshot"

**Explicit command**: `/axiom:test-simulator`

**Capabilities**:
- Screenshot capture for visual verification
- Video recording for complex workflows
- Location simulation for GPS-based features
- Push notification testing without a server
- Permission management without manual tapping
- Deep link navigation to specific screens
- Status bar override for clean screenshots
- Log analysis for crash detection

**Use when**: Visual debugging, automated testing, test scenario setup, verifying fixes with screenshots

---

#### `/axiom:screenshot`

Quick screenshot capture from booted iOS Simulator.

**What it does**: Captures screenshot, displays it (Claude is multimodal!), returns file path

**Usage**: Simply run `/axiom:screenshot` and Claude will capture and analyze the current simulator state

**Use when**: Quick visual verification, checking UI state, documenting bugs, verifying layout fixes

---

## Usage

Skills are automatically suggested by Claude Code based on context, or invoke them directly:

```bash
# WWDC 2025 skills
/skill axiom:liquid-glass
/skill axiom:swiftui-performance
/skill axiom:ui-testing

# SwiftUI
/skill axiom:swiftui-gestures
/skill axiom:swiftui-debugging
/skill axiom:swiftui-layout
/skill axiom:swiftui-nav

# Debugging
/skill axiom:xcode-debugging
/skill axiom:memory-debugging
/skill axiom:build-troubleshooting
/skill axiom:build-performance
/skill axiom:deep-link-debugging

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

# Apple Intelligence
/skill axiom:foundation-models
/skill axiom:foundation-models-diag
/skill axiom:foundation-models-ref

# Audit commands
/axiom:audit-networking
/axiom:audit-concurrency
/axiom:audit-accessibility
/axiom:audit-liquid-glass
/axiom:audit-core-data
/axiom:audit-memory

# Simulator Testing
/axiom:screenshot               # Quick screenshot capture
/axiom:test-simulator           # Full simulator testing with scenarios

# Build & Performance
/axiom:optimize-build
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
