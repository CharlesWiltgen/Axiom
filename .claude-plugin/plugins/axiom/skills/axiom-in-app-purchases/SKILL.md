---
name: axiom-in-app-purchases
description: Use when implementing in-app purchases, StoreKit 2, subscriptions, or transaction handling - testing-first workflow with .storekit configuration, StoreManager architecture, transaction verification, subscription management, and restore purchases for consumables, non-consumables, and auto-renewable subscriptions
license: MIT
metadata:
  version: "1.0"
---

# StoreKit 2 In-App Purchase Implementation

**Purpose**: Guide robust, testable in-app purchase implementation
**StoreKit Version**: StoreKit 2
**iOS Version**: iOS 15+ (iOS 18.4+ for latest features)
**Xcode**: Xcode 13+ (Xcode 16+ recommended)
**Context**: WWDC 2025-241, 2025-249, 2023-10013, 2021-10114

## When to Use This Skill

✅ **Use this skill when**:
- Implementing any in-app purchase functionality (new or existing)
- Adding consumable products (coins, hints, boosts)
- Adding non-consumable products (premium features, level packs)
- Adding auto-renewable subscriptions (monthly/annual plans)
- Debugging purchase failures, missing transactions, or restore issues
- Setting up StoreKit testing configuration
- Implementing subscription status tracking
- Adding promotional offers or introductory offers
- Server-side receipt validation
- Family Sharing support

❌ **Do NOT use this skill for**:
- StoreKit 1 (legacy API) - this skill focuses on StoreKit 2
- App Store Connect product configuration (separate documentation)
- Pricing strategy or business model decisions

---

## ⚠️ Already Wrote Code Before Creating .storekit Config?

If you wrote purchase code before creating `.storekit` configuration, you have three options:

### Option A: Delete and Start Over (Strongly Recommended)

Delete all IAP code and follow the testing-first workflow below. This reinforces correct habits and ensures you experience the full benefit of .storekit-first development.

**Why this is best**:
- Validates that you understand the workflow
- Catches product ID issues you might have missed
- Builds muscle memory for future IAP implementations
- Takes only 15-30 minutes for experienced developers

### Option B: Create .storekit Config Now (Acceptable with Caution)

Create the `.storekit` file now with your existing product IDs. Test everything works locally. Document in your PR that you tested in sandbox first.

**Trade-offs**:
- ✅ Keeps working code
- ✅ Adds local testing capability
- ❌ Misses product ID validation benefit
- ❌ Reinforces testing-after pattern
- ❌ Requires extra vigilance in code review

**If choosing this path**: Create .storekit immediately, verify locally, and commit a note explaining the approach.

### Option C: Skip .storekit Entirely (Not Recommended)

Commit without `.storekit` configuration, test only in sandbox.

**Why this is problematic**:
- Teammates can't test purchases locally
- No validation of product IDs before runtime
- Harder iteration (requires App Store Connect)
- Missing documentation of product structure

**Bottom line**: Choose Option A if possible, Option B if pragmatic, never Option C.

---

## Core Philosophy: Testing-First Workflow

> **Best Practice**: Create and test StoreKit configuration BEFORE writing production purchase code.

### Why .storekit-First Matters

The recommended workflow is to create `.storekit` configuration before writing any purchase code. This isn't arbitrary - it provides concrete benefits:

**Immediate product ID validation**:
- Typos caught in Xcode, not at runtime
- Product configuration visible in project
- No App Store Connect dependency for testing

**Faster iteration**:
- Test purchases in simulator instantly
- No network requests during development
- Accelerated subscription renewal for testing

**Team benefits**:
- Anyone can test purchase flows locally
- Product catalog documented in code
- Code review includes purchase testing

**Common objections addressed**:

❓ **"I already tested in sandbox"** - Sandbox testing is valuable but comes later. Local testing with .storekit is faster and enables true TDD.

❓ **"My code works"** - Working code is great! Adding .storekit makes it easier for teammates to verify and maintain.

❓ **"I've done this before"** - Experience is valuable. The .storekit-first workflow makes experienced developers even more productive.

❓ **"Time pressure"** - Creating .storekit takes 10-15 minutes. The time saved in iteration pays back immediately.

### The Recommended Workflow

```
StoreKit Config → Local Testing → Production Code → Unit Tests → Sandbox Testing
      ↓               ↓                ↓               ↓              ↓
   .storekit      Test purchases   StoreManager    Mock store    Integration test
```

**Why this order helps**:
1. **StoreKit Config First**: Defines products without App Store Connect dependency
2. **Local Testing**: Validates product IDs and purchase flows immediately
3. **Production Code**: Implements against validated product configuration
4. **Unit Tests**: Verifies business logic with mocked store responses
5. **Sandbox Testing**: Final validation in App Store environment

