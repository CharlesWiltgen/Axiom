
# Testing Async Code — Swift Testing Patterns

Modern patterns for testing async/await code with Swift Testing framework.

## When to Use

✅ **Use when:**
- Writing tests for async functions
- Testing callback-based APIs with Swift Testing
- Migrating async XCTests to Swift Testing
- Testing MainActor-isolated code
- Need to verify events fire expected number of times

❌ **Don't use when:**
- XCTest-only project (use XCTestExpectation)
- UI automation tests (use XCUITest)
- Performance testing with metrics (use XCTest)

## Key Differences from XCTest

| XCTest | Swift Testing |
|--------|---------------|
| `XCTestExpectation` | `confirmation { }` |
| `wait(for:timeout:)` — blocks until fulfilled | `await confirmation` — checks the count when the closure returns |
| `@MainActor` not implicit (sync test methods run on the main thread; async test methods do not) | `@MainActor` explicit |
| Serial by default | **Parallel by default** |
| `XCTAssertEqual()` | `#expect()` |
| `continueAfterFailure` | `#require` per-expectation |

## Patterns

### Pattern 1: Simple Async Function

```swift
@Test func fetchUser() async throws {
    let user = try await api.fetchUser(id: 1)
    #expect(user.name == "Alice")
}
```

### Pattern 2: Completion Handler → Continuation

For APIs without async overloads:

```swift
@Test func legacyAPI() async throws {
    let result = try await withCheckedThrowingContinuation { continuation in
        legacyFetch { result, error in
            if let result {
                continuation.resume(returning: result)
            } else {
                continuation.resume(throwing: error!)
            }
        }
    }
    #expect(result.isValid)
}
```

### Pattern 3: Single Callback with confirmation

When a callback should fire exactly once:

```swift
@Test func notificationFires() async {
    await confirmation { confirm in
        let token = NotificationCenter.default.addObserver(
            forName: .didUpdate,
            object: nil,
            queue: .main
        ) { _ in
            confirm()  // Must be called exactly once
        }
        defer { NotificationCenter.default.removeObserver(token) }
        triggerUpdate()
    }
}
```

**Note**: `confirmation` checks the count when the closure returns, so the event must arrive before `triggerUpdate()` returns. This pattern works because a `queue: .main` observer is invoked before `post` returns — not because `confirmation` waits. Keep the token and remove the observer so it cannot outlive the test; and since tests run in parallel by default, two tests that are live at the same time and observe the same notification name will count each other's posts — scope the observer with `object:`, use a distinct name, or run the suite `.serialized`.

### Pattern 4: Multiple Callbacks with expectedCount

```swift
@Test func delegateCalledMultipleTimes() async {
    await confirmation(expectedCount: 3) { confirm in
        delegate.onProgress = { progress in
            confirm()  // Called 3 times
        }
        await startDownload()  // Must deliver all 3 progress updates inside the closure
    }
}
```

### Pattern 5: Verify Callback Never Fires

`confirmation` only sees calls made before the closure returns, so the operation under test has to complete inside the closure — otherwise the check passes before the callback has had a chance to fire.

```swift
@Test func noErrorCallback() async {
    await confirmation(expectedCount: 0) { confirm in
        delegate.onError = { _ in
            confirm()  // Should never be called
        }
        await performSuccessfulOperation()  // Must complete inside the closure
    }
}
```

### Pattern 6: MainActor Tests

```swift
@Test @MainActor func viewModelUpdates() async {
    let vm = ViewModel()
    await vm.load()
    #expect(vm.items.count > 0)
    #expect(vm.isLoading == false)
}
```

### Pattern 7: Timeout Control

```swift
@Test(.timeLimit(.minutes(1)))
func slowOperation() async throws {
    try await longRunningTask()
}
```

**Note**: test time limits can only be expressed in whole minutes — `.seconds(_:)` is unavailable, and one minute is the minimum. For a tighter bound, race the work against a timeout inside the test body.

### Pattern 8: Testing Throws

```swift
@Test func invalidInputThrows() async throws {
    await #expect(throws: ValidationError.self) {
        try await validate(input: "")
    }
}

// Specific error
@Test func specificError() async throws {
    await #expect(throws: NetworkError.notFound) {
        try await api.fetch(id: -1)
    }
}
```

### Pattern 9: Optional Unwrapping with #require

```swift
@Test func firstVideo() async throws {
    let videos = try await videoLibrary.videos()
    let first = try #require(videos.first)  // Fails if nil
    #expect(first.duration > 0)
}
```

### Pattern 10: Parameterized Async Tests

```swift
@Test("Video loading", arguments: [
    "Beach.mov",
    "Mountain.mov",
    "City.mov"
])
func loadVideo(fileName: String) async throws {
    let video = try await Video.load(fileName)
    #expect(video.isPlayable)
}
```

