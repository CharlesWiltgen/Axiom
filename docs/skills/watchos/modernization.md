---
name: modernization
description: Use when migrating WatchKit storyboards to SwiftUI, consolidating dual-target projects to single-target, replacing ClockKit complications with WidgetKit, adding an iOS companion, or preparing a legacy watchOS app for the April 2026 submission gate.
---

# Modernizing a watchOS Project

Incremental migration of a legacy watchOS app along four axes — independence, single target, SwiftUI, and WidgetKit complications — on the path to watchOS 26.

## When to Use This Skill

Use this skill when you're:
- Migrating a WatchKit storyboard / `WKExtensionDelegate` project to SwiftUI + `WKApplicationDelegate`
- Consolidating a Watch App + WatchKit Extension dual-target project to a single target
- Replacing ClockKit complications with WidgetKit accessory widgets
- Adding an iOS companion to a watch-only project
- Planning an incremental migration because a full rewrite isn't viable
- Getting a legacy watchOS 6-era app ready for the April 2026 watchOS 26 SDK submission gate

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "What's the safest order to modernize a watchOS 7 app that still uses storyboards and ClockKit?"
- "My ClockKit complications stopped updating after I shipped one WidgetKit complication. How do I fix this?"
- "Can I consolidate my HealthKit dual-target app into a single target?"
- "How do I keep my users' watch-face customization when migrating from ClockKit to WidgetKit?"
- "How do I add an iOS companion to my existing watch-only app?"

## What This Skill Provides

### The Four Modernization Axes
- Dependent to independent (the user expectation)
- Dual-target to single-target (Xcode's Validate Settings consolidation tool)
- WatchKit storyboards to SwiftUI (full rewrite vs incremental via `WKHostingController`)
- ClockKit to WidgetKit complications (the partial-migration trap)
- Recommended sequencing with a dot-notation diagram explaining why order matters

### Dual-Target Consolidation
- Step-by-step Xcode workflow (Validate Settings, Upgrade to single-target, reassign interface controller classes)
- What Xcode rewrites for you: `WKExtension` to `WKApplication`, delegate rename, Info.plist merging
- The watchOS 9.2 HealthKit inheritance minimum, and why dual-target must stay on watchOS 9.1 or earlier with HealthKit

### ClockKit to WidgetKit
- The partial-migration trap — WidgetKit providing any complication immediately disables all ClockKit callbacks
- Single-release migration rule and the `CLKComplicationWidgetMigrator` setup that preserves watch-face customization
- Required `TimelineProvider` methods (`placeholder`, `getSnapshot`, `getTimeline`) and `WidgetBundle` packaging
- Budget change from ClockKit's per-data-source negotiation to WidgetKit's ~75 timeline reloads per day per complication

### Watch-Only to Watch + iOS Companion
- One-way change workflow (add iOS target, bundle ID prefix rule, embed watchOS app, `WKCompanionAppBundleIdentifier`)
- Flipping `WKWatchOnly` to `NO` on the Watch App target

### Submission and Deprecation
- watchOS SDK and 64-bit / ARM64 requirements for the April 2026 App Store gate
- `modernization-helper` agent for catching residue — `WKExtensionDelegate`, `NavigationView`, unmigrated `CLKComplicationDataSource`, leftover `WKHostingController` wrappers

## Key Pattern

The single most important rule, emphasized by Apple: the moment your WidgetKit extension provides any complication, the system stops calling ClockKit callbacks on every user device. Migrate every complication in one release and ship `CLKComplicationWidgetMigrator` alongside so watch-face customization survives the update.

## Documentation Scope

This page documents the `modernization` skill in the `axiom-watchos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions, including the full consolidation checklist, the `CLKComplicationWidgetMigrator` worked example, and the migration-sequencing diagram.

**For the target architecture after migration** — Use [platform-basics](/skills/watchos/) when building the SwiftUI App + `WKApplicationDelegate` shape, and [smart-stack-and-complications](/skills/watchos/smart-stack-and-complications) when building the WidgetKit complications you're migrating to.

## Related

- [smart-stack-and-complications](/skills/watchos/smart-stack-and-complications) — The destination architecture for ClockKit migration and RelevanceKit adoption
- [controls-and-live-activities](/skills/watchos/controls-and-live-activities) — watchOS 26 control surfaces that didn't exist in legacy projects and are worth adopting post-migration
- [swiftui-nav](/skills/ui-design/swiftui-nav) — `NavigationStack` replaces `NavigationView` once storyboards are gone
- [app-store-submission](/skills/shipping/app-store-submission) — April 2026 watchOS 26 SDK submission gate requirements

## Resources

**WWDC**: 2023-10029, 2022-10051, 2022-10050, 2020-10177

**Docs**: /technotes/tn3157-updating-your-watchos-project-for-swiftui-and-widgetkit, /widgetkit/converting-a-clockkit-app, /watchkit/wkapplication, /swiftui/wkapplicationdelegateadaptor, /clockkit/clkcomplicationwidgetmigrator

**Skills**: axiom-watchos, axiom-swiftui, axiom-shipping
