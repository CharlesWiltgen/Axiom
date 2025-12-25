---
name: cloudkit-ref
description: Modern CloudKit sync — SwiftData integration, CKSyncEngine, database APIs, conflict resolution
---

# CloudKit Reference

Comprehensive CloudKit reference for database-based iCloud storage and sync using modern APIs.

## Overview

CloudKit is for **structured data sync** (records with relationships), not simple file sync. Three modern approaches: SwiftData + CloudKit (easiest), CKSyncEngine (custom persistence), or raw CloudKit APIs.

**Based on**: CKSyncEngine (WWDC 2023), SwiftData CloudKit integration (WWDC 2023-2024), CloudKit Console (WWDC 2024)

## Three Approaches

### 1. SwiftData + CloudKit (Recommended, iOS 17+)

**When to Use**: Modern apps with SwiftData models

**Limitations**: Private database only, automatic sync

```swift
let container = try ModelContainer(
    for: Task.self,
    configurations: ModelConfiguration(
        cloudKitDatabase: .private("iCloud.com.example.app")
    )
)
```

**See Also**: `swiftdata` skill for details

### 2. CKSyncEngine (Modern, iOS 17+)

**When to Use**: Custom persistence (SQLite, GRDB, JSON)

**Advantages**: Automatic fetch/upload, conflict handling, account changes

```swift
let config = CKSyncEngine.Configuration(
    database: CKContainer.default().privateCloudDatabase,
    stateSerialization: loadState(),
    delegate: self
)
let syncEngine = try CKSyncEngine(config)
```

**Modern replacement** for manual CKDatabase operations

### 3. Raw CloudKit APIs (Legacy)

**When to Use**: Only if CKSyncEngine doesn't fit (rare)

**Core Types**:
- CKContainer — Entry point
- CKDatabase — Public/private/shared
- CKRecord — Data record
- CKRecordZone — Logical grouping

## Database Scopes

| Scope | Access | SwiftData | Use Case |
|-------|--------|-----------|----------|
| **Private** | User only | ✅ | Personal data |
| **Public** | All users | ❌ | Shared content |
| **Shared** | Invited users | ❌ | Collaboration |

## Common Patterns

### SwiftData CloudKit Sync

```swift
// Automatic sync for SwiftData models
@Model
class Task {
    var title: String
    var dueDate: Date
    // Syncs automatically with ModelConfiguration
}
```

### CKSyncEngine Delegate

```swift
extension Manager: CKSyncEngineDelegate {
    func handleEvent(_ event: CKSyncEngine.Event,
                     syncEngine: CKSyncEngine) async {
        switch event {
        case .fetchedRecordZoneChanges(let changes):
            applyChanges(changes)
        case .sentRecordZoneChanges(let changes):
            handleSent(changes)
        case .accountChange(let change):
            handleAccountChange(change)
        default:
            break
        }
    }
}
```

### Conflict Resolution

```swift
// CKSyncEngine handles conflicts automatically
// Or with raw APIs:
operation.savePolicy = .ifServerRecordUnchanged

// Handle CKError.serverRecordChanged
if error.code == .serverRecordChanged {
    let merged = mergeRecords(
        server: error.serverRecord,
        client: error.clientRecord
    )
    try await database.save(merged)
}
```

## CloudKit Console Monitoring

**Access**: https://icloud.developer.apple.com/dashboard

**Monitor**:
- Error rates, latency (p50, p95, p99)
- Request volume, bandwidth
- Quota usage

**Set Alerts**:
- High error rate (>5%)
- Quota approaching limit (>80%)

## Use This Skill When

- Implementing structured data sync
- Choosing SwiftData+CloudKit vs CKSyncEngine
- Setting up public/private/shared databases
- Debugging CloudKit sync
- Monitoring CloudKit performance

**Related**: swiftdata, storage, icloud-drive-ref, cloud-sync-diag
