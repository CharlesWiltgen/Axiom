---
name: axiom-swiftdata-migration
description: Use when creating SwiftData custom schema migrations with VersionedSchema and SchemaMigrationPlan - property type changes, relationship preservation (one-to-many, many-to-many), the willMigrate/didMigrate limitation, two-stage migration patterns, and testing migrations on real devices
skill_type: discipline
version: 1.0.0
---

# SwiftData Custom Schema Migrations

## Overview

SwiftData schema migrations move your data safely when models change. **Core principle** SwiftData's `willMigrate` sees only OLD models, `didMigrate` sees only NEW models—you can never access both simultaneously. This limitation shapes all migration strategies.

**Requires** iOS 17+, Swift 5.9+
**Target** iOS 26+ (features like `propertiesToFetch`)

## When Custom Migrations Are Required

### Lightweight Migrations (Automatic)

SwiftData can migrate automatically for:
- ✅ Adding new optional properties
- ✅ Adding new required properties with default values
- ✅ Removing properties
- ✅ Renaming properties (with `@Attribute(originalName:)`)
- ✅ Changing relationship delete rules
- ✅ Adding new models

### Custom Migrations (This Skill)

You need custom migrations for:
- ❌ Changing property types (`String` → `AttributedString`, `Int` → `String`)
- ❌ Making optional properties required (must populate existing nulls)
- ❌ Complex relationship restructuring
- ❌ Data transformations (splitting/merging fields)
- ❌ Deduplication when adding unique constraints

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

#### 1. "I need to change a property from String to AttributedString. How do I migrate existing data with relationships intact?"
→ The skill shows the two-stage migration pattern that works around the willMigrate/didMigrate limitation

#### 2. "My model has a one-to-many relationship with cascade delete. How do I preserve this during a type change migration?"
→ The skill explains relationship prefetching and maintaining inverse relationships across schema versions

#### 3. "I have a many-to-many relationship between Tags and Notes. The migration is failing with 'Expected only Arrays for Relationships'. What's wrong?"
→ The skill covers explicit inverse relationship requirements and iOS 17.0 alphabetical naming bug

#### 4. "I need to rename a model but keep all its relationships intact."
→ The skill shows `@Attribute(originalName:)` patterns for lightweight migration

#### 5. "My migration works in the simulator but crashes on a real device with existing data."
→ The skill emphasizes real-device testing and explains why simulator success doesn't guarantee production safety

#### 6. "Why do I have to copy ALL my models into each VersionedSchema, even ones that haven't changed?"
→ The skill explains SwiftData's design: each VersionedSchema is a complete snapshot, not a diff

#### 7. "I'm getting 'The model used to open the store is incompatible with the one used to create the store' error."
→ The skill provides debugging steps for schema version mismatches

#### 8. "How do I test my SwiftData migration before releasing to production?"
→ The skill covers migration testing workflow, real device testing requirements, and validation strategies

---

## The willMigrate/didMigrate Limitation

**CRITICAL** This is the architectural constraint that shapes all SwiftData migration patterns.

### What You Can Access

```swift
static let migrateV1toV2 = MigrationStage.custom(
    fromVersion: SchemaV1.self,
    toVersion: SchemaV2.self,
    willMigrate: { context in
        // ✅ CAN access: SchemaV1 models (old)
        let v1Notes = try context.fetch(FetchDescriptor<SchemaV1.Note>())

        // ❌ CANNOT access: SchemaV2 models
        // SchemaV2.Note doesn't exist yet
    },
    didMigrate: { context in
        // ✅ CAN access: SchemaV2 models (new)
        let v2Notes = try context.fetch(FetchDescriptor<SchemaV2.Note>())

        // ❌ CANNOT access: SchemaV1 models
        // SchemaV1.Note is gone
    }
)
```

### Why This Matters

You cannot directly transform data from old type to new type in a single migration stage. Example:

```swift
// ❌ IMPOSSIBLE - you can't do this in one stage
willMigrate: { context in
    let oldNotes = try context.fetch(FetchDescriptor<SchemaV1.Note>())
    for oldNote in oldNotes {
        let newNote = SchemaV2.Note()  // ❌ Doesn't exist yet!
        newNote.content = oldNote.contentAsAttributedString()
    }
}
```

**Solution** Use two-stage migration pattern (covered below).

