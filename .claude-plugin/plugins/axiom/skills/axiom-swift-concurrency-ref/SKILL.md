---
name: axiom-swift-concurrency-ref
description: Swift concurrency API reference — actors, Sendable, Task/TaskGroup, AsyncStream, continuations, isolation patterns, DispatchQueue-to-actor migration with gotcha tables
license: MIT
metadata:
  version: "1.0.0"
  last-updated: "2026-02-26"
---

# Swift Concurrency API Reference

Complete Swift concurrency API reference for copy-paste patterns and syntax lookup.

Complements `axiom-swift-concurrency` (which covers *when* and *why* to use concurrency — progressive journey, decision trees, @concurrent, isolated conformances).

**Related skills**: `axiom-swift-concurrency` (progressive journey, decision trees), `axiom-synchronization` (Mutex, locks), `axiom-assume-isolated` (assumeIsolated patterns)

## Part 1: Actor Patterns

### Actor Definition

```swift
actor ImageCache {
    private var cache: [URL: UIImage] = [:]

    func image(for url: URL) -> UIImage? {
        cache[url]
    }

    func store(_ image: UIImage, for url: URL) {
        cache[url] = image
    }
}

// Usage — must await across isolation boundary
let cache = ImageCache()
let image = await cache.image(for: url)
```

All properties and methods on an actor are isolated by default. Callers outside the actor's isolation domain must use `await` to access them.

### Actor Isolation Rules

Every actor's stored properties and methods are isolated to that actor. Access from outside the isolation boundary requires `await`, which suspends the caller until the actor can process the request.

```swift
actor Counter {
    var count = 0              // Isolated — external access requires await
    let name: String           // let constants are implicitly nonisolated

    func increment() {         // Isolated — await required from outside
        count += 1
    }

    nonisolated func identity() -> String {
        name                   // OK: accessing nonisolated let
    }
}

let counter = Counter(name: "main")
await counter.increment()      // Must await across isolation boundary
let id = counter.identity()    // No await needed — nonisolated
```

### nonisolated Keyword

Opt out of isolation for synchronous access to non-mutable state.

```swift
actor MyActor {
    let id: UUID               // let constants are implicitly nonisolated

    nonisolated var description: String {
        "Actor \(id)"          // Can only access nonisolated state
    }

    nonisolated func hash(into hasher: inout Hasher) {
        hasher.combine(id)     // Only nonisolated properties
    }
}
```

`nonisolated` methods cannot access any isolated stored properties. Use this for protocol conformances (like `Hashable`, `CustomStringConvertible`) that require synchronous access.

### Actor Reentrancy

Suspension points (`await`) inside an actor allow other callers to interleave. State may change between any two `await` expressions.

```swift
actor BankAccount {
    var balance: Double = 0

    func transfer(amount: Double, to other: BankAccount) async {
        guard balance >= amount else { return }
        balance -= amount
        // REENTRANCY HAZARD: another caller could modify balance here
        // while we await the deposit on the other actor
        await other.deposit(amount)
    }

    func deposit(_ amount: Double) {
        balance += amount
    }
}
```

**Pattern**: Re-check state after every `await` inside an actor:

```swift
actor BankAccount {
    var balance: Double = 0

    func transfer(amount: Double, to other: BankAccount) async -> Bool {
        guard balance >= amount else { return false }
        balance -= amount

        await other.deposit(amount)

        // Re-check invariants after await if needed
        return true
    }
}
```

### Global Actors

A global actor provides a single shared isolation domain accessible from anywhere.

```swift
@globalActor
actor MyGlobalActor {
    static let shared = MyGlobalActor()
}

@MyGlobalActor
func doWork() { /* isolated to MyGlobalActor */ }

@MyGlobalActor
class MyService {
    var state: Int = 0         // Isolated to MyGlobalActor
}
```

### @MainActor

The built-in global actor for UI work. All UI updates must happen on `@MainActor`.

```swift
@MainActor
class ViewModel: ObservableObject {
    @Published var items: [Item] = []

    func loadItems() async {
        let data = await fetchFromNetwork()
        items = data           // Safe: already on MainActor
    }
}

// Annotate individual members
class MixedService {
    @MainActor var uiState: String = ""

    @MainActor
    func updateUI() {
        uiState = "Done"
    }

    func backgroundWork() async -> String {
        await heavyComputation()
    }
}
```

