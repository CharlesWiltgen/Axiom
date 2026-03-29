---
name: axiom-icloud-drive-ref
description: Use when implementing 'iCloud Drive', 'ubiquitous container', 'file sync', 'NSFileCoordinator', 'NSFilePresenter', 'isUbiquitousItem', 'NSUbiquitousKeyValueStore', 'ubiquitous file sync' - comprehensive file-based iCloud sync reference
license: MIT
compatibility: iOS 5.0+, iPadOS 13.0+, macOS 10.7+
metadata:
  version: "1.0.0"
  last-updated: "2025-12-12"
---

# iCloud Drive Reference

**Purpose**: Comprehensive reference for file-based iCloud sync using ubiquitous containers
**Availability**: iOS 5.0+ (basic), iOS 8.0+ (iCloud Drive), iOS 11.0+ (modern APIs)
**Context**: File-based cloud storage, not database (use CloudKit for structured data)

## When to Use This Skill

Use this skill when:
- Implementing document-based iCloud sync
- Syncing user files across devices
- Building document-based apps (like Pages, Numbers)
- Coordinating file access across processes
- Handling iCloud file conflicts
- Using NSUbiquitousKeyValueStore for preferences

**NOT for**: Structured data with relationships (use `axiom-cloudkit-ref` instead)

---

## Overview

**iCloud Drive is for FILE-BASED sync**, not structured data.

**Use when**:
- User creates/edits documents
- Files need to sync like Dropbox
- Document picker integration

**Don't use when**:
- Need queryable structured data (use CloudKit)
- Need relationships between records (use CloudKit)
- Small key-value preferences (use NSUbiquitousKeyValueStore)

---

## Ubiquitous Containers

### Getting Ubiquitous Container URL

```swift
// ✅ CORRECT: Get iCloud container
func getICloudContainerURL() -> URL? {
    // nil = use first container in entitlements
    return FileManager.default.url(
        forUbiquityContainerIdentifier: nil
    )
}

// ✅ Check if iCloud is available
if let iCloudURL = getICloudContainerURL() {
    print("iCloud available: \(iCloudURL)")
} else {
    print("iCloud not available (not signed in or no entitlement)")
}
```

### Container Structure

```
iCloud Container/
├── Documents/          # User-visible files (Files app)
│   └── MyApp/         # Your app's documents
├── Library/           # Hidden from user
│   ├── Application Support/
│   └── Caches/
```

### Saving to iCloud Drive

```swift
// ✅ CORRECT: Save document to iCloud
func saveToICloud(data: Data, filename: String) throws {
    guard let iCloudURL = FileManager.default.url(
        forUbiquityContainerIdentifier: nil
    ) else {
        throw iCloudError.notAvailable
    }

    let documentsURL = iCloudURL.appendingPathComponent("Documents")

    // Create directory if needed
    try FileManager.default.createDirectory(
        at: documentsURL,
        withIntermediateDirectories: true
    )

    let fileURL = documentsURL.appendingPathComponent(filename)

    // Use file coordination for safe access
    let coordinator = NSFileCoordinator()
    var error: NSError?

    coordinator.coordinate(
        writingItemAt: fileURL,
        options: .forReplacing,
        error: &error
    ) { newURL in
        try? data.write(to: newURL)
    }

    if let error = error {
        throw error
    }
}
```

---

## File Coordination (Critical for Safety)

**Always use NSFileCoordinator** when accessing iCloud files. This prevents:
- Race conditions with sync
- Data corruption
- Lost updates

### Reading Files

```swift
// ✅ CORRECT: Coordinated read
func readICloudFile(url: URL) throws -> Data {
    let coordinator = NSFileCoordinator()
    var data: Data?
    var coordinationError: NSError?

    coordinator.coordinate(
        readingItemAt: url,
        options: [],
        error: &coordinationError
    ) { newURL in
        data = try? Data(contentsOf: newURL)
    }

    if let error = coordinationError {
        throw error
    }

    guard let data = data else {
        throw fileError.readFailed
    }

    return data
}
```

### Writing Files

```swift
// ✅ CORRECT: Coordinated write
func writeICloudFile(data: Data, to url: URL) throws {
    let coordinator = NSFileCoordinator()
    var coordinationError: NSError?

    coordinator.coordinate(
        writingItemAt: url,
        options: .forReplacing,
        error: &coordinationError
    ) { newURL in
        try? data.write(to: newURL)
    }

    if let error = coordinationError {
        throw error
    }
}
```

