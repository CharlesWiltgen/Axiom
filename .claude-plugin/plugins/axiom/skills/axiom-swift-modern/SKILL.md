---
name: axiom-swift-modern
description: Use when reviewing or generating Swift code for modern idiom correctness — catches outdated APIs, pre-Swift 5.5 patterns, and Foundation legacy usage that Claude defaults to
license: MIT
---

# Modern Swift Idioms

## Purpose

Claude frequently generates outdated Swift patterns from its training data. This skill corrects the most common ones — patterns that compile fine but use legacy APIs when modern equivalents are clearer, more efficient, or more correct.

**Philosophy**: "Don't repeat what LLMs already know — focus on edge cases, surprises, soft deprecations." (Paul Hudson)

## Modern API Replacements

| Old Pattern | Modern Swift | Since | Why |
|-------------|-------------|-------|-----|
| `Date()` | `Date.now` | 5.6 | Clearer intent |
| `filter { }.count` | `count(where:)` | 5.0 | Single pass, no intermediate allocation |
| `replacingOccurrences(of:with:)` | `replacing(_:with:)` | 5.7 | Swift native, no Foundation bridge |
| `CGFloat` | `Double` | 5.5 | Implicit bridging; exceptions: optionals, inout, ObjC-bridged APIs |
| `Task.sleep(nanoseconds:)` | `Task.sleep(for: .seconds(1))` | 5.7 | Type-safe Duration API |
| `DateFormatter()` | `.formatted()` / `FormatStyle` | 5.5 | No instance management, localizable by default |
| `String(format: "%.2f", val)` | `val.formatted(.number.precision(.fractionLength(2)))` | 5.5 | Type-safe, localized |
| `localizedCaseInsensitiveContains()` | `localizedStandardContains()` | 5.0 | Handles diacritics, ligatures, width variants |
| `"\(firstName) \(lastName)"` | `PersonNameComponents` with `.formatted()` | 5.5 | Respects locale name ordering |
| `"yyyy-MM-dd"` with DateFormatter | `try Date(string, strategy: .iso8601)` | 5.6 | Modern parsing (throws); use "y" not "yyyy" for display |
| `contains()` on user input | `localizedStandardContains()` | 5.0 | Required for correct text search/filtering |

## Modern Syntax

| Old Pattern | Modern Swift | Since |
|-------------|-------------|-------|
| `if let value = value {` | `if let value {` | 5.7 |
| Explicit `return` in single-expression | Omit `return`; `if`/`switch` are expressions | 5.9 |
| `Circle()` in modifiers | `.circle` (static member lookup) | 5.5 |
| `import UIKit` alongside `import SwiftUI` | Often not needed — SwiftUI re-exports most UIKit/AppKit types. Retain for UIKit-only APIs (`UIApplication`, etc.) | 5.5 |

## Foundation Modernization

| Old Pattern | Modern Foundation | Since |
|-------------|------------------|-------|
| `FileManager.default.urls(for: .documentDirectory, ...)` | `URL.documentsDirectory` | 5.7 |
| `url.appendingPathComponent("file")` | `url.appending(path: "file")` | 5.7 |
| `books.sorted { $0.author < $1.author }` (repeated) | Conform to `Comparable`, call `.sorted()` | — |
| `"yyyy"` in date format for display | `"y"` — correct in all calendar systems | — |

## SwiftUI Convenience APIs Claude Misses

- **`ContentUnavailableView.search(text: searchText)`** (iOS 17+) automatically includes the search term — no need to compose a custom string
- **`LabeledContent` in Forms** (iOS 16+) provides consistent label alignment without manual HStack layout
- **`confirmationDialog()` must attach to triggering UI** — Liquid Glass morphing animations depend on the source element

## Common Claude Hallucinations

These patterns appear frequently in Claude-generated code:

1. **Creates `DateFormatter` instances inline** — Use `.formatted()` or `FormatStyle` instead. If a formatter must exist, make it `static let`.
2. **Uses `DispatchQueue.main.async`** — Use `@MainActor` or `MainActor.run`. Never GCD. (See `axiom-swift-concurrency` for full guidance.)
3. **Uses `CGFloat` for SwiftUI parameters** — `Double` works everywhere since Swift 5.5 implicit bridging.
4. **Generates `guard let x = x else`** — Use `guard let x else` shorthand.
5. **Returns explicitly in single-expression computed properties** — Omit `return`.

## Resources

**Skills**: axiom-swift-performance, axiom-swift-concurrency, axiom-swiftui-architecture
