---
name: axiom-combine-patterns
description: Use when working with Combine publishers, AnyCancellable lifecycle, @Published properties, or bridging Combine with async/await. Covers reactive patterns, operator selection, memory management, and migration strategy.
license: MIT
metadata:
  version: "1.0.0"
  last-updated: "2026-03-12"
---

# Combine Patterns

## Overview

Combine remains embedded in massive production codebases — UIKit delegates, NotificationCenter bridging, KVO observation, and @Published properties are everywhere. New code prefers async/await, but interop and maintenance of existing Combine pipelines is daily work. This skill covers the decisions and pitfalls that matter: when to use Combine vs async/await, how to avoid memory leaks, and how to bridge between the two paradigms.

**Core principle**: Combine is not dead — it's mature. The question isn't "should I use Combine?" but "is Combine the right tool for THIS specific data flow?"

## When to Use This Skill

- Working with existing Combine pipelines
- Deciding between Combine and async/await for a new data flow
- Debugging AnyCancellable memory leaks or silent pipeline failures
- Using @Published or ObservableObject
- Bridging Combine publishers with async/await code
- Working with Subjects (PassthroughSubject, CurrentValueSubject)

## When NOT to Use This Skill

- Timer.publish patterns → route via `axiom-ios-concurrency` to timer-patterns skill (dedicated timer lifecycle coverage)
- @Observable migration from ObservableObject → use `axiom-swift-concurrency` (modern observation)
- UIKit ↔ SwiftUI bridging → route via `axiom-ios-ui` (view wrapping, not data flow)
- General async/await patterns → use `axiom-swift-concurrency`

## Example Prompts

- "Should I use Combine or async/await for this?"
- "My Combine pipeline silently stops producing values"
- "How do I convert a publisher to an async sequence?"
- "AnyCancellable is leaking — where do I store it?"
- "What's the difference between combineLatest and zip?"
- "How do I debounce a text field with Combine?"
- "My @Published property update isn't reaching the view"
- "How do I bridge a Combine publisher into async/await code?"

---

## Part 1: Combine vs async/await Decision Tree

| Use Case | Combine | async/await | Why |
|----------|---------|-------------|-----|
| One-shot network call | No | Yes | async/await is simpler, no cancellable management |
| Stream of values over time | Yes | AsyncStream | Combine's operators (debounce, combineLatest) are richer |
| Debounce/throttle user input | Yes | Awkward | Combine has built-in debounce/throttle; AsyncStream requires manual implementation |
| Merge multiple sources | Yes | TaskGroup | Combine's merge/combineLatest handle heterogeneous streams naturally |
| Existing UIKit KVO/Notification | Yes | Bridge | publisher(for:) and NotificationCenter.default.publisher are idiomatic Combine |
| New project iOS 17+ | No | Yes | @Observable + async/await is the modern pattern |
| Existing codebase with Combine | Maintain | Migrate incrementally | Don't rewrite working pipelines — bridge at boundaries |

### Quick Decision

```
Is it a one-shot operation (network call, file read)?
├─ Yes → async/await (simpler, no cancellable management)
│
Does it need time-based operators (debounce, throttle, delay)?
├─ Yes → Combine (built-in operators, no manual implementation)
│
Are you combining multiple ongoing streams?
├─ Yes → Combine (combineLatest, merge, zip are purpose-built)
│
Is this new code on iOS 17+?
├─ Yes → async/await + @Observable (modern pattern)
│
Is it existing Combine code that works?
└─ Yes → Keep it. Bridge at boundaries when async/await code needs the data.
```

---

## Part 2: Publisher/Subscriber Lifecycle

### AnyCancellable Storage Rules

AnyCancellable cancels its subscription when deallocated. If you don't store it, the pipeline is cancelled immediately after setup.

#### ❌ Pipeline dies instantly

```swift
func setupPipeline() {
    publisher
        .sink { value in
            self.handle(value)  // Never called
        }
    // AnyCancellable returned by sink is discarded → subscription cancelled
}
```

#### ✅ Store in Set<AnyCancellable>

```swift
private var cancellables = Set<AnyCancellable>()

func setupPipeline() {
    publisher
        .sink { [weak self] value in
            self?.handle(value)
        }
        .store(in: &cancellables)
}
```

### Why Set, Not Array

`Set<AnyCancellable>` is the idiomatic choice because:
- `store(in:)` works with both `Set` and `RangeReplaceableCollection` (including `Array`), but `Set` is conventional
- Order doesn't matter for subscriptions
- Prevents accidental duplicates if setup runs twice

