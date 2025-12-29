---
name: swift-testing
description: Use when writing unit tests, adopting Swift Testing framework, making tests run faster without simulator, architecting code for testability, testing async code reliably, or migrating from XCTest - covers @Test/@Suite macros, #expect/#require, parameterized tests, traits, tags, parallel execution, host-less testing
skill_type: discipline
version: 1.0.0
last_updated: WWDC 2024 (Swift Testing framework)
---

# Swift Testing

## Overview

Swift Testing is Apple's modern testing framework introduced at WWDC 2024. It uses Swift macros (`@Test`, `#expect`) instead of naming conventions, runs tests in parallel by default, and integrates seamlessly with Swift concurrency.

**Core principle**: Tests should be fast, reliable, and expressive. The fastest tests run without launching your app or simulator.

## The Speed Hierarchy

Tests run at dramatically different speeds depending on how they're configured:

| Configuration | Typical Time | Use Case |
|---------------|--------------|----------|
| `swift test` (Package) | ~0.1s | Pure logic, models, algorithms |
| Host Application: None | ~3s | Framework code, no UI dependencies |
| Bypass app launch | ~6s | App target but skip initialization |
| Full app launch | 20-60s | UI tests, integration tests |

**Key insight**: Move testable logic into Swift Packages or frameworks, then test with `swift test` or "None" host application.

---

## Building Blocks

### @Test Functions

```swift
import Testing

@Test func videoHasCorrectMetadata() {
    let video = Video(named: "example.mp4")
    #expect(video.duration == 120)
}
```

**Key differences from XCTest**:
- No `test` prefix required — `@Test` attribute is explicit
- Can be global functions, not just methods in a class
- Supports `async`, `throws`, and actor isolation
- Each test runs on a fresh instance of its containing suite

### #expect and #require

```swift
// Basic expectation — test continues on failure
#expect(result == expected)
#expect(array.isEmpty)
#expect(numbers.contains(42))

// Required expectation — test stops on failure
let user = try #require(await fetchUser(id: 123))
#expect(user.name == "Alice")

// Unwrap optionals safely
let first = try #require(items.first)
#expect(first.isValid)
```

**Why #expect is better than XCTAssert**:
- Captures source code and sub-values automatically
- Single macro handles all operators (==, >, contains, etc.)
- No need for specialized assertions (XCTAssertEqual, XCTAssertNil, etc.)

### Error Testing

```swift
// Expect any error
#expect(throws: (any Error).self) {
    try dangerousOperation()
}

// Expect specific error type
#expect(throws: NetworkError.self) {
    try fetchData()
}

// Expect specific error value
#expect(throws: ValidationError.invalidEmail) {
    try validate(email: "not-an-email")
}

// Custom validation
#expect {
    try process(data)
} throws: { error in
    guard let networkError = error as? NetworkError else { return false }
    return networkError.statusCode == 404
}
```

### @Suite Types

```swift
@Suite("Video Processing Tests")
struct VideoTests {
    let video = Video(named: "sample.mp4")  // Fresh instance per test

    @Test func hasCorrectDuration() {
        #expect(video.duration == 120)
    }

    @Test func hasCorrectResolution() {
        #expect(video.resolution == CGSize(width: 1920, height: 1080))
    }
}
```

**Key behaviors**:
- Structs preferred (value semantics, no accidental state sharing)
- Each `@Test` gets its own suite instance
- Use `init` for setup, `deinit` for teardown (actors/classes only)
- Nested suites supported for organization

---

## Traits

Traits customize test behavior:

```swift
// Display name
@Test("User can log in with valid credentials")
func loginWithValidCredentials() { }

// Disable with reason
@Test(.disabled("Waiting for backend fix"))
func brokenFeature() { }

// Conditional execution
@Test(.enabled(if: FeatureFlags.newUIEnabled))
func newUITest() { }

// Time limit
@Test(.timeLimit(.minutes(1)))
func longRunningTest() async { }

// Bug reference
@Test(.bug("https://github.com/org/repo/issues/123", "Flaky on CI"))
func sometimesFailingTest() { }

// OS version requirement
@available(iOS 18, *)
@Test func iOS18OnlyFeature() { }
```

### Tags for Organization

```swift
// Define tags
extension Tag {
    @Tag static var networking: Self
    @Tag static var performance: Self
    @Tag static var slow: Self
}

// Apply to tests
@Test(.tags(.networking, .slow))
func networkIntegrationTest() async { }

// Apply to entire suite
@Suite(.tags(.performance))
struct PerformanceTests {
    @Test func benchmarkSort() { }  // Inherits .performance tag
}
```

