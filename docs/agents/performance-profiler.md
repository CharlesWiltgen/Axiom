# performance-profiler

Automated, headless performance profiling built on the `xcprof` CLI — records a trace, analyzes it into structured JSON, and reports findings with an honest per-family support matrix. No Instruments GUI required.

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

1. **Check the environment** – `xcprof doctor` verifies xctrace; the agent records into a sandboxed `XCPROF_TRACE_ROOT`
2. **Detect targets** – Finds booted simulators and running apps
3. **Record** – `xcprof record` with a preset, bounded by `--max-duration` and gated (launch and system-wide capture require explicit opt-in)
4. **Analyze** – `xcprof analyze --json` resolves back-references, filters system frames, and attributes work to user code
5. **Report honestly** – Surfaces per-family status (`available` / `partial` / `not_exportable` / `not_present`) so an unmeasured family is never reported as clean

## Recording Presets

The agent maps your request to an `xcprof` preset (or explicit instruments):

| User Says | Preset / Instruments | Duration |
|-----------|----------------------|----------|
| "CPU", "slow", "performance" | `cpu` (CPU Profiler) | 10s |
| "memory", "allocations", "leaks" | `memory` (Allocations + Leaks) | 30s |
| "network", "API latency" | `network` (CPU Profiler + HTTP Traffic) | 20s |
| "energy", "battery" | `energy` (Power Profiler) | 30s |
| "SwiftUI", "view updates" | `SwiftUI` + CPU Profiler instruments | 10s |
| "concurrency", "actors", "tasks" | Swift Tasks + Swift Actors + CPU Profiler | 10s |

## Honest Reporting

Unlike a grep-the-XML pipeline that returns empty when a family wasn't measured, this agent reads `xcprof`'s support matrix: a family that wasn't recorded is reported as `not_present` (re-record with the right preset), not silently "clean". Stripped/release builds are symbolicated via `--dsym` (or UUID auto-discovery); unresolved frames stay raw and are flagged, never invented.

## Related

- **xcprof-ref** – The `xcprof` CLI the agent drives (record/analyze/doctor, presets, security gates)
- **performance-profiling** – Manual Instruments decision trees and workflows
- **hang-diagnostics** – Confirm main-thread hangs the CPU signal only flags
- **xctrace-ref** – Raw `xctrace` CLI (fallback reference)
