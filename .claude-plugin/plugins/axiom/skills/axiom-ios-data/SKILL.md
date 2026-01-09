---
name: axiom-ios-data
description: Use when working with ANY data persistence, database, axiom-storage, CloudKit, migration, or serialization. Covers SwiftData, Core Data, GRDB, SQLite, CloudKit sync, file storage, Codable, migrations.
user-invocable: false
---

# iOS Data & Persistence Router

**You MUST use this skill for ANY data persistence, database, axiom-storage, CloudKit, or serialization work.**

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

**Working with SwiftData** → `/skill axiom-swiftdata`
**Schema migration** → `/skill axiom-swiftdata-migration`
**Migration issues** → `/skill axiom-swiftdata-migration-diag`
**Migrating from Realm** → `/skill axiom-realm-migration-ref`
**SwiftData vs SQLiteData** → `/skill axiom-sqlitedata-migration`

### Other Databases

**GRDB queries** → `/skill axiom-grdb`
**SQLiteData** → `/skill axiom-sqlitedata`
**Advanced SQLiteData** → `/skill axiom-sqlitedata-ref`
**Core Data patterns** → `/skill axiom-core-data`
**Core Data issues** → `/skill axiom-core-data-diag`

### Migrations

**Database migration safety** → `/skill axiom-database-migration` (critical - prevents data loss)

### Serialization

**Codable issues** → `/skill axiom-codable`

### Cloud Storage

**Cloud sync patterns** → `/skill axiom-cloud-sync`
**CloudKit** → `/skill axiom-cloudkit-ref`
**iCloud Drive** → `/skill axiom-icloud-drive-ref`
**Cloud sync errors** → `/skill axiom-cloud-sync-diag`

### File Storage

**Storage strategy** → `/skill axiom-storage`
**Storage issues** → `/skill axiom-storage-diag`
**Storage management** → `/skill axiom-storage-management-ref`
**File protection** → `/skill axiom-file-protection-ref`

## Decision Tree

```
User asks about data/storage
  ├─ Database?
  │  ├─ SwiftData? → swiftdata, axiom-swiftdata-migration
  │  ├─ Core Data? → core-data, axiom-core-data-diag
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
  └─ File storage? → storage, axiom-storage-diag, axiom-storage-management-ref
```

## Critical Pattern: Migrations

**ALWAYS invoke `/skill axiom-database-migration` when adding/modifying database columns.**

This prevents:
- "FOREIGN KEY constraint failed" errors
- "no such column" crashes
- Data loss from unsafe migrations

## Example Invocations

User: "I need to add a column to my SwiftData model"
→ Invoke: `/skill axiom-database-migration` (critical - prevents data loss)

User: "How do I query SwiftData with complex filters?"
→ Invoke: `/skill axiom-swiftdata`

User: "CloudKit sync isn't working"
→ Invoke: `/skill axiom-cloud-sync-diag`

User: "Should I use SwiftData or SQLiteData?"
→ Invoke: `/skill axiom-sqlitedata-migration`
