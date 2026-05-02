# Apple Pay on the Web

**You MUST use this skill for ANY Apple Pay integration on a website.** The shape of the integration is materially different from native — additional certificate, domain verification, server-side merchant validation, and (since iOS 18) third-party browser support. For native apps see `apple-pay.md`. For the IAP/Apple Pay boundary (which doesn't apply to web — IAP doesn't exist on the web) see `apple-pay-vs-iap.md`.

## Why Web Setup Is Different

Native and web share the same merchant ID and Payment Processing Certificate, but web adds three things that don't exist in native:

| Web-only requirement | Why |
|----------------------|-----|
| **Merchant Identity Certificate** (RSA 2048; separate from Payment Processing Certificate) | Authenticates *server* sessions with Apple Pay servers via two-way TLS. Native doesn't need it because the device handles trust. |
| **Domain registration + verification** | Apple ties the Apple Pay button to specific domains. Every TLD and subdomain that displays the button must be registered and verified. |
| **Server-side merchant validation step** | Every checkout begins with your server requesting a one-time, 5-minute, single-use opaque session object from Apple — using the Merchant Identity Certificate. |

A native app skips all three. If you've shipped native Apple Pay before, expect web to take 2–3× the setup time on the certificate / domain side.

## Pre-Flight Web Checklist (MIG p.10)

Run before writing any JavaScript. Skipping any item produces silent merchant-validation failures that surface only at the first checkout.

| Step | Owner | What |
|------|-------|------|
| **HTTPS + TLS 1.2+** on every page that shows the button | Server admin | Apple's servers will not validate sessions for non-HTTPS or weak-TLS sites. |
| **Domain registered AND verified** | Account admin | Add domain in Certificates, IDs & Profiles → Merchant IDs → your ID → Merchant Domains → Add. Download `apple-developer-merchantid-domain-association.txt`, place at `/.well-known/` on the apex of the domain. **Domain cannot be behind a redirect or proxy** — must be directly reachable by Apple's IPs. Re-verify when association file expires. |
| **Merchant Identity Certificate** created and exported | Developer | RSA 2048-bit key in Keychain. Export as `.p12` with password. Split into `ApplePay.crt.pem` and `ApplePay.key.pem` via `openssl pkcs12` for server use (commands below). |
| **Cert tested** via curl to `apple-pay-gateway-cert.apple.com` | Developer | One-shot validation that your cert + domain + merchant ID work. Test before any frontend work. |
| **Allow Apple's IPs in firewall** | Server admin | Apple publishes the IP list at `/applepayontheweb/setting-up-your-server`. Domain verification fails silently if Apple can't reach your `.well-known/` file. |

### Exporting the Merchant Identity Certificate (MIG p.10–11)

```bash
# Export from Keychain as ApplePayMerchantID_and_privatekey.p12 with a password,
# then split:

openssl pkcs12 -in ApplePayMerchantID_and_privatekey.p12 \
    -out ApplePay.crt.pem -nokeys

openssl pkcs12 -in ApplePayMerchantID_and_privatekey.p12 \
    -out ApplePay.key.pem -nocerts
```

### Test cert + domain via curl (MIG p.11)

```bash
curl --location 'https://apple-pay-gateway-cert.apple.com/paymentservices/paymentSession' \
    --header 'Content-Type: text/plain' \
    --data '{
      "merchantIdentifier": "merchant.com.example.shop",
      "displayName": "Example Shop",
      "initiative": "web",
      "initiativeContext": "shop.example.com"
    }' \
    --cert ApplePay.crt.pem \
    --key ApplePay.key.pem
```

A successful response is an opaque session JSON blob. If you get nothing or a TLS error, the cert + domain pair is broken — **don't proceed to frontend**. Common failure modes are documented in `payments-diag.md`.

> "It is important that this object is not inspected, parsed or modified in any way. Apple may update the contents of this object from time to time with changes and enhancements." — MIG p.12

Pass it through verbatim to `completeMerchantValidation()`.

## Choose the Right API

Two JavaScript APIs accept Apple Pay on the web. Both are supported; pick by browser scope:

| API | Supported browsers | When to use |
|-----|-------------------|-------------|
| **Apple Pay JS** (`ApplePaySession`) | Safari (Mac, iOS, iPadOS, visionOS) | Established, full feature surface, Apple-controlled. Pick this for Safari-only flows or when you want maximum feature parity with new Apple Pay capabilities at launch. |
| **W3C Payment Request API** (`PaymentRequest`) | Cross-browser, including third-party browsers on iOS 18+ via the Apple Pay JS SDK | Pick for cross-browser support. Required for third-party browser scan-to-pay (WWDC24). |

