---
name: axiom-data
description: Use when working with ANY data persistence, database, storage, CloudKit, migration, or serialization. Covers SwiftData, Core Data, GRDB, SQLite, CloudKit sync, file storage, Codable, migrations.
license: MIT
---

# Data & Persistence

**You MUST use this skill for ANY data persistence, database, storage, CloudKit, or serialization work.**

## When to Use

Use this skill when working with:
- Databases (SwiftData, Core Data, GRDB, SQLiteData)
- Schema migrations
- CloudKit sync
- File storage (iCloud Drive, local storage)
- Data serialization (Codable, JSON)
- Storage strategy decisions
- Keychain / secure credential storage
- Encryption, signing, key management (CryptoKit)

## Quick Reference

| Symptom / Task | Reference |
|----------------|-----------|
| SwiftData @Model, @Query, ModelContext | See `skills/swiftdata.md` |
| SwiftData schema migration, VersionedSchema | See `skills/swiftdata-migration.md` |
| SwiftData migration crashes, data loss | See `skills/swiftdata-migration-diag.md` |
| Migrating from Realm to SwiftData | See `skills/realm-migration-ref.md` |
| SwiftData vs SQLiteData decision | See `skills/sqlitedata-migration.md` |
| GRDB queries, ValueObservation, DatabaseMigrator | See `skills/grdb.md` |
| SQLiteData @Table, CRUD, SyncEngine | See `skills/sqlitedata.md` |
| SQLiteData advanced patterns, CTEs, views | See `skills/sqlitedata-ref.md` |
| Core Data stack, relationships, concurrency | See `skills/core-data.md` |
| Core Data migration crashes, thread errors | See `skills/core-data-diag.md` |
| ANY schema migration safety | See `skills/database-migration.md` |
| Codable, JSON encoding/decoding | See `skills/codable.md` |
| Cloud sync architecture, offline-first | See `skills/cloud-sync.md` |
| CloudKit, CKSyncEngine, CKRecord | See `skills/cloudkit-ref.md` |
| iCloud Drive, ubiquitous containers | See `skills/icloud-drive-ref.md` |
| Cloud sync errors, conflict resolution | See `skills/cloud-sync-diag.md` |
| Storage strategy, where to store data | See `skills/storage.md` |
| Storage issues, files disappeared | See `skills/storage-diag.md` |
| Storage management, disk pressure | See `skills/storage-management-ref.md` |
| Keychain / secure credential storage | See axiom-security (skills/keychain.md) |
| Keychain errors (errSecDuplicateItem) | See axiom-security (skills/keychain-diag.md) |
| Keychain API reference | See axiom-security (skills/keychain-ref.md) |
| Encryption / signing / key management | See axiom-security (skills/cryptokit.md) |
| CryptoKit API reference | See axiom-security (skills/cryptokit-ref.md) |
| File protection, NSFileProtection | See axiom-security (skills/file-protection-ref.md) |
| tvOS data persistence (no local storage) | See axiom-swift (skills/tvos.md) |
| tvOS + CloudKit SyncEngine | See `skills/sqlitedata.md` |

### Automated Scanning

**Core Data audit** → Launch `core-data-auditor` agent or `/axiom:audit core-data` (safety violations, architectural gaps — migration options, thread-confinement, N+1 queries, merge policies, context isolation)
**Codable audit** → Launch `codable-auditor` agent or `/axiom:audit codable` (try? swallowing errors, JSONSerialization, date handling)
**iCloud audit** → Launch `icloud-auditor` agent or `/axiom:audit icloud` (entitlement checks, file coordination, CloudKit anti-patterns)
**Storage audit** → Launch `storage-auditor` agent or `/axiom:audit storage` (wrong file locations, missing backup exclusions, data loss risks)
**Database schema audit** → Launch `database-schema-auditor` agent or `/axiom:audit database-schema` (unsafe ALTER TABLE, DROP operations, missing idempotency, foreign key misuse)
**SwiftData audit** → Launch `swiftdata-auditor` agent or `/axiom:audit swiftdata` (struct models, missing VersionedSchema, relationship defaults, background context misuse, N+1 patterns)

## Decision Tree

