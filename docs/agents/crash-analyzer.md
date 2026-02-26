# crash-analyzer

Parses crash reports (.ips, .crash, or pasted text), checks symbolication status, categorizes by crash pattern, and generates actionable diagnostics.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Analyze this crash log"
- "Here's a crash from TestFlight, what's wrong?"
- "Parse this .ips file"
- "Why did my app crash? Here's the report..."

**Explicit command:**
```bash
/axiom:analyze-crash
```

## What It Does

1. **Parse crash report** — JSON .ips or text .crash format
2. **Extract key fields** — Exception type, codes, crashed thread, frames
3. **Check symbolication status** — Identifies unsymbolicated frames
4. **Categorize by crash pattern** — Null pointer, Swift runtime, watchdog, jetsam, etc.
5. **Generate actionable analysis** — Specific next steps for fixing

## Related

- **testflight-triage** — Crash investigation using Xcode Organizer
- **performance-profiling** — Instruments workflows for diagnosing performance crashes
