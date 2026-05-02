# Orders in Wallet — Post-Purchase Tracking

**You MUST use this skill when surfacing post-purchase order tracking in Wallet.** Orders are *not* Passes, *not* Receipts, and *not* the same as your app's order-history screen — they're signed structured packages with native Wallet UI, system notifications, and lock-screen surfacing. For Wallet passes (boarding / event ticket / loyalty), see `wallet-passes.md`. For the Apple Pay handoff that triggers an order add, see `apple-pay.md`.

## Distinguish: Orders vs Passes vs Receipts

| Surface | When to use | Schema |
|---------|-------------|--------|
| **Orders in Wallet** | Post-purchase fulfillment tracking — physical goods or services with a state lifecycle (placed → shipped → delivered) | Signed order package + Order Type ID Cert |
| **Wallet Passes** | Reusable artifacts the customer carries — tickets, coupons, loyalty cards, store cards | `.pkpass` + Pass Type ID Cert |
| **Receipts (PassKit)** | Per-transaction proof attached to an order or transaction | PDF / image attached to an order package (iOS 17+) |
| **Your app's order history** | App-internal browsing experience | Whatever you store; not a Wallet surface |

The boundaries are: **Order = "what's happening to my purchase"**, **Pass = "what I show to use a thing"**, **Receipt = "proof of a transaction"**. An e-commerce purchase typically generates an Order (in Wallet) and may also include receipt PDFs. An event purchase generates a Pass (the ticket) and optionally an Order (for shipping the printed ticket / merchandise).

## When to Use Orders

Use Wallet Orders when **all four** are true:

1. Customer made a purchase you can attribute (typically post-Apple-Pay)
2. Fulfillment has a meaningful state lifecycle (more than just "completed")
3. You want native Wallet tracking, system notifications, and lock-screen surfacing — not just an app push
4. You can sign and host the order package on your servers

If any of these is false, use a Pass (for ticketing) or just send an in-app push (for trivial fulfillment without state changes).

## Setup

| Step | What |
|------|------|
| 1. **Create an Order Type ID** | Apple Developer portal → Identifiers → Order Type IDs → +. Reverse-DNS form: `order.com.example.shop`. Order Type IDs are independent from Pass Type IDs and Apple Pay merchant IDs. |
| 2. **Generate Order Type ID Certificate** | Same flow as Pass Type ID Cert: CSR → upload → download. Used to **sign the order package**. |
| 3. **Configure server endpoints** | Same five-endpoint pattern as Wallet pass updates (registrations, GET passes, log) — substitute `order` for `pass`. |
| 4. **Configure APNs** | Order Type ID Certificate doubles as the APNs cert. Topic = order type identifier. |

**Order Type ID Certificate ≠ Pass Type ID Certificate ≠ Apple Pay Merchant Cert.** Three separate certs for three separate Wallet surfaces. Mixing them up is a common Phase-6 integration bug.

## Three Paths to Add an Order to Wallet

### Path 1 — Apple Pay Handoff (preferred, WWDC22)

The cleanest path. After a successful Apple Pay payment, attach `PKPaymentOrderDetails` to the auth result. Wallet async-pulls the order package from your server.

```swift
let orderDetails = PKPaymentOrderDetails(
    orderTypeIdentifier: "order.com.example.shop",
    orderIdentifier: "ORD-12345",
    webServiceURL: URL(string: "https://orders.example.com")!,
    authenticationToken: "shared-secret-for-this-order"
)
let result = PKPaymentAuthorizationResult(status: .success, errors: nil)
result.orderDetails = orderDetails    // property; not init parameter
completion(result)
```

This is the most common path because it ties order tracking to the Apple Pay confirmation moment — zero extra customer interaction.

### Path 2 — `AddOrderToWalletButton` (FinanceKitUI, iOS 17+)

For non-Apple-Pay purchases, or when you want an explicit add-to-wallet step:

```swift
import FinanceKitUI

AddOrderToWalletButton {
    // construct order URL or payload that points Wallet at your signed package
}
```

UIKit equivalent surfaces exist for non-SwiftUI hosts; check `/financekitui` for the current names. Use this path when:

- Customer paid with a non-Apple-Pay method but you still want Wallet tracking
- Purchase happened outside the app (web checkout) and the user opens the app to add the order
- You're displaying an existing order in your app's order-history view and want a direct add-to-Wallet shortcut

### Path 3 — Email Attachment

Send the signed order package as an email attachment with MIME type `application/vnd.apple.finance.order`. Customer taps → Wallet opens an Add sheet → order is added.

