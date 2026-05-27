# GRDB Across App Groups

## Overview

Sharing a GRDB (SQLite) database across the main app and its widgets, extensions, or Live Activities is one of the most dangerous patterns in iOS. GRDB's own docs are blunt about this:

> "Preventing errors that may happen due to database sharing is difficult. It is extremely difficult on iOS. And it is almost impossible to test."

And:

> "Always consider sharing plain files, or any other inter-process communication technique, before sharing an SQLite database."

The default failure modes are nasty: the OS terminates apps for holding SQLite locks during suspension (`0xDEAD10CC` in the crash log), widgets can't open the database while the device is locked unless Data Protection is exactly right, and `ValueObservation` silently never sees writes from other processes so widgets show stale data forever.

**Core principle** First, prefer not to. If you must share, follow every step in this skill — there are no optional ones. Skipping even one produces crashes that work fine in development and fail only in production.

## When to Use

Use this skill when you see any of these prompts or symptoms:

- "My widget shows stale data from the app's database"
- "My Live Activity can't open the database while the device is locked"
- "App keeps getting killed with `0xDEAD10CC` in crash logs"
- "I'm building a widget that reads from the app's GRDB store — how do I set it up safely?"
- "Why does my widget see different data than the app?"
- "App works in dev but crashes after TestFlight upload"
- "SQLite error 10 (`SQLITE_IOERR`) only on locked devices"
- "Two processes hit `SQLITE_BUSY` and never recover"

This skill is a different symptom class from `grdb-performance.md`. Performance fires on "query slow"; this one fires on "process boundary violated."

## 1 — First, prefer not to

GRDB's authors are emphatic: sharing a live SQLite database across processes on iOS is the hard path. There are easier patterns that solve the same user-visible problem.

#### Snapshot file pattern
The app owns the live database. When data changes, the app writes a derived snapshot to the App Group container — `.json`, `.plist`, or a separate read-only `.sqlite` file containing only what the widget needs. The widget reads the snapshot. No locking, no Data Protection edge cases, no `0xDEAD10CC`.

```swift
// In the app, after a relevant write
let snapshot = WidgetSnapshot(items: top10Items)
let url = appGroupURL.appending(path: "widget-snapshot.json")
try JSONEncoder().encode(snapshot).write(to: url, options: .atomic)
WidgetCenter.shared.reloadTimelines(ofKind: "TopItems")
```

#### WidgetCenter timeline reloads
For widgets, the only thing that matters is the timeline. The app can compute the next N entries on its own connection and hand them to WidgetKit. The widget extension doesn't need the database at all.

#### `UserDefaults(suiteName:)` or `NSUbiquitousKeyValueStore`
For small datasets (a few dozen items, total under ~1 MB), shared `UserDefaults` keyed by the App Group identifier is dramatically simpler. No PRAGMAs, no Data Protection, no suspension defense.

#### Darwin notifications + re-fetch on app side
If the widget needs to *cause* a refresh in the app, post a Darwin notification from the widget and let the app respond when it's next active. The widget itself never opens the database.

If none of these alternatives fits — the widget genuinely needs ad-hoc queries against the live data, or a Live Activity must update from background fetch — continue. The rest of this skill assumes you've ruled out the snapshot pattern and decided you must share.

## 2 — Mandatory setup

#### App Groups entitlement

Every target that touches the database — main app, every extension, every widget, every Live Activity — must have the App Groups entitlement, and they must all list the *same* group identifier.

In `*.entitlements` for each target:

```xml
<key>com.apple.security.application-groups</key>
<array>
    <string>group.com.example.app</string>
</array>
```

Missing this on any target produces `nil` from the container URL lookup, and the target falls back to its own sandbox — opening a different (empty) database file. This is the most common cause of "widget shows different data."

#### Container URL resolution

```swift
let groupID = "group.com.example.app"

guard let containerURL = FileManager.default
    .containerURL(forSecurityApplicationGroupIdentifier: groupID)
else {
    fatalError("App Group container missing — entitlement not configured")
}
```

#### Dedicated subdirectory

Do not place the database at the root of the container. SQLite's `-wal` and `-shm` sidecar files live next to the main `.db` file, and the container root often contains other shared resources. Create a subdirectory.

```swift
let dbDirectory = containerURL.appending(path: "Database", directoryHint: .isDirectory)
try FileManager.default.createDirectory(at: dbDirectory, withIntermediateDirectories: true)
let dbURL = dbDirectory.appending(path: "shared.sqlite")
```

