# Commands

Quick automated scans to identify issues in your codebase. Type `/command-name` in Claude Code to run.

## Available Commands

| Command | What It Checks | Output |
|---------|----------------|--------|
| [**`/axiom:audit-accessibility`**](./accessibility/audit-accessibility) | VoiceOver labels, Dynamic Type, color contrast, touch targets, WCAG compliance | Priority issues with fix recommendations |
| [**`/axiom:audit-concurrency`**](./concurrency/audit-concurrency) | Swift 6 strict mode violations, @MainActor issues, Sendable conformance, actor isolation | Concurrency errors with migration patterns |
| [**`/axiom:audit-core-data`**](./debugging/audit-core-data) | Schema migration safety, thread-confinement violations, N+1 queries, production risks | Risk score with immediate action items |
| [**`/axiom:audit-icloud`**](./storage/audit-icloud) | Missing NSFileCoordinator, CloudKit error handling, entitlement checks, SwiftData+CloudKit anti-patterns | Sync reliability issues with fix recommendations |
| [**`/axiom:audit-liquid-glass`**](./ui-design/audit-liquid-glass) | Liquid Glass adoption opportunities, glass effects, toolbar improvements, migration from UIBlurEffect | Adoption recommendations with code examples |
| [**`/axiom:audit-memory`**](./debugging/audit-memory) | Memory leak patterns: timers, observers, closures, delegates, PhotoKit | Leak candidates with Instruments guidance |
| [**`/axiom:audit-networking`**](./integration/audit-networking) | Deprecated networking APIs (SCNetworkReachability, CFSocket, NSStream), hardcoded IPs, missing error handling | File:line references with replacement patterns |
| [**`/axiom:audit-storage`**](./storage/audit-storage) | Files in wrong locations, missing backup exclusions, missing file protection, UserDefaults abuse | Data loss/backup bloat risks with fix recommendations |
| **`/axiom:audit-swiftui-nav`** | SwiftUI navigation architecture issues, missing NavigationPath, deep link gaps, state restoration | Architecture recommendations with migration patterns |
| **`/axiom:audit-swiftui-performance`** | SwiftUI performance anti-patterns, expensive view body operations, missing lazy loading, unnecessary updates | Performance fixes with before/after examples |
| **`/axiom:fix-build`** | Xcode build failures, environment issues, zombie processes, Derived Data, SPM cache, simulator state | Automatic diagnostics and fixes with verification |
| **`/axiom:optimize-build`** | Build performance bottlenecks, compilation settings, build phase scripts, type checking issues | Optimization recommendations with time savings estimates |
| [**`/axiom:screenshot`**](./testing/screenshot) | Quick screenshot capture from booted iOS Simulator | Screenshot file path + visual analysis |
| [**`/axiom:test-simulator`**](./testing/test-simulator) | Automated simulator testing with visual verification (screenshots, location, push, permissions, logs) | Test results with evidence (screenshots, logs) |

## Usage

```bash
# Run a command
/axiom:audit-accessibility
/axiom:audit-concurrency
/axiom:audit-core-data
/axiom:audit-icloud
/axiom:audit-liquid-glass
/axiom:audit-memory
/axiom:audit-networking
/axiom:audit-storage
/axiom:audit-swiftui-nav
/axiom:audit-swiftui-performance

# Build commands
/axiom:fix-build           # Diagnose and fix build failures
/axiom:optimize-build      # Optimize build performance

# Commands accept arguments
/axiom:audit-memory MyViewController.swift
/axiom:audit-networking NetworkManager.swift
/axiom:audit-storage DownloadManager.swift
/axiom:audit-icloud CloudKitManager.swift

# Testing commands
/axiom:screenshot           # Quick screenshot
/axiom:test-simulator       # Full simulator testing
```

Commands output results with `file:line` references and link to relevant skills for deeper analysis.

## Command Categories

### Auditing & Quality
- `/axiom:audit-accessibility` — Accessibility compliance
- `/axiom:audit-concurrency` — Swift 6 concurrency
- `/axiom:audit-core-data` — Core Data safety
- `/axiom:audit-icloud` — iCloud sync reliability
- `/axiom:audit-liquid-glass` — Liquid Glass adoption
- `/axiom:audit-memory` — Memory leak detection
- `/axiom:audit-networking` — Networking anti-patterns
- `/axiom:audit-storage` — File storage safety
- `/axiom:audit-swiftui-nav` — SwiftUI navigation architecture
- `/axiom:audit-swiftui-performance` — SwiftUI performance issues

### Build & Environment
- `/axiom:fix-build` — Automatic build failure diagnosis and fixes
- `/axiom:optimize-build` — Build performance optimization

### Testing & Verification
- `/axiom:screenshot` — Quick simulator screenshot
- `/axiom:test-simulator` — Full simulator testing capabilities