---

## Core Patterns

### Pattern 1: Basic VersionedSchema Setup

Every distinct schema version must be defined as a `VersionedSchema`.

```swift
import SwiftData

enum NotesSchemaV1: VersionedSchema {
    static var versionIdentifier = Schema.Version(1, 0, 0)

    static var models: [any PersistentModel.Type] {
        [Note.self, Folder.self, Tag.self]  // ALL models, even if unchanged
    }

    @Model
    final class Note {
        @Attribute(.unique) var id: String
        var title: String
        var content: String  // Original type
        var createdAt: Date

        @Relationship(deleteRule: .nullify, inverse: \Folder.notes)
        var folder: Folder?

        @Relationship(deleteRule: .nullify, inverse: \Tag.notes)
        var tags: [Tag] = []

        init(id: String, title: String, content: String, createdAt: Date) {
            self.id = id
            self.title = title
            self.content = content
            self.createdAt = createdAt
        }
    }

    @Model
    final class Folder {
        @Attribute(.unique) var id: String
        var name: String

        @Relationship(deleteRule: .cascade)
        var notes: [Note] = []

        init(id: String, name: String) {
            self.id = id
            self.name = name
        }
    }

    @Model
    final class Tag {
        @Attribute(.unique) var id: String
        var name: String

        @Relationship(deleteRule: .nullify)
        var notes: [Note] = []

        init(id: String, name: String) {
            self.id = id
            self.name = name
        }
    }
}
```

#### Key patterns
- **Complete snapshot** All models included, even unchanged ones
- **Semantic versioning** Use Schema.Version(major, minor, patch)
- **Explicit init** SwiftData doesn't synthesize initializers
- **Inverse relationships** Specify on both sides for bidirectional

---

### Pattern 2: Two-Stage Migration for Type Changes

**Use when** Changing property type (String → AttributedString, Int → String, etc.)

#### Problem

We want to change `Note.content` from `String` to `AttributedString`, but we can't access both old and new types simultaneously.

#### Solution

Use an intermediate schema version (V1.1) that has BOTH properties.

```swift
// Stage 1: V1 → V1.1 (Add new property alongside old)
enum NotesSchemaV1_1: VersionedSchema {
    static var versionIdentifier = Schema.Version(1, 1, 0)

    static var models: [any PersistentModel.Type] {
        [Note.self, Folder.self, Tag.self]
    }

    @Model
    final class Note {
        @Attribute(.unique) var id: String
        var title: String

        // OLD property (to be deprecated)
        @Attribute(originalName: "content")
        var contentOld: String = ""

        // NEW property (target type)
        var contentNew: AttributedString?

        var createdAt: Date

        @Relationship(deleteRule: .nullify, inverse: \Folder.notes)
        var folder: Folder?

        @Relationship(deleteRule: .nullify, inverse: \Tag.notes)
        var tags: [Tag] = []

        init(id: String, title: String, contentOld: String, createdAt: Date) {
            self.id = id
            self.title = title
            self.contentOld = contentOld
            self.createdAt = createdAt
        }
    }

    // Folder and Tag unchanged (copy from V1)
    @Model final class Folder { /* same as V1 */ }
    @Model final class Tag { /* same as V1 */ }
}

// Stage 2: V1.1 → V2 (Transform data, remove old property)
enum NotesSchemaV2: VersionedSchema {
    static var versionIdentifier = Schema.Version(2, 0, 0)

    static var models: [any PersistentModel.Type] {
        [Note.self, Folder.self, Tag.self]
    }

    @Model
    final class Note {
        @Attribute(.unique) var id: String
        var title: String

        // Renamed from contentNew
        @Attribute(originalName: "contentNew")
        var content: AttributedString?

        var createdAt: Date

        @Relationship(deleteRule: .nullify, inverse: \Folder.notes)
        var folder: Folder?

        @Relationship(deleteRule: .nullify, inverse: \Tag.notes)
        var tags: [Tag] = []

        init(id: String, title: String, content: AttributedString?, createdAt: Date) {
            self.id = id
            self.title = title
            self.content = content
            self.createdAt = createdAt
        }
    }

    @Model final class Folder { /* same as V1 */ }
    @Model final class Tag { /* same as V1 */ }
}
```

#### Migration Plan

