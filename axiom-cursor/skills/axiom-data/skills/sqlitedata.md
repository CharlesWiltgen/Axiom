
# SQLiteData

## Overview

Type-safe SQLite persistence using SQLiteData (pointfreeco/sqlite-data) by Point-Free. A fast, lightweight replacement for SwiftData with CloudKit synchronization support, built on GRDB (groue/GRDB.swift) and StructuredQueries (pointfreeco/swift-structured-queries).

**Core principle:** Value types (`struct`) + `@Table` macro + `database.write { }` blocks for all mutations.

**For advanced patterns** (CTEs, views, custom aggregates, schema composition), see the `skills/sqlitedata-ref.md` reference skill.

**Requires:** iOS 17+, Swift 6 strict concurrency
**License:** MIT

## When to Use SQLiteData

**Choose SQLiteData when you need:**
- Type-safe SQLite with compiler-checked queries
- CloudKit sync with record sharing
- Large datasets (50k+ records) with near-raw-SQLite performance
- Value types (structs) instead of classes
- Swift 6 strict concurrency support

**Use SwiftData instead when:**
- Simple CRUD with native Apple integration
- Prefer `@Model` classes over structs
- Don't need CloudKit record sharing

**Use raw GRDB when:**
- Complex SQL joins across 4+ tables
- Custom migration logic beyond schema changes
- Performance-critical operations needing manual SQL

---

## Quick Reference

```swift
// MODEL
@Table nonisolated struct Item: Identifiable {
    let id: UUID                    // First let = auto primary key
    var title = ""                  // Default = non-nullable
    var notes: String?              // Optional = nullable
    @Column(as: Color.Hex.self)
    var color: Color = .blue        // Custom representation
    @Ephemeral var isSelected = false  // Not persisted
}

// SETUP
prepareDependencies { $0.defaultDatabase = try! appDatabase() }
@Dependency(\.defaultDatabase) var database

// FETCH
@FetchAll var items: [Item]
@FetchAll(Item.order(by: \.title).where(\.isInStock)) var items
@FetchOne(Item.count()) var count = 0

// FETCH (static helpers - v1.4.0+)
try Item.fetchAll(db)              // vs Item.all.fetchAll(db)
try Item.find(db, key: id)         // returns non-optional Item

// INSERT
try database.write { db in
    try Item.insert { Item.Draft(title: "New") }.execute(db)
}

// UPDATE (single)
try database.write { db in
    try Item.find(id).update { $0.title = #bind("Updated") }.execute(db)
}

// UPDATE (bulk)
try database.write { db in
    try Item.where(\.isInStock).update { $0.notes = #bind("") }.execute(db)
}

// DELETE
try database.write { db in
    try Item.find(id).delete().execute(db)
    try Item.where { $0.id.in(ids) }.delete().execute(db)  // bulk
}

// QUERY
Item.where(\.isActive)                     // Keypath (simple)
Item.where { $0.title.like("%phone%") }    // Closure (complex)
Item.where { $0.status.eq(#bind(.done)) }  // Enum comparison
Item.order(by: \.title)                    // Sort
Item.order { $0.createdAt.desc() }         // Sort descending
Item.limit(10).offset(20)                  // Pagination

// RAW SQL (#sql macro)
#sql("SELECT * FROM items WHERE price > 100")  // Type-safe raw SQL
#sql("coalesce(date(\(dueDate)) = date(\(now)), 0)")  // Custom expressions

// CLOUDKIT (v1.2-1.4+)
prepareDependencies {
    $0.defaultSyncEngine = try SyncEngine(
        for: $0.defaultDatabase,
        tables: Item.self
    )
}
@Dependency(\.defaultSyncEngine) var syncEngine

// Manual sync control (v1.3.0+)
try await syncEngine.fetchChanges()  // Pull from CloudKit
try await syncEngine.sendChanges()   // Push to CloudKit
try await syncEngine.syncChanges()   // Bidirectional

// Sync state observation (v1.2.0+)
syncEngine.isSendingChanges    // true during upload
syncEngine.isFetchingChanges   // true during download
syncEngine.isSynchronizing     // either sending or fetching
```

---

## Anti-Patterns (Common Mistakes)

### ❌ Using `==` in predicates
```swift
// WRONG — removed in StructuredQueries 0.31+ (compiler error)
.where { $0.status == .completed }

// CORRECT — use comparison methods
.where { $0.status.eq(#bind(.completed)) }
```

