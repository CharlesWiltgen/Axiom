# core-data

Core Data stack setup, concurrency patterns, relationship modeling, and migration strategies for apps targeting iOS 16 and earlier or needing advanced features.

## When to Use

- Targeting iOS 16 or earlier (SwiftData unavailable)
- Need public CloudKit database (SwiftData is private-only)
- Need custom migration logic
- Maintaining existing Core Data codebase
- Need advanced features not in SwiftData

## Key Features

### Core Data vs SwiftData Decision
- **SwiftData (iOS 17+)** — New apps, simpler API, Swift-native
- **Core Data** — iOS 16 and earlier, advanced features, existing codebases

### The Golden Rule
**NEVER pass NSManagedObject across threads.** Pass objectID instead.

### Modern Stack Setup
- NSPersistentContainer (iOS 10+)
- Automatic merge from parent context
- Background context factory

### Concurrency Patterns
- `context.perform {}` for all context operations
- `newBackgroundContext()` for heavy work
- Async/await support (iOS 15+)

## Quick Reference

```swift
// Setup
let container = NSPersistentContainer(name: "Model")
container.viewContext.automaticallyMergesChangesFromParent = true

// Background work (CORRECT)
let bgContext = container.newBackgroundContext()
try await bgContext.perform {
    for item in items {
        let entity = Entity(context: bgContext)
        entity.configure(from: item)
    }
    try bgContext.save()
}

// Pass objectID across threads, not the object
let userID = user.objectID
Task.detached {
    let user = bgContext.object(with: userID)
}
```

## Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Singleton context | Concurrency crashes | Context per operation |
| Passing objects across threads | Thread-confinement violation | Pass objectID |
| Fetching in view body | Repeated fetches | Use @FetchRequest |
| No merge policy | Conflicts crash | Set mergePolicy |
| Simulator-only testing | Hides migration issues | Test on real device |

## Migration Checklist

**MANDATORY before shipping schema changes**:

1. ✓ Test on REAL DEVICE (simulator hides issues)
2. ✓ Install old version, create data
3. ✓ Install new version over it
4. ✓ Verify all data accessible
5. ✓ Check migration performance

## Related

- **core-data-diag** — Debugging migrations, thread errors, N+1 queries
- **swiftdata** — Modern alternative for iOS 17+
- **database-migration** — Safe schema evolution patterns
- **swift-concurrency** — Async/await patterns

## Resources

- [Core Data Programming Guide](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/CoreData/)
- [WWDC 2019: Making Apps with Core Data](https://developer.apple.com/videos/play/wwdc2019/230/)
