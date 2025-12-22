# Commands

Quick automated scans to identify issues in your codebase. Type `/command-name` in Claude Code to run.

## Start Here

**Not sure which command to use?** Start with `/axiom:ask`:

```bash
/axiom:ask "My build is failing"
/axiom:ask "How do I optimize SwiftUI performance?"
/axiom:ask "Check my code for memory leaks"
```

This routes your question to the right Axiom skill or agent automatically.

---

## Available Commands

| Command | What It Checks | Output |
|---------|----------------|--------|
| [**`/axiom:ask`**](./utility/ask) | Natural language entry point to all Axiom skills | Triggers the right skill or agent |
| [**`/axiom:audit`**](./utility/audit) | Unified audit command - smart selector or direct area targeting | Suggestions or specific audit execution |
| [**`/axiom:fix-build`**](./build/fix-build) | Xcode build failures, environment issues, zombie processes, Derived Data, SPM cache, simulator state | Automatic diagnostics and fixes with verification |
| [**`/axiom:optimize-build`**](./build/optimize-build) | Build performance bottlenecks, compilation settings, build phase scripts, type checking issues | Optimization recommendations with time savings estimates |
| [**`/axiom:screenshot`**](./testing/screenshot) | Quick screenshot capture from booted iOS Simulator | Screenshot file path + visual analysis |
| [**`/axiom:status`**](./utility/status) | Environment health, zombie processes, Derived Data size, simulator status, project stats | Dashboard with quick health metrics |
| [**`/axiom:test-simulator`**](./testing/test-simulator) | Automated simulator testing with visual verification (screenshots, location, push, permissions, logs) | Test results with evidence (screenshots, logs) |

## Usage

```bash
# Utility commands
/axiom:ask "My build is failing"
/axiom:audit                    # Smart mode - analyze and suggest audits
/axiom:status                   # Check health

# Audit commands (unified syntax)
/axiom:audit accessibility      # VoiceOver, Dynamic Type, WCAG
/axiom:audit concurrency        # Swift 6 data races, actor isolation
/axiom:audit memory             # Retain cycles, leaks
/axiom:audit swiftui-performance # Expensive body, missing lazy
/axiom:audit swiftui-architecture # Logic in view, testability
/axiom:audit swiftui-nav        # Navigation architecture
/axiom:audit swift-performance  # ARC issues, allocation
/axiom:audit core-data          # Thread safety, migrations
/axiom:audit networking         # Deprecated APIs
/axiom:audit codable            # JSON serialization
/axiom:audit icloud             # iCloud sync reliability
/axiom:audit storage            # File storage safety
/axiom:audit liquid-glass       # iOS 26 adoption
/axiom:audit textkit            # TextKit modernization

# Build commands
/axiom:fix-build                # Diagnose and fix build failures
/axiom:optimize-build           # Optimize build performance

# Testing commands
/axiom:screenshot               # Quick screenshot
/axiom:test-simulator           # Full simulator testing
```

Commands output results with `file:line` references and link to relevant skills for deeper analysis.

## Command Categories

### Utility
- `/axiom:ask` — Natural language helper
- `/axiom:audit` — Unified audit command (smart selector or direct area targeting)
- `/axiom:status` — Project health dashboard

### Build & Environment
- `/axiom:fix-build` — Automatic build failure diagnosis and fixes
- `/axiom:optimize-build` — Build performance optimization

### Testing
- `/axiom:screenshot` — Quick simulator screenshot
- `/axiom:test-simulator` — Full simulator testing capabilities

## Audit Areas

The `/axiom:audit` command supports these areas:

### UI & Design
- `accessibility` — VoiceOver, Dynamic Type, WCAG compliance
- `liquid-glass` — Liquid Glass adoption opportunities
- `swiftui-architecture` — SwiftUI architecture and testability
- `swiftui-nav` — Navigation architecture
- `swiftui-performance` — Performance anti-patterns
- `textkit` — TextKit 1 vs 2 modernization

### Code Quality
- `codable` — JSON serialization anti-patterns
- `concurrency` — Swift 6 strict concurrency
- `memory` — Memory leak detection
- `swift-performance` — ARC and allocation issues

### Persistence & Storage
- `core-data` — Core Data safety and migrations
- `icloud` — iCloud sync reliability
- `storage` — File storage safety

### Integration
- `networking` — Deprecated networking APIs
