
# Runtime Isolation Crashes — Diagnostic

**Use this when a warning-free Swift 6 build crashes in production with `_dispatch_assert_queue_fail` or `_swift_task_checkIsolatedSwift`.**

Strict concurrency catches data races at compile time. It does **not** catch all of them. The compiler injects runtime isolation assertions at actor and GCD boundaries — these fire in production even with zero warnings.

## Crash Signatures

Recognize these in `.ips` files, MetricKit reports, or `xcsym crash` output:

| Symbol | Meaning |
|--------|---------|
| `_dispatch_assert_queue_fail` | Code expected a specific dispatch queue, ran on a different one |
| `_swift_task_checkIsolatedSwift` | Code expected actor isolation (e.g. `@MainActor`), ran outside it |
| `swift_task_checkIsolated` | Same family — runtime isolation guard tripped |

Both originate from the same root cause: **a closure or method inherited actor isolation from its enclosing context, then an SDK called it on a different thread.**

## Why a Warning-Free Build Still Crashes

Static isolation checking cannot see through framework callbacks, delegate dispatch, or GCD bridges. When isolation is ambiguous, the compiler inserts a **runtime check** rather than rejecting the code. If the assumption is wrong at runtime, the process traps immediately.

**Zero warnings means "the type system is happy", not "the runtime invariants hold."**

Swift 5 mode would silently run the offending code on the wrong thread. Swift 6 mode preemptively crashes rather than continuing in an unsafe state.

## Diagnosis Decision Tree

```dot
digraph diag {
    "Crash symbol?" [shape=diamond];
    "Closure passed to SDK?" [shape=diamond];
    "Delegate method on @MainActor class?" [shape=diamond];
    "Combine pipeline?" [shape=diamond];
    "Used assumeIsolated?" [shape=diamond];

    "Pattern 1: Closure isolation inheritance" [shape=box];
    "Pattern 2: Delegate isolation inheritance" [shape=box];
    "Pattern 3: assumeIsolated misuse" [shape=box];
    "Pattern 4: Actor reentrancy staleness" [shape=box];

    "Crash symbol?" -> "Closure passed to SDK?" [label="_dispatch_assert_queue_fail"];
    "Crash symbol?" -> "Delegate method on @MainActor class?" [label="_swift_task_checkIsolatedSwift"];

    "Closure passed to SDK?" -> "Pattern 1: Closure isolation inheritance" [label="context.perform, .map, .sink"];
    "Closure passed to SDK?" -> "Combine pipeline?" [label="not Core Data"];
    "Combine pipeline?" -> "Pattern 1: Closure isolation inheritance" [label="yes — receive(on:) placement matters"];

    "Delegate method on @MainActor class?" -> "Pattern 2: Delegate isolation inheritance" [label="yes"];
    "Delegate method on @MainActor class?" -> "Used assumeIsolated?" [label="no"];
    "Used assumeIsolated?" -> "Pattern 3: assumeIsolated misuse" [label="yes"];
    "Used assumeIsolated?" -> "Pattern 4: Actor reentrancy staleness" [label="no — check state across await"];
}
```

## Pattern 1 — Closures Inherit Actor Isolation

A closure defined inside an `@MainActor`-isolated context inherits that isolation. The compiler marks it main-actor-isolated and inserts a runtime assertion. If the framework calls it on a background thread, the assertion fires.

### Core Data `context.perform`

```swift
// ❌ CRASHES with _dispatch_assert_queue_fail
@MainActor
class ContactsViewModel {
    func deleteAll(context: NSManagedObjectContext) {
        context.perform {
            // Inherits @MainActor from enclosing method.
            // Core Data runs it on its private background queue. Trap.
            let request = NSFetchRequest<Contact>(entityName: "Contact")
            let contacts = try? context.fetch(request)
            contacts?.forEach { context.delete($0) }
        }
    }
}
```

**Fix — mark the closure `@Sendable`.** A `@Sendable` closure has no implied actor context, so no runtime assertion is injected.

```swift
// ✅ Works — @Sendable opts out of isolation inheritance
context.perform { @Sendable in
    let request = NSFetchRequest<Contact>(entityName: "Contact")
    let contacts = try? context.fetch(request)
    contacts?.forEach { context.delete($0) }
}
```

