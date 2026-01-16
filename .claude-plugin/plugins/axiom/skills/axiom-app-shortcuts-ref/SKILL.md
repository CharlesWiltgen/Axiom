---
name: axiom-app-shortcuts-ref
description: Use when implementing App Shortcuts for instant Siri/Spotlight availability, configuring AppShortcutsProvider, adding suggested phrases, or debugging shortcuts not appearing - covers complete App Shortcuts API for iOS 16+
user-invocable: true
skill_type: reference
version: 1.0.0
---

# App Shortcuts Reference

## Overview

Comprehensive guide to App Shortcuts framework for making your app's actions instantly available in Siri, Spotlight, Action Button, Control Center, and other system experiences. App Shortcuts are pre-configured App Intents that work immediately after app install—no user setup required.

**Key distinction** App Intents are the actions; App Shortcuts are the pre-configured "surface" that makes those actions instantly discoverable system-wide.

---

## When to Use This Skill

Use this skill when:
- Implementing AppShortcutsProvider for your app
- Adding suggested phrases for Siri invocation
- Configuring instant Spotlight availability
- Creating parameterized shortcuts (skip Siri clarification)
- Using NegativeAppShortcutPhrase to prevent false positives (iOS 17+)
- Promoting shortcuts with SiriTipView
- Updating shortcuts dynamically with updateAppShortcutParameters()
- Debugging shortcuts not appearing in Shortcuts app or Spotlight
- Choosing between App Intents and App Shortcuts

Do NOT use this skill for:
- General App Intents implementation (use app-intents-ref)
- Core Spotlight indexing (use core-spotlight-ref)
- Overall discoverability strategy (use app-discoverability)

---

## Related Skills

- **app-intents-ref** — Complete App Intents implementation reference
- **app-discoverability** — Strategic guide for making apps discoverable
- **core-spotlight-ref** — Core Spotlight and NSUserActivity integration

---

## App Shortcuts vs App Intents

| Aspect | App Intent | App Shortcut |
|--------|-----------|--------------|
| **Discovery** | Must be found in Shortcuts app | Instantly available after install |
| **Configuration** | User configures in Shortcuts | Pre-configured by developer |
| **Siri activation** | Requires custom phrase setup | Works immediately with provided phrases |
| **Spotlight** | Requires donation or IndexedEntity | Appears automatically |
| **Action button** | Not directly accessible | Can be assigned immediately |
| **Setup time** | Minutes per user | Zero |

**When to use App Shortcuts** Every app should provide App Shortcuts for core functionality. They dramatically improve discoverability with zero user effort.

---

## Core Concepts

### AppShortcutsProvider Protocol

**Required conformance** Your app must have exactly one type conforming to `AppShortcutsProvider`.

```swift
struct MyAppShortcuts: AppShortcutsProvider {
    // Required: Define your shortcuts
    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] { get }

    // Optional: Branding color
    static var shortcutTileColor: ShortcutTileColor { get }

    // Optional: Dynamic updates
    static func updateAppShortcutParameters()

    // Optional: Negative phrases (iOS 17+)
    static var negativePhrases: [NegativeAppShortcutPhrase] { get }
}
```

**Platform support** iOS 16+, iPadOS 16+, macOS 13+, tvOS 16+, watchOS 9+

---

### AppShortcut Structure

Associates an `AppIntent` with spoken phrases and metadata.

```swift
AppShortcut(
    intent: StartMeditationIntent(),
    phrases: [
        "Start meditation in \(.applicationName)",
        "Begin mindfulness with \(.applicationName)"
    ],
    shortTitle: "Meditate",
    systemImageName: "figure.mind.and.body"
)
```

**Components:**
- `intent` — The App Intent to execute
- `phrases` — Spoken/typed phrases for Siri/Spotlight
- `shortTitle` — Short label for Shortcuts app tiles
- `systemImageName` — SF Symbol for visual representation

---

### AppShortcutPhrase (Suggested Phrases)

**String interpolation** Phrases use `\(.applicationName)` to dynamically include your app's name.

```swift
phrases: [
    "Start meditation in \(.applicationName)",
    "Meditate with \(.applicationName)"
]
```

**User sees in Siri/Spotlight:**
- "Start meditation in Calm"
- "Meditate with Calm"

