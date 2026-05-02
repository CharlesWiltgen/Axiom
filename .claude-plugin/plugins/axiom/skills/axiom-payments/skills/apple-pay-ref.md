# Apple Pay — PassKit API Reference

API surface for native Apple Pay across iOS, iPadOS, macOS, Catalyst, visionOS, and watchOS. For the discipline (when/how/why), see `apple-pay.md`. For web, see `apple-pay-web-ref.md`.

## Core Classes

| Class | Role | Available on |
|-------|------|--------------|
| `PKPaymentAuthorizationController` | Headless controller; preferred entry point. Used with a delegate. | iOS 8+, iPadOS 8+, macOS 11+, Catalyst 13.1+, visionOS 1+, watchOS 3+ |
| `PKPaymentAuthorizationViewController` | UIKit/AppKit view controller form. | iOS 8+, iPadOS 8+, macOS 11+, Catalyst 13.1+, visionOS 1+ |
| `PKPaymentRequest` | The request object describing the purchase. | All Apple Pay platforms |
| `PKPayment` | Payload returned in `didAuthorizePayment`. Contains `token`, `billingContact`, `shippingContact`, `shippingMethod`. | All |
| `PKPaymentToken` | The encrypted blob wrapper; contains `paymentMethod`, `transactionIdentifier`, `paymentData`. | All |
| `PKContact` | Address + name + phone + email container. | All |
| `PKPaymentMethod` | Display info: `displayName`, `network`, `type` (credit/debit/prepaid/store). | All |

## Delegate Protocols

| Protocol | Methods (selected) |
|----------|-------------------|
| `PKPaymentAuthorizationControllerDelegate` | `paymentAuthorizationController(_:didAuthorizePayment:handler:)`, `paymentAuthorizationController(_:didChangeShippingContact:handler:)`, `paymentAuthorizationController(_:didChangeShippingMethod:handler:)`, `paymentAuthorizationController(_:didChangePaymentMethod:handler:)`, `paymentAuthorizationController(_:didChangeCouponCode:handler:)`, `paymentAuthorizationController(_:didRequestMerchantSessionUpdate:)` (Mac/Catalyst), `paymentAuthorizationControllerDidFinish(_:)` |
| `PKPaymentAuthorizationViewControllerDelegate` | Same callbacks, scoped to view-controller form |

All change callbacks deliver an *update* type (`PKPaymentRequestShippingContactUpdate`, `PKPaymentRequestShippingMethodUpdate`, `PKPaymentRequestPaymentMethodUpdate`, `PKPaymentRequestCouponCodeUpdate`) carrying refreshed summary items + errors. 30-second response window per callback.

## Payment-Request Variants

Set **at most one** on a `PKPaymentRequest`:

| Property | Type | Use case |
|----------|------|----------|
| `recurringPaymentRequest` | `PKRecurringPaymentRequest` | Subscriptions at fixed intervals (regular or trial billing cycle) |
| `automaticReloadPaymentRequest` | `PKAutomaticReloadPaymentRequest` | Auto top-up at threshold (transit, store-card balance) |
| `deferredPaymentRequest` | `PKDeferredPaymentRequest` | Hotel / pre-order / car rental (free-cancellation period + bill-on date) |
| `multiTokenContexts` | `[PKPaymentTokenContext]` | Multi-merchant in one sheet (e.g. travel-booking) |
| `applePayLaterAvailability` | `PKPaymentRequest.ApplePayLaterAvailability` | `.available` / `.unavailable` (US-only, requires entitlement) |

`PKDisbursementRequest` is a *separate* request type (not a property of `PKPaymentRequest`) for funds-out flows; pair with `PKInstantFundsOutFeeSummaryItem` for fee disclosure.

## Merchant Information

| Property | Type | Purpose |
|----------|------|---------|
| `merchantIdentifier` | `String` | `merchant.com.example.foo` reverse-DNS form |
| `merchantCapabilities` | `PKMerchantCapability` | `.threeDSecure`, `.credit`, `.debit`, `.emv` (option-set) |
| `merchantCategoryCode` | `PKPaymentRequest.MerchantCategoryCode` | ISO 18245 four-digit MCC (WWDC24); set when supported card types vary by category |
| `attributionIdentifier` | `String?` | Attribution data for partner integrations |
| `isDelegatedRequest` | `Bool` | True when a delegated entity is making the request on behalf of the merchant |
| `applicationData` | `Data?` | Hash committed into the payment token's `header.applicationData`; opaque to Apple |

