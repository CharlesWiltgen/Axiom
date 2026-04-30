# database-schema-auditor

Scans database migration and schema code for safety violations and architectural gaps — from known anti-patterns like unsafe `ALTER TABLE`, `DROP` operations, and missing idempotency to architectural issues like missing FK enforcement, unguarded destructive operations, and incomplete upgrade paths.

## What It Does

- Detects 10 known anti-patterns (NOT NULL without DEFAULT, DROP TABLE/COLUMN, ALTER without idempotency, INSERT OR REPLACE on FK-referenced tables, missing `PRAGMA foreign_keys`, RENAME COLUMN drift, batch inserts outside transactions, CREATE without IF NOT EXISTS, FK addition without validation)
- Identifies architectural gaps (missing upgrade path from oldest supported version, FKs declared but not enforced, batch operations outside transactions, RENAME without raw-SQL grep, missing WAL mode for multi-process access, no post-migration sanity check)
- Correlates findings that compound into higher severity (FK constraints + PRAGMA off, INSERT OR REPLACE + ON DELETE CASCADE, ADD COLUMN NOT NULL + production user base)
- Produces a Schema Health Score (SAFE / FRAGILE / DANGEROUS)

## How to Use

**Natural language:**
- "Can you check my database migrations for safety?"
- "Review my GRDB schema code for issues"
- "Audit my SQLite migrations before release"
- "Check my database code for data loss risks"

**Explicit command:**
```bash
/axiom:audit database-schema
```

## Related

- **database-migration** skill — use to fix migration issues this auditor finds, including the 12-step DROP COLUMN pattern and idempotent ALTER strategies
- **grdb** skill — GRDB DatabaseMigrator patterns, configuration, and FK enforcement setup
- **core-data-auditor** agent — overlaps when projects mix Core Data and direct SQLite/GRDB
- **swiftdata-auditor** agent — overlaps on SwiftData-backed schemas
- **storage-auditor** agent — overlaps on `.sqlite` file location and backup exclusions
- **icloud-auditor** agent — overlaps when CloudKit-synced tables undergo schema changes
- **health-check** agent — includes database-schema-auditor in project-wide scans
