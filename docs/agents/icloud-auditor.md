# icloud-auditor

Automatically scans for iCloud integration issues: missing NSFileCoordinator, unsafe CloudKit error handling, missing entitlement checks, and SwiftData + CloudKit anti-patterns.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Check my iCloud integration"
- "Audit my CloudKit code"
- "My iCloud sync isn't working"
- "Review my file coordination code"
- "Check for iCloud Drive issues"

**Explicit command:**
```bash
/axiom:audit-icloud
```

## What It Checks

1. **Missing NSFileCoordinator** (CRITICAL) — Reading/writing iCloud Drive files without coordination → data corruption
2. **Missing CloudKit Error Handling** (HIGH) — CloudKit operations without proper CKError handling → silent failures
3. **Missing Entitlement Checks** (HIGH) — Accessing ubiquitous container without checking availability → runtime crashes
4. **SwiftData + CloudKit Anti-Patterns** (HIGH) — Using unsupported features (@Attribute(.unique)) with CloudKit → sync breaks silently
5. **Missing Conflict Resolution** (MEDIUM) — Not handling ubiquitousItemHasUnresolvedConflicts → data loss from concurrent edits
6. **CKSyncEngine Migration** (MEDIUM) — Using legacy CKDatabase APIs instead of CKSyncEngine (iOS 17+)

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: cyan
- **Scan Time**: <2 seconds

## Related Skills

- **cloud-sync-diag** — Systematic iCloud sync troubleshooting
- **cloudkit-ref** — Modern CloudKit patterns and CKSyncEngine reference
- **icloud-drive-ref** — NSFileCoordinator and file coordination details
