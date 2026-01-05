---
name: cloud-sync-diag
description: Systematic diagnostics for CloudKit errors, iCloud Drive sync failures, and quota issues
---

# Cloud Sync Diagnostics

Systematic troubleshooting for iCloud sync issues covering both CloudKit and iCloud Drive.

## Symptoms This Diagnoses

Use when you're experiencing:
- Files/data not appearing on other devices
- "iCloud account not available" errors
- Persistent sync conflicts
- CloudKit quota exceeded (CKError.quotaExceeded)
- Upload/download stuck at 0%
- Works on WiFi but not cellular
- SwiftData not syncing to CloudKit

## Example Prompts

- "Data isn't syncing between my devices"
- "Getting 'iCloud account not available' error"
- "CloudKit quota exceeded — what do I tell users?"
- "How do I handle CKError.serverRecordChanged?"
- "SwiftData CloudKit sync stopped working"
- "iCloud Drive files won't upload"

## Diagnostic Workflow

Claude guides you through systematic diagnosis:

### CloudKit Issues

```
Check account status first:
  await container.accountStatus()
  ├─ .noAccount → User not signed into iCloud
  ├─ .restricted → Parental controls
  └─ .temporarilyUnavailable → Network/iCloud outage

CKError handling:
  ├─ .quotaExceeded → Prompt user to buy storage
  ├─ .networkUnavailable → Queue for retry
  └─ .serverRecordChanged → Merge and retry
```

### iCloud Drive Issues

```
File not syncing:
  ├─ Check upload error: ubiquitousItemUploadingErrorKey
  ├─ Check download error: ubiquitousItemDownloadingErrorKey
  └─ Check conflicts: ubiquitousItemHasUnresolvedConflictsKey

Files not appearing on other device:
  ├─ Same iCloud account on both devices?
  ├─ Entitlements match?
  └─ Wait (sync takes minutes, not instant)
```

### SwiftData CloudKit

```
SwiftData not syncing:
  ├─ ModelConfiguration has CloudKit container?
  ├─ Using private database only?
  └─ No @Attribute(.unique)? (not supported)
```

## Key Diagnostic Checks

```swift
// 1. Check iCloud availability
let token = FileManager.default.ubiquityIdentityToken
if token == nil {
    print("❌ Not signed into iCloud")
}

// 2. Check CloudKit account
let status = try await CKContainer.default().accountStatus()
// .available, .noAccount, .restricted

// 3. Check container access
if let url = FileManager.default.url(
    forUbiquityContainerIdentifier: nil
) {
    print("✅ Container: \(url)")
}
```

## Common CloudKit Errors

| Error | Cause | Fix |
|-------|-------|-----|
| quotaExceeded | iCloud storage full | Prompt user to free space |
| serverRecordChanged | Conflict | Merge records and retry |
| networkUnavailable | No connection | Queue for retry |

## Documentation Scope

This page documents the `axiom-cloud-sync-diag` diagnostic skill—systematic troubleshooting Claude uses when you report iCloud sync problems.

**For SwiftData CloudKit:** See [swiftdata](/skills/persistence/swiftdata) for integration patterns.

## Related

- [swiftdata](/skills/persistence/swiftdata) — SwiftData with CloudKit integration
- [networking](/skills/integration/networking) — Network connectivity patterns

## Resources

**Docs**: /cloudkit, /icloud, /swiftdata

**Console**: https://icloud.developer.apple.com/dashboard