```swift
enum NotesMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [NotesSchemaV1.self, NotesSchemaV1_1.self, NotesSchemaV2.self]
    }

    static var stages: [MigrationStage] {
        [migrateV1toV1_1, migrateV1_1toV2]
    }

    // Stage 1: Lightweight migration (adds contentNew)
    static let migrateV1toV1_1 = MigrationStage.lightweight(
        fromVersion: NotesSchemaV1.self,
        toVersion: NotesSchemaV1_1.self
    )

    // Stage 2: Custom migration (transform String → AttributedString)
    static let migrateV1_1toV2 = MigrationStage.custom(
        fromVersion: NotesSchemaV1_1.self,
        toVersion: NotesSchemaV2.self,
        willMigrate: { context in
            // Transform data while we still have access to V1.1 models
            var fetchDesc = FetchDescriptor<NotesSchemaV1_1.Note>()

            // Prefetch relationships to preserve them
            fetchDesc.relationshipKeyPathsForPrefetching = [\.folder, \.tags]

            let notes = try context.fetch(fetchDesc)

            for note in notes {
                // Convert String → AttributedString
                note.contentNew = try? AttributedString(markdown: note.contentOld)
            }

            try context.save()
        },
        didMigrate: nil
    )
}
```

#### Apply Migration Plan

```swift
@main
struct NotesApp: App {
    let container: ModelContainer = {
        do {
            let schema = Schema(versionedSchema: NotesSchemaV2.self)
            return try ModelContainer(
                for: schema,
                migrationPlan: NotesMigrationPlan.self
            )
        } catch {
            fatalError("Failed to create container: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(container)
    }
}
```

---

### Pattern 3: Many-to-Many Relationship Migration

**Use when** You have many-to-many relationships (Tags ↔ Notes)

#### Critical Requirements

1. **Explicit inverse relationships** SwiftData won't infer many-to-many
2. **Arrays on both sides** Not optional, must be arrays
3. **iOS 17.0 bug workaround** Alphabetical naming issue

```swift
enum SchemaV1: VersionedSchema {
    static var versionIdentifier = Schema.Version(1, 0, 0)
    static var models: [any PersistentModel.Type] {
        [Note.self, Tag.self]
    }

    @Model
    final class Note {
        @Attribute(.unique) var id: String
        var title: String

        // Many-to-many: MUST specify inverse
        @Relationship(deleteRule: .nullify, inverse: \Tag.notes)
        var tags: [Tag] = []  // ✅ Array with default value

        init(id: String, title: String) {
            self.id = id
            self.title = title
        }
    }

    @Model
    final class Tag {
        @Attribute(.unique) var id: String
        var name: String

        // Many-to-many: MUST specify inverse
        @Relationship(deleteRule: .nullify, inverse: \Note.tags)
        var notes: [Note] = []  // ✅ Array with default value

        init(id: String, name: String) {
            self.id = id
            self.name = name
        }
    }
}
```

#### iOS 17.0 Alphabetical Bug Workaround

In iOS 17.0, many-to-many relationships could fail if model names were in alphabetical order (e.g., Actor ↔ Movie works, but Movie ↔ Person fails).

**Workaround** Provide default values for relationship arrays:

```swift
@Relationship(deleteRule: .nullify, inverse: \Movie.actors)
var actors: [Actor] = []  // ✅ Default value prevents bug
```

**Fixed in** iOS 17.1+

#### Adding Junction Table Metadata

If you need additional fields on the relationship (e.g., "when was this tag added?"), use an explicit junction model:

```swift
@Model
final class NoteTag {
    @Attribute(.unique) var id: String
    var addedAt: Date  // Metadata on relationship

    @Relationship(deleteRule: .cascade)
    var note: Note?

    @Relationship(deleteRule: .cascade)
    var tag: Tag?

    init(id: String, note: Note, tag: Tag, addedAt: Date) {
        self.id = id
        self.note = note
        self.tag = tag
        self.addedAt = addedAt
    }
}

@Model
final class Note {
    @Attribute(.unique) var id: String
    var title: String

    @Relationship(deleteRule: .cascade)
    var noteTags: [NoteTag] = []  // One-to-many to junction

    var tags: [Tag] {
        noteTags.compactMap { $0.tag }
    }
}

@Model
final class Tag {
    @Attribute(.unique) var id: String
    var name: String

    @Relationship(deleteRule: .cascade)
    var noteTags: [NoteTag] = []  // One-to-many to junction

    var notes: [Note] {
        noteTags.compactMap { $0.note }
    }
}
```

