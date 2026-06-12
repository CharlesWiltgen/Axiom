---
name: apple-pay-ref
description: PassKit API surface for native Apple Pay — PKPaymentAuthorizationController, PKPaymentRequest variants, PKPaymentToken format (EC_v1 and RSA_v1), delegate protocols, SwiftUI buttons, watchOS and visionOS specifics, payment-token verification and decryption
---

# Apple Pay Reference

API reference for native Apple Pay across iOS, iPadOS, macOS, Catalyst, visionOS, and watchOS. Covers `PKPaymentAuthorizationController`, the full `PKPaymentRequest` shape and its variants, the encrypted token format, and the SwiftUI button surface.

## When to Use This Reference

Use this reference when:
- Looking up `PKPaymentAuthorizationController` or `PKPaymentAuthorizationViewController` initializers and delegate signatures
- Choosing the correct `PKPaymentRequest` variant property (`recurringPaymentRequest`, `automaticReloadPaymentRequest`, `deferredPaymentRequest`, `multiTokenContexts`, `applePayLaterAvailability`)
- Looking up `PKPaymentNetwork` cases for region support
- Looking up `PKContactField` cases and the deprecated `PKAddressField` it replaces
- Decrypting a `PKPaymentToken.paymentData` server-side (EC_v1 with AES-256-GCM, or RSA_v1 with AES-128-GCM)
- Picking a `PKPaymentButtonType` for the SwiftUI `PayWithApplePayButton`
- Mapping the watchOS `WKInterfacePaymentButton` flow to the iOS API surface
- Verifying the PKCS #7 detached signature on a payment token

## Example Prompts

Questions developers ask that this reference answers:

- "What's the structure of `PKPaymentRequest`?"
- "Which delegate method fires when the user changes shipping address?"
- "What's the format of `PKPaymentToken.paymentData`?"
- "How do I verify the X.509 chain on the payment token signature?"
- "Which `PKPaymentNetwork` covers Saudi Arabia?"
- "What's the canonical sequence diagram for an in-app Apple Pay flow?"
- "Which deprecated properties should I avoid?"

## What's Covered

- **Core classes** — `PKPaymentAuthorizationController` (preferred), `PKPaymentAuthorizationViewController`, `PKPaymentRequest`, `PKPayment`, `PKPaymentToken`, `PKContact`, `PKPaymentMethod`
- **Delegate protocols** — `PKPaymentAuthorizationControllerDelegate` and the View Controller variant; the change-callback update types (`PKPaymentRequestShippingContactUpdate`, etc.) and 30-second response window
- **Payment-request variants** — `PKRecurringPaymentRequest`, `PKAutomaticReloadPaymentRequest`, `PKDeferredPaymentRequest`, `multiTokenContexts: [PKPaymentTokenContext]`, `applePayLaterAvailability`; the mutual-exclusion rule
- **Merchant info** — `merchantIdentifier`, `merchantCapabilities`, `merchantCategoryCode` (WWDC24, ISO 18245), `applicationData`
- **Networks and capabilities** — `PKPaymentNetwork` cases per region, `PKPaymentRequest.availableNetworks()`, `supportedCountries`, `unsupportedPrimaryAccountIdentifiers` (27 releases), the Bancomat naming flip-flop
- **Summary items** — `PKPaymentSummaryItem` plus the recurring, deferred, automatic-reload, disbursement, and instant-funds-out variants
- **Contact fields** — `PKContactField` cases; pre-population via `billingContact` and `shippingContact`; pre-auth redaction
- **Shipping** — `PKShippingMethod`, `PKShippingType`, `PKShippingContactEditingMode`, `PKDateComponentsRange` (WWDC21) for delivery windows
- **Coupon codes** (WWDC21) — `supportsCouponCode`, `couponCode`, `paymentCouponCodeInvalidError`, `paymentCouponCodeExpiredError`
- **Errors** — `PKPaymentError` construction helpers on `PKPaymentRequest` for field-specific feedback
- **SwiftUI buttons** (WWDC22, iOS 16+) — `PayWithApplePayButton`, `AddPassToWalletButton`, `AddOrderToWalletButton`, `VerifyIdentityWithWalletButton`; `PKPaymentButtonType` cases
- **Payment token format** — JSON shape of `paymentData`, EC_v1 (AES-256-GCM) vs RSA_v1 (AES-128-GCM), 16-null-byte IV with no AAD, six-step verification and decryption sequence
- **Decrypted payment-data shape** — `applicationPrimaryAccountNumber` (DPAN), `applicationExpirationDate`, `currencyCode`, `transactionAmount`, `paymentDataType`, multi-token `authenticationResponses`
- **In-app sequence diagram** — the 17-step flow from button tap to result animation
- **Apple Pay Later API** (WWDC23, US-only) — `PKPayLaterUtilities`, `PKPayLaterView`/`PayLaterView`, `applePayLaterAvailability`
- **watchOS** — `WKInterfacePaymentButton`, no shipping picker, short summary items
- **visionOS** — identical API surface, Optic ID modality
- **Capability detection** — `canMakePayments()`, `canMakePayments(usingNetworks:)`, `canMakePayments(usingNetworks:capabilities:)`
- **Deprecations to avoid** — `requiredShippingAddressFields`, `PKAddressField`, country-specific merchant validation URLs, `canMakePaymentsWithActiveCard()` (web)

## Documentation Scope

This page documents the `apple-pay-ref` skill — the PassKit API surface for native Apple Pay.

- For **when and why** (discipline, certs, Pre-Flight checklist, Catalyst web-security model, button-vs-mark HIG rule), see [Apple Pay](/skills/integration/apple-pay)
- For **the web counterpart** of the same merchant ID and Payment Processing Certificate, see [Apple Pay on the Web Reference](/reference/apple-pay-web-ref)
- For **the boundary decision** before writing any payment code, see [Apple Pay vs IAP](/skills/integration/apple-pay-vs-iap)
- For **failure modes** (no sheet, PSP rejection, cert mismatch), see [Payments Diagnostics](/diagnostic/payments-diag)