**Subclass inheritance**: If a class is `@MainActor`, all subclasses inherit that isolation.

### Actor Init

Actor initializers are NOT isolated to the actor. You cannot call isolated methods from init.

```swift
actor DataManager {
    var data: [String] = []

    init() {
        // Cannot call isolated methods here
        // self.loadDefaults()  // ERROR: actor-isolated method in non-isolated init
    }

    // Use a factory method instead
    static func create() async -> DataManager {
        let manager = DataManager()
        await manager.loadDefaults()
        return manager
    }

    func loadDefaults() {
        data = ["default"]
    }
}
```

### Actor Gotcha Table

| Gotcha | Symptom | Fix |
|---|---|---|
| Actor reentrancy | State changes between awaits | Re-check state after each await |
| nonisolated accessing isolated state | Compiler error | Remove nonisolated or make property nonisolated |
| Calling actor method from sync context | "Expression is 'async'" | Wrap in Task {} or make caller async |
| Global actor inheritance | Subclass inherits @MainActor | Be intentional about which methods need isolation |
| Actor init not isolated | Can't call isolated methods in init | Use factory method or populate after init |
| Actor protocol conformance | "Non-isolated" conformance error | Use nonisolated for protocol methods, or isolated conformance (Swift 6.2+) |

---

## Part 2: Sendable Patterns

### Automatic Sendable Conformance

Value types are Sendable when all stored properties are Sendable.

```swift
// Structs: Sendable when all stored properties are Sendable
struct UserProfile: Sendable {
    let name: String
    let age: Int
}

// Enums: Sendable when all associated values are Sendable
enum LoadState: Sendable {
    case idle
    case loading
    case loaded(String)        // String is Sendable
    case failed(Error)         // ERROR: Error is not Sendable
}

// Fix: use a Sendable error type
enum LoadState: Sendable {
    case idle
    case loading
    case loaded(String)
    case failed(any Error & Sendable)
}
```

### @Sendable Closures

Closures passed across isolation boundaries must be `@Sendable`. A `@Sendable` closure cannot capture mutable local state.

```swift
func runInBackground(_ work: @Sendable () -> Void) {
    Task.detached { work() }
}

// All captured values must be Sendable
var count = 0
runInBackground {
    // ERROR: capture of mutable local variable
    // count += 1
}

let snapshot = count
runInBackground {
    print(snapshot)            // OK: let binding of Sendable type
}
```

### @unchecked Sendable

Manual guarantee of thread safety. Use only when you provide synchronization yourself.

```swift
final class ThreadSafeCache: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: Any] = [:]

    func get(_ key: String) -> Any? {
        lock.lock()
        defer { lock.unlock() }
        return storage[key]
    }

    func set(_ key: String, value: Any) {
        lock.lock()
        defer { lock.unlock() }
        storage[key] = value
    }
}
```

**Requirements for @unchecked Sendable**:
- Class must be `final`
- All mutable state must be protected by a synchronization primitive (lock, queue, Mutex)
- You are responsible for correctness — the compiler will not check

### Conditional Conformance

```swift
struct Box<T> {
    let value: T
}

// Box is Sendable only when T is Sendable
extension Box: Sendable where T: Sendable {}

// Standard library uses this extensively:
// Array<Element>: Sendable where Element: Sendable
// Dictionary<Key, Value>: Sendable where Key: Sendable, Value: Sendable
// Optional<Wrapped>: Sendable where Wrapped: Sendable
```

### sending Parameter Modifier (SE-0430)

Transfer ownership of a value across isolation boundaries. The caller gives up access.

```swift
func process(_ value: sending String) async {
    // Caller can no longer access value after this call
    await store(value)
}

// Useful for transferring non-Sendable types when caller won't use them again
func handOff(_ connection: sending NetworkConnection) async {
    await manager.accept(connection)
}
```

### Build Settings

Control the strictness of Sendable checking in Xcode:

