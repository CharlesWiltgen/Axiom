---
name: axiom-performance
description: Use when app feels slow, memory grows, battery drains, or diagnosing ANY performance issue. Covers memory leaks, profiling, Instruments workflows, retain cycles, performance optimization.
license: MIT
---

# Performance

**You MUST use this skill for ANY performance issue including memory leaks, slow execution, battery drain, or profiling.**

## When to Use

Use this router when:
- App feels slow or laggy
- Memory usage grows over time
- Battery drains quickly
- Device gets hot during use
- High energy usage in Battery Settings
- Diagnosing performance with Instruments
- Memory leaks or retain cycles
- App crashes with memory warnings

## Routing Logic

### Memory Issues

**Memory leaks (Swift)** → See skills/memory-debugging.md
- Systematic leak diagnosis
- 5 common leak patterns
- Instruments workflows
- deinit not called

**Memory leak scan** → Launch `memory-auditor` agent or `/axiom:audit memory` (5-phase semantic audit: maps resource ownership, detects 6 leak patterns, reasons about missing cleanup, correlates compound risks, scores lifecycle health)

**Memory leaks (Objective-C blocks)** → See skills/objc-block-retain-cycles.md
- Block retain cycles
- Weak-strong pattern
- Network callback leaks

### Performance Profiling

**Performance profiling (GUI)** → See skills/performance-profiling.md
- Time Profiler (CPU), incl. Top Functions mode for scattered overhead (`OS27`)
- Allocations (memory growth)
- Core Data profiling (N+1 queries)
- Decision trees for tool selection
- Instruments 27 Run Comparisons, Swift executors instrument, Foundation Models instrument; Xcode 27 Organizer (Storage/hitches metrics, Metric Goals, Generate Recommendations)

**Automated profiling (CLI)** → See skills/xctrace-ref.md
- Headless xctrace profiling
- CI/CD integration patterns
- Command-line trace recording
- Programmatic trace analysis

**Run automated profile** → Use `performance-profiler` agent or `/axiom:profile`
- Records trace via xctrace
- Exports and analyzes data
- Reports findings with severity

**Compare two traces / detect regressions** → See skills/trace-comparison.md or `/axiom:compare-traces`
- Did this change slow down a hot path? Function-level CPU-share deltas
- CI gating with `xcprof compare --fail-on-regression` (non-zero exit)
- Regressions vs improvements, severity ranking, exit-code semantics

### Hang/Freeze Issues

**App hangs or freezes** → See skills/hang-diagnostics.md
- UI unresponsive for >1 second
- Main thread blocked (busy or waiting)
- Decision tree: busy vs blocked diagnosis
- Time Profiler vs System Trace selection
- 8 common hang patterns with fixes
- Watchdog terminations

