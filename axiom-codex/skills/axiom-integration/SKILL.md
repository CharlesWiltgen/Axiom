---
name: axiom-integration
description: Use when integrating ANY iOS system feature - Siri, Shortcuts, widgets, IAP, localization, privacy, alarms, calendar, reminders, contacts, background tasks, push notifications, timers. Covers App Intents, WidgetKit, StoreKit, EventKit, Contacts.
license: MIT
---

# iOS System Integration

**You MUST use this skill for ANY iOS system integration including Siri, Shortcuts, widgets, in-app purchases, background tasks, push notifications, and more.**

## Quick Reference

| Symptom / Task | Reference |
|----------------|-----------|
| Siri, App Intents, entity queries | See `skills/app-intents-ref.md` |
| App Shortcuts, phrases, Spotlight | See `skills/app-shortcuts-ref.md` |
| App discoverability strategy | See `skills/app-discoverability.md` |
| Core Spotlight indexing | See `skills/core-spotlight-ref.md` |
| LLM search over app content, SpotlightSearchTool | See `skills/core-spotlight-ref.md` |
| Widgets, Control Center controls | See `skills/extensions-widgets.md` |
| Widget API reference | See `skills/extensions-widgets-ref.md` |
| Live Activities, Dynamic Island, push-to-start, broadcast | See `skills/live-activities.md` |
| Live Activities / ActivityKit API reference | See `skills/live-activities-ref.md` |
| Apple Pay (physical goods, services, donations) | **Use `axiom-payments` instead** |
| In-app purchases, subscriptions | See `skills/in-app-purchases.md` |
| StoreKit 2 API reference | See `skills/storekit-ref.md` |
| Commitment billing plans, subscription bundles/suites, group/volume subscriptions, retention offers, offer codes | See `skills/storekit-ref.md` |
| In-game content (Unity plug-ins, asset packs + IAP) | See `skills/in-app-purchases.md`, `skills/background-assets.md` |
| Calendar events, reminders (EventKit) | See `skills/eventkit.md` |
| EventKit API reference | See `skills/eventkit-ref.md` |
| Contacts, contact picker | See `skills/contacts.md` |
| Contacts API reference | See `skills/contacts-ref.md` |
| Localization, String Catalogs | See `skills/localization.md` |
| Apple terminology matching, glossary, pseudolocalization, TMS | See `skills/localization-research-ref.md` |
| Privacy manifests, permissions UX | See `skills/privacy-ux.md` |
| Bluetooth/Wi-Fi accessory pairing (AccessorySetupKit, iOS 18+) | See `skills/accessorysetupkit.md` |
| AccessorySetupKit API (descriptor fields, events, auth-settings flow) | See `skills/accessorysetupkit-ref.md` |
| Measure distance/direction to a paired accessory (Bluetooth Channel Sounding, iOS 27) | See `skills/accessorysetupkit-ref.md` (Part 7) |
| Weather data, forecasts, attribution (WeatherKit) | See `skills/weatherkit.md` |
| VoIP calls, CallKit, VoIP push, caller ID/blocking | See `skills/callkit-livecommunicationkit.md` |
| CallKit / LiveCommunicationKit / IdentityLookup API reference | See `skills/callkit-livecommunicationkit-ref.md` |
| AlarmKit (iOS 26+) | See `skills/alarmkit-ref.md` |
| Timer patterns, scheduling | See `skills/timer-patterns.md` |
| Timer API reference | See `skills/timer-patterns-ref.md` |
| Background tasks, BGTaskScheduler | See `skills/background-processing.md` |
| Background task debugging | See `skills/background-processing-diag.md` |
| Background task API reference | See `skills/background-processing-ref.md` |
| Background Assets (large content delivery, FM adapter shipping, Apple-hosted vs server-hosted) | See `skills/background-assets.md` |
| Background Assets API reference (incl. localized asset packs, Steam conversion) | See `skills/background-assets-ref.md` |
| On-Demand Resources migration (deprecated in 27) | See `skills/background-assets.md` |
| Push notifications, APNs | See `skills/push-notifications.md` |
| Push notification debugging | See `skills/push-notifications-diag.md` |
| Push notification API reference | See `skills/push-notifications-ref.md` |

## Decision Tree

