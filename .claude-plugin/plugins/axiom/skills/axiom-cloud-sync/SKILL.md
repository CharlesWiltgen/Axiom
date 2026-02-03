---
name: axiom-cloud-sync
description: Use when choosing between CloudKit vs iCloud Drive, implementing reliable sync, handling offline-first patterns, or designing sync architecture - prevents common sync mistakes that cause data loss
license: MIT
compatibility: iOS 10+, macOS 10.12+
metadata:
  version: "1.0.0"
  last-updated: "2025-12-25"
---

# Cloud Sync

## Overview

**Core principle**: Choose the right sync technology for the data shape, then implement offline-first patterns that handle network failures gracefully.

Two fundamentally different sync approaches:
- **CloudKit** — Structured data (records with fields and relationships)
- **iCloud Drive** — File-based data (documents, images, any file format)

## Quick Decision Tree

```
What needs syncing?

├─ Structured data (records, relationships)?
│  ├─ Using SwiftData? → SwiftData + CloudKit (easiest, iOS 17+)
│  ├─ Need shared/public database? → CKSyncEngine or raw CloudKit
│  └─ Custom persistence (GRDB, SQLite)? → CKSyncEngine (iOS 17+)
│
├─ Documents/files users expect in Files app?
│  └─ iCloud Drive (UIDocument or FileManager)
│
├─ Large binary blobs (images, videos)?
│  ├─ Associated with structured data? → CKAsset in CloudKit
│  └─ Standalone files? → iCloud Drive
│
└─ App settings/preferences?
   └─ NSUbiquitousKeyValueStore (simple key-value, 1MB limit)
```

## CloudKit vs iCloud Drive

| Aspect | CloudKit | iCloud Drive |
|--------|----------|--------------|
| **Data shape** | Structured records | Files/documents |
| **Query support** | Full query language | Filename only |
| **Relationships** | Native support | None (manual) |
| **Conflict resolution** | Record-level | File-level |
| **User visibility** | Hidden from user | Visible in Files app |
| **Sharing** | Record/database sharing | File sharing |
| **Offline** | Local cache required | Automatic download |

## Red Flags

If ANY of these appear, STOP and reconsider:

- ❌ "Store JSON files in CloudKit" — Wrong tool. Use iCloud Drive for files
- ❌ "Build relationships manually in iCloud Drive" — Wrong tool. Use CloudKit
- ❌ "Assume sync is instant" — Network fails. Design offline-first
- ❌ "Skip conflict handling" — Conflicts WILL happen on multiple devices
- ❌ "Use CloudKit for user documents" — Users can't see them. Use iCloud Drive
- ❌ "Sync on app launch only" — Users expect continuous sync

## Offline-First Pattern

**MANDATORY**: All sync code must work offline first.

```swift
// ✅ CORRECT: Offline-first architecture
class OfflineFirstSync {
    private let localStore: LocalDatabase  // GRDB, SwiftData, Core Data
    private let syncEngine: CKSyncEngine

    // Write to LOCAL first, sync to cloud in background
    func save(_ item: Item) async throws {
        // 1. Save locally (instant)
        try await localStore.save(item)

        // 2. Queue for sync (non-blocking)
        syncEngine.state.add(pendingRecordZoneChanges: [
            .saveRecord(item.recordID)
        ])
    }

    // Read from LOCAL (instant)
    func fetch() async throws -> [Item] {
        return try await localStore.fetchAll()
    }
}

// ❌ WRONG: Cloud-first (blocks on network)
func save(_ item: Item) async throws {
    // Fails when offline, slow on bad network
    try await cloudKit.save(item)
    try await localStore.save(item)
}
```

## Conflict Resolution Strategies

Conflicts occur when two devices edit the same data before syncing.

### Strategy 1: Last-Writer-Wins (Simplest)

```swift
// Server always has latest, client accepts it
func resolveConflict(local: CKRecord, server: CKRecord) -> CKRecord {
    return server  // Accept server version
}
```

**Use when**: Data is non-critical, user won't notice overwrites

### Strategy 2: Merge (Most Common)

```swift
// Combine changes from both versions
func resolveConflict(local: CKRecord, server: CKRecord) -> CKRecord {
    let merged = server.copy() as! CKRecord

    // For each field, apply custom merge logic
    merged["notes"] = mergeText(
        local["notes"] as? String,
        server["notes"] as? String
    )
    merged["tags"] = mergeSets(
        local["tags"] as? [String] ?? [],
        server["tags"] as? [String] ?? []
    )

    return merged
}
```

**Use when**: Both versions contain valuable changes

### Strategy 3: User Choice

```swift
// Present conflict to user
func resolveConflict(local: CKRecord, server: CKRecord) async -> CKRecord {
    let choice = await presentConflictUI(local: local, server: server)
    return choice == .keepLocal ? local : server
}
```

**Use when**: Data is critical, user must decide

## Common Patterns

### Pattern 1: SwiftData + CloudKit (Recommended for New Apps)

