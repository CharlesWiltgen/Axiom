---
name: axiom-sqlitedata-ref
description: SQLiteData advanced patterns, @Selection column groups, single-table inheritance, recursive CTEs, database views, custom aggregates, TableAlias self-joins, JSON/string aggregation
user-invocable: true
skill_type: reference
version: 1.0.0
last_updated: 2025-12-19 — Split from sqlitedata discipline skill
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

Build reusable query components as static properties and methods on your tables.

### Reusable Scopes

```swift
extension Item {
    // Common filters as static properties
    static let active = Item.where { !$0.isArchived && !$0.isDeleted }
    static let inStock = Item.where(\.isInStock)
    static let outOfStock = Item.where { !$0.isInStock }

    // Parameterized scopes as static methods
    static func createdAfter(_ date: Date) -> Where<Item> {
        Item.where { $0.createdAt > date }
    }

    static func inCategory(_ category: String) -> Where<Item> {
        Item.where { $0.category.eq(category) }
    }
}
```

### Using Scopes

```swift
// Chain scopes together
let results = try Item.active
    .inStock
    .order(by: \.title)
    .fetchAll(db)

// Combine with additional filtering
let recent = try Item.active
    .createdAfter(lastWeek)
    .inCategory("Electronics")
    .fetchAll(db)
```

### Default Query Patterns

```swift
extension Item {
    // Standard "all visible" query
    static let visible = Item
        .where { !$0.isDeleted }
        .order(by: \.position)

    // With eager-loaded relationships
    static let withCategory = Item
        .join(Category.all) { $0.categoryID.eq($1.id) }
}

// Use as base for all queries
@FetchAll(Item.visible) var items
```

### Composing Where Clauses

```swift
extension Where<Item> {
    // Add filters to existing queries
    func onlyActive() -> Where<Item> {
        self.where { !$0.isArchived }
    }

    func matching(_ search: String) -> Where<Item> {
        self.where { $0.title.contains(search) || $0.notes.contains(search) }
    }
}

// Chain compositions
let results = try Item.inStock
    .onlyActive()
    .matching(searchText)
    .fetchAll(db)
```

### Query Helpers for Common Operations

```swift
extension Item {
    // Fetch with common options
    static func search(
        _ query: String,
        category: String? = nil,
        limit: Int = 50
    ) -> some Statement<Item> {
        var base = Item.active.where { $0.title.contains(query) }
        if let category {
            base = base.where { $0.category.eq(category) }
        }
        return base.order(by: \.title).limit(limit)
    }
}

// Clean call sites
let results = try Item.search("phone", category: "Electronics").fetchAll(db)
```

---

## Custom Fetch Requests with @Fetch

The `@Fetch` property wrapper enables complex, multi-value database requests using custom `FetchKeyRequest` types. Use this when you need to fetch multiple pieces of data in a single database read transaction.

### Basic @Fetch Usage

```swift
struct PlayersRequest: FetchKeyRequest {
    struct Value {
        let injuredPlayerCount: Int
        let players: [Player]
    }

    func fetch(_ db: Database) throws -> Value {
        try Value(
            injuredPlayerCount: Player
                .where(\.isInjured)
                .fetchCount(db),
            players: Player
                .where { !$0.isInjured }
                .order(by: \.name)
                .limit(10)
                .fetchAll(db)
        )
    }
}

// Use in SwiftUI views
struct PlayersView: View {
    @Fetch(PlayersRequest()) var response

    var body: some View {
        ForEach(response.players) { player in
            Text(player.name)
        }
        Button("View injured players (\(response.injuredPlayerCount))") {
            // ...
        }
    }
}
```

### When to Use @Fetch vs @FetchAll/@FetchOne

**Use `@FetchAll` / `@FetchOne` when:**
- Fetching a single table
- Simple queries with one result type
- Standard CRUD operations

**Use `@Fetch` when:**
- Need multiple pieces of data from one or more tables
- Want to combine query results into a custom type
- Performing aggregations alongside detail fetches
- Optimizing for fewer database round trips

### Complex Example