## Networks and Capabilities

```swift
request.supportedNetworks: [PKPaymentNetwork]
request.merchantCapabilities: PKMerchantCapability    // .threeDSecure, .credit, .debit, .emv
request.supportedCountries: Set<String>?              // ISO 3166 2-letter
request.countryCode: String                           // your merchant's country
request.currencyCode: String                          // ISO 4217 3-letter
```

| `PKPaymentNetwork` | Coverage |
|--------------------|----------|
| `.visa`, `.masterCard`, `.amex`, `.discover` | Global |
| `.chinaUnionPay` | Mainland China |
| `.interac` | Canada |
| `.eftpos` | Australia |
| `.electron`, `.maestro`, `.vPay` | Europe (Visa / Mastercard variants) |
| `.JCB` | Japan |
| `.mada` | Saudi Arabia |
| `.idCredit`, `.quicPay` | Japan domestic |

Use `PKPaymentRequest.availableNetworks()` to query device-supported networks at runtime instead of hard-coding.

## Summary Items

Order in `paymentSummaryItems` matters: the **last** item is the line displayed next to "Pay" on the sheet, with its label being the customer-facing business name.

| Type | Purpose |
|------|---------|
| `PKPaymentSummaryItem` | Generic line item (label, amount, type) |
| `PKRecurringPaymentSummaryItem` | Carries `intervalUnit`, `intervalCount`, `startDate`, `endDate` |
| `PKDeferredPaymentSummaryItem` | Carries `deferredDate` (when payment will occur) |
| `PKAutomaticReloadPaymentSummaryItem` | Carries `thresholdAmount` |
| `PKDisbursementSummaryItem` | For funds-out flows |
| `PKInstantFundsOutFeeSummaryItem` | Fee line for instant disbursement |

Summary item `type` is `.final` (default) or `.pending` for unknown amounts (rideshare, post-pay). Pending items show "Pending" instead of the amount.

## Contact Fields

```swift
request.requiredBillingContactFields: Set<PKContactField>
request.requiredShippingContactFields: Set<PKContactField>
```

`PKContactField` cases: `.postalAddress`, `.name`, `.phoneNumber`, `.emailAddress`, `.phoneticName`.

**Privacy discipline:** request only what fulfilment needs. Apple penalizes over-collection in HIG review.

**Deprecated** (iOS 11+, do not use): `requiredBillingAddressFields`, `requiredShippingAddressFields`, `PKAddressField` enum.

### Pre-populating known contacts

```swift
request.billingContact = existingBillingContact   // PKContact
request.shippingContact = existingShippingContact // PKContact
```

Skips the fields the user has already provided in your account flow.

## Shipping

```swift
request.shippingMethods: [PKShippingMethod]
request.shippingType: PKShippingType
request.shippingContactEditingMode: PKShippingContactEditingMode
```

| `PKShippingType` | Sheet language |
|------------------|----------------|
| `.shipping` (default) | "Shipping" / "Ship to" |
| `.delivery` | "Delivery" |
| `.storePickup` | "Pickup" |
| `.servicePickup` | "Service pickup" |

`PKShippingContactEditingMode`: `.available` (default — user can edit), `.storePickup` (read-only — for in-store pickup, see `/passkit/displaying-a-read-only-pickup-address`).

### `PKDateComponentsRange` (WWDC21)

Use on `PKShippingMethod.dateComponentsRange` to express delivery windows. Carries `startDateComponents` and `endDateComponents` plus calendar metadata so Wallet can render localized ranges:

```swift
let arriving = PKDateComponentsRange(
    start: DateComponents(year: 2026, month: 5, day: 5),
    end: DateComponents(year: 2026, month: 5, day: 7)
)!
let method = PKShippingMethod(label: "Standard", amount: 5.99)
method.dateComponentsRange = arriving
method.detail = "Arrives May 5–7"
```

## Coupon Codes (WWDC21)

