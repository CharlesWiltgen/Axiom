---
name: axiom-sqlitedata-migration
description: Use when migrating from SwiftData to SQLiteData — decision guide, pattern equivalents, code examples, CloudKit sharing (SwiftData can't), performance benchmarks, gradual migration strategy
license: MIT
metadata:
  version: "1.0.0"
---

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

SwiftData supports CloudKit **sync** but NOT **sharing**. SQLiteData is the only Apple-native option for record sharing.

```swift
// 1. Setup SyncEngine with sharing
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
// To fetch: Task.where { $0.projectID == project.id }
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
let tasks = Task.where { $0.projectID == project.id }
let project = Project.find(task.projectID)
```

---

**Related Skills:**
- `axiom-sqlitedata` — Full SQLiteData API reference
- `axiom-swiftdata` — SwiftData patterns if staying with Apple's framework
- `axiom-grdb` — Raw GRDB for complex queries

---

**History:** See git log for changes
