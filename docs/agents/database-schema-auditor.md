# database-schema-auditor

Scans database migration and schema code for the 10 most critical violations — unsafe ALTER TABLE patterns, DROP operations, missing idempotency, foreign key misuse, and transaction safety.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my database migrations for safety?"
- "Review my GRDB schema code for issues"
- "Audit my SQLite migrations before release"
- "Check my database code for data loss risks"

**Explicit command:**
```bash
/axiom:audit database-schema
```

## What It Does

1. **ADD COLUMN NOT NULL Without DEFAULT** (CRITICAL) — Crashes for all users with existing data
2. **DROP TABLE on User Data** (CRITICAL) — Permanent data deletion
3. **DROP COLUMN** (CRITICAL) — Unsupported before SQLite 3.35.0 (iOS 16+)
4. **ALTER TABLE Without Idempotency** (CRITICAL) — Crashes on re-run
5. **INSERT OR REPLACE Breaks Foreign Keys** (HIGH) — Silently deletes child records
6. **Foreign Key Addition Without Validation** (HIGH) — Fails with orphaned rows
7. **PRAGMA foreign_keys Not Enabled** (HIGH) — Constraints silently ignored
8. **RENAME COLUMN Without Migration Strategy** (MEDIUM) — Breaks raw SQL references
9. **Batch Insert Outside Transaction** (MEDIUM) — 30x slower without wrapping
10. **CREATE Without IF NOT EXISTS** (MEDIUM) — Breaks migration idempotency

## Related

- **database-migration** — Safe schema evolution patterns for SQLite/GRDB/SwiftData
- **grdb** — GRDB patterns and DatabaseMigrator reference
