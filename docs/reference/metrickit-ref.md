---
name: metrickit-ref
description: MetricKit API reference for field diagnostics -- MXMetricPayload, MXDiagnosticPayload, MXCallStackTree, crash and hang collection
---

# MetricKit Reference

Complete API reference for collecting field performance metrics and diagnostics using MetricKit. Covers metric payloads, diagnostic payloads, call stack symbolication, and integration patterns.

## When to Use This Reference

Use this reference when:
- Setting up an MXMetricManagerSubscriber in your app
- Parsing MXMetricPayload for CPU, memory, launch, or disk I/O metrics
- Parsing MXDiagnosticPayload for crash, hang, and exception diagnostics
- Symbolicating MXCallStackTree frames with dSYMs
- Understanding background exit reasons (jetsam, watchdog, CPU limit)
- Integrating MetricKit alongside a crash reporter like Crashlytics or Sentry

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I set up MetricKit to collect crash data?"
- "How do I symbolicate MetricKit call stacks?"
- "What background exit types does MetricKit track?"
- "How do I parse MXDiagnosticPayload for hang diagnostics?"
- "How do I use MetricKit signpost metrics for custom operations?"
- "What's the difference between MetricKit and Xcode Organizer?"

## What's Covered

- MXMetricManagerSubscriber setup and registration timing
- MXMetricPayload: CPU, memory, launch time histograms, disk I/O, network, scroll hitches, signpost metrics
- MXDiagnosticPayload: crash, hang, disk write exception, and CPU exception diagnostics
- MXCallStackTree JSON parsing and symbolication with `atos`
- MXBackgroundExitData: all 10 exit types with interpretation and recommended actions
- Integration patterns: analytics upload, hybrid crash reporting, regression alerting
- MetricKit vs Xcode Organizer comparison
- Common gotchas: 24-hour delay, opt-in only, simulator limitations, unsymbolicated stacks

## Documentation Scope

This page documents the `axiom-metrickit-ref` reference skill -- the complete MetricKit API guide Claude uses when you need to collect and analyze field performance data.

**For profiling during development:** See [xctrace-ref](/reference/xctrace-ref) for CLI-based Instruments profiling.

**For App Store Connect metrics:** See [app-store-connect-ref](/reference/app-store-connect-ref) for the web dashboard view of performance data.

**For hang diagnosis:** See the `axiom-hang-diagnostics` skill for hang-specific workflows.

## Related

- [app-store-connect-ref](/reference/app-store-connect-ref) -- Web dashboard crash and metrics analysis
- [xctrace-ref](/reference/xctrace-ref) -- CLI Instruments profiling for development

## Resources

**WWDC**: 2019-417, 2020-10081, 2021-10087

**Docs**: /metrickit, /metrickit/mxmetricmanager, /metrickit/mxdiagnosticpayload