**Benefits of following this workflow**:
- Product IDs validated before writing code
- Faster development iteration
- Easier team collaboration
- Better test coverage

---

## Mandatory Checklist

Before marking IAP implementation complete, **ALL** items must be verified:

### Phase 1: Testing Foundation
- [ ] Created `.storekit` configuration file with all products
- [ ] Verified each product type renders correctly in StoreKit preview
- [ ] Tested successful purchase flow for each product in Xcode
- [ ] Tested purchase failure scenarios (insufficient funds, cancelled)
- [ ] Tested restore purchases flow
- [ ] For subscriptions: tested renewal, expiration, and upgrade/downgrade

### Phase 2: Architecture
- [ ] Centralized StoreManager class exists (single source of truth)
- [ ] StoreManager is ObservableObject (SwiftUI) or uses NotificationCenter
- [ ] Transaction observer listens for updates via `Transaction.updates`
- [ ] All transaction verification uses `VerificationResult`
- [ ] All transactions call `.finish()` after entitlement granted
- [ ] Product loading happens at app launch or before displaying store

### Phase 3: Purchase Flow
- [ ] Purchase uses new `purchase(confirmIn:options:)` with UI context (iOS 18.2+)
- [ ] Purchase handles all `PurchaseResult` cases (success, userCancelled, pending)
- [ ] Purchase verifies transaction signature before granting entitlement
- [ ] Purchase stores transaction receipt/identifier for support
- [ ] appAccountToken set for all purchases (if using server backend)

### Phase 4: Subscription Management (if applicable)
- [ ] Subscription status tracked via `Product.SubscriptionInfo.Status`
- [ ] Current entitlements checked via `Transaction.currentEntitlements(for:)`
- [ ] Renewal info accessed for expiration, renewal date, offer status
- [ ] Subscription views use ProductView or SubscriptionStoreView
- [ ] Win-back offers implemented for expired subscriptions
- [ ] Grace period and billing retry states handled

### Phase 5: Restore & Sync
- [ ] Restore purchases implemented (required by App Store Review)
- [ ] Restore uses `Transaction.currentEntitlements` or `Transaction.all`
- [ ] Family Sharing transactions identified (if supported)
- [ ] Server sync implemented (if using backend)
- [ ] Cross-device entitlement sync tested

### Phase 6: Error Handling
- [ ] Network errors handled gracefully (retries, user messaging)
- [ ] Invalid product IDs detected and logged
- [ ] Purchase failures show user-friendly error messages
- [ ] Transaction verification failures logged and reported
- [ ] Refund notifications handled (via App Store Server Notifications)

### Phase 7: Testing & Validation
- [ ] Unit tests verify purchase logic with mocked Product/Transaction
- [ ] Unit tests verify subscription status determination
- [ ] Integration tests with StoreKit configuration pass
- [ ] Sandbox testing with real Apple ID completed
- [ ] TestFlight testing completed before production release

---

## Step 1: Create StoreKit Configuration (FIRST!)

**DO THIS BEFORE WRITING ANY PURCHASE CODE.**

### Create Configuration File

1. **Xcode → File → New → File → StoreKit Configuration File**
2. **Save as**: `Products.storekit` (or your app name)
3. **Add to target**: ✅ (include in app bundle for testing)

### Add Products

Click "+" and add each product type:

#### Consumable
```
Product ID: com.yourapp.coins_100
Reference Name: 100 Coins
Price: $0.99
```

#### Non-Consumable
```
Product ID: com.yourapp.premium
Reference Name: Premium Upgrade
Price: $4.99
```

#### Auto-Renewable Subscription
```
Product ID: com.yourapp.pro_monthly
Reference Name: Pro Monthly
Price: $9.99/month
Subscription Group ID: pro_tier
```

### Test Immediately

1. **Run app in simulator**
2. **Scheme → Edit Scheme → Run → Options**
3. **StoreKit Configuration**: Select `Products.storekit`
4. **Verify**: Products load, purchases complete, transactions appear

---

## Step 2: Implement StoreManager Architecture

### Required Pattern: Centralized StoreManager

**All purchase logic must go through a single StoreManager.** No scattered `Product.purchase()` calls throughout app.

