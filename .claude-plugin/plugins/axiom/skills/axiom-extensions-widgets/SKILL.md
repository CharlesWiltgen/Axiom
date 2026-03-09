---
name: axiom-extensions-widgets
description: Use when implementing widgets, Live Activities, or Control Center controls - enforces correct patterns for timeline management, data sharing, and extension lifecycle to prevent common crashes and memory issues
license: MIT
compatibility: iOS 14+, iPadOS 14+, watchOS 9+
metadata:
  version: "1.0.0"
---

# Extensions & Widgets — Discipline

## Core Philosophy

> "Widgets are not mini apps. They're glanceable views into your app's data, rendered at strategic moments and displayed by the system. Extensions run in sandboxed environments with limited memory and execution time."

**Mental model**: Think of widgets as **archived snapshots** on a timeline, not live views. Your widget doesn't "run" continuously — it renders, gets archived, and the system displays the snapshot.

**Extension sandboxing**: Extensions have:
- Limited memory (~30MB)
- No network access in widget views (fetch in TimelineProvider only)
- Separate bundle container from main app
- Require App Groups for data sharing

## When to Use This Skill

✅ **Use this skill when**:
- Implementing any widget (Home Screen, Lock Screen, StandBy, Control Center)
- Creating Live Activities
- Debugging why widgets show stale data
- Widget not appearing in gallery
- Interactive buttons not responding
- Live Activity fails to start
- Control Center control is unresponsive
- Sharing data between app and widget/extension

❌ **Do NOT use this skill for**:
- Pure App Intents implementation (use **app-intents-ref**)
- SwiftUI layout questions (use **swiftui-layout**)
- Performance profiling (use **swiftui-performance**)
- General debugging (use **xcode-debugging**)

## Related Skills

- **extensions-widgets-ref** — Comprehensive API reference
- **app-intents-ref** — App Intents for interactive widgets
- **swift-concurrency** — Async patterns for data fetching
- **swiftdata** — Using SwiftData with App Groups

## Example Prompts

#### 1. "My widget isn't updating"
→ This skill covers timeline policies, refresh budgets, manual reload, and App Groups configuration

#### 2. "How do I share data between app and widget?"
→ This skill explains App Groups entitlement, shared UserDefaults, and container URLs

#### 3. "Widget shows old data even after I update the app"
→ This skill covers container paths, UserDefaults suite names, and WidgetCenter reload

#### 4. "Live Activity fails to start"
→ This skill covers 4KB data limit, ActivityAttributes constraints, authorization checks

#### 5. "Control Center control takes forever to respond"
→ This skill covers async ValueProvider patterns and optimistic UI

#### 6. "Interactive widget button does nothing"
→ This skill covers App Intent perform() implementation and WidgetCenter reload

---

# Red Flags / Anti-Patterns

## Pattern 1: Network Calls in Widget View

**Time cost**: 2-4 hours debugging why widgets are blank or show errors

### Symptom
- Widget renders but shows no data
- Console errors: "NSURLSession not available in widget extension"
- Widget appears blank intermittently

### ❌ BAD Code

```swift
struct MyWidgetView: View {
    @State private var data: String?

    var body: some View {
        VStack {
            if let data = data {
                Text(data)
            }
        }
        .onAppear {
            // ❌ WRONG — Network in widget view
            Task {
                let (data, _) = try await URLSession.shared.data(from: apiURL)
                self.data = String(data: data, encoding: .utf8)
            }
        }
    }
}
```

**Why it fails**: Widget views are rendered, archived, and reused. Network calls in views are unreliable and may not execute.

### ✅ GOOD Code

```swift
// Main app — prefetch and save
func updateWidgetData() async {
    let data = try await fetchFromAPI()
    let shared = UserDefaults(suiteName: "group.com.myapp")!
    shared.set(data, forKey: "widgetData")

    WidgetCenter.shared.reloadAllTimelines()
}

// Widget TimelineProvider — read from shared storage
struct Provider: TimelineProvider {
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let shared = UserDefaults(suiteName: "group.com.myapp")!
        let data = shared.string(forKey: "widgetData") ?? "No data"

        let entry = SimpleEntry(date: Date(), data: data)
        let timeline = Timeline(entries: [entry], policy: .atEnd)
        completion(timeline)
    }
}
```

**Pattern**: Fetch data in main app, save to shared storage, read in widget.

**Can TimelineProvider make network requests?**

