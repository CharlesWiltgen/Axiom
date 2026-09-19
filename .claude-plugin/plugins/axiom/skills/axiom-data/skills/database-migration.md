
# Database Migration

## Overview

Safe database schema evolution for production apps with user data. **Core principle** Migrations are immutable after shipping. Make them additive, idempotent, and thoroughly tested.

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

#### 1. "I need to add a new column to store user preferences, but the app is already live with user data. How do I do this safely?"
→ The skill covers safe additive patterns for adding columns without losing existing data, including idempotency checks

#### 2. "I'm getting 'Cannot add a NOT NULL column with default value NULL' when I try to migrate. What does this mean and how do I fix it?"
→ The skill explains why a NOT NULL column needs a DEFAULT once the table has rows, and shows both fixes (non-NULL DEFAULT, or nullable plus backfill)

#### 3. "I need to change a column from text to integer. Can I just ALTER the column type?"
→ The skill demonstrates the safe pattern: add new column → migrate data → deprecate old (NEVER delete)

#### 4. "I'm adding a foreign key relationship between tables. How do I add the relationship without breaking existing data?"
→ The skill covers both routes: an application-level indexed column, and the table rebuild that gets a declared constraint SQLite will actually enforce

#### 5. "Users are reporting crashes after the last update. I changed a migration but the app is already in production. What do I do?"
→ The skill explains migrations are immutable after shipping; shows how to create a new migration to fix the issue rather than modifying the old one

---

## ⛔ NEVER Do These (Data Loss Risk)

#### These actions DESTROY user data in production

❌ **NEVER use DROP TABLE** with user data
❌ **NEVER modify shipped migrations** (create new one instead)
❌ **NEVER drop a table before copying its rows** into the replacement — the rebuild order is create new → copy → drop old → rename, and it is the supported way to add NOT NULL, CHECK and FOREIGN KEY constraints
❌ **NEVER add NOT NULL column** without DEFAULT value
❌ **NEVER delete columns** without retiring them in code first — `DROP COLUMN` has existed since SQLite 3.35.0, but it refuses PRIMARY KEY, UNIQUE, indexed, CHECK, generated-column and trigger-referenced columns, and the data is gone for that release either way

#### If you're tempted to do any of these, STOP and use the safe patterns below.

## Mandatory Rules

#### ALWAYS follow these

