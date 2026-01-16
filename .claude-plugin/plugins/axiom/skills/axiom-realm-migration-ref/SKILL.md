---
name: axiom-realm-migration-ref
description: Use when migrating from Realm to SwiftData - comprehensive migration guide covering pattern equivalents, threading model conversion, schema migration strategies, CloudKit sync transition, and real-world scenarios
user-invocable: true
skill_type: reference
version: 1.0.0
---

# Realm to SwiftData Migration — Reference Guide

**Purpose**: Complete migration path from Realm to SwiftData
**Swift Version**: Swift 5.9+ (Swift 6 with strict concurrency recommended)
**iOS Version**: iOS 17+ (iOS 26+ recommended)
**Context**: Realm Device Sync sunset Sept 30, 2025. This guide is essential for Realm users migrating before deadline.

---

## Critical Timeline

**Realm Device Sync** DEPRECATION DEADLINE = September 30, 2025

If your app uses Realm Sync:
- ⚠️ You MUST migrate by September 30, 2025
- ✅ SwiftData is the recommended replacement
- ⏰ Time remaining: Depends on current date, but migrations take 2-8 weeks for production apps

**This guide** provides everything needed for successful migration.

---

## Migration Strategy Overview

```
Phase 1 (Week 1-2): Preparation & Planning
├─ Audit current Realm usage
├─ Understand model relationships
├─ Plan data migration path
└─ Set up test environment

Phase 2 (Week 2-3): Development
├─ Create SwiftData models from Realm schemas
├─ Implement data migration logic
├─ Convert threading model to async/await
└─ Test with real data

Phase 3 (Week 3-4): Migration
├─ Migrate existing app users' data
├─ Run in parallel (Realm + SwiftData)
├─ Verify CloudKit sync works
└─ Monitor for issues

Phase 4 (Week 4+): Production
├─ Deploy update with parallel persistence
├─ Gradual cutover from Realm to SwiftData
├─ Deprecate Realm code
└─ Monitor CloudKit sync health
```

---

## Part 1: Pattern Equivalents

### Model Definition Conversion

#### Realm → SwiftData: Basic Model

```swift
// REALM
class RealmTrack: Object {
    @Persisted(primaryKey: true) var id: String
    @Persisted var title: String
    @Persisted var artist: String
    @Persisted var duration: TimeInterval
    @Persisted var genre: String?
}

// SWIFTDATA
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

**Key differences**:
- Realm: `@Persisted(primaryKey: true)` → SwiftData: `@Attribute(.unique)`
- Realm: Implicit init → SwiftData: Explicit init required
- Realm: `Object` base class → SwiftData: `@Model` macro on `final class`

#### Realm → SwiftData: Relationships

```swift
// REALM: One-to-Many
class RealmAlbum: Object {
    @Persisted(primaryKey: true) var id: String
    @Persisted var title: String
    @Persisted var tracks: RealmSwiftCollection<RealmTrack>
}

// SWIFTDATA: One-to-Many
@Model
final class Album {
    @Attribute(.unique) var id: String
    var title: String

    @Relationship(deleteRule: .cascade, inverse: \Track.album)
    var tracks: [Track] = []
}

@Model
final class Track {
    @Attribute(.unique) var id: String
    var title: String
    var album: Album?  // Inverse automatically maintained
}
```

**Key differences**:
- Realm: Explicit `RealmSwiftCollection` type → SwiftData: Native `[Track]` array
- Realm: Manual relationship management → SwiftData: Inverse relationships automatic
- Realm: No delete rules → SwiftData: `deleteRule: .cascade / .nullify / .deny`

#### Realm → SwiftData: Indexes

```swift
// REALM
class RealmTrack: Object {
    @Persisted(primaryKey: true) var id: String
    @Persisted(indexed: true) var genre: String
    @Persisted(indexed: true) var releaseDate: Date
}

// SWIFTDATA
@Model
final class Track {
    @Attribute(.unique) var id: String
    @Attribute(.indexed) var genre: String = ""
    @Attribute(.indexed) var releaseDate: Date = Date()
}
```

---

## Part 2: Threading Model Conversion

### Realm Threading → Swift Concurrency

#### Realm: Manual Thread Handling

```swift
class RealmDataManager {
    func fetchTracksOnBackground() {
        DispatchQueue.global().async {
            let realm = try! Realm()  // Must get Realm on each thread
            let tracks = realm.objects(RealmTrack.self)

            DispatchQueue.main.async {
                self.updateUI(tracks: Array(tracks))
            }
        }
    }

