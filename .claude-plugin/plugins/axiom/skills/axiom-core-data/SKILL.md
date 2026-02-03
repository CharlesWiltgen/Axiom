---
name: axiom-core-data
description: Use when choosing Core Data vs SwiftData, setting up the Core Data stack, modeling relationships, or implementing concurrency patterns - prevents thread-confinement errors and migration crashes
license: MIT
compatibility: iOS 3+, macOS 10.4+
metadata:
  version: "1.0.0"
  last-updated: "2025-12-25"
---

# Core Data

## Overview

**Core principle**: Core Data is a mature object graph and persistence framework. Use it when needing features SwiftData doesn't support, or when targeting older iOS versions.

**When to use Core Data vs SwiftData**:
- **SwiftData** (iOS 17+) — New apps, simpler API, Swift-native
- **Core Data** — iOS 16 and earlier, advanced features, existing codebases

## Quick Decision Tree

```
Which persistence framework?

├─ Targeting iOS 17+ only?
│  ├─ Simple data model? → SwiftData (recommended)
│  ├─ Need public CloudKit database? → Core Data (SwiftData is private-only)
│  ├─ Need custom migration logic? → Core Data (more control)
│  └─ Existing Core Data app? → Keep Core Data or migrate gradually
│
├─ Targeting iOS 16 or earlier?
│  └─ Core Data (SwiftData unavailable)
│
└─ Need both? → Use Core Data with SwiftData wrapper (advanced)
```

## Red Flags

If ANY of these appear, STOP:

- ❌ "Access managed objects on any thread" — Thread-confinement violation
- ❌ "Skip migration testing on real device" — Simulator hides schema issues
- ❌ "Use a singleton context everywhere" — Leads to concurrency crashes
- ❌ "Force lightweight migration always" — Complex changes need mapping models
- ❌ "Fetch in view body" — Use @FetchRequest or observe in view model

## Core Data Stack Setup

### Modern Stack (iOS 10+)

```swift
import CoreData

class CoreDataStack {
    static let shared = CoreDataStack()

    lazy var persistentContainer: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "Model")

        // Configure for CloudKit if needed
        // container.persistentStoreDescriptions.first?.cloudKitContainerOptions =
        //     NSPersistentCloudKitContainerOptions(containerIdentifier: "iCloud.com.app")

        container.loadPersistentStores { description, error in
            if let error = error {
                // Handle appropriately for production
                fatalError("Failed to load store: \(error)")
            }
        }

        // Enable automatic merging
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy

        return container
    }()

    var viewContext: NSManagedObjectContext {
        persistentContainer.viewContext
    }

    func newBackgroundContext() -> NSManagedObjectContext {
        persistentContainer.newBackgroundContext()
    }
}
```

### CloudKit Integration

```swift
import CoreData

class CloudKitStack {
    lazy var container: NSPersistentCloudKitContainer = {
        let container = NSPersistentCloudKitContainer(name: "Model")

        guard let description = container.persistentStoreDescriptions.first else {
            fatalError("No store description")
        }

        // Enable CloudKit sync
        description.cloudKitContainerOptions = NSPersistentCloudKitContainerOptions(
            containerIdentifier: "iCloud.com.yourapp"
        )

        // Enable history tracking for sync
        description.setOption(true as NSNumber,
                             forKey: NSPersistentHistoryTrackingKey)
        description.setOption(true as NSNumber,
                             forKey: NSPersistentStoreRemoteChangeNotificationPostOptionKey)

        container.loadPersistentStores { _, error in
            if let error = error {
                fatalError("CloudKit store failed: \(error)")
            }
        }

        container.viewContext.automaticallyMergesChangesFromParent = true

        return container
    }()
}
```

## Concurrency Patterns

### The Golden Rule

**NEVER pass NSManagedObject across threads.** Pass objectID instead.

```swift
// ❌ WRONG: Passing object across threads
let user = viewContext.fetch(...)  // Main thread
Task.detached {
    print(user.name)  // CRASH: Wrong thread
}

// ✅ CORRECT: Pass objectID, fetch on target context
let userID = user.objectID
Task.detached {
    let bgContext = CoreDataStack.shared.newBackgroundContext()
    let user = bgContext.object(with: userID) as! User
    print(user.name)  // Safe
}
```

### Background Processing

```swift
// ✅ CORRECT: Background context for heavy work
func importData(_ items: [ImportItem]) async throws {
    let context = CoreDataStack.shared.newBackgroundContext()

    try await context.perform {
        for item in items {
            let entity = Entity(context: context)
            entity.configure(from: item)
        }

        try context.save()
    }
}

// Changes automatically merge to viewContext if configured
```

### Async/Await (iOS 15+)

```swift
// Modern async context operations
func fetchUsers() async throws -> [User] {
    let context = CoreDataStack.shared.viewContext

    return try await context.perform {
        let request = User.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(key: "name", ascending: true)]
        return try context.fetch(request)
    }
}
```

## Relationship Modeling

### One-to-Many

```swift
// In User entity
@NSManaged var posts: NSSet?

// Convenience accessors
extension User {
    var postsArray: [Post] {
        (posts?.allObjects as? [Post]) ?? []
    }

    func addPost(_ post: Post) {
        mutableSetValue(forKey: "posts").add(post)
    }
}
```

### Many-to-Many

