---
name: audit-textkit
description: Scan for TextKit issues (launches textkit-auditor agent)
---

# TextKit Audit

Launches the **textkit-auditor** agent to scan for TextKit 1 fallback triggers, deprecated glyph APIs, and missing Writing Tools integration.

## What It Checks

- TextKit 1 fallback triggers (.layoutManager access)
- NSLayoutManager usage (TextKit 1 only)
- Glyph APIs (data corruption with complex scripts)
- NSRange with TextKit 2 APIs
- Missing Writing Tools integration

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Check my text editor for TextKit issues"
- "Review my UITextView code"
- "Check for TextKit 2 compatibility"