**Why this matters** The system uses these exact phrases to trigger your intent via Siri and show suggestions in Spotlight.

---

### @AppShortcutsBuilder

Result builder for defining shortcuts array.

```swift
@AppShortcutsBuilder
static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: OrderIntent(), /* ... */)
    AppShortcut(intent: ReorderIntent(), /* ... */)

    if UserDefaults.standard.bool(forKey: "premiumUser") {
        AppShortcut(intent: CustomizeIntent(), /* ... */)
    }
}
```

**Result builder features:**
- Conditional shortcuts (if/else)
- Loop-generated shortcuts (for-in)
- Inline array construction

---

## Phrase Template Patterns

### Basic Phrases (No Parameters)

```swift
AppShortcut(
    intent: StartWorkoutIntent(),
    phrases: [
        "Start workout in \(.applicationName)",
        "Begin exercise with \(.applicationName)",
        "Work out in \(.applicationName)"
    ],
    shortTitle: "Start Workout",
    systemImageName: "figure.run"
)
```

**Benefits:**
- Simple, discoverable
- Works for all users
- No parameter ambiguity

**Use when** Intent has no required parameters or parameters have defaults.

---

### Parameterized Phrases (Skip Clarification)

Pre-configure intents with specific parameter values to skip Siri's clarification step.

```swift
// Intent with parameters
struct StartMeditationIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Meditation"

    @Parameter(title: "Type")
    var meditationType: MeditationType?

    @Parameter(title: "Duration")
    var duration: Int?
}

// Shortcuts with different parameter combinations
@AppShortcutsBuilder
static var appShortcuts: [AppShortcut] {
    // Generic version (will ask for parameters)
    AppShortcut(
        intent: StartMeditationIntent(),
        phrases: ["Start meditation in \(.applicationName)"],
        shortTitle: "Meditate",
        systemImageName: "figure.mind.and.body"
    )

    // Specific versions (skip parameter step)
    AppShortcut(
        intent: StartMeditationIntent(
            meditationType: .mindfulness,
            duration: 10
        ),
        phrases: [
            "Start quick mindfulness in \(.applicationName)",
            "10 minute mindfulness in \(.applicationName)"
        ],
        shortTitle: "Quick Mindfulness",
        systemImageName: "brain.head.profile"
    )

    AppShortcut(
        intent: StartMeditationIntent(
            meditationType: .sleep,
            duration: 20
        ),
        phrases: [
            "Start sleep meditation in \(.applicationName)"
        ],
        shortTitle: "Sleep Meditation",
        systemImageName: "moon.stars.fill"
    )
}
```

**Benefits:**
- One-phrase completion (no follow-up questions)
- Better user experience for common use cases
- Spotlight shows specific shortcuts

**Trade-off** More shortcuts = more visual clutter in Shortcuts app. Balance common cases (3-5 shortcuts) vs flexibility (generic shortcut with parameters).

---

## NegativeAppShortcutPhrase (iOS 17+)

Train the system to NOT invoke your app for certain phrases.

```swift
struct MeditationAppShortcuts: AppShortcutsProvider {
    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartMeditationIntent(),
            phrases: ["Start meditation in \(.applicationName)"],
            shortTitle: "Meditate",
            systemImageName: "figure.mind.and.body"
        )
    }

    // Prevent false positives
    static var negativePhrases: [NegativeAppShortcutPhrase] {
        NegativeAppShortcutPhrases {
            "Stop meditation"
            "Cancel meditation"
            "End session"
        }
    }
}
```

**When to use:**
- Phrases that sound similar to your shortcuts but mean the opposite
- Common phrases users might say that shouldn't trigger your app
- Disambiguation when multiple apps have similar capabilities

**Platform** iOS 17.0+, iPadOS 17.0+, macOS 14.0+, tvOS 17.0+, watchOS 10.0+

---

## Discovery UI Components

### SiriTipView — Promote Shortcuts In-App

Display the spoken phrase for a shortcut directly in your app's UI.

```swift
import AppIntents
import SwiftUI

struct OrderConfirmationView: View {
    @State private var showSiriTip = true

    var body: some View {
        VStack {
            Text("Order confirmed!")

            // Show Siri tip after successful order
            SiriTipView(intent: ReorderIntent(), isVisible: $showSiriTip)
                .siriTipViewStyle(.dark)
        }
    }
}
```

