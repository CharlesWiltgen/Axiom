---
name: axiom-extensions-widgets-ref
description: Use when implementing widgets, Live Activities, Control Center controls, or app extensions - comprehensive API reference for WidgetKit, ActivityKit, App Groups, and extension lifecycle for iOS 14+
license: MIT
compatibility: iOS 14+, iPadOS 14+, watchOS 9+, macOS 11+, axiom-visionOS 2+
metadata:
  version: "1.0.0"
---

# Extensions & Widgets API Reference

## Overview

This skill provides comprehensive API reference for Apple's widget and extension ecosystem:

- **Standard Widgets** (iOS 14+) — Home Screen, Lock Screen, StandBy widgets
- **Interactive Widgets** (iOS 17+) — Buttons and toggles with App Intents
- **Live Activities** (iOS 16.1+) — Real-time updates on Lock Screen and Dynamic Island
- **Control Center Widgets** (iOS 18+) — System-wide quick controls
- **App Extensions** — Shared data, lifecycle, entitlements

Widgets are SwiftUI **archived snapshots** rendered on a timeline by the system. Extensions are sandboxed executables bundled with your app.

## When to Use This Skill

✅ **Use this skill when**:
- Implementing any type of widget (Home Screen, Lock Screen, StandBy)
- Creating Live Activities for ongoing events
- Building Control Center controls
- Sharing data between app and extensions
- Understanding widget timelines and refresh policies
- Integrating widgets with App Intents
- Supporting watchOS or visionOS widgets

❌ **Do NOT use this skill for**:
- Pure App Intents questions (use **app-intents-ref** skill)
- SwiftUI layout issues (use **swiftui-layout** skill)
- Performance optimization (use **swiftui-performance** skill)
- Debugging crashes (use **xcode-debugging** skill)

## Related Skills

- **app-intents-ref** — App Intents for interactive widgets and configuration
- **swift-concurrency** — Async/await patterns for widget data loading
- **swiftui-performance** — Optimizing widget rendering
- **swiftui-layout** — Complex widget layouts
- **extensions-widgets** — Discipline skill with anti-patterns and debugging

## Key Terminology

- **Timeline** — Series of entries defining when/what content to display; system shows entries at specified times
- **TimelineProvider** — Protocol supplying timeline entries (placeholder, snapshot, timeline generation)
- **TimelineEntry** — Struct with widget data + display date
- **Timeline Budget** — Daily limit (40-70) for timeline reloads
- **Budget-Exempt** — Reloads that don't count (user-initiated, app foregrounding, system-initiated)
- **Widget Family** — Size/shape (systemSmall, systemMedium, accessoryCircular, etc.)
- **App Groups** — Entitlement for shared data container between app and extensions
- **ActivityAttributes** — Static data (set once) + dynamic ContentState (updated during lifecycle)
- **ContentState** — Changing part of ActivityAttributes; must be under 4KB total
- **Dynamic Island** — iPhone 14 Pro+ Live Activity display; compact, minimal, and expanded sizes
- **ControlWidget** — iOS 18+ widgets for Control Center, Lock Screen, and Action Button
- **Supplemental Activity Families** — Enables Live Activities on Apple Watch or CarPlay

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

For Live Activities (covered in Live Activities section).

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
- **`systemExtraLarge`** (~720×380, iOS 15+ iPad only) — Rich layouts, multiple views

### Accessory Families (Lock Screen, iOS 16+)
- **`accessoryCircular`** (~48×48pt) — Circular complication, icon or gauge
- **`accessoryRectangular`** (~160×72pt) — Above clock, text + icon
- **`accessoryInline`** (single line) — Above date, text only

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

## Button and Toggle

Interactive widgets use SwiftUI `Button` and `Toggle` with App Intents.

### Button with App Intent

```swift
Button(intent: IncrementIntent()) {
    Label("Increment", systemImage: "plus.circle")
}
```

The intent updates shared data via App Groups in its `perform()` method. See **axiom-app-intents-ref** for full `AppIntent` definition syntax.

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

The intent follows the same `AppIntent` structure with a `@Parameter(title: "Enabled") var enabled: Bool`. See **axiom-app-intents-ref** for full `AppIntent` definition syntax.

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

# Part 4: Live Activities (iOS 16.1+)

## ActivityAttributes

Defines static and dynamic data for a Live Activity.

```swift
import ActivityKit

struct PizzaDeliveryAttributes: ActivityAttributes {
    // Static data - set when activity starts, never changes
    struct ContentState: Codable, Hashable {
        // Dynamic data - updated throughout activity lifecycle
        var status: DeliveryStatus
        var estimatedDeliveryTime: Date
        var driverName: String?
    }

    // Static attributes
    var orderNumber: String
    var pizzaType: String
}
```

**Key constraint**: `ActivityAttributes` total data size must be under **4KB** to start successfully.

## Starting Activities

### Request Authorization

```swift
import ActivityKit

let authorizationInfo = ActivityAuthorizationInfo()
let areActivitiesEnabled = authorizationInfo.areActivitiesEnabled
```

### Start an Activity

