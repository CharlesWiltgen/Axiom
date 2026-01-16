---
name: axiom-extensions-widgets-ref
description: Use when implementing widgets, Live Activities, Control Center controls, or app extensions - comprehensive API reference for WidgetKit, ActivityKit, App Groups, and extension lifecycle for iOS 14+
user-invocable: true
skill_type: reference
version: 1.0.0
apple_platforms: iOS 14+, iPadOS 14+, watchOS 9+, macOS 11+, axiom-visionOS 2+
---

# Extensions & Widgets API Reference

## Overview

This skill provides comprehensive API reference for Apple's widget and extension ecosystem:

- **Standard Widgets** (iOS 14+) — Home Screen, Lock Screen, StandBy widgets
- **Interactive Widgets** (iOS 17+) — Buttons and toggles with App Intents
- **Live Activities** (iOS 16.1+) — Real-time updates on Lock Screen and Dynamic Island
- **Control Center Widgets** (iOS 18+) — System-wide quick controls
- **App Extensions** — Shared data, lifecycle, entitlements

**What are widgets?**: Widgets are SwiftUI views that display timely, relevant information from your app. Unlike live app views, widgets are **archived snapshots** rendered on a timeline and displayed by the system.

**What are extensions?**: App extensions are separate executables bundled with your app that run in sandboxed environments with limited resources and capabilities.

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

**Timeline** — A series of entries that define when and what content your widget displays. The system automatically shows the appropriate entry at each specified time.

**TimelineProvider** — Protocol you implement to supply timeline entries to the system. Includes methods for placeholder, snapshot, and actual timeline generation.

**TimelineEntry** — A struct containing your widget's data and the date when it should be displayed. Each entry is like a "snapshot" of your widget at a specific time.

**Timeline Budget** — The daily limit (40-70) of how many times the system will request new timelines for your widget. Helps conserve battery.

**Budget-Exempt** — Timeline reloads that don't count against your daily budget (user-initiated, app foregrounding, system-initiated).

**Widget Family** — The size/shape of a widget (systemSmall, systemMedium, accessoryCircular, etc.). Your view adapts based on the family.

**App Groups** — An entitlement that allows your app and extensions to share data through a common container. Required for widgets to access app data.

**ActivityAttributes** — Defines both static data (set once when Live Activity starts) and dynamic ContentState (updated throughout activity lifecycle).

**ContentState** — The part of ActivityAttributes that changes during a Live Activity's lifetime. Must be under 4KB total.

**Dynamic Island** — iPhone 14 Pro+ feature where Live Activities appear around the TrueDepth camera. Has three sizes: compact, minimal, and expanded.

**ControlWidget** — iOS 18+ feature allowing widgets to appear in Control Center, Lock Screen, and Action Button for quick actions.

**Concentric Alignment** — Design principle for Dynamic Island content where visual mass (centroid) nestles inside the Island's rounded walls with even margins.

**Visual Mass (Centroid)** — The perceived "weight" center of your content. In Dynamic Island, this should align with the Island's shape for proper fit.

**Supplemental Activity Families** — Enables Live Activities to appear on Apple Watch or CarPlay in addition to iPhone.

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

**Decision Tree**:

```
Does your widget need user configuration?
├─ NO → Use StaticConfiguration
│  └─ Example: Weather widget for current location
│
└─ YES → Need configuration
   ├─ Simple static options (no dynamic data)?
   │  └─ Use AppIntentConfiguration with WidgetConfigurationIntent
   │     └─ Example: Timer with preset durations (5, 10, 15 minutes)
   │
   └─ Dynamic options (projects, contacts, playlists)?
      └─ Use AppIntentConfiguration + EntityQuery
         └─ Example: Project status widget showing user's projects
```

**Configuration Type Comparison**:

| Configuration | Use When | Example |
|---------------|----------|---------|
| **StaticConfiguration** | No user customization needed | Weather for current location, battery status |
| **AppIntentConfiguration** (simple) | Fixed list of options | Timer presets, theme selection |
| **AppIntentConfiguration** (EntityQuery) | Dynamic list from app data | Project picker, contact picker, playlist selector |
| **ActivityConfiguration** | Live ongoing events | Delivery tracking, workout progress, sports scores |