You can support both — many large merchants do, choosing dynamically based on the browser. Apple's recommended migration path is toward Payment Request API for portability, but Apple Pay JS remains supported.

## Display the Button (WWDC24, MIG p.13)

There are two ways to render the Apple Pay button on the web. **One of them works on third-party browsers; one doesn't.**

| Method | Works on Safari? | Works on third-party browsers (iOS 18+)? | Recommended? |
|--------|-----------------|------------------------------------------|--------------|
| **JavaScript SDK button** (`<apple-pay-button>` custom element) | Yes | **Yes** | **Yes — required for non-Safari support** |
| **CSS-implemented button** (background-image with `-webkit-appearance`) | Yes | **No** | Legacy only |

Load the SDK in `<head>`:

```html
<script crossorigin
        src="https://applepay.cdn-apple.com/jsapi/v1.latest/apple-pay-sdk.js">
</script>
```

`v1.latest` resolves to the current SDK. Specific-version pinning paths are documented at `/applepayontheweb/loading-the-latest-version-of-apple-pay-js` — verify the exact form before pinning. **SDK 1.2.0 or newer is required for third-party browser scan-to-pay.**

Render the button:

```html
<apple-pay-button buttonstyle="black" type="buy" locale="en-US">
</apple-pay-button>
```

The SDK custom element handles localization, sizing, and Light/Dark adaptation automatically. Don't try to style it with custom CSS beyond the documented attributes.

## Capability Detection (WWDC24)

Three APIs, two of them deprecated. Pick correctly.

| API | Returns | Status |
|-----|---------|--------|
| `ApplePaySession.canMakePayments()` | Boolean — device hardware supports Apple Pay | Current |
| `ApplePaySession.canMakePaymentsWithActiveCard(merchantId)` | Promise<Boolean> — device has a card provisioned | **Deprecated** (WWDC24) |
| `applePayCapabilities(merchantId)` | Promise<{ paymentCredentialStatus }> | Current — replaces `canMakePaymentsWithActiveCard` |

`paymentCredentialStatus` values:

| Value | Meaning | UI guidance |
|-------|---------|-------------|
| `paymentCredentialsAvailable` | Active card provisioned | Show Apple Pay first / pre-selected (HIG + AUG primacy rule) |
| `paymentCredentialsUnavailable` | No card; Apple Pay not usable | Hide the button |
| `paymentCredentialStatusUnknown` | Can't determine (e.g. third-party browser before scan-to-pay) | Show the button; ordering is your choice |
| `applePayUnsupported` | Browser / device fundamentally can't | Hide the button |

```js
const result = await applePayCapabilities("merchant.com.example.shop");
switch (result.paymentCredentialStatus) {
    case "paymentCredentialsAvailable":   showPrimary(); break;
    case "paymentCredentialStatusUnknown": showSecondary(); break;
    case "paymentCredentialsUnavailable":
    case "applePayUnsupported":            hide(); break;
}
```

> The HIG / AUG rule: if `applePayCapabilities()` returns `paymentCredentialsAvailable`, Apple Pay must be the **primary** displayed payment option. Not necessarily the only one — but pre-selected, larger, or otherwise visually first.

## Merchant Validation Flow (MIG p.14, providing-merchant-validation, tech talk 111381)

The single most security-critical part of web integration. Get it wrong and either you leak your merchant identity cert or your sessions don't authenticate.

```
Browser                    Your server                    Apple Pay servers
   │                            │                                │
   │── checkout button click ──▶│                                │
   │                            │                                │
   │◀── ApplePaySession.begin() ┤                                │
   │   (sheet appears)          │                                │
   │                            │                                │
   │── onmerchantvalidation ───▶│                                │
   │   (validationURL)          │                                │
   │                            │                                │
   │                            │── POST /paymentSession ────────▶│
   │                            │   (merchant identity cert,     │
   │                            │   two-way TLS)                 │
   │                            │                                │
   │                            │◀── opaque session JSON ───────┤
   │                            │                                │
   │◀── completeMerchantValidation(session)                      │
   │                            │                                │
```

### Implementation contract

