---
name: tap-to-pay
description: Tap to Pay on iPhone (ProximityReader) — PSP-onboarding reality, managed-entitlement workflow, PaymentCardReader lifecycle, prepare-on-foreground discipline, loyalty pass NFC reads, and the "Tap to Pay" button label HIG rule
---

# Tap to Pay on iPhone

Discipline-enforcing skill for accepting contactless card payments on iPhone via the `ProximityReader` framework. Tap to Pay replaces external card readers — no Bluetooth dongles, no terminals — but the Apple integration is roughly half the work. The other half is PSP onboarding, which Apple's documentation barely mentions and which is usually where projects stall.

## When to Use

Use this skill when:
- Adding contactless card acceptance to a point-of-sale iOS app
- Submitting the Tap to Pay managed entitlement request via `/contact/request/tap-to-pay-on-iphone/`
- Configuring the `com.apple.developer.proximity-reader.payment.acceptance` entitlement and provisioning profile
- Choosing a PSP (Stripe Terminal, Adyen, Square) for your launch regions
- Wiring `PaymentCardReader` lifecycle into your app's scene phase handling
- Implementing loyalty NFC pass reads at point-of-sale via `ProximityReader`
- Recovering from a Tap to Pay entitlement stuck in "Submitted" status for weeks
- Switching from the deprecated `prepare(using:updateHandler:)` to the async stream API

## Example Prompts

Real questions developers ask that this skill answers:

- "I want to add Tap to Pay on iPhone to my point-of-sale app — where do I start?"
- "My Tap to Pay entitlement has been Submitted for two weeks — what do I do?"
- "Why does the first tap after my app foregrounds hang indefinitely?"
- "Which PSPs support Tap to Pay in the UK?"
- "Can I use 'Tap to Pay' as a button label for refunds?"
- "How do I read a loyalty card from Wallet at checkout?"
- "Does Tap to Pay work in the iOS Simulator?"

## What This Skill Provides

- **What Tap to Pay actually is** — supported payment types (contactless card, Apple Pay, other digital wallets, NFC loyalty passes), hardware floor (iPhone XS+), region gating
- **The PSP-onboarding reality** — three Apple-supported PSPs as of writing, the per-region certification and account-flag requirements, the in-writing PSP confirmation rule before spending engineering time
- **Managed-entitlement workflow** — the nine-step flow from request form to App Review, the Quinn-the-Eskimo mental model for managed capabilities, dev vs distribution entitlement (each requested separately), per-extension-bundle requests
- **"Submitted" stuck pattern** — the 7-business-day escalation rule and the Apple Developer Support case path (not Feedback Assistant)
- **Merchant onboarding flow** — `isSupported`, `isAccountLinked`, `linkAccount(using:)`, `relinkAccount(using:)`; the PSP-issued token at runtime; never roll your own T&C sheet
- **HIG: always offer the button** — even during configuration, with determinate or indeterminate progress; never hide the button while configuration is in progress
- **PaymentCardReader lifecycle** — `prepare(using:)` on launch AND on every foregrounding (the most-violated invariant); `events` async stream observation; `returnReadResultImmediately` for 1-2 second savings
- **Non-payment uses** — card lookup without charging (refund without receipt, store-card-on-file) and loyalty NFC reads from Wallet
- **HIG button label rule** — "Tap to Pay on iPhone" or "Tap to Pay" only; never the Apple logo; generic labels (Look Up, Verify, Refund) for non-payment actions
- **`ProximityReaderDiscovery`** — Apple-maintained tutorial UI for merchant education; use instead of rolling your own

## Related

- [Tap to Pay Reference](/reference/tap-to-pay-ref) — `PaymentCardReader` API surface, event cases, session methods, Store and Forward mode, `MobileDocumentReader` cross-reference
- [Wallet Passes](/skills/integration/wallet-passes) — the pass.json `nfc` block schema for loyalty passes that Tap to Pay reads at checkout
- [Apple Pay](/skills/integration/apple-pay) — sibling for online card acceptance on the same device
- [Payments Diagnostics](/diagnostic/payments-diag) — entitlement-stuck patterns, `prepare()` not called on foreground, `isSupported` false root causes
- [Code Signing Reference](/reference/code-signing-ref) — generic managed-capability mechanics the Tap to Pay entitlement plugs into
