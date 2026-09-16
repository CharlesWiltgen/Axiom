
# iOS Storage Management Reference

**Purpose**: Comprehensive reference for storage pressure, purging policies, disk space, and URL resource values
**Context**: Answer to "Does iOS provide any way to mark files as 'purge as last resort'?"

## When to Use This Skill

Use this skill when you need to:
- Understand iOS file purging behavior
- Check available disk space correctly
- Set purge priorities for cached files
- Exclude files from backup
- Monitor storage pressure
- Understand volume capacity APIs
- Handle "low storage" scenarios

## The Core Question

> **"Does iOS provide any way to mark files as 'purge as last resort'?"**

**Answer**: Not directly, but iOS provides two approaches:

1. **Location-based purging** (implicit priority):
   - `tmp/` → Purged when your app is not running
   - `Library/Caches/` → Purged under storage pressure, never while the app is running
   - `Documents/`, `Application Support/` → Not purged while the app is installed (iOS; on tvOS every directory is purgeable)

2. **Capacity checking** (explicit strategy):
   - `volumeAvailableCapacityForImportantUsage` — Space for content the user asked to keep locally (still replaceable)
   - `volumeAvailableCapacityForOpportunisticUsage` — Space for content nobody asked for
   - Check before writing replaceable content; never gate an irreplaceable write on either key

---

## URL Resource Values for Storage

### Complete Reference Table

| Resource Key | Type | Purpose | Availability |
|--------------|------|---------|--------------|
| `volumeAvailableCapacityKey` | Int? | Total available space | iOS 4.0+ |
| `volumeAvailableCapacityForImportantUsageKey` | Int64 | Space for content the user expects locally (replaceable) | iOS 11.0+; unavailable on tvOS/watchOS |
| `volumeAvailableCapacityForOpportunisticUsageKey` | Int64 | Space for content nobody requested | iOS 11.0+; unavailable on tvOS/watchOS |
| `volumeTotalCapacityKey` | Int? | Total volume capacity | iOS 4.0+ |
| `isExcludedFromBackupKey` | Bool | Exclude from iCloud/iTunes backup | iOS 5.1+ |
| `fileAllocatedSizeKey` | Int? | Actual disk space used | iOS 4.0+ |
| `totalFileAllocatedSizeKey` | Int? | Total allocated (including metadata) | iOS 5.0+ |

### Checking Available Space (Modern Approach)

```swift
// ✅ CORRECT: Check capacity before writing replaceable content
func canSaveReplaceableContent(fileSize: Int64, userRequested: Bool) -> Bool {
    let homeURL = URL(fileURLWithPath: NSHomeDirectory())

    do {
        let values = try homeURL.resourceValues(forKeys: [
            .volumeAvailableCapacityForImportantUsageKey,
            .volumeAvailableCapacityForOpportunisticUsageKey
        ])

        if userRequested {
            // The user asked to keep this here, but it can be re-fetched
            let importantCapacity = values.volumeAvailableCapacityForImportantUsage ?? 0
            return fileSize < importantCapacity
        } else {
            // Nothing the user asked for (caches, thumbnails)
            let opportunisticCapacity = values.volumeAvailableCapacityForOpportunisticUsage ?? 0
            return fileSize < opportunisticCapacity
        }
    } catch {
        print("Error checking capacity: \(error)")
        return false
    }
}

// ✅ CORRECT: Never gate an irreplaceable write on a capacity check — attempt it
func saveUserDocument(_ data: Data, to url: URL) throws {
    do {
        try data.write(to: url, options: .atomic)
    } catch let error as NSError where error.domain == NSPOSIXErrorDomain && error.code == Int(ENOSPC) {
        showLowStorageAlert()
        throw error
    }
}

// Usage
if canSaveReplaceableContent(fileSize: Int64(imageData.count), userRequested: false) {
    try imageData.write(to: cachesURL.appendingPathComponent("photo.jpg"))
}

try saveUserDocument(imageData, to: documentsURL.appendingPathComponent("photo.jpg"))
```

### Important vs Opportunistic Capacity

**volumeAvailableCapacityForImportantUsage**:
- Space for content the user or app **clearly expects to be present locally** — but which is ultimately replaceable
- Use for: Content the user explicitly asked to keep, that can be re-fetched
- Includes space the system expects to reclaim by purging non-essential and cached resources

**volumeAvailableCapacityForOpportunisticUsage**:
- Space for content **no one explicitly asked for**
- Use for: Caches, thumbnails, pre-fetching
- Same purgeable-space accounting — the difference is only whether a request was made

Neither key is a reservation. From Apple's documentation for the important-usage key: *"This value should not be used in determining if there is room for an irreplaceable resource. In the case of irreplaceable resources, always attempt to save the resource regardless of available capacity and handle failure as gracefully as possible."*

```swift
// ✅ CORRECT: Different thresholds for different data types
func shouldDownloadThumbnail(size: Int64) -> Bool {
    let capacity = (try? URL(fileURLWithPath: NSHomeDirectory())
        .resourceValues(forKeys: [.volumeAvailableCapacityForOpportunisticUsageKey])
        .volumeAvailableCapacityForOpportunisticUsage) ?? 0

    // Only download optional content if there's plenty of space
    return size < capacity
}

func shouldReDownloadUserContent(size: Int64) -> Bool {
    let capacity = (try? URL(fileURLWithPath: NSHomeDirectory())
        .resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        .volumeAvailableCapacityForImportantUsage) ?? 0

    // The user asked for this, but it can be re-fetched — check before pulling it down again
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
    var url = url  // setResourceValues is mutating
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

## Implicit Purge Priority (Location-Based)

iOS purges files based on **location**, not explicit priority flags.

### Purge Priority Hierarchy

```
PURGED FIRST (Between Launches):
└── tmp/
    - Purged: When your app is not running (periodically, and on device restore)
    - Use for: Truly temporary intermediates

