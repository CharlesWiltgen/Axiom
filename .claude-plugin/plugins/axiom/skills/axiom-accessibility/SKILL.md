---
name: axiom-accessibility
description: Use when fixing or auditing ANY accessibility issue — VoiceOver, Dynamic Type, color contrast, touch targets, WCAG compliance, App Store accessibility review.
license: MIT
---

# Accessibility

**You MUST use this skill for ANY accessibility work including VoiceOver, Dynamic Type, color contrast, WCAG compliance, and UX flow auditing.**

## Quick Reference

| Symptom / Task | Reference |
|----------------|-----------|
| VoiceOver labels, hints, navigation | See `references/accessibility-diag.md` |
| Dynamic Type scaling violations | See `references/accessibility-diag.md` |
| Color contrast (WCAG AA/AAA) | See `references/accessibility-diag.md` |
| Touch target sizes (< 44x44pt) | See `references/accessibility-diag.md` |
| Keyboard navigation (iPadOS/macOS) | See `references/accessibility-diag.md` |
| Reduce Motion support | See `references/accessibility-diag.md` |
| Assistive Access (cognitive, iOS 17+) | See `references/accessibility-diag.md` |
| Accessibility Inspector workflows | See `references/accessibility-diag.md` |
| App Store Review preparation | See `references/accessibility-diag.md` |
| UX dead ends, dismiss traps | See `references/ux-flow-audit.md` |
| Buried CTAs, missing empty states | See `references/ux-flow-audit.md` |
| Missing loading/error states | See `references/ux-flow-audit.md` |
| Deep link dead ends | See `references/ux-flow-audit.md` |
| Accessibility dead ends (gesture-only) | See `references/ux-flow-audit.md` |

## Decision Tree

```dot
digraph accessibility {
    start [label="Accessibility issue" shape=ellipse];
    what [label="What type?" shape=diamond];

    start -> what;
    what -> "references/accessibility-diag.md" [label="VoiceOver/labels/hints"];
    what -> "references/accessibility-diag.md" [label="Dynamic Type"];
    what -> "references/accessibility-diag.md" [label="color contrast"];
    what -> "references/accessibility-diag.md" [label="touch targets"];
    what -> "references/accessibility-diag.md" [label="keyboard nav"];
    what -> "references/accessibility-diag.md" [label="Reduce Motion"];
    what -> "references/accessibility-diag.md" [label="Assistive Access"];
    what -> "references/accessibility-diag.md" [label="App Store prep"];
    what -> "references/ux-flow-audit.md" [label="UX dead end/dismiss trap"];
    what -> "references/ux-flow-audit.md" [label="missing states"];
    what -> "accessibility-auditor" [label="automated scan" shape=box];
}
```

1. ANY VoiceOver, Dynamic Type, contrast, touch target, or WCAG issue → `references/accessibility-diag.md`
2. Assistive Access (cognitive disabilities, iOS 17+) → `references/accessibility-diag.md`
3. App Store accessibility rejection → `references/accessibility-diag.md`
4. UX dead ends, dismiss traps, buried CTAs, missing states → `references/ux-flow-audit.md`
5. Want automated accessibility scan? → `accessibility-auditor` agent or `/axiom:audit accessibility`

## Automated Scanning

**Accessibility audit** → Launch `accessibility-auditor` agent or `/axiom:audit accessibility`
- VoiceOver labels and hints
- Dynamic Type violations
- Color contrast failures
- WCAG compliance scanning

**UX flow audit** → Launch `ux-flow-auditor` agent
- Dead-end views, dismiss traps
- Buried CTAs, missing empty/loading/error states
- Deep link dead ends, accessibility dead ends

## Critical Patterns

#### Image Accessibility

- Use `Image(decorative: "photo")` for purely decorative images — automatically hidden from VoiceOver (equivalent to `accessibilityHidden(true)` but semantically clearer)
- Use `accessibilityInputLabels()` for buttons with complex or changing labels — improves Voice Control accuracy by providing alternative labels
- Respect `accessibilityDifferentiateWithoutColor` environment value — when active, provide non-color cues (icons, patterns, labels) alongside color indicators

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll add VoiceOver labels when I'm done building" | Accessibility is foundational, not polish. accessibility-diag prevents App Store rejection. |
| "My app doesn't need accessibility" | All apps need accessibility. It's required by App Store guidelines and benefits all users. |
| "Dynamic Type just needs .scaledFont" | Dynamic Type has 7 common violations. accessibility-diag catches them all. |
| "Color contrast looks fine to me" | Visual assessment is unreliable. WCAG ratios require measurement. accessibility-diag validates. |
| "UX issues are just polish" | UX dead ends cause 1-star reviews. They're defects, not enhancements. |
| "The dismiss gesture handles it" | fullScreenCover has no dismiss gesture. That's the trap. |

## Example Invocations

User: "My button isn't being read by VoiceOver"
→ See `references/accessibility-diag.md`

User: "How do I support Dynamic Type?"
→ See `references/accessibility-diag.md`

User: "Check my app for accessibility issues"
→ See `references/accessibility-diag.md`

User: "Prepare for App Store accessibility review"
→ See `references/accessibility-diag.md`

User: "Scan my app for accessibility issues automatically"
→ Launch `accessibility-auditor` agent

User: "How do I support Assistive Access?"
→ See `references/accessibility-diag.md`

User: "Check for UX dead ends and dismiss traps"
→ See `references/ux-flow-audit.md`

User: "My fullScreenCover has no way to dismiss"
→ See `references/ux-flow-audit.md`

User: "Are there missing empty states in my app?"
→ See `references/ux-flow-audit.md`
