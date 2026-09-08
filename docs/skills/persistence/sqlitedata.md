---
name: sqlitedata
description: SQLiteData (Point-Free) patterns with @Table models, CloudKit sync, and StructuredQueries
skill_type: discipline
version: 3.0.0
---

# SQLiteData

Type-safe SQLite persistence using [SQLiteData](https://github.com/pointfreeco/sqlite-data) by Point-Free. A fast, lightweight replacement for SwiftData with CloudKit synchronization support, built on GRDB and StructuredQueries.

## When to Use This Skill

Use this skill when you're:
- Using SQLiteData with @Table models
- Setting up CloudKit sync with SQLiteData
- Writing queries with @FetchAll, @FetchOne
- Inserting, updating, or deleting records
- Debugging StructuredQueries crashes
- Batch importing data

**Core principle:** Value types (struct) + @Table macro + database.write { } blocks for all mutations.

**Choose SQLiteData when:** Type-safe SQLite, CloudKit sync, large datasets (50k+), Swift 6 strict concurrency.

**Use SwiftData instead when:** Simple CRUD, prefer @Model classes, don't need CloudKit record sharing.

**Use raw GRDB when:** Complex SQL joins across 4+ tables, custom migration logic, performance-critical manual SQL.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I set up a @Table model with custom column types?"
- "My @FetchAll query crashes with 'no such column'. What's wrong?"
- "How do I share data between my app and widget using SQLiteData?"
- "How do I do a bulk insert efficiently?"
- "How do I set up CloudKit sync with SQLiteData?"
- "What's the difference between @FetchAll and @FetchOne?"
- "How do I group my list into sections the way SwiftData does, but in SQL?"
- "My @FetchOne shows the wrong row — I passed the record but it loads a different one."
- "Which SQLiteData package traits should I turn on?"
- "My tests pass but sync is never exercised. What am I missing?"

## What This Skill Provides

### @Table Models
- let for auto primary key (first let = primary key)
- var with defaults = non-nullable
- Optional = nullable
- @Column(as:) for custom representations
- @Ephemeral for non-persisted properties

### Queries
- @FetchAll for array results
- @FetchOne for single value/aggregate, and why single-record observation must be seeded with a statement rather than a record
- where() with keypaths and closures
- order(by:) and limit/offset
- Static helpers: fetchAll, find (v1.4.0+)
- Sectioned results with `sectionBy:` (v1.8.0+) — `ResultsSectionCollection`, `ResultsSection`
- Loading and error state inherited from [Sharing](/skills/persistence/swift-sharing) (`isLoading`, `loadError`)

### Mutations
- insert with Draft pattern
- update single and bulk
- delete single and bulk
- RETURNING clause for inserted values

### CloudKit Sync
- SyncEngine configuration
- prepareDependencies setup
- Record sharing, with per-record database resolution (v1.11.1+)
- Previewable sharing UI — `CloudSharingView` mocks in previews and tests (v1.5.0+)

### Package Traits
- Six traits — CasePaths, Tagged, ColumnCoding, LazyInitializableByDefault, StrictDecoding, SuppressPlatformSQLiteAvailability — plus `SQLiteDataTagged`, a deprecated alias for `Tagged`
- Which three become default behavior in the next major release

### Testing and Previews
- Context-driven database provisioning (in-memory for previews, temporary pool for tests)
- The sync engine no longer auto-starts under test (v1.5.1+) — `await syncEngine.start()` is required

### Advanced Patterns
- #sql macro for raw SQL
- FTS5 full-text search
- @DatabaseFunction for custom functions

## Key Pattern

### Basic CRUD

```swift
// MODEL
@Table nonisolated struct Item: Identifiable {
    let id: UUID                    // First let = auto primary key
    var title = ""                  // Default = non-nullable
    var notes: String?              // Optional = nullable
    @Ephemeral var isSelected = false  // Not persisted
}

// SETUP
prepareDependencies { $0.defaultDatabase = try! appDatabase() }
@Dependency(\.defaultDatabase) var database

// FETCH
@FetchAll var items: [Item]
@FetchAll(Item.order(by: \.title).where(\.isActive)) var activeItems

// INSERT
try database.write { db in
    try Item.insert { Item.Draft(title: "New") }.execute(db)
}

// UPDATE
try database.write { db in
    try Item.find(id).update { $0.title = #bind("Updated") }.execute(db)
}

// DELETE
try database.write { db in
    try Item.find(id).delete().execute(db)
}
```

### Common Queries

```swift
// Filter
Item.where(\.isActive)                     // Keypath (simple)
Item.where { $0.title.contains("phone") }  // Closure (complex)
Item.where { $0.status.eq(#bind(.done)) }  // Enum comparison

// Sort and paginate
Item.order(by: \.title)                    // Ascending
Item.order { $0.createdAt.desc() }         // Descending
Item.limit(10).offset(20)                  // Pagination
```

## Documentation Scope

This page documents the `axiom-data` skill — SQLiteData patterns Claude uses when you're working with Point-Free's SQLite framework.

**For advanced patterns:** See [sqlitedata-ref](/reference/sqlitedata-ref) for CTEs, views, custom aggregates, schema composition, and TableAlias.

**For raw GRDB:** See [grdb](/skills/persistence/grdb) when you need maximum SQL control.

## Related

- [sqlitedata-ref](/reference/sqlitedata-ref) – Advanced patterns: CTEs, views, aggregates, @Selection
- [grdb](/skills/persistence/grdb) – Raw GRDB for complex queries
- [database-migration](/skills/persistence/database-migration) – Safe schema evolution patterns
- [swift-sharing](/skills/persistence/swift-sharing) – The layer `@FetchAll` and `@FetchOne` are built on; `isLoading`, `loadError`, and custom persistence strategies live there

## Resources

**WWDC**: N/A (third-party framework)

**Docs**: github.com/pointfreeco/sqlite-data, github.com/groue/GRDB.swift
