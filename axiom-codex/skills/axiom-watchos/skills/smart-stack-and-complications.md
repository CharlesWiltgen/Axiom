# Smart Stack and Complications

## When to Use This Skill

Use when:
- Building watch complications — `accessoryCircular`, `accessoryRectangular`, `accessoryInline`, `accessoryCorner`, or `AccessoryWidgetGroup`
- Deciding between a timeline widget and the new watchOS 26 **relevant widget** for Smart Stack placement
- Adopting RelevanceKit — `RelevantContext`, `WidgetRelevance`, `WidgetRelevanceAttribute`
- Making a widget or control **configurable** from the watch face or Smart Stack
- Adding APNs push updates to watch widgets (new in watchOS 26)
- Deduplicating cards when both a timeline and a relevant widget render the same event
- Planning a ClockKit → WidgetKit complication migration

#### Related Skills

- Use `platform-basics.md` for overall app structure and Info.plist keys
- Use `controls-and-live-activities.md` for controls (which share Smart Stack real estate) and Live Activities on watch
- Use `modernization.md` for the ClockKit → WidgetKit migration checklist — this skill covers the target architecture
- Use `watch-connectivity.md` for `transferCurrentComplicationUserInfo` as a wake-on-change signal
- Use `background-and-networking.md` for widget timeline refresh strategies
- Use `axiom-integration` for general widget / App Intents patterns shared with iOS

## Core Principle

**Complications, widgets, Live Activities, and controls all share the Smart Stack on watchOS 26.** Pick the right surface by primary purpose, not by habit. Then use RelevanceKit so the system shows your content when it matters.

> "The Smart Stack now supports Controls, Widgets, and Live Activities. With so many ways to show content in the Smart Stack, it can be hard to decide which one to choose. It's helpful to consider the primary purpose." — Apple, What's new in watchOS 26

| Primary purpose | Surface |
|---|---|
| Perform a quick action (change setting, trigger a device) | Control — see `controls-and-live-activities.md` |
| Display info throughout the day (weather, upcoming event) | Widget (timeline or relevant) |
| Event with a clear start and end (flight, sports match) | Live Activity |

## Complication Surfaces

Four watchOS complication families, plus one grouping view:

| Widget family | Placement | Typical content |
|---|---|---|
| `accessoryCircular` | Corner, sub-dial, Modular Compact slot | One metric (steps, battery, next event time) |
| `accessoryRectangular` | Modular large, Infograph rectangular slot | Two-to-three lines of text with optional icon |
| `accessoryInline` | Inline band above/below watch face | Single line, system-tinted |
| `accessoryCorner` | Corner of Infograph face only | Curved text + gauge |
| `AccessoryWidgetGroup` | Wraps three circular views with a shared label | Bundled multi-metric complication |

Use the standard WidgetKit pattern — `StaticConfiguration` or `AppIntentConfiguration`, a `TimelineProvider` / `AppIntentTimelineProvider`, and a SwiftUI view. Apple's important migration rule:

> "As soon as you offer a widget-based complication, the system stops calling ClockKit APIs." — Apple, Creating accessory widgets and watch complications

Offer a WidgetKit complication for every ClockKit complication you currently ship, in a single release — a partial migration silently breaks the ClockKit ones.

## Smart Stack Basics

The Smart Stack surfaces widgets contextually — rotate the Digital Crown above the watch face and the system shows what it predicts is relevant. Widgets compete for placement; the system picks using signals you provide.

Two signal paths:

1. **Timeline widget + `RelevanceConfiguration`** — you compute timeline entries as usual, and supply an associated `RelevanceConfiguration` that hints when each entry matters.
2. **Relevant widget** (watchOS 26) — a new configuration type that generates entries on demand when a `RelevantContext` matches. Multiple views can appear simultaneously.

The relevant widget is the better tool when multiple instances of the same widget might be useful at the same time (three overlapping calendar events, two upcoming flights, four scheduled reminders). The timeline widget is still right for steady content (hourly weather, step count).

## RelevanceKit (watchOS 26)

RelevanceKit tells the system when a widget matters. Contexts cover date, sleep schedule, fitness state, location — and on watchOS 26, **points of interest** by MapKit category.

### `RelevantContext` types

- `.date(interval:kind:)` — happening now or soon
- `.location(category:)` — at a specific MapKit point-of-interest type
- plus sleep-schedule, fitness, and other built-in contexts

### Location-based widget relevance

```swift
func relevance() async -> WidgetRelevance<Void> {
    guard let context = RelevantContext.location(category: .beach) else {
        return WidgetRelevance<Void>([])
    }
    return WidgetRelevance([WidgetRelevanceAttribute(context: context)])
}
```

`RelevantContext.location(category:)` returns `nil` if the category isn't supported — guard, don't force-unwrap.

