
# App Clips — Lightweight, Install-Free App Slices

An App Clip is a small slice of your app a user can launch instantly — from a website link, App Clip Code, NFC tag, QR code, Maps, Messages, or Spotlight — without installing the full app. It's a **separate Xcode target embedded inside your full app's archive**, not a standalone submission, and it lives under tight size and capability limits. Get the size tier, entitlements, and data-handoff right and an App Clip is a powerful acquisition funnel; get them wrong and it won't build, won't invoke, or gets rejected.

## Core mental model

The App Clip is a second target whose bundle ID is `<ParentBundleID>.Clip`. You build and submit it **with** the full app (one archive, App Store Connect ties them together). The App Clip shares code with the full app via a framework or shared sources, but it is heavily constrained: a hard binary-size ceiling, a denylist of frameworks, ephemeral notifications, and no persistent identity. When the user wants more, they upgrade to the full app — and any data the App Clip stored must hand off cleanly.

## When to Use This Skill

- Adding an App Clip target to an existing app
- Choosing an invocation method (and understanding how it caps your size budget)
- Configuring associated domains and the AASA file for App Clip links
- Setting up the App Store Connect default and advanced launch experiences
- Handing off App Clip data to the full app on upgrade
- Debugging "App Clip won't invoke" or "build exceeds maximum size"

For the entitlement/restriction/size tables and the AASA format, see `skills/app-clips-ref.md`. App Clips ship with the parent app — see `skills/app-store-submission.md` for the submission flow and `skills/app-review-guidelines.md` for review rules.

## App Clip size limits — the make-or-break constraint

The **uncompressed** App Clip binary (after app thinning, per variant) must not exceed the limit for its minimum deployment target:

| Minimum deployment target | Size limit | Conditions |
|---------------------------|-----------|------------|
| iOS 15 and earlier | 10 MB | — |
| iOS 16+ | 15 MB | — |
| iOS 17+ | **100 MB** | **Digital invocations only** (website / Spotlight), reliable-internet contexts, and **no support for iOS < 17** |

The 100 MB tier is exclusive to **digital** invocations. The moment you support a **physical** invocation — App Clip Code, QR code, or NFC tag — you're capped at **15 MB** again. (App Store Connect's "Maximum build file sizes" reference is the authoritative source.)

One exception, for **testing only**: the App Clip *demo link* that App Store Connect generates can exercise the 100 MB limit even from physical invocations (App Clip Codes, NFC, QR). That's a demo/preview affordance — your shipping physical invocations still cap at 15 MB, so don't let a 100 MB clip "working" via the demo link convince you it's production-ready.

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| Counting on the 100 MB tier with an NFC/QR/App Clip Code | Physical invocations cap you at 15 MB | Use only digital invocations for the 100 MB tier, or stay ≤ 15 MB |
| Bundle ID isn't `<ParentBundleID>.Clip` | App Store Connect won't associate the clip | Name it exactly `<ParentBundleID>.Clip` |
| AASA not served correctly | App Clip links don't invoke | Serve `apple-app-site-association` with an `appclips` key; the server must answer Apple's `AASA-Bot` / CFNetwork fetch |
| Using a denylisted framework | App Clip won't build / is rejected | App Intents, HealthKit, Contacts, etc. are unavailable in App Clips — guard or drop them |
| Expecting persistent identity | App Clips get an empty-string device name and an empty-string `identifierForVendor`; no ATT/SKAdNetwork | Don't rely on device identity or attribution in the clip |
| Notifications that linger | App Clips get **ephemeral** notifications by default (8 hours per launch) | For multi-day flows, explicitly request standard notification permission |
| Data doesn't survive upgrade | App Clip and full app are separate sandboxes | Hand off via a shared App Group / Keychain before the user upgrades |

## Part 1 — Target and archive structure

Add an **App Clip target** to your project (File ▸ New ▸ Target ▸ App Clip). Xcode embeds it inside the full app target so they archive together. Share code through a common framework or shared source membership — but every shared file still counts against the App Clip's size budget, so keep the clip's dependency graph lean.

## Part 2 — Entitlements

Three entitlements wire the clip to its parent:

- **App Clip target** — `com.apple.developer.parent-application-identifiers` listing the full app's App ID, and `com.apple.developer.on-demand-install-capable`.
- **Full app target** — `com.apple.developer.associated-appclip-app-identifiers`, which Xcode adds automatically when you archive.