### ❌ Missing `#bind` in update assignments (StructuredQueries 0.31+)
```swift
// WRONG — compiler error in StructuredQueries 0.31+
Item.find(id).update { $0.title = "New" }.execute(db)

// CORRECT — wrap literal values with #bind
Item.find(id).update { $0.title = #bind("New") }.execute(db)

// NOTE: Compound operators (+=, -=) don't need #bind — they auto-bind
Item.find(id).update { $0.title += "!" }.execute(db)  // OK
```

### ❌ Wrong update order
```swift
// WRONG — .update before .where
Item.update { $0.title = #bind("X") }.where { $0.id.eq(#bind(id)) }

// CORRECT — .find() for single, .where() before .update() for bulk
Item.find(id).update { $0.title = #bind("X") }.execute(db)
Item.where(\.isOld).update { $0.archived = #bind(true) }.execute(db)
```

### ❌ Instance methods for insert
```swift
// WRONG — no instance insert method
let item = Item(id: UUID(), title: "Test")
try item.insert(db)

// CORRECT — static insert with .Draft
try Item.insert { Item.Draft(title: "Test") }.execute(db)
```

### ❌ Missing `nonisolated`
```swift
// WRONG — Swift 6 concurrency warning
@Table struct Item { ... }

// CORRECT
@Table nonisolated struct Item { ... }
```

### ❌ Awaiting inside write block
```swift
// WRONG — write block is synchronous
try await database.write { db in ... }

// CORRECT — no await inside the block
try database.write { db in
    try Item.insert { ... }.execute(db)
}
```

### ❌ Forgetting `.execute(db)`
```swift
// WRONG — builds query but doesn't run it
try database.write { db in
    Item.insert { Item.Draft(title: "X") }  // Does nothing!
}

// CORRECT
try database.write { db in
    try Item.insert { Item.Draft(title: "X") }.execute(db)
}
```

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

### Querying Related Tables (Joins)

**Don't fetch all records and filter in Swift** — push filtering to the database:

```swift
// ❌ Anti-pattern: Fetch all, filter in Swift
let allReminders = try database.read { try Reminder.all.fetch($0) }
let filtered = allReminders.filter { $0.remindersListID == listID }

// ✅ Filter at database level
let filtered = try database.read {
    try Reminder.all
        .filter { $0.remindersListID.eq(#bind(listID)) }
        .fetch($0)
}

// ✅ Join across tables with filtering
let remindersWithList = try database.read {
    try Reminder.all
        .join(RemindersList.all) { $0.remindersListID.eq($1.id) }
        .filter { $1.name.eq(#bind("Shopping")) }
        .fetch($0)
}

// ✅ Left join (include reminders even if no list)
let allWithOptionalList = try database.read {
    try Reminder.all
        .leftJoin(RemindersList.all) { $0.remindersListID.eq($1.id) }
        .fetch($0)
}
```

For complex joins across 4+ tables, drop down to raw GRDB (see `skills/grdb.md`).

### @Ephemeral — Non-Persisted Properties

Mark properties that exist in Swift but not in the database:

```swift
@Table
nonisolated struct Item: Identifiable {
    let id: UUID
    var title = ""
    var price: Decimal = 0

    @Ephemeral
    var isSelected = false  // Not stored in database

    @Ephemeral
    var formattedPrice: String {  // Computed, not stored
        "$\(price)"
    }
}
```

**Use cases:**
- UI state (selection, expansion, hover)
- Computed properties derived from stored columns
- Transient flags for business logic
- Default values for properties not yet in schema

**Important:** `@Ephemeral` properties must have default values since they won't be populated from the database.

---

## Database Setup

### Create Database

```swift
import Dependencies
import SQLiteData
import GRDB

func appDatabase() throws -> any DatabaseWriter {
    var configuration = Configuration()
    configuration.prepareDatabase { db in
        // Configure database behavior
        db.trace { print("SQL: \($0)") }  // Optional SQL logging
    }

    let database = try DatabaseQueue(configuration: configuration)

    var migrator = DatabaseMigrator()

    // Register migrations
    migrator.registerMigration("v1") { db in
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

### Register in Dependencies

```swift
extension DependencyValues {
    var defaultDatabase: any DatabaseWriter {
        get { self[DefaultDatabaseKey.self] }
        set { self[DefaultDatabaseKey.self] = newValue }
    }
}