## Widget Families

### System Families (Home Screen)

| Family | Size (points) | iOS Version | Use Case |
|--------|---------------|-------------|----------|
| `systemSmall` | ~170×170 | 14+ | Single piece of info, icon |
| `systemMedium` | ~360×170 | 14+ | Multiple data points, chart |
| `systemLarge` | ~360×380 | 14+ | Detailed view, list |
| `systemExtraLarge` | ~720×380 | 15+ (iPad only) | Rich layouts, multiple views |

### Accessory Families (Lock Screen, iOS 16+)

| Family | Location | Size | Content |
|--------|----------|------|---------|
| `accessoryCircular` | Circular complication | ~48×48pt | Icon or gauge |
| `accessoryRectangular` | Above clock | ~160×72pt | Text + icon |
| `accessoryInline` | Above date | Single line | Text only |

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

Controls when the system requests a new timeline.

| Policy | Behavior |
|--------|----------|
| `.atEnd` | Reload after last entry |
| `.after(date)` | Reload at specific date |
| `.never` | No automatic reload (manual only) |

### Manual Reload

```swift
import WidgetKit

// Reload all widgets of this kind
WidgetCenter.shared.reloadAllTimelines()

// Reload specific kind
WidgetCenter.shared.reloadTimelines(ofKind: "MyWidget")
```

## Refresh Budgets

**Daily budget**: 40-70 timeline reloads per day (varies by system load and user engagement)

### Budget-Exempt Scenarios

These do NOT count against your budget:
- User explicitly reloads (pull-to-refresh on Home Screen)
- App is foregrounded
- User adds widget to Home Screen
- System-initiated reloads (e.g., after reboot)

### Best Practices

```swift
// ✅ GOOD: Strategic intervals (15-60 min)
let entries = (0..<8).map { offset in
    let date = Calendar.current.date(byAdding: .minute, value: offset * 15, to: now)!
    return SimpleEntry(date: date, data: data)
}

// ❌ BAD: Too frequent (1 min) - will exhaust budget
let entries = (0..<60).map { offset in
    let date = Calendar.current.date(byAdding: .minute, value: offset, to: now)!
    return SimpleEntry(date: date, data: data)
}
```

## Performance Implications

### Memory Limits

**Widget extensions have strict memory limits**:
- ~30MB for standard widgets
- ~50MB for Live Activities
- System terminates extension if exceeded

**Best practices**:
```swift
// ✅ GOOD: Load only what you need
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    let data = loadRecentItems(limit: 10)  // Limited dataset
    let entries = generateEntries(from: data)
    completion(Timeline(entries: entries, policy: .atEnd))
}

// ❌ BAD: Loading entire database
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    let allData = database.loadAllItems()  // Thousands of items = memory spike
    // ...
}
```

### Network Requests

**Never make network requests in widget views** - they won't complete before rendering.

```swift
// ❌ CRITICAL ERROR: Network in view
struct MyWidgetView: View {
    var body: some View {
        VStack {
            Text("Weather")
        }
        .onAppear {
            Task {
                // This will NOT work - view is already rendered
                let weather = try? await fetchWeather()
            }
        }
    }
}

// ✅ CORRECT: Network in timeline provider
struct Provider: TimelineProvider {
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        Task {
            // Fetch data here, before rendering
            let weather = try await fetchWeather()
            let entry = SimpleEntry(date: Date(), weather: weather)
            completion(Timeline(entries: [entry], policy: .atEnd))
        }
    }
}
```

### Timeline Generation Performance

**Target**: Complete `getTimeline()` in under 5 seconds

**Strategies**:
1. **Cache in main app** - Precompute expensive operations
2. **Async/await** - Don't block completion handler
3. **Limit entries** - 10-20 entries maximum
4. **Minimal computation** - Simple transformations only

```swift
// ✅ GOOD: Fast timeline generation
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    // Read pre-computed data from shared container
    let shared = UserDefaults(suiteName: "group.com.myapp")!
    let cachedData = shared.data(forKey: "widgetData")

    let entries = generateQuickEntries(from: cachedData)
    completion(Timeline(entries: entries, policy: .after(Date().addingTimeInterval(3600))))
}

// ❌ BAD: Expensive operations in timeline
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    // Parsing large JSON, complex algorithms
    let json = parseHugeJSON()  // 10+ seconds
    let analyzed = runMLModel(on: json)  // 5+ seconds
    // Widget will timeout and show placeholder
}
```

