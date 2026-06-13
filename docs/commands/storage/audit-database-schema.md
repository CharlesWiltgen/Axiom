---
name: audit-database-schema
description: Scan database migration code for unsafe ALTER TABLE, DROP operations, missing idempotency, FK misuse
---

# audit-database-schema

Scan database migration and schema-evolution code for patterns that risk data loss or migration crashes.

## What This Command Does

Launches the **database-schema-auditor** agent to flag dangerous SQL patterns in migration files — destructive operations, non-idempotent migrations, and foreign-key misuse that breaks under concurrent access.

## What It Checks

1. **Unsafe ALTER TABLE** – column adds without defaults, type changes that lose data, NOT NULL added to populated columns
2. **DROP operations** – `DROP TABLE`/`DROP COLUMN` without an explicit migration-roll-forward path
3. **Missing idempotency** – migrations that fail on re-run rather than being safely repeatable
4. **Foreign-key misuse** – `REFERENCES` without `ON DELETE` policy, or cascade rules that delete more than intended
5. **Transaction safety** – multi-statement migrations not wrapped in `BEGIN`/`COMMIT`

## Related Agent

- [database-schema-auditor](/agents/database-schema-auditor) – The agent that powers this command
