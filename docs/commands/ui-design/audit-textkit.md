---
name: audit-textkit
description: Scan for TextKit 1 fallback triggers, deprecated glyph APIs, and missing Writing Tools integration
---

# audit-textkit

Scan for TextKit 1 fallback triggers, deprecated glyph APIs, and missing Writing Tools integration.

## What This Command Does

Launches the **textkit-auditor** agent to detect issues that prevent Writing Tools integration and cause incorrect behavior with complex scripts (Arabic, Kannada, Thai).

## What It Checks

1. **TextKit 1 Fallback Triggers** — Direct `.layoutManager` access that causes one-way fallback to TextKit 1
2. **Deprecated Glyph APIs** — `numberOfGlyphs`, `glyphRange`, `glyphIndex` that break with complex scripts
3. **NSRange with TextKit 2** — Using NSRange instead of NSTextRange/NSTextLocation
4. **Missing Writing Tools Integration** — No `writingToolsBehavior` configuration (iOS 18+)
5. **Missing State Awareness** — Text mutations without `isWritingToolsActive` checks

## Related Agent

- [textkit-auditor](/agents/textkit-auditor) — The agent that powers this command
- [textkit-ref](/reference/textkit-ref) — Complete TextKit 2 reference and migration guide