| Setting | Value | Behavior |
|---|---|---|
| `SWIFT_STRICT_CONCURRENCY` | `minimal` | Only explicit Sendable annotations checked |
| `SWIFT_STRICT_CONCURRENCY` | `targeted` | Inferred Sendable + closure checking |
| `SWIFT_STRICT_CONCURRENCY` | `complete` | Full strict concurrency (Swift 6 default) |

### Sendable Gotcha Table

| Gotcha | Symptom | Fix |
|---|---|---|
| Class can't be Sendable | "Class cannot conform to Sendable" | Make final + immutable, or @unchecked Sendable with locks |
| Closure captures non-Sendable | "Capture of non-Sendable type" | Copy value before capture, or make type Sendable |
| Protocol can't require Sendable | Generic constraints complex | Use `where T: Sendable` |
| @unchecked Sendable hides bugs | Data races at runtime | Only use when lock/queue guarantees safety |
| Array/Dictionary conditional | Collection is Sendable only if Element is | Ensure element types are Sendable |
| Error not Sendable | "Type does not conform to Sendable" | Use `any Error & Sendable` or typed errors |

---

## Part 3: Task Management

### Task { }

Creates an unstructured task that inherits the current actor context and priority.

```swift
// Inherits actor context — if called from @MainActor, runs on MainActor
let task = Task {
    try await fetchData()
}

// Get the result
let result = try await task.value

// Get Result<Success, Failure>
let outcome = await task.result
```

### Task.detached { }

Creates a task with no inherited context. Does not inherit the actor or priority.

```swift
Task.detached(priority: .background) {
    // NOT on MainActor even if created from MainActor
    await processLargeFile()
}
```

**When to use**: Background work that must NOT run on the calling actor. Prefer `Task {}` in most cases — `Task.detached` is rarely needed.

### Task Cancellation

Cancellation is cooperative. Setting cancellation is a request; the task must check and respond.

```swift
let task = Task {
    for item in largeCollection {
        // Option 1: Check boolean
        if Task.isCancelled { break }

        // Option 2: Throw CancellationError
        try Task.checkCancellation()

        await process(item)
    }
}

// Request cancellation
task.cancel()
```

### Task.sleep

Suspends the current task for a duration. Supports cancellation — throws `CancellationError` if cancelled during sleep.

```swift
// Duration-based (preferred)
try await Task.sleep(for: .seconds(2))
try await Task.sleep(for: .milliseconds(500))

// Nanoseconds (older API)
try await Task.sleep(nanoseconds: 2_000_000_000)
```

### Task.yield

Voluntarily yields execution to allow other tasks to run. Use in long-running synchronous loops.

```swift
for i in 0..<1_000_000 {
    if i.isMultiple(of: 1000) {
        await Task.yield()
    }
    process(i)
}
```

### Task Priority

| Priority | Use Case |
|---|---|
| `.userInitiated` | Direct user action, visible result |
| `.high` | Same as .userInitiated |
| `.medium` | Default when not specified |
| `.low` | Prefetching, non-urgent work |
| `.utility` | Long computation, progress shown |
| `.background` | Maintenance, cleanup, not time-sensitive |

```swift
Task(priority: .userInitiated) {
    await loadVisibleContent()
}

Task(priority: .background) {
    await cleanupTempFiles()
}
```

### @TaskLocal

Task-scoped values that propagate to child tasks automatically.

```swift
enum RequestContext {
    @TaskLocal static var requestID: String?
    @TaskLocal static var userID: String?
}

// Set values for a scope
RequestContext.$requestID.withValue("req-123") {
    RequestContext.$userID.withValue("user-456") {
        // Both values available here and in child tasks
        Task {
            print(RequestContext.requestID)  // "req-123"
            print(RequestContext.userID)     // "user-456"
        }
    }
}

// Outside scope — values are nil
print(RequestContext.requestID)  // nil
```

**Propagation rules**: `@TaskLocal` values propagate to child tasks created with `Task {}`. They do NOT propagate to `Task.detached {}`.

### Task Gotcha Table

