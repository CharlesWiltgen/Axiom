---
name: storage-management-ref
description: Purge priorities, disk space APIs, backup exclusion — complete storage management reference
---

# Storage Management Reference

Comprehensive reference for storage pressure, purging policies, disk space checking, and URL resource values.

## Overview

**Answers the question**: "Does iOS provide purge priority APIs?"

iOS provides two approaches:
1. **Location-based purging** (implicit): tmp/ → Caches/ → never (Documents/)
2. **Capacity checking** (explicit): volumeAvailableCapacityForImportant vs Opportunistic

## URL Resource Values

### Disk Space APIs

```swift
// For must-save data
let values = try url.resourceValues(forKeys: [
    .volumeAvailableCapacityForImportantUsageKey
])
let importantSpace = values.volumeAvailableCapacityForImportantUsage

// For optional caches
let values = try url.resourceValues(forKeys: [
    .volumeAvailableCapacityForOpportunisticUsageKey
])
let cacheSpace = values.volumeAvailableCapacityForOpportunisticUsage
```

### Backup Control

```swift
// Exclude re-downloadable files from backup
var resourceValues = URLResourceValues()
resourceValues.isExcludedFromBackup = true
try url.setResourceValues(resourceValues)
```

### Purgeable Files

```swift
// Mark as purgeable candidate
var resourceValues = URLResourceValues()
resourceValues.isPurgeable = true
try url.setResourceValues(resourceValues)
```

## Purge Priority Hierarchy

### System Purge Behavior

```
PURGED FIRST (Aggressive):
└── tmp/ — Hours to days

PURGED SECOND (Storage Pressure):
└── Caches/ — Weeks to months

NEVER PURGED:
├── Documents/
└── Application Support/
```

### Implementation Strategy

```swift
enum FilePriority {
    case essential    // Documents/, App Support/
    case cacheable    // Caches/
    case temporary    // tmp/
}

func saveFile(data: Data, priority: FilePriority) {
    let url = getURL(for: priority)
    try data.write(to: url)

    if priority == .cacheable {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try url.setResourceValues(values)
    }
}
```

## Common Patterns

### Check Space Before Saving

```swift
func shouldDownload(size: Int64, isEssential: Bool) -> Bool {
    let key: URLResourceKey = isEssential
        ? .volumeAvailableCapacityForImportantUsageKey
        : .volumeAvailableCapacityForOpportunisticUsageKey

    let values = try? url.resourceValues(forKeys: [key])
    let available = isEssential
        ? values?.volumeAvailableCapacityForImportantUsage
        : values?.volumeAvailableCapacityForOpportunisticUsage

    return size < (available ?? 0)
}
```

### Proactive Cache Cleanup

```swift
func cleanupIfNeeded() {
    let values = try? url.resourceValues(forKeys: [
        .volumeAvailableCapacityForOpportunisticUsageKey
    ])

    if let available = values?.volumeAvailableCapacityForOpportunisticUsage,
       available < 200_000_000 {  // < 200 MB
        deleteOldestCacheFiles()
    }
}
```

## Use This Skill When

- Understanding purge priorities ("purge as last resort")
- Checking available disk space
- Excluding files from backup
- Handling storage pressure
- Implementing cache management

**Related**: storage, storage-diag, file-protection-ref
