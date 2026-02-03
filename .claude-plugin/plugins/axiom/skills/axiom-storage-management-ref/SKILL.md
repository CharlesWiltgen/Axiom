---
name: axiom-storage-management-ref
description: Use when asking about 'purge files', 'storage pressure', 'disk space iOS', 'isExcludedFromBackup', 'URL resource values', 'volumeAvailableCapacity', 'low storage', 'file purging priority', 'cache management' - comprehensive reference for iOS storage management and URL resource value APIs
license: MIT
compatibility: iOS 5.0+, iPadOS 5.0+, macOS 10.7+
metadata:
  version: "1.0.0"
  last-updated: "2025-12-12"
---

# iOS Storage Management Reference

**Purpose**: Comprehensive reference for storage pressure, purging policies, disk space, and URL resource values
**Availability**: iOS 5.0+ (basic), iOS 11.0+ (modern capacity APIs)
**Context**: Answer to "Does iOS provide any way to mark files as 'purge as last resort'?"

## When to Use This Skill

Use this skill when you need to:
- Understand iOS file purging behavior
- Check available disk space correctly
- Set purge priorities for cached files
- Exclude files from backup
- Monitor storage pressure
- Mark files as purgeable
- Understand volume capacity APIs
- Handle "low storage" scenarios

## The Core Question

> **"Does iOS provide any way to mark files as 'purge as last resort'?"**

**Answer**: Not directly, but iOS provides two approaches:

1. **Location-based purging** (implicit priority):
   - `tmp/` → Purged aggressively (anytime)
   - `Library/Caches/` → Purged under storage pressure
   - `Documents/`, `Application Support/` → Never purged

2. **Capacity checking** (explicit strategy):
   - `volumeAvailableCapacityForImportantUsage` — For must-save data
   - `volumeAvailableCapacityForOpportunisticUsage` — For nice-to-have data
   - Check before saving, choose location based on available space

---

## URL Resource Values for Storage

### Complete Reference Table

| Resource Key | Type | Purpose | Availability |
|--------------|------|---------|--------------|
| `volumeAvailableCapacityKey` | Int64 | Total available space | iOS 5.0+ |
| `volumeAvailableCapacityForImportantUsageKey` | Int64 | Space for essential files | iOS 11.0+ |
| `volumeAvailableCapacityForOpportunisticUsageKey` | Int64 | Space for optional files | iOS 11.0+ |
| `volumeTotalCapacityKey` | Int64 | Total volume capacity | iOS 5.0+ |
| `isExcludedFromBackupKey` | Bool | Exclude from iCloud/iTunes backup | iOS 5.1+ |
| `isPurgeableKey` | Bool | System can delete under pressure | iOS 9.0+ |
| `fileAllocatedSizeKey` | Int64 | Actual disk space used | iOS 5.0+ |
| `totalFileAllocatedSizeKey` | Int64 | Total allocated (including metadata) | iOS 5.0+ |

### Checking Available Space (Modern Approach)

```swift
// ✅ CORRECT: Check appropriate capacity before saving
func checkSpaceBeforeSaving(fileSize: Int64, isEssential: Bool) -> Bool {
    let homeURL = FileManager.default.homeDirectoryForCurrentUser

    do {
        let values = try homeURL.resourceValues(forKeys: [
            .volumeAvailableCapacityForImportantUsageKey,
            .volumeAvailableCapacityForOpportunisticUsageKey
        ])

        if isEssential {
            // For must-save data (user-created content, critical app data)
            let importantCapacity = values.volumeAvailableCapacityForImportantUsage ?? 0
            return fileSize < importantCapacity
        } else {
            // For nice-to-have data (caches, thumbnails)
            let opportunisticCapacity = values.volumeAvailableCapacityForOpportunisticUsage ?? 0
            return fileSize < opportunisticCapacity
        }
    } catch {
        print("Error checking capacity: \(error)")
        return false
    }
}

// Usage
if checkSpaceBeforeSaving(fileSize: imageData.count, isEssential: true) {
    try imageData.write(to: documentsURL.appendingPathComponent("photo.jpg"))
} else {
    showLowStorageAlert()
}
```

### Important vs Opportunistic Capacity

**volumeAvailableCapacityForImportantUsage**:
- Space reserved for **essential** operations
- Use for: User-created content, must-save data
- System reserves this space more aggressively
- Higher threshold