| Gotcha | Symptom | Fix |
|---|---|---|
| Task never cancelled | Resource leak, work continues after view disappears | Store task, cancel in deinit/onDisappear |
| Ignoring cancellation | Task runs to completion even when cancelled | Check Task.isCancelled in loops, use checkCancellation() |
| Task.detached loses actor context | "Not isolated to MainActor" | Use Task {} when you need actor isolation |
| Capturing self in Task | Potential retain cycle | Use [weak self] for long-lived tasks |
| TaskLocal not propagated | Value is nil in detached task | TaskLocal only propagates to child tasks, not detached |
| Task priority inversion | Low-priority task blocks high-priority | System handles most cases; avoid awaiting low-priority from high |

---

## Part 4: Structured Concurrency

### async let

Run a fixed number of operations in parallel. All `async let` bindings are implicitly awaited when the scope exits.

```swift
async let images = fetchImages()
async let metadata = fetchMetadata()
async let config = loadConfig()

// All three run concurrently, await together
let (imgs, meta, cfg) = try await (images, metadata, config)
```

**Semantics**: If one `async let` throws, the others are cancelled. All must complete (or be cancelled) before the enclosing scope exits.

### TaskGroup — Non-Throwing

Dynamic number of parallel tasks where none throw.

```swift
let results = await withTaskGroup(of: String.self) { group in
    for name in names {
        group.addTask {
            await fetchGreeting(for: name)
        }
    }

    var greetings: [String] = []
    for await greeting in group {
        greetings.append(greeting)
    }
    return greetings
}
```

### TaskGroup — Throwing

Dynamic number of parallel tasks that can throw.

```swift
let images = try await withThrowingTaskGroup(of: (URL, UIImage).self) { group in
    for url in urls {
        group.addTask {
            let image = try await downloadImage(url)
            return (url, image)
        }
    }

    var results: [URL: UIImage] = [:]
    for try await (url, image) in group {
        results[url] = image
    }
    return results
}
```

### withDiscardingTaskGroup (iOS 17+)

For when you need concurrency but don't need to collect results.

```swift
try await withThrowingDiscardingTaskGroup { group in
    for connection in connections {
        group.addTask {
            try await connection.monitor()
            // Results are discarded — useful for long-running services
        }
    }
    // Group stays alive until all tasks complete or one throws
}
```

### TaskGroup Control

```swift
await withTaskGroup(of: Data.self) { group in
    // Add tasks conditionally
    group.addTaskUnlessCancelled {
        await fetchData()
    }

    // Cancel remaining tasks
    group.cancelAll()

    // Wait without collecting
    await group.waitForAll()

    // Iterate one at a time
    while let result = await group.next() {
        process(result)
    }
}
```

### Task Tree Semantics

Structured concurrency forms a tree:
- **Parent cancellation cancels all children** — cancelling a task cancels all `async let` and TaskGroup children
- **Child error propagates to parent** — in throwing groups, a child error cancels siblings and propagates up
- **All children must complete before parent returns** — the scope awaits all children, even cancelled ones

```swift
// If fetchImages() throws, fetchMetadata() is automatically cancelled
async let images = fetchImages()
async let metadata = fetchMetadata()
let result = try await (images, metadata)
```

### Structured Concurrency Gotcha Table

| Gotcha | Symptom | Fix |
|---|---|---|
| async let unused | Work still executes but result is discarded silently | Assign all async let results or use withDiscardingTaskGroup |
| TaskGroup accumulating memory | Memory grows with 10K+ tasks | Process results as they arrive, don't collect all |
| Capturing mutable state in addTask | "Mutation of captured var" | Use let binding or actor |
| Not handling partial failure | Some tasks succeed, some fail | Use group.next() and handle errors individually |
| async let in loop | Compiler error — async let must be in fixed positions | Use TaskGroup instead |
| Returning from group early | Remaining tasks still run | Call group.cancelAll() before returning |

---

## Part 5: Async Sequences

### AsyncStream

Non-throwing stream for producing values over time.

```swift
let stream = AsyncStream<Int> { continuation in
    for i in 0..<10 {
        continuation.yield(i)
    }
    continuation.finish()
}

for await value in stream {
    print(value)
}
```

### AsyncThrowingStream

Stream that can fail with an error.