```swift
struct DashboardRequest: FetchKeyRequest {
    struct Value: Sendable {
        let totalItems: Int
        let activeItems: [Item]
        let categories: [Category]
        let recentActivity: [ActivityLog]
    }

    func fetch(_ db: Database) throws -> Value {
        try Value(
            totalItems: Item.count().fetchOne(db) ?? 0,
            activeItems: Item
                .where { !$0.isArchived }
                .order(by: \.updatedAt.desc())
                .limit(10)
                .fetchAll(db),
            categories: Category
                .order(by: \.name)
                .fetchAll(db),
            recentActivity: ActivityLog
                .order(by: \.timestamp.desc())
                .limit(20)
                .fetchAll(db)
        )
    }
}

@Fetch(DashboardRequest()) var dashboard
```

### Dynamic @Fetch Loading

Load different requests dynamically with `.load()`:

```swift
@Fetch var searchResults = SearchRequest.Value()

// Load with initial query
.task {
    try? await $searchResults.load(SearchRequest(query: "Swift"))
}

// Reload with new query
Button("Search") {
    Task {
        try? await $searchResults.load(SearchRequest(query: newQuery))
    }
}
```

### @Fetch with Animation

```swift
@Fetch(
    PlayersRequest(),
    animation: .default
) var response
```

**Key Benefits:**
- Single database read transaction (atomic, consistent)
- Automatic observation (updates when any table changes)
- Type-safe result structure
- Composable with other query patterns

---

## Advanced Query Patterns

### String Functions

```swift
// Case conversion
let upper = try Item
    .select { $0.title.upper() }
    .fetchAll(db)

let lower = try Item
    .select { $0.title.lower() }
    .fetchAll(db)

// Trimming whitespace
let trimmed = try Item
    .select { $0.title.trim() }       // Both sides
    .fetchAll(db)

let leftTrimmed = try Item
    .select { $0.title.ltrim() }      // Left only
    .fetchAll(db)

// Substring extraction
let firstThree = try Item
    .select { $0.title.substr(0, 3) }  // Start index, length
    .fetchAll(db)

// String replacement
let cleaned = try Item
    .select { $0.title.replace("old", "new") }
    .fetchAll(db)

// String length
let lengths = try Item
    .select { ($0.title, $0.title.length()) }
    .fetchAll(db)

// Find substring position (1-indexed, 0 if not found)
let positions = try Item
    .where { $0.title.instr("search") > 0 }
    .fetchAll(db)

// Pattern matching
let matches = try Item
    .where { $0.title.like("%phone%") }           // SQL LIKE
    .fetchAll(db)

let prefixed = try Item
    .where { $0.title.hasPrefix("iPhone") }       // Starts with
    .fetchAll(db)

let suffixed = try Item
    .where { $0.title.hasSuffix("Pro") }          // Ends with
    .fetchAll(db)

let containing = try Item
    .where { $0.title.contains("Max") }           // Contains
    .fetchAll(db)

// Case-insensitive comparison
let caseInsensitive = try Item
    .where { $0.title.collate(.nocase).eq("IPHONE") }
    .fetchAll(db)
```

### Null Handling

```swift
// Coalesce — return first non-null value
let displayName = try User
    .select { $0.nickname ?? $0.firstName ?? "Anonymous" }
    .fetchAll(db)

// ifnull — alternative if null
let safePrice = try Item
    .select { $0.discountPrice.ifnull($0.price) }
    .fetchAll(db)

// Check for null
let withDueDate = try Reminder
    .where { $0.dueDate.isNot(nil) }
    .fetchAll(db)

let noDueDate = try Reminder
    .where { $0.dueDate.is(nil) }
    .fetchAll(db)

// Null-safe comparison in ordering
let sorted = try Item
    .order { $0.priority.desc(nulls: .last) }  // Nulls at end
    .fetchAll(db)
```

### Range and Set Membership

```swift
// IN — check if value is in a set
let selected = try Item
    .where { $0.id.in(selectedIds) }
    .fetchAll(db)

// IN with subquery
let itemsInActiveCategories = try Item
    .where { $0.categoryID.in(
        Category.where(\.isActive).select(\.id)
    )}
    .fetchAll(db)

// NOT IN
let excluded = try Item
    .where { !$0.id.in(excludedIds) }
    .fetchAll(db)

// BETWEEN — range check
let midRange = try Item
    .where { $0.price.between(10, and: 100) }
    .fetchAll(db)

// Swift range syntax
let inRange = try Item
    .where { (10...100).contains($0.price) }
    .fetchAll(db)
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

### Distinct Results

Remove duplicate rows from query results:

```swift
// Get unique categories
let categories = try Item
    .select(\.category)
    .distinct()
    .fetchAll(db)

