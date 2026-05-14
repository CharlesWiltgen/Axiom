---
name: isolation-inheritance-diag
description: Diagnostic for warning-free Swift 6 builds that crash in production with _dispatch_assert_queue_fail or _swift_task_checkIsolatedSwift
skill_type: diagnostic
version: 1.0
---

# Runtime Isolation Crash Diagnostics

Systematic diagnostic for production crashes that happen even though your Swift 6 build has zero strict-concurrency warnings. Closures and methods silently inherit actor isolation from their defining context; when an SDK calls them on a different thread, the runtime guard trips.

## Symptoms This Diagnoses

Use when you're experiencing:

- Crash signature `_dispatch_assert_queue_fail` in `.ips`, MetricKit, or `xcsym crash` output
- Crash signature `_swift_task_checkIsolatedSwift` or `swift_task_checkIsolated`
- A warning-free Swift 6 build that ships clean but crashes in production
- Core Data `context.perform` closures inside an `@MainActor` view model crashing on the private queue
- Combine `.map` / `.filter` / `.sink` operators crashing when the publisher emits off-main
- `NotificationCenter.default.publisher(...).sink` crashes when notifications are posted from background threads
- Delegate methods (`CLLocationManagerDelegate`, `NSDocument`, `AVAudioPlayerDelegate`, `WKNavigationDelegate`) on `@MainActor` classes crashing on framework callback
- `MainActor.assumeIsolated` crashes when the caller turns out not to be on main
- State staleness or precondition failures after `await` inside actors (reentrancy)

## Example Prompts

- "Why does my warning-free Swift 6 build crash with `_dispatch_assert_queue_fail`?"
- "Core Data `context.perform` crashes inside my `@MainActor` view model"
- "CLLocationManager delegate method is crashing with `_swift_task_checkIsolatedSwift`"
- "My Combine pipeline crashes when the publisher emits on a background thread"
- "Should I use `@Sendable in` or `.receive(on:)` to fix this isolation crash?"
- "`MainActor.assumeIsolated` is crashing — but my class is `@MainActor`, what's wrong?"

## Diagnostic Workflow

Claude walks through:

### Step 1: Identify the Crash Signature

| Symbol | Meaning |
|--------|---------|
| `_dispatch_assert_queue_fail` | Code expected a specific dispatch queue, ran on a different one |
| `_swift_task_checkIsolatedSwift` | Code expected actor isolation, ran outside it |
| `swift_task_checkIsolated` | Runtime isolation guard tripped (same family) |

Both come from the same root cause: a closure or method inherited actor isolation from its defining context, then was called on a different thread.

### Step 2: Categorize the Pattern

| Symptom | Pattern |
|---------|---------|
| Closure passed to SDK API crashes (`context.perform`, `.map`, `.sink`) | Pattern 1 — Closure isolation inheritance |
| Delegate method on `@MainActor` class crashes when framework calls it | Pattern 2 — Delegate isolation inheritance |
| `MainActor.assumeIsolated { ... }` line in the crash trace | Pattern 3 — `assumeIsolated` misuse |
| Precondition failure after `await` inside an actor | Pattern 4 — Actor reentrancy staleness |

### Step 3: Apply the Canonical Fix

Claude reads the [axiom-concurrency](/skills/concurrency/) suite's `isolation-inheritance-diag.md` and prescribes the specific fix for the pattern — `@Sendable in` annotation, `.receive(on:)` placement, `nonisolated` + `Task { @MainActor in }`, or state re-check after `await`.

## Key Diagnostic Patterns

### Pattern 1 — Closure Isolation Inheritance

Closure defined inside an `@MainActor` context inherits that isolation. Compiler injects a runtime assertion. SDK calls it on its own queue. Trap fires.

```swift
// ❌ CRASHES with _dispatch_assert_queue_fail
@MainActor
class ContactsViewModel {
    func deleteAll(context: NSManagedObjectContext) {
        context.perform {
            // Inherits @MainActor; Core Data runs it on private queue
            let request = NSFetchRequest<Contact>(entityName: "Contact")
            let contacts = try? context.fetch(request)
            contacts?.forEach { context.delete($0) }
        }
    }
}

// ✅ FIX — @Sendable opts the closure out of isolation inheritance
context.perform { @Sendable in
    let request = NSFetchRequest<Contact>(entityName: "Contact")
    let contacts = try? context.fetch(request)
    contacts?.forEach { context.delete($0) }
}
```

