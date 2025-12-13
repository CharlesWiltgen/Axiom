---
name: audit-icloud
description: Comprehensive iCloud integration audit — detects unsafe file coordination, missing CloudKit error handling, entitlement check issues, and iCloud anti-patterns with file:line references and sync reliability ratings
allowed-tools: Glob(*.swift), Grep(*)
---

# iCloud Integration Audit

I'll perform a comprehensive iCloud audit of your iOS/macOS codebase, checking for the most critical issues that cause sync failures, data conflicts, and CloudKit errors.

## What I'll Check

### 1. Missing NSFileCoordinator (CRITICAL)
**Pattern**: Reading/writing iCloud Drive files without `NSFileCoordinator`
**Impact**: Race conditions with sync → data corruption
**Risk**: Lost updates, file corruption

### 2. Missing CloudKit Error Handling (HIGH)
**Pattern**: CloudKit operations without proper `CKError` handling
**Impact**: Silent failures, quota exceeded unhandled, conflicts ignored
**Risk**: Sync failures, data loss

### 3. Missing Entitlement Checks (HIGH)
**Pattern**: Accessing ubiquitous container without checking availability
**Impact**: Runtime crashes when user not signed into iCloud
**Risk**: App crashes, user frustration

### 4. SwiftData + CloudKit Anti-Patterns (HIGH)
**Pattern**: Using unsupported features with CloudKit sync
**Examples**:
- `@Attribute(.unique)` constraint
- Complex predicates in @Query
**Impact**: Sync breaks silently
**Risk**: Data inconsistency across devices

### 5. Missing Conflict Resolution (MEDIUM)
**Pattern**: Not handling `hasUnresolvedConflicts` for iCloud Drive
**Impact**: User edits on multiple devices conflict, data lost
**Risk**: Data loss from unresolved conflicts

### 6. Legacy CloudKit APIs (MEDIUM)
**Pattern**: Using `CKDatabase` operations instead of `CKSyncEngine` (iOS 17+)
**Impact**: Manually reimplementing what CKSyncEngine provides
**Risk**: More complexity, more bugs

## Audit Process

1. **Glob** for all Swift files: `**/*.swift`
2. **Search** for iCloud anti-patterns using regex
3. **Report** findings with:
   - `file:line` references
   - Severity: CRITICAL/HIGH/MEDIUM/LOW
   - Sync reliability impact
   - Fix recommendation
   - Link to `axiom:cloudkit-ref` or `axiom:icloud-drive-ref` skills

## Output Format

```
=== ICLOUD INTEGRATION AUDIT RESULTS ===

CRITICAL Issues (Data Corruption Risk):
- src/Managers/DocumentManager.swift:78 - Writing to iCloud URL without coordination
  Risk: Race condition with sync → data corruption
  Fix: Wrap in NSFileCoordinator:
    let coordinator = NSFileCoordinator()
    coordinator.coordinate(writingItemAt: icloudURL, options: .forReplacing, error: nil) { newURL in
        try? data.write(to: newURL)
    }

HIGH Issues (Sync Failures):
- src/Sync/CloudKitManager.swift:123 - CKDatabase.save() without error handling
  Risk: Silent failures, quota exceeded unhandled
  Fix: Handle critical errors (.quotaExceeded, .networkUnavailable, .serverRecordChanged, .notAuthenticated)

MEDIUM Issues (Data Loss Risk):
- src/Documents/DocumentController.swift:67 - Not checking for iCloud conflicts
  Risk: User edits on iPad and iPhone conflict, one version lost
  Fix: Detect and resolve with NSFileVersion API

=== NEXT STEPS ===

For CloudKit best practices:
  /skill axiom:cloudkit-ref

For iCloud Drive file coordination:
  /skill axiom:icloud-drive-ref

For debugging sync issues:
  /skill axiom:cloud-sync-diag

iCloud Sync Summary:
- CRITICAL Issues: 1 (data corruption risk)
- HIGH Issues: 2 (sync failures)
- MEDIUM Issues: 1 (conflict resolution missing)
```

## Detection Patterns

### Missing NSFileCoordinator
```swift
// BAD - Data corruption risk
let icloudURL = containerURL.appendingPathComponent("document.txt")
try data.write(to: icloudURL)

// GOOD - Coordinated write
let coordinator = NSFileCoordinator()
coordinator.coordinate(writingItemAt: icloudURL, options: .forReplacing, error: nil) { newURL in
    try? data.write(to: newURL)
}
```

### Missing CloudKit Error Handling
```swift
// BAD - Silent failures
try await database.save(record)

// GOOD - Proper error handling
do {
    try await database.save(record)
} catch let error as CKError {
    switch error.code {
    case .quotaExceeded:
        showStorageFullAlert()
    case .networkUnavailable:
        queueForRetry(record)
    case .serverRecordChanged:
        let merged = mergeRecords(server: error.serverRecord, client: record)
        try await database.save(merged)
    case .notAuthenticated:
        showSignInPrompt()
    default:
        throw error
    }
}
```

