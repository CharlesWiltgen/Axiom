---
name: payments-diag
description: Cross-cutting failure modes across Apple Pay, Tap to Pay, Wallet passes, and Wallet orders — no-sheet, merchant validation, PSP rejection, entitlement stuck, pass-won't-import, App Review rejections, sandbox vs production
---

# Payments Diagnostics

Systematic troubleshooting for failure modes across the entire payments suite. The discipline skills cover *how* to do things right; this skill covers *what's wrong* when symptoms appear. Each branch maps a symptom to a root cause and points back at the discipline skill that fixes it.

## Symptoms This Diagnoses

Use when you're experiencing:
- No payment sheet appears, `canMakePayments()` returns false unexpectedly, or `present()`/`begin()` returns silently
- Web sheet appears but merchant validation fails — the most common single web-integration blocker after domain verification
- Sheet completes but PSP rejects authorization (decryption or production-key issues)
- Tap to Pay button greyed, `isSupported` returns false, or the entitlement request is stuck in "Submitted" status
- Tap to Pay never reaches `readyForTap`, or the first read after foreground hangs indefinitely
- `.pkpass` file won't import — Wallet shows nothing, "invalid pass," or silently fails
- Pass imports but APNs-pushed updates don't reach the device
- Apple Pay payment succeeded with `PKPaymentOrderDetails` set but the order never appears in Wallet
- Order added but subsequent fulfillment-status updates never arrive
- App Review rejection citing 3.1.1, 3.1.2, 3.1.3, 3.2.1(vi), 3.2.2(iv), 4.9, or Apple Pay AUG
- Sandbox transaction succeeds, production fails (or vice versa)

## Example Prompts

Questions developers ask that this diagnostic answers:

- "Why doesn't my Apple Pay button do anything?"
- "Domain verification keeps failing — what am I missing?"
- "My Tap to Pay entitlement has been Submitted for two weeks — what now?"
- "My `.pkpass` won't import — Wallet just silently does nothing."
- "Why doesn't my order appear in Wallet after the Apple Pay confirmation?"
- "App Review rejected my app for using IAP for restaurant delivery — what do I switch to?"
- "Why does my first tap after the app foregrounds hang?"
- "Sandbox transactions work but production declines — what's wrong?"

## Diagnostic Workflow

The skill organizes failure modes by symptom branch. Each branch covers the full surface and points at the discipline skill that prescribes the fix.

| Branch | Headline cause |
|--------|----------------|
| No payment sheet appears | Capability not enabled, profile stale, domain not verified, third-party browser using CSS button instead of JS SDK |
| Web merchant validation fails | Domain not verified, wrong cert type (Merchant Identity vs Payment Processing), cert expired, validation called from browser, session inspected/modified, sandbox vs production endpoint mismatch |
| PSP rejects post-auth | Wrong CSR uploaded for Payment Processing Cert, cert not activated after creation (the two-stage workflow's second stage skipped), production vs sandbox key mismatch, `applicationData` hash doesn't match |
| Tap to Pay entitlement stuck | Org vs individual account, distribution entitlement not re-requested, per-extension request missing, region mismatch; 7-business-day rule before opening an Apple Developer Support case |
| Tap to Pay never `readyForTap` | `prepare()` not called on foreground (95% of cases), PSP token expired, reader created but events stream never emits |
| Wallet pass won't import | Missing WWDR Intermediate cert (most common), wrong WWDR generation, manifest missing files, identifier mismatch, team mismatch, `.DS_Store` in bundle, expired cert, PEM/p12/DER format confusion, dates not ISO 8601 |
| Pass updates don't arrive | Malformed `webServiceURL`, token shorter than 16 chars, APNs cert confusion (use the Pass Type ID Cert, not a separate one), wrong push topic, updated pass not re-signed |
| Order won't add | Wrong cert (Order Type ID Cert vs Pass Type ID Cert vs Apple Pay Merchant Cert), order package not signed, `PKPaymentOrderDetails` set via init parameter, token too short, webServiceURL returns 4xx/5xx |
| Order updates don't arrive | Wrong APNs cert (use Order Type ID Cert), wrong push topic (= order type identifier), webServiceURL 4xx/5xx, updated package not re-signed |
| App Review rejection (payment-related) | Wrong rail (IAP for physical goods or Apple Pay for digital content), AUG parity violation, AUG primary-option violation, custom button mimicking Apple Pay branding, Tap to Pay label for non-payment actions, donations collected by non-approved app |
| Sandbox vs production | Sandbox transactions decline pre-fulfillment by design; production needs production keys plus activated certs |

The skill includes a **Quick-Reference Crisis Card** for production triage — the probability-weighted first checks for each symptom (e.g. "Tap to Pay first-tap hangs → 95% chance `prepare()` not called on foreground"), plus the curl-test-first incident-response sequence for web merchant validation.

## Related

- [Apple Pay](/skills/integration/apple-pay) — discipline for native flows; cert renewal staging, button vs mark, delegate response budget
- [Apple Pay Reference](/reference/apple-pay-ref) — PassKit API surface
- [Apple Pay on the Web](/skills/integration/apple-pay-web) — web discipline; the 30-second production-incident triage lives here
- [Apple Pay on the Web Reference](/reference/apple-pay-web-ref) — `ApplePaySession` and Payment Request API surface
- [Tap to Pay](/skills/integration/tap-to-pay) — entitlement workflow, PSP onboarding, prepare-on-foreground discipline
- [Tap to Pay Reference](/reference/tap-to-pay-ref) — `ProximityReader` API surface
- [Wallet Passes](/skills/integration/wallet-passes) — eight-step signing workflow plus the don't-roll-your-own recommendation
- [Wallet Passes Reference](/reference/wallet-passes-ref) — `pass.json` schema and `PKPassLibrary`
- [Wallet Orders](/skills/integration/wallet-orders) — Order Type ID Cert, three add-to-wallet paths, why subscriptions are not Orders
- [Wallet Extensions Reference](/reference/wallet-extensions-ref) — issuer-side provisioning; shares the entitlement-stuck pattern
- [Apple Pay vs IAP](/skills/integration/apple-pay-vs-iap) — root-cause skill for any rejection citing the rail boundary
- [App Store Diagnostics](/diagnostic/app-store-diag) — appeal workflow for payment-related rejections that require formal response
