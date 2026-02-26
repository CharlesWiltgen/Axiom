# swiftdata-auditor

Scans SwiftData code for the 10 most critical violations — struct models, missing VersionedSchema, relationship defaults, migration timing, background context misuse, and N+1 patterns.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my SwiftData code for issues?"
- "Review my @Model definitions for correctness"
- "I'm about to ship with SwiftData, can you audit it?"
- "My SwiftData relationships keep crashing"

**Explicit command:**
```bash
/axiom:audit swiftdata
```

## What It Checks

1. **Struct models** (CRITICAL) — @Model requires class, not struct
2. **Missing VersionedSchema** (CRITICAL) — Required for safe schema migration
3. **Relationship defaults** (HIGH) — Default values on relationships cause issues
4. **Migration timing** (HIGH) — Migrations must run before first ModelContext access
5. **Background context misuse** (HIGH) — Thread-confinement violations
6. **N+1 patterns** (MEDIUM) — Relationship traversal without prefetching
7. **Missing indexes** (MEDIUM) — Slow queries on large datasets
8. **CloudKit compatibility** (MEDIUM) — Optional requirements for sync
9. **Missing cascade rules** (MEDIUM) — Orphaned related objects
10. **Fetch descriptor issues** (LOW) — Suboptimal predicate patterns

## Model & Tools

- **Model**: sonnet
- **Tools**: Glob, Grep, Read
- **Color**: green

## Related Skills

- **swiftdata** — SwiftData @Model, @Query, and CloudKit integration patterns
- **swiftdata-migration** — Custom schema migration strategies
- **swiftdata-migration-diag** — Migration crash troubleshooting