// Distinct with multiple columns
let uniquePairs = try Item
    .select { ($0.category, $0.status) }
    .distinct()
    .fetchAll(db)
```

### Pagination

Use `limit()` and `offset()` for paged results:

```swift
let pageSize = 20
let page = 3

let items = try Item
    .order(by: \.createdAt)
    .limit(pageSize, offset: page * pageSize)
    .fetchAll(db)
```

**Tip:** For large datasets, cursor-based pagination (using last item's ID) is more efficient than offset:

```swift
// Cursor-based: more efficient for deep pages
let items = try Item
    .where { $0.id > lastSeenId }
    .order(by: \.id)
    .limit(pageSize)
    .fetchAll(db)
```

---

## RETURNING Clause

Fetch generated values from INSERT, UPDATE, or DELETE operations:

### Get Generated ID from Insert

```swift
// Insert and get the auto-generated UUID
let newId = try Item.insert {
    Item.Draft(title: "New Item")
}
.returning(\.id)
.fetchOne(db)

// Insert and get the full inserted record
let newItem = try Item.insert {
    Item.Draft(title: "New Item")
}
.returning(Item.self)
.fetchOne(db)
```

### Get Updated Values

```swift
// Update and return the new values
let updatedTitles = try Item
    .where { $0.isInStock }
    .update { $0.title = "Updated: " + $0.title }
    .returning(\.title)
    .fetchAll(db)

// Return multiple columns
let updates = try Item.find(id)
    .update { $0.count += 1 }
    .returning { ($0.id, $0.count) }
    .fetchOne(db)
```

### Get Deleted Records

```swift
// Capture records before deletion
let deleted = try Item
    .where { $0.isArchived }
    .delete()
    .returning(Item.self)
    .fetchAll(db)

print("Deleted \(deleted.count) archived items")
```

**When to use RETURNING:**
- Get auto-generated IDs without a second query
- Audit deleted records before removal
- Verify updated values match expectations
- Batch operations that need result confirmation

---

## Joins

### Basic Joins

```swift
extension Reminder {
    static let withTags = group(by: \.id)
        .leftJoin(ReminderTag.all) { $0.id.eq($1.reminderID) }
        .leftJoin(Tag.all) { $1.tagID.eq($2.primaryKey) }
}
```

### Join Types

```swift
// INNER JOIN — only matching rows
let itemsWithCategories = try Item
    .join(Category.all) { $0.categoryID.eq($1.id) }
    .fetchAll(db)

// LEFT JOIN — all from left, matching from right (nullable)
let itemsWithOptionalCategory = try Item
    .leftJoin(Category.all) { $0.categoryID.eq($1.id) }
    .select { ($0, $1) }  // (Item, Category?)
    .fetchAll(db)

// RIGHT JOIN — all from right, matching from left
let categoriesWithItems = try Item
    .rightJoin(Category.all) { $0.categoryID.eq($1.id) }
    .select { ($0, $1) }  // (Item?, Category)
    .fetchAll(db)

// FULL OUTER JOIN — all from both
let allCombined = try Item
    .fullJoin(Category.all) { $0.categoryID.eq($1.id) }
    .select { ($0, $1) }  // (Item?, Category?)
    .fetchAll(db)
```

### Self-Joins with TableAlias

Query the same table twice (e.g., employee/manager relationships):

```swift
// Define an alias for the second reference
struct ManagerAlias: TableAlias {
    typealias Table = Employee
}

// Employee with their manager's name
let employeesWithManagers = try Employee
    .leftJoin(Employee.all.as(ManagerAlias.self)) { $0.managerID.eq($1.id) }
    .select {
        (
            employeeName: $0.name,
            managerName: $1.name  // From aliased table
        )
    }
    .fetchAll(db)

// Find employees who manage others
let managers = try Employee
    .join(Employee.all.as(ManagerAlias.self)) { $0.id.eq($1.managerID) }
    .select { $0 }
    .distinct()
    .fetchAll(db)
```

---

## Case Expressions

CASE WHEN logic for conditional values in queries:

```swift
// Simple case — map values
let labels = try Item
    .select {
        Case($0.priority)
            .when(1, then: "Low")
            .when(2, then: "Medium")
            .when(3, then: "High")
            .else("Unknown")
    }
    .fetchAll(db)

