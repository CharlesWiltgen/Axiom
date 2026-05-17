---
name: wallet-passes-ref
description: pass.json schema and PassKit consumer-side API — top-level keys, pass styles, PassFields display rules, semantic tags, barcode formats, NFC payload, locations/beacons, PKPassLibrary, image dimension table, multipass bundles
---

# Wallet Passes Reference

Schema reference for `pass.json` and the PassKit consumer-side API (`PKPassLibrary`, `PKAddPassesViewController`). Covers required and optional top-level keys, pass-style dictionaries, field display rules, semantic tags, barcode formats, NFC payload schema, and the web service endpoint shapes.

## When to Use This Reference

Use this reference when:
- Authoring `pass.json` and looking up required and optional top-level keys
- Choosing the correct pass style key (`boardingPass`, `eventTicket`, `coupon`, `storeCard`, `generic`) plus `preferredStyleSchemes: ["posterEventTicket"]` for iOS 18+
- Looking up `PassFields` display behavior (which fields show on Apple Watch, which on the stacked Wallet view, which on the back)
- Looking up `semantics` tag names for poster event tickets, boarding passes, store cards
- Looking up `PKBarcodeFormat*` values for QR, PDF417, Aztec, Code128
- Wiring `PKPassLibrary` for consumer-side pass enumeration, threading constraints, and notifications
- Looking up the five Apple-defined web service endpoint schemas
- Packaging a `.pkpasses` multi-pass bundle

## Example Prompts

Questions developers ask that this reference answers:

- "Which top-level keys are required in `pass.json`?"
- "Which fields are visible on Apple Watch?"
- "What semantic tags do I set for a flight boarding pass?"
- "What's the schema of the `nfc` block?"
- "How do I call `PKPassLibrary.passes(of:)` for payment passes?"
- "What MIME type do I use for a multi-pass download?"
- "What are the exact endpoint paths for the pass update web service?"

## What's Covered

- **Top-level keys** — `formatVersion`, `passTypeIdentifier`, `serialNumber`, `teamIdentifier`, `organizationName`, `description`, plus optional `logoText`, color keys, `expirationDate`, `voided`, `relevantDate`, `locations`, `beacons`, `barcodes`, `nfc`, `webServiceURL`, `authenticationToken`, `associatedStoreIdentifiers`, `appLaunchURL`, `userInfo`, `sharingProhibited`, `suppressStripShine`, `preferredStyleSchemes`, `groupingIdentifier`, `semantics`
- **Pass style keys** — `boardingPass` (with `transitType`), `eventTicket`, `coupon`, `storeCard`, `generic`; iOS 18+ `posterEventTicket` declared via `preferredStyleSchemes` (underlying style is still `eventTicket`)
- **`PKTransitType`** values for boarding passes
- **PassFields** — `headerFields` (stacked Wallet view), `primaryFields`, `secondaryFields`, `auxiliaryFields` (Apple Watch surfaces these), `backFields` (tap pass info)
- **Field dictionary keys** — `key`, `label`, `value`, `attributedValue`, `changeMessage`, `dateStyle`, `timeStyle`, `currencyCode`, `numberStyle`, `textAlignment`, `isRelative`, `ignoresTimeZone`, `dataDetectorTypes`
- **`PKDateStyle*`**, **`PKNumberStyle*`**, **`PKTextAlignment*`**, and **`PKDataDetectorType*`** value lists
- **Semantic tags** — `eventName`, `eventStartDate`/`eventEndDate`, venue tags, `performerNames`, `seats`, sports `leftTeamName`/`rightTeamName`, airline `airlineCode`/`flightNumber`, boarding `departureGate`/`arrivalDate`, store-card `balance`/`totalPrice`
- **Barcodes array** — `PKBarcodeFormatQR`, `PKBarcodeFormatPDF417`, `PKBarcodeFormatAztec`, `PKBarcodeFormatCode128`; the deprecated singular `barcode` key
- **NFC payload schema** — `nfc.message`, `nfc.encryptionPublicKey`, `nfc.requiresAuthentication`; requires NFC Pass Encoding entitlement
- **Locations and beacons** — schema and 10-item caps
- **`PKPassLibrary`** — instance methods, modern `PKPassType` cases (`.any`, `.barcode`, `.secureElement`; `.payment` was renamed), threading constraint (not thread-safe; main-thread confinement)
- **`PKPassLibrary` notifications** — `PKPassLibraryDidChange`, `PKPassLibraryRemoteSecureElementPassesDidChange` (formerly `RemotePaymentPasses`)
- **`PKAddPassesViewController`** — `init(pass:)` and `init(passes:)`, delegate
- **Image filename and dimension reference** — `icon`, `logo`, `strip`, `background`, `thumbnail`, `footer` at `@2x` and `@3x`; which images each style requires; pointer to the HIG for exact pixel dimensions (numbers change; pin the doc)
- **Localization** — `.lproj` directory layout, `pass.strings` UTF-16, system-formatted date/currency auto-localization
- **Multipass bundles** — `.pkpasses` zip, MIME types (`application/vnd.apple.pkpass`, `application/vnd.apple.pkpasses`), 10-pass and 150 MB caps
- **SwiftUI buttons** — `AddPassToWalletButton`, `AddOrderToWalletButton`, `VerifyIdentityWithWalletButton`
- **Web service endpoint schemas** — five-endpoint pattern with request/response shapes, `Authorization: ApplePass <token>` header, conditional response headers for `GET /v1/passes/...`

## Documentation Scope

This page documents the `wallet-passes-ref` skill — the `pass.json` schema plus the consumer-side PassKit API.

- For **building, signing, distributing, and updating** passes (PKCS #7 chain, WWDR, manifest, web service flow, lock-screen relevance, NFC entitlement, iOS 18 poster event ticket migration), see [Wallet Passes](/skills/integration/wallet-passes)
- For **post-purchase order tracking** (a sibling Wallet surface with its own cert and similar signing chain), see [Wallet Orders](/skills/integration/wallet-orders)
- For **the merchant-side NFC pass read** at point-of-sale, see [Tap to Pay](/skills/integration/tap-to-pay)
- For **signing failure modes** (missing WWDR, manifest mismatch, expired cert), see [Payments Diagnostics](/diagnostic/payments-diag)
