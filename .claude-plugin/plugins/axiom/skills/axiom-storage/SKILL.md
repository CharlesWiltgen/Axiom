---
name: axiom-storage
description: Use when asking 'where should I store this data', 'should I use SwiftData or files', 'CloudKit vs iCloud Drive', 'Documents vs Caches', 'local or cloud storage', 'how do I sync data', 'where do app files go' - comprehensive decision framework for all iOS storage options
license: MIT
compatibility: iOS 17+, iPadOS 17+, macOS Sonoma+
metadata:
  version: "1.0.0"
  last-updated: "2025-12-12"
---

# iOS Storage Guide

**Purpose**: Navigation hub for ALL storage decisions — database vs files, local vs cloud, specific locations
**iOS Version**: iOS 17+ (iOS 26+ for latest features)
**Context**: Complete storage decision framework integrating SwiftData (WWDC 2023), CKSyncEngine (WWDC 2023), and file management best practices

## When to Use This Skill

✅ **Use this skill when**:
- Starting a new project and choosing storage approach
- Asking "where should I store this data?"
- Deciding between SwiftData, Core Data, SQLite, or files
- Choosing between CloudKit and iCloud Drive for sync
- Determining Documents vs Caches vs Application Support
- Planning data architecture for offline/online scenarios
- Migrating from one storage solution to another
- Debugging "files disappeared" or "data not syncing"

❌ **Do NOT use this skill for**:
- SwiftData implementation details (use `axiom-swiftdata` skill)
- SQLite/GRDB specifics (use `axiom-sqlitedata` or `axiom-grdb` skills)
- CloudKit sync implementation (use `axiom-cloudkit-ref` skill)
- File protection APIs (use `axiom-file-protection-ref` skill)

**Related Skills**:
- Existing database skills: `axiom-swiftdata`, `axiom-sqlitedata`, `axiom-grdb`
- New file skills: `axiom-file-protection-ref`, `axiom-storage-management-ref`, `axiom-storage-diag`
- New cloud skills: `axiom-cloudkit-ref`, `axiom-icloud-drive-ref`, `axiom-cloud-sync-diag`

## Core Philosophy

> **"Choose the right tool for your data shape. Then choose the right location."**

Storage decisions have two dimensions:
1. **Format**: How is data structured? (Queryable records vs files)
2. **Location**: Where is it stored? (Local vs cloud, which directory)

Getting the format wrong forces workarounds. Getting the location wrong causes data loss or backup bloat.

---

## The Complete Decision Tree

### Level 1: Format — What Are You Storing?

```
What is the shape of your data?

├─ STRUCTURED DATA (queryable records, relationships, search)
│   Examples: User profiles, task lists, notes, contacts, transactions
│   → Continue to "Structured Data Path" below
│
└─ FILES (documents, images, videos, downloads, caches)
    Examples: Photos, PDFs, downloaded content, thumbnails, temp files
    → Continue to "File Storage Path" below
```

---

## Structured Data Path

### Modern Apps (iOS 17+)

```swift
// ✅ CORRECT: SwiftData for modern structured persistence
import SwiftData

@Model
class Task {
    var title: String
    var isCompleted: Bool
    var dueDate: Date

    init(title: String, isCompleted: Bool = false, dueDate: Date) {
        self.title = title
        self.isCompleted = isCompleted
        self.dueDate = dueDate
    }
}

// Query with type safety
@Query(sort: \Task.dueDate) var tasks: [Task]
```

**Why SwiftData**:
- Modern Swift-native API (no Objective-C)
- Type-safe queries
- Built-in CloudKit sync support
- Observable models integrate with SwiftUI
- **Use skill**: `axiom-swiftdata` for implementation details

**When NOT to use SwiftData**:
- Need advanced SQLite features (FTS5, complex joins)
- Existing Core Data app (migration overhead)
- Ultra-performance-critical (direct SQLite is faster)

### Advanced Control Needed

```swift
// ✅ CORRECT: SQLiteData or GRDB for advanced features
import SQLiteData

// Full-text search, custom indices, raw SQL when needed
let results = try db.prepare("SELECT * FROM users WHERE name MATCH ?", "John")
```

**Use SQLiteData when**:
- Need full-text search (FTS5)
- Custom SQL queries and indices
- Maximum performance (direct SQLite)
- Migration from existing SQLite database
- **Use skill**: `axiom-sqlitedata` for modern SQLite patterns

