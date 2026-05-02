# Apple Pay — Native Apps (iOS / iPadOS / macOS / Catalyst / visionOS / watchOS)

**You MUST use this skill for ANY native Apple Pay integration.** The core operational document is the **Apple Pay Merchant Integration Guide** (MIG) — most of this skill cites it directly. For website integration use `apple-pay-web.md`. For the IAP boundary, see `apple-pay-vs-iap.md`.

## The Five-Actor Mental Model (MIG p.5)

```
Customer → Merchant App → Merchant Server → PSP → Acquirer → Network → Issuer
```

| Actor | What they do |
|-------|--------------|
| Customer | Authenticates with biometric / passcode. Apple device encrypts payment data and returns it to your app. |
| Merchant App | Sends the encrypted Apple Pay payment object to your server. |
| Merchant Server | Forwards payment object to your Payment Service Provider (PSP). |
| PSP | **Decrypts** the Apple Pay payment object using your Payment Processing private key. Formats a 3D Secure authorization message. |
| Acquirer | Routes payment for authorization. |
| Payment Network | De-tokenizes the DPAN and forwards the PAN to the issuing bank. |
| Issuer | Authorizes (or declines). |

**Apple decrypts nothing.** Apple's role is to encrypt the device-specific tokenized credentials (DPAN) at authentication time. The private key for decryption belongs to you (or your PSP). This affects who controls the Payment Processing Certificate's CSR — see Pre-Flight Checklist.

## Pre-Flight Checklist (MIG pp.4–9)

Run this before writing any PassKit code. Skipping any item produces silent failures that surface only at sandbox or production.

| Step | Owner | What |
|------|-------|------|
| Confirm PSP supports Apple Pay | Payments team | Check Apple's supported PSPs list at /apple-pay (#payment-platforms section). If yours isn't listed, contact them directly. |
| Apple Developer Program membership | Account holder | Required, renewed yearly. **Enterprise Program accounts cannot use Apple Pay.** |
| Create Merchant ID | Account holder | `merchant.com.example.foo` reverse-DNS form. **Never expires.** Reusable across multiple apps + websites. |
| Create Payment Processing Certificate | Account holder + PSP | ECC 256-bit (or RSA 2048 for mainland China). **Expires every 25 months.** If your PSP decrypts on their side, follow their CSR procedure (typically they provide the CSR). If you self-decrypt, you generate the CSR locally. |
| Enable Apple Pay capability in Xcode | Developer | Signing & Capabilities → + → Apple Pay → click refresh → select merchant ID. |
| (For automation) Apple Pay sandbox tester account | Developer | Created in App Store Connect. Sign out of iCloud first; sign in with the sandbox tester. |

### Cert renewal — the create-but-don't-activate workflow (MIG p.9)

Renewal is a **two-stage** operation. Most production outages around Apple Pay come from skipping the staging:

1. Generate the new Payment Processing Certificate before the old one expires (**create**).
2. Coordinate with your PSP. Wait until both sides are ready.
3. Click **Activate** in the Apple Developer portal at the agreed cutover time.

> "This prepares your replacement certificate but doesn't activate it immediately. Work with your PSP to choose the best time to switch over to the renewed certificate, and when you are both ready, press the 'activate' button next to the certificate in the Apple Developer Portal." — MIG p.9

Failing to coordinate the activation toggle = a window where Apple servers encrypt with one key but your PSP holds another. Transactions fail.

## Constructing the Payment Request

The shape of the request is the same regardless of platform. Three patterns:

### One-time payment (the default)

```swift
let request = PKPaymentRequest()
request.merchantIdentifier = "merchant.com.example.shop"
request.supportedNetworks = [.visa, .masterCard, .amex, .discover]
request.merchantCapabilities = [.threeDSecure]   // or include .credit / .debit if needed
request.countryCode = "US"
request.currencyCode = "USD"
request.paymentSummaryItems = [
    PKPaymentSummaryItem(label: "Subtotal", amount: NSDecimalNumber(string: "89.99")),
    PKPaymentSummaryItem(label: "Shipping", amount: NSDecimalNumber(string: "5.00")),
    // Final line: label = your customer-facing business name; amount = grand total displayed next to "Pay"
    PKPaymentSummaryItem(label: "Example Shop", amount: NSDecimalNumber(string: "94.99"))
]
request.requiredShippingContactFields = [.name, .postalAddress]
request.requiredBillingContactFields = [.postalAddress]
```

