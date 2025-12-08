# Commands

Quick automated scans to identify issues in your codebase. Type `/command-name` in Claude Code to run.

## Available Commands

| Command | What It Checks | Output |
|---------|----------------|--------|
| [**`/audit-accessibility`**](./accessibility/audit-accessibility) | VoiceOver labels, Dynamic Type, color contrast, touch targets, WCAG compliance | Priority issues with fix recommendations |
| [**`/audit-concurrency`**](./concurrency/audit-concurrency) | Swift 6 strict mode violations, @MainActor issues, Sendable conformance, actor isolation | Concurrency errors with migration patterns |
| [**`/audit-core-data`**](./debugging/audit-core-data) | Schema migration safety, thread-confinement violations, N+1 queries, production risks | Risk score with immediate action items |
| [**`/audit-liquid-glass`**](./ui-design/audit-liquid-glass) | Liquid Glass adoption opportunities, glass effects, toolbar improvements, migration from UIBlurEffect | Adoption recommendations with code examples |
| [**`/audit-memory`**](./debugging/audit-memory) | Memory leak patterns: timers, observers, closures, delegates, PhotoKit | Leak candidates with Instruments guidance |
| [**`/audit-networking`**](./integration/audit-networking) | Deprecated networking APIs (SCNetworkReachability, CFSocket, NSStream), hardcoded IPs, missing error handling | File:line references with replacement patterns |
| [**`/axiom:screenshot`**](./testing/screenshot) | Quick screenshot capture from booted iOS Simulator | Screenshot file path + visual analysis |
| [**`/axiom:test-simulator`**](./testing/test-simulator) | Automated simulator testing with visual verification (screenshots, location, push, permissions, logs) | Test results with evidence (screenshots, logs) |

## Usage

```bash
# Run a command
/audit-accessibility
/audit-concurrency
/audit-core-data
/audit-liquid-glass
/audit-memory
/audit-networking

# Commands accept arguments
/audit-memory MyViewController.swift
/audit-networking NetworkManager.swift

# Testing commands
/axiom:screenshot           # Quick screenshot
/axiom:test-simulator       # Full simulator testing
```

Commands output results with `file:line` references and link to relevant skills for deeper analysis.

## Command Categories

### Auditing & Quality
- `/audit-accessibility` — Accessibility compliance
- `/audit-concurrency` — Swift 6 concurrency
- `/audit-core-data` — Core Data safety
- `/audit-liquid-glass` — Liquid Glass adoption
- `/audit-memory` — Memory leak detection
- `/audit-networking` — Networking anti-patterns

### Testing & Verification
- `/axiom:screenshot` — Quick simulator screenshot
- `/axiom:test-simulator` — Full simulator testing capabilities