private enum DefaultDatabaseKey: DependencyKey {
    static let liveValue: any DatabaseWriter = {
        try! appDatabase()
    }()
}

// In app init or @main
prepareDependencies {
    $0.defaultDatabase = try! appDatabase()
}
```

---

## Query Patterns

### Property Wrappers (@FetchAll, @FetchOne)

Both wrap a `SharedReader` from Point-Free's swift-sharing, so `$items.isLoading`, `$items.loadError`, and `try await $items.load(otherQuery)` are available on every fetch. See `skills/swift-sharing.md`.

The primary way to observe database changes in SwiftUI:

```swift
struct ItemsList: View {
    @FetchAll(Item.order(by: \.title)) var items

    var body: some View {
        List(items) { item in
            Text(item.title)
        }
    }
}
```

**Key behaviors:**
- Automatically subscribes to database changes
- Updates when any `Item` changes
- Runs on the main thread
- Cancels observation when view disappears (iOS 17+)

### @FetchOne for Aggregates

```swift
struct StatsView: View {
    @FetchOne(Item.count()) var totalCount = 0
    @FetchOne(Item.where(\.isInStock).count()) var inStockCount = 0

    var body: some View {
        Text("Total: \(totalCount), In Stock: \(inStockCount)")
    }
}
```

### @FetchOne on a Single Record

**Pass a statement, not a record.** The seeded form looks equivalent and is not:

```swift
// ❌ observes the right row at first, then never re-points
@FetchOne var item: Item
init(item: Item) { _item = FetchOne(wrappedValue: item) }

// ✅ re-points whenever the id changes
@FetchOne var item: Item?
init(id: Item.ID) { _item = FetchOne(Item.find(id)) }
```

Three separate causes produce the identical symptom, and upgrading fixes only the first.

**Initial row (fixed in 1.10.0).** Before 1.10.0 the seeded form ignored the value's identity and observed the *first row of the table*. A pair of `PrimaryKeyedTable`-constrained inits now build `.find(Value.PrimaryKey(queryOutput: wrappedValue.primaryKey))`, so the first row rendered is correct.

**Not primary-keyed at all (any version).** The seeded form has two overloads. The `PrimaryKeyedTable` one builds `.find(...)`; the plain `Table` one builds `Value.all.selectStar().asSelect().limit(1)` — **no `WHERE`**, so it renders whatever row SQLite yields first. Overload resolution picks silently. `@Table` conforms `PrimaryKeyedTable` only when it found a key: `isPrimaryKey = primaryKey == nil && identifier.text == "id"`. A table whose key is `reminderID` or `uuid` gets `Table` only and falls to the `LIMIT 1` overload on **every** version. Check it with a one-line probe:

```swift
func _requiresPrimaryKey<T: PrimaryKeyedTable>(_: T.Type) {}
_requiresPrimaryKey(Reminder.self)      // compile error = not primary-keyed
```

Fix the model — rename the key to `id` or mark it `@Column(primaryKey: true)` — since without the conformance you also lose `find`, sync metadata, and CloudKit eligibility (`SyncEngine` requires `each T: PrimaryKeyedTable`).

**Re-pointing (still broken at 1.12.0).** Those two inits assign `sharedReader` directly and never call `setFetchKeyID`, which every statement-taking init does. `FetchBox.update(from:)` opens with `guard let otherFetchKeyID = other.fetchKeyID else { return }`, so with a nil key it bails before adopting the new query. When SwiftUI *reuses* the view's storage rather than creating fresh identity, `init` runs again and builds a new box, but the persisted box keeps observing the original row — live, correct data, wrong record.

That reuse is the common case in exactly the places this pattern is used: a `NavigationSplitView` detail column as `selection` changes, a sheet driven by separately-tracked state, re-entry into a `navigationDestination`. Push/pop with distinct identities looks fine, which is why it reads as intermittent.

Prefer `Item?` too — the non-optional request throws `NotFound` when the row is deleted out from under an open detail view, leaving a `loadError` and a frozen copy of a row that no longer exists.

For a view whose id can change without `init` re-running, reload explicitly:

```swift
.task(id: itemID) { try? await $item.load(Item.find(itemID)) }
```

### Sectioned Results (v1.8.0+)

`sectionBy:` groups rows in the database rather than in Swift, so section boundaries are computed by SQL and stay correct as rows change:

```swift
@FetchAll(Reminder.order(by: \.title), sectionBy: \.category)
var reminders