```swift
let attributes = PizzaDeliveryAttributes(
    orderNumber: "12345",
    pizzaType: "Pepperoni"
)

let initialState = PizzaDeliveryAttributes.ContentState(
    status: .preparing,
    estimatedDeliveryTime: Date().addingTimeInterval(30 * 60)
)

let activity = try Activity.request(
    attributes: attributes,
    content: ActivityContent(state: initialState, staleDate: nil),
    pushType: nil // or .token for push notifications
)
```

## Error Handling

### Common Activity Errors

Always check `ActivityAuthorizationInfo().areActivitiesEnabled` before requesting. Handle these errors from `Activity.request()`:

- **`ActivityAuthorizationError`** — User denied Live Activities permission
- **`ActivityError.dataTooLarge`** — ActivityAttributes exceeds 4KB; reduce attribute size
- **`ActivityError.tooManyActivities`** — System limit reached (typically 2-3 simultaneous)

Store `activity.id` after successful request for later updates.

## Updating Activities

### Update with New Content

```swift
// Find active activity by stored ID
guard let activity = Activity<PizzaDeliveryAttributes>.activities
    .first(where: { $0.id == storedActivityID }) else { return }

let updatedState = PizzaDeliveryAttributes.ContentState(
    status: .onTheWay,
    estimatedDeliveryTime: Date().addingTimeInterval(10 * 60),
    driverName: "John"
)

await activity.update(
    ActivityContent(
        state: updatedState,
        staleDate: Date().addingTimeInterval(60) // Mark stale after 1 min
    )
)
```

### Alert Configuration

```swift
await activity.update(updatedContent, alertConfiguration: AlertConfiguration(
    title: "Pizza is here!",
    body: "Your \(attributes.pizzaType) pizza has arrived",
    sound: .default
))
```

### Monitoring Activity Lifecycle

Use `activity.activityStateUpdates` async sequence to observe state changes (`.active`, `.ended`, `.dismissed`, `.stale`). Clean up stored activity IDs on `.ended` or `.dismissed`. Cancel the monitoring task in `deinit`.

## Ending Activities

### Dismissal Policies

```swift
await activity.end(
    ActivityContent(state: finalState, staleDate: nil),
    dismissalPolicy: .default
)
```

Dismissal policy options:
- **`.immediate`** — Removes instantly
- **`.default`** — Stays on Lock Screen for ~4 hours
- **`.after(date)`** — Removes at specific time (e.g., `.after(Date().addingTimeInterval(3600))`)

## Push Notifications for Live Activities

### Request Push Token

```swift
let activity = try Activity.request(
    attributes: attributes,
    content: initialContent,
    pushType: .token // Request push token
)

// Monitor for push token
for await pushToken in activity.pushTokenUpdates {
    let tokenString = pushToken.map { String(format: "%02x", $0) }.joined()
    // Send to your server
    await sendTokenToServer(tokenString, activityID: activity.id)
}
```

### Frequent Push Updates (iOS 18.2+)

Standard limit is ~10-12 pushes/hour. For live events (sports, stocks), add the `com.apple.developer.activity-push-notification-frequent-updates` entitlement for significantly higher limits.

---

# Part 5: Dynamic Island (iOS 16.1+)

## Presentation Types

Live Activities appear in the Dynamic Island with three size classes:

### Compact (Leading + Trailing)

Shown when another Live Activity is expanded or when multiple activities are active.

```swift
DynamicIsland {
    DynamicIslandExpandedRegion(.leading) {
        Image(systemName: "timer")
    }
    DynamicIslandExpandedRegion(.trailing) {
        Text("\(entry.timeRemaining)")
    }
    // ...
} compactLeading: {
    Image(systemName: "timer")
} compactTrailing: {
    Text("\(entry.timeRemaining)")
        .frame(width: 40)
}
```

### Minimal

Shown when more than two Live Activities are active (circular avatar).

```swift
DynamicIsland {
    // ...
} minimal: {
    Image(systemName: "timer")
        .foregroundStyle(.tint)
}
```

### Expanded

Shown when user long-presses the compact view.

```swift
DynamicIsland {
    DynamicIslandExpandedRegion(.leading) {
        Image(systemName: "timer")
            .font(.title)
    }

    DynamicIslandExpandedRegion(.trailing) {
        VStack(alignment: .trailing) {
            Text("\(entry.timeRemaining)")
                .font(.title2.monospacedDigit())
            Text("remaining")
                .font(.caption)
        }
    }

    DynamicIslandExpandedRegion(.center) {
        // Optional center content
    }

    DynamicIslandExpandedRegion(.bottom) {
        HStack {
            Button(intent: PauseIntent()) {
                Label("Pause", systemImage: "pause.fill")
            }
            Button(intent: StopIntent()) {
                Label("Stop", systemImage: "stop.fill")
            }
        }
    }
}
```

## Design Principles (From WWDC 2023-10194)

### Concentric Alignment

Content should nest concentrically inside the Dynamic Island's rounded shape with even margins. Use `Circle()` or `RoundedRectangle(cornerRadius:)` — never sharp `Rectangle()` which pokes into corners.

### Biological Motion

