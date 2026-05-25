---
name: extensions-widgets
description: Widgets and Control Center controls with correct timeline and data sharing patterns
skill_type: discipline
version: 0.9
apple_platforms: iOS 14+, iPadOS 14+, watchOS 9+
---

# Extensions & Widgets

Widget development patterns for Home Screen, Lock Screen, StandBy, and Control Center controls. Covers timeline management, data sharing between app and extensions, and extension lifecycle.

> **Live Activities** (Dynamic Island, ActivityKit, push/broadcast) have their own page: [live-activities](/skills/integration/live-activities).

## When to Use This Skill

Use this skill when you're:
- Implementing any widget (Home Screen, Lock Screen, StandBy, Control Center)
- Widget shows stale data or doesn't update
- Widget not appearing in gallery
- Interactive buttons not responding
- Control Center control is unresponsive
- Sharing data between main app and widget

**Mental model:** Widgets are archived snapshots on a timeline, not live views. They render, get archived, and the system displays the snapshot.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "My widget isn't updating even after I change data in the main app."
- "How do I share data between my app and widget?"
- "Widget shows old data even after I update the app."
- "Control Center control takes forever to respond."
- "Interactive widget button does nothing when tapped."
- "Widget gallery doesn't show my widget."

## What This Skill Provides

### Timeline Management
- TimelineProvider patterns (getTimeline, getSnapshot, placeholder)
- Refresh budgets and policies
- Manual reload with WidgetCenter
- When widgets actually update

### Data Sharing
- App Groups entitlement setup
- Shared UserDefaults with suite name
- Container URLs for file sharing
- Why widgets can't see main app data directly

### Control Center Controls (iOS 18+)
- ValueProvider for async state
- Optimistic UI patterns
- Control action handling

### Interactive Widgets (iOS 17+)
- App Intent integration
- Button/Toggle in widget views
- perform() implementation
- WidgetCenter reload after actions

### Common Anti-Patterns
- Network calls in widget view (use TimelineProvider)
- Missing App Groups entitlement
- Wrong UserDefaults suite name
- Forgetting WidgetCenter.shared.reloadAllTimelines()

## Key Pattern

### Data Sharing Between App and Widget

```swift
// 1. Add App Groups entitlement to BOTH targets
// Capabilities → App Groups → group.com.yourapp.shared

// 2. Use shared UserDefaults (NOT .standard)
let sharedDefaults = UserDefaults(suiteName: "group.com.yourapp.shared")
sharedDefaults?.set(value, forKey: "myKey")

// 3. Reload widget after data changes
WidgetCenter.shared.reloadAllTimelines()

// ❌ WRONG — Widget can't see this
UserDefaults.standard.set(value, forKey: "key")
```

### Timeline Provider Pattern

```swift
struct Provider: TimelineProvider {
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        // ✅ Fetch data here (TimelineProvider has network access)
        let data = fetchFromSharedDefaults()

        let entry = SimpleEntry(date: Date(), data: data)
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600)))
        completion(timeline)
    }
}

// ❌ WRONG — Widget view has no network access
struct WidgetView: View {
    var body: some View {
        Text("").onAppear {
            URLSession.shared.data(from: url) // Won't work!
        }
    }
}
```

## Documentation Scope

This page documents the `axiom-integration` skill—widget development patterns Claude uses when you're implementing Home Screen widgets or Control Center controls.

**For comprehensive API reference:** See [extensions-widgets-ref](/reference/extensions-widgets-ref) for complete API coverage, troubleshooting, and expert review checklist.

**For App Intents:** See [app-intents-ref](/reference/app-intents-ref) for interactive widget button implementation.

## Related

- [live-activities](/skills/integration/live-activities) — Live Activities & Dynamic Island (extracted from this skill)
- [extensions-widgets-ref](/reference/extensions-widgets-ref) — Complete API reference, troubleshooting, expert checklist
- [app-intents-ref](/reference/app-intents-ref) — App Intents for interactive widgets
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Async patterns for data fetching
- [swiftdata](/skills/persistence/swiftdata) — Using SwiftData with App Groups

## Resources

**WWDC**: 2025-278, 2024-10157, 2023-10028

**Docs**: /widgetkit, /widgetkit/controlling-interactivity-and-appearance
