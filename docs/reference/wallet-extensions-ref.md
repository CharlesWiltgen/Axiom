---
name: wallet-extensions-ref
description: Issuer-side Wallet Extensions for banks and card-issuer apps — PKIssuerProvisioningExtensionHandler (non-UI) and PKIssuerProvisioningExtensionAuthorizationProviding (UI), Apple-managed entitlements, sample-code pointer. Not for merchant developers
---

# Wallet Extensions Reference

API reference for **issuer-side** Wallet extensions that let banks and card-issuer apps add provisionable payment cards to Apple Pay directly from within the Wallet app. Customers tap "Add a Card" in Wallet and complete provisioning without launching the issuer app first.

**This is not for merchant developers.** If you accept payments, see [Apple Pay](/skills/integration/apple-pay). The audience for this reference is verified card-issuing institutions.

## When to Use This Reference

Use this reference when:
- Building a bank or card-issuer iOS app that surfaces provisionable cards inside Wallet
- Implementing `PKIssuerProvisioningExtensionHandler` (the non-UI extension) for status reporting, pass enumeration, and `PKAddPaymentPassRequest` generation
- Implementing `PKIssuerProvisioningExtensionAuthorizationProviding` (the UI extension) for re-authentication
- Requesting the Apple-managed entitlements for the NUI and UI extensions
- Reusing the `PKAddPaymentPassRequest` data model from an existing in-app provisioning flow (`PKAddPaymentPassViewController`)

## Example Prompts

Questions developers ask that this reference answers:

- "I'm implementing card provisioning for our bank's iOS app — where do I start?"
- "What's the difference between the NUI and UI Wallet extensions?"
- "How do I request the Wallet Extensions entitlement?"
- "Is the `PKAddPaymentPassRequest` data model the same as in-app provisioning?"
- "Does Apple ship sample code for Wallet Extensions?"

## What's Covered

- **Audience boundary** — Wallet Extensions are exclusive to apps that issue payment cards (banks, credit unions, card networks); not for merchant or non-issuer apps
- **Availability** — iOS 14.0+, iPadOS 14.0+, Mac Catalyst 14.0+, visionOS 1.0+
- **Two extensions per issuer app** — non-UI `PKIssuerProvisioningExtensionHandler` subclass (reports status, lists provisionable passes, generates `PKAddPaymentPassRequest`) and UI `PKIssuerProvisioningExtensionAuthorizationProviding` (typically a `UIViewController`) for re-authentication
- **Apple-managed entitlements** — separate keys for NUI and UI extensions, requested via Apple Developer Support (not Xcode capabilities), granted case-by-case to verified card issuers; cannot test without the entitlement
- **Sample code** — Apple's "Implementing Wallet Extensions" sample at `/passkit/implementing-wallet-extensions` (four-target project — containing app, UI extension, NUI extension, tests)
- **Shared data model** — `PKAddPaymentPassRequest` plus nonce plus certificate chain is identical to in-app provisioning via `PKAddPaymentPassViewController`; the extension hosts the same flow inside Wallet's UI

## Documentation Scope

This page documents the `wallet-extensions-ref` skill — the issuer provisioning surface for banks and card networks.

- For **merchant acceptance** (accepting payments rather than issuing cards), see [Apple Pay](/skills/integration/apple-pay)
- For **non-payment Wallet artifacts** (tickets, coupons, loyalty cards), see [Wallet Passes](/skills/integration/wallet-passes)
- For **contactless acceptance on iPhone**, see [Tap to Pay](/skills/integration/tap-to-pay)
- For **entitlement-stuck patterns** that apply to Wallet Extensions requests as well as Tap to Pay, see [Payments Diagnostics](/diagnostic/payments-diag)