```swift
request.supportsCouponCode = true
request.couponCode = ""   // empty = show input field; non-empty = pre-populate
```

Implement `paymentAuthorizationController(_:didChangeCouponCode:handler:)` to validate and respond with an updated summary or `paymentCouponCodeInvalidError(localizedDescription:)` / `paymentCouponCodeExpiredError(localizedDescription:)`.

## Errors

`PKPaymentError` is the error type. Construct via convenience class methods on `PKPaymentRequest`:

| Constructor | Use |
|-------------|-----|
| `paymentBillingAddressInvalidError(withKey:localizedDescription:)` | Bad billing field (use `CNPostalAddressKey` constants for `key`) |
| `paymentShippingAddressInvalidError(withKey:localizedDescription:)` | Bad shipping field |
| `paymentShippingAddressUnserviceableError(withLocalizedDescription:)` | Address valid but you don't ship there |
| `paymentContactInvalidError(withContactField:localizedDescription:)` | Bad name/email/phone — pass `PKContactField` |
| `paymentCouponCodeInvalidError(localizedDescription:)` | Coupon malformed |
| `paymentCouponCodeExpiredError(localizedDescription:)` | Coupon past expiry |

Errors flow back via the `update.errors` array on each change callback's update object, or via `PKPaymentAuthorizationResult(status: .failure, errors: [...])` on the final auth.

## SwiftUI Buttons (WWDC22, iOS 16+)

| View | Purpose |
|------|---------|
| `PayWithApplePayButton(_:action:)` | Initiates Apple Pay; uses system styling |
| `AddPassToWalletButton(action:)` | Adds a `.pkpass` to Wallet (see `wallet-passes.md`) |
| `AddOrderToWalletButton(action:)` | iOS 17+; adds an order package (see `wallet-orders.md`) |
| `VerifyIdentityWithWalletButton(action:)` | Identity verification via Wallet (axiom-integration territory) |

Modifiers:

```swift
PayWithApplePayButton(.buy) { ... }
    .payWithApplePayButtonStyle(.automatic)   // .black, .white, .whiteOutline, .automatic
    .frame(height: 45)
    .disabled(!canPay)
```

`PKPaymentButtonType`: `.plain`, `.buy`, `.setUp`, `.inStore`, `.donate`, `.checkout`, `.book`, `.subscribe`, `.reload`, `.addMoney`, `.topUp`, `.order`, `.rent`, `.support`, `.contribute`, `.tip`, `.continue` (case selection drives the button label localization).

`PKPaymentButtonStyle` (UIKit): `.white`, `.whiteOutline`, `.black`, `.automatic`.

## Payment Token Format

`PKPaymentToken.paymentData` is a UTF-8 JSON dictionary with this shape:

```json
{
  "version": "EC_v1",                              // or "RSA_v1"
  "data": "<base64 encrypted payment data>",
  "signature": "<base64 detached PKCS #7 signature>",
  "header": {
    "publicKeyHash": "<base64 SHA-256 of merchant public key>",
    "transactionId": "<hex>",

    // EC_v1 only:
    "ephemeralPublicKey": "<base64 X.509 encoded key>",

    // RSA_v1 only:
    "wrappedKey": "<base64 symmetric key wrapped with merchant RSA public key>",

    // Optional, both versions:
    "applicationData": "<hex SHA-256 of original PKPaymentRequest.applicationData>"
  }
}
```

| Field | Notes |
|-------|-------|
| `signature` | Detached PKCS #7 envelope (not a raw ECDSA / RSA signature). Algorithm and signing certificate live inside the CMS structure. |
| `version` | `EC_v1` for ECC-encrypted (most regions); `RSA_v1` for RSA-encrypted (used where ECC is unavailable due to regulation, e.g. mainland China). |
| `applicationData` | SHA-256 hash of `PKPaymentRequest.applicationData`. Omitted from the header if the original property was nil. Use to bind the token to a specific order ID. |
| `wrappedKey` | RSA_v1 only. Symmetric key wrapped with your RSA public key; unwrap with your RSA private key. |
| `ephemeralPublicKey` | EC_v1 only. ANSI X.963 / X.509 encoded ephemeral public key. |