**Use tags to**:
- Run subsets of tests (filter by tag in Test Navigator)
- Exclude slow tests from quick feedback loops
- Group related tests across different files/suites

---

## Parameterized Testing

Transform repetitive tests into a single parameterized test:

```swift
// ❌ Before: Repetitive
@Test func vanillaHasNoNuts() {
    #expect(!IceCream.vanilla.containsNuts)
}
@Test func chocolateHasNoNuts() {
    #expect(!IceCream.chocolate.containsNuts)
}
@Test func almondHasNuts() {
    #expect(IceCream.almond.containsNuts)
}

// ✅ After: Parameterized
@Test(arguments: [IceCream.vanilla, .chocolate, .strawberry])
func flavorWithoutNuts(_ flavor: IceCream) {
    #expect(!flavor.containsNuts)
}

@Test(arguments: [IceCream.almond, .pistachio])
func flavorWithNuts(_ flavor: IceCream) {
    #expect(flavor.containsNuts)
}
```

### Two-Collection Parameterization

```swift
// Test all combinations (4 × 3 = 12 test cases)
@Test(arguments: [1, 2, 3, 4], ["a", "b", "c"])
func allCombinations(number: Int, letter: String) {
    // Tests: (1,"a"), (1,"b"), (1,"c"), (2,"a"), ...
}

// Test paired values only (3 test cases)
@Test(arguments: zip([1, 2, 3], ["one", "two", "three"]))
func pairedValues(number: Int, name: String) {
    // Tests: (1,"one"), (2,"two"), (3,"three")
}
```

### Benefits Over For-Loops

| For-Loop | Parameterized |
|----------|---------------|
| Stops on first failure | All arguments run |
| Unclear which value failed | Each argument shown separately |
| Sequential execution | Parallel execution |
| Can't re-run single case | Re-run individual arguments |

---

## Fast Tests: Architecture for Testability

### Strategy 1: Swift Package for Logic (Fastest)

Move pure logic into a Swift Package:

```
MyApp/
├── MyApp/                    # App target (UI, app lifecycle)
├── MyAppCore/                # Swift Package (testable logic)
│   ├── Package.swift
│   └── Sources/
│       └── MyAppCore/
│           ├── Models/
│           ├── Services/
│           └── Utilities/
└── MyAppCoreTests/           # Package tests
```

Run with `swift test` — no simulator, no app launch:

```bash
cd MyAppCore
swift test  # Runs in ~0.1 seconds
```

### Strategy 2: Framework with No Host Application

For code that must stay in the app project:

1. **Create a framework target** (File → New → Target → Framework)
2. **Move model code** into the framework
3. **Make types public** that need external access
4. **Add imports** in files using the framework
5. **Set Host Application to "None"** in test target settings

```
Project Settings → Test Target → Testing
  Host Application: None  ← Key setting
  ☐ Allow testing Host Application APIs
```

Build+test time: ~3 seconds vs 20-60 seconds with app launch.

### Strategy 3: Bypass SwiftUI App Launch

If you can't use a framework, bypass the app launch:

```swift
// Simple solution (no custom startup code)
@main
struct ProductionApp: App {
    var body: some Scene {
        WindowGroup {
            if !isRunningTests {
                ContentView()
            }
        }
    }

    private var isRunningTests: Bool {
        NSClassFromString("XCTestCase") != nil
    }
}
```

```swift
// Thorough solution (custom startup code)
@main
struct MainEntryPoint {
    static func main() {
        if NSClassFromString("XCTestCase") != nil {
            TestApp.main()  // Empty app for tests
        } else {
            ProductionApp.main()
        }
    }
}

struct TestApp: App {
    var body: some Scene {
        WindowGroup { }  // Empty
    }
}
```

---

## Async Testing

### Basic Async Tests

```swift
@Test func fetchUserReturnsData() async throws {
    let user = try await userService.fetch(id: 123)
    #expect(user.name == "Alice")
}
```

### Testing Callbacks with Continuations

```swift
// Convert completion handler to async
@Test func legacyAPIWorks() async throws {
    let result = try await withCheckedThrowingContinuation { continuation in
        legacyService.fetchData { result in
            continuation.resume(with: result)
        }
    }
    #expect(result.count > 0)
}
```

### Confirmations for Multiple Events

```swift
@Test func cookiesAreEaten() async {
    await confirmation("cookie eaten", expectedCount: 10) { confirm in
        let jar = CookieJar(count: 10)
        jar.onCookieEaten = { confirm() }
        await jar.eatAll()
    }
}

// Confirm something never happens
await confirmation(expectedCount: 0) { confirm in
    let cache = Cache()
    cache.onEviction = { confirm() }
    cache.store("small-item")  // Should not trigger eviction
}
```