Yes, but with important caveats:

```swift
struct Provider: TimelineProvider {
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        Task {
            // ✅ Network requests ARE allowed here
            let data = try await fetchFromAPI()
            let entry = SimpleEntry(date: Date(), data: data)
            completion(Timeline(entries: [entry], policy: .atEnd))
        }
    }
}
```

**Constraints**:
- **30-second timeout** - System kills extension if getTimeline() doesn't complete
- **No background sessions** - Can't download large files
- **Battery cost** - Every timeline reload uses battery
- **Not guaranteed** - May fail on poor connections

**Best practice**: Prefetch in main app (faster, more reliable), use TimelineProvider network as fallback only.

---

## Pattern 2: Missing App Groups

**Time cost**: 1-2 hours debugging why widget shows empty/default data

### Symptom
- Widget always shows placeholder or default values
- Changes in main app don't reflect in widget
- UserDefaults reads return nil in widget

### ❌ BAD Code

```swift
// Main app
UserDefaults.standard.set("Updated", forKey: "myKey")

// Widget extension
let value = UserDefaults.standard.string(forKey: "myKey") // Returns nil!
```

**Why it fails**: `UserDefaults.standard` accesses different containers in app vs. extension.

### ✅ GOOD Code

```swift
// 1. Enable App Groups entitlement in BOTH targets:
//    - Main app target: Signing & Capabilities → + App Groups → "group.com.myapp"
//    - Widget extension target: Same group identifier

// 2. Main app
let shared = UserDefaults(suiteName: "group.com.myapp")!
shared.set("Updated", forKey: "myKey")

// 3. Widget extension
let shared = UserDefaults(suiteName: "group.com.myapp")!
let value = shared.string(forKey: "myKey") // Returns "Updated"
```

**Verification**:
```swift
let containerURL = FileManager.default.containerURL(
    forSecurityApplicationGroupIdentifier: "group.com.myapp"
)
print("Shared container: \(containerURL?.path ?? "MISSING")")
// Should print path, not "MISSING"
```

---

## Pattern 3: Over-Refreshing (Budget Exhaustion)

**Time cost**: Poor user experience, battery drain, widgets stop updating

### Symptom
- Widget updates frequently at first, then stops
- Console logs: "Timeline reload budget exhausted"
- Widget becomes stale after a few hours

### ❌ BAD Code

```swift
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    var entries: [SimpleEntry] = []

    // ❌ WRONG — 60 entries at 1-minute intervals
    for minuteOffset in 0..<60 {
        let date = Calendar.current.date(byAdding: .minute, value: minuteOffset, to: Date())!
        entries.append(SimpleEntry(date: date, data: "Data"))
    }

    let timeline = Timeline(entries: entries, policy: .atEnd)
    completion(timeline)
}
```

**Why it's bad**: System gives 40-70 reloads/day. This approach uses 24 reloads/hour → exhausts budget in 2-3 hours.

### ✅ GOOD Code

```swift
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    var entries: [SimpleEntry] = []

    // ✅ CORRECT — 8 entries at 15-minute intervals (2 hours coverage)
    for offset in 0..<8 {
        let date = Calendar.current.date(byAdding: .minute, value: offset * 15, to: Date())!
        entries.append(SimpleEntry(date: date, data: getData()))
    }

    let timeline = Timeline(entries: entries, policy: .atEnd)
    completion(timeline)
}
```

**Guidelines**:
- 15-60 minute intervals for most widgets
- 5-15 minutes for time-sensitive data (stocks, sports)
- Use `.atEnd` policy for automatic reload
- Let system decide optimal refresh based on user engagement

---

## Pattern 4: Blocking Main Thread in Controls

**Time cost**: Control Center control unresponsive, poor UX

### Symptom
- Tapping control in Control Center shows spinner for seconds
- Control seems "stuck" or frozen
- No immediate visual feedback

### ❌ BAD Code

```swift
struct ThermostatControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "Thermostat") {
            ControlWidgetButton(action: GetTemperatureIntent()) {
                // ❌ WRONG — Synchronous fetch blocks UI
                let temp = HomeManager.shared.currentTemperature() // Blocking call
                Label("\(temp)°", systemImage: "thermometer")
            }
        }
    }
}
```

**Why it's bad**: Button renders on main thread. Blocking network/database calls freeze UI.

### ✅ GOOD Code

