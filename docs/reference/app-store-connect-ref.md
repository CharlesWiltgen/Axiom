---
name: app-store-connect-ref
description: Crash analysis, TestFlight feedback, metrics dashboards, and data export workflows for App Store Connect
---

# App Store Connect Reference

Reference for navigating App Store Connect to find crash reports, TestFlight feedback, performance metrics, and data export workflows.

## When to Use This Reference

Use this reference when:
- Triaging crash reports in App Store Connect
- Reviewing TestFlight feedback from beta testers
- Monitoring performance metrics across app versions
- Exporting crash logs or metrics via the ASC API
- Deciding between App Store Connect and Xcode Organizer for crash analysis

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I find crash reports in App Store Connect?"
- "Where do I see TestFlight feedback screenshots?"
- "How do I compare crash rates between app versions?"
- "Why don't I see crashes in App Store Connect?"
- "How do I export crash data from the App Store Connect API?"
- "What's the difference between ASC and Xcode Organizer for crash triage?"

## What's Covered

- Crashes dashboard navigation and filtering (platform, version, date range, device, OS)
- Key metrics: crash-free users, crash count, crash rate, affected devices
- Individual crash signature detail views with distribution data
- Downloading and symbolicating crash logs (.ips and .crash formats)
- TestFlight feedback: screenshots, device info, limitations (one-way only)
- Metrics dashboard: hangs, disk writes, launch time, memory, battery, scrolling
- Termination types (jetsam, watchdog, background task timeout) that don't produce crash reports
- App Store Connect API endpoints for automated data export
- Crash triage priority framework (P0-P3)
- Common questions: missing crashes, unsymbolicated stacks, ASC vs Organizer

## Documentation Scope

This page documents the `axiom-app-store-connect-ref` reference skill -- the complete guide Claude uses when you need to navigate App Store Connect for crash and performance data.

**For crash log parsing:** Use the `/axiom:analyze-crash` command to parse downloaded crash logs.

**For on-device metrics:** See [metrickit-ref](/reference/metrickit-ref) for collecting field metrics programmatically via MetricKit.

## Related

- [metrickit-ref](/reference/metrickit-ref) -- Programmatic field metrics collection
- [xctrace-ref](/reference/xctrace-ref) -- CLI-based Instruments profiling

## Resources

**WWDC**: 2020-10076, 2020-10078, 2021-10203, 2021-10258

**Docs**: /app-store-connect/api, /xcode/diagnosing-issues-using-crash-reports-and-device-logs