See axiom-data (skills/core-data.md) for the broader Core Data threading patterns.

### Combine `.map`, `.filter`, etc.

```swift
// ❌ CRASHES — .map closure inherits @MainActor, publisher emits off-main
@MainActor
class SearchViewModel {
    func subscribe() {
        searchPublisher
            .map { value in            // inherits @MainActor from subscribe()
                value.lowercased()
            }
            .receive(on: DispatchQueue.main)  // too late — .map already crashed
            .sink { self.results = $0 }
            .store(in: &cancellables)
    }
}
```

**Fix A — move `.receive(on:)` before any isolated operator.** The thread hop happens first, so the closure runs on main where its isolation is satisfied.

```swift
// ✅ Works — hop to main before isolated closures
searchPublisher
    .receive(on: DispatchQueue.main)
    .map { value in value.lowercased() }
    .sink { self.results = $0 }
    .store(in: &cancellables)
```

**Fix B — `@Sendable` if the operator should run off-main.**

```swift
// ✅ Works — explicit non-isolated transformation
searchPublisher
    .map { @Sendable value in value.lowercased() }
    .receive(on: DispatchQueue.main)
    .sink { self.results = $0 }
    .store(in: &cancellables)
```

### NotificationCenter `.sink`

```swift
// ❌ CRASHES if notification is posted off-main inside @MainActor class
NotificationCenter.default.publisher(for: .didRefresh)
    .sink { [weak self] _ in
        self?.reload()   // sink inherits @MainActor, fires on poster's thread
    }
    .store(in: &cancellables)
```

**Fix — insert `.receive(on: DispatchQueue.main)` before `.sink`.**

```swift
// ✅ Works
NotificationCenter.default.publisher(for: .didRefresh)
    .receive(on: DispatchQueue.main)
    .sink { [weak self] _ in self?.reload() }
    .store(in: &cancellables)
```

## Pattern 2 — Delegate Methods Inherit Isolation Too

When an entire class is `@MainActor`-isolated, **every method inherits that isolation, including delegate overrides**. If an SDK calls a delegate method from its own internal queue, the runtime check fires.

### NSDocument

```swift
// ❌ CRASHES — AppKit calls autosavesInPlace from a background queue
@MainActor
class MyDocument: NSDocument {
    override class var autosavesInPlace: Bool { true }
}
```

**Fix — mark the specific method `nonisolated`.** Leave the rest of the class on the main actor.

```swift
// ✅ Works
override nonisolated class var autosavesInPlace: Bool { true }
```

### CLLocationManagerDelegate

```swift
// ❌ CRASHES — CLLocationManager delivers updates on its own queue
@MainActor
class LocationManager: NSObject, CLLocationManagerDelegate {
    func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        updateMap(with: locations)   // inherits @MainActor, crashes
    }
}
```

**Fix — `nonisolated` on the delegate method, then `Task { @MainActor in }` for UI work.**

```swift
// ✅ Works
nonisolated func locationManager(
    _ manager: CLLocationManager,
    didUpdateLocations locations: [CLLocation]
) {
    Task { @MainActor in
        self.updateMap(with: locations)
    }
}
```

### Other delegates with the same trap

- `AVAudioPlayerDelegate` — audio completion callbacks
- `WKNavigationDelegate` — navigation callbacks may arrive off-main
- `URLSessionDelegate` — completion handlers run on session's delegate queue
- Any third-party SDK delegate that does not document main-thread delivery

**General rule** If a delegate protocol does not document main-thread delivery, treat its methods as background-thread by default and mark them `nonisolated`.

## Pattern 3 — `MainActor.assumeIsolated` Misuse

`MainActor.assumeIsolated` is a runtime assertion, not a thread hop. **It crashes immediately if the code is not actually on the main actor.**

Using it as a synchronous alternative to `await MainActor.run` in arbitrary contexts will crash whenever the assumption fails.

```swift
// ❌ DANGEROUS — assumeIsolated used in a context that might not be on main
func handleCallback() {
    MainActor.assumeIsolated {   // crashes if called off-main
        updateUI()
    }
}

// ✅ Use only when you KNOW you're on main (legacy delegate documented to deliver on main)
nonisolated func legacyCallback() {
    // SDK guarantees main-thread delivery
    MainActor.assumeIsolated {
        updateUI()
    }
}

// ✅ Or use proper async hop when uncertain
func handleCallback() async {
    await MainActor.run { updateUI() }
}
```

