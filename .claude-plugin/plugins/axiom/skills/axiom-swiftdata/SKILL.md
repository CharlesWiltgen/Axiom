---
name: axiom-swiftdata
description: Use when working with SwiftData - @Model definitions, @Query in SwiftUI, @Relationship macros, ModelContext patterns, CloudKit integration, iOS 26+ features, and Swift 6 concurrency with @MainActor — Apple's native persistence framework
license: MIT
metadata:
  version: "1.0.0"
---

# SwiftData

## Overview

Apple's native persistence framework using `@Model` classes and declarative queries. Built on Core Data, designed for SwiftUI.

**Core principle** Reference types (`class`) + `@Model` macro + declarative `@Query` for reactive SwiftUI integration.

**Requires** iOS 17+, Swift 5.9+
**Target** iOS 26+ (this skill focuses on latest features)
**License** Proprietary (Apple)

## When to Use SwiftData

#### Choose SwiftData when you need
- ✅ Native Apple integration with SwiftUI
- ✅ Simple CRUD operations
- ✅ Automatic UI updates with `@Query`
- ✅ CloudKit sync (iOS 17+)
- ✅ Reference types (classes) with relationships

#### Use SQLiteData instead when
- Need value types (structs)
- CloudKit record sharing (not just sync)
- Large datasets (50k+ records) with specific performance needs

#### Use GRDB when
- Complex raw SQL required
- Fine-grained migration control needed

**For migrations** See the `axiom-swiftdata-migration` skill for custom schema migrations with VersionedSchema and SchemaMigrationPlan. For migration debugging, see `axiom-swiftdata-migration-diag`.

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

#### Basic Operations

#### 1. "I have a notes app with folders. I need to filter notes by folder and sort by last modified. How do I set up the @Query?"
→ The skill shows how to use `@Query` with predicates, sorting, and automatic view updates

#### 2. "When a user deletes a task list, all tasks should auto-delete too. How do I set up the relationship?"
→ The skill explains `@Relationship` with `deleteRule: .cascade` and inverse relationships

#### 3. "I have a relationship between User → Messages → Attachments. How do I prevent orphaned data when deleting?"
→ The skill shows cascading deletes, inverse relationships, and safe deletion patterns

#### CloudKit & Sync

#### 4. "My chat app syncs messages to other devices via CloudKit. Sometimes messages conflict. How do I handle sync conflicts?"
→ The skill covers CloudKit integration, conflict resolution strategies (last-write-wins, custom resolution), and sync patterns

#### 5. "I'm adding CloudKit sync to my app, but I get 'Property must have a default value' error. What's wrong?"
→ The skill explains CloudKit constraints: all properties must be optional or have defaults, explains why (network timing), and shows fixes

#### 6. "I want to show users when their data is syncing to iCloud and what happens when they're offline."
→ The skill shows monitoring sync status with notifications, detecting network connectivity, and offline-aware UI patterns

#### 7. "I need to share a playlist with other users. How do I implement CloudKit record sharing?"
→ The skill covers CloudKit record sharing patterns (iOS 26+) with owner/permission tracking and sharing metadata

#### Performance & Optimization

#### 8. "I need to query 50,000 messages but only display 20 at a time. How do I paginate efficiently?"
→ The skill covers performance patterns, batch fetching, limiting queries, and preventing memory bloat with chunked imports

#### 9. "My app loads 100 tasks with relationships, and displaying them is slow. I think it's N+1 queries."
→ The skill shows how to identify N+1 problems without prefetching, provides prefetching pattern, and shows 100x performance improvement

#### 10. "I'm importing 1 million records from an API. What's the best way to batch them without running out of memory?"
→ The skill shows chunk-based importing with periodic saves, memory cleanup patterns, and batch operation optimization

#### 11. "Which properties should I add indexes to? I'm worried about over-indexing slowing down writes."
→ The skill explains index optimization patterns: when to index (frequently filtered/sorted properties), when to avoid (rarely used, frequently changing), maintenance costs

#### Migration from Legacy Frameworks

#### 12. "We're migrating from Realm/Core Data to SwiftData"
→ See the comparison table in Migration section below, then follow `realm-to-swiftdata-migration` or `axiom-swiftdata-migration` for detailed guides

