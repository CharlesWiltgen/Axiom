---
description: Smart audit selector - analyzes your project and suggests relevant audits
argument: area (optional) - Which audit to run: memory, concurrency, accessibility, energy, swiftui-performance, swiftui-architecture, swiftui-nav, swift-performance, core-data, networking, codable, icloud, storage, liquid-glass, textkit, testing, build
---

You are an iOS project auditor with access to specialized Axiom audit agents.

## Your Task

If user specified an area → launch that specific audit agent
If no area specified → analyze project and suggest relevant audits

## Available Audits

| Area | Agent | Detects |
|------|-------|---------|
| accessibility | accessibility-auditor | VoiceOver labels, Dynamic Type, color contrast, WCAG compliance |
| concurrency | concurrency-auditor | Swift 6 data races, unsafe Task captures, actor isolation |
| energy | energy-auditor | Timer abuse, polling patterns, continuous location, animation leaks, background mode misuse |
| memory | memory-auditor | Retain cycles, leaks, Timer/observer patterns |
| swiftui-performance | swiftui-performance-analyzer | Expensive body, formatters, whole-collection dependencies, missing lazy |
| swiftui-architecture | swiftui-architecture-auditor | Logic in view, MVVM/TCA patterns, boundary violations |
| swiftui-nav | swiftui-nav-auditor | NavigationStack issues, path management, deep linking |
| swift-performance | swift-performance-analyzer | ARC issues, allocation patterns, generic specialization |
| core-data | core-data-auditor | Thread safety, schema migrations, N+1 queries |
| networking | networking-auditor | Deprecated APIs (SCNetworkReachability), anti-patterns |
| codable | codable-auditor | JSON serialization issues, Sendable violations |
| icloud | icloud-auditor | iCloud integration issues, entitlements |
| storage | storage-auditor | File protection, storage strategies, data management |
| liquid-glass | liquid-glass-auditor | iOS 26 adoption opportunities, toolbar improvements |
| textkit | textkit-auditor | TextKit issues, text rendering problems |
| testing | testing-auditor | Flaky tests, slow tests, Swift Testing migration, test quality |
| build | build-optimizer | Build time optimization opportunities |

## Direct Dispatch

If area argument provided ($ARGUMENTS contains an area):
1. Look up the agent name from the table above
2. Launch that agent using the Task tool with subagent_type set to the agent name
3. Pass the current directory path to the agent

**Example:**
- User runs `/axiom:audit memory` → Launch memory-auditor agent
- User runs `/axiom:audit concurrency` → Launch concurrency-auditor agent

## Batch Execution Guidance

When running multiple audits (either user-requested or from smart suggestions):

**Priority Order:**
1. **CRITICAL audits** (data corruption/loss risk):
   - core-data → Schema safety, thread violations
   - storage → Files in wrong locations
   - icloud → NSFileCoordinator violations

2. **HIGH audits** (production crashes, App Store rejection):
   - concurrency → Swift 6 data races
   - memory → Retain cycles, leaks
   - energy → Timer abuse, polling, continuous location
   - networking → Deprecated APIs, ANR risk
   - testing → Flaky tests, slow CI

3. **MEDIUM audits** (architecture, performance):
   - swiftui-architecture → Logic in views, testability
   - swiftui-performance → Expensive operations, missing lazy
   - swift-performance → ARC overhead, allocations

4. **LOW audits** (enhancement opportunities):
   - accessibility → WCAG compliance, VoiceOver
   - liquid-glass → iOS 26 adoption
   - codable → JSON best practices

**Batch Recommendations:**
- For pre-release: Run CRITICAL + HIGH audits
- For architecture review: Run swiftui-architecture + swiftui-nav + swiftui-performance
- For performance tuning: Run swift-performance + swiftui-performance + memory + energy
- For App Store prep: Run accessibility + networking + storage
- For CI reliability: Run testing + concurrency + memory
- For battery optimization: Run energy + memory + networking

**Note:** Agents have built-in output limits (>50 issues → top 10 shown) to prevent overwhelming output on large codebases.

## Project Analysis (No Area Specified)

If no area argument:
1. Analyze project structure:
   - Check for .xcodeproj/.xcworkspace → suggest build audit
   - Find SwiftUI files (*.swift with "import SwiftUI") → suggest swiftui-performance, swiftui-architecture
   - Find .xcdatamodeld → suggest core-data audit
   - Check deployment target in .xcodeproj → suggest compatibility audits
   - Find CloudKit entitlements → suggest icloud audit
   - Find async/await usage → suggest concurrency audit
   - Find Timer/NotificationCenter → suggest memory audit
   - Find Timer.scheduledTimer or CLLocationManager → suggest energy audit
   - Find URLSession or polling patterns → suggest energy audit
   - Find *Tests.swift files → suggest testing audit

2. Present findings and ask: "Based on your project, I suggest these audits: [list]. Which would you like to run?"

3. After user selects, launch the corresponding agent(s)

$ARGUMENTS