### Battery Impact

**Widget refresh = battery drain**

| Refresh Strategy | Daily Budget Used | Battery Impact |
|------------------|-------------------|----------------|
| Strategic (4x/hour) | ~48 reloads | Low |
| Aggressive (12x/hour) | Budget exhausted by 6 PM | High |
| On-demand only | 5-10 reloads | Minimal |

**When to reload**:
- ✅ Significant data change (order status update)
- ✅ User opens app (free reload)
- ✅ Time-based (hourly weather)
- ❌ Speculative updates (might change)
- ❌ Cosmetic changes (color theme)

### View Rendering Performance

**Widgets render frequently** (every time user views Home Screen/Lock Screen)

```swift
// ✅ GOOD: Simple, efficient views
struct MyWidgetView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.title)
                .font(.headline)
            Text(entry.subtitle)
                .font(.caption)
        }
        .padding()
    }
}

// ❌ BAD: Heavy view operations
struct MyWidgetView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack {
            // Avoid expensive operations in view body
            Text(entry.title)
            // Don't compute in body - precompute in entry
            ForEach(complexCalculation(entry.data)) { item in
                Text(item.name)
            }
        }
    }

    func complexCalculation(_ data: [Item]) -> [ProcessedItem] {
        // This runs on EVERY render
        return data.map { /* expensive transform */ }
    }
}
```

**Rule**: Precompute everything in `TimelineEntry`, keep views simple.

### Image Performance

```swift
// ✅ GOOD: Asset catalog images (fast)
Image("icon-weather")

// ✅ GOOD: SF Symbols (fast)
Image(systemName: "cloud.rain.fill")

// ⚠️ ACCEPTABLE: Small images from shared container
if let imageData = Data(/* from shared container */),
   let uiImage = UIImage(data: imageData) {
    Image(uiImage: uiImage)
}

// ❌ BAD: Remote images (won't load)
AsyncImage(url: URL(string: "https://..."))  // Doesn't work in widgets

// ❌ BAD: Large images (memory spike)
Image(/* 4K resolution image */)  // Will cause termination
```

---

# Part 2: Interactive Widgets (iOS 17+)

## Button and Toggle

Interactive widgets use SwiftUI `Button` and `Toggle` with App Intents.

### Button with App Intent

```swift
struct MyWidgetView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack {
            Text(entry.count)
            Button(intent: IncrementIntent()) {
                Label("Increment", systemImage: "plus.circle")
            }
        }
    }
}

struct IncrementIntent: AppIntent {
    static var title: LocalizedStringResource = "Increment Counter"

    func perform() async throws -> some IntentResult {
        // Update shared data using App Groups
        let shared = UserDefaults(suiteName: "group.com.myapp")!
        let count = shared.integer(forKey: "count")
        shared.set(count + 1, forKey: "count")
        return .result()
    }
}
```

### Toggle with App Intent

```swift
struct ToggleFeatureIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Feature"

    @Parameter(title: "Enabled")
    var enabled: Bool

    func perform() async throws -> some IntentResult {
        // Update shared data using App Groups
        let shared = UserDefaults(suiteName: "group.com.myapp")!
        shared.set(enabled, forKey: "featureEnabled")
        return .result()
    }
}

struct MyWidgetView: View {
    @State private var isEnabled: Bool = false

    var body: some View {
        Toggle(isOn: $isEnabled) {
            Text("Feature")
        }
        .onChange(of: isEnabled) { newValue in
            Task {
                try? await ToggleFeatureIntent(enabled: newValue).perform()
            }
        }
    }
}
```

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