---

## @Model Definitions

### Basic Model

```swift
import SwiftData

@Model
final class Track {
    @Attribute(.unique) var id: String
    var title: String
    var artist: String
    var duration: TimeInterval
    var genre: String?

    init(id: String, title: String, artist: String, duration: TimeInterval, genre: String? = nil) {
        self.id = id
        self.title = title
        self.artist = artist
        self.duration = duration
        self.genre = genre
    }
}
```

#### Key patterns
- Use `final class`, not `struct`
- Use `@Attribute(.unique)` for primary key-like behavior
- Provide explicit `init` (SwiftData doesn't synthesize)
- Optional properties (`String?`) are nullable

### Relationships

```swift
@Model
final class Track {
    @Attribute(.unique) var id: String
    var title: String

    @Relationship(deleteRule: .cascade, inverse: \Album.tracks)
    var album: Album?

    init(id: String, title: String, album: Album? = nil) {
        self.id = id
        self.title = title
        self.album = album
    }
}

@Model
final class Album {
    @Attribute(.unique) var id: String
    var title: String

    @Relationship(deleteRule: .cascade)
    var tracks: [Track] = []

    init(id: String, title: String) {
        self.id = id
        self.title = title
    }
}
```

### Many-to-Many Self-Referential Relationships

```swift
@MainActor  // Required for Swift 6 strict concurrency
@Model
final class User {
    @Attribute(.unique) var id: String
    var name: String

    // Users following this user (inverse relationship)
    @Relationship(deleteRule: .nullify, inverse: \User.following)
    var followers: [User] = []

    // Users this user is following
    @Relationship(deleteRule: .nullify)
    var following: [User] = []

    init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}
```

#### CRITICAL: SwiftData automatically manages BOTH sides when you modify ONE side.

✅ **Correct — Only modify ONE side**
```swift
// user1 follows user2 (modifying ONE side)
user1.following.append(user2)
try modelContext.save()

// SwiftData AUTOMATICALLY updates user2.followers
// Don't manually append to both sides - causes duplicates!
```

❌ **Wrong — Don't manually update both sides**
```swift
user1.following.append(user2)
user2.followers.append(user1)  // Redundant! Creates duplicates in CloudKit sync
```

#### Unfollowing (remove from ONE side only)
```swift
user1.following.removeAll { $0.id == user2.id }
try modelContext.save()
// user2.followers automatically updated
```

#### Verifying relationship integrity (for debugging)
```swift
// Check if relationship is truly bidirectional
let user1FollowsUser2 = user1.following.contains { $0.id == user2.id }
let user2FollowedByUser1 = user2.followers.contains { $0.id == user1.id }

// These MUST always match after save()
assert(user1FollowsUser2 == user2FollowedByUser1, "Relationship corrupted!")
```

#### CloudKit Sync Recovery (if relationships become corrupted)
```swift
// If CloudKit sync creates duplicate/orphaned relationships:

// 1. Backup current state
let backup = user.following.map { $0.id }

// 2. Clear relationships
user.following.removeAll()
user.followers.removeAll()
try modelContext.save()

// 3. Rebuild from source of truth (e.g., API)
for followingId in backup {
    if let followingUser = fetchUser(id: followingId) {
        user.following.append(followingUser)
    }
}
try modelContext.save()

// 4. Force CloudKit resync (in ModelConfiguration)
// Re-create ModelContainer to force full sync after corruption recovery
```

#### Delete rules
- `.cascade` - Delete related objects
- `.nullify` - Set relationship to nil
- `.deny` - Prevent deletion if relationship exists
- `.noAction` - Leave relationship as-is (careful!)

## ModelContainer Setup

### SwiftUI App

```swift
import SwiftUI
import SwiftData

@main
struct MusicApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [Track.self, Album.self])
    }
}
```

### Custom Configuration

```swift
let schema = Schema([Track.self, Album.self])

let config = ModelConfiguration(
    schema: schema,
    url: URL(fileURLWithPath: "/path/to/database.sqlite"),
    cloudKitDatabase: .private("iCloud.com.example.app")
)

let container = try ModelContainer(
    for: schema,
    configurations: config
)
```

### In-Memory (Tests)

```swift
let config = ModelConfiguration(isStoredInMemoryOnly: true)
let container = try ModelContainer(
    for: schema,
    configurations: config
)
```

## Queries in SwiftUI

### Basic @Query

```swift
import SwiftUI
import SwiftData

struct TracksView: View {
    @Query var tracks: [Track]

    var body: some View {
        List(tracks) { track in
            Text(track.title)
        }
    }
}
```

**Automatic updates** View refreshes when data changes.

### Filtered, Sorted, Combined

```swift
// Filtered
@Query(filter: #Predicate<Track> { $0.genre == "Rock" }) var rockTracks: [Track]

// Sorted (single)
@Query(sort: \.title, order: .forward) var tracks: [Track]

// Sorted (multiple descriptors)
@Query(sort: [SortDescriptor(\.artist), SortDescriptor(\.title)]) var tracks: [Track]

// Combined filter + sort
@Query(filter: #Predicate<Track> { $0.duration > 180 }, sort: \.title) var longTracks: [Track]
```

## ModelContext Operations

### Accessing ModelContext

```swift
struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    // ...
}
```

### CRUD Operations

```swift
// Insert
let track = Track(id: "1", title: "Song", artist: "Artist", duration: 240)
modelContext.insert(track)

// Fetch
let descriptor = FetchDescriptor<Track>(
    predicate: #Predicate { $0.genre == "Rock" },
    sortBy: [SortDescriptor(\.title)]
)
let rockTracks = try modelContext.fetch(descriptor)

// Update — just modify properties, SwiftData tracks changes
track.title = "Updated Title"

// Delete
modelContext.delete(track)

// Batch delete
try modelContext.delete(model: Track.self, where: #Predicate { $0.genre == "Classical" })

// Save (optional — auto-saves on view disappear)
try modelContext.save()
```

## Predicates

### Basic Comparisons

```swift
#Predicate<Track> { $0.duration > 180 }
#Predicate<Track> { $0.artist == "Artist Name" }
#Predicate<Track> { $0.genre != nil }
```

### Compound Predicates

```swift
#Predicate<Track> { track in
    track.genre == "Rock" && track.duration > 180
}

#Predicate<Track> { track in
    track.artist == "Artist" || track.artist == "Other Artist"
}
```

### String Matching

```swift
// Contains
#Predicate<Track> { track in
    track.title.contains("Love")
}

// Case-insensitive contains
#Predicate<Track> { track in
    track.title.localizedStandardContains("love")
}

// Starts with
#Predicate<Track> { track in
    track.artist.hasPrefix("The ")
}
```

### Relationship Predicates

```swift
#Predicate<Track> { track in
    track.album?.title == "Album Name"
}

#Predicate<Album> { album in
    album.tracks.count > 10
}
```

## Swift 6 Concurrency

### @MainActor Isolation

```swift
import SwiftData

@MainActor
@Model
final class Track {
    var id: String
    var title: String

    init(id: String, title: String) {
        self.id = id
        self.title = title
    }
}
```

**Why** SwiftData models are not `Sendable`. Use `@MainActor` to ensure safe access from SwiftUI.

### Background Context

```swift
import SwiftData

actor DataImporter {
    let modelContainer: ModelContainer

    init(container: ModelContainer) {
        self.modelContainer = container
    }

    func importTracks(_ tracks: [TrackData]) async throws {
        // Create background context
        let context = ModelContext(modelContainer)

        for track in tracks {
            let model = Track(
                id: track.id,
                title: track.title,
                artist: track.artist,
                duration: track.duration
            )
            context.insert(model)
        }

        try context.save()
    }
}
```

**Pattern** Use `ModelContext(modelContainer)` for background operations, not `@Environment(\.modelContext)` which is main-actor bound.

## CloudKit Integration

### Enable CloudKit Sync

```swift
let schema = Schema([Track.self])

let config = ModelConfiguration(
    schema: schema,
    cloudKitDatabase: .private("iCloud.com.example.MusicApp")
)

let container = try ModelContainer(
    for: schema,
    configurations: config
)
```

### Capabilities Required

1. Enable iCloud in Xcode (Signing & Capabilities)
2. Select CloudKit
3. Add iCloud container: `iCloud.com.example.MusicApp`

**Note** SwiftData CloudKit sync is automatic - no manual conflict resolution needed.

### CloudKit Constraints (CRITICAL)

#### When using CloudKit sync, ALL properties must be optional or have default values

```swift
@Model
final class Track {
    @Attribute(.unique) var id: String = UUID().uuidString  // ✅ Has default
    var title: String = ""  // ✅ Has default
    var duration: TimeInterval = 0  // ✅ Has default
    var genre: String? = nil  // ✅ Optional

    // ❌ These don't work with CloudKit:
    // var requiredField: String  // No default, not optional
}
```

**Why** CloudKit only syncs to private zones, and network delays mean new records may not have all fields populated yet.

**Relationship Constraint** All relationships must be optional
```swift
@Model
final class Track {
    @Relationship(deleteRule: .cascade, inverse: \Album.tracks)
    var album: Album?  // ✅ Must be optional for CloudKit
}
```

### Sync Status, Conflicts, Offline Handling

SwiftData CloudKit sync uses **last-write-wins** by default. For sync status monitoring, custom conflict resolution, and offline-aware UI patterns, see `axiom-cloud-sync`. For CKShare-based record sharing, see `axiom-cloudkit-ref`.

### Resolving "Property must be optional or have default value" Error

**Problem** You get this error when trying to use CloudKit sync:
```
Property 'title' must be optional or have a default value for CloudKit synchronization
```

#### Solution
```swift
// ❌ Wrong - required property
@Model
final class Track {
    var title: String
}

// ✅ Correct - has default
@Model
final class Track {
    var title: String = ""
}

// ✅ Also correct - optional
@Model
final class Track {
    var title: String?
}
```

### Testing CloudKit Sync (Without iCloud)

```swift
let schema = Schema([Track.self])

// Test configuration (no CloudKit sync)
let testConfig = ModelConfiguration(isStoredInMemoryOnly: true)

let container = try ModelContainer(for: schema, configurations: testConfig)
```

#### For real CloudKit testing
1. Sign in to iCloud on test device
2. Enable CloudKit in Capabilities
3. Use real device (simulator CloudKit is unreliable)
4. Check iCloud status in Settings → [Your Name] → iCloud

## iOS 26+ Features

### Enhanced Relationship Handling

```swift
@Model
final class Track {
    @Relationship(
        deleteRule: .cascade,
        inverse: \Album.tracks,
        minimum: 0,
        maximum: 1  // Track belongs to at most one album
    ) var album: Album?
}
```

### Transient Properties

```swift
@Model
final class Track {
    var id: String
    var duration: TimeInterval

    @Transient
    var formattedDuration: String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
```

**Transient** Computed property, not persisted.

### History Tracking

```swift
// Enable history tracking
let config = ModelConfiguration(
    schema: schema,
    cloudKitDatabase: .private("iCloud.com.example.app"),
    allowsSave: true,
    isHistoryEnabled: true  // iOS 26+
)
```

## Performance Patterns

### Batch Fetching

```swift
let descriptor = FetchDescriptor<Track>(
    sortBy: [SortDescriptor(\.title)]
)
descriptor.fetchLimit = 100  // Paginate results

let tracks = try modelContext.fetch(descriptor)
```

### Prefetch Relationships (Prevent N+1 Queries)

```swift
let descriptor = FetchDescriptor<Track>()
descriptor.relationshipKeyPathsForPrefetching = [\.album]  // Eager load album

let tracks = try modelContext.fetch(descriptor)
// No N+1 queries - albums already loaded
```

**CRITICAL** Without prefetching, accessing `track.album.title` in a loop triggers individual queries for EACH track:

```swift
// ❌ SLOW: N+1 queries (1 fetch tracks + 100 fetch albums)
let tracks = try modelContext.fetch(FetchDescriptor<Track>())
for track in tracks {
    print(track.album?.title)  // 100 separate queries!
}

// ✅ FAST: 2 queries total (1 fetch tracks + 1 fetch all albums)
let descriptor = FetchDescriptor<Track>()
descriptor.relationshipKeyPathsForPrefetching = [\.album]
let tracks = try modelContext.fetch(descriptor)
for track in tracks {
    print(track.album?.title)  // Already loaded
}
```

### Faulting (Lazy Loading)

SwiftData uses faulting (lazy loading) by default:

```swift
let track = tracks.first
// Album is a fault - not loaded yet

let albumTitle = track.album?.title
// Album loaded on access (separate query)
```

#### Use faulting strategically
- ✅ Good when you access relationships in only 10-20% of cases
- ✅ Good for large relationship graphs you partially use
- ❌ Bad when you access relationships in loops → use prefetching instead

### Batch Operations (Performance for Large Datasets)

```swift
// ❌ SLOW: 1000 individual saves
for track in largeDataset {
    track.genre = "Updated"
    try modelContext.save()  // Expensive - 1000 times
}

// ✅ FAST: Single save operation
for track in largeDataset {
    track.genre = "Updated"
}
try modelContext.save()  // Once for entire batch
```

### Index Optimization (iOS 26+)

Create indexes on frequently queried properties:

```swift
@Model
final class Track {
    @Attribute(.unique) var id: String = UUID().uuidString

    @Attribute(.indexed)  // ✅ Add index
    var genre: String = ""

    @Attribute(.indexed)
    var releaseDate: Date = Date()

    var title: String = ""
    var duration: TimeInterval = 0
}

// Now these queries are faster:
@Query(filter: #Predicate { $0.genre == "Rock" }) var rockTracks: [Track]
@Query(filter: #Predicate { $0.releaseDate > Date() }) var upcomingTracks: [Track]
```

#### When to add indexes
- ✅ Properties used in `@Query` filters frequently
- ✅ Properties used in sort operations
- ✅ Properties used in relationships
- ❌ NOT properties that are rarely filtered
- ❌ NOT properties that change frequently (maintenance cost)

### Memory Optimization: Fetch Chunks

For very large datasets (100k+ records), fetch in chunks:

```swift
actor DataImporter {
    let modelContainer: ModelContainer

    func importLargeDataset(_ items: [Item]) async throws {
        let chunkSize = 1000
        let context = ModelContext(modelContainer)

        for chunk in items.chunked(into: chunkSize) {
            for item in chunk {
                let track = Track(
                    id: item.id,
                    title: item.title,
                    artist: item.artist,
                    duration: item.duration
                )
                context.insert(track)
            }

            try context.save()  // Save after each chunk

            // Prevent memory bloat
            context.delete(model: Track.self, where: #Predicate { _ in true })
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

### Avoiding Retain Cycles in CloudKit Sync

When using CloudKit, avoid capturing `self` in closures:

```swift
// ❌ Retain cycle with CloudKit sync
actor TrackManager {
    func startSync() {
        Task {
            for await notification in NotificationCenter.default
                .notifications(named: NSNotification.Name("CloudKitSyncDidComplete")) {
                self.refreshUI()  // Potential retain cycle
            }
        }
    }
}

// ✅ Proper weak capture
actor TrackManager {
    func startSync() {
        Task { [weak self] in
            guard let self else { return }
            for await notification in NotificationCenter.default
                .notifications(named: NSNotification.Name("CloudKitSyncDidComplete")) {
                await self.refreshUI()
            }
        }
    }
}
```

## Common Patterns

### Search

```swift
struct SearchableTracksView: View {
    @Query var tracks: [Track]
    @State private var searchText = ""

    var filteredTracks: [Track] {
        if searchText.isEmpty {
            return tracks
        }
        return tracks.filter { track in
            track.title.localizedStandardContains(searchText) ||
            track.artist.localizedStandardContains(searchText)
        }
    }

    var body: some View {
        List(filteredTracks) { track in
            Text(track.title)
        }
        .searchable(text: $searchText)
    }
}
```

### Custom Sort

```swift
struct TracksView: View {
    @Query var tracks: [Track]
    @State private var sortOrder: SortOrder = .title

    enum SortOrder {
        case title, artist, duration
    }

    var sortedTracks: [Track] {
        switch sortOrder {
        case .title:
            return tracks.sorted { $0.title < $1.title }
        case .artist:
            return tracks.sorted { $0.artist < $1.artist }
        case .duration:
            return tracks.sorted { $0.duration < $1.duration }
        }
    }
}
```

### Undo/Redo

```swift
struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.undoManager) private var undoManager

    func deleteTrack(_ track: Track) {
        modelContext.delete(track)

        // Undo is automatic with modelContext
        // Use Cmd+Z to undo
    }
}
```

## Migration from Realm & Core Data

### Key Differences at a Glance

| Concept | Realm | Core Data | SwiftData |
|---|---|---|---|
| Model definition | `Object` subclass + `@Persisted` | `NSManagedObject` + `@NSManaged` | `final class` + `@Model` |
| Primary key | `@Persisted(primaryKey:)` | Entity inspector | `@Attribute(.unique)` |
| Threading | Manual per-thread Realm instances | `context.perform {}` blocks | Actor isolation + `ModelContext(container)` |
| Relationships | `RealmSwiftCollection<T>` | Entity editor + `@NSManaged` | `@Relationship` with automatic inverses |
| Background work | `DispatchQueue` + thread-local Realm | `newBackgroundContext()` | `actor` + `ModelContext(modelContainer)` |
| Batch delete | Loop + `realm.delete()` | `NSBatchDeleteRequest` | `context.delete(model:where:)` |
| CloudKit sync | Realm Sync (deprecated Sept 2025) | `NSPersistentCloudKitContainer` | `ModelConfiguration(cloudKitDatabase:)` |

### Detailed Migration Guides

- **`realm-to-swiftdata-migration`** — Complete Realm migration: pattern equivalents, thread safety conversion, relationship migration, CloudKit sync transition, timeline planning
- **`axiom-swiftdata-migration`** — SwiftData schema evolution: VersionedSchema, SchemaMigrationPlan, lightweight vs custom migrations
- **`axiom-database-migration`** — Safe additive migration patterns applicable to any persistence framework

## Testing

### Test Setup

```swift
import XCTest
import SwiftData
@testable import MusicApp