    func saveTrackOnBackground(_ track: RealmTrack) {
        DispatchQueue.global().async {
            let realm = try! Realm()
            try! realm.write {
                realm.add(track)
            }
        }
    }
}
```

**Problems**:
- Manual DispatchQueue threading error-prone
- Easy to access objects on wrong thread
- No compile-time guarantees

#### SwiftData: Actor-Based Concurrency

```swift
actor SwiftDataManager {
    let modelContainer: ModelContainer

    func fetchTracks() async -> [Track] {
        let context = ModelContext(modelContainer)
        let descriptor = FetchDescriptor<Track>()
        return (try? context.fetch(descriptor)) ?? []
    }

    func saveTrack(_ track: Track) async {
        let context = ModelContext(modelContainer)
        context.insert(track)
        try? context.save()
    }
}

// Usage (automatic thread handling)
@MainActor
class ViewController: UIViewController {
    @State private var tracks: [Track] = []
    private let manager: SwiftDataManager

    func loadTracks() async {
        tracks = await manager.fetchTracks()
    }
}
```

**Advantages**:
- No manual DispatchQueue
- Compile-time thread safety
- Automatic actor isolation
- Swift 6 strict concurrency compatible

#### Common Threading Patterns

| Realm Pattern | SwiftData Pattern |
|--------------|------------------|
| `DispatchQueue.global().async` | `async/await` in background actor |
| `realm.write { }` | `context.insert()` + `context.save()` |
| Manual thread-local Realm instances | Shared `ModelContainer` + background `ModelContext` |
| `Thread.isMainThread` checks | `@MainActor` annotations |

---

## Part 3: Schema Migration Strategies

### Simple Schema Migration (Direct Conversion)

For apps with simple schemas (< 5 tables, < 10 fields), direct migration is straightforward:

```swift
actor SchemaImporter {
    let realmPath: String
    let modelContainer: ModelContainer

    func migrateFromRealm() async throws {
        // 1. Open Realm database
        let realmConfig = Realm.Configuration(fileURL: URL(fileURLWithPath: realmPath))
        let realm = try await Realm(configuration: realmConfig)

        // 2. Create SwiftData context
        let context = ModelContext(modelContainer)

        // 3. Migrate each model type
        try migrateAllTracks(from: realm, to: context)
        try migrateAllAlbums(from: realm, to: context)
        try migrateAllPlaylists(from: realm, to: context)

        // 4. Save all at once
        try context.save()

        print("Migration complete!")
    }

    private func migrateAllTracks(from realm: Realm, to context: ModelContext) throws {
        let realmTracks = realm.objects(RealmTrack.self)

        for realmTrack in realmTracks {
            let sdTrack = Track(
                id: realmTrack.id,
                title: realmTrack.title,
                artist: realmTrack.artist,
                duration: realmTrack.duration,
                genre: realmTrack.genre
            )
            context.insert(sdTrack)
        }
    }

    private func migrateAllAlbums(from realm: Realm, to context: ModelContext) throws {
        let realmAlbums = realm.objects(RealmAlbum.self)

        for realmAlbum in realmAlbums {
            let sdAlbum = Album(
                id: realmAlbum.id,
                title: realmAlbum.title
            )
            context.insert(sdAlbum)

            // Connect relationships after creating all records
            for realmTrack in realmAlbum.tracks {
                if let sdTrack = findTrack(id: realmTrack.id, in: context) {
                    sdAlbum.tracks.append(sdTrack)
                }
            }
        }
    }

    private func findTrack(id: String, in context: ModelContext) -> Track? {
        let descriptor = FetchDescriptor<Track>(
            predicate: #Predicate { $0.id == id }
        )
        return try? context.fetch(descriptor).first
    }
}
```

### Complex Schema Migration (Transformation Layer)

For apps with complex schemas, many computed properties, or data transformations:

```swift
// Step 1: Define transformation layer
struct TrackDTO {
    let realmTrack: RealmTrack

