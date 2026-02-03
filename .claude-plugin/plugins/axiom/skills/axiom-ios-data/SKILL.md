---
name: axiom-ios-data
description: Use when working with ANY data persistence, database, axiom-storage, CloudKit, migration, or serialization. Covers SwiftData, Core Data, GRDB, SQLite, CloudKit sync, file storage, Codable, migrations.
license: MIT
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

1. SwiftData? → swiftdata, swiftdata-migration
2. Core Data? → core-data, core-data-diag
3. GRDB? → grdb
4. SQLiteData? → sqlitedata, sqlitedata-ref
5. ANY schema migration? → database-migration (ALWAYS — prevents data loss)
6. Realm migration? → realm-migration-ref
7. SwiftData vs SQLiteData? → sqlitedata-migration
8. Cloud sync architecture? → cloud-sync
9. CloudKit? → cloudkit-ref
10. iCloud Drive? → icloud-drive-ref
11. Cloud sync errors? → cloud-sync-diag
12. Codable/JSON serialization? → codable
13. File storage strategy? → storage, storage-diag, storage-management-ref
14. File protection? → file-protection-ref

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Just adding a column, no migration needed" | Schema changes without migration crash users. database-migration prevents data loss. |
| "I'll handle the migration manually" | Manual migrations miss edge cases. database-migration covers rollback and testing. |
| "Simple query, I don't need the skill" | Query patterns prevent N+1 and thread-safety issues. The skill has copy-paste solutions. |
| "CloudKit sync is straightforward" | CloudKit has 15+ failure modes. cloud-sync-diag diagnoses them systematically. |
| "I know Codable well enough" | Codable has silent data loss traps (try? swallows errors). codable skill prevents production bugs. |

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
