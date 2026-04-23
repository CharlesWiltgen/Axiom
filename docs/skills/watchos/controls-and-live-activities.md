---
name: controls-and-live-activities
description: Use when building watch controls for Control Center, Smart Stack, or the Ultra Action button, surfacing iOS Live Activities on Apple Watch, wiring Double Tap to primary actions, or choosing between static and App Intent control configurations.
---

# Controls and Live Activities on Apple Watch

Controls (buttons and toggles) and Live Activities on watchOS 26 — where they live, how to wire them, and how the watch relays actions to iPhone when needed.

## When to Use This Skill

Use this skill when you're:
- Building a control that lands in Control Center, Smart Stack, or the Apple Watch Ultra Action button
- Deciding whether an iPhone-only control covers your case or the Watch app needs its own `ControlWidget`
- Choosing between `StaticControlConfiguration` and `AppIntentControlConfiguration`
- Surfacing an existing iOS Live Activity on a paired Apple Watch
- Wiring Double Tap to the primary action on watchOS 11+
- Debugging a control that shows up in the gallery but fails to fire on the watch

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Why doesn't my iPhone control show up on Apple Watch?"
- "How do I build a configurable control that lets the user pick which timer to run?"
- "My Live Activity looks fine on iPhone but is illegible on the watch — what's wrong?"
- "Do I need a separate Watch app to put a control on Apple Watch?"
- "How do I make my control respond to Double Tap without extra wiring?"

## What This Skill Provides

### Surface Selection
- Decision table matching user intent (toggle a setting, trigger an action, open the app, glance at info, follow a bounded event) to control, widget, or Live Activity
- Why controls whose action foregrounds iPhone are filtered out of watch placement, and the `OpenIntent` rule that follows

### Control Anatomy
- `ControlWidget` + `StaticControlConfiguration` or `AppIntentControlConfiguration` + `AppIntent` / `SetValueIntent`
- Worked examples for a static toggle (system-managed `value`), a fire-and-forget button, and a watchOS 26 configurable control with `.promptsForUserConfiguration()`
- `WidgetBundle` ordering as gallery ordering

### Double Tap and the Ultra Action Button
- Why `ControlWidgetToggle` and `ControlWidgetButton` get Double Tap for free
- `handGestureShortcut(.primaryAction)` for non-control surfaces
- Keeping a tappable equivalent because users can disable Double Tap globally

### Live Activities on Watch
- iPhone authors, creates, updates, and ends Live Activities; the watch displays — the watch cannot initiate them
- Designing the minimal presentation first because the watch uses it most often
- `ActivityAttributes` structure, `ActivityConfiguration` view layer, and `NSSupportsLiveActivities` plist requirement
- Constraints that apply on watch too: 8-hour active limit, 4 KB payload cap, no network or location access inside the view, image size limits

## Key Pattern

For a stateful control, treat `value` as read-only system input and mutate your model to match — never set `value` manually:

```swift
struct ToggleTimerIntent: SetValueIntent {
    @Parameter(title: "Timer is running")
    var value: Bool

    func perform() async throws -> some IntentResult {
        TimerService.shared.setRunning(value)
        return .result()
    }
}
```

## Documentation Scope

This page documents the `controls-and-live-activities` skill in the `axiom-watchos` suite. The skill file contains comprehensive guidance Claude uses when answering your questions, including worked examples for each control style, the full `ActivityConfiguration` pattern with Dynamic Island regions, and the common-mistakes table.

**For widget surfaces that share Smart Stack real estate** — Use [smart-stack-and-complications](/skills/watchos/smart-stack-and-complications) when picking between a control, a widget, and a Live Activity, or when adopting RelevanceKit.

## Related

- [smart-stack-and-complications](/skills/watchos/smart-stack-and-complications) — Widget vs control vs Live Activity decision-making and RelevanceKit
- [watch-connectivity](/skills/watchos/watch-connectivity) — Syncing control state with the paired iPhone when the watch authors the source of truth
- [extensions-widgets](/skills/integration/extensions-widgets) — iOS-side ActivityKit setup and general App Intent patterns
- [app-intents-ref](/reference/app-intents-ref) — App Intent protocol reference for the intents that back controls
- [push-notifications](/skills/integration/push-notifications) — APNs token flow for pushing Live Activity updates that propagate to the watch

## Resources

**WWDC**: 2025-334, 2024-10157, 2024-10098, 2024-10205, 2023-10027, 2023-10194

**Docs**: /widgetkit/creating-controls-to-perform-actions-across-the-system, /widgetkit/controlwidget, /appintents/setvalueintent, /activitykit, /activitykit/activityconfiguration

**Skills**: axiom-watchos, axiom-integration, axiom-accessibility
