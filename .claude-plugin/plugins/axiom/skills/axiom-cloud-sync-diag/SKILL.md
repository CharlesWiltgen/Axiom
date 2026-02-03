---
name: axiom-cloud-sync-diag
description: Use when debugging 'file not syncing', 'CloudKit error', 'sync conflict', 'iCloud upload failed', 'ubiquitous item error', 'data not appearing on other devices', 'CKError', 'quota exceeded' - systematic iCloud sync diagnostics for both CloudKit and iCloud Drive
license: MIT
metadata:
  version: "1.0.0"
  last-updated: "2025-12-12"
---

# iCloud Sync Diagnostics

## Overview

**Core principle** 90% of cloud sync problems stem from account/entitlement issues, network connectivity, or misunderstanding sync timing—not iCloud infrastructure bugs.

iCloud (both CloudKit and iCloud Drive) handles billions of sync operations daily across all Apple devices. If your data isn't syncing, the issue is almost always configuration, connectivity, or timing expectations.

## Red Flags — Suspect Cloud Sync Issue

If you see ANY of these:
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
    let homeURL = FileManager.default.homeDirectoryForCurrentUser
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
│   └─ User exceeded iCloud storage quota
│       → Prompt user to purchase more storage
│       → Or delete old data
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

**Cause**: User's iCloud storage full

**Fix**:
```swift
if error.code == .quotaExceeded {
    // Show alert to user
    showAlert(
        title: "iCloud Storage Full",
        message: "Please free up space in Settings → [Name] → iCloud → Manage Storage"
    )
}
```

### CKError.serverRecordChanged

**Cause**: Conflict - record modified on server since fetch

**Fix**:
```swift
if error.code == .serverRecordChanged,
   let serverRecord = error.serverRecord,
   let clientRecord = error.clientRecord {
    // Merge records
    let merged = mergeRecords(server: serverRecord, client: clientRecord)

    // Retry with merged version
    try await database.save(merged)
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

// 3. Check all properties have defaults or are optional
@Model
class Task {
    var title: String = ""  // ✅ Has default
    var dueDate: Date?      // ✅ Optional
}
```

### Pattern 3: File Coordinator Deadlock

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

### Pattern 4: Conflicts Not Resolving

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
            try await self.save(record)
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

- `axiom-cloudkit-ref` — CloudKit implementation details
- `axiom-icloud-drive-ref` — iCloud Drive implementation details
- `axiom-storage` — Choose sync approach

---

**Last Updated**: 2025-12-12
**Skill Type**: Diagnostic