### 4 Memory Leak Patterns

#### Leak 1: Strong self in sink

```swift
// ❌ LEAK: sink closure captures self strongly
publisher
    .sink { value in
        self.handle(value)  // Strong capture → retain cycle
    }
    .store(in: &cancellables)

// ✅ FIX: weak self
publisher
    .sink { [weak self] value in
        self?.handle(value)
    }
    .store(in: &cancellables)
```

#### Leak 2: Missing store(in:)

```swift
// ❌ LEAK: cancellable assigned to local var, not stored
let cancellable = publisher.sink { handle($0) }
// cancellable deallocated at end of scope → pipeline cancelled

// ✅ FIX: store in instance property
publisher.sink { [weak self] in self?.handle($0) }
    .store(in: &cancellables)
```

#### Leak 3: Over-retained cancellables

```swift
// ❌ LEAK: cancellables set never cleared, old pipelines accumulate
func refreshData() {
    // Each call adds another subscription without removing the previous one
    dataPublisher
        .sink { [weak self] in self?.update($0) }
        .store(in: &cancellables)
}

// ✅ FIX: clear before re-subscribing
func refreshData() {
    cancellables.removeAll()  // Cancel previous subscriptions
    dataPublisher
        .sink { [weak self] in self?.update($0) }
        .store(in: &cancellables)
}
```

#### Leak 4: assign(to:on:) strong capture

`assign(to:on:)` captures the `on:` parameter **strongly**. When the target is `self`, you get a retain cycle: `self → cancellables → subscription → self`.

```swift
// ❌ LEAK: assign(to:on:) retains self strongly — deinit never called
userPublisher
    .map { $0.name }
    .assign(to: \.displayName, on: self)
    .store(in: &cancellables)

// ✅ FIX: use assign(to:) with @Published projected value (iOS 14+)
userPublisher
    .map { $0.name }
    .assign(to: &$displayName)
// No store(in:) needed — subscription tied to @Published property lifetime
```

Key difference: `assign(to: &$prop)` does NOT return an `AnyCancellable` — the subscription is managed internally and cancelled when the `@Published` property's owner deallocates. No retain cycle, no cancellable storage needed.

If you must support iOS 13, use `sink` with `[weak self]` instead.

---

## Part 3: Essential Operators

One canonical example per group. These cover 90% of real-world usage.

### Transform

```swift
// map: transform each value
publisher.map { $0.name }

// compactMap: transform + filter nil
publisher.compactMap { Int($0) }

// flatMap: one-to-many (each value produces a new publisher)
searchText
    .flatMap { query in
        api.search(query)  // Returns a publisher
    }
```

**flatMap gotcha**: Without `.switchToLatest()` or `maxPublishers: .max(1)`, flatMap creates a new inner publisher for every upstream value. For search-as-you-type, use `map` + `switchToLatest` instead:

```swift
searchText
    .map { query in api.search(query) }
    .switchToLatest()  // Cancels previous search when new query arrives
```

### Combine Multiple Sources

```swift
// combineLatest: latest value from each, fires when ANY changes
Publishers.CombineLatest(namePublisher, agePublisher)
    .map { name, age in "\(name), \(age)" }

// merge: interleave values from same-type publishers
Publishers.Merge(localUpdates, remoteUpdates)
    .sink { update in handle(update) }

// zip: pairs values 1:1 (waits for both to produce)
Publishers.Zip(requestA, requestB)
    .sink { responseA, responseB in /* both complete */ }
```

| Operator | Fires When | Use Case |
|----------|-----------|----------|
| combineLatest | Any input changes | Form validation (all fields) |
| merge | Any input produces | Combining event streams |
| zip | All inputs produce one value | Parallel requests that must complete together |

### Time-Based

```swift
// debounce: wait until values stop arriving (search-as-you-type)
searchTextPublisher
    .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
    .sink { [weak self] query in self?.search(query) }
    .store(in: &cancellables)

// throttle: emit at most once per interval (scroll position)
scrollOffsetPublisher
    .throttle(for: .milliseconds(100), scheduler: RunLoop.main, latest: true)
    .sink { [weak self] offset in self?.updateHeader(offset) }
    .store(in: &cancellables)
```

