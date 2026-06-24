---
name: swift-testing
description: Swift Testing framework — @Test, #expect, fast tests without simulator, async testing
version: 1.0.0
---

# Swift Testing

Swift Testing is Apple's modern testing framework (WWDC 2024). It uses macros (`@Test`, `#expect`), runs tests in parallel, and integrates with Swift concurrency.

## When to Use

Use this skill when:
- Writing unit tests with Swift Testing
- Making tests run faster (without simulator)
- Testing async code reliably
- Migrating from XCTest
- Deciding between Swift Testing and XCTest
- Issue severity and test cancellation (iOS 27)

## Example Prompts

- "How do I write a unit test with Swift Testing?"
- "My tests take 60 seconds — how do I make them faster?"
- "How do I test async code without flaky failures?"
- "Should I use Swift Testing or XCTest?"
- "How do I migrate from XCTest?"
- "How do I record a non-fatal warning or cancel a test mid-run?" (iOS 27)
- "How do I rerun a flaky test until it fails?" (Xcode 27)
- "How do I make cross-framework XCTest/Swift Testing assertion warnings hard failures?" (Xcode 27)

## What This Skill Provides

- **Issue severity & test cancellation** (iOS 27) — `Issue.record(_:severity:)`, `Test.cancel`

### Basic Structure

```swift
import Testing

@Test func videoHasCorrectMetadata() {
    let video = Video(named: "example.mp4")
    #expect(video.duration == 120)
}
```

### The Speed Hierarchy

| Configuration | Time | Use Case |
|---------------|------|----------|
| `swift test` (Package) | ~0.1s | Pure logic, models |
| Host Application: None | ~3s | Framework code |
| Full app launch | 20-60s | UI tests |

**Key insight**: Move testable logic into Swift Packages, then test with `swift test`.

### Async Testing

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

### XCTest Migration

| XCTest | Swift Testing |
|--------|---------------|
| `func testFoo()` | `@Test func foo()` |
| `XCTAssertEqual(a, b)` | `#expect(a == b)` |
| `XCTUnwrap(x)` | `try #require(x)` |
| `class Tests: XCTestCase` | `@Suite struct Tests` |

**Keep XCTest for**: UI tests, performance tests, Objective-C.

### Parameterized Tests

```swift
@Test(arguments: [IceCream.vanilla, .chocolate, .strawberry])
func flavorWithoutNuts(_ flavor: IceCream) {
    #expect(!flavor.containsNuts)
}
```

## Related

- [ui-testing](/skills/ui-design/ui-testing) – UI testing with Recording UI Automation
- [swift-concurrency](/skills/concurrency/swift-concurrency) – Async patterns for testing

## Resources

**WWDC**: 2024-10179 (Meet Swift Testing), 2024-10195 (Go further), 2026-262, 2026-267

**Docs**: /documentation/testing, /testing/issue/severity

**Point-Free**: swift-concurrency-extras, swift-clocks
