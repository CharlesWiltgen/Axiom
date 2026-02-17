---
name: app-store-ref
description: App Store submission reference — complete metadata field specs, App Review guideline index, privacy manifest schema, age rating system, export compliance, EU DSA requirements, IAP review pipeline, and WWDC25 submission changes
skill_type: reference
version: 1.0.0
apple_platforms: iOS, iPadOS, tvOS, watchOS, visionOS
---

# App Store Submission Reference

Complete reference for every App Store submission requirement. Covers metadata fields, privacy manifest schema, App Review Guidelines, age ratings, export compliance, account requirements, monetization, EU compliance, build upload, and WWDC25 changes.

## When to Use This Reference

Use this reference when you need:
- Specific metadata field requirements or character limits
- App Review guideline numbers for a specific topic
- Privacy manifest schema fields or Required Reason API categories
- Age rating tiers and capability declarations
- EU DSA trader status requirements
- IAP submission pipeline and review flow
- Build upload SDK requirements and processing details
- WWDC25 submission changes (draft submissions, accessibility labels, tags)

**For pre-submission workflow:** See [App Store Submission](/skills/shipping/app-store-submission) for the pre-flight checklist and pressure scenarios.

**For rejection troubleshooting:** See [App Store Diagnostics](/diagnostic/app-store-diag) for diagnosis from rejection message to fix.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What are the character limits for App Store metadata fields?"
- "What screenshot sizes do I need for iPhone and iPad?"
- "What guideline covers Sign in with Apple requirements?"
- "What are the Required Reason API categories for privacy manifests?"
- "What are the new age rating tiers as of 2025?"
- "What's required for EU DSA trader status?"
- "How does the IAP review pipeline work?"
- "What changed for App Store submissions in WWDC25?"

## What's Covered

- **Part 1: Metadata Fields** — All required fields with character limits, screenshot pixel dimensions per device, App Preview specs, icon requirements, localization rules, category selection
- **Part 2: Privacy Requirements** — Privacy manifest XML schema, Required Reason API categories with reason codes, Privacy Nutrition Label data types and purposes, ATT implementation, common purpose strings (NS*UsageDescription)
- **Part 3: App Review Guidelines** — Quick reference for all sections 1-5 (Safety, Performance, Business, Design, Legal) with guideline numbers and topics, plus top 10 rejection reasons
- **Part 4: Age Rating System** — Five-tier ratings (4+/9+/13+/16+/18+), new capability declarations (messaging, UGC, advertising), regional mapping, questionnaire topics
- **Part 5: Export Compliance** — Encryption decision tree, exempt vs non-exempt uses, Info.plist keys
- **Part 6: Account Requirements** — Account deletion checklist, SIWA rules and exceptions, token revocation
- **Part 7: Monetization** — IAP submission pipeline, subscription rules, loot box disclosure, external payment eligibility, subscription group architecture
- **Part 8: EU Compliance** — DSA trader status, trader requirements, alternative distribution
- **Part 9: Build Upload** — Upload methods, build identifiers, SDK requirements, processing stages, TestFlight review
- **Part 10: WWDC25 Changes** — Draft submissions, reusable build numbers, accessibility nutrition labels, AI-generated tags, custom product page keywords, expanded offer codes

## Key Pattern

### App Review Guidelines Top Rejections

| Rank | Guideline | Issue | Prevention |
|------|-----------|-------|------------|
| 1 | 2.1 | Crashes, placeholders | Thorough QA |
| 2 | 4.3 | Duplicate/spam apps | Genuine unique value |
| 3 | 2.3.3 | Inaccurate screenshots | Screenshots match app |
| 4 | 5.1.1 | Privacy policy/strings | Complete all privacy |
| 5 | 4.0 | Design quality | Follow HIG |

### Privacy Manifest Required Reason APIs

| Category | APIs | Common Reasons |
|----------|------|----------------|
| File timestamp | `NSFileCreationDate`, `NSFileModificationDate` | C617.1 |
| System boot time | `systemUptime`, `mach_absolute_time` | 35F9.1 |
| Disk space | `NSFileSystemFreeSize` | E174.1 |
| User defaults | `UserDefaults` (cross-app) | CA92.1 |

## Documentation Scope

This page documents the `axiom-app-store-ref` reference skill — complete API-level coverage Claude uses when you need specific App Store submission details, field specs, and guideline numbers.

**For submission workflow:** See [App Store Submission](/skills/shipping/app-store-submission) for the pre-flight checklist and anti-patterns.

**For rejection diagnosis:** See [App Store Diagnostics](/diagnostic/app-store-diag) for mapping rejection messages to fixes.

## Related

- [App Store Submission](/skills/shipping/app-store-submission) — Pre-flight checklist and submission workflow
- [App Store Diagnostics](/diagnostic/app-store-diag) — Rejection diagnosis and remediation patterns
- [StoreKit 2 Reference](/reference/storekit-ref) — IAP and subscription API details
- [Privacy UX Patterns](/reference/privacy-ux) — Privacy manifest implementation and ATT UX
- [App Store Connect](/reference/app-store-connect-ref) — ASC navigation, crash data, metrics

## Resources

**WWDC**: 2022-10166, 2025-224, 2025-241, 2025-252, 2025-328

**Docs**: /app-store/review/guidelines, /app-store/submitting, /app-store/app-privacy-details, /help/app-store-connect

**Skills**: axiom-app-store-submission, axiom-app-store-diag, axiom-privacy-ux, axiom-storekit-ref
