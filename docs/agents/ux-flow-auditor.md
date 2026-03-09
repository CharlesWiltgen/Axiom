# UX Flow Auditor

Automatically scans iOS apps (SwiftUI and UIKit) for user journey defects — dead ends, dismiss traps, buried CTAs, and missing states that cause user frustration.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Check my app for UX dead ends"
- "Are there any dismiss traps in my sheets?"
- "Audit my app's user flows for issues"
- "Can VoiceOver users complete all flows?"
- "Check if all my views have empty states"

**Explicit command:**
```bash
/axiom:audit ux-flow
```

## What It Does

Unlike Axiom's code-level auditors that check patterns, this agent checks what users actually experience: Can they complete their task? Can they get back? Do they know what's happening?

### Issue Categories

**Core Defects** (always checked):
1. **Dead-End Views** (CRITICAL) — Views with no navigation, actions, or completion state
2. **Dismiss Traps** (CRITICAL) — Sheets/fullScreenCover without a way to close
3. **Buried CTAs** (HIGH) — Primary actions hidden below fold or in menus
4. **Promise-Scope Mismatch** (HIGH) — Button/title says X, content is Y
5. **Deep Link Dead Ends** (HIGH) — URL opens but lands on empty/broken state
6. **Missing Empty States** (HIGH) — Lists with no data show blank screen
7. **Missing Loading/Error States** (HIGH) — Async operations with no feedback
8. **Accessibility Dead Ends** (HIGH) — Actions only reachable via gestures, invisible to VoiceOver

**Contextual Checks** (when product context warrants):
9. **Onboarding Gaps** (MEDIUM) — First-launch flow incomplete or overwhelming
10. **Broken Data Paths** (MEDIUM) — @Binding not connected, @Observable not injected
11. **Platform Parity Gaps** (MEDIUM) — iPad sidebar missing, landscape broken

### Unique Features

- **Cross-Auditor Correlation** — Notes when findings overlap with other Axiom auditors (navigation, accessibility, concurrency) and elevates compound issues
- **Navigation Reachability Score** — Reports what percentage of screens are reachable via deep links, widgets, and notifications
- **Enhanced Rating Table** — CRITICAL/HIGH findings include Urgency, Blast Radius, Fix Effort, and ROI

## Related

- **ux-flow-audit** skill — The UX principles and detection categories this agent applies
- **swiftui-nav-auditor** agent — Navigation architecture issues (complementary — nav checks structure, UX flow checks user experience)
- **accessibility-auditor** agent — Full WCAG compliance scanning (complementary — accessibility checks compliance, UX flow checks flow reachability)
