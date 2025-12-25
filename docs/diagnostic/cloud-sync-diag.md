---
name: cloud-sync-diag
description: CloudKit errors, iCloud Drive sync failures, quota exceeded — systematic cloud sync diagnostics
---

# Cloud Sync Diagnostics

Systematic diagnostics for iCloud sync issues covering both CloudKit and iCloud Drive.

## Overview

90% of cloud sync problems stem from account/entitlement issues, network connectivity, or misunderstanding sync timing—not iCloud infrastructure bugs.

## Red Flags

If you see:
- Files/data not appearing on other devices
- "iCloud account not available" errors
- Persistent sync conflicts
- CloudKit quota exceeded
- Upload/download stuck at 0%
- Works on WiFi but not cellular

## Decision Trees

### CloudKit Sync Issues

```
CloudKit data not syncing?

Account unavailable?
  Check: await container.accountStatus()
  .noAccount → User not signed into iCloud
  .restricted → Parental controls
  .temporarilyUnavailable → Network/iCloud outage

CKError.quotaExceeded?
  → User exceeded iCloud storage quota
  → Prompt to purchase more storage

CKError.networkUnavailable?
  → No internet connection
  → Test on different network

CKError.serverRecordChanged?
  → Concurrent modifications (conflict)
  → Implement conflict resolution

SwiftData not syncing?
  → Check ModelConfiguration CloudKit setup
  → Verify private database only
  → Check for @Attribute(.unique) (not supported)
```

### iCloud Drive Sync Issues

```
iCloud Drive files not syncing?

File not uploading?
  Check: url.resourceValues(.ubiquitousItemUploadingErrorKey)
  → Error details indicate issue

File not downloading?
  Check: url.resourceValues(.ubiquitousItemDownloadingErrorKey)
  → May need manual download trigger

File has conflicts?
  Check: url.resourceValues(.ubiquitousItemHasUnresolvedConflictsKey)
  → Resolve with NSFileVersion

Files not appearing on other device?
  → Same iCloud account on both devices?
  → Entitlements match on both?
  → Wait (sync takes minutes, not instant)
  → Check Settings → iCloud → iCloud Drive → [App]
```

## Common CloudKit Errors

### CKError.quotaExceeded

**Cause**: User's iCloud storage full

**Fix**: Show alert to free up space in Settings

### CKError.serverRecordChanged

**Cause**: Conflict - record modified since fetch

**Fix**: Merge records and retry

```swift
if error.code == .serverRecordChanged,
   let serverRecord = error.serverRecord,
   let clientRecord = error.clientRecord {
    let merged = mergeRecords(server: serverRecord,
                              client: clientRecord)
    try await database.save(merged)
}
```

### CKError.networkUnavailable

**Cause**: No internet connection

**Fix**: Queue for retry when online

## Common iCloud Drive Errors

### Upload Errors

```swift
let values = try? url.resourceValues(forKeys: [
    .ubiquitousItemUploadingErrorKey
])

if let error = values?.ubiquitousItemUploadingError {
    // Common: iCloud storage full
}
```

### Download Errors

```swift
let values = try? url.resourceValues(forKeys: [
    .ubiquitousItemDownloadingErrorKey
])

if let error = values?.ubiquitousItemDownloadingError {
    // Common: Network unavailable, file deleted on server
}
```

## Diagnostic Checklist

### Run These First

```swift
// 1. Check iCloud account status
let status = FileManager.default.ubiquityIdentityToken
if status == nil {
    print("❌ Not signed into iCloud")
}

// 2. Check CloudKit account
let container = CKContainer.default()
let ckStatus = try await container.accountStatus()
// .available, .noAccount, .restricted, etc.

// 3. Check entitlements
if let containerURL = FileManager.default.url(
    forUbiquityContainerIdentifier: nil
) {
    print("✅ iCloud container: \(containerURL)")
} else {
    print("❌ No iCloud container")
}

// 4. Check network connectivity
// Use NWPathMonitor

// 5. Check device storage
let values = try? homeURL.resourceValues(forKeys: [
    .volumeAvailableCapacityKey
])
```

## CloudKit Console Monitoring

**Access**: https://icloud.developer.apple.com/dashboard

**Monitor**:
- Error rates by type
- Latency percentiles
- Quota usage
- Request volume

**Set Alerts**:
- High error rate (>5%)
- Quota approaching limit (>80%)

## Production Crisis Scenario

**Symptom**: Users report data not syncing after app update

**Diagnosis Steps**:

1. Check account status (2 min)
2. Verify entitlements unchanged (5 min)
3. Check for breaking changes (10 min)
4. Test on clean device (15 min)

**Root Causes** (90%):
- Entitlements changed/corrupted
- CloudKit container ID mismatch
- Breaking schema changes
- Account restrictions

## Use This Skill When

- Debugging "data not syncing"
- CloudKit errors (CKError)
- iCloud Drive upload/download failures
- Persistent sync conflicts
- Quota exceeded errors

**Related**: cloudkit-ref, icloud-drive-ref, storage