```swift
struct ThermostatProvider: ControlValueProvider {
    func currentValue() async throws -> ThermostatValue {
        // ✅ CORRECT — Async fetch, non-blocking
        let temp = try await HomeManager.shared.fetchTemperature()
        return ThermostatValue(temperature: temp)
    }

    var previewValue: ThermostatValue {
        ThermostatValue(temperature: 72) // Instant fallback
    }
}

struct ThermostatValue: ControlValueProviderValue {
    var temperature: Int
}

struct ThermostatControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "Thermostat", provider: ThermostatProvider()) { value in
            ControlWidgetButton(action: AdjustTemperatureIntent()) {
                Label("\(value.temperature)°", systemImage: "thermometer")
            }
        }
    }
}
```

**Pattern**: Use `ControlValueProvider` for async data, provide instant `previewValue` fallback.

---

## Pattern 5: Missing Dismissal Policy (Zombie Live Activities)

**Time cost**: User annoyance, negative reviews

### Symptom
- Live Activities stay on Lock Screen for hours after event ends
- Users must manually dismiss completed activities
- Activity shows "Delivered" but won't disappear

### ❌ BAD Code

```swift
// Start activity
let activity = try Activity.request(attributes: attributes, content: initialContent)

// Later... event completes
// ❌ WRONG — Never call .end()
// Activity stays forever until user dismisses
```

**Why it's bad**: Activities persist indefinitely unless explicitly ended.

### ✅ GOOD Code

```swift
// When event completes
let finalState = DeliveryAttributes.ContentState(
    status: .delivered,
    deliveredAt: Date()
)

await activity.end(
    ActivityContent(state: finalState, staleDate: nil),
    dismissalPolicy: .default // Removes after ~4 hours
)

// Or for immediate removal
await activity.end(nil, dismissalPolicy: .immediate)

// Or remove at specific time
let dismissTime = Date().addingTimeInterval(30 * 60) // 30 min
await activity.end(nil, dismissalPolicy: .after(dismissTime))
```

**Best practices**:
- `.immediate` — Transient events (timer completed, song finished)
- `.default` — Most activities (shows "completed" state for ~4 hours)
- `.after(date)` — Specific end time (meeting ends, flight lands)

---

## Pattern 6: Exceeding 4KB Data Limit (Live Activities)

**Time cost**: Activity fails to start silently, hard to debug

### Symptom
- `Activity.request()` throws error
- Console: "Activity attributes exceed size limit"
- Activity never appears on Lock Screen

### ❌ BAD Code

```swift
struct GameAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var teamALogo: Data // ❌ Large image data
        var teamBLogo: Data
        var playByPlay: [String] // ❌ Unbounded array
        var statistics: [String: Any] // ❌ Large dictionary
    }

    var gameID: String
    var venueName: String
}

// Fails if total size > 4KB
let activity = try Activity.request(attributes: attrs, content: content)
```

**Why it fails**: ActivityAttributes + ContentState combined must be < 4KB.

### ✅ GOOD Code

```swift
struct GameAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var teamAScore: Int // ✅ Small primitives
        var teamBScore: Int
        var quarter: Int
        var timeRemaining: String // "2:34"
        var lastPlay: String? // Single most recent play
    }

    var gameID: String // ✅ Reference, not full data
    var teamAName: String
    var teamBName: String
}

// Use asset catalog for images in view
struct GameLiveActivityView: View {
    var context: ActivityViewContext<GameAttributes>

    var body: some View {
        HStack {
            Image(context.attributes.teamAName) // Asset catalog
            Text("\(context.state.teamAScore)")
            // ...
        }
    }
}
```

**Strategies**:
- Store IDs/references, not full objects
- Use asset catalogs for images (not embedded Data)
- Keep ContentState minimal (only changeable data)
- Use computed properties in views for derived data

### Size Targets (Safety Margins)

**Hard limit**: 4096 bytes (4KB)

**Target guidance**:
- ✅ **< 2KB**: Safe with room to grow - recommended for v1.0
- ⚠️ **2-3KB**: Acceptable but monitor closely as you add features
- 🔴 **3.5KB+**: Risky - future fields may push you over limit

**Why safety margins matter**: You'll add fields later (new features, more data). Starting at 3.8KB leaves zero room for growth.

