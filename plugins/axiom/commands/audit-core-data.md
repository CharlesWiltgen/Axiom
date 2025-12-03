---
name: audit-core-data
description: Quick audit for Core Data safety violations - detects schema migration risks, thread-confinement violations, N+1 query patterns, missing lightweight migration options, and unsafe production patterns
allowed-tools: Glob(*.swift, *.xcdatamodeld), Grep(*)
---

# Core Data Safety Audit

I'll scan your Swift codebase and Core Data models for the 5 most common Core Data issues that cause production crashes and data loss.

## What This Command Does

Performs automated checks for:

1. **Schema Migration Safety** — Missing lightweight migration options, schema version mismatches
2. **Thread-Confinement Violations** — NSManagedObject accessed from wrong threads
3. **N+1 Query Patterns** — Relationship access in loops without prefetching
4. **Production Risk Patterns** — Delete store patterns, missing migration testing
5. **Performance Issues** — Missing batch sizes, no faulting controls

## Scan Categories

### 1. Schema Migration Safety (HIGH PRIORITY)

#### Looks for
- Missing `NSMigratePersistentStoresAutomaticallyOption`
- Missing `NSInferMappingModelAutomaticallyOption`
- Hard-coded store deletion (data loss risk)
- Schema changes without version increments

#### Pattern
```swift
// ❌ DANGER: Missing migration options
let coordinator = NSPersistentStoreCoordinator(managedObjectModel: model)
try coordinator.addPersistentStore(ofType: NSSQLiteStoreType,
                                    configurationName: nil,
                                    at: storeURL,
                                    options: nil)  // Missing migration options!

// ❌ DANGER: Deleting user data
try? FileManager.default.removeItem(at: storeURL)  // 100% data loss

// ✅ SAFE: Lightweight migration enabled
let options = [
    NSMigratePersistentStoresAutomaticallyOption: true,
    NSInferMappingModelAutomaticallyOption: true
]
```

**Severity** 🔴 **CRITICAL** — Can cause 100% production crashes or data loss

---

### 2. Thread-Confinement Violations (HIGH PRIORITY)

#### Looks for
- NSManagedObject accessed outside `perform/performAndWait`
- Objects passed between threads
- Background fetch without proper context usage

#### Pattern
```swift
// ❌ DANGER: Accessing object from wrong thread
DispatchQueue.global().async {
    let user = context.object(with: objectID) as! User
    print(user.name)  // Thread-confinement violation!
}

// ❌ DANGER: Passing object between threads
Task {
    await processUser(managedObject)  // Crossing thread boundary!
}

// ✅ SAFE: Proper context usage
backgroundContext.perform {
    let user = backgroundContext.object(with: objectID) as! User
    print(user.name)  // Safe - on correct thread
}
```

**Severity** 🔴 **CRITICAL** — Causes production crashes

---

### 3. N+1 Query Patterns (MEDIUM PRIORITY)

#### Looks for
- Relationship access inside loops
- Missing `relationshipKeyPathsForPrefetching`
- Fetch requests without prefetching hints

#### Pattern
```swift
// ❌ N+1 PROBLEM: Accessing relationship in loop
for user in users {
    print(user.posts.count)  // Fires 1 query per user = N+1!
}

// ✅ SOLUTION: Prefetch relationships
fetchRequest.relationshipKeyPathsForPrefetching = ["posts"]
let users = try context.fetch(fetchRequest)
for user in users {
    print(user.posts.count)  // No extra queries!
}
```

**Severity** 🟡 **MEDIUM** — Causes performance degradation

---

### 4. Production Risk Patterns (HIGH PRIORITY)

#### Looks for
- Delete store in production code paths
- Missing migration testing
- No error handling for store creation
- Simulator-only testing patterns

#### Pattern
```swift
// ❌ DANGER: Delete store in production
if let storeURL = container.persistentStoreDescriptions.first?.url {
    try? FileManager.default.removeItem(at: storeURL)
    // Users lose ALL data permanently
}

// ❌ DANGER: No error handling
try! coordinator.addPersistentStore(...)  // Will crash if migration fails

// ✅ SAFE: Proper error handling with fallback
do {
    try coordinator.addPersistentStore(ofType: NSSQLiteStoreType,
                                       configurationName: nil,
                                       at: storeURL,
                                       options: migrationOptions)
} catch {
    // Log error, show user message, attempt recovery
    handleMigrationFailure(error)
}
```

**Severity** 🔴 **CRITICAL** — Causes permanent data loss

---

### 5. Performance Issues (LOW PRIORITY)

#### Looks for
- Missing `fetchBatchSize`
- Missing `returnsObjectsAsFaults`
- Large result sets without batching

#### Pattern
```swift
// ❌ PERFORMANCE ISSUE: No batch size
let fetchRequest = NSFetchRequest<User>(entityName: "User")
// Loading all 10,000 users into memory at once!

// ✅ BETTER: Use batch size
fetchRequest.fetchBatchSize = 20
// Loads 20 at a time - lower memory usage
```

**Severity** 🟢 **LOW** — Causes memory pressure but not crashes

---

## Execution Steps

1. **Glob for relevant files**
```
**/*.swift (Core Data code)
**/*.xcdatamodeld (schema models)
```

2. **For each file, grep for patterns**

#### Schema migration safety
```regex
NSPersistentStoreCoordinator
addPersistentStore
NSMigratePersistentStoresAutomaticallyOption
NSInferMappingModelAutomaticallyOption
FileManager.*removeItem.*storeURL
```

#### Thread-confinement
```regex
DispatchQueue.*NSManagedObject
Task.*NSManagedObject
context\.perform
performAndWait
```