**`PKPaymentSummaryItem.amount` is `NSDecimalNumber`, not `Double`.** Use `NSDecimalNumber(string:)` from a string, or `NSDecimalNumber(decimal:)` from a Swift `Decimal`. Passing a Double literal won't compile. Wrong amount precision is the single most common Apple Pay integration bug — currency math from `Double` is the root cause.

Privacy discipline: only request fields you actually need to fulfil the order. The HIG penalizes over-collection.

The **last** summary item is the line displayed next to "Pay" on the sheet, and the **label** is the business name customers see. If you are an intermediary, format as `"Pay [End_Merchant] (via [Your_Business])"` per HIG and `apple-pay-vs-iap.md`.

### Recurring / automatic-reload / deferred / disbursement variants (MIG pp.18–19)

Apple Pay has dedicated request types for non-one-time scenarios. **You cannot set more than one variant on a single request.**

| Scenario | Request property | Use when |
|----------|------------------|----------|
| Subscription (digital or service) at fixed interval | `recurringPaymentRequest` (`PKRecurringPaymentRequest`) | Streaming, gym, club dues, utility-style recurring billing. The MPAN ("merchant token") lets billing continue across device upgrades and card replacements. |
| Auto top-up at threshold | `automaticReloadPaymentRequest` (`PKAutomaticReloadPaymentRequest`) | Stored-balance / transit / store-card reload when balance dips below threshold. |
| Pay later at delivery | `deferredPaymentRequest` (`PKDeferredPaymentRequest`) | Hotel booking, pre-order, car rental with incidental authorization. Free-cancellation period and bill-on date. |
| Pay out *to* the user | `PKDisbursementRequest` | Funds transfer from your platform to the user's card linked in Wallet. Web-equivalent uses `Disbursement Request Modifier`. |

Use these instead of rolling your own subscription billing. Without `PKRecurringPaymentRequest`, you lose merchant-token continuity — every device swap or card replacement breaks the subscription.

### Apple Pay Later (US-only, WWDC23)

WWDC23 introduced two complementary surfaces for Apple Pay Later:

- **Pre-checkout merchandising** via `PKPayLaterView` (UIKit) / `PayLaterView` (SwiftUI). Place on product / cart pages to indicate "Pay Later available" *before* the customer initiates checkout. Use `PKPayLaterUtilities.validate(amount:currencyCode:)` to gate display.
- **Per-request gating** via `applePayLaterAvailability` (now marked deprecated; check current docs before use). When you do set it, `.unavailable` requires an associated `Reason`:

```swift
// If using applePayLaterAvailability (check deprecation status):
request.applePayLaterAvailability = .unavailable(.itemIneligible)
// or .unavailable(.recurringTransaction) for subscription-style requests
```

Use `.unavailable` for prohibited transaction types (subscriptions, recurring items, gift cards). Apple Pay Later is **folded into the existing payment request** — it's not a separate flow.

### Multi-merchant in one sheet (`PKPaymentTokenContext`, WWDC22)

A booking flow that pays a hotel, an airline, and a car-rental company in one user gesture:

```swift
let hotelContext = PKPaymentTokenContext(
    merchantIdentifier: "merchant.com.example.partners.hotelco",
    externalIdentifier: "hotelco",
    merchantName: "HotelCo",
    merchantDomain: "hotelco.example",
    amount: NSDecimalNumber(string: "320.00")
)
request.multiTokenContexts = [hotelContext, airlineContext, carRentalContext]
```

Each context produces its own encrypted payment token with its own PSP routing. The user sees one sheet but the merchant settlement is split.

### Merchant Category Code (WWDC24)

