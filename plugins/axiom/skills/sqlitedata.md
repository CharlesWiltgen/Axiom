---
name: sqlitedata
description: Use when working with SQLiteData (Point-Free) — @Table models, @FetchAll/@FetchOne queries, database.write with .Draft inserts, .find().update/.delete, CloudKit SyncEngine setup, batch imports, #sql macro, joins, @Selection for custom query results, database views with createTemporaryView, @DatabaseFunction custom aggregates, and when to drop to raw GRDB
version: 2.3.0
last_updated: 2025-12-03 — Added Custom Aggregate Functions section
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

## Migrating from SwiftData

### When to Switch

```
┌─────────────────────────────────────────────────────────┐
│ Should I switch from SwiftData to SQLiteData?           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Performance problems with 10k+ records?                │
│    YES → SQLiteData (10-50x faster for large datasets)  │
│                                                         │
│  Need CloudKit record SHARING (not just sync)?          │
│    YES → SQLiteData (SwiftData cannot share records)    │
│                                                         │
│  Complex queries across multiple tables?                │
│    YES → SQLiteData + raw GRDB when needed              │
│                                                         │
│  Need Sendable models for Swift 6 concurrency?          │
│    YES → SQLiteData (value types, not classes)          │
│                                                         │
│  Testing @Model classes is painful?                     │
│    YES → SQLiteData (pure structs, easy to mock)        │
│                                                         │
│  Happy with SwiftData for simple CRUD?                  │
│    YES → Stay with SwiftData (simpler for basic apps)   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Pattern-by-Pattern Equivalents

| SwiftData | SQLiteData |
|-----------|------------|
| `@Model class Item` | `@Table nonisolated struct Item` |
| `@Attribute(.unique)` | `@Column(primaryKey: true)` or SQL UNIQUE |
| `@Relationship var tags: [Tag]` | `var tagIDs: [Tag.ID]` + join query |
| `@Query var items: [Item]` | `@FetchAll var items: [Item]` |
| `@Query(sort: \.title)` | `@FetchAll(Item.order(by: \.title))` |
| `@Query(filter: #Predicate { $0.isActive })` | `@FetchAll(Item.where(\.isActive))` |
| `@Environment(\.modelContext)` | `@Dependency(\.defaultDatabase)` |
| `context.insert(item)` | `Item.insert { Item.Draft(...) }.execute(db)` |
| `context.delete(item)` | `Item.find(id).delete().execute(db)` |
| `try context.save()` | Automatic in `database.write { }` block |
| `ModelContainer(for:)` | `prepareDependencies { $0.defaultDatabase = }` |

### Code Migration Example

**SwiftData (Before)**

```swift
import SwiftData

@Model
class Task {
    var id: UUID
    var title: String
    var isCompleted: Bool
    var project: Project?

    init(title: String) {
        self.id = UUID()
        self.title = title
        self.isCompleted = false
    }
}

struct TaskListView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \.title) private var tasks: [Task]

    var body: some View {
        List(tasks) { task in
            Text(task.title)
        }
    }

    func addTask(_ title: String) {
        let task = Task(title: title)
        context.insert(task)
    }

    func deleteTask(_ task: Task) {
        context.delete(task)
    }
}
```

**SQLiteData (After)**

```swift
import SQLiteData

@Table
nonisolated struct Task: Identifiable {
    let id: UUID
    var title = ""
    var isCompleted = false
    var projectID: Project.ID?
}

struct TaskListView: View {
    @Dependency(\.defaultDatabase) var database
    @FetchAll(Task.order(by: \.title)) var tasks

    var body: some View {
        List(tasks) { task in
            Text(task.title)
        }
    }

    func addTask(_ title: String) {
        try database.write { db in
            try Task.insert {
                Task.Draft(title: title)
            }
            .execute(db)
        }
    }

    func deleteTask(_ task: Task) {
        try database.write { db in
            try Task.find(task.id).delete().execute(db)
        }
    }
}
```

**Key Differences:**
- `class` → `struct` with `nonisolated`
- `@Model` → `@Table`
- `@Query` → `@FetchAll`
- `@Environment(\.modelContext)` → `@Dependency(\.defaultDatabase)`
- Implicit save → Explicit `database.write { }` block
- Direct init → `.Draft` type for inserts
- `@Relationship` → Explicit foreign key column + join

### CloudKit Sharing (SwiftData Can't Do This)

SwiftData supports CloudKit **sync** but NOT **sharing**. If you need users to share records with each other, SQLiteData is your only Apple-native option.

```swift
// 1. Setup SyncEngine with sharing support
prepareDependencies {
    $0.defaultDatabase = try! appDatabase()
    $0.defaultSyncEngine = try SyncEngine(
        for: $0.defaultDatabase,
        tables: Task.self, Project.self
    )
}

// 2. Share a record
@Dependency(\.defaultSyncEngine) var syncEngine
@State var sharedRecord: SharedRecord?

func shareProject(_ project: Project) async throws {
    sharedRecord = try await syncEngine.share(record: project) { share in
        share[CKShare.SystemFieldKey.title] = "Join my project!"
        share[CKShare.SystemFieldKey.shareType] = "Project"
    }
}

// 3. Present native sharing UI
.sheet(item: $sharedRecord) { record in
    CloudSharingView(sharedRecord: record)
}

// 4. Handle incoming shares (in App)
.onContinueUserActivity(CKShare.recordType) { activity in
    // User tapped share link
}

// 5. Delete local data when removing shared access
func leaveShare() async throws {
    try await syncEngine.deleteLocalData()
}
```

**Sharing enables:**
- Collaborative lists (shopping, reminders, projects)
- Shared workspaces with permissions
- Family sharing of app data
- Team collaboration features

### Performance Comparison

| Operation | SwiftData | SQLiteData | Improvement |
|-----------|-----------|------------|-------------|
| Insert 50k records | ~4 minutes | ~45 seconds | **5x faster** |
| Query 10k with predicate | ~2 seconds | ~50ms | **40x faster** |
| Memory (10k objects) | ~80MB (classes) | ~20MB (structs) | **4x smaller** |
| Cold launch (large DB) | ~3 seconds | ~200ms | **15x faster** |
| Complex join query | N+1 trap common | Single SQL query | **Orders of magnitude** |

*Benchmarks approximate, vary by device and data shape.*

### Gradual Migration Strategy

You don't have to migrate everything at once:

```swift
// 1. Add SQLiteData for new high-performance features
// Keep SwiftData for existing simple CRUD

// 2. Migrate one model at a time
// Start with the performance bottleneck

// 3. Use separate databases initially
// SQLiteData: heavy data, sharing
// SwiftData: user preferences, simple state

// 4. Eventually consolidate if needed
// Or keep hybrid if it works
```

### Migration Gotchas

**Watch out for:**

1. **Relationships → Foreign Keys**
   ```swift
   // SwiftData: implicit relationship
   @Relationship var tasks: [Task]

   // SQLiteData: explicit column + query
   // In parent: nothing special
   // In child: var projectID: Project.ID
   // To fetch: Task.where { $0.projectID == project.id }
   ```

2. **Optional Handling**
   ```swift
   // SwiftData: optionals just work
   var dueDate: Date?

   // SQLiteData: optionals map to nullable SQL columns (same)
   var dueDate: Date?  // Works the same
   ```

3. **Cascade Deletes**
   ```swift
   // SwiftData: @Relationship(deleteRule: .cascade)

   // SQLiteData: Define in SQL schema
   // "REFERENCES parent(id) ON DELETE CASCADE"
   ```

4. **No Automatic Inverse**
   ```swift
   // SwiftData: @Relationship(inverse: \Task.project)

   // SQLiteData: Query both directions manually
   let tasks = Task.where { $0.projectID == project.id }
   let project = Project.find(task.projectID)
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

## Database Views

SQLiteData provides type-safe, schema-safe wrappers around [SQLite Views](https://www.sqlite.org/lang_createview.html) — pre-packaged SELECT statements that can be queried like tables.

### Understanding @Selection

The `@Selection` macro defines custom query result types. Use it for:

1. **Custom query results** — Shape data from joins without a view
2. **Combined with `@Table`** — Define a view-backed type

#### @Selection for Custom Query Results

```swift
// Define a custom result shape for a join query
@Selection
struct ReminderWithList: Identifiable {
    var id: Reminder.ID { reminder.id }
    let reminder: Reminder
    let remindersList: RemindersList
    let isPastDue: Bool
    let tags: String
}

// Use in a join query
@FetchAll(
    Reminder
        .join(RemindersList.all) { $0.remindersListID.eq($1.id) }
        .select {
            ReminderWithList.Columns(
                reminder: $0,
                remindersList: $1,
                isPastDue: $0.isPastDue,
                tags: ""  // computed elsewhere
            )
        }
)
var reminders: [ReminderWithList]
```

**Key insight:** `@Selection` generates a `.Columns` type for use in `.select { }` closures, providing compile-time verification that your query results match your Swift type.

#### @Selection for Aggregate Queries

```swift
@Selection
struct Stats {
    var allCount = 0
    var flaggedCount = 0
    var scheduledCount = 0
    var todayCount = 0
}

// Single query returns all stats
@FetchOne(
    Reminder.select {
        Stats.Columns(
            allCount: $0.count(filter: !$0.isCompleted),
            flaggedCount: $0.count(filter: $0.isFlagged && !$0.isCompleted),
            scheduledCount: $0.count(filter: $0.isScheduled),
            todayCount: $0.count(filter: $0.isToday)
        )
    }
)
var stats = Stats()
```

### Creating Temporary Views

For complex queries you'll reuse, create an actual SQLite view using `@Table @Selection` together:

```swift
// 1. Define the view type with BOTH macros
@Table @Selection
private struct ReminderWithList {
    let reminderTitle: String
    let remindersListTitle: String
}

// 2. Create the temporary view
try database.write { db in
    try ReminderWithList.createTemporaryView(
        as: Reminder
            .join(RemindersList.all) { $0.remindersListID.eq($1.id) }
            .select {
                ReminderWithList.Columns(
                    reminderTitle: $0.title,
                    remindersListTitle: $1.title
                )
            }
    )
    .execute(db)
}
```

**Generated SQL:**
```sql
CREATE TEMPORARY VIEW "reminderWithLists"
("reminderTitle", "remindersListTitle")
AS
SELECT
  "reminders"."title",
  "remindersLists"."title"
FROM "reminders"
JOIN "remindersLists"
  ON "reminders"."remindersListID" = "remindersLists"."id"
```

#### Querying Views

Once created, query the view like any table — the JOIN is hidden:

```swift
// The join complexity is encapsulated in the view
let results = try ReminderWithList
    .order { ($0.remindersListTitle, $0.reminderTitle) }
    .limit(10)
    .fetchAll(db)
```

**Generated SQL:**
```sql
SELECT "reminderWithLists"."reminderTitle",
       "reminderWithLists"."remindersListTitle"
FROM "reminderWithLists"
ORDER BY "reminderWithLists"."remindersListTitle",
         "reminderWithLists"."reminderTitle"
LIMIT 10
```

### Updatable Views with INSTEAD OF Triggers

SQLite views are read-only by default. To enable INSERT/UPDATE/DELETE, use `INSTEAD OF` triggers that reroute operations to the underlying tables:

```swift
// Enable inserts on the view
try database.write { db in
    try ReminderWithList.createTemporaryTrigger(
        insteadOf: .insert { new in
            // Reroute insert to actual tables
            Reminder.insert {
                ($0.title, $0.remindersListID)
            } values: {
                (
                    new.reminderTitle,
                    // Find existing list by title
                    RemindersList
                        .select(\.id)
                        .where { $0.title.eq(new.remindersListTitle) }
                )
            }
        }
    )
    .execute(db)
}

// Now you can insert into the view!
try ReminderWithList.insert {
    ReminderWithList(
        reminderTitle: "Morning sync",
        remindersListTitle: "Business"  // Must match existing list
    )
}
.execute(db)
```

**Key concepts:**
- `INSTEAD OF` triggers intercept operations on the view
- You define how to reroute to the real tables
- The rerouting logic is application-specific (create new? find existing? fail?)

### When to Use Views vs @Selection

| Use Case | Approach |
|----------|----------|
| One-off join query | `@Selection` only |
| Reusable complex query | `@Table @Selection` + `createTemporaryView` |
| Need to insert/update via view | Add `createTemporaryTrigger(insteadOf:)` |
| Simple aggregates | `@Selection` with `.select { }` |
| Hide join complexity from callers | Temporary view |

### Temporary vs Permanent Views

SQLiteData creates **temporary** views that exist only for the database connection lifetime:

```swift
// Temporary view — gone when connection closes
ReminderWithList.createTemporaryView(as: ...)

// For permanent views, use raw SQL in migrations
migrator.registerMigration("Create view") { db in
    try #sql(
        """
        CREATE VIEW "reminderWithLists" AS
        SELECT r.title as reminderTitle, l.title as remindersListTitle
        FROM reminders r
        JOIN remindersLists l ON r.remindersListID = l.id
        """
    )
    .execute(db)
}
```

**When to use permanent views:**
- Query is used across app restarts
- View definition rarely changes
- Performance benefit from persistent query plan

**When to use temporary views:**
- Query varies by runtime conditions
- Testing different view definitions
- View needs to be dropped/recreated dynamically

---

## Custom Aggregate Functions

SQLiteData lets you write complex aggregation logic in Swift using the `@DatabaseFunction` macro, then invoke it directly from SQL queries. This avoids contorted SQL subqueries for operations like mode, median, or custom statistics.

### Defining a Custom Aggregate

```swift
import StructuredQueries

