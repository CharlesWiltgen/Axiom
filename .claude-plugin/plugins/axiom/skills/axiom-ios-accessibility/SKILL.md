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
- Assistive Access support (cognitive disabilities, iOS 17+)

## Routing Logic

### Accessibility Issues

**All accessibility work** → `/skill axiom-accessibility-diag`
- VoiceOver labels and hints
- Dynamic Type scaling
- Color contrast (WCAG)
- Touch target sizes
- Keyboard navigation
- Reduce Motion support
- Assistive Access (cognitive disabilities, iOS 17+)
- Accessibility Inspector usage
- App Store Review preparation

### Automated Scanning

**Accessibility audit** → Launch `accessibility-auditor` agent or `/axiom:audit accessibility` (VoiceOver issues, Dynamic Type violations, color contrast failures, WCAG compliance scanning)

## Decision Tree

1. ANY accessibility issue → accessibility-diag
2. Want automated accessibility scan? → accessibility-auditor (Agent)

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll add VoiceOver labels when I'm done building" | Accessibility is foundational, not polish. accessibility-diag prevents App Store rejection. |
| "My app doesn't need accessibility" | All apps need accessibility. It's required by App Store guidelines and benefits all users. |
| "Dynamic Type just needs .scaledFont" | Dynamic Type has 7 common violations. accessibility-diag catches them all. |
| "Color contrast looks fine to me" | Visual assessment is unreliable. WCAG ratios require measurement. accessibility-diag validates. |

## Critical Pattern

**accessibility-diag** covers:
- 8 critical accessibility issues (including Assistive Access)
- WCAG compliance levels (A, AA, AAA)
- Assistive Access mode (cognitive disabilities, iOS 17+)
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

User: "Scan my app for accessibility issues automatically"
→ Invoke: `accessibility-auditor` agent

User: "How do I support Assistive Access?"
→ Invoke: `/skill axiom-accessibility-diag`

User: "My app doesn't show up in Assistive Access"
→ Invoke: `/skill axiom-accessibility-diag`
