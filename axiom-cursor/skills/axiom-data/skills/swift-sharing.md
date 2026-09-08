# Sharing

## Overview

Point-Free's [swift-sharing](https://github.com/pointfreeco/swift-sharing) gives a value one storage location and many observers. `@Shared` is the persistence-and-observation layer that SQLiteData's `@FetchAll` / `@FetchOne` are built on, and it works standalone for user defaults, files, and in-memory state.

**Core principle** A shared value is a *reference* with a persistence strategy attached. Reads observe; writes go through `withLock`; loading and failure are first-class state you can render, not exceptions you swallow.

**Requires** Sharing ships manifests back to Swift 5.9; package traits need 6.1+. Sharing 2.8.0+ matters on Swift 6.3 toolchains — see the first anti-pattern.

## When to Use

- A value read in several places that must stay in sync — user settings, feature flags, the signed-in user
- Persisting to `UserDefaults` or a file without hand-writing the load/save/observe loop
- Understanding what `@FetchAll` and `@FetchOne` inherit: `isLoading`, `loadError`, and the reload path behind `$items.load(newQuery)`
- Writing a custom persistence strategy (Keychain, remote config, iCloud key-value store)

For SQL-backed data use `skills/sqlitedata.md` — `@FetchAll` is a Sharing reader with a SQL key, and you rarely need to build that yourself.

## Quick Reference

```swift
@Shared(.appStorage("launchCount")) var launchCount = 0
@Shared(.fileStorage(.documentsDirectory.appending(component: "user.json"))) var user: User?
@Shared(.inMemory("session")) var session: Session?
@SharedReader(.appStorage("isPro")) var isPro = false   // read-only

$launchCount.withLock { $0 += 1 }        // mutate
Binding($isEnabled)                       // SwiftUI two-way binding
try await $user.load()                    // force a reload
try await $user.save()                    // force a write
$user.isLoading, $user.loadError, $user.saveError
```

## Anti-Patterns (Common Mistakes)

### ❌ Assigning through `@Shared`'s setter

Two distinct failures. Given:

```swift
struct Settings { @Shared var isEnabled: Bool }
@Binding var settings: Settings          // a SwiftUI Binding, not a Shared
```

**Direct assignment is rejected regardless of Swift version** — this axis tracks the Sharing version, not the toolchain:

```swift
settings.isEnabled = false               // ❌ setter unavailable (2.7) / deprecated (2.8+)
settings.$isEnabled.withLock { $0 = false }   // ✅
```

**Chaining a SwiftUI binding into shared state is the new one.** `$settings.isEnabled` reaches the same setter through SwiftUI's dynamic member lookup — a path Swift did not check availability through until 6.3 closed the hole:

```swift
Toggle("Enabled", isOn: $settings.isEnabled)          // ❌ compile error on Sharing <= 2.7 + Swift 6.3
Toggle("Enabled", isOn: Binding(settings.$isEnabled)) // ✅
```

Sharing 2.8.0 softens the setter from *unavailable* to *deprecated*, so this warns rather than fails. A project pinned below 2.8.0 breaks on Swift 6.3 **only where it chains a binding into shared state** — code that never does keeps building. The deprecation message names both replacements: `withLock` for mutation, `Binding($shared)` for SwiftUI.

### ❌ Treating a failed load as an empty value

```swift
// WRONG — an unreadable file and an empty file look identical
@Shared(.fileStorage(url)) var items: [Item] = []
if items.isEmpty { showOnboarding() }

// RIGHT — distinguish "no data" from "could not read"
if let error = $items.loadError { showRetry(error) }
else if items.isEmpty { showOnboarding() }
```

### ❌ Read-modify-write outside the lock

```swift
// WRONG — two writers interleave and one update is lost
let current = counts
$counts.withLock { $0 = current + [id: 1] }

// RIGHT — read and write inside the same critical section
$counts.withLock { $0[id, default: 0] += 1 }
```

### ❌ Reaching for a strategy that does not exist

