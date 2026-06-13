---
name: tap-to-pay-ref
description: ProximityReader API surface — PaymentCardReader, PaymentCardReaderSession, event cases, Store and Forward mode, MobileDocumentReader (Tap to Present ID) cross-reference, ProximityReaderDiscovery, threading model
---

# Tap to Pay Reference

API reference for the `ProximityReader` framework. Covers `PaymentCardReader`, `PaymentCardReaderSession`, the event stream, the deprecated update-handler signature, Store and Forward mode, and the brief `MobileDocumentReader` cross-reference for Tap to Present ID.

## When to Use This Reference

Use this reference when:
- Looking up `PaymentCardReader` initializers, instance methods, and the `events` async sequence
- Checking the static `PaymentCardReader.isSupported` semantics for capability gating
- Looking up `PaymentCardReader.Event` cases (`updateProgress`, `readyForTap`)
- Looking up `PaymentCardReaderSession` methods (`readPayment`, `readPaymentCard`, `refundPayment`, `readPass`, `cancel`)
- Migrating from the deprecated `prepare(using:updateHandler:)` to the async stream API
- Implementing Store and Forward mode for offline capture (PSP-dependent)
- Disambiguating `PaymentCardReader` from `MobileDocumentReader` (Tap to Present ID)
- Wiring `ProximityReaderDiscovery` as the merchant tutorial UI

## Example Prompts

Questions developers ask that this reference answers:

- "What are the cases of `PaymentCardReader.Event`?"
- "What's the modern replacement for `prepare(using:updateHandler:)`?"
- "Does `PaymentCardReader` conform to `Sendable`?"
- "How do I read an NFC loyalty pass without charging?"
- "What does `PaymentCardReader.fetchPaymentCardReaderStore()` do?"
- "What's `MobileDocumentReader`, and is it part of `axiom-payments`?"

## What's Covered

- **Framework availability** – iOS 15.4+, iPadOS 15.4+, Mac Catalyst 17.0+; cannot be used in iOS Simulator
- **`PaymentCardReader`** – `init(options:)`, `isSupported` (class property), `readerIdentifier`, `options`, `events` async sequence, `prepare(using:)`, `isAccountLinked(using:)`, `linkAccount(using:)`, `relinkAccount(using:)`, `fetchPaymentCardReaderStore()`, `prepareStoreAndForward()`
- **`PaymentCardReader.Options`** – opaque PSP-supplied configuration
- **`PaymentCardReader.Token`** – PSP-issued, runtime-fetched, TTL-bounded
- **Deprecations** – `id` (replaced by `readerIdentifier`), `prepare(using:updateHandler:)` (replaced by `prepare(using:)` + `events` stream), `PaymentCardReader.UpdateEvent` (replaced by `PaymentCardReader.Event`)
- **`PaymentCardReader.Event`** – `updateProgress(Int)` (0-100, for determinate progress UI), `readyForTap`; per-transaction success/failure delivered through the session async API
- **`PaymentCardReaderSession`** – `readPayment(_:)` for charges, `readPaymentCard(_:)` for non-charging lookup, `refundPayment(_:)` for refunds, `readPass(_:)` for NFC loyalty pass reads, `cancel()`
- **`PaymentCardTransaction`** and **`PaymentCardLookupResult`** — opaque result types
- **NFC pass reading** – combined-mode (pass + payment in one tap) and standalone-pass-only modes; cross-reference to the `pass.json` `nfc` block schema
- **Read errors** – categories (cancellation, timeout, unsupported card, issuer decline, SCA required, reader not configured, entitlement missing) with recovery guidance; PSP SDKs wrap these in typed hierarchies
- **Store and Forward mode** – `prepareStoreAndForward()`, `fetchPaymentCardReaderStore()`; PSP-supported, not Apple-supported, with chargeback risk
- **`MobileDocumentReader`** (Tap to Present ID, WWDC23) — separate class on the same framework for reading driver's licenses and state IDs; out of scope for `axiom-payments` but cross-referenced here so developers searching ProximityReader land in the right place — plus the ID-verification additions from the 27 releases (the `.name` element with `MobileDocumentHolderName`, `issuerIdentifiers`)
- **`CustomerEngagementSession`** (27 releases) — merchant↔customer-device pairing for contact info, signups, payments, carts, and pass adds
- **`ProximityReaderDiscovery`** – system-provided merchant tutorial UI, Apple-maintained and localized
- **Pipeline state diagram** – the foreground → prepare → readyForTap → read → completed → re-prepare-on-foreground loop
- **Threading model** – `Sendable` conformance, single-consumer `events` async stream
- **Capability detection** – defensive `isSupported` gating before showing the Tap to Pay button

## Documentation Scope

This page documents the `tap-to-pay-ref` skill — the `ProximityReader` framework API surface.

- For **the entitlement workflow, PSP onboarding, prepare-on-foreground discipline, HIG button label rule**, see [Tap to Pay](/skills/integration/tap-to-pay)
- For **NFC loyalty pass schema** the reader consumes, see [Wallet Passes](/skills/integration/wallet-passes) and [Wallet Passes Reference](/reference/wallet-passes-ref)
- For **failure modes** (entitlement stuck, prepare not called, `isSupported` false), see [Payments Diagnostics](/diagnostic/payments-diag)
- For **the sibling acceptance API** for online card flows on the same device, see [Apple Pay Reference](/reference/apple-pay-ref)