```swift
// Both sides have NSSet
// User.tags <-> Tag.users

extension User {
    func addTag(_ tag: Tag) {
        mutableSetValue(forKey: "tags").add(tag)
        // Core Data automatically adds to tag.users
    }
}
```

### Delete Rules

| Rule | Behavior | Use Case |
|------|----------|----------|
| **Nullify** | Set relationship to nil | Optional relationships |
| **Cascade** | Delete related objects | Owned children (User → Posts) |
| **Deny** | Prevent deletion if related objects exist | Protect referenced data |
| **No Action** | Do nothing (manual cleanup required) | Rarely appropriate |

## Fetching Patterns

### SwiftUI Integration

```swift
struct UserList: View {
    @FetchRequest(
        sortDescriptors: [NSSortDescriptor(keyPath: \User.name, ascending: true)],
        predicate: NSPredicate(format: "isActive == YES"),
        animation: .default
    )
    private var users: FetchedResults<User>

    var body: some View {
        List(users) { user in
            Text(user.name ?? "Unknown")
        }
    }
}

// Dynamic predicates
struct FilteredList: View {
    @FetchRequest var items: FetchedResults<Item>

    init(category: String) {
        _items = FetchRequest(
            sortDescriptors: [NSSortDescriptor(keyPath: \Item.date, ascending: false)],
            predicate: NSPredicate(format: "category == %@", category)
        )
    }
}
```

### Batch Fetching (Avoid N+1)

```swift
// ❌ WRONG: N+1 queries
let users = try context.fetch(User.fetchRequest())
for user in users {
    print(user.posts?.count ?? 0)  // Fault fired for each user
}

// ✅ CORRECT: Prefetch relationships
let request = User.fetchRequest()
request.relationshipKeyPathsForPrefetching = ["posts"]
let users = try context.fetch(request)
for user in users {
    print(user.posts?.count ?? 0)  // Already loaded
}
```

### Batch Size for Large Datasets

```swift
let request = User.fetchRequest()
request.fetchBatchSize = 20  // Load 20 at a time as needed
request.returnsObjectsAsFaults = true  // Default, memory efficient
```

## Schema Migration

### Lightweight Migration (Automatic)

Handled automatically for:
- Adding optional attributes
- Removing attributes
- Renaming (with renaming identifier)
- Adding relationships with optional or default value

```swift
let description = NSPersistentStoreDescription()
description.shouldMigrateStoreAutomatically = true
description.shouldInferMappingModelAutomatically = true
```

### When Mapping Model Is Needed

- Changing attribute types
- Splitting/merging entities
- Complex relationship changes
- Data transformation during migration

```swift
// Create mapping model in Xcode:
// File → New → Mapping Model
// Select source and destination models
```

### Migration Testing Checklist

**MANDATORY before shipping**:

1. ✓ Test on REAL DEVICE (simulator deletes DB on rebuild)
2. ✓ Install old version, create data
3. ✓ Install new version over it
4. ✓ Verify all data accessible
5. ✓ Check migration performance (large datasets)

## Anti-Patterns

### 1. Singleton Context for Everything

```swift
// ❌ WRONG: One context for all operations
class DataManager {
    let context = CoreDataStack.shared.viewContext

    func importInBackground() {
        // Using main context on background = crash
        for item in largeDataset {
            let entity = Entity(context: context)
        }
    }
}

// ✅ CORRECT: Context per operation type
func importInBackground() {
    let bgContext = CoreDataStack.shared.newBackgroundContext()
    bgContext.perform {
        // Safe background work
    }
}
```

### 2. Fetching in View Body

```swift
// ❌ WRONG: Fetch on every render
var body: some View {
    let users = try? context.fetch(User.fetchRequest())  // Called repeatedly!
    List(users ?? []) { ... }
}

// ✅ CORRECT: Use @FetchRequest
@FetchRequest(sortDescriptors: [])
var users: FetchedResults<User>

var body: some View {
    List(users) { ... }  // Automatic updates
}
```

### 3. Ignoring Merge Policy

```swift
// ❌ WRONG: No merge policy (conflicts crash)
let context = container.viewContext

// ✅ CORRECT: Define merge behavior
context.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
context.automaticallyMergesChangesFromParent = true
```

## Performance Tips

1. **Use fetchBatchSize** for large result sets
2. **Prefetch relationships** that will be accessed
3. **Use background contexts** for imports/exports
4. **Batch save** — don't save after each insert
5. **Use fetchLimit** when only first N results are needed
6. **Profile with SQL debug**: `-com.apple.CoreData.SQLDebug 1`

## Pressure Scenarios

### Scenario 1: "SwiftData is simpler, let's migrate now"

**Situation**: New iOS 17 features available, temptation to migrate mid-project.

**Risk**: Migration is complex. Mixed Core Data + SwiftData has sharp edges.

**Response**: "Complete current milestone first. Migration needs dedicated time and testing."

### Scenario 2: "Skip migration testing, simulator works"

**Situation**: Schema change tested only in simulator.

**Risk**: Simulator deletes database on rebuild. Real devices keep persistent data and crash.

**Response**: "MANDATORY: Test on real device with real data. 15 minutes now prevents production crash."

## Related Skills

- `axiom-core-data-diag` — Debugging migrations, thread errors, N+1 queries
- `axiom-swiftdata` — Modern alternative for iOS 17+
- `axiom-database-migration` — Safe schema evolution patterns
- `axiom-swift-concurrency` — Async/await patterns for Core Data