**Requirements:**
- Intent must be used in an AppShortcut (otherwise shows empty view)
- isVisible binding controls display state

**Styles:**
- `.automatic` — Adapts to environment
- `.light` — Light background
- `.dark` — Dark background

**Best practice** Show after users complete actions, suggesting easier ways next time.

---

### ShortcutsLink — Link to Shortcuts App

Opens your app's page in the Shortcuts app, listing all available shortcuts.

```swift
import AppIntents
import SwiftUI

struct SettingsView: View {
    var body: some View {
        List {
            Section("Siri & Shortcuts") {
                ShortcutsLink()
                // Displays "Shortcuts" with standard link styling
            }
        }
    }
}
```

**When to use:**
- Settings screen
- Help/Support section
- Onboarding flow

**Benefits** Single tap takes users to see all your app's shortcuts, with suggested phrases visible.

---

### ShortcutTileColor — Branding

Set the color for your shortcuts in the Shortcuts app.

```swift
struct CoffeeAppShortcuts: AppShortcutsProvider {
    static var shortcutTileColor: ShortcutTileColor = .tangerine

    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        // ...
    }
}
```

**Available colors:**
| Color | Use Case |
|-------|----------|
| `.blue` | Default, professional |
| `.tangerine` | Energy, food/beverage |
| `.purple` | Creative, meditation |
| `.teal` | Health, wellness |
| `.red` | Urgent, important |
| `.pink` | Lifestyle, social |
| `.navy` | Business, finance |
| `.yellow` | Productivity, notes |
| `.lime` | Fitness, outdoor |

Full list: `.blue`, `.grape`, `.grayBlue`, `.grayBrown`, `.grayGreen`, `.lightBlue`, `.lime`, `.navy`, `.orange`, `.pink`, `.purple`, `.red`, `.tangerine`, `.teal`, `.yellow`

**Choose color** that matches your app icon or brand identity.

---

## Dynamic Updates

### updateAppShortcutParameters()

Call when parameter options change to refresh stored shortcuts.

```swift
struct MeditationAppShortcuts: AppShortcutsProvider {
    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        // Shortcuts can reference dynamic data
        for session in MeditationData.favoriteSessions {
            AppShortcut(
                intent: StartSessionIntent(session: session),
                phrases: ["Start \(session.name) in \(.applicationName)"],
                shortTitle: session.name,
                systemImageName: session.iconName
            )
        }
    }

    static func updateAppShortcutParameters() {
        // Called automatically when needed
        // Override only if you need custom behavior
    }
}

// In your app, when data changes
extension MeditationData {
    func markAsFavorite(_ session: Session) {
        favoriteSessions.append(session)

        // Update App Shortcuts to reflect new data
        MeditationAppShortcuts.updateAppShortcutParameters()
    }
}
```

**When to call:**
- User adds/removes favorites
- Available options change
- App data structure updates

**Automatic invocation** The system calls this periodically, but you can force updates when you know data changed.

---

## Complete Implementation Example

### Step 1: Define App Intents

```swift
import AppIntents

struct OrderCoffeeIntent: AppIntent {
    static var title: LocalizedStringResource = "Order Coffee"
    static var description = IntentDescription("Orders coffee for pickup")

    @Parameter(title: "Coffee Type")
    var coffeeType: CoffeeType

    @Parameter(title: "Size")
    var size: CoffeeSize

    @Parameter(title: "Customizations")
    var customizations: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Order \(\.$size) \(\.$coffeeType)") {
            \.$customizations
        }
    }

    func perform() async throws -> some IntentResult {
        let order = try await CoffeeService.shared.order(
            type: coffeeType,
            size: size,
            customizations: customizations
        )

        return .result(
            value: order,
            dialog: "Your \(size) \(coffeeType) is ordered for pickup"
        )
    }
}

struct ReorderLastIntent: AppIntent {
    static var title: LocalizedStringResource = "Reorder Last Coffee"
    static var description = IntentDescription("Reorders your most recent coffee")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        guard let lastOrder = try await CoffeeService.shared.lastOrder() else {
            throw CoffeeError.noRecentOrders
        }

        try await CoffeeService.shared.reorder(lastOrder)

        return .result(
            dialog: "Reordering your \(lastOrder.coffeeName)"
        )
    }
}

enum CoffeeType: String, AppEnum {
    case latte, cappuccino, americano, espresso

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Coffee"
    static var caseDisplayRepresentations: [CoffeeType: DisplayRepresentation] = [
        .latte: "Latte",
        .cappuccino: "Cappuccino",
        .americano: "Americano",
        .espresso: "Espresso"
    ]
}

enum CoffeeSize: String, AppEnum {
    case small, medium, large

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Size"
    static var caseDisplayRepresentations: [CoffeeSize: DisplayRepresentation] = [
        .small: "Small",
        .medium: "Medium",
        .large: "Large"
    ]
}
```

