# Autonomous Agents

Axiom includes 38 autonomous agents that automatically detect and diagnose common iOS development issues.

## What Are Agents?

Agents are autonomous problem-solvers that:
- **Trigger automatically** based on keywords in your conversation
- **Run independently** with their own model and tools
- **Scan your codebase** for specific anti-patterns
- **Provide actionable fixes** with file:line references and code examples

## How to Use Agents

**Natural language (recommended)** — Just describe what you want:

- "Check my code for accessibility issues" → **accessibility-auditor** triggers
- "Scan for memory leaks" → **memory-auditor** triggers
- "My SwiftUI app has janky scrolling" → **swiftui-performance-analyzer** triggers
- "Review for Swift 6 concurrency violations" → **concurrency-auditor** triggers
- "Check Core Data safety" → **core-data-auditor** triggers
- "Find Liquid Glass adoption opportunities" → **liquid-glass-auditor** triggers
- "Scan for deprecated networking APIs" → **networking-auditor** triggers
- "Review my in-app purchase implementation" → **iap-auditor** triggers
- "Implement in-app purchases" → **iap-implementation** triggers
- "My build is failing" → **build-fixer** triggers
- "My builds are slow" → **build-optimizer** triggers
- "Run a health check on my project" → **health-check** triggers
- "Scan everything for issues" → **health-check** triggers
- "Check my navigation architecture" → **swiftui-nav-auditor** triggers
- "Validate my App Store screenshots" → **screenshot-validator** triggers
- "Take a screenshot to verify this fix" → **simulator-tester** triggers

**Explicit commands** — For direct invocation:

```bash
/axiom:audit-accessibility
/axiom:audit-memory
/axiom:audit-swiftui-performance
/axiom:audit-concurrency
/axiom:audit-core-data
/axiom:audit-iap
/axiom:audit-liquid-glass
/axiom:audit-networking
/axiom:audit-swiftui-nav
/axiom:audit-icloud
/axiom:audit-storage
/axiom:fix-build
/axiom:optimize-build
/axiom:audit screenshots
/axiom:test-simulator
/axiom:health-check
```

## Agent Categories

### Project-Wide
- **health-check** — Orchestrates multiple specialized auditors in parallel, deduplicates findings, and produces a unified project health report with executive summary

### Build & Environment
- **build-fixer** — Automatically diagnoses and fixes Xcode build failures using environment-first diagnostics (zombie processes, Derived Data, simulator state, SPM cache)
- **build-optimizer** — Scans for build performance optimizations (compilation mode, architecture settings, build phase scripts, type checking bottlenecks) with measurable time savings
- **spm-conflict-resolver** — Analyzes Package.swift and Package.resolved to diagnose and resolve Swift Package Manager dependency conflicts

### Code Quality
- **accessibility-auditor** — Scans for accessibility violations and architectural issues (inaccessible flows, gesture-only paths, inconsistent label coverage, WCAG compliance)
- **codable-auditor** — Detects Codable safety violations and semantic gaps (silent field drops, wrapper-hidden fallbacks, cross-file strategy drift, enum future-case crashes, CodingKeys mismatches) beyond the obvious anti-patterns
- **concurrency-auditor** — Detects Swift 6 concurrency violations and architectural issues (missing isolation, incoherent strategies, incomplete cancellation, permanent escape hatches)
- **energy-auditor** — Scans for energy anti-patterns and unnecessary background work (timers for inactive features, location when not on map, unused background modes, lifecycle asymmetries)
- **memory-auditor** — Finds memory leak patterns and architectural issues (missing cleanup paths, unbounded collection growth, inconsistent resource lifecycle management)
- **swift-performance-analyzer** — Detects Swift performance issues and context-dependent overhead (ARC in hot paths, copies in tight loops, actor hops in iteration, existential types in hot paths)
- **textkit-auditor** — Scans for TextKit issues and architectural gaps (TextKit 1 fallback triggers, deprecated glyph APIs that break on complex scripts, missing Writing Tools configuration, missing `isWritingToolsActive` guards on programmatic mutations, SwiftUI wrappers dropping TextKit 2 properties, RTL-untested custom layout fragments)

### UI & Design
- **liquid-glass-auditor** — Identifies iOS 26+ Liquid Glass adoption opportunities (glass effects, toolbar improvements, search patterns, migration from old blur effects)
- **swiftui-architecture-auditor** — Scans SwiftUI architecture and completeness (untestable logic in views, async boundary violations, inconsistent patterns, missing separation of concerns)
- **swiftui-layout-auditor** — Scans SwiftUI layout for anti-patterns and adaptivity gaps (GeometryReader misuse, missing multitasking support, identity loss, near-edge fixed sizing)
- **swiftui-performance-analyzer** — Detects SwiftUI performance issues and context-dependent problems (expensive operations amplified in scrolling cells, unnecessary rebuilds, missing lazy loading)
- **swiftui-nav-auditor** — Scans SwiftUI navigation architecture and completeness (orphan destinations, deep link gaps, state restoration, type collisions, modal/stack conflicts)
- **ux-flow-auditor** — Detects UX journey defects and incomplete flows (dead ends, dismiss traps, buried CTAs, missing states, unvalidated entry points, inaccessible paths)

