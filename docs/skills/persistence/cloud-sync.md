# cloud-sync

Choosing between CloudKit and iCloud Drive, implementing reliable offline-first sync, and handling conflicts gracefully.

## When to Use

- Choosing between CloudKit vs iCloud Drive
- Implementing reliable sync for structured data
- Setting up offline-first architecture
- Handling sync conflicts
- Designing sync state indicators

## Key Features

### Quick Decision Tree
- **Structured data** (records, relationships) → CloudKit
- **Files/documents** (visible in Files app) → iCloud Drive
- **Large binary blobs** with structured data → CKAsset
- **Simple settings** → NSUbiquitousKeyValueStore

### Offline-First Pattern
- Write to LOCAL first, sync to cloud in background
- Never block UI on network operations
- Show sync state indicators (synced/pending/conflict/offline)

### Conflict Resolution Strategies
1. **Last-Writer-Wins** — Simplest, accept server version
2. **Merge** — Combine changes from both versions
3. **User Choice** — Present conflict for critical data

### Three Modern Approaches (CloudKit)
1. **SwiftData + CloudKit** — Easiest, automatic, iOS 17+
2. **CKSyncEngine** — Custom persistence, iOS 17+
3. **Raw CloudKit APIs** — Maximum control

## Quick Reference

```swift
// Offline-first: Always write locally first
func save(_ item: Item) async throws {
    try await localStore.save(item)           // Instant
    syncEngine.queueForSync(item.recordID)    // Background
}

// Read locally (instant, works offline)
func fetch() async throws -> [Item] {
    return try await localStore.fetchAll()
}
```

## Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Cloud-first saves | Blocks on network, fails offline | Local-first architecture |
| No sync state | Users don't know if data saved | Show sync indicators |
| Ignoring conflicts | Silent data loss | Implement conflict resolution |
| Single retry | Network is unreliable | Exponential backoff |

## Related

- **cloudkit-ref** — Complete CloudKit API reference
- **icloud-drive-ref** — File-based sync patterns
- **cloud-sync-diag** — Debugging sync failures
- **storage** — Choosing local storage location

## Resources

- [WWDC 2023: Build better document-based apps](https://developer.apple.com/videos/play/wwdc2023/10034/)
- [WWDC 2023: Meet CKSyncEngine](https://developer.apple.com/videos/play/wwdc2023/10188/)
