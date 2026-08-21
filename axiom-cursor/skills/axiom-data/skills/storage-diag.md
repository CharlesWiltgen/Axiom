
# Local File Storage Diagnostics

## Overview

**Core principle** 90% of file storage problems stem from choosing the wrong storage location, misunderstanding file protection levels, or missing backup exclusions—not iOS file system bugs.

The iOS file system is battle-tested across millions of apps and devices. If your files are disappearing, becoming inaccessible, or causing backup issues, the problem is almost always in storage location choice or protection configuration.

## Red Flags — Suspect File Storage Issue

If you see ANY of these:
- Files mysteriously disappear after device restart
- Files disappear randomly (weeks after creation)
- App backup size unexpectedly large (>500 MB)
- "File not found" after app background/foreground cycle
- Files inaccessible when device is locked
- Users report lost data after iOS update
- Background tasks can't access files

❌ **FORBIDDEN** "iOS deleted my files, the file system is broken"
- iOS file system handles billions of files daily across all apps
- System behavior is documented and predictable
- 99% of issues are location/protection mismatches

### Red Flag — `isExcludedFromBackup` on user-created content = permanent data loss

**NEVER set `isExcludedFromBackup = true` on anything the user created or can't get back.** Exclusion means it is NOT in iCloud/iTunes backups. If there is also no cloud sync, the data is gone forever on device replacement, restore, or "Erase All Content". Exclusion is correct ONLY for re-downloadable/regenerable content (caches, downloaded media). The reflex of "exclude it to shrink the backup" is how apps silently destroy user data.

### Red Flag — Caches are purged at ANY time, even while your app isn't running

The system can evict `Caches/` mid-session or between launches — there is no "safe" window. A `Caches/` read that assumes the file is present is a latent crash/blank-screen bug. Every `Caches/` (and `tmp/`) read MUST have a cache-miss path that regenerates or re-downloads. If you can't tolerate a miss, the data does not belong in `Caches/`.

## Mandatory First Steps

**ALWAYS check these FIRST** (before changing code):

```swift
// 1. Check WHERE file is stored
func diagnoseFileLocation(_ url: URL) {
    let path = url.path
    if path.contains("/tmp/") {
        print("⚠️ File in tmp/ - system purges aggressively")
    } else if path.contains("/Caches/") {
        print("⚠️ File in Caches/ - purged under storage pressure")
    } else if path.contains("/Documents/") {
        print("✅ File in Documents/ - never purged, backed up")
    } else if path.contains("/Library/Application Support/") {
        print("✅ File in Application Support/ - never purged, backed up")
    }
}

// 2. Check file protection level
func diagnoseFileProtection(_ url: URL) throws {
    let attrs = try FileManager.default.attributesOfItem(atPath: url.path)
    if let protection = attrs[.protectionKey] as? FileProtectionType {
        print("Protection: \(protection)")
        if protection == .complete {
            print("⚠️ File inaccessible when device locked")
        }
    }
}

// 3. Check backup status
func diagnoseBackupStatus(_ url: URL) throws {
    let values = try url.resourceValues(forKeys: [.isExcludedFromBackupKey])
    if let excluded = values.isExcludedFromBackup {
        print("Excluded from backup: \(excluded)")
    }
}

// 4. Check file existence and size
func diagnoseFileState(_ url: URL) {
    if FileManager.default.fileExists(atPath: url.path) {
        if let size = try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int64 {
            print("File exists, size: \(size) bytes")
        }
    } else {
        print("❌ File does not exist")
    }
}
```

---

## Decision Tree

### Files Disappeared

```
Files missing? → Check where stored

├─ Disappeared after device restart
│   ├─ Was in tmp/? → EXPECTED (tmp/ purged on reboot)
│   │   → FIX: Move to Caches/ or Application Support/
│   │
│   ├─ Was in Caches/? → System purged (storage pressure)
│   │   → FIX: Move to Application Support/ if can't be regenerated
│   │
│   └─ Protection level .complete? → Inaccessible until unlock
│       → FIX: Wait for unlock or use .completeUntilFirstUserAuthentication
│
├─ Disappeared randomly (weeks later)
│   ├─ In Caches/? → System purged under storage pressure
│   │   → EXPECTED if re-downloadable
│   │   → FIX: Re-download when needed, or move to Application Support/
│   │
│   └─ In Documents or Application Support/?
│       → Check if user deleted app (purges all data)
│       → Check iOS update (rare, but check migration path)
│
└─ Only some files missing
    → Check isExcludedFromBackup + iCloud sync
    → Check if file names have special characters
    → Check file permissions
```

### Files Inaccessible

