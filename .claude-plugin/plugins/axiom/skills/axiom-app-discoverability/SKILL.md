---
name: axiom-app-discoverability
description: Use when making app surface in Spotlight search, Siri suggestions, or system experiences - covers the 6-step strategy combining App Intents, App Shortcuts, Core Spotlight, and NSUserActivity to feed the system metadata for iOS 16+
skill_type: discipline
version: 1.0.0
---

# App Discoverability

## Overview

**Core principle** Feed the system metadata across multiple APIs, let the system decide when to surface your app.

iOS surfaces apps in Spotlight, Siri suggestions, and system experiences based on metadata you provide through App Intents, App Shortcuts, Core Spotlight, and NSUserActivity. The system learns from actual usage and boosts frequently-used actions. No single API is sufficient—comprehensive discoverability requires a multi-API strategy.

**Key insight** iOS boosts shortcuts and activities that users actually invoke. If nobody uses an intent, the system hides it. Provide clear, action-oriented metadata and the system does the heavy lifting.

---

## When to Use This Skill

Use this skill when:
- Making your app appear in Spotlight search results
- Enabling Siri to suggest your app in relevant contexts
- Adding app actions to Action Button (iPhone/Apple Watch Ultra)
- Making app content discoverable system-wide
- Planning discoverability architecture before implementation
- Troubleshooting "why isn't my app being suggested?"

Do NOT use this skill when:
- You need detailed API reference (use app-intents-ref, axiom-app-shortcuts-ref, axiom-core-spotlight-ref)
- You're implementing a specific API (use the reference skills)
- You just want to add a single App Intent (use app-intents-ref)

---

## The 6-Step Discoverability Strategy

This is a proven strategy from developers who've implemented discoverability across multiple production apps. **Implementation time: One evening for minimal viable discoverability.**

### Step 1: Add App Intents

App Intents power Spotlight search, Siri requests, and Shortcut suggestions. **Without AppIntents, your app will never surface meaningfully.**

```swift
struct OrderCoffeeIntent: AppIntent {
    static var title: LocalizedStringResource = "Order Coffee"
    static var description = IntentDescription("Orders coffee for pickup")

    @Parameter(title: "Coffee Type")
    var coffeeType: CoffeeType

    @Parameter(title: "Size")
    var size: CoffeeSize

    func perform() async throws -> some IntentResult {
        try await CoffeeService.shared.order(type: coffeeType, size: size)
        return .result(dialog: "Your \(size) \(coffeeType) is ordered")
    }
}
```

**Why this matters** App Intents are the foundation. Everything else builds on them.

See: **app-intents-ref** for complete API reference

---

### Step 2: Add App Shortcuts with Suggested Phrases

App Shortcuts make your intents **instantly available** after install. No configuration required.

```swift
struct CoffeeAppShortcuts: AppShortcutsProvider {
    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OrderCoffeeIntent(),
            phrases: [
                "Order coffee in \(.applicationName)",
                "Get my usual coffee from \(.applicationName)"
            ],
            shortTitle: "Order Coffee",
            systemImageName: "cup.and.saucer.fill"
        )
    }

    static var shortcutTileColor: ShortcutTileColor = .tangerine
}
```

**Why this matters** Without App Shortcuts, users must manually configure shortcuts. With them, your actions appear immediately in Siri, Spotlight, Action Button, and Control Center.

**Critical** Use `suggestedPhrase` patterns—this increases the chance that the system proposes them in Spotlight action suggestions and Siri's carousel.

See: **app-shortcuts-ref** for phrase patterns and best practices

---

### Step 3: Expose Searchable Content via Core Spotlight

Index content that matters. **The system will surface items that match user queries.**

