---
name: axiom-cloudkit-ref
description: Use when implementing 'CloudKit sync', 'CKSyncEngine', 'CKRecord', 'CKDatabase', 'SwiftData CloudKit', 'shared database', 'public database', 'CloudKit zones', 'conflict resolution' - comprehensive CloudKit database APIs and modern sync patterns reference
user-invocable: true
skill_type: reference
version: 1.0.0
last_updated: 2025-12-12
apple_platforms: iOS 10.0+, iPadOS 13.0+, macOS 10.12+
---

# CloudKit Reference

**Purpose**: Comprehensive CloudKit reference for database-based iCloud storage and sync
**Availability**: iOS 10.0+ (basic), iOS 17.0+ (CKSyncEngine), iOS 17.0+ (SwiftData integration)
**Context**: Modern CloudKit sync via CKSyncEngine (WWDC 2023) or SwiftData integration

## When to Use This Skill

Use this skill when:
- Implementing structured data sync to iCloud
- Choosing between SwiftData+CloudKit, CKSyncEngine, or raw CloudKit APIs
- Setting up public/private/shared databases
- Implementing conflict resolution
- Debugging CloudKit sync issues
- Monitoring CloudKit performance

**NOT for**: Simple file sync (use `axiom-icloud-drive-ref` instead)

## Overview

**CloudKit is for STRUCTURED DATA sync** (records with relationships), not simple file sync.

Three modern approaches:
1. **SwiftData + CloudKit** (Easiest, iOS 17+)
2. **CKSyncEngine** (Custom persistence, iOS 17+, WWDC 2023)
3. **Raw CloudKit APIs** (Maximum control, more complexity)

---

## Approach 1: SwiftData + CloudKit (Recommended)

**When to use**: iOS 17+ apps with SwiftData models

**Limitations**:
- Private database only (no public/shared)
- Automatic sync (less control)
- SwiftData constraints apply

```swift
// ✅ CORRECT: SwiftData with CloudKit sync
import SwiftData

@Model
class Task {
    var title: String
    var isCompleted: Bool
    var dueDate: Date

    init(title: String, isCompleted: Bool = false, dueDate: Date) {
        self.title = title
        self.isCompleted = isCompleted
        self.dueDate = dueDate
    }
}

// Configure CloudKit container
let container = try ModelContainer(
    for: Task.self,
    configurations: ModelConfiguration(
        cloudKitDatabase: .private("iCloud.com.example.app")
    )
)

// That's it! Sync happens automatically
```

**Entitlements required**:
- iCloud capability
- CloudKit container

**Use `axiom-swiftdata` skill for SwiftData details**

---

## Approach 2: CKSyncEngine (Modern, WWDC 2023)

**When to use**: Custom persistence (SQLite, GRDB, JSON) with cloud sync

**Advantages over raw CloudKit**:
- Manages fetch/upload cycles automatically
- Handles conflicts
- Manages account changes
- Recommended over manual CKDatabase operations

```swift
// ✅ CORRECT: CKSyncEngine setup
import CloudKit

class SyncManager {
    let syncEngine: CKSyncEngine

    init() throws {
        let config = CKSyncEngine.Configuration(
            database: CKContainer.default().privateCloudDatabase,
            stateSerialization: loadSyncState(),
            delegate: self
        )

        syncEngine = try CKSyncEngine(config)
    }

    // Implement delegate methods
}

extension SyncManager: CKSyncEngineDelegate {
    // Handle events
    func handleEvent(_ event: CKSyncEngine.Event, syncEngine: CKSyncEngine) async {
        switch event {
        case .stateUpdate(let stateUpdate):
            saveSyncState(stateUpdate.stateSerialization)

        case .accountChange(let change):
            handleAccountChange(change)

        case .fetchedDatabaseChanges(let changes):
            applyDatabaseChanges(changes)

        case .fetchedRecordZoneChanges(let changes):
            applyRecordChanges(changes)

        case .sentRecordZoneChanges(let changes):
            handleSentChanges(changes)

        case .willFetchChanges, .didFetchChanges,
             .willSendChanges, .didSendChanges:
            // Optional lifecycle events
            break

        @unknown default:
            break
        }
    }

    // Next batch of changes to send
    func nextRecordZoneChangeBatch(
        _ context: CKSyncEngine.SendChangesContext,
        syncEngine: CKSyncEngine
    ) async -> CKSyncEngine.RecordZoneChangeBatch? {
        // Return pending local changes
        let pendingChanges = getPendingLocalChanges()
        return CKSyncEngine.RecordZoneChangeBatch(
            pendingSaves: pendingChanges,
            recordIDsToDelete: []
        )
    }
}
```

