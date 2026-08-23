
# Extensions & Widgets API Reference

## Overview

This skill provides comprehensive API reference for Apple's widget and extension ecosystem:

- **Standard Widgets** (iOS 14+) — Home Screen, Lock Screen, StandBy widgets
- **Interactive Widgets** (iOS 17+) — Buttons and toggles with App Intents
- **Control Center Widgets** (iOS 18+) — System-wide quick controls
- **Liquid Glass Widgets** (iOS 26+) — Accented rendering, glass effects, container backgrounds
- **visionOS Widgets** (visionOS 2+) — Mounting styles, textures, proximity awareness
- **App Extensions** — Shared data, lifecycle, entitlements

Widgets are SwiftUI **archived snapshots** rendered on a timeline by the system. Extensions are sandboxed executables bundled with your app.

> **Live Activities & Dynamic Island** have their own reference: `skills/live-activities-ref.md` (ActivityKit lifecycle, push/broadcast, Dynamic Island layout, watch/CarPlay/Mac surfaces). They render in a widget extension, so the App Groups and extension-setup details below still apply.

## When to Use This Skill

✅ **Use this skill when**:
- Implementing any type of widget (Home Screen, Lock Screen, StandBy)
- Building Control Center controls
- Sharing data between app and extensions
- Understanding widget timelines and refresh policies
- Integrating widgets with App Intents
- Adopting Liquid Glass rendering in widgets
- Supporting watchOS or visionOS widgets
- Implementing visionOS mounting styles, textures, or proximity awareness

❌ **Do NOT use this skill for**:
- Pure App Intents questions (use **app-intents-ref** skill)
- SwiftUI layout issues (use **axiom-swiftui** layout reference)
- Performance optimization (use **axiom-swiftui** performance reference)
- Debugging crashes (use **xcode-debugging** skill)

## Related Skills

- **app-intents-ref** — App Intents for interactive widgets and configuration
- **swift-concurrency** — Async/await patterns for widget data loading
- **axiom-swiftui** (performance reference) — Optimizing widget rendering
- **axiom-swiftui** (layout reference) — Complex widget layouts
- **extensions-widgets** — Discipline skill with anti-patterns and debugging

## Key Terminology

- **Timeline** — Series of entries defining when/what content to display; system shows entries at specified times
- **TimelineProvider** — Protocol supplying timeline entries (placeholder, snapshot, timeline generation)
- **TimelineEntry** — Struct with widget data + display date
- **Timeline Budget** — Daily limit (40-70) for timeline reloads
- **Budget-Exempt** — Reloads that don't count (user-initiated, app foregrounding, system-initiated)
- **Widget Family** — Size/shape (systemSmall, systemMedium, accessoryCircular, etc.)
- **App Groups** — Entitlement for shared data container between app and extensions
- **ControlWidget** — iOS 18+ widgets for Control Center, Lock Screen, and Action Button

---

# Part 1: Standard Widgets (iOS 14+)

## Widget Configuration Types

### StaticConfiguration

For widgets that don't require user configuration.

```swift
@main
struct MyWidget: Widget {
    let kind: String = "MyWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MyWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("My Widget")
        .description("This widget displays...")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
```

### AppIntentConfiguration (iOS 17+)

For widgets with user configuration using App Intents.

```swift
struct MyConfigurableWidget: Widget {
    let kind: String = "MyConfigurableWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectProjectIntent.self,
            provider: Provider()
        ) { entry in
            MyWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Project Status")
        .description("Shows your selected project")
    }
}
```

**Migration from IntentConfiguration**: iOS 16 and earlier used `IntentConfiguration` with SiriKit intents. Migrate to `AppIntentConfiguration` for iOS 17+.

### ActivityConfiguration

For Live Activities — declared in the widget extension. See `skills/live-activities-ref.md`.

## Choosing the Right Configuration

No user configuration needed? Use `StaticConfiguration`. Simple static options? Use `AppIntentConfiguration` with `WidgetConfigurationIntent`. Dynamic options from app data? Use `AppIntentConfiguration` + `EntityQuery`.

**Quick Reference**:
- **StaticConfiguration** — No customization (weather, battery status)
- **AppIntentConfiguration** (simple) — Fixed options (timer presets, theme selection)
- **AppIntentConfiguration** (EntityQuery) — Dynamic list from app data (project/contact/playlist picker)
- **ActivityConfiguration** — Live ongoing events (delivery tracking, workout progress, sports scores)

