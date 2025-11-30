# Database Migration

Safe database schema evolution for SQLite/GRDB/SwiftData. Prevents data loss with additive migrations and testing workflows.

**When to use**: Adding/modifying database columns, encountering "FOREIGN KEY constraint failed", "no such column", "cannot add NOT NULL column" errors, creating schema migrations for SQLite/GRDB/SwiftData

## Key Features

- Safe migration patterns (additive, idempotent, transactional)
- Testing checklist (fresh install + migration paths)
- Common errors and fixes
- GRDB and SwiftData examples
- Multi-layered prevention for 100k+ user apps

**Philosophy**: Migrations are immutable after shipping. Make them additive, idempotent, and thoroughly tested to prevent data loss.

**TDD Tested**: Already bulletproof, no changes needed during pressure testing