### Reliable Async Testing with Concurrency Extras

**Problem**: Async tests can be flaky due to scheduling unpredictability.

```swift
// ❌ Flaky: Task scheduling is unpredictable
@Test func loadingStateChanges() async {
    let model = ViewModel()
    let task = Task { await model.loadData() }
    #expect(model.isLoading == true)  // Often fails!
    await task.value
}
```

**Solution**: Use Point-Free's `swift-concurrency-extras`:

```swift
import ConcurrencyExtras

@Test func loadingStateChanges() async {
    await withMainSerialExecutor {
        let model = ViewModel()
        let task = Task { await model.loadData() }
        await Task.yield()
        #expect(model.isLoading == true)  // Deterministic!
        await task.value
        #expect(model.isLoading == false)
    }
}
```

**Why it works**: Serializes async work to main thread, making suspension points deterministic.

### Deterministic Time with TestClock

Use Point-Free's `swift-clocks` to control time in tests:

```swift
import Clocks

@MainActor
class FeatureModel: ObservableObject {
    @Published var count = 0
    let clock: any Clock<Duration>
    var timerTask: Task<Void, Error>?

    init(clock: any Clock<Duration>) {
        self.clock = clock
    }

    func startTimer() {
        timerTask = Task {
            while true {
                try await clock.sleep(for: .seconds(1))
                count += 1
            }
        }
    }
}

// Test with controlled time
@Test func timerIncrements() async {
    let clock = TestClock()
    let model = FeatureModel(clock: clock)

    model.startTimer()

    await clock.advance(by: .seconds(1))
    #expect(model.count == 1)

    await clock.advance(by: .seconds(4))
    #expect(model.count == 5)

    model.timerTask?.cancel()
}
```

**Clock types**:
- `TestClock` — Advance time manually, deterministic
- `ImmediateClock` — All sleeps return instantly (great for previews)
- `UnimplementedClock` — Fails if used (catch unexpected time dependencies)

---

## Parallel Testing

Swift Testing runs tests in parallel by default.

### When to Serialize

```swift
// Serialize tests in a suite that share external state
@Suite(.serialized)
struct DatabaseTests {
    @Test func createUser() { }
    @Test func deleteUser() { }  // Runs after createUser
}

// Serialize parameterized test cases
@Test(.serialized, arguments: [1, 2, 3])
func sequentialProcessing(value: Int) { }
```

### Hidden Dependencies

```swift
// ❌ Bug: Tests depend on execution order
@Suite struct CookieTests {
    static var cookie: Cookie?

    @Test func bakeCookie() {
        Self.cookie = Cookie()  // Sets shared state
    }

    @Test func eatCookie() {
        #expect(Self.cookie != nil)  // Fails if runs first!
    }
}

// ✅ Fixed: Each test is independent
@Suite struct CookieTests {
    @Test func bakeCookie() {
        let cookie = Cookie()
        #expect(cookie.isBaked)
    }

    @Test func eatCookie() {
        let cookie = Cookie()
        cookie.eat()
        #expect(cookie.isEaten)
    }
}
```

**Random order** helps expose these bugs — fix them rather than serialize.

---

## Known Issues

Handle expected failures without noise:

```swift
@Test func featureUnderDevelopment() {
    withKnownIssue("Backend not ready yet") {
        try callUnfinishedAPI()
    }
}

// Conditional known issue
@Test func platformSpecificBug() {
    withKnownIssue("Fails on iOS 17.0") {
        try reproduceEdgeCaseBug()
    } when: {
        ProcessInfo().operatingSystemVersion.majorVersion == 17
    }
}
```

**Better than .disabled because**:
- Test still compiles (catches syntax errors)
- You're notified when the issue is fixed
- Results show "expected failure" not "skipped"

---

## Migration from XCTest

### Comparison Table

| XCTest | Swift Testing |
|--------|---------------|
| `func testFoo()` | `@Test func foo()` |
| `XCTAssertEqual(a, b)` | `#expect(a == b)` |
| `XCTAssertNil(x)` | `#expect(x == nil)` |
| `XCTAssertThrowsError` | `#expect(throws:)` |
| `XCTUnwrap(x)` | `try #require(x)` |
| `class FooTests: XCTestCase` | `@Suite struct FooTests` |
| `setUp()` / `tearDown()` | `init` / `deinit` |
| `continueAfterFailure = false` | `#require` (per-expectation) |
| `addTeardownBlock` | `deinit` or defer |