Dynamic Island animations should feel organic and elastic. Use `.spring(response: 0.6, dampingFraction: 0.7)` or `.interpolatingSpring(stiffness: 300, damping: 25)` instead of linear animations.

---

# Part 6: Control Center Widgets (iOS 18+)

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

For boolean state.

```swift
struct AirplaneModeControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "AirplaneModeControl") {
            ControlWidgetToggle(
                isOn: AirplaneModeIntent.isEnabled,
                action: AirplaneModeIntent()
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

Use `AppIntentControlConfiguration` with a `WidgetConfigurationIntent` (same pattern as configurable widgets). Add `.promptsForUserConfiguration()` to show configuration UI when the user adds the control.

## Control Refinements

- `.controlWidgetActionHint("Toggles flashlight")` — VoiceOver accessibility hint
- `.displayName("My Control")` / `.description("...")` — Shown in Control Center UI

---

# Part 7: iOS 18+ Updates

## Liquid Glass / Accented Rendering (iOS 18+)

Apply `.widgetAccentedRenderingMode(.accented)` to your widget view for system glass effects. Default is `.fullColor`. When accented, colors blend with system glass — test in multiple contexts (Home Screen, StandBy, Lock Screen).

## Cross-Platform Support

### visionOS (2+)
Use `#if os(visionOS)` guard, `.supportedFamilies([.systemSmall, .systemMedium])`, and `.ornamentLevel(.default)` for spatial ornament positioning.

### CarPlay (iOS 18+)
Add `.supplementalActivityFamilies([.medium])` to `ActivityConfiguration`. Uses StandBy-style full-width dashboard presentation.

### macOS Menu Bar
Live Activities from paired iPhone appear automatically in macOS Sequoia+ menu bar. No code changes required.

### watchOS Controls (11+)
`ControlWidget` works identically on watchOS — available in Control Center, Action Button, and Smart Stack. Same `StaticControlConfiguration` / `ControlWidgetButton` pattern as iOS.

## Relevance Widgets (iOS 18+)

Use `.relevanceConfiguration(for:score:attributes:)` to help the system promote widgets in Smart Stack. Attributes include `.location(CLLocation)`, `.timeOfDay(DateInterval)`, and `.activity(String)` for context-aware ranking.

## Push Notification Updates (iOS 18+)

Implement `PKPushRegistryDelegate` and handle `.widgetKit` push type to receive server-to-widget pushes. Update shared container data and call `WidgetCenter.shared.reloadAllTimelines()`. Pushes to iPhone automatically sync to Apple Watch and CarPlay.

---

# Part 8: App Groups & Data Sharing

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

# Part 9: watchOS Integration

## supplementalActivityFamilies (watchOS 11+)

Add `.supplementalActivityFamilies([.small])` to `ActivityConfiguration` to show Live Activities on Apple Watch Smart Stack (same modifier used for CarPlay with `.medium`).

## activityFamily Environment

Use `@Environment(\.activityFamily)` to adapt layout — check for `.small` (watchOS) vs iPhone layout.

## Always On Display

Use `@Environment(\.isLuminanceReduced)` to simplify views for Always On Display — reduce detail, use white text, larger fonts. Combine with `@Environment(\.colorScheme)` for proper dark mode handling.

## Update Budgeting (watchOS)

watchOS updates sync automatically with iPhone via push notifications. Updates may be delayed if watch is out of Bluetooth range.

---

# Part 10: Practical Workflows

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

**Live Activities** (if applicable):
- [ ] ActivityAttributes under 4KB
- [ ] Authorization checked before starting
- [ ] Activity ends when event completes
- [ ] Proper dismissal policy set
- [ ] watchOS support configured if relevant (supplementalActivityFamilies)
- [ ] Dynamic Island layouts tested (compact, minimal, expanded)

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

# Part 11: Troubleshooting

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

## Live Activity Won't Start

**Symptoms**: `Activity.request()` throws error

**Common Errors**:

**"Activity size exceeds 4KB"**:
```swift
// ❌ BAD: Large images in attributes
struct MyAttributes: ActivityAttributes {
    var productImage: UIImage  // Too large!
}

// ✅ GOOD: Use asset catalog names
struct MyAttributes: ActivityAttributes {
    var productImageName: String  // Reference to asset
}
```

**"Activities not enabled"**:
```swift
// Check authorization first
let authInfo = ActivityAuthorizationInfo()
guard authInfo.areActivitiesEnabled else {
    throw ActivityError.notEnabled
}
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

**watchOS Live Activity not showing**: Add `.supplementalActivityFamilies([.small])` to `ActivityConfiguration`, verify watchOS 11+, check Bluetooth/pairing.

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

**WWDC**: 2025-278, 2024-10157, 2024-10068, 2024-10098, 2023-10028, 2023-10194, 2022-10184, 2022-10185

**Docs**: /widgetkit, /activitykit, /appintents

**Skills**: axiom-app-intents-ref, axiom-swift-concurrency, axiom-swiftui-performance, axiom-swiftui-layout, axiom-extensions-widgets

---

**Version**: 0.9 | **Platforms**: iOS 14+, iPadOS 14+, watchOS 9+, macOS 11+, axiom-visionOS 2+