```swift
import StoreKit

@MainActor
final class StoreManager: ObservableObject {
    // Published state for UI
    @Published private(set) var products: [Product] = []
    @Published private(set) var purchasedProductIDs: Set<String> = []

    // Product IDs from StoreKit configuration
    private let productIDs = [
        "com.yourapp.coins_100",
        "com.yourapp.premium",
        "com.yourapp.pro_monthly"
    ]

    private var transactionListener: Task<Void, Never>?

    init() {
        // Start transaction listener immediately
        transactionListener = listenForTransactions()

        Task {
            await loadProducts()
            await updatePurchasedProducts()
        }
    }

    deinit {
        transactionListener?.cancel()
    }
}
```

**Why @MainActor**: Published properties must update on main thread for UI binding.

### Load Products (At Launch)

```swift
extension StoreManager {
    func loadProducts() async {
        do {
            // Load products from App Store
            let loadedProducts = try await Product.products(for: productIDs)

            // Update published property on main thread
            self.products = loadedProducts

        } catch {
            print("Failed to load products: \(error)")
            // Show error to user
        }
    }
}
```

**Call from**: `App.init()` or first view's `.task` modifier

### Listen for Transactions (REQUIRED)

```swift
extension StoreManager {
    func listenForTransactions() -> Task<Void, Never> {
        Task.detached { [weak self] in
            // Listen for ALL transaction updates
            for await verificationResult in Transaction.updates {
                await self?.handleTransaction(verificationResult)
            }
        }
    }

    @MainActor
    private func handleTransaction(_ result: VerificationResult<Transaction>) async {
        // Verify transaction signature
        guard let transaction = try? result.payloadValue else {
            print("Transaction verification failed")
            return
        }

        // Grant entitlement to user
        await grantEntitlement(for: transaction)

        // CRITICAL: Always finish transaction
        await transaction.finish()

        // Update purchased products
        await updatePurchasedProducts()
    }
}
```

**Why detached**: Transaction listener runs independently of view lifecycle

---

## Step 3: Implement Purchase Flow

### Purchase with UI Context (iOS 18.2+)

```swift
extension StoreManager {
    func purchase(_ product: Product, confirmIn scene: UIWindowScene) async throws -> Bool {
        // Perform purchase with UI context for payment sheet
        let result = try await product.purchase(confirmIn: scene)

        switch result {
        case .success(let verificationResult):
            // Verify the transaction
            guard let transaction = try? verificationResult.payloadValue else {
                print("Transaction verification failed")
                return false
            }

            // Grant entitlement
            await grantEntitlement(for: transaction)

            // CRITICAL: Finish transaction
            await transaction.finish()

            // Update state
            await updatePurchasedProducts()

            return true

        case .userCancelled:
            // User tapped "Cancel" in payment sheet
            return false

        case .pending:
            // Purchase requires action (Ask to Buy, payment issue)
            // Will be delivered via Transaction.updates when approved
            return false

        @unknown default:
            return false
        }
    }
}
```

### SwiftUI Purchase (Using Environment)

```swift
struct ProductRow: View {
    let product: Product
    @Environment(\.purchase) private var purchase

    var body: some View {
        Button("Buy \(product.displayPrice)") {
            Task {
                do {
                    let result = try await purchase(product)
                    // Handle result
                } catch {
                    print("Purchase failed: \(error)")
                }
            }
        }
    }
}
```

### Set appAccountToken (If Using Backend)

```swift
func purchase(
    _ product: Product,
    confirmIn scene: UIWindowScene,
    accountToken: UUID
) async throws -> Bool {
    // Purchase with appAccountToken for server-side association
    let result = try await product.purchase(
        confirmIn: scene,
        options: [
            .appAccountToken(accountToken)
        ]
    )

    // ... handle result
}
```

**When to use**: When your backend needs to associate purchases with user accounts

---

## Step 4: Verify Transactions (MANDATORY)

### Always Use VerificationResult

```swift
func handleTransaction(_ result: VerificationResult<Transaction>) async {
    switch result {
    case .verified(let transaction):
        // ✅ Transaction signed by App Store
        await grantEntitlement(for: transaction)
        await transaction.finish()

    case .unverified(let transaction, let error):
        // ❌ Transaction signature invalid
        print("Unverified transaction: \(error)")
        // DO NOT grant entitlement
        // DO finish transaction to clear from queue
        await transaction.finish()
    }
}
```

**Why verify**: Prevents granting entitlements for:
- Fraudulent receipts
- Jailbroken device receipts
- Man-in-the-middle attacks

### Check Transaction Fields

```swift
func grantEntitlement(for transaction: Transaction) async {
    // Check transaction hasn't been revoked
    guard transaction.revocationDate == nil else {
        print("Transaction was refunded")
        await revokeEntitlement(for: transaction.productID)
        return
    }

    // Grant based on product type
    switch transaction.productType {
    case .consumable:
        await addConsumable(productID: transaction.productID)

    case .nonConsumable:
        await unlockFeature(productID: transaction.productID)

    case .autoRenewable:
        await activateSubscription(productID: transaction.productID)

    default:
        break
    }
}
```

