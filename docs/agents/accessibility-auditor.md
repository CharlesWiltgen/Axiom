# accessibility-auditor

Scans for accessibility violations — from known anti-patterns like missing VoiceOver labels and fixed fonts to architectural issues like completely inaccessible flows and gesture-only paths with no assistive technology equivalent.

## What It Does

- Detects 8 known violation categories (VoiceOver labels, Dynamic Type, custom font scaling, layout scaling, color contrast, touch targets, Reduce Motion, keyboard navigation)
- Identifies inaccessible flows (gesture-only interactions, custom-drawn content hidden from VoiceOver, inconsistent label coverage)
- Correlates findings that compound into higher severity
- Produces an Accessibility Health Score (COMPLIANT / GAPS / NON-COMPLIANT)

## How to Use

**Natural language:**
- "Check my code for accessibility issues"
- "I need to submit to the App Store soon, can you review accessibility?"
- "Review my code for accessibility compliance"
- "Check if my UI follows WCAG guidelines"

**Explicit command:**
```bash
/axiom:audit accessibility
```

## Related

- **accessibility-diag** skill — use to diagnose and fix the issues this auditor finds, including Accessibility Inspector workflows
- **typography-ref** skill — Dynamic Type and typography reference guide
- **ux-flow-auditor** agent — overlaps on flow reachability via assistive technology