```swift
let stream = AsyncThrowingStream<Data, Error> { continuation in
    let monitor = NetworkMonitor()
    monitor.onData = { data in
        continuation.yield(data)
    }
    monitor.onError = { error in
        continuation.finish(throwing: error)
    }
    monitor.onComplete = {
        continuation.finish()
    }

    continuation.onTermination = { @Sendable _ in
        monitor.stop()
    }

    monitor.start()
}

do {
    for try await data in stream {
        process(data)
    }
} catch {
    handleStreamError(error)
}
```

### Continuation API

```swift
let stream = AsyncStream<Value> { continuation in
    // Emit a value
    continuation.yield(value)

    // End the stream normally
    continuation.finish()

    // Cleanup when consumer cancels or stream ends
    continuation.onTermination = { @Sendable termination in
        switch termination {
        case .cancelled:
            cleanup()
        case .finished:
            finalCleanup()
        @unknown default:
            break
        }
    }
}

// For throwing streams
let stream = AsyncThrowingStream<Value, Error> { continuation in
    continuation.yield(value)
    continuation.finish()                  // Normal end
    continuation.finish(throwing: error)   // End with error
}
```

### Buffering Policies

Control what happens when values are produced faster than consumed.

```swift
// Keep all values (default) — memory can grow unbounded
let stream = AsyncStream<Int>(bufferingPolicy: .unbounded) { continuation in
    // ...
}

// Keep oldest N values, drop new ones when buffer is full
let stream = AsyncStream<Int>(bufferingPolicy: .bufferingOldest(100)) { continuation in
    // ...
}

// Keep newest N values, drop old ones when buffer is full
let stream = AsyncStream<Int>(bufferingPolicy: .bufferingNewest(100)) { continuation in
    // ...
}
```

| Policy | Behavior | Use When |
|---|---|---|
| `.unbounded` | Keeps all values | Consumer keeps up, or bounded producer |
| `.bufferingOldest(N)` | Drops new values when full | Order matters, older values have priority |
| `.bufferingNewest(N)` | Drops old values when full | Latest state matters (UI updates, sensor data) |

### Custom AsyncSequence

```swift
struct Counter: AsyncSequence {
    typealias Element = Int
    let limit: Int

    struct AsyncIterator: AsyncIteratorProtocol {
        var current = 0
        let limit: Int

        mutating func next() async -> Int? {
            guard current < limit else { return nil }
            defer { current += 1 }
            return current
        }
    }

    func makeAsyncIterator() -> AsyncIterator {
        AsyncIterator(limit: limit)
    }
}

// Usage
for await number in Counter(limit: 5) {
    print(number)  // 0, 1, 2, 3, 4
}
```

### AsyncSequence Operators

Standard operators work on any `AsyncSequence`:

```swift
// Map
for await name in users.map(\.name) { }

// Filter
for await adult in users.filter({ $0.age >= 18 }) { }

// CompactMap
for await image in urls.compactMap({ await tryLoadImage($0) }) { }

// Prefix
for await first5 in stream.prefix(5) { }

// first(where:)
let match = await stream.first(where: { $0 > threshold })

// Contains
let hasMatch = await stream.contains(where: { $0 > threshold })

// Reduce
let sum = await numbers.reduce(0, +)
```

### Built-in Async Sequences

```swift
// NotificationCenter
for await notification in NotificationCenter.default.notifications(named: .didUpdate) {
    handleUpdate(notification)
}

// URLSession bytes
let (bytes, response) = try await URLSession.shared.bytes(from: url)
for try await byte in bytes {
    process(byte)
}

// FileHandle bytes
for try await line in FileHandle.standardInput.bytes.lines {
    process(line)
}
```

### Async Sequence Gotcha Table

| Gotcha | Symptom | Fix |
|---|---|---|
| Continuation yielded after finish | Runtime warning, value lost | Track finished state, guard before yield |
| Stream never finishing | for-await loop hangs forever | Always call continuation.finish() in all code paths |
| No onTermination handler | Resource leak when consumer cancels | Set continuation.onTermination for cleanup |
| Unbounded buffer | Memory growth under load | Use .bufferingNewest(N) or .bufferingOldest(N) |
| Multiple consumers | Only first consumer gets values | AsyncStream is single-consumer; create separate streams per consumer |
| for-await on MainActor | UI freezes waiting for values | Use Task {} to consume off the main path |

