---
name: apple-pay-web-ref
description: API surface for Apple Pay on the web — ApplePaySession (Apple Pay JS) and PaymentRequest (W3C) forms, event handlers, ApplePayPaymentRequest schema, ApplePayPaymentToken format, ApplePayError codes, status codes, web sequence diagrams
---

# Apple Pay on the Web Reference

API reference for both Apple Pay JS (`ApplePaySession`) and the W3C Payment Request API form of Apple Pay on the web. Both produce the same encrypted token; differences are in event-handler shape and request structure.

## When to Use This Reference

Use this reference when:
- Looking up `ApplePaySession` lifecycle methods (`begin`, `abort`, `completeMerchantValidation`, `completePayment`, etc.)
- Mapping Apple Pay JS event handlers to their Payment Request API equivalents
- Looking up `ApplePayPaymentRequest` properties and merchant capability strings
- Looking up `ApplePayError` codes and contact-field names
- Decoding `ApplePayPaymentToken.paymentData` (the shape is identical to native `PKPaymentToken.paymentData`)
- Choosing the correct `ApplePaySession.complete*` status code or migrating to the typed `errors: [ApplePayError]` shape
- Pinning a JS API version with `ApplePaySession.supportsVersion()`
- Wiring the merchandising widget (`<apple-pay-later-merchandising>`) or the Track-with-Apple-Wallet button

## Example Prompts

Questions developers ask that this reference answers:

- "What's the constructor signature for `ApplePaySession`?"
- "Which `ApplePayError` code do I use for an unservicable shipping address?"
- "What does `applePayCapabilities()` return, and how is it different from `canMakePaymentsWithActiveCard()`?"
- "How do I render the Apple Pay Later merchandising widget on a product page?"
- "What's the in-Safari sequence diagram for Apple Pay on the web?"
- "Which `ApplePaySession.STATUS_*` constants should I avoid in favor of `errors`?"

## What's Covered

- **API choice** — `ApplePaySession` (Safari only) vs `PaymentRequest` with method identifier `https://apple.com/apple-pay` (cross-browser including third-party browsers on iOS 18+ via SDK 1.2.0+)
- **`ApplePaySession` constructor** — `new ApplePaySession(version, paymentRequest)`; the version-pinning rule
- **Session lifecycle methods** — `begin`, `abort`, `completeMerchantValidation`, `completePayment`, `completePaymentMethodSelection`, `completeShippingContactSelection`, `completeShippingMethodSelection`, `completeCouponCodeChange`
- **Apple Pay JS event handlers** — `onvalidatemerchant`, `onpaymentauthorized`, `onpaymentmethodselected`, `onshippingcontactselected`, `onshippingmethodselected`, `oncouponcodechanged`, `oncancel`
- **Static methods** — `canMakePayments`, `canMakePaymentsWithActiveCard` (deprecated WWDC24), `openPaymentSetup`, `supportsVersion`
- **Top-level `applePayCapabilities()`** (WWDC24) — the four `paymentCredentialStatus` values and how they drive show-primary, show-secondary, hide decisions
- **`ApplePayPaymentRequest`** — every property: country/currency codes, capabilities, networks, total/line items, contact fields, billing/shipping contact pre-population, shipping methods/type, `applicationData`, coupon, all variant modifiers
- **`ApplePayLineItem`** — string amounts only (never JS Number), `type: "final"` or `"pending"`
- **Payment Request API form** — `methodData`, `details`, `options`, method `show()`/`abort()`/`canMakePayment()`, event mapping to Apple Pay JS analogs
- **Modifiers** (Payment Request API) — `recurringPaymentRequest`, `automaticReloadPaymentRequest`, `deferredPaymentRequest`, `multiTokenContexts`, `additionalLineItems` with `type: "disbursement"` for web disbursements (WWDC24)
- **`ApplePayPayment` and `ApplePayPaymentToken`** — authorization result shape; `paymentData` identical to native `PKPaymentToken.paymentData`
- **`ApplePayPaymentContact`** — full shape; pre-auth redacted vs post-auth full subset
- **`ApplePayError`** — code list (`shippingContactInvalid`, `billingContactInvalid`, `addressUnserviceable`, `couponCodeInvalid`, `couponCodeExpired`, `unknown`), contact-field name list, and the preference for typed errors over numeric `STATUS_*` codes
- **Status codes** — the `STATUS_*` constants table
- **Apple Pay Later merchandising widget** (WWDC23) — `<apple-pay-later-merchandising>` custom element
- **Track with Apple Wallet button** (WWDC23) — `<apple-pay-wallet-button>` for order tracking handoff
- **Web sequence diagrams** — in-Safari direct flow (18 steps) and PSP-hosted page flow (5 steps)
- **Maintaining your environment** — three things that expire (Payment Processing Cert at 25 months, Merchant Identity Cert, domain verification); the merchant ID itself never expires
- **Capability detection decision tree** — dot diagram from `applePayCapabilities()` result to UI state

## Documentation Scope

This page documents the `apple-pay-web-ref` skill — the JavaScript API surface for Apple Pay on the web (Apple Pay JS plus the W3C Payment Request API form).

- For **when and why** (cert export, domain verification, server-side merchant validation, AUG parity, 30-second production triage), see [Apple Pay on the Web](/skills/integration/apple-pay-web)
- For **the native counterpart** of the same merchant ID and Payment Processing Certificate, see [Apple Pay Reference](/reference/apple-pay-ref)
- For **post-purchase order tracking** triggered by `<apple-pay-wallet-button>`, see [Wallet Orders](/skills/integration/wallet-orders)
- For **failure modes** (merchant validation, cert vs domain isolation), see [Payments Diagnostics](/diagnostic/payments-diag)
