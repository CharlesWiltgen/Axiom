---
name: xctrace-ref
description: xctrace CLI reference for headless Instruments profiling, CI/CD integration, and trace export
---

# xctrace Reference

Command-line reference for `xctrace`, the CLI behind Instruments.app. Covers headless trace recording, XML export, and CI/CD automation for performance analysis.

## When to Use This Reference

Use this reference when:
- Recording Instruments traces from the command line
- Automating profiling in CI/CD pipelines
- Exporting trace data to XML for programmatic analysis
- Finding the right instrument for your profiling need
- Troubleshooting xctrace recording or export issues
- Comparing performance before and after code changes

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I profile my app from the command line?"
- "How do I record a CPU trace with xctrace?"
- "How do I export an Instruments trace to XML?"
- "How do I automate performance testing in CI?"
- "What instruments are available in xctrace?"
- "Why does my trace export fail with a template error?"

## What's Covered

- Recording traces with `--instrument` and `--template` flags
- Target selection: attach by name/PID, launch, all-processes, specific device
- Core instruments: CPU Profiler, Allocations, Leaks, SwiftUI, Swift Concurrency
- Full list of 50+ available instruments
- XML export via `--toc` (table of contents) and `--xpath` (specific tables)
- CPU profile schema columns and data interpretation
- CI/CD integration scripts for automated profiling
- Before/after comparison workflow
- Process discovery for simulator apps
- Troubleshooting: template errors in Xcode 26+, attach failures, empty traces, symbolication
- Xcode 26+ gotcha: prefer `--instrument` over `--template` for reliable export

## Key Pattern

```bash
# Record a CPU profile
xcrun xctrace record \
    --instrument 'CPU Profiler' \
    --attach 'MyApp' \
    --time-limit 10s \
    --output profile.trace

# See available tables
xcrun xctrace export --input profile.trace --toc

# Export specific table
xcrun xctrace export --input profile.trace \
    --xpath '/trace-toc/run[@number="1"]/data/table[@schema="cpu-profile"]'
```

## Documentation Scope

This page documents the `axiom-xctrace-ref` reference skill -- the complete xctrace CLI guide Claude uses when you need headless profiling or automated performance analysis.

**For GUI profiling workflows:** See [performance-profiling](/skills/debugging/performance-profiling) for Instruments decision trees.

**For field metrics:** See [metrickit-ref](/reference/metrickit-ref) for collecting performance data from production users.

## Related

- [performance-profiling](/skills/debugging/performance-profiling) -- Instruments decision trees and profiling workflows
- [metrickit-ref](/reference/metrickit-ref) -- Field performance metrics via MetricKit
- [app-store-connect-ref](/reference/app-store-connect-ref) -- Production crash and metrics dashboards

## Resources

**Docs**: /xcode/instruments, /os/logging/recording-performance-data