Set `merchantCategoryCode` (ISO 18245 four-digit code) when supported card types vary by category. Without an MCC, the sheet may show cards that the customer's bank then declines for that merchant type — bad UX, avoidable.

## Presenting the Sheet

| Surface | API | Notes |
|---------|-----|-------|
| iOS / iPadOS | `PKPaymentAuthorizationController` (preferred) or `PKPaymentAuthorizationViewController` | Controller is non-UI; ViewController hosts presentation. SwiftUI `PayWithApplePayButton` (iOS 16+) wraps this. |
| macOS / Catalyst | `PKPaymentAuthorizationController` with explicit window | Mac/Catalyst use the **web security model**, not native — see Catalyst section. |
| watchOS | `WKInterfacePaymentButton` | Different API surface; see `apple-pay-ref.md` watchOS section. |
| visionOS | `PKPaymentAuthorizationController` / SwiftUI button | Identical to iOS API; only auth modality changes (Optic ID). |

### SwiftUI button (preferred, iOS 16+)

```swift
PayWithApplePayButton(.buy) {
    // build PKPaymentRequest, present via PKPaymentAuthorizationController
}
.payWithApplePayButtonStyle(.automatic)   // adapts to Light/Dark
.frame(height: 45)
```

`PayWithApplePayButton` is the modern path. Still build the `PKPaymentRequest` exactly as above.

### Capability detection (MIG p.13)

```swift
if PKPaymentAuthorizationController.canMakePayments() {
    // device hardware supports Apple Pay (Secure Element present)
}

if PKPaymentAuthorizationController.canMakePayments(usingNetworks: [.visa, .masterCard]) {
    // device has at least one card in Wallet for those networks
}
```

`canMakePayments()` checks **device capability** only — not whether a card is provisioned. `canMakePayments(usingNetworks:)` checks both. Use both.

**HIG rule:** If `canMakePayments()` returns true, you must show the Apple Pay button. Don't gate it on the user already having a card; the system handles the "no card → set up Wallet" flow.

## Delegate Callbacks (MIG pp.15–17)

The system calls your delegate at every customer interaction with the sheet. **Respond promptly** — the system aborts the transaction if your handler stalls. Don't run synchronous network calls or long fulfillment logic inside a callback; pre-compute or kick off async work and return.

| Callback | Trigger | What to do |
|----------|---------|------------|
| `paymentAuthorizationController(_:didChangeShippingContact:handler:)` | Customer changes shipping address | Recalculate shipping methods + costs + tax, return updated `PKPaymentRequestShippingContactUpdate` with new summary items |
| `paymentAuthorizationController(_:didChangeShippingMethod:handler:)` | Customer picks a different shipping option | Recalculate total, return `PKPaymentRequestShippingMethodUpdate` |
| `paymentAuthorizationController(_:didChangePaymentMethod:handler:)` | Customer switches to different card | Recalculate any card-specific fees / discounts, return `PKPaymentRequestPaymentMethodUpdate` |
| `paymentAuthorizationController(_:didChangeCouponCode:handler:)` | Customer enters / changes coupon code | Validate, return `PKPaymentRequestCouponCodeUpdate` |
| `paymentAuthorizationController(_:didAuthorizePayment:handler:)` | Customer confirms with Face/Touch/Optic ID | **This is where you hand the encrypted token to your server.** Return `PKPaymentAuthorizationResult` (`.success` or `.failure(errors:)`) promptly. |
| `paymentAuthorizationControllerDidFinish(_:)` | Sheet dismissed | Clean up; may or may not have been a successful payment. |

### Privacy: redacted addresses pre-authorization (MIG p.15)

Before the user confirms, you receive a **redacted** shipping contact — no street, name, or phone. Use this to compute shipping options and tax. After the user authorizes, the **complete** contact is delivered.

```
// Pre-auth (redacted)
{ country: "US", region: "NC", city: "Raleigh", postalCode: "27601" }

// Post-auth (full)
{ country: "US", addressLines: ["2399 Elm St"], region: "NC", city: "Raleigh",
  postalCode: "27601", recipient: "Allison Cain", phone: "..." }
```