```swift
import ActivityKit

func startDeliveryActivity(order: Order) {
    // Check authorization first
    let authInfo = ActivityAuthorizationInfo()
    guard authInfo.areActivitiesEnabled else {
        print("Live Activities not enabled by user")
        return
    }

    let attributes = PizzaDeliveryAttributes(
        orderNumber: order.id,
        pizzaType: order.pizzaType
    )

    let initialState = PizzaDeliveryAttributes.ContentState(
        status: .preparing,
        estimatedDeliveryTime: order.estimatedTime
    )

    do {
        let activity = try Activity.request(
            attributes: attributes,
            content: ActivityContent(state: initialState, staleDate: nil),
            pushType: .token
        )

        // Store activity ID for later updates
        UserDefaults.shared.set(activity.id, forKey: "currentDeliveryActivityID")

    } catch let error as ActivityAuthorizationError {
        // User denied Live Activities permission
        print("Authorization error: \(error.localizedDescription)")

    } catch let error as ActivityError {
        switch error {
        case .dataTooLarge:
            // ActivityAttributes exceeds 4KB
            print("Activity data too large - reduce attribute size")
        case .tooManyActivities:
            // System limit reached (typically 2-3 simultaneous)
            print("Too many active Live Activities")
        default:
            print("Activity error: \(error.localizedDescription)")
        }

    } catch {
        print("Unexpected error: \(error)")
    }
}
```

### Safely Updating Activities

```swift
func updateActivity(newStatus: DeliveryStatus) async {
    // Find active activity
    guard let activityID = UserDefaults.shared.string(forKey: "currentDeliveryActivityID"),
          let activity = Activity<PizzaDeliveryAttributes>.activities.first(where: { $0.id == activityID })
    else {
        print("No active delivery activity found")
        return
    }

    let updatedState = PizzaDeliveryAttributes.ContentState(
        status: newStatus,
        estimatedDeliveryTime: Date().addingTimeInterval(10 * 60),
        driverName: "John"
    )

    // Await the update result
    let updateTask = Task {
        await activity.update(
            ActivityContent(state: updatedState, staleDate: nil)
        )
    }

    await updateTask.value
}
```

### Handling Activity Lifecycle

```swift
class DeliveryManager {
    private var activityTask: Task<Void, Never>?

    func monitorActivity(_ activity: Activity<PizzaDeliveryAttributes>) {
        // Cancel previous monitoring
        activityTask?.cancel()

        // Monitor activity state
        activityTask = Task {
            for await state in activity.activityStateUpdates {
                switch state {
                case .active:
                    print("Activity is active")
                case .ended:
                    print("Activity ended by system")
                    // Clean up
                    UserDefaults.shared.removeObject(forKey: "currentDeliveryActivityID")
                case .dismissed:
                    print("Activity dismissed by user")
                    // Clean up
                    UserDefaults.shared.removeObject(forKey: "currentDeliveryActivityID")
                case .stale:
                    print("Activity marked stale")
                @unknown default:
                    break
                }
            }
        }
    }

    deinit {
        activityTask?.cancel()
    }
}
```

## Updating Activities

### Update with New Content

```swift
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
let updatedContent = ActivityContent(
    state: updatedState,
    staleDate: nil
)

await activity.update(updatedContent, alertConfiguration: AlertConfiguration(
    title: "Pizza is here!",
    body: "Your \(attributes.pizzaType) pizza has arrived",
    sound: .default
))
```

## Ending Activities

### Dismissal Policies

```swift
// Immediate - removes instantly
await activity.end(nil, dismissalPolicy: .immediate)

// Default - stays for ~4 hours on Lock Screen
await activity.end(nil, dismissalPolicy: .default)

// After date - removes at specific time
let dismissTime = Date().addingTimeInterval(60 * 60) // 1 hour
await activity.end(nil, dismissalPolicy: .after(dismissTime))
```

### Final Content

```swift
let finalState = PizzaDeliveryAttributes.ContentState(
    status: .delivered,
    estimatedDeliveryTime: Date(),
    driverName: "John"
)

await activity.end(
    ActivityContent(state: finalState, staleDate: nil),
    dismissalPolicy: .default
)
```

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

For scenarios requiring more frequent updates than standard push limits:

```swift
let activity = try Activity.request(
    attributes: attributes,
    content: initialContent,
    pushType: .token
)

// App needs "com.apple.developer.activity-push-notification-frequent-updates" entitlement
```

