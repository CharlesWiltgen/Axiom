---
name: audit-iap
description: Scan StoreKit code for unfinished transactions, weak receipt validation, missing restore, and subscription tracking gaps
---

# audit-iap

Scan existing in-app purchase code for the defects that cost revenue or trigger App Store rejections.

## What This Command Does

Launches the **iap-auditor** agent, which reviews StoreKit code you already have. It does not write new purchase code — for that, ask for an IAP implementation and the **iap-implementation** agent takes over.

## What It Checks

1. **Missing `transaction.finish()`** – unfinished transactions are redelivered forever, and the purchase never completes for the user
2. **Weak receipt validation** – trusting client-side state that can be spoofed
3. **Missing restore purchases** – an App Store review requirement for non-consumables and subscriptions
4. **Subscription status tracking** – renewals, expirations, and grace periods handled incompletely
5. **StoreKit testing gaps** – missing `.storekit` configuration, so purchase paths are never exercised before release

## Usage

```
/axiom:audit iap
```

## Related

- [iap-auditor](/agents/iap-auditor) – The agent that powers this command
- [iap-implementation](/agents/iap-implementation) – Writes new StoreKit 2 purchase code; this command reviews code that already exists
