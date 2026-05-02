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
| Widgets, Live Activities, Control Center | See `skills/extensions-widgets.md` |
| Widget/Live Activity API reference | See `skills/extensions-widgets-ref.md` |
| Apple Pay (physical goods, services, donations) | **Use `axiom-payments` instead** |
| In-app purchases, subscriptions | See `skills/in-app-purchases.md` |
| StoreKit 2 API reference | See `skills/storekit-ref.md` |
| Calendar events, reminders (EventKit) | See `skills/eventkit.md` |
| EventKit API reference | See `skills/eventkit-ref.md` |
| Contacts, contact picker | See `skills/contacts.md` |
| Contacts API reference | See `skills/contacts-ref.md` |
| Localization, String Catalogs | See `skills/localization.md` |
| Apple terminology matching, glossary, pseudolocalization, TMS | See `skills/localization-research-ref.md` |
| Privacy manifests, permissions UX | See `skills/privacy-ux.md` |
| AlarmKit (iOS 26+) | See `skills/alarmkit-ref.md` |
| Timer patterns, scheduling | See `skills/timer-patterns.md` |
| Timer API reference | See `skills/timer-patterns-ref.md` |
| Background tasks, BGTaskScheduler | See `skills/background-processing.md` |
| Background task debugging | See `skills/background-processing-diag.md` |
| Background task API reference | See `skills/background-processing-ref.md` |
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
    what -> "skills/extensions-widgets.md" [label="widgets / Live Activities\n/ Control Center"];
    what -> "skills/in-app-purchases.md" [label="IAP / subscriptions"];
    what -> "skills/eventkit.md" [label="calendar / reminders"];
    what -> "skills/contacts.md" [label="contacts"];
    what -> "skills/localization.md" [label="localization"];
    what -> "skills/privacy-ux.md" [label="privacy / permissions"];
    what -> "skills/alarmkit-ref.md" [label="alarms (iOS 26+)"];
    what -> "skills/timer-patterns.md" [label="timers"];
    what -> "skills/background-processing.md" [label="background tasks"];
    what -> "skills/push-notifications.md" [label="push notifications"];
}
```

1. Siri / App Intents / entity queries? → `skills/app-intents-ref.md`
2. App Shortcuts / phrases? → `skills/app-shortcuts-ref.md`
3. App discoverability / Spotlight strategy? → `skills/app-discoverability.md`, `skills/core-spotlight-ref.md`
4. Widgets / Live Activities / Control Center? → `skills/extensions-widgets.md`, `skills/extensions-widgets-ref.md`
5. In-app purchases / StoreKit? → `skills/in-app-purchases.md`, `skills/storekit-ref.md`
6. Calendar / reminders / EventKit? → `skills/eventkit.md`, `skills/eventkit-ref.md`
7. Contacts / contact picker? → `skills/contacts.md`, `skills/contacts-ref.md`
8. Localization mechanics (String Catalogs, plurals, RTL)? → `skills/localization.md`
8a. Localization research (Apple terminology, glossary, pseudolocalization, TMS)? → `skills/localization-research-ref.md`
9. Privacy / permissions? → `skills/privacy-ux.md`
10. Alarms (iOS 26+)? → `skills/alarmkit-ref.md`
11. Timers? → `skills/timer-patterns.md`, `skills/timer-patterns-ref.md`
12. Background tasks / BGTaskScheduler? → `skills/background-processing.md`, `skills/background-processing-diag.md`, `skills/background-processing-ref.md`
13. Push notifications? → `skills/push-notifications.md`, `skills/push-notifications-diag.md`, `skills/push-notifications-ref.md`
14. Want IAP audit? → Launch `iap-auditor` agent
15. Want full IAP implementation? → Launch `iap-implementation` agent
16. Camera / photos / audio / haptics / ShazamKit? → **Use `axiom-media` instead**

## Cross-Domain Routing

**Widget + data sync** (widget not showing updated data):
- Widget timeline not refreshing → **stay here** (extensions-widgets)
- SwiftData/Core Data not shared with extension → **also invoke axiom-data** (App Groups)

**Live Activity + push notification**:
- ActivityKit push token setup → **stay here** (extensions-widgets)
- Push delivery failures → **also invoke axiom-networking** (networking-diag)
- Entitlements/certificates → **also invoke axiom-build**

**Push + background processing** (silent push not triggering background work):
- Push payload and delivery → **stay here** (push-notifications-diag)
- BGTaskScheduler execution → **stay here** (background-processing)

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
| "Just request full Calendar access" | Most apps only need to add events — EventKitUI does that with zero permissions. |
| "I'll use CNContactStore directly for picking" | CNContactPickerViewController needs no authorization and shows all contacts. |

## Example Invocations

User: "How do I add Siri support?"
→ Read: `skills/app-intents-ref.md`

User: "My widget isn't updating"
→ Read: `skills/extensions-widgets.md`

User: "Implement in-app purchases with StoreKit 2"
→ Read: `skills/in-app-purchases.md`

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

User: "Review my in-app purchase implementation"
→ Launch: `iap-auditor` agent
