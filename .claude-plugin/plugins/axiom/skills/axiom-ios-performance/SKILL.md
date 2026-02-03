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

### MetricKit Integration

**MetricKit API reference** → `/skill axiom-metrickit-ref`
- MXMetricPayload parsing
- MXDiagnosticPayload (crashes, hangs)
- Field performance data collection
- Integration with crash reporting

## Decision Tree

1. Memory leak (Swift)? → memory-debugging
2. Memory leak (Objective-C blocks)? → objc-block-retain-cycles
3. App hang/freeze (UI unresponsive >1s)? → hang-diagnostics
4. Battery drain (know the symptom)? → energy-diag
5. Battery drain (need API reference)? → energy-ref
6. Battery drain (general)? → energy
7. MetricKit setup/parsing? → metrickit-ref
8. Profile with GUI (Instruments)? → performance-profiling
9. Profile with CLI (xctrace)? → xctrace-ref
10. Run automated profile now? → performance-profiler agent
11. General slow/lag? → performance-profiling

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I know it's a memory leak, let me find it" | Memory leaks have 6 patterns. memory-debugging diagnoses the right one in 15 min vs 2 hours. |
| "I'll just run Time Profiler" | Wrong Instruments template wastes time. performance-profiling selects the right tool first. |
| "Battery drain is probably the network layer" | Energy issues span 8 subsystems. energy skill diagnoses the actual cause. |
| "App feels slow, I'll optimize later" | Performance issues compound. Profiling now saves exponentially more time later. |
| "It's just a UI freeze, probably a slow API call" | Freezes have busy vs blocked causes. hang-diagnostics has a decision tree for both. |

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