---

### Step 2: Create AppShortcutsProvider

```swift
import AppIntents

struct CoffeeAppShortcuts: AppShortcutsProvider {

    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        // Generic order (will ask for parameters)
        AppShortcut(
            intent: OrderCoffeeIntent(),
            phrases: [
                "Order coffee in \(.applicationName)",
                "Get coffee from \(.applicationName)"
            ],
            shortTitle: "Order",
            systemImageName: "cup.and.saucer.fill"
        )

        // Common specific orders (skip parameter step)
        AppShortcut(
            intent: OrderCoffeeIntent(
                coffeeType: .latte,
                size: .medium
            ),
            phrases: [
                "Order my usual from \(.applicationName)",
                "Get my regular coffee from \(.applicationName)"
            ],
            shortTitle: "Usual Order",
            systemImageName: "star.fill"
        )

        // Reorder last
        AppShortcut(
            intent: ReorderLastIntent(),
            phrases: [
                "Reorder coffee from \(.applicationName)",
                "Order again from \(.applicationName)"
            ],
            shortTitle: "Reorder",
            systemImageName: "arrow.clockwise"
        )
    }

    // Branding
    static var shortcutTileColor: ShortcutTileColor = .tangerine

    // Prevent false positives (iOS 17+)
    static var negativePhrases: [NegativeAppShortcutPhrase] {
        NegativeAppShortcutPhrases {
            "Cancel coffee order"
            "Stop coffee"
        }
    }
}
```

---

### Step 3: Promote in UI

```swift
import SwiftUI
import AppIntents

struct OrderConfirmationView: View {
    @State private var showReorderTip = true

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 60))
                .foregroundColor(.green)

            Text("Order Placed!")
                .font(.title)

            Text("Your coffee will be ready in 10 minutes")
                .foregroundColor(.secondary)

            // Promote reorder shortcut
            if showReorderTip {
                SiriTipView(intent: ReorderLastIntent(), isVisible: $showReorderTip)
                    .siriTipViewStyle(.dark)
                    .padding(.top)
            }

            // Link to see all shortcuts
            Section {
                ShortcutsLink()
            } header: {
                Text("See all available shortcuts")
                    .font(.caption)
            }
        }
        .padding()
    }
}
```

---

## Where App Shortcuts Appear

Once implemented, your App Shortcuts are available in:

| Location | User Experience |
|----------|-----------------|
| **Siri** | Voice activation with provided phrases |
| **Spotlight** | Search for action or phrase → Instant execution |
| **Shortcuts app** | Pre-populated shortcuts, zero configuration |
| **Action Button** (iPhone 15 Pro) | Assignable to hardware button |
| **Apple Watch Ultra** | Action Button assignment |
| **Control Center** | Add shortcuts as controls |
| **Lock Screen widgets** | Quick actions without unlocking |
| **Apple Pencil Pro** | Squeeze gesture assignment |
| **Focus Filters** | Contextual filtering |

**Instant availability** All locations work immediately after app install. No user setup required.

---

## Testing & Debugging

### Verify Shortcuts Appear in Shortcuts App

1. Build and run your app on device
2. Open Shortcuts app
3. Tap "+" to create new shortcut
4. Search for your app name
5. Verify shortcuts appear with correct titles and icons

**If shortcuts don't appear:**
- Ensure AppShortcutsProvider is in your main app target
- Check that `isDiscoverable` is true for the AppIntents (default)
- Rebuild and reinstall app
- Check console for AppShortcuts errors

---

### Test Siri Invocation

1. Invoke Siri
2. Say one of your suggested phrases
3. Verify Siri executes the intent