var body: some View {
    List {
        ForEach($reminders.sections) { section in
            Section(section.name ?? "Uncategorized") {
                ForEach(section) { reminder in Text(reminder.title) }
            }
        }
    }
}
```

`$reminders.sections` is a `ResultsSectionCollection<Reminder, String?>` — a `RandomAccessCollection` of `ResultsSection`, each `Identifiable` by its `name`. The collection also offers `sectionNames`, `subscript(sectionName:)`, `contains(sectionName:)`, and `index(ofSectionNamed:)`.

The section expression is **prepended to the query's `ORDER BY`**, so the sort you write is applied *within* each section. Pass a closure for an arbitrary SQL expression or an explicit ordering:

```swift
@FetchAll(Reminder.order(by: \.title), sectionBy: { $0.category.desc() })
var reminders
```

`SelectStatement.fetchAll(_:sectionBy:)` is the imperative equivalent for one-shot reads.

### Lifecycle-Aware Fetching (v1.4.0+)

Use `.task` to automatically cancel observation when view disappears:

```swift
struct ItemsList: View {
    @Fetch(Item.all, animation: .default)
    private var items = [Item]()

    @State var searchQuery = ""

    var body: some View {
        List(items) { item in
            Text(item.title)
        }
        .searchable(text: $searchQuery)
        .task(id: searchQuery) {
            // Automatically cancels when view disappears or searchQuery changes
            try? await $items.load(
                Item.where { $0.title.like("%\(searchQuery)%") }
                    .order(by: \.title)
            ).task  // ← .task for auto-cancellation
        }
    }
}
```

**Before v1.4.0** (manual cleanup):
```swift
.task {
    try? await $items.load(query)
}
.onDisappear {
    Task { try await $items.load(Item.none) }
}
```

**With v1.4.0** (automatic):
```swift
.task {
    try? await $items.load(query).task  // Auto-cancels
}
```

### Filtering

```swift
// Simple keypath filter
let active = Item.where(\.isActive)

// Complex closure filter
let recent = Item.where { $0.createdAt > lastWeek && !$0.isArchived }

// Contains/prefix/suffix — all spelled with `like`
let matches = Item.where { $0.title.like("%phone%") }
let starts = Item.where { $0.title.like("iPhone%") }
```

### Sorting

```swift
// Single column
let sorted = Item.order(by: \.title)

// Descending
let descending = Item.order { $0.createdAt.desc() }

// Multiple columns
let multiSort = Item.order { ($0.priority, $0.createdAt.desc()) }
```

### Static Fetch Helpers (v1.4.0+)

Cleaner syntax for fetching:

```swift
// OLD (verbose)
let items = try Item.all.fetchAll(db)
let item = try Item.find(id).fetchOne(db)  // returns Optional<Item>

// NEW (concise)
let items = try Item.fetchAll(db)
let item = try Item.find(db, key: id)      // returns Item (non-optional)

// Works with where clauses too
let active = try Item.where(\.isActive).find(db, key: id)
```

**Key improvement:** `.find(db, key:)` returns non-optional, throwing an error if not found.

---

## Insert / Update / Delete

### Insert

```swift
try database.write { db in
    try Item.insert {
        Item.Draft(title: "New Item", isInStock: true)
    }
    .execute(db)
}
```

#### Drafts and lazily-initialized columns

`Draft` is the insert-shaped twin of a table: the primary key is optional because the database assigns it. Since StructuredQueries 0.33, `@Column(lazyInitializable: true)` extends that to any column — the property becomes optional *in the Draft only*, for values the database fills in (a `DEFAULT CURRENT_TIMESTAMP`) or that you set after inserting a parent row (a foreign key):

```swift
@Table struct Item {
    let id: Int
    var title: String
    @Column(lazyInitializable: true) var createdAt: Date
}