#### N+1 queries
```regex
for\s+\w+\s+in.*\{[\s\S]*?\.\w+\.count
for\s+\w+\s+in.*\{[\s\S]*?\.\w+\.first
relationshipKeyPathsForPrefetching
```

#### Production risks
```regex
FileManager.*removeItem.*persistent
try!\s+.*addPersistentStore
try!\s+.*coordinator
```

#### Performance
```regex
fetchBatchSize
returnsObjectsAsFaults
NSFetchRequest
```

3. **Analyze findings**
   - Count occurrences per category
   - Flag critical patterns (data loss, crashes)
   - Calculate risk score

4. **Generate report**

```
Core Data Safety Audit Results
==============================

Summary:
  🔴 CRITICAL Issues: 3 found
  🟡 MEDIUM Issues: 2 found
  🟢 LOW Issues: 1 found

CRITICAL - Immediate Action Required:
  ⚠️  Line 45 in AppDelegate.swift: Missing lightweight migration options
      Risk: 100% production crash on schema change
      Fix: Add NSMigratePersistentStoresAutomaticallyOption

  ⚠️  Line 67 in DataManager.swift: Hard-coded store deletion
      Risk: Permanent user data loss
      Fix: Remove FileManager.removeItem or gate behind debug flag

  ⚠️  Line 123 in UserService.swift: Thread-confinement violation
      Risk: Production crash when accessing from background
      Fix: Use backgroundContext.perform { }

MEDIUM - Performance Degradation:
  ⚠️  Line 89 in UserListView.swift: N+1 query pattern
      Impact: 1000 users = 1000 extra queries
      Fix: Add relationshipKeyPathsForPrefetching = ["posts"]

  ⚠️  Line 201 in DataSync.swift: N+1 query in sync loop
      Impact: Sync takes 30 seconds instead of 3 seconds
      Fix: Prefetch relationships before loop

LOW - Optimization Opportunities:
  ℹ️  Line 45 in FetchController.swift: Missing fetchBatchSize
      Impact: Higher memory usage with large result sets
      Fix: Add fetchRequest.fetchBatchSize = 20

Risk Score: 8/10 (CRITICAL issues present)

Next Steps:
  1. Fix all CRITICAL issues before next release
  2. Use /skill core-data-diag for detailed diagnosis
  3. Test migration on real device with production data copy
  4. Add Core Data unit tests for migration safety
```

---

## Output Format

#### For each issue
1. Severity indicator (🔴/🟡/🟢)
2. File path and line number
3. Code snippet showing problem
4. Risk explanation
5. Fix recommendation with example code

#### Summary at end
- Risk score (0-10)
- Prioritized action items
- Links to relevant skills

---

## Example Output

```
=== Core Data Audit: AppDelegate.swift ===

🔴 CRITICAL - Line 45: Missing lightweight migration options
  Current:
    try coordinator.addPersistentStore(
        ofType: NSSQLiteStoreType,
        configurationName: nil,
        at: storeURL,
        options: nil  // ❌ Missing migration options
    )

  Risk:
    When you add a new Core Data attribute/entity, 100% of existing
    users will crash on app launch with:
    "The model used to open the store is incompatible with the one
     used to create the store"

  Fix [IMMEDIATE]:
    let options = [
        NSMigratePersistentStoresAutomaticallyOption: true,
        NSInferMappingModelAutomaticallyOption: true
    ]
    try coordinator.addPersistentStore(
        ofType: NSSQLiteStoreType,
        configurationName: nil,
        at: storeURL,
        options: options  // ✅ Enables automatic lightweight migration
    )

  Impact: Prevents 100% crash rate on schema changes
  Time to fix: 5 minutes
  Must fix before: Next schema change

---

=== Core Data Audit: DataManager.swift ===

🔴 CRITICAL - Line 67: Hard-coded store deletion
  Current:
    if let storeURL = container.persistentStoreDescriptions.first?.url {
        try? FileManager.default.removeItem(at: storeURL)
    }

  Risk:
    Every user who runs this code path loses ALL their data permanently.
    Recovery impossible.

    Typical scenario: 10,000 users → 10,000 uninstalls + 1-star reviews

  Fix [IMMEDIATE]:
    Option 1: Remove this code entirely
    Option 2: Gate behind debug flag:
        #if DEBUG
        try? FileManager.default.removeItem(at: storeURL)
        #endif

  Impact: Prevents permanent data loss for all users
  Time to fix: 2 minutes
  Must fix before: Any production release

---

Summary:
  - 2 critical issues requiring immediate fixes
  - Combined fix time: 7 minutes
  - Risk score: 8/10 without fixes, 2/10 after fixes

For implementation details: /skill core-data-diag
```

---

## Implementation Notes

#### Risk Score Calculation
- Each 🔴 CRITICAL issue: +3 points
- Each 🟡 MEDIUM issue: +1 point
- Each 🟢 LOW issue: +0.5 points
- Maximum score: 10

#### Priority Levels
- **CRITICAL**: Must fix before production release (data loss, crashes)
- **MEDIUM**: Fix in next sprint (performance degradation)
- **LOW**: Optimize when convenient (memory pressure)

#### False Positive Handling
- Thread-confinement: May flag intentional thread switches (verify with perform block)
- N+1 queries: May flag small loops (< 10 iterations) that don't need optimization
- Delete store: If behind debug flag or one-time migration, may be intentional

---

## Cross-References

After audit, use these skills for fixes:

- `/skill core-data-diag` - Comprehensive Core Data diagnostics with production crisis defense
- `/skill database-migration` - Safe schema evolution for SQLite/GRDB
- `/skill swiftdata` - SwiftData patterns (if considering migration)

---

## Requirements

- **Core Data** stack in Swift codebase
- **Xcode** project with .xcdatamodeld files
- **Production app** or preparing for production release
