
# iCloud Sync Diagnostics

## Overview

**Core principle** 90% of cloud sync problems stem from account/entitlement issues, network connectivity, or misunderstanding sync timing—not iCloud infrastructure bugs.

iCloud (both CloudKit and iCloud Drive) handles billions of sync operations daily across all Apple devices. If your data isn't syncing, the issue is almost always configuration, connectivity, or timing expectations.

## Red Flags — Suspect Cloud Sync Issue

If you see ANY of these:
- **Nothing EVER syncs, no errors, console silent** → check `cloudKitContainerOptions` FIRST on any store description you construct yourself (custom URL, named configuration, extra store). Without it that description silently behaves like a plain `NSPersistentContainer` and mirrors nothing. The container's own default description needs nothing — it is matched to the first CloudKit container in your entitlements automatically. This is the #1 "sync was never wired up" cause — diagnose it before anything else.
- **Works in dev, fails in TestFlight/App Store** (often surfacing as `quotaExceeded`) → CloudKit schema not deployed to Production. Named signature — recognize it instantly, do not chase it as a storage or network bug.
- Files/data not appearing on other devices
- "iCloud account not available" errors
- Persistent sync conflicts
- CloudKit quota exceeded
- Upload/download stuck at 0%
- Works on simulator but not device
- Works on WiFi but not cellular

❌ **FORBIDDEN** "iCloud is broken, we should build our own sync"
- iCloud infrastructure handles trillions of operations
- Building reliable sync is incredibly complex
- 99% of issues are configuration or connectivity

---

## Mandatory First Steps

**ALWAYS check these FIRST** (before changing code):

#### 0. Confirm the container is actually CloudKit-backed (Core Data)

For `NSPersistentCloudKitContainer`, mirroring is OFF on every store description you build yourself until it carries `cloudKitContainerOptions`. Omit it and that store loads fine, saves locally, raises no error, and syncs nothing. The container's own default description is matched to the first CloudKit container in your entitlements for you. This is the first thing to verify when "it never synced once."

```swift
let container = NSPersistentCloudKitContainer(name: "Model")
let description = container.persistentStoreDescriptions.first!

// ❌ MISSING THIS LINE on a description you constructed = silent no-op. It looks
// like a plain NSPersistentContainer. (Redundant but harmless on the default one.)
description.cloudKitContainerOptions = NSPersistentCloudKitContainerOptions(
    containerIdentifier: "iCloud.com.example.app"
)

// Required for mirroring:
description.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)

// Required only if you consume remote changes in the UI:
description.setOption(true as NSNumber, forKey: NSPersistentStoreRemoteChangeNotificationPostOptionKey)

// Verify after loadPersistentStores — nil on a description you constructed
// yourself means this store mirrors nothing:
assert(description.cloudKitContainerOptions != nil, "Store is not CloudKit-backed")
```

```swift
// 1. Check iCloud account status
func checkICloudStatus() async {
    let status = FileManager.default.ubiquityIdentityToken

    if status == nil {
        print("❌ Not signed into iCloud")
        print("Settings → [Name] → iCloud → Sign in")
        return
    }

    print("✅ Signed into iCloud")

    // For CloudKit specifically
    let container = CKContainer.default()
    do {
        let status = try await container.accountStatus()
        switch status {
        case .available:
            print("✅ CloudKit available")
        case .noAccount:
            print("❌ No iCloud account")
        case .restricted:
            print("❌ iCloud restricted (parental controls?)")
        case .couldNotDetermine:
            print("⚠️ Could not determine status")
        case .temporarilyUnavailable:
            print("⚠️ Temporarily unavailable (retry)")
        @unknown default:
            print("⚠️ Unknown status")
        }
    } catch {
        print("Error checking CloudKit: \(error)")
    }
}

// 2. Check entitlements
func checkEntitlements() {
    // Verify iCloud container exists
    if let containerURL = FileManager.default.url(
        forUbiquityContainerIdentifier: nil
    ) {
        print("✅ iCloud container: \(containerURL)")
    } else {
        print("❌ No iCloud container")
        print("Check Xcode → Signing & Capabilities → iCloud")
    }
}

// 3. Check network connectivity
func checkConnectivity() {
    // Use NWPathMonitor or similar
    print("Network: Check if device has internet")
    print("Try on different networks (WiFi, cellular)")
}

// 4. Check device storage
func checkStorage() {
    let homeURL = URL(fileURLWithPath: NSHomeDirectory())
    if let values = try? homeURL.resourceValues(forKeys: [
        .volumeAvailableCapacityKey
    ]) {
        let available = values.volumeAvailableCapacity ?? 0
        print("Available space: \(available / 1_000_000) MB")

        if available < 100_000_000 {  // <100 MB
            print("⚠️ Low storage may prevent sync")
        }
    }
}
```