## Widget Families

### System Families (Home Screen)
- **`systemSmall`** (~170×170, iOS 14+) — Single piece of info, icon
- **`systemMedium`** (~360×170, iOS 14+) — Multiple data points, chart
- **`systemLarge`** (~360×380, iOS 14+) — Detailed view, list
- **`systemExtraLarge`** (~720×380, iOS 15+) — Rich layouts, multiple views. iPad-only through iOS 26; the 27 cycle brings the landscape extra-large family to the **iPhone** Home Screen (a Home-Screen capability change, WWDC 2026-277, no API delta).
- **`systemExtraLargePortrait`** `iOS27/macOS27` — portrait-oriented extra-large family (the genuine new API; visionOS already had it at 26). Declare it alongside `systemExtraLarge` so the system picks the orientation that fits the placement.

> **OS27 gating** `systemExtraLargePortrait` doesn't exist before the 27 SDK, and the iPhone extra-large slot only renders on 27. Declare the families in `supportedFamilies` and gate the matching `switch` arm with `if #available(iOS 27, *)`.

### Accessory Families (Lock Screen, iOS 16+)
- **`accessoryCircular`** (~48×48pt) — Circular complication, icon or gauge
- **`accessoryRectangular`** (~160×72pt) — Above clock, text + icon
- **`accessoryInline`** (single line) — Above date, text only

> **iPad Lock Screen placement requires these accessory families.** A widget that declares only system families (`systemSmall`/`systemMedium`/`systemLarge`) will not appear on the iPad Lock Screen even with a correct `containerBackground` — the missing piece is `supportedFamilies`, not the background. Declare `accessoryRectangular` / `accessoryCircular` / `accessoryInline` to opt into the Lock Screen on both iPhone and iPad.

### Example: Supporting Multiple Families

```swift
struct MyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MyWidget", provider: Provider()) { entry in
            if #available(iOSApplicationExtension 16.0, *) {
                switch entry.family {
                case .systemSmall:
                    SmallWidgetView(entry: entry)
                case .systemMedium:
                    MediumWidgetView(entry: entry)
                case .accessoryCircular:
                    CircularWidgetView(entry: entry)
                case .accessoryRectangular:
                    RectangularWidgetView(entry: entry)
                default:
                    Text("Unsupported")
                }
            } else {
                LegacyWidgetView(entry: entry)
            }
        }
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular
        ])
    }
}
```

## Timeline System

### TimelineProvider Protocol

Provides entries that define when the system should render your widget.

```swift
struct Provider: TimelineProvider {
    // Placeholder while loading
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), emoji: "😀")
    }

    // Shown in widget gallery
    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), emoji: "📷")
        completion(entry)
    }

    // Actual timeline
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        var entries: [SimpleEntry] = []
        let currentDate = Date()

        // Create entry every hour for 5 hours
        for hourOffset in 0 ..< 5 {
            let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: currentDate)!
            let entry = SimpleEntry(date: entryDate, emoji: "⏰")
            entries.append(entry)
        }

        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }
}
```

### TimelineReloadPolicy

Controls when the system requests a new timeline:
- **`.atEnd`** — Reload after last entry
- **`.after(date)`** — Reload at specific date
- **`.never`** — No automatic reload (manual only)

### Manual Reload

```swift
import WidgetKit

// Reload all widgets of this kind
WidgetCenter.shared.reloadAllTimelines()

// Reload specific kind
WidgetCenter.shared.reloadTimelines(ofKind: "MyWidget")
```

### Entries vs. reloads

A `Timeline`'s entries are **pre-rendered snapshots, not refetch points.** The system displays each entry's view at its `date` from data already baked into that entry — it does **not** re-run your provider or fetch anything per entry. You fetch only when `getTimeline()` runs, and *that invocation* is a **reload** — the event the daily budget counts. So 60 one-minute entries ≠ 60 updates: they are 60 archived snapshots from a single fetch, all showing the same data. Adding entries never produces fresher data and never increases reloads. To refresh the *data* you need a new **reload**: a policy trigger (`.atEnd` / `.after`), an interactive intent's `perform()` returning, a `.widgetKit` push, or an app-initiated `WidgetCenter` call.

## Performance & Budget Quick Reference

