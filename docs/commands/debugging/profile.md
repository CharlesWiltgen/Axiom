# /axiom:profile

Run automated performance profiling via xctrace CLI (launches the `performance-profiler` agent).

## Command

```bash
/axiom:profile
```

## What It Does

1. **Detect targets** — Finds booted simulators and running apps
2. **Select instrument** — CPU Profiler, Allocations, Leaks, SwiftUI, or Swift Tasks
3. **Record trace** — Captures performance data via xctrace CLI
4. **Export and analyze** — Processes trace data programmatically
5. **Report findings** — Severity-rated results with recommendations

## When to Use

- You want to profile CPU usage without opening Instruments
- You need to check for memory leaks from the command line
- You want to analyze app launch time
- You need headless performance tracing for CI

## Related

- [performance-profiler](/agents/performance-profiler) — The agent behind this command
- [performance-profiling](/skills/debugging/performance-profiling) — Manual Instruments workflows
