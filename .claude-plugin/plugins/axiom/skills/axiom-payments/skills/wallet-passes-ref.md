# Wallet Passes — pass.json Schema + PassKit API Reference

Schema reference for `pass.json` and the PassKit consumer-side API. For the discipline (signing chain, distribution, web service), see `wallet-passes.md`.

## Top-Level Keys

```json
{
  "formatVersion": 1,
  "passTypeIdentifier": "pass.com.example.event",
  "serialNumber": "EVT-2026-00042",
  "teamIdentifier": "ABCDE12345",
  "organizationName": "Example Events",
  "description": "Event ticket for Apr 15 Concert",
  "eventTicket": { ... }
}
```

| Key | Type | Required | Notes |
|-----|------|----------|-------|
| `formatVersion` | Integer | Yes | Always `1` |
| `passTypeIdentifier` | String | Yes | Reverse DNS form, matches certificate |
| `serialNumber` | String | Yes | Unique within identifier |
| `teamIdentifier` | String | Yes | Apple Developer Team ID |
| `organizationName` | String | Yes | Issuer business name (visible) |
| `description` | String | Yes | VoiceOver-accessible summary |
| `logoText` | String | No | Optional text next to logo |
| `foregroundColor` | String | No | `rgb(255, 255, 255)` form |
| `backgroundColor` | String | No | Same form |
| `labelColor` | String | No | Color of field labels |
| `expirationDate` | ISO 8601 | No | One of three auto-hide triggers (with `voided: true` and stale `relevantDate`); see `wallet-passes.md` |
| `voided` | Boolean | No | If true, pass is hidden from main list |
| `relevantDate` | ISO 8601 | No | Lock-screen relevance trigger |
| `locations` | Array | No | Up to 10 location objects |
| `beacons` | Array | No | Up to 10 iBeacon objects |
| `barcodes` | Array | No | Code formats supported on the device |
| `nfc` | Object | No | NFC payload (requires entitlement) |
| `webServiceURL` | URL | No | HTTPS update endpoint base |
| `authenticationToken` | String | No | ≥16 chars; per-pass shared secret |
| `associatedStoreIdentifiers` | Array<Number> | No | App Store IDs for cross-promotion |
| `appLaunchURL` | URL | No | Custom URL scheme to launch your app from the pass |
| `userInfo` | Object | No | Application-private dictionary |
| `sharingProhibited` | Boolean | No | If true, pass cannot be shared |
| `suppressStripShine` | Boolean | No | Disable strip image shine effect |
| `preferredStyleSchemes` | Array<String> | No | iOS 18+ — e.g. `["posterEventTicket"]` |
| `groupingIdentifier` | String | No | Groups passes in Wallet (event tickets) |
| `semantics` | Object (semantic tags) | No | Rich metadata; required for posterEventTicket |

## Pass Style Keys (Mutually Exclusive)

Exactly one of these top-level keys appears, carrying a `PassFields` dictionary:

| Style Key | Use |
|-----------|-----|
| `boardingPass` | Transit / single trip |
| `eventTicket` | Event admission |
| `coupon` | Promotional |
| `storeCard` | Loyalty / balance |
| `generic` | Catch-all |
| Plus iOS 18+ `posterEventTicket` declared via `preferredStyleSchemes` rather than a separate top-level key (the underlying style is still `eventTicket`) |

`boardingPass` additionally requires:
```json
"boardingPass": {
    "transitType": "PKTransitTypeAir",   // Air | Bus | Boat | Train | Generic
    "headerFields": [...],
    "primaryFields": [...],
    "secondaryFields": [...],
    "auxiliaryFields": [...],
    "backFields": [...]
}
```

`PKTransitType` values: `PKTransitTypeAir`, `PKTransitTypeBus`, `PKTransitTypeBoat`, `PKTransitTypeTrain`, `PKTransitTypeGeneric`.

## PassFields

Each style dictionary uses these field arrays:

| Array | Display position |
|-------|------------------|
| `headerFields` | Top right of pass; the only field visible when passes are stacked in Wallet on iPhone |
| `primaryFields` | Most prominent — large display |
| `secondaryFields` | Below primary |
| `auxiliaryFields` | Below secondary; smaller |
| `backFields` | Pass back side; tap pass info to view |