---

## Step 5: Track Current Entitlements

### Check What User Owns

```swift
extension StoreManager {
    func updatePurchasedProducts() async {
        var purchased: Set<String> = []

        // Iterate through all current entitlements
        for await result in Transaction.currentEntitlements {
            guard let transaction = try? result.payloadValue else {
                continue
            }

            // Only include active entitlements (not revoked)
            if transaction.revocationDate == nil {
                purchased.insert(transaction.productID)
            }
        }

        self.purchasedProductIDs = purchased
    }
}
```

### Check Specific Product

```swift
func isEntitled(to productID: String) async -> Bool {
    // Check current entitlements for specific product
    for await result in Transaction.currentEntitlements(for: productID) {
        if let transaction = try? result.payloadValue,
           transaction.revocationDate == nil {
            return true
        }
    }

    return false
}
```

---

## Step 6: Implement Subscription Management

### Track Subscription Status

```swift
extension StoreManager {
    func checkSubscriptionStatus(for groupID: String) async -> Product.SubscriptionInfo.Status? {
        // Get subscription statuses for group
        guard let result = try? await Product.SubscriptionInfo.status(for: groupID),
              let status = result.first else {
            return nil
        }

        return status.state
    }
}
```

### Handle Subscription States

```swift
func updateSubscriptionUI(for status: Product.SubscriptionInfo.Status) {
    switch status.state {
    case .subscribed:
        // User has active subscription
        showSubscribedContent()

    case .expired:
        // Subscription expired - show win-back offer
        showResubscribeOffer()

    case .inGracePeriod:
        // Billing issue - show payment update prompt
        showUpdatePaymentPrompt()

    case .inBillingRetryPeriod:
        // Apple retrying payment - maintain access
        showBillingRetryMessage()

    case .revoked:
        // Family Sharing access removed
        removeAccess()

    @unknown default:
        break
    }
}
```

### Use StoreKit Views (iOS 17+)

```swift
struct SubscriptionView: View {
    var body: some View {
        SubscriptionStoreView(groupID: "pro_tier") {
            // Marketing content
            VStack {
                Image("premium-icon")
                Text("Unlock all features")
            }
        }
        .subscriptionStoreControlStyle(.prominentPicker)
    }
}
```

---

## Step 7: Implement Restore Purchases (REQUIRED)

### Restore Flow

```swift
extension StoreManager {
    func restorePurchases() async {
        // Sync all transactions from App Store
        try? await AppStore.sync()

        // Update current entitlements
        await updatePurchasedProducts()
    }
}
```

### UI Button

```swift
struct SettingsView: View {
    @StateObject private var store = StoreManager()

    var body: some View {
        Button("Restore Purchases") {
            Task {
                await store.restorePurchases()
            }
        }
    }
}
```

**App Store Requirement**: Apps with IAP must provide restore functionality for non-consumables and subscriptions.

---

## Step 8: Handle Refunds

### Listen for Refund Notifications

```swift
extension StoreManager {
    func listenForTransactions() -> Task<Void, Never> {
        Task.detached { [weak self] in
            for await verificationResult in Transaction.updates {
                await self?.handleTransaction(verificationResult)
            }
        }
    }

    @MainActor
    private func handleTransaction(_ result: VerificationResult<Transaction>) async {
        guard let transaction = try? result.payloadValue else {
            return
        }

        // Check if transaction was refunded
        if let revocationDate = transaction.revocationDate {
            print("Transaction refunded on \(revocationDate)")
            await revokeEntitlement(for: transaction.productID)
        } else {
            await grantEntitlement(for: transaction)
        }

        await transaction.finish()
    }
}
```

---

## Step 9: Unit Testing

### Mock Store Responses

```swift
protocol StoreProtocol {
    func products(for ids: [String]) async throws -> [Product]
    func purchase(_ product: Product) async throws -> PurchaseResult
}

// Production
final class StoreManager: StoreProtocol {
    func products(for ids: [String]) async throws -> [Product] {
        try await Product.products(for: ids)
    }
}

// Testing
final class MockStore: StoreProtocol {
    var mockProducts: [Product] = []
    var mockPurchaseResult: PurchaseResult?

    func products(for ids: [String]) async throws -> [Product] {
        mockProducts
    }

    func purchase(_ product: Product) async throws -> PurchaseResult {
        mockPurchaseResult ?? .userCancelled
    }
}
```

### Test Purchase Logic