| Operator | Behavior | Use Case |
|----------|----------|----------|
| debounce | Waits for silence, then emits last value | Search fields, auto-save |
| throttle(latest: true) | Emits latest value at fixed intervals | Scroll tracking, sensor data |
| throttle(latest: false) | Emits first value at fixed intervals | Rate-limiting button taps |

### Error Handling

```swift
// tryMap: transform that can throw
publisher.tryMap { data in
    try JSONDecoder().decode(Model.self, from: data)
}

// mapError: convert error types
publisher.mapError { error in
    AppError.network(error)
}

// replaceError: provide fallback value (terminates error path)
publisher.replaceError(with: defaultValue)

// retry: re-subscribe on failure
publisher.retry(3)  // Retry up to 3 times before propagating error
```

**Error handling order matters**: `retry` should come before `replaceError`. Retry re-subscribes to the upstream publisher; replaceError terminates the error and makes the pipeline infallible.

```swift
api.fetchData()
    .retry(3)                    // Try 3 more times on failure
    .replaceError(with: cached)  // If all retries fail, use cache
    .sink { data in update(data) }
    .store(in: &cancellables)
```

**replaceError after flatMap kills the outer pipeline**: If `replaceError` is downstream of `flatMap`, a single inner publisher error terminates the entire pipeline — not just that one request. Move error handling inside `flatMap` so each inner publisher handles its own errors:

```swift
// ❌ One API error kills the entire pipeline
$searchText
    .flatMap { query in api.search(query) }
    .replaceError(with: [])  // Pipeline completes on first error
    .sink { ... }

// ✅ Each search handles its own errors independently
$searchText
    .flatMap { query in
        api.search(query)
            .replaceError(with: [])  // Only this search affected
    }
    .sink { ... }
```

---

## Part 4: @Published + ObservableObject

### willSet Timing

`@Published` fires its publisher in `willSet`, not `didSet`. This means subscribers see the new value before the property has actually been set on the object.

```swift
class ViewModel: ObservableObject {
    @Published var count = 0

    init() {
        $count.sink { newValue in
            // 'newValue' is the incoming value
            // BUT self.count is still the OLD value here
            print("New: \(newValue), Current: \(self.count)")
            // Prints "New: 1, Current: 0" when count is set to 1
        }
        .store(in: &cancellables)
    }
}
```

If you need to read the property's value after it's been set, don't subscribe to `$count` — use a `didSet` observer instead, or read `self.count` after a brief deferral. The `$` publisher is designed for reacting to the incoming value, not for reading post-mutation state.

### Nested ObservableObject Trap

SwiftUI does NOT observe nested ObservableObject changes. Only the top-level object's `objectWillChange` triggers view updates.

```swift
// ❌ View won't update when settings.theme changes
class AppState: ObservableObject {
    @Published var settings = Settings()  // Settings is also ObservableObject
}

class Settings: ObservableObject {
    @Published var theme = "light"  // Changes here don't propagate
}

// ✅ FIX: Forward objectWillChange manually
class AppState: ObservableObject {
    @Published var settings = Settings()
    private var cancellables = Set<AnyCancellable>()

    init() {
        settings.objectWillChange
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
    }
}
```

**Better fix for iOS 17+**: Migrate to `@Observable`, which handles nested observation automatically. See `axiom-swift-concurrency` for migration patterns.

### Thread Safety Warning

`@Published` is NOT thread-safe. Setting a `@Published` property from a background thread triggers `objectWillChange` off the main thread, which can crash SwiftUI views.

```swift
// ❌ CRASH: @Published set from background thread
class ViewModel: ObservableObject {
    @Published var data: [Item] = []

    func fetch() {
        Task {
            let items = await api.fetchItems()
            data = items  // Background thread → crash
        }
    }
}

// ✅ FIX: Ensure main thread
@MainActor
class ViewModel: ObservableObject {
    @Published var data: [Item] = []

    func fetch() {
        Task {
            let items = await api.fetchItems()
            data = items  // Safe — @MainActor ensures main thread
        }
    }
}
```

---

## Part 5: Bridging Combine and async/await

### Publisher → AsyncSequence

Use `.values` to consume any publisher as an async sequence:

```swift
let cancellable = notificationPublisher
    .sink { notification in handle(notification) }

// ✅ Modern equivalent using .values
for await notification in notificationPublisher.values {
    handle(notification)
}
```

**Caveats with `.values`**:
- The `for await` loop runs indefinitely until the publisher completes or the Task is cancelled
- Errors thrown by the publisher terminate the loop
- Only one consumer — if two `for await` loops consume the same `.values`, behavior is undefined