1. **Browser** registers `onmerchantvalidation` (Apple Pay JS) or listens for the `merchantvalidation` event (Payment Request API). The handler receives a `validationURL` — **always use the URL the event provides**; it can vary.
2. **Browser** POSTs the validationURL to your own server.
3. **Server** POSTs to the Apple Pay endpoint using the **Merchant Identity Certificate** for two-way TLS. **Never call this endpoint from the browser.**
4. **Apple Pay** returns an opaque JSON session object.
5. **Server** returns it verbatim to the browser.
6. **Browser** calls `session.completeMerchantValidation(sessionObject)` (Apple Pay JS) or resolves the validation event (Payment Request API).

### Server-side request shape

```http
POST https://apple-pay-gateway.apple.com/paymentservices/paymentSession
Content-Type: text/plain

{
  "merchantIdentifier": "merchant.com.example.shop",
  "displayName": "Example Shop",
  "initiative": "web",
  "initiativeContext": "shop.example.com"
}
```

Two-way TLS using the merchant identity cert + private key. Apple's gateway accepts JSON content with either `Content-Type: text/plain` (per the MIG curl example, p.11) or `application/json` — they both work. **Use `validationURL` from the event, not a hardcoded URL** — Apple may route validation through different paths.

### Critical rules (any one of these will break validation)

- **Server-side only.** Calling `paymentSession` from the browser leaks the certificate. App Review and Apple Pay servers both reject this design.
- **Don't inspect or modify the session object.** It's opaque. Apple updates the schema without notice. Pass it through verbatim.
- **Single-use.** Each session object is good for one `completeMerchantValidation()` call.
- **5-minute expiry.** Sessions older than 5 minutes are dead.
- **Sandbox vs production endpoint.** Sandbox uses `apple-pay-gateway-cert.apple.com`; production uses `apple-pay-gateway.apple.com`. Don't ship sandbox URLs to production.

## Payment Request Construction (MIG pp.13–17)

Apple Pay JS form:

```js
const session = new ApplePaySession(14, {
    countryCode: "US",
    currencyCode: "USD",
    merchantCapabilities: ["supports3DS"],
    supportedNetworks: ["visa", "masterCard", "amex", "discover"],
    total: {
        label: "Example Shop",
        type: "final",
        amount: "94.99"
    },
    lineItems: [
        { label: "Subtotal", amount: "89.99" },
        { label: "Shipping", amount: "5.00" }
    ],
    requiredShippingContactFields: ["postalAddress", "name"],
    requiredBillingContactFields: ["postalAddress"]
});
```

Payment Request API form:

```js
const supportedNetworks = ["visa", "masterCard", "amex", "discover"];
const methodData = [{
    supportedMethods: "https://apple.com/apple-pay",
    data: {
        version: 14,
        merchantIdentifier: "merchant.com.example.shop",
        merchantCapabilities: ["supports3DS"],
        supportedNetworks,
        countryCode: "US"
    }
}];
const details = {
    displayItems: [
        { label: "Subtotal", amount: { currency: "USD", value: "89.99" } },
        { label: "Shipping", amount: { currency: "USD", value: "5.00" } }
    ],
    total: { label: "Example Shop", amount: { currency: "USD", value: "94.99" } }
};
const options = { requestPayerName: true, requestShipping: true };
const request = new PaymentRequest(methodData, details, options);
```

The currency-amount form differs between the two APIs (string vs nested `{currency, value}` object). Decimal-precise strings throughout — never JS `Number` literals; floating-point math will silently corrupt totals.

## Event Handlers

Respond promptly — the system aborts the transaction if your handler stalls.

| Apple Pay JS event | Payment Request API equivalent | Trigger |
|--------------------|-------------------------------|---------|
| `onshippingaddresschange` | `shippingaddresschange` event | Shipping address picked / changed |
| `onshippingmethodchange` | `shippingoptionchange` event | Shipping method picked |
| `onpaymentmethodselected` | `paymentmethodchange` event | Payment card switched |
| `oncouponcodechanged` | `couponcodechange` event | Coupon code entered |
| `onpaymentauthorized` | `paymentResponse` from `request.show()` | Customer authenticated |
| `oncancel` | promise rejects with `AbortError` | Sheet dismissed |

### Coupon code (WWDC21)