**Don't** require post-auth fields to compute pre-auth state. Plenty of integrations bug out because they need a phone number to estimate shipping cost — they can't, by design.

## Error Handling (MIG p.16)

Use `PKPaymentError` to point users at specific fields with friendly messages. The sheet highlights the bad field automatically:

```swift
let zipError = PKPaymentRequest.paymentShippingAddressInvalidError(
    withKey: CNPostalAddressPostalCodeKey,
    localizedDescription: "ZIP code doesn't match city"
)
completion(PKPaymentAuthorizationResult(status: .failure, errors: [zipError]))
```

Address validation discipline:
- **Tolerate ZIP+4 and various phone formats.** Apple's words: "intelligent enough to ignore irrelevant data."
- **Accept addresses with missing `subAdministrativeArea` / `subLocality` / `phoneticFamilyName`** — they're often empty.
- **Don't** validate address fields against your own US-only rules when shipping internationally — `country`/`countryCode` is authoritative.

## Authorization Handoff to PSP (MIG pp.20–21)

After `didAuthorizePayment`, you have a `PKPaymentToken` containing:

```
PKPaymentToken
├─ paymentMethod (network, type, displayName) — non-sensitive, OK to display
├─ transactionIdentifier — opaque
└─ paymentData — the encrypted blob
   ├─ data: ciphertext
   ├─ signature: ECDSA / RSA signature
   ├─ header: { publicKeyHash, ephemeralPublicKey, transactionId }
   └─ version: "EC_v1" (or "RSA_v1" for mainland China)
```

**Two paths to PSP:**

1. **Pass the encrypted blob through.** Most PSPs accept `paymentData` as-is; they decrypt on their side using the Payment Processing private key (which they hold because they generated the CSR). This is the default and recommended path.
2. **Self-decrypt and forward.** If you generated the CSR yourself, you hold the private key and can decrypt server-side. Then you forward the decrypted card data to the PSP. See `apple-pay-ref.md` "Payment Token Format" and Apple's `/passkit/payment-token-format-reference`.

**Never put decryption logic in the client app.** The private key never belongs on the device — server-side only. This is non-negotiable.

### Completing the handler

```swift
// Inside didAuthorizePayment
let result = await myServer.authorize(token: payment.token)
if result.success {
    completion(PKPaymentAuthorizationResult(status: .success, errors: nil))
} else {
    completion(PKPaymentAuthorizationResult(status: .failure, errors: result.errors))
}
```

Keep the auth call fast — the system aborts if you stall. If your server is slow, **don't** return `.success` and reconcile asynchronously: that charges the customer for an order you can't yet fulfil. Tighten your auth path instead.

### Order tracking handoff (WWDC22)

Set `PKPaymentOrderDetails` on the result to hand off post-purchase tracking to Wallet's Orders surface (see `wallet-orders.md`):

```swift
let orderDetails = PKPaymentOrderDetails(
    orderTypeIdentifier: "order.com.example.shop",
    orderIdentifier: "ORD-12345",
    webServiceURL: URL(string: "https://orders.example.com")!,
    authenticationToken: "shared-secret-for-this-order"
)
let result = PKPaymentAuthorizationResult(status: .success, errors: nil)
result.orderDetails = orderDetails   // set as property; not an init parameter
completion(result)
```

Apple async-pulls the signed order package from your server. The customer sees the order in Wallet automatically. See `wallet-orders.md` for package signing.

## Apple Pay Mark vs Apple Pay Button — A Named Anti-Pattern

This is the most common HIG violation in shipped apps. They are **different things**:

| Element | Purpose | Tappable? | API-provided? |
|---------|---------|-----------|----------------|
| **Apple Pay Button** | Initiates the payment flow | Yes | Yes (`PKPaymentButton`, `PayWithApplePayButton`, `WKInterfacePaymentButton`) |
| **Apple Pay Mark** | Communicates "Apple Pay accepted" — signage only | **No** | Static graphic from Apple Pay Marketing Guidelines (/apple-pay/marketing) |

