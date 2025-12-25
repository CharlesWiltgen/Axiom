---
name: swift-testing
description: Use when writing unit tests, adopting Swift Testing framework, making tests run faster without simulator, architecting code for testability, testing async code reliably, or migrating from XCTest
version: 1.0.0
last_updated: WWDC 2024 (Swift Testing framework)
---

# Swift Testing

## Overview

Swift Testing is Apple's modern testing framework introduced at WWDC 2024. It uses Swift macros (`@Test`, `#expect`) instead of naming conventions, runs tests in parallel by default, and integrates seamlessly with Swift concurrency.

**Core principle**: Tests should be fast, reliable, and expressive. The fastest tests run without launching your app or simulator.

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

#### 1. "How do I write a unit test with Swift Testing?"
→ Shows `@Test`, `#expect`, `#require` with examples and comparison to XCTest

#### 2. "My tests take 60 seconds to run. How do I make them faster?"
→ Explains the Speed Hierarchy: Package tests (0.1s) → Framework (3s) → Full app (60s)

#### 3. "How do I test async code without flaky failures?"
→ Covers `confirmation()`, `withMainSerialExecutor`, and `TestClock`

#### 4. "Should I use Swift Testing or XCTest?"
→ Decision tree: Swift Testing for unit tests, XCTest for UI/performance tests

#### 5. "How do I migrate from XCTest to Swift Testing?"
→ Comparison table and incremental migration strategy

---

## The Speed Hierarchy

Tests run at dramatically different speeds:

| Configuration | Time | Use Case |
|---------------|------|----------|
| `swift test` (Package) | ~0.1s | Pure logic, models |
| Host Application: None | ~3s | Framework code |
| Bypass app launch | ~6s | App target, skip init |
| Full app launch | 20-60s | UI tests |

**Key insight**: Move testable logic into Swift Packages, then test with `swift test`.

## Building Blocks

### @Test Functions

```swift
import Testing

@Test func videoHasCorrectMetadata() {
    let video = Video(named: "example.mp4")
    #expect(video.duration == 120)
}
```

No `test` prefix required. Can be global functions or struct methods.

### #expect and #require

```swift
// Continues on failure
#expect(result == expected)

// Stops on failure (unwraps optionals)
let user = try #require(await fetchUser(id: 123))
#expect(user.name == "Alice")
```

### @Suite Types

```swift
@Suite("Video Processing Tests")
struct VideoTests {
    let video = Video(named: "sample.mp4")  // Fresh per test

    @Test func hasCorrectDuration() {
        #expect(video.duration == 120)
    }
}
```

Use structs, not classes. Each test gets its own instance.

## Parameterized Tests

```swift
@Test(arguments: [IceCream.vanilla, .chocolate, .strawberry])
func flavorWithoutNuts(_ flavor: IceCream) {
    #expect(!flavor.containsNuts)
}
```

All arguments run in parallel. Each failure is reported separately.

## Fast Tests Without Simulator

### Option 1: Swift Package (Fastest)

```
MyApp/
├── MyApp/           # App target
└── MyAppCore/       # Package with testable logic
    └── Tests/       # Run with `swift test`
```

### Option 2: Framework with No Host

```
Test Target → Host Application: None
```

### Option 3: Bypass App Launch

```swift
@main
struct MainEntryPoint {
    static func main() {
        if NSClassFromString("XCTestCase") != nil {
            TestApp.main()  // Empty app
        } else {
            ProductionApp.main()
        }
    }
}
```

## Async Testing

### Confirmations for Events

```swift
@Test func notificationReceived() async {
    await confirmation(expectedCount: 1) { confirm in
        NotificationCenter.default.addObserver(...) {
            confirm()
        }
        triggerNotification()
    }
}
```

### Reliable with withMainSerialExecutor

```swift
import ConcurrencyExtras

@Test func loadingStateChanges() async {
    await withMainSerialExecutor {
        let model = ViewModel()
        let task = Task { await model.loadData() }
        await Task.yield()
        #expect(model.isLoading == true)  // Deterministic
    }
}
```

### Controlled Time with TestClock

```swift
import Clocks

@Test func timerIncrements() async {
    let clock = TestClock()
    let model = FeatureModel(clock: clock)

    model.startTimer()
    await clock.advance(by: .seconds(5))
    #expect(model.count == 5)
}
```

## Migration from XCTest

| XCTest | Swift Testing |
|--------|---------------|
| `func testFoo()` | `@Test func foo()` |
| `XCTAssertEqual(a, b)` | `#expect(a == b)` |
| `XCTUnwrap(x)` | `try #require(x)` |
| `class Tests: XCTestCase` | `@Suite struct Tests` |
| `setUp()` | `init` |

**Keep XCTest for**: UI tests, performance tests, Objective-C.

## Reference

**WWDC 2024**:
- [Meet Swift Testing](https://developer.apple.com/videos/play/wwdc2024/10179/)
- [Go further with Swift Testing](https://developer.apple.com/videos/play/wwdc2024/10195/)

**Apple Documentation**:
- [Swift Testing](https://developer.apple.com/documentation/testing)

**Point-Free**:
- [swift-concurrency-extras](https://github.com/pointfreeco/swift-concurrency-extras)
- [swift-clocks](https://github.com/pointfreeco/swift-clocks)

**Fast Testing**:
- [Quality Coding: Optimize Xcode for fast tests](https://qualitycoding.org/optimize-xcode-for-fast-tests/)
- [xp123: Run tests without an app](https://xp123.com/run-tests-without-an-app-step-by-step-with-xcode/)