Useful for legacy / B2B flows where email is the canonical communication channel.

## Order Package Structure

A **signed order package** is the equivalent of a `.pkpass` for orders — a signed bundle with structured data:

| Field | Required | Purpose |
|-------|----------|---------|
| `orderTypeIdentifier` | Yes | Must match your Order Type ID Cert |
| `orderIdentifier` | Yes | Unique within the type |
| `authenticationToken` | Yes | Per-order shared secret (≥16 chars; same rule as pass tokens) |
| `webServiceURL` | Yes | HTTPS base for updates |
| `merchantData` | Yes | Business name, contact info, support links |
| `lineItems` | Yes | Array — each with image (300×300, solid background per HIG), name, price |
| `fulfillment` | Yes | Status, tracking number, carrier, estimated arrival |
| `payment` | Optional | Total + payment method display info |
| `receipts` | Optional (iOS 17+) | Per-transaction receipt attachments — PDF or image |

The package is signed by the **Order Type ID Certificate**, with the Apple WWDR Intermediate Certificate in `extracerts`, the same PKCS #7 detached + S/MIME signing-time pattern as Wallet passes (see `wallet-passes.md` § "Cert + Signing Workflow").

Use a server library if one exists for your stack. Roll-your-own signing for orders has the same gotchas as for passes (missing WWDR, wrong key format, stale manifest).

## Update Flow

Updates use the **same web-service + APNs push** model as Wallet passes:

```dot
digraph order_update {
    "Server: fulfillment state changes" [shape=ellipse];
    "Server: send APNs push to registered devices" [shape=box];
    "Wallet: receive push (empty payload OK)" [shape=box];
    "Wallet: GET /v1/devices/.../registrations" [shape=box];
    "Server: respond with changed orderIdentifiers" [shape=box];
    "Wallet: GET /v1/orders/{type}/{order}" [shape=box];
    "Server: return fresh signed order package" [shape=box];
    "Wallet: replace local order, surface notification" [shape=box];

    "Server: fulfillment state changes" -> "Server: send APNs push to registered devices";
    "Server: send APNs push to registered devices" -> "Wallet: receive push (empty payload OK)";
    "Wallet: receive push (empty payload OK)" -> "Wallet: GET /v1/devices/.../registrations";
    "Wallet: GET /v1/devices/.../registrations" -> "Server: respond with changed orderIdentifiers";
    "Server: respond with changed orderIdentifiers" -> "Wallet: GET /v1/orders/{type}/{order}";
    "Wallet: GET /v1/orders/{type}/{order}" -> "Server: return fresh signed order package";
    "Server: return fresh signed order package" -> "Wallet: replace local order, surface notification";
}
```

Wallet-side state is end-to-end encrypted via iCloud sync — your server sees only what it sends; Wallet's UI state isn't readable by you.

## Status Values

| Status | When |
|--------|------|
| `orderPlaced` | Initial state |
| `processing` | Merchant has the order; not yet shipped |
| `readyForPickup` | In-store pickup orders only — ready for the customer |
| `pickedUp` | Pickup order collected |
| `shipped` | Shipped (carrier / tracking unknown or not yet visible) |
| `onTheWay` | In transit with carrier — show tracking |
| `outForDelivery` | Last-mile dispatch |
| `delivered` | Final delivery confirmed |
| `issue` | Problem (delivery failure, refund pending, customer service contact required) |
| `cancelled` | Order cancelled |

### `shippingType` (iOS 17+)

Tells Wallet how to render the fulfillment surface:

| `shippingType` | Use |
|----------------|-----|
| `shipping` | Standard shipping with carrier tracking |
| `delivery` | Local / same-day delivery |
| `pickup` | Customer-pickup-at-location |

Set this consistently with the status values you'll send. A `shippingType: pickup` order using `outForDelivery` doesn't make sense.

## HIG Discipline

| Rule | Why |
|------|-----|
| **Add the order with partial data** if needed | Wallet displays the order even if shipping details aren't known yet — "Check back later for full details." Don't wait until you have everything. |
| **Per-line-item images: solid background, 300×300, no lifestyle photos** | Orders render at small sizes; lifestyle imagery doesn't scale |
| **Universal links for "Manage Order" buttons** | Open the app if installed; web fallback otherwise |
| **Provide multiple contact methods** | Phone, Messages for Business, email, website — different customers prefer different channels |
| **Avoid duplicate notifications** | If Wallet has the order, **disable your in-app push for the same status change**. Wallet shows the system notification; an additional in-app push is noise. Use the `associatedStoreIdentifiers` array on the order package for App Store linkage and suppress your own push when the order is in Wallet. |
| **Don't use Orders for things that aren't orders** | Subscription renewals → use the appropriate Wallet pass type. Orders are for bounded fulfillment lifecycles. |