try Item.insert { Item.Draft(title: "New") }.execute(db)   // createdAt omitted
```

A table gets a `Draft` if it has a primary key **or** any lazy-initializable column — drafts are no longer exclusive to primary-keyed tables. The `LazyInitializableByDefault` trait makes every defaulted-less property behave this way; it is documented upstream as a future default.

### Insert with RETURNING (get generated ID)

```swift
let newId = try database.write { db in
    try Item.insert {
        Item.Draft(title: "New Item")
    }
    .returning(\.id)
    .fetchOne(db)
}
```

### Update Single Record

```swift
try database.write { db in
    try Item.find(itemId)
        .update { $0.title = #bind("Updated Title") }
        .execute(db)
}
```

### Update Multiple Records

```swift
try database.write { db in
    try Item.where(\.isArchived)
        .update { $0.isDeleted = #bind(true) }
        .execute(db)
}
```

### Delete

```swift
// Delete single
try database.write { db in
    try Item.find(id).delete().execute(db)
}

// Delete multiple
try database.write { db in
    try Item.where { $0.createdAt < cutoffDate }
        .delete()
        .execute(db)
}
```

### Upsert (Insert or Update)

SQLite's UPSERT (`INSERT ... ON CONFLICT ... DO UPDATE`) expresses "insert if missing, otherwise update" in one statement.

```swift
try database.write { db in
    try Item.insert {
        item
    } onConflict: { cols in
        (cols.libraryID, cols.remoteID)   // Conflict target columns
    } doUpdate: { row, excluded in
        row.name = excluded.name           // Merge semantics
        row.notes = excluded.notes
    }
    .execute(db)
}
```

#### Parameters

- `onConflict:` — Columns defining "same row" (must match UNIQUE constraint/index)
- `doUpdate:` — What to update on conflict
  - `row` = existing database row
  - `excluded` = proposed insert values (SQLite's `excluded` table)

#### With Partial Unique Index

When your UNIQUE index has a `WHERE` clause, add a conflict filter:

```swift
try Item.insert {
    item
} onConflict: { cols in
    (cols.libraryID, cols.remoteID)
} where: { cols in
    cols.remoteID.isNot(nil)          // Match partial index condition
} doUpdate: { row, excluded in
    row.name = excluded.name
}
.execute(db)
```

#### Schema Requirement

```sql
CREATE UNIQUE INDEX idx_items_sync_identity
ON items (libraryID, remoteID)
WHERE remoteID IS NOT NULL
```

#### Merge Strategies

##### Replace All Mutable Fields (Sync Mirror)

```swift
doUpdate: { row, excluded in
    row.name = excluded.name
    row.notes = excluded.notes
    row.updatedAt = excluded.updatedAt
}
```

##### Merge Without Clobbering

```swift
doUpdate: { row, excluded in
    row.name = excluded.name.ifnull(row.name)
    row.notes = excluded.notes.ifnull(row.notes)
}
```

##### Last-Write-Wins (Raw SQL)

```swift
try db.execute(sql: """
    INSERT INTO items (id, name, updatedAt) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        updatedAt = excluded.updatedAt
    WHERE excluded.updatedAt >= items.updatedAt
    """, arguments: [item.id, item.name, item.updatedAt])
// Use >= to handle timestamp ties (last arrival wins)
```

#### ❌ Common Upsert Mistakes

##### Missing UNIQUE Constraint

```swift
// WRONG — no index to conflict against
onConflict: { ($0.libraryID, $0.remoteID) }
// but table has no UNIQUE(libraryID, remoteID)
```

##### Using INSERT OR REPLACE

```swift
// WRONG — REPLACE deletes then inserts, breaking FK relationships
try db.execute(sql: "INSERT OR REPLACE INTO items ...")

// CORRECT — use ON CONFLICT for true upsert
try Item.insert { ... } onConflict: { ... } doUpdate: { ... }
```

---

## Batch Operations

### Batch Insert

```swift
try database.write { db in
    try Item.insert {
        ($0.title, $0.isInStock)
    } values: {
        items.map { ($0.title, $0.isInStock) }
    }
    .execute(db)
}
```

### Transaction Safety

All mutations inside `database.write { }` are wrapped in a transaction:

```swift
try database.write { db in
    // These all succeed or all fail together
    try Item.insert { ... }.execute(db)
    try Item.find(id).update { ... }.execute(db)
    try OtherTable.find(otherId).delete().execute(db)
}
```

If any operation throws, the entire transaction rolls back.

---

## Raw SQL with #sql Macro

When you need custom SQL expressions beyond the type-safe query builder, use the `#sql` macro from StructuredQueries:

### Custom Query Expressions

```swift
nonisolated extension Item.TableColumns {
    var isPastDue: some QueryExpression<Bool> {
        @Dependency(\.date.now) var now
        return !isCompleted && #sql("coalesce(date(\(dueDate)) < date(\(now)), 0)")
    }
}

// Use in queries
let overdue = try Item.where { $0.isPastDue }.fetchAll(db)
```

### Raw SQL Queries

```swift
// Direct SQL with parameter interpolation
try #sql("SELECT * FROM items WHERE price > \(minPrice)").execute(db)

// Using \(raw:) for literal values
let tableName = "items"
try #sql("SELECT * FROM \(raw: tableName)").execute(db)
```

#### Why #sql

- Type-safe parameter binding (prevents SQL injection)
- Compile-time syntax checking
- Seamless integration with query builder
- Parameter interpolation automatically escapes values

For schema creation (CREATE TABLE, migrations), see the `skills/sqlitedata-ref.md` reference skill for complete examples.

---

## CloudKit Sync

### Basic Setup

```swift
import CloudKit

extension DependencyValues {
    var defaultSyncEngine: SyncEngine {
        get { self[DefaultSyncEngineKey.self] }
        set { self[DefaultSyncEngineKey.self] = newValue }
    }
}

private enum DefaultSyncEngineKey: DependencyKey {
    static let liveValue = {
        @Dependency(\.defaultDatabase) var database
        return try! SyncEngine(
            for: database,
            tables: Item.self,
            privateTables: SensitiveItem.self,  // Private database
            startImmediately: true
        )
    }()
}

// In app init
prepareDependencies {
    $0.defaultDatabase = try! appDatabase()
    $0.defaultSyncEngine = try! SyncEngine(
        for: $0.defaultDatabase,
        tables: Item.self
    )
}
```

### Manual Sync Control (v1.3.0+)

Control when sync happens instead of automatic background sync:

```swift
@Dependency(\.defaultSyncEngine) var syncEngine

// Pull changes from CloudKit
try await syncEngine.fetchChanges()

// Push local changes to CloudKit
try await syncEngine.sendChanges()

// Bidirectional sync
try await syncEngine.syncChanges()
```

**Use cases:**
- User-triggered "Refresh" button
- Sync after critical operations
- Custom sync scheduling
- Testing sync behavior

### Sync State Observation (v1.2.0+)

Show UI feedback during sync:

```swift
struct SyncStatusView: View {
    @Dependency(\.defaultSyncEngine) var syncEngine

    var body: some View {
        HStack {
            if syncEngine.isSynchronizing {
                ProgressView()
                if syncEngine.isSendingChanges {
                    Text("Uploading...")
                } else if syncEngine.isFetchingChanges {
                    Text("Downloading...")
                }
            } else {
                Image(systemName: "checkmark.circle")
                Text("Synced")
            }
        }
    }
}
```

**Observable properties:**
- `isSendingChanges: Bool` — True during CloudKit upload
- `isFetchingChanges: Bool` — True during CloudKit download
- `isSynchronizing: Bool` — True if either sending or fetching
- `isRunning: Bool` — True if sync engine is active

### Query Sync Metadata (v1.3.0+)

Access CloudKit sync information for records:

```swift
import CloudKit

// Get sync metadata for a record
let metadata = try SyncMetadata.find(item.syncMetadataID).fetchOne(db)

// Join items with their sync metadata
let itemsWithSync = try Item.all
    .leftJoin(SyncMetadata.all) { $0.syncMetadataID.eq($1.id) }
    .select { (item: $0, metadata: $1) }
    .fetchAll(db)

// Check if record is shared
let sharedItems = try Item.all
    .join(SyncMetadata.all) { $0.syncMetadataID.eq($1.id) }
    .where { $1.isShared }
    .fetchAll(db)
```

### Sharing Records Across iCloud Accounts

`CloudSharingView` presents the system share sheet for a record. Since 1.5.0 it is a plain SwiftUI `View` rather than a `UIViewControllerRepresentable`, branching on `@Dependency(\.context)`: live contexts get the real controller, **previews and tests get a SwiftUI mock** showing the thumbnail, title, and participants. Sharing UI is therefore previewable — it no longer blanks out or crashes the canvas.

Since 1.11.1, share operations resolve the CloudKit database **per record** (`container.database(for: recordID)`) instead of assuming `privateCloudDatabase`. That is what makes a record someone else shared with you editable; before, writes against a shared record were aimed at the wrong database. If sync metadata is missing, the error now tells you to call `syncEngine.sendChanges()`.

### Migration Helpers

Migrate primary keys when switching sync strategies:

```swift
try await syncEngine.migratePrimaryKeys(
    from: OldItem.self,
    to: NewItem.self
)
```

---

## Testing and Previews

`defaultDatabase()` is context-sensitive: a pool in the app container when live, and a temporary **on-disk** pool for both previews and tests. Use it rather than hand-rolling per-context setup:

```swift
prepareDependencies { $0.defaultDatabase = try! defaultDatabase() }
```

(The library's own docstring says previews get an in-memory database; the code has said `temporaryDatabasePool` for both `.preview` and `.test` since 1.11.1. Nothing depends on it being in-memory, but don't assume the file is absent.)

**The sync engine does not auto-start under test (since 1.5.1).** Any test that exercises synchronization must start it explicitly:

```swift
@Test func syncsNewReminder() async throws {
    let syncEngine = try SyncEngine(for: database, tables: Reminder.self)
    try await syncEngine.start()          // ← required; without it, sync never runs
    // …
}
```

This changed behavior without a compile error, so a suite written against 1.5.0 or earlier still builds and simply stops testing sync — assertions pass against a sync engine that never ran. Audit for it when upgrading past 1.5.1.

CloudKit itself is mocked in tests, so no container or entitlement is needed.

---

## Package Traits

SQLiteData declares seven SwiftPM traits — six real ones plus `SQLiteDataTagged`, a deprecated alias for `Tagged`. All are opt-in, and three are documented upstream as becoming default behavior in the next major release; enable those now rather than migrating later.

| Trait | Effect | Note |
|-------|--------|------|
| `CasePaths` | Enum tables / single-table inheritance via `@Selection enum` | See `skills/sqlitedata-ref.md` |
| `Tagged` | `Tagged<Self, Int>` identifiers in schemas | `SQLiteDataTagged` is a deprecated alias |
| `ColumnCoding` | `Codable` `CodingKeys` follow `@Column("…")` names, not property names | **Future default.** With it on, writing your own `CodingKeys` is a compile error |
| `LazyInitializableByDefault` | Draft properties with no default become optional | **Future default** |
| `StrictDecoding` | Throw on storage/expected type mismatch instead of coercing | **Future default** |
| `SuppressPlatformSQLiteAvailability` | Drop `@available` gates on APIs needing a newer SQLite than the platform bundles | Only for apps embedding their own SQLite/SQLCipher |

`ColumnCoding` is the one to reach for first: without it, a table with `@Column("is_completed") var isCompleted` encodes JSON keyed `"isCompleted"` while the database column is `is_completed`, and the mismatch surfaces only when something round-trips through `Codable`.

On toolchains earlier than Swift 6.3, a trait that introduces a dependency (`CasePaths`, `Tagged`) also needs that package declared explicitly in your `Package.swift` — a SwiftPM resolution bug fixed in 6.3.

---

## When to Drop to GRDB

SQLiteData is built on GRDB. Use raw GRDB when you need:

- Complex joins across 4+ tables
- Window functions (ROW_NUMBER, RANK, etc.)
- Performance-critical paths where you've profiled and confirmed the query builder is the bottleneck

See `skills/grdb.md` for raw SQL patterns, ValueObservation, and DatabaseMigrator usage.

---

## tvOS

SQLiteData with CloudKit SyncEngine is the **recommended tvOS data solution**. tvOS has no persistent local storage — the system deletes Caches (including Application Support) under storage pressure. With SyncEngine, iCloud is your persistent store and the local database is just a cache that rebuilds automatically after deletion. See axiom-swift (skills/tvos.md) for full tvOS storage constraints.

---

## Resources

**GitHub**: pointfreeco/sqlite-data, pointfreeco/swift-structured-queries, groue/GRDB.swift

**Skills**: axiom-data (skills/sqlitedata-ref.md), axiom-data (skills/sqlitedata-migration.md), axiom-data (skills/database-migration.md), axiom-data (skills/grdb.md), axiom-data (skills/swift-sharing.md)

---

**Targets:** iOS 17+, Swift 6
**Framework:** SQLiteData 1.12+ (StructuredQueries 0.39+, GRDB 7.11+)
**History:** See git log for changes
