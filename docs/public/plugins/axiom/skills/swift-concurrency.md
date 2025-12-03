---
name: swift-concurrency
description: Swift 6 strict concurrency patterns, fixes, and best practices — Quick reference for actor isolation, Sendable, async/await, and data race prevention
---

# Swift 6 Concurrency Guide

**Purpose**: Quick reference for Swift 6 concurrency patterns
**Swift Version**: Swift 6.0+ with strict concurrency
**iOS Version**: iOS 17+ recommended
**Context**: Helps navigate actor isolation, Sendable, and data race prevention

## When to Use This Skill

✅ **Use this skill when**:
- Debugging Swift 6 concurrency errors (actor isolation, data races, Sendable warnings)
- Implementing `@MainActor` classes or async functions
- Converting delegate callbacks to async-safe patterns
- Deciding between `@MainActor`, `nonisolated`, or actor isolation
- Resolving "Sending 'self' risks causing data races" errors
- Making types conform to `Sendable`
- Offloading CPU-intensive work to background threads

❌ **Do NOT use this skill for**:
- General Swift syntax (use Swift documentation)
- SwiftUI-specific patterns (different context)
- API-specific patterns (use API documentation)

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

**General Concurrency**

**1. "I'm getting 'Main actor-isolated property accessed from nonisolated context' errors in my delegate methods. How do I fix this?"**
→ The skill covers the critical Pattern 2 (Value Capture Before Task) that shows when to capture delegate parameters before the Task context hop

**2. "My code is throwing 'Type does not conform to Sendable' warnings when I try to pass data between background work and MainActor. What does this mean?"**
→ The skill explains Sendable conformance requirements and shows patterns for enums, structs, and classes that cross actor boundaries

**3. "I have a task that's stored as a property and it's causing memory leaks. How do I write it correctly with weak self?"**
→ The skill demonstrates Pattern 3 (Weak Self in Tasks) showing the difference between stored and short-lived tasks

**4. "I'm new to Swift 6 concurrency. What are the critical patterns I need to know to write safe concurrent code?"**
→ The skill provides 6 copy-paste-ready patterns covering delegates, Sendable types, tasks, snapshots, MainActor, and background work

**5. "How do I know when to use @MainActor vs nonisolated vs @concurrent? The rules aren't clear."**
→ The skill clarifies actor isolation rules and provides a decision tree for each scenario with real-world examples

**Data Persistence & Concurrency**

**6. "I'm fetching 10,000 records from SwiftData on a background thread, but I'm getting thread-confinement errors. How do I safely load data?"**
→ The skill shows Pattern 7 (Background SwiftData Access) which demonstrates creating background ModelContext and safely passing data back to MainActor

**7. "I have Core Data on a background thread and need to update the UI. I keep getting 'accessed from different thread' crashes."**
→ The skill covers Pattern 8 (Core Data Thread-Safe Fetch) showing private queue contexts and lightweight representations for thread-safe access

**8. "How do I batch-import 1 million records from an API without blocking the UI or causing memory bloat?"**
→ The skill demonstrates Pattern 9 (Batch Import with Progress) using background actors, chunk-based processing, and periodic saves

**9. "My GRDB queries are blocking the UI. How do I run complex SQL on a background thread safely?"**
→ The skill shows Pattern 10 (GRDB Background Execution) with actor-based query execution and safe data transfer back to MainActor

**10. "I need to sync data to CloudKit while keeping the UI responsive. How do I prevent the UI from freezing?"**
→ The skill covers Pattern 11 (CloudKit Sync with Progress Reporting) showing structured concurrency for sync operations with UI feedback

---

## Quick Decision Tree