> "Use the Apple Pay mark only to communicate that Apple Pay is accepted. The Apple Pay mark doesn't facilitate payment. Never use it as a payment button or position it as a button." — Apple Pay HIG

**The wrong path:** placing the Apple Pay Mark in your custom checkout button as both label and trigger.
**The right path:** use the Apple Pay Mark as inline signage on your product / cart pages; use the API-provided Apple Pay Button for the action.

If you must use a custom button (e.g. a generic "Pay" button on a page where multiple methods exist), the HIG is explicit: **don't display "Apple Pay" or the Apple Pay logo on a custom button**. Reference Apple Pay separately on the same page using the Mark.

## Sandbox Testing Discipline (MIG p.22)

| Rule | Why |
|------|-----|
| Use App Store Connect sandbox tester account; sign out of iCloud first | The sandbox-vs-prod boundary is at the iCloud account level. |
| Use Apple-provided sandbox FPANs | Test cards available per region (US / UK / etc.). For OTP prompts, use `111111`. |
| Sandbox transactions decline pre-fulfillment by design | This is not a bug. Sandbox is for flow validation, not order completion. |
| **Test in production with real cards before launch** | The PSP test key won't match the production key. End-to-end with real money on real cards is the only valid pre-launch test. |
| Test on multiple devices and browsers | Especially since iOS 18+ added third-party browser support; web flows must work outside Safari. |
| Map every PKPayment field to your order system | Phone numbers may have `+` prefix; ZIP may be ZIP+4; verify your fulfillment ingest. |

> "Attempting to use these cards with a live production environment will result in your PSP rejecting the transaction." — MIG p.22

The sandbox is fragile by design. If your PSP returns an error against sandbox, that's not a sandbox failure — it's a working sandbox correctly refusing fake money.

## Catalyst / macOS Considerations (WWDC20, MIG)

Mac and Catalyst Apple Pay use the **web security model**, not native. This affects three things:

1. **Window requirement.** `PKPaymentAuthorizationController` must be presented from a window — not from a controllerless context. AppKit + Catalyst always have a window; the requirement is operational, not API-shape.
2. **Merchant validation is required even in-app.** Implement `paymentAuthorizationController(_:didRequestMerchantSessionUpdate:)` — Catalyst calls this just like the web does. Native iOS/iPadOS doesn't.
3. **Static merchant validation URL.** Use `apple-pay-gateway.apple.com/paymentservices/paymentSession` (production) and `apple-pay-gateway-cert.apple.com/paymentservices/paymentSession` (sandbox). The legacy region-specific URLs (e.g. `apple-pay-gateway-uk.apple.com`) **were removed** — using one will fail merchant validation.

The merchant validation step on Mac/Catalyst is **server-side only**. Same rules as the web: never call `paymentSession` from the client, only from your server with the Merchant Identity Certificate via two-way TLS.

## visionOS

API-shape identical to iOS. The only material difference is the auth modality: **Optic ID** (or device passcode) replaces Face ID / Touch ID. No code changes required — `PKPaymentAuthorizationController` adapts automatically. SwiftUI `PayWithApplePayButton` works as on iOS.

## App Clips (WWDC20)

Apple Pay is the **recommended payment method** for App Clips:
- No account-creation friction (Apple Pay supplies the contact + payment data).
- Pair with **Sign in with Apple** for guest checkout if you need a customer record.
- App Clips have a 10MB binary limit; PassKit's footprint is system-supplied, no impact.

A clip's button surface and authorization flow are identical to a full app. Use the SwiftUI `PayWithApplePayButton` to keep the binary lean.

## Anti-Patterns