### Timeline Refresh Budget
- **Daily budget**: 40-70 reloads/day (varies by system load and engagement)
- **Budget-exempt**: User-initiated reload, app foregrounding, widget added, system reboot
- **Strategic** (4x/hour) — ~48 reloads/day, low battery impact
- **Aggressive** (12x/hour) — Budget exhausted by 6 PM, high impact
- **On-demand only** — 5-10 reloads/day, minimal impact
- Reload on significant data changes and time-based events. Avoid speculative or cosmetic reloads.

```swift
// ✅ GOOD: Strategic intervals (15-60 min)
let entries = (0..<8).map { offset in
    let date = Calendar.current.date(byAdding: .minute, value: offset * 15, to: now)!
    return SimpleEntry(date: date, data: data)
}
```

### Memory Limits
- ~30MB for standard widgets, ~50MB for Live Activities — system terminates if exceeded
- Load only what you need (e.g., `loadRecentItems(limit: 10)`, not entire database)

### Network Requests
**Never make network requests in widget views** — they won't complete before rendering. Fetch data in `getTimeline()` instead.

### Timeline Generation
Complete `getTimeline()` in under 5 seconds. Cache expensive computations in the main app, read pre-computed data from shared container, limit to 10-20 entries.

### View Rendering
Precompute everything in `TimelineEntry`, keep views simple. No expensive operations in `body`.

### Images
- Use asset catalog images or SF Symbols (fast)
- Small images from shared container are acceptable
- `AsyncImage` does NOT work in widgets
- Large images cause memory termination

---

# Part 2: Interactive Widgets (iOS 17+)

## Interactivity Is Independent of Configuration Type

Interactivity comes from a `Button`/`Toggle` in the **entry view** — not from the widget's configuration. The common mistake is reaching for `AppIntentConfiguration` to make a widget interactive. You don't need it.

| Your widget | Configuration | Provider | Intent role |
|---|---|---|---|
| Tappable actions, no user settings | `StaticConfiguration` | `TimelineProvider` | plain `AppIntent` (button action) |
| User-configurable (picker, options) | `AppIntentConfiguration` | `AppIntentTimelineProvider` | `WidgetConfigurationIntent` (config) |
| Both | `AppIntentConfiguration` | `AppIntentTimelineProvider` | `WidgetConfigurationIntent` for config + plain `AppIntent` for buttons |

The two App Intent roles are distinct and unrelated. A **button's** intent is a plain `AppIntent` that performs an action; a **configuration** intent is a `WidgetConfigurationIntent` that parameterizes the timeline. `StaticConfiguration` has no intent parameter at all (`StaticConfiguration<Content: View>`), yet its content view can still contain interactive controls. `AppIntentConfiguration<Intent, Content>` is constrained to `Intent: WidgetConfigurationIntent` — it exists *only* for user configuration.

Interactive controls work in all system families and in `accessoryCircular` / `accessoryRectangular` (Lock Screen) on iPhone and iPad — Lock Screen widgets are **not** read-only.

## Button and Toggle

Interactive widgets use SwiftUI `Button` and `Toggle` with App Intents, placed inside the entry view of any configuration type.

### Button with App Intent

```swift
Button(intent: IncrementIntent()) {
    Label("Increment", systemImage: "plus.circle")
}
```

The intent updates shared data via App Groups in its `perform()` method. **When `perform()` returns, the system automatically reloads this widget's timeline via its provider** — you do not call `WidgetCenter` for the tapped widget itself (see Part 1's manual-reload note for when you do). See **skills/app-intents-ref.md** for full `AppIntent` definition syntax.

### Toggle with App Intent

Same pattern as Button — use a `Toggle` bound to state, invoke intent on change:

```swift
Toggle(isOn: $isEnabled) {
    Text("Feature")
}
.onChange(of: isEnabled) { newValue in
    Task { try? await ToggleFeatureIntent(enabled: newValue).perform() }
}
```

The intent follows the same `AppIntent` structure with a `@Parameter(title: "Enabled") var enabled: Bool`. See **skills/app-intents-ref.md** for full `AppIntent` definition syntax.

## invalidatableContent Modifier

Provides visual feedback during App Intent execution.

```swift
struct MyWidgetView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack {
            Text(entry.status)
                .invalidatableContent() // Dims during intent execution

            Button(intent: RefreshIntent()) {
                Image(systemName: "arrow.clockwise")
            }
        }
    }
}
```