## Sharing Orders via Messages (iOS 16.4+)

Built-in. Customer can long-press an order in Wallet → Share via Messages. Recipients see a rich preview. **No extra integration on your side** — the system handles it. The only thing to verify: your order package's `merchantData.contactInfo` should be complete, since Messages renders that in the share sheet.

## Order Tracking Widget (iOS 16.4+)

System-provided widget. Automatically picks up active orders from Wallet. Customer adds it to home screen. **No integration on your side** — the system populates it from Wallet's order list.

You don't ship a widget for this; Apple's widget is what customers see.

## Maps Integration (iOS 17+)

For pickup orders, Siri Suggestions surface time + location prompts via Maps:

- Set `pickupLocation` on the fulfillment data with a real `MKPlacemark` / lat-lng
- Set the pickup window (date range)
- The customer gets a "Time to leave for pickup" suggestion based on travel estimate

Don't fabricate the pickup location to a generic address — Siri Suggestions misroute users. Use the actual store's geo coordinates.

## FinanceKit / FinanceKitUI Note

This skill uses `FinanceKitUI` only for the **order-add helpers** (`AddOrderToWalletButton`). The broader **FinanceKit** (consumer banking surface — account aggregation, transaction queries) is **out of scope for axiom-payments** and would belong in a future banking-app suite. Don't conflate the two; the order-add buttons are a small, isolated FinanceKitUI affordance.

## Anti-Patterns

| Anti-Pattern | Why it fails | Fix |
|--------------|--------------|-----|
| Using Orders for subscription renewals | Subscriptions don't have an order-fulfillment lifecycle | Use the right Wallet pass type, or stick with IAP / Apple Pay confirmations |
| Signing order packages with the Apple Pay merchant cert | Wrong cert; Wallet rejects | Use Order Type ID Certificate |
| Signing order packages with the Pass Type ID cert | Different surface, different cert | Use Order Type ID Certificate |
| Sending Wallet-style change notifications when in-app push covers the same change | Customer gets duplicate notifications | Configure dedup; pick one channel for the same state change |
| Setting `PKPaymentAuthorizationResult.orderDetails` via init parameter | The orderDetails is a property, not an init arg | Set on the result after construction |
| Treating Orders like Passes | Different schema, different signing identity, different lifecycle | Read this skill plus `wallet-passes.md` to see the boundary |
| `authenticationToken` shorter than 16 chars | Same constraint as pass tokens | ≥16 chars (32+ recommended) |
| Lifestyle photos for line-item images | Don't scale at Wallet's display sizes | 300×300 solid-background product shots |
| Forgetting `shippingType` on iOS 17+ | Wallet renders generic UI; loses pickup-vs-delivery distinction | Always set `shippingType` for iOS 17+ targets |

## Pre-Launch Checklist

- [ ] Order Type ID created in Apple Developer portal
- [ ] Order Type ID Certificate generated, exported, deployed to signing server
- [ ] WWDR Intermediate Certificate available in signing pipeline
- [ ] Order package signing tested (PKCS #7 + S/MIME signing-time + WWDR)
- [ ] Five web-service endpoints implemented (registrations + GET orders + log)
- [ ] APNs configured with Order Type ID Cert as topic
- [ ] Notification dedup configured between in-app push and Wallet push
- [ ] All status values mapped from your fulfillment system
- [ ] `shippingType` set for iOS 17+ targets
- [ ] Per-line-item images at 300×300 with solid backgrounds
- [ ] Universal link for "Manage Order" tested (app fallback to web)
- [ ] Pickup orders include real geo coordinates for Maps integration
- [ ] Apple Pay handoff path tested (`PKPaymentOrderDetails`)
- [ ] FinanceKitUI `AddOrderToWalletButton` path tested if applicable
- [ ] Email-attachment path tested if applicable

## Resources

**Docs**: /walletorders, /walletorders/order, /walletorders/orderfulfillment, /financekit, /financekitui, /financekitui/addordertowalletbutton, /passkit/pkpaymentorderdetails

**WWDC**: 2022-10041, 2023-10114

**Tech Talks**: 110336

**HIG**: /design/human-interface-guidelines/wallet

**Skills**: wallet-passes, apple-pay, wallet-passes-ref, payments-diag, axiom-design/hig
