---
name: profile
description: Run automated performance profiling via xctrace CLI (launches performance-profiler agent)
---

# Profile Performance

Launches the **performance-profiler** agent to record and analyze performance traces using `xctrace` CLI.

## What It Does

The agent will:
1. Detect available simulators and running apps
2. Help you select what to profile
3. Record a trace with the appropriate instrument (CPU Profiler, Allocations, Leaks, SwiftUI)
4. Export and analyze the data programmatically
5. Report findings with severity and recommendations

## Supported Instruments

- **CPU Profiler** — Find hot functions and CPU bottlenecks
- **Allocations** — Track memory usage and growth
- **Leaks** — Detect memory leaks
- **SwiftUI** — Analyze view body updates
- **Swift Tasks/Actors** — Concurrency analysis

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Profile my app's CPU usage"
- "Run Time Profiler on my app"
- "Check for memory leaks"
- "Profile my app's launch time"
- "Run a headless performance trace"