**Corpus/aggregate hang triage (Sentry, ASC)** → `axiom-shipping (skills/production-triage.md)` + `triage-analyzer` agent
- Multiple grouped hang reports from an aggregator, not a single .ips file
- Classify `anr_idle_runloop` vs `anr_main_thread_block` across the corpus
- Flag suspension/idle-runloop false-positives (the #1 hang by user count is often noise)
- Cluster into root-cause families and rank by impact

### App Launch

**Slow app launch** → See skills/app-launch.md
- Slow first frame, frozen first screen, launch regression in Organizer
- Launch-phase model (pre-main / main→first frame / extended launch)
- Cold vs warm vs hot/resume vs notification launch — how to reproduce each
- App Launch instrument workflow, `dyld Activity`, measurement hygiene
- Pre-main fixes (frameworks, `+load`, mergeable libraries), main-thread deferral, priority inversion
- `XCTApplicationLaunchMetric` regression test, `MXAppLaunchMetric` field histograms, custom "app is interactive" signpost
- Push-notification launch path (tap→first pixel / tap→interactive targets)

### Energy Issues

**Battery drain, high energy** → See skills/energy.md
- Power Profiler workflow
- Subsystem diagnosis (CPU/GPU/Network/Location/Display)
- Anti-pattern fixes
- Background execution optimization

**Symptom-based diagnosis** → See skills/energy-diag.md
- "App at top of Battery Settings"
- "Device gets hot"
- "Background battery drain"
- Time-cost analysis for each path

**API reference with code** → See skills/energy-ref.md
- Complete WWDC code examples
- Timer, network, location efficiency
- BGContinuedProcessingTask (iOS 26)
- MetricKit setup

**Energy scan** → Launch `energy-auditor` agent or `/axiom:audit energy` (8 anti-patterns: timer abuse, polling, continuous location, animation leaks, background mode misuse, network inefficiency, GPU waste, disk I/O)

### Timer Safety

**Timer crash patterns (DispatchSourceTimer)** → See `axiom-integration` (skills/timer-patterns.md)
- 4 crash scenarios causing EXC_BAD_INSTRUCTION
- RunLoop mode gotcha (Timer stops during scroll)
- SafeDispatchTimer wrapper
- Timer vs DispatchSourceTimer decision

**Timer API reference** → See `axiom-integration` (skills/timer-patterns-ref.md)
- Timer, DispatchSourceTimer, Combine, AsyncTimerSequence APIs
- Lifecycle diagrams
- Platform availability

### Swift Performance

**Swift performance optimization** → See skills/swift-performance.md
- Value vs reference types, copy-on-write
- ARC overhead, generic specialization
- Collection performance

**Swift performance scan** → Launch `swift-performance-analyzer` agent or `/axiom:audit swift-performance` (unnecessary copies, ARC overhead, unspecialized generics, collection inefficiencies, actor isolation costs, memory layout)

**Modern Swift idioms** → See axiom-swift (skills/swift-modern.md)
- Outdated API patterns (Date(), CGFloat, DateFormatter)
- Foundation modernization (URL.documentsDirectory, FormatStyle)
- Claude-specific hallucination corrections

### MetricKit Integration

**MetricKit API reference** → See skills/metrickit-ref.md
- New Swift-first API (`OS27`): MetricManager AsyncSequence streams, typed MetricResult metrics (incl. Metal frame rate, storage), typed diagnostics with termination categories, launch-task tracking
- Per-state metrics (StateReporting framework, `OS27`): split hitch/hang/memory metrics by tab, mode, or experiment
- Crash reporter extensions (CrashReportExtension framework, `OS27`): process crashes at crash time with in-extension symbolication (Part 10)
- MXMetricPayload / MXDiagnosticPayload parsing (legacy, iOS 13–26)
- Field performance data collection
- Integration with crash reporting

### Runtime Console Capture

**Capture simulator console output** → `/axiom:console`
- Capture print(), os_log(), Logger output from simulator
- Structured JSON with level, subsystem, category
- Bounded collection with `--timeout` and `--max-lines`
- Filter by subsystem or regex

### Runtime State Inspection

**LLDB interactive debugging** → See axiom-build (skills/lldb.md)
- Set breakpoints, inspect variables at runtime
- Crash reproduction from crash logs
- Thread state analysis for hangs
- Swift value inspection (po vs v)

**LLDB command reference** → See axiom-build (skills/lldb-ref.md)
- Complete command syntax
- Breakpoint recipes
- Expression evaluation patterns

## Decision Tree

1. Memory climbing + UI stutter/jank? → memory-debugging FIRST (memory pressure causes GC pauses that drop frames), then performance-profiling if memory is fixed but stutter remains
2. Memory leak (Swift)? → memory-debugging
3. Memory leak (Objective-C blocks)? → objc-block-retain-cycles
4. App hang/freeze — is UI completely unresponsive (can't tap, no feedback)?
   - YES → hang-diagnostics (busy vs blocked diagnosis)
   - NO, just slow → performance-profiling (Time Profiler)
   - First launch only? → Also check for synchronous I/O or lazy initialization in hang-diagnostics
   - Multiple grouped hang reports from Sentry/ASC (corpus, not single file)? → `axiom-shipping (skills/production-triage.md)` + `triage-analyzer`
5. Slowdown when multiple async operations complete at once? → Cross-route to `axiom-concurrency` (callback contention, not profiling)
6. Slow app launch / slow first frame / launch regression / slow after push tap? → app-launch
7. Battery drain (know the symptom)? → energy-diag
8. Battery drain (need API reference)? → energy-ref
9. Battery drain (general)? → energy
10. MetricKit setup/parsing? → metrickit-ref
10a. Metrics split by app state (per-tab hitch rate, experiment arms) or StateReporting? → metrickit-ref (Part 1)
10b. Profiling agentic/LLM features (Foundation Models instrument, token metrics)? → performance-profiling, then axiom-ai
10c. Building a crash reporter extension (process crashes at crash time)? → metrickit-ref (Part 10)
11. Profile with GUI (Instruments)? → performance-profiling
12. Profile with CLI (xctrace)? → xctrace-ref
13. Run automated profile now? → performance-profiler agent
14. General slow/lag? → performance-profiling
14a. Slow GRDB/SQLite queries (EXPLAIN QUERY PLAN, index design, cursors)? → See axiom-data (skills/grdb-performance.md)
15. Want proactive memory leak scan? → memory-auditor (Agent)
16. Want energy anti-pattern scan? → energy-auditor (Agent)
17. Want Swift performance audit (ARC, generics, collections)? → swift-performance-analyzer (Agent)
18. Need to inspect variable/thread state at runtime? → See axiom-build (skills/lldb.md)
19. Need exact LLDB command syntax? → See axiom-build (skills/lldb-ref.md)
20. Timer stops during scrolling? → timer-patterns (RunLoop mode)
21. EXC_BAD_INSTRUCTION crash with DispatchSourceTimer? → timer-patterns (4 crash patterns)
22. Choosing between Timer, DispatchSourceTimer, Combine timer, async timer? → timer-patterns
23. Need timer API syntax/lifecycle? → timer-patterns-ref
24. Code review for outdated Swift patterns? → swift-modern
25. Claude generating legacy APIs (DateFormatter, CGFloat, DispatchQueue)? → swift-modern
26. Need to see runtime console output before profiling? → axiom-tools (skills/xclog-ref.md) or `/axiom:console`
27. Have an `.ips`, MetricKit, or legacy `.crash` text file to symbolicate/triage? → axiom-tools (skills/xcsym-ref.md) or `/axiom:analyze-crash`

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I know it's a memory leak, let me find it" | Memory leaks have 6 patterns. memory-debugging diagnoses the right one in 15 min vs 2 hours. |
| "I'll just run Time Profiler" | Wrong Instruments template wastes time. performance-profiling selects the right tool first. |
| "Battery drain is probably the network layer" | Energy issues span 8 subsystems. energy skill diagnoses the actual cause. |
| "App feels slow, I'll optimize later" | Performance issues compound. Profiling now saves exponentially more time later. |
| "It's just a UI freeze, probably a slow API call" | Freezes have busy vs blocked causes. hang-diagnostics has a decision tree for both. |
| "Memory is climbing AND scrolling stutters — two separate bugs" | Memory pressure causes GC pauses that drop frames. Fix the leak first, then re-check scroll performance. |
| "It only freezes on first launch, must be loading something" | First-launch hangs have 3 patterns: synchronous I/O, lazy initialization, main thread contention. hang-diagnostics diagnoses which. |
| "Launch feels slow — I'll trim some startup code" | Launch has 3 phases (pre-main / main→first frame / extended) and a watchdog. app-launch tells you which phase to profile, with measurement hygiene so the number means something. |
| "Launch is fine, it's fast on my phone" | Measure on your oldest supported device with a Release build. app-launch has the full hygiene checklist — newest-device numbers hide the regression. |
| "Resume from the app switcher is slow too" | Resume isn't a launch — never measure it as one. app-launch distinguishes cold/warm/hot/notification and how to reproduce each. |
| "UI locks up when network requests finish — that's slow" | Multiple callbacks completing at once = main thread contention = concurrency issue. Cross-route to axiom-concurrency. |
| "I'll just add print statements to debug this" | Print-debug cycles cost 3-5 min each (build + run + reproduce). An LLDB breakpoint costs 30 seconds. axiom-build (skills/lldb.md) has the commands. |
| "I can't see what the app is logging" | xclog captures print() + os_log from the simulator with structured JSON. `/axiom:console`. |
| "I'll hand-parse this .ips JSON to see the top frame" | xcsym parses, discovers dSYMs, symbolicates, and categorizes in one call — structured JSON with pattern_tag. `/axiom:analyze-crash`. |
| "I'll just use Timer.scheduledTimer, it's simpler" | Timer stops during scrolling (`.default` mode), retains its target (leak). timer-patterns has the decision tree. |
| "DispatchSourceTimer crashed but it's intermittent, let's ship" | DispatchSourceTimer has 4 crash patterns that are ALL deterministic. timer-patterns diagnoses which one. |
| "Claude already knows modern Swift" | Claude defaults to pre-5.5 patterns (Date(), CGFloat, filter().count). swift-modern has the correction table. |
| "MetricKit is that old MX delegate API" | The 27 cycle rebuilt it: MetricManager AsyncSequence streams, typed metrics, per-state aggregation. metrickit-ref Part 1 has the new surface. |
| "My field metrics are one blended average, can't tell which screen is slow" | StateReporting splits every metric by app state you define (per-tab, per-experiment). metrickit-ref Part 1. |
| "No single function is hot, so the profile is useless" | Scattered overhead (dynamic dispatch, retain/release, existentials) hides in flame graphs. Top Functions mode merges it. performance-profiling. |

## Critical Patterns

**Memory Debugging** (memory-debugging):
- 6 leak patterns: timers, observers, closures, delegates, view callbacks, PhotoKit
- Instruments workflows
- Leak vs caching distinction

**Performance Profiling** (performance-profiling):
- Time Profiler for CPU bottlenecks
- Allocations for memory growth
- Core Data SQL logging for N+1 queries
- Self Time vs Total Time

**Energy Optimization** (energy):
- Power Profiler subsystem diagnosis
- 8 anti-patterns: timers, polling, location, animations, background, network, GPU, disk
- Audit checklists by subsystem
- Pressure scenarios for deadline resistance

## Example Invocations

User: "My app's memory usage keeps growing"
→ See skills/memory-debugging.md

User: "I have a memory leak but deinit isn't being called"
→ See skills/memory-debugging.md

User: "My app feels slow, where do I start?"
→ See skills/performance-profiling.md

User: "My Objective-C block callback is leaking"
→ See skills/objc-block-retain-cycles.md

User: "My app drains battery quickly"
→ See skills/energy.md

User: "Users say the device gets hot when using my app"
→ See skills/energy-diag.md

User: "What's the best way to implement location tracking efficiently?"
→ See skills/energy-ref.md

User: "Profile my app's CPU usage"
→ Use: `performance-profiler` agent (or `/axiom:profile`)

User: "How do I run xctrace from the command line?"
→ See skills/xctrace-ref.md

User: "I need headless profiling for CI/CD"
→ See skills/xctrace-ref.md

User: "My app hangs sometimes"
→ See skills/hang-diagnostics.md

User: "The UI freezes and becomes unresponsive"
→ See skills/hang-diagnostics.md

User: "Main thread is blocked, how do I diagnose?"
→ See skills/hang-diagnostics.md

User: "Triage my Sentry hangs" / "Which ANR reports are real blocks?"
→ See `axiom-shipping (skills/production-triage.md)` + `triage-analyzer` agent (or `/axiom:triage sentry`)

User: "My app takes 3 seconds to launch"
→ See skills/app-launch.md

User: "Xcode Organizer says my launch time regressed"
→ See skills/app-launch.md

User: "How do I reduce pre-main / dyld time?"
→ See skills/app-launch.md

User: "App is slow to come up after tapping a push notification"
→ See skills/app-launch.md

User: "How do I write a launch performance test?"
→ See skills/app-launch.md

User: "How do I set up MetricKit?"
→ See skills/metrickit-ref.md

User: "How do I parse MXMetricPayload?"
→ See skills/metrickit-ref.md

User: "How do I use the new MetricManager / migrate off MXMetricManager?"
→ See skills/metrickit-ref.md (Part 1)

User: "Can I get hitch metrics per tab or per experiment?"
→ See skills/metrickit-ref.md (Part 1, StateReporting)

User: "How do I profile my Foundation Models / agentic feature?"
→ See skills/performance-profiling.md (Foundation Models instrument), then axiom-ai

User: "How do I compare two Instruments runs to verify a fix?"
→ See skills/performance-profiling.md (Run Comparisons) or skills/trace-comparison.md (CLI/CI)

User: "Scan my code for memory leaks"
→ Invoke: `memory-auditor` agent

User: "Check my app for battery drain issues"
→ Invoke: `energy-auditor` agent

User: "Audit my Swift code for performance anti-patterns"
→ Invoke: `swift-performance-analyzer` agent

User: "How do I inspect this variable in the debugger?"
→ Invoke: See axiom-build (skills/lldb.md)

User: "What's the LLDB command for conditional breakpoints?"
→ Invoke: See axiom-build (skills/lldb-ref.md)

User: "I need to reproduce this crash in the debugger"
→ Invoke: See axiom-build (skills/lldb.md)

User: "My list scrolls slowly and memory keeps growing"
→ See skills/memory-debugging.md first, then skills/performance-profiling.md if stutter remains

User: "App freezes for a few seconds on first launch then works fine"
→ See skills/hang-diagnostics.md

User: "UI locks up when multiple API calls return at the same time"
→ Cross-route: `/skill axiom-concurrency` (callback contention)

User: "My timer stops when the user scrolls"
→ Read: `axiom-integration` (skills/timer-patterns.md)

User: "EXC_BAD_INSTRUCTION crash in my timer code"
→ Read: `axiom-integration` (skills/timer-patterns.md)

User: "Should I use Timer or DispatchSourceTimer?"
→ Read: `axiom-integration` (skills/timer-patterns.md)

User: "How do I create an AsyncTimerSequence?"
→ Read: `axiom-integration` (skills/timer-patterns-ref.md)

User: "Review my Swift code for outdated patterns"
→ Invoke: See axiom-swift (skills/swift-modern.md)

User: "Is there a more modern way to do this?"
→ Invoke: See axiom-swift (skills/swift-modern.md)

User: "What is the app logging? I need to see console output"
→ Invoke: `/axiom:console`

User: "Capture the simulator logs while I reproduce this bug"
→ Invoke: `/axiom:console`