// Searched case — boolean conditions
let status = try Order
    .select {
        Case()
            .when($0.shippedAt.isNot(nil), then: "Shipped")
            .when($0.paidAt.isNot(nil), then: "Paid")
            .when($0.createdAt.isNot(nil), then: "Pending")
            .else("Unknown")
    }
    .fetchAll(db)

// Case in updates (toggle pattern)
try Reminder.find(id).update {
    $0.status = Case($0.status)
        .when(.incomplete, then: .completing)
        .when(.completing, then: .completed)
        .else(.incomplete)
}
.execute(db)

// Case for computed columns
let itemsWithTier = try Item
    .select {
        (
            $0.title,
            Case()
                .when($0.price < 10, then: "Budget")
                .when($0.price < 100, then: "Standard")
                .else("Premium")
        )
    }
    .fetchAll(db)
```

---

## Common Table Expressions (CTEs)

### Non-Recursive CTEs

Simplify complex queries by breaking them into named subqueries:

```swift
// Define a CTE for expensive items
let expensiveItems = try With {
    Item.where { $0.price > 1000 }
} query: { expensive in
    // Use the CTE in the final query
    expensive
        .order(by: \.price)
        .limit(10)
}
.fetchAll(db)

// Multiple CTEs
let report = try With {
    // CTE 1: High-value customers
    Customer.where { $0.totalSpent > 10000 }
} with: {
    // CTE 2: Recent orders
    Order.where { $0.createdAt > lastMonth }
} query: { highValue, recentOrders in
    // Join the CTEs
    highValue
        .join(recentOrders) { $0.id.eq($1.customerID) }
        .select { ($0.name, $1.total) }
}
.fetchAll(db)

// CTE for deduplication
let uniqueEmails = try With {
    Customer
        .group(by: \.email)
        .select { ($0.email, $0.id.min()) }
} query: { unique in
    Customer
        .where { $0.id.in(unique.select { $1 }) }
}
.fetchAll(db)
```

**When to use CTEs:**
- Break complex queries into readable parts
- Reuse a subquery multiple times
- Improve query plan for complex joins
- Self-documenting query structure

### Recursive CTEs

Query hierarchical data like trees, org charts, or threaded comments:

```swift
// Define a tree structure
@Table
nonisolated struct Category: Identifiable {
    let id: UUID
    var name = ""
    var parentID: UUID?  // Self-referential for hierarchy
}

// Recursive query to get all descendants
let allDescendants = try With {
    // Base case: start with root category
    Category.where { $0.id.eq(rootCategoryId) }
} recursiveUnion: { cte in
    // Recursive case: join children to CTE
    Category.all
        .join(cte) { $0.parentID.eq($1.id) }
        .select { $0 }
} query: { cte in
    // Final query from the CTE
    cte.order(by: \.name)
}
.fetchAll(db)
```

#### Ancestor Path (Walking Up the Tree)

```swift
// Get all ancestors of a category
let ancestors = try With {
    Category.where { $0.id.eq(childCategoryId) }
} recursiveUnion: { cte in
    Category.all
        .join(cte) { $0.id.eq($1.parentID) }
        .select { $0 }
} query: { cte in
    cte.all
}
.fetchAll(db)
```

#### Threaded Comments

```swift
@Table
nonisolated struct Comment: Identifiable {
    let id: UUID
    var body = ""
    var parentID: UUID?
    var depth = 0
}

// Get comment thread with depth
let thread = try With {
    Comment
        .where { $0.parentID.is(nil) && $0.postID.eq(postId) }
        .select { ($0, 0) }  // depth = 0 for root
} recursiveUnion: { cte in
    Comment.all
        .join(cte) { $0.parentID.eq($1.id) }
        .select { ($0, $1.depth + 1) }
} query: { cte in
    cte.order { ($0.depth, $0.createdAt) }
}
.fetchAll(db)
```

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

Beyond basic `match()`, FTS5 provides search UI helpers:

```swift
@Table
struct ItemText: FTS5 {
    let rowid: Int
    let title: String
    let description: String
}

// Highlight search terms in results
let results = try ItemText
    .where { $0.match(searchQuery) }
    .select {
        (
            $0.rowid,
            $0.title.highlight("<b>", "</b>"),      // <b>search</b> term
            $0.description.highlight("<mark>", "</mark>")
        )
    }
    .fetchAll(db)

