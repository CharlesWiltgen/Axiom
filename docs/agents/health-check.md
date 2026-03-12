# Health Check

Orchestrates multiple specialized Axiom auditors in parallel, deduplicates findings, and produces a unified project health report.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Run a health check on my project"
- "Scan everything for issues"
- "Give me a full audit of my codebase"
- "Check my project health before release"

**Explicit command:**
```bash
/axiom:health-check
/axiom:audit all
```

## What It Does

Runs a 4-phase meta-audit:

1. **Detect** — Greps the codebase for framework signals to determine which auditors apply
2. **Launch** — Runs all applicable auditors in parallel (always-run + conditional)
3. **Deduplicate** — Merges findings that reference the same file:line across multiple auditors
4. **Report** — Produces a unified report with executive summary, findings by domain, and summary table

### Always-Run Auditors

These apply to every iOS project:
- memory-auditor
- security-privacy-scanner
- accessibility-auditor
- swift-performance-analyzer
- modernization-helper
- codable-auditor

### Conditional Auditors

Triggered by framework signals in the codebase (e.g., `import SwiftUI` triggers SwiftUI auditors, `@Model` triggers SwiftData auditor). Approximately 20 conditional auditors cover SwiftUI, persistence, concurrency, networking, camera, AI, games, and more.

### Output

Reports are written to `scratch/health-check-{date}.md` with:
- Executive summary (top 5 critical findings)
- Findings grouped by domain, sorted by severity
- Passed audits (zero-issue domains)
- Summary table with trigger reasons and severity breakdown

## Related

- [UX Flow Auditor](/agents/ux-flow-auditor) — User journey defects (complementary — health-check includes UX flow when SwiftUI navigation is detected)
- [/axiom:health-check](/commands/health-check) — The command that launches this agent
- Individual auditors can be run standalone for focused scans (e.g., `/axiom:audit memory`)