---

## Decision Tree

### CloudKit Sync Issues

```
CloudKit data not syncing?

├─ Account unavailable?
│   ├─ Check: await container.accountStatus()
│   ├─ .noAccount → User not signed into iCloud
│   ├─ .restricted → Parental controls or corporate restrictions
│   └─ .temporarilyUnavailable → Network issue or iCloud outage
│
├─ CKError.quotaExceeded?
│   └─ This is an UMBRELLA error — two distinct meanings:
│       1. User iCloud storage full (rare; payload usually small)
│           → Prompt user to purchase more storage / delete old data
│       2. Schema not deployed to Production environment
│           → Dev builds work, TestFlight/App Store fail with quotaExceeded
│           → Fix: CloudKit Console → Deploy Schema to Production
│       → DIAGNOSE FIRST: which one? See "CKError.quotaExceeded" below.
│
├─ CKError.networkUnavailable?
│   └─ No internet connection
│       → Check WiFi/cellular
│       → Test on different network
│
├─ CKError.serverRecordChanged (conflict)?
│   └─ Concurrent modifications
│       → Implement conflict resolution
│       → Use savePolicy correctly
│
└─ SwiftData not syncing?
    ├─ Check ModelConfiguration CloudKit setup
    ├─ Verify private database only (no public/shared)
    └─ Check for @Attribute(.unique) (not supported with CloudKit)
```

### iCloud Drive Sync Issues

```
iCloud Drive files not syncing?

├─ File not uploading?
│   ├─ Check: url.resourceValues(.ubiquitousItemIsUploadingKey)
│   ├─ Check: url.resourceValues(.ubiquitousItemUploadingErrorKey)
│   └─ Error details will indicate issue
│
├─ File not downloading?
│   ├─ Not requested? → startDownloadingUbiquitousItem(at:)
│   ├─ Check: url.resourceValues(.ubiquitousItemDownloadingErrorKey)
│   └─ May need manual download trigger
│
├─ File has conflicts?
│   ├─ Check: url.resourceValues(.ubiquitousItemHasUnresolvedConflictsKey)
│   └─ Resolve with NSFileVersion
│
└─ Files not appearing on other device?
    ├─ Check iCloud account on both devices (same account?)
    ├─ Check entitlements match on both
    ├─ Wait (sync not instant, can take minutes)
    └─ Check Settings → iCloud → iCloud Drive → [App] is enabled
```

---

## Common CloudKit Errors

### CKError.accountTemporarilyUnavailable

**Cause**: iCloud servers temporarily unavailable or user signed out

**Fix**:
```swift
if error.code == .accountTemporarilyUnavailable {
    // Retry with exponential backoff
    try await Task.sleep(for: .seconds(5))
    try await retryOperation()
}
```

### CKError.quotaExceeded

**Cause**: UMBRELLA error — CloudKit returns `quotaExceeded` for two distinct conditions. Always disambiguate before alerting the user.

**Diagnosis — pick the right meaning** (a small per-user payload + dev/TestFlight divergence is almost never the literal storage cause):

```swift
// The real reason usually rides along in the underlying error:
if let info = error.userInfo[NSUnderlyingErrorKey] as? NSError {
    print("Underlying reason:", info.localizedDescription)
}

// Symptom matrix:
// • Works on dev, fails on TestFlight/App Store?
//      → MEANING 2: Production schema not deployed.
//      → Fix: CloudKit Console → switch to Development → click
//        "Deploy Schema to Production". One-way, permanent.
//
// • User has actually exhausted iCloud storage (verify in Settings)?
//      → MEANING 1: Literal storage quota. Prompt to manage iCloud.

if error.code == .quotaExceeded {
    // For meaning 1 only — after ruling out 2:
    showAlert(
        title: "iCloud Storage Full",
        message: "Please free up space in Settings → [Name] → iCloud → Manage Storage"
    )
}
```

