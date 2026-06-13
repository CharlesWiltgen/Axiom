---
name: app-review-guidelines
description: Index of Apple's App Review Guidelines organized by section, with zero-tolerance flags, top rejection causes, and sensitive-app requirements
---

# App Review Guidelines

A structured index of Apple's App Review Guidelines, verified against the current published revision. Use this to find the guideline number behind a rejection, identify zero-tolerance violations before submitting, and understand which app types require extra documentation.

## When to Use

Use this skill when:
- You received a rejection message citing a specific guideline number and need context
- You want to verify your app against the sections most often cited in rejections
- You're building a sensitive-category app (Kids, medical, crypto, gambling, VPN) and need the extra documentation requirements
- You need to know which violations carry immediate-removal risk
- You're auditing a feature against Safety, Performance, Business, Design, or Legal sections before adding it

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "What does Guideline 2.1 actually require?"
- "Which App Review Guidelines have zero-tolerance enforcement?"
- "We're submitting a Kids category app — what's required by 1.3 and 5.1.4?"
- "What are the top 10 rejection causes by frequency?"
- "Is my VPN app subject to special review requirements?"
- "Our app handles loot boxes — which guideline covers odds disclosure?"
- "What's the difference between 4.2 (minimum functionality) and 4.3 (spam)?"

## What This Skill Provides

- **Section-by-section index** – Safety (1.x), Performance (2.x), Business (3.x), Design (4.x), and Legal (5.x), with topic summaries for each numbered guideline
- **Zero-tolerance flags** – The four guidelines (1.1.4, 2.5.3, 4.1(b), 5.1.1(vi)) whose violation can mean immediate removal or Developer Program termination, called out separately so they don't get lost in the long list
- **Top 10 rejection causes** – Ordered by frequency, anchored on Apple's published statistics where available; the canonical "if you only check ten things, check these"
- **Sensitive app types** – Kids apps with third-party ads, medical hardware, third-party content/trademarks, gambling/VPN/real-money gaming, and regulated industries (banking, crypto, healthcare, air travel), with the extra documentation each requires
- **Cross-references to payments** – Apple Pay, Wallet, and Tap to Pay guidance is split out to the `axiom-payments` suite; this skill points there for Section 3 questions involving physical-world payments

## Related

- [App Store Submission](./app-store-submission) – Pre-flight checklist that catches 90% of guideline violations before you submit
- [App Store Diagnostics](/diagnostic/app-store-diag) – Use when a rejection has arrived; maps guideline numbers to root causes and fixes
- [Expert Review Checklist](./expert-review-checklist) – 9-section verification list covering build, privacy, metadata, monetization, and EU compliance
- [App Store Reference](/reference/app-store-ref) – Field-level metadata specs, privacy manifest schema, and age rating tiers
