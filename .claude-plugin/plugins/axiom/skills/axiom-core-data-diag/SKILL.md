---
name: axiom-core-data-diag
description: Use when debugging schema migration crashes, concurrency thread-confinement errors, N+1 query performance, SwiftData to Core Data bridging, or testing migrations without data loss - systematic Core Data diagnostics with safety-first migration patterns
user-invocable: false
skill_type: diagnostic
version: 1.0.0
---

# Core Data Diagnostics & Migration

## Overview

Core Data issues manifest as production crashes from schema mismatches, mysterious concurrency errors, performance degradation under load, and data corruption from unsafe migrations. **Core principle** 85% of Core Data problems stem from misunderstanding thread-confinement, schema migration requirements, and relationship query patterns—not Core Data defects.

## Red Flags — Suspect Core Data Issue

If you see ANY of these, suspect a Core Data misunderstanding, not framework breakage:
- Crash on production launch: "Unresolvable fault" after schema change
- Thread-confinement error: "Accessing NSManagedObject on a different thread"
- App suddenly slow after adding a User→Posts relationship
- SwiftData app needs complex features; considering mixing Core Data alongside
- Schema migration works in simulator but crashes on production
- ❌ **FORBIDDEN** "Core Data is broken, we need a different database"
  - Core Data handles trillions of records in production apps
  - Schema mismatches and thread errors are always developer code, not framework
  - Do not rationalize away the issue—diagnose it

**Critical distinction** Simulator deletes the database on each rebuild, hiding schema mismatch issues. Real devices keep persistent databases and crash immediately on schema mismatch. **MANDATORY: Test migrations on real device with real data before shipping.**

## Mandatory First Steps

**ALWAYS run these FIRST** (before changing code):

```swift
// 1. Identify the crash/issue type
// Screenshot the crash message and note:
//   - "Unresolvable fault" = schema mismatch
//   - "different thread" = thread-confinement
//   - Slow performance = N+1 queries or fetch size issues
//   - Data corruption = unsafe migration
// Record: "Crash type: [exact message]"

// 2. Check if it's schema mismatch
// Compare these:
let coordinator = persistentStoreCoordinator
let model = coordinator.managedObjectModel
let store = coordinator.persistentStores.first

// Get actual store schema version:
do {
    let metadata = try NSPersistentStoreCoordinator.metadataForPersistentStore(
        ofType: NSSQLiteStoreType,
        at: storeURL,
        options: nil
    )
    print("Store version identifier: \(metadata[NSStoreModelVersionIdentifiersKey] ?? "unknown")")

    // Get app's current model version:
    print("App model version: \(model.versionIdentifiers)")

    // If different = schema mismatch
} catch {
    print("Schema check error: \(error)")
}
// Record: "Store version vs. app model: match or mismatch?"

// 3. Check thread-confinement for concurrency errors
// For any NSManagedObject access:
print("Main thread? \(Thread.isMainThread)")
print("Context concurrency type: \(context.concurrencyType.rawValue)")
print("Accessing from: \(Thread.current)")
// Record: "Thread mismatch? Yes/no"

// 4. Profile relationship access for N+1 problems
// In Xcode, run with arguments:
// -com.apple.CoreData.SQLDebug 1
// Check Console for SQL queries:
//   SELECT * FROM USERS;  (1 query)
//   SELECT * FROM POSTS WHERE user_id = 1;  (1 query per user = N+1!)
// Record: "N+1 found? Yes/no, how many extra queries"

// 5. Check SwiftData vs. Core Data confusion
if #available(iOS 17.0, *) {
    // If using SwiftData @Model + Core Data simultaneously:
    // Error: "Store is locked" or "EXC_BAD_ACCESS"
    // = trying to access same database from both layers
    print("Using both SwiftData and Core Data on same store?")
}
// Record: "Mixing SwiftData + Core Data? Yes/no"
```