**Why one code, two causes**: Apple documents `quotaExceeded` only as an iCloud storage quota; the missing-production-schema rejection arrives as the same code and is indistinguishable client-side, so disambiguate before alerting the user. The Production Crisis Scenario below covers the dev-vs-prod path.

### CKError.serverRecordChanged

**Cause**: Record modified on server since your last fetch. **Most common root cause**: saving a stale record without fetching the latest version first.

**Diagnosis — check the simple fix FIRST**:
```swift
// ❌ WRONG: Saving without fetching latest version
// This causes serverRecordChanged on EVERY concurrent edit
let record = CKRecord(recordType: "Note", recordID: existingID)
record["title"] = "Updated"
_ = try await database.save(record)  // Overwrites server version → conflict

// ✅ FIX: Fetch-then-modify-then-save (fixes 80% of cases)
let latest = try await database.record(for: existingID)  // Get latest
latest["title"] = "Updated"  // Modify the fetched record
_ = try await database.save(latest)  // Save with correct changeTag
```

**If fetch-then-save doesn't fix it** (true concurrent edits from multiple devices):
```swift
if error.code == .serverRecordChanged,
   let serverRecord = error.serverRecord,
   let clientRecord = error.clientRecord {
    // Merge records — only needed for real multi-device conflicts
    let merged = mergeRecords(server: serverRecord, client: clientRecord)
    _ = try await database.save(merged)
}
```

### CKError.networkUnavailable

**Cause**: No internet connection

**Fix**:
```swift
if error.code == .networkUnavailable {
    // Queue for retry when online
    queueOperation(for: .whenOnline)

    // Or show offline indicator
    showOfflineIndicator()
}
```

### Silent Data Loss in Batch Operations

**Symptom**: Sync appears to work but records silently disappear or fail to save.

**Common causes**:

| Cause | Symptom | Fix |
|-------|---------|-----|
| Record size > 1 MB | Individual records silently dropped from batch | Split large data into CKAsset |
| Batch partial failure | Some records save, others fail silently | Check `perRecordSaveBlock` for per-record errors |
| Conflict auto-resolution | Last-writer-wins overwrites valid data | Implement merge-based conflict resolution |
| Asset download not triggered | Record syncs but CKAsset content missing | Call `fetchRecordZoneChanges` with `desiredKeys` |

**Diagnosis**:
```swift
// ❌ WRONG: Batch save with no per-record error handling
let operation = CKModifyRecordsOperation(recordsToSave: records)
operation.modifyRecordsResultBlock = { result in
    // Only catches operation-level failures — misses per-record errors
}

// ✅ CORRECT: Check each record individually
let operation = CKModifyRecordsOperation(recordsToSave: records)
operation.perRecordSaveBlock = { recordID, result in
    switch result {
    case .success(let record):
        print("✅ Saved: \(recordID)")
    case .failure(let error):
        print("❌ Failed: \(recordID) — \(error)")
        // Log for retry — this record was silently lost otherwise
    }
}
```

---

### CKSyncEngine batch cap — CKError.limitExceeded

**Symptom**: A CKSyncEngine send fails with `CKError.limitExceeded` during heavy initial or bulk sync.

**Cause**: A single change batch exceeded the server's **250-record cap (saves + deletes combined)**.

**Fix**: Never hand-assemble a batch. In `nextRecordZoneChangeBatch(_:syncEngine:)` use `CKSyncEngine.RecordZoneChangeBatch(pendingChanges:recordProvider:)` — its failable async init stops at the cap and leaves the remainder in `pendingRecordZoneChanges`. Applies on every CKSyncEngine OS version (iOS 17+); the cap was undocumented before 27. See `cloud-sync` → "CKSyncEngine change-batch cap".

### Server-side asset import errors `OS27`

Errors specific to `CKAsset(importing:)` (Photos → CloudKit server copy). See `cloudkit-ref` → "Server-side asset copy".