**Standard push limit**: ~10-12 per hour
**Frequent push entitlement**: Significantly higher limit for live events (sports, stocks, etc.)

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

> "A key aspect to making things fit nicely inside the Dynamic Island is for them to be concentric with its shape. This is when rounded shapes nest inside of each other with even margins all the way around."

**Visual mass (centroid)** should nestle inside the Dynamic Island walls:

```swift
// ✅ GOOD: Concentric circular shape
Circle()
    .fill(.blue)
    .frame(width: 44, height: 44)

// ❌ BAD: Square poking into corners
Rectangle()
    .fill(.blue)
    .frame(width: 44, height: 44)

// ✅ BETTER: Rounded rectangle
RoundedRectangle(cornerRadius: 12)
    .fill(.blue)
    .frame(width: 44, height: 44)
```

### Biological Motion

Dynamic Island animations should feel **organic and elastic**, not mechanical:

```swift
// Elastic spring animation
.animation(.spring(response: 0.6, dampingFraction: 0.7), value: isExpanded)

// Biological curve
.animation(.interpolatingSpring(stiffness: 300, damping: 25), value: content)
```

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

For controls that need to fetch current state asynchronously.

```swift
struct TemperatureControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "ThermostatControl", provider: ThermostatProvider()) { value in
            ControlWidgetButton(action: AdjustTemperatureIntent()) {
                Label("\(value.temperature)°", systemImage: "thermometer")
            }
        }
    }
}

struct ThermostatProvider: ControlValueProvider {
    func currentValue() async throws -> ThermostatValue {
        // Fetch current temperature from HomeKit/server
        let temp = try await HomeManager.shared.currentTemperature()
        return ThermostatValue(temperature: temp)
    }

    var previewValue: ThermostatValue {
        ThermostatValue(temperature: 72) // Fallback for preview
    }
}

struct ThermostatValue: ControlValueProviderValue {
    var temperature: Int
}
```

## Configurable Controls

Allow users to customize the control before adding.

```swift
struct ConfigureTimerIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Configure Timer"

    @Parameter(title: "Duration (minutes)", default: 5)
    var duration: Int
}

struct TimerControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(
            kind: "TimerControl",
            intent: ConfigureTimerIntent.self
        ) { config in
            ControlWidgetButton(action: StartTimerIntent(duration: config.duration)) {
                Label("\(config.duration)m", systemImage: "timer")
            }
        }
        .promptsForUserConfiguration() // Show configuration UI when adding
    }
}
```

## Control Refinements

### controlWidgetActionHint

Accessibility hint for VoiceOver.

```swift
ControlWidgetButton(action: ToggleTorchIntent()) {
    Label("Flashlight", systemImage: "flashlight.on.fill")
}
.controlWidgetActionHint("Toggles flashlight")
```

### displayName and description

```swift
StaticControlConfiguration(kind: "MyControl") {
    // ...
}
.displayName("My Control")
.description("Brief description shown in Control Center")
```

---

# Part 7: iOS 18+ Updates

## Liquid Glass / Accented Rendering

Widgets can render with **accented glass effects** matching system aesthetics (iOS 18+).

### widgetAccentedRenderingMode

```swift
struct MyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MyWidget", provider: Provider()) { entry in
            MyWidgetView(entry: entry)
                .widgetAccentedRenderingMode(.accented)
        }
    }
}
```

### Rendering Modes

| Mode | Effect |
|------|--------|
| `.accented` | System applies glass effect, respects vibrancy |
| `.fullColor` | Full color rendering (default) |

**Design consideration**: When `.accented`, your widget's colors blend with system glass. Test in multiple contexts (Home Screen, StandBy, Lock Screen).

## visionOS Support

Widgets supported on visionOS 2+ with spatial presentation.

### Mounting Styles

```swift
#if os(visionOS)
struct MyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MyWidget", provider: Provider()) { entry in
            MyWidgetView(entry: entry)
        }
        .supportedFamilies([.systemSmall, .systemMedium])
        .ornamentLevel(.default) // Spatial ornament positioning
    }
}
#endif
```

## CarPlay Widgets (iOS 18+)

Live Activities appear on CarPlay displays in supported vehicles.