---

### Pattern 4: Relationship Prefetching During Migration

**Use when** Migrating models with relationships to avoid N+1 queries

```swift
static let migrateV1toV2 = MigrationStage.custom(
    fromVersion: SchemaV1.self,
    toVersion: SchemaV2.self,
    willMigrate: { context in
        var fetchDesc = FetchDescriptor<SchemaV1.Note>()

        // Prefetch relationships (iOS 26+)
        fetchDesc.relationshipKeyPathsForPrefetching = [\.folder, \.tags]

        // Only fetch properties you need (iOS 26+)
        fetchDesc.propertiesToFetch = [\.title, \.content]

        let notes = try context.fetch(fetchDesc)

        // Relationships are already loaded - no N+1
        for note in notes {
            let folderName = note.folder?.name  // ✅ Already in memory
            let tagCount = note.tags.count  // ✅ Already in memory
        }

        try context.save()
    },
    didMigrate: nil
)
```

#### Performance Impact

```
Without prefetching:
- 1 query to fetch notes
- N queries to fetch each note's folder
- N queries to fetch each note's tags
= 1 + N + N queries

With prefetching:
- 1 query to fetch notes
- 1 query to fetch all folders
- 1 query to fetch all tags
= 3 queries total
```

---

### Pattern 5: Renaming Properties

**Use when** You want to rename a property without data loss

```swift
enum SchemaV1: VersionedSchema {
    static var versionIdentifier = Schema.Version(1, 0, 0)
    static var models: [any PersistentModel.Type] {
        [Note.self]
    }

    @Model
    final class Note {
        @Attribute(.unique) var id: String
        var title: String  // Original name
    }
}

enum SchemaV2: VersionedSchema {
    static var versionIdentifier = Schema.Version(2, 0, 0)
    static var models: [any PersistentModel.Type] {
        [Note.self]
    }

    @Model
    final class Note {
        @Attribute(.unique) var id: String

        // Renamed from "title" to "heading"
        @Attribute(originalName: "title")
        var heading: String
    }
}

// Migration plan (lightweight migration)
enum MigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [SchemaV1.self, SchemaV2.self]
    }

    static var stages: [MigrationStage] {
        [migrateV1toV2]
    }

    static let migrateV1toV2 = MigrationStage.lightweight(
        fromVersion: SchemaV1.self,
        toVersion: SchemaV2.self
    )
}
```

**Why this works** SwiftData sees `originalName` and preserves data during lightweight migration.

---

### Pattern 6: Deduplication for Unique Constraints

**Use when** Adding `@Attribute(.unique)` to a field that has duplicates

```swift
enum SchemaV1: VersionedSchema {
    static var versionIdentifier = Schema.Version(1, 0, 0)
    static var models: [any PersistentModel.Type] {
        [Trip.self]
    }

    @Model
    final class Trip {
        @Attribute(.unique) var id: String
        var name: String  // ❌ Not unique, has duplicates

        init(id: String, name: String) {
            self.id = id
            self.name = name
        }
    }
}

enum SchemaV2: VersionedSchema {
    static var versionIdentifier = Schema.Version(2, 0, 0)
    static var models: [any PersistentModel.Type] {
        [Trip.self]
    }

    @Model
    final class Trip {
        @Attribute(.unique) var id: String
        @Attribute(.unique) var name: String  // ✅ Now unique

        init(id: String, name: String) {
            self.id = id
            self.name = name
        }
    }
}

enum TripMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [SchemaV1.self, SchemaV2.self]
    }

    static var stages: [MigrationStage] {
        [migrateV1toV2]
    }

    static let migrateV1toV2 = MigrationStage.custom(
        fromVersion: SchemaV1.self,
        toVersion: SchemaV2.self,
        willMigrate: { context in
            // Deduplicate before adding unique constraint
            let trips = try context.fetch(FetchDescriptor<SchemaV1.Trip>())

            var seenNames = Set<String>()
            for trip in trips {
                if seenNames.contains(trip.name) {
                    // Duplicate - delete or rename
                    context.delete(trip)
                } else {
                    seenNames.insert(trip.name)
                }
            }

            try context.save()
        },
        didMigrate: nil
    )
}
```