**Use GRDB when**:
- Need reactive queries (ValueObservation)
- Complex database operations
- Type-safe query builders
- **Use skill**: `axiom-grdb` for advanced patterns

### Legacy Apps (iOS 16 and earlier)

```swift
// ❌ LEGACY: Core Data (avoid for new projects)
import CoreData

// NSManagedObject, NSFetchRequest, NSPredicate...
```

**Only use Core Data if**:
- Maintaining existing Core Data app
- Can't upgrade to iOS 17 minimum deployment

---

## File Storage Path

### Decision Tree for Files

```
What kind of file is it?

├─ USER-CREATED CONTENT (documents, photos created by user)
│   Where: Documents/ directory
│   Backed up: ✅ Yes (iCloud/iTunes)
│   Purged: ❌ Never
│   Visible in Files app: ✅ Yes
│   Example: User's edited photos, documents, exported data
│   → See "Documents Directory" section below
│
├─ APP-GENERATED DATA (not user-visible, must persist)
│   Where: Library/Application Support/
│   Backed up: ✅ Yes
│   Purged: ❌ Never
│   Visible in Files app: ❌ No
│   Example: Database files, user settings, downloaded assets
│   → See "Application Support Directory" section below
│
├─ RE-DOWNLOADABLE / REGENERABLE CONTENT
│   Where: Library/Caches/
│   Backed up: ❌ No (set isExcludedFromBackup)
│   Purged: ✅ Yes (under storage pressure)
│   Example: Thumbnails, API responses, downloaded images
│   → See "Caches Directory" section below
│
└─ TEMPORARY FILES (can be deleted anytime)
    Where: tmp/
    Backed up: ❌ No
    Purged: ✅ Yes (aggressive, even while app running)
    Example: Image processing intermediates, export staging
    → See "Temporary Directory" section below
```

### Documents Directory

```swift
// ✅ CORRECT: User-created content in Documents
func saveUserDocument(_ data: Data, filename: String) throws {
    let documentsURL = FileManager.default.urls(
        for: .documentDirectory,
        in: .userDomainMask
    )[0]

    let fileURL = documentsURL.appendingPathComponent(filename)

    // Enable file protection
    try data.write(to: fileURL, options: .completeFileProtection)
}
```

**Key rules**:
- ✅ DO store: User-created documents, exported files, user-visible content
- ❌ DON'T store: Downloaded data that can be re-fetched, caches, temp files
- ⚠️ WARNING: Everything here is backed up to iCloud. Large re-downloadable files will bloat backups and may get your app rejected.

**Use skill**: `axiom-file-protection-ref` for encryption options

### Application Support Directory

```swift
// ✅ CORRECT: App data in Application Support
func getAppDataURL() -> URL {
    let appSupportURL = FileManager.default.urls(
        for: .applicationSupportDirectory,
        in: .userDomainMask
    )[0]

    // Create app-specific subdirectory
    let appDataURL = appSupportURL.appendingPathComponent(
        Bundle.main.bundleIdentifier ?? "AppData"
    )

    try? FileManager.default.createDirectory(
        at: appDataURL,
        withIntermediateDirectories: true
    )

    return appDataURL
}
```

**Use for**:
- SwiftData/SQLite database files
- User preferences
- Downloaded assets that must persist
- Configuration files

### Caches Directory

```swift
// ✅ CORRECT: Re-downloadable content in Caches
func cacheDownloadedImage(data: Data, for url: URL) throws {
    let cacheURL = FileManager.default.urls(
        for: .cachesDirectory,
        in: .userDomainMask
    )[0]

    let filename = url.lastPathComponent
    let fileURL = cacheURL.appendingPathComponent(filename)

    try data.write(to: fileURL)

    // Mark as excluded from backup (explicit, though Caches is auto-excluded)
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    try fileURL.setResourceValues(resourceValues)
}
```

**Key rules**:
- ✅ The system CAN and WILL delete files here under storage pressure
- ✅ Always have a way to re-download or regenerate
- ❌ Don't store anything that can't be recreated

**Use skill**: `axiom-storage-management-ref` for purge policies and disk space management

### Temporary Directory

