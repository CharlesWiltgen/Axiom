---
name: modernize
description: Find legacy iOS patterns and get a migration path for each — @Observable, @State, deprecated SwiftUI APIs
---

# modernize

Find legacy patterns in your codebase and get the migration path for each one.

Shorthand for [`/axiom:audit modernization`](/commands/debugging/audit-modernization) — same agent, fewer keystrokes.

## What This Command Does

Launches the **modernization-helper** agent. It reports each legacy pattern with the modern equivalent and how to get there, so you can adopt incrementally rather than facing an all-or-nothing rewrite.

## What It Checks

1. **`ObservableObject` / `@Published`** – the `@Observable` macro replacement, and what changes about view updates
2. **`@StateObject` / `@ObservedObject`** – when these become `@State` and `@Bindable`
3. **Deprecated SwiftUI APIs** – still-compiling calls that have a current replacement
4. **UIKit patterns with a modern equivalent** – including scene-lifecycle migrations
5. **Migration order** – which changes are safe in isolation and which have to move together

## Usage

```
/axiom:modernize
```

## Related

- [modernization-helper](/agents/modernization-helper) – The agent that powers this command
- [audit-modernization](/commands/debugging/audit-modernization) – The same agent under the `/axiom:audit` family