PURGED SECOND (Storage Pressure):
└── Library/Caches/
    - Purged: When the system needs space; never while the app is running
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

This hierarchy is iOS. On tvOS the directories exist but none of them survive reliably once the app is not running — see axiom-swift (skills/tvos.md).

### Implementation Strategy

```swift
// ✅ CORRECT: Choose location based on purge priority needs
func saveFile(data: Data, priority: FilePriority) throws {
    var url: URL  // setResourceValues is mutating

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
        // Purged when the app is not running - for temp files
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
    case temporary    // Purge between launches
}
```

---

## Storage Pressure Detection

### Responding to Low Storage

```swift
// ✅ CORRECT: Monitor for low storage and clean up proactively
class StorageMonitor {
    func checkStorageAndCleanup() {
        let homeURL = URL(fileURLWithPath: NSHomeDirectory())

        guard let values = try? homeURL.resourceValues(forKeys: [
            .volumeAvailableCapacityForOpportunisticUsageKey,
            .volumeTotalCapacityKey
        ]) else { return }

        let availableSpace = values.volumeAvailableCapacityForOpportunisticUsage ?? 0
        let totalSpace = values.volumeTotalCapacity ?? 1

        // Calculate percentage
        let percentAvailable = Double(availableSpace) / Double(totalSpace)

        if percentAvailable < 0.10 {  // Tunable: clean up below 10% free
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
// Requires Info.plist BGTaskSchedulerPermittedIdentifiers = ["com.example.app.cleanup"]
// and UIBackgroundModes = ["processing"] for a BGProcessingTask.
import BackgroundTasks

// Call from application(_:didFinishLaunchingWithOptions:) — every launch handler
// must be registered before it returns
func registerBackgroundCleanup() {
    let registered = BGTaskScheduler.shared.register(
        forTaskWithIdentifier: "com.example.app.cleanup",
        using: nil
    ) { task in
        self.handleStorageCleanup(task: task as! BGProcessingTask)
    }

    // false means the identifier is missing from BGTaskSchedulerPermittedIdentifiers
    assert(registered, "com.example.app.cleanup is not a permitted background task identifier")
}

// Registering alone never delivers a task — submit a request to schedule it
func scheduleStorageCleanup() {
    let request = BGProcessingTaskRequest(identifier: "com.example.app.cleanup")
    request.requiresNetworkConnectivity = false
    request.requiresExternalPower = false

    do {
        try BGTaskScheduler.shared.submit(request)
    } catch {
        print("Could not schedule storage cleanup: \(error)")
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
    let homeURL = URL(fileURLWithPath: NSHomeDirectory())
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
            cleanupOldestFiles(targetSize: 100 * 1_000_000) // Tunable target: 100 MB
        }

        try data.write(to: cacheURL)
    }

    func shouldCleanupCache(addingSize: Int64) -> Bool {
        let homeURL = URL(fileURLWithPath: NSHomeDirectory())
        guard let values = try? homeURL.resourceValues(forKeys: [
            .volumeAvailableCapacityForOpportunisticUsageKey
        ]) else { return false }

        let available = values.volumeAvailableCapacityForOpportunisticUsage ?? 0

        // Tunable: keep 200 MB of headroom free
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
        var mediaURL = applicationSupportDirectory  // setResourceValues is mutating
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
    if size > 100 * 1_000_000 {  // Tunable threshold: 100 MB
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
           size > 10 * 1_000_000 {  // Tunable threshold: 10 MB
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
| Check space before a replaceable write | `volumeAvailableCapacityForImportantUsageKey` | `values.volumeAvailableCapacityForImportantUsage` |
| Check space for cache | `volumeAvailableCapacityForOpportunisticUsageKey` | `values.volumeAvailableCapacityForOpportunisticUsage` |
| Save irreplaceable content | Attempt the write | Handle `NSPOSIXErrorDomain` 28 (ENOSPC) |
| Exclude from backup | `isExcludedFromBackupKey` | `resourceValues.isExcludedFromBackup = true` |
| Get file size | `totalFileAllocatedSizeKey` | `values.totalFileAllocatedSize` |
| Purge priority | Location-based | Use `tmp/` or `Caches/` directory |

---

## File Protection Quick Reference

Set encryption level per file. See axiom-security (skills/file-protection-ref.md) for full guide.

| Level | When Accessible | Use For |
|-------|----------------|---------|
| `.complete` | Only while unlocked | Passwords, tokens, health data |
| `.completeUnlessOpen` | After first unlock if already open | Active downloads, media recording |
| `.completeUntilFirstUserAuthentication` | After first unlock (default) | Most app data |
| `.none` | Always, even before unlock | Background fetch data, push payloads |

```swift
// Set protection on file
try data.write(to: url, options: .completeFileProtection)

// Set protection on directory
try FileManager.default.createDirectory(
    at: url,
    withIntermediateDirectories: true,
    attributes: [.protectionKey: FileProtectionType.complete]
)

// Check current protection
let values = try url.resourceValues(forKeys: [.fileProtectionKey])
print("Protection: \(values.fileProtection ?? .none)")
```

---

## Related Skills

- `skills/storage.md` — Decide where to store files
- axiom-security (skills/file-protection-ref.md) — File encryption and security
- `skills/storage-diag.md` — Debug storage-related issues