This also makes it easier to apply Data Protection to all three files in one place (see §4).

**If your shared DB contains an FTS5 index:** sync triggers (`sqlite-fts-ref.md` §5) only fire for writes from the connection that has them registered. A widget that writes directly to the source table will not fire the app's triggers — the FTS index will drift. Either keep writes in the app process only, or register triggers in every writing process.

## 3 — Mandatory PRAGMAs and configuration

#### Use `DatabasePool`, not `DatabaseQueue`

`DatabasePool` is the only correct choice for multi-process sharing. It enables WAL automatically and supports concurrent reads while a writer holds the write transaction. A `DatabaseQueue` with explicit `journal_mode = WAL` is technically functional but serializes every operation in the current process — and the `grdb-performance-auditor` agent flags it as Critical for app-group databases because it bottlenecks every reader behind the writer. Use `DatabasePool`.

#### Persistent WAL is non-negotiable

iOS read-only processes (and locked-device scenarios) cannot open a database whose WAL file has been "checkpointed and unlinked" by another connection. The fix is to tell SQLite to keep the WAL file around persistently using `SQLITE_FCNTL_PERSIST_WAL`.

```swift
import GRDB
import SQLite3

var config = Configuration()

// Wait up to 5s on lock contention before surfacing SQLITE_BUSY to the caller.
// This is GRDB's typed wrapper — prefer it over `PRAGMA busy_timeout`.
config.busyMode = .timeout(5)

config.prepareDatabase { db in
    // Keep -wal and -shm files on disk so read-only processes can attach.
    var flag: CInt = 1
    let code = withUnsafeMutablePointer(to: &flag) { ptr -> CInt in
        sqlite3_file_control(db.sqliteConnection, nil, SQLITE_FCNTL_PERSIST_WAL, ptr)
    }
    guard code == SQLITE_OK else {
        throw DatabaseError(resultCode: ResultCode(rawValue: code))
    }

    // NORMAL — not EXCLUSIVE. EXCLUSIVE would lock out every other process.
    try db.execute(sql: "PRAGMA locking_mode = NORMAL")
}
```

#### `locking_mode = NORMAL` (never `EXCLUSIVE`)

`EXCLUSIVE` is a performance optimization for single-process apps that hold the database open for their entire lifetime. It claims the lock and never releases it. The second process trying to open the database gets `SQLITE_BUSY` forever. For shared databases this PRAGMA is forbidden.

#### `busyMode = .timeout(5)`

Without a busy timeout, the moment two processes contend on a write, the loser gets `SQLITE_BUSY` immediately. With a timeout, SQLite quietly retries inside the C library for up to N seconds before surfacing the error. `Configuration.busyMode = .timeout(5)` is GRDB's typed wrapper — prefer it over `PRAGMA busy_timeout = 5000` because it integrates with GRDB's connection lifecycle. You still need application-level retry (see §8) for cases where the timeout expires.

#### Enable suspension notifications

```swift
config.observesSuspensionNotifications = true
```

This is the GRDB hook that integrates with the suspension-defense pattern in §5. Set it now and finish the wiring in §5.

#### Apply `PRAGMA optimize` from `grdb-performance.md` §4

Shared DBs especially benefit from `PRAGMA optimize` discipline: widget and extension readers can't refresh the planner's statistics (they have no write opportunity to trigger auto-analyze). The writer process must maintain stats on behalf of all readers. Apply the on-open `PRAGMA optimize=0x10002` per `grdb-performance.md` §4 in your writer process, and run periodic `PRAGMA optimize` on background transitions.

## 4 — Data Protection

iOS encrypts files in the App Group container according to a per-file Data Protection class. SQLite uses three files — `.db`, `.db-wal`, and `.db-shm` — and **all three must have the same protection class**. A mismatch produces `SQLITE_IOERR` (error code 10) when the locked-device process tries to read.

#### Four protection classes

| Class | Accessible when |
|--------|----------|
| `.complete` | Device is unlocked |
| `.completeUnlessOpen` | After unlock; open files stay open through lock |
| `.completeUntilFirstUserAuthentication` | After first unlock since boot |
| `.none` | Always (default) |

#### The default `.complete` breaks widgets

If you accept the default, your widget will work fine until the user auto-locks the device. Then the widget extension can't read the database — every query returns `SQLITE_IOERR`. The widget shows a blank state, and the user thinks the app is broken.

#### Use `.completeUntilFirstUserAuthentication` for shared databases

