# core-data-auditor

Scans Core Data code for safety violations, architectural gaps, and production risks that cause crashes, data loss, and performance degradation.

## How to Use

**Natural language (automatic triggering):**
- "Can you check my Core Data code for safety issues?"
- "I'm about to ship an app with Core Data, can you review it?"
- "Review my code for Core Data migration risks"
- "Check for thread-confinement violations in my persistence layer"

**Explicit command:**
```bash
/axiom:audit core-data
```

## What It Does

### Safety Violations
1. **Schema Migration Safety** (CRITICAL) — Missing lightweight migration options
2. **Thread-Confinement Violations** (CRITICAL) — NSManagedObject accessed from wrong threads
3. **N+1 Query Patterns** (MEDIUM) — Relationship access in loops without prefetching
4. **Production Risk Patterns** (CRITICAL) — Hard-coded store deletion, try! on migration
5. **Performance Issues** (LOW) — Missing fetchBatchSize, no faulting controls

### Completeness Checks
6. **Missing merge policy** — Conflicts crash instead of resolving
7. **Missing auto-merge from parent** — Stale UI after background saves
8. **Singleton context abuse** — viewContext used for background work
9. **Unsafe object passing** — NSManagedObject across threads instead of objectID
10. **Missing delete rules** — Orphaned data or unexpected cascades
11. **Save-per-insert pattern** — 100x slower than batch saves
12. **Fetch-then-delete loops** — 100x slower than batch deletes
13. **Fetching in view body** — Redundant queries on every render

### Health Score
Reports overall production readiness as **PRODUCTION READY**, **NEEDS HARDENING**, or **UNSAFE** with specific metrics.

## Related

- **core-data-diag** skill — Comprehensive Core Data diagnostics with production crisis defense; use to fix issues this auditor finds
- **database-migration** skill — Safe schema evolution patterns
- **concurrency-auditor** agent — Investigates thread-safety issues this auditor finds
- **swiftui-performance-analyzer** agent — Investigates N+1 query jank this auditor finds