```
Can't access file?

├─ Error: "No permission" or NSFileReadNoPermissionError
│   ├─ Device locked? → Check file protection
│   │   └─ .complete protection? → Wait for unlock
│   │       → FIX: Use .completeUntilFirstUserAuthentication
│   │
│   └─ Background task accessing? → .complete blocks background
│       → FIX: Change to .completeUntilFirstUserAuthentication
│
├─ File exists but read returns empty/nil
│   └─ Check actual file size on disk
│       → May be zero-byte file from failed write
│
└─ File exists in debugger but not at runtime
    → Check if using wrong directory (Documents vs Caches)
    → Check URL construction
```

### Backup Too Large

```
App backup > 500 MB?

├─ Check Documents directory size
│   └─ Large files (>10 MB each)?
│       ├─ Can they be re-downloaded? → Move to Caches + isExcludedFromBackup
│       └─ User-created? → Keep in Documents (warn user if >1 GB)
│
├─ Check Application Support size
│   └─ Downloaded media/podcasts?
│       → Mark isExcludedFromBackup = true
│
└─ Audit backup with code:
    ```swift
    func auditBackupSize() {
        let docsURL = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        )[0]
        let size = getDirectorySize(url: docsURL)
        print("Documents (backed up): \(size / 1_000_000) MB")
    }
    ```
```

---

## Common Patterns by Symptom

### Pattern 1: Files in tmp/ Disappear

**Symptom**: Temp files missing after restart or even during app lifecycle

**Cause**: tmp/ is purged aggressively by system

**Fix**:
```swift
// ❌ WRONG: Using tmp/ for anything that should persist
let tmpURL = FileManager.default.temporaryDirectory
let fileURL = tmpURL.appendingPathComponent("data.json")
try data.write(to: fileURL)  // WILL BE DELETED

// ✅ CORRECT: Use Caches/ for re-generable data
let cacheURL = FileManager.default.urls(
    for: .cachesDirectory,
    in: .userDomainMask
)[0]
let fileURL = cacheURL.appendingPathComponent("data.json")
try data.write(to: fileURL)
```

### Pattern 2: Caches Purged, Data Lost

**Symptom**: Downloaded content disappears weeks later

**Cause**: Caches/ is purged under storage pressure (expected behavior)

**Hard rule**: Every `Caches/` read MUST assume the file may be gone — the miss path (regenerate or re-download) is not optional error handling, it is the contract for living in `Caches/`. Either re-download on demand OR move to Application Support if it can't be regenerated.
```swift
// ✅ CORRECT: Handle missing cache gracefully
func loadCachedImage(url: URL) async throws -> UIImage {
    let cacheURL = getCacheURL(for: url)

    // Try cache first
    if FileManager.default.fileExists(atPath: cacheURL.path),
       let data = try? Data(contentsOf: cacheURL),
       let image = UIImage(data: data) {
        return image
    }

    // Cache miss - re-download
    let (data, _) = try await URLSession.shared.data(from: url)
    try data.write(to: cacheURL)
    return UIImage(data: data)!
}
```

### Pattern 3: .complete Protection Blocks Background

**Symptom**: Background tasks fail with "permission denied"

**Cause**: Files with .complete protection inaccessible when locked

**Fix**:
```swift
// ❌ WRONG: .complete protection for background-accessed files
try data.write(to: url, options: .completeFileProtection)
// Background task fails when device locked

// ✅ CORRECT: Use .completeUntilFirstUserAuthentication
try data.write(
    to: url,
    options: .completeFileProtectionUntilFirstUserAuthentication
)
// Accessible in background after first unlock
```

### Pattern 4: Backup Bloat from Downloaded Content

**Symptom**: App backup >1 GB, app rejected or users complain

**Cause**: Downloaded content in Documents/ or not marked excluded

**Fix**:
```swift
// ✅ CORRECT: Exclude re-downloadable content
func downloadPodcast(url: URL) async throws {
    let appSupportURL = FileManager.default.urls(
        for: .applicationSupportDirectory,
        in: .userDomainMask
    )[0]

    let podcastURL = appSupportURL
        .appendingPathComponent("Podcasts")
        .appendingPathComponent(url.lastPathComponent)

    // Download
    let (data, _) = try await URLSession.shared.data(from: url)
    try data.write(to: podcastURL)

    // Mark excluded from backup
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    try podcastURL.setResourceValues(resourceValues)
}
```

### Pattern 5: Backup Exclusion Silently Lost After Atomic Write

**Symptom**: A file marked `isExcludedFromBackup` reappears in backups after the next save, and the backup grows again.

