
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
- Debugging why widgets show stale data
- Widget not appearing in gallery
- Interactive buttons not responding
- Control Center control is unresponsive
- Sharing data between app and widget/extension

> **Live Activities moved.** Dynamic Island, ActivityKit lifecycle, push/broadcast updates, and push-to-start now live in `skills/live-activities.md` (+ `skills/live-activities-ref.md`). They share a widget extension with widgets, which is why setup details (App Groups, the extension target) still apply here.

❌ **Do NOT use this skill for**:
- Pure App Intents implementation (see `skills/app-intents-ref.md`)
- SwiftUI layout questions (use **axiom-swiftui** layout reference)
- Performance profiling (use **axiom-swiftui** performance reference)
- General debugging (use **axiom-build**)

## Related Skills

- `skills/extensions-widgets-ref.md` — Comprehensive API reference
- `skills/live-activities.md` — Live Activities & Dynamic Island (extracted from this skill)
- `skills/app-intents-ref.md` — App Intents for interactive widgets
- `axiom-concurrency` — Async patterns for data fetching
- `axiom-data` — Using SwiftData with App Groups

## Example Prompts

#### 1. "My widget isn't updating"
→ This skill covers timeline policies, refresh budgets, manual reload, and App Groups configuration

#### 2. "How do I share data between app and widget?"
→ This skill explains App Groups entitlement, shared UserDefaults, and container URLs

#### 3. "Widget shows old data even after I update the app"
→ This skill covers container paths, UserDefaults suite names, and WidgetCenter reload

#### 4. "Live Activity won't start / update / dismiss"
→ See `skills/live-activities.md` — Live Activities have their own skill now

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

**Why it's bad**: This is *fake* freshness, and the budget reasoning is subtler than it looks. All 60 entries come from one fetch, so they show the **same** stale value — entries are pre-rendered snapshots, not refetch points, and only **reloads** (each `getTimeline()` call) count against the 40-70/day budget. With `.atEnd`, this timeline is actually ~1 reload/hour (within budget). The real trap is the next instinct: making the value *actually* update every minute via `policy: .after(60s)`, which forces ~1,440 reloads/day and exhausts the budget within ~1 hour — after which the widget freezes for the rest of the day.

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

struct ThermostatValue {
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

## Pattern 5: Widget Not Appearing in Gallery

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
│  │  ├─ Time/data-driven widget? → Change to .atEnd or .after(date)
│  │  └─ Intent-driven (interactive) widget? → .never is correct;
│  │     system auto-reloads after perform(), app reloads on data change
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
│  └─ Manually calling WidgetCenter for the tapped widget?
│     └─ Not needed — system auto-reloads this widget after perform()
│        returns. Manual reload is for app-driven changes / OTHER kinds.
│
├─ Live Activity issue (start/update/dismiss, Dynamic Island, push, watch)?
│  └─ See skills/live-activities.md
│
└─ Control Center control unresponsive?
   ├─ Async operation blocking UI?
   │  └─ Use ControlValueProvider with async currentValue()
   └─ Provide previewValue for instant fallback
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

> For Live Activity debugging (4KB check, authorization, pushType, dismissal), see `skills/live-activities.md`.

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

## Scenario 2: "Control Center control is slow"

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
                "Light",
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

struct LightValue {
    var isOn: Bool
}

// 2. Optimistic Intent — a toggle's action MUST be a SetValueIntent (ValueType == Bool)
struct ToggleLightIntent: SetValueIntent {
    static var title: LocalizedStringResource = "Toggle Light"

    @Parameter var value: Bool   // The new on/off state the system passes in

    func perform() async throws -> some IntentResult {
        // Immediately update cache (optimistic)
        let shared = UserDefaults(suiteName: "group.com.myapp")!
        shared.set(value, forKey: "lastKnownLightState")

        // Then update actual device (async)
        try await HomeManager.shared.setLight(isOn: value)

        return .result()
    }
}

// 3. Control with provider
struct LightControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "Light", provider: LightProvider()) { value in
            ControlWidgetToggle(
                "Light",
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

Before shipping widgets:

## Pre-Release
- ☐ App Groups entitlement in BOTH targets (app + extension)
- ☐ Shared UserDefaults uses `suiteName` (not `.standard`)
- ☐ `.containerBackground(for: .widget)` on every widget view (required since iOS 17; without it the widget loses StandBy / iPad Lock Screen placement)
- ☐ Timeline entries ≥ 5 minutes apart (avoid budget exhaustion)
- ☐ No network calls in widget views (only in TimelineProvider)
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
- Blocking main thread → Unresponsive controls

---

**Remember**: Widgets are NOT mini apps. They're glanceable snapshots rendered by the system. Extensions run in sandboxed environments with strict resource limits. Follow the patterns in this skill to avoid the most common pitfalls.

---

## Resources

**Skills**: skills/extensions-widgets-ref.md, skills/push-notifications.md, skills/push-notifications-ref.md, skills/background-processing.md
