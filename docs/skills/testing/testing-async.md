---
name: testing-async
description: Swift Testing patterns for async code — confirmation for callbacks, @MainActor tests, parallel execution, XCTest migration
---

# Testing Async Code — Swift Testing Patterns

**Purpose**: Modern patterns for testing async/await code with Swift Testing framework
**Swift Version**: Swift 6+
**Xcode Version**: Xcode 16+

## When to Use This Skill

✅ **Use this skill when**:
- Writing tests for async functions
- Testing callback-based APIs with Swift Testing
- Migrating async XCTests to Swift Testing
- Testing MainActor-isolated code
- Need to verify events fire expected number of times

❌ **Do NOT use this skill for**:
- XCTest-only project (use XCTestExpectation)
- UI automation tests (use XCUITest)
- Performance testing with metrics (use XCTest)

## Key Differences from XCTest

| XCTest | Swift Testing |
|--------|---------------|
| `XCTestExpectation` | `confirmation { }` |
| `wait(for:timeout:)` | `await confirmation` |
| `@MainActor` implicit | `@MainActor` explicit |
| Serial by default | **Parallel by default** |

## Key Patterns

### Simple Async Function

```swift
@Test func fetchUser() async throws {
    let user = try await api.fetchUser(id: 1)
    #expect(user.name == "Alice")
}
```

### Callback with confirmation

```swift
@Test func notificationFires() async {
    await confirmation { confirm in
        NotificationCenter.default.addObserver(
            forName: .didUpdate, object: nil, queue: .main
        ) { _ in
            confirm()
        }
        triggerUpdate()
    }
}
```

### Multiple Callbacks

```swift
@Test func delegateCalledThreeTimes() async {
    await confirmation(expectedCount: 3) { confirm in
        delegate.onProgress = { _ in confirm() }
        startDownload()
    }
}
```

### MainActor Tests

```swift
@Test @MainActor func viewModelUpdates() async {
    let vm = ViewModel()
    await vm.load()
    #expect(vm.items.count > 0)
}
```

## Common Mistakes

### Using sleep Instead of confirmation

```swift
// ❌ Flaky
try await Task.sleep(for: .seconds(1))
#expect(eventReceived)

// ✅ Deterministic
await confirmation { confirm in
    onEvent = { confirm() }
    triggerEvent()
}
```

## Related Skills

- [Swift Testing](./swift-testing) — Complete Swift Testing guide
- [Swift Concurrency](/skills/concurrency/swift-concurrency) — Async/await patterns

## Resources

- **WWDC**: [Meet Swift Testing (10179)](https://developer.apple.com/videos/play/wwdc2024/10179/)
- **WWDC**: [Go further with Swift Testing (10195)](https://developer.apple.com/videos/play/wwdc2024/10195/)
- **Docs**: [Testing Framework](https://developer.apple.com/documentation/testing)
