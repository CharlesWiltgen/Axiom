
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

**For migrations** See the `skills/swiftdata-migration.md` skill for custom schema migrations with VersionedSchema and SchemaMigrationPlan. For migration debugging, see `skills/swiftdata-migration-diag.md`.

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
→ The skill covers CloudKit integration, last-write-wins conflict behavior, and sync patterns

#### 5. "I'm adding CloudKit sync to my app, but I get 'CloudKit integration requires that all attributes be optional, or have a default value set'. What's wrong?"
→ The skill explains CloudKit constraints: all properties must be optional or have defaults, explains why (network timing), and shows fixes

#### 6. "I want to show users when their data is syncing to iCloud and what happens when they're offline."
→ The skill shows monitoring sync status with notifications, detecting network connectivity, and offline-aware UI patterns

#### 7. "I need to share a playlist with other users. How do I implement CloudKit record sharing?"
→ The skill covers CloudKit record sharing patterns (iOS 26+) with owner/permission tracking and sharing metadata

#### Performance & Optimization

#### 8. "I need to query 50,000 messages but only display 20 at a time. How do I paginate efficiently?"
→ The skill covers performance patterns, batch fetching, limiting queries, and chunked imports that bound memory

#### 9. "My app loads 100 tasks with relationships, and displaying them is slow. I think it's N+1 queries."
→ The skill shows how to identify N+1 problems without prefetching, provides prefetching pattern, and shows 100x performance improvement

#### 10. "I'm importing 1 million records from an API. What's the best way to batch them without running out of memory?"
→ The skill shows chunk-based importing with periodic saves and one context per chunk, plus batch operation optimization

#### 11. "Which properties should I add indexes to? I'm worried about over-indexing slowing down writes."
→ The skill explains index optimization patterns: when to index (frequently filtered/sorted properties), when to avoid (rarely used, frequently changing), maintenance costs

#### Migration from Legacy Frameworks