Sharing ships exactly three: `.appStorage`, `.fileStorage`, `.inMemory`. There is no Keychain, SQLite, or iCloud strategy in the package. Secrets belong in the Keychain — see axiom-security (skills/keychain.md) — reached through a custom `SharedKey`, never `.appStorage`, which is unencrypted and backed up.

## @Shared vs @SharedReader

| | `@Shared` | `@SharedReader` |
|---|---|---|
| Mutation | `withLock`, `save()` | None |
| Key protocol | `SharedKey` (adds `save`) | `SharedReaderKey` |
| Error state | `loadError`, `saveError` | `loadError` |
| Use for | State you own | Derived or externally-owned data |

Both conform to `Observable`, `Perceptible`, and `DynamicProperty`, so they work in SwiftUI views, UIKit controllers, and `@Observable` models alike.

Inside an `@Observable` class the property **must** carry `@ObservationIgnored`, or the macro's synthesized storage collides:

```swift
@Observable final class CounterModel {
    @ObservationIgnored
    @Shared(.appStorage("count")) var count = 0
}
// without it: error: invalid redeclaration of synthesized property '_count'
```

`@Shared` does its own observation, so nothing is lost by ignoring it.

Derive a narrower reference with dynamic member lookup — `$user.name` is a `Shared<String>` writing back to the same storage. `$shared.read { … }` projects a read-only transform.

## Persistence Strategies

### .appStorage

```swift
@Shared(.appStorage("launchCount")) var launchCount = 0
@Shared(.appStorage("theme")) var theme: Theme = .system     // RawRepresentable
@Shared(.appStorage("filters")) var filters: Filters = .init() // Codable
```

Typed overloads cover `Bool`, `Int`, `Double`, `String`, `[String]`, `URL`, `Data`, `Date`, each with an optional variant, plus generic `Codable` and `RawRepresentable` forms.

#### Two traps

Keys containing `.` or starting with `@` are not valid for key-value observation. Sharing falls back to `NotificationCenter` and reports: *"External updates will be observed less efficiently and accurately."* Cross-process updates are what degrade — the case that matters for app-group and widget setups. Use flat keys (`"user_isPro"`, not `"user.isPro"`); silence deliberately with the `appStorageKeyFormatWarningEnabled` dependency.

A suite must be **one shared instance**, not constructed per call site. Two `UserDefaults(suiteName:)` objects for the same suite break synchronization and observation, and Sharing reports it:

```swift
extension UserDefaults {
    nonisolated(unsafe) static let group = UserDefaults(suiteName: "group.com.example.app")!
}
@Shared(.appStorage("isPro", store: .group)) var isPro = false
```

Note where `store:` goes — it is a parameter of `.appStorage(_:store:)`, not of `@Shared`. And `nonisolated(unsafe)` is required: `UserDefaults` is not `Sendable`, so a plain `static let` fails Swift 6 strict concurrency.

Or set it once globally via the `defaultAppStorage` dependency.

### .fileStorage

```swift
@Shared(.fileStorage(.documentsDirectory.appending(component: "user.json"))) var user: User?
```

Writes atomically and observes the file, so edits from an extension or another process propagate. Pass `decode:`/`encode:` for a non-Codable payload.

### .inMemory

```swift
@Shared(.inMemory("session")) var session: Session?
```

Process-lifetime only. The right choice for values that must not survive a relaunch.

### Type-safe keys

Register a default so call sites carry no literals:

```swift
extension SharedReaderKey where Self == AppStorageKey<Bool>.Default {
    static var isPro: Self { Self[.appStorage("isPro"), default: false] }
}

@Shared(.isPro) var isPro     // no key string, no default at the call site
```

## Loading and Error State

```swift
@SharedReader(.remoteConfig) var config = Config()

var body: some View {
    if $config.isLoading { ProgressView() }
    else if let error = $config.loadError { ErrorView(error) }
    else { ConfigView(config) }
}
```

Every **non-optional** `@Shared` / `@SharedReader` needs a default — the bare-key initializer is `@available(*, unavailable)` with the message "Assign a default value". Optional-valued state needs none, since `nil` already is the default. `Shared(require:)` / `SharedReader(require:)` are the `async throws` alternatives for when there is no sensible placeholder and you would rather fail than render one, and a key with a registered `.Default` supplies the value for you.

