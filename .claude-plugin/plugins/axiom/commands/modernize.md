---
name: modernize
description: Migrate legacy iOS patterns to modern equivalents (launches modernization-helper agent)
disable-model-invocation: true
---

# Modernize iOS Code

Launches the **modernization-helper** agent to find legacy patterns and give you the migration path for each.

Shorthand for `/axiom:audit modernization` — same agent, fewer keystrokes.

## What It Does

The agent will:
1. Scan for `ObservableObject` / `@Published` that should become `@Observable`
2. Find `@StateObject` and `@ObservedObject` that should become `@State` / `@Bindable`
3. Flag deprecated SwiftUI APIs still in use, with their replacements
4. Identify UIKit patterns that have a modern SwiftUI or scene-lifecycle equivalent
5. Give a migration path per finding rather than a bare list, so you can adopt incrementally

## Prefer Natural Language?

You can also trigger this agent by saying:
- "How do I migrate from ObservableObject to @Observable?"
- "Are there any deprecated APIs in my SwiftUI code?"
- "Update my code to use modern SwiftUI patterns"
- "Should I still use @StateObject?"