| Error | Code | Meaning | Fix |
|-------|------|---------|-----|
| `CKError.unknownItem` | 11 | Source asset no longer on the server | Re-export from Photos; do not reuse a stale `ExportedAssetID` |
| `CKError.assetNotAvailable` | 35 | `ExportedAssetID` invalid or expired (valid days only, device-bound) | Re-export just before save; never persist or transmit the ID |
| `PHPhotosError.requestNotSupportedForAsset` | 3306 | Photo library is local-only (not cloud-enabled) | Require iCloud Photos; fall back to a local file-URL CKAsset |

---

## Common iCloud Drive Errors

### Upload Errors

```swift
// ✅ Check upload error
func checkUploadError(url: URL) {
    let values = try? url.resourceValues(forKeys: [
        .ubiquitousItemUploadingErrorKey
    ])

    if let error = values?.ubiquitousItemUploadingError {
        print("Upload error: \(error.localizedDescription)")

        if (error as NSError).code == NSFileWriteOutOfSpaceError {
            print("iCloud storage full")
        }
    }
}
```

### Download Errors

```swift
// ✅ Check download error
func checkDownloadError(url: URL) {
    let values = try? url.resourceValues(forKeys: [
        .ubiquitousItemDownloadingErrorKey
    ])

    if let error = values?.ubiquitousItemDownloadingError {
        print("Download error: \(error.localizedDescription)")

        // Common errors:
        // - Network unavailable
        // - Account unavailable
        // - File deleted on server
    }
}
```

---

## Debugging Patterns

### Pattern 1: CloudKit Operation Not Completing

**Symptom**: Save/fetch never completes, no error

**Diagnosis**:
```swift
// Add timeout
Task {
    try await withTimeout(seconds: 30) {
        try await database.save(record)
    }
}

// Log operation lifecycle
operation.database = database
operation.completionBlock = {
    print("Operation completed")
}
operation.qualityOfService = .userInitiated

// Check if operation was cancelled
if operation.isCancelled {
    print("Operation was cancelled")
}
```

**Common causes**:
- No network connectivity
- Account issues
- Operation cancelled prematurely

### Pattern 2: SwiftData CloudKit Not Syncing

**Symptom**: SwiftData saves locally but doesn't sync

**Diagnosis**:
```swift
// 1. Verify CloudKit configuration
let config = ModelConfiguration(
    cloudKitDatabase: .private("iCloud.com.example.app")
)

// 2. Check for incompatible attributes
// ❌ @Attribute(.unique) not supported with CloudKit
@Model
class Task {
    @Attribute(.unique) var id: UUID  // ← Remove this
    var title: String
}
// Removing .unique means duplicates CAN appear. Replace enforcement with
// convergent dedup-on-import — see Pattern 3.

// 3. Check all properties have defaults or are optional
@Model
class Task {
    var title: String = ""  // ✅ Has default
    var dueDate: Date?      // ✅ Optional
}
```

### Pattern 3: Deterministic Dedup-on-Import (no unique constraints)

**Symptom**: Same logical record appears 2-5 times across devices. CloudKit cannot enforce uniqueness, so concurrent first-launch imports each create their own copy.

**Why a naive "delete duplicates" pass fails**: each device picks a different winner (e.g. "keep the newest" — clocks differ; "keep the first I saw" — order differs), so devices delete each other's survivors and the duplicates resurrect on the next sync. The fix is a **convergent dedup**: every device must independently compute the SAME winner from the data alone.

```swift
// Run on remote-change notification, after merging incoming changes.
// 1. Group by a stable BUSINESS key (not the CloudKit recordID — those differ).
let groups = Dictionary(grouping: allRecords, by: \.businessKey)

for (_, dupes) in groups where dupes.count > 1 {
    // 2. Elect a winner deterministically — same input → same winner on EVERY device.
    //    Use a stable tiebreaker (UUID string), never a clock or local insertion order.
    let winner = dupes.min { $0.stableID.uuidString < $1.stableID.uuidString }!

    // 3. Merge field values from losers into the winner (don't lose user edits).
    for loser in dupes where loser.stableID != winner.stableID {
        winner.merge(from: loser)
        context.delete(loser)
    }
}
try context.save()  // Deletions propagate; every device converged on the same winner.
```

**Rules that make it converge**: (1) group by business key, (2) elect with a deterministic tiebreaker derived from record data (not `Date` or local order), (3) merge losers' fields into the winner before deleting. Idempotent — running it twice changes nothing.

### Pattern 4: File Coordinator Deadlock

**Symptom**: File operations hang

