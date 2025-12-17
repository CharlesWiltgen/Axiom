---
name: core-data-diag
description: Schema migrations, thread-confinement, N+1 queries — systematic Core Data diagnostics with production crisis defense
---

# Core Data Diagnostics

Systematic Core Data troubleshooting with production crisis defense for 500K+ user data loss prevention.

## Overview

Diagnostic workflows for schema migration crashes, thread-confinement errors, N+1 query performance, and SwiftData bridging issues. Includes mandatory safety patterns for production migrations affecting hundreds of thousands of users.

## What This Diagnostic Covers

### Critical Production Issues

#### Schema Migration Crashes
- "Can't find model for source store" errors
- Migration failures on 10% of devices
- Data corruption after migration
- Version mismatch crashes
- Missing lightweight migration options

#### Thread-Confinement Errors
- "Object was created in different context" crashes
- Intermittent crashes when passing objects to tasks
- Background fetch crashes
- Main thread checker violations

#### N+1 Query Performance
- App freezing when scrolling lists
- Relationship access triggering hundreds of queries
- Missing prefetching hints
- Slow list rendering (>1s per row)

#### Production Crisis Scenarios
- 500K+ users affected by migration crash
- Data loss reports flooding support
- App Store rating dropping from 4.8 → 2.3
- Emergency hotfix required within hours

## When to Use This Diagnostic

Use this diagnostic when:
- Planning schema changes for production app
- Migration crashes reported in Crashlytics
- Thread-confinement errors in production logs
- App feels sluggish loading Core Data
- Before shipping migration to 100K+ users
- **Emergency**: Production crisis active

## Diagnostic Workflows

### Schema Migration Safety

```
1. Pre-Migration Validation (CRITICAL - 2 hours)
   ├─ Backup production data
   ├─ Test migration on 100+ device types
   ├─ Verify lightweight migration options set
   ├─ Test rollback to previous version
   └─ Monitor migration time (must be <10s)

2. Migration Testing Checklist
   ├─ Empty database → full migration ✓
   ├─ Partially migrated database → resume ✓
   ├─ Corrupted database → error handling ✓
   ├─ Network offline during migration ✓
   ├─ App killed during migration → recovery ✓
   └─ Downgrade to previous version → compatibility ✓

3. Production Rollout (Phased)
   ├─ Week 1: Internal testers (50 users)
   ├─ Week 2: Beta testers (500 users)
   ├─ Week 3: 5% of production (25K users)
   ├─ Week 4: 25% of production (125K users)
   └─ Week 5: 100% rollout if <0.1% crash rate
```

### Thread-Confinement Diagnosis

```
1. Enable Main Thread Checker
   - Edit Scheme → Diagnostics → Main Thread Checker ✓

2. Reproduce Issue
   - Find crash pattern
   - Identify object crossing thread boundary
   - Document call stack

3. Apply Fix Pattern
   ├─ Extract objectID before leaving context
   ├─ Fetch object on destination context
   ├─ Use value types for thread-safe data
   └─ Never pass NSManagedObject to Task/DispatchQueue
```

### N+1 Query Detection

```
1. Enable SQLite Debug Logging
   -com.apple.CoreData.SQLDebug 1

2. Profile with Instruments
   - Core Data instrument
   - Count fetch operations
   - Identify relationship access in loops

3. Add Prefetching
   fetchRequest.relationshipKeyPathsForPrefetching = ["relationship"]
```

## Production Crisis Defense

**Scenario**: Migration crash affecting 500K users, 2-hour hotfix window

**Emergency Protocol**:
1. **Stop the rollout** — Halt app updates immediately
2. **Triage severity** — Data loss vs crashes vs performance
3. **Quick fixes only**:
   - Skip migration, use old schema (if possible)
   - Add migration options if missing
   - Increase error handling, never delete store
4. **Communicate**: In-app message, support docs, social media
5. **Hotfix review**: Request expedited App Store review
6. **Monitor closely**: Crashlytics, user reports, ratings

**Never do in crisis**:
- ❌ Delete persistent store (100% data loss)
- ❌ Rewrite migration from scratch (high risk)
- ❌ Change multiple things at once (can't isolate issue)
- ❌ Deploy without testing on real devices

**Always do in crisis**:
- ✅ Add defensive error handling
- ✅ Test on 10+ real device configurations
- ✅ Have rollback plan ready
- ✅ Communicate transparently with users

## Safety-First Migration Patterns

#### Pattern 1: Lightweight Migration Only
```swift
let options = [
    NSMigratePersistentStoresAutomaticallyOption: true,
    NSInferMappingModelAutomaticallyOption: true
]
// NEVER delete store in production
```

#### Pattern 2: Additive Changes Only
```swift
// ✅ SAFE: Add optional property
// ❌ UNSAFE: Remove property, change type, add required property
```

#### Pattern 3: Test Migration Path
```swift
// Test v1 → v2, v1 → v3, v2 → v3
// Users may skip versions
```

#### Pattern 4: Never Delete Store
```swift
// ❌ NEVER in production
try? FileManager.default.removeItem(at: storeURL)

// ✅ Handle migration errors gracefully
catch {
    // Log error, show user message, keep old data
}
```

## Related Resources

- [audit-core-data](/commands/debugging/audit-core-data) — Quick automated scan
- [swiftdata](/skills/persistence/swiftdata) — Modern SwiftData patterns
- [database-migration](/skills/persistence/database-migration) — Safe schema evolution

## Documentation Scope

This is a **diagnostic skill** — mandatory workflows with production crisis defense.

#### Diagnostic includes
- Step-by-step troubleshooting
- Production crisis emergency protocols
- Safety-first migration patterns
- 500K+ user impact scenarios
- Phased rollout strategies

**Vs Reference**: Diagnostic skills enforce specific workflows and handle pressure scenarios. Reference skills provide comprehensive information without mandatory steps.

## Size

25 KB - Diagnostic workflows with production crisis defense
