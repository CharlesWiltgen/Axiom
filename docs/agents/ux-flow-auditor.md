# UX Flow Auditor

Scans iOS apps (SwiftUI and UIKit) for user journey defects — from known anti-patterns like dead ends and dismiss traps to missing flows like incomplete error recovery and unvalidated entry points.

## What It Does

- Detects 11 known UX defects (dead-end views, dismiss traps, buried CTAs, missing empty/loading/error states, accessibility dead ends, and more)
- Identifies incomplete journeys (critical flows without end-to-end completion, modals without error recovery, entry points that don't validate data)
- Correlates findings that compound into higher severity
- Produces a UX Journey Health Score (SMOOTH / ROUGH EDGES / BROKEN JOURNEYS)

## How to Use

**Natural language:**
- "Check my app for UX dead ends"
- "Are there any dismiss traps in my sheets?"
- "Audit my app's user flows for issues"
- "Can VoiceOver users complete all flows?"

**Explicit command:**
```bash
/axiom:audit ux-flow
```

## Related

- **ux-flow-audit** skill — the UX principles and detection categories this agent applies
- **swiftui-nav-auditor** agent — navigation architecture issues (complementary — nav checks structure, UX flow checks user experience)
- **accessibility-auditor** agent — full WCAG compliance scanning (complementary — accessibility checks compliance, UX flow checks flow reachability)