```swift
@Test func testSuccessfulPurchase() async {
    let mockStore = MockStore()
    let manager = StoreManager(store: mockStore)

    // Given: Mock successful purchase
    mockStore.mockPurchaseResult = .success(.verified(mockTransaction))

    // When: Purchase product
    let result = await manager.purchase(mockProduct)

    // Then: Entitlement granted
    #expect(result == true)
    #expect(manager.purchasedProductIDs.contains("com.app.premium"))
}

@Test func testCancelledPurchase() async {
    let mockStore = MockStore()
    let manager = StoreManager(store: mockStore)

    // Given: User cancels
    mockStore.mockPurchaseResult = .userCancelled

    // When: Purchase product
    let result = await manager.purchase(mockProduct)

    // Then: No entitlement granted
    #expect(result == false)
    #expect(manager.purchasedProductIDs.isEmpty)
}
```

---

## Common Anti-Patterns (NEVER DO THIS)

### ❌ No StoreKit Configuration

```swift
// ❌ WRONG: Writing purchase code without .storekit file
let products = try await Product.products(for: productIDs)
// Can't test this without App Store Connect setup!
```

✅ **Correct**: Create `.storekit` file FIRST, test in Xcode, THEN implement.

### ❌ Code Before .storekit Config

```swift
// ❌ Less ideal: Write code, test in sandbox, add .storekit later
let products = try await Product.products(for: productIDs)
let result = try await product.purchase(confirmIn: scene)
// "I tested this in sandbox, it works! I'll add .storekit config later."
```

✅ **Recommended**: Create `.storekit` config first, then write code.

**If you're in this situation**: See "Already Wrote Code Before Creating .storekit Config?" section above for your options (A, B, or C).

**Why .storekit-first is better**:
- Product ID typos caught in Xcode, not at runtime
- Faster iteration without network requests
- Teammates can test locally
- Documents product structure in code

**Sandbox testing is valuable** - it validates against real App Store infrastructure. But starting with .storekit makes sandbox testing easier because you've already validated product IDs locally.

### ❌ Scattered Purchase Calls

```swift
// ❌ WRONG: Purchase calls scattered throughout app
Button("Buy") {
    try await product.purchase()  // In view 1
}

Button("Subscribe") {
    try await subscriptionProduct.purchase()  // In view 2
}
```

✅ **Correct**: All purchases through centralized StoreManager.

### ❌ Forgetting to Finish Transactions

```swift
// ❌ WRONG: Never calling finish()
func handleTransaction(_ transaction: Transaction) {
    grantEntitlement(for: transaction)
    // Missing: await transaction.finish()
}
```

✅ **Correct**: ALWAYS call `transaction.finish()` after granting entitlement.

### ❌ Not Verifying Transactions

```swift
// ❌ WRONG: Using unverified transaction
for await transaction in Transaction.all {
    grantEntitlement(for: transaction)  // Unsafe!
}
```

✅ **Correct**: Always check `VerificationResult` before granting.

### ❌ Ignoring Transaction Listener

```swift
// ❌ WRONG: Only handling purchases in purchase() method
func purchase() {
    let result = try await product.purchase()
    // What about pending purchases, family sharing, restore?
}
```

✅ **Correct**: Listen to `Transaction.updates` for ALL transaction sources.

### ❌ Not Implementing Restore

```swift
// ❌ WRONG: No restore button
// App Store will REJECT your app!
```

✅ **Correct**: Provide visible "Restore Purchases" button in settings.

---

## Validation

Before marking IAP implementation complete, verify:

### Code Inspection

Run these searches to verify compliance:

```bash
# Check StoreKit configuration exists
find . -name "*.storekit"

# Check transaction.finish() is called
rg "transaction\.finish\(\)" --type swift

# Check VerificationResult usage
rg "VerificationResult" --type swift

# Check Transaction.updates listener
rg "Transaction\.updates" --type swift

# Check restore implementation
rg "AppStore\.sync|Transaction\.all" --type swift
```

### Functional Testing

- [ ] Can purchase each product type in StoreKit configuration
- [ ] Can cancel purchase and state remains consistent
- [ ] Can restore purchases and regain access
- [ ] Subscription renewal/expiration works as expected
- [ ] Refunded transactions revoke access
- [ ] Family Sharing transactions identified (if supported)

### Sandbox Testing

- [ ] Real Apple ID sandbox purchases complete
- [ ] TestFlight beta testers confirm purchase flows work
- [ ] Server-side validation works (if using backend)

---

## Resources

**WWDC**: 2025-241, 2025-249, 2023-10013, 2021-10114

**Docs**: /storekit, /appstoreserverapi

**Skills**: axiom-storekit-ref
