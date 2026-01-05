---
name: swiftdata-migration-diag
description: Systematic diagnostics for SwiftData migration crashes, data loss, and relationship errors
skill_type: diagnostic
version: 0.9
---

# SwiftData Migration Diagnostics

Systematic troubleshooting for SwiftData migration failures. Covers schema version mismatches, relationship errors, and simulator-vs-device issues.

## Symptoms This Diagnoses

Use when you're experiencing:
- App crashes on launch after schema change
- "Expected only Arrays for Relationships" error
- "The model used to open the store is incompatible"
- "Failed to fulfill faulting for [relationship]"
- Migration works in simulator but crashes on device
- Data exists before migration, gone after
- Relationships broken (nil where they shouldn't be)

## Example Prompts

- "App crashes after I added a new property to my @Model"
- "'Expected only Arrays for Relationships' — what does this mean?"
- "Migration works in simulator but crashes on real device"
- "Data disappeared after migration"
- "How do I fix 'incompatible model' errors?"
- "Relationships are nil after running migration"

## Diagnostic Workflow

Claude guides you through systematic diagnosis:

### Step 1: Identify Error Type

| Error Message | Root Cause |
|---------------|------------|
| "Expected only Arrays for Relationships" | Missing inverse on many-to-many |
| "incompatible model" | Schema version mismatch |
| "Failed to fulfill faulting" | Relationship not prefetched |
| Simulator works, device crashes | Untested migration path |

### Step 2: Check Common Issues

Before changing code:
1. Verify ALL models listed in VersionedSchema.models
2. Check migration plan has all versions in order
3. Verify relationship inverses on both sides
4. Enable SwiftData debug logging

### Step 3: Apply Targeted Fix

Claude provides specific patterns:
- **Pattern 1**: Relationship inverse fixes
- **Pattern 2**: Schema version mismatch
- **Pattern 3**: willMigrate/didMigrate usage
- **Pattern 4**: Real device testing
- **Pattern 5**: Relationship prefetching

## Key Diagnostic Patterns

### Many-to-Many Relationships

```swift
// ❌ Missing inverse causes "Expected only Arrays"
var tags: [Tag] = []

// ✅ Explicit inverse required
@Relationship(deleteRule: .nullify, inverse: \Tag.notes)
var tags: [Tag] = []
```

### Schema Version Checklist

```swift
enum MigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [SchemaV1.self, SchemaV2.self, SchemaV3.self]  // All versions!
    }
}
```

### Simulator vs Device

**Critical:** Simulator deletes database on each rebuild. Real devices keep persistent databases.

**Always test migrations on real device with real data before shipping.**

## Quick Reference

| Error | Fix | Time |
|-------|-----|------|
| "Expected only Arrays" | Add `@Relationship(inverse:)` | 2 min |
| "incompatible model" | Add missing version to schemas | 2 min |
| "Failed to fulfill faulting" | Add prefetching | 3 min |
| Data lost after migration | Move logic to willMigrate | 5 min |
| Device crash only | Test on real device | 15 min |

## Documentation Scope

This page documents the `axiom-swiftdata-migration-diag` diagnostic skill—systematic troubleshooting Claude uses when SwiftData migrations fail.

**For migration patterns:** See [swiftdata-migration](/skills/persistence/swiftdata-migration) for implementation guidance.

**For SwiftData basics:** See [swiftdata](/skills/persistence/swiftdata) for @Model and @Query patterns.

## Related

- [swiftdata-migration](/skills/persistence/swiftdata-migration) — Custom migration patterns
- [swiftdata](/skills/persistence/swiftdata) — SwiftData fundamentals
- [database-migration](/skills/persistence/database-migration) — General migration safety

## Resources

**WWDC**: 2025-291 (SwiftData Migration), 2023-10195 (Schema modeling)

**Docs**: /swiftdata, /swiftdata/schemamigrationplan