**Checking size**:
```swift
let attributes = GameAttributes(gameID: "123", teamAName: "Hawks", teamBName: "Eagles")
let state = GameAttributes.ContentState(teamAScore: 14, teamBScore: 10, quarter: 2, timeRemaining: "5:23", lastPlay: nil)

let encoder = JSONEncoder()
if let attributesData = try? encoder.encode(attributes),
   let stateData = try? encoder.encode(state) {
    let totalSize = attributesData.count + stateData.count
    print("Total size: \(totalSize) bytes")

    if totalSize < 2048 {
        print("✅ Safe with room to grow")
    } else if totalSize < 3072 {
        print("⚠️ Acceptable but monitor")
    } else if totalSize < 3584 {
        print("🔴 Risky - optimize now")
    } else {
        print("❌ CRITICAL - will likely fail")
    }
}
```

**Optimization priorities** (when over 2KB):
1. Replace `String` descriptions with enums (if fixed set)
2. Shorten string values ("Team A" → "A")
3. Use smaller types (Int → Int8 if range allows)
4. Remove optional fields that are rarely used

---

## Pattern 7: Widget Not Appearing in Gallery

**Time cost**: 30 minutes debugging invisible widget

### Symptom
- Widget builds successfully
- No errors in console
- Widget doesn't appear in widget picker/gallery
- Can't add to Home Screen

### ❌ BAD Code

```swift
@main
struct MyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MyWidget", provider: Provider()) { entry in
            MyWidgetView(entry: entry)
        }
        .configurationDisplayName("My Widget")
        .description("Shows data")
        // ❌ MISSING: supportedFamilies() — widget won't appear!
    }
}
```

**Why it fails**: Without supportedFamilies(), system doesn't know which sizes to offer.

### ✅ GOOD Code

```swift
@main
struct MyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MyWidget", provider: Provider()) { entry in
            MyWidgetView(entry: entry)
        }
        .configurationDisplayName("My Widget")
        .description("Shows data")
        .supportedFamilies([.systemSmall, .systemMedium]) // ✅ Required
    }
}
```

**Other common causes**:
- Widget target's "Skip Install" set to YES (should be NO)
- Widget extension not added to app's "Embed App Extensions"
- Clean build folder needed (`Cmd+Shift+K`)

---

# Decision Tree

```
Widget/Extension Issue?
│
├─ Widget not appearing in gallery?
│  ├─ Check WidgetBundle registered in @main
│  ├─ Verify supportedFamilies() includes intended families
│  └─ Clean build folder, restart Xcode
│
├─ Widget not refreshing?
│  ├─ Timeline policy set to .never?
│  │  └─ Change to .atEnd or .after(date)
│  ├─ Budget exhausted? (too frequent reloads)
│  │  └─ Increase interval between entries (15-60 min)
│  └─ Manual reload
│     └─ WidgetCenter.shared.reloadAllTimelines()
│
├─ Widget shows empty/old data?
│  ├─ App Groups configured in BOTH targets?
│  │  ├─ No → Add "App Groups" entitlement
│  │  └─ Yes → Verify same group ID
│  ├─ Using UserDefaults.standard?
│  │  └─ Change to UserDefaults(suiteName: "group.com.myapp")
│  └─ Shared container path correct?
│     └─ Print containerURL, verify not nil
│
├─ Interactive button not working?
│  ├─ App Intent perform() returns value?
│  │  └─ Must return IntentResult
│  ├─ perform() updates shared data?
│  │  └─ Update App Group storage
│  └─ Calls WidgetCenter.reloadTimelines()?
│     └─ Reload to reflect changes
│
├─ Live Activity fails to start?
│  ├─ Data size > 4KB?
│  │  └─ Reduce ActivityAttributes + ContentState
│  ├─ Authorization enabled?
│  │  └─ Check ActivityAuthorizationInfo().areActivitiesEnabled
│  └─ pushType correct?
│     └─ nil for local updates, .token for push
│
├─ Control Center control unresponsive?
│  ├─ Async operation blocking UI?
│  │  └─ Use ControlValueProvider with async currentValue()
│  └─ Provide previewValue for instant fallback
│
└─ watchOS Live Activity not showing?
   ├─ supplementalActivityFamilies includes .small?
   └─ Apple Watch paired and in range?
```

---

# Mandatory First Steps

Before debugging any widget or extension issue, complete this checklist:

## Widget Debugging Checklist

- ☐ **App Groups enabled** in BOTH main app AND extension targets
  ```bash
  # Verify entitlements
  codesign -d --entitlements - /path/to/YourApp.app
  # Should show com.apple.security.application-groups
  ```

