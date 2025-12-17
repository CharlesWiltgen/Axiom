---
name: realm-migration-ref
description: Complete migration guide from Realm to SwiftData — pattern equivalents, threading models, schema strategies, CloudKit sync transition
---

# Realm to SwiftData Migration Reference

**URGENT**: Realm Device Sync sunsets September 30, 2025. Complete migration guide to prevent data loss.

## Overview

Comprehensive reference for migrating from Realm to SwiftData without losing user data or breaking threading patterns. Covers pattern equivalents, schema migration strategies, and CloudKit sync transition.

## What's Covered

### Pattern Equivalents

#### Model Definitions
- `Object` → `@Model`
- `@Persisted` → `@Attribute` / `@Relationship`
- Primary keys and indexing
- Inverse relationships

#### Queries
- `results(ofType:)` → `@Query` / `FetchDescriptor`
- Predicates and sorting
- Lazy loading vs eager fetching
- Performance characteristics

#### Threading Models
- Realm's thread-confined objects → SwiftData's ModelContext
- Background writes → ModelContext on background actors
- Freeze patterns → value snapshots
- Notifications → observation framework

### Schema Migration

#### Data Migration Strategies
- Export Realm data to JSON/SQLite
- Batch import into SwiftData
- Validation and integrity checks
- Rollback strategies

#### Schema Mapping
- Property type conversions
- Relationship restructuring
- Embedded objects → nested models
- List/Array handling

### CloudKit Sync Transition

#### From Realm Device Sync
- Atlas Device Sync → CloudKit
- Conflict resolution differences
- Authentication changes
- Network Reachability patterns

## When to Use This Reference

Use this reference when:
- Planning migration from Realm to SwiftData
- Converting Realm Object models to @Model
- Replacing Realm Device Sync with CloudKit
- Dealing with legacy Realm codebases
- **Before September 30, 2025** (Realm Device Sync sunset)

## Migration Timeline

```
1. Audit (Week 1)
   - Inventory all Realm models
   - Document threading patterns
   - List Device Sync dependencies

2. Schema Design (Week 2)
   - Design SwiftData @Model equivalents
   - Plan relationship mappings
   - CloudKit schema design

3. Data Migration (Week 3-4)
   - Export Realm data
   - Import to SwiftData
   - Validate integrity
   - Test rollback

4. Code Migration (Week 4-6)
   - Replace Realm queries with @Query
   - Update threading patterns
   - Implement CloudKit sync
   - Remove Realm dependencies

5. Testing (Week 7-8)
   - User acceptance testing
   - Performance validation
   - Cloud sync verification
   - Production rollout plan
```

## Key Differences

| Realm | SwiftData | Notes |
|-------|-----------|-------|
| Thread-confined objects | ModelContext per thread | Must extract values before crossing threads |
| `realm.write {}` | `modelContext.save()` | Explicit vs automatic saving |
| Device Sync | CloudKit | Different conflict resolution |
| Lazy relationships | Eager by default | Performance implications |
| Notifications | `@Query` observation | Different update patterns |

## Related Skills

- [swiftdata](/skills/persistence/swiftdata) — SwiftData implementation patterns
- [database-migration](/skills/persistence/database-migration) — Safe schema evolution
- [core-data-diag](/diagnostic/core-data-diag) — Core Data troubleshooting (if considering Core Data instead)

## Documentation Scope

This is a **reference skill** — comprehensive migration guide without mandatory workflows.

#### Reference includes
- Pattern equivalents catalog
- Threading model comparisons
- Schema migration strategies
- CloudKit sync patterns
- Real-world migration scenarios

## Urgency

#### Realm Device Sync sunsets September 30, 2025

After this date:
- No new Device Sync apps accepted
- Existing apps continue but deprecated
- Migration required for long-term support

Start migration planning now if using Realm Device Sync.

## Size

28 KB - Complete migration reference with pattern catalog