---

## Part 6: Isolation Patterns

### @MainActor on Functions

```swift
@MainActor
func updateUI() {
    label.text = "Done"
}

// Call from async context
func doWork() async {
    let result = await computeResult()
    await updateUI()           // Hops to MainActor
}
```

### MainActor.run

Explicitly execute a closure on the main actor from any context.

```swift
func processData() async {
    let result = await heavyComputation()

    await MainActor.run {
        self.label.text = result
        self.progressView.isHidden = true
    }
}
```

### MainActor.assumeIsolated (iOS 17+)

Assert that code is already running on the main actor. Crashes at runtime if the assertion is false.

```swift
func legacyCallback() {
    // We KNOW this is called on main thread (UIKit guarantee)
    MainActor.assumeIsolated {
        self.viewModel.update()    // Access @MainActor state
    }
}
```

See `axiom-assume-isolated` for comprehensive patterns.

### nonisolated

Opt out of the enclosing actor's isolation.

```swift
@MainActor
class ViewModel {
    let id: UUID                           // Implicitly nonisolated (let)

    nonisolated var analyticsID: String {   // Explicitly nonisolated
        id.uuidString
    }

    var items: [Item] = []                 // Isolated to MainActor
}
```

### nonisolated(unsafe)

Compiler escape hatch. Tells the compiler to treat a property as if it's not isolated, without any safety guarantees.

```swift
// Use only when you have external guarantees of thread safety
nonisolated(unsafe) var legacyState: Int = 0

// Common for global constants that the compiler can't verify
nonisolated(unsafe) let formatter: DateFormatter = {
    let f = DateFormatter()
    f.dateStyle = .medium
    return f
}()
```

**Warning**: `nonisolated(unsafe)` provides zero runtime protection. Data races will not be caught. Use only as a last resort for bridging legacy code.

### @preconcurrency

Suppress concurrency warnings for pre-concurrency APIs during migration.

```swift
// Suppress warnings for entire module
@preconcurrency import MyLegacyFramework

// Suppress for specific protocol conformance
class MyDelegate: @preconcurrency SomeLegacyDelegate {
    func delegateCallback() {
        // No Sendable warnings for this conformance
    }
}
```

### #isolation (Swift 5.9+)

Capture the caller's isolation context so a function runs on whatever actor the caller is on.

```swift
func doWork(isolation: isolated (any Actor)? = #isolation) async {
    // Runs on caller's actor — no hop if caller is already isolated
    performWork()
}

// Called from @MainActor — runs on MainActor
@MainActor
func setup() async {
    await doWork()             // doWork runs on MainActor
}

// Called from custom actor — runs on that actor
actor MyActor {
    func run() async {
        await doWork()         // doWork runs on MyActor
    }
}
```

### Isolation Gotcha Table

| Gotcha | Symptom | Fix |
|---|---|---|
| MainActor.run from MainActor | Unnecessary hop, potential deadlock risk | Check context or use assumeIsolated |
| nonisolated(unsafe) data race | Crash at runtime, corrupted state | Use proper isolation or Mutex |
| @preconcurrency hiding real issues | Runtime crashes in production | Migrate to proper concurrency before shipping |
| #isolation not available pre-5.9 | Compiler error | Use traditional @MainActor annotation |
| nonisolated on actor method | Can't access any isolated state | Only use for computed properties from non-isolated state |

---

## Part 7: Continuations

Bridge callback-based APIs to async/await.

### withCheckedContinuation

Non-throwing bridge.

```swift
func currentLocation() async -> CLLocation {
    await withCheckedContinuation { continuation in
        locationManager.requestLocation { location in
            continuation.resume(returning: location)
        }
    }
}
```

### withCheckedThrowingContinuation

Throwing bridge.

```swift
func fetchUser(id: String) async throws -> User {
    try await withCheckedThrowingContinuation { continuation in
        api.fetchUser(id: id) { result in
            switch result {
            case .success(let user):
                continuation.resume(returning: user)
            case .failure(let error):
                continuation.resume(throwing: error)
            }
        }
    }
}
```

### Continuation Resume Methods

