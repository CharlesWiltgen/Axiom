---
name: audit-concurrency
description: Scan Swift code for concurrency issues and violations before running the swift-concurrency skill — detects unsafe tasks, missing @MainActor, Sendable violations, and actor isolation problems with file:line references
allowed-tools: Glob(*.swift), Grep(*)
---

# Swift Concurrency Audit

Scan your Swift codebase for common Swift 6 concurrency anti-patterns and violations that cause data races, crashes, and memory leaks.

## What This Command Checks

1. **Missing @MainActor on UI Classes** — View controllers and ObservableObjects without @MainActor
2. **Unsafe Task Self Capture** — Tasks capturing self strongly without [weak self]
3. **Sendable Violations** — Non-Sendable types crossing actor boundaries
4. **Improper Actor Isolation** — Unsafe data access from actor contexts
5. **Missing Weak Self in Stored Tasks** — Stored Task properties that leak memory
6. **Thread Confinement Violations** — MainActor property access from background contexts

## When to Use

Run this command when:
- Migrating to Swift 6 strict concurrency
- Seeing "data race" warnings or actor isolation errors
- Experiencing crashes with multithreaded access
- Before enabling strict concurrency checking
- After adding async/await or actors to your codebase

## Concurrency Issues

### 🔴 Critical (Crashes/Memory Leaks)

#### Missing @MainActor on UI Classes
```swift
// ❌ DATA RACE: Can be accessed from any thread
class ProfileViewModel: ObservableObject {
    @Published var name: String = ""
}

// ✅ SAFE: MainActor ensures thread safety
@MainActor
class ProfileViewModel: ObservableObject {
    @Published var name: String = ""
}
```

#### Unsafe Task Self Capture
```swift
// ❌ LEAKS: Task captures self strongly
var loadTask: Task<Void, Never>?
loadTask = Task {
    self.data = await fetchData()  // Retain cycle!
}

// ✅ SAFE: Use weak self
loadTask = Task { [weak self] in
    guard let self = self else { return }
    self.data = await fetchData()
}
```

### 🟡 High Priority (Data Races)

#### Sendable Violations
```swift
// ❌ DATA RACE: Non-Sendable type crossing actor boundary
class UserData {
    var name: String
}

Task { @MainActor in
    await actor.process(userData)  // Warning: UserData is not Sendable
}

// ✅ SAFE: Make Sendable or use value types
struct UserData: Sendable {
    let name: String
}
```

#### Improper Actor Isolation
```swift
// ❌ DATA RACE: Using actor data without isolation
let result = await dataActor.getData()
result.mutate()  // Unsafe if result is mutable reference type!

// ✅ SAFE: Copy data before leaving actor context
let result = await dataActor.getData().copy()
result.mutate()  // Safe - working with copy
```

### 🟢 Medium Priority (Warnings)

#### Thread Confinement Violations
```swift
// ❌ WARNING: MainActor property accessed in detached task
Task.detached {
    print(self.mainActorProperty)  // Warning!
}

// ✅ SAFE: Capture value before detaching
let value = mainActorProperty
Task.detached {
    print(value)  // Safe - captured before detaching
}
```

## Running the Audit

```bash
# In Claude Code
/audit-concurrency
```

The command will:
1. Find all Swift files in your project
2. Scan for the 6 concurrency patterns above
3. Report findings with `file:line` references
4. Prioritize by severity (Critical → Medium)
5. Suggest fixes from swift-concurrency skill

## Example Output

```
🔴 CRITICAL: Missing @MainActor (4 issues)
  - ProfileViewModel.swift:12 - ObservableObject without @MainActor
  - SettingsVC.swift:23 - UIViewController without @MainActor
  Impact: Potential data race crashes

🔴 CRITICAL: Unsafe Task Self Capture (2 issues)
  - NetworkManager.swift:45 - Task captures self without [weak self]
  - ImageLoader.swift:67 - Stored task property leaks memory
  Impact: Memory leaks, retain cycles

🟡 HIGH: Sendable Violations (3 issues)
  - DataManager.swift:89 - Non-Sendable class crossing actor boundary
  - UserSession.swift:34 - Mutable reference type in @Sendable closure
  Impact: Data race warnings, potential crashes

🟢 MEDIUM: Thread Confinement (1 issue)
  - BackgroundSync.swift:56 - MainActor property in detached task
  Impact: Compiler warnings
```

## Next Steps

After running the audit:

1. **Fix Critical issues immediately** — These cause crashes and memory leaks
2. **Address High priority issues** — Enable strict concurrency checking
3. **Resolve Medium priority warnings** — Clean build before shipping

For detailed fix patterns, use the [swift-concurrency](/skills/concurrency/swift-concurrency) skill:

```
"How do I fix these Swift concurrency issues?"
```

The skill provides copy-paste templates for:
- Pattern 1: Sendable types
- Pattern 2: Value capture before task
- Pattern 3: Weak self in tasks
- Pattern 4: Atomic snapshots
- And 8 more patterns for data persistence

## Real-World Impact

#### Before audit
- 2-4 hours debugging mysterious crashes
- Data races discovered in production
- Actor isolation errors blocking Swift 6 migration

#### After audit
- 5-10 minutes to identify all concurrency issues
- Fix most issues with ~5 lines of code
- Smooth Swift 6 strict concurrency migration

Run this command periodically to catch concurrency regressions early.
