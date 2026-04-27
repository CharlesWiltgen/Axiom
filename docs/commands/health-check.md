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

### Scoping to a Branch's Diff

For PR review, scope the audit to files changed on the current branch — auditors only inspect the files your PR touched, so findings stay relevant and don't pull in pre-existing issues from elsewhere in the repo.

```
/axiom:health-check diff
```

This compares the current branch against the merge-base with `origin/main` (falling back to `origin/master`, then `main`, then `master` if `origin/main` doesn't exist).

The report's first line declares the scope (`changed files vs <base> (merge-base <SHA>, N files)`) and lists the audited files. Findings outside that file list are dropped, even if an auditor surfaces them — the scope is a hard boundary.

If there are no changed Swift files vs the base, the command exits cleanly without launching any auditors.

### Emphasis (Freeform)

Anything you write that isn't `diff` or `skip <auditor>` is treated as emphasis — the agent uses it to prioritize the executive summary and the order of the summary table, but it never excludes auditors. Useful when you want a full audit but care most about a specific area.

```
/axiom:health-check focus on memory leaks
/axiom:health-check I'm worried about Core Data migrations
/axiom:health-check prioritize accessibility before release
```

### Combining Modifiers

All three modifiers compose freely:

```
/axiom:health-check diff skip camera focus on concurrency
```

This runs a diff-scoped audit, omits the camera auditor, and surfaces concurrency findings first in the report.

## Auto-Detection

The agent detects which auditors are relevant by scanning for framework imports, file types, and code patterns. Six auditors always run (memory, security, accessibility, swift-performance, modernization, codable). Others activate based on what's found in your project.

## Output

Results appear in two places:
1. **Conversation** — Executive summary with top 5 critical findings + summary table
2. **scratch/ directory** — Full detailed reports per auditor domain

## Related

- [Audit Command](/commands/utility/audit) — Run individual auditors by domain
- [Memory Auditor](/agents/memory-auditor) — One of the 26 individual auditors health-check orchestrates