```swift
// Return a value
continuation.resume(returning: value)

// Throw an error
continuation.resume(throwing: error)

// From a Result type
continuation.resume(with: result)    // Result<T, Error>
```

### Resume-Exactly-Once Rule

A continuation MUST be resumed exactly once:
- **Resuming twice** crashes with `"Continuation already resumed"` (checked) or undefined behavior (unsafe)
- **Never resuming** causes the awaiting task to hang forever — a silent leak

```swift
// DANGEROUS: callback might not be called
func riskyBridge() async throws -> Data {
    try await withCheckedThrowingContinuation { continuation in
        api.fetch { data, error in
            if let error {
                continuation.resume(throwing: error)
                return
            }
            if let data {
                continuation.resume(returning: data)
                return
            }
            // BUG: if both are nil, continuation is never resumed
            // Fix: add a fallback
            continuation.resume(throwing: BridgeError.noResponse)
        }
    }
}
```

### Bridging Delegates

```swift
class LocationBridge: NSObject, CLLocationManagerDelegate {
    private var continuation: CheckedContinuation<CLLocation, Error>?
    private let manager = CLLocationManager()

    func requestLocation() async throws -> CLLocation {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            manager.delegate = self
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        continuation?.resume(returning: locations[0])
        continuation = nil     // Prevent double resume
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}
```

### Unsafe Continuations

Skip runtime checks for performance. Same API as checked, but misuse causes undefined behavior instead of a diagnostic crash.

```swift
func fastBridge() async -> Data {
    await withUnsafeContinuation { continuation in
        // No runtime check for double-resume or missing resume
        fastCallback { data in
            continuation.resume(returning: data)
        }
    }
}
```

**Use checked continuations during development, switch to unsafe only after thorough testing and when profiling shows the check is a bottleneck.**

### Continuation Gotcha Table

| Gotcha | Symptom | Fix |
|---|---|---|
| Resume called twice | "Continuation already resumed" crash | Set continuation to nil after resume |
| Resume never called | Task hangs indefinitely | Ensure all code paths resume — including error/nil cases |
| Capturing continuation | Continuation escapes scope | Store in property, ensure single resume |
| Unsafe continuation in debug | No diagnostics for misuse | Use withCheckedContinuation during development |
| Delegate called multiple times | Crash on second resume | Use AsyncStream instead of continuation for repeated callbacks |
| Callback on wrong thread | Doesn't matter for continuation | Continuations can be resumed from any thread |

---

## Part 8: Migration Patterns

Common migrations from GCD and completion handlers to Swift concurrency.

### DispatchQueue to Actor

```swift
// BEFORE: DispatchQueue for thread safety
class ImageCache {
    private let queue = DispatchQueue(label: "cache", attributes: .concurrent)
    private var cache: [URL: UIImage] = [:]

    func get(_ url: URL, completion: @escaping (UIImage?) -> Void) {
        queue.async { completion(self.cache[url]) }
    }

    func set(_ url: URL, image: UIImage) {
        queue.async(flags: .barrier) { self.cache[url] = image }
    }
}

// AFTER: Actor
actor ImageCache {
    private var cache: [URL: UIImage] = [:]

    func get(_ url: URL) -> UIImage? {
        cache[url]
    }

    func set(_ url: URL, image: UIImage) {
        cache[url] = image
    }
}
```

### DispatchGroup to TaskGroup

```swift
// BEFORE: DispatchGroup
let group = DispatchGroup()
var results: [Data] = []
for url in urls {
    group.enter()
    fetch(url) { data in
        results.append(data)
        group.leave()
    }
}
group.notify(queue: .main) { use(results) }

// AFTER: TaskGroup
let results = await withTaskGroup(of: Data.self) { group in
    for url in urls {
        group.addTask { await fetch(url) }
    }
    var collected: [Data] = []
    for await data in group {
        collected.append(data)
    }
    return collected
}
use(results)
```

### Completion Handler to async

```swift
// BEFORE
func fetchData(completion: @escaping (Result<Data, Error>) -> Void) {
    URLSession.shared.dataTask(with: url) { data, _, error in
        if let error { completion(.failure(error)); return }
        guard let data else { completion(.failure(FetchError.noData)); return }
        completion(.success(data))
    }.resume()
}

// AFTER
func fetchData() async throws -> Data {
    let (data, _) = try await URLSession.shared.data(from: url)
    return data
}
```