- ☐ **Widget in Widget Gallery** (not just on Home Screen)
  - Long-press Home Screen → + button → Find your widget
  - Verify it appears with correct name and description

- ☐ **Console logs** for timeline errors
  ```bash
  # Xcode Console
  # Filter: "widget" OR "timeline"
  # Look for: "Timeline reload failed", "Budget exhausted"
  ```

- ☐ **Manual reload test**
  ```swift
  WidgetCenter.shared.reloadAllTimelines()
  ```
  - If this fixes it → problem is timeline policy or refresh budget

- ☐ **Shared container accessible**
  ```swift
  let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: "group.com.myapp"
  )
  print("Container: \(container?.path ?? "NIL")")
  // Must print valid path, not "NIL"
  ```

## Live Activity Debugging Checklist

- ☐ **ActivityAttributes < 4KB**
  ```swift
  let encoded = try JSONEncoder().encode(attributes)
  print("Size: \(encoded.count) bytes") // Must be < 4096
  ```

- ☐ **Authorization check**
  ```swift
  let authInfo = ActivityAuthorizationInfo()
  print("Enabled: \(authInfo.areActivitiesEnabled)")
  ```

- ☐ **pushType matches server integration**
  - `nil` → local updates only
  - `.token` → expects push notifications

- ☐ **Dismissal policy implemented**
  - Every activity.end() must specify policy

## Control Center Widget Checklist

- ☐ **ControlValueProvider for async data**
- ☐ **previewValue provides instant fallback**
- ☐ **App Intent perform() is async**
- ☐ **No blocking network/database calls in views**

---

# Pressure Scenarios

## Scenario 1: "Widget shows wrong data in production"

### Situation
- App released to App Store
- Users report widget displaying incorrect/stale information
- Works fine in development

### Pressure Signals
- 🚨 **App Store reviews** — 1-star reviews mentioning broken widget
- ⏰ **Time pressure** — Need hotfix ASAP
- 👔 **Executive visibility** — Management asking for status updates

### Rationalization Traps (DO NOT)

1. *"Just force a timeline reload more often"*
   - **Why it fails**: Exhausts budget, makes problem worse

2. *"The widget worked in testing"*
   - **Why it fails**: Development vs. production App Groups mismatch

3. *"Users should just restart their phone"*
   - **Why it fails**: Not a fix, damages reputation

### MANDATORY Systematic Fix

#### Step 1: Verify App Groups (30 min)

```swift
// Add logging to BOTH app and widget
let group = "group.com.myapp.production" // Must match exactly
let container = FileManager.default.containerURL(
    forSecurityApplicationGroupIdentifier: group
)

print("[\(Bundle.main.bundleIdentifier ?? "?")] Container: \(container?.path ?? "NIL")")

// Log EVERY read/write
let shared = UserDefaults(suiteName: group)!
print("Writing key 'lastUpdate' = \(Date())")
shared.set(Date(), forKey: "lastUpdate")
```

**Verify**: Run app, then widget. Both should print SAME container path.

#### Step 2: Check Container Paths

```bash
# Device logs (Xcode → Window → Devices and Simulators → View Device Logs)
# Filter: Your app bundle ID
# Look for: Container path mismatches
```

Common issues:
- App uses `group.com.myapp.dev`
- Widget uses `group.com.myapp.production`
- **Fix**: Ensure EXACT same group ID in both .entitlements files

#### Step 3: Add Version Stamp

```swift
// Main app — stamp every write
struct WidgetData: Codable {
    var value: String
    var timestamp: Date
    var appVersion: String
}

let data = WidgetData(
    value: "Latest",
    timestamp: Date(),
    appVersion: Bundle.main.appVersion
)
shared.set(try JSONEncoder().encode(data), forKey: "widgetData")

// Widget — verify version
if let data = shared.data(forKey: "widgetData"),
   let decoded = try? JSONDecoder().decode(WidgetData.self, from: data) {
    print("Widget reading data from app version: \(decoded.appVersion)")
}
```

#### Step 4: Force Reload on App Launch

```swift
// AppDelegate / @main App
func applicationDidBecomeActive(_ application: UIApplication) {
    WidgetCenter.shared.reloadAllTimelines()
}
```

### Communication Template