```js
const session = new ApplePaySession(14, {
    // ...
    supportsCouponCode: true,
    couponCode: "SUMMER10"   // optional — pre-fills the field
});

session.oncouponcodechanged = (event) => {
    if (codeIsValid(event.couponCode)) {
        session.completeCouponCodeChange({
            newTotal: { label: "Example Shop", type: "final", amount: "84.99" },
            newLineItems: [...]
        });
    } else {
        session.completeCouponCodeChange({
            errors: [new ApplePayError("couponCodeInvalid")]
        });
    }
};
// newLineItems: replace with your refreshed line items array
```

### Pre-auth (redacted) vs post-auth (full) shipping contact

Same rule as native: pre-auth address has no street / phone / name. Use it for shipping option calculation. Full address arrives in `onpaymentauthorized` after the customer authenticates.

## Variants — Recurring / Automatic Reload / Deferred / Disbursement (MIG p.18, WWDC22)

Pass as `paymentRequestModifier` (Payment Request API) or as a sub-object on `ApplePayPaymentRequest` (Apple Pay JS):

| Scenario | Modifier | Use when |
|----------|----------|----------|
| Subscription at fixed interval | `recurringPaymentRequest` | Streaming, gym, club dues |
| Auto top-up at threshold | `automaticReloadPaymentRequest` | Stored balance / transit reload |
| Pay later at delivery | `deferredPaymentRequest` | Hotel, pre-order, car rental |
| Pay out *to* the user | Disbursement modifier (WWDC24) | Funds transfer from your platform |

Each variant carries a corresponding **summary item** type and a `tokenNotificationURL` for merchant-token lifecycle events (UNLINK / EXPIRED / etc.). Without `tokenNotificationURL` you can't be informed when a customer un-provisions a card from Wallet.

## Web Disbursements (WWDC24)

Disbursements existed in native (iOS 17, see `apple-pay.md`); WWDC24 extended them to the web via Payment Request API. Pattern:

```js
const methodData = [{
    supportedMethods: "https://apple.com/apple-pay",
    data: {
        version: 14,
        merchantIdentifier: "merchant.com.example",
        countryCode: "US",
        supportedNetworks,
        merchantCapabilities: ["supports3DS", "supportsInstantFundsOut"]
    }
}];
const details = {
    total: { label: "Example Cashout", amount: { currency: "USD", value: "200.00" } },
    additionalLineItems: [{
        type: "disbursement",
        label: "Withdrawal",
        amount: { currency: "USD", value: "200.00" }
    }]
};
const options = { requestShipping: false };  // disbursements don't ship
```

Discipline:

- **`requestShipping: false`** — disbursements have no shipping concept. Setting `true` confuses the sheet.
- **`supportsInstantFundsOut`** capability declares your processor supports the rail.
- **`additionalLineItems` with `type: "disbursement"`** declares the cashout amount.
- The flow ends with the funds appearing on the user's card linked in Wallet.

## Acceptable Use Guidelines

