# Wallet Extensions — Issuer Provisioning Reference

API surface for **issuer-side** Wallet extensions that let banks / card-issuer apps add provisionable cards to Apple Pay directly from within the Wallet app.

**This is not for merchant developers.** If you accept payments, see `apple-pay.md`. If you build a bank or card-issuer app, this is for you.

## Audience Boundary

Wallet Extensions are exclusively for apps that **issue payment cards** — banks, credit unions, card networks. They surface "Add Card" entry points inside Wallet itself, so customers don't have to launch the issuer app first.

If your app is anything else, this skill doesn't apply. Use:

- `apple-pay.md` — accepting payments (merchant)
- `wallet-passes.md` — issuing tickets / coupons / loyalty (non-payment Wallet artifacts)
- `tap-to-pay.md` — accepting contactless payments on iPhone

## Availability

iOS 14.0+, iPadOS 14.0+, Mac Catalyst 14.0+, visionOS 1.0+.

## Two Extensions Per Issuer App

| Extension | Class / Protocol | Role |
|-----------|------------------|------|
| Non-UI (NUI) | `PKIssuerProvisioningExtensionHandler` subclass | Reports status, lists provisionable passes, generates the `PKAddPaymentPassRequest`. No UI. |
| UI | `PKIssuerProvisioningExtensionAuthorizationProviding` (typically a `UIViewController`) | Re-authentication when NUI reports auth required. Uses the issuer app's credentials. |

Both ship as separate extension bundles inside the issuer app target. Wallet invokes them when the customer taps "Add a Card" in Wallet.

For full method signatures, parameter shapes, and result enums, see Apple's docs — the Resources section below points to the authoritative pages.

## Required Entitlements (Apple-Managed)

Wallet Extensions require **Apple-issued entitlements** — request via Apple Developer Support, not Xcode capabilities. The NUI and UI extensions need **separate entitlement keys**.

You **cannot test these extensions without the entitlement**. Apple reviews each request and grants on a case-by-case basis (typically restricted to verified card-issuing institutions). If you're stuck waiting on the entitlement, see `payments-diag.md` for the entitlement-stuck pattern — there's nothing to debug locally until Apple grants access.

## Sample Code

Apple ships an "Implementing Wallet Extensions" sample at `/passkit/implementing-wallet-extensions` — a four-target project (containing app, UI extension, NUI extension, tests). Use as a template.

The provisioning data model (`PKAddPaymentPassRequest` + nonce + certificate chain) is shared with **in-app provisioning** via `PKAddPaymentPassViewController`. If you've shipped in-app provisioning, the data model is identical; the extension just hosts the same flow inside Wallet's UI. See `apple-pay-ref.md` for the shared `PKAddPaymentPassRequest` shape.

## Resources

**Docs**: /passkit/pkissuerprovisioningextensionhandler, /passkit/pkissuerprovisioningextensionauthorizationproviding, /passkit/implementing-wallet-extensions, /passkit/pkaddpaymentpassrequest, /passkit/pkaddpaymentpassviewcontroller

**WWDC**: 2020-10662

**Skills**: apple-pay, apple-pay-ref, payments-diag
