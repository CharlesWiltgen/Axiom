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

`xcprof analyze` produces structured findings for:

- **CPU Profiler** — hot functions and CPU bottlenecks (`cpu` preset)
- **Network Connections** — socket-level connection stats (`network` preset)

These are recorded but **not** parsed by `analyze` — open the trace in Instruments (`open <trace>`) for their views:

- **Allocations / Leaks** — memory usage and growth (`analyze` reports them `not_exportable`)
- **Power Profiler** — energy (on-device iOS; `not_exportable` on macOS)
- **SwiftUI**, **Swift Tasks/Actors** — recorded alongside CPU Profiler

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Profile my app's CPU usage"
- "Run Time Profiler on my app"
- "Check for memory leaks"
- "Profile my app's launch time"
- "Run a headless performance trace"