// Extract snippets with context
let snippets = try ItemText
    .where { $0.match(searchQuery) }
    .select {
        $0.description.snippet(
            "<b>", "</b>",  // highlight markers
            "...",          // ellipsis for truncation
            64              // max tokens
        )
    }
    .fetchAll(db)
// "...the <b>search</b> term appears in context..."

// BM25 ranking for relevance sorting
let ranked = try ItemText
    .where { $0.match(searchQuery) }
    .order { $0.bm25().desc() }  // Most relevant first
    .select {
        ($0.title, $0.bm25())
    }
    .fetchAll(db)
```

---

## Aggregation

### String Aggregation (groupConcat)

Concatenate values from multiple rows into a single string:

```swift
// Get comma-separated tags for each item
let itemsWithTags = try Item
    .group(by: \.id)
    .leftJoin(ItemTag.all) { $0.id.eq($1.itemID) }
    .leftJoin(Tag.all) { $1.tagID.eq($2.id) }
    .select {
        (
            $0.title,
            $2.name.groupConcat(separator: ", ")
        )
    }
    .fetchAll(db)
// ("iPhone", "electronics, mobile, apple")

// With ordering within the aggregate
let orderedTags = try Item
    .group(by: \.id)
    .leftJoin(Tag.all) { /* ... */ }
    .select {
        $2.name.groupConcat(separator: ", ", order: { $0.asc() })
    }
    .fetchAll(db)

// Distinct values only
let uniqueCategories = try Item
    .group(by: \.storeID)
    .select {
        $0.category.groupConcat(distinct: true, separator: " | ")
    }
    .fetchAll(db)
```

### JSON Aggregation

Build JSON arrays and objects directly in queries:

```swift
// Aggregate rows into JSON array
let itemsJson = try Store
    .group(by: \.id)
    .leftJoin(Item.all) { $0.id.eq($1.storeID) }
    .select {
        (
            $0.name,
            $1.title.jsonGroupArray()  // ["item1", "item2", ...]
        )
    }
    .fetchAll(db)

// With filtering
let activeItemsJson = try Store
    .group(by: \.id)
    .leftJoin(Item.all) { $0.id.eq($1.storeID) }
    .select {
        $1.title.jsonGroupArray(filter: $1.isActive)
    }
    .fetchAll(db)

// Build JSON objects
let storeData = try Store
    .select {
        jsonObject(
            "id", $0.id,
            "name", $0.name,
            "itemCount", $0.itemCount
        )
    }
    .fetchAll(db)
```

### Aggregate Functions with Filters

All aggregate functions support conditional aggregation:

```swift
let stats = try Item
    .select {
        Stats.Columns(
            total: $0.count(),
            activeCount: $0.count(filter: $0.isActive),
            inStockCount: $0.count(filter: $0.isInStock),
            avgPrice: $0.price.avg(),
            avgActivePrice: $0.price.avg(filter: $0.isActive),
            maxDiscount: $0.discount.max(filter: $0.isOnSale),
            totalRevenue: $0.revenue.sum(filter: $0.status.eq(.completed))
        )
    }
    .fetchOne(db)
```

### HAVING Clause

Filter grouped results after aggregation with `.having()`:

```swift
// Customers with more than 5 orders
let frequentCustomers = try Customer
    .group(by: \.id)
    .leftJoin(Order.all) { $0.id.eq($1.customerID) }
    .having { $1.count() > 5 }
    .select { ($0.name, $1.count()) }
    .fetchAll(db)

// Categories with total sales over threshold
let topCategories = try Category
    .group(by: \.id)
    .leftJoin(Item.all) { $0.id.eq($1.categoryID) }
    .having { $1.price.sum() > 10000 }
    .select { ($0.name, $1.price.sum()) }
    .fetchAll(db)

// Combined WHERE and HAVING
// WHERE filters rows before grouping, HAVING filters after
let activeHighVolume = try Store
    .where(\.isActive)                          // Before grouping
    .group(by: \.id)
    .leftJoin(Order.all) { $0.id.eq($1.storeID) }
    .having { $1.count() >= 100 }               // After grouping
    .select { ($0.name, $1.count()) }
    .fetchAll(db)
```

**When to use:**
- `.where()` — Filter individual rows before grouping
- `.having()` — Filter groups after aggregation based on aggregate values

---

## Schema Creation with #sql Macro

The `#sql` macro from [StructuredQueries](https://github.com/pointfreeco/swift-structured-queries) enables type-safe raw SQL for schema creation, migrations, and custom DDL statements.

