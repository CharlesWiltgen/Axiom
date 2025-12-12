---
name: app-shortcuts-ref
description: Reference — Complete App Shortcuts API guide for instant Siri/Spotlight availability with AppShortcutsProvider, suggested phrases, and discovery UI components for iOS 16+
---

# App Shortcuts

Complete reference for App Shortcuts framework—pre-configured App Intents that work instantly after install.

## When to Use This Skill

- Implement AppShortcutsProvider for your app
- Add suggested phrases for Siri invocation
- Configure instant Spotlight availability
- Create parameterized shortcuts (skip Siri clarification)
- Use NegativeAppShortcutPhrase to prevent false positives (iOS 17+)
- Promote shortcuts with SiriTipView
- Update shortcuts dynamically with updateAppShortcutParameters()
- Debug shortcuts not appearing in Shortcuts app or Spotlight
- Choose between App Intents and App Shortcuts

## Key Concepts

### AppShortcutsProvider

Your app's single source of App Shortcuts:

```swift
struct MyAppShortcuts: AppShortcutsProvider {
    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OrderIntent(),
            phrases: ["Order in \(.applicationName)"],
            shortTitle: "Order",
            systemImageName: "cup.and.saucer.fill"
        )
    }

    static var shortcutTileColor: ShortcutTileColor = .tangerine
}
```

### Suggested Phrases

Phrases users say to Siri or type in Spotlight:

```swift
phrases: [
    "Order coffee in \(.applicationName)",
    "Get coffee from \(.applicationName)"
]
```

The system uses these exact phrases for Siri activation and Spotlight suggestions.

### Discovery UI Components

- **SiriTipView** — Show users the spoken phrase for a shortcut
- **ShortcutsLink** — Link to your app's page in Shortcuts app
- **ShortcutTileColor** — Brand your shortcuts with app colors

## Where App Shortcuts Appear

Once implemented, your App Shortcuts appear in:

- Siri (voice activation)
- Spotlight (search results)
- Shortcuts app (pre-populated)
- Action Button (iPhone 15 Pro, Apple Watch Ultra)
- Control Center (quick controls)
- Lock Screen widgets
- Apple Pencil Pro (squeeze gesture)

All locations activate immediately after install.

## Related Skills

- [app-intents-ref](/reference/app-intents-ref) — Complete App Intents implementation reference
- [app-discoverability](/reference/app-discoverability) — Strategic guide for making apps discoverable
- [core-spotlight-ref](/reference/core-spotlight-ref) — Core Spotlight and NSUserActivity integration
