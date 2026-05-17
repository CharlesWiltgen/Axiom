---
name: expert-review-checklist
description: Comprehensive 9-section App Store submission checklist covering build, privacy, metadata, account, content, age rating, monetization, EU compliance, and App Review info
---

# Expert Review Checklist

A 9-section verification checklist for App Store submissions. Where [App Store Submission](./app-store-submission) is the discipline-focused pre-flight workflow with anti-patterns and pressure scenarios, this skill is the flat checklist — every box that must be ticked before you tap Submit for Review.

## When to Use

Use this skill when:
- You want a single flat list to walk through before submission, not a workflow
- You're doing a final pass after [App Store Submission](./app-store-submission) and want to verify nothing was missed
- You're submitting to EU markets and need DSA trader status verification steps
- You're shipping IAP and want monetization-specific verification (status, screenshots, restore, grace period)
- You're a team lead reviewing a submission someone else prepared
- You need a printable / exportable verification list to share with a non-engineer (product, legal, design)

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Run me through the full pre-submission checklist."
- "What goes in the EU compliance section before I submit?"
- "What does the build section of pre-submission verification cover?"
- "Walk me through the privacy checklist line by line."
- "What demo credentials does App Review need from us?"
- "Have we covered everything for monetization before submitting?"

## What This Skill Provides

- **Build verification** — SDK version, export compliance flag, encryption documentation, IPv6 compatibility, signing, bundle ID, build string uniqueness, OTA size, architectures, no private APIs
- **Privacy verification** — `PrivacyInfo.xcprivacy`, policy URL in App Store Connect, in-app privacy access, purpose strings, ATT, Required Reason APIs, nutrition labels, third-party SDK manifests, generated privacy report
- **Metadata verification** — App name length, description, keywords, screenshots, "What's New" text, copyright, support URL, promotional text, category, localization
- **Account verification** — Account deletion, SIWA token revocation, equal SIWA prominence, demo credentials that won't expire mid-review
- **Content verification** — No placeholders, no broken links, no staging URLs, no test data in screenshots, no references to other platforms
- **Age rating verification** — Questionnaire completion, new capability declarations, UGC moderation, content filtering, loot box odds disclosure
- **Monetization verification** — IAP status, IAP screenshots, subscription terms transparency, loot box disclosure, restore purchases, grace period, offer codes
- **EU compliance verification** — DSA trader status declaration, 2FA-verified trader email and phone, accurate contact information
- **App Review info verification** — Contact name/email/phone, demo credentials, notes explaining non-obvious features, attachments for special hardware, monitored review email

## Related

- [App Store Submission](./app-store-submission) — The workflow-driven pre-flight skill; start there, then run this checklist as the final pass
- [App Review Guidelines](./app-review-guidelines) — Index of guideline numbers behind each rejection category
- [App Store Diagnostics](/diagnostic/app-store-diag) — Use when something on this checklist is wrong and you need diagnosis-to-fix mapping
- [App Store Reference](/reference/app-store-ref) — Field-level specs (character limits, screenshot dimensions, privacy manifest schema)
