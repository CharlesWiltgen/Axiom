---
name: storekit-ref
description: Complete StoreKit 2 API reference with Product, Transaction, subscriptions, and StoreKit Views
skill_type: reference
version: 1.0.0
apple_platforms: iOS 15+ (iOS 18.4+ for latest features)
---

# StoreKit 2 API Reference

Complete API reference for StoreKit 2 in-app purchases. Covers Product, Transaction, subscriptions, StoreKit Views, and App Store Server APIs.

## When to Use This Reference

Use this reference when you need:
- Specific API signatures and parameters
- iOS 18.4 field additions (appTransactionID, offerPeriod, etc.)
- Transaction lifecycle and verification details
- Subscription status and renewal info structures
- StoreKit Views configuration options
- Server API endpoints and payloads

**For implementation workflow:** See [in-app-purchases](/skills/integration/in-app-purchases) for testing-first patterns and architecture.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What are all the fields on Transaction and what do they mean?"
- "How do I check if a subscription is in grace period?"
- "What's the difference between RenewalInfo and SubscriptionStatus?"
- "How do I customize ProductView appearance?"
- "What fields are new in iOS 18.4 for StoreKit?"
- "How do I verify a transaction on my server?"

## What's Covered

### Product API
- Product.products(for:) loading
- Product.PurchaseResult handling
- Product.SubscriptionInfo for subscription details
- Purchase options (quantity, promotionalOffer)

### Transaction API
- Transaction structure and all fields
- Transaction.updates listener
- Transaction.currentEntitlements
- Transaction.finish() timing
- VerificationResult and JWS verification

### Subscription APIs
- RenewalInfo for upcoming renewals
- SubscriptionStatus for current state
- Grace period detection
- Offer types (introductory, promotional, win-back)

### StoreKit Views (iOS 17+)
- ProductView for single products
- SubscriptionStoreView for subscription groups
- Customization and styling options
- Integration with purchase flow

### Product Types
- Consumable (coins, hints)
- Non-consumable (premium features)
- Auto-renewable subscriptions
- Non-renewing subscriptions

### App Store Server APIs
- Server notifications (V2)
- Transaction history endpoint
- Subscription status endpoint
- Look up order ID

### iOS 18.4 Enhancements
- appTransactionID field
- offerPeriod for subscription offers
- Enhanced renewal info

## Key Pattern

### Transaction Structure

```swift
// Key Transaction fields
struct Transaction {
    let id: UInt64                        // Unique transaction ID
    let productID: String                 // Product identifier
    let purchaseDate: Date                // When purchased
    let expirationDate: Date?             // For subscriptions
    let revocationDate: Date?             // If refunded
    let isUpgraded: Bool                  // If upgraded to higher tier
    let offerType: OfferType?             // Trial, intro, promo, win-back
    let appTransactionID: String?         // iOS 18.4+ app-level ID
}

// Verification
switch result {
case .verified(let transaction):
    // Safe to use
case .unverified(let transaction, let error):
    // Verification failed
}
```

### Subscription Status Check

```swift
// Check subscription state
let statuses = try await Product.SubscriptionInfo.status(for: groupID)
for status in statuses {
    switch status.state {
    case .subscribed:
        // Active subscription
    case .expired:
        // Subscription ended
    case .inBillingRetryPeriod:
        // Payment failed, retrying
    case .inGracePeriod:
        // Payment failed, still granting access
    case .revoked:
        // Refunded
    }
}
```

## Documentation Scope

This page documents the `axiom-storekit-ref` reference skill—complete API coverage Claude uses when you need specific StoreKit 2 API details.

**For implementation patterns:** See [in-app-purchases](/skills/integration/in-app-purchases) for testing-first workflow and architecture patterns.

## Related

- [in-app-purchases](/skills/integration/in-app-purchases) — Implementation patterns and testing workflow
- [iap-auditor](/agents/iap-auditor) — Automated IAP code scanning

## Resources

**WWDC**: 2025-241, 2025-249, 2023-10013, 2021-10114

**Docs**: /storekit, /storekit/product, /storekit/transaction
