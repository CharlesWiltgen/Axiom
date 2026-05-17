---
name: apple-pay-web
description: Apple Pay on the web — merchant identity certificate, domain verification, server-side merchant validation, JS SDK button vs CSS button, third-party browser support (WWDC24), AUG parity, and the 30-second production-incident triage
---

# Apple Pay on the Web

Discipline-enforcing skill for Apple Pay on websites. Web setup is materially different from native — a separate Merchant Identity Certificate, domain registration plus verification, server-side merchant validation via two-way TLS, and (since iOS 18) third-party browser support through scan-to-pay. Expect web to take 2-3x the certificate and domain time of a native integration.

## When to Use

Use this skill when:
- Adding Apple Pay to a website using Apple Pay JS (`ApplePaySession`) or the W3C Payment Request API
- Setting up a Merchant Identity Certificate, domain verification, or `.well-known/apple-developer-merchantid-domain-association.txt`
- Implementing server-side `onmerchantvalidation` against `apple-pay-gateway.apple.com` with two-way TLS
- Choosing between the JS SDK custom-element button and a legacy CSS-implemented button
- Enabling Apple Pay on Chrome, Edge, Firefox, or Brave on iOS 18+ via scan-to-pay
- Switching from `canMakePaymentsWithActiveCard()` (deprecated WWDC24) to `applePayCapabilities()`
- Diagnosing a production incident where merchant validation suddenly fails
- Complying with the AUG parity rule and primary-option rule

## Example Prompts

Real questions developers ask that this skill answers:

- "Apple Pay on my website doesn't show the button in Chrome — why?"
- "Domain verification keeps failing — what am I missing?"
- "How do I implement merchant validation server-side?"
- "What's the migration path from `canMakePaymentsWithActiveCard()` to `applePayCapabilities()`?"
- "Apple Pay is broken in production and the CEO is on the bridge — what do I check first?"
- "How do I add web disbursements (WWDC24)?"
- "Where does the merchant identity certificate go, and how is it different from the payment processing certificate?"

## What This Skill Provides

- **Why web setup is different** — the three web-only requirements that native doesn't need: Merchant Identity Certificate, domain registration plus verification, server-side merchant validation
- **Pre-flight web checklist** — HTTPS plus TLS 1.2+, domain registered and verified, Merchant Identity Certificate exported and split into PEM crt and key, curl test against `apple-pay-gateway-cert.apple.com`, Apple IP allowlist on egress
- **API choice** — Apple Pay JS (`ApplePaySession`) for Safari only, Payment Request API for cross-browser including third-party browsers on iOS 18+
- **Button rendering** — JS SDK custom element (`<apple-pay-button>`) works on third-party browsers; CSS-implemented buttons don't. SDK 1.2.0+ required for scan-to-pay
- **Capability detection** — `applePayCapabilities()` returns one of four `paymentCredentialStatus` values; the HIG/AUG rule that mandates pre-selection when `paymentCredentialsAvailable`
- **Merchant validation flow** — server-only `POST /paymentSession` with two-way TLS, opaque session JSON passed through verbatim, single-use 5-minute expiry, sandbox vs production endpoint discipline
- **Payment request construction** — decimal-precise string amounts (never JS Number), differences between Apple Pay JS and Payment Request API forms
- **Variants** — `recurringPaymentRequest`, `automaticReloadPaymentRequest`, `deferredPaymentRequest`, web disbursements (WWDC24) with `supportsInstantFundsOut`
- **Third-party browser scan-to-pay** — iOS 18 QR-handoff flow; requires SDK button at version 1.2.0+
- **30-second production triage** — the curl-test-first incident-response sequence and named anti-actions (don't re-issue cert before curl, don't bounce servers as first move)

## Related

- [Apple Pay on the Web Reference](/reference/apple-pay-web-ref) — `ApplePaySession` and Payment Request API surface, event handlers, status codes, sequence diagrams
- [Apple Pay](/skills/integration/apple-pay) — native counterpart; the merchant ID and Payment Processing Certificate are shared
- [Apple Pay vs IAP](/skills/integration/apple-pay-vs-iap) — boundary plus the web Acceptable Use Guidelines (prohibited categories, parity, primary-option)
- [Wallet Orders](/skills/integration/wallet-orders) — Track-with-Apple-Wallet button and post-purchase handoff
- [Payments Diagnostics](/diagnostic/payments-diag) — merchant-validation failure modes, cert vs domain isolation
