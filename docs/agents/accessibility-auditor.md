# accessibility-auditor

Automatically scans for VoiceOver label issues, Dynamic Type violations, color contrast failures, and WCAG compliance problems.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Check my code for accessibility issues"
- "I need to submit to the App Store soon, can you review accessibility?"
- "Review my code for accessibility compliance"
- "Check if my UI follows WCAG guidelines"

**Explicit command:**
```bash
/axiom:audit-accessibility
```

## What It Checks

1. **VoiceOver Labels** (CRITICAL) — Missing accessibilityLabel, generic labels
2. **Dynamic Type** (HIGH) — Fixed font sizes instead of .font(.body)
3. **Custom Font Scaling** (HIGH) — Custom UIFont without UIFontMetrics, .custom() without relativeTo:
4. **Layout Scaling** (MEDIUM) — Fixed padding/spacing without @ScaledMetric or scaledValue
5. **Color Contrast** (HIGH) — Low contrast text/background combinations
6. **Touch Target Sizes** (MEDIUM) — Buttons smaller than 44x44pt
7. **Reduce Motion Support** (MEDIUM) — Animations without checks
8. **Keyboard Navigation** (MEDIUM) — Missing keyboard shortcuts

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: purple
- **Scan Time**: <1 second

## Related Skills

- **accessibility-diag** — Comprehensive accessibility diagnostics with WCAG compliance
- **typography-ref** — Typography and Dynamic Type reference guide
