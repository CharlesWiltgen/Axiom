---
name: sqlitedata-migration
description: Migration guide from SwiftData to SQLiteData — decision guide, pattern equivalents, CloudKit sharing, performance benchmarks
---

# SQLiteData Migration

Complete migration guide from Apple's SwiftData to Point-Free's SQLiteData, covering when to migrate, pattern equivalents, and gradual migration strategies.

## Overview

Guide for migrating from SwiftData to SQLiteData, including decision framework, code pattern conversions, CloudKit sharing (SwiftData can't), and performance considerations.

## When to Migrate

### Migrate to SQLiteData When
- ✅ Need CloudKit record sharing (SwiftData only syncs, no sharing)
- ✅ Have 50k+ records with performance concerns
- ✅ Want value types (structs) over reference types (classes)
- ✅ Need more control over SQL queries
- ✅ Prefer explicit over magic behavior

### Stay with SwiftData When
- Simple CRUD with native Apple integration
- Already working well with @Model classes
- Don't need CloudKit record sharing
- Team prefers Apple-native solutions

## Pattern Equivalents

### Model Definition

**SwiftData**
```swift
@Model
class Task {
    var id: UUID
    var title: String
    var isComplete: Bool

    init(title: String) {
        self.id = UUID()
        self.title = title
        self.isComplete = false
    }
}
```

**SQLiteData**
```swift
@Table
struct Task: Identifiable, Sendable {
    @Attribute(.primaryKey)
    var id: UUID
    var title: String
    var isComplete: Bool
}
```

### Queries

**SwiftData**
```swift
@Query(filter: #Predicate { !$0.isComplete })
var incompleteTasks: [Task]
```

**SQLiteData**
```swift
@FetchAll(Task.where { !$0.isComplete })
var incompleteTasks: [Task]
```

### Relationships

**SwiftData**
```swift
@Model
class Task {
    @Relationship(deleteRule: .cascade)
    var subtasks: [Subtask]
}
```

**SQLiteData**
```swift
@Table
struct Task: Identifiable, Sendable {
    var id: UUID
    // Relationships via foreign keys
}

@Table
struct Subtask: Identifiable, Sendable {
    var id: UUID
    var taskId: UUID  // Foreign key
}
```

## Migration Strategy

### Gradual Migration
1. Add SQLiteData alongside SwiftData
2. Migrate one model at a time
3. Keep both running during transition
4. Remove SwiftData when complete

### Data Migration
```swift
func migrateToSQLiteData() async throws {
    // Fetch from SwiftData
    let tasks = try modelContext.fetch(FetchDescriptor<Task>())

    // Write to SQLiteData
    try await database.write { db in
        for task in tasks {
            try SQLiteTask.insert {
                SQLiteTask(
                    id: task.id,
                    title: task.title,
                    isComplete: task.isComplete
                )
            }.execute(db)
        }
    }
}
```

## CloudKit Sharing

**SwiftData limitation**: Can only sync, cannot share records

**SQLiteData advantage**:
```swift
// Full CloudKit sharing support
let share = CKShare(rootRecord: record)
try await database.share(record, with: share)
```

## Performance Comparison

| Operation | SwiftData | SQLiteData |
|-----------|-----------|------------|
| Insert 50k | ~60s | ~30s |
| Fetch 10k | ~2s | ~0.5s |
| Complex query | Core Data layer | Direct SQL |

## Related Resources

- [sqlitedata](/skills/persistence/sqlitedata) — SQLiteData patterns
- [swiftdata](/skills/persistence/swiftdata) — SwiftData patterns
- [database-migration](/skills/persistence/database-migration) — Safe schema evolution