```swift
// ✅ CORRECT: Truly temporary files in tmp
func processImageWithTempFile(image: UIImage) throws {
    let tmpURL = FileManager.default.temporaryDirectory
    let tempFileURL = tmpURL.appendingPathComponent(UUID().uuidString + ".jpg")

    // Write temp file
    try image.jpegData(compressionQuality: 0.8)?.write(to: tempFileURL)

    // Process...
    processImage(at: tempFileURL)

    // Clean up (though system will auto-clean eventually)
    try? FileManager.default.removeItem(at: tempFileURL)
}
```

**Key rules**:
- System can delete files here AT ANY TIME (even while app is running)
- Always clean up after yourself
- Don't rely on files persisting between app launches

---

## Cloud Storage Decisions

### Should Data Sync to Cloud?

```
Does this data need to sync across user's devices?

├─ NO → Use local storage (paths above)
│
└─ YES → What kind of data?
    │
    ├─ STRUCTURED DATA (queryable, relationships)
    │   → Use CloudKit
    │   → See "CloudKit Path" below
    │
    ├─ FILES (documents, images)
    │   → Use iCloud Drive (ubiquitous containers)
    │   → See "iCloud Drive Path" below
    │
    └─ SMALL PREFERENCES (<1 MB, key-value pairs)
        → Use NSUbiquitousKeyValueStore
        → See "Key-Value Store" below
```

### CloudKit Path (Structured Data Sync)

```swift
// ✅ CORRECT: SwiftData with CloudKit sync (iOS 17+)
import SwiftData

let container = try ModelContainer(
    for: Task.self,
    configurations: ModelConfiguration(
        cloudKitDatabase: .private("iCloud.com.example.app")
    )
)
```

**Three approaches to CloudKit**:

1. **SwiftData + CloudKit** (Recommended, iOS 17+):
   - Automatic sync for SwiftData models
   - Private database only
   - Easiest approach
   - **Use skill**: `axiom-swiftdata` for details

2. **CKSyncEngine** (Custom persistence, iOS 17+):
   - For SQLite, GRDB, or custom stores
   - Manages sync automatically
   - Modern replacement for manual CloudKit
   - **Use skill**: `axiom-cloudkit-ref` for CKSyncEngine patterns

3. **Raw CloudKit APIs** (Legacy):
   - CKContainer, CKDatabase, CKRecord
   - Manual sync management
   - Only if CKSyncEngine doesn't fit
   - **Use skill**: `axiom-cloudkit-ref` for raw API reference

### iCloud Drive Path (File Sync)

```swift
// ✅ CORRECT: iCloud Drive for file-based sync
func saveToICloud(_ data: Data, filename: String) throws {
    // Get ubiquitous container
    guard let iCloudURL = FileManager.default.url(
        forUbiquityContainerIdentifier: nil
    ) else {
        throw StorageError.iCloudUnavailable
    }

    let documentsURL = iCloudURL.appendingPathComponent("Documents")
    try FileManager.default.createDirectory(
        at: documentsURL,
        withIntermediateDirectories: true
    )

    let fileURL = documentsURL.appendingPathComponent(filename)
    try data.write(to: fileURL)
}
```

**When to use iCloud Drive**:
- User-created documents that sync
- File-based collaboration
- Simple file sync (like Dropbox)

**Use skill**: `axiom-icloud-drive-ref` for implementation details

### Key-Value Store (Small Preferences)

```swift
// ✅ CORRECT: Small synced preferences
let store = NSUbiquitousKeyValueStore.default

store.set(true, forKey: "darkModeEnabled")
store.set(2.0, forKey: "textSize")
store.synchronize()
```

**Limitations**:
- Max 1 MB total storage
- Max 1024 keys
- Max 1 MB per value
- For preferences ONLY, not data storage

---

## Common Patterns and Anti-Patterns

### ✅ DO: Choose Based on Data Shape

```swift
// ✅ CORRECT: Structured data → SwiftData
@Model
class Note {
    var title: String
    var content: String
    var tags: [Tag]  // Relationships
}

// ✅ CORRECT: Files → FileManager + proper directory
let imageData = capturedPhoto.jpegData(compressionQuality: 0.9)
try imageData?.write(to: documentsURL.appendingPathComponent("photo.jpg"))
```

### ❌ DON'T: Use Files for Structured Data