#### What this tells you
- **Schema mismatch** → Proceed to Pattern 1 (lightweight migration decision)
- **Thread-confinement error** → Proceed to Pattern 2 (async/await concurrency)
- **N+1 queries** → Proceed to Pattern 3 (relationship prefetching)
- **SwiftData + Core Data conflict** → Proceed to Pattern 4 (bridging)
- **Slow after migration** → Proceed to Pattern 5 (testing safety)

#### MANDATORY INTERPRETATION

Before changing ANY code, identify ONE of these:

1. If crash is "Unresolvable fault" AND store/model versions differ → Schema mismatch (not user error)
2. If crash mentions "different thread" AND you're using DispatchQueue → Thread-confinement (not thread-safe design)
3. If performance degrades with relationship access → N+1 queries (check SQL log)
4. If SwiftData and Core Data code exist together → Conflicting data layers (architectural issue)
5. If migration test passes but production fails → Edge case in real data (testing gap)

#### If diagnostics are contradictory or unclear
- STOP. Do NOT proceed to patterns yet
- Add print statements to every NSManagedObject access (thread check)
- Add `-com.apple.CoreData.SQLDebug 1` and count SQL queries
- Establish baseline: what's actually happening vs. what you assumed

## Decision Tree

```
Core Data problem suspected?
├─ Crash: "Unresolvable fault"?
│  └─ YES → Schema mismatch (store ≠ app model)
│     ├─ Add new required field? → Pattern 1a (lightweight migration)
│     ├─ Remove field, rename, or change type? → Pattern 1b (heavy migration)
│     └─ Don't know how to fix? → Pattern 1c (testing safety)
│
├─ Crash: "different thread"?
│  └─ YES → Thread-confinement violated
│     ├─ Using DispatchQueue for background work? → Pattern 2a (async context)
│     ├─ Mixing Core Data with async/await? → Pattern 2b (structured concurrency)
│     └─ SwiftUI @FetchRequest causing issues? → Pattern 2c (@FetchRequest safety)
│
├─ Performance: App became slow?
│  └─ YES → Likely N+1 queries
│     ├─ Accessing user.posts in loop? → Pattern 3a (prefetching)
│     ├─ Large result set? → Pattern 3b (batch sizing)
│     └─ Just added relationships? → Pattern 3c (relationship tuning)
│
├─ Using both SwiftData and Core Data?
│  └─ YES → Data layer conflict
│     ├─ Need Core Data features SwiftData lacks? → Pattern 4a (drop to Core Data)
│     ├─ Already committed to SwiftData? → Pattern 4b (stay in SwiftData)
│     └─ Unsure which to use? → Pattern 4c (decision framework)
│
└─ Migration works locally but crashes in production?
   └─ YES → Testing gap
      ├─ Didn't test with real data? → Pattern 5a (production testing)
      ├─ Schema change affects large dataset? → Pattern 5b (migration safety)
      └─ Need verification before shipping? → Pattern 5c (pre-deployment checklist)
```

## Common Patterns

### Pattern Selection Rules (MANDATORY)

#### Apply ONE pattern at a time, starting with diagnostics

1. **Always start with Mandatory First Steps** — Identify the actual problem
2. **Run decision tree** — Narrow to specific pattern
3. **Apply ONE pattern** — Don't combine patterns
4. **Test on real device** — Simulator hides issues
5. **Verify with migration test** — Before deploying

#### FORBIDDEN
- ❌ Changing code without diagnostics
- ❌ Skipping real device testing
- ❌ Using simulator success as proof of migration safety
- ❌ Mixing multiple migration patterns
- ❌ Deploying migrations without pre-deployment verification

---

### Pattern 1a: Lightweight Migration (Simple Schema Changes)

**PRINCIPLE** Core Data can automatically migrate simple schemas (additive changes) without data loss if done correctly.

#### ✅ SAFE Lightweight Migrations
- Adding new optional field: `@NSManaged var nickname: String?`
- Adding new required field WITH default: Create attribute with default value
- Renaming entity or attribute: Use mapping model with automatic mapping
- Removing unused field: Just delete from model (data stays on disk, ignored)