### Verification + decryption

Per `/passkit/payment-token-format-reference`:

1. **Verify the signature.** The signature is over `ephemeralPublicKey || data || transactionId || applicationData` (EC_v1) or `wrappedKey || data || transactionId || applicationData` (RSA_v1). Validate the X.509 chain to Apple Root CA — G3, check the marker OIDs (`1.2.840.113635.100.6.29` leaf, `1.2.840.113635.100.6.2.14` intermediate), and verify CMS signing time is within 5 minutes of the transaction.
2. **Identify the merchant key** via `publicKeyHash` (matches the SHA-256 of your Payment Processing certificate's public key).
3. **Restore the symmetric key.** EC_v1: ECDH from `ephemeralPublicKey` + your private key, then NIST-style KDF. RSA_v1: unwrap `wrappedKey` with your RSA private key. Apple delegates the KDF specifics to `/passkit/restoring-the-symmetric-key`.
4. **Decrypt `data`.** EC_v1 uses **AES-256-GCM** (`id-aes256-GCM`); RSA_v1 uses **AES-128-GCM** (`id-aes128-GCM`). Both modes use a **16-null-byte IV with no associated authentication data (AAD)**.
5. **Verify uniqueness** of `transactionId` against your processed-payment store (5-minute window).
6. **Verify business fields** in the decrypted payload: `currencyCode`, `transactionAmount`, `applicationData` hash matches your stored request.

The decryption key never belongs on the device. Most merchants pass the encrypted blob through to the PSP; only self-decrypt if you're the merchant of record AND you generated the CSR yourself.

### Decrypted payment-data shape (selected keys)

| Key | Description |
|-----|-------------|
| `applicationPrimaryAccountNumber` | DPAN — the device-specific tokenized PAN |
| `applicationExpirationDate` | YYMMDD |
| `currencyCode` | ISO 4217 numeric, as string (preserves leading zeros) |
| `transactionAmount` | Number |
| `cardholderName` | Optional |
| `paymentDataType` | `"3DSecure"` or `"EMV"` |
| `paymentData` | Nested dict — `onlinePaymentCryptogram` + `eciIndicator` (3DSecure), or `emvData` + `encryptedPINData` (EMV; RSA_v1 only) |
| `authenticationResponses` | Multi-token requests only — list of submerchant cryptograms |
| `merchantTokenIdentifier` / `merchantTokenMetadata` | Merchant-token (MPAN) requests only |

`PKPaymentMethod.type`: `.unknown`, `.debit`, `.credit`, `.prepaid`, `.store`.

## In-App Sequence Diagram (MIG p.26)

```
[1]  Customer taps Apple Pay button
[2]  App constructs PKPaymentRequest
[3]  App presents PKPaymentAuthorizationController
[4]  System displays sheet
[5]  Customer interacts (shipping / coupon / method changes)
[6]  Each interaction → delegate change callback → app responds with update
[7]  Customer authenticates (Face/Touch/Optic ID)
[8]  System encrypts payment data with merchant's Payment Processing public key
[9]  System calls didAuthorizePayment with PKPayment (encrypted token + contacts)
[10] App POSTs token to merchant server
[11] Merchant server forwards to PSP (encrypted blob OR self-decrypted card data)
[12] PSP authorizes via acquirer / network / issuer
[13] PSP returns success/failure to merchant server
[14] Merchant server returns to app
[15] App calls completion handler with PKPaymentAuthorizationResult
[16] System dismisses sheet with result animation
[17] Optional: PKPaymentOrderDetails handoff to Wallet Orders surface
```

Steps 11–13 happen out-of-band over the merchant-controlled network path. Steps 7–9 are the trust boundary — Apple's public key is what protects the card data in transit between Wallet and the PSP.

## Apple Pay Later API (WWDC23, US-only)

| Type | Purpose |
|------|---------|
| `PKPayLaterUtilities` | `validate(forAmount:currency:)` — tells you whether a transaction qualifies |
| `PKPayLaterView` (UIKit) / `PayLaterView` (SwiftUI) | Pre-checkout merchandising surface |
| `PKPaymentRequest.applePayLaterAvailability` | `.available` / `.unavailable` |

Mark `.unavailable` for prohibited categories (subscriptions, recurring items, gift cards). The `PKPayLaterView` / `PayLaterView` is the merchandising widget you place on product / cart pages to indicate "Pay Later available" *before* checkout.

## watchOS

`WKInterfacePaymentButton` — Storyboard / WatchKit-only; no SwiftUI equivalent on watchOS yet. Configure via `setLabel(_:)` / `setStyle(_:)` and wire the action through the storyboard. Delegate flow uses `PKPaymentAuthorizationController` (same as iOS) with these adaptations:

- **No shipping picker on the watch.** Resolve shipping pre-presentation; the watch sheet doesn't show shipping options.
- **Recommend short summary items.** Long lists scroll uncomfortably on a 41/45/49mm display.
- **Pairing model:** payment apps that ship for both iPhone and Watch should treat the iPhone app as the source of truth for setup; Watch app inherits merchant ID / capability via App Group sharing if needed.

`PKPaymentButtonLabel` cases parallel iOS `PKPaymentButtonType` (`.buy`, `.setUp`, `.inStore`, `.donate`, etc.). Verify exact case set against current Apple docs (`/watchkit/wkinterfacepaymentbutton`) before relying on a specific label.

## visionOS

API surface is **identical to iOS**. Auth modality is **Optic ID** (or device passcode). No code changes vs iOS — `PKPaymentAuthorizationController` and `PayWithApplePayButton` work as-is. SwiftUI is preferred on visionOS.

## Capability Detection (Static)

```swift
PKPaymentAuthorizationController.canMakePayments() -> Bool
PKPaymentAuthorizationController.canMakePayments(usingNetworks:) -> Bool
PKPaymentAuthorizationController.canMakePayments(usingNetworks:capabilities:) -> Bool
```

`canMakePayments()` checks Secure Element presence; doesn't check card provisioning. The two-arg form checks both. The three-arg form additionally filters by capability (e.g. `.threeDSecure`).

Web-side equivalent (for reference): `applePayCapabilities()` / `ApplePaySession.canMakePayments()` — see `apple-pay-web-ref.md`.

## Application-Specific Data

```swift
request.applicationData: Data?  // hash signed into the token; opaque to Apple
```

Use to bind a payment to your app's order ID without leaking it through the encrypted blob. The data is cryptographically committed in the token; tampering invalidates the signature.

## Deprecations to Avoid

| Deprecated | Replacement |
|------------|-------------|
| `requiredShippingAddressFields` | `requiredShippingContactFields` |
| `requiredBillingAddressFields` | `requiredBillingContactFields` |
| `PKAddressField` enum | `PKContactField` |
| `billingAddress` / `shippingAddress` properties | `billingContact` / `shippingContact` |
| `PKShippingContactEditingMode.enabled` | `PKShippingContactEditingMode.available` |
| Country-specific merchant validation URLs (`apple-pay-gateway-uk.apple.com`, etc.) | `apple-pay-gateway.apple.com` (production), `apple-pay-gateway-cert.apple.com` (sandbox) |
| `canMakePaymentsWithActiveCard()` (web) | `applePayCapabilities()` (WWDC24) |

## Resources

**MIG**: pp.13–17 (request + delegates), pp.18–19 (variants + merchant tokens), pp.20–21 (token format + auth), p.26 (sequence diagram)

**WWDC**: 2020-10662 (button types, automatic style), 2021-10092 (coupon codes, date ranges), 2022-10041 (multi-merchant, SwiftUI buttons, MCC), 2023-10114 (Apple Pay Later, deferred, disbursements), 2024-10108 (third-party browser, applePayCapabilities, MCC)

**Docs**: /passkit, /passkit/pkpaymentrequest, /passkit/pkpayment, /passkit/pkpaymenttoken, /passkit/pkpaymentauthorizationcontroller, /passkit/pkpaymentnetwork, /passkit/pkcontactfield, /passkit/pkshippingmethod, /passkit/payment-token-format-reference, /passkit/displaying-a-read-only-pickup-address

**Skills**: apple-pay (discipline), apple-pay-web-ref (web API surface), wallet-orders (PKPaymentOrderDetails handoff), payments-diag (token / merchant-validation failure modes)