```swift
// ❌ WRONG: Storing queryable data as JSON files
let tasks = [Task(...), Task(...), Task(...)]
let jsonData = try JSONEncoder().encode(tasks)
try jsonData.write(to: appSupportURL.appendingPathComponent("tasks.json"))

// Why it's wrong:
// - Can't query individual tasks
// - Can't filter or sort efficiently
// - No relationships
// - Entire file loaded into memory
// - Concurrent access issues

// ✅ CORRECT: Use SwiftData instead
@Model class Task { ... }
```

### ❌ DON'T: Store Re-downloadable Content in Documents

```swift
// ❌ WRONG: Downloaded images in Documents (bloats backup!)
func downloadProfileImage(url: URL) throws {
    let data = try Data(contentsOf: url)
    let documentsURL = FileManager.default.urls(
        for: .documentDirectory,
        in: .userDomainMask
    )[0]
    try data.write(to: documentsURL.appendingPathComponent("profile.jpg"))
}

// ✅ CORRECT: Use Caches instead
func downloadProfileImage(url: URL) throws {
    let data = try Data(contentsOf: url)
    let cacheURL = FileManager.default.urls(
        for: .cachesDirectory,
        in: .userDomainMask
    )[0]
    let fileURL = cacheURL.appendingPathComponent("profile.jpg")
    try data.write(to: fileURL)

    // Mark excluded from backup
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    try fileURL.setResourceValues(resourceValues)
}
```

### ❌ DON'T: Use CloudKit for Simple File Sync

```swift
// ❌ WRONG: Storing files as CKAssets with manual sync
let asset = CKAsset(fileURL: documentURL)
let record = CKRecord(recordType: "Document")
record["file"] = asset
// ... manual upload, conflict handling, etc.

// ✅ CORRECT: Use iCloud Drive for files
// Files automatically sync via ubiquitous container
try data.write(to: iCloudDocumentsURL.appendingPathComponent("doc.pdf"))
```

---

## Quick Reference Table

| Data Type | Format | Local Location | Cloud Sync | Use Skill |
|-----------|--------|----------------|------------|-----------|
| User tasks, notes | Structured | Application Support | SwiftData + CloudKit | `axiom-swiftdata` → `axiom-cloudkit-ref` |
| User photos (created) | File | Documents | iCloud Drive | `axiom-file-protection-ref` → `axiom-icloud-drive-ref` |
| Downloaded images | File | Caches | None (re-download) | `axiom-storage-management-ref` |
| Thumbnails | File | Caches | None (regenerate) | `axiom-storage-management-ref` |
| Database file | File | Application Support | CKSyncEngine (if custom) | `axiom-sqlitedata` → `axiom-cloudkit-ref` |
| Temp processing | File | tmp | None | N/A |
| User settings | Key-Value | UserDefaults | NSUbiquitousKeyValueStore | N/A |

---

## Debugging: Data Missing or Not Syncing?

**Files disappeared**:
- Check if stored in Caches or tmp (system purged them)
- Check file protection level (may be inaccessible when locked)
- **Use skill**: `axiom-storage-diag`

**Backup too large**:
- Check if re-downloadable content is in Documents (should be in Caches)
- Check if `isExcludedFromBackup` is set on large files
- **Use skill**: `axiom-storage-management-ref`

**Data not syncing**:
- CloudKit: Check CKSyncEngine status, account availability
  - **Use skill**: `axiom-cloud-sync-diag`
- iCloud Drive: Check ubiquitous container entitlements, file coordinator
  - **Use skill**: `axiom-icloud-drive-ref`, `axiom-cloud-sync-diag`

---

## Migration Checklist

When changing storage approach:

**Database to Database** (e.g., Core Data → SwiftData):
- [ ] Create SwiftData models matching Core Data entities
- [ ] Write migration code to copy data
- [ ] Test with production-size datasets
- [ ] Keep old database for rollback

**Files to Database**:
- [ ] Identify all JSON/plist files storing structured data
- [ ] Create SwiftData models
- [ ] Write one-time migration on first launch
- [ ] Verify all data migrated, then delete old files

**Local to Cloud**:
- [ ] Ensure proper entitlements (CloudKit/iCloud)
- [ ] Handle initial upload carefully (bandwidth)
- [ ] Test conflict resolution
- [ ] Provide user control (opt-in)

---

**Last Updated**: 2025-12-12
**Skill Type**: Discipline
**Related WWDC Sessions**:
- WWDC 2023-10187: Meet SwiftData
- WWDC 2023-10188: Sync to iCloud with CKSyncEngine
- WWDC 2024-10137: What's new in SwiftData