**Effect**: Content with `.invalidatableContent()` becomes slightly transparent while the associated intent executes, providing user feedback.

## Animation System

### contentTransition for Numeric Text

```swift
Text("\(entry.value)")
    .contentTransition(.numericText(value: Double(entry.value)))
```

**Effect**: Numbers smoothly count up or down instead of instantly changing.

### View Transitions

```swift
VStack {
    if entry.showDetail {
        DetailView()
            .transition(.scale.combined(with: .opacity))
    }
}
.animation(.spring(response: 0.3), value: entry.showDetail)
```

---

# Part 3: Configurable Widgets (iOS 17+)

## WidgetConfigurationIntent

Define configuration parameters for your widget.

```swift
import AppIntents

struct SelectProjectIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Select Project"
    static var description = IntentDescription("Choose which project to display")

    @Parameter(title: "Project")
    var project: ProjectEntity?

    // Provide default value
    static var parameterSummary: some ParameterSummary {
        Summary("Show \(\.$project)")
    }
}
```

## Entity and EntityQuery

Provide dynamic options for configuration.

```swift
struct ProjectEntity: AppEntity {
    var id: String
    var name: String

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Project")

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct ProjectQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [ProjectEntity] {
        // Return projects matching these IDs
        return await ProjectStore.shared.projects(withIDs: identifiers)
    }

    func suggestedEntities() async throws -> [ProjectEntity] {
        // Return all available projects
        return await ProjectStore.shared.allProjects()
    }
}
```

## Using Configuration in Provider

```swift
struct Provider: AppIntentTimelineProvider {
    func timeline(for configuration: SelectProjectIntent, in context: Context) async -> Timeline<SimpleEntry> {
        let project = configuration.project // Use selected project
        let entries = await generateEntries(for: project)
        return Timeline(entries: entries, policy: .atEnd)
    }
}
```

---

> **Live Activities & Dynamic Island moved.** The full ActivityKit reference — `ActivityAttributes`/`ContentState`, start/update/end, the `ActivityState` lifecycle, per-activity push, push-to-start, broadcast channels, frequent updates, Dynamic Island layout, and watch/CarPlay/Mac surfaces — now lives in `skills/live-activities-ref.md`.

---

# Part 4: Control Center Widgets (iOS 18+)

## ControlWidget Protocol

Controls appear in Control Center, Lock Screen, and Action Button (iPhone 15 Pro+).

### StaticControlConfiguration

For simple controls without configuration.

```swift
import WidgetKit
import AppIntents

struct TorchControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "TorchControl") {
            ControlWidgetButton(action: ToggleTorchIntent()) {
                Label("Flashlight", systemImage: "flashlight.on.fill")
            }
        }
        .displayName("Flashlight")
        .description("Toggle flashlight")
    }
}
```

### AppIntentControlConfiguration

For configurable controls.

```swift
struct TimerControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(
            kind: "TimerControl",
            intent: ConfigureTimerIntent.self
        ) { configuration in
            ControlWidgetButton(action: StartTimerIntent(duration: configuration.duration)) {
                Label("\(configuration.duration)m Timer", systemImage: "timer")
            }
        }
    }
}
```

## ControlWidgetButton

For discrete actions (one-shot operations).

```swift
ControlWidgetButton(action: PlayMusicIntent()) {
    Label("Play", systemImage: "play.fill")
}
.tint(.purple)
```

## ControlWidgetToggle

For boolean state. The `action` must be a `SetValueIntent` whose `ValueType == Bool`; the trailing closure is the value label and receives the current `isOn` state, so pass a title as the first argument.

```swift
struct AirplaneModeControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "AirplaneModeControl") {
            ControlWidgetToggle(
                "Airplane Mode",
                isOn: AirplaneModeIntent.isEnabled,
                action: AirplaneModeIntent()   // : SetValueIntent, ValueType == Bool
            ) { isOn in
                Label(isOn ? "On" : "Off", systemImage: "airplane")
            }
        }
    }
}
```

## Value Providers (Async State)

For controls needing async state, pass a `ControlValueProvider` to `StaticControlConfiguration`:

```swift
struct ThermostatProvider: ControlValueProvider {
    func currentValue() async throws -> ThermostatValue {
        let temp = try await HomeManager.shared.currentTemperature()
        return ThermostatValue(temperature: temp)
    }
    var previewValue: ThermostatValue { ThermostatValue(temperature: 72) }
}
```

