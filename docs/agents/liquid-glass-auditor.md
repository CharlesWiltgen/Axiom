# liquid-glass-auditor

Automatically scans SwiftUI codebase for Liquid Glass adoption opportunities (iOS 26+).

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my app for Liquid Glass adoption opportunities?"
- "I'm updating my app to iOS 26, what UI improvements can I make?"
- "Review my SwiftUI code for Liquid Glass patterns"
- "I have old UIBlurEffect code, should I migrate to Liquid Glass?"

**Explicit command:**
```bash
/axiom:audit-liquid-glass
```

## What It Checks

1. **Custom Views for Glass Effects** (MEDIUM) — Views that could use .glassBackgroundEffect()
2. **Toolbar Improvements** (HIGH) — Missing .borderedProminent, Spacer(.fixed)
3. **Search Patterns** (MEDIUM) — .searchable() placement opportunities
4. **Migration from Old Blur Effects** (HIGH) — UIBlurEffect, NSVisualEffectView, .material
5. **Tinting Opportunities** (LOW) — Prominent buttons missing .tint()

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: cyan

## Related Skills

- **liquid-glass** skill — Liquid Glass implementation with design review defense
- **liquid-glass-ref** skill — Comprehensive app-wide adoption guide