final class TrackTests: XCTestCase {
    var modelContext: ModelContext!

    override func setUp() async throws {
        let schema = Schema([Track.self])
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: schema, configurations: config)
        modelContext = ModelContext(container)
    }

    func testInsertTrack() throws {
        let track = Track(id: "1", title: "Test", artist: "Artist", duration: 240)
        modelContext.insert(track)

        let descriptor = FetchDescriptor<Track>()
        let tracks = try modelContext.fetch(descriptor)

        XCTAssertEqual(tracks.count, 1)
        XCTAssertEqual(tracks.first?.title, "Test")
    }
}
```

## Comparison: SwiftData vs SQLiteData

| Feature | SwiftData | SQLiteData |
|---------|-----------|------------|
| **Type** | Reference (class) | Value (struct) |
| **Macro** | `@Model` | `@Table` |
| **Queries** | `@Query` in SwiftUI | `@FetchAll` / `@FetchOne` |
| **Relationships** | `@Relationship` macro | Explicit foreign keys |
| **CloudKit** | Automatic sync | Manual SyncEngine + sharing |
| **Backend** | Core Data | GRDB + SQLite |
| **Learning Curve** | Easy (native) | Moderate |
| **Performance** | Good | Excellent (raw SQL) |

## Resources

**Docs**: /swiftdata

**Skills**: axiom-swiftdata-migration, axiom-swiftdata-migration-diag, axiom-database-migration, axiom-sqlitedata, axiom-grdb, axiom-swift-concurrency

## Common Mistakes

### ❌ Forgetting explicit init
```swift
@Model
final class Track {
    var id: String
    var title: String
    // No init - won't compile
}
```
**Fix** Always provide `init` for `@Model` classes

### ❌ Using structs
```swift
@Model
struct Track { }  // Won't work - must be class
```
**Fix** Use `final class` not `struct`

### ❌ Background operations on main context
```swift
@Environment(\.modelContext) var context  // Main actor only

Task {
    // ❌ Crash - crossing actor boundaries
    context.insert(track)
}
```
**Fix** Use `ModelContext(modelContainer)` for background work

### ❌ Not saving when needed
```swift
modelContext.insert(track)
// Might not persist immediately
```
**Fix** Call `try modelContext.save()` for immediate persistence

---

**Created** 2025-11-28
**Targets** iOS 17+ (focus on iOS 26+ features)
**Framework** SwiftData (Apple)
**Swift** 5.9+ (Swift 6 concurrency patterns)