**Cause**: `isExcludedFromBackup` is a property of the file's inode, not its path. An atomic write (`.atomic` writes to a temp file, then renames over the original) or any `replaceItemAt` produces a NEW inode — the flag does not carry over. You must re-apply it every time you replace the file.

**Fix**:
```swift
// Re-apply AFTER every atomic write / replacement
try data.write(to: cacheURL, options: .atomic)  // new inode → flag dropped
var values = URLResourceValues()
values.isExcludedFromBackup = true
try cacheURL.setResourceValues(values)           // re-apply on the new file

// ❌ WRONG: setting the flag on a stale path-string URL or before the write
// URL(fileURLWithPath:) on a path string still resolves to a URL, but if you
// captured it before the rename you are tagging the OLD inode that no longer exists.
// Always re-resolve and re-apply on the live file URL after the write completes.
```

### Pattern 6: Zero-Byte File From a Failed Write

**Symptom**: File exists but reads back empty/nil; corrupted data after a crash, low battery, or disk-full during save.

**Cause**: A non-atomic `write(to:)` truncates the file first, then streams bytes. If the process is killed mid-write, you are left with a partial or zero-byte file — the old good data is already gone.

**Fix**: Always write with `.atomic`. It writes to a temp file and renames only after the bytes are fully on disk, so a reader never sees a half-written file and a failure leaves the previous version intact.
```swift
// ✅ CORRECT: atomic write is all-or-nothing
try data.write(to: fileURL, options: .atomic)
```

### Pattern 7: Disk-Full Crash From an Unhandled Write

**Symptom**: App crashes when saving a large download on a near-full device; users on 16/32 GB devices hit it constantly.

**Cause**: `Data.write` throws `NSFileWriteOutOfSpaceError` when the volume is full. An unhandled throw becomes a crash. Pre-checking with raw `volumeAvailableCapacityKey` is also wrong — it reports too little, because it ignores space the system can reclaim by purging caches and offloaded content.

**Fix**: Check `volumeAvailableCapacityForImportantUsage` (purgeable-aware → the realistic number iOS will actually give you), AND still handle the out-of-space error, because capacity can change between check and write.
```swift
func canStore(bytes needed: Int64, at url: URL) throws -> Bool {
    let values = try url.resourceValues(
        forKeys: [.volumeAvailableCapacityForImportantUsageKey]
    )
    guard let available = values.volumeAvailableCapacityForImportantUsage
    else { return false }
    return available > needed
}

do {
    try data.write(to: fileURL, options: .atomic)
} catch let error as NSError
    where error.code == NSFileWriteOutOfSpaceError {
    // Free purgeable cache and surface a clear "storage full" message — don't crash
}
```

---

## Production Crisis Scenario

**SYMPTOM**: Users report lost photos after iOS update

**DIAGNOSIS STEPS**:

1. **Check storage location** (5 min):
   ```swift
   // Were photos in Caches/?
   let photosInCaches = path.contains("/Caches/")
   // If yes → system purged them (expected)
   ```

2. **Check if backed up** (5 min):
   ```swift
   // Check if excluded from backup
   let excluded = try? url.resourceValues(
       forKeys: [.isExcludedFromBackupKey]
   ).isExcludedFromBackup
   // If excluded=true AND not synced → lost
   ```

3. **Check migration path** (10 min):
   - Did app container path change?
   - Did we migrate data from old location?

**ROOT CAUSES** (90% of cases):
- Photos in Caches/ (purged under storage pressure)
- Photos excluded from backup + no cloud sync
- Migration code missing after major iOS update

**FIX**:
- User photos MUST be in Documents/
- Never exclude user-created content from backup
- Always have cloud sync OR backup for user content

---

## Quick Diagnostic Checklist

Run this on any storage problem:

```swift
func diagnoseStorageIssue(fileURL: URL) {
    print("=== Storage Diagnosis ===")

    // 1. Location
    diagnoseFileLocation(fileURL)

    // 2. Protection
    try? diagnoseFileProtection(fileURL)

    // 3. Backup status
    try? diagnoseBackupStatus(fileURL)

    // 4. File state
    diagnoseFileState(fileURL)

    // 5. Directory size
    if let parentURL = fileURL.deletingLastPathComponent() as URL? {
        let size = getDirectorySize(url: parentURL)
        print("Parent directory size: \(size / 1_000_000) MB")
    }

    print("=== End Diagnosis ===")
}
```

---

## Related Skills

- `skills/storage.md` — Correct storage location decisions
- axiom-security (skills/file-protection-ref.md) — Understanding protection levels
- `skills/storage-management-ref.md` — Purge behavior and capacity APIs

---

**Last Updated**: 2026-05-21
**Skill Type**: Diagnostic