// 1. Define the function with @DatabaseFunction macro
@DatabaseFunction
func mode(priority priorities: some Sequence<Reminder.Priority?>) -> Reminder.Priority? {
    var occurrences: [Reminder.Priority: Int] = [:]
    for priority in priorities {
        guard let priority else { continue }
        occurrences[priority, default: 0] += 1
    }
    return occurrences.max { $0.value < $1.value }?.key
}
```

**Key points:**
- Takes `some Sequence<T?>` as input (receives all values from the grouped rows)
- Returns the aggregated result
- The macro generates a `$mode` function for use in queries

### Registering the Function

Add the function to your database configuration:

```swift
func appDatabase() throws -> any DatabaseWriter {
    var configuration = Configuration()
    configuration.prepareDatabase { db in
        db.add(function: $mode)  // Register the $mode function
    }

    let database = try DatabaseQueue(configuration: configuration)
    // ... migrations
    return database
}
```

### Using in Queries

Once registered, invoke with `$functionName(arg: $column)`:

```swift
// Find the most common priority per reminders list
let results = try RemindersList
    .group(by: \.id)
    .leftJoin(Reminder.all) { $0.id.eq($1.remindersListID) }
    .select { ($0.title, $mode(priority: $1.priority)) }
    .fetchAll(db)
