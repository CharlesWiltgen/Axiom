# grdb-performance-auditor

Scans GRDB and SQLite code for performance and correctness anti-patterns. Pairs with [database-schema-auditor](/agents/database-schema-auditor) (migration safety); this agent focuses on shipped-code performance, cross-process correctness, and Swift 6 idioms.

## What It Does

- Framework detection (Raw GRDB / SQLiteData / Both) to gate detectors and avoid false positives
- Detects 7 high-confidence patterns: raw SQL string interpolation, missing FK indexes (raw SQL), missing `PRAGMA optimize` for raw-GRDB apps, journal mode mismatch for app-group DBs, missing `observesSuspensionNotifications` for shared DBs, prefix-redundant indexes (raw SQL), `databaseSelection` declared as stored property (Swift 6 compile error)
- Includes 1 optional modernization detector: legacy `Record` subclass migration
- Identifies completeness gaps (missing `vacuum(into:)` backup, missing `Configuration.busyMode` for shared DBs, untransacted batch operations, FTS5 normalization mismatches)
- Correlates findings that compound into higher severity (raw SQL interpolation + user input → CRITICAL injection vector; missing FK index + Pattern-3 stats gap → compound slowdown)
- Produces a Performance Health Score (SAFE / FRAGILE / DANGEROUS)
- Honest about scope: Detectors 2 and 6 scan raw SQL only — GRDB DSL `belongsTo` (auto-indexes) and `create(index:)` (cross-correlation requires a parser) are explicitly flagged for manual review

## How to Use

**Natural language:**
- "Can you audit my GRDB code for performance issues?"
- "Check my app-group database setup before release"
- "Scan for raw SQL injection risks in my GRDB code"
- "Why are my GRDB queries slow?"
- "Review my widget-to-app database sharing"

**Explicit command:**
```bash
/axiom:audit grdb-performance
```

## Related

- **grdb-performance** skill — use to understand and fix issues this auditor finds (PRAGMA optimize, EXPLAIN QUERY PLAN, index design, cursors, Swift 6 idioms)
- **grdb-app-groups** skill — fix multi-process sharing findings (persistent WAL, suspension defense, Data Protection)
- **sqlite-fts-ref** reference — fix FTS5 findings (tokenizer, Unicode discipline)
- **grdb** skill — GRDB primer for context on what each detector is checking
- **database-schema-auditor** agent — pairs with this auditor; covers migration safety while this one covers shipped-code performance
- **codable-auditor** agent — overlaps when records are Codable; check both for full coverage
- **storage-auditor** agent — overlaps on `.sqlite` file location and backup exclusions
- **health-check** agent — includes grdb-performance-auditor in project-wide scans