---

## Testing Migrations

### Mandatory Testing Checklist

- [ ] Test fresh install (all migrations run from V1 → latest)
- [ ] Test upgrade from each previous version
- [ ] Test on REAL device (not just simulator)
- [ ] Verify relationship integrity after migration
- [ ] Check for data loss (count records before/after)
- [ ] Test with production-sized dataset

### Why Simulator Testing Is Insufficient

**Simulator behavior** Deletes database on rebuild, always sees fresh schema

**Real device behavior** Keeps persistent database across updates, schema must match

```swift
// ❌ WRONG - only testing in simulator
// You rebuild → simulator deletes database → fresh install
// Migration code never runs!

// ✅ CORRECT - test on real device
// 1. Install v1 build on device
// 2. Create sample data
// 3. Install v2 build (with migration)
// 4. Verify data preserved
```

### Testing Workflow

**Before deploying any migration to production:**

#### 1. Create Test Data Sets

Prepare test data representing pre-migration state:
- **Minimal dataset** - 10-20 records with all relationship types
- **Realistic dataset** - 1,000+ records matching production scale
- **Edge cases** - Empty relationships, max relationship counts, optional fields

#### 2. Test in Simulator

Run migration with test data:
```swift
// Create test data in V1 schema
let v1Container = try ModelContainer(for: Schema(versionedSchema: SchemaV1.self))
// ... populate test data ...

// Run migration
let v2Container = try ModelContainer(
    for: Schema(versionedSchema: SchemaV2.self),
    migrationPlan: MigrationPlan.self
)
```

Verify:
- All relationships preserved
- No data loss (count records before/after)
- New fields populated correctly
- Performance acceptable with realistic dataset size

#### 3. Test on Real Device

**CRITICAL** - Simulator success does not guarantee production safety.

```bash
# Workflow:
1. Install v1 build on real device
2. Create 100+ records with relationships
3. Verify data exists
4. Install v2 build (over existing app, don't delete)
5. Launch app
6. Verify:
   - App launches without crash
   - All 100+ records still exist
   - Relationships intact
   - New fields populated
```

#### 4. Validate with Production Data (If Possible)

If you have access to production data:
- Copy production database to development environment
- Run migration against copy
- Verify no data corruption
- Check performance with production-sized dataset

See `axiom-swiftdata-migration-diag` for debugging tools if migration fails.

### Migration Test Pattern

```swift
import Testing
import SwiftData

@Test func testMigrationFromV1ToV2() throws {
    // 1. Create V1 data
    let v1Schema = Schema(versionedSchema: SchemaV1.self)
    let v1Config = ModelConfiguration(isStoredInMemoryOnly: true)
    let v1Container = try ModelContainer(for: v1Schema, configurations: v1Config)

    let context = v1Container.mainContext
    let note = SchemaV1.Note(id: "1", title: "Test", content: "Original")
    context.insert(note)
    try context.save()

    // 2. Run migration to V2
    let v2Schema = Schema(versionedSchema: SchemaV2.self)
    let v2Container = try ModelContainer(
        for: v2Schema,
        migrationPlan: MigrationPlan.self,
        configurations: v1Config
    )

    // 3. Verify data migrated
    let v2Context = v2Container.mainContext
    let notes = try v2Context.fetch(FetchDescriptor<SchemaV2.Note>())

    #expect(notes.count == 1)
    #expect(notes.first?.content != nil)  // String → AttributedString
}
```

---

## Decision Tree: Lightweight vs Custom Migration

```
What change are you making?
├─ Adding optional property → Lightweight ✓
├─ Adding required property with default → Lightweight ✓
├─ Renaming property (with originalName) → Lightweight ✓
├─ Removing property → Lightweight ✓
├─ Changing relationship delete rule → Lightweight ✓
├─ Adding new model → Lightweight ✓
├─ Changing property type → Custom (two-stage) ✗
├─ Making optional → required → Custom (populate nulls first) ✗
├─ Adding unique constraint (duplicates exist) → Custom (deduplicate first) ✗
└─ Complex relationship restructure → Custom ✗
```

---

## Common Mistakes

### ❌ Forgetting to include ALL models in VersionedSchema