```

**Without custom aggregate (raw SQL):**
```sql
-- This messy subquery is what @DatabaseFunction replaces
SELECT
  remindersLists.title,
  (
    SELECT reminders.priority
    FROM reminders
    WHERE reminders.remindersListID = remindersLists.id
      AND reminders.priority IS NOT NULL
    GROUP BY reminders.priority
    ORDER BY count(*) DESC
    LIMIT 1
  )
FROM remindersLists;
```

### Common Use Cases

| Aggregate | Description |
|-----------|-------------|
| Mode | Most frequently occurring value |
| Median | Middle value in sorted sequence |
| Weighted average | Average with per-row weights |
| Custom filtering | Complex conditional aggregation |
| String concatenation | Join strings with custom logic |

### Example: Median Function

```swift
@DatabaseFunction
func median(values: some Sequence<Double?>) -> Double? {
    let sorted = values.compactMap { $0 }.sorted()
    guard !sorted.isEmpty else { return nil }

    let mid = sorted.count / 2
    if sorted.count.isMultiple(of: 2) {
        return (sorted[mid - 1] + sorted[mid]) / 2
    } else {
        return sorted[mid]
    }
}

// Register
configuration.prepareDatabase { db in
    db.add(function: $median)
}

// Use
let medianPrices = try Product
    .group(by: \.categoryID)
    .select { ($0.categoryID, $median(values: $0.price)) }
    .fetchAll(db)
