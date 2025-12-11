---
name: audit-accessibility
description: Scan for accessibility issues (launches accessibility-auditor agent)
---

# Accessibility Audit

Launches the **accessibility-auditor** agent to scan for VoiceOver label issues, Dynamic Type violations, color contrast failures, and WCAG compliance problems.

## What It Checks

- Missing accessibilityLabel on interactive elements
- Fixed font sizes (breaks Dynamic Type)
- Low color contrast
- Touch targets smaller than 44x44pt
- Missing Reduce Motion support
- Missing keyboard navigation

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Check my code for accessibility issues"
- "Review my code for accessibility compliance"
- "Check if my UI follows WCAG guidelines"