**To stakeholders**:
```
Status: Investigating widget data sync issue

Root cause: App Groups configuration mismatch between app and widget extension in production build

Fix: Updated both targets to use identical group identifier, added logging to prevent recurrence

Timeline: Hotfix submitted to App Store review (24-48h)

Workaround for users: Force-quit app and relaunch (triggers widget refresh)
```

### Time Saved
- **Without systematic fix**: 4-8 hours of trial-and-error, multiple resubmissions
- **With this process**: 1-2 hours to identify, fix, and verify

---

## Scenario 2: "Live Activity must update instantly"

### Situation
- Sports score app
- Users expect scores to update within seconds of real game events
- Current timeline-based approach too slow

### Pressure
- **Competitive**: "Other apps update faster"
- **Deadline**: Marketing promised "real-time" updates

### Rationalization Traps (DO NOT)

1. *"Just create entries every 5 seconds"*
   - **Why it fails**: Not real-time, exhausts battery, doesn't scale

2. *"Add WebSocket to widget view"*
   - **Why it fails**: Extensions can't maintain persistent connections

3. *"Lower refresh interval to 1 second"*
   - **Why it fails**: Timeline system not designed for sub-minute updates

### MANDATORY Solution: Phased Approach

**Critical reality check**: Push notification entitlement approval takes **3-7 days**. Never promise features before approval.

#### Phase 1: Ship with Local Updates (No Approval Required)

**Ship immediately** with app-driven updates:

```swift
// Start activity WITHOUT push (no entitlement needed)
let activity = try Activity.request(
    attributes: attributes,
    content: initialContent,
    pushType: nil  // Local updates only
)

// In your app when data changes (user opens app, pulls to refresh)
await activity.update(ActivityContent(
    state: updatedState,
    staleDate: nil
))
```

**Set expectations**: Updates occur when user interacts with app. This is **acceptable** for v1.0 and requires zero approval.

#### Phase 2: Add Push After Approval (3-7 Days)

**After entitlement approved**, switch to push:

#### Step 1: Enable Push for Live Activities

```swift
// 1. Entitlement: "com.apple.developer.activity-push-notification"

// 2. Request activity with push token
let activity = try Activity.request(
    attributes: attributes,
    content: initialContent,
    pushType: .token
)

// 3. Monitor for token
Task {
    for await pushToken in activity.pushTokenUpdates {
        let tokenString = pushToken.map { String(format: "%02x", $0) }.joined()
        await sendTokenToServer(activityID: activity.id, token: tokenString)
    }
}
```

#### Step 2: Server-Side Push (Phase 2 Only)

```json
{
  "aps": {
    "timestamp": 1633046400,
    "event": "update",
    "content-state": {
      "teamAScore": 14,
      "teamBScore": 10,
      "quarter": 2,
      "timeRemaining": "5:23"
    },
    "alert": {
      "title": "Touchdown!",
      "body": "Team A scores"
    }
  }
}
```

**Standard push limit**: ~10-12 per hour

#### Step 3: Request Frequent Updates Entitlement (Phase 2, iOS 18.2+)

For apps requiring more frequent pushes (sports, stocks):

```xml
<key>com.apple.developer.activity-push-notification-frequent-updates</key>
<true/>
```

**Requires justification** in App Store Connect: "Live sports scores require immediate updates for user engagement"

#### Verification

```swift
// Log push receipt in Live Activity widget
#if DEBUG
let logURL = FileManager.default.containerURL(
    forSecurityApplicationGroupIdentifier: "group.com.myapp"
)!.appendingPathComponent("push_log.txt")

let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
try! "\(timestamp): Received push\n".append(to: logURL)
#endif
```

### Communication Template

**To marketing/exec (Phase 1)**:
```
Launch Timeline:
- Phase 1 (immediate): Live Activities with app-driven updates. Updates appear when users open app or pull to refresh.
- Phase 2 (3-7 days): Push notification integration after Apple approval. Updates arrive within 1-3 seconds of server events.

Recommendation: Launch Phase 1 to market, communicate Phase 2 as "coming soon" once approved.
```

**To marketing/exec (Phase 2)**:
```
"Real-time" positioning requires clarification:

Technical: Live Activities update via push notifications with 1-3 second latency from server to device

Constraints: Apple's push system has rate limits (~10/hour standard, axiom-higher with special entitlement)

Competitive analysis: Competitors likely use same system with similar limitations

Recommendation: Position as "near real-time" (accurate) vs "instant" (misleading)
```