    var id: String { realmTrack.id }
    var title: String { realmTrack.title }
    var cleanTitle: String { realmTrack.title.trimmingCharacters(in: .whitespaces) }
    var durationFormatted: String {
        let minutes = Int(realmTrack.duration) / 60
        let seconds = Int(realmTrack.duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// Step 2: Migrate through transformation layer
actor ComplexMigrator {
    let modelContainer: ModelContainer

    func migrateWithTransformation(from realm: Realm) throws {
        let context = ModelContext(modelContainer)

        let realmTracks = realm.objects(RealmTrack.self)
        for realmTrack in realmTracks {
            let dto = TrackDTO(realmTrack: realmTrack)

            // Transform data during migration
            let sdTrack = Track(
                id: dto.id,
                title: dto.cleanTitle,  // Cleaned version
                artist: realmTrack.artist,
                duration: realmTrack.duration
            )
            context.insert(sdTrack)
        }

        try context.save()
    }
}
```

---

## Part 4: CloudKit Sync Transition

### Realm Sync → SwiftData CloudKit

Realm Sync (now deprecated) provided automatic sync. SwiftData uses CloudKit directly:

```swift
// REALM SYNC: Automatic but deprecated
let config = Realm.Configuration(
    syncConfiguration: SyncConfiguration(user: app.currentUser!)
)

// SWIFTDATA: CloudKit (recommended replacement)
let schema = Schema([Track.self, Album.self])
let config = ModelConfiguration(
    schema: schema,
    cloudKitDatabase: .private("iCloud.com.example.MusicApp")
)

let container = try ModelContainer(for: schema, configurations: config)
```

### Sync Status Monitoring

```swift
@MainActor
class CloudKitSyncMonitor: ObservableObject {
    @Published var isSyncing = false
    @Published var lastSyncDate: Date?
    @Published var syncError: Error?

    let modelContainer: ModelContainer

    func startMonitoring() {
        // Monitor CloudKit sync notifications
        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("CloudKitSyncDidComplete"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.isSyncing = false
            self?.lastSyncDate = Date()
        }
    }

    func syncNow() async {
        isSyncing = true

        do {
            let context = ModelContext(modelContainer)
            // SwiftData sync happens automatically
            // Manually fetch to trigger sync
            let descriptor = FetchDescriptor<Track>()
            _ = try context.fetch(descriptor)
        } catch {
            syncError = error
        }

        isSyncing = false
    }
}
```

### Migration Timing: Realm Sync → CloudKit

```
Timeline:
Week 1-2: Development & Testing
├─ Create SwiftData models
├─ Test migrations in non-CloudKit mode
└─ Prepare CloudKit configuration

Week 3: CloudKit Sync Testing
├─ Enable CloudKit in test build
├─ Verify sync works with small datasets
├─ Test multi-device sync
└─ Test conflict resolution

Week 4+: Production Rollout
├─ Deploy app with SwiftData + CloudKit
├─ Initially run parallel (Realm Sync + SwiftData CloudKit)
├─ Monitor both sync mechanisms
├─ Gradually deprecate Realm Sync
└─ Final cutoff before Sept 30, 2025
```

---

## Part 5: Real-World Migration Scenarios

### Scenario A: Small App (< 10,000 Records)

**Timeline**: 1-2 weeks
**Data Size**: < 10 MB

```swift
// 1. Export Realm data
let realmPath = Realm.Configuration.defaultConfiguration.fileURL!

// 2. Migrate in background task
actor SmallAppMigration {
    let modelContainer: ModelContainer

    func migrateSmallApp() async throws {
        let realmConfig = Realm.Configuration(fileURL: realmPath)
        let realm = try await Realm(configuration: realmConfig)

        let context = ModelContext(modelContainer)

        // All-at-once migration (safe for < 10k records)
        let allTracks = realm.objects(RealmTrack.self)
        for realmTrack in allTracks {
            let track = Track(from: realmTrack)
            context.insert(track)
        }

        try context.save()
        print("✅ Migrated \(allTracks.count) tracks")
    }
}

// 3. Deploy
// Option 1: Migrate on first launch (offline)
// Option 2: Provide manual "Migrate Data" button
// Option 3: Automatic migration in background
```

### Scenario B: Medium App (100,000 - 1,000,000 Records)

**Timeline**: 3-4 weeks
**Data Size**: 100 MB - 1 GB
**Challenge**: Progress reporting, memory management

```swift
actor MediumAppMigration {
    let modelContainer: ModelContainer
    let realmPath: String

    typealias ProgressCallback = (Int, Int) -> Void

    func migrateMediumApp(onProgress: @MainActor ProgressCallback) async throws {
        let realmConfig = Realm.Configuration(fileURL: URL(fileURLWithPath: realmPath))
        let realm = try await Realm(configuration: realmConfig)

        let context = ModelContext(modelContainer)
        let allTracks = realm.objects(RealmTrack.self)
        let totalCount = allTracks.count

        // Chunk-based migration for memory efficiency
        var count = 0
        for chunk in Array(allTracks).chunked(into: 5000) {
            for realmTrack in chunk {
                let track = Track(from: realmTrack)
                context.insert(track)
            }

            // Save periodically
            try context.save()

            count += chunk.count
            await onProgress(count, totalCount)

            // Check for cancellation
            if Task.isCancelled {
                throw CancellationError()
            }
        }
    }
}

// 4. Show progress UI
@MainActor
class MigrationViewController: UIViewController {
    @IBOutlet weak var progressView: UIProgressView!
    @IBOutlet weak var statusLabel: UILabel!

    func startMigration() {
        Task {
            do {
                try await migrator.migrateMediumApp { current, total in
                    self.progressView.progress = Float(current) / Float(total)
                    self.statusLabel.text = "Migrated \(current) of \(total)..."
                }

                self.statusLabel.text = "✅ Migration complete!"
            } catch {
                self.statusLabel.text = "❌ Migration failed: \(error)"
            }
        }
    }
}
```

### Scenario C: Large App (Enterprise, > 1 Million Records)

**Timeline**: 6-8 weeks
**Data Size**: > 1 GB
**Challenge**: Minimal downtime, data integrity, rollback plan

```swift
class EnterpriseGradualMigration {
    let coreDataStack: CoreDataStack  // Existing Realm
    let modelContainer: ModelContainer
    let batchSize = 10000

    // Phase 1: Parallel migration
    func startGradualMigration() async {
        var offset = 0
        let totalRecords = countAllRecords()

        while offset < totalRecords {
            let batch = fetchRealmBatch(limit: batchSize, offset: offset)
            try? await migrateBatch(batch)

            offset += batchSize
            await reportProgress(offset, totalRecords)
        }
    }

    private func migrateBatch(_ batch: [RealmTrack]) async throws {
        let context = ModelContext(modelContainer)

        for realmTrack in batch {
            let track = Track(from: realmTrack)
            context.insert(track)
            track.migrationStatus = .completedPhase1
        }

        try context.save()

        // Give main thread time to breathe
        try await Task.sleep(nanoseconds: 100_000_000)  // 100ms
    }

    // Phase 2: Verify all migrated
    func verifyMigrationComplete() async throws {
        let sdContext = ModelContext(modelContainer)
        let sdCount = try sdContext.fetch(FetchDescriptor<Track>())

        let realmCount = countAllRealmRecords()

        guard sdCount.count == realmCount else {
            throw MigrationError.countMismatch(sd: sdCount.count, realm: realmCount)
        }

        print("✅ Verified: \(sdCount.count) records migrated")
    }

    // Phase 3: Rollback plan
    func rollbackToRealm() {
        // Keep Realm database intact until 100% confident
        // Only delete Realm after running stable on SwiftData for 2+ weeks
    }
}
```

---

## Part 6: Testing & Verification

### Data Integrity Checklist

Before going live with SwiftData:

```swift
@MainActor
class MigrationVerifier {
    func verifyMigration() async throws {
        print("🔍 Running migration verification...")

        // 1. Count verification
        let sdCount = try await countSwiftDataRecords()
        let realmCount = countRealmRecords()
        print("✓ Record count: SD=\(sdCount), Realm=\(realmCount)")

        guard sdCount == realmCount else {
            throw VerificationError.countMismatch
        }

        // 2. Data integrity sampling (spot checks)
        try await verifySampleRecords(count: min(100, sdCount / 10))
        print("✓ Spot checked 100 records - all valid")

        // 3. Relationship integrity
        try await verifyRelationships()
        print("✓ All relationships intact")

        // 4. CloudKit sync test
        try await verifyCloudKitSync()
        print("✓ CloudKit sync working")

        // 5. Performance test
        try await verifyPerformance()
        print("✓ Query performance acceptable")

        print("✅ All verifications passed!")
    }

    private func verifySampleRecords(count: Int) async throws {
        let sdContext = ModelContext(modelContainer)
        let descriptor = FetchDescriptor<Track>()

        let tracks = try sdContext.fetch(descriptor)
        let sample = Array(tracks.prefix(count))

        for track in sample {
            // Verify fields populated
            assert(!track.id.isEmpty, "Track has empty ID")
            assert(!track.title.isEmpty, "Track has empty title")
            assert(track.duration > 0, "Track has invalid duration")
        }
    }

    private func verifyRelationships() async throws {
        let sdContext = ModelContext(modelContainer)

        let albumDescriptor = FetchDescriptor<Album>()
        let albums = try sdContext.fetch(albumDescriptor)

        for album in albums {
            // Verify inverse relationships
            for track in album.tracks {
                assert(track.album?.id == album.id, "Relationship broken")
            }
        }
    }

    private func verifyCloudKitSync() async throws {
        let sdContext = ModelContext(modelContainer)

        // Insert test record
        let testTrack = Track(
            id: "test-" + UUID().uuidString,
            title: "Test Track",
            artist: "Test Artist",
            duration: 240
        )
        sdContext.insert(testTrack)
        try sdContext.save()

        // Verify CloudKit sync initiated
        // (Check iCloud → iPhone → Settings → iCloud for sync status)
        print("ℹ️  Check iCloud app to verify sync initiated")
    }

    private func verifyPerformance() async throws {
        let sdContext = ModelContext(modelContainer)

        let start = Date()

        let descriptor = FetchDescriptor<Track>(
            sortBy: [SortDescriptor(\.title)]
        )
        _ = try sdContext.fetch(descriptor)

        let elapsed = Date().timeIntervalSince(start)
        print("Fetch time: \(String(format: "%.2f", elapsed))s")

        guard elapsed < 2.0 else {
            throw VerificationError.performanceIssue
        }
    }
}
```

---

## Part 7: Troubleshooting

### Common Migration Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Property must have default" | CloudKit constraint | Add defaults: `var title: String = ""` |
| Relationships not synced | Missing inverse | Add `inverse: \Track.album` |
| Sync stuck | CloudKit auth issue | Check Settings → iCloud → CloudKit |
| Memory bloat during import | No chunking | Implement batch import (1000 at a time) |
| Data loss | No backup | Keep Realm copy for 2 weeks post-migration |

---

## Part 8: Success Criteria

Your migration is successful when:

- [ ] All data migrated correctly (count matches)
- [ ] Sample record verification passes (spot checks 100+ records)
- [ ] Relationships intact (inverse relationships work)
- [ ] CloudKit sync enabled and working
- [ ] Performance acceptable (queries < 1 second)
- [ ] No data races (Swift 6 strict concurrency)
- [ ] Tested on real device (not just simulator)
- [ ] Rollback plan documented and tested
- [ ] Realm database kept as backup for 2 weeks
- [ ] Zero crashes in production after 1 week

---

## Quick Reference: Command Checklist

```bash
# 1. Audit Realm usage
grep -r "RealmTrack\|RealmAlbum" . --include="*.swift"

# 2. Count Realm records (in app)
let realm = try! Realm()
let count = realm.objects(RealmTrack.self).count

# 3. Export Realm database
cp ~/Library/Developer/Realm/my_realm.realm ~/Downloads/backup.realm

# 4. Test SwiftData models
// Create in-memory test container
let config = ModelConfiguration(isStoredInMemoryOnly: true)
let container = try ModelContainer(for: Track.self, configurations: config)

# 5. Verify CloudKit
Settings → [Your Name] → iCloud → Check CloudKit status
```

---

## Resources

**WWDC**: 2024-10137

**Docs**: /swiftdata

**Skills**: axiom-swiftdata, axiom-swift-concurrency, axiom-database-migration

---

**Created**: 2025-11-30
**Status**: Production-ready migration guide
**Urgency**: Realm Device Sync sunset September 30, 2025
**Estimated Migration Time**: 2-8 weeks depending on app complexity