This is the right balance: encrypted at rest before the user has ever entered their passcode (e.g., right after reboot), accessible the moment the user unlocks once. Background fetch, widgets, and Live Activities all work as expected after the user unlocks the device.

```swift
let protection: FileProtectionType = .completeUntilFirstUserAuthentication

for suffix in ["", "-wal", "-shm"] {
    let url = URL(filePath: dbURL.path() + suffix)
    guard FileManager.default.fileExists(atPath: url.path()) else { continue }
    try FileManager.default.setAttributes(
        [.protectionKey: protection],
        ofItemAtPath: url.path()
    )
}
```

iOS 17 added a fifth class, `.completeWhenUserInactive` — encrypted after a short user-inactive period. Useful for sensitive data that should be readable while the user is actively interacting but encrypted shortly after they stop. For app-group sharing with widgets, `.completeUntilFirstUserAuthentication` remains the right default; `.completeWhenUserInactive` would block widget reads during idle periods, which is exactly when widgets refresh.

Apply this **at first open, and again after any migration that recreates files** (e.g., a `VACUUM INTO` migration). Migrations that drop and recreate the WAL file lose the protection attribute and silently fall back to `.complete`.

#### `.complete` is correct for sensitive data — but then no widget access

If your data classification genuinely requires `.complete` (health records, financial credentials), do not share that database with a widget. Use the snapshot pattern from §1 to expose only the safe-to-show-on-lock-screen subset.

## 5 — Suspension defense (`0xDEAD10CC`) [load-bearing]

#### What is `0xDEAD10CC`?

When iOS suspends an app, the OS waits a few seconds for in-flight work to wind down. If the app is still holding a SQLite file lock when the suspension watchdog fires, iOS *kills the app* with exception code `0xDEAD10CC` ("dead lock"). The crash log lists this code under the exception type, often `EXC_RESOURCE` or `EXC_CRASH`.

This is invisible in development because the debugger prevents suspension. It manifests in TestFlight, App Review, and production — exactly when you can't debug it.

#### The fix has three parts, all mandatory

##### Part 1: Configure GRDB to observe suspension notifications

(Already done in §3.)

```swift
var config = Configuration()
config.observesSuspensionNotifications = true
```

##### Part 2: Post the lifecycle notifications

GRDB doesn't know when your app is about to be suspended — UIKit does. Forward the lifecycle events to the notifications GRDB listens for.

**Critical**: post `suspendNotification` from the **background** transition, not from `resignActive`. `resignActive` fires for transient interruptions (Control Center pull-down, app switcher peek, incoming call) when the app is NOT actually being suspended. Posting `suspendNotification` there interrupts in-flight queries every time the user pulls down Notification Center, producing spurious `SQLITE_INTERRUPT` errors.

```swift
// SceneDelegate
import UIKit
import GRDB

func sceneDidEnterBackground(_ scene: UIScene) {
    NotificationCenter.default.post(name: Database.suspendNotification, object: nil)
}

func sceneWillEnterForeground(_ scene: UIScene) {
    NotificationCenter.default.post(name: Database.resumeNotification, object: nil)
}
```

For AppDelegate-based apps without scenes, use `applicationDidEnterBackground` and `applicationWillEnterForeground`. For SwiftUI lifecycle, use `.onChange(of: scenePhase)` — and `.inactive` must be a no-op, not a suspend trigger:

```swift
@Environment(\.scenePhase) private var scenePhase

var body: some Scene {
    WindowGroup { ContentView() }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                NotificationCenter.default.post(name: Database.resumeNotification, object: nil)
            case .background:
                NotificationCenter.default.post(name: Database.suspendNotification, object: nil)
            case .inactive:
                break   // Transient — do NOT post suspendNotification here
            @unknown default:
                break
            }
        }
}
```

When GRDB receives `suspendNotification`, it interrupts in-flight queries and releases SQLite locks so the OS can suspend the process cleanly. When it receives `resumeNotification`, it un-suspends and lets new queries proceed.

##### Part 3: Catch the interrupt at call sites

While suspended, GRDB throws `DatabaseError` with `resultCode == .SQLITE_INTERRUPT` (9) or `.SQLITE_ABORT` (4) instead of running the query. These are not failures — they are "try again when the app is active." Treat them accordingly.

```swift
do {
    let items = try await dbPool.read { db in
        try Item.fetchAll(db)
    }
    return items
} catch let error as DatabaseError
    where error.resultCode == .SQLITE_INTERRUPT
        || error.resultCode == .SQLITE_ABORT
{
    // App was being suspended. Defer the read until resume.
    return []
}
```

