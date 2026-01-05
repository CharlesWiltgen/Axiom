---
name: textkit-ref
description: Reference — Complete TextKit 2 guide covering architecture, migration from TextKit 1, Writing Tools integration, and SwiftUI TextEditor with AttributedString through iOS 26
---

# TextKit 2 Reference

This reference helps you work with Apple's TextKit 2 framework for custom text rendering, rich text editing, and Writing Tools integration. It covers architecture, migration from TextKit 1, and iOS 26+ features.

## When to Use This Reference

Use this reference when you're:
- Building custom text views or rich text editors
- Migrating from TextKit 1 to TextKit 2
- Integrating Writing Tools (iOS 18+)
- Working with SwiftUI TextEditor and AttributedString (iOS 26+)
- Debugging text layout issues or unexpected fallbacks to TextKit 1

**Not sure if you need TextKit 2?** If you're using standard `Text`, `TextField`, or `UILabel`, you probably don't. TextKit 2 is for custom text rendering, syntax highlighting, or rich text editing beyond what built-in controls provide.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I migrate my text view from TextKit 1 to TextKit 2?"
- "Why is my UITextView falling back to TextKit 1?"
- "How do I count lines in TextKit 2 without glyph APIs?"
- "How do I integrate Writing Tools with my custom text editor?"
- "How do I use AttributedString with SwiftUI TextEditor in iOS 26?"
- "What's the difference between NSTextRange and NSRange?"

## What's Covered

### Core Architecture
- Three-layer MVC pattern (Model, Controller, View)
- NSTextContentManager, NSTextLayoutManager, NSTextViewportLayoutController
- Object-based ranges (NSTextLocation, NSTextRange) vs integer indices

### Migration from TextKit 1
- Paradigm shift from glyphs to elements
- NSRange ↔ NSTextRange conversion patterns
- Fallback triggers to avoid (accessing `.layoutManager` causes one-way fallback)
- Why glyph APIs are dangerous for international text

### Writing Tools (iOS 18+)
- TextKit 2 requirement for full experience
- Lifecycle delegate methods
- Protected ranges for code blocks and quotes
- Writing Tools Coordinator for custom text engines (iOS 26+)

### SwiftUI TextEditor (iOS 26+)
- AttributedString binding
- Custom formatting definitions
- Value constraints
- Selection handling

## Documentation Scope

This page documents the `axiom-textkit-ref` skill—a comprehensive reference Claude uses when answering TextKit 2 questions. The skill contains detailed API documentation, code examples, and migration patterns.

**For automated scanning:** Use the [textkit-auditor](/agents/textkit-auditor) agent to scan your codebase for TextKit 1 fallback triggers and migration opportunities.

**For typography and Dynamic Type:** See [typography-ref](/reference/typography-ref) for font handling, text styles, and accessibility considerations.

## Key Patterns

### Checking for TextKit 2 (Critical)

Always check TextKit 2 first to avoid triggering fallback:

```swift
// ✅ GOOD: Check TextKit 2 first
if let textLayoutManager = textView.textLayoutManager {
    // TextKit 2 code
} else if let layoutManager = textView.layoutManager {
    // TextKit 1 fallback only for old OS
}

// ❌ BAD: Accessing .layoutManager triggers one-way fallback
if let layoutManager = textView.layoutManager {
    // You're now stuck in TextKit 1!
}
```

### Creating a TextKit 2 Text View

```swift
// iOS 16+ / macOS 13+
let textView = UITextView(usingTextLayoutManager: true)
```

### Writing Tools Integration

```swift
// Lifecycle awareness
func textViewWritingToolsWillBegin(_ textView: UITextView) {
    isSyncing = false  // Pause syncing during Writing Tools
}

func textViewWritingToolsDidEnd(_ textView: UITextView) {
    isSyncing = true  // Resume syncing
}
```

## Known Limitations

- **One-way fallback** — Accessing `.layoutManager` permanently switches to TextKit 1
- **No glyph APIs** — Use NSTextLocation and layout fragments instead
- **NSTextTable unsupported** — Use NSTextList or custom layouts

## Related Resources

- [textkit-auditor](/agents/textkit-auditor) — Autonomous agent that scans for TextKit 1 fallback triggers
- [typography-ref](/reference/typography-ref) — Typography, Dynamic Type, and font handling reference
- [WWDC 2021-10061](https://developer.apple.com/videos/play/wwdc2021/10061/) — Meet TextKit 2
- [WWDC 2024-10168](https://developer.apple.com/videos/play/wwdc2024/10168/) — Get started with Writing Tools
- [WWDC 2025-280](https://developer.apple.com/videos/play/wwdc2025/280/) — Cook up a rich text experience in SwiftUI
