---
name: ux-flow-audit
description: Discipline for auditing real user-experience flow defects — dead ends, dismiss traps, buried CTAs, missing empty/loading/error states, deep-link breakage, accessibility dead ends
---

# UX Flow Audit

A discipline skill for auditing what users actually experience: can they complete the task, can they get back, do they know what's happening? Axiom's code-level auditors check patterns; this skill checks UX outcomes.

UX flow issues are not polish. A dismiss trap or dead-end view after a payment generates 1-star reviews within hours of launch — each one costing 10-20 positive reviews to offset, while the fix is usually 10-30 minutes.

## When to Use

Use this skill when:
- You're reviewing a flow before TestFlight or App Store submission
- A user (or your own QA) reports being "stuck" on a screen
- You're auditing a SwiftUI or UIKit app for missing empty, loading, or error states
- You're checking that every modal (`.sheet`, `.fullScreenCover`, alert) has an escape hatch
- You're verifying that gesture-only actions have accessibility equivalents
- A `.onOpenURL` handler exists and you want to confirm it doesn't land users on broken state
- You want a structured cross-correlation between UX findings and findings from `swiftui-nav-auditor`, `accessibility-auditor`, or `concurrency-auditor`

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Audit my onboarding flow for dead ends and dismiss traps."
- "Does this sheet have a way out for VoiceOver users?"
- "Find missing empty states across the codebase."
- "My fullScreenCover has no close button — is that a UX defect?"
- "Walk every entry point and confirm users can complete the primary task."
- "What's the typical fix time for a buried CTA?"

## What This Skill Provides

- **Six iOS UX principles** – Honor the Promise, Escape Hatch, Primary Action Visibility, Dead End Prevention, Progressive Disclosure, Feedback Loop. Each one anchors a detection category.
- **8 core defects (always check)** – Dead-End Views, Dismiss Traps, Buried CTAs, Promise-Scope Mismatch, Deep Link Dead Ends, Missing Empty States, Missing Loading/Error States, Accessibility Dead Ends. These are UX bugs, not opinions.
- **3 contextual checks** – Onboarding Gaps, Broken Data Paths, Platform Parity Gaps. Flag when they look wrong, but acknowledge product judgment may differ.
- **Audit process** – Six-step procedure: map entry points, map navigation containers, trace flows, check data wiring, check platform adaptivity, check accessibility flows.
- **Cross-auditor correlation table** – When a UX finding overlaps with another Axiom auditor (nav, accessibility, concurrency, SwiftData), severity bumps to CRITICAL.
- **Output format** – Enhanced rating table (urgency, blast radius, fix effort, ROI) and Navigation Reachability Score quantifying what percent of screens are externally reachable.
- **Fix effort reality check** – A table showing typical fix times (10-30 minutes for most defects), used to push back on "that's a big change" rationalizations.
- **Anti-rationalization table** – Counters the seven most common excuses for shipping UX defects, including "users will figure it out" and "the dismiss gesture handles it" (it doesn't on fullScreenCover).

## Related

- [SwiftUI Navigation](./swiftui-nav) – Architectural reference for `NavigationStack`, `NavigationSplitView`, and deep-link routing
- [SwiftUI Debugging](./swiftui-debugging) – State, binding, and view-update issues that often surface as UX problems
- [HIG](./hig) – Apple Human Interface Guidelines that anchor "Honor the Promise" and primary action visibility
- [Accessibility Diagnostics](/diagnostic/accessibility-diag) – Full WCAG and VoiceOver coverage; complements the Accessibility Dead Ends defect category
- [UX Flow Auditor agent](/agents/ux-flow-auditor) – Autonomous scanning across the codebase that produces a structured report against the same eight core defects
