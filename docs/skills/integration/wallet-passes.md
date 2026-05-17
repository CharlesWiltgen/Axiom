---
name: wallet-passes
description: Wallet passes — boarding passes, event tickets (including iOS 18 poster event tickets), coupons, loyalty cards, store cards. PKCS #7 signing chain with WWDR Intermediate, manifest hashing, web service for updates, lock-screen relevance
---

# Wallet Passes

Discipline-enforcing skill for building, signing, distributing, and updating Apple Wallet passes. The signing chain (PKCS #7 detached + WWDR Intermediate + S/MIME signing-time + manifest hashing) is the most long-lived and confusing part of the entire payments suite. Most teams burn 4-8 hours debugging signing on first integration. Use a maintained server library and skip most of it.

## When to Use

Use this skill when:
- Building boarding passes, event tickets, coupons, loyalty cards, or store cards
- Migrating an existing event ticket to the iOS 18 poster event ticket rendering
- Generating a `.pkpass` bundle (manifest.json, signature, pass.json, images)
- Wiring the PKCS #7 signing pipeline with the Apple WWDR Intermediate Certificate
- Implementing the five-endpoint web service for pass updates and the APNs push that triggers them
- Setting `relevantDate`, `locations`, or `beacons` for lock-screen surfacing
- Adding NFC payloads to passes (requires the NFC Pass Encoding entitlement)
- Distributing passes via in-app `PKAddPassButton`, email attachment, web download, or `.pkpasses` multi-pass bundles
- Localizing passes with `.lproj` directories and `pass.strings`

## Example Prompts

Real questions developers ask that this skill answers:

- "How do I build a Wallet pass for my event tickets?"
- "My `.pkpass` won't import — Wallet says invalid. What's wrong?"
- "How do I migrate to the iOS 18 poster event ticket style?"
- "Why aren't pass updates reaching the device after I push via APNs?"
- "What's the difference between a Pass Type ID Cert and an Apple Pay Merchant Cert?"
- "How do I make a coupon show up on the lock screen when the user is near a store?"
- "Can I include `.DS_Store` files in my pass bundle?"

## What This Skill Provides

- **Pass anatomy** — required contents of a `.pkpass` (pass.json, manifest.json, signature, icon variants); the fact that `.pkpass` is a renamed zip
- **Pass Type Identifier plus Serial Number** — how `(passTypeIdentifier, serialNumber)` forms the unique key and how re-issuing with the same pair replaces the prior pass
- **Pass style decision** — `boardingPass`, `eventTicket`, `coupon`, `storeCard`, `generic`; iOS 18 `posterEventTicket` opt-in via `preferredStyleSchemes`
- **The signing workflow that breaks teams** — eight steps: Pass Type ID, CSR, certificate, WWDR Intermediate, manifest with SHA-1 hashes, PKCS #7 detached signature with S/MIME signing-time, zip-and-rename, simulator test; common failure modes for each
- **The "don't roll your own" recommendation** — server-side libraries for Node, Ruby, Python, Go; most signing failures originate from scratch implementations
- **Distribution channels** — `PKAddPassButton`, email attachment with `application/vnd.apple.pkpass`, web download, multi-pass `.pkpasses` bundles (10 passes max, 150 MB total)
- **Web service for updates** — five Apple-defined endpoints, `ApplePass <authenticationToken>` auth, APNs flow with the Pass Type ID Cert as both signing and push identity, the discipline rule of only pushing for time-critical changes
- **Lock-screen relevance** — `relevantDate`, `locations` (max 10), `beacons` (max 10); per-style relevance rules
- **NFC payloads** — `nfc` object schema, separate entitlement requirement; cross-reference to Tap to Pay for the merchant-side read surface
- **iOS 18 poster event ticket migration** — semantic tags, poster art, the NFC vs QR/barcode incompatibility
- **Auto-hide expired passes** — `expirationDate`, `voided: true`, stale `relevantDate`
- **Localization** — `.lproj` directories, `pass.strings` in UTF-16, system-formatted date and currency values

## Related

- [Wallet Passes Reference](/reference/wallet-passes-ref) — `pass.json` schema, field dictionary keys, semantic tags, barcode formats, `PKPassLibrary`, image dimension table
- [Wallet Orders](/skills/integration/wallet-orders) — sibling surface for post-purchase tracking; shares the PKCS #7 signing chain mechanics
- [Tap to Pay](/skills/integration/tap-to-pay) — the merchant-side `ProximityReader` API that reads NFC loyalty passes at checkout
- [Apple Pay](/skills/integration/apple-pay) — the auth result that can hand off a `PKPaymentOrderDetails` (orders) but does not produce passes directly
- [Payments Diagnostics](/diagnostic/payments-diag) — the nine failure modes for "pass won't import" and the update-delivery failure tree
- [Keychain Reference](/reference/keychain-ref) — generic cert export and `.p12` mechanics the Pass Type ID Cert plugs into