The provider value is passed to your control's closure: `{ value in ControlWidgetButton(...) }`.

## Configurable Controls

Use `AppIntentControlConfiguration` with a `ControlConfigurationIntent` (the control-specific analogue of `WidgetConfigurationIntent`). Add `.promptsForUserConfiguration()` to show configuration UI when the user adds the control.

## Control Refinements

- `.controlWidgetActionHint("Toggles flashlight")` — VoiceOver accessibility hint
- `.displayName("My Control")` / `.description("...")` — Shown in Control Center UI

---

# Part 5: iOS 18+ Updates

## Accented Rendering and Liquid Glass

Widget rendering modes span multiple iOS versions: `widgetAccentable()` (iOS 16+), `WidgetAccentedRenderingMode` (iOS 18+), and Liquid Glass effects like `glassEffect()` and `GlassEffectContainer` (iOS 26+). Detect the mode and adapt layout accordingly.

### Detecting Rendering Mode

```swift
struct MyWidgetView: View {
    @Environment(\.widgetRenderingMode) var renderingMode

    var body: some View {
        if renderingMode == .accented {
            // Simplified layout — opaque images tinted white, background replaced with glass
        } else {
            // Standard full-color layout
        }
    }
}
```

### widgetAccentable(_:)

Marks views as part of the **accent group**. In accented mode, accent-group views are tinted separately from primary-group views, creating visual hierarchy.

```swift
HStack {
    VStack(alignment: .leading) {
        Text("Title")
            .font(.headline)
            .widgetAccentable()  // Accent group — tinted in accented mode
        Text("Subtitle")
            // Primary group by default
    }
    Image(systemName: "star.fill")
        .widgetAccentable()  // Also accent group
}
```

### WidgetAccentedRenderingMode

Controls how images render in accented mode. Apply to `Image` views:

```swift
Image("myPhoto")
    .widgetAccentedRenderingMode(.accented)      // Tinted with accent color
Image("myIcon")
    .widgetAccentedRenderingMode(.monochrome)     // Rendered as monochrome
Image("myBadge")
    .widgetAccentedRenderingMode(.fullColor)       // Keeps original colors (opt-out)
```

**Best practices**: Display full-color images only in `.fullColor` rendering mode. Use `.widgetAccentable()` strategically for visual hierarchy. Test with multiple accent colors and background images.

### Container Backgrounds