### CREATE TABLE in Migrations

```swift
func appDatabase() throws -> any DatabaseWriter {
    let databaseQueue = try DatabaseQueue()
    var migrator = DatabaseMigrator()

    migrator.registerMigration("Create initial tables") { db in
        try #sql(
            """
            CREATE TABLE "items" (
                "id" TEXT PRIMARY KEY NOT NULL DEFAULT (uuid()),
                "title" TEXT NOT NULL DEFAULT '',
                "isInStock" INTEGER NOT NULL DEFAULT 1,
                "price" REAL NOT NULL DEFAULT 0.0,
                "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
            ) STRICT
            """
        ).execute(db)

        try #sql(
            """
            CREATE TABLE "categories" (
                "id" TEXT PRIMARY KEY NOT NULL DEFAULT (uuid()),
                "name" TEXT NOT NULL UNIQUE,
                "position" INTEGER NOT NULL DEFAULT 0
            ) STRICT
            """
        ).execute(db)

        // Foreign key relationship
        try #sql(
            """
            CREATE TABLE "itemCategories" (
                "itemID" TEXT NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
                "categoryID" TEXT NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
                PRIMARY KEY ("itemID", "categoryID")
            ) STRICT
            """
        ).execute(db)
    }

    try migrator.migrate(databaseQueue)
    return databaseQueue
}
```

### Parameter Interpolation with \(raw:)

Use `\(raw:)` for literal SQL values (table names, column names) and regular `\()` for query parameters:

```swift
migrator.registerMigration("Create table with dynamic defaults") { db in
    let defaultListColor = Color.HexRepresentation(queryOutput: defaultColor).hexValue
    let tableName = "remindersLists"

    try #sql(
        """
        CREATE TABLE \(raw: tableName) (
            "id" TEXT PRIMARY KEY NOT NULL DEFAULT (uuid()),
            "color" INTEGER NOT NULL DEFAULT \(raw: defaultListColor ?? 0),
            "title" TEXT NOT NULL DEFAULT ''
        ) STRICT
        """
    ).execute(db)
}
```

**⚠️ Safety:**
- `\(value)` → Automatically escaped, prevents SQL injection
- `\(raw: value)` → Inserted literally, use ONLY for identifiers you control
- Never use `\(raw: userInput)` — this creates SQL injection vulnerability

### CREATE INDEX

```swift
migrator.registerMigration("Add indexes") { db in
    try #sql(
        """
        CREATE INDEX "idx_items_createdAt"
        ON "items" ("createdAt" DESC)
        """
    ).execute(db)

    try #sql(
        """
        CREATE INDEX "idx_items_search"
        ON "items" ("title", "isInStock")
        WHERE "isArchived" = 0
        """
    ).execute(db)
}
```

### CREATE TRIGGER

```swift
migrator.registerMigration("Add audit triggers") { db in
    try #sql(
        """
        CREATE TRIGGER "update_item_timestamp"
        AFTER UPDATE ON "items"
        BEGIN
            UPDATE "items"
            SET "updatedAt" = datetime('now')
            WHERE "id" = NEW."id";
        END
        """
    ).execute(db)
}
```

### ALTER TABLE

```swift
migrator.registerMigration("Add notes column") { db in
    try #sql(
        """
        ALTER TABLE "items"
        ADD COLUMN "notes" TEXT NOT NULL DEFAULT ''
        """
    ).execute(db)
}
```

### When to Use #sql for Schema

**Use #sql when:**
- Creating tables in migrations
- Adding indexes, triggers, views
- Complex DDL that query builder doesn't support
- Need full control over SQLite STRICT tables

**Don't use #sql for:**
- Regular queries (use query builder: `Item.where(...)`)
- Simple inserts/updates/deletes (use `.insert()`, `.update()`, `.delete()`)
- Anything available in type-safe query builder

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

## Batch Upsert Performance

For high-volume sync (50K+ records), the type-safe upsert API may be too slow. Use raw SQL with cached statements for maximum throughput.

### Cached Statement Upsert