```
Error: "Main actor-isolated property accessed from nonisolated context"
├─ In delegate method?
│  └─ Use Pattern 2: Value Capture Before Task
├─ In async function?
│  └─ Add @MainActor or call from Task { @MainActor in }
└─ In property getter?
   └─ Use Pattern 4: Atomic Snapshots

Error: "Type does not conform to Sendable"
├─ Is it an enum with no associated values?
│  └─ Use Pattern 1: Add `: Sendable`
├─ Is it a struct with all Sendable properties?
│  └─ Implicit Sendable (do nothing) or explicit `: Sendable`
└─ Is it a class?
   └─ Make @MainActor or add manual Sendable conformance

Error: "Static var requires concurrency annotation"
└─ Use `nonisolated static let` (if immutable)

Warning: Task may cause memory leak
└─ Use Pattern 3: `Task { [weak self] in }`
```

## Common Patterns (Copy-Paste Templates)

### Pattern 1: Sendable Enum/Struct

**When**: Type crosses actor boundaries (passed between @MainActor and background)

```swift
// ✅ Enum (no associated values)
private enum PlaybackState: Sendable {
    case stopped
    case playing
    case paused
}

// ✅ Struct (all properties Sendable)
struct Track: Sendable {
    let id: String
    let title: String
    let artist: String?
}

// ✅ Enum with Sendable associated values
enum Result: Sendable {
    case success(data: Data)
    case failure(error: Error)  // Error is Sendable
}
```

**Why**: Swift 6 requires types crossing actor boundaries to be `Sendable` to prevent data races.

---

### Pattern 2: Delegate Value Capture (CRITICAL)

**When**: `nonisolated` delegate method needs to update @MainActor state

**Why `@MainActor` on delegate doesn't work**: Delegate protocols define methods as nonisolated by the framework. You can't change their isolation.

**❌ WRONG (Accessing delegate parameters directly)**:
```swift
nonisolated func delegate(_ param: SomeType) {
    Task { @MainActor in
        // ❌ Accessing param.value crosses actor boundary unsafely
        self.property = param.value
        print("Status: \(param.status)")
    }
}
```

**✅ CORRECT (Capture Before Task)**:
```swift
nonisolated func delegate(_ param: SomeType) {
    // ✅ Step 1: Capture delegate parameter values BEFORE Task
    let value = param.value
    let status = param.status

    // ✅ Step 2: Task hop to MainActor
    Task { @MainActor in
        // ✅ Step 3: Now safe to access self (we're on MainActor)
        // ✅ Use captured values from delegate parameters
        self.property = value
        print("Status: \(status)")
    }
}
```