### async/await → Publisher

Wrap an async function in `Future` for Combine consumption:

```swift
func fetchUser(id: String) async throws -> User { ... }

// Wrap as a Combine publisher
let userPublisher = Future<User, Error> { promise in
    Task {
        do {
            let user = try await fetchUser(id: "123")
            promise(.success(user))
        } catch {
            promise(.failure(error))
        }
    }
}
```

**Future executes immediately** — it runs its closure when created, not when subscribed. Wrap in `Deferred` if you need lazy execution:

```swift
let lazyPublisher = Deferred {
    Future<User, Error> { promise in
        Task {
            do {
                let user = try await fetchUser(id: "123")
                promise(.success(user))
            } catch {
                promise(.failure(error))
            }
        }
    }
}
```

### Gradual Migration Strategy

Don't rewrite working Combine code. Bridge at the boundary:

```
Combine pipeline  →  .values  →  async/await code
                     (bridge)

async function    →  Future   →  Combine pipeline
                     (bridge)
```

**Migration priority**:
1. New code: write in async/await
2. Boundary: bridge with `.values` or `Future`
3. Existing Combine: leave working pipelines alone
4. Rewrite: only when the pipeline needs significant changes anyway

---

## Part 6: Subjects

### PassthroughSubject vs CurrentValueSubject

| Feature | PassthroughSubject | CurrentValueSubject |
|---------|-------------------|-------------------|
| Initial value | None | Required |
| Late subscribers | Miss previous values | Get current value immediately |
| `.value` property | No | Yes (read current value) |
| Use case | Events (button taps, notifications) | State (current selection, loading status) |

```swift
// Event-driven: no initial value, late subscribers miss past events
let taps = PassthroughSubject<Void, Never>()
taps.send()

// State-driven: always has a current value
let isLoading = CurrentValueSubject<Bool, Never>(false)
isLoading.value = true  // Direct access
isLoading.send(false)   // Also works
```

### Send-After-Completion Pitfall

Once a Subject receives a completion event, all subsequent `send()` calls are silently ignored. No crash, no error — just silence.

```swift
let subject = PassthroughSubject<Int, Never>()

subject.send(1)           // Delivered
subject.send(completion: .finished)
subject.send(2)           // Silently ignored — no crash, no warning

// This is the most common cause of "my pipeline stopped working"
```

**Diagnosis**: If a pipeline silently stops producing values, check whether anything upstream sent a `.finished` or `.failure` completion. Once complete, the pipeline is dead.

---

## Part 7: Cold vs Hot Publishers (share/multicast)

Most Combine publishers are **cold** — they start work when subscribed and each subscriber gets its own independent execution. `URLSession.dataTaskPublisher` fires a new HTTP request per subscriber.

```swift
// ❌ Two subscribers = two network requests
let publisher = URLSession.shared
    .dataTaskPublisher(for: url)
    .map(\.data)
    .eraseToAnyPublisher()

publisher.sink { cache.store($0) }.store(in: &cancellables)  // Request 1
publisher.sink { display($0) }.store(in: &cancellables)       // Request 2
```

### share()

`.share()` makes a cold publisher hot — the first subscriber triggers the work, subsequent subscribers share the output:

```swift
// ✅ One request, shared result
let publisher = URLSession.shared
    .dataTaskPublisher(for: url)
    .map(\.data)
    .share()
    .eraseToAnyPublisher()

publisher.sink { cache.store($0) }.store(in: &cancellables)  // Triggers request
publisher.sink { display($0) }.store(in: &cancellables)       // Shares result
```

### share() Gotchas

| Gotcha | Effect | Fix |
|--------|--------|-----|
| Late subscribers miss values | `share()` uses PassthroughSubject — no replay | Attach all subscribers before the first value arrives, or use `multicast` with `CurrentValueSubject` |
| Upstream completed before subscriber attaches | Late subscriber immediately gets `.finished` with no values | Ensure subscription order, or cache the result outside Combine |
| All subscribers cancel → upstream cancels | New subscriber after that triggers a NEW upstream execution | Expected behavior, but surprising if you assumed the result was cached |

### When to use share()

```
Multiple subscribers to the same expensive publisher?
├─ No → Don't use share() (unnecessary complexity)
│
├─ Yes, all subscribe at the same time?
│   └─ Yes → share() works
│
└─ Yes, subscribers attach at different times?
    └─ Use multicast(subject:) with CurrentValueSubject, or cache the result in a property
```

