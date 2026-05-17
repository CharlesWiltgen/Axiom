---
name: apple-pay
description: Native Apple Pay across iOS, iPadOS, macOS, Catalyst, visionOS, and watchOS — PSP relationship, certificates, payment-request construction, delegate flow, Catalyst web-security model, button-vs-mark HIG rule
---

# Apple Pay (Native Apps)

Discipline-enforcing skill for native Apple Pay integration. Covers the five-actor PSP mental model, the merchant ID and Payment Processing Certificate setup, payment-request construction (one-time, recurring, automatic-reload, deferred, multi-merchant, disbursement), delegate callbacks, Catalyst's web-security model, and the most common HIG violation in shipped apps — the Apple Pay Mark used as a button.

## When to Use

Use this skill when:
- Adding Apple Pay to an iOS, iPadOS, macOS, Catalyst, visionOS, or watchOS app
- Setting up a Merchant ID, Payment Processing Certificate, or Apple Pay capability in Xcode
- Choosing between one-time, recurring, automatic-reload, deferred, multi-merchant, or disbursement request types
- Building `PKPaymentAuthorizationController` delegate callbacks (shipping, coupon, payment method changes)
- Handing off post-purchase tracking to Wallet's Orders surface via `PKPaymentOrderDetails`
- Renewing a Payment Processing Certificate (the create-but-don't-activate workflow)
- Deciding when to use the Apple Pay Mark versus the Apple Pay Button
- Testing with App Store Connect sandbox tester accounts

## Example Prompts

Real questions developers ask that this skill answers:

- "How do I set up Apple Pay in my iOS app?"
- "What's the difference between the Apple Pay button and the Apple Pay mark?"
- "How do I implement a recurring subscription with `PKRecurringPaymentRequest`?"
- "My sandbox transactions decline — is that a bug?"
- "Why does Catalyst need merchant validation even though native iOS doesn't?"
- "How do I hand off order tracking to Wallet after payment?"
- "What's the cert renewal workflow without breaking production?"

## What This Skill Provides

- **Five-actor mental model** — customer, merchant app, merchant server, PSP, acquirer, network, issuer; clarifies who decrypts what and why the private key never belongs on the device
- **Pre-flight checklist** — PSP confirmation, Apple Developer Program membership (Enterprise accounts cannot use Apple Pay), Merchant ID, Payment Processing Certificate (ECC 256, expires every 25 months), Xcode capability flow
- **Cert renewal staging** — the two-stage "create but don't activate" workflow that prevents the cutover window where Apple's servers encrypt with one key but your PSP holds another
- **Request-type decision** — when to use `PKRecurringPaymentRequest`, `PKAutomaticReloadPaymentRequest`, `PKDeferredPaymentRequest`, `multiTokenContexts`, `PKDisbursementRequest`; the merchant token (MPAN) continuity argument for using the dedicated types
- **Delegate-callback discipline** — 30-second response budget per change handler, pre-auth redacted vs post-auth full contact data, error construction via `PKPaymentError` for field-specific feedback
- **Apple Pay Mark vs Button** — the most common HIG violation in shipped apps; the Mark is signage and never tappable, the Button is API-provided and initiates payment
- **Sandbox vs production discipline** — sandbox transactions decline pre-fulfillment by design; production needs production keys plus activated certs; test with real cards before launch
- **Catalyst and macOS** — web security model applies, window requirement, merchant validation required even in-app, static merchant validation URL (legacy region-specific URLs were removed)
- **visionOS and watchOS** — Optic ID modality on visionOS, `WKInterfacePaymentButton` plus no-shipping-picker constraint on watchOS

## Related

- [Apple Pay Reference](/reference/apple-pay-ref) — PassKit API surface, payment-request variants, payment token format
- [Apple Pay vs IAP](/skills/integration/apple-pay-vs-iap) — boundary decision; what to use for physical goods, services, donations, vs digital content
- [Apple Pay on the Web](/skills/integration/apple-pay-web) — web counterpart; merchant identity certificate, domain verification, server-side merchant validation
- [Wallet Orders](/skills/integration/wallet-orders) — post-purchase order tracking handoff via `PKPaymentOrderDetails`
- [Payments Diagnostics](/diagnostic/payments-diag) — failure modes for no-sheet-appears, PSP decryption rejection, cert mismatch
- [In-App Purchases](/skills/integration/in-app-purchases) — sibling rail for digital content and subscriptions consumed inside the app