Apple Watch displays `primaryFields`, `secondaryFields`, and `auxiliaryFields`, plus the footer image and barcode. Stacked iPhone view shows only `headerFields`.

For iOS 18+ `posterEventTicket` rendering, additional structured event content lives in the top-level `semantics` object, not a separate field array. See `wallet-passes.md` § "iOS 18 Poster Event Ticket Migration".

## Field Dictionary Keys

```json
{
    "key": "balance",
    "label": "Current balance",
    "value": 21.75,
    "currencyCode": "USD",
    "changeMessage": "Balance changed to %@",
    "textAlignment": "PKTextAlignmentRight"
}
```

| Key | Type | Notes |
|-----|------|-------|
| `key` | String | Required; unique within pass |
| `label` | String | Display label (often a localization key) |
| `value` | String / Number | The displayed value |
| `attributedValue` | String | HTML-subset alternative; underline / link / font-style only |
| `changeMessage` | String | `%@` placeholder for the new value; shown on update notification |
| `dateStyle` | String | `PKDateStyleNone`, `PKDateStyleShort`, `PKDateStyleMedium`, `PKDateStyleLong`, `PKDateStyleFull` |
| `timeStyle` | Same | Same options for time component |
| `currencyCode` | String | ISO 4217 — pairs with numeric `value` |
| `numberStyle` | String | `PKNumberStyleDecimal`, `PKNumberStylePercent`, `PKNumberStyleScientific`, `PKNumberStyleSpellOut` |
| `textAlignment` | String | `PKTextAlignmentLeft`, `PKTextAlignmentCenter`, `PKTextAlignmentRight`, `PKTextAlignmentNatural` |
| `isRelative` | Boolean | If true, render date relative to now ("in 3 hours") |
| `ignoresTimeZone` | Boolean | If true, render the date components literally without TZ adjustment |
| `dataDetectorTypes` | Array<String> | `PKDataDetectorTypePhoneNumber`, `...Link`, `...Address`, `...CalendarEvent` (back fields) |

## Semantic Tags (`semantics`)

Apple-defined keys that give Wallet rich data for: lock-screen suggestions, Live Activities, Maps integration, music integration (`posterEventTicket`), accessibility. Set as a single top-level `semantics` object.

| Tag | Pass styles |
|-----|------------|
| `eventName` | event ticket / poster event |
| `eventStartDate`, `eventEndDate` | event |
| `venueName`, `venueLocation`, `venueEntrance`, `venueRoom`, `venueRegionName`, `venuePhoneNumber` | event |
| `performerNames` | event |
| `artistIDs` | event |
| `leftTeamName`, `rightTeamName`, `homeTeamLocation`, `awayTeamLocation` | sports event |
| `seats` | event (array of seat dictionaries) |
| `airlineCode`, `flightNumber`, `flightCode` | boarding (air) |
| `departureLocation`, `destinationLocation`, `departureAirportCode`, `destinationAirportCode`, `departureGate`, `destinationGate`, `departureTerminal`, `destinationTerminal` | boarding (air) |
| `departureDate`, `arrivalDate`, `originalDepartureDate`, `currentDepartureDate` | boarding (any) |
| `boardingGroup`, `boardingSequenceNumber` | boarding |
| `transitProvider`, `vehicleName`, `vehicleNumber`, `vehicleType` | boarding |
| `passengerName` | boarding (PersonNameComponents) |
| `currencyCode`, `totalPrice`, `balance` | store card / generic |
| `additionalTicketAttributes` | event |
| `wifiAccess` | hotel-like passes |

A `seats` entry typically contains: `seatSection`, `seatRow`, `seatNumber`, `seatIdentifier`, `seatType`, `seatDescription`.

Refer to `/walletpasses/passsemantics` (and per-tag pages) for the full enumeration. Sparse `semantics` = sparse Wallet event guide.

## Barcodes Array

```json
"barcodes": [
    {
        "format": "PKBarcodeFormatQR",
        "message": "ticket-id-12345",
        "messageEncoding": "iso-8859-1",
        "altText": "12345"
    }
]
```