## Relevant Widgets — the watchOS 26 Pattern

Think of a relevant widget as a multi-card version of a timeline widget. Three roles:

| Type | Role | Analog in timeline widgets |
|---|---|---|
| `RelevanceEntry` | Data for one card | `TimelineEntry` |
| `RelevanceEntriesProvider` | Builds entries + declares when the widget is relevant | `TimelineProvider` / `AppIntentTimelineProvider` |
| `RelevanceConfiguration` | Glues provider + view into a `Widget` body | `StaticConfiguration` / `AppIntentConfiguration` |

### Full example — beach events calendar

```swift
// 1. Relevance provider — tells the system when the widget is relevant
struct BeachEventRelevanceProvider: RelevanceEntriesProvider {
    let store: BeachEventStore

    func relevance() async -> WidgetRelevance<BeachEventConfigurationIntent> {
        let events = store.upcomingEvents()
        let attributes = events.map { event in
            WidgetRelevanceAttribute(
                configuration: BeachEventConfigurationIntent(event: event),
                context: .date(interval: event.dateInterval, kind: .default)
            )
        }
        return WidgetRelevance(attributes)
    }

    func entry(
        configuration: BeachEventConfigurationIntent,
        context: Context
    ) async throws -> BeachEventRelevanceEntry {
        if context.isPreview {
            return .previewEntry
        }
        return BeachEventRelevanceEntry(event: configuration.event)
    }

    func placeholder(context: Context) -> BeachEventRelevanceEntry {
        .placeholderEntry
    }
}

// 2. The widget
struct BeachEventWidget: Widget {
    private let store = BeachEventStore.shared

    var body: some WidgetConfiguration {
        RelevanceConfiguration(
            kind: "BeachEventWidget",
            provider: BeachEventRelevanceProvider(store: store)
        ) { entry in
            BeachWidgetView(entry: entry)
        }
        .configurationDisplayName("Beach Events")
        .description("Events at the beach")
    }
}
```

The pattern:

1. `relevance()` returns a `WidgetRelevance` describing each card's `WidgetRelevanceAttribute` (configuration + context).
2. `entry(configuration:context:)` receives a single attribute's configuration and returns the entry for that card. Check `context.isPreview` for previews.
3. `placeholder(context:)` returns a skeleton entry while data loads.
4. `RelevanceConfiguration` ties the provider to a view closure.

## Deduplicating Timeline + Relevant Widgets

If a user has a timeline widget in their Smart Stack *and* your relevant widget would match, the system may show two cards for the same event. Associate them so the system replaces the timeline widget with the relevant cards when relevance applies:

```swift
struct BeachEventWidget: Widget {
    var body: some WidgetConfiguration {
        RelevanceConfiguration(kind: "BeachEventWidget", provider: provider) { entry in
            BeachWidgetView(entry: entry)
        }
        .associatedKind(WidgetKinds.beachEventsTimeline)
    }
}
```

`associatedKind(_:)` hands the system the timeline widget's kind string; when the relevant widget has cards to show, the timeline card steps aside.

## Configurable Widgets (watchOS 26)

Starting in watchOS 26, users can customize widgets and controls on the watch face and Smart Stack the same way they do on iOS. Declare your widget as configurable by returning an empty recommendations array:

```swift
struct BeachWidgetProvider: AppIntentTimelineProvider {
    func recommendations() -> [AppIntentRecommendation<BeachConfigurationIntent>] {
        if #available(watchOS 26, *) {
            // Empty array signals the widget is user-configurable
            return []
        } else {
            // Pre-watchOS 26: return actual preconfigured options
            return recommendedBeaches
        }
    }
}
```

**Controls** are configurable via `AppIntentControlConfiguration` + `AppIntentControlValueProvider`:

```swift
struct ConfigurableMeditationControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(
            kind: WidgetKinds.configurableMeditationControl,
            provider: Provider()
        ) { value in
            // Provide the control's content using `value`
        }
        .displayName("Ocean Meditation")
        .description("Meditation with optional ocean sounds.")
        .promptsForUserConfiguration()
    }
}

extension ConfigurableMeditationControl {
    struct Provider: AppIntentControlValueProvider {
        func previewValue(configuration: TimerConfiguration) -> Value {
            // Value shown in the add sheet
        }
        func currentValue(configuration: TimerConfiguration) async throws -> Value {
            // Live value for this configuration
        }
    }
}
```

## Workout-App Suggestions

Apple-made feature you get for free if you do it right:

> "If your Watch app uses HealthKit to record workouts, it may be suggested in the Smart Stack based on a person's routine." — Apple, What's new in watchOS 26

Requirements:

- Specify the correct `HKWorkoutActivityType` on each workout session
- Record accurate start and end times — not approximate, not front-loaded
- Attach location data via `HKWorkoutRouteBuilder` when applicable