**Example**:
- You: "Order coffee in CoffeeApp"
- Siri: "What size and type?"
- You: "Medium latte"
- Siri: "Your medium latte is ordered for pickup"

**If Siri doesn't recognize phrase:**
- Check phrase includes `\(.applicationName)`
- Verify phrase is in appShortcuts array
- Try simpler phrases (3-6 words ideal)
- Avoid complex grammar or rare words

---

### Test Spotlight Discovery

1. Swipe down to open Spotlight
2. Type your app name or shortcut phrase
3. Verify shortcut appears in results
4. Tap to execute

**If shortcut doesn't appear in Spotlight:**
- Wait a few minutes (indexing delay)
- Restart device
- Check System Settings → Siri & Search → [Your App] → Show App in Search

---

### Debug with Console Logs

```swift
#if DEBUG
struct CoffeeAppShortcuts: AppShortcutsProvider {
    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        let shortcuts = [
            AppShortcut(/* ... */),
            // ...
        ]

        print("📱 Registered \(shortcuts.count) App Shortcuts")
        shortcuts.forEach { shortcut in
            print("  - \(shortcut.shortTitle)")
        }

        return shortcuts
    }
}
#endif
```

**Check Xcode console** after app launch to verify shortcuts are registered.

---

## Best Practices

### 1. Phrase Design

#### ❌ DON'T: Long, complex phrases
```swift
phrases: [
    "I would like to order a coffee from \(.applicationName) please"
]
```

#### ✅ DO: Short, natural phrases
```swift
phrases: [
    "Order coffee in \(.applicationName)",
    "Get coffee from \(.applicationName)"
]
```

**Guidelines:**
- 3-6 words ideal
- Start with verb (Order, Start, Get, Show)
- Include `\(.applicationName)` for disambiguation
- Use natural language users would actually say

---

### 2. Shortcut Quantity

#### ❌ DON'T: Provide 20+ shortcuts
```swift
// Bad: Overwhelming
AppShortcut for every possible combination
```

#### ✅ DO: Focus on 3-5 core actions
```swift
// Good: Focused on common tasks
AppShortcut(intent: OrderIntent(), /* ... */)
AppShortcut(intent: ReorderIntent(), /* ... */)
AppShortcut(intent: ViewOrdersIntent(), /* ... */)
```

**Why** Too many shortcuts creates clutter. Focus on high-value, frequently-used actions.

---

### 3. Parameter Combinations

#### ❌ DON'T: Parameterize every variant
```swift
// Bad: Creates 12 shortcuts (3 sizes × 4 types)
for size in CoffeeSize.allCases {
    for type in CoffeeType.allCases {
        AppShortcut(intent: OrderIntent(type: type, size: size), /* ... */)
    }
}
```

#### ✅ DO: Provide generic + top 2-3 common cases
```swift
// Good: Generic + common specific cases
AppShortcut(intent: OrderIntent(), /* ... */)  // Generic
AppShortcut(intent: OrderIntent(type: .latte, size: .medium), /* ... */)  // Usual
AppShortcut(intent: OrderIntent(type: .espresso, size: .small), /* ... */)  // Quick
```

---

### 4. Short Titles

#### ❌ DON'T: Verbose or redundant
```swift
shortTitle: "Order Coffee from Coffee App"
```

#### ✅ DO: Concise and clear
```swift
shortTitle: "Order"
```

**Context** App name already appears in Shortcuts app, so no need to repeat.

---

### 5. System Images

#### ❌ DON'T: Use custom images
```swift
// Not supported
shortImage: UIImage(named: "custom")
```

#### ✅ DO: Use SF Symbols
```swift
systemImageName: "cup.and.saucer.fill"
```

**Why** SF Symbols scale properly, support dark mode, and integrate with system UI.

---

## Resources

**WWDC**: 2022-10170, 2022-10169, 260

**Docs**: /appintents/appshortcutsprovider, /appintents/appshortcut, /appintents/app-shortcuts

**Skills**: axiom-app-intents-ref, axiom-app-discoverability, axiom-core-spotlight-ref

---

**Remember** App Shortcuts make your app's functionality instantly available across iOS. Define 3-5 core shortcuts with natural phrases, promote them in your UI with SiriTipView, and users can invoke them immediately via Siri, Spotlight, Action Button, and more.