```dot
digraph integration {
    start [label="Integration task" shape=ellipse];
    what [label="Which system feature?" shape=diamond];

    start -> what;
    what -> "skills/app-intents-ref.md" [label="Siri / App Intents"];
    what -> "skills/app-shortcuts-ref.md" [label="Shortcuts / phrases"];
    what -> "skills/app-discoverability.md" [label="discoverability\nstrategy"];
    what -> "skills/extensions-widgets.md" [label="widgets /\nControl Center"];
    what -> "skills/live-activities.md" [label="Live Activities /\nDynamic Island"];
    what -> "skills/in-app-purchases.md" [label="IAP / subscriptions"];
    what -> "skills/eventkit.md" [label="calendar / reminders"];
    what -> "skills/contacts.md" [label="contacts"];
    what -> "skills/localization.md" [label="localization"];
    what -> "skills/privacy-ux.md" [label="privacy / permissions"];
    what -> "skills/accessorysetupkit.md" [label="accessory pairing\n(Bluetooth/Wi-Fi)"];
    what -> "skills/weatherkit.md" [label="weather / forecasts"];
    what -> "skills/callkit-livecommunicationkit.md" [label="VoIP calls /\ncaller ID"];
    what -> "skills/alarmkit-ref.md" [label="alarms (iOS 26+)"];
    what -> "skills/timer-patterns.md" [label="timers"];
    what -> "skills/background-processing.md" [label="background tasks"];
    what -> "skills/background-assets.md" [label="large asset delivery /\nFM adapter shipping"];
    what -> "skills/push-notifications.md" [label="push notifications"];
}
```

1. Siri / App Intents / entity queries? → `skills/app-intents-ref.md`
2. App Shortcuts / phrases? → `skills/app-shortcuts-ref.md`
3. App discoverability / Spotlight strategy? → `skills/app-discoverability.md`, `skills/core-spotlight-ref.md`
3a. LLM search over your app's index (SpotlightSearchTool, LanguageModelSession tool-calling)? → `skills/core-spotlight-ref.md`
4. Widgets / Control Center controls? → `skills/extensions-widgets.md`, `skills/extensions-widgets-ref.md`
4a. Live Activities / Dynamic Island / push-to-start / broadcast? → `skills/live-activities.md`, `skills/live-activities-ref.md`
5. In-app purchases / StoreKit? → `skills/in-app-purchases.md`, `skills/storekit-ref.md`
5a. Subscription billing plans (12-month commitment), bundles/suites, group/volume purchasing, retention offers, offer-code redemption? → `skills/storekit-ref.md`
6. Calendar / reminders / EventKit? → `skills/eventkit.md`, `skills/eventkit-ref.md`
7. Contacts / contact picker? → `skills/contacts.md`, `skills/contacts-ref.md`
8. Localization mechanics (String Catalogs, plurals, RTL)? → `skills/localization.md`
8a. Localization research (Apple terminology, glossary, pseudolocalization, TMS)? → `skills/localization-research-ref.md`
9. Privacy / permissions? → `skills/privacy-ux.md`
10. Alarms (iOS 26+)? → `skills/alarmkit-ref.md`
10a. Bluetooth/Wi-Fi accessory pairing (iOS 18+)? → `skills/accessorysetupkit.md`
10b. Weather data / forecasts / attribution (WeatherKit)? → `skills/weatherkit.md`
10c. VoIP calls / CallKit / VoIP push / caller ID / blocking? → `skills/callkit-livecommunicationkit.md`
11. Timers? → `skills/timer-patterns.md`, `skills/timer-patterns-ref.md`
12. Background tasks / BGTaskScheduler? → `skills/background-processing.md`, `skills/background-processing-diag.md`, `skills/background-processing-ref.md`
12a. Large asset delivery (game packs, localized asset packs, ML models, Foundation Models adapters, ODR migration)? → `skills/background-assets.md`, `skills/background-assets-ref.md`
13. Push notifications? → `skills/push-notifications.md`, `skills/push-notifications-diag.md`, `skills/push-notifications-ref.md`
14. Want IAP audit? → Launch `iap-auditor` agent
15. Want full IAP implementation? → Launch `iap-implementation` agent
16. Camera / photos / audio / haptics / ShazamKit? → **Use `axiom-media` instead**

## Cross-Domain Routing

**Widget + data sync** (widget not showing updated data):
- Widget timeline not refreshing → **stay here** (extensions-widgets)
- SwiftData/Core Data not shared with extension → **also invoke axiom-data** (App Groups)

**App Intents + security** (lock-screen intent risk, prompt injection via Siri):
- Intent/schema API surface → **stay here** (app-intents-ref)
- Threat modeling, authenticationPolicy gating, schema risk metadata → **also invoke axiom-security** (skills/agentic-security.md)

**Live Activity + push notification**:
- ActivityKit push token / broadcast setup → **stay here** (live-activities)
- Push delivery failures → **also invoke axiom-networking** (networking-diag)
- Entitlements/certificates → **also invoke axiom-build**

**VoIP push + CallKit** (VoIP app killed / pushes stopped arriving):
- VoIP push must report a call to CallKit → **stay here** (callkit-livecommunicationkit, Part 1)
- PushKit token vs APNs delivery → **stay here** (push-notifications for the APNs contrast)
- Call audio silent/misrouted → **also invoke axiom-media** (AVAudioSession category)

**Push + background processing** (silent push not triggering background work):
- Push payload and delivery → **stay here** (push-notifications-diag)
- BGTaskScheduler execution → **stay here** (background-processing)

**In-game content** (StoreKit + Background Assets, Unity plug-ins):
- Asset packs, IAP mechanics, payment sheet, mock server → **stay here** (background-assets, in-app-purchases)
- Game input, rendering, game-side performance → **also invoke axiom-games / axiom-graphics**

