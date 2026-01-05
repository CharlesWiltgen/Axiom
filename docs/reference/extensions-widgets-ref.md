---
name: extensions-widgets-ref
description: Comprehensive API reference for WidgetKit, ActivityKit, and App Groups
skill_type: reference
version: 0.9
apple_platforms: iOS 14+, iPadOS 14+, watchOS 9+
---

# Extensions & Widgets API Reference

Comprehensive API reference for Apple's widget and extension ecosystem. Covers WidgetKit, ActivityKit, Control Center widgets, and App Groups data sharing.

## When to Use This Reference

Use this reference when you need:
- Complete API signatures for WidgetKit or ActivityKit
- Timeline configuration options and refresh policies
- Live Activity data limits and update patterns
- Control Center widget implementation details
- App Groups entitlement and data sharing specifics
- watchOS or visionOS widget platform differences

**For discipline patterns:** See [extensions-widgets](/skills/integration/extensions-widgets) for anti-patterns, troubleshooting, and decision trees.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What are all the TimelineReloadPolicy options and when should I use each?"
- "What's the exact 4KB data limit for Live Activities and what counts toward it?"
- "How do I configure a Control Center widget with async ValueProvider?"
- "What are the differences between widget families on different platforms?"
- "How do I set up App Groups correctly for both targets?"
- "What's the complete ActivityAttributes implementation pattern?"

## What's Covered

### Standard Widgets (iOS 14+)
- Widget protocol and WidgetConfiguration
- TimelineProvider: getTimeline, getSnapshot, placeholder
- TimelineReloadPolicy: atEnd, after, never
- Widget families: systemSmall/Medium/Large, accessory variants
- WidgetCenter for reloads and configuration

### Interactive Widgets (iOS 17+)
- Button and Toggle in widget views
- App Intent integration with perform()
- Configuration intents
- WidgetCenter.shared.reloadAllTimelines()

### Live Activities (iOS 16.1+)
- ActivityAttributes definition
- Dynamic Island layouts (compact, minimal, expanded)
- 4KB content state limit
- Push notification updates
- ActivityKit request and update APIs

### Control Center Controls (iOS 18+)
- Control protocol
- ValueProvider for async state
- ControlWidgetButton and ControlWidgetToggle
- Optimistic UI patterns

### App Groups & Data Sharing
- Entitlement configuration
- UserDefaults(suiteName:) patterns
- Container URLs for file sharing
- Background refresh coordination

### Platform Variations
- watchOS widget considerations
- visionOS widget support
- macOS desktop widgets

### Troubleshooting
- Common failure patterns
- Debug logging techniques
- Memory limit issues

### Expert Review Checklist
- 50+ item checklist for widget code review
- Timeline efficiency validation
- Data sharing verification

## Key Pattern

### Complete Widget Implementation

```swift
// Widget Configuration
@main
struct MyWidget: Widget {
    let kind = "MyWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MyWidgetView(entry: entry)
        }
        .configurationDisplayName("My Widget")
        .description("Shows app data.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// Timeline Provider
struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), data: "Placeholder")
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        completion(SimpleEntry(date: Date(), data: fetchFromCache()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let data = fetchFromSharedDefaults()
        let entry = SimpleEntry(date: Date(), data: data)
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600)))
        completion(timeline)
    }
}
```

## Documentation Scope

This page documents the `axiom-extensions-widgets-ref` reference skill—comprehensive API coverage Claude uses when you need specific API details for widgets and extensions.

**For patterns and troubleshooting:** See [extensions-widgets](/skills/integration/extensions-widgets) for discipline patterns, anti-patterns, and debugging workflows.

## Related

- [extensions-widgets](/skills/integration/extensions-widgets) — Discipline skill with patterns and troubleshooting
- [app-intents-ref](/reference/app-intents-ref) — App Intents for interactive widgets
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Async patterns for data loading

## Resources

**WWDC**: 2025-278, 2024-10157, 2024-10068, 2023-10028, 2023-10194, 2020-10028

**Docs**: /widgetkit, /activitykit, /widgetkit/making-a-configurable-widget