If these don't line up, App Store Connect won't recognize the pairing and TestFlight/review will fail. See `skills/app-clips-ref.md` for the exact key/value shapes.

## Part 3 — Invocations (and how they cap your size)

App Clips launch from: **App Clip Codes**, **NFC tags**, **QR codes**, Safari **Smart App Banners**, **Maps**, **Messages**, **Spotlight**, and default `https://appclip.apple.com/...` links. The split that matters for your binary budget:

- **Physical** (App Clip Code, NFC, QR) → 15 MB ceiling.
- **Digital** (website link, Spotlight) → eligible for the 100 MB tier on iOS 17+.

Design the invocation strategy *before* you architect the clip — it sets your size budget.

## Part 4 — Associated domains and AASA

Add an **Associated Domains** entitlement with an `appclips:` prefix entry (`appclips:example.com`). Serve an `apple-app-site-association` (AASA) file at `https://example.com/.well-known/apple-app-site-association` with an `appclips` section listing your App Clip's app ID and URL patterns. The file must be valid JSON served over HTTPS with no redirects, and your server must respond to Apple's `AASA-Bot` user agent (and CFNetwork). A 404 or a redirect here is the #1 cause of "the App Clip link does nothing."

## Part 5 — App Store Connect launch experiences

- **Default experience** — a header image, a ≤56-character subtitle, and a call-to-action verb (e.g. "Open", "View", "Play"). Required; it's what users see in the App Clip card.
- **Advanced experiences** — per-URL or per-location cards (e.g. Maps place cards, multi-location businesses). Configure these in App Store Connect to tailor the card to the specific invocation.

## Part 6 — Handing data off to the full app

The App Clip and full app are **separate sandboxes**. To carry state across an upgrade, write it somewhere both can read:

- **App Group** shared container (files, shared `UserDefaults`)
- **Keychain** with an access group (iOS 15.4+ allows the App Clip and app to share keychain items)
- **Sign in with Apple** (re-establish identity in the full app)
- **CloudKit public database** (read-only from the clip)

Write the handoff data *before* prompting the upgrade, and read it on first launch of the full app.

## Part 7 — Restrictions

App Clips can't use: App Intents, HealthKit, HomeKit, Contacts, EventKit, Core Motion, and several other frameworks (full list in `skills/app-clips-ref.md`). They get **ephemeral** notification authorization by default (8 hours from each launch), though you can explicitly request standard permission for functionality that spans more than a day. They have **no access to ATT or SKAdNetwork**, and both the device name and `identifierForVendor` return an **empty string**. Build the clip assuming no persistent identity and no long-lived background presence.

## Part 8 — App Clip + Live Activities

An App Clip *can* show a Live Activity. It requires its own widget-extension target that contains **only** the Live Activity (no static/timeline widgets). This is a useful pattern for order/arrival status during an install-free flow — see axiom-integration (skills/live-activities.md) for the ActivityKit side.

## Common Mistakes

- Forgetting the 100 MB tier (iOS 17+) is digital-invocation-only — any NFC/QR/App Clip Code drops you to 15 MB.
- Adding an NFC/QR/App Clip Code invocation while relying on the 100 MB budget.
- Naming the clip's bundle ID anything other than `<ParentBundleID>.Clip`.
- A misconfigured or redirecting AASA file — the App Clip link silently does nothing.
- Reaching for App Intents / HealthKit / Contacts inside the clip.
- Expecting persistent identity (device name and `identifierForVendor` are empty strings), ATT, or background execution.
- Writing data only to the clip's own container, then losing it on upgrade.

## Resources

**WWDC**: 2020-10174, 2020-10120, 2021-10013, 2022-10097, 2023-10178

**Docs**: /appclip, /appclip/creating-an-app-clip-with-xcode, /appclip/configuring-the-launch-experience-of-your-app-clip, /appclip/associating-your-app-clip-with-your-website, /appclip/sharing-data-between-your-app-clip-and-your-full-app, /appclip/choosing-the-right-functionality-for-your-app-clip

**Skills**: skills/app-clips-ref.md, skills/app-store-submission.md (submitting with the parent app), skills/app-review-guidelines.md, axiom-integration (skills/live-activities.md — App Clip Live Activities)