1. **Additive only** Add new columns/tables, never delete
2. **Idempotent** Check existence before creating (safe to run twice)
3. **Transactional** Wrap entire migration in single transaction (GRDB's migrator does). Connection PRAGMAs — `foreign_keys`, `journal_mode` — are set before it opens; inside a transaction `PRAGMA foreign_keys` is silently ignored
4. **Test both paths** Fresh install AND migration from previous version
5. **Nullable first** Add columns as NULL, backfill later if needed
6. **Immutable** Once shipped to users, migrations cannot be changed

## Safe Patterns

### Adding Column (Most Common)

```swift
// ✅ Safe pattern
func migration00X_AddNewColumn() throws {
    try database.write { db in
        // 1. Check if column exists (idempotency)
        let hasColumn = try db.columns(in: "tableName")
            .contains { $0.name == "newColumn" }

        if !hasColumn {
            // 2. Add as nullable (works with existing rows)
            try db.execute(sql: """
                ALTER TABLE tableName
                ADD COLUMN newColumn TEXT
            """)
        }
    }
}
```

#### Why this works
- Nullable columns don't require DEFAULT
- Existing rows get NULL automatically
- No data transformation needed
- Safe for users upgrading from old versions

### Adding Column with Default Value

```swift
// ✅ Safe pattern with default
func migration00X_AddColumnWithDefault() throws {
    try database.write { db in
        let hasColumn = try db.columns(in: "tracks")
            .contains { $0.name == "playCount" }

        if !hasColumn {
            try db.execute(sql: """
                ALTER TABLE tracks
                ADD COLUMN playCount INTEGER DEFAULT 0
            """)
        }
    }
}
```

### Changing Column Type (Advanced)

**Pattern**: Add new column → migrate data → deprecate old (NEVER delete)

```swift
// ✅ Safe pattern for type change
func migration00X_ChangeColumnType() throws {
    try database.write { db in
        // Step 1: Add new column with new type
        try db.execute(sql: """
            ALTER TABLE users
            ADD COLUMN age_new INTEGER
        """)

        // Step 2: Migrate existing data
        try db.execute(sql: """
            UPDATE users
            SET age_new = CAST(age_old AS INTEGER)
            WHERE age_old IS NOT NULL
        """)

        // Step 3: Application code uses age_new going forward
        // (Never delete age_old column - just stop using it)
    }
}
```

### Adding Foreign Key Constraint

SQLite's `ALTER TABLE` has no `ADD CONSTRAINT`, so a constraint can't be attached to a column that already exists.

**When the relationship lives in a new column, add it with its constraint.** `ADD COLUMN … REFERENCES` declares a foreign key SQLite enforces like any other, with no rebuild. With foreign keys on, SQLite requires the new column to default to NULL, so it starts with no orphans; fill it with an `UPDATE`, which the constraint then checks. Rows with no match keep `NULL`.

```sql
ALTER TABLE tracks ADD COLUMN album_id TEXT REFERENCES albums(id) ON DELETE CASCADE;
UPDATE tracks SET album_id = (SELECT id FROM albums WHERE albums.title = tracks.album_name);
```

In GRDB: `t.add(column: "album_id", .text).references("albums", onDelete: .cascade)` inside `db.alter(table:)`.

When the column must be `NOT NULL`, or the constraint belongs on a column that already exists, there are two routes: an indexed column whose relationship the app enforces, or a table rebuild that produces a declared constraint.

#### Route 1 — indexed column, application-level relationship

```swift
// ✅ Safe pattern for foreign keys
func migration00X_AddForeignKey() throws {
    try database.write { db in
        // Step 1: Add new column (nullable initially)
        try db.execute(sql: """
            ALTER TABLE tracks
            ADD COLUMN album_id TEXT
        """)

        // Step 2: Populate the data
        try db.execute(sql: """
            UPDATE tracks
            SET album_id = (
                SELECT id FROM albums
                WHERE albums.title = tracks.album_name
            )
        """)

        // Step 3: Add index (helps query performance)
        try db.execute(sql: """
            CREATE INDEX IF NOT EXISTS idx_tracks_album_id
            ON tracks(album_id)
        """)
    }
}
```

The index is the whole mechanism here, and that is the catch: nothing stops an `album_id` that points at no album. Delete an album and its tracks stay behind as orphans, and `PRAGMA foreign_key_check` prints nothing — there is no constraint for it to check. Referential damage the standard integrity check cannot see is the reason to declare the constraint when the relationship matters.

#### Route 2 — declared constraint, table rebuild

A declared FK — the kind `database-schema-auditor` reports as CRITICAL when it is not enforced — needs SQLite's documented rebuild, in the documented order. Copy before you drop.

```sql
PRAGMA foreign_keys = OFF;   -- outside the transaction: inside one it is a no-op
BEGIN;
CREATE TABLE new_tracks (
    id       TEXT NOT NULL PRIMARY KEY,
    album_id TEXT REFERENCES albums(id)
);
-- LEFT JOIN: a track with no matching album keeps a NULL album_id.
-- An inner JOIN leaves it out of the copy, and DROP TABLE then deletes it.
INSERT INTO new_tracks (id, album_id)
    SELECT t.id, a.id FROM tracks t LEFT JOIN albums a ON a.title = t.album_name;
DROP TABLE tracks;
ALTER TABLE new_tracks RENAME TO tracks;
PRAGMA foreign_key_check;   -- one row per violation; abort before COMMIT if any
COMMIT;
PRAGMA foreign_keys = ON;
```

Carry every column you're keeping in the `INSERT … SELECT` — whatever it leaves out is gone once `DROP TABLE` runs — and compare the row count before and after.

In a GRDB `registerMigration`, run only the `CREATE` / `INSERT` / `DROP` / `ALTER … RENAME` statements. The migrator already owns the transaction, so a second `BEGIN` fails, and its default `foreignKeyChecks: .deferred` runs the migration with foreign keys off and checks them right before committing.

Enforcement is a connection setting, not a schema property: `PRAGMA foreign_keys = ON`, which GRDB sets by default — `Configuration.foreignKeysEnabled` defaults to `true`. Declared but unenforced is the one outcome worth avoiding.

### Complex Schema Refactoring

**Pattern**: Break into multiple migrations

```swift
// Migration 1: Add new structure
func migration010_AddNewTable() throws {
    try database.write { db in
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS new_structure (
                id TEXT NOT NULL PRIMARY KEY,
                data TEXT
            )
        """)
    }
}

// Migration 2: Copy data
func migration011_MigrateData() throws {
    try database.write { db in
        try db.execute(sql: """
            INSERT OR IGNORE INTO new_structure (id, data)
            SELECT id, data FROM old_structure
        """)
    }
}

// Migration 3: Add indexes
func migration012_AddIndexes() throws {
    try database.write { db in
        try db.execute(sql: """
            CREATE INDEX IF NOT EXISTS idx_new_structure_data
            ON new_structure(data)
        """)
    }
}

// Old structure stays around (deprecated in code)
```

## Modern schema choices

When designing new tables (or rewriting old ones during a migration), consider these SQLite 3.37+ features. All are available on Axiom's iOS 18+/macOS 15+ floor.

### STRICT tables

`CREATE TABLE x (...) STRICT;` enforces column types at insert and update time. Six allowed types: `INT`, `INTEGER`, `REAL`, `TEXT`, `BLOB`, `ANY`. Insert a value that can't be losslessly converted to the declared type and SQLite raises `SQLITE_CONSTRAINT_DATATYPE` — behaves like Postgres or MySQL rather than classic SQLite's silent coercion.

```sql
CREATE TABLE track (
    id       INTEGER PRIMARY KEY,
    title    TEXT NOT NULL,
    duration REAL NOT NULL,
    artwork  BLOB
) STRICT;
```

**When to use**

- New tables where type integrity matters
- Especially valuable when your records are Swift `Codable` types that won't survive silent coercion — STRICT catches the schema/Swift drift at the database boundary instead of letting bad data accumulate

**Combinable** `CREATE TABLE x (...) STRICT, WITHOUT ROWID;`

**Backwards compatibility** Databases with STRICT tables won't open on SQLite < 3.37.0.

**`ANY` is a gotcha** In a STRICT table, `ANY` columns store values without coercion — `'000123'` stays TEXT instead of being coerced to INTEGER `123` (which is what would happen in a non-STRICT table). If you need polymorphic storage, this is what you want; if you assumed legacy coercion, surprise.

### Related perf-affecting schema choices

`WITHOUT ROWID` (storage layout for small-row tables with non-integer PKs) and generated columns (indexable computed values) are *performance* concerns rather than migration safety. See `grdb-performance.md` §7 "Schema choices that affect performance" for those — they belong to the same design conversation but the tradeoffs are different.

## Testing Checklist

#### BEFORE deploying any migration

These run against the migrator your app ships — the registrations themselves, not a copy.

```swift
// The migrator under test
func makeMigrator() -> DatabaseMigrator {
    var migrator = DatabaseMigrator()
    migrator.registerMigration("v1") { db in
        try db.execute(sql: "CREATE TABLE tableName (id TEXT NOT NULL PRIMARY KEY)")
    }
    migrator.registerMigration("v2") { db in
        try db.execute(sql: "ALTER TABLE tableName ADD COLUMN newColumn TEXT")
    }
    return migrator
}
```

#### Test 1 — Migration path (CRITICAL, tests data preservation)

```swift
@Test func migrationFromV1ToV2Succeeds() async throws {
    let dbQueue = try DatabaseQueue()
    let migrator = makeMigrator()

    // Simulate a v1 install with real user data
    try migrator.migrate(dbQueue, upTo: "v1")
    try await dbQueue.write { db in
        try db.execute(sql: "INSERT INTO tableName (id) VALUES ('test1')")
    }

    // Run the v2 migration
    try migrator.migrate(dbQueue)

    // Verify data survived + new column exists
    try await dbQueue.read { db in
        let count = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM tableName")
        #expect(count == 1)  // Data preserved

        let columns = try db.columns(in: "tableName").map { $0.name }
        #expect(columns.contains("newColumn"))  // New column exists
    }
}
```

#### Test 2 — Fresh install (run all migrations, verify final schema)
```swift
@Test func freshInstallCreatesCorrectSchema() async throws {
    let dbQueue = try DatabaseQueue()
    let migrator = makeMigrator()

    // Run all migrations from empty
    try migrator.migrate(dbQueue)

    // Verify final schema
    try await dbQueue.read { db in
        let hasTable = try db.tableExists("tableName")
        #expect(hasTable)

        let columns = try db.columns(in: "tableName").map { $0.name }
        #expect(columns.contains("id"))
        #expect(columns.contains("newColumn"))
    }
}
```

#### Test 3 — Idempotency (run migrations twice, should not throw)
```swift
@Test func migrationsAreIdempotent() async throws {
    let dbQueue = try DatabaseQueue()
    let migrator = makeMigrator()

    // Run migrations twice
    try migrator.migrate(dbQueue)
    try migrator.migrate(dbQueue)  // Should not throw

    // Verify still correct
    try await dbQueue.read { db in
        let count = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM tableName")
        #expect(count == 0)  // No duplicate data
    }
}
```

#### Manual testing (before TestFlight)
1. Install v(n-1) build on device → add real user data
2. Install v(n) build (with new migration)
3. Verify: App launches, data visible, no crashes

## Decision Tree

```
What are you trying to do?
├─ Add new column?
│  └─ ALTER TABLE ADD COLUMN (nullable) → Done
├─ Add column with default?
│  └─ ALTER TABLE ADD COLUMN ... DEFAULT value → Done
├─ Change column type?
│  └─ Add new column → Migrate data → Deprecate old → Done
├─ Delete column?
│  └─ Retire in code first → DROP COLUMN once nothing else references it → Done
├─ Rename column?
│  └─ Add new column → Migrate data → Deprecate old → Done
├─ Add foreign key?
│  ├─ New nullable column? → ADD COLUMN … REFERENCES → Populate with UPDATE → Done
│  ├─ App-level relationship? → Add column → Populate data → Add index → Done
│  └─ Declared constraint on an existing or NOT NULL column? → Rebuild the table (create new → copy → drop old → rename) → Done
└─ Complex refactor?
   └─ Break into multiple migrations → Test each step → Done
```

## Common Errors

| Error | Fix |
|-------|-----|
| `FOREIGN KEY constraint failed` | Parent row is missing, or a declared FK is now being enforced. `PRAGMA foreign_keys` is a no-op inside a transaction — use `PRAGMA defer_foreign_keys = ON` (scoped to the current transaction) or GRDB's `registerMigration(_:foreignKeyChecks:)`, and set `PRAGMA foreign_keys` before `BEGIN` |
| `no such column: columnName` | Add migration to create column |
| `Cannot add a NOT NULL column with default value NULL` | Give the column a non-NULL `DEFAULT`, or add it nullable and backfill in a second migration |
| `table tableName already exists` | Add `IF NOT EXISTS` clause |
| `duplicate column name` | Check if column exists before adding (idempotency) |

## Common Mistakes

❌ **Adding NOT NULL without DEFAULT**
```sql
-- ❌ Fails the moment the table has rows
ALTER TABLE albums ADD COLUMN rating INTEGER NOT NULL;
```

✅ **Correct: nullable first**
```sql
-- ✅ Existing rows stay NULL until a later migration backfills
ALTER TABLE albums ADD COLUMN rating INTEGER;
UPDATE albums SET rating = 0 WHERE rating IS NULL;
```

A `DEFAULT` also satisfies the constraint in one step — `ADD COLUMN rating INTEGER NOT NULL DEFAULT 0` — but every existing row gets `0`, so nullable plus an explicit backfill is what you want whenever "never set" differs from "set to the default".

❌ **Forgetting to check for existence** — `IF NOT EXISTS` exists for `CREATE TABLE` and `CREATE INDEX`; `ALTER TABLE ADD COLUMN` has no such clause, so guard it with the `db.columns(in:)` check

❌ **Modifying shipped migrations** — Create new migration instead

❌ **Not testing migration path** — Always test upgrade from previous version

## GRDB-Specific Patterns

### DatabaseMigrator Setup

```swift
var migrator = DatabaseMigrator()

// Migration 1
migrator.registerMigration("v1") { db in
    try db.execute(sql: """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT NOT NULL PRIMARY KEY,
            name TEXT NOT NULL
        )
    """)
}

// Migration 2
migrator.registerMigration("v2") { db in
    let hasColumn = try db.columns(in: "users")
        .contains { $0.name == "email" }

    if !hasColumn {
        try db.execute(sql: """
            ALTER TABLE users
            ADD COLUMN email TEXT
        """)
    }
}

// Apply migrations
try migrator.migrate(dbQueue)
```

### Checking Migration Status

```swift
// Check which migrations have been applied
let appliedMigrations = try dbQueue.read { db in
    try migrator.appliedMigrations(db)
}
print("Applied migrations: \(appliedMigrations)")

// Check whether every registered migration has run
let hasCompletedMigrations = try dbQueue.read { db in
    try migrator.hasCompletedMigrations(db)
}
```

## SwiftData Migrations

For SwiftData (iOS 17+), use `VersionedSchema` and `SchemaMigrationPlan`:

```swift
// Define schema versions
enum MyAppSchemaV1: VersionedSchema {
    static let versionIdentifier = Schema.Version(1, 0, 0)
    static var models: [any PersistentModel.Type] {
        [Track.self, Album.self]
    }
}

enum MyAppSchemaV2: VersionedSchema {
    static let versionIdentifier = Schema.Version(2, 0, 0)
    static var models: [any PersistentModel.Type] {
        [Track.self, Album.self, Playlist.self]  // Added Playlist
    }
}

// Define migration plan
enum MyAppMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [MyAppSchemaV1.self, MyAppSchemaV2.self]
    }

    static var stages: [MigrationStage] {
        [migrateV1toV2]
    }

    static let migrateV1toV2 = MigrationStage.custom(
        fromVersion: MyAppSchemaV1.self,
        toVersion: MyAppSchemaV2.self,
        willMigrate: nil,
        didMigrate: { context in
            // Custom migration logic here
        }
    )
}
```

## Real-World Impact

**Before** Developer adds NOT NULL column → migration fails for 50% of users → emergency rollback → data inconsistency

**After** Developer adds nullable column → tests both paths → smooth deployment → backfills data in v2

**Key insight** Migrations can't be rolled back in production. Get them right the first time through thorough testing.

## tvOS

**tvOS migrations may run against a fresh database.** Every local directory is purgeable between launches, so your app may launch with no database at all. Migrations must handle this gracefully — they effectively become both "create" and "upgrade" operations.

**Key implications**:
- Migrations must be idempotent (already a best practice, but critical here)
- Don't assume previous data exists for backfill operations
- Test the "fresh install" path as often as the "upgrade" path

See axiom-swift (skills/tvos.md) for full tvOS storage constraints.

---

**Frameworks**: SQLite, GRDB, SwiftData
