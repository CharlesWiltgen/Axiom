# textkit-auditor

Scans Swift code for TextKit issues — both known anti-patterns like silent TextKit 1 fallback triggers, deprecated glyph APIs that break on Arabic/Hebrew/Thai/Indic text, NSRange mixed with TextKit 2 APIs, and missing Writing Tools configuration, and architectural gaps like missing fallback notification observation, SwiftUI wrappers that drop TextKit 2 properties, missing `isWritingToolsActive` checks during programmatic mutations, and untested RTL handling in custom layout fragments.

## What It Does

- Detects 6 known anti-patterns (direct `.layoutManager` access forcing one-way TextKit 1 fallback, `NSLayoutManager` direct instantiation or delegate adoption, deprecated glyph APIs `numberOfGlyphs`/`glyphRange`/`rectForGlyph`, `NSRange` passed to TextKit 2 APIs without conversion, missing `writingToolsBehavior` on iOS 18+/macOS 15+ edit views, missing `isWritingToolsActive` guard on programmatic mutations)
- Identifies architectural gaps (missing `_UITextViewEnablingCompatibilityMode` / `willSwitchToNSLayoutManagerNotification` observers so silent fallback goes undetected, glyph APIs in measurement code that "works" for English but breaks for international users, `writingToolsResultOptions` not matched to editor content model, missing `willBegin`/`didEndWritingToolsSession` lifecycle gating, SwiftUI `UIViewRepresentable`/`NSViewRepresentable` wrappers not forwarding TextKit 2 properties, TextKit 1 fallback not gated behind `if #available`, NSAttributedString custom attributes not verified to round-trip through TextKit 2, large attributed-string assignments on main thread, autosave/undo not disabled during Writing Tools sessions, custom `NSTextLayoutFragment` subclasses untested on RTL, SwiftUI `TextEditor` wrapped by `UIViewRepresentable` losing automatic Writing Tools)
- Correlates findings that compound into higher severity (`.layoutManager` access + iOS 18+ deployment guarantees Writing Tools loss, glyph APIs + non-English locales corrupts layout, missing `isWritingToolsActive` check + autosave timer corrupts mid-generation results, `NSLayoutManager` subclass + custom rendering blocks any migration path)
- Produces a TextKit Modernity Health Score (MODERN / MIXED / LEGACY)

## How to Use

**Natural language:**
- "Can you check my text editor for TextKit issues?"
- "Why isn't Writing Tools appearing in my text view?"
- "Review my UITextView code"
- "Check for TextKit 2 compatibility"
- "I need to add a text editor, can you review the implementation?"

**Explicit command:**
```bash
/axiom:audit textkit
```

## Related

- **textkit-ref** skill (axiom-uikit) — TextKit 2 architecture, migration patterns from TextKit 1, Writing Tools integration, SwiftUI TextEditor + AttributedString
- **accessibility-auditor** agent — overlaps on accessibility regressions when TextKit 1 fallback fires (rotor, Mark Up, navigation)
- **concurrency-auditor** agent — overlaps on background `NSAttributedString` construction crossing actor boundaries
- **swift-performance-analyzer** agent — overlaps on main-thread stalls when loading large documents
- **swiftui-performance-analyzer** agent — overlaps on SwiftUI `UIViewRepresentable` wrappers re-creating text views on every render
- **storage-auditor** agent — overlaps on saved-document file location and protection
- **health-check** agent — includes textkit-auditor in project-wide scans
