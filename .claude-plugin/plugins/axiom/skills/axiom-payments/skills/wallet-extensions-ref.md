# Wallet Extensions — Issuer Provisioning Reference

API surface for **issuer-side** Wallet extensions that let banks / card-issuer apps add provisionable cards to Apple Pay directly from within the Wallet app. **This is not for merchant developers.** If you accept payments, see `apple-pay.md`. If you build a bank or card-issuer app, this is for you.

## Availability

`PKIssuerProvisioningExtensionHandler` and the UI extension protocol — iOS 14.0+, iPadOS 14.0+, Mac Catalyst 14.0+, visionOS 1.0+. Xcode 15.0+ for the modern sample.

## Audience

Wallet Extensions are exclusively for apps that **issue payment cards** — banks, credit unions, card networks. The extensions surface "Add Card" entry points inside Wallet itself, so the customer doesn't have to launch the issuer app first.

If your app is a merchant payment app (accepts payments), or a wallet-pass-issuer (ticketing, loyalty, coupons), or a Tap to Pay terminal, **this skill doesn't apply**. Use:

- `apple-pay.md` for accepting payments
- `wallet-passes.md` for issuing tickets / coupons / loyalty
- `tap-to-pay.md` for accepting contactless on iPhone

## Architecture

Two extensions per issuer app:

| Extension | Class | Role |
|-----------|-------|------|
| **Non-UI extension** | Subclass of `PKIssuerProvisioningExtensionHandler` | Reports status, lists provisionable passes, performs card data lookup. No UI. |
| **UI extension** | Conforms to `PKIssuerProvisioningExtensionAuthorizationProviding` (typically a `UIViewController`) | Re-authentication when the non-UI extension reports `auth required`. Uses the same login credentials as the issuer app. |

Both extensions ship with the issuer app target as separate bundles. Wallet invokes them when the customer taps "Add a Card" in Wallet.

## `PKIssuerProvisioningExtensionHandler`

Non-UI extension subclass. Implement these abstract methods:

| Method | Returns | Purpose |
|--------|---------|---------|
| `status(completion:)` | `PKIssuerProvisioningExtensionStatus` | Quick status: are passes available? Is auth required? |
| `passEntries(completion:)` | `[PKIssuerProvisioningExtensionPassEntry]` | Cards available to provision (already issued to this user) |
| `remotePassEntries(completion:)` | `[PKIssuerProvisioningExtensionPassEntry]` | Same but for paired-device provisioning (e.g. Apple Watch from iPhone) |
| `generateAddPaymentPassRequestForPassEntryWithIdentifier(_:configuration:certificateChain:nonce:nonceSignature:completionHandler:)` | `PKAddPaymentPassRequest` | The actual provisioning request — wraps card data + nonce signature for the encrypted payload to Apple Pay. (`WithIdentifier` is part of the method name; first parameter is unlabeled.) |

`PKIssuerProvisioningExtensionStatus` carries:

- `requiresAuthentication: Bool`
- `passEntriesAvailable: Bool`
- `remotePassEntriesAvailable: Bool`

Returning `requiresAuthentication: true` is the signal that triggers Wallet to invoke your UI extension.

## `PKIssuerProvisioningExtensionAuthorizationProviding`

UI extension. Conforming view controller presents an authentication challenge using the issuer app's credentials.

| Member | Purpose |
|--------|---------|
| `var completionHandler: ((PKIssuerProvisioningExtensionAuthorizationResult) -> Void)?` | Wallet sets this; you call it when auth completes |
| (UIViewController lifecycle) | Standard view-controller lifecycle for the auth UI |

`PKIssuerProvisioningExtensionAuthorizationResult` cases:
- `.authorized`
- `.canceled`

Once you call `completionHandler(.authorized)`, Wallet returns to the non-UI flow with auth state cleared.

## Required Entitlements (Apple-Managed)

Wallet Extensions require Apple-issued entitlements — request via Apple Developer Support, not Xcode capabilities. Both the NUI and UI extensions need separate entitlement keys.

You **cannot** test these extensions without the entitlement; Apple reviews the request and grants on a case-by-case basis (typically restricted to verified card-issuing institutions).

## Sample Code

Apple ships an "Implementing Wallet Extensions" sample at `/passkit/implementing-wallet-extensions` — a four-target sample (containing app, UI extension, NUI extension, tests). Use as a template; the sample's container app stub is repurposable for the auth UI.

The provisioning request shape (`PKAddPaymentPassRequest` + nonce + certificate chain) overlaps with **in-app provisioning** from the issuer app proper — `PKAddPaymentPassViewController`. If you've shipped in-app provisioning before, the data model is the same; the extension just hosts the same flow inside Wallet's UI.

## Cross-References

- **`apple-pay.md`** — briefly references issuer extensions in the macOS / Catalyst context. Issuer extensions on Catalyst use the same headers as iOS but with Catalyst's window-presentation rules.
- **`wallet-passes.md`** — not related; Wallet Passes are for non-payment artifacts (tickets, coupons). Wallet Extensions are for payment cards.
- **`apple-pay-ref.md`** — `PKAddPaymentPassRequest`, `PKAddPaymentPassViewController` API shapes are reusable across in-app provisioning and extension provisioning.

## Resources

**Docs**: /passkit/pkissuerprovisioningextensionhandler, /passkit/pkissuerprovisioningextensionauthorizationproviding, /passkit/implementing-wallet-extensions, /passkit/pkaddpaymentpassrequest, /passkit/pkaddpaymentpassviewcontroller

**WWDC**: 2020-10662

**Skills**: apple-pay, apple-pay-ref, payments-diag