```swift
import CoreSpotlight
import UniformTypeIdentifiers

func indexOrder(_ order: Order) {
    let attributes = CSSearchableItemAttributeSet(contentType: .item)
    attributes.title = order.coffeeName
    attributes.contentDescription = "Order from \(order.date.formatted())"
    attributes.keywords = ["coffee", "order", order.coffeeName]

    let item = CSSearchableItem(
        uniqueIdentifier: order.id.uuidString,
        domainIdentifier: "orders",
        attributeSet: attributes
    )

    CSSearchableIndex.default().indexSearchableItems([item]) { error in
        if let error = error {
            print("Indexing error: \(error)")
        }
    }
}
```

**Why this matters** Core Spotlight makes your app's content searchable. When users search for "latte" in Spotlight, your app's orders appear.

**Index only what matters** Don't index everything. Focus on user-facing content (orders, documents, notes, etc.).

See: **core-spotlight-ref** for batching, deletion patterns, and best practices

---

### Step 4: Use NSUserActivity for High-Value Screens

Mark important screens as eligible for search and prediction.

```swift
func viewOrder(_ order: Order) {
    let activity = NSUserActivity(activityType: "com.coffeeapp.viewOrder")
    activity.title = order.coffeeName
    activity.isEligibleForSearch = true
    activity.isEligibleForPrediction = true
    activity.persistentIdentifier = order.id.uuidString

    // Connect to App Intents
    activity.appEntityIdentifier = order.id.uuidString

    // Provide rich metadata
    let attributes = CSSearchableItemAttributeSet(contentType: .item)
    attributes.contentDescription = "Your \(order.coffeeName) order"
    attributes.thumbnailData = order.imageData
    activity.contentAttributeSet = attributes

    activity.becomeCurrent()

    // In your view controller or SwiftUI view
    self.userActivity = activity
}
```

**Why this matters** The system learns which screens users visit frequently and suggests them proactively. Lock screen widgets, Siri suggestions, and Spotlight all benefit.

**Critical** Only mark screens that users would want to return to. Not settings, not onboarding, not error states.

See: **core-spotlight-ref** for eligibility patterns and activity continuation

---

### Step 5: Provide Correct Intent Metadata

Clear descriptions and titles are critical because **Spotlight displays them directly.**

#### ❌ DON'T: Generic or unclear
```swift
static var title: LocalizedStringResource = "Do Thing"
static var description = IntentDescription("Performs action")
```

#### ✅ DO: Specific, action-oriented
```swift
static var title: LocalizedStringResource = "Order Coffee"
static var description = IntentDescription("Orders coffee for pickup")
```

**Parameter summaries must be natural language:**

```swift
static var parameterSummary: some ParameterSummary {
    Summary("Order \(\.$size) \(\.$coffeeType)")
}
// Siri: "Order large latte"
```

**Why this matters** Poor metadata means users won't understand what your intent does. Clear metadata = higher usage = system boosts it.

---

### Step 6: Usage-Based Boosting

**The system boosts shortcuts and activities that users actually invoke. If nobody uses an intent, the system hides it.**

This is automatic—you don't control it. What you control:
1. **Discoverability** — Make it easy to find (Steps 1-5)
2. **Utility** — Make it worth using (design good intents)
3. **Promotion** — Show users available shortcuts (SiriTipView)

```swift
// Promote your shortcuts in-app
SiriTipView(intent: OrderCoffeeIntent(), isVisible: $showTip)
    .siriTipViewStyle(.dark)
```

**Why this matters** Even perfect metadata won't help if users don't know shortcuts exist. Educate users in your app's UI.

See: **app-shortcuts-ref** for SiriTipView and ShortcutsLink patterns

---

## Decision Tree: Which API for Which Use Case

