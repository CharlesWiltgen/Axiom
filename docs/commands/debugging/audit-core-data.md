---
name: audit-core-data
description: Quick audit for Core Data safety violations — detects schema migration risks, thread-confinement violations, N+1 query patterns, missing lightweight migration options, and unsafe production patterns
allowed-tools: Glob(*.swift, *.xcdatamodeld), Grep(*)
---

# Core Data Safety Audit

Scan your Swift codebase and Core Data models for the 5 most common Core Data issues that cause production crashes and data loss.

## What This Command Checks

1. **Schema Migration Safety** — Missing lightweight migration options, schema version mismatches
2. **Thread-Confinement Violations** — NSManagedObject accessed from wrong threads
3. **N+1 Query Patterns** — Relationship access in loops without prefetching
4. **Production Risk Patterns** — Delete store patterns, missing migration testing
5. **Performance Issues** — Missing batch sizes, no faulting controls

## When to Use

Run this command when:
- Adding new Core Data entities or attributes
- Before shipping production releases
- After seeing intermittent crashes in production
- When users report data loss or corruption
- Before migrating to a new Core Data schema version

## Issue Categories

### 🔴 Critical Issues (Crashes/Data Loss)

#### Schema Migration Safety
- Missing `NSMigratePersistentStoresAutomaticallyOption`
- Store deletion without migration path (100% data loss)
- Schema changes without version increments

#### Thread-Confinement Violations
- NSManagedObject accessed outside `perform/performAndWait`
- Objects passed between threads or actors
- Background fetch without proper context usage

### 🟡 Medium Priority (Performance)

#### N+1 Query Patterns
- Relationship access inside loops
- Missing `relationshipKeyPathsForPrefetching`
- Fetch requests that trigger hundreds of queries

#### Production Risk Patterns
- Hard-coded store paths
- Missing migration unit tests
- No rollback strategy for failed migrations

### 🟢 Low Priority (Optimization)

#### Performance Issues
- Missing fetch batch sizes
- No faulting controls on large datasets
- Inefficient predicate patterns

## Running the Audit

```bash
# In Claude Code
/audit-core-data
```

The command will:
1. Find all Swift files and Core Data models
2. Scan for the 5 issue categories above
3. Report findings with `file:line` references
4. Prioritize by severity (Critical → Low)
5. Link to relevant sections in the [core-data-diag](/diagnostic/core-data-diag) skill

## Example Output

```
🔴 CRITICAL: Schema Migration Safety (3 issues)
  - AppDelegate.swift:45 - Missing migration options
  - CoreDataStack.swift:23 - Store deletion detected
  - User.xcdatamodeld — Schema version not incremented

🟡 MEDIUM: N+1 Query Patterns (7 issues)
  - UserListView.swift:67 - Relationship access in loop
  - PostsViewController.swift:102 - Missing prefetch

🟢 LOW: Performance Issues (2 issues)
  - FetchController.swift:34 - Missing batch size
```

## Next Steps

After running the audit:

1. **Fix Critical issues immediately** — These cause production crashes
2. **Review Medium issues** — Address before next release
3. **Document Low issues** — Add to technical debt backlog

For detailed fix guidance, use the [core-data-diag](/diagnostic/core-data-diag) skill:

```
"How do I fix these Core Data migration issues?"
```

The skill provides:
- Safe migration patterns
- Thread-confinement solutions
- N+1 query prevention
- Production crisis defense strategies

## Real-World Impact

#### Before audit
- 2-5 hours debugging intermittent crashes
- Data loss discovered in production
- Migration failures affecting 500K+ users

#### After audit
- 2-5 minutes to identify issues
- Catch problems before production
- Proactive migration testing prevents data loss

Run this command before every release to catch Core Data regressions early.
