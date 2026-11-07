---
name: in-app-purchases
description: StoreKit 2 in-app purchase implementation with testing-first workflow
skill_type: discipline
version: 1.0
---

# StoreKit 2 In-App Purchases

A testing-first guide to implementing in-app purchases with StoreKit 2. Covers consumables, non-consumables, auto-renewable subscriptions, transaction verification, and restoring purchases.

## When to Use

Use this skill when you're:
- Implementing any in-app purchase functionality
- Adding consumable products (coins, hints, boosts)
- Adding non-consumable products (premium features, level packs)
- Adding auto-renewable subscriptions
- Debugging purchase failures, missing transactions, or restore issues
- Setting up a StoreKit testing configuration
- Tracking subscription status
- Adding promotional or introductory offers
- Implementing restore purchases

Selling physical goods or services, or taking donations? Those go through Apple Pay, not in-app purchase; see [apple-pay-vs-iap](/skills/integration/apple-pay-vs-iap).

**Core principle** Create the `.storekit` configuration file before you write purchase code. It catches product ID typos in Xcode, lets you test purchases in the simulator, and documents your product catalog.

## Example Prompts

Questions you can ask your assistant that will draw from this skill:

- "How do I set up in-app purchases with StoreKit 2?"
- "My purchase completes but the content doesn't unlock."
- "How do I test subscriptions without waiting a month?"
- "User says they purchased but Transaction.currentEntitlements is empty."
- "How do I implement restore purchases?"
- "What's the difference between consumable and non-consumable?"
- "How do I handle subscription renewal and expiration?"

## What This Skill Provides

### Testing-First Workflow
- Creating the `.storekit` configuration file
- Configuring consumables, non-consumables, and subscriptions
- Simulator testing with accelerated subscription renewal
- Why creating the `.storekit` file first catches bugs early
- Unit testing purchase logic against a mocked store

### StoreManager Architecture
- One centralized `StoreManager` instead of scattered purchase calls
- Loading products with `Product.products(for:)`
- The purchase flow with `Product.purchase()`, including the SwiftUI `purchase` environment action
- Transaction verification with `VerificationResult`
- When to call `Transaction.finish()`

### Transaction Handling
- The `Transaction.updates` listener (renewals, Ask to Buy approvals, purchases on other devices)
- `AppStore.sync()` and `Transaction.currentEntitlements` for restore
- How consumable and non-consumable transactions differ
- Refunds and revoked transactions
- `appAccountToken` and server-side validation

### Subscription Management
- `Product.SubscriptionInfo.Status` for subscription state
- Grace period and billing retry states
- `SubscriptionStoreView` for a system subscription screen
- Family Sharing support

### Common Mistakes
- Writing purchase code before the `.storekit` configuration
- Forgetting `Transaction.finish()`, which leaves the purchase stuck
- Not listening to `Transaction.updates`
- Granting content without verifying the transaction
- Shipping without a restore option

## Key Pattern

### Basic Purchase Flow

```swift
@MainActor
final class StoreManager: ObservableObject {
    @Published private(set) var products: [Product] = []
    private var transactionListener: Task<Void, Never>?

    init() {
        transactionListener = listenForTransactions()
    }

    func loadProducts() async {
        products = (try? await Product.products(for: ["premium_monthly", "coins_100"])) ?? []
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
            // Ask to Buy or a payment issue; the result arrives later via Transaction.updates
            break
        @unknown default:
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
extension StoreManager {
    // Start at app launch — catches purchases made on other devices
    func listenForTransactions() -> Task<Void, Never> {
        Task.detached { [weak self] in
            for await result in Transaction.updates {
                await self?.handleTransaction(result)
            }
        }
    }

    private func handleTransaction(_ result: VerificationResult<Transaction>) async {
        guard let transaction = try? checkVerified(result) else { return }
        await deliverContent(for: transaction)
        await transaction.finish()
    }
}
```

## Documentation Scope

This page documents the `in-app-purchases` skill (in the `axiom-integration` suite), which your assistant uses when you add purchases to your app.

## Related

- [storekit-ref](/reference/storekit-ref) – Complete StoreKit 2 API reference, including commitment billing plans, multi-seat subscriptions with per-seat pricing (iOS 27.3), and offer details
- [iap-auditor](/agents/iap-auditor) – Scans existing purchase code for missing `finish()` calls, verification, and restore
- [swift-concurrency](/skills/concurrency/swift-concurrency) – Async patterns for purchase flows

## Resources

**WWDC**: 2025-241, 2025-249, 2023-10013, 2021-10114

**Docs**: /storekit, /storekit/in-app-purchase, /storekit/product
