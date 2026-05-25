---
name: app-clips
description: Lightweight install-free app slices — size tiers, invocation, AASA, launch experiences, and data handoff
skill_type: skill
version: 1.0
apple_platforms: iOS 14+ (100 MB tier iOS 17+)
---

# App Clips

An App Clip is a small slice of your app a user can launch instantly — from a website link, App Clip Code, NFC tag, QR code, Maps, Messages, or Spotlight — without installing the full app. It's a separate Xcode target embedded inside your full app's archive, living under tight size and capability limits.

Part of the **axiom-shipping** suite (`skills/app-clips.md` and `skills/app-clips-ref.md`).

## When to Use

Use this skill when you're:
- Adding an App Clip target to an existing app
- Choosing an invocation method (and understanding how it caps your size budget)
- Configuring associated domains and the AASA file for App Clip links
- Setting up the App Store Connect default and advanced launch experiences
- Handing off App Clip data to the full app on upgrade
- Debugging "App Clip won't invoke" or "build exceeds maximum size"

## Example Prompts

- "How do I add an App Clip to my app?"
- "What's the App Clip size limit?"
- "Why does my App Clip link do nothing?"
- "How do I share data between my App Clip and the full app?"
- "How do I set up the App Clip launch experience in App Store Connect?"

## Key Concepts

### Size tiers — the make-or-break constraint

The uncompressed App Clip binary (after thinning) must fit its deployment target's ceiling:

| Minimum target | Limit | Conditions |
|----------------|-------|------------|
| iOS 15 and earlier | 10 MB | — |
| iOS 16+ | 15 MB | — |
| iOS 17+ | 100 MB | Digital invocations only; reliable internet; no iOS < 17 support |

The 100 MB tier is digital-invocations-only. The moment you support a physical invocation (App Clip Code, QR, NFC), you're capped at 15 MB.

### It ships with the full app

The App Clip bundle ID is `<ParentBundleID>.Clip` and it's embedded in the full app's archive — never submitted standalone. Entitlements (`parent-application-identifiers`, `on-demand-install-capable`, and the auto-added `associated-appclip-app-identifiers`) tie the two together.

### App Clip links need a correct AASA

Add an `appclips:` Associated Domain and serve an `apple-app-site-association` file with an `appclips` key. A 404 or redirect here is the #1 cause of "the link does nothing."

### Plan for no persistent identity

App Clips can't use App Intents, HealthKit, Contacts, and other frameworks; get only ephemeral notifications (8 hours/launch); have no ATT/SKAdNetwork, an empty device name, and a zeroed IDFV. Hand off data to the full app via a shared App Group or Keychain before the user upgrades.

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| 100 MB tier with a QR/NFC invocation | Build rejected (over 15 MB) | 100 MB is digital-invocation-only |
| NFC/QR while relying on 100 MB | Over the 15 MB cap | Keep physical-invocation clips ≤ 15 MB |
| Wrong bundle ID | No ASC pairing | Use `<ParentBundleID>.Clip` |
| Misconfigured AASA | Link does nothing | Serve valid JSON, no redirects, `appclips` key |
| Using denylisted frameworks | Won't build | App Intents / HealthKit / Contacts unavailable |
| Data lost on upgrade | Poor UX | Hand off via App Group / Keychain |

## Related

- [App Store Submission](/skills/shipping/app-store-submission) — App Clips ship with the parent app
- [App Review Guidelines](/skills/shipping/app-review-guidelines) — Review rules that apply to App Clips
- For App Clip Live Activities, see the axiom-integration suite (live-activities)

## Resources

**WWDC**: 2020-10174, 2020-10120, 2021-10013, 2022-10097, 2023-10178

**Docs**: /appclip, /appclip/creating-an-app-clip-with-xcode, /appclip/configuring-the-launch-experience-of-your-app-clip, /appclip/associating-your-app-clip-with-your-website, /appclip/sharing-data-between-your-app-clip-and-your-full-app
