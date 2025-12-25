---
name: storage
description: Complete decision framework for iOS storage — database vs files, local vs cloud, specific locations
---

# Storage Guide

Navigation hub for ALL storage decisions — where to store data, which technology to use, local vs cloud.

## Overview

Comprehensive decision framework integrating SwiftData (WWDC 2023), CKSyncEngine (WWDC 2023), file management, and cloud sync. Guides developers to the right storage solution based on data shape and requirements.

## What This Skill Covers

### Storage Decision Framework

#### Structured Data Path
- Modern apps (iOS 17+) → SwiftData
- Advanced control → SQLiteData/GRDB
- Legacy apps → Core Data
- Cloud sync → SwiftData + CloudKit or CKSyncEngine

#### File Storage Path
- User-created content → Documents/
- App data (not visible) → Application Support/
- Re-downloadable → Caches/
- Temporary → tmp/

#### Cloud Storage Path
- Structured data → CloudKit (via SwiftData or CKSyncEngine)
- Files → iCloud Drive (ubiquitous containers)
- Small preferences → NSUbiquitousKeyValueStore

### Cross-References

**Database Skills**:
- `swiftdata` — Modern persistence (iOS 17+)
- `sqlitedata` — Advanced SQLite control
- `grdb` — Reactive queries, migrations

**File Skills**:
- `file-protection-ref` — Encryption, security
- `storage-management-ref` — Purging, disk space
- `storage-diag` — Debug file issues

**Cloud Skills**:
- `cloudkit-ref` — Database sync
- `icloud-drive-ref` — File sync
- `cloud-sync-diag` — Debug sync issues

## Common Patterns

### Pattern: Choosing Storage Format

```
What are you storing?

STRUCTURED DATA (queryable, relationships)
→ SwiftData (modern, iOS 17+)
→ See: swiftdata skill

FILES (documents, images, caches)
→ FileManager + proper directory
→ See: file-protection-ref, storage-management-ref
```

### Pattern: Local vs Cloud

```
Needs to sync across devices?

NO → Local storage
YES → Cloud storage
  - Structured data? → CloudKit (cloudkit-ref)
  - Files? → iCloud Drive (icloud-drive-ref)
```

### Anti-Pattern: Wrong Format

```
❌ WRONG: JSON files for queryable data
→ Can't query, filter, or sort efficiently
→ FIX: Use SwiftData instead

❌ WRONG: Re-downloadable content in Documents/
→ Bloats backup
→ FIX: Use Caches/ with isExcludedFromBackup
```

## Quick Decision Table

| Data Type | Format | Local Location | Cloud | Related Skill |
|-----------|--------|----------------|-------|---------------|
| User tasks | Structured | App Support | SwiftData + CloudKit | swiftdata, cloudkit-ref |
| User photos | File | Documents | iCloud Drive | file-protection-ref, icloud-drive-ref |
| Downloaded images | File | Caches | None | storage-management-ref |
| Thumbnails | File | Caches | None | storage-management-ref |
| Preferences | Key-Value | UserDefaults | NSUbiquitousKVStore | N/A |

## Use This Skill When

- Starting new project (choosing storage approach)
- Asking "where should I store this data?"
- Deciding between SwiftData, files, or cloud
- Planning data architecture
- Migrating storage solutions

**Related**: Getting Started guide, swiftdata, cloudkit-ref, file-protection-ref
