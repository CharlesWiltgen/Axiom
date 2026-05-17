---
name: app-discoverability
description: Multi-API strategy for surfacing your app in Spotlight, Siri, Action Button, and system experiences via App Intents, App Shortcuts, Core Spotlight, and NSUserActivity
---

# App Discoverability

Discipline-enforcing skill for making your app discoverable system-wide. The core rule: no single API is sufficient. Feed the system metadata across App Intents, App Shortcuts, Core Spotlight, and NSUserActivity, then let iOS surface your app based on context and actual usage.

## When to Use

Use this skill when:
- Making your app appear in Spotlight search results
- Enabling Siri suggestions in relevant contexts
- Adding app actions to the Action Button (iPhone, Apple Watch Ultra)
- Indexing app content so the system can surface it
- Planning a discoverability architecture before writing code
- Troubleshooting "why isn't my app being suggested?"

Do NOT use this skill when:
- You just need the App Intents API surface — use `app-intents-ref`
- You're configuring a single AppShortcut — use `app-shortcuts-ref`
- You're working on Core Spotlight indexing details — use `core-spotlight-ref`

## Example Prompts

- "How do I make my app's content show up in Spotlight?"
- "What's the minimum implementation for Siri to suggest my coffee-ordering action?"
- "Why isn't the system surfacing my App Intent?"
- "We added App Intents but no shortcuts are appearing — what's missing?"
- "I want my orders to be searchable from the home screen. Which API?"
- "How do I get my app on the Action Button?"
- "I'm indexing 10,000 items in Core Spotlight and launch is slow. What's the fix?"

## What This Skill Provides

- **Six-step discoverability strategy** — App Intents first (everything builds on them), App Shortcuts second (instant availability without user setup), Core Spotlight third (content indexing), NSUserActivity fourth (high-value screens), clear metadata fifth, usage-based boosting sixth
- **API decision tree** — which framework to use for actions vs. content vs. screens vs. entity linkage
- **"One evening" implementation pattern** — define 1-3 core intents, add an AppShortcutsProvider, index top-level content, attach NSUserActivity to detail screens, test in Spotlight and Shortcuts
- **Batch indexing discipline** — never index everything; batch in 100s during background processing; use `beginBatch()`/`endBatch()` for atomic updates on 50,000+ items
- **Spotlight debugging checklist** — verification steps, common indexing mistakes table (missing `title`, no keywords, stale unique identifiers, quota issues)
- **Six anti-patterns** — implementing intents without AppShortcutsProvider, indexing everything, generic intent metadata, no SiriTipView promotion, marking every screen `isEligibleForPrediction`, leaving NSUserActivity disconnected from App Intent entities
- **Code review checklist** — App Intents, App Shortcuts, Core Spotlight, NSUserActivity, user education, testing
- **Phrase-pattern discipline** — every AppShortcut phrase must include `\(.applicationName)` for Siri to recognize it

## Related

- [app-intents-ref](/reference/app-intents-ref) — complete App Intents API surface
- [app-shortcuts-ref](/reference/app-shortcuts-ref) — AppShortcutsProvider, suggested phrases, SiriTipView, ShortcutsLink
- [core-spotlight-ref](/reference/core-spotlight-ref) — Core Spotlight indexing API and NSUserActivity reference
- [eventkit-contacts](/skills/integration/eventkit-contacts) — if your discoverable content includes calendar events or contacts
