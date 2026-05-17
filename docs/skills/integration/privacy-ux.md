---
name: privacy-ux
description: Discipline for privacy-first app design — privacy manifests, just-in-time permission requests, App Tracking Transparency, tracking domains, Required Reason APIs, and Privacy Nutrition Labels
---

# Privacy UX

Discipline-enforcing skill for shipping a privacy-first iOS app. Privacy manifests (`PrivacyInfo.xcprivacy`) are the source of truth; just-in-time permission requests dramatically reduce denial rates; tracking domains and Required Reason APIs are App Review enforcement points, not optional documentation.

## When to Use

Use this skill when:
- Creating or auditing `PrivacyInfo.xcprivacy`
- Requesting system permissions (Camera, Photos, Microphone, Location, Bluetooth, etc.)
- Implementing App Tracking Transparency (ATT) and IDFA access
- Preparing or updating Privacy Nutrition Labels in App Store Connect
- Declaring tracking domains and avoiding accidental tracking
- Adding Required Reason API declarations (UserDefaults, file timestamps, system boot time, disk space)
- Designing transparent UX for permission and ATT prompts
- Debugging privacy-related App Store rejections

## Example Prompts

- "How do I structure my `PrivacyInfo.xcprivacy`?"
- "What's the right just-in-time pattern for requesting camera access?"
- "How do I implement ATT without users denying me 90% of the time?"
- "Which of my APIs need a Required Reason declaration?"
- "How do I declare tracking domains in my privacy manifest?"
- "What data types go into Privacy Nutrition Labels and how do they map to manifest entries?"
- "I'm getting an ITMS-91056 rejection — what's missing?"

## What This Skill Provides

- **Privacy manifest discipline** — `PrivacyInfo.xcprivacy` structure, `NSPrivacyTracking` flag, `NSPrivacyTrackingDomains` array, `NSPrivacyCollectedDataTypes` declarations, `NSPrivacyAccessedAPITypes` with reason codes (e.g., `CA92.1` for UserDefaults)
- **Just-in-time permission pattern** — show a pre-permission education screen, request system access on user action (not at launch), handle denial gracefully with a Settings redirect path
- **App Tracking Transparency UX** — pre-prompt education, `ATTrackingManager.requestTrackingAuthorization`, status checking, IDFA access only after `.authorized`
- **Tracking domains** — what counts as tracking, automatic blocking in iOS 17+, how to declare partner domains in the manifest
- **Required Reason APIs** — the four common categories (UserDefaults, file timestamps, system boot time, disk space) and the specific reason codes that satisfy App Review
- **Privacy Nutrition Labels** — data collection categories, data use purposes, linked vs. not-linked-to-identity, how to keep the manifest and Nutrition Labels in sync
- **Permission decision matrix** — which permissions need usage descriptions, which need entitlements, which are silently blocked without manifest declarations
- **Anti-patterns** — requesting at launch ("get all the popups out of the way"), missing Info.plist usage descriptions (crash on first access), no Required Reason declaration (App Store rejection), ATT request with no pre-prompt context (denial rate near 100%), tracking domains undeclared (silent blocking)
- **App Review rejection playbook** — common ITMS codes (ITMS-91056, ITMS-91065, ITMS-91062) and the manifest changes that resolve them

## Related

- [hig](/skills/ui-design/hig) — permission request UX patterns and onboarding flow
- [hig-ref](/reference/hig-ref) — complete HIG reference
- [eventkit-contacts](/skills/integration/eventkit-contacts) — EventKit and Contacts have their own permission models layered on top of these patterns
