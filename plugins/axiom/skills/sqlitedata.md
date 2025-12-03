---
name: sqlitedata
description: Use when working with SQLiteData (Point-Free) — @Table models, @FetchAll/@FetchOne queries, database.write with .Draft inserts, .find().update/.delete, CloudKit SyncEngine setup, batch imports, #sql macro, joins, and when to drop to raw GRDB
version: 2.0.0
last_updated: 2025-12-03 — Complete rewrite verified against official repository
---

# SQLiteData

## Overview

Type-safe SQLite persistence using [SQLiteData](https://github.com/pointfreeco/sqlite-data) by Point-Free. A fast, lightweight replacement for SwiftData with CloudKit synchronization support, built on [GRDB](https://github.com/groue/GRDB.swift) and [StructuredQueries](https://github.com/pointfreeco/swift-structured-queries).

**Core principle:** Value types (`struct`) + `@Table` macro + `database.write { }` blocks for all mutations.

**Requires:** iOS 17+, Swift 6 strict concurrency
**License:** MIT

## When to Use SQLiteData

**Choose SQLiteData when you need**
- Type-safe SQLite with compiler-checked queries
- CloudKit sync with record sharing
- Large datasets (50k+ records) with near-raw-SQLite performance
- Value types (structs) instead of classes
- Swift 6 strict concurrency support

**Use SwiftData instead when**
- Simple CRUD with native Apple integration
- Prefer `@Model` classes over structs
- Don't need CloudKit record sharing

**Use raw GRDB when**
- Complex SQL joins across 4+ tables
- Custom migration logic beyond schema changes
- Performance-critical operations needing manual SQL

---

## @Table Model Definitions

### Basic Table

```swift
import SQLiteData

@Table
nonisolated struct Item: Identifiable {
    let id: UUID           // First `let` = auto primary key
    var title = ""
    var isInStock = true
    var notes = ""
}
```

**Key patterns:**
- Use `struct`, not `class` (value types)
- Add `nonisolated` for Swift 6 concurrency
- First `let` property is automatically the primary key
- Use defaults (`= ""`, `= true`) for non-nullable columns
- Optional properties (`String?`) map to nullable SQL columns

### Custom Primary Key

```swift
@Table
nonisolated struct Tag: Hashable, Identifiable {
    @Column(primaryKey: true)
    var title: String      // Custom primary key
    var id: String { title }
}
```

### Column Customization

```swift
@Table
nonisolated struct RemindersList: Hashable, Identifiable {
    let id: UUID

    @Column(as: Color.HexRepresentation.self)  // Custom type representation
    var color: Color = .blue

    var position = 0
    var title = ""
}
```

### Foreign Keys

```swift
@Table
nonisolated struct Reminder: Hashable, Identifiable {
    let id: UUID
    var title = ""
    var remindersListID: RemindersList.ID  // Foreign key (explicit column)
}

@Table
nonisolated struct Attendee: Hashable, Identifiable {
    let id: UUID
    var name = ""
    var syncUpID: SyncUp.ID  // References parent
}
```

**Note:** SQLiteData uses explicit foreign key columns. Relationships are expressed through joins, not `@Relationship` macros.

---

## Database Setup

### App Entry Point

```swift
import SQLiteData

@main
struct MyApp: App {
    init() {
        prepareDependencies {
            $0.defaultDatabase = try! appDatabase()
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

func appDatabase() throws -> any DatabaseWriter {
    let database = try SQLiteData.defaultDatabase()

    var migrator = DatabaseMigrator()
    #if DEBUG
    migrator.eraseDatabaseOnSchemaChange = true
    #endif

    migrator.registerMigration("Create initial tables") { db in
        try #sql(
            """
            CREATE TABLE "items" (
                "id" TEXT PRIMARY KEY NOT NULL DEFAULT (uuid()),
                "title" TEXT NOT NULL DEFAULT '',
                "isInStock" INTEGER NOT NULL DEFAULT 1,
                "notes" TEXT NOT NULL DEFAULT ''
            ) STRICT
            """
        )
        .execute(db)
    }

    try migrator.migrate(database)
    return database
}
```

### Accessing the Database

```swift
struct ContentView: View {
    @Dependency(\.defaultDatabase) var database

    func addItem() {
        try database.write { db in
            try Item.insert { Item.Draft(title: "New Item") }
                .execute(db)
        }
    }
}
```

---

## Query Patterns

### @FetchAll — Fetch Collections

```swift
// Fetch all items
@FetchAll var items: [Item]

// With ordering
@FetchAll(Item.order(by: \.title))
var items

// With filtering (keypath style)
@FetchAll(Item.where(\.isInStock))
var items

// With animation
@FetchAll(Item.order { $0.id.desc() }, animation: .default)
var items
```

### @FetchOne — Fetch Single Values

```swift
// Count without loading all records
@FetchOne(Item.count())
var itemsCount = 0

// Single record (optional)
@FetchOne(Item.where(\.isInStock).limit(1))
var firstInStock: Item?
```

### @Fetch — Custom Multi-Query Transactions

```swift
@Fetch(ItemStats(), animation: .default)
private var stats = ItemStats.Value()

struct ItemStats: FetchKeyRequest {
    struct Value {
        var items: [Item] = []
        var count = 0
        var inStockCount = 0
    }

    func fetch(_ db: Database) throws -> Value {
        try Value(
            items: Item.order { $0.title }.fetchAll(db),
            count: Item.fetchCount(db),
            inStockCount: Item.where(\.isInStock).fetchCount(db)
        )
    }
}
```

### Filtering (Closure Style)

```swift
// Simple predicate
let results = try Fact
    .where { $0.body.contains(searchQuery) }
    .fetchAll(db)

// Comparison methods
let pending = try Reminder
    .where { $0.status.eq(#bind(.incomplete)) }
    .fetchAll(db)

// Multiple IDs
let selected = try Item
    .where { $0.id.in(selectedIds) }
    .fetchAll(db)

// Boolean negation
let incomplete = try Reminder
    .where { !$0.isCompleted }
    .fetchAll(db)
```

### Ordering

```swift
// Keypath style
Item.order(by: \.title)

// Closure style with direction
Item.order { $0.id.desc() }
Item.order { $0.title.asc() }
```

### Dynamic Queries

```swift
struct ContentView: View {
    @Fetch(Search(), animation: .default)
    private var results = Search.Value()

    @State var query = ""

    var body: some View {
        List { /* ... */ }
            .searchable(text: $query)
            .task(id: query) {
                try await $results.load(Search(query: query), animation: .default)
            }
    }
}

struct Search: FetchKeyRequest {
    var query = ""
    struct Value { var items: [Item] = [] }

    func fetch(_ db: Database) throws -> Value {
        let search = Item
            .where { $0.title.contains(query) }
            .order { $0.title }
        return try Value(items: search.fetchAll(db))
    }
}
```

---

## Insert / Update / Delete

### Insert — Uses .Draft Type

```swift
@Dependency(\.defaultDatabase) var database

func addItem(title: String) {
    withErrorReporting {
        try database.write { db in
            try Item.insert {
                Item.Draft(title: title, isInStock: true)
            }
            .execute(db)
        }
    }
}
```

**Critical:** The `@Table` macro generates a `.Draft` nested type for inserts. Use `Item.Draft(...)` not `Item(...)`.

### Insert with Conflict Handling

```swift
try database.write { db in
    try Tag.insert(or: .ignore) {
        Tag(title: "existing-tag")
    }
    .execute(db)
}
```

### Update — Single Record with .find()

```swift
func incrementCounter(_ counter: Counter) {
    withErrorReporting {
        try database.write { db in
            try Counter.find(counter.id).update {
                $0.count += 1
            }
            .execute(db)
        }
    }
}

func updateTitle(_ item: Item, newTitle: String) {
    try database.write { db in
        try Item.find(item.id).update {
            $0.title = newTitle
        }
        .execute(db)
    }
}
```

### Update — Bulk with .where().update()

```swift
// Mark all completing reminders as completed
try database.write { db in
    try Reminder
        .where { $0.status.eq(#bind(.completing)) }
        .update { $0.status = .completed }
        .execute(db)
}
```

**Note:** For bulk updates, `.where()` comes BEFORE `.update()`.

### Delete — Single Record

```swift
func deleteItem(_ item: Item) {
    try database.write { db in
        try Item.find(item.id).delete().execute(db)
    }
}
```

### Delete — Bulk

```swift
func deleteItems(at indices: IndexSet) {
    try database.write { db in
        let ids = indices.map { items[$0].id }
        try Item
            .where { $0.id.in(ids) }
            .delete()
            .execute(db)
    }
}
```

---

## Batch Operations

### Batch Insert (Large Datasets)

For 50k+ records, batch within transactions:

```swift
func importItems(_ items: [Item.Draft]) async throws {
    let batchSize = 500

    for batch in items.chunked(into: batchSize) {
        try await database.write { db in
            for item in batch {
                try Item.insert { item }.execute(db)
            }
        }
    }
}

extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
```

**Performance:**
| Pattern | Transactions | Time (50k records) |
|---------|--------------|-------------------|
| One-by-one | 50,000 | ~4 hours |
| Batched (500) | 100 | ~45 seconds |
| Single transaction | 1 | ~20 seconds (risky) |

**Recommendation:** Use batch size 500 for resilience. Single transaction is faster but rolls back entirely on any failure.

---

## CloudKit Sync

### Basic Setup

```swift
@main
struct MyApp: App {
    init() {
        prepareDependencies {
            $0.defaultDatabase = try! appDatabase()
            $0.defaultSyncEngine = try SyncEngine(
                for: $0.defaultDatabase,
                tables: Item.self, Category.self
            )
        }
    }
}
```

### With Multiple Tables

```swift
prepareDependencies {
    $0.defaultDatabase = try! appDatabase()
    $0.defaultSyncEngine = try SyncEngine(
        for: $0.defaultDatabase,
        tables: SyncUp.self,
                Attendee.self,
                Meeting.self
    )
}
```

### With Delegate

```swift
prepareDependencies {
    $0.defaultDatabase = try! appDatabase()
    $0.defaultSyncEngine = try SyncEngine(
        for: $0.defaultDatabase,
        tables: RemindersList.self,
                Reminder.self,
                Tag.self,
        delegate: mySyncEngineDelegate
    )
}
```

### Sharing Records

```swift
@Dependency(\.defaultSyncEngine) var syncEngine

func shareItem(_ item: Item) async throws -> SharedRecord {
    try await syncEngine.share(record: item) { share in
        share[CKShare.SystemFieldKey.title] = "Join my list!"
    }
}
```

---

## Raw SQL with #sql Macro

### Create Tables

```swift
migrator.registerMigration("Create tables") { db in
    try #sql(
        """
        CREATE TABLE "reminders" (
            "id" TEXT PRIMARY KEY NOT NULL DEFAULT (uuid()),
            "title" TEXT NOT NULL DEFAULT '',
            "dueDate" TEXT,
            "priority" INTEGER,
            "remindersListID" TEXT NOT NULL
                REFERENCES "remindersLists"("id") ON DELETE CASCADE
        ) STRICT
        """
    )
    .execute(db)
}
```

### Create Indexes

```swift
migrator.registerMigration("Create indexes") { db in
    try #sql(
        """
        CREATE INDEX IF NOT EXISTS "idx_reminders_listID"
        ON "reminders"("remindersListID")
        """
    )
    .execute(db)
}
```

### Inline SQL in Queries

```swift
nonisolated extension Reminder.TableColumns {
    var isPastDue: some QueryExpression<Bool> {
        @Dependency(\.date.now) var now
        return !isCompleted && #sql("coalesce(date(\(dueDate)) < date(\(now)), 0)")
    }
}
```

---

## Advanced Patterns

### Joins

```swift
extension Reminder {
    static let withTags = group(by: \.id)
        .leftJoin(ReminderTag.all) { $0.id.eq($1.reminderID) }
        .leftJoin(Tag.all) { $1.tagID.eq($2.primaryKey) }
}
```

### Full-Text Search (FTS5)

```swift
@Table
struct ReminderText: FTS5 {
    let rowid: Int
    let title: String
    let notes: String
    let tags: String
}

// Create FTS table in migration
try #sql(
    """
    CREATE VIRTUAL TABLE "reminderTexts" USING fts5(
        "title", "notes", "tags",
        tokenize = 'trigram'
    )
    """
)
.execute(db)
```

### Database Triggers

```swift
try database.write { db in
    try Reminder.createTemporaryTrigger(
        after: .insert { new in
            Reminder
                .find(new.id)
                .update {
                    $0.position = Reminder.select { ($0.position.max() ?? -1) + 1 }
                }
        }
    )
    .execute(db)
}
```

### Custom Update Logic

```swift
extension Updates<Reminder> {
    mutating func toggleStatus() {
        self.status = Case(self.status)
            .when(#bind(.incomplete), then: #bind(.completing))
            .else(#bind(.incomplete))
    }
}

// Usage
try Reminder.find(reminder.id).update { $0.toggleStatus() }.execute(db)
```

### Enum Support

```swift
enum Priority: Int, QueryBindable {
    case low = 1
    case medium = 2
    case high = 3
}

enum Status: Int, QueryBindable {
    case incomplete = 0
    case completing = 1
    case completed = 2
}

@Table
nonisolated struct Reminder: Identifiable {
    let id: UUID
    var priority: Priority?
    var status: Status = .incomplete
}
```

---

## When to Drop to GRDB

Use raw GRDB for complex operations SQLiteData doesn't cover:

### Complex Multi-Table Joins

```swift
import GRDB

let sql = """
    SELECT r.*, l.title as listTitle, COUNT(t.tagID) as tagCount
    FROM reminders r
    JOIN remindersLists l ON r.remindersListID = l.id
    LEFT JOIN remindersTags t ON r.id = t.reminderID
    WHERE l.title = ?
    GROUP BY r.id
    """

let results = try database.read { db in
    try Row.fetchAll(db, sql: sql, arguments: ["Personal"])
}
```

### ValueObservation (Reactive)

```swift
import GRDB

let observation = ValueObservation.tracking { db in
    try Item.fetchAll(db)
}

let cancellable = observation.start(in: database) { error in
    print("Error: \(error)")
} onChange: { items in
    print("Items updated: \(items.count)")
}
```

---

## Common Mistakes

### Using instance methods for insert
```swift
// WRONG — won't compile
let item = Item(id: UUID(), title: "Test")
try item.insert(db)

// CORRECT — use .Draft with static insert
try Item.insert { Item.Draft(title: "Test") }.execute(db)
```

### Wrong update order
```swift
// WRONG — .update before .where
try Item.update { $0.title = "New" }.where { $0.id == id }.execute(db)

// CORRECT — .find for single record
try Item.find(id).update { $0.title = "New" }.execute(db)

// CORRECT — .where before .update for bulk
try Item.where { $0.isInStock }.update { $0.notes = "" }.execute(db)
```

### Using == instead of .eq()
```swift
// WRONG — may not work in all contexts
.where { $0.status == .completed }

// CORRECT — use comparison methods
.where { $0.status.eq(#bind(.completed)) }
```

### Missing nonisolated
```swift
// WRONG — Swift 6 concurrency warning
@Table
struct Item: Identifiable { ... }

// CORRECT — add nonisolated
@Table
nonisolated struct Item: Identifiable { ... }
```

### Awaiting database.write
```swift
// WRONG — write block is synchronous inside
try await database.write { db in ... }

// CORRECT — await outside, sync inside
try database.write { db in
    try Item.insert { Item.Draft(...) }.execute(db)
}
```

---

## Comparison: SQLiteData vs SwiftData

| Feature | SQLiteData | SwiftData |
|---------|-----------|-----------|
| **Type** | Value types (struct) | Reference types (class) |
| **Macro** | `@Table` | `@Model` |
| **Queries** | `@FetchAll` / `@FetchOne` | `@Query` |
| **Access** | `@Dependency(\.defaultDatabase)` | `@Environment(\.modelContext)` |
| **Insert** | `Item.insert { .Draft(...) }` | `context.insert(item)` |
| **CloudKit** | Full sync + sharing | Sync only (no sharing) |
| **Performance** | Near raw SQLite | Core Data overhead |

---

## Quick Reference

```swift
// Setup
prepareDependencies { $0.defaultDatabase = try! appDatabase() }
@Dependency(\.defaultDatabase) var database

// Fetch
@FetchAll var items: [Item]
@FetchAll(Item.order(by: \.title)) var items
@FetchOne(Item.count()) var count = 0

// Insert
try database.write { db in
    try Item.insert { Item.Draft(title: "New") }.execute(db)
}

// Update single
try database.write { db in
    try Item.find(id).update { $0.title = "Updated" }.execute(db)
}

// Update bulk
try database.write { db in
    try Item.where(\.isInStock).update { $0.notes = "" }.execute(db)
}

// Delete
try database.write { db in
    try Item.find(id).delete().execute(db)
}

// Delete bulk
try database.write { db in
    try Item.where { $0.id.in(ids) }.delete().execute(db)
}

// CloudKit
prepareDependencies {
    $0.defaultSyncEngine = try SyncEngine(for: $0.defaultDatabase, tables: Item.self)
}
```

---

## External Resources

- [SQLiteData Documentation](https://swiftpackageindex.com/pointfreeco/sqlite-data/documentation/sqlitedata)
- [SQLiteData GitHub](https://github.com/pointfreeco/sqlite-data)
- [StructuredQueries](https://github.com/pointfreeco/swift-structured-queries) — Query building library
- [GRDB](https://github.com/groue/GRDB.swift) — Underlying SQLite wrapper
- [Point-Free Episodes](https://www.pointfree.co) — Video tutorials (subscription)

**Related Axiom Skills:**
- `database-migration` — Safe schema evolution patterns
- `grdb` — Raw SQL and advanced GRDB features
- `swiftdata` — Apple's native persistence framework

---

## Version History

- **2.0.0**: Complete rewrite verified against official pointfreeco/sqlite-data repository. Fixed 15 major inaccuracies: @Column not @Attribute, .Draft insert pattern, .find() for updates/deletes, prepareDependencies setup, SyncEngine CloudKit config, @FetchAll without generics, .eq() comparison methods. Added 8 missing features: @Fetch, #sql macro, nonisolated, joins, FTS5, triggers, enum support, custom update logic.
- **1.1.0**: Added production crisis section (retained concepts, updated syntax)
- **1.0.0**: Initial skill (contained significant API inaccuracies)

---

**Created:** 2025-11-28
**Rewritten:** 2025-12-03
**Targets:** iOS 17+, Swift 6
**Framework:** SQLiteData 1.0+ (Point-Free)