```swift
struct MyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: NavigationAttributes.self) { context in
            NavigationView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Dynamic Island presentation
            }
        }
        .supplementalActivityFamilies([
            .small, // watchOS
            .medium  // CarPlay
        ])
    }
}
```

**CarPlay rendering**: Uses StandBy-style full-width presentation on the dashboard.

## macOS Menu Bar

Live Activities from paired iPhone appear in macOS menu bar automatically (no code changes required, macOS Sequoia+).

**Presentation**: Compact view appears in menu bar; clicking expands to show full content.

## watchOS Controls

Control Center widgets available on watchOS 11+ in:
- Control Center
- Action Button
- Smart Stack (automatic suggestions)

```swift
struct WatchControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "WatchControl") {
            ControlWidgetButton(action: StartWorkoutIntent()) {
                Label("Workout", systemImage: "figure.run")
            }
        }
    }
}
```

## Relevance Widgets (iOS 18+)

System intelligently promotes relevant widgets to Smart Stack on watchOS.

### RelevanceConfiguration

```swift
struct RelevantWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "RelevantWidget", provider: Provider()) { entry in
            RelevantWidgetView(entry: entry)
        }
        .relevanceConfiguration(
            for: entry,
            score: entry.relevanceScore,
            attributes: [
                .location(entry.userLocation),
                .timeOfDay(entry.relevantTimeRange)
            ]
        )
    }
}
```

### WidgetRelevanceAttribute

```swift
enum WidgetRelevanceAttribute {
    case location(CLLocation)
    case timeOfDay(DateInterval)
    case activity(String) // Calendar event, workout, etc.
}
```

## Push Notification Updates (iOS 18+)

### WidgetPushHandler

Server-to-widget push notifications with cross-device sync.

```swift
class WidgetPushHandler: NSObject, PKPushRegistryDelegate {
    func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType) {
        if type == .widgetKit {
            // Update widget data in shared container
            let shared = UserDefaults(suiteName: "group.com.myapp")!
            if let data = payload.dictionaryPayload["widgetData"] as? [String: Any] {
                shared.set(data, forKey: "widgetData")
            }

            // Reload widgets
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}
```

**Cross-device sync**: Push to iPhone automatically syncs to Apple Watch and CarPlay Live Activities.

---

# Part 8: App Groups & Data Sharing

## App Groups Entitlement

Required for sharing data between your app and extensions.

### Configuration

1. **Xcode**: Targets → Signing & Capabilities → Add "App Groups"
2. **Identifier format**: `group.com.company.appname`
3. **Enable for both**: Main app target AND extension target

### Example Entitlement File

```xml
<key>com.apple.security.application-groups</key>
<array>
    <string>group.com.mycompany.myapp</string>
</array>
```

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

```swift
lazy var persistentContainer: NSPersistentContainer = {
    let container = NSPersistentContainer(name: "MyApp")

    let sharedStoreURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.com.mycompany.myapp"
    )!.appendingPathComponent("MyApp.sqlite")

    let description = NSPersistentStoreDescription(url: sharedStoreURL)
    container.persistentStoreDescriptions = [description]

    container.loadPersistentStores { description, error in
        // Handle errors
    }

    return container
}()
```

## IPC Communication

### Background URL Session (For Downloads)

```swift
// Main app
let config = URLSessionConfiguration.background(withIdentifier: "com.mycompany.myapp.background")
config.sharedContainerIdentifier = "group.com.mycompany.myapp"
let session = URLSession(configuration: config)
```

### Darwin Notification Center (Simple Signals)

```swift
import Foundation

// Post notification
CFNotificationCenterPostNotification(
    CFNotificationCenterGetDarwinNotifyCenter(),
    CFNotificationName("com.mycompany.myapp.dataUpdated" as CFString),
    nil, nil, true
)

// Observe notification (in widget)
CFNotificationCenterAddObserver(
    CFNotificationCenterGetDarwinNotifyCenter(),
    Unmanaged.passUnretained(self).toOpaque(),
    { (center, observer, name, object, userInfo) in
        // Reload widget
        WidgetCenter.shared.reloadAllTimelines()
    },
    "com.mycompany.myapp.dataUpdated" as CFString,
    nil, .deliverImmediately
)
```