### Moving Files

```swift
// ✅ CORRECT: Coordinated move
func moveFile(from sourceURL: URL, to destURL: URL) throws {
    let coordinator = NSFileCoordinator()
    var coordinationError: NSError?

    coordinator.coordinate(
        writingItemAt: sourceURL,
        options: .forMoving,
        writingItemAt: destURL,
        options: .forReplacing,
        error: &coordinationError
    ) { newSource, newDest in
        try? FileManager.default.moveItem(at: newSource, to: newDest)
    }

    if let error = coordinationError {
        throw error
    }
}
```

---

## URL Resource Values for iCloud

### Checking iCloud Status

```swift
// ✅ Check if file is in iCloud
func isInICloud(url: URL) -> Bool {
    let values = try? url.resourceValues(forKeys: [.isUbiquitousItemKey])
    return values?.isUbiquitousItem ?? false
}

// ✅ Check download status
func getDownloadStatus(url: URL) -> String {
    let values = try? url.resourceValues(forKeys: [
        .ubiquitousItemDownloadingStatusKey,
        .ubiquitousItemIsDownloadingKey,
        .ubiquitousItemDownloadingErrorKey
    ])

    if let downloading = values?.ubiquitousItemIsDownloading, downloading {
        return "Downloading..."
    }

    if let status = values?.ubiquitousItemDownloadingStatus {
        switch status {
        case .current:
            return "Downloaded"
        case .notDownloaded:
            return "Not downloaded (iCloud only)"
        case .downloaded:
            return "Downloaded"
        @unknown default:
            return "Unknown"
        }
    }

    return "Unknown"
}

// ✅ Check upload status
func isUploading(url: URL) -> Bool {
    let values = try? url.resourceValues(forKeys: [.ubiquitousItemIsUploadingKey])
    return values?.ubiquitousItemIsUploading ?? false
}

// ✅ Check for conflicts
func hasConflicts(url: URL) -> Bool {
    let values = try? url.resourceValues(forKeys: [
        .ubiquitousItemHasUnresolvedConflictsKey
    ])
    return values?.ubiquitousItemHasUnresolvedConflicts ?? false
}
```

### Downloading Files

```swift
// ✅ CORRECT: Request download
func downloadFromICloud(url: URL) throws {
    try FileManager.default.startDownloadingUbiquitousItem(at: url)
}

// ✅ Monitor download progress
let query = NSMetadataQuery()
query.predicate = NSPredicate(format: "%K == %@",
    NSMetadataItemURLKey, url as NSURL)
query.searchScopes = [NSMetadataQueryUbiquitousDataScope]

NotificationCenter.default.addObserver(
    forName: .NSMetadataQueryDidUpdate,
    object: query,
    queue: .main
) { notification in
    // Check progress
    if let item = query.results.first as? NSMetadataItem {
        if let percent = item.value(forAttribute: NSMetadataUbiquitousItemPercentDownloadedKey) as? Double {
            print("Downloaded: \(percent)%")
        }
    }
}

query.start()
```

---

## Conflict Resolution

### Detecting Conflicts

```swift
// ✅ Get conflict versions
func getConflictVersions(for url: URL) -> [NSFileVersion]? {
    return NSFileVersion.unresolvedConflictVersionsOfItem(at: url)
}
```

### Resolving Conflicts

```swift
// ✅ CORRECT: Resolve conflicts
func resolveConflicts(at url: URL, keepingVersion: ConflictResolution) throws {
    guard let conflicts = NSFileVersion.unresolvedConflictVersionsOfItem(at: url),
          !conflicts.isEmpty else {
        return  // No conflicts
    }

    let current = try NSFileVersion.currentVersionOfItem(at: url)

    switch keepingVersion {
    case .current:
        // Keep current version, discard others
        for conflict in conflicts {
            conflict.isResolved = true
        }

    case .other(let chosenVersion):
        // Replace current with chosen conflict version
        try chosenVersion.replaceItem(at: url, options: [])
        chosenVersion.isResolved = true

        // Mark other conflicts as resolved
        for conflict in conflicts where conflict != chosenVersion {
            conflict.isResolved = true
        }

    case .manual:
        // App merges manually, then marks resolved
        let mergedData = mergeConflicts(current: current, conflicts: conflicts)
        try mergedData.write(to: url)

        for conflict in conflicts {
            conflict.isResolved = true
        }
    }

    // Remove resolved versions
    try NSFileVersion.removeOtherVersionsOfItem(at: url)
}

enum ConflictResolution {
    case current
    case other(NSFileVersion)
    case manual
}
```

