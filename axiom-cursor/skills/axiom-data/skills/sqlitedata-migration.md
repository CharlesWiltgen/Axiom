
# Migrating from SwiftData to SQLiteData

## When to Switch

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

---

## Pattern Equivalents

| SwiftData | SQLiteData |
|-----------|------------|
| `@Model class Item` | `@Table nonisolated struct Item` |
| `@Attribute(.unique)` | SQL UNIQUE in the schema (`@Column(primaryKey: true)` marks the Swift-side key and adds no constraint) |
| `@Relationship var tags: [Tag]` | `var tagIDs: [Tag.ID]` + join query |
| `@Query var items: [Item]` | `@FetchAll var items: [Item]` |
| `@Query(sort: \Item.title)` | `@FetchAll(Item.order(by: \.title))` |
| `@Query(filter: #Predicate<Item> { $0.isActive })` | `@FetchAll(Item.where(\.isActive))` |
| `@Environment(\.modelContext)` | `@Dependency(\.defaultDatabase)` |
| `context.insert(item)` | `Item.insert { Item.Draft(...) }.execute(db)` |
| `context.delete(item)` | `Item.find(id).delete().execute(db)` |
| `try context.save()` | Automatic in `database.write { }` block |
| `ModelContainer(for:)` | `prepareDependencies { $0.defaultDatabase = }` |

---

## Code Example

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
    @Query(sort: \Task.title) private var tasks: [Task]

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

    func addTask(_ title: String) throws {
        try database.write { db in
            try Task.insert {
                Task.Draft(title: title)
            }
            .execute(db)
        }
    }

    func deleteTask(_ task: Task) throws {
        try database.write { db in
            try Task.find(task.id).delete().execute(db)
        }
    }
}
```

`Task.Draft(title:)` leaves `id` to the database, and the insert sends an explicit `NULL` for it — so the `id` column's DDL has to substitute the default. SQLiteData's own shape, `"id" TEXT PRIMARY KEY NOT NULL ON CONFLICT REPLACE DEFAULT (uuid())`, works because `REPLACE` fills the `NULL` from the column default; against a plain `TEXT PRIMARY KEY NOT NULL` the same insert fails with a NOT NULL constraint failure on `id`. Pass the id yourself — `Task.Draft(id: UUID(), title: title)` — if your schema has no such default.

**Key differences:**
- `class` → `struct` with `nonisolated`
- `@Model` → `@Table`
- `@Query` → `@FetchAll`
- `@Environment(\.modelContext)` → `@Dependency(\.defaultDatabase)`
- Implicit save → Explicit `database.write { }` block
- Direct init → `.Draft` type for inserts
- `@Relationship` → Explicit foreign key + join

---

## CloudKit Sharing (SwiftData Can't Do This)

SwiftData supports CloudKit **sync** but NOT **sharing**. SQLiteData is the only persistence framework with a sharing API — Apple's own route is CloudKit's `CKSyncEngine` and `CKShare` by hand.

```swift
// 1. Setup SyncEngine with sharing
try! prepareDependencies {
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
    }
}

// 3. Present native sharing UI
.sheet(item: $sharedRecord) { record in
    CloudSharingView(sharedRecord: record)
}
```

**Sharing enables:** Collaborative lists, shared workspaces, family sharing, team features.

---

## Performance Comparison

| Operation | SwiftData | SQLiteData | Improvement |
|-----------|-----------|------------|-------------|
| Insert 50k records | ~4 minutes | ~45 seconds | **5x** |
| Query 10k with predicate | ~2 seconds | ~50ms | **40x** |
| Memory (10k objects) | ~80MB | ~20MB | **4x smaller** |
| Cold launch (large DB) | ~3 seconds | ~200ms | **15x** |

*Benchmarks approximate, vary by device and data shape.*

---

## Migrating Existing User Data

**Critical**: Schema migration alone loses all user data. You must export from SwiftData and import into SQLiteData.

```swift
// 1. Read all records from SwiftData's backing store
func migrateExistingData(from modelContext: ModelContext, to database: any DatabaseWriter) throws {
    // Fetch all SwiftData records
    let descriptor = FetchDescriptor<SwiftDataTask>()
    let existingTasks = try modelContext.fetch(descriptor)
    let priorCount = try database.read { db in try SQLiteTask.fetchCount(db) }

    // 2. Bulk insert into SQLiteData
    try database.write { db in
        for task in existingTasks {
            try SQLiteTask.insert {
                SQLiteTask.Draft(
                    id: task.id,
                    title: task.title,
                    isCompleted: task.isCompleted,
                    projectID: task.project?.id
                )
            }
            .execute(db)
        }
    }

    // 3. Verify migration. Compare a delta: a re-run, or rows written by
    // anything else, make an absolute count fail on a successful migration.
    // `precondition` is not stripped in Release, where a bad migration ships.
    let count = try database.read { db in
        try SQLiteTask.fetchCount(db)
    }
    precondition(count == priorCount + existingTasks.count, "Migration count mismatch!")
}
```

**Migration checklist:**
- [ ] Export all models before deleting SwiftData container
- [ ] Migrate relationships (fetch parent IDs for foreign keys)
- [ ] Verify the exported count matches the imported count (compare a delta, not the whole table)
- [ ] Keep SwiftData container as backup until confirmed working
- [ ] Run migration on first launch with a version flag in UserDefaults

## Gradual Migration Strategy

You don't have to migrate everything at once:

1. **Add SQLiteData for new features** — Keep SwiftData for existing simple CRUD
2. **Migrate one model at a time** — Start with the performance bottleneck
3. **Use separate databases initially** — SQLiteData for heavy data/sharing, SwiftData for preferences
4. **Consolidate if needed** — Or keep hybrid if it works

---

## Common Gotchas

### Relationships → Foreign Keys

```swift
// SwiftData: implicit relationship
@Relationship var tasks: [Task]

// SQLiteData: explicit column + query
// In child: var projectID: Project.ID
// To fetch: Task.where { $0.projectID.eq(#bind(project.id)) }
```

### Cascade Deletes

```swift
// SwiftData: @Relationship(deleteRule: .cascade)

// SQLiteData: Define in SQL schema
// "REFERENCES parent(id) ON DELETE CASCADE"
```

### No Automatic Inverse

```swift
// SwiftData: @Relationship(inverse: \Task.project)

// SQLiteData: Query both directions manually
let tasks = Task.where { $0.projectID.eq(#bind(project.id)) }
let project = Project.find(task.projectID)
```

---

**Related Skills:**
- `skills/sqlitedata.md` — Full SQLiteData API reference
- `skills/swiftdata.md` — SwiftData patterns if staying with Apple's framework
- `skills/grdb.md` — Raw GRDB for complex queries