**Why**: Delegate methods are `nonisolated` (called from library's threads). Delegate parameters must be captured BEFORE the Task creates MainActor context. Once inside `Task { @MainActor in }`, accessing `self` is safe because you're on MainActor.

**Rule**: Capture all delegate parameter values before Task. Accessing `self` inside the Task is safe and expected.

**Real-world example** (chat message delegate):
```swift
// Delegate method called from network layer's thread
nonisolated func didReceiveMessage(_ message: Message, fromUser user: User) {
    // ✅ Capture delegate parameters
    let messageText = message.content
    let senderName = user.displayName

    Task { @MainActor in
        // ✅ Safe: accessing self properties (we're on MainActor now)
        self.messages.append(message)
        self.unreadCount += 1

        // ✅ Use captured delegate parameters
        self.showNotification(text: messageText, from: senderName)
    }
}
```

**Key distinction**:
- Delegate parameters (`message`, `user`) → Must capture before Task
- Self properties (`self.messages`) → Safe to access inside `Task { @MainActor in }`

---

### Pattern 3: Weak Self in Tasks

**When**: Task is stored as a property OR runs for a long time

**❌ WRONG (Memory Leak)**:
```swift
class MusicPlayer {
    private var progressTask: Task<Void, Never>?

    func startMonitoring() {
        progressTask = Task {  // ❌ Strong capture of self
            while !Task.isCancelled {
                await self.updateProgress()
            }
        }
    }
}
// MusicPlayer → progressTask → closure → self (CYCLE)
```

**✅ CORRECT (No Leak)**:
```swift
class MusicPlayer {
    private var progressTask: Task<Void, Never>?

    func startMonitoring() {
        progressTask = Task { [weak self] in  // ✅ Weak capture
            guard let self = self else { return }

            while !Task.isCancelled {
                await self.updateProgress()
            }
        }
    }

    deinit {
        progressTask?.cancel()  // Clean up
    }
}
```

**Why**: Task strongly captures `self`, creating retain cycle if stored as property. Use `[weak self]` to break cycle.

**Note**: Short-lived Tasks (not stored) can use strong captures:
```swift
// ✅ OK: Task executes immediately and completes
func quickUpdate() {
    Task {  // Strong capture OK (not stored)
        await self.refresh()
    }
}
```

---

### Pattern 4: Atomic Snapshots

**When**: Reading multiple properties from an object that could change mid-access

**❌ WRONG (Torn Reads)**:
```swift
var currentTime: TimeInterval {
    get async {
        // ❌ If state changes between reads, torn read!
        return player?.currentTime ?? 0
    }
}
```

**✅ CORRECT (Atomic Snapshot)**:
```swift
var currentTime: TimeInterval {
    get async {
        // ✅ Cache reference first for atomic snapshot
        guard let player = player else { return 0 }
        return player.currentTime
    }
}
```

**Why**: If state changes between reads, you could read inconsistent data. Caching ensures all properties come from the same instance.

---

### Pattern 5: MainActor for UI Code

**When**: Code touches UI (views, view controllers, observable objects)

```swift
// ✅ View models should be @MainActor
@MainActor
class PlayerViewModel: ObservableObject {
    @Published var currentTrack: Track?
    @Published var isPlaying: Bool = false

    func play(_ track: Track) async {
        // Already on MainActor, can update @Published properties
        self.currentTrack = track
        self.isPlaying = true
    }
}

// ✅ SwiftUI views are implicitly @MainActor
struct PlayerView: View {
    @StateObject var viewModel = PlayerViewModel()

    var body: some View {
        // UI code automatically on MainActor
    }
}
```

---

### Pattern 6: Background Work with @concurrent (Swift 6.2+)

**When**: CPU-intensive operations that should always run on background thread

```swift
// ✅ Force background execution
@concurrent
func extractMetadata(from url: URL) async -> Metadata {
    // Always runs on background thread pool
    // Good for: file I/O, image processing, parsing
    let data = try? Data(contentsOf: url)
    return parseMetadata(data)
}

// Usage (automatically offloads to background)
let metadata = await extractMetadata(from: fileURL)
```

**Note**: `@concurrent` requires Swift 6.2 (Xcode 16.2+, iOS 18.2+)

---

## Data Persistence Concurrency Patterns

### Pattern 7: Background SwiftData Access

**When**: Fetching large datasets from SwiftData without blocking UI

```swift
// ✅ Proper background SwiftData access
actor DataFetcher {
    let modelContainer: ModelContainer

    func fetchAllTracks() async throws -> [Track] {
        // ✅ Create background context (not on MainActor)
        let context = ModelContext(modelContainer)

        // ✅ Fetch on background thread (no UI blocking)
        let descriptor = FetchDescriptor<Track>(
            sortBy: [SortDescriptor(\.title)]
        )
        return try context.fetch(descriptor)
    }
}

// Usage (on MainActor)
@MainActor
class TrackViewModel: ObservableObject {
    @Published var tracks: [Track] = []
    private let fetcher: DataFetcher

    func loadTracks() async {
        do {
            // ✅ Fetch on background, then update UI
            let fetchedTracks = try await fetcher.fetchAllTracks()
            // Back on MainActor automatically after await
            self.tracks = fetchedTracks
        } catch {
            print("Fetch failed: \(error)")
        }
    }
}
```

**Why**: SwiftData models are not Sendable. Use actor to isolate database operations, fetch on background, then return lightweight representations to MainActor.

**Key distinction**:
- Database operations happen in actor (off MainActor)
- Models fetched in background
- Only final results passed back to MainActor
- No blocking UI during fetch

---

### Pattern 8: Core Data Thread-Safe Fetch

**When**: Fetching from Core Data on background thread with UI updates

```swift
// ✅ Thread-safe Core Data fetch pattern
actor CoreDataFetcher {
    let persistentContainer: NSPersistentContainer

    func fetchTracksID(genre: String) async throws -> [String] {
        // ✅ Create background context
        let context = persistentContainer.newBackgroundContext()

        // ✅ Lightweight representation (just IDs, Sendable)
        var trackIDs: [String] = []

        try await context.perform {
            let request = NSFetchRequest<CDTrack>(entityName: "Track")
            request.predicate = NSPredicate(format: "genre = %@", genre)

            let results = try context.fetch(request)
            // ✅ Extract IDs BEFORE leaving context
            trackIDs = results.map { $0.id }
        }

        return trackIDs  // ✅ Return lightweight data
    }

    func fetchFullTracks(ids: [String]) async throws -> [Track] {
        // ✅ On MainActor, fetch full objects using IDs
        let mainContext = persistentContainer.viewContext

        var tracks: [Track] = []
        for id in ids {
            let request = NSFetchRequest<CDTrack>(entityName: "Track")
            request.predicate = NSPredicate(format: "id = %@", id)

            if let cdTrack = try mainContext.fetch(request).first {
                tracks.append(Track(from: cdTrack))
            }
        }

        return tracks
    }
}
```

**Why**: NSManagedObjects are thread-confined. Always:
1. Fetch on background context
2. Extract lightweight data (IDs, strings) BEFORE leaving context
3. Pass lightweight data back to MainActor
4. Fetch full objects on MainActor if needed

---

### Pattern 9: Batch Import with Progress Reporting

**When**: Importing large datasets (100k+ records) without UI freeze

```swift
// ✅ Batch import with progress feedback
actor DataImporter {
    let modelContainer: ModelContainer

    typealias ProgressCallback = (Int, Int) -> Void  // current, total

    func importRecords(_ records: [RawRecord], onProgress: @MainActor ProgressCallback) async throws {
        let chunkSize = 1000
        let context = ModelContext(modelContainer)

        for (index, chunk) in records.chunked(into: chunkSize).enumerated() {
            // ✅ Process chunk
            for record in chunk {
                let track = Track(
                    id: record.id,
                    title: record.title,
                    artist: record.artist,
                    duration: record.duration
                )
                context.insert(track)
            }

            // ✅ Save after chunk
            try context.save()

            // ✅ Report progress to MainActor UI
            let processed = (index + 1) * chunkSize
            await onProgress(min(processed, records.count), records.count)

            // ✅ Check for cancellation
            if Task.isCancelled {
                throw CancellationError()
            }
        }
    }
}

// Usage
@MainActor
class ImportViewModel: ObservableObject {
    @Published var progress: Double = 0

    func importData(_ records: [RawRecord]) async {
        do {
            try await importer.importRecords(records) { [weak self] current, total in
                self?.progress = Double(current) / Double(total)
            }
        } catch {
            print("Import failed: \(error)")
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

**Why**:
- Chunks prevent memory bloat
- Periodic saves prevent data loss
- Progress callbacks keep UI responsive
- Cancellation support for user control

---

### Pattern 10: GRDB Background Query Execution

**When**: Complex SQL queries that block UI

```swift
// ✅ GRDB queries on background thread
actor DatabaseQueryExecutor {
    let dbQueue: DatabaseQueue

    func fetchUserWithPosts(userId: String) async throws -> (user: User, posts: [Post]) {
        // ✅ Query happens on GRDB's background thread automatically
        return try await dbQueue.read { db in
            let user = try User.filter(Column("id") == userId).fetchOne(db)!

            // ✅ Fetch related posts (complex join)
            let posts = try Post
                .filter(Column("userId") == userId)
                .order(Column("createdAt").desc)
                .limit(100)
                .fetchAll(db)

            return (user, posts)
        }
    }

    func aggregateUserStats(userId: String) async throws -> UserStats {
        // ✅ Complex SQL on background thread
        return try await dbQueue.read { db in
            let postCount = try Post
                .filter(Column("userId") == userId)
                .fetchCount(db)

            let likeCount = try Like
                .filter(Column("userId") == userId)
                .fetchCount(db)

            return UserStats(postCount: postCount, likeCount: likeCount)
        }
    }
}

// Usage (on MainActor)
@MainActor
class UserViewModel: ObservableObject {
    @Published var user: User?
    @Published var posts: [Post] = []

    func loadUser(_ id: String) async {
        do {
            let (user, posts) = try await executor.fetchUserWithPosts(userId: id)
            self.user = user
            self.posts = posts
        } catch {
            print("Failed: \(error)")
        }
    }
}
```

**Why**: GRDB's `read()` and `write()` methods automatically dispatch to background, so:
1. Complex queries don't block MainActor
2. Thread safety is automatic
3. Results returned to caller (no threading needed)

---

### Pattern 11: CloudKit Sync with Progress Monitoring

**When**: Syncing data to CloudKit while keeping UI responsive

```swift
// ✅ Structured concurrency for CloudKit sync
@MainActor
class CloudKitSyncManager: ObservableObject {
    @Published var isSyncing = false
    @Published var syncProgress: Double = 0
    @Published var lastSyncDate: Date?

    let modelContainer: ModelContainer

    func syncToCloudKit() async {
        isSyncing = true
        syncProgress = 0

        let syncTask = Task {
            do {
                // ✅ Run sync operation
                try await performCloudKitSync()

                // ✅ Update UI when complete
                lastSyncDate = Date()
                syncProgress = 1.0
            } catch {
                print("Sync failed: \(error)")
            }
        }

        // ✅ Optional: Show progress updates
        for try await _ in NotificationCenter.default
            .notifications(named: NSNotification.Name("CloudKitSyncProgress")) {
            // Update progress here
        }

        await syncTask.value  // Wait for completion
        isSyncing = false
    }

    private func performCloudKitSync() async throws {
        let context = ModelContext(modelContainer)

        // ✅ Fetch local changes
        let descriptor = FetchDescriptor<Track>(
            predicate: #Predicate { $0.needsSync }
        )
        let unsyncedTracks = try context.fetch(descriptor)

        // ✅ Upload in batches
        for chunk in unsyncedTracks.chunked(into: 100) {
            for track in chunk {
                track.needsSync = false
            }
            try context.save()
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

**Why**:
- CloudKit sync happens off MainActor
- UI remains responsive during sync
- Progress reporting keeps user informed
- Structured concurrency enables cancellation support

---

### Pattern 12: Main Thread Safety for Persistence Operations

**When**: Ensuring persistence operations don't access UI state unsafely

```swift
// ❌ WRONG: Accessing @Published properties from background
actor DataSaver {
    func saveTrack(_ track: Track, viewModel: TrackViewModel) async throws {
        // ❌ Unsafe: viewModel is @MainActor, can't access from background
        let oldTrack = viewModel.currentTrack
        viewModel.currentTrack = track  // ❌ Data race!
    }
}

// ✅ CORRECT: Pass data, not references
@MainActor
class TrackViewModel: ObservableObject {
    @Published var currentTrack: Track?

    func saveTrack(_ track: Track, using saver: DataSaver) async {
        do {
            // ✅ Pass data, not self
            try await saver.saveTrack(track)

            // ✅ Back on MainActor, safe to update
            self.currentTrack = track
        } catch {
            print("Save failed: \(error)")
        }
    }
}

actor DataSaver {
    let modelContainer: ModelContainer

    func saveTrack(_ track: Track) async throws {
        let context = ModelContext(modelContainer)
        context.insert(track)
        try context.save()
        // ✅ Return to MainActor caller
    }
}
```

**Key rule**: Never pass `@MainActor` objects or properties to background actors. Always extract the data you need first.

---

## Anti-Patterns (DO NOT DO THIS)

### Anti-Pattern 1: Accessing Self Before Task Hop
```swift
// ❌ NEVER DO THIS
nonisolated func delegate(_ param: Type) {
    Task { @MainActor in
        self.property = param.value  // ❌ WRONG: accessing self before hop
    }
}
```

### Anti-Pattern 2: Strong Self in Stored Tasks
```swift
// ❌ NEVER DO THIS
progressTask = Task {  // ❌ Memory leak!
    while true {
        await self.update()
    }
}
```

### Anti-Pattern 3: Using nonisolated(unsafe) Without Justification
```swift
// ❌ DON'T DO THIS
nonisolated(unsafe) var currentTrack: Track?  // ❌ Mutable! Data race possible!

// ✅ DO THIS
@MainActor var currentTrack: Track?  // ✅ Actor-isolated, safe
```

**Rule**: Only use `nonisolated(unsafe)` for:
- Static immutable values you're certain are thread-safe
- Legacy global state that can't be refactored (document why)

---

## Common Swift 6 Errors & Fixes

### Error: "Main actor-isolated property ... accessed from nonisolated context"

**Fix**: Use Pattern 2 (Value Capture Before Task)

---

### Error: "Type ... does not conform to the Sendable protocol"

**Fix**: Add `Sendable` conformance to the type:
```swift
enum State: Sendable {  // ✅ Add Sendable
    case idle
    case active
}
```

---

### Error: "Static property ... must be Sendable"

**Fix**: Use `nonisolated static let` (for immutable data):
```swift
nonisolated static let defaultValue = "Hello"
```

---

### Warning: "Capture of 'self' with non-Sendable type in a @Sendable closure"

**Fix**: Use `[weak self]` in Task:
```swift
Task { [weak self] in  // ✅ Weak capture
    guard let self = self else { return }
    // ...
}
```

---

## Build Settings for Swift 6

**Enable strict concurrency checking**

```
Build Settings → Swift Compiler — Concurrency
→ "Strict Concurrency Checking" = Complete
```

**What it does**:
- Compile-time data race prevention
- Enforces actor isolation
- Requires explicit Sendable conformance

---

## Code Review Checklist

Use this when reviewing new code or fixing concurrency warnings:

### 1. Delegate Methods
- [ ] All delegate methods marked `nonisolated`
- [ ] Delegate parameter values captured **before** Task creation
- [ ] Accessing `self` inside `Task { @MainActor in }` is safe and expected
- [ ] Captured values used for delegate parameters only

### 2. Types Crossing Actors
- [ ] Enums have `: Sendable` if crossing actors
- [ ] Structs have all Sendable properties
- [ ] No classes crossing actors (use @MainActor or actors)

### 3. Tasks
- [ ] Stored Tasks use `[weak self]`
- [ ] Short-lived Tasks can use strong self
- [ ] Task inherits actor context from creation point

### 4. Property Access
- [ ] Multi-property access uses cached reference
- [ ] No torn reads from changing state
- [ ] Optional unwrapping with `?? fallback`

### 5. Actor Isolation
- [ ] UI-touching code is @MainActor
- [ ] Background work is nonisolated or uses @concurrent
- [ ] No blocking operations on MainActor

---

## Real-World Impact

**Before** Random crashes, data races, "works on my machine" bugs
**After** Compile-time guarantees, no data races, predictable behavior

**Key insight** Swift 6's strict concurrency catches bugs at compile time instead of runtime crashes.

---

## Reference Documentation

**Apple Resources**:
- [Swift Concurrency Documentation](https://docs.swift.org/swift-book/LanguageGuide/Concurrency.html)
- [Adopting strict concurrency in Swift 6](https://developer.apple.com/documentation/swift/adoptingswift6)
- [Sendable Protocol](https://developer.apple.com/documentation/swift/sendable)
- [WWDC 2022: Eliminate data races using Swift Concurrency](https://developer.apple.com/videos/play/wwdc2022/110351/)
- [WWDC 2021: Protect mutable state with Swift actors](https://developer.apple.com/videos/play/wwdc2021/10133/)

---

**Last Updated**: 2025-11-28
**Status**: Production-ready patterns for Swift 6 strict concurrency
