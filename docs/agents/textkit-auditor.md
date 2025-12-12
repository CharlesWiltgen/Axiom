# textkit-auditor

Automatically scans for TextKit 1 fallback triggers, deprecated glyph APIs, and missing Writing Tools integration — prevents loss of Writing Tools support and ensures modern text handling for complex scripts.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Check my text editor for TextKit issues"
- "Why isn't Writing Tools appearing in my text view?"
- "Review my UITextView code"
- "Check for TextKit 2 compatibility"

**Explicit command:**
```bash
/axiom:audit-textkit
```

## What It Checks

1. **TextKit 1 Fallback Triggers** (CRITICAL) — Direct `.layoutManager` access, NSLayoutManager usage
2. **Deprecated Glyph APIs** (CRITICAL) — `numberOfGlyphs`, `glyphRange`, `glyphIndex` (breaks with Arabic, Kannada)
3. **NSRange with TextKit 2** (HIGH) — Using NSRange instead of NSTextRange/NSTextLocation
4. **Missing Writing Tools** (MEDIUM) — No `writingToolsBehavior` property (iOS 18+)
5. **Missing State Checks** (MEDIUM) — Text mutations without `isWritingToolsActive` check

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: cyan
- **Scan Time**: <1 second

## Related Skills

- **textkit-ref** skill — Complete TextKit 2 architecture, migration patterns, and Writing Tools integration guide