**volumeAvailableCapacityForOpportunisticUsage**:
- Space available for **optional** operations
- Use for: Caches, thumbnails, pre-fetching
- Lower threshold (system may already be under pressure)
- Indicates "go ahead if you want, but system is getting full"

```swift
// ✅ CORRECT: Different thresholds for different data types
func shouldDownloadThumbnail(size: Int64) -> Bool {
    let capacity = try? FileManager.default.homeDirectoryForCurrentUser
        .resourceValues(forKeys: [.volumeAvailableCapacityForOpportunisticUsageKey])
        .volumeAvailableCapacityForOpportunisticUsage ?? 0

    // Only download optional content if there's plenty of space
    return size < capacity
}

func canSaveUserDocument(size: Int64) -> Bool {
    let capacity = try? FileManager.default.homeDirectoryForCurrentUser
        .resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        .volumeAvailableCapacityForImportantUsage ?? 0

    // User documents are essential
    return size < capacity
}
```

---

## Backup Exclusion

### isExcludedFromBackup

Files in `Caches/` are automatically excluded from backup, but you should **explicitly mark** re-downloadable files in other directories.

```swift
// ✅ CORRECT: Exclude large re-downloadable files from backup
func markExcludedFromBackup(url: URL) throws {
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    try url.setResourceValues(resourceValues)
}

// Example: Downloaded podcast episodes
func downloadPodcast(url: URL) throws {
    let appSupportURL = FileManager.default.urls(
        for: .applicationSupportDirectory,
        in: .userDomainMask
    )[0]

    let podcastURL = appSupportURL
        .appendingPathComponent("Podcasts")
        .appendingPathComponent(url.lastPathComponent)

    // Download file
    let data = try Data(contentsOf: url)
    try data.write(to: podcastURL)

    // Mark as excluded from backup (can re-download)
    try markExcludedFromBackup(url: podcastURL)
}
```

**When to exclude from backup**:
- ✅ Downloaded content that can be re-fetched
- ✅ Generated thumbnails
- ✅ Cached API responses
- ✅ Large media files from server
- ❌ User-created content (always back up)
- ❌ App data that can't be recreated

### Checking Backup Status

```swift
// ✅ Check if file is excluded from backup
func isExcludedFromBackup(url: URL) -> Bool {
    let values = try? url.resourceValues(forKeys: [.isExcludedFromBackupKey])
    return values?.isExcludedFromBackup ?? false
}
```

---

## Purgeable Files

### isPurgeable

Mark files as candidates for automatic purging by the system.

```swift
// ✅ CORRECT: Mark cache files as purgeable
func markAsPurgeable(url: URL) throws {
    var resourceValues = URLResourceValues()
    resourceValues.isPurgeable = true
    try url.setResourceValues(resourceValues)
}

// Example: Thumbnail cache
func cacheThumbnail(image: UIImage, for url: URL) throws {
    let cacheURL = FileManager.default.urls(
        for: .cachesDirectory,
        in: .userDomainMask
    )[0]

    let thumbnailURL = cacheURL.appendingPathComponent(url.lastPathComponent)

    // Save thumbnail
    try image.pngData()?.write(to: thumbnailURL)

    // Mark as purgeable
    try markAsPurgeable(url: thumbnailURL)

    // Also exclude from backup
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    try thumbnailURL.setResourceValues(resourceValues)
}
```

**Note**: Files in `Caches/` are already purgeable by location. Setting `isPurgeable` is advisory for files in other locations.

---

## Implicit Purge Priority (Location-Based)

iOS purges files based on **location**, not explicit priority flags.

### Purge Priority Hierarchy

```
PURGED FIRST (Aggressive):
└── tmp/
    - Purged: Anytime (even while app running)
    - Lifetime: Hours to days
    - Use for: Truly temporary intermediates

PURGED SECOND (Storage Pressure):
└── Library/Caches/
    - Purged: When system needs space
    - Lifetime: Weeks to months (if space available)
    - Use for: Re-downloadable, regenerable content

NEVER PURGED (Permanent):
├── Documents/
│   - Backed up: ✅ Yes
│   - Purged: ❌ Never (unless app deleted)
│   - Use for: User-created content
│
└── Library/Application Support/
    - Backed up: ✅ Yes
    - Purged: ❌ Never (unless app deleted)
    - Use for: Essential app data
```

### Implementation Strategy

