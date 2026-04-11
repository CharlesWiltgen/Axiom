---
name: axiom-data
description: Use when working with ANY data persistence, database, axiom-storage, CloudKit, migration, or serialization. Covers SwiftData, Core Data, GRDB, SQLite, CloudKit sync, file storage, Codable, migrations.
license: MIT
---

# Data & Persistence

**You MUST use this skill for ANY data persistence, database, axiom-storage, CloudKit, or serialization work.**

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
| SwiftData @Model, @Query, ModelContext | See `references/swiftdata.md` |
| SwiftData schema migration, VersionedSchema | See `references/swiftdata-migration.md` |
| SwiftData migration crashes, data loss | See `references/swiftdata-migration-diag.md` |
| Migrating from Realm to SwiftData | See `references/realm-migration-ref.md` |
| SwiftData vs SQLiteData decision | See `references/sqlitedata-migration.md` |
| GRDB queries, ValueObservation, DatabaseMigrator | See `references/grdb.md` |
| SQLiteData @Table, CRUD, SyncEngine | See `references/sqlitedata.md` |
| SQLiteData advanced patterns, CTEs, views | See `references/sqlitedata-ref.md` |
| Core Data stack, relationships, concurrency | See `references/core-data.md` |
| Core Data migration crashes, thread errors | See `references/core-data-diag.md` |
| ANY schema migration safety | See `references/database-migration.md` |
| Codable, JSON encoding/decoding | See `references/codable.md` |
| Cloud sync architecture, offline-first | See `references/cloud-sync.md` |
| CloudKit, CKSyncEngine, CKRecord | See `references/cloudkit-ref.md` |
| iCloud Drive, ubiquitous containers | See `references/icloud-drive-ref.md` |
| Cloud sync errors, conflict resolution | See `references/cloud-sync-diag.md` |
| Storage strategy, where to store data | See `references/storage.md` |
| Storage issues, files disappeared | See `references/storage-diag.md` |
| Storage management, disk pressure | See `references/storage-management-ref.md` |
| Keychain / secure credential storage | See axiom-security (references/keychain.md) |
| Keychain errors (errSecDuplicateItem) | See axiom-security (references/keychain-diag.md) |
| Keychain API reference | See axiom-security (references/keychain-ref.md) |
| Encryption / signing / key management | See axiom-security (references/cryptokit.md) |
| CryptoKit API reference | See axiom-security (references/cryptokit-ref.md) |
| File protection, NSFileProtection | See axiom-security (references/file-protection-ref.md) |
| tvOS data persistence (no local storage) | See axiom-swift (references/tvos.md) |
| tvOS + CloudKit SyncEngine | See `references/sqlitedata.md` |

### Automated Scanning

**Core Data audit** → Launch `core-data-auditor` agent or `/axiom:audit core-data` (migration risks, thread-confinement, N+1 queries, production data loss)
**Codable audit** → Launch `codable-auditor` agent or `/axiom:audit codable` (try? swallowing errors, JSONSerialization, date handling)
**iCloud audit** → Launch `icloud-auditor` agent or `/axiom:audit icloud` (entitlement checks, file coordination, CloudKit anti-patterns)
**Storage audit** → Launch `storage-auditor` agent or `/axiom:audit storage` (wrong file locations, missing backup exclusions, data loss risks)
**Database schema audit** → Launch `database-schema-auditor` agent or `/axiom:audit database-schema` (unsafe ALTER TABLE, DROP operations, missing idempotency, foreign key misuse)
**SwiftData audit** → Launch `swiftdata-auditor` agent or `/axiom:audit swiftdata` (struct models, missing VersionedSchema, relationship defaults, background context misuse, N+1 patterns)

## Decision Tree