**Calendar/Contacts + data sync**:
- EventKit/Contacts data issues → **stay here**
- Shared data with widget via App Groups → **also invoke axiom-data**

#### watchOS surfaces
- Complications + Smart Stack widgets → See axiom-watchos (skills/smart-stack-and-complications.md)
- Live Activities on Apple Watch → See axiom-watchos (skills/controls-and-live-activities.md)

## Conflict Resolution

**integration vs axiom-build**: When system features fail with entitlement/certificate errors:
- Use **axiom-build** for signing and provisioning issues
- Use **integration** for API usage and permission patterns

**integration vs axiom-data**: When widgets or extensions can't access shared data:
- App Groups and shared containers → **axiom-data**
- Specifically: GRDB/SQLite database shared with widget/extension/Live Activity → See axiom-data (skills/grdb-app-groups.md)
- Widget timeline, Live Activity updates → **integration**

**integration vs axiom-media**: When media features overlap with system features:
- Camera/photo/audio/haptics code → **axiom-media**
- Privacy manifests for camera/microphone → **stay here** (privacy-ux)
- Background audio mode → **stay here** (background-processing)

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "App Intents are just a protocol conformance" | App Intents have parameter validation, entity queries, and background execution. |
| "Widgets are simple, I've done them before" | Widgets have timeline, interactivity, and Live Activity patterns that evolve yearly. |
| "Localization is just String Catalogs" | Xcode 26 has type-safe localization, generated symbols, and #bundle macro. |
| "Push notifications are just a payload and a token" | Token lifecycle, Focus levels, service extension gotchas cause 80% of push bugs. |
| "I'll just bundle the assets, it's simpler" | Bundling ≥10 MB inflates first-install size and pays the cost every update. Background Assets ships with App Store install-progress integration; FM adapters can't be bundled at all. See `skills/background-assets.md`. |
| "I'll use URLSession for the asset download" | URLSession doesn't integrate with App Store install progress, charging-aware scheduling, or per-app quota — and can't reach Apple-hosted asset packs at all. Background Assets is the supported channel. |
| "On-Demand Resources still works fine" | The entire `NSBundleResourceRequest` family is deprecated in the 27 SDKs ("Use Background Assets instead"). Migrate ODR tags to asset packs. See `skills/background-assets.md`. |
| "Just request full Calendar access" | Most apps only need to add events — EventKitUI does that with zero permissions. |
| "I'll request Bluetooth permission and scan for the accessory" | AccessorySetupKit (iOS 18+) pairs in one tap with no broad Bluetooth prompt and grants scoped BT+Wi-Fi access. See `skills/accessorysetupkit.md`. |
| "I'll process the VoIP push, then report the call when ready" | iOS terminates your app and stops delivering VoIP pushes if a push doesn't report a call *before* completion. Report first, fetch after. See `skills/callkit-livecommunicationkit.md`. |
| "I'll activate the audio session when the call connects" | CallKit owns the audio session — activate only in `provider(_:didActivate:)` or audio is silent/misrouted. See `skills/callkit-livecommunicationkit.md`. |
| "I'll use CNContactStore directly for picking" | CNContactPickerViewController needs no authorization and shows all contacts. |

## Example Invocations

User: "How do I add Siri support?"
→ Read: `skills/app-intents-ref.md`

User: "My widget isn't updating"
→ Read: `skills/extensions-widgets.md`

User: "My Live Activity won't update" / "How do I add a Dynamic Island?" / "Broadcast scores to thousands of Live Activities"
→ Read: `skills/live-activities.md`

User: "Implement in-app purchases with StoreKit 2"
→ Read: `skills/in-app-purchases.md`

User: "Offer a monthly plan with a 12-month commitment" / "Sell subscription seats to teams"
→ Read: `skills/storekit-ref.md`

User: "Deliver level packs only in the player's language" / "Convert my Steam depots to asset packs"
→ Read: `skills/background-assets-ref.md`

User: "Let the on-device model answer questions about my app's content"
→ Read: `skills/core-spotlight-ref.md`

User: "How do I implement push notifications?"
→ Read: `skills/push-notifications.md`

User: "Push notifications work in dev but not production"
→ Read: `skills/push-notifications-diag.md`

User: "My background task never runs"
→ Read: `skills/background-processing-diag.md`

User: "How do I add an event to the user's calendar?"
→ Read: `skills/eventkit.md`

User: "How do I let users pick a contact?"
→ Read: `skills/contacts.md`

User: "How do I pair a Bluetooth accessory without the permission prompt?"
→ Read: `skills/accessorysetupkit.md`

User: "How do I show the weather forecast with WeatherKit?" / "Why was my weather app rejected?"
→ Read: `skills/weatherkit.md`

User: "My VoIP app gets killed" / "How do I handle CallKit incoming calls?" / "How do I block spam callers?"
→ Read: `skills/callkit-livecommunicationkit.md`

User: "Review my in-app purchase implementation"
→ Launch: `iap-auditor` agent
