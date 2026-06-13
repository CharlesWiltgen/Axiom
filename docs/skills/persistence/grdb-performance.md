---
name: grdb-performance
description: Performant, idiomatic SQLite + GRDB for Swift — connection model, WAL economics, PRAGMA optimize, EXPLAIN QUERY PLAN workflow, index design, cursors, Swift 6 idioms
version: 1.0.0
---

# GRDB Performance

Performance and correctness discipline for GRDB on Apple platforms. Use SQLite deliberately; let GRDB handle safe Swift integration; validate with query plans and Instruments instead of cargo-cult PRAGMAs.

## When to Use This Skill

Use this skill when you're:

- Diagnosing a slow GRDB query and want to know what to measure first
- Hitting an app hang that traces back to database access
- Watching memory grow while fetching large result sets
- Designing a new schema and want choices you won't regret
- Choosing between `DatabaseQueue` and `DatabasePool`
- Reviewing GRDB code that uses raw SQL with string interpolation
- Doing a pre-release sanity check on a GRDB-backed app

**For full-text search** (tokenizers, Unicode discipline): see [sqlite-fts-ref](/reference/sqlite-fts-ref).

**For multi-process sharing** (app + widget): see [grdb-app-groups](/skills/persistence/grdb-app-groups).

**For migration safety** (schema evolution): see [database-migration](/skills/persistence/database-migration).

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Why is my GRDB query so slow?"
- "Should I use `DatabaseQueue` or `DatabasePool` for my app?"
- "What's `PRAGMA optimize` and do I need it?"
- "My `fetchAll` is using too much memory — what's the fix?"
- "How do I know if my queries are actually using their indexes?"
- "Why does the planner say SCAN when I have an index?"
- "I have partial indexes but they don't seem to fire. Why?"
- "When should I use `WITHOUT ROWID`?"
- "How do I migrate from `Record` subclass to struct records?"
- "My Swift 6 build fails with 'databaseSelection is not concurrency-safe' — fix?"

## What This Skill Provides

### Folklore Correction
- The N+1 myth doesn't apply to SQLite
- 200+ queries per page is normal — SQLite runs in-process

### Connection Model
- `DatabaseQueue` vs `DatabasePool` decision rule
- Why connections stay open for app lifetime (WWDC 2019)

### WAL Economics & Backup Safety
- WAL journal mode: 16→1 fsync win measured at WWDC 2019
- `.db` / `-wal` / `-shm` sidecar files travel together — copying `.db` alone corrupts
- `vacuum(into:)` for consistent snapshot backups
- Checkpoint behavior, autocheckpoint thresholds, when to switch back to DELETE journal for very large transactions

### Query Planner Workflow
- `PRAGMA optimize=0x10002` on connection open + periodic refresh
- EXPLAIN QUERY PLAN as the verification tool
- SCAN / SEARCH / USE TEMP B-TREE — what each means and what to do
- Cost differential: with vs without stats

### Index Design
- The compound-index rule: "left to right, no skipping, stops at the first range"
- Partial indexes — planner does no algebra; query literal must match
- Expression indexes for `LOWER()` and JSON
- Always index FK columns (GRDB DSL `belongsTo` does this automatically)

### Schema Choices That Affect Performance
- `WITHOUT ROWID` for small-row tables with non-integer PKs
- Generated columns (VIRTUAL by default; indexable)
- `PRAGMA table_xinfo` (not `table_info`) to inspect generated columns

### Query Idioms
- Records as Sendable structs, not `Record` subclasses (GRDB 7+)
- `databaseSelection` MUST be computed property under Swift 6
- SQL injection: only via `?`/`:name` arguments or `execute(literal:)`

### Cursors for Large Streams
- `fetchCursor` consumption rules (must stay inside `read { ... }`)
- `Row` reuse — `row.copy()` when keeping snapshots
- When cursors win vs `fetchAll`

### Observation Cost
- `ValueObservation` default scheduling (main-actor async)
- `.immediate` scheduling — fast queries only
- `DatabaseRegionObservation` – when transactions matter more than values

