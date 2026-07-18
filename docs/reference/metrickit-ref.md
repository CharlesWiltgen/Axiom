---
name: metrickit-ref
description: MetricKit API reference for field diagnostics -- the 27-cycle Swift API (MetricManager, MetricResult, StateReporting) plus legacy MXMetricPayload, MXDiagnosticPayload, MXCallStackTree
---

# MetricKit Reference

Complete API reference for collecting field performance metrics and diagnostics using MetricKit. Covers the new Swift-first API from the 27 platform releases (MetricManager, typed metrics and diagnostics, per-state metrics via StateReporting) alongside the legacy MX* payload API, call stack symbolication, and integration patterns.

## When to Use This Reference

Use this reference when:
- Setting up MetricKit collection — the new `MetricManager` AsyncSequence streams (27) or a legacy MXMetricManagerSubscriber
- Migrating from MXMetricManager to the new Swift API
- Splitting field metrics by app state (per-tab, per-experiment) with the StateReporting framework
- Parsing typed `MetricReport`/`DiagnosticReport` values or legacy MXMetricPayload/MXDiagnosticPayload
- Symbolicating MetricKit call-stack frames with dSYMs
- Understanding background exit reasons (jetsam, watchdog, CPU limit)
- Building a crash reporter extension with the CrashReportExtension framework (27)
- Integrating MetricKit alongside a crash reporter like Crashlytics or Sentry

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I set up MetricKit to collect crash data?"
- "How do I migrate from MXMetricManager to MetricManager?"
- "Can I get hitch metrics per tab or per experiment arm?"
- "How do I attach custom metadata to my reported app states?"
- "How do I symbolicate MetricKit call stacks?"
- "What background exit types does MetricKit track?"
- "How do I use MetricKit signpost metrics for custom operations?"
- "How do I build a crash reporter extension?"
- "What's the difference between MetricKit and Xcode Organizer?"


## What's Covered

- The new Swift API (27): MetricManager setup, MetricReport interval entries, the full MetricResult metric inventory (including Metal frame rate and storage metrics), launch-task tracking, typed diagnostics with termination categories, and memory exception diagnostics
- Per-state metrics: StateReporting domains, state transitions, the `@ReportableMetadata` macro, and state-grouped report encoding
- Crash reporter extensions (27): the CrashReportExtension framework — CrashedProcess, in-extension symbolication, binary image inventory
- Migration map from the soft-deprecated MX* API to the 27 API
- MXMetricManagerSubscriber setup and registration timing (legacy)
- MXMetricPayload: CPU, memory, launch time histograms, disk I/O, network, scroll hitches, signpost metrics
- MXDiagnosticPayload: crash, hang, disk write exception, and CPU exception diagnostics
- MXCallStackTree JSON parsing and symbolication with `atos`
- MXBackgroundExitData: all 10 exit types with interpretation and recommended actions
- Integration patterns: analytics upload, hybrid crash reporting, regression alerting
- MetricKit vs Xcode Organizer comparison
- Common gotchas: daily metric delivery, opt-in only, simulator limitations, unsymbolicated stacks, state rate limiting

## Documentation Scope

This page documents the `axiom-performance` reference skill -- the complete MetricKit API guide Claude uses when you need to collect and analyze field performance data.

**For profiling during development:** See [xctrace-ref](/reference/xctrace-ref) for CLI-based Instruments profiling.

**For App Store Connect metrics:** See [app-store-connect-ref](/reference/app-store-connect-ref) for the web dashboard view of performance data.

**For hang diagnosis:** See the `axiom-performance` skill for hang-specific workflows.

## Related

- [app-store-connect-ref](/reference/app-store-connect-ref) – Web dashboard crash and metrics analysis
- [xctrace-ref](/reference/xctrace-ref) – CLI Instruments profiling for development

## Resources

**WWDC**: 2019-417, 2020-10081, 2021-10087, 2026-222

**Docs**: /metrickit, /metrickit/metricmanager, /statereporting, /crashreportextension, /metrickit/mxmetricmanager, /metrickit/mxdiagnosticpayload