```
┌─ Need to expose app functionality? ────────────────────────────────┐
│                                                                      │
│  ┌─ YES → App Intents (AppIntent protocol)                         │
│  │        └─ Want instant availability without user setup?         │
│  │           └─ YES → App Shortcuts (AppShortcutsProvider)         │
│  │                                                                  │
│  └─ NO → Exposing app CONTENT (not actions)?                       │
│           │                                                         │
│           ├─ User-initiated activity (viewing screen)?             │
│           │  └─ YES → NSUserActivity with isEligibleForSearch      │
│           │                                                         │
│           └─ Indexing all content (documents, orders, notes)?      │
│              └─ YES → Core Spotlight (CSSearchableItem)            │
│                                                                     │
│  ┌─ Already using App Intents?                                     │
│  │  └─ Want automatic Spotlight search for entities?               │
│  │     └─ YES → IndexedEntity protocol                             │
│  │                                                                  │
│  └─ Want to connect screen to App Intent entity?                   │
│     └─ YES → NSUserActivity.appEntityIdentifier                    │
└──────────────────────────────────────────────────────────────────┘
```

### Quick Reference Table

| Use Case | API | Example |
|----------|-----|---------|
| Expose action to Siri/Shortcuts | `AppIntent` | "Order coffee" |
| Make action available instantly | `AppShortcut` | Appear in Spotlight immediately |
| Index all app content | `CSSearchableItem` | All coffee orders searchable |
| Mark current screen important | `NSUserActivity` | User viewing order detail |
| Auto-generate Find actions | `IndexedEntity` | "Find orders where..." |
| Link screen to App Intent | `appEntityIdentifier` | Deep link to specific order |

---

## Quick Implementation Pattern ("One Evening" Approach)

For minimal viable discoverability:

### 1. Define 1-3 Core App Intents (30 minutes)
```swift
// Your app's most valuable actions
struct OrderCoffeeIntent: AppIntent { /* ... */ }
struct ReorderLastIntent: AppIntent { /* ... */ }
struct ViewOrdersIntent: AppIntent { /* ... */ }
```

### 2. Create AppShortcutsProvider (15 minutes)
```swift
struct CoffeeAppShortcuts: AppShortcutsProvider {
    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OrderCoffeeIntent(),
            phrases: ["Order coffee in \(.applicationName)"],
            shortTitle: "Order",
            systemImageName: "cup.and.saucer.fill"
        )
        // Add 2-3 more shortcuts
    }
}
```

### 3. Index Top-Level Content (30 minutes)
```swift
// Index most recent/important content only
func indexRecentOrders() {
    let recentOrders = try await OrderService.shared.recent(limit: 20)
    let items = recentOrders.map { createSearchableItem(from: $0) }
    CSSearchableIndex.default().indexSearchableItems(items)
}
```

### 4. Add NSUserActivity to Detail Screens (30 minutes)
```swift
// In your detail view controllers/views
let activity = NSUserActivity(activityType: "com.app.viewOrder")
activity.isEligibleForSearch = true
activity.becomeCurrent()
self.userActivity = activity
```

### 5. Test in Spotlight and Shortcuts (15 minutes)
- Open Shortcuts app → Search for your app → Verify shortcuts appear
- Search Spotlight → Search for your content → Verify results
- Invoke Siri → "Order coffee in [YourApp]" → Verify works

**Total time: ~2 hours** for basic discoverability

---

## Anti-Patterns (What NOT to Do)

### ❌ ANTI-PATTERN 1: Implementing just App Intents without App Shortcuts

**Problem** Users must manually configure shortcuts. Your app won't appear in Spotlight/Siri automatically.

**Fix** Always create AppShortcutsProvider with suggested phrases.

---

### ❌ ANTI-PATTERN 2: Indexing everything in Core Spotlight

**Problem** Indexing thousands of items causes poor performance and quota issues. Users get overwhelmed.

```swift
// ❌ BAD: Index all 10,000 orders
let allOrders = try await OrderService.shared.all()
```

**Fix** Index selectively—recent items, favorites, frequently accessed.

```swift
// ✅ GOOD: Index recent orders only
let recentOrders = try await OrderService.shared.recent(limit: 50)
```

---

### ❌ ANTI-PATTERN 3: Generic intent titles and descriptions

