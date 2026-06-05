---
name: profile
description: Run automated performance profiling via xcprof (launches performance-profiler agent)
disable-model-invocation: true
---

# Profile Performance

Launches the **performance-profiler** agent to record and analyze performance traces using the `xcprof` CLI (record → analyze), no Instruments GUI required.

## What It Does

The agent will:
1. Detect available simulators and running apps
2. Help you select what to profile
3. Record a trace with `xcprof record` — preset-based, bounded by `--max-duration`, and gated (launch / system-wide capture require explicit opt-in)
4. Analyze it with `xcprof analyze --json` — back-references resolved, system frames filtered, work attributed to user code
5. Report findings with an honest per-family support matrix (so an unmeasured family is never reported as clean) and recommendations

## Supported Instruments

- **CPU Profiler** — Find hot functions and CPU bottlenecks
- **Allocations** — Track memory usage and growth
- **Leaks** — Detect memory leaks
- **SwiftUI** — Analyze view body updates
- **Swift Tasks/Actors** — Concurrency analysis

> CPU / memory / network / energy round-trip through `xcprof analyze` today. SwiftUI and Swift Tasks/Actors are recorded alongside CPU Profiler, but their instrument-specific views currently require opening the trace in Instruments (`open <trace>`).

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Profile my app's CPU usage"
- "Run Time Profiler on my app"
- "Check for memory leaks"
- "Profile my app's launch time"
- "Run a headless performance trace"
