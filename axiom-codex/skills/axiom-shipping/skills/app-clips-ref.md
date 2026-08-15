
# App Clips — Reference

Reference tables for App Clip size tiers, entitlements, invocations, AASA format, data sharing, and restrictions. For the discipline (architecture decisions, gotchas, debugging), see `skills/app-clips.md`.

## Size limits

Uncompressed App Clip binary, after app thinning, per variant, measured against the minimum deployment target:

| Minimum deployment target | Limit | Conditions |
|---------------------------|-------|------------|
| iOS 15 and earlier | 10 MB | — |
| iOS 16+ | 15 MB | — |
| iOS 17+ | 100 MB | Digital invocations only; reliable internet; no iOS < 17 support |

Physical invocations (App Clip Code, QR, NFC) cap the clip at **15 MB** regardless of deployment target. Authoritative source: App Store Connect ▸ Reference ▸ Maximum build file sizes.

Exception (testing only): the App Store Connect-generated App Clip **demo link** can use the 100 MB limit even with physical invocations. This is a demo/preview affordance — production physical invocations still cap at 15 MB.

## Bundle and target

- App Clip bundle ID: **`<ParentBundleID>.Clip`** (exact).
- App Clip is a separate target embedded in the full app; both ship in **one archive**.
- Shared code via a common framework or shared source membership — counts against the size budget.

## Entitlements

| Target | Entitlement | Value |
|--------|-------------|-------|
| App Clip | `com.apple.developer.parent-application-identifiers` | `[ <TeamID>.<ParentBundleID> ]` |
| App Clip | `com.apple.developer.on-demand-install-capable` | `true` |
| Full app | `com.apple.developer.associated-appclip-app-identifiers` | added automatically by Xcode at archive time |

Both targets also need **Associated Domains** for App Clip links (see below).

## Invocation methods

| Method | Type | Size impact |
|--------|------|-------------|
| App Clip Code | Physical | 15 MB cap |
| NFC tag | Physical | 15 MB cap |
| QR code | Physical | 15 MB cap |
| Safari Smart App Banner | Digital | 100 MB eligible (iOS 17+) |
| Maps | Digital | 100 MB eligible (iOS 17+) |
| Messages | Digital | 100 MB eligible (iOS 17+) |
| Spotlight | Digital | 100 MB eligible (iOS 17+) |
| `https://appclip.apple.com/...` default link | Digital | 100 MB eligible (iOS 17+) |

## Associated Domains and AASA

Entitlement entry (both the App Clip and, for full-app Universal Links, the app):

```
appclips:example.com
```

AASA file at `https://example.com/.well-known/apple-app-site-association` (HTTPS, valid JSON, no redirects, answers Apple's `AASA-Bot` / CFNetwork fetch):

```json
{
  "appclips": {
    "apps": ["ABCDE12345.com.example.MyApp.Clip"]
  }
}
```

For Universal Links into the full app, the same file also carries the standard `applinks` section.

## App Store Connect launch experience

- **Default experience** (required): header image, subtitle (≤ 56 characters), call-to-action verb (e.g. Open / View / Play). Plus the URL the experience opens.
- **Advanced experiences**: per-URL or per-place cards (Maps place cards, multi-location). Configured in App Store Connect.

## Data sharing with the full app

| Mechanism | Notes |
|-----------|-------|
| App Group shared container | Files and shared `UserDefaults` both targets can read |
| Keychain (access group) | App Clip ↔ app keychain sharing, iOS 15.4+ |
| Sign in with Apple | Re-establish identity in the full app |
| CloudKit public database | Read-only from the App Clip (iOS 16+); no private/shared containers |

Write handoff data **before** prompting the upgrade; read it on first launch of the full app.

## Restrictions

Capabilities an App Clip does **not** have:

- **No background execution** — no `BGTaskScheduler`, no Background Modes, no background URLSession, no background Bluetooth.
- **Ephemeral notifications by default** — ~8 hours per launch; for multi-day functionality you can explicitly request standard notification permission.
- **No persistent identity** — device name and `identifierForVendor` both return an empty string.
- **No ATT / SKAdNetwork** — no App Tracking Transparency, no attribution kit.
- **Restricted frameworks** — App Intents, HealthKit, HomeKit, Contacts, EventKit, Core Motion, MediaPlayer, PhotoKit, Speech, Nearby Interaction, and others are unavailable at runtime; verify a framework's App Clip availability before depending on it.
- **No standalone submission** — always submitted embedded in the full app.

## App Clip Live Activities

An App Clip may present a Live Activity via its own widget-extension target that contains **only** the Live Activity (no static/timeline widgets). See axiom-integration (skills/live-activities.md).

## Resources

**WWDC**: 2020-10174, 2020-10120, 2021-10013, 2022-10097, 2023-10178

**Docs**: /appclip, /appclip/creating-an-app-clip-with-xcode, /appclip/configuring-the-launch-experience-of-your-app-clip, /appclip/associating-your-app-clip-with-your-website, /appclip/sharing-data-between-your-app-clip-and-your-full-app

**Skills**: skills/app-clips.md, skills/app-store-submission.md, axiom-integration (skills/live-activities.md)
