# /axiom:analyze-crash

Parse and analyze iOS/macOS crash logs to identify root cause (launches the `crash-analyzer` agent).

## Command

```bash
/axiom:analyze-crash
```

## What It Does

1. **Parse crash report** — JSON .ips or text .crash format
2. **Extract key fields** — Exception type, codes, crashed thread, frames
3. **Check symbolication** — Identifies unsymbolicated frames
4. **Categorize crash pattern** — Null pointer, Swift runtime, watchdog, jetsam, etc.
5. **Generate analysis** — Actionable diagnostics with specific next steps

## When to Use

- You have a crash log from TestFlight or production
- You need to understand a .ips or .crash file
- You want to identify the crash pattern without manually reading the report

## Related

- [crash-analyzer](/agents/crash-analyzer) — The agent behind this command
- [testflight-triage](/skills/debugging/testflight-triage) — Crash investigation using Xcode Organizer