## Dynamic Keys

Swap the backing key at runtime to re-drive a query. This is the mechanism behind search:

```swift
.task(id: searchText) {
    try? await $items.load(.search(searchText))
}
```

In a SwiftUI view that gets recreated, declare the property with `@State.Shared` / `@State.SharedReader` so the dynamically loaded key survives.

## Custom Persistence

Conform to `SharedReaderKey` to read, `SharedKey` to also write:

```swift
struct KeychainKey<Value: Codable & Sendable>: SharedKey {
    let account: String
    var id: some Hashable { account }

    func load(context: LoadContext<Value>, continuation: LoadContinuation<Value>) {
        do { continuation.resume(returning: try Keychain.read(account)) }
        catch { continuation.resume(throwing: error) }
    }

    func subscribe(
        context: LoadContext<Value>, subscriber: SharedSubscriber<Value>
    ) -> SharedSubscription {
        SharedSubscription {}      // no external change source to observe
    }

    func save(_ value: Value, context: SaveContext, continuation: SaveContinuation) {
        do { try Keychain.write(value, account); continuation.resume() }
        catch { continuation.resume(throwing: error) }
    }
}
```

`LoadContext` distinguishes `.initialValue` from `.userInitiated`; `SaveContext` distinguishes `.didSet` from `.userInitiated`, which is how a key debounces implicit writes while still writing through on an explicit `save()`. Resume the continuation exactly once on every path. Dropping it reports an issue and resumes with the initial value; *retaining* it without ever resuming is what hangs the awaiting `load()`. A second resume is ignored and reported.

## Testing

Each test gets its own quarantined `.appStorage`, `.fileStorage`, and `.inMemory` storage, so tests neither leak into each other nor touch the real `UserDefaults` or disk. `.fileStorage` swaps to an in-memory map under test.

Parameterized and repeated tests need the storage reset per iteration:

```swift
import DependenciesTestSupport

@Test(.dependencies) func counts() { … }
```

Previews need no setup — `defaultAppStorage` and `defaultFileStorage` already resolve to in-memory in a preview context. **UI tests** do, since the app runs as a separate process:

```swift
prepareDependencies {
    $0.defaultAppStorage = .inMemory
    $0.defaultFileStorage = .inMemory
}
```

## Package Traits

| Trait | Default | Effect |
|-------|---------|--------|
| `CustomDump` | On | Pretty-printing and diffing of shared values |
| `IdentifiedCollections` | On | Derive `Shared` elements from shared collections |
| `CasePaths` | Off | Case-path dynamic member lookup on shared enums |

Traits require the Swift 6.1+ manifest; on a Swift 6.0 toolchain none are available.

## Relationship to SQLiteData

`@FetchAll` and `@FetchOne` wrap a `SharedReader` — `FetchAll` exposes it as `public var sharedReader: SharedReader<[Element]>`, and SQLiteData's internal `FetchKey` is a `SharedReaderKey` whose load runs a SQL query through GRDB. Everything on this page applies to them: `$items.isLoading` and `$items.loadError` forward straight to the `SharedReader`, while `try await $items.load(newQuery)` is SQLiteData's own statement-taking overload layered on Sharing's key-taking `load`.

Consequence worth knowing: SQLiteData depends on swift-sharing 2.3.0+, so a project that pins Sharing below 2.8.0 inherits the Swift 6.3 build failure above even if it only ever writes `@FetchAll`.

## Resources

**GitHub**: pointfreeco/swift-sharing, pointfreeco/sqlite-data

**Skills**: axiom-data (skills/sqlitedata.md), axiom-data (skills/sqlitedata-ref.md), axiom-security (skills/keychain.md)

---

**Targets:** iOS 26+/18, macOS 26+/15
**Framework:** Sharing 2.10+ (manifests back to Swift 5.9; traits need 6.1+)
**History:** See git log for changes
