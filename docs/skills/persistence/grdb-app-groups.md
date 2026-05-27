---
name: grdb-app-groups
description: Sharing a GRDB database across the main app and widgets, extensions, or Live Activities — persistent WAL, suspension defense, Data Protection on .db/-wal/-shm, cross-process change notification
version: 1.0.0
---

# GRDB Across App Groups

Discipline for sharing a SQLite database between the main app and its widgets, extensions, or Live Activities on iOS. GRDB's own docs say this is "extremely difficult on iOS and almost impossible to test." This skill makes the checklist explicit.

## When to Use This Skill

Use this skill when you're seeing any of these:

- "My widget shows stale data from the app's database"
- "My Live Activity can't open the database while the device is locked"
- "App keeps getting killed with `0xDEAD10CC` in crash logs"
- "App works in dev but crashes after TestFlight upload"
- "Two processes hit `SQLITE_BUSY` and never recover"
- "SQLite error 10 (`SQLITE_IOERR`) only on locked devices"
- "Why does my widget see different data than the app?"
- You're starting a new widget/extension and need to read from the app's GRDB database safely

**This is a different symptom class from [grdb-performance](/skills/persistence/grdb-performance)**: performance fires on "query slow"; this one fires on "process boundary violated."

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "My widget needs to read the same database as the app — how do I set it up safely?"
- "I shipped to TestFlight and now I'm getting `0xDEAD10CC` crashes — what?"
- "My Live Activity can't read the database after the device locks. Why?"
- "How do I notify my widget when the app writes to the database?"
- "Should I use `DatabaseQueue` or `DatabasePool` for my app + widget setup?"
- "What Data Protection class should my shared SQLite file use?"

## What This Skill Provides

### Decision Frame
- Snapshot file pattern (when you can avoid live sharing entirely)
- WidgetCenter timeline reloads
- Shared `UserDefaults` for small datasets

### Mandatory Setup
- App Groups entitlement on every target
- Container URL retrieval
- Dedicated subdirectory for the `.db` + `-wal` + `-shm` trio

### Mandatory PRAGMAs and Configuration
- `DatabasePool` required (WAL automatic, supports concurrent reads)
- Persistent WAL via `SQLITE_FCNTL_PERSIST_WAL` ioctl
- `Configuration.busyMode = .timeout(5)`
- `locking_mode = NORMAL` (not `EXCLUSIVE`)

### Data Protection
- Why `.complete` breaks widgets after auto-lock
- `.completeUntilFirstUserAuthentication` for shared databases
- Apply to all three files (`.db`, `.db-wal`, `.db-shm`)
- iOS 17+ `.completeWhenUserInactive` — when not to use it for widget sharing

### Suspension Defense (`0xDEAD10CC`)
- The iOS suspension watchdog and SQLite locks
- `Configuration.observesSuspensionNotifications = true`
- `Database.suspendNotification` / `resumeNotification` lifecycle posts
- **Use `DidEnterBackground` not `WillResignActive`** — `.inactive` is transient
- SwiftUI `scenePhase` wiring with `.inactive` as no-op
- Catching `SQLITE_INTERRUPT` (9) and `SQLITE_ABORT` (4) at call sites

### File Coordination on Open
- `NSFileCoordinator` for writer/reader race protection
- Preventing migration races on first multi-process launch

### Cross-Process Change Notification
- `DatabaseRegionObservation` for transaction detection
- Darwin notifications via `CFNotificationCenterGetDarwinNotifyCenter`
- Pass `false` / `0` for `deliverImmediately` (ignored on Darwin)

### `SQLITE_BUSY` Retry
- Always expected with multi-process
- Exponential backoff (50ms, 200ms, 500ms)
- When to surface to user as "sync busy" state

## Key Pattern

### Persistent WAL setup

```swift
import GRDB
import SQLite3

var config = Configuration()
config.busyMode = .timeout(5)
config.observesSuspensionNotifications = true

config.prepareDatabase { db in
    // Keep -wal and -shm files on disk so read-only processes can attach
    var flag: CInt = 1
    let code = withUnsafeMutablePointer(to: &flag) { ptr -> CInt in
        sqlite3_file_control(db.sqliteConnection, nil, SQLITE_FCNTL_PERSIST_WAL, ptr)
    }
    guard code == SQLITE_OK else {
        throw DatabaseError(resultCode: ResultCode(rawValue: code))
    }
    try db.execute(sql: "PRAGMA locking_mode = NORMAL")
}
```

### Suspension defense wiring (SwiftUI)

```swift
@Environment(\.scenePhase) private var scenePhase

var body: some Scene {
    WindowGroup { ContentView() }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                NotificationCenter.default.post(
                    name: Database.resumeNotification, object: nil)
            case .background:
                NotificationCenter.default.post(
                    name: Database.suspendNotification, object: nil)
            case .inactive:
                break   // Transient — do NOT suspend here
            @unknown default:
                break
            }
        }
}
```

### Cross-process change broadcast

```swift
let regionObservation = DatabaseRegionObservation(tracking: .fullDatabase)

let cancellable = regionObservation.start(in: dbPool) { error in
    // log
} onChange: { db in
    CFNotificationCenterPostNotification(
        CFNotificationCenterGetDarwinNotifyCenter(),
        CFNotificationName("com.example.app.db.changed" as CFString),
        nil, nil, false   // deliverImmediately is ignored on Darwin center
    )
}
```

## Documentation Scope

This page documents the `grdb-app-groups` skill — multi-process SQLite sharing discipline. For automated scanning of these patterns, use [grdb-performance-auditor](/agents/grdb-performance-auditor) (it includes app-group detection).

## Related

- [grdb](/skills/persistence/grdb) — GRDB primer for setup and queries
- [grdb-performance](/skills/persistence/grdb-performance) — performance discipline including `PRAGMA optimize` for shared DBs
- [sqlite-fts-ref](/reference/sqlite-fts-ref) — cross-process FTS5 trigger caveats
- [icloud-drive-ref](/reference/icloud-drive-ref) — iCloud Drive-based sharing (different model)
- [storage](/reference/storage) — storage location semantics
- [grdb-performance-auditor](/agents/grdb-performance-auditor) — detects journal mode mismatch and missing suspension defense for app-group DBs

## Resources

**GRDB docs**: github.com/groue/GRDB.swift Documentation/DatabaseSharing.md

**Apple docs**: configuring-app-groups, FileProtectionType
