---
name: analyze-crash
description: Parse and analyze iOS/macOS crash logs (.ips, .crash, or pasted text) to identify root cause
---

# Analyze Crash Log

Launches the **crash-analyzer** agent to parse crash reports and identify the root cause.

## What It Does

The agent will:
1. Parse the crash report (JSON .ips or text .crash format)
2. Extract key fields (exception type, codes, crashed thread, frames)
3. Check symbolication status
4. Categorize by crash pattern (null pointer, Swift runtime, watchdog, jetsam, etc.)
5. Generate actionable analysis with specific next steps

## Crash Sources

Provide crashes via:
- **Pasted text** — Copy/paste the crash report directly
- **File path** — `~/Library/Logs/DiagnosticReports/MyApp.ips`
- **Xcode export** — Copied from Organizer

## Crash Log Locations

```bash
# macOS/iOS Simulator crash logs
~/Library/Logs/DiagnosticReports/*.ips

# Device crash logs (after sync)
~/Library/Logs/CrashReporter/MobileDevice/<DeviceName>/
```

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Analyze this crash log"
- "Here's a crash from TestFlight, what's wrong?"
- "Parse this .ips file"
- "Why did my app crash? Here's the report..."
