---
name: apple-pay-vs-iap
description: The Apple Pay vs In-App Purchase boundary — what App Review enforces in both directions, the physical-vs-digital and consumed-inside-vs-outside-the-app rules, donations, reader apps, marketplace label requirements, and web AUG implications
---

# Apple Pay vs In-App Purchase

Decision skill for picking the correct payment rail before writing any payment code. App Review enforces this boundary in both directions — physical goods on IAP and digital content on Apple Pay are each guaranteed rejections. The rule is short, but applying it to specific cases (donations, reader apps, marketplaces, subscriptions) takes care.

## When to Use

Use this skill when:
- Starting any new payment integration — before writing the first line of code
- Deciding the rail for a subscription, donation, marketplace, or reader-app flow
- Recovering from an App Store rejection citing Section 3.1.1, 3.1.2, 3.1.3, or 4.9
- Adding a new product type to an app that already supports payments
- Auditing an existing app to see whether each product is on the correct rail
- Designing a web checkout that must comply with the Acceptable Use Guidelines parity rule

## Example Prompts

Real questions developers ask that this skill answers:

- "Should I use Apple Pay or IAP for my hotel-booking app?"
- "How does Apple Pay differ from In-App Purchase?"
- "App Review rejected my app for using IAP for restaurant delivery — what do I switch to?"
- "Can I accept donations through IAP?"
- "We sell digital content but Apple Pay fees would be lower — can we use Apple Pay?"
- "My marketplace app shows only my business on the Pay line — is that allowed?"
- "What does the reader-app exemption actually cover?"

## What This Skill Provides

- **The Apple-canonical rule** – the exact one-sentence guideline from the Apple Pay HIG and the Merchant Integration Guide p.4, plus the codification in App Review §3.1.1 and §3.1.3(e)
- **Decision tree** – physical-vs-digital, consumed-inside-vs-outside-the-app, subscription-by-underlying-product, reader-app-exemption gating
- **Concrete category mapping** – table covering groceries, restaurants, hotels, tickets, parking, memberships, donations, marketplaces, premium features, in-game currency, streaming, news, cloud storage, and reader apps with the App Review reference for each
- **Donations narrow rule** – §3.2.1(vi) requires approved nonprofits to offer Apple Pay; §3.2.2(iv) prohibits non-approved apps from collecting donations in-app at all (there is no IAP donation fallback)
- **Subscription discipline** – digital content subscription uses IAP §3.1.2; physical recurring delivery and service subscriptions use Apple Pay with `PKRecurringPaymentRequest`; hybrid apps put each product on the matching rail
- **Marketplace and intermediary labels** – the HIG-required "Pay [End_Merchant] (via [Your_Business])" format on the Pay line and the rejection trigger for hiding the end merchant
- **Web Acceptable Use Guidelines** – prohibited categories list, the parity rule (Apple Pay at least as prominent as any other payment method), the primary-option rule (pre-selected when `paymentCredentialsAvailable`)
- **PSP-direct (raw card) rules** – when an iOS app can ship a PSP card form alongside Apple Pay versus when Apple Pay is the only allowed rail
- **Common rejection patterns** – mapping from rejection text to root cause to fix, citing the corpus tracked in `payments-diag`

## Related

- [Apple Pay](/skills/integration/apple-pay) – native discipline; what to do once you've picked Apple Pay
- [Apple Pay on the Web](/skills/integration/apple-pay-web) – web discipline; AUG parity and primary-option rules in practice
- [In-App Purchases](/skills/integration/in-app-purchases) – StoreKit 2 patterns for digital content and subscriptions
- [Payments Diagnostics](/diagnostic/payments-diag) – App Store rejection diagnosis for payment-related text
- [App Store Diagnostics](/diagnostic/app-store-diag) – appeal workflow for rejections that need formal response