### Persistence & Storage
- **core-data-auditor** — Scans Core Data for safety violations and architectural gaps (missing migration options, thread-confinement errors, N+1 queries, singleton context abuse, missing merge policies)
- **database-schema-auditor** — Scans database migration and schema code for safety violations and architectural gaps (unsafe ALTER TABLE, DROP operations, missing idempotency, FK constraints declared but not enforced, incomplete upgrade paths)
- **icloud-auditor** — Scans for iCloud integration issues and architectural gaps (missing NSFileCoordinator, incomplete CKError matrix coverage, missing account-change observation, polling instead of CKSubscriptions, SwiftData + CloudKit unsupported features, missing fallback UX when iCloud is unavailable)
- **storage-auditor** — Detects file storage mistakes and architectural gaps (files in wrong locations, missing backup exclusions, missing file protection, sensitive data in files instead of Keychain, missing App Group containers, unbounded cache growth, orphan files after entity deletion)
- **swiftdata-auditor** — Scans SwiftData code for safety violations and architectural gaps (struct models, missing schema registration, array relationships without defaults, background context misuse, N+1 patterns, stale predicates, CloudKit conformance gaps)

### Integration
- **camera-auditor** — Scans for camera/audio capture issues and architectural gaps (deprecated APIs, missing interruption handlers, main-thread session work, missing runtime-error recovery, concurrent session queues, stuck permission-denied UI, missing audio session deactivation, missing `RotationCoordinator` on iOS 17+, multi-cam without support guards)
- **foundation-models-auditor** — Scans Foundation Models code for missing availability checks, main thread blocking, manual JSON parsing, session lifecycle issues
- **networking-auditor** — Scans for deprecated networking APIs, anti-patterns, and completeness gaps (missing transition handling, TLS coverage, connection cleanup, framework selection)
- **iap-auditor** — Audits IAP code for missing transaction.finish(), weak verification, missing Transaction.updates listener, missing restore, partial subscription state coverage, missing intro eligibility checks, subscription terms and loot box odds disclosure gaps, and compound rejection-risk combinations; scores IAP health READY/NEEDS WORK/NOT READY
- **iap-implementation** — Implements complete StoreKit 2 IAP solution with testing-first workflow (.storekit configuration, centralized StoreManager, transaction handling, subscription management, restore purchases)

### Shipping
- **screenshot-validator** — AI-powered visual inspection of App Store screenshots for dimension validation, placeholder text detection, debug artifact scanning, competitor references, and content completeness
- **security-privacy-scanner** — Scans for hardcoded credentials, insecure token storage, Privacy Manifest coverage gaps (cross-referenced against Required Reason APIs actually used), ATS violations, missing ATT descriptions, missing usage descriptions, missing export compliance, weak Keychain ACLs, over-broad entitlements, and third-party SDK manifest gaps; scores security posture HARDENED/GAPS/VULNERABLE

### Testing
- **performance-profiler** — Automated performance profiling via xctrace CLI (CPU Profiler, Allocations, Leaks, SwiftUI, Swift Tasks)
- **simulator-tester** — Automated simulator testing with visual verification (screenshots, video, location simulation, push notifications, permissions, deep links, log analysis) for closed-loop debugging
- **test-debugger** — Closed-loop test debugging: analyzes failures, suggests fixes, re-runs tests until passing
- **test-failure-analyzer** — Diagnoses flaky tests, race conditions, and tests that pass locally but fail in CI
- **test-runner** — Runs XCUITests, parses .xcresult bundles, provides structured results with failure analysis
- **testing-auditor** — Finds flaky patterns, identifies untested critical paths, checks speed improvements, and evaluates Swift Testing migration readiness

### Games
- **spritekit-auditor** — Scans SpriteKit code for anti-patterns and architectural gaps (physics bitmask issues, draw call waste, action memory leaks, leaked scenes from missing transition cleanup, runaway node accumulation, missing time-step clamping, HUD on scene root instead of camera, missing async texture preload)

### Misc
- **crash-analyzer** — Parses crash reports (.ips, .crash), checks symbolication, categorizes by crash pattern, generates actionable diagnostics
- **modernization-helper** — Scans for legacy patterns and provides migration paths to iOS 17/18 (ObservableObject to @Observable, etc.)

## Why Agents?

**Before** (Commands):
- User must remember `/axiom:audit-accessibility`
- Manual invocation every time
- Duplication between command and skill implementations

**After** (Agents):
- Natural language: "check accessibility"
- Automatic triggering based on context
- One source of truth, zero duplication
- Scales better (agents = files + commands, not duplicated implementations)

## Agent Architecture

All agents:
- Use **sonnet model** for architectural reasoning and pattern detection
- Provide **file:line references** for easy fixing
- Include **severity ratings** (CRITICAL/HIGH/MEDIUM/LOW)
- Show **before/after code examples**
- Recommend **testing strategies** to verify fixes

## Browse All Agents

Select an agent from the sidebar to see its full documentation, detection patterns, and fix recommendations.
