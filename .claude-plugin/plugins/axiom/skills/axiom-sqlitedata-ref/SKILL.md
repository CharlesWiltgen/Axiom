---
name: axiom-sqlitedata-ref
description: SQLiteData advanced patterns, @Selection column groups, single-table inheritance, recursive CTEs, database views, custom aggregates, TableAlias self-joins, JSON/string aggregation
license: MIT
metadata:
  version: "1.0.0"
  last-updated: "2025-12-19 — Split from sqlitedata discipline skill"
---

# SQLiteData Advanced Reference

## Overview

Advanced query patterns and schema composition techniques for [SQLiteData](https://github.com/pointfreeco/sqlite-data) by Point-Free. Built on [GRDB](https://github.com/groue/GRDB.swift) and [StructuredQueries](https://github.com/pointfreeco/swift-structured-queries).

**For core patterns** (CRUD, CloudKit setup, @Table basics), see the `axiom-sqlitedata` discipline skill.

**This reference covers** advanced querying, schema composition, views, and custom aggregates.

**Requires** iOS 17+, Swift 6 strict concurrency
**Framework** SQLiteData 1.4+

---

## Column Groups and Schema Composition

SQLiteData provides powerful tools for composing schema types, enabling reuse, better organization, and single-table inheritance patterns.

### Column Groups

Group related columns into reusable types with `@Selection`:

```swift
// Define a reusable column group
@Selection
struct Timestamps {
    let createdAt: Date
    let updatedAt: Date?
}

// Use in multiple tables
@Table
nonisolated struct RemindersList: Identifiable {
    let id: UUID
    var title = ""
    let timestamps: Timestamps  // Embedded column group
}

@Table
nonisolated struct Reminder: Identifiable {
    let id: UUID
    var title = ""
    var isCompleted = false
    let timestamps: Timestamps  // Same group, reused
}
```

**Important:** SQLite has no concept of grouped columns. Flatten all groupings in your CREATE TABLE:

```sql
CREATE TABLE "remindersLists" (
    "id" TEXT PRIMARY KEY NOT NULL DEFAULT (uuid()),
    "title" TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT
) STRICT
```

#### Querying Column Groups

Access fields inside groups with dot syntax:

```swift
// Query a field inside the group
RemindersList
    .where { $0.timestamps.createdAt <= cutoffDate }
    .fetchAll(db)

// Compare entire group (flattens to tuple in SQL)
RemindersList
    .where {
        $0.timestamps <= Timestamps(createdAt: date1, updatedAt: date2)
    }
```

#### Nesting Groups in @Selection

Use column groups in custom query results:

```swift
@Selection
struct Row {
    let reminderTitle: String
    let listTitle: String
    let timestamps: Timestamps  // Nested group
}

let results = try Reminder
    .join(RemindersList.all) { $0.remindersListID.eq($1.id) }
    .select {
        Row.Columns(
            reminderTitle: $0.title,
            listTitle: $1.title,
            timestamps: $0.timestamps  // Pass entire group
        )
    }
    .fetchAll(db)
```

### Single-Table Inheritance with Enums

Model polymorphic data using `@CasePathable @Selection` enums — a value-type alternative to class inheritance:

```swift
import CasePaths

@Table
nonisolated struct Attachment: Identifiable {
    let id: UUID
    let kind: Kind

    @CasePathable @Selection
    enum Kind {
        case link(URL)
        case note(String)
        case image(URL)
    }
}
```

**Note:** `@CasePathable` is required and comes from Point-Free's [CasePaths](https://github.com/pointfreeco/swift-case-paths) library.

#### SQL Schema for Enum Tables

Flatten all cases into nullable columns:

```sql
CREATE TABLE "attachments" (
    "id" TEXT PRIMARY KEY NOT NULL DEFAULT (uuid()),
    "link" TEXT,
    "note" TEXT,
    "image" TEXT
) STRICT
```

#### Querying Enum Tables

```swift
// Fetch all — decoding determines which case
let attachments = try Attachment.all.fetchAll(db)

// Filter by case
let images = try Attachment
    .where { $0.kind.image.isNot(nil) }
    .fetchAll(db)
```

#### Inserting Enum Values

```swift
try Attachment.insert {
    Attachment.Draft(kind: .note("Hello world!"))
}
.execute(db)
// Inserts: (id, NULL, 'Hello world!', NULL)
```

#### Updating Enum Values

```swift
try Attachment.find(id).update {
    $0.kind = .link(URL(string: "https://example.com")!)
}
.execute(db)
// Sets link column, NULLs note and image columns
```

### Complex Enum Cases with Grouped Columns

Enum cases can hold structured data using nested `@Selection` types:

```swift
@Table
nonisolated struct Attachment: Identifiable {
    let id: UUID
    let kind: Kind

    @CasePathable @Selection
    enum Kind {
        case link(URL)
        case note(String)
        case image(Attachment.Image)  // Fully qualify nested types
    }

    @Selection
    struct Image {
        var caption = ""
        var url: URL
    }
}
```

SQL schema flattens all nested fields:

```sql
CREATE TABLE "attachments" (
    "id" TEXT PRIMARY KEY NOT NULL DEFAULT (uuid()),
    "link" TEXT,
    "note" TEXT,
    "caption" TEXT,
    "url" TEXT
) STRICT
```

### Passing Rows to Database Functions

With column groups, `@DatabaseFunction` can accept entire table rows:

```swift
@DatabaseFunction
func isPastDue(reminder: Reminder) -> Bool {
    !reminder.isCompleted && reminder.dueDate < Date()
}

// Use in queries — columns are flattened/reconstituted automatically
let pastDue = try Reminder
    .where { $isPastDue(reminder: $0) }
    .fetchAll(db)
```

### Column Groups vs SwiftData Inheritance

| Approach | SQLiteData | SwiftData |
|----------|-----------|-----------|
| Type | Value types (enums/structs) | Reference types (classes) |
| Exhaustivity | Compiler-enforced switch | Runtime type checking |
| Verbosity | Concise enum cases | Verbose class hierarchy |
| Inheritance | Single-table via enum | @Model class inheritance |
| Reusable columns | `@Selection` groups | Manual repetition |

**SwiftData equivalent (more verbose):**
```swift
@Model class Attachment { var isActive: Bool }
@Model class Link: Attachment { var url: URL }
@Model class Note: Attachment { var note: String }
@Model class Image: Attachment { var url: URL }
// Each needs explicit init calling super.init
```

---

## Query Composition

Build reusable scopes as static properties/methods:

```swift
extension Item {
    static let active = Item.where { !$0.isArchived && !$0.isDeleted }
    static let inStock = Item.where(\.isInStock)

    static func createdAfter(_ date: Date) -> Where<Item> {
        Item.where { $0.createdAt > date }
    }
}

// Chain scopes
let results = try Item.active.inStock.order(by: \.title).fetchAll(db)

// Use as base for @FetchAll
@FetchAll(Item.active) var items
```

Extend `Where<Item>` to add composable filters:

```swift
extension Where<Item> {
    func matching(_ search: String) -> Where<Item> {
        self.where { $0.title.contains(search) || $0.notes.contains(search) }
    }
}
let results = try Item.inStock.matching(searchText).fetchAll(db)
```

---

## Custom Fetch Requests with @Fetch

Use `@Fetch` when you need multiple pieces of data in a single read transaction (use `@FetchAll`/`@FetchOne` for single-table queries):

```swift
struct DashboardRequest: FetchKeyRequest {
    struct Value: Sendable {
        let totalItems: Int
        let activeItems: [Item]
        let categories: [Category]
    }

    func fetch(_ db: Database) throws -> Value {
        try Value(
            totalItems: Item.count().fetchOne(db) ?? 0,
            activeItems: Item.where { !$0.isArchived }.order(by: \.updatedAt.desc()).limit(10).fetchAll(db),
            categories: Category.order(by: \.name).fetchAll(db)
        )
    }
}

@Fetch(DashboardRequest()) var dashboard
```

Dynamic loading with `.load()`:

```swift
@Fetch var results = SearchRequest.Value()

.task(id: query) {
    try? await $results.load(SearchRequest(query: query), animation: .default)
}
```

Key benefits: atomic reads, automatic observation, type-safe results.

---

## Advanced Query Patterns

### String Functions

| Function | Usage | SQL |
|----------|-------|-----|
| `upper()` / `lower()` | `$0.title.upper()` | UPPER/LOWER |
| `trim()` / `ltrim()` / `rtrim()` | `$0.title.trim()` | TRIM |
| `substr(start, len)` | `$0.title.substr(0, 3)` | SUBSTR |
| `replace(old, new)` | `$0.title.replace("old", "new")` | REPLACE |
| `length()` | `$0.title.length()` | LENGTH |
| `instr(search)` | `$0.title.instr("search") > 0` | INSTR |
| `like(pattern)` | `$0.title.like("%phone%")` | LIKE |
| `hasPrefix` / `hasSuffix` / `contains` | `$0.title.contains("Max")` | Swift-style |
| `collate(.nocase)` | `$0.title.collate(.nocase).eq("X")` | COLLATE |

### Null Handling

```swift
// Coalesce — first non-null value
let name = try User.select { $0.nickname ?? $0.firstName ?? "Anonymous" }.fetchAll(db)

// Null checks
let withDue = try Reminder.where { $0.dueDate.isNot(nil) }.fetchAll(db)
let noDue = try Reminder.where { $0.dueDate.is(nil) }.fetchAll(db)

// Null-safe ordering
let sorted = try Item.order { $0.priority.desc(nulls: .last) }.fetchAll(db)
```

### Range and Set Membership

```swift
// IN (set or subquery)
let selected = try Item.where { $0.id.in(selectedIds) }.fetchAll(db)
let inActive = try Item.where { $0.categoryID.in(
    Category.where(\.isActive).select(\.id)
)}.fetchAll(db)

// NOT IN
let excluded = try Item.where { !$0.id.in(excludedIds) }.fetchAll(db)

// BETWEEN (or Swift range syntax)
let midRange = try Item.where { $0.price.between(10, and: 100) }.fetchAll(db)
```

### Pagination

```swift
// Offset-based
let items = try Item.order(by: \.createdAt).limit(20, offset: page * 20).fetchAll(db)

// Cursor-based (more efficient for deep pages)
let items = try Item.where { $0.id > lastSeenId }.order(by: \.id).limit(20).fetchAll(db)
```

### Distinct Results

```swift
let categories = try Item.select(\.category).distinct().fetchAll(db)
```

---

## RETURNING Clause

Fetch generated values from INSERT, UPDATE, or DELETE operations:

```swift
// Insert and get auto-generated ID
let newId = try Item.insert { Item.Draft(title: "New Item") }
    .returning(\.id).fetchOne(db)

// Update and return new values
let updates = try Item.find(id).update { $0.count += 1 }
    .returning { ($0.id, $0.count) }.fetchOne(db)

// Capture deleted records before removal
let deleted = try Item.where { $0.isArchived }.delete()
    .returning(Item.self).fetchAll(db)
```

Use RETURNING to avoid a second query for auto-generated IDs, audit deletions, or verify updates.

---

## Joins

### Join Types

```swift
// INNER JOIN — only matching rows
let items = try Item.join(Category.all) { $0.categoryID.eq($1.id) }.fetchAll(db)

// LEFT JOIN — all from left, matching from right (nullable)
let items = try Item.leftJoin(Category.all) { $0.categoryID.eq($1.id) }
    .select { ($0, $1) }  // (Item, Category?)
    .fetchAll(db)
```

Also available: `.rightJoin()` (all from right) and `.fullJoin()` (all from both).

Multi-table joins chain naturally:

```swift
extension Reminder {
    static let withTags = group(by: \.id)
        .leftJoin(ReminderTag.all) { $0.id.eq($1.reminderID) }
        .leftJoin(Tag.all) { $1.tagID.eq($2.primaryKey) }
}
```

### Self-Joins with TableAlias

```swift
struct ManagerAlias: TableAlias { typealias Table = Employee }

let employeesWithManagers = try Employee
    .leftJoin(Employee.all.as(ManagerAlias.self)) { $0.managerID.eq($1.id) }
    .select { (employeeName: $0.name, managerName: $1.name) }
    .fetchAll(db)
```

---

## Case Expressions

```swift
// Simple case — map values
let labels = try Item.select {
    Case($0.priority).when(1, then: "Low").when(2, then: "Medium")
        .when(3, then: "High").else("Unknown")
}.fetchAll(db)

// Searched case — boolean conditions
let status = try Order.select {
    Case().when($0.shippedAt.isNot(nil), then: "Shipped")
        .when($0.paidAt.isNot(nil), then: "Paid").else("Unknown")
}.fetchAll(db)

// Case in updates (toggle pattern)
try Reminder.find(id).update {
    $0.status = Case($0.status)
        .when(.incomplete, then: .completing)
        .when(.completing, then: .completed)
        .else(.incomplete)
}.execute(db)
```

---

## Common Table Expressions (CTEs)

### Non-Recursive CTEs

```swift
// Single CTE
let expensiveItems = try With {
    Item.where { $0.price > 1000 }
} query: { expensive in
    expensive.order(by: \.price).limit(10)
}.fetchAll(db)

// Multiple CTEs
let report = try With {
    Customer.where { $0.totalSpent > 10000 }
} with: {
    Order.where { $0.createdAt > lastMonth }
} query: { highValue, recentOrders in
    highValue.join(recentOrders) { $0.id.eq($1.customerID) }
        .select { ($0.name, $1.total) }
}.fetchAll(db)
```

Use CTEs to break complex queries into readable parts, reuse subqueries, or improve query plans.

### Recursive CTEs

Query hierarchical data (trees, org charts, threaded comments):

```swift
@Table
nonisolated struct Category: Identifiable {
    let id: UUID
    var name = ""
    var parentID: UUID?  // Self-referential
}

// Get all descendants of a root category
let allDescendants = try With {
    Category.where { $0.id.eq(rootCategoryId) }  // Base case
} recursiveUnion: { cte in
    Category.all.join(cte) { $0.parentID.eq($1.id) }.select { $0 }  // Recursive case
} query: { cte in
    cte.order(by: \.name)
}.fetchAll(db)
```

Reverse the join condition (`$0.id.eq($1.parentID)`) to walk up the tree instead of down.

---

## Full-Text Search (FTS5)

### Basic FTS5

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

### Advanced FTS5 Features

```swift
// Highlight search terms
let results = try ItemText.where { $0.match(query) }
    .select { ($0.rowid, $0.title.highlight("<b>", "</b>")) }.fetchAll(db)

// Snippets with context
let snippets = try ItemText.where { $0.match(query) }
    .select { $0.description.snippet("<b>", "</b>", "...", 64) }.fetchAll(db)

// BM25 relevance ranking
let ranked = try ItemText.where { $0.match(query) }
    .order { $0.bm25().desc() }.fetchAll(db)
```

---

## Aggregation

### String and JSON Aggregation

```swift
// groupConcat — comma-separated tags per item
let itemsWithTags = try Item.group(by: \.id)
    .leftJoin(ItemTag.all) { $0.id.eq($1.itemID) }
    .leftJoin(Tag.all) { $1.tagID.eq($2.id) }
    .select { ($0.title, $2.name.groupConcat(separator: ", ")) }
    .fetchAll(db)
// ("iPhone", "electronics, mobile, apple")

// jsonGroupArray — aggregate into JSON array
let itemsJson = try Store.group(by: \.id)
    .leftJoin(Item.all) { $0.id.eq($1.storeID) }
    .select { ($0.name, $1.title.jsonGroupArray()) }
    .fetchAll(db)
```

Options: `.groupConcat(distinct: true)`, `.groupConcat(order: { $0.asc() })`, `.jsonGroupArray(filter: $1.isActive)`, `jsonObject("key", $0.value)`.

### Conditional Aggregation

All aggregate functions accept a `filter:` parameter:

```swift
let stats = try Item.select {
    Stats.Columns(
        total: $0.count(),
        activeCount: $0.count(filter: $0.isActive),
        avgActivePrice: $0.price.avg(filter: $0.isActive),
        totalRevenue: $0.revenue.sum(filter: $0.status.eq(.completed))
    )
}.fetchOne(db)
```

### HAVING Clause

`.where()` filters rows before grouping; `.having()` filters groups after aggregation:

```swift
let frequentCustomers = try Customer.group(by: \.id)
    .leftJoin(Order.all) { $0.id.eq($1.customerID) }
    .having { $1.count() > 5 }
    .select { ($0.name, $1.count()) }
    .fetchAll(db)
```

---

## Schema Creation with #sql Macro

The `#sql` macro enables type-safe raw SQL for schema creation and migrations.

### CREATE TABLE

```swift
migrator.registerMigration("Create initial tables") { db in
    try #sql("""
        CREATE TABLE "items" (
            "id" TEXT PRIMARY KEY NOT NULL DEFAULT (uuid()),
            "title" TEXT NOT NULL DEFAULT '',
            "isInStock" INTEGER NOT NULL DEFAULT 1,
            "price" REAL NOT NULL DEFAULT 0.0,
            "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
        ) STRICT
        """).execute(db)
}
```

### Parameter Interpolation

- `\(value)` → Automatically escaped (safe for user input)
- `\(raw: value)` → Inserted literally (only for identifiers you control)
- **Never** use `\(raw: userInput)` — SQL injection vulnerability

### Other DDL

```swift
// CREATE INDEX (with optional WHERE for partial indexes)
try #sql("""CREATE INDEX "idx_items_search" ON "items" ("title") WHERE "isArchived" = 0""").execute(db)

// CREATE TRIGGER
try #sql("""
    CREATE TRIGGER "update_timestamp" AFTER UPDATE ON "items"
    BEGIN UPDATE "items" SET "updatedAt" = datetime('now') WHERE "id" = NEW."id"; END
    """).execute(db)

// ALTER TABLE
try #sql("""ALTER TABLE "items" ADD COLUMN "notes" TEXT NOT NULL DEFAULT ''""").execute(db)
```

Use `#sql` for DDL (CREATE, ALTER, indexes, triggers). Use the query builder for regular CRUD.

### Foreign Key Relationships

```swift
migrator.registerMigration("Create tables with foreign keys") { db in
    try #sql("""
        CREATE TABLE "itemCategories" (
            "itemID" TEXT NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
            "categoryID" TEXT NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
            PRIMARY KEY ("itemID", "categoryID")
        ) STRICT
        """).execute(db)
}
```

**Critical**: Enable foreign key enforcement — SQLite disables it by default:

```swift
var configuration = Configuration()
configuration.prepareDatabase { db in
    try db.execute(sql: "PRAGMA foreign_keys = ON")
}
```

Without `PRAGMA foreign_keys = ON`, `REFERENCES` and `ON DELETE CASCADE` are silently ignored.

### Transaction Context for Batch Operations

Wrap batch operations in explicit transactions for atomicity and performance:

```swift
try database.write { db in
    // All operations share one transaction
    for item in items {
        try Item.insert { Item.Draft(title: item.title) }.execute(db)
    }
}
// Commits once on success, rolls back entirely on failure
```

The `database.write { }` block is already a transaction. For read-heavy batch analysis, use `database.read { }` which provides a consistent snapshot.

---

## Database Views

### @Selection for Custom Query Results

`@Selection` generates a `.Columns` type for compile-time verified query results:

```swift
@Selection
struct ReminderWithList: Identifiable {
    var id: Reminder.ID { reminder.id }
    let reminder: Reminder
    let remindersList: RemindersList
}

@FetchAll(
    Reminder.join(RemindersList.all) { $0.remindersListID.eq($1.id) }
        .select { ReminderWithList.Columns(reminder: $0, remindersList: $1) }
)
var reminders: [ReminderWithList]
```

Also works for aggregate queries — see the Conditional Aggregation section above.

### Temporary Views

For reusable complex queries, combine `@Table @Selection` and `createTemporaryView`:

```swift
@Table @Selection
private struct ReminderWithList {
    let reminderTitle: String
    let remindersListTitle: String
}

try database.write { db in
    try ReminderWithList.createTemporaryView(
        as: Reminder.join(RemindersList.all) { $0.remindersListID.eq($1.id) }
            .select { ReminderWithList.Columns(reminderTitle: $0.title, remindersListTitle: $1.title) }
    ).execute(db)
}

// Query like a table — join complexity hidden
let results = try ReminderWithList.order { ($0.remindersListTitle, $0.reminderTitle) }.fetchAll(db)
```

Temporary views exist for the connection lifetime. For persistent views, use `#sql("CREATE VIEW ...")` in migrations.

To make views writable, add `createTemporaryTrigger(insteadOf: .insert { ... })` to reroute operations to underlying tables.

---

## Custom Aggregate Functions

Write complex aggregation in Swift with `@DatabaseFunction`, avoiding contorted SQL subqueries:

```swift
// 1. Define — takes Sequence<T?>, returns aggregate result
@DatabaseFunction
func mode(priority priorities: some Sequence<Reminder.Priority?>) -> Reminder.Priority? {
    var occurrences: [Reminder.Priority: Int] = [:]
    for priority in priorities {
        guard let priority else { continue }
        occurrences[priority, default: 0] += 1
    }
    return occurrences.max { $0.value < $1.value }?.key
}

// 2. Register
configuration.prepareDatabase { db in db.add(function: $mode) }

// 3. Use in queries
let results = try RemindersList.group(by: \.id)
    .leftJoin(Reminder.all) { $0.id.eq($1.remindersListID) }
    .select { ($0.title, $mode(priority: $1.priority)) }
    .fetchAll(db)
```

Common uses: mode, median, weighted average, custom filtering. Functions run in Swift (not SQLite's C engine), so use built-in aggregates (`count`, `sum`, `avg`, `min`, `max`) when possible.

---

## Batch Upsert Performance

For high-volume sync (50K+ records), use cached statements instead of the type-safe API:

```swift
func batchUpsert(_ items: [Item], in db: Database) throws {
    let statement = try db.cachedStatement(sql: """
        INSERT INTO items (id, name, libraryID, remoteID, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(libraryID, remoteID) DO UPDATE SET
            name = excluded.name, updatedAt = excluded.updatedAt
        WHERE excluded.updatedAt >= items.updatedAt
        """)
    for item in items {
        try statement.execute(arguments: [item.id, item.name, item.libraryID, item.remoteID, item.updatedAt])
    }
}
```

For even higher throughput, build multi-row VALUES clauses. Query the variable limit at runtime: `sqlite3_limit(db.sqliteConnection, SQLITE_LIMIT_VARIABLE_NUMBER, -1)` (32,766 on iOS 14+, 999 on iOS 13).

| Pattern | Throughput | Trade-off |
|---------|------------|-----------|
| Type-safe upsert | ~1K rows/sec | Best DX, compile-time checks |
| Cached statement | ~10K rows/sec | Good balance |
| Multi-row VALUES | ~50K rows/sec | Most complex |

---

## Miscellaneous Advanced Patterns

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

### Compound Selects

```swift
// UNION (deduplicated), UNION ALL (keep duplicates)
let all = try Customer.select(\.email).union(Supplier.select(\.email)).fetchAll(db)

// INTERSECT (in both), EXCEPT (in first but not second)
let shared = try Customer.select(\.email).intersect(Supplier.select(\.email)).fetchAll(db)
```

---

## Resources

**GitHub**: pointfreeco/sqlite-data, pointfreeco/swift-structured-queries, groue/GRDB.swift

**Skills**: axiom-sqlitedata, axiom-sqlitedata-migration, axiom-database-migration, axiom-grdb

---

**Targets:** iOS 17+, Swift 6
**Framework:** SQLiteData 1.4+
**History:** See git log for changes