See `skills/assume-isolated.md` for the full assumeIsolated decision matrix.

## Pattern 4 — Actor Reentrancy State Staleness

Not a hard crash, but a precondition failure or silent corruption. After an `await` inside an actor method, **the actor unlocks and other tasks can mutate state**. State captured before suspension may be stale after it.

```swift
// ❌ Bug — `cached` may be stale after the await
actor ImageCache {
    var images: [URL: UIImage] = [:]

    func image(for url: URL) async -> UIImage? {
        let cached = images[url]                    // read before await
        if cached == nil {
            let downloaded = await download(url)    // ← reentrancy point
            images[url] = downloaded                 // stale `cached` no longer relevant
            return downloaded
        }
        return cached
    }
}
```

**Fix — re-check state after every `await`, or restructure to avoid the gap.**

```swift
// ✅ Works — re-check after suspension
actor ImageCache {
    var images: [URL: UIImage] = [:]

    func image(for url: URL) async -> UIImage? {
        if let cached = images[url] { return cached }
        let downloaded = await download(url)
        // Another task may have populated images[url] during await — prefer existing
        if let existing = images[url] { return existing }
        images[url] = downloaded
        return downloaded
    }
}
```

## Testing Implication

These crashes only surface with **real SDK callbacks and background-thread publishers**. Unit tests that drive code paths synchronously on the main thread will not trigger the runtime assertions.

**Add to your test plan**

- Drive Core Data through `context.perform` from background-spawned tasks
- Push notifications from `DispatchQueue.global().async { NotificationCenter.default.post(...) }`
- Exercise location/audio/network delegates on real devices, not just mocks
- Validate Combine pipelines by sending values on non-main schedulers
- Run integration tests on iOS 17.4+ where Swift 6 runtime assertions are strictest

See axiom-testing (skills/swift-testing.md) for testing async code that exercises real SDK callbacks.

## Anti-Rationalizations

| Thought | Reality |
|---------|---------|
| "My build is warning-free, so Swift 6 isolation is correct" | Static checking can't see through SDK callbacks. Runtime assertions fire anyway. |
| "I'll wrap it in `MainActor.assumeIsolated` to silence the warning" | `assumeIsolated` is a runtime trap, not a silencer. It crashes when the assumption is wrong. |
| "Adding `@Sendable` is the same as `@unchecked Sendable`" | `@Sendable` on a closure breaks isolation inheritance. `@unchecked Sendable` on a type hides data races. |
| "I'll just remove `@MainActor` from the class" | Now you have data races on UI state. The class-level isolation is correct — fix the specific method/closure. |
| "I'll use `DispatchQueue.main.async` inside the delegate method" | Works, but `nonisolated` + `Task { @MainActor in }` is the Swift 6 idiom and integrates with structured concurrency. |
| "`.receive(on:)` position doesn't matter — it's still in the pipeline" | Operators run in order. Any isolated closure before `.receive(on:)` runs on the upstream thread. |
| "Tests pass, so it works" | Mocked tests don't exercise SDK threading. Real-device integration tests do. |

## Cross-References

- `skills/swift-concurrency.md` — Core Swift 6 concurrency patterns (isolation rules, `@concurrent`)
- `skills/assume-isolated.md` — Full `assumeIsolated` patterns and when it's safe
- `skills/swift-concurrency-ref.md` — `nonisolated`, `@Sendable`, isolation syntax reference
- axiom-data (skills/core-data.md) — Core Data threading model and `context.perform` patterns
- axiom-uikit (skills/combine-patterns.md) — Combine schedulers and `.receive(on:)` placement
- crash-analyzer (Agent) — Recognizes these crash signatures via pattern tags

## Resources

**WWDC**: 2024-10169, 2025-268

**Docs**: /swift/sendable, /swift/mainactor, /coredata/nsmanagedobjectcontext/perform

**Skills**: assume-isolated, swift-concurrency, swift-concurrency-ref

**External**: Khoa Pham — "How to avoid Swift 6 concurrency crashes" (onmyway133.com)
