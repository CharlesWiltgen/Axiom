---
name: app-store-submission
description: Use when preparing ANY app for App Store submission - enforces pre-flight checklist, rejection prevention, privacy compliance, and metadata completeness to prevent common App Store rejections
---

# App Store Submission

Systematic pre-flight checklist that catches 90% of App Store rejection causes before submission. A 30-minute pre-flight saves 3-7 days of rejection-fix-resubmit cycles.

## When to Use

Use this skill when you're:
- Preparing to submit an app or update to the App Store
- Submitting your first app as a new developer
- Responding to an App Review rejection
- Running a pre-submission audit before TestFlight or production
- Updating an existing app after a long gap (new requirements may apply)
- Wondering "is my app ready to submit?"

**Core principle:** Ship once, ship right. Over 40% of rejections cite Guideline 2.1 (App Completeness), and another 30% are metadata and privacy issues. These are preventable.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Is my app ready to submit to the App Store?"
- "What do I need before submitting my first iOS app?"
- "I keep getting rejected, what am I missing?"
- "What's the pre-submission checklist for App Store?"
- "Do I need a privacy manifest?"
- "My app update was rejected for metadata issues"

## What This Skill Provides

### Pre-Flight Checklist (8 Categories)
Complete mandatory checklist covering build configuration, privacy requirements, metadata fields, account/authentication, App Review info, content completeness, regional compliance, and new 2025-2026 requirements.

### Anti-Patterns with Time Costs
8 common submission mistakes — submitting without device testing, missing privacy policy, placeholder content, ignoring privacy manifest, missing Sign in with Apple, no account deletion, wrong age rating, missing demo credentials — each with the days lost and prevention steps.

### Decision Tree
Step-by-step "Is my app ready?" walkthrough covering crashes, privacy manifest, privacy policy, screenshots, account deletion, SIWA, IAP, encryption, EU compliance, demo credentials, age rating, and placeholder content.

### Pressure Scenarios
Three scenarios that prevent rationalization under deadline pressure, repeated rejections, and false confidence from prior approval.

### Screenshot and Metadata Requirements
Device size specifications, screenshot rules, App Preview video specs, and common metadata rejection triggers.

### Handling Rejections
Reading rejection messages, response strategy, when to appeal, appeal process, and metadata vs binary rejection differences.

## Key Pattern

### The 30-Minute Pre-Flight

```
Before EVERY submission, run the complete checklist:

1. Build Configuration  — Physical device, latest SDK, IPv6, release config
2. Privacy              — Manifest, policy (ASC + in-app), purpose strings, ATT
3. Metadata             — Name, screenshots, keywords, "What's New"
4. Account              — Deletion flow, SIWA, Restore Purchases
5. App Review Info      — Contact info, demo credentials, notes
6. Content              — No placeholders, all links work, production assets
7. Regional             — EU DSA trader status, age rating, export compliance
8. New Requirements     — Updated age rating, accessibility labels, SDK minimum
```

**Before**: 11 days lost to three preventable rejections.
**After**: 30-minute pre-flight catches all issues, approved on first submission.

## Documentation Scope

This page documents the `axiom-app-store-submission` skill — a discipline skill that Claude uses when helping you prepare for App Store submission. The skill contains the complete checklist, all 8 anti-patterns with code examples, pressure scenarios, and first-time developer guidance.

**For specific field specs:** See [App Store Reference](/reference/app-store-ref) for metadata character limits, screenshot dimensions, privacy manifest schema, and guideline numbers.

**For rejection troubleshooting:** See [App Store Diagnostics](/diagnostic/app-store-diag) for systematic diagnosis from rejection message to fix.

## Related

- [App Store Reference](/reference/app-store-ref) — Complete metadata field specs, guideline index, privacy manifest schema
- [App Store Diagnostics](/diagnostic/app-store-diag) — Rejection diagnosis and remediation patterns
- [StoreKit 2 Reference](/reference/storekit-ref) — IAP and subscription implementation
- [Privacy UX Patterns](/reference/privacy-ux) — Privacy manifest, ATT, and permission request patterns
- [App Store Connect](/reference/app-store-connect-ref) — ASC navigation, crash data, and analytics

## Resources

**WWDC**: 2022-10166, 2025-328, 2025-224, 2025-241

**Docs**: /app-store/review/guidelines, /app-store/submitting, /app-store/app-privacy-details

**Skills**: axiom-app-store-ref, axiom-app-store-diag, axiom-storekit-ref, axiom-privacy-ux