### Reality Check
- Push notifications are fastest mechanism available
- 1-3 second latency is normal
- Budget limits exist for battery optimization
- Users prefer longer battery life over millisecond-faster scores

> For comprehensive push notification setup (APNs auth, payload format, token management, service extensions), see axiom-push-notifications and axiom-push-notifications-ref. This skill covers the ActivityKit UI and state management side.

---

## Scenario 3: "Control Center control is slow"

### Situation
- Smart home control for lights
- Tapping control in Control Center takes 3-5 seconds to respond
- Users expect instant feedback

### MANDATORY Fix: Optimistic UI + Async Value Provider

#### Problem Code

```swift
struct LightControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "Light") {
            ControlWidgetToggle(
                isOn: LightManager.shared.isOn, // ❌ Blocking fetch
                action: ToggleLightIntent()
            ) { isOn in
                Label(isOn ? "On" : "Off", systemImage: "lightbulb.fill")
            }
        }
    }
}
```

#### Fixed Code

```swift
// 1. Value Provider for async state
struct LightProvider: ControlValueProvider {
    func currentValue() async throws -> LightValue {
        // Async fetch from HomeKit/server
        let isOn = try await HomeManager.shared.fetchLightState()
        return LightValue(isOn: isOn)
    }

    var previewValue: LightValue {
        // Instant fallback from cache
        let shared = UserDefaults(suiteName: "group.com.myapp")!
        return LightValue(isOn: shared.bool(forKey: "lastKnownLightState"))
    }
}

struct LightValue: ControlValueProviderValue {
    var isOn: Bool
}

// 2. Optimistic Intent
struct ToggleLightIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Light"

    func perform() async throws -> some IntentResult {
        // Immediately update cache (optimistic)
        let shared = UserDefaults(suiteName: "group.com.myapp")!
        let currentState = shared.bool(forKey: "lastKnownLightState")
        let newState = !currentState
        shared.set(newState, forKey: "lastKnownLightState")

        // Then update actual device (async)
        try await HomeManager.shared.setLight(isOn: newState)

        return .result()
    }
}

// 3. Control with provider
struct LightControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "Light", provider: LightProvider()) { value in
            ControlWidgetToggle(
                isOn: value.isOn,
                action: ToggleLightIntent()
            ) { isOn in
                Label(isOn ? "On" : "Off", systemImage: "lightbulb.fill")
                    .tint(isOn ? .yellow : .gray)
            }
        }
    }
}
```

**Result**: Control responds instantly with cached state, actual device updates in background.

---

# Final Checklist

Before shipping widgets or Live Activities:

## Pre-Release
- ☐ App Groups entitlement in BOTH targets (app + extension)
- ☐ Shared UserDefaults uses `suiteName` (not `.standard`)
- ☐ Timeline entries ≥ 5 minutes apart (avoid budget exhaustion)
- ☐ No network calls in widget views (only in TimelineProvider)
- ☐ ActivityAttributes + ContentState < 4KB
- ☐ Live Activities call `.end()` with appropriate dismissal policy
- ☐ Control Center controls use ControlValueProvider for async data
- ☐ Tested on actual device (not just simulator) — **Required because**:
  - Simulator doesn't enforce timeline budget limits
  - Push notifications don't work in simulator
  - App Groups container paths differ (simulator vs device)
  - Memory limits not enforced in simulator
  - Background refresh behavior different
- ☐ Tested all supported widget families
- ☐ Verified widget appears in Widget Gallery

## Post-Release Monitoring
- ☐ Monitor for "Timeline reload budget exhausted" errors
- ☐ Track widget data staleness in analytics
- ☐ Watch App Store reviews for widget-related complaints
- ☐ Log App Group container access for debugging

## Common Failure Modes
- Missing App Groups → Widget shows default data
- Wrong group ID → App and widget can't communicate
- Over-refreshing → Widget stops updating after hours
- Network in view → Widget renders blank
- No dismissal policy → Zombie Live Activities
- Blocking main thread → Unresponsive controls

---

**Remember**: Widgets are NOT mini apps. They're glanceable snapshots rendered by the system. Extensions run in sandboxed environments with strict resource limits. Follow the patterns in this skill to avoid the most common pitfalls.

---

## Resources

**Skills**: axiom-extensions-widgets-ref, axiom-push-notifications, axiom-push-notifications-ref, axiom-background-processing