1. SwiftData? → `references/swiftdata.md`, `references/swiftdata-migration.md`
2. Core Data? → `references/core-data.md`, `references/core-data-diag.md`
3. GRDB? → `references/grdb.md`
4. SQLiteData? → `references/sqlitedata.md`, `references/sqlitedata-ref.md`
5. ANY schema migration? → `references/database-migration.md` (ALWAYS — prevents data loss)
6. Realm migration? → `references/realm-migration-ref.md`
7. SwiftData vs SQLiteData? → `references/sqlitedata-migration.md`
8. Cloud sync architecture? → `references/cloud-sync.md`
9. CloudKit? → `references/cloudkit-ref.md`
10. iCloud Drive? → `references/icloud-drive-ref.md`
11. Cloud sync errors? → `references/cloud-sync-diag.md`
12. Codable/JSON serialization? → `references/codable.md`
13. File storage strategy? → `references/storage.md`, `references/storage-diag.md`, `references/storage-management-ref.md`
14. File protection? → See axiom-security (references/file-protection-ref.md)
15. Keychain / storing tokens, passwords, secrets securely? → See axiom-security (references/keychain.md), See axiom-security (references/keychain-diag.md), See axiom-security (references/keychain-ref.md)
16. SecItem errors (errSecDuplicateItem, errSecItemNotFound, errSecInteractionNotAllowed)? → See axiom-security (references/keychain-diag.md)
17. Encryption, signing, Secure Enclave, CryptoKit? → See axiom-security (references/cryptokit.md), See axiom-security (references/cryptokit-ref.md)
18. Quantum-secure cryptography, HPKE, ML-KEM? → See axiom-security (references/cryptokit.md)
19. Want Core Data safety scan? → core-data-auditor (Agent)
20. Want Codable anti-pattern scan? → codable-auditor (Agent)
21. Want iCloud sync audit? → icloud-auditor (Agent)
22. Want storage location audit? → storage-auditor (Agent)
23. Want database schema/migration safety scan? → database-schema-auditor (Agent)
24. Want SwiftData code audit? → swiftdata-auditor (Agent)
25. tvOS data persistence? → See axiom-swift (references/tvos.md) (CRITICAL: no persistent local storage) + `references/sqlitedata.md` (CloudKit SyncEngine)

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Just adding a column, no migration needed" | Schema changes without migration crash users. database-migration prevents data loss. |
| "I'll handle the migration manually" | Manual migrations miss edge cases. database-migration covers rollback and testing. |
| "Simple query, I don't need the skill" | Query patterns prevent N+1 and thread-safety issues. The skill has copy-paste solutions. |
| "CloudKit sync is straightforward" | CloudKit has 15+ failure modes. cloud-sync-diag diagnoses them systematically. |
| "I know Codable well enough" | Codable has silent data loss traps (try? swallows errors). codable skill prevents production bugs. |
| "I'll use local storage on tvOS" | tvOS has NO persistent local storage. System deletes Caches at any time. axiom-tvos explains the iCloud-first pattern. |
| "UserDefaults is fine for this token" | UserDefaults is unencrypted, backed up to iCloud, and visible to MDM profiles. One audit catches it. keychain stores tokens securely. |
| "I'll encrypt it myself with CommonCrypto" | CryptoKit replaced CommonCrypto's buffer-management nightmares with one-line APIs. cryptokit prevents misuse. |

## Critical Pattern: Migrations

**ALWAYS read `references/database-migration.md` when adding/modifying database columns.**

This prevents:
- "FOREIGN KEY constraint failed" errors
- "no such column" crashes
- Data loss from unsafe migrations

## Example Invocations

User: "I need to add a column to my SwiftData model"
→ Read: `references/database-migration.md` (critical - prevents data loss)

User: "How do I query SwiftData with complex filters?"
→ Read: `references/swiftdata.md`

User: "CloudKit sync isn't working"
→ Read: `references/cloud-sync-diag.md`

User: "Should I use SwiftData or SQLiteData?"
→ Read: `references/sqlitedata-migration.md`

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
→ Invoke: See axiom-swift (references/tvos.md) + Read: `references/sqlitedata.md`

User: "My tvOS app loses data between launches"
→ Invoke: See axiom-swift (references/tvos.md)

User: "How do I store an auth token securely?"
→ Invoke: See axiom-security (references/keychain.md)

User: "errSecDuplicateItem but I checked and the item doesn't exist"
→ Invoke: See axiom-security (references/keychain-diag.md)

User: "How do I encrypt data with AES in Swift?"
→ Invoke: See axiom-security (references/cryptokit.md)

User: "I need to sign data with the Secure Enclave"
→ Invoke: See axiom-security (references/cryptokit.md)

User: "What's ML-KEM and should I use it?"
→ Invoke: See axiom-security (references/cryptokit.md)
