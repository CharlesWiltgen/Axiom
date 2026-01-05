---
name: swiftdata
description: Use when working with SwiftData — @Model definitions, @Query in SwiftUI, @Relationship macros, ModelContext patterns, CloudKit integration, iOS 26+ features, and Swift 6 concurrency with @MainActor — Apple's native persistence framework
---

# SwiftData

Apple's native persistence framework using `@Model` classes and declarative queries. Built on Core Data, designed for SwiftUI.

## When to Use This Skill

Use this skill when you're:
- Defining `@Model` classes and relationships
- Writing `@Query` in SwiftUI views
- Setting up `ModelContainer` and `ModelContext`
- Integrating CloudKit sync
- Handling Swift 6 concurrency with `@MainActor`
- Migrating from Realm or Core Data

**Not sure if SwiftData is right?** Choose SwiftData for native Apple integration with automatic SwiftUI updates. Use SQLiteData for value types or CloudKit record sharing. Use GRDB for complex raw SQL.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "I have a notes app with folders. How do I filter notes by folder and sort by last modified with @Query?"
- "When a user deletes a task list, all tasks should auto-delete. How do I set up the relationship?"
- "I'm adding CloudKit sync but get 'Property must have a default value' error. What's wrong?"
- "My app loads 100 tasks with relationships slowly. I think it's N+1 queries. How do I fix this?"
- "We're migrating from Realm to SwiftData. What are the biggest code differences?"
- "How do I handle CloudKit sync conflicts in my chat app?"
- "Which properties should I add indexes to without slowing down writes?"

## What's Covered

### Core Patterns
- `@Model` definitions with `@Attribute` and `@Relationship`
- `@Query` with predicates, sorting, and filtering
- `ModelContainer` setup (SwiftUI app, custom config, in-memory for tests)
- `ModelContext` operations (insert, fetch, update, delete, batch)

### CloudKit Integration
- Enabling sync with `ModelConfiguration`
- CloudKit constraints (optional/default properties)
- Sync status monitoring and offline handling
- Conflict resolution strategies
- Record sharing (iOS 26+)

### Performance
- Prefetching relationships (prevent N+1 queries)
- Batch operations and chunked imports
- Index optimization (iOS 26+)
- Faulting strategies

### Swift 6 Concurrency
- `@MainActor` isolation for models
- Background context patterns with actors
- Safe async/await patterns

### Migration Strategies
- Realm → SwiftData pattern equivalents
- Core Data → SwiftData migration
- Dual-stack gradual migration
- CloudKit sync migration from Realm Sync

## Key Pattern

### Preventing N+1 Queries

```swift
// ❌ SLOW: 101 queries (1 + 100 for each album)
let tracks = try modelContext.fetch(FetchDescriptor<Track>())
for track in tracks {
    print(track.album?.title)  // Separate query each time
}

// ✅ FAST: 2 queries total
let descriptor = FetchDescriptor<Track>()
descriptor.relationshipKeyPathsForPrefetching = [\.album]
let tracks = try modelContext.fetch(descriptor)
for track in tracks {
    print(track.album?.title)  // Already loaded
}
```

## Documentation Scope

This page documents the `axiom-swiftdata` skill—comprehensive SwiftData guidance Claude uses when answering your questions. The skill contains detailed API patterns, code examples, CloudKit configuration, and migration workflows.

**For schema migrations:** Use [database-migration](/skills/persistence/database-migration) when adding or modifying database columns safely.

## Related

- [database-migration](/skills/persistence/database-migration) — Safe schema evolution patterns for adding/modifying columns
- [sqlitedata](/skills/persistence/sqlitedata) — Alternative using value types (structs) with CloudKit record sharing
- [grdb](/skills/persistence/grdb) — Raw SQL queries when fine-grained control is needed
- [swift-concurrency](/skills/concurrency/swift-concurrency) — @MainActor and actor patterns for Swift 6

## Resources

**WWDC**: 2023-10187, 2023-10195, 2024-10137, 2025-10138

**Docs**: /swiftdata, /swiftdata/model, /swiftdata/query