For `ValueObservation`, the publisher automatically resumes when the resume notification fires — but you must still handle the interim period in your view.

#### Anti-rationalization

"The app works fine in dev. We can ship it and watch the crash reports." No. Development never triggers the suspension watchdog because the debugger keeps the process alive. `0xDEAD10CC` only appears in TestFlight, App Review, and production. By the time you see crash reports, real users are affected.

This step is not negotiable. There is no "we'll add it in v1.1" — the v1.0 ship is the v1.0 crash.

## 6 — File coordination on open

When two processes open the database simultaneously — for example, the app launches at the same moment a widget timeline refresh fires — they race on WAL recovery and migration. Possible outcomes: database corruption, `SQLITE_BUSY` on every operation, or two processes running the same migration twice.

#### Wrap opens in `NSFileCoordinator`

```swift
import Foundation
import GRDB

func openSharedDatabase(at url: URL, config: Configuration) throws -> DatabasePool {
    let coordinator = NSFileCoordinator(filePresenter: nil)
    var coordinatorError: NSError?
    var dbPool: DatabasePool?
    var dbError: Error?

    coordinator.coordinate(
        writingItemAt: url,
        options: .forMerging,
        error: &coordinatorError
    ) { coordinatedURL in
        do {
            dbPool = try DatabasePool(path: coordinatedURL.path, configuration: config)
        } catch {
            dbError = error
        }
    }

    if let error = coordinatorError { throw error }
    if let error = dbError { throw error }
    guard let dbPool else { throw DatabaseError(resultCode: .SQLITE_INTERNAL) }
    return dbPool
}
```

#### Read-only opens use `readingItemAt:` and `.withoutChanges`

A widget that only reads should not request a writing-coordinated open — that blocks the app from writing while the widget is initializing.

```swift
coordinator.coordinate(
    readingItemAt: url,
    options: .withoutChanges,
    error: &coordinatorError
) { coordinatedURL in
    // open read-only DatabasePool
}
```

This is *in addition to* the PRAGMAs in §3, not a replacement. PRAGMAs handle in-flight contention; `NSFileCoordinator` handles open-time races.

## 7 — Cross-process change notification

`ValueObservation` only sees writes that pass through *its own* `DatabasePool` connection. A widget observing the database will never automatically refresh when the main app writes — the widget's connection has no idea the file changed.

The workaround: writers broadcast a Darwin notification; readers listen and trigger a re-fetch. Darwin notifications cross process boundaries, coalesce automatically, and don't carry payloads (the reader must re-query).

#### Writer side

For `ValueObservation` and `DatabaseRegionObservation` basics, see `grdb-performance.md` §10. Use `DatabaseRegionObservation` (not `ValueObservation`) here to detect any commit and post a notification — values aren't useful across a process boundary, but the *fact* of a commit is.

```swift
import GRDB

let regionObservation = DatabaseRegionObservation(tracking: .fullDatabase)

let cancellable = regionObservation.start(in: dbPool) { error in
    // Surface region-observation errors to your logging pipeline.
} onChange: { db in
    // Fires after every committed write on this connection.
    // deliverImmediately is ignored on the Darwin center; pass false
    // per Apple's CFNotificationCenter header for forward compatibility.
    CFNotificationCenterPostNotification(
        CFNotificationCenterGetDarwinNotifyCenter(),
        CFNotificationName("com.example.app.db.changed" as CFString),
        nil,
        nil,
        false
    )
}
```

You can scope the tracked region (e.g., specific tables) to avoid posting on every write — useful if writes are frequent and only some affect the widget.

#### Reader side

Subscribe via `CFNotificationCenterAddObserver` and re-fetch.

```swift
let center = CFNotificationCenterGetDarwinNotifyCenter()
let name = "com.example.app.db.changed" as CFString

CFNotificationCenterAddObserver(
    center,
    Unmanaged.passUnretained(self).toOpaque(),
    { _, _, _, _, _ in
        // Triggered on cross-process notification. Re-fetch and update UI.
        Task { await WidgetCenter.shared.reloadAllTimelines() }
    },
    name,
    nil,
    CFNotificationSuspensionBehavior(rawValue: 0)   // ignored on Darwin center; pass 0 per Apple's header
)
```

#### Why Darwin notifications, not `NSNotificationCenter`

`NSNotificationCenter` is in-process only. `CFNotificationCenterGetDistributedCenter` exists but is macOS-only. `CFNotificationCenterGetDarwinNotifyCenter` is the iOS-supported cross-process channel.

#### Coalescing and rate limiting