### Missing Entitlement Checks
```swift
// BAD - Crashes if user not signed in
let containerURL = FileManager.default.url(forUbiquityContainerIdentifier: nil)

// GOOD - Check availability first
guard FileManager.default.ubiquityIdentityToken != nil else {
    showNotSignedInAlert()
    return
}
let containerURL = FileManager.default.url(forUbiquityContainerIdentifier: nil)
```

### SwiftData CloudKit Anti-Pattern
```swift
// BAD - Breaks CloudKit sync
@Model
class User {
    @Attribute(.unique) var email: String  // NOT supported with CloudKit
}

// GOOD - Manual uniqueness checking
@Model
class User {
    var email: String  // No .unique
    // Check duplicates before save with @Query
}
```

### Missing Conflict Resolution
```swift
// BAD - Ignores conflicts
let data = try Data(contentsOf: icloudURL)

// GOOD - Detect and resolve
let values = try? url.resourceValues(forKeys: [.ubiquitousItemHasUnresolvedConflictsKey])
if values?.ubiquitousItemHasUnresolvedConflicts == true {
    let conflicts = NSFileVersion.unresolvedConflictVersionsOfItem(at: url) ?? []
    // Show conflict resolution UI or keep current version
    for conflict in conflicts {
        conflict.isResolved = true
    }
}
```

### Legacy CloudKit API
```swift
// OLD - Manual fetch/upload cycle
let operation = CKFetchRecordZoneChangesOperation()
database.add(operation)

// MODERN - CKSyncEngine handles this (iOS 17+)
let config = CKSyncEngine.Configuration(
    database: CKContainer.default().privateCloudDatabase,
    stateSerialization: loadState(),
    delegate: self
)
let syncEngine = try CKSyncEngine(config)
```

## Search Queries I'll Run

1. **Unsafe iCloud Drive**: `Grep "ubiquityContainerIdentifier|ubiquitousItemDownloading" -A 5` (check for `NSFileCoordinator`)
2. **Missing Error Handling**: `Grep "\.save\(|\.fetch|CKDatabase|CKRecord" -A 5` (check for `CKError` handling)
3. **Missing Entitlement Checks**: `Grep "ubiquityIdentityToken|accountStatus"`
4. **SwiftData Anti-Patterns**: `Grep "@Attribute\(\.unique\)|cloudKitDatabase"`
5. **Missing Conflict Resolution**: `Grep "ubiquitousItemHasUnresolvedConflicts|NSFileVersion"`
6. **Legacy APIs**: `Grep "CKDatabase|CKFetchRecordZoneChanges|CKModifyRecords"`

## CloudKit Error Handling Checklist

All CloudKit operations should handle:
- `.quotaExceeded` — User's iCloud storage full
- `.networkUnavailable` — No internet connection
- `.serverRecordChanged` — Conflict (concurrent modification)
- `.notAuthenticated` — User signed out of iCloud
- `.zoneNotFound` — Custom zone doesn't exist yet
- `.partialFailure` — Batch operation partially failed

## NSFileCoordinator Patterns

Always use coordination for iCloud Drive:

**✅ Coordinated Read**:
```swift
let coordinator = NSFileCoordinator()
coordinator.coordinate(readingItemAt: url, options: [], error: nil) { newURL in
    let data = try? Data(contentsOf: newURL)
}
```

**✅ Coordinated Write**:
```swift
coordinator.coordinate(writingItemAt: url, options: .forReplacing, error: nil) { newURL in
    try? data.write(to: newURL)
}
```

**❌ WRONG - Direct Access**:
```swift
let data = try? Data(contentsOf: icloudURL)  // Race condition!
```

## Limitations

- **Cannot detect**: Runtime sync status, actual conflict scenarios, network availability
- **False positives**: Local file operations (not in iCloud container), test code with mock CloudKit
- **Test with multiple devices** after fixes

## Post-Audit

After fixing issues:
1. Test multi-device sync (edit same document on two devices)
2. Test offline mode (turn off Wi-Fi, verify queue/retry)
3. Test quota exceeded (Settings → [Profile] → Manage Storage → Delete to <100MB)
4. Test not signed in (Settings → [Profile] → Sign Out)
5. Test conflicts (edit same file offline on two devices, then go online)

For comprehensive iCloud debugging:
- `/skill axiom:cloud-sync-diag` — Sync troubleshooting
- `/skill axiom:cloudkit-ref` — Modern CloudKit patterns (CKSyncEngine)
- `/skill axiom:icloud-drive-ref` — File coordination details