```swift
enum SchemaV1: VersionedSchema {
    static var models: [any PersistentModel.Type] {
        [Note.self]  // ❌ WRONG: Missing Folder and Tag
    }
}

// ✅ CORRECT: Include ALL models
enum SchemaV1: VersionedSchema {
    static var models: [any PersistentModel.Type] {
        [Note.self, Folder.self, Tag.self]  // ✅ Even if unchanged
    }
}
```

**Why** Each VersionedSchema is a complete snapshot of the data model, not a diff.

---

### ❌ Trying to access old models in didMigrate

```swift
static let migrate = MigrationStage.custom(
    fromVersion: SchemaV1.self,
    toVersion: SchemaV2.self,
    willMigrate: nil,
    didMigrate: { context in
        // ❌ CRASH: SchemaV1.Note doesn't exist here
        let oldNotes = try context.fetch(FetchDescriptor<SchemaV1.Note>())
    }
)

// ✅ CORRECT: Use willMigrate for old models
static let migrate = MigrationStage.custom(
    fromVersion: SchemaV1.self,
    toVersion: SchemaV2.self,
    willMigrate: { context in
        // ✅ SchemaV1.Note exists here
        let oldNotes = try context.fetch(FetchDescriptor<SchemaV1.Note>())
    },
    didMigrate: nil
)
```

---

### ❌ Not testing on real device with real data

```swift
// ❌ WRONG: Simulator success ≠ production safety
// Rebuild simulator → database deleted → fresh install
// Migration never actually runs!

// ✅ CORRECT: Test migration path
// 1. Install v1 on real device
// 2. Create data (100+ records)
// 3. Install v2 with migration
// 4. Verify data preserved
```

---

### ❌ Many-to-many without explicit inverse

```swift
// ❌ WRONG: SwiftData can't infer many-to-many
@Model
final class Note {
    var tags: [Tag] = []  // ❌ Missing inverse
}

// ✅ CORRECT: Explicit inverse
@Model
final class Note {
    @Relationship(deleteRule: .nullify, inverse: \Tag.notes)
    var tags: [Tag] = []  // ✅ Inverse specified
}
```

---

### ❌ Assuming simulator success = production success

Simulator deletes database on rebuild. Real devices keep persistent databases across updates.

**Impact** Migration bugs hidden in simulator, crash 100% of production users.

**Fix** ALWAYS test on real device before shipping.

---

## Debugging Failed Migrations

### Enable Core Data SQL Debug

```bash
# In Xcode scheme, add argument:
-com.apple.coredata.swiftdata.debug 1
```

**Output** Shows actual SQL queries during migration

```
CoreData: sql: SELECT Z_PK, Z_ENT, Z_OPT, ZID, ZTITLE FROM ZNOTE
CoreData: sql: ALTER TABLE ZNOTE ADD COLUMN ZCONTENT TEXT
```

### Common Error Messages

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| "Expected only Arrays for Relationships" | Many-to-many inverse missing | Add `@Relationship(inverse:)` |
| "The model used to open the store is incompatible" | Schema version mismatch | Verify migration plan schemas array |
| "Failed to fulfill faulting for..." | Relationship integrity broken | Prefetch relationships during migration |
| App crashes on launch after schema change | Missing model in VersionedSchema | Include ALL models |

---

## Quick Reference

### Basic Migration Setup

```swift
// 1. Define versioned schemas
enum SchemaV1: VersionedSchema { /* models */ }
enum SchemaV2: VersionedSchema { /* models */ }

// 2. Create migration plan
enum MigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [SchemaV1.self, SchemaV2.self]
    }

    static var stages: [MigrationStage] {
        [migrateV1toV2]
    }

    static let migrateV1toV2 = MigrationStage.lightweight(
        fromVersion: SchemaV1.self,
        toVersion: SchemaV2.self
    )
}

// 3. Apply to container
let schema = Schema(versionedSchema: SchemaV2.self)
let container = try ModelContainer(
    for: schema,
    migrationPlan: MigrationPlan.self
)
```

---

## Resources

**WWDC**: 2025-291, 2023-10195

**Docs**: /swiftdata

**Skills**: axiom-swiftdata, axiom-swiftdata-migration-diag, axiom-database-migration

---

**Created** 2025-12-09
**Targets** iOS 17+ (focus on iOS 26+ features)
**Framework** SwiftData (Apple)
**Swift** 5.9+