| `format` value | Code |
|----------------|------|
| `PKBarcodeFormatQR` | QR code |
| `PKBarcodeFormatPDF417` | 2D PDF417 |
| `PKBarcodeFormatAztec` | 2D Aztec |
| `PKBarcodeFormatCode128` | 1D Code128 |

Use the `barcodes` **array** (iOS 9+). The deprecated singular `barcode` key still exists for backward compatibility but doesn't render on iOS 9+. Always provide an array even if it has one element.

## NFC Payload

```json
"nfc": {
    "message": "your-encoded-payload",
    "encryptionPublicKey": "<base64 ECC P-256 public key>",
    "requiresAuthentication": false
}
```

Requires the **NFC Pass Encoding entitlement** (separate Apple Developer request). For payment cards (issuer/bank context), use `wallet-extensions-ref.md` patterns instead.

## Locations + Beacons

```json
"locations": [
    {
        "latitude": 37.3349,
        "longitude": -122.0090,
        "altitude": 30.0,
        "relevantText": "You're near Apple Park"
    }
]
```

```json
"beacons": [
    {
        "proximityUUID": "12345678-1234-1234-1234-123456789012",
        "major": 1,
        "minor": 1,
        "relevantText": "Welcome"
    }
]
```

Up to 10 each. `relevantText` appears as a lock-screen suggestion when the pass becomes relevant.

## PKPassLibrary

Consumer-side library — for iOS / iPadOS / macOS / Catalyst / visionOS / watchOS.

| Method | Purpose |
|--------|---------|
| `PKPassLibrary.isPassLibraryAvailable()` | Static; check before instantiating |
| `passes()` | All passes the app can access |
| `passes(of: PKPassType)` | Filtered. Modern cases: `.any`, `.barcode`, `.secureElement`. (`.payment` was renamed to `.secureElement` when Apple generalized payment-pass APIs.) |
| `pass(withPassTypeIdentifier:serialNumber:)` | Lookup by key |
| `containsPass(_:)` | Exists check |
| `addPasses(_:withCompletionHandler:)` | Multi-pass add via system UI |
| `replacePass(with:)` | Replace existing |
| `removePass(_:)` | Remove from user library |
| `openPaymentSetup()` | Open Wallet's payment setup |
| `requestAuthorization(for:completion:)` | Permission flow |
| `authorizationStatus(for:)` | Check current permission |

**Threading:** `PKPassLibrary` is **not thread-safe**. Apple's guidance: confine each instance to a single thread (typically the main thread). Don't share an instance across threads.

### Notifications

`PKPassLibraryNotificationName` cases (subscribe via NotificationCenter):

| Notification | Trigger |
|--------------|---------|
| `PKPassLibraryDidChange` | Library contents changed |
| `PKPassLibraryRemoteSecureElementPassesDidChange` | Paired-device Secure Element pass state changed (formerly RemotePaymentPasses, renamed when payment-pass APIs generalized to Secure Element) |

`PKPassLibraryNotificationKey` cases identify what changed inside the userInfo dictionary.

## PKAddPassesViewController

```swift
let controller = PKAddPassesViewController(pass: pass)
present(controller, animated: true)
```

System UI to review-then-add. Initialize with one `PKPass` or use `init(passes:)` for multiple. Conform to `PKAddPassesViewControllerDelegate` to learn when the user finishes.

For SwiftUI, `AddPassToWalletButton(action:)` wraps this (iOS 16+).

## Image Filename + Dimension Reference

Required and optional images (PNG only; @2x and @3x variants):

| Filename | Required for | Notes |
|----------|--------------|-------|
| `icon.png` (`@2x`, `@3x`) | All | Used in notifications + email + lock screen |
| `logo.png` (`@2x`, `@3x`) | All | Top-of-pass branding |
| `strip.png` (`@2x`, `@3x`) | event ticket / coupon | Strip across the card |
| `background.png` (`@2x`, `@3x`) | event ticket | Full-bleed background; blurred on lock screen |
| `thumbnail.png` (`@2x`, `@3x`) | generic / event | Right side of pass |
| `footer.png` (`@2x`, `@3x`) | boarding pass | Below the strip |