The system uses that data to predict when to suggest launching the app.

## Widget Push Updates via APNs (watchOS 26)

> "Beginning in watchOS 26, you can send push updates to widgets using APNs. Widget push updates are supported for all widgets on all Apple platforms that support WidgetKit." — Apple, What's new in watchOS 26

Push updates are the right tool when data changes unpredictably (score change, incoming message, status flip). See *What's new in widgets* (WWDC25). The rule in `watch-connectivity.md` still applies — Watch Connectivity complication transfers are a 50/day budget; push widgets via APNs when frequency matters.

## Previewing Relevant Widgets

Three preview levels, each for a different development stage:

```swift
// 1. View-only preview — layout check across sizes
#Preview("Entries") {
    BeachEventWidget()
} relevanceEntries: {
    BeachEventRelevanceEntry.previewShorebirds
    BeachEventRelevanceEntry.previewMeditation
}

// 2. Provider + relevance — verify entry generation
#Preview("Provider and Relevance") {
    BeachEventWidget()
} relevanceProvider: {
    BeachEventRelevanceProvider(store: .preview)
} relevance: {
    let configurations: [BeachEventConfigurationIntent] = [
        .previewSurfing,
        .previewMeditation,
        .previewWalk
    ]
    let attributes = configurations.map {
        WidgetRelevanceAttribute(
            configuration: $0,
            context: .date($0.event.startDate, kind: .default)
        )
    }
    return WidgetRelevance(attributes)
}

// 3. Full provider preview — final pass
#Preview("Provider") {
    BeachEventWidget()
} relevanceProvider: {
    BeachEventRelevanceProvider(store: .preview)
}
```

## ClockKit Migration — Summary Only

ClockKit complications still work on watchOS 8 and earlier. From watchOS 9 onward, the target is WidgetKit. The single migration rule to know in this skill: the moment any WidgetKit complication is offered, ClockKit callbacks stop firing. Plan to migrate every complication in the same release — partial migration silently disables ClockKit.

Full migration workflow, including parallel-support patterns for older watchOS versions, is in `modernization.md`.

## Common Mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Force-unwrapping `RelevantContext.location(category:)` | Crash when the category is unsupported on the device | `guard let context = RelevantContext.location(category: ...)` and return an empty `WidgetRelevance` |
| Offering a WidgetKit complication while still relying on ClockKit callbacks | ClockKit complication silently stops updating on devices that install the update | Migrate all complications in a single release; `modernization.md` has the full checklist |
| Missing `associatedKind(_:)` on a relevant widget that overlaps a timeline widget | Two cards appear for the same event in the Smart Stack | Call `.associatedKind(timelineWidgetKind)` on the `RelevanceConfiguration` |
| Returning non-empty recommendations while intending the widget to be configurable on watchOS 26 | Users see preconfigured options instead of the configuration UI | Wrap in `if #available(watchOS 26, *)` and return `[]` for the configurable path |
| Relying on `transferCurrentComplicationUserInfo` as the primary refresh path at high frequency | Silent throttling past 50/day; updates stop | Move high-frequency updates to APNs widget push (watchOS 26+); reserve the Watch Connectivity budget for user-visible-change moments |
| Using `accessoryCorner` on non-Infograph faces | No card appears; budget wasted | `accessoryCorner` is Infograph-only; offer the other three accessory families too |
| Shipping a relevant widget without `context.isPreview` handling | Preview sheet shows placeholder or real user data instead of the preview | Return a dedicated `.previewEntry` branch inside `entry(configuration:context:)` |
| Returning stale or empty `relevance()` attributes | Widget never appears in the Smart Stack even when relevant | Populate `WidgetRelevanceAttribute` for every event that should surface, not just the next one |
| Skipping `HKWorkoutRouteBuilder` for outdoor workouts | App not suggested in the Smart Stack for the user's routine | Attach route data on runs, walks, cycling; see `axiom-health` |

## Resources

**WWDC**: 2025-334, 2025-278, 2023-10029, 2023-10309, 2023-10027, 2022-10050, 2022-10051

**Docs**: /widgetkit/creating-accessory-widgets-and-watch-complications, /widgetkit/converting-a-clockkit-app, /widgetkit/widgets-and-complications-collection, /widgetkit/accessorywidgetgroup, /widgetkit/relevanceconfiguration, /widgetkit/relevanceentry, /widgetkit/relevanceentriesprovider, /widgetkit/widgetrelevance, /widgetkit/widgetrelevanceattribute, /relevancekit, /relevancekit/relevantcontext, /widgetkit/appintentcontrolconfiguration, /widgetkit/appintentcontrolvalueprovider, /widgetkit/appintentrecommendation

**Skills**: axiom-watchos (platform-basics, controls-and-live-activities, modernization, watch-connectivity, background-and-networking), axiom-integration, axiom-health