For Combine, the position of `.receive(on:)` matters — it must run *before* any isolated operator, or those operators run on the upstream thread first.

### Pattern 2 — Delegate Methods Inherit Isolation Too

When a class is `@MainActor`, every method inherits isolation including delegate overrides. SDKs that deliver callbacks on background queues then trip the runtime check.

```swift
// ❌ CRASHES — CLLocationManager delivers on its own queue
@MainActor
class LocationManager: NSObject, CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        updateMap(with: locations)
    }
}

// ✅ FIX — nonisolated on the delegate method, hop to MainActor for UI
nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    Task { @MainActor in
        self.updateMap(with: locations)
    }
}
```

Same pattern for `NSDocument.autosavesInPlace`, `AVAudioPlayerDelegate`, `WKNavigationDelegate`, and any SDK delegate that does not document main-thread delivery.

### Pattern 3 — `MainActor.assumeIsolated` Misuse

`assumeIsolated` is a runtime assertion, not a thread hop. Using it as a sync alternative to `await MainActor.run` from arbitrary contexts crashes whenever the caller turns out not to be on main.

Use it only for legacy delegates documented to deliver on the main thread. For uncertain contexts, use `await MainActor.run { ... }` instead.

### Pattern 4 — Actor Reentrancy State Staleness

After every `await` inside an actor method, other tasks can mutate the actor's state. State captured before suspension may be stale. Re-check after `await`, or restructure to avoid the gap.

## Quick Reference

| Symptom | Fix | Time |
|---------|-----|------|
| `context.perform { ... }` in `@MainActor` class crashes | `context.perform { @Sendable in ... }` | 1 min |
| Combine `.map` crashes before `.receive(on:)` | Move `.receive(on: .main)` before `.map`, OR `@Sendable` on `.map` | 1 min |
| `NotificationCenter` `.sink` crashes when posted off-main | Add `.receive(on: DispatchQueue.main)` before `.sink` | 1 min |
| Delegate method on `@MainActor` class crashes | `nonisolated` method + `Task { @MainActor in }` | 3 min |
| `assumeIsolated` crashes | Replace with `await MainActor.run { }` | 2 min |
| Stale state after `await` in actor | Re-check after suspension | 5 min |

## Testing Implication

These crashes only surface with **real SDK callbacks and background-thread publishers**. Unit tests driving code synchronously on the main thread will not trigger them.

Add to your test plan:

- Drive Core Data through `context.perform` from `Task.detached`
- Post notifications via `DispatchQueue.global().async { NotificationCenter.default.post(...) }`
- Exercise location/audio/network delegates on real devices, not just mocks
- Send Combine values on non-main schedulers
- Run integration tests on iOS 17.4+ where Swift 6 runtime assertions are strictest

## Documentation Scope

This page documents the `isolation-inheritance-diag` skill in the [axiom-concurrency](/skills/concurrency/) suite — systematic diagnostics for crashes that escape Swift 6's compile-time checks.

**For Swift 6 compile-time concurrency rules** see [swift-concurrency](/skills/concurrency/swift-concurrency).

**For `assumeIsolated` patterns** see [assume-isolated](/skills/concurrency/assume-isolated).

**For automated crash triage** see [crash-analyzer](/agents/crash-analyzer) — the `swift_concurrency_violation` pattern_tag routes here.

## Related

- [swift-concurrency](/skills/concurrency/swift-concurrency) — Core Swift 6 concurrency patterns (isolation rules, `@concurrent`)
- [assume-isolated](/skills/concurrency/assume-isolated) — When `MainActor.assumeIsolated` is the right tool
- [combine-patterns](/skills/concurrency/combine-patterns) — Combine schedulers and `.receive(on:)` placement
- [core-data](/skills/persistence/core-data) — Core Data threading model and `context.perform` patterns
- [crash-analyzer](/agents/crash-analyzer) — Automated symbolication that recognizes these signatures

## Resources

**WWDC**: 2024-10169 (What's new in Swift), 2025-268 (Embracing Swift concurrency)

**Docs**: /swift/sendable, /swift/mainactor, /coredata/nsmanagedobjectcontext/perform

**External**: Khoa Pham — "How to avoid Swift 6 concurrency crashes" (onmyway133.com)