```

### Performance Considerations

- **Swift execution:** The function runs in Swift, not SQLite's C engine
- **Row iteration:** All grouped values are passed to your function
- **Memory:** Large groups load all values into memory
- **Use sparingly:** Best for complex logic that's awkward in SQL; use built-in aggregates (`count`, `sum`, `avg`, `min`, `max`) when possible

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

- **2.3.0**: Added "Custom Aggregate Functions" section covering `@DatabaseFunction` macro, function registration with `db.add(function:)`, using custom aggregates in queries, mode/median examples, and performance considerations.
- **2.2.0**: Added comprehensive "Database Views" section covering `@Selection` macro for custom query results, `@Table @Selection` for view-backed types, `createTemporaryView` for SQLite views, `INSTEAD OF` triggers for updatable views, decision guide for views vs @Selection, and temporary vs permanent view patterns.
- **2.1.0**: Added comprehensive "Migrating from SwiftData" section — decision guide, pattern-by-pattern equivalents, full code migration example, CloudKit sharing deep dive (SwiftData's missing feature), performance benchmarks, gradual migration strategy, and gotchas.
- **2.0.0**: Complete rewrite verified against official pointfreeco/sqlite-data repository. Fixed 15 major inaccuracies: @Column not @Attribute, .Draft insert pattern, .find() for updates/deletes, prepareDependencies setup, SyncEngine CloudKit config, @FetchAll without generics, .eq() comparison methods. Added 8 missing features: @Fetch, #sql macro, nonisolated, joins, FTS5, triggers, enum support, custom update logic.
- **1.1.0**: Added production crisis section (retained concepts, updated syntax)
- **1.0.0**: Initial skill (contained significant API inaccuracies)

---

**Created:** 2025-11-28
**Rewritten:** 2025-12-03
**Targets:** iOS 17+, Swift 6
**Framework:** SQLiteData 1.0+ (Point-Free)