```swift
// ✅ CORRECT: Choose location based on purge priority needs
func saveFile(data: Data, priority: FilePriority) throws {
    let url: URL

    switch priority {
    case .essential:
        // Never purged - for user-created or critical app data
        url = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("important.dat")

    case .cacheable:
        // Purged under storage pressure - for re-downloadable content
        url = FileManager.default.urls(
            for: .cachesDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("cache.dat")

    case .temporary:
        // Purged aggressively - for temp files
        url = FileManager.default.temporaryDirectory
            .appendingPathComponent("temp.dat")
    }

    try data.write(to: url)

    // For cacheable files, mark excluded from backup
    if priority == .cacheable {
        var resourceValues = URLResourceValues()
        resourceValues.isExcludedFromBackup = true
        try url.setResourceValues(resourceValues)
    }
}

enum FilePriority {
    case essential    // Never purge
    case cacheable    // Purge under pressure
    case temporary    // Purge aggressively
}
```

---

## Storage Pressure Detection

### Responding to Low Storage

```swift
// ✅ CORRECT: Monitor for low storage and clean up proactively
class StorageMonitor {
    func checkStorageAndCleanup() {
        let homeURL = FileManager.default.homeDirectoryForCurrentUser

        guard let values = try? homeURL.resourceValues(forKeys: [
            .volumeAvailableCapacityForOpportunisticUsageKey,
            .volumeTotalCapacityKey
        ]) else { return }

        let availableSpace = values.volumeAvailableCapacityForOpportunisticUsage ?? 0
        let totalSpace = values.volumeTotalCapacity ?? 1

        // Calculate percentage
        let percentAvailable = Double(availableSpace) / Double(totalSpace)

        if percentAvailable < 0.10 {  // Less than 10% free
            print("⚠️ Low storage detected, cleaning up...")
            cleanupCaches()
        }
    }

    func cleanupCaches() {
        let cacheURL = FileManager.default.urls(
            for: .cachesDirectory,
            in: .userDomainMask
        )[0]

        // Delete old cache files
        let fileManager = FileManager.default
        guard let files = try? fileManager.contentsOfDirectory(
            at: cacheURL,
            includingPropertiesForKeys: [.contentModificationDateKey]
        ) else { return }

        // Sort by modification date
        let sortedFiles = files.sorted { url1, url2 in
            let date1 = (try? url1.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            let date2 = (try? url2.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            return (date1 ?? .distantPast) < (date2 ?? .distantPast)
        }

        // Delete oldest files first
        for fileURL in sortedFiles.prefix(100) {
            try? fileManager.removeItem(at: fileURL)
        }
    }
}
```

### Background Cleanup Task

```swift
// ✅ CORRECT: Register background task to clean up storage
import BackgroundTasks

func registerBackgroundCleanup() {
    BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "com.example.app.cleanup",
        using: nil
    ) { task in
        self.handleStorageCleanup(task: task as! BGProcessingTask)
    }
}

func handleStorageCleanup(task: BGProcessingTask) {
    task.expirationHandler = {
        task.setTaskCompleted(success: false)
    }

    // Clean up old caches
    cleanupOldFiles()

    task.setTaskCompleted(success: true)
}
```

---

## File Size Calculation

### Getting Accurate File Sizes

```swift
// ✅ CORRECT: Get actual disk usage (includes filesystem overhead)
func getFileSize(url: URL) -> Int64? {
    let values = try? url.resourceValues(forKeys: [
        .fileAllocatedSizeKey,
        .totalFileAllocatedSizeKey
    ])

    // Use totalFileAllocatedSize for accurate disk usage
    return values?.totalFileAllocatedSize.map { Int64($0) }
}

// ✅ Calculate directory size
func getDirectorySize(url: URL) -> Int64 {
    guard let enumerator = FileManager.default.enumerator(
        at: url,
        includingPropertiesForKeys: [.totalFileAllocatedSizeKey]
    ) else { return 0 }

    var totalSize: Int64 = 0

    for case let fileURL as URL in enumerator {
        if let size = getFileSize(url: fileURL) {
            totalSize += size
        }
    }

    return totalSize
}

// Usage
let cacheSize = getDirectorySize(url: cachesDirectory)
print("Cache using \(cacheSize / 1_000_000) MB")
```

---

## Common Patterns

### Pattern 1: Smart Download Based on Available Space

```swift
// ✅ CORRECT: Only download optional content if space available
func downloadOptionalContent(url: URL, size: Int64) async throws {
    // Check opportunistic capacity
    let homeURL = FileManager.default.homeDirectoryForCurrentUser
    let values = try homeURL.resourceValues(forKeys: [
        .volumeAvailableCapacityForOpportunisticUsageKey
    ])

    guard let available = values.volumeAvailableCapacityForOpportunisticUsage,
          size < available else {
        print("Skipping download - low storage")
        return
    }

    // Proceed with download
    let data = try await URLSession.shared.data(from: url).0
    try data.write(to: cachesDirectory.appendingPathComponent(url.lastPathComponent))
}
```

