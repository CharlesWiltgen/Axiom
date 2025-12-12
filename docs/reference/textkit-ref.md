---
name: textkit-ref
description: Reference — Complete TextKit 2 guide covering architecture, migration from TextKit 1, Writing Tools integration, and SwiftUI TextEditor with AttributedString through iOS 26
---

# TextKit 2 Reference

Complete reference for TextKit 2 covering architecture, migration from TextKit 1, Writing Tools integration, and SwiftUI TextEditor with AttributedString.

## Overview

Comprehensive guide to TextKit 2 APIs and patterns for modern text layout on Apple platforms, based on WWDC 2021-2025 sessions.

## What This Reference Covers

### TextKit 2 Architecture
- **Model Layer** — NSTextContentManager, NSTextContentStorage, NSTextElement
- **Controller Layer** — NSTextLayoutManager, NSTextLayoutFragment, NSTextLineFragment
- **View Layer** — NSTextViewportLayoutController

### Core Design Principles
1. **Correctness** — No glyph APIs, proper handling of complex scripts (Arabic, Kannada)
2. **Safety** — Immutable value semantics prevent unintended sharing
3. **Performance** — Viewport-based layout, always noncontiguous

### Migration from TextKit 1
- **Paradigm shift** — Glyphs → Elements, NSRange → NSTextRange
- **Fallback triggers** — Accessing `.layoutManager` causes one-way fallback
- **NSRange conversion** — Via NSTextContentManager offset methods

### Writing Tools (iOS 18+)
- **TextKit 2 requirement** — Full experience requires TextKit 2 (TK1 = panel-only)
- **Lifecycle methods** — `textViewWritingToolsWillBegin`, `DidEnd`
- **Behavior control** — `.writingToolsBehavior`, `.writingToolsResultOptions`
- **Protected ranges** — Delegate method for code blocks, quotes

### SwiftUI TextEditor + AttributedString (iOS 26+)
- **AttributedString binding** — `TextEditor(text: Binding<AttributedString>)`
- **Custom formatting** — AttributedTextFormattingDefinition protocol
- **Value constraints** — Control attribute values with business logic
- **Selection handling** — AttributedTextSelection for single/multiple ranges

## Key Patterns

### TextKit 2 Check Pattern (Critical)
```swift
// ✅ GOOD: Check TextKit 2 first
if let textLayoutManager = textView.textLayoutManager {
    // TextKit 2 code
} else if let layoutManager = textView.layoutManager {
    // TextKit 1 fallback only for old OS
}

// ❌ BAD: Immediate fallback to TextKit 1
if let layoutManager = textView.layoutManager {
    // Triggers one-way fallback!
}
```

### Create TextKit 2 Text View
```swift
// iOS 16+
let textView = UITextView(usingTextLayoutManager: true)

// macOS 13+
let nsTextView = NSTextView(usingTextLayoutManager: true)
```

### Enumerate Layout Fragments
```swift
var lineCount = 0
textLayoutManager.enumerateTextLayoutFragments(
    from: textLayoutManager.documentRange.location,
    options: [.ensuresLayout]
) { fragment in
    lineCount += fragment.textLineFragments.count
    return true
}
```

### NSRange ↔ NSTextRange Conversion
```swift
// NSRange → NSTextRange
let startLocation = textContentManager.location(
    textContentManager.documentRange.location,
    offsetBy: nsRange.location
)!
let endLocation = textContentManager.location(
    startLocation,
    offsetBy: nsRange.length
)!
let textRange = NSTextRange(location: startLocation, end: endLocation)

// NSTextRange → NSRange
let startOffset = textContentManager.offset(
    from: textContentManager.documentRange.location,
    to: textRange.location
)
let length = textContentManager.offset(
    from: textRange.location,
    to: textRange.endLocation
)
let nsRange = NSRange(location: startOffset, length: length)
```

### Writing Tools Integration
```swift
// Basic configuration
textView.writingToolsBehavior = .default  // Full experience
textView.writingToolsResultOptions = [.richText, .list]

// Lifecycle awareness
func textViewWritingToolsWillBegin(_ textView: UITextView) {
    isSyncing = false  // Pause syncing during Writing Tools
}

func textViewWritingToolsDidEnd(_ textView: UITextView) {
    isSyncing = true  // Resume syncing
}

// Protected ranges (delegate)
func textView(
    _ textView: UITextView,
    writingToolsIgnoredRangesIn enclosingRange: NSRange
) -> [NSRange] {
    return codeBlockRanges + quoteRanges
}
```

### SwiftUI TextEditor with AttributedString
```swift
struct RecipeEditor: View {
    @State private var text: AttributedString = "Recipe text"
    @State private var selection: AttributedTextSelection?

    var body: some View {
        TextEditor(text: $text, selection: $selection)
            .attributedTextFormattingDefinition(RecipeFormattingDefinition.self)
    }
}
```

## Migration Quick Reference

| TextKit 1 | TextKit 2 |
|-----------|-----------|
| `NSLayoutManager` | `NSTextLayoutManager` |
| `NSRange` | `NSTextRange` / `NSTextLocation` |
| `numberOfGlyphs` | Enumerate `textLayoutFragments` |
| `glyphRange(for:)` | No direct equivalent (use fragments) |
| `characterIndex(forGlyphAt:)` | Use NSTextLocation |
| Optional noncontiguous | Always noncontiguous (viewport) |

## Why Glyph APIs Are Dangerous

**Complex Scripts Break 1:1 Mapping:**
- **Arabic**: 1 character → 2+ glyphs (ligatures, position forms)
- **Kannada "October"**: Character 4 → 2 glyphs (split vowel), glyphs reorder
- **Thai**: Combining marks, variable glyph counts

**TextKit 2 Solution**: Abstracts glyphs entirely, uses NSTextLocation for safe positioning.

## Known Limitations

- **Viewport instability** — Scroll position can shift during layout
- **One-way fallback** — Accessing `.layoutManager` permanently switches to TextKit 1
- **Limited TextKit 1 features** — NSTextTable unsupported (use NSTextList or custom layouts)

## Related Resources

- [textkit-auditor](/agents/textkit-auditor) — Scans for TextKit 1 fallback triggers
- [typography-ref](/reference/typography-ref) — Typography and Dynamic Type reference
- [WWDC 2021-10061: Meet TextKit 2](https://developer.apple.com/videos/play/wwdc2021/10061/)
- [WWDC 2024-10168: Get started with Writing Tools](https://developer.apple.com/videos/play/wwdc2024/10168/)
- [WWDC 2025-280: Cook up a rich text experience in SwiftUI](https://developer.apple.com/videos/play/wwdc2025/280/)
