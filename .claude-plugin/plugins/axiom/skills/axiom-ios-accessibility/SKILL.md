---
name: axiom-ios-accessibility
description: Use when fixing or auditing ANY accessibility issue - VoiceOver, Dynamic Type, color contrast, touch targets, WCAG compliance, App Store accessibility review.
license: MIT
---

# iOS Accessibility Router

**You MUST use this skill for ANY accessibility work including VoiceOver, Dynamic Type, color contrast, and WCAG compliance.**

## When to Use

Use this router when:
- Fixing VoiceOver issues
- Implementing Dynamic Type
- Checking color contrast
- Ensuring touch target sizes
- Preparing for App Store accessibility review
- WCAG compliance auditing

## Routing Logic

### Accessibility Issues

**All accessibility work** → `/skill axiom-accessibility-diag`
- VoiceOver labels and hints
- Dynamic Type scaling
- Color contrast (WCAG)
- Touch target sizes
- Keyboard navigation
- Reduce Motion support
- Accessibility Inspector usage
- App Store Review preparation

## Decision Tree

1. ANY accessibility issue → accessibility-diag

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll add VoiceOver labels when I'm done building" | Accessibility is foundational, not polish. accessibility-diag prevents App Store rejection. |
| "My app doesn't need accessibility" | All apps need accessibility. It's required by App Store guidelines and benefits all users. |
| "Dynamic Type just needs .scaledFont" | Dynamic Type has 7 common violations. accessibility-diag catches them all. |
| "Color contrast looks fine to me" | Visual assessment is unreliable. WCAG ratios require measurement. accessibility-diag validates. |

## Critical Pattern

**accessibility-diag** covers:
- 7 critical accessibility issues
- WCAG compliance levels (A, AA, AAA)
- Accessibility Inspector workflows
- VoiceOver testing checklist
- App Store Review requirements

## Example Invocations

User: "My button isn't being read by VoiceOver"
→ Invoke: `/skill axiom-accessibility-diag`

User: "How do I support Dynamic Type?"
→ Invoke: `/skill axiom-accessibility-diag`

User: "Check my app for accessibility issues"
→ Invoke: `/skill axiom-accessibility-diag`

User: "Prepare for App Store accessibility review"
→ Invoke: `/skill axiom-accessibility-diag`
