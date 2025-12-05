# core-data-auditor

Automatically scans Core Data code for safety violations that cause production crashes and permanent data loss.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my Core Data code for safety issues?"
- "I'm about to ship an app with Core Data, can you review it?"
- "Review my code for Core Data migration risks"
- "Check for thread-confinement violations in my persistence layer"

**Explicit command:**
```bash
/axiom:audit-core-data
```

## What It Checks

1. **Schema Migration Safety** (CRITICAL) — Missing lightweight migration options
2. **Thread-Confinement Violations** (CRITICAL) — NSManagedObject accessed from wrong threads
3. **N+1 Query Patterns** (MEDIUM) — Relationship access in loops without prefetching
4. **Production Risk Patterns** (CRITICAL) — Hard-coded store deletion, try! on migration
5. **Performance Issues** (LOW) — Missing fetchBatchSize, no faulting controls

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: orange

## Related Skills

- **core-data-diag** skill — Comprehensive Core Data diagnostics with production crisis defense