> **`containerBackground(for:)` is an iOS 17 API, not an iOS 18 one — and it is effectively required.** Every widget must declare a container background (it replaced direct `.background` use on the widget's root). A widget that omits it does not crash, but it renders with a system default and is excluded from StandBy and the iPad Lock Screen, and Xcode emits an "adopt containerBackground" warning. The accented / Liquid Glass *behavior* described below is the iOS 18 / iOS 26 layer on top of this iOS 17 requirement.

```swift
VStack { /* content */ }
    .containerBackground(for: .widget) {
        Color.blue.opacity(0.2)
    }
```

In accented mode, the system removes the background and replaces it with themed glass. To prevent removal (excludes widget from iPad Lock Screen, StandBy):

```swift
.containerBackgroundRemovable(false)
```

### Liquid Glass in Custom Widget Elements

```swift
Text("Label")
    .padding()
    .glassEffect()  // Default capsule shape

Image(systemName: "star.fill")
    .frame(width: 60, height: 60)
    .glassEffect(.regular, in: .rect(cornerRadius: 12))

Button("Action") { }
    .buttonStyle(.glass)
```

Combine multiple glass elements with `GlassEffectContainer`:

```swift
GlassEffectContainer(spacing: 20.0) {
    HStack(spacing: 20.0) {
        Image(systemName: "cloud")
            .frame(width: 60, height: 60)
            .glassEffect()
        Image(systemName: "sun")
            .frame(width: 60, height: 60)
            .glassEffect()
    }
}
```

## Cross-Platform Support

### visionOS Widgets (visionOS 2+)

visionOS widgets are 3D objects placed in physical space — mounted on surfaces or floating. They support unique spatial features.

#### Mounting Styles

Widgets can be elevated (on top of surfaces) or recessed (embedded into vertical surfaces like walls):

```swift
.supportedMountingStyles([.elevated, .recessed])  // Default is both
// .supportedMountingStyles([.recessed])           // Wall-only widget
```

If limited to `.recessed`, users cannot place the widget on horizontal surfaces.

#### Widget Textures

Two visual textures for spatial appearance:

```swift
.widgetTexture(.glass)   // Default — transparent glass-like appearance
.widgetTexture(.paper)   // Poster-like look, effective with extra-large sizes
```

#### Proximity Awareness (levelOfDetail)

Widgets adapt to user distance automatically. The system animates transitions between detail levels:

```swift
@Environment(\.levelOfDetail) var levelOfDetail

var body: some View {
    VStack {
        Text(entry.value)
            .font(levelOfDetail == .simplified ? .largeTitle : .title)
    }
}
```

Values: `.default` (close viewing) and `.simplified` (distance viewing — use larger text, fewer details).

#### visionOS Widget Families

visionOS supports all system families plus extra-large sizes:

```swift
.supportedFamilies([
    .systemSmall, .systemMedium, .systemLarge,
    .systemExtraLarge,
    .systemExtraLargePortrait  // portrait extra-large (visionOS 26+, iOS/macOS 27+)
])
```

Extra-large families are particularly effective with `.widgetTexture(.paper)` for poster-like displays.

#### Background Detection

Detect whether the widget background is visible (removed in accented mode):

```swift
@Environment(\.showsWidgetContainerBackground) var showsBackground
```

### watchOS Controls (11+)
`ControlWidget` works identically on watchOS — available in Control Center, Action Button, and Smart Stack. Same `StaticControlConfiguration` / `ControlWidgetButton` pattern as iOS.

> Live Activity surfaces (CarPlay, macOS menu bar, Apple Watch Smart Stack) are documented in `skills/live-activities-ref.md`.

## Relevance Widgets (iOS 18+)

Use `.relevanceConfiguration(for:score:attributes:)` to help the system promote widgets in Smart Stack. Attributes include `.location(CLLocation)`, `.timeOfDay(DateInterval)`, and `.activity(String)` for context-aware ranking.

## Push Notification Updates (iOS 18+)

Implement `PKPushRegistryDelegate` and handle `.widgetKit` push type to receive server-to-widget pushes. Update shared container data and call `WidgetCenter.shared.reloadAllTimelines()`. Pushes to iPhone automatically sync to Apple Watch and CarPlay.

---

# Part 6: App Groups & Data Sharing

## App Groups Entitlement

Required for sharing data between your app and extensions.

### Configuration

1. Xcode: Targets → Signing & Capabilities → Add "App Groups"
2. Identifier format: `group.com.company.appname`
3. Enable for BOTH main app target AND extension target

## Shared Containers

### Access Shared Container

```swift
let sharedContainer = FileManager.default.containerURL(
    forSecurityApplicationGroupIdentifier: "group.com.mycompany.myapp"
)!

let dataFileURL = sharedContainer.appendingPathComponent("widgetData.json")
```

### UserDefaults with App Groups

```swift
// Main app - write data
let shared = UserDefaults(suiteName: "group.com.mycompany.myapp")!
shared.set("Updated value", forKey: "myKey")

// Widget extension - read data
let shared = UserDefaults(suiteName: "group.com.mycompany.myapp")!
let value = shared.string(forKey: "myKey")
```

### Core Data with App Groups

Point `NSPersistentStoreDescription` at the shared container URL:

```swift
let sharedStoreURL = FileManager.default.containerURL(
    forSecurityApplicationGroupIdentifier: "group.com.mycompany.myapp"
)!.appendingPathComponent("MyApp.sqlite")

let description = NSPersistentStoreDescription(url: sharedStoreURL)
container.persistentStoreDescriptions = [description]
```

## IPC Communication

- **Background URL Session** — Set `config.sharedContainerIdentifier` to your App Group ID for downloads accessible by extensions
- **Darwin Notification Center** — Use `CFNotificationCenterPostNotification` / `CFNotificationCenterAddObserver` with `CFNotificationCenterGetDarwinNotifyCenter()` for simple cross-process signals (e.g., notify widget to call `WidgetCenter.shared.reloadAllTimelines()`)

---

# Part 7: Practical Workflows

## Building Your First Widget

For a complete step-by-step tutorial with working code examples, see Apple's [Building Widgets Using WidgetKit and SwiftUI](https://developer.apple.com/documentation/widgetkit/building-widgets-using-widgetkit-and-swiftui) sample project.

**Key steps**: Add widget extension target, configure App Groups, implement TimelineProvider, design SwiftUI view, update from main app. See Expert Review Checklist below for production requirements.

---

## Expert Review Checklist

### Before Shipping Widgets

**Architecture**:
- [ ] App Groups entitlement configured in app AND extension
- [ ] Group identifier matches exactly in both targets
- [ ] Shared container used for ALL data sharing
- [ ] No `UserDefaults.standard` in widget code

**Performance**:
- [ ] Timeline generation completes in < 5 seconds
- [ ] No network requests in widget views
- [ ] Timeline has reasonable refresh intervals (≥ 15 min)
- [ ] Entry count reasonable (< 20-30 entries)
- [ ] Memory usage under limits (~30MB widgets, ~50MB activities)
- [ ] Images optimized (asset catalog or SF Symbols preferred)

**Data & State**:
- [ ] Widget handles missing/nil data gracefully
- [ ] Entry dates in chronological order
- [ ] Placeholder view looks reasonable
- [ ] Snapshot view representative of actual use

**User Experience**:
- [ ] Widget appears in widget gallery
- [ ] configurationDisplayName clear and concise
- [ ] description explains widget purpose
- [ ] All supported families tested and look correct
- [ ] Text readable on both light and dark backgrounds
- [ ] Interactive elements (buttons/toggles) work correctly

**Liquid Glass** (if applicable):
- [ ] `widgetAccentable()` applied for visual hierarchy in accented mode
- [ ] `WidgetAccentedRenderingMode` set on images (`.accented`, `.monochrome`, or `.fullColor`)
- [ ] Tested with multiple accent colors and background images
- [ ] Container background configured with `.containerBackground(for: .widget)`

**visionOS** (if applicable):
- [ ] Mounting styles configured (`.elevated`, `.recessed`, or both)
- [ ] Widget texture chosen (`.glass` or `.paper`)
- [ ] `levelOfDetail` handled for proximity-aware layouts
- [ ] Extra-large families supported if appropriate (`.systemExtraLarge`, `.systemExtraLargePortrait`)
- [ ] Tested at different distances for proximity transitions

**Control Center Widgets** (if applicable):
- [ ] ControlValueProvider async and fast (< 1 second)
- [ ] previewValue provides reasonable fallback
- [ ] displayName and description set
- [ ] Tested in Control Center, Lock Screen, Action Button

**Testing**:
- [ ] Tested on actual device (not just simulator)
- [ ] Tested adding/removing widget
- [ ] Tested app data changes → widget updates
- [ ] Tested force-quit app → widget still works
- [ ] Tested low memory scenarios
- [ ] Tested all iOS versions you support
- [ ] Tested with no internet connection

---

## Testing Guidance

### Unit Testing Pattern

Test `placeholder()`, `getSnapshot()`, and `getTimeline()` methods. Save test data to shared container, call `getTimeline()` with a mock context, assert entries are non-empty and contain expected data. Use `waitForExpectations(timeout: 5.0)` for async timeline generation.

### Manual Testing Checklist
- Add widget to Home Screen, verify widget gallery, all supported sizes, data matches app
- Change data in main app, observe widget updates, force-quit app, reboot device
- Delete all app data (graceful handling), disable network (offline), Low Power Mode, multiple instances
- Monitor memory in Xcode Debug Navigator, check timeline generation time in Console, test on older devices

### Debugging Tips
- Add `print()` logging in `getTimeline()` to verify it's being called and data is loaded
- Verify App Groups: print `FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:)` in both app and widget — paths must match
- After data changes in main app, call `WidgetCenter.shared.reloadAllTimelines()`

---

# Part 8: Troubleshooting

**Widget not appearing in gallery**: Check `WidgetBundle` includes it, verify `supportedFamilies()`, check extension's "Skip Install" = NO, verify deployment target matches app.

## Widget Not Refreshing

**Symptoms**: Widget shows stale data, doesn't update

**Diagnostic Steps**:
1. Check timeline policy (`.atEnd` vs `.after()` vs `.never`)
2. Verify you're not exceeding daily budget (40-70 reloads)
3. Check if `getTimeline()` is being called (add logging)
4. Ensure App Groups configured correctly for shared data

**Solution**:
```swift
// Manual reload from main app when data changes
import WidgetKit

WidgetCenter.shared.reloadAllTimelines()
// or
WidgetCenter.shared.reloadTimelines(ofKind: "MyWidget")
```

## Data Not Shared Between App and Widget

**Symptoms**: Widget shows default/empty data

**Diagnostic Steps**:
1. Verify App Groups entitlement in BOTH targets
2. Check group identifier matches exactly
3. Ensure using same suiteName in both targets
4. Check file path if using shared container

**Solution**:
```swift
// Both app AND extension must use:
let shared = UserDefaults(suiteName: "group.com.mycompany.myapp")!

// NOT:
let shared = UserDefaults.standard  // ❌ Different containers
```

## Interactive Widget Button Not Working

**Symptoms**: Tapping button does nothing

**Diagnostic Steps**:
1. Verify App Intent's `perform()` returns `IntentResult`
2. Check intent is imported in widget target
3. Ensure button uses `intent:` parameter, not `action:`
4. Check Console for intent execution errors

**Solution**:
```swift
// ✅ CORRECT: Use intent parameter
Button(intent: MyIntent()) {
    Label("Action", systemImage: "star")
}

// ❌ WRONG: Don't use action closure
Button(action: { /* This won't work in widgets */ }) {
    Label("Action", systemImage: "star")
}
```

**Control Center widget slow**: Use async in `ControlValueProvider.currentValue()`, never block with `Thread.sleep`. Provide fast `previewValue` fallback.

**Widget shows wrong size**: Switch on `@Environment(\.widgetFamily)` in view, adapt layout per family, avoid hardcoded sizes.

**Timeline entries out of order**: Ensure entry dates are chronological. Use incrementing offsets from `Date()`.


## Performance Issues

**Symptoms**: Widget rendering slow, battery drain

**Common Causes**:
- Too many timeline entries (> 100)
- Network requests in view code
- Heavy computation in `getTimeline()`
- Refresh intervals too frequent (< 15 min)

**Solution**:
```swift
// ✅ GOOD: Strategic intervals
let entries = (0..<8).map { offset in
    let date = Calendar.current.date(byAdding: .minute, value: offset * 15, to: now)!
    return SimpleEntry(date: date, data: precomputedData)
}

// ❌ BAD: Too frequent, too many entries
let entries = (0..<100).map { offset in
    let date = Calendar.current.date(byAdding: .minute, value: offset, to: now)!
    return SimpleEntry(date: date, data: fetchFromNetwork())  // Network in timeline
}
```

---

## Debugging Widgets

### Simulator vs Device

- **Simulator**: Widgets refresh immediately; no budget limits apply. Useful for layout testing but misleading for refresh behavior.
- **Device**: Budget-limited (40-70 reloads/day). Test on device before shipping to verify real-world refresh timing.
- **Xcode Previews**: Work for layout but skip `getTimeline()`. Test timeline logic with unit tests or device runs.

### Common Debugging Workflow

1. Add `print()` in `getTimeline()` — verify it's called and data loads
2. Check Console.app filtered by widget extension process name
3. Use `WidgetCenter.shared.getCurrentConfigurations()` to verify registration
4. If widget shows old data after app update, verify App Groups container paths match

### Data Sharing Patterns

**SwiftData in Widgets** (iOS 17+):
- Create `ModelContainer` in widget with same schema as main app
- Use shared App Groups container: `ModelConfiguration(url: containerURL)`
- Widget reads only — never write from widget to avoid conflicts
- Main app calls `WidgetCenter.shared.reloadAllTimelines()` after writes

**GRDB/SQLite in Widgets**:
- Share database file via App Groups container
- Use `DatabasePool` (not `DatabaseQueue`) for concurrent reads
- Widget opens read-only connection: `try DatabasePool(path: dbPath, configuration: readOnlyConfig)`
- Set `configuration.readonly = true` in widget to prevent accidental writes

---

## Resources

**WWDC**: 2025-278, 2024-10157, 2024-10098, 2023-10028, 2022-10184, 2022-10185, 2026-277

**Docs**: /widgetkit, /widgetkit/widgetfamily/systemextralargeportrait, /appintents

**Skills**: skills/live-activities-ref.md (Live Activities & Dynamic Island), skills/app-intents-ref.md, axiom-concurrency, axiom-swiftui, skills/extensions-widgets.md

---

**Version**: 0.9 | **Platforms**: iOS 14+, iPadOS 14+, watchOS 9+, macOS 11+, visionOS 2+