```swift
import SwiftData

// Automatic CloudKit sync with zero configuration
@Model
class Note {
    var title: String
    var content: String
    var createdAt: Date

    init(title: String, content: String) {
        self.title = title
        self.content = content
        self.createdAt = Date()
    }
}

// Container automatically syncs if CloudKit entitlement present
let container = try ModelContainer(for: Note.self)
```

**Limitations**:
- Private database only (no public/shared)
- Automatic sync (less control over timing)
- No custom conflict resolution

### Pattern 2: CKSyncEngine (Custom Persistence)

```swift
// For GRDB, SQLite, or custom databases
class MySyncManager: CKSyncEngineDelegate {
    private let engine: CKSyncEngine
    private let database: GRDBDatabase

    func handleEvent(_ event: CKSyncEngine.Event) async {
        switch event {
        case .stateUpdate(let update):
            // Persist sync state
            await saveSyncState(update.stateSerialization)

        case .fetchedDatabaseChanges(let changes):
            // Apply changes to local DB
            for zone in changes.modifications {
                await handleZoneChanges(zone)
            }

        case .sentRecordZoneChanges(let sent):
            // Mark records as synced
            for saved in sent.savedRecords {
                await markSynced(saved.recordID)
            }
        }
    }
}
```

See `axiom-cloudkit-ref` for complete CKSyncEngine setup.

### Pattern 3: iCloud Drive Documents

```swift
import UIKit

class MyDocument: UIDocument {
    var content: Data?

    override func contents(forType typeName: String) throws -> Any {
        return content ?? Data()
    }

    override func load(fromContents contents: Any, ofType typeName: String?) throws {
        content = contents as? Data
    }
}

// Save to iCloud Drive (visible in Files app)
let url = FileManager.default.url(forUbiquityContainerIdentifier: nil)?
    .appendingPathComponent("Documents")
    .appendingPathComponent("MyFile.txt")

let doc = MyDocument(fileURL: url!)
doc.content = "Hello".data(using: .utf8)
doc.save(to: url!, for: .forCreating)
```

See `axiom-icloud-drive-ref` for NSFileCoordinator and conflict handling.

## Anti-Patterns

### 1. Ignoring Sync State

```swift
// ❌ WRONG: No awareness of pending changes
var items: [Item] = []  // Are these synced? Pending? Conflicted?

// ✅ CORRECT: Track sync state
struct SyncableItem {
    let item: Item
    let syncState: SyncState  // .synced, .pending, .conflict
}
```

### 2. Blocking UI on Sync

```swift
// ❌ WRONG: UI blocks until sync completes
func viewDidLoad() async {
    items = try await cloudKit.fetchAll()  // Spinner forever on airplane
    tableView.reloadData()
}

// ✅ CORRECT: Show local data immediately
func viewDidLoad() {
    items = localStore.fetchAll()  // Instant
    tableView.reloadData()

    Task {
        await syncEngine.fetchChanges()  // Background update
    }
}
```

### 3. No Retry Logic

```swift
// ❌ WRONG: Single attempt
try await cloudKit.save(record)

// ✅ CORRECT: Exponential backoff
func saveWithRetry(_ record: CKRecord, attempts: Int = 3) async throws {
    for attempt in 0..<attempts {
        do {
            try await cloudKit.save(record)
            return
        } catch let error as CKError where error.isRetryable {
            let delay = pow(2.0, Double(attempt))
            try await Task.sleep(for: .seconds(delay))
        }
    }
    throw SyncError.maxRetriesExceeded
}
```

## Sync State Indicators

Always show users the sync state:

```swift
enum SyncState {
    case synced       // ✓ (checkmark)
    case pending      // ↻ (arrows)
    case conflict     // ⚠ (warning)
    case offline      // ☁ with X
}

// In SwiftUI
HStack {
    Text(item.title)
    Spacer()
    SyncIndicator(state: item.syncState)
}
```

## Entitlement Checklist

Before sync will work:

1. **Xcode → Signing & Capabilities**
   - ✓ iCloud capability added
   - ✓ CloudKit checked (for CloudKit)
   - ✓ iCloud Documents checked (for iCloud Drive)
   - ✓ Container selected/created

2. **Apple Developer Portal**
   - ✓ App ID has iCloud capability
   - ✓ CloudKit container exists (for CloudKit)

3. **Device**
   - ✓ Signed into iCloud
   - ✓ iCloud Drive enabled (Settings → [Name] → iCloud)

## Pressure Scenarios

### Scenario 1: "Just skip conflict handling for v1"

**Situation**: Deadline pressure to ship without conflict resolution.

**Risk**: Users WILL edit on multiple devices. Data WILL be lost silently.

**Response**: "Minimum viable conflict handling takes 2 hours. Silent data loss costs users and generates 1-star reviews."

### Scenario 2: "Sync on app launch is enough"

**Situation**: Avoiding continuous sync complexity.

**Risk**: Users expect changes to appear within seconds, not on next launch.

**Response**: Use CKSyncEngine or SwiftData which handle continuous sync automatically.

## Related Skills

- `axiom-cloudkit-ref` — Complete CloudKit API reference
- `axiom-icloud-drive-ref` — File-based sync with NSFileCoordinator
- `axiom-cloud-sync-diag` — Debugging sync failures
- `axiom-storage` — Choosing where to store data locally
