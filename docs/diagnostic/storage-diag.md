---
name: storage-diag
description: Files disappeared, backup too large, file access errors — systematic local storage diagnostics
---

# Local Storage Diagnostics

Systematic diagnostics for file storage issues — files disappearing, access errors, backup bloat.

## Overview

90% of file storage problems stem from wrong storage location, misunderstood file protection levels, or missing backup exclusions—not iOS file system bugs.

## Red Flags

If you see:
- Files mysteriously disappear after device restart
- Files disappear randomly (weeks later)
- App backup size unexpectedly large (>500 MB)
- "File not found" errors
- Files inaccessible when device locked
- Background tasks can't access files

## Decision Trees

### Files Disappeared

```
Where was file stored?

tmp/ → EXPECTED (purged on reboot)
  FIX: Move to Caches/

Caches/ → System purged (storage pressure)
  FIX: Move to App Support if can't regenerate

Documents/App Support → Check:
  - User deleted app?
  - iOS update migration issue?
  - File protection level?
```

### Files Inaccessible

```
Error: "No permission"

Device locked? → Check file protection
  .complete? → Wait for unlock
  FIX: Use .completeUntilFirstUserAuthentication

Background task? → .complete blocks background
  FIX: Change protection level
```

### Backup Too Large

```
App backup > 500 MB?

Check Documents/ size:
  Large files? → Can re-download?
    YES → Move to Caches + isExcludedFromBackup
    NO → Keep in Documents (warn if >1 GB)

Check Application Support/:
  Downloaded media? → Mark isExcludedFromBackup
```

## Diagnostic Commands

### Check File Location

```swift
func diagnoseLocation(_ url: URL) {
    if url.path.contains("/tmp/") {
        print("⚠️ In tmp/ - purged aggressively")
    } else if url.path.contains("/Caches/") {
        print("⚠️ In Caches/ - purged under pressure")
    } else if url.path.contains("/Documents/") {
        print("✅ In Documents/ - never purged, backed up")
    }
}
```

### Check Protection Level

```swift
func diagnoseProtection(_ url: URL) throws {
    let attrs = try FileManager.default.attributesOfItem(
        atPath: url.path
    )
    if let protection = attrs[.protectionKey] as? FileProtectionType {
        print("Protection: \(protection)")
    }
}
```

### Check Backup Status

```swift
func diagnoseBackup(_ url: URL) throws {
    let values = try url.resourceValues(forKeys: [
        .isExcludedFromBackupKey
    ])
    print("Excluded from backup: \(values.isExcludedFromBackup ?? false)")
}
```

## Common Issues

### Pattern 1: tmp/ Files Disappear

**Symptom**: Temp files missing after restart

**Cause**: tmp/ purged aggressively

**Fix**: Use Caches/ for re-generable data

### Pattern 2: Caches Purged

**Symptom**: Downloaded content gone weeks later

**Cause**: Caches/ purged under pressure (expected)

**Fix**: Re-download on demand OR move to App Support

### Pattern 3: .complete Blocks Background

**Symptom**: Background tasks fail with "permission denied"

**Cause**: .complete protection inaccessible when locked

**Fix**: Use .completeUntilFirstUserAuthentication

### Pattern 4: Backup Bloat

**Symptom**: App backup >1 GB

**Cause**: Downloaded content in Documents/ or not excluded

**Fix**: Mark isExcludedFromBackup on re-downloadable files

## Use This Skill When

- Debugging "files disappeared"
- "File not found" errors
- App backup too large
- Files inaccessible when locked
- Background access failures

**Related**: storage, file-protection-ref, storage-management-ref
