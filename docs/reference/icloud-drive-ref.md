---
name: icloud-drive-ref
description: File-based iCloud sync — ubiquitous containers, file coordination, conflict resolution
---

# iCloud Drive Reference

Comprehensive reference for file-based iCloud sync using ubiquitous containers and file coordination.

## Overview

iCloud Drive is for **file-based sync**, not structured data (use CloudKit for that). Provides automatic file sync across devices like Dropbox.

**Use When**: User creates/edits documents, file-based apps (like Pages)

**Don't Use When**: Need queryable data with relationships (use CloudKit)

## Core Concepts

### Ubiquitous Containers

```swift
// Get iCloud container URL
func getICloudURL() -> URL? {
    return FileManager.default.url(
        forUbiquityContainerIdentifier: nil
    )
}

// Check if iCloud available
if getICloudURL() != nil {
    print("iCloud available")
}
```

### Container Structure

```
iCloud Container/
├── Documents/     # User-visible (Files app)
└── Library/       # Hidden from user
```

### File Coordination (Critical)

**Always use NSFileCoordinator** for iCloud files to prevent:
- Race conditions with sync
- Data corruption
- Lost updates

```swift
// Coordinated read
let coordinator = NSFileCoordinator()
coordinator.coordinate(
    readingItemAt: url,
    options: [],
    error: nil
) { newURL in
    let data = try? Data(contentsOf: newURL)
}

// Coordinated write
coordinator.coordinate(
    writingItemAt: url,
    options: .forReplacing,
    error: nil
) { newURL in
    try? data.write(to: newURL)
}
```

## URL Resource Values

### iCloud Status

```swift
// Check if file in iCloud
let values = try? url.resourceValues(forKeys: [
    .isUbiquitousItemKey
])
let isInICloud = values?.isUbiquitousItem ?? false

// Check download status
let values = try? url.resourceValues(forKeys: [
    .ubiquitousItemDownloadingStatusKey
])
// Returns: .current, .notDownloaded, .downloaded

// Check for conflicts
let values = try? url.resourceValues(forKeys: [
    .ubiquitousItemHasUnresolvedConflictsKey
])
```

### Download Files

```swift
// Request download
try FileManager.default.startDownloadingUbiquitousItem(at: url)

// Monitor progress with NSMetadataQuery
```

## Conflict Resolution

### Detect Conflicts

```swift
let conflicts = NSFileVersion.unresolvedConflictVersionsOfItem(
    at: url
)
```

### Resolve Conflicts

```swift
// Keep current version
for conflict in conflicts {
    conflict.isResolved = true
}

// Or replace with chosen version
try chosenVersion.replaceItem(at: url, options: [])
chosenVersion.isResolved = true
```

## NSUbiquitousKeyValueStore

**For small preferences only** (<1 MB total, <1024 keys)

```swift
let store = NSUbiquitousKeyValueStore.default

// Set values
store.set(true, forKey: "darkModeEnabled")
store.synchronize()

// Read values
let darkMode = store.bool(forKey: "darkModeEnabled")

// Listen for changes
NotificationCenter.default.addObserver(
    forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
    object: store,
    queue: .main
) { _ in
    updatePreferences()
}
```

## Common Patterns

### Document Picker Integration

```swift
let picker = UIDocumentPickerViewController(
    forOpeningContentTypes: [.pdf, .plainText]
)
picker.directoryURL = getICloudURL()
present(picker, animated: true)
```

### Monitor Directory Changes

```swift
let query = NSMetadataQuery()
query.predicate = NSPredicate(
    format: "%K BEGINSWITH %@",
    NSMetadataItemPathKey,
    directoryURL.path
)
query.searchScopes = [NSMetadataQueryUbiquitousDataScope]

NotificationCenter.default.addObserver(
    forName: .NSMetadataQueryDidUpdate,
    object: query,
    queue: .main
) { _ in
    processResults()
}

query.start()
```

## Use This Skill When

- Implementing document-based iCloud sync
- Syncing user files across devices
- Using file coordination (NSFileCoordinator)
- Handling iCloud file conflicts
- Syncing small preferences

**Related**: storage, cloudkit-ref, cloud-sync-diag