Darwin notifications coalesce: if the writer posts 100 times in a second, the reader may receive between 1 and 100 notifications. Because they carry no payload, the reader must always re-fetch — there's no shortcut. For widgets, this is fine; `WidgetCenter.shared.reloadAllTimelines()` is itself rate-limited by WidgetKit.

## 8 — `SQLITE_BUSY` retry

Even with `busy_timeout = 5000` from §3, under contention you'll still see `SQLITE_BUSY` (error code 5) when the timeout expires. This is *expected* with multi-process sharing — do not log it as a fatal error.

#### Exponential backoff retry

```swift
import GRDB

func writeWithRetry<T>(
    in dbPool: DatabasePool,
    maxAttempts: Int = 3,
    work: @escaping (Database) throws -> T
) async throws -> T {
    let delays: [UInt64] = [50_000_000, 200_000_000, 500_000_000]  // ns: 50, 200, 500 ms

    for attempt in 0..<maxAttempts {
        do {
            return try await dbPool.write(work)
        } catch let error as DatabaseError where error.resultCode == .SQLITE_BUSY {
            if attempt == maxAttempts - 1 { throw error }
            try await Task.sleep(nanoseconds: delays[attempt])
        }
    }

    throw DatabaseError(resultCode: .SQLITE_BUSY)
}
```

#### After max attempts, surface to UI

Beyond three retries (~750 ms total), give up gracefully. Surface a "data sync busy — try again" state to the user rather than spinning indefinitely. A widget should fall back to its last cached snapshot; the app should show a transient banner.

#### Do not retry inside the write block

Retrying inside a `dbPool.write { }` closure deadlocks — you'd be holding the write transaction while waiting for it. The retry must wrap the entire `write(_:)` call.

## 9 — Anti-patterns

| Anti-pattern | Symptom | Fix | Section |
|---|---|---|---|
| Sharing `.db` without persistent WAL | Widget process can't open the database; `SQLITE_CANTOPEN` | Set `SQLITE_FCNTL_PERSIST_WAL` in `prepareDatabase` | §3 |
| `FileProtectionType.complete` on shared DB | Widget reads return `SQLITE_IOERR` (10) after device auto-locks | Use `.completeUntilFirstUserAuthentication` | §4 |
| Missing `observesSuspensionNotifications` | App killed in TestFlight/production with `0xDEAD10CC` in crash logs | Configure GRDB + wire scene lifecycle notifications | §5 |
| `ValueObservation` for cross-process updates | Widget shows stale data forever; never refreshes when app writes | Add `DatabaseRegionObservation` + Darwin notifications | §7 |
| `PRAGMA locking_mode = EXCLUSIVE` | Second process gets `SQLITE_BUSY` permanently | Use `locking_mode = NORMAL` | §3 |
| Skipping `NSFileCoordinator` on open | Migration races on first multi-process launch; possible corruption | Wrap opens in coordinator | §6 |
| `DatabaseQueue` instead of `DatabasePool` | All operations serialize across the whole process — widget reads block during app writes | Use `DatabasePool` | §3 |
| App Group entitlement on app only, not widget | Widget reads its own empty sandbox database | Add entitlement to every target | §2 |
| Database at App Group container root | `-wal`/`-shm` sidecars collide with other shared files; protection attributes inconsistent | Use a dedicated subdirectory | §2 |
| Treating `SQLITE_BUSY` as fatal | One-time contention crashes the widget | Exponential backoff retry | §8 |
| Treating `SQLITE_INTERRUPT` as failure | Spurious errors during app suspension | Recognize interrupt as "retry on resume" | §5 |
| "It works in dev, ship it" | Production crashes invisible in development | Test on a real device with the debugger detached | §5 |
| Snapshot pattern dismissed without consideration | Months spent fighting suspension and Data Protection bugs | Re-read §1 — most widget use cases don't need a live shared DB | §1 |
| FTS5 index in shared DB with writes from multiple processes | Widget search returns drift-stale results | Sync triggers only fire for writes from the registering connection — restrict writes to one process or register triggers in every writer | §2, see `sqlite-fts-ref.md` §5 |

## Resources

**Docs**: github.com/groue/GRDB.swift Documentation/DatabaseSharing.md, sosumi.ai/documentation/xcode/configuring-app-groups, sosumi.ai/documentation/foundation/fileprotectiontype, sosumi.ai/documentation/foundation/nsfilecoordinator

**Skills**: grdb, grdb-performance, sqlite-fts-ref, storage, icloud-drive-ref
