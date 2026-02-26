# performance-profiler

Automated performance profiling via xctrace CLI — records traces, exports data, and provides analysis summaries without requiring the Instruments GUI.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Profile my app's CPU usage"
- "Run Time Profiler on my app"
- "Check for memory leaks without opening Instruments"
- "Profile my app's launch time"

**Explicit command:**
```bash
/axiom:profile
```

## What It Does

1. **Detect targets** — Finds booted simulators and running apps
2. **Select instrument** — CPU Profiler, Allocations, Leaks, SwiftUI, or Swift Tasks
3. **Record trace** — Captures performance data via xctrace CLI
4. **Export and analyze** — Processes trace data programmatically
5. **Report findings** — Severity-rated results with recommendations

## Supported Instruments

| User Says | Instrument | Duration |
|-----------|------------|----------|
| "CPU", "slow", "performance" | CPU Profiler | 10s |
| "memory", "allocations" | Allocations | 30s |
| "leaks", "retain cycle" | Leaks | 30s |
| "SwiftUI", "view updates" | SwiftUI | 10s |
| "launch", "startup" | Launch workflow | varies |
| "concurrency", "actors" | Swift Tasks + Actors | 10s |

## Model & Tools

- **Model**: sonnet
- **Tools**: Bash, Read, Grep, Glob
- **Color**: orange

## Related Skills

- **performance-profiling** — Manual Instruments decision trees and workflows
- **xctrace-ref** — Full xctrace CLI reference
- **memory-debugging** — Memory leak diagnosis patterns