---

# Part 9: watchOS Integration

## supplementalActivityFamilies (watchOS 11+)

Live Activities from iPhone automatically appear on Apple Watch Smart Stack.

```swift
struct MyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DeliveryAttributes.self) { context in
            // iPhone presentation
            DeliveryView(context: context)
        } dynamicIsland: { context in
            // Dynamic Island (iPhone only)
            DynamicIsland { /* ... */ }
        }
        .supplementalActivityFamilies([.small]) // Enable watchOS
    }
}
```

## activityFamily Environment

Adapt layout for Apple Watch.

```swift
struct DeliveryView: View {
    @Environment(\.activityFamily) var activityFamily
    var context: ActivityViewContext<DeliveryAttributes>

    var body: some View {
        if activityFamily == .small {
            // watchOS-optimized layout
            WatchDeliveryView(context: context)
        } else {
            // iPhone layout
            iPhoneDeliveryView(context: context)
        }
    }
}
```

## Always On Display Adaptation

### isLuminanceReduced

```swift
struct WatchWidgetView: View {
    @Environment(\.isLuminanceReduced) var isLuminanceReduced

    var body: some View {
        if isLuminanceReduced {
            // Simplified view for Always On Display
            Text(timeString)
                .font(.system(.title, design: .rounded))
        } else {
            // Full color, detailed view
            VStack {
                Text(timeString).font(.title)
                Text(statusString).font(.caption)
            }
        }
    }
}
```

### Color Scheme Adaptation

```swift
@Environment(\.colorScheme) var colorScheme

var body: some View {
    Text("Status")
        .foregroundColor(
            isLuminanceReduced
                ? .white  // Always On: white text
                : (colorScheme == .dark ? .white : .black)
        )
}
```

## Update Budgeting (watchOS)

**Synchronization**: watchOS Live Activity updates are synchronized with iPhone. When iPhone receives an update via push notification, watchOS automatically refreshes.

**Connectivity**: Updates may be delayed if Apple Watch is out of range or Bluetooth is disconnected.

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

### Unit Testing Timeline Providers

```swift
import XCTest
import WidgetKit
@testable import MyWidgetExtension

class TimelineProviderTests: XCTestCase {
    var provider: Provider!

    override func setUp() {
        super.setUp()
        provider = Provider()
    }

    func testPlaceholderReturnsValidEntry() {
        let context = MockContext()
        let entry = provider.placeholder(in: context)

        XCTAssertNotNil(entry)
        // Placeholder should have default/safe values
    }

    func testTimelineGenerationWithValidData() {
        // Setup: Save test data to shared container
        let testData = WidgetData(title: "Test", value: 100, lastUpdated: Date())
        SharedDataManager.shared.saveData(testData)

        let expectation = expectation(description: "Timeline generated")
        let context = MockContext()

        provider.getTimeline(in: context) { timeline in
            XCTAssertFalse(timeline.entries.isEmpty)
            XCTAssertEqual(timeline.entries.first?.widgetData?.title, "Test")
            expectation.fulfill()
        }

        waitForExpectations(timeout: 5.0)
    }
}
```

### Manual Testing Checklist

**Basic Functionality**:
1. Add widget to Home Screen
2. Verify it shows in widget gallery
3. Check all supported sizes display correctly
4. Confirm data matches app data

**Data Updates**:
1. Change data in main app
2. Observe widget updates (may take seconds)
3. Force-quit app, verify widget still shows data
4. Reboot device, verify widget persists

**Edge Cases**:
1. Delete all app data, verify widget handles gracefully
2. Disable network, verify widget works offline
3. Enable Low Power Mode, verify widget respects limits
4. Add multiple instances of same widget

**Performance**:
1. Monitor memory usage in Xcode (Debug Navigator)
2. Check timeline generation time in Console logs
3. Verify no crashes in crash logs
4. Test on older devices (not just latest iPhone)

### Debugging Tips

**Widget not updating?**
```swift
// Add logging to getTimeline()
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    print("⏰ Widget timeline requested at \(Date())")
    let data = SharedDataManager.shared.loadData()
    print("📊 Loaded data: \(String(describing: data))")
    // ...
}

// In main app after data change
print("🔄 Reloading widget timelines")
WidgetCenter.shared.reloadAllTimelines()
```

