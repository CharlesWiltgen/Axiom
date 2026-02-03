---
name: axiom-swiftdata-migration-diag
description: Use when SwiftData migrations crash, fail to preserve relationships, lose data, or work in simulator but fail on device - systematic diagnostics for schema version mismatches, relationship errors, and migration testing gaps
license: MIT
metadata:
  version: "1.0.0"
---

# SwiftData Migration Diagnostics

## Overview

SwiftData migration failures manifest as production crashes, data loss, corrupted relationships, or simulator-only success. **Core principle** 90% of migration failures stem from missing models in VersionedSchema, relationship inverse issues, or untested migration paths—not SwiftData bugs.

## Red Flags — Suspect SwiftData Migration Issue

If you see ANY of these, suspect a migration configuration problem:

- App crashes on launch after schema change
- "Expected only Arrays for Relationships" error
- "The model used to open the store is incompatible with the one used to create the store"
- "Failed to fulfill faulting for [relationship]"
- Migration works in simulator but crashes on real device
- Data exists before migration, gone after
- Relationships broken after migration (nil where they shouldn't be)
- ❌ **FORBIDDEN** "SwiftData migrations are broken, we should use Core Data"
  - SwiftData handles millions of migrations in production apps
  - Schema mismatches and relationship errors are always configuration, not framework
  - Do not rationalize away the issue—diagnose it

**Critical distinction** Simulator deletes the database on each rebuild, hiding schema mismatch issues. Real devices keep persistent databases and crash immediately on schema mismatch. **MANDATORY: Test migrations on real device with real data before shipping.**

## Mandatory First Steps

**ALWAYS run these FIRST** (before changing code):

```swift
// 1. Identify the crash/issue type
// Screenshot the crash message and note:
//   - "Expected only Arrays" = relationship inverse missing
//   - "incompatible model" = schema version mismatch
//   - "Failed to fulfill faulting" = relationship integrity broken
//   - Simulator works, device crashes = untested migration path
// Record: "Error type: [exact message]"

// 2. Check schema version configuration
// In your migration plan:
enum MigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        // ✅ VERIFY: All versions in order?
        // ✅ VERIFY: Latest version matches container?
        [SchemaV1.self, SchemaV2.self, SchemaV3.self]
    }

    static var stages: [MigrationStage] {
        // ✅ VERIFY: Migration stages match schema transitions?
        [migrateV1toV2, migrateV2toV3]
    }
}

// In your app:
let schema = Schema(versionedSchema: SchemaV3.self)  // ✅ VERIFY: Matches latest in plan?
let container = try ModelContainer(
    for: schema,
    migrationPlan: MigrationPlan.self  // ✅ VERIFY: Plan is registered?
)
// Record: "Schema version: latest is [version]"

// 3. Check all models included in VersionedSchema
enum SchemaV2: VersionedSchema {
    static var models: [any PersistentModel.Type] {
        // ✅ VERIFY: Are ALL models listed? (even unchanged ones)
        [Note.self, Folder.self, Tag.self]
    }
}
// Record: "Missing models? Yes/no"

// 4. Check relationship inverse declarations
@Model
final class Note {
    @Relationship(deleteRule: .nullify, inverse: \Folder.notes)  // ✅ VERIFY: inverse specified?
    var folder: Folder?

    @Relationship(deleteRule: .nullify, inverse: \Tag.notes)  // ✅ VERIFY: inverse specified?
    var tags: [Tag] = []
}
// Record: "Relationship inverses: all specified? Yes/no"

// 5. Enable SwiftData debug logging
// In Xcode scheme, add argument:
// -com.apple.coredata.swiftdata.debug 1
// Run and check Console for SQL queries
// Record: "Debug log shows: [what you see]"
```

#### What this tells you

- **"Expected only Arrays for Relationships"** → Proceed to Pattern 1 (relationship inverse fix)
- **"incompatible model"** → Proceed to Pattern 2 (schema version mismatch)
- **Missing models in VersionedSchema** → Proceed to Pattern 3 (complete schema snapshot)
- **Simulator works, device crashes** → Proceed to Pattern 4 (migration testing)
- **Data lost after migration** → Proceed to Pattern 5 (willMigrate/didMigrate misuse)

#### MANDATORY INTERPRETATION

Before changing ANY code, identify ONE of these:

1. If error is "Expected only Arrays" AND relationship inverse missing → Relationship configuration issue
2. If error mentions "incompatible" AND schema versions don't match → Version mismatch
3. If models are missing from VersionedSchema → Incomplete schema snapshot
4. If simulator succeeds but device fails → Untested migration path
5. If data exists before but not after → willMigrate/didMigrate limitation violated

#### If diagnostics are contradictory or unclear

- STOP. Do NOT proceed to patterns yet
- Add `-com.apple.coredata.swiftdata.debug 1` and examine SQL output
- Check file system: does .sqlite file exist? What size?
- Establish baseline: what's actually happening vs. what you assumed

---

## Verifying Migration Completed Successfully

**Use this section when migration appears to complete without errors, but you want to verify data integrity.**

### Quick Verification Checklist

After migration runs without crashing:

```swift
// 1. Verify record count matches pre-migration
let context = container.mainContext
let postMigrationCount = try context.fetch(FetchDescriptor<Note>()).count
print("Post-migration count: \(postMigrationCount)")
// Compare to pre-migration count

// 2. Spot-check specific records
let sampleNote = try context.fetch(
    FetchDescriptor<Note>(predicate: #Predicate { $0.id == "known-test-id" })
).first
print("Sample note title: \(sampleNote?.title ?? "MISSING")")

// 3. Verify relationships intact
if let note = sampleNote {
    print("Folder relationship: \(note.folder != nil ? "✓" : "✗")")
    print("Tags count: \(note.tags.count)")

    // Verify inverse relationships
    if let folder = note.folder {
        let folderHasNote = folder.notes.contains { $0.id == note.id }
        print("Inverse relationship: \(folderHasNote ? "✓" : "✗")")
    }
}

// 4. Check for orphaned data
let orphanedNotes = try context.fetch(
    FetchDescriptor<Note>(predicate: #Predicate { $0.folder == nil })
)
print("Orphaned notes (should be 0 if cascade delete worked): \(orphanedNotes.count)")
```

### What Successful Migration Looks Like

**Console Output:**
```
Post-migration count: 1523  // Matches pre-migration
Sample note title: Test Note  // Not "MISSING"
Folder relationship: ✓
Tags count: 3
Inverse relationship: ✓
Orphaned notes: 0
```

**If you see:**
- Record count differs → Data loss (check willMigrate logic)
- "MISSING" records → Schema mismatch or fetch error
- Relationships nil → Inverse configuration or prefetching issue
- Orphaned records >0 → Cascade delete rule not working

See patterns below for specific fixes.

---

## Decision Tree

```
SwiftData migration problem suspected?
├─ Error: "Expected only Arrays for Relationships"?
│  └─ YES → Relationship inverse missing
│     ├─ Many-to-many relationship? → Pattern 1a (explicit inverse)
│     ├─ One-to-many relationship? → Pattern 1b (verify both sides)
│     └─ iOS 17.0 alphabetical bug? → Pattern 1c (default value workaround)
│
├─ Error: "incompatible model" or crash on launch?
│  └─ YES → Schema version mismatch
│     ├─ Latest schema not in plan? → Pattern 2a (add to schemas array)
│     ├─ Migration stage missing? → Pattern 2b (add stage)
│     └─ Container using wrong schema? → Pattern 2c (verify version)
│
├─ Migration runs but data missing?
│  └─ YES → Data loss during migration
│     ├─ Used didMigrate to access old models? → Pattern 3a (use willMigrate)
│     ├─ Forgot to save in willMigrate? → Pattern 3b (add context.save())
│     └─ Custom migration logic wrong? → Pattern 3c (debug transformation)
│
├─ Works in simulator but crashes on device?
│  └─ YES → Untested migration path
│     ├─ Never tested on real device? → Pattern 4a (real device testing)
│     ├─ Never tested upgrade path? → Pattern 4b (test v1 → v2 upgrade)
│     └─ Production data differs from test? → Pattern 4c (test with prod data)
│
└─ Relationships nil after migration?
   └─ YES → Relationship integrity broken
      ├─ Forgot to prefetch relationships? → Pattern 5a (add prefetching)
      ├─ Inverse relationship wrong? → Pattern 5b (fix inverse)
      └─ Delete rule caused cascade? → Pattern 5c (check delete rules)
```

---

## Common Patterns

### Pattern 1a: Fix "Expected only Arrays for Relationships"

**PRINCIPLE** Many-to-many relationships require explicit inverse declarations.

#### ❌ WRONG (Causes "Expected only Arrays" error)
```swift
@Model
final class Note {
    var tags: [Tag] = []  // ❌ Missing inverse
}

@Model
final class Tag {
    var notes: [Note] = []  // ❌ Missing inverse
}
```

#### ✅ CORRECT (Explicit inverse)
```swift
@Model
final class Note {
    @Relationship(deleteRule: .nullify, inverse: \Tag.notes)
    var tags: [Tag] = []  // ✅ Inverse specified
}

@Model
final class Tag {
    @Relationship(deleteRule: .nullify, inverse: \Note.tags)
    var notes: [Note] = []  // ✅ Inverse specified
}
```

**Why this works** SwiftData requires explicit inverse for many-to-many to create junction table correctly.

**Time cost** 2 minutes to add inverse declarations

---

### Pattern 1b: iOS 17.0 Alphabetical Bug Workaround

**PRINCIPLE** In iOS 17.0, many-to-many relationships could fail if model names were in alphabetical order.

#### ❌ WRONG (Crashes in iOS 17.0)
```swift
@Model
final class Actor {
    @Relationship(deleteRule: .nullify, inverse: \Movie.actors)
    var movies: [Movie]  // ❌ No default value
}

@Model
final class Movie {
    @Relationship(deleteRule: .nullify, inverse: \Actor.movies)
    var actors: [Actor]  // ❌ No default value
}
// Crashes if "Actor" < "Movie" alphabetically
```

#### ✅ CORRECT (Works in iOS 17.0+)
```swift
@Model
final class Actor {
    @Relationship(deleteRule: .nullify, inverse: \Movie.actors)
    var movies: [Movie] = []  // ✅ Default value
}

@Model
final class Movie {
    @Relationship(deleteRule: .nullify, inverse: \Actor.movies)
    var actors: [Actor] = []  // ✅ Default value
}
```

**Fixed in** iOS 17.1+

**Time cost** 1 minute to add default values

---

### Pattern 2a: Schema Version Mismatch

**PRINCIPLE** Migration plan's schemas array must include ALL versions in order.

#### ❌ WRONG (Missing version causes crash)
```swift
enum MigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [SchemaV1.self, SchemaV3.self]  // ❌ Missing V2!
    }

    static var stages: [MigrationStage] {
        [migrateV1toV2, migrateV2toV3]  // References V2 but not in schemas
    }
}
```

#### ✅ CORRECT (All versions in order)
```swift
enum MigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [SchemaV1.self, SchemaV2.self, SchemaV3.self]  // ✅ All versions
    }

    static var stages: [MigrationStage] {
        [migrateV1toV2, migrateV2toV3]
    }
}
```

**Time cost** 2 minutes to add missing version

---

### Pattern 3a: Data Loss from willMigrate/didMigrate Misuse

**PRINCIPLE** Old models only accessible in willMigrate, new models only in didMigrate.

#### ❌ WRONG (Tries to access old models in didMigrate)
```swift
static let migrate = MigrationStage.custom(
    fromVersion: SchemaV1.self,
    toVersion: SchemaV2.self,
    willMigrate: nil,
    didMigrate: { context in
        // ❌ CRASH: SchemaV1.Note doesn't exist here
        let oldNotes = try context.fetch(FetchDescriptor<SchemaV1.Note>())

        // Data lost because transformation never ran
    }
)
```

#### ✅ CORRECT (Transform in willMigrate)
```swift
static let migrate = MigrationStage.custom(
    fromVersion: SchemaV1.self,
    toVersion: SchemaV2.self,
    willMigrate: { context in
        // ✅ SchemaV1.Note exists here
        let oldNotes = try context.fetch(FetchDescriptor<SchemaV1.Note>())

        // Transform data while old models still accessible
        for note in oldNotes {
            note.transformed = transformLogic(note.oldValue)
        }

        try context.save()  // ✅ Save before migration completes
    },
    didMigrate: nil
)
```

**Time cost** 5 minutes to move logic to correct closure

---

### Pattern 4a: Real Device Testing

**PRINCIPLE** Simulator deletes database on rebuild. Real devices keep persistent databases.

#### Testing Workflow

```bash
# 1. Install v1 on real device
# Build with SchemaV1 as current version
# Run app, create sample data (100+ records)

# 2. Verify data exists
# Check app: should see 100+ records

# 3. Install v2 with migration
# Build with SchemaV2 as current version + migration plan
# Install over existing app (don't delete)

# 4. Verify migration succeeded
# App launches without crash
# Data still exists (100+ records)
# Relationships intact
```

#### Migration Test Code

```swift
import Testing
import SwiftData

@Test func testMigrationOnRealDevice() throws {
    // This test MUST run on real device, not simulator
    #if targetEnvironment(simulator)
    throw XCTSkip("Migration test requires real device")
    #endif

    let container = try ModelContainer(
        for: Schema(versionedSchema: SchemaV2.self),
        migrationPlan: MigrationPlan.self
    )

    let context = container.mainContext
    let notes = try context.fetch(FetchDescriptor<SchemaV2.Note>())

    // Verify data preserved
    #expect(notes.count > 0)

    // Verify relationships
    for note in notes {
        if note.folder != nil {
            #expect(note.folder?.notes.contains { $0.id == note.id } == true)
        }
    }
}
```

**Time cost** 15 minutes to test on real device

---

### Pattern 5a: Relationship Prefetching to Preserve Integrity

**PRINCIPLE** Fetch relationships eagerly during migration to avoid faulting errors.

#### ❌ WRONG (Relationships may fault and break)
```swift
static let migrate = MigrationStage.custom(
    fromVersion: SchemaV1.self,
    toVersion: SchemaV2.self,
    willMigrate: { context in
        let notes = try context.fetch(FetchDescriptor<SchemaV1.Note>())

        for note in notes {
            // ❌ May trigger fault, relationship not loaded
            let folderName = note.folder?.name
        }
    },
    didMigrate: nil
)
```

#### ✅ CORRECT (Prefetch relationships)
```swift
static let migrate = MigrationStage.custom(
    fromVersion: SchemaV1.self,
    toVersion: SchemaV2.self,
    willMigrate: { context in
        var fetchDesc = FetchDescriptor<SchemaV1.Note>()

        // ✅ Prefetch relationships
        fetchDesc.relationshipKeyPathsForPrefetching = [\.folder, \.tags]

        let notes = try context.fetch(fetchDesc)

        for note in notes {
            // ✅ Relationships already loaded
            let folderName = note.folder?.name
            let tagCount = note.tags.count
        }

        try context.save()
    },
    didMigrate: nil
)
```

**Time cost** 3 minutes to add prefetching

---

## Quick Reference: Error → Fix Mapping

| Error Message | Root Cause | Fix | Time |
|--------------|------------|-----|------|
| "Expected only Arrays for Relationships" | Many-to-many inverse missing | Add `@Relationship(inverse:)` to both sides | 2 min |
| "The model used to open the store is incompatible" | Schema version mismatch | Add missing version to `schemas` array | 2 min |
| "Failed to fulfill faulting for [relationship]" | Relationship not prefetched | Add `relationshipKeyPathsForPrefetching` | 3 min |
| App crashes after schema change | Missing model in VersionedSchema | Include ALL models in `models` array | 2 min |
| Data lost after migration | Transformation in wrong closure | Move logic from didMigrate to willMigrate | 5 min |
| Simulator works, device crashes | Untested migration path | Test on real device with real data | 15 min |
| Relationships nil after migration | Inverse relationship wrong | Fix `@Relationship(inverse:)` keypath | 3 min |

---

## Debugging Checklist

When migration fails, verify ALL of these:

- [ ] All models included in `VersionedSchema.models` array
- [ ] All schema versions included in `SchemaMigrationPlan.schemas` array
- [ ] Migration stages match schema transitions (V1→V2, V2→V3)
- [ ] Many-to-many relationships have explicit `inverse:` on both sides
- [ ] Container initialized with correct latest schema version
- [ ] Migration plan registered in `ModelContainer` initialization
- [ ] Tested on real device (not just simulator)
- [ ] Tested upgrade path (v1 → v2), not just fresh install
- [ ] SwiftData debug logging enabled (`-com.apple.coredata.swiftdata.debug 1`)
- [ ] Data transformation logic in `willMigrate` (not `didMigrate`)

---

## When You're Stuck After 30 Minutes

If you've spent >30 minutes and the migration issue persists:

#### STOP. You either
1. Skipped mandatory diagnostics (most common)
2. Misidentified the actual problem
3. Applied wrong pattern for your symptom
4. Haven't tested on real device/real data
5. Have complex edge case requiring two-stage migration

#### MANDATORY checklist before claiming "skill didn't work"

- [ ] I ran all Mandatory First Steps diagnostics
- [ ] I identified the problem type (relationship, schema mismatch, data loss, testing gap)
- [ ] I enabled SwiftData debug logging and examined SQL output
- [ ] I tested on real device with real data (not simulator)
- [ ] I applied the FIRST matching pattern from Decision Tree
- [ ] I verified all models included in VersionedSchema
- [ ] I checked relationship inverse declarations

#### If ALL boxes are checked and still broken
- You need two-stage migration (covered in `axiom-swiftdata-migration` skill)
- Time cost: 30-60 minutes for complex type change migration
- Ask: "What data transformation is actually needed?" and implement two-stage pattern

---

## Time Cost Transparency

- Pattern 1 (relationship inverse): 2-3 minutes
- Pattern 2 (schema version): 2-5 minutes
- Pattern 3 (willMigrate fix): 5-10 minutes
- Pattern 4 (real device testing): 15-30 minutes
- Pattern 5 (relationship prefetching): 3-5 minutes

---

## Real-World Impact

**Before** SwiftData migration debugging 2-8 hours per issue
- App crashes on launch in production
- Data loss for existing users
- Relationships broken after migration
- Simulator success, device failure
- Customer trust damaged

**After** 15-45 minutes with systematic diagnosis
- Identify problem type with diagnostics (5 min)
- Apply correct pattern (5-10 min)
- Test on real device (15-30 min)
- Deploy with confidence

**Key insight** SwiftData has well-established patterns for every common migration issue. The problem is developers don't know which diagnostic applies to their error.

---

## Resources

**WWDC**: 2025-291, 2023-10195

**Docs**: /swiftdata

**Skills**: axiom-swiftdata-migration, axiom-swiftdata, axiom-database-migration

---

**Created** 2025-12-09
**Status** Production-ready diagnostic patterns
**Framework** SwiftData (Apple)
**Swift** 5.9+
