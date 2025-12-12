---
name: app-discoverability
description: Strategic guide for making iOS apps discoverable in Spotlight, Siri, and system experiences through App Intents, App Shortcuts, Core Spotlight, and NSUserActivity
---

# App Discoverability

Strategic guide for making iOS apps surface in Spotlight search, Siri suggestions, and system experiences. Feed the system metadata across multiple APIs and let iOS decide when to surface your app.

## When to Use This Skill

- Make your app appear in Spotlight search results
- Enable Siri suggestions in relevant contexts
- Add app actions to Action Button (iPhone/Apple Watch Ultra)
- Make app content discoverable system-wide
- Plan discoverability architecture before implementation
- Troubleshoot "why isn't my app being suggested?"

## The 6-Step Discoverability Strategy

This strategy enables comprehensive app discoverability with little effort:

1. **Add App Intents** — Power Spotlight, Siri, and Shortcuts
2. **Add App Shortcuts** — Make actions instantly available with suggested phrases
3. **Index with Core Spotlight** — Make content searchable
4. **Use NSUserActivity** — Mark high-value screens for prediction
5. **Provide Clear Metadata** — Titles and descriptions displayed in Spotlight
6. **System Boosts Usage** — Frequently-used actions get promoted automatically

**Implementation time:** One evening for basic discoverability

## Quick Start Checklist

- [ ] Define 1-3 core App Intents for primary actions
- [ ] Create AppShortcutsProvider with suggested phrases
- [ ] Index top-level content with Core Spotlight
- [ ] Add NSUserActivity to detail screens
- [ ] Test in Spotlight and Shortcuts app
- [ ] Promote shortcuts in UI with SiriTipView

## Related Skills

- [app-intents-ref](/reference/app-intents-ref) — Complete App Intents API reference
- [app-shortcuts-ref](/reference/app-shortcuts-ref) — App Shortcuts implementation guide
- [core-spotlight-ref](/reference/core-spotlight-ref) — Core Spotlight and NSUserActivity reference
