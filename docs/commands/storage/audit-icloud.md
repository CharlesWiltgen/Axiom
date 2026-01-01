---
name: audit-icloud
description: Comprehensive iCloud integration audit for file coordination, CloudKit errors, and sync patterns
---

# iCloud Integration Audit

Scan your codebase for iCloud anti-patterns that cause sync failures, data conflicts, and CloudKit errors.

## What It Scans

### CRITICAL (Data Corruption Risk)
- **Missing NSFileCoordinator** — Reading/writing iCloud Drive files without coordination causes race conditions with sync
- **Unsafe file access** — Direct Data(contentsOf:) on iCloud URLs

### HIGH (Sync Failures)
- **Missing CloudKit error handling** — Operations without CKError handling (quotaExceeded, serverRecordChanged, notAuthenticated)
- **Missing entitlement checks** — Accessing ubiquitous container without checking availability
- **SwiftData + CloudKit anti-patterns** — Using @Attribute(.unique) with CloudKit sync

### MEDIUM (Data Loss Risk)
- **Missing conflict resolution** — Not handling hasUnresolvedConflicts for iCloud Drive
- **Legacy CloudKit APIs** — Using CKDatabase operations instead of CKSyncEngine (iOS 17+)

## Usage

```bash
# Run iCloud audit
/axiom:audit icloud
```

## Example Output

```
=== ICLOUD INTEGRATION AUDIT ===

CRITICAL Issues (Data Corruption Risk):
  src/Managers/DocumentManager.swift:78
    Writing to iCloud URL without coordination
    Fix: Wrap in NSFileCoordinator

HIGH Issues (Sync Failures):
  src/Sync/CloudKitManager.swift:123
    CKDatabase.save() without error handling
    Fix: Handle quotaExceeded, serverRecordChanged

Summary:
  - 1 CRITICAL (data corruption risk)
  - 2 HIGH (sync failures)
  - 1 MEDIUM (missing conflict resolution)
```

## CloudKit Errors to Handle

All CloudKit operations should handle:
- `.quotaExceeded` — User's iCloud storage full
- `.networkUnavailable` — No internet connection
- `.serverRecordChanged` — Conflict (concurrent modification)
- `.notAuthenticated` — User signed out of iCloud

## Related

- [cloud-sync-diag](/diagnostic/cloud-sync-diag) — Sync troubleshooting
- [swiftdata](/skills/persistence/swiftdata) — SwiftData CloudKit integration
