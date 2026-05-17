---
name: storage
description: Navigation hub for ALL storage decisions — choosing between SwiftData, Core Data, SQLite, and files; picking the right directory (Documents vs Application Support vs Caches vs tmp); deciding between CloudKit and iCloud Drive
---

# iOS Storage Decisions

Navigation hub for storage architecture decisions on Apple platforms. Covers the two dimensions every storage choice has: **format** (structured records vs files) and **location** (local vs cloud, which directory).

Getting the format wrong forces workarounds. Getting the location wrong causes data loss, backup bloat, or App Store rejections. This skill is the decision framework that prevents both.

## When to Use

Use this skill when you're:
- Starting a project and choosing a storage approach
- Asking "where should I store this data?"
- Deciding between SwiftData, Core Data, SQLite, GRDB, or files
- Choosing between CloudKit and iCloud Drive for sync
- Determining Documents vs Caches vs Application Support vs tmp
- Planning data architecture for offline-first or sync-heavy apps
- Migrating from one storage solution to another
- Debugging "files disappeared," "backup is huge," or "data not syncing"

Use a more specific skill when you're implementing details:
- [swiftdata](/skills/persistence/swiftdata) for `@Model` and `@Query`
- [grdb](/skills/persistence/grdb) for raw SQL and reactive queries
- [cloud-sync](/skills/persistence/cloud-sync) for CloudKit sync implementation
- [database-migration](/skills/persistence/database-migration) for safe schema evolution

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Where should I store user-edited photos vs downloaded thumbnails?"
- "Should I use SwiftData or SQLiteData for a notes app?"
- "My app's iCloud backup is 2 GB. What am I doing wrong?"
- "Should I sync this user data with CloudKit or iCloud Drive?"
- "We're moving from JSON files to SwiftData. How do we plan the migration?"
- "Why are files in `tmp/` disappearing while my app is running?"
- "What happens to local files on tvOS between launches?"

## What This Skill Provides

### Format decisions

- Structured data vs file storage — the question to ask before picking an API
- SwiftData vs Core Data vs SQLiteData vs GRDB — when each is the right tool
- When to use plain `FileManager` instead of any database

### Location decisions

- **Documents** — user-created content, backed up, visible in Files app
- **Application Support** — app-generated data that must persist, backed up, hidden
- **Caches** — re-downloadable content, system can purge under pressure
- **tmp** — temporary scratch space, system can purge anytime
- **`isExcludedFromBackup`** — explicit backup control for large files

### Cloud sync decisions

- CloudKit vs iCloud Drive vs `NSUbiquitousKeyValueStore`
- SwiftData + CloudKit (iOS 17+) vs CKSyncEngine vs raw CloudKit APIs
- The 1 MB / 1024 key limits on `NSUbiquitousKeyValueStore`

### Platform gotchas

- tvOS has no persistent local storage — every local file can vanish between launches
- Cache directories on iOS get purged under storage pressure even while your app is running
- Documents stores everything in iCloud backup — large re-downloadable content there will bloat backups and risk rejection

### Migration checklists

- Database to database (Core Data to SwiftData)
- Files to database (JSON to SwiftData)
- Local to cloud (CloudKit/iCloud entitlements, conflict handling, opt-in UX)

## Key Pattern

### Choose location by lifecycle, not by convenience

```swift
// User-created → Documents (backed up, visible in Files)
try data.write(
    to: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("MyDocument.pdf"),
    options: .completeFileProtection
)

// Re-downloadable → Caches (system can purge, excluded from backup)
let cacheURL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    .appendingPathComponent("thumbnail.jpg")
try imageData.write(to: cacheURL)

var resourceValues = URLResourceValues()
resourceValues.isExcludedFromBackup = true
try cacheURL.setResourceValues(resourceValues)
```

The two choices above use the same `FileManager` API. The lifecycle difference — "user made this" vs "I can re-download this" — is what determines where it goes.

## Related

- [swiftdata](/skills/persistence/swiftdata) — implementation details for `@Model`, `@Query`, and Swift 6 concurrency
- [sqlitedata](/skills/persistence/sqlitedata) — value-type persistence with CloudKit record sharing
- [grdb](/skills/persistence/grdb) — raw SQL, reactive queries, and complex database operations
- [core-data](/skills/persistence/core-data) — when you're maintaining an existing Core Data app
- [cloud-sync](/skills/persistence/cloud-sync) — CloudKit sync implementation with CKSyncEngine
- [database-migration](/skills/persistence/database-migration) — safe schema evolution patterns
- [codable](/skills/persistence/codable) — JSON and plist encoding for small structured data
- [storage-diag](/diagnostic/storage-diag) — troubleshooting missing files, backup bloat, and protection-level failures
- [storage-management-ref](/reference/storage-management-ref) — purge policies, disk space APIs, and quota management
- [file-protection-ref](/reference/file-protection-ref) — `.completeFileProtection` and related encryption options
- [icloud-drive-ref](/reference/icloud-drive-ref) — ubiquitous container patterns for file-based sync
- [cloudkit-ref](/reference/cloudkit-ref) — CKSyncEngine and raw CloudKit API reference

## Resources

**WWDC**: 2023-10187, 2023-10188, 2024-10137

**Docs**: /foundation/filemanager, /swiftdata, /cloudkit/cksyncengine, /foundation/nsubiquitouskeyvaluestore