```swift
func batchUpsert(_ items: [Item], in db: Database) throws {
    let statement = try db.cachedStatement(sql: """
        INSERT INTO items (id, name, libraryID, remoteID, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(libraryID, remoteID) DO UPDATE SET
            name = excluded.name,
            updatedAt = excluded.updatedAt
        WHERE excluded.updatedAt >= items.updatedAt
        """)

    for item in items {
        try statement.execute(arguments: [
            item.id, item.name, item.libraryID,
            item.remoteID, item.updatedAt
        ])
    }
}
```

**Why this is faster:**
- Statement compiled once, reused for all rows
- No Swift type-checking overhead per row
- `cachedStatement` reuses prepared statements across calls

### Multi-Row Batch Upsert

Reduce statement count further with multi-row VALUES:

```swift
import SQLite3  // Required for sqlite3_limit

func batchUpsert(_ items: [Item], in db: Database) throws {
    guard !items.isEmpty else { return }

    // Query SQLite variable limit at runtime (requires import SQLite3)
    let maxVars = Int(sqlite3_limit(db.sqliteConnection, SQLITE_LIMIT_VARIABLE_NUMBER, -1))
    let columnsPerRow = 5  // id, name, libraryID, remoteID, updatedAt
    let maxRowsPerBatch = max(1, maxVars / columnsPerRow)

    for batchStart in stride(from: 0, to: items.count, by: maxRowsPerBatch) {
        let batchEnd = min(batchStart + maxRowsPerBatch, items.count)
        let batch = Array(items[batchStart..<batchEnd])

        // Build multi-row VALUES clause
        let placeholders = Array(repeating: "(?, ?, ?, ?, ?)", count: batch.count)
            .joined(separator: ", ")

        let sql = """
            INSERT INTO items (id, name, libraryID, remoteID, updatedAt)
            VALUES \(placeholders)
            ON CONFLICT(libraryID, remoteID) DO UPDATE SET
                name = excluded.name,
                updatedAt = excluded.updatedAt
            WHERE excluded.updatedAt >= items.updatedAt
            """

        var arguments: [DatabaseValueConvertible?] = []
        for item in batch {
            arguments.append(contentsOf: [
                item.id, item.name, item.libraryID,
                item.remoteID, item.updatedAt
            ] as [DatabaseValueConvertible?])
        }

        try db.execute(sql: sql, arguments: StatementArguments(arguments))
    }
}
```

**SQLite variable limits:**
- iOS 14+: 32,766 variables (SQLite 3.32+)
- iOS 13 and earlier: 999 variables
- Query at runtime: `sqlite3_limit(db.sqliteConnection, SQLITE_LIMIT_VARIABLE_NUMBER, -1)`

### When to Use Each Pattern

| Pattern | Use Case | Throughput |
|---------|----------|------------|
| Type-safe upsert | Small batches, type safety priority | ~1K rows/sec |
| Cached statement | Medium batches (1K-10K rows) | ~10K rows/sec |
| Multi-row VALUES | Large batches (10K+ rows) | ~50K rows/sec |

**Note:** Throughput varies by device, row size, and index count. Profile your workload.

**Trade-offs:**
- Type-safe: Best DX, compile-time checks, slowest
- Cached statement: Good balance, manual column maintenance
- Multi-row: Fastest, most complex, requires variable limit handling

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

### Compound Selects (UNION, INTERSECT, EXCEPT)

Combine multiple queries into a single result set:

```swift
// UNION — combine results, remove duplicates
let allContacts = try Customer.select(\.email)
    .union(Supplier.select(\.email))
    .fetchAll(db)

// UNION ALL — combine results, keep duplicates
let allEmails = try Customer.select(\.email)
    .union(all: true, Supplier.select(\.email))
    .fetchAll(db)

// INTERSECT — only rows in both queries
let sharedEmails = try Customer.select(\.email)
    .intersect(Supplier.select(\.email))
    .fetchAll(db)

// EXCEPT — rows in first but not second
let customerOnlyEmails = try Customer.select(\.email)
    .except(Supplier.select(\.email))
    .fetchAll(db)
```

**Use cases:**
- Combine data from multiple tables with same structure
- Find common or unique values across tables
- Build "all activity" feeds from different event types

---

## Resources

**GitHub**: pointfreeco/sqlite-data, pointfreeco/swift-structured-queries, groue/GRDB.swift

**Skills**: axiom-sqlitedata, axiom-sqlitedata-migration, axiom-database-migration, axiom-grdb

---

**Targets:** iOS 17+, Swift 6
**Framework:** SQLiteData 1.4+
**History:** See git log for changes