**Key concepts**:
- **State serialization**: Persist sync state between app launches
- **Events**: Delegate receives events for changes
- **Batches**: You provide pending changes, engine uploads them
- **Automatic conflict resolution**: Engine handles basic conflicts

---

## Approach 3: Raw CloudKit APIs (Legacy)

**When to use**: Only if CKSyncEngine doesn't fit (rare)

**Core types**:
- `CKContainer` — Entry point
- `CKDatabase` — Public/private/shared scope
- `CKRecord` — Individual data record
- `CKRecordZone` — Logical grouping
- `CKAsset` — Binary file storage

### Basic Operations

```swift
// ✅ Container and database
let container = CKContainer.default()
let privateDatabase = container.privateCloudDatabase
let publicDatabase = container.publicCloudDatabase

// ✅ Create record
let record = CKRecord(recordType: "Task")
record["title"] = "Buy groceries"
record["isCompleted"] = false
record["dueDate"] = Date()

// ✅ Save record
try await privateDatabase.save(record)

// ✅ Fetch record
let recordID = CKRecord.ID(recordName: "task-123")
let fetchedRecord = try await privateDatabase.record(for: recordID)

// ✅ Query records
let predicate = NSPredicate(format: "isCompleted == NO")
let query = CKQuery(recordType: "Task", predicate: predicate)
let (matchResults, _) = try await privateDatabase.records(matching: query)

for result in matchResults {
    if case .success(let record) = result.1 {
        print("Task: \(record["title"] as? String ?? "")")
    }
}

// ✅ Delete record
try await privateDatabase.deleteRecord(withID: recordID)
```

### Conflict Resolution

```swift
// ✅ Handle conflicts with savePolicy
let operation = CKModifyRecordsOperation(
    recordsToSave: [record],
    recordIDsToDelete: nil
)

// Save only if server version unchanged
operation.savePolicy = .ifServerRecordUnchanged

// OR: Always overwrite server
operation.savePolicy = .changedKeys  // Only changed fields

operation.modifyRecordsResultBlock = { result in
    switch result {
    case .success:
        print("Saved")
    case .failure(let error as CKError):
        if error.code == .serverRecordChanged {
            // Conflict - merge manually
            let serverRecord = error.serverRecord
            let clientRecord = error.clientRecord
            let merged = mergeRecords(server: serverRecord, client: clientRecord)
            // Retry with merged record
        }
    }
}

privateDatabase.add(operation)
```

---

## Database Scopes

| Scope | Accessibility | SwiftData Support | Use Case |
|-------|---------------|-------------------|----------|
| **Private** | User only | ✅ Yes | Personal user data |
| **Public** | All users | ❌ No | Shared/public content |
| **Shared** | Invited users | ❌ No | Collaboration |

### Private Database

```swift
// ✅ Private database (most common)
let privateDB = CKContainer.default().privateCloudDatabase

// User must be signed into iCloud
// Data syncs across user's devices
// Not visible to other users
```

### Public Database

```swift
// ✅ Public database (for shared content)
let publicDB = CKContainer.default().publicCloudDatabase

// Accessible to all app users
// Even unauthenticated users can read
// Writes require authentication
// Use for: Leaderboards, public content, discovery
```

### Shared Database

```swift
// ✅ Shared database (collaboration)
let sharedDB = CKContainer.default().sharedCloudDatabase

// For CKShare-based collaboration
// Users invited to specific record zones
// Use for: Shared documents, team data
```

---

## CloudKit Assets (Files)

