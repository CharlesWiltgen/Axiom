# Health Check

Comprehensive project health check that auto-detects relevant auditors, runs them in parallel, and produces a single prioritized report.

## What It Does

- Scans project structure to detect which frameworks and patterns are used
- Launches all relevant auditors in parallel (6 always-run + conditional)
- Deduplicates findings that appear across multiple auditors (same file:line)
- Produces unified report with executive summary + grouped details
- Writes full results to `scratch/health-check-*.md` files

## Usage

```
/axiom:health-check
```

Or via the audit command:

```
/axiom:audit all
```

### Excluding Auditors

```
/axiom:health-check skip spritekit skip camera
```

## Auto-Detection

The agent detects which auditors are relevant by scanning for framework imports, file types, and code patterns. Six auditors always run (memory, security, accessibility, swift-performance, modernization, codable). Others activate based on what's found in your project.

## Output

Results appear in two places:
1. **Conversation** — Executive summary with top 5 critical findings + summary table
2. **scratch/ directory** — Full detailed reports per auditor domain

## Related

- [Audit Command](/commands/utility/audit) — Run individual auditors by domain
- [Memory Auditor](/agents/memory-auditor) — One of the 26 individual auditors health-check orchestrates