#### 12. "We're migrating from Realm/Core Data to SwiftData"
→ See the comparison table in Migration section below, then follow `skills/realm-migration-ref.md` or `skills/swiftdata-migration.md` for detailed guides

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
- Use `final class`, not `struct` (omit `final` if you need subclasses — see Class Inheritance below)
- Use `@Attribute(.unique)` for primary key-like behavior (not supported with CloudKit sync — see CloudKit Constraints below)
- Provide explicit `init` (SwiftData doesn't synthesize)
- Optional properties (`String?`) are nullable
- Use `@Attribute(.preserveValueOnDeletion)` on properties whose values should survive even after the object is deleted (useful for analytics, audit trails)

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
- `.deny` - Intended to prevent deletion if a relationship exists, but SwiftData does not enforce it today (it behaves like `.nullify`) — check referential constraints in code before deleting
- `.noAction` - Leave relationship as-is (careful!)

## Codable Attributes for Unowned Types (OS27)

SwiftData builds its schema by inspecting a model's stored properties. A stored property whose type is a **class** — ownership is irrelevant — can't be inspected and crashes at launch (e.g. `MKMapItem.Identifier`, or a `final class` of your own):

```
Fatal error: Class property within Persisted Struct/Enum is not supported
```

If that type is `Codable`, mark the attribute `@Attribute(.codable)` (`OS27`) — SwiftData persists its encoded form instead of inferring a schema:

```swift
@Model
final class Trip {
    var name: String
    @Attribute(.codable) var mapItemIdentifier: MKMapItem.Identifier?   // OS27

    init(name: String, mapItemIdentifier: MKMapItem.Identifier? = nil) {
        self.name = name
        self.mapItemIdentifier = mapItemIdentifier
    }
}
```

**It's an escape hatch, not a default.** The stored blob is opaque to SwiftData, so a `.codable` attribute:
- **filters on `nil` only** — comparing it against a value throws `unsupportedPredicate` at fetch time, and a nested key path into the encoded payload silently matches nothing;
- sorts only when the payload is `Comparable` (which is what rules out `MKMapItem.Identifier` above), but indexes like any other attribute;
- **won't** trigger a migration when its shape changes — you own keeping the type's `Codable` conformance forward/backward compatible, and a payload the store can no longer decode traps in Core Data the next time that row faults.

For types you *do* own, model them as `@Model` or supported value types so you can filter against values. (`.codable` is the modern cousin of transformable attributes.)

## Class Inheritance (iOS 26+)

SwiftData supports class inheritance for hierarchical models. Use when you have a clear IS-A relationship (e.g., `BusinessTrip` IS-A `Trip`) and need both broad queries (all trips) and type-specific queries.

**Unusable below iOS 26.** A `PersistentModel` subclass must carry `@available(anyAppleOS 26, *)`; anything narrower is rejected (`A PersistentModel Subclass requires iOS 26.0 or greater`), and without an availability stamp the macro reports `A PersistentModel Subclass is required to have platform availability specified`. On the iOS 17/18 floor, take the enum/flag alternative in the table below instead.

### Base and Subclass Pattern

Apply `@Model` to both base class and subclasses. Omit `final` on the base class, and stamp each subclass `@available(anyAppleOS 26, *)`.

```swift
@Model class Trip {
    @Attribute(.preserveValueOnDeletion)
    var name: String
    var destination: String
    var startDate: Date
    var endDate: Date

    @Relationship(deleteRule: .cascade, inverse: \Accommodation.trip)
    var accommodation: Accommodation?

    init(name: String, destination: String, startDate: Date, endDate: Date) {
        self.name = name
        self.destination = destination
        self.startDate = startDate
        self.endDate = endDate
    }
}

@available(anyAppleOS 26, *)
@Model class BusinessTrip: Trip {
    var purpose: String
    var expenseCode: String

    @Relationship(deleteRule: .cascade, inverse: \BusinessMeal.trip)
    var businessMeals: [BusinessMeal] = []

    init(name: String, destination: String, startDate: Date, endDate: Date,
         purpose: String, expenseCode: String) {
        self.purpose = purpose
        self.expenseCode = expenseCode
        super.init(name: name, destination: destination, startDate: startDate, endDate: endDate)
    }
}
```

### Type-Based Queries with #Predicate

Query all base class instances (includes subclasses), or filter by type:

```swift
// All trips (includes BusinessTrip, PersonalTrip, etc.)
@Query(sort: \Trip.startDate) var allTrips: [Trip]

// Only business trips — use `is` in #Predicate
@Query(filter: #Predicate<Trip> { $0 is BusinessTrip }) var businessTrips: [Trip]

// Filter on subclass-specific properties. A `#Predicate` body is a single expression, and an
// `as?` cast inside one throws `unsupportedPredicate` at fetch time — so match the type in the
// predicate and narrow in Swift, or store a discriminator on the base model.
// The predicate must be a global or a `static let`: an instance property can't be referenced
// from a sibling `@Query` initializer.
static let vacationPredicate = #Predicate<Trip> { $0 is PersonalTrip }

@Query(filter: vacationPredicate) var vacationTrips: [Trip]

// Narrow on `reason` after the fetch instead of filtering inside the predicate:
var vacationReasoned: [PersonalTrip] {
    vacationTrips.compactMap { $0 as? PersonalTrip }.filter { $0.reason == .vacation }
}
```

### Composing Compound Predicates Dynamically (`OS27`)

`#Predicate` is resolved at compile time, so you can't build one from a runtime array (e.g. a user's checked filter options). Foundation's `Predicate(all:)` / `Predicate(any:)` (`OS27`, all platforms) fold a collection of subpredicates into one with AND / OR:

```swift
@available(anyAppleOS 27, *)
func tripFilter(for destinations: [String]) -> Predicate<Trip> {
    // Each clause captures one value and compares it against a scalar model property.
    let clauses = destinations.map { destination in
        #Predicate<Trip> { $0.destination == destination }
    }
    return Predicate(any: clauses)        // OR; use `all:` for AND
}
// ...
@Query(filter: tripFilter(for: selectedDestinations)) var matching: [Trip]
```

Guard the empty-collection case: by the usual AND/OR identity an empty `all:` matches everything and an empty `any:` matches nothing, so "no filters selected" should be handled explicitly rather than fed in as `[]`. Before `OS27`, compose at runtime by folding subpredicates with `.evaluate(_:)` inside one outer compile-time `#Predicate`:

```swift
let classPredicate = #Predicate<Trip> { $0 is BusinessTrip }   // chosen at runtime
let searchPredicate = #Predicate<Trip> { $0.destination.contains(text) }

#Predicate<Trip> { classPredicate.evaluate($0) && searchPredicate.evaluate($0) }
```

Relationships typed to the base class can hold mixed subclass instances:

```swift
@Model class TravelPlanner {
    var name: String

    @Relationship(deleteRule: .cascade)
    var upcomingTrips: [Trip] = []  // Can contain BusinessTrip and PersonalTrip

    init(name: String) { self.name = name }
}
```

Cast to access subclass-specific properties:

```swift
for trip in planner.upcomingTrips {
    if let business = trip as? BusinessTrip {
        print(business.expenseCode)
    }
}
```

### When to Use Inheritance vs Alternatives

| Signal | Use Inheritance | Use Enum/Flag Instead |
|--------|----------------|----------------------|
| Subclasses share many base properties | Yes | — |
| Need type-based queries across all models | Yes | — |
| Subclasses have their own relationships | Yes | — |
| Only 1-2 distinguishing properties | — | Yes |
| Query only on specialized properties | — | Yes |
| Protocol conformance suffices | — | Yes |

**Keep hierarchies shallow** (1-2 levels). Deep chains complicate schema migrations and queries.

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
@Query(sort: \Track.title, order: .forward) var tracks: [Track]

// Sorted (multiple descriptors)
@Query(sort: [SortDescriptor(\Track.artist), SortDescriptor(\Track.title)]) var tracksByArtist: [Track]

// Combined filter + sort
@Query(filter: #Predicate<Track> { $0.duration > 180 }, sort: \.title) var longTracks: [Track]
```

### Sectioned Queries (OS27)

`@Query` gained a `sectionBy:` parameter (`OS27`, all platforms) that groups results without manual post-fetch grouping. With `sectionBy:` the wrapped value is no longer a flat `[Element]` — it becomes `SectionedResults<Element, String>`:

```swift
struct TracksView: View {
    // sectionBy takes a KeyPath to a String (or String?) on the model.
    @Query(sort: \Track.title, sectionBy: \.genre)
    private var tracks: SectionedResults<Track, String>

    var body: some View {
        List {
            ForEach(tracks) { section in             // ResultsSection<Track, String>
                Section(section.id) {                // section.id == the section key (the genre)
                    ForEach(section) { track in      // each section IS a collection of its Tracks
                        Text(track.title)
                    }
                }
            }
        }
    }
}
```

`SectionedResults<Element, SectionTitle>` is a `RandomAccessCollection` of `ResultsSection<Element, SectionTitle>` — each one `Identifiable` (`.id` == the section title) and a `RandomAccessCollection` of that section's models. `sectionTitles`, `contains(sectionTitle:)` and `index(ofSectionTitled:)` are also available, and the unsectioned `[Track]` form still works when `sectionBy:` is omitted, so adoption is incremental.

## Observing Results Outside SwiftUI — `ResultsObserver` (OS27)

`@Query` only works inside SwiftUI views. `ResultsObserver` (`OS27`, all platforms) is the programmatic equivalent — SwiftData's answer to `NSFetchedResultsController` — for UIKit/AppKit controllers, `@Observable` state objects, or non-UI code. It fetches with the same primitives as `@Query` (filter, sort, sectioning) and observes the store through Swift Observation.

```swift
@Observable @MainActor
final class TrackListModel {
    private let observer: ResultsObserver<Track, Never>   // Never == unsectioned
    @ObservationIgnored private var token: ObservationTracking.Token?   // ~Copyable, so not observable
    var tracks: [Track] = []

    init(modelContext: ModelContext) throws {
        observer = try ResultsObserver<Track, Never>(
            sortBy: [SortDescriptor(\.title)],
            modelContext: modelContext
        )
        tracks = Array(observer.results)
        token = withContinuousObservation(options: [.didSet]) { [weak self] _ in
            guard let self else { return }
            self.tracks = Array(self.observer.results)
        }
    }
}
```

- Inits take a `modelContext:` **or** a `modelContainer:`, optional `filterBy:`/`sortBy:` (or a full `FetchDescriptor`), and — for the `SectionTitle == String` variant — a `sectionBy: KeyPath<Element, String>`; all `throws`.
- Read `observer.results` (a `FetchResultsCollection`), or `observer.sections` when sectioned. For table/collection views, `element(at: IndexPath)` and `indexPath(for:)` map rows ↔ models.
- `withContinuousObservation(options:apply:)` is a new `OS27` Observation API that re-fires on every change and returns an `ObservationTracking.Token` (`~Copyable`) you **must retain** — it supersedes manually re-arming `withObservationTracking`. Store it `@ObservationIgnored`: `@Observable` cannot track a non-copyable property. Options: `.willSet`, `.didSet`, `.deinit`.

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

// Save when you need the write to land now
// (main-context autosave is on by default and flushes at app-lifecycle events)
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

// Starts with (`hasPrefix` is not supported in a #Predicate)
#Predicate<Track> { track in
    track.artist.starts(with: "The ")
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

> **Threading errors are isolation bugs.** If you're seeing `Illegal attempt to establish a relationship between objects in different contexts` from a background notification, push handler, or `BGTaskScheduler` callback, the root cause is usually closure isolation inheritance — the work that fetches in a background `ModelContext` and the work that writes the relationship are running on different actors. Read this section AND axiom-concurrency (skills/isolation-inheritance-diag.md) Pattern 1 for the full runtime-crash catalog.

### Model Isolation

Annotating the model itself with `@MainActor` is the mistake, not the fix. The `@Model` macro emits a `nonisolated` conformance, so under `-swift-version 6` a main-actor-isolated model is a compile error:

```
error: conformance of 'Track' to protocol 'PersistentModel' crosses into
main actor-isolated code and can cause data races [#ConformanceIsolation]
```

Leave the model unannotated:

```swift
import SwiftData

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

**Why** SwiftData models are not `Sendable` — the macro declares that conformance as `@available(*, unavailable, message: "PersistentModels are not Sendable, consider utilizing a ModelActor or use Track's persistentModelID instead")`. Keep the model nonisolated and confine access to one actor: the main actor through `@Environment(\.modelContext)`, everything else through `@ModelActor` or a background `ModelContext(modelContainer)`.

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

#### Calling from SwiftUI

```swift
struct ContentView: View {
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        Button("Import") {
            Task {
                let importer = DataImporter(container: modelContext.container)
                try await importer.importTracks(data)
            }
        }
    }
}
```

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

**Note** SwiftData CloudKit sync is automatic, with no conflict hooks to write — the framework resolves conflicts last-write-wins.

### CloudKit Constraints (CRITICAL)

#### When using CloudKit sync, ALL properties must be optional or have default values

```swift
@Model
final class Track {
    var id: String = UUID().uuidString  // ✅ Has default (don't use .unique — CloudKit can't enforce it)
    var title: String = ""  // ✅ Has default
    var duration: TimeInterval = 0  // ✅ Has default
    var genre: String? = nil  // ✅ Optional

    // ❌ These don't work with CloudKit:
    // var requiredField: String  // No default, not optional

    init(id: String = UUID().uuidString, title: String = "", duration: TimeInterval = 0, genre: String? = nil) {
        self.id = id
        self.title = title
        self.duration = duration
        self.genre = genre
    }
}
```

**Why** CloudKit only syncs to private zones, and network delays mean new records may not have all fields populated yet.

#### Handling uniqueness without `.unique`

When you genuinely need uniqueness with CloudKit — a settings singleton, or records keyed by a natural ID (a server `recordID`, ISBN, email) — enforce it in code. There are two cases, and they need different handling.

**Records your own code inserts** (an import, a server fetch you control): use a **fetch-before-insert** upsert at the insert site.

```swift
func upsert(remoteID: String, in context: ModelContext) throws {
    var descriptor = FetchDescriptor<Track>(
        predicate: #Predicate { $0.remoteID == remoteID }
    )
    descriptor.fetchLimit = 1
    if let existing = try context.fetch(descriptor).first {
        existing.lastSeen = .now          // update in place — no duplicate
    } else {
        context.insert(Track(remoteID: remoteID))
    }
}
```

**Records CloudKit delivers via sync**: you get no insert hook to upsert at, and a fetch-before-insert *races in-flight sync* — the remote copy of a record may not have arrived locally yet, so the fetch misses and a duplicate slips in regardless. Don't dedup on every insert. Instead let sync settle, then run a **deduplication sweep** on a background `ModelContext` at a natural lull (app foreground, a debounced timer, or after your own refresh completes):

```swift
func deduplicate(in context: ModelContext) throws {
    let all = try context.fetch(FetchDescriptor<Track>())
    let groups = Dictionary(grouping: all, by: \.remoteID)
    for (_, dupes) in groups where dupes.count > 1 {
        // keep the earliest record, delete the rest
        let keep = dupes.min { $0.createdAt < $1.createdAt }
        for dupe in dupes where dupe !== keep {
            context.delete(dupe)
        }
    }
    try context.save()
}
```

Run the sweep on a background context (not the main one), keyed by the natural ID, so it doesn't block the UI or fight active sync.

**Relationship Constraint** All relationships must be optional
```swift
@Model
final class Track {
    @Relationship(deleteRule: .cascade, inverse: \Album.tracks)
    var album: Album?  // ✅ Must be optional for CloudKit

    init(album: Album? = nil) {
        self.album = album
    }
}
```

### Sync Status, Conflicts, Offline Handling

SwiftData CloudKit sync uses **last-write-wins** and exposes no conflict or merge-policy API, so anything custom means driving CloudKit yourself. For sync status monitoring and offline-aware UI patterns, see `skills/cloud-sync.md`; for CKShare-based record sharing, see `skills/cloudkit-ref.md`.

### Resolving the "optional or have a default value" Error

**Problem** You get this error when trying to use CloudKit sync:
```
CloudKit integration requires that all attributes be optional, or have a default value set.
The following attributes are marked non-optional but do not have a default value:
BadTrack: title
```

#### Solution
```swift
// ❌ Wrong - required property. Compiles, then ModelContainer throws the message above.
@Model
final class BadTrack {
    var title: String

    init(title: String) {
        self.title = title
    }
}

// ✅ Correct - has default
@Model
final class DefaultedTrack {
    var title: String = ""

    init(title: String = "") {
        self.title = title
    }
}

// ✅ Also correct - optional
@Model
final class OptionalTrack {
    var title: String?

    init(title: String? = nil) {
        self.title = title
    }
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

## Relationship, Transient and History Features

### Enhanced Relationship Handling (iOS 17+)

`minimumModelCount`/`maximumModelCount` express cardinality bounds on a relationship.

```swift
@Model
final class Track {
    @Relationship(
        deleteRule: .cascade,
        minimumModelCount: 0,
        maximumModelCount: 1,  // Track belongs to at most one album
        inverse: \Album.tracks
    ) var album: Album?

    init(album: Album? = nil) {
        self.album = album
    }
}
```

### Transient Properties (iOS 17+)

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

    init(id: String, duration: TimeInterval) {
        self.id = id
        self.duration = duration
    }
}
```

**Transient** Computed property, not persisted.

### History Tracking

SwiftData records persistent history automatically — there is no `isHistoryEnabled` flag on `ModelConfiguration`. Query the change history with `ModelContext.fetchHistory(_:)` using a `HistoryDescriptor` (iOS 18+):

```swift
var descriptor = HistoryDescriptor<DefaultHistoryTransaction>()
// Optionally filter by token/date via descriptor.predicate

let transactions = try modelContext.fetchHistory(descriptor)
for transaction in transactions {
    for change in transaction.changes {
        switch change {
        case .insert(let inserted): handleInsert(inserted)
        case .update(let updated):  handleUpdate(updated)
        case .delete(let deleted):  handleDelete(deleted)
        @unknown default: break   // HistoryChange is a resilient enum
        }
    }
}

// Prune processed history once you've caught up:
try modelContext.deleteHistory(HistoryDescriptor<DefaultHistoryTransaction>())
```

#### Observing History — `HistoryObserver` (OS27)

`fetchHistory` is a pull. `HistoryObserver` (`OS27`, all platforms) is the push — an `@Observable` object whose `eventCounter` increments whenever new history transactions land, so a sync engine or an extension-aware app reacts without polling:

```swift
@Observable @MainActor
final class StoreSync {
    private let observer: HistoryObserver
    @ObservationIgnored private var token: ObservationTracking.Token?   // ~Copyable, so not observable

    init(modelContainer: ModelContainer) throws {
        // Filter to app-authored changes so you don't replay server-originated ones back.
        observer = try HistoryObserver(authors: ["App"], modelContainer: modelContainer)
        token = withContinuousObservation(options: [.didSet]) { [weak self] _ in
            _ = self?.observer.eventCounter        // touch the observable to re-arm
            self?.processNewTransactions()
        }
    }

    private func processNewTransactions() {
        // Pull the latest with modelContext.fetchHistory(...) and apply them.
    }
}
```

`HistoryObserver(historyTokens:observedModels:authors:modelContainer:)` (everything but `modelContainer` optional) `throws`. Scope it with `observedModels:` and `authors:`, observe `eventCounter`, then pull the actual changes with the existing `ModelContext.fetchHistory(_:)`.

## Performance Patterns

### Batch Fetching

```swift
var descriptor = FetchDescriptor<Track>(
    sortBy: [SortDescriptor(\Track.title)]
)
descriptor.fetchLimit = 100  // Paginate results

let tracks = try modelContext.fetch(descriptor)
```

### Prefetch Relationships (Prevent N+1 Queries)

```swift
var descriptor = FetchDescriptor<Track>()
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
var descriptor = FetchDescriptor<Track>()
descriptor.relationshipKeyPathsForPrefetching = [\.album]
let prefetched = try modelContext.fetch(descriptor)
for track in prefetched {
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

### Index Optimization (iOS 18+)

Create indexes on frequently queried properties with the freestanding `#Index` macro (there is no `@Attribute(.indexed)` option). Each array argument is one index — pass multiple arrays for multiple single-column indexes, or one array of several key paths for a compound index:

```swift
@Model
final class Track {
    @Attribute(.unique) var id: String = UUID().uuidString
    var genre: String = ""
    var releaseDate: Date = Date()
    var title: String = ""
    var duration: TimeInterval = 0

    #Index<Track>([\.genre], [\.releaseDate])  // two single-column indexes

    init(id: String = UUID().uuidString, genre: String = "", releaseDate: Date = Date(), title: String = "", duration: TimeInterval = 0) {
        self.id = id
        self.genre = genre
        self.releaseDate = releaseDate
        self.title = title
        self.duration = duration
    }
}

// Now these queries are faster:
private static let today = Date()
@Query(filter: #Predicate<Track> { $0.genre == "Rock" }) var rockTracks: [Track]
@Query(filter: #Predicate<Track> { $0.releaseDate > today }) var upcomingTracks: [Track]
```

#### When to add indexes
- ✅ Properties used in `@Query` filters frequently
- ✅ Properties used in sort operations
- ✅ Properties used in relationships
- ❌ NOT properties that are rarely filtered
- ❌ NOT properties that change frequently (maintenance cost)

### Memory Optimization: Fetch Chunks

For very large datasets (100k+ records), fetch in chunks. To bound memory, use a fresh `ModelContext` per chunk — do not "clean up" with a batch delete, which is entity-wide at any stage of the loop:

```swift
actor DataImporter {
    let modelContainer: ModelContainer

    init(modelContainer: ModelContainer) {
        self.modelContainer = modelContainer
    }

    func importLargeDataset(_ items: [Item]) async throws {
        let chunkSize = 1000

        for chunk in items.chunked(into: chunkSize) {
            // A fresh context per chunk: the save persists it, and releasing the context
            // at the end of the iteration frees the models it was holding onto.
            let context = ModelContext(modelContainer)

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

Undo is **opt-in**. `modelContext.undoManager` is `nil` by default, and `@Environment(\.undoManager)` is SwiftUI's own manager — it does not register the context's changes:

```swift
func deleteTrack(_ track: Track, in modelContext: ModelContext) {
    modelContext.delete(track)
}
```

Turn it on at the container modifier — `isUndoEnabled` defaults to `false`:

```swift
.modelContainer(for: Track.self, isUndoEnabled: true)
```

Or attach your own manager: `modelContext.undoManager = UndoManager()`. Undo covers changes since the last `save()`: undoing a saved insert and then saving again deletes the persisted row, and undoing a saved delete does not bring it back.

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

- **`skills/realm-migration-ref.md`** — Complete Realm migration: pattern equivalents, thread safety conversion, relationship migration, CloudKit sync transition, timeline planning
- **`skills/swiftdata-migration.md`** — SwiftData schema evolution: VersionedSchema, SchemaMigrationPlan, lightweight vs custom migrations
- **`skills/database-migration.md`** — Safe additive migration patterns applicable to any persistence framework

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

## tvOS

**No local file on tvOS is *guaranteed* to persist, but SwiftData does keep a local store there.** `Documents` and `Caches` exist from the first launch, and `Application Support` is a real, separate directory — SwiftData does not create it for you, and it is not aliased to `Caches`. What differs from iOS is where a default store lands: on tvOS a container's default URL is `Library/Caches/default.store`, the one directory the system may purge, where iOS uses `Library/Application Support/default.store`.

Pass an explicit store URL under Application Support when you need durability, and treat CloudKit sync (`cloudKitDatabase: .private(...)`) as the belt-and-braces option rather than a requirement. See axiom-swift (skills/tvos.md) for full tvOS storage constraints.

---

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

// ❌ Swift 6 error — the detached closure is `sending`
Task.detached {
    context.insert(track)   // main actor-isolated property 'context' cannot be accessed from outside of the actor
}
```
**Fix** Use `ModelContext(modelContainer)` for background work. `Task {}` inherits the surrounding actor and is not the failure case — only a genuinely nonisolated closure is, and it fails to compile rather than crashing.

### ❌ Not saving when needed
```swift
modelContext.insert(track)
// Might not persist immediately
```
**Fix** Call `try modelContext.save()` for immediate persistence

## Resources

**WWDC**: 2026-274, 2026-275

**Docs**: /swiftdata, /swiftdata/adopting-inheritance-in-swiftdata, /swiftdata/query, /swiftdata/sectionedresults

**Skills**: skills/swiftdata-migration.md, skills/swiftdata-migration-diag.md, skills/database-migration.md, skills/sqlitedata.md, skills/grdb.md
