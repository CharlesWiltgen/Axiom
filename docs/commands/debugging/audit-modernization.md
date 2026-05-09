---
name: audit-modernization
description: Scan for legacy iOS patterns to migrate — ObservableObject, @StateObject, deprecated APIs
---

# audit-modernization

Scan for legacy iOS patterns that have modern replacements, with migration guidance for each.

## What This Command Does

Launches the **modernization-helper** agent to identify code still using older patterns and suggest the iOS 17/18+ replacement, including code samples for the migration.

## What It Checks

1. **ObservableObject → @Observable** — classes using the older protocol that should adopt the macro
2. **@StateObject → @State** — `@StateObject` declarations on `@Observable` types (which require `@State`)
3. **Deprecated APIs** — calls to deprecated SwiftUI/UIKit APIs flagged with the corresponding `@available` replacement
4. **Combine → AsyncSequence** — `Publisher` chains that translate cleanly to `for await`
5. **Async legacy bridges** — `withCheckedContinuation` calls where a modern async API now exists

## Related Agent

- [modernization-helper](/agents/modernization-helper) — The agent that powers this command
