---
name: wallet-orders
description: Orders in Wallet — post-purchase tracking via signed order packages, Order Type ID certificate, three add-to-wallet paths, status lifecycle, Maps and Messages integration, and why subscriptions must never be modeled as Orders
---

# Wallet Orders

Discipline-enforcing skill for surfacing post-purchase order tracking in Apple Wallet. Orders are signed structured packages with native Wallet UI, system notifications, lock-screen surfacing, and an Order-Tracking widget. They are not Passes, not Receipts, and not the same as your app's order-history screen — and they are not a place to put subscriptions, no matter how convenient the existing cert pipeline looks.

## When to Use

Use this skill when:
- Surfacing post-purchase fulfillment tracking after an Apple Pay checkout
- Implementing `PKPaymentOrderDetails` handoff from `PKPaymentAuthorizationResult`
- Adding `AddOrderToWalletButton` (FinanceKitUI, iOS 17+) for non-Apple-Pay purchases
- Setting up an Order Type ID, Order Type ID Certificate, and the order signing pipeline
- Wiring the five-endpoint web service for order registrations, updates, and pass-fetch
- Configuring APNs with the Order Type ID Certificate as topic
- Choosing the correct status lifecycle and `shippingType` for an order
- Pushing back on a proposal to use Wallet Orders for subscription renewal tracking

## Example Prompts

Real questions developers ask that this skill answers:

- "I want order tracking to appear in Wallet after Apple Pay checkout — how?"
- "How do I add an order from a non-Apple-Pay purchase?"
- "Can I use Wallet Orders to show subscription renewal dates?"
- "Why doesn't my order appear in Wallet after the Apple Pay confirmation?"
- "What's the difference between an Order Type ID Cert, a Pass Type ID Cert, and a Merchant Cert?"
- "How do I avoid duplicate notifications between my in-app push and the Wallet push?"
- "What status values should I send as the order moves through fulfillment?"

## What This Skill Provides

- **Order vs Pass vs Receipt** – the boundary table and the rule that Orders model bounded fulfillment lifecycles, not reusable artifacts
- **Four-criteria test** for when to use Orders versus a Pass or a simple in-app push
- **Setup** – Order Type ID creation, Order Type ID Certificate (separate from Pass Type ID Cert and Apple Pay Merchant Cert), five-endpoint server pattern, APNs with the Order Type ID Cert as topic
- **Three add-to-wallet paths** – Apple Pay handoff via `PKPaymentOrderDetails` (preferred), `AddOrderToWalletButton` for non-Apple-Pay purchases, email attachment with `application/vnd.apple.finance.order` MIME type
- **Order package structure** – required fields, signing chain (PKCS #7 detached plus WWDR plus S/MIME signing-time, same pattern as `.pkpass`)
- **Status lifecycle** – `orderPlaced`, `processing`, `readyForPickup`, `pickedUp`, `shipped`, `onTheWay`, `outForDelivery`, `delivered`, `issue`, `cancelled`; `shippingType` (iOS 17+) for shipping/delivery/pickup rendering
- **HIG discipline** – add orders with partial data; 300×300 solid-background line-item images; universal links for "Manage Order"; suppress in-app push when Wallet has the order
- **Maps integration** (iOS 17+) — real geo coordinates for pickup; the "time to leave for pickup" Siri Suggestion
- **Why subscriptions are not Orders** – the system-surface misuse cost (Order-Tracking widget, Messages share preview, Maps Siri Suggestions, Wallet grouping algorithm, App Review)
- **Canonical subscription-tracking surface** – StoreKit 2 `Product.SubscriptionInfo.Status`, ActivityKit for lock-screen countdowns, WidgetKit for renewal dates, App Store Server Notifications V2 — the pushback toolkit when someone proposes Wallet Orders for renewals

## Related

- [Apple Pay](/skills/integration/apple-pay) – the auth result from which `PKPaymentOrderDetails` is handed off
- [Wallet Passes](/skills/integration/wallet-passes) – sibling Wallet surface; shares the PKCS #7 signing chain mechanics
- [Wallet Passes Reference](/reference/wallet-passes-ref) – pass.json schema, image dimension table, web service endpoint schemas
- [Payments Diagnostics](/diagnostic/payments-diag) – order-won't-add and order-updates-don't-arrive failure modes
- [In-App Purchases](/skills/integration/in-app-purchases) – StoreKit 2 patterns that are the correct surface for subscription tracking
