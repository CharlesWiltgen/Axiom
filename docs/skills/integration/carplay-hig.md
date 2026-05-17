---
name: carplay-hig
description: CarPlay HIG and design discipline — app category selection, the 8 Universal Guidelines, per-category rules, entitlement review preparation, iOS 26 widgets and Live Activities, CarPlay Ultra
---

# CarPlay HIG and Design Discipline

CarPlay is not a second screen for your iPhone app. It is a regulated surface with hard design rules that Apple enforces during entitlement review — before your app ever reaches the App Store. This skill helps you pick the correct app category, comply with the 8 Universal Guidelines and per-category rules, and prepare a submission that passes review.

## When to Use

Use this skill when you're:

- Deciding whether your app belongs on CarPlay at all, and if so, in which of the 10 categories
- Requesting a CarPlay entitlement (Apple reviews design before granting the entitlement)
- Designing any CarPlay screen, flow, alert, or notification
- Adding widgets or Live Activities to CarPlay on iOS 26+
- Responding to Apple feedback on a CarPlay submission
- Reviewing an existing CarPlay implementation for HIG compliance
- Supporting CarPlay Ultra, which requires multitouch-aware layouts

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Which CarPlay category should my parking-finder app use?"
- "Apple rejected my CarPlay entitlement request — what's the most likely cause?"
- "Can I show message body text in a CarPlay notification?"
- "How do I add a widget to CarPlay without making it the primary CarPlay experience?"
- "What does CarPlay Ultra require that vanilla CarPlay doesn't?"
- "I want to add a one-time setup screen to my CarPlay app. Is that OK?"

## What This Skill Provides

- **Category selection decision tree** for picking exactly one of the 10 CarPlay categories (Audio, Communication, Driving Task, EV Charging, Fueling, Navigation, Parking, Public Safety, Quick Food Ordering, Voice-Based Conversational), including the minimum iOS version and entitlement string for each
- **The 8 Universal Guidelines** quoted verbatim from the CarPlay Developer Guide — primary purpose, never direct to iPhone, all flows possible in CarPlay, relevant to driving, no gaming or social networking, no message content, templates as intended, SiriKit for voice
- **Per-category design rules** for each of the 10 categories, including the no-lyrics rule for audio apps, the 10 navigation-specific rules, the refresh-rate caps for driving task apps, the QSR simplified-ordering rule, and the voice-only modality rule for conversational apps
- **Anti-rationalization table** that pre-empts the dozen most common "I'll just…" thoughts that violate CarPlay rules, each paired with the specific rule and source
- **Entitlement request flow** — what Apple reviews, why category fit is the most common rejection reason, and how to frame your description so the right reviewer signs off
- **Layout, color, icon, and per-template asset sizes** including the 120×120 and 180×180 icon sizes, the no-black-background rule, and the screen-resolution range (800×480 to 1920×720, plus portrait 900×1200)
- **Error handling for iPhone-locked state** — why CarPlay typically runs with iPhone locked, what storage and Keychain access becomes unavailable, and how to surface errors in CarPlay rather than on the iPhone
- **iOS 26 additions** — widgets in CarPlay (`.systemSmall` family, `.disfavoredLocations([.carPlay])` for unsuitable widgets), Live Activities (`.small` activity family), CarPlay Ultra and multitouch
- **Notification rules** — which categories support notifications, the `.carPlay` authorization option, `allowInCarPlay` category option, and the no-message-body rule for communication apps
- **Expert review checklist** covering category fit, universal guidelines, layout and assets, error and locked-state behavior, and iOS 26 additions — run it before requesting the entitlement

## Key Pattern

### Templates are not custom views

CarPlay apps don't draw their own controls. They pick from a fixed set of templates (list, grid, alert, map, Now Playing, and so on) and supply data; iOS renders the UI onto the vehicle's display. The one exception is the navigation base view, which exists exclusively to draw a map — never overlays, alerts, or custom UI.

### Driver distraction is the framing principle

"CarPlay is designed for the driver, not for passengers." Every rule in the HIG exists to keep eyes on the road. When you find yourself wanting to add a feature "while we're here," ask whether it serves a driving task. If it doesn't, leave it on iPhone.

### iPhone-locked is the default test path

Most CarPlay use happens with iPhone locked in a pocket or center console. Your app cannot access files protected with `NSFileProtectionComplete`, the most restrictive Keychain items, or SQLite databases opened with `SQLITE_OPEN_FILEPROTECTION_COMPLETE`. Test this path early — it surfaces issues that work-when-unlocked testing hides.

## Related

- [now-playing](/skills/integration/now-playing) — Core Now Playing patterns that CarPlay audio apps build on (this is the foundation; CarPlay-specific customization layers on top)
- [now-playing-carplay](/reference/now-playing-carplay) — `CPNowPlayingTemplate` API mechanics, sports mode metadata, and the CarPlay-specific gotchas table for audio apps
- [carplay-templates-ref](/reference/carplay-templates-ref) — Full reference for all 12 CarPlay templates, per-category availability matrix, and template depth limits
- [carplay-navigation-ref](/reference/carplay-navigation-ref) — Navigation-specific reference (base view rules, route guidance lifecycle, instrument cluster, HUD metadata, multitouch on iOS 26+)
- [push-notifications](/skills/integration/push-notifications) — Notification authorization including the `.carPlay` option and `allowInCarPlay` category configuration

## Resources

**Primary sources (Apple):**

- CarPlay HIG — developer.apple.com/design/human-interface-guidelines/carplay
- CarPlay Developer Guide (Feb 2026) — entitlement request, template availability, per-category rules, asset sizes
- CarPlay Audio App Programming Guide (Mar 2017) — legacy MediaPlayer path notes that still apply to iPhone-locked data access

**WWDC**: 2017-719, 2018-213, 2020-10635, 2022-10016, 2025-216