### Keep Using XCTest For

- **UI tests** (XCUIApplication)
- **Performance tests** (XCTMetric)
- **Objective-C tests**

### Migration Tips

1. Both frameworks can coexist in the same target
2. Migrate incrementally, one test file at a time
3. Consolidate similar XCTests into parameterized Swift tests
4. Single-test XCTestCase → global `@Test` function

---

## Common Mistakes

### ❌ Mixing Assertions

```swift
// Don't mix XCTest and Swift Testing
@Test func badExample() {
    XCTAssertEqual(1, 1)  // ❌ Wrong framework
    #expect(1 == 1)       // ✅ Use this
}
```

### ❌ Using Classes for Suites

```swift
// ❌ Avoid: Reference semantics can cause shared state bugs
@Suite class VideoTests { }

// ✅ Prefer: Value semantics isolate each test
@Suite struct VideoTests { }
```

### ❌ Forgetting @MainActor

```swift
// ❌ May fail with Swift 6 strict concurrency
@Test func updateUI() async {
    viewModel.updateTitle("New")  // Data race warning
}

// ✅ Isolate to main actor
@Test @MainActor func updateUI() async {
    viewModel.updateTitle("New")
}
```

### ❌ Over-Serializing

```swift
// ❌ Don't serialize just because tests use async
@Suite(.serialized) struct APITests { }  // Defeats parallelism

// ✅ Only serialize when tests truly share mutable state
```

### ❌ XCTestCase with Swift 6.2 MainActor Default

Swift 6.2's `default-actor-isolation = MainActor` breaks XCTestCase:

```swift
// ❌ Error: Main actor-isolated initializer 'init()' has different
// actor isolation from nonisolated overridden declaration
final class PlaygroundTests: XCTestCase {
    override func setUp() async throws {
        try await super.setUp()
    }
}
```

**Solution**: Mark XCTestCase subclass as `nonisolated`:

```swift
// ✅ Works with MainActor default isolation
nonisolated final class PlaygroundTests: XCTestCase {
    @MainActor
    override func setUp() async throws {
        try await super.setUp()
    }

    @Test @MainActor
    func testSomething() async {
        // Individual tests can be @MainActor
    }
}
```

**Why**: XCTestCase is Objective-C, not annotated for Swift concurrency. Its initializers are `nonisolated`, causing conflicts with MainActor-isolated subclasses.

**Better solution**: Migrate to Swift Testing (`@Suite struct`) which handles isolation properly.

---

## Xcode Optimization for Fast Feedback

### Turn Off Parallel XCTest Execution

Swift Testing runs in parallel by default; XCTest parallelization adds overhead:

```
Test Plan → Options → Parallelization → "Swift Testing Only"
```

### Turn Off Test Debugger

Attaching the debugger costs ~1 second per run:

```
Scheme → Edit Scheme → Test → Info → ☐ Debugger
```

### Delete UI Test Templates

Xcode's default UI tests slow everything down. Remove them:
1. Delete UI test target (Project Settings → select target → -)
2. Delete UI test source folder

### Disable dSYM for Debug Builds

```
Build Settings → Debug Information Format
  Debug: DWARF
  Release: DWARF with dSYM File
```

### Check Build Scripts

Run Script phases without defined inputs/outputs cause full rebuilds. Always specify:
- Input Files / Input File Lists
- Output Files / Output File Lists

---

## Checklist

### Before Writing Tests
- [ ] Identify what can move to a Swift Package (pure logic)
- [ ] Set up framework target if package isn't viable
- [ ] Configure Host Application: None for unit tests

### Writing Tests
- [ ] Use `@Test` with clear display names
- [ ] Use `#expect` for all assertions
- [ ] Use `#require` to fail fast on preconditions
- [ ] Use parameterization for similar test cases
- [ ] Add `.tags()` for organization

### Async Tests
- [ ] Mark test functions `async` and use `await`
- [ ] Use `confirmation()` for callback-based code
- [ ] Consider `withMainSerialExecutor` for flaky tests

### Parallel Safety
- [ ] Avoid shared mutable state between tests
- [ ] Use fresh instances in each test
- [ ] Only use `.serialized` when absolutely necessary

---

## Resources

**WWDC**: 2024-10179, 2024-10195

**Docs**: /testing, /testing/migratingfromxctest, /testing/testing-asynchronous-code, /testing/parallelization

**GitHub**: pointfreeco/swift-concurrency-extras, pointfreeco/swift-clocks

---

**History:** See git log for changes