### SQLiteData Layer Note
- How tuning transfers from GRDB to SQLiteData
- Direct SQLite-3 decode vs Codable round-trips
- `@FetchAll` ≈ `ValueObservation.shared(in:)` semantics

### Anti-Patterns Reference
- 14-row anti-pattern table covering: SQL string interpolation, missing FK indexes, unbounded `fetchAll`, opening/closing DB per query, missing `PRAGMA optimize`, partial-index WHERE mismatch, `ORDER BY` without supporting index, `.immediate` on slow ValueObservation, `Record` subclass, `databaseSelection` as `static let`, copying `.sqlite` alone, stored generated columns for indexable lookups, string concatenation for case-insensitive search
- Each anti-pattern cross-references the explaining section

### When to Profile vs Read
- EXPLAIN QUERY PLAN first (free)
- Instruments File Activity for write amplification
- Instruments Points of Interest with `db.trace` for contention
- Read-first principle: most perf bugs are missing-the-cheap-win problems, not measurement problems
- Realistic-data warning: toy data lies

## Key Pattern

### PRAGMA optimize (biggest cheap win)

```swift
var config = Configuration()
config.prepareDatabase { db in
    // On connection open: include analysis of fresh connection (0x10000 bit)
    try db.execute(sql: "PRAGMA optimize=0x10002")
}
let dbQueue = try DatabaseQueue(path: dbPath, configuration: config)

// On app background or before close:
try dbQueue.write { db in
    try db.execute(sql: "PRAGMA optimize")
}
```

### EXPLAIN QUERY PLAN workflow

```swift
try dbQueue.read { db in
    let plan = try Row.fetchAll(
        db,
        sql: "EXPLAIN QUERY PLAN SELECT * FROM track WHERE artist_id = ?",
        arguments: [42]
    )
    for row in plan { print(row) }
}
```

Red flags: `SCAN <table>` on a large table, `USE TEMP B-TREE` for ORDER BY / GROUP BY / DISTINCT.

### Cursors for memory-sensitive fetches

```swift
try dbQueue.read { db in
    let cursor = try Track.fetchCursor(db, sql: "SELECT * FROM track ORDER BY title")
    while let track = try cursor.next() {
        process(track)
    }
}
```

Critical: cursors MUST be consumed inside the `read { ... }` closure.

## Documentation Scope

This page documents the `grdb-performance` skill — performance and correctness discipline for GRDB. For automated scanning, use [grdb-performance-auditor](/agents/grdb-performance-auditor).

For the GRDB primer (setup, record types, basic queries), see [grdb](/skills/persistence/grdb).

## Related

- [grdb](/skills/persistence/grdb) – primer for setup, record types, ValueObservation basics
- [sqlite-fts-ref](/reference/sqlite-fts-ref) – full-text search shared by GRDB and SQLiteData
- [grdb-app-groups](/skills/persistence/grdb-app-groups) – multi-process database sharing
- [database-migration](/skills/persistence/database-migration) – migration safety, STRICT tables
- [sqlitedata](/skills/persistence/sqlitedata) – when SQLiteData is a better fit than raw GRDB
- [grdb-performance-auditor](/agents/grdb-performance-auditor) – automated scan for issues this skill teaches

## Resources

**WWDC**: 2019-419 ("Optimizing Storage in Your App")

**SQLite docs**: sqlite.org/np1queryprob, sqlite.org/wal, sqlite.org/eqp, sqlite.org/queryplanner, sqlite.org/lang_analyze, sqlite.org/partialindex, sqlite.org/expridx, sqlite.org/withoutrowid, sqlite.org/gencol

**GRDB docs**: github.com/groue/GRDB.swift

**Third-party**: emschwartz.me/subtleties-of-sqlite-indexes (Schwartz compound-index rule), simonwillison.net/2024/May/8/modern-sqlite-generated-columns (Willison generated columns), phiresky.github.io/blog/2020/sqlite-performance-tuning (Phiresky PRAGMA tuning)