---

## NSUbiquitousKeyValueStore (Preferences Sync)

**For small preferences only** (<1 MB total, <1024 keys)

```swift
// ✅ CORRECT: Sync small preferences
let store = NSUbiquitousKeyValueStore.default

// Set values
store.set(true, forKey: "darkModeEnabled")
store.set(2.0, forKey: "textSizeMultiplier")
store.set(["en", "es"], forKey: "selectedLanguages")

// Synchronize
store.synchronize()

// Read values
let darkMode = store.bool(forKey: "darkModeEnabled")
let textSize = store.double(forKey: "textSizeMultiplier")

// Listen for changes from other devices
NotificationCenter.default.addObserver(
    forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
    object: store,
    queue: .main
) { notification in
    // Update UI with new values
    updatePreferences()
}
```

**Limitations**:
- Total storage: 1 MB
- Max keys: 1024
- Max value size: 1 MB
- Use only for preferences, not data

---

## Entitlements

```xml
<!-- iCloud capability -->
<key>com.apple.developer.icloud-services</key>
<array>
    <string>CloudDocuments</string>
</array>

<!-- Ubiquitous containers -->
<key>com.apple.developer.ubiquity-container-identifiers</key>
<array>
    <string>iCloud.com.example.app</string>
</array>

<!-- Key-value store (if using) -->
<key>com.apple.developer.ubiquity-kvstore-identifier</key>
<string>$(TeamIdentifierPrefix)com.example.app</string>
```

---

## Common Patterns

### Pattern 1: Document Picker Integration

```swift
// ✅ Present iCloud document picker
import UniformTypeIdentifiers

let picker = UIDocumentPickerViewController(
    forOpeningContentTypes: [.pdf, .plainText]
)
picker.delegate = self
picker.allowsMultipleSelection = false

// Enable iCloud
picker.directoryURL = getICloudContainerURL()

present(picker, animated: true)
```

### Pattern 2: Monitor Directory for Changes

```swift
// ✅ Monitor iCloud directory
class ICloudMonitor {
    let query = NSMetadataQuery()

    func startMonitoring(directory: URL) {
        query.predicate = NSPredicate(format: "%K BEGINSWITH %@",
            NSMetadataItemPathKey, directory.path)

        query.searchScopes = [NSMetadataQueryUbiquitousDataScope]

        NotificationCenter.default.addObserver(
            forName: .NSMetadataQueryDidUpdate,
            object: query,
            queue: .main
        ) { [weak self] _ in
            self?.processResults()
        }

        query.start()
    }

    func processResults() {
        for item in query.results {
            if let metadataItem = item as? NSMetadataItem,
               let url = metadataItem.value(forAttribute: NSMetadataItemURLKey) as? URL {
                print("File: \(url.lastPathComponent)")
            }
        }
    }
}
```

---

## Quick Reference

| Task | API | Notes |
|------|-----|-------|
| Get iCloud URL | `FileManager.default.url(forUbiquityContainerIdentifier:)` | Returns nil if unavailable |
| Check if in iCloud | `.isUbiquitousItemKey` resource value | Bool |
| Download file | `startDownloadingUbiquitousItem(at:)` | Async, monitor with NSMetadataQuery |
| Check download status | `.ubiquitousItemDownloadingStatusKey` | current/notDownloaded/downloaded |
| Check for conflicts | `.ubiquitousItemHasUnresolvedConflictsKey` | Bool |
| Resolve conflicts | `NSFileVersion.unresolvedConflictVersionsOfItem(at:)` | Manual merge or choose version |
| Sync preferences | `NSUbiquitousKeyValueStore.default` | <1 MB total |
| File coordination | `NSFileCoordinator` | **Always** use for iCloud files |

---

## Related Skills

- `axiom-storage` — Choose iCloud Drive vs CloudKit
- `axiom-cloudkit-ref` — For structured data sync
- `axiom-cloud-sync-diag` — Debug iCloud sync issues

---

**Last Updated**: 2025-12-12
**Skill Type**: Reference
**Minimum iOS**: 5.0 (basic), 8.0 (iCloud Drive), 11.0 (modern APIs)
