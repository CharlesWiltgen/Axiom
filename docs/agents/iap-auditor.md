# iap-auditor

Automatically audits in-app purchase code to find both known anti-patterns and missing/incomplete patterns that cause revenue loss, App Store rejections, and customer support load.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you review my in-app purchase implementation?"
- "I'm having issues with subscription renewals"
- "Audit my StoreKit 2 code"
- "Check if I'm handling transactions correctly"
- "My restore purchases isn't working properly"

**Explicit command:**
```bash
/axiom:audit-iap
```

## What It Does

Maps your IAP architecture (StoreKit version, product types, centralization pattern, transaction lifecycle coverage), then detects and reasons about:

### Critical (Revenue or Rejection Risk)
- **Missing transaction.finish()** — Transactions stuck in queue, re-delivered every launch
- **Missing VerificationResult checks** — Fraudulent receipts granted entitlements
- **Missing Transaction.updates listener** — Renewals, Family Sharing, offer codes silently lost
- **Missing restore functionality** — Guideline 3.1.1 rejection; users can't recover purchases
- **Missing subscription terms display** — Guideline 3.1.2(a) rejection
- **Missing loot box odds disclosure** — Guideline 3.1.1 rejection

### High (Subscriber UX and Store Policy)
- **Partial subscription state coverage** — Billing retry and grace period users lose access
- **Subscription status read but not observed mid-session** — One-shot read at launch misses mid-session expiry / renewal; users see stale Pro state until relaunch
- **Missing promoted-purchase handler (StoreKit 1)** — Class adopts `SKPaymentTransactionObserver` without `paymentQueue(_:shouldAddStorePayment:)`; promoted IAPs from the App Store product page silently fail
- **Missing intro offer eligibility check** — Ineligible users charged full price after seeing intro pricing
- **Missing appAccountToken** — Server cannot tie transactions to user accounts
- **Missing StoreKit configuration file** — No local testing; every change requires App Store Connect round-trip
- **Hardcoded prices** — Wrong currency shown to international users

### Medium (Architecture and Coverage)
- **Scattered purchase calls** — No centralized StoreManager; duplicated verification logic
- **Missing offer code / promotional offer handling** — Marketing campaigns fail silently
- **Missing Family Sharing handling** — Shared entitlements granted or blocked incorrectly
- **Missing refund handling** — Revoked entitlements remain active
- **Missing IAP tests** — Regressions reach production
- **Generic error messaging** — Users can't self-resolve (parental controls, region mismatch)
- **Missing export compliance declaration** — Submission blocked pending review

### Compound Findings
Findings that intersect carry elevated severity — e.g., missing `finish()` + missing `Transaction.updates` listener means the transaction queue fills permanently; missing verification + no server-side validation means full client-side entitlement bypass.

### Health Score
Overall IAP health: **READY / NEEDS WORK / NOT READY** based on rejection-risk patterns, revenue-risk patterns, subscription state coverage, server validation presence, and test coverage.

## Related

- **in-app-purchases** skill — Complete StoreKit 2 implementation guide
- **storekit-ref** reference — Comprehensive StoreKit 2 API reference
- **iap-implementation** agent — Use to implement full IAP flow when starting fresh
- **security-privacy-scanner** agent — Use for adjacent receipt-validation security concerns