The web AUG governs *what* you can sell with Apple Pay on the web — independent of App Review (which doesn't apply on the web). Disabling Apple Pay on a website is at Apple's discretion and is enforced separately.

The full AUG cross-reference and prohibited-categories list lives in `apple-pay-vs-iap.md` § "Web — Acceptable Use Guidelines". Two AUG rules that hit web integrations specifically:

### Parity rule

> If any other payment method appears on a page, Apple Pay must appear with at-least-equal prominence on the same page.

Most common AUG violations: Apple Pay tucked under a "more options" disclosure, sized smaller than other buttons, or shown on the cart page but not the express checkout panel.

### Primary-option rule (when active card detected)

> If `applePayCapabilities()` returns `paymentCredentialsAvailable` (active card provisioned in Wallet), Apple Pay must be **pre-selected** as the primary payment option.

A neutral chooser ("which payment method?") with all options equal is a violation when an active card is detected.

## Third-Party Browser Scan-to-Pay (WWDC24)

iOS 18 enabled Apple Pay on Chrome / Edge / Firefox / Brave on iOS via QR-scan handoff to the user's iPhone Wallet. Requirements:

- **JavaScript SDK button** (the custom element) — CSS buttons don't render the QR flow
- **JS SDK 1.2.0+**
- **Standard Apple Pay JS or Payment Request API** integration on your server side — no special server logic for scan-to-pay

If you already use the SDK button at version 1.2.0+, you get scan-to-pay for free. The user sees a QR code in the third-party browser; their iPhone Wallet authenticates and returns the encrypted token over the existing flow.

## Testing (MIG p.22)

| Surface | Use |
|---------|-----|
| Apple Pay sandbox tester accounts | Sign-in flow same as native; sandbox FPANs work in Safari / Chrome / Edge / Firefox |
| `applepaydemo.apple.com` | **Use this.** Apple's interactive demo shows correct flow patterns. Treat it as a tool, not just a doc — it's the fastest way to verify your environment works end-to-end. |
| Curl test (MIG p.11) | Validates merchant identity cert + domain *before* you wire frontend |
| Real cards in production | Sandbox is for flow validation; only production proves end-to-end works |

## Anti-Patterns

| Anti-Pattern | Why it fails | Fix |
|--------------|--------------|-----|
| Calling `paymentSession` from the browser | Leaks merchant identity cert; rejected by Apple Pay servers and by App Review (where applicable) | Server-side only, two-way TLS |
| CSS-implemented button | Doesn't render on third-party browsers | Use SDK button (custom element) |
| Hardcoding the validation URL | Apple may route different domains differently | Always use `event.validationURL` |
| Inspecting / modifying the merchant session object | Opaque schema; modification breaks validation | Pass through verbatim |
| Domain behind CDN with redirect or proxy | Domain verification fails silently | Direct HTTPS access from Apple IPs |
| `apple-developer-merchantid-domain-association.txt` not at apex `/.well-known/` | File must be at top-level | Move file; re-verify |
| Using `canMakePaymentsWithActiveCard()` | Deprecated WWDC24 | Switch to `applePayCapabilities()` |
| Apple Pay below other payment methods | AUG parity violation | Promote to at-least-equal prominence |
| Apple Pay not pre-selected when active card detected | AUG primary-option violation | Pre-select when `paymentCredentialsAvailable` |
| Floating-point amounts | JS `Number` precision corruption | Decimal-precise strings throughout |
| Sandbox URL in production code | Validation succeeds in sandbox, transactions decline in production | Switch endpoints based on env |

## Domain-Verification Debug Checklist

If domain verification fails (the most common single web-integration blocker):

- [ ] File at exact path `/.well-known/apple-developer-merchantid-domain-association.txt` (not `/apple-developer-merchantid-domain-association.txt` at root)
- [ ] HTTPS endpoint reachable from Apple's published IP ranges (see `/applepayontheweb/setting-up-your-server`)
- [ ] No redirects (HTTP→HTTPS redirect at the apex is fine; redirects on the file path are not)
- [ ] No CDN that strips path or rewrites response
- [ ] Server returns the file with `Content-Type: text/plain` (or any non-HTML; some CDNs replace plaintext with HTML 404 pages)
- [ ] Apex domain matches the registered merchant domain exactly (no `www.` mismatch)
- [ ] File contents unmodified from Apple's download (don't edit, don't add a BOM, don't trim newlines)
- [ ] Domain verification re-run from Apple Developer portal after placing file

If verification passes but `onvalidatemerchant` still fails: check the curl command in MIG p.11 against your server's cert + domain pair. That isolates the problem to either the cert or the domain.

## Time-Pressure Triage Order (Production Down)

When merchant validation breaks in production with a deadline (launch day, active outage, CEO on the bridge), the sequence below isolates the failure surface in 30 seconds and prevents panic-driven mistakes that extend the outage. Run **in this order**, not in parallel:

| # | Action | Time | Why this order |
|---|--------|------|---------------|
| 1 | **MIG p.11 curl** against `apple-pay-gateway.apple.com` (production) or `apple-pay-gateway-cert.apple.com` (sandbox) using prod merchant identity cert + key + the EXACT `initiativeContext` your frontend sends | 30s | Tests cert + key + domain registration + outbound network + Apple-side health in one shot. Almost every other check is a subset of what this proves. |
| 2 | If curl returns session JSON but live flow still fails: cert is fine, `initiativeContext` mismatch is the next suspect — diff the curl `initiativeContext` against the actual `validationURL` event payload. www-vs-apex, port numbers, and trailing-dot variants all silently fail. | 1 min | Curl proving the cert pair works narrows the search to context. |
| 3 | If curl fails with TLS error: `openssl x509 -noout -dates` on the cert file, plus modulus-match against the key | 1 min | Distinguishes expiry from cert/key mismatch. |
| 4 | If curl fails connection-reset / hang: domain-association file at `/.well-known/`, then Apple IP allowlist on egress firewall | 5 min | Connection failure = DNS / network / `.well-known` issue, not cert issue. |

### Don't panic-do (named anti-actions during incidents)

