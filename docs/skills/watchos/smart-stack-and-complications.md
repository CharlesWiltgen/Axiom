---
name: smart-stack-and-complications
description: Use when building watch complications, adopting RelevanceKit for Smart Stack placement, choosing between timeline and relevant widgets, making widgets configurable, or adding APNs push updates on watchOS 26.
---

# Smart Stack and Complications

Watch complications, Smart Stack widgets, and RelevanceKit for surfacing the right content at the right moment on Apple Watch.

## When to Use This Skill

Use this skill when you're:
- Building a watch complication in `accessoryCircular`, `accessoryRectangular`, `accessoryInline`, `accessoryCorner`, or `AccessoryWidgetGroup`
- Deciding between a timeline widget and a watchOS 26 relevant widget for Smart Stack placement
- Adopting RelevanceKit with `RelevantContext`, `WidgetRelevance`, or `WidgetRelevanceAttribute`
- Making a widget or control configurable from the watch face or Smart Stack
- Sending APNs push updates to watch widgets on watchOS 26
- Deduplicating Smart Stack cards when a timeline widget and a relevant widget cover the same event

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I make my complication show up in the Smart Stack only when the user is near a beach?"
- "Should I use a timeline widget or a relevant widget for a calendar of upcoming surf sessions?"
- "My Smart Stack shows two cards for the same event — how do I deduplicate them?"
- "How do I make my watchOS 26 widget user-configurable?"
- "My ClockKit complication stopped updating after I added a WidgetKit complication. Why?"

## What This Skill Provides

### Surface Selection
- Decision table mapping primary purpose (action, info, bounded event) to control, widget, or Live Activity
- The four watchOS complication families plus `AccessoryWidgetGroup`, with placement and content guidance
- Why `accessoryCorner` is Infograph-only and when to avoid wasting it

### RelevanceKit on watchOS 26
- `RelevantContext` types including the new location-by-MapKit-category option
- `RelevanceEntry`, `RelevanceEntriesProvider`, and `RelevanceConfiguration` roles compared to timeline equivalents
- Worked example building a beach-events relevant widget end to end
- Three-level preview pattern (view-only, provider + relevance, full provider)

### Timeline vs Relevant Widgets
- When each type fits (steady content vs multiple simultaneous cards)
- `associatedKind(_:)` for deduplicating overlapping timeline and relevant widgets in the Smart Stack
- Configurable widgets on watchOS 26 — returning an empty recommendations array to opt in

### Watch-Aware Integrations
- Free Smart Stack suggestions for HealthKit-recording workout apps (activity type, accurate times, `HKWorkoutRouteBuilder`)
- APNs widget push updates on watchOS 26 and when to prefer them over Watch Connectivity's 50/day complication budget
- The ClockKit-to-WidgetKit partial-migration trap summarized; full workflow in the modernization skill

## Key Pattern

Guard `RelevantContext.location(category:)` — it returns `nil` on devices that don't support the category, and force-unwrapping crashes production:

```swift
func relevance() async -> WidgetRelevance<Void> {
    guard let context = RelevantContext.location(category: .beach) else {
        return WidgetRelevance<Void>([])
    }
    return WidgetRelevance([WidgetRelevanceAttribute(context: context)])
}
```

## Documentation Scope

This page documents the `smart-stack-and-complications` skill in the `axiom-watchos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions, including the full RelevanceKit worked example and the common-mistakes table.

**For the ClockKit to WidgetKit migration workflow** — Use [modernization](/skills/watchos/modernization) when converting existing complications, preserving watch-face customization with `CLKComplicationWidgetMigrator`, and planning a single-release cutover.

## Related

- [controls-and-live-activities](/skills/watchos/controls-and-live-activities) — Controls and Live Activities share Smart Stack real estate with widgets; the decision table helps pick the right surface
- [watch-connectivity](/skills/watchos/watch-connectivity) — `transferCurrentComplicationUserInfo` as a wake-on-change signal, and the 50/day transfer budget that makes APNs preferable for high-frequency updates
- [background-and-networking](/skills/watchos/background-and-networking) — Widget timeline refresh strategies within watchOS's networking and background constraints
- [modernization](/skills/watchos/modernization) — Covers the partial-migration trap when ClockKit and WidgetKit coexist
- [extensions-widgets](/skills/integration/extensions-widgets) — iOS-side widgets and general WidgetKit patterns shared with the watch

## Resources

**WWDC**: 2025-334, 2025-278, 2023-10029, 2023-10309, 2023-10027, 2022-10050, 2022-10051

**Docs**: /widgetkit/creating-accessory-widgets-and-watch-complications, /widgetkit/converting-a-clockkit-app, /widgetkit/relevanceconfiguration, /relevancekit, /relevancekit/relevantcontext

**Skills**: axiom-watchos, axiom-integration, axiom-health
