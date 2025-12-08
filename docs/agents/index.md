# Autonomous Agents

Axiom includes 11 autonomous agents that automatically detect and diagnose common iOS development issues.

## What Are Agents?

Agents are autonomous problem-solvers that:
- **Trigger automatically** based on keywords in your conversation
- **Run independently** with their own model and tools
- **Scan your codebase** for specific anti-patterns
- **Provide actionable fixes** with file:line references and code examples

## How to Use Agents

**Natural language (recommended)** — Just describe what you want:

- "Check my code for accessibility issues" → **accessibility-auditor** triggers
- "Scan for memory leaks" → **memory-audit-runner** triggers
- "My SwiftUI app has janky scrolling" → **swiftui-performance-analyzer** triggers
- "Review for Swift 6 concurrency violations" → **concurrency-validator** triggers
- "Check Core Data safety" → **core-data-auditor** triggers
- "Find Liquid Glass adoption opportunities" → **liquid-glass-auditor** triggers
- "Scan for deprecated networking APIs" → **networking-auditor** triggers
- "My build is failing" → **build-fixer** triggers
- "My builds are slow" → **build-optimizer** triggers
- "Check my navigation architecture" → **swiftui-nav-auditor** triggers
- "Take a screenshot to verify this fix" → **simulator-tester** triggers

**Explicit commands** — For direct invocation:

```bash
/axiom:audit-accessibility
/axiom:audit-memory
/axiom:audit-swiftui-performance
/axiom:audit-concurrency
/axiom:audit-core-data
/axiom:audit-liquid-glass
/axiom:audit-networking
/axiom:audit-swiftui-nav
/axiom:fix-build
/axiom:optimize-build
/axiom:test-simulator
```

## Agent Categories

### Build & Environment
- **build-fixer** — Automatically diagnoses and fixes Xcode build failures using environment-first diagnostics (zombie processes, Derived Data, simulator state, SPM cache)
- **build-optimizer** — Scans for build performance optimizations (compilation mode, architecture settings, build phase scripts, type checking bottlenecks) with measurable time savings

### Code Quality
- **accessibility-auditor** — Scans for VoiceOver label issues, Dynamic Type violations, color contrast failures, touch target sizes, WCAG compliance problems
- **concurrency-validator** — Detects Swift 6 strict concurrency violations (missing @MainActor, unsafe Task captures, Sendable violations, actor isolation problems)
- **memory-audit-runner** — Finds 6 common memory leak patterns (timers, observers, closures, delegates, view callbacks, PhotoKit accumulation)

### Persistence & Data
**core-data-auditor** — Scans for schema migration risks, thread-confinement violations, N+1 query patterns, production data loss risks, performance issues

### UI & Performance
- **liquid-glass-auditor** — Identifies iOS 26+ Liquid Glass adoption opportunities (glass effects, toolbar improvements, search patterns, migration from old blur effects)
- **swiftui-performance-analyzer** — Detects SwiftUI performance anti-patterns (expensive operations in view bodies, missing lazy loading, unnecessary updates, navigation performance issues)
- **swiftui-nav-auditor** — Scans SwiftUI navigation architecture (missing NavigationPath, deep link gaps, state restoration issues, wrong container usage, type safety problems)

### Networking
**networking-auditor** — Scans for deprecated networking APIs (SCNetworkReachability, CFSocket, NSStream) and anti-patterns (reachability checks, hardcoded IPs, missing error handling)

### Testing & Verification
**simulator-tester** — Automated simulator testing with visual verification (screenshots, video, location simulation, push notifications, permissions, deep links, log analysis) for closed-loop debugging

## Why Agents?

**Before** (Commands):
- User must remember `/axiom:audit-accessibility`
- Manual invocation every time
- Duplication between command and skill implementations

**After** (Agents):
- Natural language: "check accessibility"
- Automatic triggering based on context
- One source of truth, zero duplication
- Scales better (9 agents = 9 files + 9 commands = 18 total, not 18 duplicated implementations)

## Agent Architecture

All agents:
- Use **haiku model** for fast execution (<1 second scans)
- Provide **file:line references** for easy fixing
- Include **severity ratings** (CRITICAL/HIGH/MEDIUM/LOW)
- Show **before/after code examples**
- Recommend **testing strategies** to verify fixes

## Browse All Agents

Select an agent from the sidebar to see its full documentation, detection patterns, and fix recommendations.