**Diagnosis**:
```swift
// ❌ WRONG: Nested coordination can deadlock
coordinator.coordinate(writingItemAt: url, options: [], error: nil) { newURL in
    // Don't create another coordinator here!
    anotherCoordinator.coordinate(...)  // ← Deadlock risk
}

// ✅ CORRECT: Single coordinator per operation
coordinator.coordinate(writingItemAt: url, options: [], error: nil) { newURL in
    // Direct file operations only
    try data.write(to: newURL)
}
```

### Pattern 5: Conflicts Not Resolving

**Symptom**: Conflicts persist even after resolution

**Diagnosis**:
```swift
// ❌ WRONG: Not marking as resolved
let conflicts = NSFileVersion.unresolvedConflictVersionsOfItem(at: url)
for conflict in conflicts ?? [] {
    // Missing: conflict.isResolved = true
}

// ✅ CORRECT: Mark resolved and remove
for conflict in conflicts ?? [] {
    conflict.isResolved = true
}
try NSFileVersion.removeOtherVersionsOfItem(at: url)
```

---

## Production Crisis Scenario

**SYMPTOM**: Users report data not syncing after app update

**DIAGNOSIS STEPS** (run in order):

1. **Check account status** (2 min):
   ```swift
   // On affected device
   let status = FileManager.default.ubiquityIdentityToken
   // nil? → Not signed in
   ```

2. **Verify entitlements unchanged** (5 min):
   - Compare old vs new build entitlements
   - Verify container IDs match

3. **Check for breaking changes** (10 min):
   - Did CloudKit schema change?
   - Did ubiquitous container ID change?
   - Are old and new versions compatible?

4. **Test on clean device** (15 min):
   - Factory reset device or use new test device
   - Sign into iCloud
   - Install app
   - Does sync work on fresh install?

**ROOT CAUSES** (90% of cases):
- Entitlements changed/corrupted in build
- CloudKit container ID mismatch
- Breaking schema changes
- Account restrictions (new parental controls, etc.)

**FIX**:
- Verify entitlements in build
- Test migration path from old version
- Add better error handling and user messaging

---

## Monitoring

### CloudKit Console (recommended - WWDC 2024)

**Access**: https://icloud.developer.apple.com/dashboard

**Monitor**:
- Error rates by type
- Latency percentiles (p50, p95, p99)
- Quota usage
- Request volume

**Set alerts for**:
- High error rate (>5%)
- Quota approaching limit (>80%)
- Latency spikes

### Client-Side Logging

```swift
// ✅ Log all CloudKit operations
extension CKDatabase {
    func saveWithLogging(_ record: CKRecord) async throws {
        print("Saving record: \(record.recordID)")
        let start = Date()

        do {
            _ = try await self.save(record)
            let duration = Date().timeIntervalSince(start)
            print("✅ Saved in \(duration)s")
        } catch let error as CKError {
            print("❌ Save failed: \(error.code), \(error.localizedDescription)")
            throw error
        }
    }
}
```

---

## Quick Diagnostic Checklist

```swift
func diagnoseCloudSyncIssue() async {
    print("=== Cloud Sync Diagnosis ===")

    // 1. Account
    await checkICloudStatus()

    // 2. Entitlements
    checkEntitlements()

    // 3. Network
    checkConnectivity()

    // 4. Storage
    checkStorage()

    // 5. For CloudKit
    let container = CKContainer.default()
    do {
        let status = try await container.accountStatus()
        print("CloudKit status: \(status)")
    } catch {
        print("CloudKit error: \(error)")
    }

    // 6. For iCloud Drive
    if let url = getICloudContainerURL() {
        let values = try? url.resourceValues(forKeys: [
            .ubiquitousItemDownloadingErrorKey,
            .ubiquitousItemUploadingErrorKey
        ])
        print("Download error: \(values?.ubiquitousItemDownloadingError?.localizedDescription ?? "none")")
        print("Upload error: \(values?.ubiquitousItemUploadingError?.localizedDescription ?? "none")")
    }

    print("=== End Diagnosis ===")
}
```

---

## Related Skills

- `skills/cloudkit-ref.md` — CloudKit implementation details
- `skills/icloud-drive-ref.md` — iCloud Drive implementation details
- `skills/storage.md` — Choose sync approach