| Anti-action | Why it's wrong |
|-------------|----------------|
| Re-issue the merchant identity cert before MIG p.11 curl confirms expiry | Re-issuance creates a new failure window; if cert wasn't the issue, you've made it worse |
| Bounce app servers as the first move | Server bounces don't fix upstream Apple-side or cert issues; they trade the outage for a cold-cache spike |
| Pre-emptively hide the button before running the 30s curl test | Curl test is faster than the deploy that would hide the button — diagnose first |
| Ship "Apple Pay temporarily unavailable" copy on the cart page | AUG governs prominence *when present*; absence is allowed during incidents. A status-message banner about a payment method down is itself an AUG signal Apple may flag — just remove the button conditionally |

### AUG mitigation rule (incident-only)

The Web AUG parity rule applies to button **presence**, not absence. If Apple Pay is broken in production, hide the button via feature flag — that satisfies AUG. Do **not** add disclosure text about Apple Pay being temporarily down; do **not** show a greyed-out button. Either Apple Pay is functional and prominent, or it's absent. Re-enable behind a canary once the curl test passes again.

## TLS / Cert Debug Checklist

- [ ] `ApplePay.crt.pem` includes only the certificate (no key bytes)
- [ ] `ApplePay.key.pem` is unencrypted (or your server is configured with the passphrase)
- [ ] Server presents both client cert + private key on outbound TLS to `apple-pay-gateway.apple.com`
- [ ] Cert hasn't expired (Merchant Identity Cert and Payment Processing Cert both expire — track separately)
- [ ] Cert matches the merchant ID in the request body (`merchantIdentifier`)
- [ ] `initiativeContext` matches a verified domain registered under the same merchant ID

## Pre-Production Checklist (MIG p.22)

- [ ] curl test against `apple-pay-gateway-cert.apple.com` succeeds (sandbox) and `apple-pay-gateway.apple.com` succeeds (production)
- [ ] Button renders on Safari (Mac, iOS, iPadOS, visionOS)
- [ ] Button renders on Chrome / Edge / Firefox via JS SDK 1.2.0+ (third-party browser scan-to-pay)
- [ ] Sandbox flow exercised end-to-end with sandbox tester + sandbox FPANs
- [ ] Production flow exercised with real cards on multiple devices
- [ ] `applePayCapabilities()` decision tree exercised: `paymentCredentialsAvailable` (primary), `paymentCredentialStatusUnknown` (visible), `paymentCredentialsUnavailable` (hidden)
- [ ] Error paths via `ApplePayError` exercised (shipping, contact, coupon)
- [ ] Recurring / automatic / deferred variants tested if applicable
- [ ] Disbursement flow tested if `supportsInstantFundsOut` is in your capabilities
- [ ] AUG parity verified across every page that shows a payment method
- [ ] Privacy statement linked from every page that initiates Apple Pay (App Store policy + AUG requirement)
- [ ] Cert renewal calendar entries set 30 days before each cert's expiry

## Resources

**MIG**: pp.10–11 (cert + domain + curl test), pp.12–14 (sheet + validation), pp.13–17 (request + events), pp.18–19 (variants + tokens), p.22 (testing), p.27 (web sequence diagram), p.28 (PSP-hosted sequence)

**WWDC**: 2020-10662 (button, automatic style), 2021-10092 (redesigned sheet, JS SDK button, coupon, shipping date ranges), 2022-10041 (multi-merchant, automatic-reload, order tracking), 2023-10114 (Apple Pay Later merchandising, deferred, disbursements), 2024-10108 (third-party browser, JS SDK 1.2.0, applePayCapabilities, web disbursements, MCC)

**Tech Talks**: 111381 (Get started with Apple Pay on the Web — operational walkthrough)

**Docs**: /applepayontheweb, /applepayontheweb/configuring-your-environment, /applepayontheweb/setting-up-your-server, /applepayontheweb/maintaining-your-environment, /applepayontheweb/apple-pay-js-api, /applepayontheweb/payment-request-api, /applepayontheweb/applepaysession, /applepayontheweb/providing-merchant-validation, /applepayontheweb/checking-for-apple-pay-availability, /apple-pay/acceptable-use-guidelines-for-websites

**Sample**: applepaydemo.apple.com (interactive)

**Skills**: apple-pay-web-ref (API surface), apple-pay (native counterpart for shared concepts), apple-pay-vs-iap (boundary), payments-diag (cert + domain failure modes), axiom-design/hig (button placement)
