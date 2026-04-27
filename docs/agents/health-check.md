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
/axiom:health-check                              # Full project audit
/axiom:health-check diff                         # Scoped to files changed vs origin/main merge-base
/axiom:health-check focus on memory leaks        # Full audit, but prioritize emphasized findings
/axiom:health-check diff skip camera             # Diff-scoped, skipping the camera auditor
/axiom:audit all
```

## What It Does

Runs a 5-phase meta-audit:

1. **Scope and intent** — Determines audit scope (full vs diff-scoped vs `origin/main` merge-base), parses any auditor exclusions, and captures any freeform user emphasis. The launching command computes the diff file list and passes it to the agent.
2. **Detect** — Greps the in-scope file set for framework signals to determine which auditors apply
3. **Launch** — Runs all applicable auditors in parallel (always-run + conditional). In diff-scoped mode, every auditor is constrained to the same file list.
4. **Deduplicate** — Merges findings that reference the same file:line across multiple auditors. In diff-scoped mode, any finding outside the file list is dropped.
5. **Report** — Produces a unified report with scope header, executive summary, findings by domain, and summary table. User emphasis (if any) affects ordering and highlighting, never which auditors ran.

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

Reports are written to `scratch/health-check-{date}.md` (full audit) or `scratch/health-check-diff-{date}.md` (diff-scoped) with:
- Scope header (full audit vs `diff vs <base>` with merge-base SHA and file count)
- Executive summary (top 5 critical findings)
- Findings grouped by domain, sorted by severity
- Passed audits (zero-issue domains)
- Summary table with trigger reasons and severity breakdown

## Related

- [UX Flow Auditor](/agents/ux-flow-auditor) — User journey defects (complementary — health-check includes UX flow when SwiftUI navigation is detected)
- [/axiom:health-check](/commands/health-check) — The command that launches this agent
- Individual auditors can be run standalone for focused scans (e.g., `/axiom:audit memory`)
