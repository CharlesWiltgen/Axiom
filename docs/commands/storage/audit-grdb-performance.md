---
name: audit-grdb-performance
description: Scan GRDB and SQLite code for SQL injection, missing indexes, app-group sharing gaps, and silently stale observations
---

# audit-grdb-performance

Scan GRDB-backed code for performance and correctness problems that don't announce themselves — slow queries, unsafe raw SQL, and observations that quietly stop updating.

## What This Command Does

Launches the **grdb-performance-auditor** agent. It first classifies your codebase (raw GRDB, SQLiteData, or both; queue vs pool; app-group sharing yes/no), then runs only the detectors that apply to that classification, so it doesn't report findings that can't happen in your setup.

This is the runtime-and-idioms counterpart to [audit-database-schema](/commands/storage/audit-database-schema), which covers migration safety.

## What It Checks

1. **SQL string interpolation** – raw SQL built from interpolated values instead of bound arguments, an injection vector
2. **Missing foreign-key indexes** – SQLite doesn't index FK columns for you, and unindexed JOINs scan the child table
3. **Missing `PRAGMA optimize`** – without it the query planner reasons from no statistics, typically 2–10× slower on real user data
4. **App-group sharing gaps** – journal mode not WAL, and missing `observesSuspensionNotifications` (the `0xDEAD10CC` production crash)
5. **Prefix-redundant indexes** – an index whose column list is a prefix of another, costing write time and disk
6. **`databaseSelection` as a stored property** – a hard Swift 6 compile error
7. **Legacy `Record` subclasses** – discouraged since GRDB 7, and awkward to make `Sendable`
8. **`INSERT OR REPLACE` misused as an upsert** – deletes and re-inserts, so unlisted columns reset to defaults and `ON DELETE CASCADE` fires
9. **Observation on a `WITHOUT ROWID` table** – SQLite's update hook never fires for these, so the observation goes silent permanently with no error
10. **`WITHOUT ROWID` upsert below GRDB 7.11** – GRDB generated wrong SQL for that pairing before 7.11.0

## Usage

```
/axiom:audit grdb-performance
```

## Related

- [grdb-performance-auditor](/agents/grdb-performance-auditor) – The agent that powers this command
- [grdb-performance](/skills/persistence/grdb-performance) – The discipline the auditor enforces, with the reasoning behind each finding
- [grdb](/skills/persistence/grdb) – Setup, record types, upsert, and query patterns
- [grdb-app-groups](/skills/persistence/grdb-app-groups) – Multi-process sharing, if the auditor flags app-group findings
- [audit-database-schema](/commands/storage/audit-database-schema) – Migration safety, the other half of a GRDB review
