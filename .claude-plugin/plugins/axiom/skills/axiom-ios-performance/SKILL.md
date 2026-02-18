---
name: axiom-ios-performance
description: Use when app feels slow, memory grows, battery drains, or diagnosing ANY performance issue. Covers memory leaks, profiling, Instruments workflows, retain cycles, performance optimization.
license: MIT
---

# iOS Performance Router

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

**Memory leaks (Swift)** → `/skill axiom-memory-debugging`
- Systematic leak diagnosis
- 5 common leak patterns
- Instruments workflows
- deinit not called

**Memory leak scan** → Launch `memory-auditor` agent or `/axiom:audit memory` (6 common patterns: timers, observers, closures, delegates, view callbacks, PhotoKit)

**Memory leaks (Objective-C blocks)** → `/skill axiom-objc-block-retain-cycles`
- Block retain cycles
- Weak-strong pattern
- Network callback leaks

### Performance Profiling

**Performance profiling (GUI)** → `/skill axiom-performance-profiling`
- Time Profiler (CPU)
- Allocations (memory growth)
- Core Data profiling (N+1 queries)
- Decision trees for tool selection

**Automated profiling (CLI)** → `/skill axiom-xctrace-ref`
- Headless xctrace profiling
- CI/CD integration patterns
- Command-line trace recording
- Programmatic trace analysis

**Run automated profile** → Use `performance-profiler` agent or `/axiom:profile`
- Records trace via xctrace
- Exports and analyzes data
- Reports findings with severity

### Hang/Freeze Issues

**App hangs or freezes** → `/skill axiom-hang-diagnostics`
- UI unresponsive for >1 second
- Main thread blocked (busy or waiting)
- Decision tree: busy vs blocked diagnosis
- Time Profiler vs System Trace selection
- 8 common hang patterns with fixes
- Watchdog terminations

### Energy Issues

**Battery drain, high energy** → `/skill axiom-energy`
- Power Profiler workflow
- Subsystem diagnosis (CPU/GPU/Network/Location/Display)
- Anti-pattern fixes
- Background execution optimization

**Symptom-based diagnosis** → `/skill axiom-energy-diag`
- "App at top of Battery Settings"
- "Device gets hot"
- "Background battery drain"
- Time-cost analysis for each path

**API reference with code** → `/skill axiom-energy-ref`
- Complete WWDC code examples
- Timer, network, location efficiency
- BGContinuedProcessingTask (iOS 26)
- MetricKit setup

**Energy scan** → Launch `energy-auditor` agent or `/axiom:audit energy` (8 anti-patterns: timer abuse, polling, continuous location, animation leaks, background mode misuse, network inefficiency, GPU waste, disk I/O)

### Swift Performance

**Swift performance optimization** → `/skill axiom-swift-performance`
- Value vs reference types, copy-on-write
- ARC overhead, generic specialization
- Collection performance

**Swift performance scan** → Launch `swift-performance-analyzer` agent or `/axiom:audit swift-performance` (unnecessary copies, ARC overhead, unspecialized generics, collection inefficiencies, actor isolation costs, memory layout)

### MetricKit Integration

**MetricKit API reference** → `/skill axiom-metrickit-ref`
- MXMetricPayload parsing
- MXDiagnosticPayload (crashes, hangs)
- Field performance data collection
- Integration with crash reporting

### Runtime State Inspection

**LLDB interactive debugging** → `/skill axiom-lldb`
- Set breakpoints, inspect variables at runtime
- Crash reproduction from crash logs
- Thread state analysis for hangs
- Swift value inspection (po vs v)

**LLDB command reference** → `/skill axiom-lldb-ref`
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
5. Slowdown when multiple async operations complete at once? → Cross-route to `axiom-ios-concurrency` (callback contention, not profiling)
6. Battery drain (know the symptom)? → energy-diag
7. Battery drain (need API reference)? → energy-ref
8. Battery drain (general)? → energy
9. MetricKit setup/parsing? → metrickit-ref
10. Profile with GUI (Instruments)? → performance-profiling
11. Profile with CLI (xctrace)? → xctrace-ref
12. Run automated profile now? → performance-profiler agent
13. General slow/lag? → performance-profiling
14. Want proactive memory leak scan? → memory-auditor (Agent)
15. Want energy anti-pattern scan? → energy-auditor (Agent)
16. Want Swift performance audit (ARC, generics, collections)? → swift-performance-analyzer (Agent)
17. Need to inspect variable/thread state at runtime? → axiom-lldb
18. Need exact LLDB command syntax? → axiom-lldb-ref

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
| "UI locks up when network requests finish — that's slow" | Multiple callbacks completing at once = main thread contention = concurrency issue. Cross-route to ios-concurrency. |
| "I'll just add print statements to debug this" | Print-debug cycles cost 3-5 min each (build + run + reproduce). An LLDB breakpoint costs 30 seconds. axiom-lldb has the commands. |

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
→ Invoke: `/skill axiom-memory-debugging`

User: "I have a memory leak but deinit isn't being called"
→ Invoke: `/skill axiom-memory-debugging`

User: "My app feels slow, where do I start?"
→ Invoke: `/skill axiom-performance-profiling`

User: "My Objective-C block callback is leaking"
→ Invoke: `/skill axiom-objc-block-retain-cycles`

User: "My app drains battery quickly"
→ Invoke: `/skill axiom-energy`

User: "Users say the device gets hot when using my app"
→ Invoke: `/skill axiom-energy-diag`

User: "What's the best way to implement location tracking efficiently?"
→ Invoke: `/skill axiom-energy-ref`

User: "Profile my app's CPU usage"
→ Use: `performance-profiler` agent (or `/axiom:profile`)

User: "How do I run xctrace from the command line?"
→ Invoke: `/skill axiom-xctrace-ref`

User: "I need headless profiling for CI/CD"
→ Invoke: `/skill axiom-xctrace-ref`

User: "My app hangs sometimes"
→ Invoke: `/skill axiom-hang-diagnostics`

User: "The UI freezes and becomes unresponsive"
→ Invoke: `/skill axiom-hang-diagnostics`

User: "Main thread is blocked, how do I diagnose?"
→ Invoke: `/skill axiom-hang-diagnostics`

User: "How do I set up MetricKit?"
→ Invoke: `/skill axiom-metrickit-ref`

User: "How do I parse MXMetricPayload?"
→ Invoke: `/skill axiom-metrickit-ref`

User: "Scan my code for memory leaks"
→ Invoke: `memory-auditor` agent

User: "Check my app for battery drain issues"
→ Invoke: `energy-auditor` agent

User: "Audit my Swift code for performance anti-patterns"
→ Invoke: `swift-performance-analyzer` agent

User: "How do I inspect this variable in the debugger?"
→ Invoke: `/skill axiom-lldb`

User: "What's the LLDB command for conditional breakpoints?"
→ Invoke: `/skill axiom-lldb-ref`

User: "I need to reproduce this crash in the debugger"
→ Invoke: `/skill axiom-lldb`

User: "My list scrolls slowly and memory keeps growing"
→ Invoke: `/skill axiom-memory-debugging` first, then `/skill axiom-performance-profiling` if stutter remains

User: "App freezes for a few seconds on first launch then works fine"
→ Invoke: `/skill axiom-hang-diagnostics`

User: "UI locks up when multiple API calls return at the same time"
→ Cross-route: `/skill axiom-ios-concurrency` (callback contention)