**Check Console logs**:
```
Widget: ⏰ Widget timeline requested at 2024-01-15 10:30:00
Widget: 📊 Loaded data: Optional(WidgetData(title: "Test", value: 42))
```

**Verify App Groups**:
```swift
// In both app and widget, verify same path
let container = FileManager.default.containerURL(
    forSecurityApplicationGroupIdentifier: "group.com.yourcompany.yourapp"
)
print("📁 Container path: \(container?.path ?? "nil")")
// Both should print SAME path
```

---

# Part 11: Troubleshooting

## Widget Not Appearing in Gallery

**Symptoms**: Widget doesn't show up in the widget picker

**Diagnostic Steps**:
1. Check `WidgetBundle` includes your widget
2. Verify `supportedFamilies()` is set
3. Check extension target's "Skip Install" is NO
4. Verify extension's deployment target matches app

**Solution**:
```swift
@main
struct MyWidgetBundle: WidgetBundle {
    var body: some Widget {
        MyWidget()
        // Add your widget here if missing
    }
}
```

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

## Control Center Widget Slow/Unresponsive

**Symptoms**: Control takes seconds to respond, appears frozen

**Cause**: Synchronous work in `ControlValueProvider` or intent `perform()`

**Solution**:
```swift
struct MyValueProvider: ControlValueProvider {
    func currentValue() async throws -> MyValue {
        // ✅ GOOD: Async fetch
        let value = try await fetchCurrentValue()
        return MyValue(data: value)
    }

    var previewValue: MyValue {
        // ✅ GOOD: Fast fallback
        MyValue(data: "Loading...")
    }
}

// ❌ BAD: Don't block main thread
func currentValue() async throws -> MyValue {
    Thread.sleep(forTimeInterval: 2.0)  // Blocks UI
}
```

## Widget Shows Wrong Size/Layout

**Symptoms**: Widget clipped or incorrect aspect ratio

**Diagnostic Steps**:
1. Check `entry.family` in view code
2. Verify view adapts to family size
3. Test all supported families
4. Check for hardcoded sizes

**Solution**:
```swift
struct MyWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallLayout(entry: entry)
        case .systemMedium:
            MediumLayout(entry: entry)
        default:
            Text("Unsupported")
        }
    }
}
```

## Timeline Entries Not Appearing in Order

**Symptoms**: Widget jumps between entries randomly

**Cause**: Entry dates not in chronological order

**Solution**:
```swift
// ✅ GOOD: Chronological dates
let now = Date()
let entries = (0..<5).map { offset in
    let date = Calendar.current.date(byAdding: .hour, value: offset, to: now)!
    return SimpleEntry(date: date, data: "Entry \(offset)")
}

// ❌ BAD: Out of order dates
let entries = [
    SimpleEntry(date: Date().addingTimeInterval(3600), data: "2"),
    SimpleEntry(date: Date(), data: "1"),  // Out of order
]
```

## watchOS Live Activity Not Showing

**Symptoms**: Activity appears on iPhone but not Apple Watch

**Diagnostic Steps**:
1. Check `.supplementalActivityFamilies([.small])` is set
2. Verify Apple Watch is paired and nearby
3. Check watchOS version (11+)
4. Ensure Bluetooth enabled

**Solution**:
```swift
ActivityConfiguration(for: MyAttributes.self) { context in
    MyActivityView(context: context)
} dynamicIsland: { context in
    DynamicIsland { /* ... */ }
}
.supplementalActivityFamilies([.small])  // Required for watchOS
```

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

## Resources

**WWDC**: 2025-278, 2024-10157, 2024-10068, 2024-10098, 2023-10028, 2023-10194, 2022-10184, 2022-10185

**Docs**: /widgetkit, /activitykit, /appintents

**Skills**: axiom-app-intents-ref, axiom-swift-concurrency, axiom-swiftui-performance, axiom-swiftui-layout, axiom-extensions-widgets

---

**Version**: 0.9 | **Platforms**: iOS 14+, iPadOS 14+, watchOS 9+, macOS 11+, axiom-visionOS 2+
