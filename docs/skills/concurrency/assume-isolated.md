---
name: assume-isolated
description: Synchronous actor access for tests, legacy callbacks, and performance-critical code — MainActor.assumeIsolated, @preconcurrency conformances, crash behavior
---

# assumeIsolated — Synchronous Actor Access

**Purpose**: Synchronously access actor-isolated state when you know you're on the correct isolation domain
**Swift Version**: Swift 5.9+
**iOS Version**: iOS 13+

## When to Use This Skill

✅ **Use this skill when**:
- Testing MainActor code synchronously (avoiding Task overhead)
- Legacy delegate callbacks documented to run on main thread
- Performance-critical code avoiding async hop overhead
- Protocol conformances where callbacks are guaranteed on specific actor

❌ **Do NOT use this skill for**:
- Uncertain about current isolation (use `await` instead)
- Already in async context (you have isolation)
- Cross-actor calls needed (use async)

## Key Patterns

### MainActor.assumeIsolated

```swift
static func assumeIsolated<T>(
    _ operation: @MainActor () throws -> T,
    file: StaticString = #fileID,
    line: UInt = #line
) rethrows -> T where T: Sendable
```

**Behavior**: Executes synchronously. **Crashes** if not on MainActor's serial executor.

### Legacy Delegate Callbacks

From WWDC 2024-10169 — When documentation guarantees main thread delivery:

```swift
@MainActor
class LocationDelegate: NSObject, CLLocationManagerDelegate {
    var location: CLLocation?

    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        MainActor.assumeIsolated {
            self.location = locations.last
        }
    }
}
```

### @preconcurrency Shorthand

```swift
// ✅ Using @preconcurrency (cleaner)
extension MyClass: @preconcurrency SomeDelegate {
    func callback() {
        self.updateUI()  // Compiler wraps in assumeIsolated
    }
}
```

## Task vs assumeIsolated

| Aspect | `Task { @MainActor in }` | `MainActor.assumeIsolated` |
|--------|--------------------------|---------------------------|
| Timing | Deferred (next run loop) | Synchronous (inline) |
| Async support | Yes (can await) | No (sync only) |
| Failure mode | Runs anyway | **Crashes** if wrong isolation |

## Related Skills

- [Swift Concurrency](./swift-concurrency) — Complete concurrency guide
- [Swift Testing](/skills/testing/swift-testing) — Testing MainActor code

## Resources

- **WWDC**: [Migrate your app to Swift 6 (10169)](https://developer.apple.com/videos/play/wwdc2024/10169/)
- **Docs**: [MainActor.assumeIsolated](https://developer.apple.com/documentation/swift/mainactor/assumeisolated)