For exact pixel dimensions per asset and per pass style, see the Wallet HIG (`/design/human-interface-guidelines/wallet`) "Image dimensions" section. Apple updates these — pin the doc, not the numbers.

## Localization

Directory layout per locale: `<lang>-<region>.lproj/`. Examples: `en.lproj`, `en-GB.lproj`, `zh-Hans.lproj`, `fr.lproj`.

Each `.lproj` contains:
- Localized image overrides (any subset of the top-level images)
- `pass.strings` — UTF-16 encoded `"key" = "translation";` form

`pass.strings` translates string values *and* labels referenced as keys in `pass.json`. Date / time / currency / number values are auto-localized by the system formatters — no `.lproj` needed.

```
"OfferAmount" = "100% off";
"OfferAmountLabel" = "Anything you want!";
```

## Multipass Bundles

Packaging multiple `.pkpass` into one download:

```bash
# Each .pkpass is already a signed zip.
# Bundle multiple into a .pkpasses (note plural):

zip -r my-bundle.zip pass1.pkpass pass2.pkpass pass3.pkpass
mv my-bundle.zip my-bundle.pkpasses
```

| MIME type | Container |
|-----------|-----------|
| `application/vnd.apple.pkpass` | Single `.pkpass` |
| `application/vnd.apple.pkpasses` | Multi-pass `.pkpasses` |

Limits: up to 10 passes, max 150 MB total.

## SwiftUI Buttons

| View | Purpose |
|------|---------|
| `AddPassToWalletButton(action:)` | iOS 16+ — Add to Apple Wallet |
| `AddOrderToWalletButton(action:)` | iOS 17+ — Add Order to Wallet (see `wallet-orders.md`) |
| `VerifyIdentityWithWalletButton(action:)` | iOS 16+ — Verify with Wallet |

Use these instead of CSS-styled custom buttons; they handle localization and HIG compliance.

## Web Service Endpoint Schemas

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}` | POST | `{ pushToken }` | 200 (registered) / 200 (already registered) / 401 |
| Same | DELETE | - | 200 |
| `/v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}` | GET | `?passesUpdatedSince={tag}` | `{ lastUpdated, serialNumbers: [...] }` |
| `/v1/passes/{passTypeIdentifier}/{serialNumber}` | GET | - | Updated `.pkpass` (binary, `application/vnd.apple.pkpass`) |
| `/v1/log` | POST | `{ logs: [...] }` | 200 |

All endpoints validate `Authorization: ApplePass <authenticationToken>` header. The token is the per-pass `authenticationToken` from `pass.json`.

The pass-fetch endpoint (`GET /v1/passes/...`) supports conditional response headers — return `If-Modified-Since` / `Last-Modified` to avoid serving unchanged passes.

## Resources

**Docs**: /walletpasses, /walletpasses/pass, /walletpasses/passfields, /walletpasses/passfieldcontent, /walletpasses/passsemantics, /walletpasses/building-a-pass, /walletpasses/creating-the-source-for-a-pass, /walletpasses/distributing-and-updating-a-pass, /walletpasses/adding-a-web-service-to-update-passes, /walletpasses/creating-an-airline-boarding-pass-using-semantic-tags, /walletpasses/creating-a-coupon-pass, /walletpasses/creating-an-event-pass-using-semantic-tags, /walletpasses/creating-a-generic-pass, /walletpasses/creating-a-store-card-pass, /passkit/pkpasslibrary, /passkit/pkaddpassesviewcontroller, /passkit/pkaddpassbutton

**Archived**: library/archive/documentation/UserExperience/Conceptual/PassKit_PG (manifest hashing, PKCS #7 details, Table 4-2 relevance rules)

**HIG**: /design/human-interface-guidelines/wallet (image specs, pass design, Apple Watch layout)

**WWDC**: 2021-10092 (multipass downloads, auto-hide expired), 2024-10108 (poster event ticket, semantic tags, event guide)

**Skills**: wallet-passes (discipline), wallet-orders (post-purchase tracking), tap-to-pay (NFC pass reading at point-of-sale), payments-diag (signing failure modes), apple-pay-ref (PassKit core API), axiom-design/hig (Wallet pass design)