```swift
// ✅ Store files as CKAsset
let imageURL = saveImageToTempFile(image)  // Must be file URL
let asset = CKAsset(fileURL: imageURL)

let record = CKRecord(recordType: "Photo")
record["image"] = asset
record["caption"] = "Sunset"

try await privateDatabase.save(record)

// ✅ Retrieve asset
let fetchedRecord = try await privateDatabase.record(for: recordID)
if let asset = fetchedRecord["image"] as? CKAsset,
   let fileURL = asset.fileURL {
    let imageData = try Data(contentsOf: fileURL)
    let image = UIImage(data: imageData)
}
```

**Important**: CKAsset requires a **file URL**, not Data. Write data to temp file first.

---

## CloudKit Console (Monitoring - WWDC 2024)

### Developer Notifications

Set up alerts for:
- Schema changes
- Quota exceeded
- High error rates
- Custom thresholds

### Telemetry

Monitor:
- Request count
- Error rate
- Latency (p50, p95, p99)
- Bandwidth usage

### Logs

View:
- Individual requests
- Error details
- Performance bottlenecks

**Access**: https://icloud.developer.apple.com/dashboard

---

## Common Patterns

### Pattern 1: Initial Sync

```swift
// ✅ Fetch all records on first launch
func performInitialSync() async throws {
    let predicate = NSPredicate(value: true)  // All records
    let query = CKQuery(recordType: "Task", predicate: predicate)

    let (results, _) = try await privateDatabase.records(matching: query)

    for result in results {
        if case .success(let record) = result.1 {
            saveToLocalDatabase(record)
        }
    }
}
```

### Pattern 2: Incremental Sync

```swift
// ✅ Use CKServerChangeToken for incremental fetches
func fetchChanges(since token: CKServerChangeToken?) async throws {
    let zoneID = CKRecordZone.ID(zoneName: "Tasks")

    let config = CKFetchRecordZoneChangesOperation.ZoneConfiguration(
        previousServerChangeToken: token
    )

    let operation = CKFetchRecordZoneChangesOperation(
        recordZoneIDs: [zoneID],
        configurationsByRecordZoneID: [zoneID: config]
    )

    operation.recordWasChangedBlock = { recordID, result in
        if case .success(let record) = result {
            updateLocalDatabase(with: record)
        }
    }

    operation.recordWithIDWasDeletedBlock = { recordID, _ in
        deleteFromLocalDatabase(recordID)
    }

    operation.recordZoneFetchResultBlock = { zoneID, result in
        if case .success(let (token, _, _)) = result {
            saveChangeToken(token)  // For next fetch
        }
    }

    try await privateDatabase.add(operation)
}
```

---

## Entitlements

Required entitlements in Xcode:

```xml
<!-- iCloud capability -->
<key>com.apple.developer.icloud-services</key>
<array>
    <string>CloudKit</string>
</array>

<!-- CloudKit container -->
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
    <string>iCloud.com.example.app</string>
</array>
```

**Setup**:
1. Xcode → Target → Signing & Capabilities
2. "+ Capability" → iCloud
3. Check "CloudKit"
4. Select or create container

---

## Quick Reference

| Task | Modern API (iOS 17+) | Legacy API |
|------|----------------------|------------|
| Structured data sync | SwiftData + CloudKit | CKSyncEngine or CKDatabase |
| Custom persistence sync | CKSyncEngine | CKDatabase |
| Conflict resolution | Automatic (SwiftData/CKSyncEngine) | Manual (savePolicy) |
| Account changes | Handled automatically | Manual detection |
| Monitoring | CloudKit Console telemetry | Manual logging |

---

## Related Skills

- `axiom-swiftdata` — SwiftData implementation details
- `axiom-storage` — Choose CloudKit vs iCloud Drive
- `axiom-icloud-drive-ref` — File-based iCloud sync
- `axiom-cloud-sync-diag` — Debug CloudKit sync issues

---

**Last Updated**: 2025-12-12
**Skill Type**: Reference
**Minimum iOS**: 10.0 (basic), 17.0 (CKSyncEngine, SwiftData integration)
**WWDC Sessions**: 2023-10188 (CKSyncEngine), 2024-10122 (CloudKit Console)
