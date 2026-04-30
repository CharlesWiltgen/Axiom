# icloud-auditor

Scans for iCloud integration issues — both known anti-patterns like missing NSFileCoordinator and incomplete CKError handling, and architectural gaps like missing account-change observation, polling instead of CKSubscriptions, and missing fallback UX when iCloud is unavailable.

## What It Does

- Detects 6 known anti-patterns (missing NSFileCoordinator on ubiquitous I/O, missing CKError handling, missing entitlement / availability checks, SwiftData @Attribute(.unique) silently disabling CloudKit sync, missing conflict resolution, legacy CKDatabase APIs on iOS 17+ targets)
- Identifies architectural gaps (per-access vs once-at-launch availability checks, incomplete CKError matrix coverage across `.quotaExceeded`/`.networkUnavailable`/`.serverRecordChanged`/`.notAuthenticated`/`.zoneNotFound`/`.partialFailure`, missing `NSUbiquityIdentityDidChange` observation, polling instead of CKSubscriptions, missing fallback UX when iCloud is unavailable, sync telemetry blind spots)
- Correlates findings that compound into higher severity (uncoordinated I/O + multi-process access via extension/widget, CKError gaps + automated retry loops, `@Attribute(.unique)` + CloudKit-bound model)
- Produces an iCloud Health Score (SAFE / FRAGILE / DANGEROUS)

## How to Use

**Natural language:**
- "Check my iCloud integration"
- "Audit my CloudKit code"
- "My iCloud sync isn't working"
- "Review my file coordination code"
- "Check for iCloud Drive issues"

**Explicit command:**
```bash
/axiom:audit icloud
```

## Related

- **cloud-sync-diag** skill — systematic iCloud sync troubleshooting once issues surface
- **cloudkit-ref** skill — modern CloudKit patterns and CKSyncEngine reference
- **icloud-drive-ref** skill — NSFileCoordinator and ubiquitous file coordination
- **swiftdata-auditor** agent — overlaps on `cloudKitDatabase:`-bound @Model classes
- **storage-auditor** agent — overlaps on iCloud Drive vs Documents location
- **networking-auditor** agent — overlaps on network connectivity prerequisites for sync
- **health-check** agent — includes icloud-auditor in project-wide scans
