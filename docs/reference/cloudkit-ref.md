---
name: cloudkit-ref
description: Modern CloudKit sync and sharing — SwiftData integration, CKSyncEngine, database APIs, root-record + zone-wide CKShare, conflict resolution
skill_type: reference
---

# CloudKit Reference

CloudKit reference for database-backed iCloud storage, sync, and sharing. Covers the three modern sync approaches (SwiftData + CloudKit, CKSyncEngine, raw CloudKit), the two record-sharing models, and conflict resolution.

For file/document iCloud (a ubiquitous container) see [icloud-drive-ref](/reference/icloud-drive-ref) — a different problem. For sync *failures* and conflict debugging, see [cloud-sync-diag](/diagnostic/cloud-sync-diag).

## When to Use This Reference

Use this reference when you're:

- Choosing between SwiftData + CloudKit, CKSyncEngine, and raw CloudKit APIs
- Syncing structured records (with relationships) across a user's devices
- Sharing records or an entire zone with other iCloud users (collaboration)
- Deciding between root-record and zone-wide sharing
- Resolving save conflicts (`CKError.serverRecordChanged`, save policies)
- Setting up custom zones, subscriptions, and change tracking
- Monitoring CloudKit error rates and quota in the Console

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "Should I use SwiftData + CloudKit or CKSyncEngine for my app?"
- "How do I share a record with another iCloud user?"
- "Should I use root-record (`CKShare(rootRecord:)`) or zone-wide (`CKShare(recordZoneID:)`) sharing?"
- "I shared my data but the person I invited sees a blank/empty list — why?"
- "How do I share an entire CloudKit zone?"
- "How do I handle `CKError.serverRecordChanged` conflicts?"
- "How do I fetch only the changes since my last sync?"

## What's Covered

### Sync Approaches
- SwiftData + CloudKit — `ModelConfiguration(cloudKitDatabase:)`; private-DB only, no `@Attribute(.unique)`
- CKSyncEngine — automatic fetch/upload for custom persistence (SQLite/GRDB/JSON)
- Raw CloudKit — `CKContainer`, `CKDatabase`, `CKRecord`, `CKRecordZone`, `CKModifyRecordsOperation`

### Databases & Scopes
- Private / Public / Shared scopes — access, SwiftData support, use case
- `privateCloudDatabase`, `publicCloudDatabase`, `sharedCloudDatabase`

### Zones & Change Tracking
- Custom zones vs the default zone; `CKRecordZone`
- `CKFetchDatabaseChangesOperation`, `CKFetchRecordZoneChangesOperation`, server change tokens

### Subscriptions
- `CKSubscription` (query / zone / database), silent push, `CKModifySubscriptionsOperation`

### Sharing
- **Root-record (hierarchical)** – `CKShare(rootRecord:)`; shares a record plus its `parent`-linked descendants
- **Zone-wide** – `CKShare(recordZoneID:)`; shares *every* record in the zone, for apps that read by enumerating the whole zone
- The decision: an enumerate-the-zone app needs zone-wide, or the invitee sees an empty data set (root-record only shares the rooted hierarchy)
- `UICloudSharingController`, participant permissions, `CKAcceptSharesOperation`, the `CKRecordNameZoneWideShare` constant

### Conflict Resolution
- Save policies (`.ifServerRecordUnchanged`), `CKError.serverRecordChanged`, server/client record merge

### Monitoring
- CloudKit Console — error rate, latency percentiles, quota usage, alerts

## Key Patterns

### SwiftData + CloudKit (the easy path)

```swift
let container = try ModelContainer(
    for: Task.self,
    configurations: ModelConfiguration(
        cloudKitDatabase: .private("iCloud.com.example.app")
    )
)
```

### Choosing a sharing model

```swift
// Hierarchical: share one record and its parent-linked children.
let share = CKShare(rootRecord: rootRecord)

// Zone-wide: share the whole zone. Use this when the app reads by
// enumerating the zone rather than walking a root hierarchy — with
// root-record sharing, such an app exposes a blank data set to the invitee.
let zoneShare = CKShare(recordZoneID: customZone.zoneID)
```

## Documentation Scope

This page documents the `cloudkit-ref` skill — database-backed CloudKit (records, sync, sharing). The comprehensive patterns and code live in the skill, which Claude loads automatically.

- For an automated audit of an existing CloudKit/iCloud integration, run the [icloud-auditor](/agents/icloud-auditor)
- For file/document iCloud rather than record sync, see [icloud-drive-ref](/reference/icloud-drive-ref)

## Related

- [swiftdata](/skills/persistence/swiftdata) – SwiftData models that sync via `ModelConfiguration(cloudKitDatabase:)`
- [cloud-sync-diag](/diagnostic/cloud-sync-diag) – diagnose sync failures and conflict errors when CloudKit misbehaves
- [icloud-drive-ref](/reference/icloud-drive-ref) – file/document iCloud sync, distinct from record sync
- [storage](/skills/persistence/storage) – choosing CloudKit vs iCloud Drive vs local storage
- [icloud-auditor](/agents/icloud-auditor) – automated scan for entitlement, CKError-coverage, and account-change gaps

## Resources

**Docs**: /cloudkit, /cloudkit/ckshare, /cloudkit/cksyncengine, /cloudkit/ckrecordzone
