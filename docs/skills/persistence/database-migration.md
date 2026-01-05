---
name: database-migration
description: Use when adding/modifying database columns, encountering "FOREIGN KEY constraint failed", "no such column", "cannot add NOT NULL column" errors, or creating schema migrations for SQLite/GRDB/SQLiteData — prevents data loss with safe migration patterns and testing workflows for iOS/macOS apps
---

# Database Migration

Safe database schema evolution for production apps with user data. Prevents data loss with additive, idempotent migration patterns.

## When to Use This Skill

Use this skill when you're:
- Adding new columns to existing tables
- Modifying column types or constraints
- Getting "FOREIGN KEY constraint failed" errors
- Getting "no such column" errors
- Getting "cannot add NOT NULL column" errors
- Adding relationships between tables
- Planning schema migrations before release

**Core principle:** Migrations are immutable after shipping. Make them additive and idempotent.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "I need to add a new column but the app is live with user data. How do I do this safely?"
- "I'm getting 'cannot add NOT NULL column' errors. What's wrong?"
- "I need to change a column from text to integer. Can I just ALTER the column type?"
- "How do I add a foreign key without breaking existing data?"
- "Users are crashing after update. I changed a migration but it's already in production."
- "How do I test migrations before shipping?"
- "What's the safe pattern for renaming a column?"

## What's Covered

### Critical Rules (Data Loss Prevention)

**NEVER do these with user data:**
- ❌ DROP TABLE
- ❌ Modify shipped migrations (create new one)
- ❌ Recreate tables to change schema
- ❌ Add NOT NULL column without DEFAULT
- ❌ Delete columns (SQLite limitation)

### Safe Patterns
- Adding nullable columns
- Adding columns with defaults
- Type migration (new column → migrate → deprecate)
- Foreign key addition sequence
- Index creation

### Testing Workflows
- Pre-flight migration testing
- Rollback strategies
- Version compatibility testing

### Framework-Specific
- GRDB DatabaseMigrator patterns
- SQLiteData @Column migrations
- SwiftData schema versioning

## Key Pattern

### Adding a Column Safely

```swift
// ✅ SAFE: Add nullable column (works with existing rows)
migrator.registerMigration("v2_add_preferences") { db in
    try db.execute(sql: """
        ALTER TABLE users ADD COLUMN preferences TEXT
    """)
}

// ✅ SAFE: Add column with default (works with existing rows)
migrator.registerMigration("v3_add_created_at") { db in
    try db.execute(sql: """
        ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT ''
    """)
}

// ❌ UNSAFE: NOT NULL without default (fails on existing rows)
try db.execute(sql: """
    ALTER TABLE users ADD COLUMN required_field TEXT NOT NULL
    -- Error: cannot add NOT NULL column with default value NULL
""")
```

### Changing Column Type Safely

```swift
// ✅ SAFE: Add new → migrate → keep old (never delete)
migrator.registerMigration("v4_migrate_age_to_int") { db in
    // 1. Add new column
    try db.execute(sql: "ALTER TABLE users ADD COLUMN age_int INTEGER")

    // 2. Migrate data
    try db.execute(sql: "UPDATE users SET age_int = CAST(age AS INTEGER)")

    // 3. Keep old column (for backwards compatibility)
    // NEVER: DROP COLUMN age
}
```

## Documentation Scope

This page documents the `axiom-database-migration` skill—safe schema evolution patterns Claude uses when helping you plan and execute migrations. The skill contains complete patterns for SQLite, GRDB, SQLiteData, and SwiftData.

**For persistence frameworks:** See [swiftdata](/skills/persistence/swiftdata), [grdb](/skills/persistence/grdb), or [sqlitedata](/skills/persistence/sqlitedata) for framework-specific guidance.

## Related

- [swiftdata](/skills/persistence/swiftdata) — SwiftData patterns including schema versioning
- [grdb](/skills/persistence/grdb) — GRDB DatabaseMigrator patterns
- [sqlitedata](/skills/persistence/sqlitedata) — SQLiteData @Column and migration patterns
- [xcode-debugging](/skills/debugging/xcode-debugging) — Environment diagnostics when migrations fail

## Resources

**WWDC**: 2019-230, 2023-10187

**Docs**: /grdb, /swiftdata/schema-versioning
