---
name: grdb
description: Raw GRDB for complex SQL queries, ValueObservation, and DatabaseMigrator patterns
version: 1.1.0
---

# GRDB

Direct SQLite access using [GRDB.swift](https://github.com/groue/GRDB.swift). Type-safe Swift wrapper around raw SQL with full SQLite power when you need it.

## When to Use This Skill

Use this skill when you're:
- Writing complex SQL joins across multiple tables
- Creating custom aggregation queries (GROUP BY, HAVING)
- Using ValueObservation for reactive queries
- Needing full control over SQL for performance
- Writing advanced database migrations
- Dropping down from SQLiteData for performance-critical operations

**Use SQLiteData instead when:** Type-safe @Table models are sufficient, CloudKit sync needed, prefer declarative queries.

**Use SwiftData when:** Simple CRUD with native Apple integration, don't need raw SQL control.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "I need to query messages with their authors and count of reactions in one query."
- "I want to observe a filtered list and update the UI whenever notes with a specific tag change."
- "I'm importing thousands of records and need custom migration logic."
- "My query is slow (10+ seconds). How do I profile and optimize it?"
- "I need GROUP BY with HAVING clause. Raw SQL seems easier than type-safe queries."

## What's Covered

### Database Setup
- DatabaseQueue (single connection) vs DatabasePool (concurrent access)
- File-based and in-memory databases
- When to use Queue vs Pool

### Record Types
- Codable structs for fetch/insert
- FetchableRecord and PersistableRecord protocols
- Mapping to/from database rows

### Querying
- Raw SQL with fetchAll, fetchOne
- Type-safe queries with QueryInterfaceRequest
- Complex JOINs with associations
- Aggregations: COUNT, SUM, GROUP BY

### ValueObservation
- Reactive queries that update on database changes
- Scheduling on main thread for UI
- Combining observations

### DatabaseMigrator
- Registering migrations
- Migration order and versioning
- Safe rollback patterns
- Data transforms during migration

### Performance
- EXPLAIN QUERY PLAN for profiling
- database.trace for logging
- Index creation
- Transaction batching

## Key Pattern

### Basic Query

```swift
import GRDB

let dbQueue = try DatabaseQueue(path: dbPath)

// Fetch with Codable
struct Track: Codable {
    var id: String
    var title: String
    var artist: String
}

let tracks = try dbQueue.read { db in
    try Track.fetchAll(db, sql: "SELECT * FROM tracks WHERE artist = ?", arguments: ["Daft Punk"])
}

// Write
try dbQueue.write { db in
    try db.execute(sql: "INSERT INTO tracks (id, title, artist) VALUES (?, ?, ?)",
                   arguments: [UUID().uuidString, "Get Lucky", "Daft Punk"])
}
```

### ValueObservation (Reactive)

```swift
let observation = ValueObservation.tracking { db in
    try Track.filter(Column("artist") == "Daft Punk").fetchAll(db)
}

let cancellable = observation.start(in: dbQueue, onError: { error in
    print("Error: \(error)")
}, onChange: { tracks in
    // Called on every database change affecting this query
    self.tracks = tracks
})
```

### DatabaseMigrator

```swift
var migrator = DatabaseMigrator()

migrator.registerMigration("v1") { db in
    try db.create(table: "tracks") { t in
        t.column("id", .text).primaryKey()
        t.column("title", .text).notNull()
        t.column("artist", .text).notNull()
    }
}

migrator.registerMigration("v2") { db in
    try db.alter(table: "tracks") { t in
        t.add(column: "duration", .double)
    }
}

try migrator.migrate(dbQueue)
```

## Documentation Scope

This page documents the `axiom-grdb` skill—raw GRDB patterns Claude uses when you need maximum SQL control beyond what SQLiteData provides.

**For SQLiteData:** See [sqlitedata](/skills/persistence/sqlitedata) for type-safe @Table models with less boilerplate.

**For migrations:** See [database-migration](/skills/persistence/database-migration) for safe schema evolution patterns.

## Related

- [sqlitedata](/skills/persistence/sqlitedata) — Type-safe SQLiteData with @Table models
- [database-migration](/skills/persistence/database-migration) — Safe migration patterns
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Async patterns for database actors

## Resources

**WWDC**: N/A (third-party framework)

**Docs**: github.com/groue/GRDB.swift
