# iap-implementation

Implements complete StoreKit 2 IAP solution following testing-first workflow with StoreKit configuration, centralized StoreManager, transaction handling, subscription management, and restore purchases.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Implement in-app purchases for my app"
- "Add subscription support with monthly and annual plans"
- "Set up StoreKit 2 for consumable purchases"
- "Add premium upgrade to my app"
- "Implement restore purchases"

**Explicit command:**
```bash
/axiom:implement-iap
```

## What It Implements

1. **StoreKit Configuration** — .storekit file for local testing
2. **StoreManager** — Centralized purchase management
3. **Transaction Listener** — Handles renewals, Family Sharing, offer codes
4. **Transaction Verification** — Secure verification against fraud
5. **Purchase Flows** — Buy, restore, subscription management
6. **Unit Tests** — Comprehensive test coverage
7. **Testing Instructions** — How to test before App Store submission

## Implementation Phases

### Phase 1: Requirements Gathering
- Product types (consumable, non-consumable, subscription)
- Product IDs
- Server backend integration needs
- Subscription details (tiers, free trials, etc.)

### Phase 2: StoreKit Configuration
- Create .storekit file with product definitions
- Configure pricing and subscription groups
- Set up for local testing

### Phase 3: Core Implementation
- StoreManager singleton with purchase logic
- Transaction listener for background updates
- Verification and entitlement granting
- Restore purchases functionality

### Phase 4: Testing & Verification
- Unit tests for purchase flows
- Manual testing instructions
- Edge case validation

## Model & Tools

- **Model**: sonnet
- **Tools**: Glob, Grep, Read, Write, Edit, Bash
- **Color**: blue
- **Implementation Time**: 10-15 minutes

## Related Skills

- **in-app-purchases** skill — Complete StoreKit 2 implementation guide
- **storekit-ref** reference — Comprehensive StoreKit 2 API reference
- **iap-auditor** agent — Audit existing IAP implementations