1. SwiftData? → `skills/swiftdata.md`, `skills/swiftdata-migration.md`
2. Core Data? → `skills/core-data.md`, `skills/core-data-diag.md`
3. GRDB? → `skills/grdb.md`
4. SQLiteData? → `skills/sqlitedata.md`, `skills/sqlitedata-ref.md`
5. ANY schema migration? → `skills/database-migration.md` (ALWAYS — prevents data loss)
6. Realm migration? → `skills/realm-migration-ref.md`
7. SwiftData vs SQLiteData? → `skills/sqlitedata-migration.md`
8. Cloud sync architecture? → `skills/cloud-sync.md`
9. CloudKit? → `skills/cloudkit-ref.md`
10. iCloud Drive? → `skills/icloud-drive-ref.md`
11. Cloud sync errors? → `skills/cloud-sync-diag.md`
12. Codable/JSON serialization? → `skills/codable.md`
13. File storage strategy? → `skills/storage.md`, `skills/storage-diag.md`, `skills/storage-management-ref.md`
14. File protection? → See axiom-security (skills/file-protection-ref.md)
15. Keychain / storing tokens, passwords, secrets securely? → See axiom-security (skills/keychain.md), See axiom-security (skills/keychain-diag.md), See axiom-security (skills/keychain-ref.md)
16. SecItem errors (errSecDuplicateItem, errSecItemNotFound, errSecInteractionNotAllowed)? → See axiom-security (skills/keychain-diag.md)
17. Encryption, signing, Secure Enclave, CryptoKit? → See axiom-security (skills/cryptokit.md), See axiom-security (skills/cryptokit-ref.md)
18. Quantum-secure cryptography, HPKE, ML-KEM? → See axiom-security (skills/cryptokit.md)
19. Want Core Data safety scan? → core-data-auditor (Agent)
20. Want Codable anti-pattern scan? → codable-auditor (Agent)
21. Want iCloud sync audit? → icloud-auditor (Agent)
22. Want storage location audit? → storage-auditor (Agent)
23. Want database schema/migration safety scan? → database-schema-auditor (Agent)
24. Want SwiftData code audit? → swiftdata-auditor (Agent)
25. tvOS data persistence? → See axiom-swift (skills/tvos.md) (CRITICAL: no persistent local storage) + `skills/sqlitedata.md` (CloudKit SyncEngine)
26. SwiftData @MainActor / background context threading? → `/skill axiom-concurrency`
27. Structured data generation with Foundation Models? → `/skill axiom-ai`

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Just adding a column, no migration needed" | Schema changes without migration crash users. database-migration prevents data loss. |
| "I'll handle the migration manually" | Manual migrations miss edge cases. database-migration covers rollback and testing. |
| "Simple query, I don't need the skill" | Query patterns prevent N+1 and thread-safety issues. The skill has copy-paste solutions. |
| "CloudKit sync is straightforward" | CloudKit has 15+ failure modes. cloud-sync-diag diagnoses them systematically. |
| "I know Codable well enough" | Codable has silent data loss traps (try? swallows errors). codable skill prevents production bugs. |
| "I'll use local storage on tvOS" | tvOS has NO persistent local storage. System deletes Caches at any time. See axiom-swift (skills/tvos.md) for the iCloud-first pattern. |
| "UserDefaults is fine for this token" | UserDefaults is unencrypted, backed up to iCloud, and visible to MDM profiles. One audit catches it. keychain stores tokens securely. |
| "I'll encrypt it myself with CommonCrypto" | CryptoKit replaced CommonCrypto's buffer-management nightmares with one-line APIs. cryptokit prevents misuse. |

## Critical Pattern: Migrations

**ALWAYS read `skills/database-migration.md` when adding/modifying database columns.**

This prevents:
- "FOREIGN KEY constraint failed" errors
- "no such column" crashes
- Data loss from unsafe migrations

## Example Invocations

User: "I need to add a column to my SwiftData model"
→ Read: `skills/database-migration.md` (critical - prevents data loss)

User: "How do I query SwiftData with complex filters?"
→ Read: `skills/swiftdata.md`

User: "CloudKit sync isn't working"
→ Read: `skills/cloud-sync-diag.md`

User: "Should I use SwiftData or SQLiteData?"
→ Read: `skills/sqlitedata-migration.md`

User: "Check my Core Data code for safety issues"
→ Launch: `core-data-auditor` agent

User: "Scan for Codable anti-patterns before release"
→ Launch: `codable-auditor` agent

User: "Audit my iCloud sync implementation"
→ Launch: `icloud-auditor` agent

User: "Check if my files are stored in the right locations"
→ Launch: `storage-auditor` agent

User: "Audit my database migrations for safety"
→ Launch: `database-schema-auditor` agent

User: "Check my SwiftData models for issues"
→ Launch: `swiftdata-auditor` agent

User: "How do I persist data on tvOS?"
→ Invoke: See axiom-swift (skills/tvos.md) + Read: `skills/sqlitedata.md`

User: "My tvOS app loses data between launches"
→ Invoke: See axiom-swift (skills/tvos.md)

User: "How do I store an auth token securely?"
→ Invoke: See axiom-security (skills/keychain.md)

User: "errSecDuplicateItem but I checked and the item doesn't exist"
→ Invoke: See axiom-security (skills/keychain-diag.md)

User: "How do I encrypt data with AES in Swift?"
→ Invoke: See axiom-security (skills/cryptokit.md)

User: "I need to sign data with the Secure Enclave"
→ Invoke: See axiom-security (skills/cryptokit.md)

User: "What's ML-KEM and should I use it?"
→ Invoke: See axiom-security (skills/cryptokit.md)
