---
name: app-store-diag
description: Use when app is rejected by App Review, submission blocked, or appeal needed - systematic diagnosis from rejection message to fix with guideline-specific remediation patterns and appeal writing
---

# App Store Rejection Diagnostics

Systematic App Store rejection diagnosis and remediation. Maps rejection messages to targeted fixes for the 6 categories that account for 90% of all App Review failures.

## Overview

Most developers waste 1-2 weeks on rejection cycles because they skim the rejection message, assume the cause, and "fix" something that wasn't the problem. This diagnostic provides systematic diagnosis from rejection message to targeted fix.

## Symptoms This Diagnoses

Use when you're experiencing:
- App rejected by App Review with a specific guideline number
- "Binary Rejected" with no clear guideline cited
- Same app rejected multiple times for different reasons
- "Metadata Rejected" status in App Store Connect
- Rejection mentions "privacy", "data collection", "login", or "authentication"
- Reviewer asking for demo account or additional information
- Unsure whether to fix and resubmit or appeal

## Example Prompts

Questions you can ask Claude that will draw from this diagnostic:

- "My app was rejected for Guideline 2.1, what do I do?"
- "I got 'Metadata Rejected' — do I need a new build?"
- "App rejected for missing privacy policy, how do I fix this?"
- "Should I appeal this App Store rejection?"
- "My app was rejected 3 times for different reasons each time"
- "Binary Rejected but no guideline number — what happened?"
- "How do I write an App Review appeal?"

## Diagnostic Workflow

```
1. Read the FULL rejection message (5 min)
   |- Copy exact text and all guideline numbers
   |- Identify rejection type (App/Metadata/Binary)
   |- Check if reviewer is asking for info vs rejecting
   +- Screenshot for team reference

2. Map to diagnostic pattern (2 min)
   |- Guideline 2.1 -> Pattern 1 (App Completeness)
   |- Guideline 2.3 -> Pattern 2 (Metadata)
   |- Guideline 5.1 -> Pattern 3 (Privacy)
   |- Guideline 4.8 -> Pattern 4 (Sign in with Apple)
   |- Guideline 3.x -> Pattern 5 (Business/Monetization)
   |- No guideline  -> Pattern 6 (Binary/Technical)
   +- Disagree       -> Pattern 7 (Appeal)

3. Apply pattern fix (varies)
   |- Follow diagnosis steps for the specific pattern
   |- Fix ALL cited guidelines (not just the first)
   +- Run pre-submission checklist before resubmitting

4. Verify and resubmit (30 min)
   |- Test fix on physical device
   |- Run complete pre-flight checklist
   +- Explain fixes in resubmission notes
```

## Diagnostic Patterns

### Pattern 1: Guideline 2.1 — App Completeness
**Symptom**: Crashes, placeholder content, broken links, missing demo credentials
**Diagnosis**: Test on physical device, search project for placeholders, verify all URLs
**Fix**: Replace all test content, provide working demo credentials, test on reviewer's OS version

### Pattern 2: Guideline 2.3 — Metadata Issues
**Symptom**: "Metadata Rejected" — screenshots don't match, misleading description
**Diagnosis**: Compare every screenshot to current build, verify each description claim
**Fix**: Update in ASC directly (no new build needed for metadata-only rejections)

### Pattern 3: Guideline 5.1 — Privacy Violations
**Symptom**: Missing privacy policy, undeclared data collection, no ATT
**Diagnosis**: Check policy accessibility (ASC + in-app), generate Privacy Report, audit SDKs
**Fix**: Update privacy manifest, add purpose strings, ensure policy matches actual collection

### Pattern 4: Guideline 4.8 — Missing Sign in with Apple
**Symptom**: Third-party login without SIWA
**Diagnosis**: Check if any third-party/social login exists (Google, Facebook, etc.)
**Fix**: Implement SIWA at equal visual prominence, handle credential revocation

### Pattern 5: Guideline 3.x — Business/Monetization
**Symptom**: Digital content without IAP, unclear subscription terms, hidden loot box odds
**Diagnosis**: Identify if digital goods bypass Apple IAP
**Fix**: Implement StoreKit 2 for all digital goods, disclose loot box odds, clarify terms

### Pattern 6: Binary Rejected — Technical Gates
**Symptom**: Automated rejection, no guideline number, build stuck processing
**Diagnosis**: Check SDK version, privacy manifest presence, encryption declaration, signing
**Fix**: Update Xcode/SDK, add PrivacyInfo.xcprivacy, set ITSAppUsesNonExemptEncryption

### Pattern 7: Appeal Process
**Symptom**: Genuine belief that reviewer misunderstood the app
**Diagnosis**: Verify compliance with cited guideline, gather evidence
**Fix**: Reply in ASC with specific evidence first; formal appeal if unresolved

## Quick Reference

| Rejection Type | Likely Cause | Pattern | Typical Fix Time |
|---|---|---|---|
| Guideline 2.1 | Crashes/placeholders | 1 | 1-3 days |
| Guideline 2.3 | Metadata mismatch | 2 | 1 day (no build) |
| Guideline 5.1 | Privacy gaps | 3 | 2-5 days |
| Guideline 4.8 | Missing SIWA | 4 | 3-5 days |
| Guideline 3.x | Payment method | 5 | 3-14 days |
| Binary Rejected | Technical gate | 6 | 1-2 days |

## Production Crisis Defense

**Scenario**: App rejected for the 3rd time with a different reason each time, launch is tomorrow

**Why this happens**: Each review pass goes deeper. First pass catches crashes, second checks metadata, third audits privacy compliance. This is normal.

**Mandatory Protocol**:
1. Don't panic. Don't resubmit without a thorough fix.
2. Run the COMPLETE pre-flight checklist — not just the cited issue.
3. Audit comprehensively for the specific rejection category.
4. Verify all previous rejection issues are still fixed.
5. Request expedited review if genuinely time-critical.

**Time comparison**:
- Quick fix + resubmit: 7-14 more days (likely rejected again)
- Full audit + thorough fix: 3-5 days (high confidence)
- Full audit + expedited review: 1-3 days (if granted)

## Documentation Scope

This is a **diagnostic skill** — systematic rejection diagnosis with guideline-specific remediation patterns.

#### Diagnostic includes
- 7 diagnostic patterns covering 90% of App Store rejections
- Decision tree mapping rejection messages to patterns
- Production crisis scenario with multi-rejection protocol
- Appeal writing guidance with good/bad examples
- Pre-submission checklist to prevent future rejections
- Common mistakes (skimming rejection, fixing only cited issue, arguing emotionally)

**Vs Reference**: Diagnostic skills enforce specific workflows and handle pressure scenarios. Reference skills provide comprehensive information without mandatory steps.

## Related

- [App Store Submission](/skills/shipping/app-store-submission) — Pre-flight checklist to prevent rejections
- [App Store Reference](/reference/app-store-ref) — Metadata specs, guideline index, privacy manifest schema
- [StoreKit 2 Reference](/reference/storekit-ref) — IAP implementation for Guideline 3.x fixes
- [Privacy UX Patterns](/reference/privacy-ux) — Privacy manifest and ATT for Guideline 5.1 fixes

## Resources

**WWDC**: 2025-328

**Docs**: /app-store/review/guidelines, /distribute/app-review, /contact/app-store/?topic=appeal

**Skills**: axiom-app-store-submission, axiom-app-store-ref, axiom-storekit-ref, axiom-privacy-ux
