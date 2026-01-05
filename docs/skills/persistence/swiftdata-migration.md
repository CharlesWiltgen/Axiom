---
name: swiftdata-migration
description: SwiftData custom schema migrations with VersionedSchema and SchemaMigrationPlan
skill_type: discipline
version: 0.9
---

# SwiftData Custom Schema Migrations

Custom schema migrations for SwiftData when lightweight migrations aren't enough. Covers VersionedSchema, SchemaMigrationPlan, the willMigrate/didMigrate limitation, and two-stage migration patterns.

## When to Use This Skill

Use this skill when you're:
- Changing property types (String → AttributedString, Int → String)
- Making optional properties required (must populate existing nulls)
- Complex relationship restructuring
- Splitting or merging fields
- Adding unique constraints that require deduplication
- Getting "model incompatible with store" errors
- Migration works in simulator but crashes on device

**Lightweight migrations (automatic)** handle: adding optional properties, adding properties with defaults, removing properties, renaming with `@Attribute(originalName:)`, changing delete rules, adding new models.

**Custom migrations (this skill)** are required when lightweight isn't enough.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "I need to change a property from String to AttributedString. How do I migrate existing data?"
- "My model has a one-to-many relationship with cascade delete. How do I preserve it during migration?"
- "I have a many-to-many relationship and migration is failing with 'Expected only Arrays'."
- "Why do I have to copy ALL my models into each VersionedSchema?"
- "My migration works in simulator but crashes on real device."
- "I'm getting 'model used to open store is incompatible' error."

## What's Covered

### The willMigrate/didMigrate Limitation
- willMigrate sees only OLD models
- didMigrate sees only NEW models
- You can never access both simultaneously
- This shapes all migration strategies

### VersionedSchema Pattern
- Each schema is a complete snapshot (not a diff)
- All models must be copied to each version
- @Attribute(originalName:) for lightweight renames

### Two-Stage Migration Pattern
- Stage 1: Old model saves data to temporary storage
- Stage 2: New model reads from temporary storage
- Required for type changes

### Relationship Preservation
- One-to-many with cascade delete
- Many-to-many inverse relationships
- iOS 17.0 alphabetical naming bug

### Testing Migrations
- Real device testing (simulator success ≠ production safety)
- Pre-migration database backup
- Validation strategies

## Key Pattern

### The Core Limitation

```swift
static let migrateV1toV2 = MigrationStage.custom(
    fromVersion: SchemaV1.self,
    toVersion: SchemaV2.self,
    willMigrate: { context in
        // ✅ CAN access: SchemaV1 models (old)
        let v1Notes = try context.fetch(FetchDescriptor<SchemaV1.Note>())
        // ❌ CANNOT access: SchemaV2 models (don't exist yet)
    },
    didMigrate: { context in
        // ✅ CAN access: SchemaV2 models (new)
        let v2Notes = try context.fetch(FetchDescriptor<SchemaV2.Note>())
        // ❌ CANNOT access: SchemaV1 models (gone)
    }
)
```

### Two-Stage Migration for Type Changes

```swift
// Stage 1: Save old data to temporary storage (willMigrate)
willMigrate: { context in
    let oldNotes = try context.fetch(FetchDescriptor<SchemaV1.Note>())
    var tempData: [UUID: String] = [:]
    for note in oldNotes {
        tempData[note.id] = note.bodyString // Old type: String
    }
    // Save to UserDefaults or file
}

// Stage 2: Read and convert (didMigrate)
didMigrate: { context in
    let newNotes = try context.fetch(FetchDescriptor<SchemaV2.Note>())
    // Read from temporary storage
    for note in newNotes {
        if let oldString = tempData[note.id] {
            note.body = AttributedString(oldString) // New type
        }
    }
}
```

## Documentation Scope

This page documents the `axiom-swiftdata-migration` skill—custom SwiftData migration patterns Claude uses when you need migrations beyond what lightweight migration handles.

**For SwiftData basics:** See [swiftdata](/skills/persistence/swiftdata) for @Model, @Query, and ModelContext patterns.

**For migration diagnostics:** See [swiftdata-migration-diag](/diagnostic/swiftdata-migration-diag) for troubleshooting migration failures.

## Related

- [swiftdata](/skills/persistence/swiftdata) — Core SwiftData patterns
- [swiftdata-migration-diag](/diagnostic/swiftdata-migration-diag) — Migration failure diagnosis
- [database-migration](/skills/persistence/database-migration) — General SQLite migration patterns

## Resources

**WWDC**: 2023-10187 (Model your schema with SwiftData), 2024-10137 (What's new in SwiftData)

**Docs**: /swiftdata/versionedschema, /swiftdata/schemamigrationplan