#### ❌ WRONG (Crashes production)
```swift
// BAD: Adding required field without migration
@NSManaged var userID: String  // Required, no default

// BAD: Assuming simulator = production
// Works in simulator (deletes DB), crashes on real device

// BAD: Modifying field type
@NSManaged var createdAt: Date  // Was String, now Date
// Core Data can't automatically convert
```

#### ✅ CORRECT (Safe lightweight migration)
```swift
// 1. In Xcode: Editor → Add Model Version
// Creates new .xcdatamodel version file

// 2. In new version, add required field WITH default:
@NSManaged var userID: String = UUID().uuidString

// 3. Mark as current model version:
// File Inspector → Versioned Core Data Model
// Check "Current Model Version"

// 4. Test:
// Simulate old version: delete app, copy old database, run with new code
// Real app loads → migration succeeded

// 5. Deploy when confident
```

#### When this works
- Adding optional fields (always safe)
- Adding required fields WITH default values
- Removing fields
- Renaming entities/attributes with mapping model

#### When this FAILS (don't try lightweight)
- Changing field type (String → Int)
- Making optional field required (data has nulls, can't convert)
- Complex relationship changes
- Custom data transformations needed

**Time cost** 5-10 minutes for lightweight migration setup

---

### Pattern 1b: Heavy Migration (Complex Schema Changes)

**PRINCIPLE** When lightweight migration won't work, use NSEntityMigrationPolicy for custom transformation logic.

#### Use when
- Changing field types (String → Date)
- Making optional required (need to populate existing nulls)
- Complex relationship restructuring
- Custom data transformations (e.g., split "firstName lastName" into separate fields)

#### Example: Convert String dates to Date objects

```swift
// 1. Create mapping model
// File → New → Mapping Model
// Source: old version, Destination: new version

// 2. Create custom migration policy
class DateMigrationPolicy: NSEntityMigrationPolicy {
    override func createDestinationInstances(
        forSource sInstance: NSManagedObject,
        in mapping: NSEntityMapping,
        manager: NSMigrationManager
    ) throws {
        let destination = NSEntityDescription.insertNewObject(
            forEntityName: mapping.destinationEntityName ?? "",
            into: manager.destinationContext
        )

        for key in sInstance.entity.attributesByName.keys {
            destination.setValue(sInstance.value(forKey: key), forKey: key)
        }

        // Custom transformation: String → Date
        if let dateString = sInstance.value(forKey: "createdAt") as? String,
           let date = ISO8601DateFormatter().date(from: dateString) {
            destination.setValue(date, forKey: "createdAt")
        } else {
            destination.setValue(Date(), forKey: "createdAt")
        }

        manager.associate(source: sInstance, withDestinationInstance: destination, for: mapping)
    }
}

// 3. In mapping model Inspector:
// Set Custom Policy Class: DateMigrationPolicy

// 4. Test extensively with real data before shipping
```

#### Critical safety rules
- ALWAYS backup database before testing migration
- Test migration on COPY of production data
- Verify data integrity after migration (spot checks)
- Create rollback plan if migration fails

**Time cost** 30-60 minutes per migration + testing

---

### Pattern 2a: Async Context for Background Fetching

**PRINCIPLE** Core Data objects are thread-confined. Fetch on background thread, convert to lightweight representations for main thread.

#### ❌ WRONG (Thread-confinement crash)
```swift
DispatchQueue.global().async {
    let context = NSManagedObjectContext(concurrencyType: .mainQueueConcurrencyType)
    let results = try! context.fetch(request)

    DispatchQueue.main.async {
        self.objects = results  // ❌ CRASH: objects faulted on background thread
    }
}
```

#### ✅ CORRECT (Use private queue context for background work)
```swift
// Create background context
let backgroundContext = NSManagedObjectContext(concurrencyType: .privateQueueConcurrencyType)
backgroundContext.parent = viewContext

// Fetch on background thread
backgroundContext.perform {
    do {
        let results = try backgroundContext.fetch(userRequest)

        // Convert to lightweight representation BEFORE main thread
        let userIDs = results.map { $0.id }  // Just the IDs, not full objects

        DispatchQueue.main.async {
            // On main thread, fetch full objects from main context
            let mainResults = try self.viewContext.fetch(request)
            self.objects = mainResults
        }
    } catch {
        print("Fetch error: \(error)")
    }
}
```

#### Why this works
- Background context fetches on background thread (safe)
- Converts heavy objects to lightweight values (safe to pass to main)
- Main context fetches on main thread (safe)
- No thread-confined objects crossing thread boundaries

**Time cost** 10 minutes to restructure

---

### Pattern 2b: Structured Concurrency (async/await with Core Data)

**PRINCIPLE** Use NSPersistentContainer or NSManagedObjectContext async methods for Swift Concurrency compatibility.

#### ✅ CORRECT (iOS 13+ async APIs)
```swift
// iOS 13+: Use async perform
let users = try await viewContext.perform {
    try viewContext.fetch(userRequest)
}
// Executes fetch on correct thread, returns to caller

// iOS 17+: Use Swift Concurrency async/await directly
let users = try await container.mainContext.fetch(userRequest)

// For background work:
let backgroundUsers = try await backgroundContext.perform {
    try backgroundContext.fetch(userRequest)
}
// Fetch happens on background queue, thread-safe
```

#### ❌ WRONG (Mixing Swift Concurrency with DispatchQueue)
```swift
async {
    DispatchQueue.global().async {
        try context.fetch(request)  // ❌ Wrong thread!
    }
}
```

**Time cost** 5 minutes to convert from DispatchQueue to async/await

---

### Pattern 3a: Relationship Prefetching (Prevent N+1)

**PRINCIPLE** Tell Core Data to fetch relationships eagerly instead of lazy-loading on access.

#### ❌ WRONG (N+1 query pattern)
```swift
let users = try context.fetch(userRequest)

for user in users {
    let posts = user.posts  // ❌ Triggers fetch for EACH user!
    // 1 fetch for users + N fetches for relationships = N+1 total
}
```

#### ✅ CORRECT (Prefetch relationships)
```swift
var request = NSFetchRequest<User>(entityName: "User")

// Tell Core Data to fetch relationships eagerly
request.relationshipKeyPathsForPrefetching = ["posts", "comments"]
// Now relationships are fetched in a single query per relationship

let users = try context.fetch(request)

for user in users {
    let posts = user.posts  // ✅ INSTANT: Already fetched
    // Total: 1 fetch for users + 1 fetch for all posts = 2 queries
}
```

#### Other optimization patterns
```swift
// Batch size: fetch in chunks for large result sets
request.fetchBatchSize = 100

// Faulting behavior: convert faults to lightweight snapshots
request.returnsObjectsAsFaults = false  // Keep objects in memory
// Use carefully—can cause memory pressure with large results

// Distinct: remove duplicates from relationship fetches
request.returnsDistinctResults = true
```

**Time cost** 2-5 minutes to add prefetching

---

### Pattern 3b: Fetch Batch Sizing

**PRINCIPLE** For large result sets, fetch in batches to manage memory.

#### Example: Scrolling through 100,000 users

```swift
var request = NSFetchRequest<User>(entityName: "User")
request.fetchBatchSize = 100  // Fetch 100 at a time

// Set sort descriptor for stable pagination
request.sortDescriptors = [NSSortDescriptor(key: "id", ascending: true)]

let results = try context.fetch(request)
// Memory footprint: ~100 users at a time, not all 100,000

for user in results {
    // Accessing user 0-99: in memory
    // Accessing user 100: batch refetch (user 100-199)
    // Auto-pagination, minimal memory usage
}
```

**Time cost** 3 minutes to tune batch size

---

### Pattern 4a: Core Data Features SwiftData Doesn't Have

**Scenario** You chose SwiftData, but need features it lacks.

#### SwiftData lacks
- Complex migrations (auto-migration only)
- Custom validation (before save)
- Relationship delete rules (cascade, deny, nullify)
- Direct SQL queries
- Advanced prefetching
- Faulting control

#### When to drop to Core Data from SwiftData
- Need custom migrations
- Need validation logic
- Need complex relationship rules
- Need raw SQL for performance
- Need fault tolerance patterns

#### ✅ CORRECT (Hybrid approach when necessary)
```swift
// Keep SwiftData for simple entities
@Model final class Note {
    var id: String
    var title: String
}

// Drop to Core Data for complex operations
let backgroundContext = NSManagedObjectContext(concurrencyType: .privateQueueConcurrencyType)
backgroundContext.parent = container.viewContext

// Fetch with Core Data, convert to SwiftData models
let results = try backgroundContext.perform {
    try backgroundContext.fetch(coreDataRequest)
}
```

**CRITICAL** Do NOT access the same entity from both SwiftData and Core Data simultaneously. One or the other, not both.

**Time cost** 30-60 minutes to create bridging layer

---

### Pattern 4b: Stay in SwiftData (Recommended for New Projects)

**Scenario** You're in SwiftData and wondering if you need Core Data.

#### SwiftData provides 80% of Core Data functionality for modern apps
- Type-safe models (@Model)
- Reactive queries (@Query)
- CloudKit sync (built-in)
- Automatic migrations (for simple changes)
- Proper async/await integration

#### When SwiftData is sufficient
- Simple schemas (users, notes, todos)
- Minimal relationship complexity
- CloudKit sync needed
- iOS 17+ requirement acceptable
- No legacy Core Data code to maintain

#### Decision: Stay in SwiftData if you can answer YES to 3+ of these
- ✅ iOS 17+ only (no iOS 16 support needed)
- ✅ Simple relationships (1-to-many, not many-to-many)
- ✅ Standard migrations (add fields, remove fields)
- ✅ CloudKit sync beneficial
- ✅ Type safety important

#### Decision: Drop to Core Data if
- ❌ Need iOS 16 support (SwiftData iOS 17+ only)
- ❌ Complex relationship rules (cascade rules, constraints)
- ❌ Custom migrations required
- ❌ Raw SQL needed for performance
- ❌ Already have Core Data codebase

**Time cost** 0 minutes (decision only)

---

### Pattern 5a: Safe Production Testing Before Migration

**PRINCIPLE** Never deploy a migration without testing against real data.

#### MANDATORY Pre-Deployment Checklist

```swift
// Step 1: Export production database
// From running app in simulator or real device:
// ~/Library/Developer/CoreData/[AppName]/
// Copy entire [AppName].sqlite database

// Step 2: Create migration test
@Test func testProductionDataMigration() throws {
    // Copy production database to test location
    let testDB = tempDirectory.appendingPathComponent("test.sqlite")
    try FileManager.default.copyItem(from: prodDatabase, to: testDB)

    // Attempt migration
    var config = ModelConfiguration(url: testDB, isStoredInMemory: false)
    let container = try ModelContainer(for: User.self, configurations: [config])

    // Verify data integrity
    let context = container.mainContext
    let allUsers = try context.fetch(FetchDescriptor<User>())

    // Spot checks: verify specific records migrated correctly
    guard let user1 = allUsers.first(where: { $0.id == "test-id-1" }) else {
        throw MigrationError.missingUser
    }

    // Check derived data is correct
    XCTAssertEqual(user1.name, "Expected Name")
    XCTAssertNotNil(user1.createdAt)

    // Check relationships
    XCTAssertEqual(user1.posts.count, expectedPostCount)
}

// Step 3: Run test against real production data
// Pass ✓ before shipping
```

#### Safety rules
- ❌ NEVER test migrations with simulator (simulator deletes DB)
- ✅ ALWAYS test with copy of real production data
- ✅ ALWAYS verify spot checks (specific records)
- ✅ ALWAYS check relationships loaded correctly
- ✅ ALWAYS have rollback plan documented

**Time cost** 15-30 minutes to create migration test

---

### Pattern 5c: Pre-Deployment Verification Checklist

#### MANDATORY before shipping ANY Core Data change

- [ ] Did you create a new .xcdatamodel version? (Not just editing the existing one)
- [ ] Does the new version have a mapping model if needed?
- [ ] Did you test migration with real production data? (Not simulator)
- [ ] Did you verify 5+ specific records migrated correctly?
- [ ] Did you check relationships loaded?
- [ ] Did you test on real device (oldest supported)?
- [ ] Does app launch without crashing? (Fresh install)
- [ ] Does app launch with old data? (Migration path)
- [ ] Is rollback plan documented? (In case production fails)

#### If you answer NO to any item
- ❌ DO NOT SHIP
- Go back, fix the issue, re-test
- One "NO" = data loss risk

**Time cost** 5 minutes checklist

---

## Quick Reference Table

| Issue | Check | Fix |
|-------|-------|-----|
| "Unresolvable fault" crash | Do store/model versions match? | Create .xcdatamodel version + mapping model |
| "Different thread" crash | Is fetch happening on main thread? | Use private queue context for background work |
| App became slow | Are relationships being prefetched? | Add relationshipKeyPathsForPrefetching |
| N+1 query performance | Check `-com.apple.CoreData.SQLDebug 1` logs | Add prefetching or convert to lightweight representation |
| SwiftData needs Core Data features | Do you need custom migrations? | Use Core Data NSEntityMigrationPolicy |
| Not sure about SwiftData vs. Core Data | Do you need iOS 16 support? | Use Core Data for iOS 16, SwiftData for iOS 17+ |
| Migration test works, production fails | Did you test with real data? | Create migration test with production database copy |

---

## When You're Stuck After 30 Minutes

If you've spent >30 minutes and the Core Data issue persists:

#### STOP. You either
1. Skipped mandatory diagnostics (most common)
2. Misidentified the actual problem
3. Applied wrong pattern for your symptom
4. Haven't tested on real device/real data
5. Have edge case requiring custom NSEntityMigrationPolicy

#### MANDATORY checklist before claiming "skill didn't work"

- [ ] I ran all Mandatory First Steps diagnostics
- [ ] I identified the problem type (schema, concurrency, performance, bridging, testing)
- [ ] I checked Core Data SQL debug logs (`-com.apple.CoreData.SQLDebug 1`)
- [ ] I tested on real device with real data (not simulator)
- [ ] I applied the FIRST matching pattern from Decision Tree
- [ ] I created a migration test if schema changed
- [ ] I verified at least 3 specific records migrated correctly
- [ ] I have a rollback plan documented

#### If ALL boxes are checked and still broken
- You need custom NSEntityMigrationPolicy (not covered by basic patterns)
- Time cost: 60-90 minutes for complex migration
- Ask: "What data transformation is actually needed?" and implement custom policy

#### Time cost transparency
- Pattern 1 (lightweight migration): 5-10 minutes
- Pattern 1 (heavy migration with custom policy): 60-90 minutes
- Pattern 2 (concurrency): 5-10 minutes
- Pattern 3 (prefetching): 2-5 minutes
- Pattern 4 (bridging): 30-60 minutes
- Pattern 5 (testing): 15-30 minutes

---

## Common Mistakes

❌ **Testing migration in simulator only**
- Simulator deletes database on rebuild, hiding schema mismatches
- Fix: ALWAYS test on real device or with production database copy

❌ **Assuming default values protect against data loss**
- Default values only work for new records, not existing data
- Fix: Use NSEntityMigrationPolicy for existing data

❌ **Accessing Core Data objects across threads without conversion**
- Objects are thread-confined, can't cross thread boundaries
- Fix: Convert to lightweight representations before passing to other threads

❌ **Not realizing relationship access = database query**
- `user.posts` triggers a fetch for EACH user (N+1)
- Fix: Use relationshipKeyPathsForPrefetching or extract IDs first

❌ **Mixing SwiftData and Core Data on same store**
- Both layers can't access the same database simultaneously
- Fix: Choose one layer, or use hybrid approach with separate entities

❌ **Deploying migrations without pre-deployment testing**
- Edge cases in production data cause crashes
- Fix: MANDATORY migration test with real production data

❌ **Rationalizing: "I'll just delete the data"**
- ❌ FORBIDDEN: Users won't appreciate losing their data
- Users uninstall and leave bad reviews
- Fix: Invest in safe migration testing

---

## Production Crisis Pressure: Defending Safe Migration Patterns

### The Problem

Under production crisis pressure, you'll face requests to:
- "Users are crashing - just delete the database and start fresh"
- "Migration is taking too long - skip the testing and ship it"
- "We can't wait 2 days for proper migration - hack it together"
- "Schema mismatch? Just force-create a new store"

These sound like pragmatic crisis responses. **But they cause data loss and permanent user trust damage.** Your job: defend using data safety principles and customer impact, not fear of pressure.

### Red Flags — PM/Manager Requests That Cause Data Loss

If you hear ANY of these during a production crisis, **STOP and reference this skill**:

- ❌ **"Delete the persistent store and start fresh"** – Users lose ALL their data permanently
- ❌ **"Force lightweight migration without testing"** – High risk of data corruption in production
- ❌ **"Skip migration and create new store"** – Abandons existing user data
- ❌ **"We'll fix data issues after launch"** – Impossible to recover lost/corrupted data
- ❌ **"Just ship it, we can handle support tickets"** – Data loss creates permanent user churn
- ❌ **"Test on simulator is enough"** – Simulator deletes database on rebuild, hides schema mismatches

### How to Push Back Professionally

#### Step 1: Quantify the Customer Impact

```
"I want to resolve this crash ASAP, but let me show you what deleting the store means:

Current situation:
- 10,000 active users with data
- Average 50 items per user (500,000 total records)
- Users have 1 week to 2 years of accumulated data

If we delete the store:
- 10,000 users lose ALL their data on next app launch
- Uninstall rate: 60-80% (industry standard after data loss)
- App Store reviews: Expect 1-star reviews citing data loss
- Recovery: Impossible - data is gone permanently

Safe alternative:
- Test migration on real device with production data copy (2-4 hours)
- Deploy migration that preserves user data
- Uninstall rate: <5% (standard update churn)"
```

#### Step 2: Demonstrate the Risk

Show the PM/manager what happens:
1. Copy production database from device backup
2. Run proposed "quick fix" (delete store)
3. Show: All user data gone permanently
4. Show alternative: Safe migration preserving data
5. Time comparison: 30 min hack vs. 2-4 hour safe migration

#### Reference
- "Users don't forgive data loss" (App Store review patterns)
- Migration testing on real device prevents 95% of production crashes
- Schema mismatch crashes affect 100% of existing users

#### Step 3: Offer Compromise

```
"I can get us through this crisis while protecting user data:

#### Fast track (4 hours total)
1. Copy production database from TestFlight user (30 min)
2. Write and test migration on real device copy (2 hours)
3. Submit build with tested migration (30 min)
4. Monitor first 100 updates for crashes (1 hour)

#### Fallback if migration fails
- Have "delete store" build ready as Plan B
- Only deploy if migration shows 100% failure rate
- Communicate data loss to users proactively

This approach:
- Tries safe path first (protects user data)
- Has emergency fallback (if migration impossible)
- Honest timeline (4 hours vs. "just delete it" 30 min)"
```

#### Step 4: Document the Decision

If overruled (PM insists on deleting store):

```
Slack message to PM + team:

"Production crisis: Schema mismatch causing crashes for existing users.

PM decision: Delete persistent store to resolve immediately.

Impact assessment:
- 10,000 users lose ALL data permanently on next app launch
- Expected uninstall rate: 60-80% based on data loss patterns
- App Store review damage: High risk of 1-star reviews
- Customer support: Expect high volume of data loss complaints
- Recovery: Impossible - deleted data cannot be recovered

Alternative proposed (4-hour safe migration) was declined due to urgency.

I'm flagging this decision proactively so we can:
1. Prepare support team for data loss complaints
2. Draft App Store response to expected negative reviews
3. Consider user communication about data loss before launch"
```

#### Why this works
- You're not questioning their judgment under pressure
- You're quantifying user impact (business consequences)
- You're offering a solution with honest timeline
- You're providing fallback option (not blocking progress)
- You're documenting the decision (protects you post-launch)

### Real-World Example: Production Crash (500K Active Users)

#### Scenario
- Production app crashing for 100% of users after update
- Error: "The model used to open the store is incompatible with the one used to create the store"
- CTO says: "Delete the database and ship hotfix in 2 hours"
- 500,000 active users with average 6 months of data each

#### What to do

```swift
// ❌ WRONG - Deletes all user data (CTO's request)
let coordinator = NSPersistentStoreCoordinator(managedObjectModel: model)
let storeURL = /* persistent store URL */
try? FileManager.default.removeItem(at: storeURL) // 500K users lose data
try! coordinator.addPersistentStore(ofType: NSSQLiteStoreType,
                                    configurationName: nil,
                                    at: storeURL,
                                    options: nil)

// ✅ CORRECT - Safe lightweight migration (4-hour timeline)
let options = [
    NSMigratePersistentStoresAutomaticallyOption: true,
    NSInferMappingModelAutomaticallyOption: true
]

do {
    try coordinator.addPersistentStore(ofType: NSSQLiteStoreType,
                                       configurationName: nil,
                                       at: storeURL,
                                       options: options)
    // Migration succeeded - user data preserved
} catch {
    // Migration failed — NOW consider deleting with user communication
    print("Migration error: \(error)")
}
```

#### In the meeting, show
1. Schema version mismatch causing crash
2. Lightweight migration can fix automatically
3. Testing on production database copy (2 hours)
4. Time comparison: 2 hours (safe) vs. immediate (data loss)

**Time estimate** 4 hours total (2 hours migration testing, 2 hours build/deploy)

#### Result
- Honest timeline manages expectations
- Safe migration preserves 500K users' data
- Uninstall rate: 3% (standard update churn)
- App Store reviews: No data loss complaints

#### Alternative if migration truly impossible
- Document why migration failed
- Communicate data loss to users proactively
- Provide export feature in next version

### When to Accept Data Loss (Even If You Disagree)

Sometimes data loss is the only option. Accept if:

- [ ] Migration is genuinely impossible (tried on production data copy)
- [ ] PM/CTO understand 60-80% expected uninstall rate
- [ ] Team commits to user communication about data loss
- [ ] You've documented technical reasons migration failed

#### Document in Slack

```
"Production crisis: Migration failed on production data copy after 4-hour testing.

Technical details:
- Attempted lightweight migration: Failed with [error]
- Attempted heavy migration with mapping model: Failed with [error]
- Root cause: [specific schema incompatibility]

Data loss decision:
- No safe migration path exists
- PM approved delete persistent store approach
- Expected impact: 60-80% uninstall rate (500K → 100-200K users)

Mitigation plan:
- Add data export feature before next schema change
- Communicate data loss to users via in-app message
- Prepare support team for complaints
- Monitor uninstall rates post-launch"
```

This protects you and shows you exhausted safe options first.

---

## Real-World Impact

**Before** Core Data debugging 3-8 hours per issue
- Crashes in production (schema mismatch)
- Performance gradually degrades (N+1 queries)
- Thread errors in background operations
- Data corruption from unsafe migrations
- Customer trust damaged

**After** 30 minutes to 2 hours with systematic diagnosis
- Identify problem type with diagnostics (5 min)
- Apply correct pattern (5-10 min)
- Test on real device (varies)
- Deploy with confidence

**Key insight** Core Data has well-established patterns for every common issue. The problem is developers don't know which pattern applies to their symptom.

---

**Last Updated**: 2025-11-30
**Status**: TDD-tested with pressure scenarios
**Framework**: Core Data (Foundation framework)
**Complements**: SwiftData skill (understanding relationship to Core Data)