Arguments run in **parallel** automatically.

## Parallel Test Execution

Swift Testing runs tests **in parallel by default** (unlike XCTest).

### Handling Shared State

```swift
// ❌ Shared mutable state — Swift 6 rejects the bare global
var sharedCounter = 0

@Test func test1() async {
    sharedCounter += 1  // error: main actor-isolated var 'sharedCounter' can not be mutated from a nonisolated context
}

@Test func test2() async {
    sharedCounter += 1  // error: same — the compiler is what stops this, not the test
}

// ❌ Opting out of that check restores the real race
nonisolated(unsafe) var racingCounter = 0

@Test func test3() async {
    racingCounter += 1  // Data race! Parallel tests write the same global
}

@Test func test4() async {
    racingCounter += 1  // Data race!
}

// ✅ Each test gets fresh instance
struct CounterTests {
    var counter = Counter()  // Fresh per test

    @Test func increment() {
        counter.increment()
        #expect(counter.value == 1)
    }
}
```

### Forcing Serial Execution

When tests must run sequentially:

```swift
@Suite("Database tests", .serialized)
struct DatabaseTests {
    @Test func createRecord() async { /* ... */ }
    @Test func readRecord() async { /* ... */ }  // After create
    @Test func deleteRecord() async { /* ... */ }  // After read
}
```

**Note**: Other unrelated tests still run in parallel.

## Common Mistakes

### Mistake 1: Using sleep Instead of confirmation

```swift
// ❌ Flaky — arbitrary wait time
@Test func eventFires() async throws {
    setupEventHandler()
    try await Task.sleep(for: .seconds(1))  // Hope it happened?
    #expect(eventReceived)
}

// ✅ Deterministic — the trigger must complete inside the closure
@Test func eventFires() async {
    await confirmation { confirm in
        onEvent = { confirm() }
        await triggerEvent()  // Must fire before the closure returns
    }
}
```

### Mistake 2: Forgetting @MainActor on UI Tests

```swift
// ❌ Compile error — a nonisolated test cannot touch MainActor state
@Test func viewModel() {
    let vm = ViewModel()
    #expect(vm.items.count > 0)  // error: main actor-isolated property 'items' can not be referenced from a nonisolated context
}

// ✅ Explicit isolation
@Test @MainActor func viewModel() async {
    let vm = ViewModel()
    await vm.load()
}
```

### Mistake 3: Missing confirmation for Callbacks

```swift
// ❌ Test passes immediately — doesn't wait for callback
@Test func callback() async {
    api.fetch { result in
        #expect(result.isSuccess)  // Never executed before test ends
    }
}

// ✅ The callback must complete inside the closure
@Test func callback() async {
    await confirmation { confirm in
        // Awaiting a callback-taking call does NOT wait for the callback —
        // `await api.fetch { ... }` compiles with an #UnnecessaryEffectMarker
        // warning and returns immediately. Bridge it with a continuation.
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            api.fetch { result in
                #expect(result.isSuccess)
                confirm()
                continuation.resume()
            }
        }
    }
}
```

### Mistake 4: Not Handling Parallel Execution

```swift
// ❌ Tests interfere with each other
@Test func writeFile() async {
    try! "data".write(to: sharedFileURL, atomically: true, encoding: .utf8)
}

@Test func readFile() async {
    let data = try! String(contentsOf: sharedFileURL, encoding: .utf8)  // May fail!
}

// ✅ Use unique files or .serialized
@Test func writeAndRead() async {
    let url = FileManager.default.temporaryDirectory
        .appendingPathComponent(UUID().uuidString)
    try! "data".write(to: url, atomically: true, encoding: .utf8)
    let data = try! String(contentsOf: url, encoding: .utf8)
    #expect(data == "data")
}
```

## Migration from XCTest

### XCTestExpectation → confirmation

```swift
// XCTest
func testFetch() {
    let expectation = expectation(description: "fetch")
    api.fetch { result in
        XCTAssertNotNil(result)
        expectation.fulfill()
    }
    wait(for: [expectation], timeout: 5)
}

// Swift Testing
@Test func fetch() async {
    await confirmation { confirm in
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            api.fetch { result in
                #expect(result != nil)
                confirm()
                continuation.resume()
            }
        }
    }
}
```

### Async setUp → Suite init

```swift
// XCTest
class MyTests: XCTestCase {
    var service: Service!

    override func setUp() async throws {
        service = try await Service.create()
    }
}

// Swift Testing
struct MyTests {
    let service: Service

    init() async throws {
        service = try await Service.create()
    }

    @Test func example() async {
        // Use self.service
    }
}
```

## Resources

**WWDC**: 2024-10179, 2024-10195

**Docs**: /testing, /testing/confirmation

**Skills**: See `skills/swift-testing.md`