### @objc Delegates with @MainActor

```swift
@MainActor
class ViewController: UIViewController, UITableViewDelegate {
    // @objc delegate methods inherit @MainActor isolation from the class
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        // Already on MainActor — safe to update UI
        updateSelection(indexPath)
    }
}
```

### NotificationCenter to AsyncSequence

```swift
// BEFORE
let observer = NotificationCenter.default.addObserver(
    forName: .didUpdate, object: nil, queue: .main
) { notification in
    handleUpdate(notification)
}
// Must remove observer in deinit

// AFTER
let task = Task {
    for await notification in NotificationCenter.default.notifications(named: .didUpdate) {
        await handleUpdate(notification)
    }
}
// Cancel task in deinit — no manual observer removal needed
```

### Timer to AsyncSequence

```swift
// BEFORE
let timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
    updateUI()
}
// Must invalidate in deinit

// AFTER
let task = Task {
    while !Task.isCancelled {
        await updateUI()
        try? await Task.sleep(for: .seconds(1))
    }
}
// Cancel task in deinit
```

### DispatchSemaphore to Actor

```swift
// BEFORE: Semaphore to limit concurrent operations
let semaphore = DispatchSemaphore(value: 3)
for url in urls {
    DispatchQueue.global().async {
        semaphore.wait()
        defer { semaphore.signal() }
        download(url)
    }
}

// AFTER: TaskGroup with limited concurrency
await withTaskGroup(of: Void.self) { group in
    var inFlight = 0
    for url in urls {
        if inFlight >= 3 {
            await group.next()   // Wait for one to finish
            inFlight -= 1
        }
        group.addTask { await download(url) }
        inFlight += 1
    }
    await group.waitForAll()
}
```

### Migration Gotcha Table

| Gotcha | Symptom | Fix |
|---|---|---|
| DispatchQueue.sync to actor | Deadlock potential | Remove .sync, use await |
| Global dispatch to actor contention | Slowdown from serialization | Profile with Concurrency Instruments |
| Legacy delegate + Sendable | "Cannot conform to Sendable" | Use @preconcurrency import or @MainActor isolation |
| Callback called multiple times | Continuation crash | Use AsyncStream instead of continuation |
| Semaphore.wait in async context | Thread starvation, potential deadlock | Use TaskGroup with manual concurrency limiting |
| DispatchQueue.main.async to MainActor | Subtle timing differences | MainActor.run is the equivalent — test edge cases |

---

## API Quick Reference

| Task | API | Swift Version |
|---|---|---|
| Define isolated type | `actor MyActor { }` | 5.5+ |
| Run on main thread | `@MainActor` | 5.5+ |
| Mark as safe to share | `: Sendable` | 5.5+ |
| Mark closure safe to share | `@Sendable` | 5.5+ |
| Parallel tasks (fixed) | `async let` | 5.5+ |
| Parallel tasks (dynamic) | `withTaskGroup` | 5.5+ |
| Stream values | `AsyncStream` | 5.5+ |
| Bridge callback | `withCheckedContinuation` | 5.5+ |
| Check cancellation | `Task.checkCancellation()` | 5.5+ |
| Task-scoped values | `@TaskLocal` | 5.5+ |
| Assert isolation | `MainActor.assumeIsolated` | 5.9+ (iOS 17+) |
| Capture caller isolation | `#isolation` | 5.9+ |
| Lock-based sync | `Mutex` | 6.0+ (iOS 18+) |
| Discard results | `withDiscardingTaskGroup` | 5.9+ (iOS 17+) |
| Transfer ownership | `sending` parameter | 6.0+ |
| Force background | `@concurrent` | 6.2+ |
| Isolated conformance | `extension: @MainActor Proto` | 6.2+ |

## Resources

**WWDC**: 2021-10132, 2021-10134, 2022-110350, 2025-268

**Docs**: /swift/concurrency, /swift/actor, /swift/sendable, /swift/taskgroup

**Skills**: swift-concurrency, assume-isolated, synchronization, concurrency-profiling
