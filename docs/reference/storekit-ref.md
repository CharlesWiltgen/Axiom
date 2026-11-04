---
name: storekit-ref
description: Complete StoreKit 2 API reference with Product, Transaction, subscriptions, and StoreKit Views
skill_type: reference
version: 1.0.0
apple_platforms: iOS 15+ (newest APIs need iOS 18.4, 26.4, or the 27 cycle)
---

# StoreKit 2 API Reference

Complete API reference for StoreKit 2 in-app purchases, from iOS 15 through the 27-cycle additions. Covers Product, Transaction, subscriptions, StoreKit Views, and the App Store Server APIs.

## When to Use This Reference

Use this reference when you need:
- Specific API signatures and parameters
- iOS 18.4 field additions (`appTransactionID`, `offer.period`, and more)
- Transaction lifecycle and verification details
- Subscription status and renewal info structures
- StoreKit Views configuration options
- Monthly billing plans with a 12-month commitment, subscription bundles, or group and volume selling
- Server API endpoints and payloads

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "What are all the fields on `Transaction` and what do they mean?"
- "How do I check if a subscription is in grace period?"
- "What's the difference between `RenewalInfo` and `SubscriptionStatus`?"
- "How do I customize `ProductView` appearance?"
- "What fields are new in iOS 18.4 for StoreKit?"
- "How do I offer a monthly plan with a 12-month commitment?"
- "What are subscription bundles, and what does `AppTransaction.all` return?"

## What's Covered

### Product API
- `Product.products(for:)` loading and missing-product detection
- `purchase(confirmIn:)` and the SwiftUI `purchase` environment action
- `Product.PurchaseResult` handling
- `Product.SubscriptionInfo` – period, introductory and promotional offers
- Purchase options: `appAccountToken`, `promotionalOffer(_:compactJWS:)`, `introductoryOfferEligibility(compactJWS:)`, `billingPlanType`, `quantity`

### Transaction API
- Transaction structure and all fields
- `Transaction.updates` listener and its sources
- `Transaction.currentEntitlements` and `currentEntitlements(for:)` (replaces the deprecated `currentEntitlement(for:)`)
- `Transaction.all` history
- `Transaction.finish()` timing
- `VerificationResult` and JWS verification

### AppTransaction
- `AppTransaction.shared`, `appTransactionID`, `originalPlatform`
- App-version checks and paid-to-free business model migration

### Subscription APIs
- `RenewalInfo` for upcoming renewals, expiration reasons and price-increase consent
- `SubscriptionStatus` for current state, including `status(transactionID:)` and `Status.all`
- Grace period detection
- Offer types (introductory, promotional, offer code, win-back), plus retention offers (`offerType` 5, with a client `OfferType.retention` value from the Xcode 27.3 SDK)
- Monthly subscriptions with a 12-month commitment (`PricingTerms`, billing plans, from 26.4)
- Multi-seat subscriptions with per-seat and volume-tier pricing (`pricingModel`, the `seats(_:)` purchase option, invitation and data-sharing sheets, from 27.3)

### StoreKit Views
- `ProductView` and `StoreView` (iOS 17+)
- `SubscriptionStoreView` and its control styles (iOS 17+)
- `SubscriptionOfferView` (iOS and visionOS 26+), visible relationships and detail actions
- Offer modifiers such as `subscriptionPromotionalOffer` and `preferredSubscriptionOffer`
- `subscriptionStatusTask` modifier (iOS 17+)

### Offer Codes
- Redemption for every product type (iOS 18.2+)
- `offerCodeRedemption` and `presentOfferCodeRedeemSheet`
- The `.oneTime` payment mode

### Product Types
- Consumable (coins, hints)
- Non-consumable (premium features)
- Auto-renewable subscriptions
- Non-renewing subscriptions
- Subscription bundles and suites (`.subscriptionBundle`, `.subscriptionSuite`, 27 cycle)

### 27-Cycle Additions (WWDC 2026)
- Advanced Commerce: `Product.SubscriptionInfo.bundledSubscriptions`, bundle transaction fields, `Partner`
- `AppTransaction.all` (AppTransactions sequence) and `AppTransaction.storeType`
- Offer code redemption rework (`RedeemOption`, transaction-returning redeem sheets)
- New error cases: `RefundRequestError.ineligible`, `StoreKitError.invalidPresentationContext`
- Group and volume subscription purchasing (StoreKit 2 required)

### iOS 18.4 Enhancements
- `appTransactionID` on `Transaction`, `AppTransaction` and `RenewalInfo`
- `offer.period` for subscription offers
- `appAccountToken` and `advancedCommerceInfo` on renewal info
- `currentEntitlements(for:)`, `Transaction.all(for:)` and `status(transactionID:)`

### App Store Server Library and APIs
- Promotional offer signatures (`PromotionalOfferV2SignatureCreator`)
- Set App Account Token and Get App Transaction Info endpoints
- Send Consumption Information V2 (prorated refunds)
- Refund notifications (`revocationType`, `revocationPercentage`)
- Retention Messaging API (real-time messages, `offerType` 5)
- Group management endpoints

### Edge Cases, Testing and Migration
- Family Sharing, refunds, the Advanced Commerce API, win-back offers
- StoreKit configuration files, the Transaction Manager and sandbox testing
- Migrating from StoreKit 1

## Key Pattern

### Transaction Fields and Verification

```swift
// Key Transaction fields
transaction.id                // Unique transaction ID
transaction.originalID        // Consistent across renewals
transaction.productID         // "com.app.pro_monthly"
transaction.purchaseDate
transaction.expirationDate    // Subscriptions
transaction.revocationDate    // Set when refunded
transaction.isUpgraded        // Upgraded to a higher tier
transaction.offer?.type       // .introductory, .promotional, .code, .winBack
transaction.appTransactionID  // iOS 18.4+

// Verification
switch result {
case .verified(let transaction):
    await grantEntitlement(for: transaction)
    await transaction.finish()
case .unverified(let transaction, let error):
    print("Unverified: \(error)")      // Never grant the entitlement
    await transaction.finish()         // Still finish, to clear the queue
}
```

### Subscription Status Check

```swift
let statuses = try await Product.SubscriptionInfo.status(for: groupID)
for status in statuses {
    switch status.state {
    case .subscribed, .inGracePeriod, .inBillingRetryPeriod:
        grantAccess()      // Grace period and billing retry keep access
    case .expired, .revoked:
        revokeAccess()     // Expired: offer resubscribe or win-back
    default:
        break
    }
}
```

## Documentation Scope

This page documents the `storekit-ref` skill (in the `axiom-integration` suite), the complete API coverage your assistant uses when you need specific StoreKit 2 details. For the testing-first implementation workflow and purchase architecture, see [in-app-purchases](/skills/integration/in-app-purchases).

## Related

- [iap-auditor](/agents/iap-auditor) – scans existing IAP code for missing listeners, unfinished transactions and verification gaps
- [iap-implementation](/agents/iap-implementation) – adds StoreKit 2 purchases to a project from scratch
- [app-store-ref](/reference/app-store-ref) – App Store Connect setup for retention messaging and group or volume pricing
- [apple-pay-vs-iap](/skills/integration/apple-pay-vs-iap) – whether a purchase belongs on StoreKit or Apple Pay

## Resources

**WWDC**: 2026-210, 2026-391, 2025-241, 2025-249, 2023-10013, 2021-10114

**Docs**: /storekit, /storekit/product, /storekit/transaction, /storekit/product/subscriptioninfo/pricingterms, /storekit/apptransaction/all
