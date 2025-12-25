---
name: ios-data
description: Use when working with ANY data persistence, database, storage, CloudKit, migration, or serialization. Covers SwiftData, Core Data, GRDB, SQLite, CloudKit sync, file storage, Codable, migrations.
---

# iOS Data & Persistence Router

**You MUST use this skill for ANY data persistence, database, storage, CloudKit, or serialization work.**

## When to Use

Use this router when working with:
- Databases (SwiftData, Core Data, GRDB, SQLiteData)
- Schema migrations
- CloudKit sync
- File storage (iCloud Drive, local storage)
- Data serialization (Codable, JSON)
- Storage strategy decisions

## Routing Logic

### SwiftData

**Working with SwiftData** → `/skill swiftdata`
**Schema migration** → `/skill swiftdata-migration`
**Migration issues** → `/skill swiftdata-migration-diag`
**Migrating from Realm** → `/skill realm-migration-ref`
**SwiftData vs SQLiteData** → `/skill sqlitedata-migration`

### Other Databases

**GRDB queries** → `/skill grdb`
**SQLiteData** → `/skill sqlitedata`
**Advanced SQLiteData** → `/skill sqlitedata-ref`
**Core Data patterns** → `/skill core-data`
**Core Data issues** → `/skill core-data-diag`

### Migrations

**Database migration safety** → `/skill database-migration` (critical - prevents data loss)

### Serialization

**Codable issues** → `/skill codable`

### Cloud Storage

**Cloud sync patterns** → `/skill cloud-sync`
**CloudKit** → `/skill cloudkit-ref`
**iCloud Drive** → `/skill icloud-drive-ref`
**Cloud sync errors** → `/skill cloud-sync-diag`

### File Storage

**Storage strategy** → `/skill storage`
**Storage issues** → `/skill storage-diag`
**Storage management** → `/skill storage-management-ref`
**File protection** → `/skill file-protection-ref`

## Decision Tree

```
User asks about data/storage
  ├─ Database?
  │  ├─ SwiftData? → swiftdata, swiftdata-migration
  │  ├─ Core Data? → core-data, core-data-diag
  │  ├─ GRDB? → grdb
  │  └─ SQLiteData? → sqlitedata
  │
  ├─ Migration? → database-migration (ALWAYS - prevents data loss)
  │
  ├─ Cloud storage?
  │  ├─ Sync architecture? → cloud-sync
  │  ├─ CloudKit? → cloudkit-ref
  │  ├─ iCloud Drive? → icloud-drive-ref
  │  └─ Sync errors? → cloud-sync-diag
  │
  ├─ Serialization? → codable
  │
  └─ File storage? → storage, storage-diag, storage-management-ref
```

## Critical Pattern: Migrations

**ALWAYS invoke `/skill database-migration` when adding/modifying database columns.**

This prevents:
- "FOREIGN KEY constraint failed" errors
- "no such column" crashes
- Data loss from unsafe migrations

## Example Invocations

User: "I need to add a column to my SwiftData model"
→ Invoke: `/skill database-migration` (critical - prevents data loss)

User: "How do I query SwiftData with complex filters?"
→ Invoke: `/skill swiftdata`

User: "CloudKit sync isn't working"
→ Invoke: `/skill cloud-sync-diag`

User: "Should I use SwiftData or SQLiteData?"
→ Invoke: `/skill sqlitedata-migration`