**Problem** Spotlight displays these directly. Generic text confuses users.

```swift
// ❌ BAD
static var title: LocalizedStringResource = "Action"
static var description = IntentDescription("Does something")
```

**Fix** Use specific, action-oriented language.

```swift
// ✅ GOOD
static var title: LocalizedStringResource = "Order Coffee"
static var description = IntentDescription("Orders your favorite coffee for pickup")
```

---

### ❌ ANTI-PATTERN 4: Not educating users about shortcuts

**Problem** Perfect implementation means nothing if users don't know it exists.

**Fix** Use `SiriTipView` to promote shortcuts in your app's UI.

```swift
// Show tip after user places order
SiriTipView(intent: ReorderLastIntent(), isVisible: $showTip)
```

---

### ❌ ANTI-PATTERN 5: Marking every screen as eligible for search

**Problem** System gets confused about what's important. Low-quality suggestions.

```swift
// ❌ BAD: Settings screen marked for prediction
activity.isEligibleForPrediction = true // Don't predict Settings!
```

**Fix** Only mark screens users would want to return to (content, not chrome).

```swift
// ✅ GOOD: Mark content screens only
if order != nil {
    activity.isEligibleForPrediction = true
}
```

---

### ❌ ANTI-PATTERN 6: Forgetting to connect NSUserActivity to App Intents

**Problem** NSUserActivity and App Intents remain siloed. Lost integration opportunities.

**Fix** Use `appEntityIdentifier` to connect them.

```swift
// ✅ GOOD: Connect activity to App Intent entity
activity.appEntityIdentifier = order.id.uuidString
```

---

## Code Review Checklist

When reviewing discoverability implementation, verify:

**App Intents:**
- [ ] Intents have clear, action-oriented titles
- [ ] Descriptions explain what the intent does
- [ ] Parameter summaries use natural language phrasing
- [ ] `isDiscoverable = true` for public intents

**App Shortcuts:**
- [ ] AppShortcutsProvider is implemented
- [ ] Suggested phrases include `\(.applicationName)`
- [ ] Phrases are short and action-oriented
- [ ] ShortcutTileColor matches app branding
- [ ] 3-5 core shortcuts defined (not too many)

**Core Spotlight:**
- [ ] Only valuable content is indexed (not everything)
- [ ] Unique identifiers are stable and persistent
- [ ] Domain identifiers group related content
- [ ] Attributes include title, description, keywords
- [ ] Deletion logic exists (when content removed)

**NSUserActivity:**
- [ ] Only high-value screens marked eligible
- [ ] `becomeCurrent()` called when screen appears
- [ ] `resignCurrent()` called when screen disappears
- [ ] `appEntityIdentifier` connects to App Intent entities
- [ ] `contentAttributeSet` provides rich metadata

**User Education:**
- [ ] SiriTipView used to promote shortcuts
- [ ] ShortcutsLink available in settings/help
- [ ] Onboarding mentions Siri/Spotlight support

**Testing:**
- [ ] Shortcuts appear in Shortcuts app
- [ ] Siri recognizes suggested phrases
- [ ] Spotlight returns app content
- [ ] Activity continuation works (tap Spotlight result)

---

## Related Skills

- **app-intents-ref** — Complete App Intents API reference
- **app-shortcuts-ref** — App Shortcuts implementation guide
- **core-spotlight-ref** — Core Spotlight and NSUserActivity reference

---

## Resources

**WWDC**: 260, 275, 2022-10170

**Docs**: /appintents/making-your-app-s-functionality-available-to-siri, /corespotlight

**Skills**: axiom-app-intents-ref, axiom-app-shortcuts-ref, axiom-core-spotlight-ref

---

**Remember** Discoverability isn't one API—it's a strategy. Feed the system metadata across App Intents, App Shortcuts, Core Spotlight, and NSUserActivity. Let iOS decide when to surface your app based on context and user behavior.