---

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Combine is dead, just use async/await" | Combine has no deprecation notice. Thousands of production apps use it. Rewriting working pipelines wastes time and introduces bugs. Bridge incrementally instead. |
| "I'll just use .sink everywhere" | Without `[weak self]` and proper `store(in:)`, every sink is a potential memory leak. The lifecycle rules in Part 2 prevent the top 4 leak patterns. |
| "assign(to:on:) is fine, it's the standard API" | It captures `on:` strongly — retain cycle if target is `self`. Use `assign(to: &$prop)` instead (Part 2, Leak 4). |
| "debounce and throttle are the same thing" | debounce waits for silence; throttle emits at intervals. Using the wrong one causes either delayed responses or missed events. Part 3 has the decision table. |
| "I know how @Published works" | @Published fires on willSet, not didSet. Nested ObservableObject doesn't propagate. Background thread access crashes. Part 4 covers all three traps. |
| "I'll migrate everything to async/await at once" | Full rewrites of working Combine code introduce bugs and waste time. Bridge at boundaries (Part 5). Rewrite only when the pipeline needs significant changes anyway. |

---

## Pressure Scenarios

### Scenario 1: "Let's migrate all Combine code to async/await"

**Setup**: Tech lead wants to modernize the codebase. "Combine is legacy, let's rip it out."

**Pressure**: Authority + scope creep. The entire data layer uses Combine publishers, @Published properties, and operator chains.

**Expected with skill**: Push back with the gradual migration strategy (Part 5). New code uses async/await. Boundaries use `.values` and `Future`. Existing working pipelines stay until they need changes. Full rewrite is the most expensive option with the least benefit.

**Pushback template**: "Combine isn't deprecated — Apple still ships it in every SDK. A full rewrite of working pipelines introduces bugs we don't have today. Let's bridge at boundaries: new code in async/await, `.values` to consume existing publishers, and we only rewrite a pipeline when we're already changing it significantly."

---

### Scenario 2: "Pipeline silently stopped — just recreate it"

**Setup**: A Combine pipeline stopped producing values after a refactor. No crash, no error.

**Pressure**: Time pressure. "Just tear it down and rebuild."

**Expected with skill**: Diagnose before rebuilding. Check: (1) Was a completion sent upstream? (send-after-completion, Part 6). (2) Is the AnyCancellable still alive? (storage rules, Part 2). (3) Did the publisher error without handling? (replaceError / catch, Part 3). These three causes cover 90% of silent pipeline failures.

**Diagnostic checklist**:
1. Is the `AnyCancellable` still stored? (Set not cleared, not deallocated)
2. Did anything upstream send `.finished` or `.failure`?
3. Is there a `tryMap` or other throwing operator without error handling?
4. Was `switchToLatest` used where the outer publisher completed?

**Pushback template**: "Before rebuilding, let me check four things: cancellable lifecycle, upstream completions, unhandled errors, and switchToLatest completion. One of these is almost always the cause. It takes 5 minutes to diagnose vs 30 minutes to rebuild and test."

---

### Scenario 3: "Settings changes aren't updating the UI"

**Setup**: A settings screen uses a nested ObservableObject. The parent `AppState` holds a `Settings` object. When the user changes `settings.theme`, the UI doesn't update.

**Pressure**: "The binding works in isolation, it must be a SwiftUI bug. Let me just force a refresh with objectWillChange.send()."

**Expected with skill**: Recognize the nested ObservableObject trap (Part 4). SwiftUI does NOT observe nested ObservableObject changes — only the top-level object's `objectWillChange` triggers view updates. The fix is either forwarding `objectWillChange` from the nested object, or migrating to `@Observable` (iOS 17+) which handles nesting automatically.

**Anti-pattern without skill**: Sprinkling `objectWillChange.send()` calls throughout the code, adding `@Published` to every nested property (which doesn't help), or restructuring the model to flatten everything into one object (losing separation of concerns).

**Pushback template**: "SwiftUI only observes the top-level ObservableObject. Nested objects need their objectWillChange forwarded to the parent. Part 4 has the exact pattern — it's a 5-line fix in the parent's init, not a SwiftUI bug."

---

## Resources

**WWDC**: 2019-722, 2019-721, 2020-10034

**Docs**: /combine, /combine/anycancellable, /combine/published

**Skills**: swift-concurrency, memory-debugging
