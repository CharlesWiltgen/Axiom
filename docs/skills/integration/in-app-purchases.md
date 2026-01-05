---
name: in-app-purchases
description: StoreKit 2 in-app purchase implementation with testing-first workflow
skill_type: discipline
version: 1.0
---

# StoreKit 2 In-App Purchases

StoreKit 2 implementation guide with testing-first workflow. Covers consumables, non-consumables, auto-renewable subscriptions, transaction verification, and restore purchases.

## When to Use This Skill

Use this skill when you're:
- Implementing any in-app purchase functionality
- Adding consumable products (coins, hints, boosts)
- Adding non-consumable products (premium features, level packs)
- Adding auto-renewable subscriptions
- Debugging purchase failures or missing transactions
- Setting up StoreKit testing configuration
- Implementing subscription status tracking
- Adding promotional or introductory offers
- Implementing restore purchases

**Core principle:** Create `.storekit` configuration BEFORE writing purchase code. This catches product ID typos in Xcode, enables simulator testing, and documents your product catalog.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I set up in-app purchases with StoreKit 2?"
- "My purchase completes but the content doesn't unlock."
- "How do I test subscriptions without waiting a month?"
- "User says they purchased but Transaction.currentEntitlements is empty."
- "How do I implement restore purchases?"
- "What's the difference between consumable and non-consumable?"
- "How do I handle subscription renewal and expiration?"

## What's Covered

### Testing-First Workflow
- Creating `.storekit` configuration file
- Product configuration (consumables, non-consumables, subscriptions)
- Simulator testing with accelerated time
- Why .storekit-first catches bugs early

### StoreManager Architecture
- Product loading with Product.products(for:)
- Purchase flow with Product.purchase()
- Transaction verification (StoreKit.VerificationResult)
- Transaction.finish() timing

### Transaction Handling
- Transaction.updates listener (background purchases)
- Transaction.currentEntitlements for restore
- Consumable vs durable transaction lifecycles
- Server-side verification patterns

### Subscription Management
- Product.SubscriptionInfo for subscription details
- Renewal state tracking
- Grace period handling
- Family Sharing support

### Common Issues
- Missing Transaction.finish() (purchase stuck)
- Not listening to Transaction.updates
- Product ID mismatches
- Sandbox vs production differences

## Key Pattern

### Basic Purchase Flow

```swift
@MainActor
class StoreManager: ObservableObject {
    @Published var products: [Product] = []

    func loadProducts() async {
        products = try? await Product.products(for: ["premium_monthly", "coins_100"])
    }

    func purchase(_ product: Product) async throws {
        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)
            await deliverContent(for: transaction)
            await transaction.finish()  // ✅ Always finish!

        case .userCancelled:
            break
        case .pending:
            // Awaiting parental approval, etc.
            break
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let safe):
            return safe
        case .unverified:
            throw PurchaseError.verification
        }
    }
}
```

### Transaction Listener (Required)

```swift
// Start at app launch — catches purchases made on other devices
func listenForTransactions() -> Task<Void, Never> {
    Task.detached {
        for await result in Transaction.updates {
            if let transaction = try? self.checkVerified(result) {
                await self.deliverContent(for: transaction)
                await transaction.finish()
            }
        }
    }
}
```

## Documentation Scope

This page documents the `axiom-in-app-purchases` skill—StoreKit 2 implementation patterns Claude uses when you're adding purchase functionality to your app.

**For comprehensive API reference:** See [storekit-ref](/reference/storekit-ref) for complete API coverage, edge cases, and server-side patterns.

**For subscription-specific patterns:** See [storekit-ref](/reference/storekit-ref) subscription section for renewal, upgrades, and family sharing.

## Related

- [storekit-ref](/reference/storekit-ref) — Complete StoreKit 2 API reference
- [iap-auditor](/agents/iap-auditor) — Automated scanning for IAP issues
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Async patterns for purchase flows

## Resources

**WWDC**: 2025-241, 2025-249, 2023-10013, 2021-10114

**Docs**: /storekit, /storekit/in-app-purchase, /storekit/product
