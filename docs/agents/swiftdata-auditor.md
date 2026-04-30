# swiftdata-auditor

Scans SwiftData code for safety violations and architectural gaps — from known anti-patterns like struct models, missing VersionedSchema registration, and array-relationships without defaults to architectural issues like CloudKit conformance gaps, stale predicates, and missing recovery paths for failed migrations.

## What It Does

- Detects 10 known anti-patterns (@Model struct, missing schema registration, array relationships without defaults, fetch in didMigrate, @Environment context in background tasks, missing save() after mutations, both-sides bidirectional updates, N+1 in relationship loops, over-indexing, batch inserts without chunking)
- Identifies architectural gaps (orphan @Model classes not registered, migration plan gaps to oldest supported version, CloudKit conformance failures, stale #Predicate strings after renames, external-storage cleanup leaks, accidental `eraseDatabaseOnSchemaChange` in production, App Group disk-location mismatches)
- Correlates findings that compound into higher severity (struct model + array relationship, schema misregistration + production users, race + data loss, over-indexing + insert-heavy loops)
- Produces a SwiftData Health Score (SAFE / FRAGILE / DANGEROUS)

## How to Use

**Natural language:**
- "Can you check my SwiftData code for issues?"
- "Review my @Model definitions for correctness"
- "I'm about to ship with SwiftData, can you audit it?"
- "My SwiftData relationships keep crashing"

**Explicit command:**
```bash
/axiom:audit swiftdata
```

## Related

- **swiftdata** skill — use to fix issues this auditor finds, including @Model patterns, @Query usage, and CloudKit integration
- **swiftdata-migration** skill — schema migration strategies, VersionedSchema design, and stage planning
- **swiftdata-migration-diag** skill — migration crash troubleshooting
- **database-schema-auditor** agent — overlaps on the SQLite layer underneath SwiftData
- **core-data-auditor** agent — overlaps when projects mix Core Data and SwiftData
- **icloud-auditor** agent — overlaps on CloudKit-synced @Model classes
- **swiftui-performance-analyzer** agent — overlaps on @Query in heavy views
- **health-check** agent — includes swiftdata-auditor in project-wide scans