### Pattern 2: Progressive Cache Cleanup

```swift
// ✅ CORRECT: Clean up caches when approaching storage limits
class CacheManager {
    func addToCache(data: Data, key: String) throws {
        let cacheURL = getCacheURL(for: key)

        // Check if we should clean up first
        if shouldCleanupCache(addingSize: Int64(data.count)) {
            cleanupOldestFiles(targetSize: 100 * 1_000_000) // 100 MB
        }

        try data.write(to: cacheURL)
    }

    func shouldCleanupCache(addingSize: Int64) -> Bool {
        let homeURL = FileManager.default.homeDirectoryForCurrentUser
        guard let values = try? homeURL.resourceValues(forKeys: [
            .volumeAvailableCapacityForOpportunisticUsageKey
        ]) else { return false }

        let available = values.volumeAvailableCapacityForOpportunisticUsage ?? 0

        // Clean up if less than 200 MB free
        return available < 200 * 1_000_000
    }

    func cleanupOldestFiles(targetSize: Int64) {
        // Delete oldest cache files until under target
        // (implementation similar to earlier example)
    }
}
```

### Pattern 3: Exclude Downloaded Media from Backup

```swift
// ✅ CORRECT: Downloaded podcast/video management
class MediaDownloader {
    func downloadMedia(url: URL) async throws {
        let data = try await URLSession.shared.data(from: url).0

        // Store in Application Support (not Caches, so it persists)
        let mediaURL = applicationSupportDirectory
            .appendingPathComponent("Downloads")
            .appendingPathComponent(url.lastPathComponent)

        try data.write(to: mediaURL)

        // But exclude from backup (can re-download)
        var resourceValues = URLResourceValues()
        resourceValues.isExcludedFromBackup = true
        try mediaURL.setResourceValues(resourceValues)
    }
}
```

---

## Debugging Storage Issues

### Audit Backup Size

```swift
// ✅ Check what's being backed up
func auditBackupSize() {
    let documentsURL = FileManager.default.urls(
        for: .documentDirectory,
        in: .userDomainMask
    )[0]

    let size = getDirectorySize(url: documentsURL)
    print("Documents (backed up): \(size / 1_000_000) MB")

    // Check for large files that should be excluded
    if size > 100 * 1_000_000 {  // > 100 MB
        print("⚠️ Large backup size - check for re-downloadable files")
        findLargeFiles(in: documentsURL)
    }
}

func findLargeFiles(in directory: URL) {
    guard let enumerator = FileManager.default.enumerator(
        at: directory,
        includingPropertiesForKeys: [.totalFileAllocatedSizeKey]
    ) else { return }

    for case let fileURL as URL in enumerator {
        if let size = getFileSize(url: fileURL),
           size > 10 * 1_000_000 {  // > 10 MB
            print("Large file: \(fileURL.lastPathComponent) (\(size / 1_000_000) MB)")

            // Check if excluded from backup
            if !isExcludedFromBackup(url: fileURL) {
                print("⚠️ Should this be excluded from backup?")
            }
        }
    }
}
```

---

## Quick Reference

| Task | API | Code |
|------|-----|------|
| Check space for essential file | `volumeAvailableCapacityForImportantUsageKey` | `values.volumeAvailableCapacityForImportantUsage` |
| Check space for cache | `volumeAvailableCapacityForOpportunisticUsageKey` | `values.volumeAvailableCapacityForOpportunisticUsage` |
| Exclude from backup | `isExcludedFromBackupKey` | `resourceValues.isExcludedFromBackup = true` |
| Mark purgeable | `isPurgeableKey` | `resourceValues.isPurgeable = true` |
| Get file size | `totalFileAllocatedSizeKey` | `values.totalFileAllocatedSize` |
| Purge priority | Location-based | Use `tmp/` or `Caches/` directory |

---

## Related Skills

- `axiom-storage` — Decide where to store files
- `axiom-file-protection-ref` — File encryption and security
- `axiom-storage-diag` — Debug storage-related issues

---

**Last Updated**: 2025-12-12
**Skill Type**: Reference
**Minimum iOS**: 5.0 (basic), 11.0 (modern capacity APIs)
