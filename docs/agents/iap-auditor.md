# iap-auditor

Automatically audits existing IAP code to detect missing transaction.finish() calls, weak receipt validation, missing restore functionality, subscription status tracking issues, and StoreKit testing configuration gaps.

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

## What It Checks

1. **Transaction Finishing** (CRITICAL) — Missing transaction.finish() calls, stuck transactions
2. **Transaction Verification** (CRITICAL) — Not checking VerificationResult, security risks
3. **Transaction Listener** (CRITICAL) — Missing Transaction.updates listener
4. **Restore Purchases** (CRITICAL) — No restore functionality (App Store requirement)
5. **Subscription Status** (HIGH) — Not tracking subscription state, grace period handling
6. **StoreKit Configuration** (HIGH) — Missing .storekit file for testing

## Model & Tools

- **Model**: haiku
- **Tools**: Glob, Grep, Read
- **Color**: green
- **Scan Time**: <1 second

## Related Skills

- **in-app-purchases** skill — Complete StoreKit 2 implementation guide
- **storekit-ref** reference — Comprehensive StoreKit 2 API reference
