---
name: axiom-assume-isolated
description: Use when needing synchronous actor access in tests, legacy delegate callbacks, or performance-critical code. Covers MainActor.assumeIsolated, @preconcurrency protocol conformances, crash behavior, Task vs assumeIsolated.
user-invocable: true
skill_type: discipline
version: 1.0.0
---

# assumeIsolated — Synchronous Actor Access

Synchronously access actor-isolated state when you **know** you're already on the correct isolation domain.

## When to Use

✅ **Use when:**
- Testing MainActor code synchronously (avoiding Task overhead)
- Legacy delegate callbacks documented to run on main thread
- Performance-critical code avoiding async hop overhead
- Protocol conformances where callbacks are guaranteed on specific actor

❌ **Don't use when:**
- Uncertain about current isolation (use `await` instead)
- Already in async context (you have isolation)
- Cross-actor calls needed (use async)
- Callback origin is unknown or untrusted

## API Reference

### MainActor.assumeIsolated

```swift
static func assumeIsolated<T>(
    _ operation: @MainActor () throws -> T,
    file: StaticString = #fileID,
    line: UInt = #line
) rethrows -> T where T: Sendable
```

**Behavior**: Executes synchronously. **Crashes** if not on MainActor's serial executor.

### Custom Actor assumeIsolated

```swift
func assumeIsolated<T>(
    _ operation: (isolated Self) throws -> T,
    file: StaticString = #fileID,
    line: UInt = #line
) rethrows -> T where T: Sendable
```

## Task vs assumeIsolated

| Aspect | `Task { @MainActor in }` | `MainActor.assumeIsolated` |
|--------|--------------------------|---------------------------|
| Timing | Deferred (next run loop) | Synchronous (inline) |
| Async support | Yes (can await) | No (sync only) |
| Context | From any context | Must be sync function |
| Failure mode | Runs anyway | **Crashes** if wrong isolation |
| Use case | Start async work | Verify + access isolated state |

## Patterns

### Pattern 1: Testing MainActor Code

```swift
@Test func viewModelUpdates() {
    MainActor.assumeIsolated {
        let vm = ViewModel()
        vm.update()
        #expect(vm.state == .updated)
    }
}
```

### Pattern 2: Legacy Delegate Callbacks

From WWDC 2024-10169 — When documentation guarantees main thread delivery:

```swift
@MainActor
class LocationDelegate: NSObject, CLLocationManagerDelegate {
    var location: CLLocation?

    // CLLocationManager created on main thread delivers callbacks on main thread
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

### Pattern 3: @preconcurrency Shorthand

`@preconcurrency` is equivalent shorthand — wraps in `assumeIsolated` automatically:

```swift
// ❌ Manual approach (verbose)
extension MyClass: SomeDelegate {
    nonisolated func callback() {
        MainActor.assumeIsolated {
            self.updateUI()
        }
    }
}

// ✅ Using @preconcurrency (equivalent, cleaner)
extension MyClass: @preconcurrency SomeDelegate {
    func callback() {
        self.updateUI()  // Compiler wraps in assumeIsolated
    }
}
```

**When protocol adds isolation**: `@preconcurrency` becomes unnecessary and compiler warns.

### Pattern 4: Thread Check Before assumeIsolated

When caller context is unknown (e.g., library code):

```swift
func getView() -> UIView {
    if Thread.isMainThread {
        return createHostingViewOnMain()
    } else {
        return DispatchQueue.main.sync {
            createHostingViewOnMain()
        }
    }
}

private func createHostingViewOnMain() -> UIView {
    MainActor.assumeIsolated {
        let hosting = UIHostingController(rootView: MyView())
        return hosting.view
    }
}
```

### Pattern 5: Custom Actor Access

```swift
actor DataStore {
    var cache: [String: Data] = [:]

    nonisolated func synchronousRead(key: String) -> Data? {
        // Only safe if called from DataStore's executor
        assumeIsolated { isolated in
            isolated.cache[key]
        }
    }
}
```

## Common Mistakes

### Mistake 1: Silencing Compiler Errors

```swift
// ❌ DANGEROUS: Using assumeIsolated to silence warnings
func unknownContext() {
    MainActor.assumeIsolated {
        updateUI()  // Crashes if not actually on main actor!
    }
}

// ✅ When uncertain, use proper async
func unknownContext() async {
    await MainActor.run {
        updateUI()
    }
}
```

### Mistake 2: Assuming GCD Main Queue == MainActor

They're **usually** the same, but not guaranteed. Check documentation or use async.

### Mistake 3: Using in Async Context

```swift
// ❌ Unnecessary — you already have isolation
@MainActor
func updateState() async {
    MainActor.assumeIsolated {  // Pointless
        self.state = .ready
    }
}

// ✅ Direct access
@MainActor
func updateState() async {
    self.state = .ready
}
```

## When @preconcurrency Becomes Unnecessary

If the protocol later adds MainActor isolation:

```swift
// Library update:
@MainActor
protocol CaffeineThresholdDelegate: AnyObject {
    func caffeineLevel(at level: Double)
}

// Your code — @preconcurrency now warns:
// "@preconcurrency attribute on conformance has no effect"
extension Recaffeinater: CaffeineThresholdDelegate {
    func caffeineLevel(at level: Double) {
        // Direct access, no wrapper needed
    }
}
```

## Crash Behavior

Per Apple documentation:
> "If the current context is not running on the actor's serial executor... this method will crash with a fatal error."

**Trapping is intentional**: Better to crash than corrupt user data with a race condition.

## Resources

**WWDC**: 2024-10169

**Docs**: /swift/mainactor/assumeisolated, /swift/actor/assumeisolated

**Skills**: axiom-swift-concurrency