| Anti-Pattern | Why it fails | Fix |
|--------------|--------------|-----|
| Putting payment-token decryption in the client app | Private key on device = security violation; PSPs reject this design | Decrypt only on your server, or pass the encrypted blob through to the PSP |
| Skipping `merchantCategoryCode` (WWDC24) when supported card types vary | Sheet shows cards the customer's bank declines for that MCC | Set MCC from ISO 18245 |
| Using deprecated `requiredShippingAddressFields` instead of `requiredShippingContactFields` | Deprecated since iOS 11; doesn't surface name/email correctly | Use `requiredShippingContactFields` |
| Rolling your own subscription billing instead of `PKRecurringPaymentRequest` | Loses merchant-token continuity; subscription breaks on device upgrade | Use the dedicated request type |
| Calling old country-specific merchant validation URL (`apple-pay-gateway-uk.apple.com` etc.) | URL was removed | Use static `apple-pay-gateway.apple.com` |
| Treating the Apple Pay Mark as a button | HIG violation; conversion-killer; App Review rejection trigger | Use API-provided button; Mark is signage |
| Validating addresses against US-only rules in international flow | Rejects valid international addresses (UK postcodes, e.g.) | Tolerate variations; use `countryCode` to scope validation |
| Requesting more contact fields than you need | Privacy issue + cart abandonment | Request only what fulfillment requires |
| Skipping the cert-renewal create-but-don't-activate workflow | Production transactions decrypt with wrong key during cutover | Coordinate activation with PSP; flip toggle at agreed time |
| Using Enterprise Program account | Apple Pay is **not** available on Enterprise Program | Use Apple Developer Program (paid, $99/year) |

## Pre-Launch Checklist (MIG p.22)

- [ ] Apple Pay button visible on every device + browser combination you support
- [ ] Sandbox flow exercised end-to-end (decline expected — that's correct)
- [ ] Production flow exercised with real cards on real devices (success expected)
- [ ] All PKPayment contact fields mapped to your order management system
- [ ] Phone number format variations handled (with/without `+`, with/without country code, with/without spaces)
- [ ] Address format variations handled across countries you ship to
- [ ] Coupon-code event handling tested if `supportsCouponCode` is enabled
- [ ] Shipping-method change events tested
- [ ] Cancellation paths exercised — sheet dismissed pre-auth, dismissed post-auth, app suspended mid-flow
- [ ] Recurring/automatic-reload/deferred flows tested if applicable, including merchant-token notification (MIG p.19)
- [ ] Cert expiry calendar entry set 30 days before 25-month mark

## Risk Management Checklist (MIG p.23)

Apple's recommendations for fraud-mitigation independent of the PSP's controls:

- [ ] **Velocity** — limit transactions per device / card / IP within a window
- [ ] **Delivery** — flag mismatched billing/shipping countries
- [ ] **Bad-transaction list** — maintain block list of known-fraud cards / contacts
- [ ] **Email / IP signals** — disposable-email, anonymized-IP heuristics
- [ ] **Country / region** — flag transactions from regions you don't normally serve

These are PSP-orthogonal — PSPs do their own fraud screening, but you should still implement merchant-level checks.

## Resources

**MIG**: pp.4–9 (setup), pp.13–17 (request + delegates), pp.18–19 (variants + merchant tokens), pp.20–22 (auth + testing), p.23 (risk), p.26 (sequence diagram)

**WWDC**: 2020-10662 (Catalyst, App Clips, button types, static URL), 2021-10092 (redesigned sheet, coupon, shipping date ranges), 2022-10041 (multi-merchant, automatic payments, order tracking, SwiftUI buttons), 2023-10114 (Apple Pay Later, deferred, disbursements, MCC), 2024-10108 (third-party browser, JS SDK 1.2.0, applePayCapabilities, MCC)

**HIG**: /design/human-interface-guidelines/apple-pay (button, mark, payment-sheet UX)

**Docs**: /passkit, /passkit/setting-up-apple-pay, /passkit/pkpaymentrequest, /passkit/payment-token-format-reference, /help/account/capabilities/configure-apple-pay, /apple-pay (PSP list, marketing)

**Skills**: apple-pay-ref (API surface), apple-pay-vs-iap (boundary), apple-pay-web (web), wallet-orders (post-purchase), payments-diag (failure modes), axiom-design/hig (button placement), axiom-security/keychain-ref (cert export), axiom-shipping/app-store-diag (rejection patterns)
