---
name: core-spotlight-ref
description: Reference — Core Spotlight and NSUserActivity guide for indexing app content, Spotlight search, Siri predictions, and Handoff for iOS 9+
---

# Core Spotlight & NSUserActivity

Complete reference for Core Spotlight framework and NSUserActivity—make app content discoverable in Spotlight search, enable Siri predictions, and support Handoff.

## When to Use This Skill

- Index app content (documents, notes, orders, messages) for Spotlight
- Use NSUserActivity for Handoff or Siri predictions
- Choose between CSSearchableItem, IndexedEntity, and NSUserActivity
- Implement activity continuation from Spotlight results
- Batch index for performance
- Delete indexed content
- Debug Spotlight search not finding app content
- Integrate NSUserActivity with App Intents (appEntityIdentifier)

## When to Use Each API

| Use Case | Approach |
|----------|----------|
| User viewing specific screen | NSUserActivity |
| Index all app content | CSSearchableItem |
| App Intents entity search | IndexedEntity |
| Handoff between devices | NSUserActivity |
| Background content indexing | CSSearchableItem batch |

**Apple guidance:** Use NSUserActivity for user-initiated activities (screens currently visible), not as a general indexing mechanism. For comprehensive content indexing, use Core Spotlight's CSSearchableItem.

## Core Spotlight (CSSearchableItem)

### Creating Searchable Items

```swift
import CoreSpotlight
import UniformTypeIdentifiers

let attributes = CSSearchableItemAttributeSet(contentType: .item)
attributes.title = "Order #1234"
attributes.contentDescription = "Medium latte with oat milk"
attributes.keywords = ["coffee", "latte", "order"]
attributes.thumbnailData = imageData

let item = CSSearchableItem(
    uniqueIdentifier: order.id.uuidString,
    domainIdentifier: "orders",
    attributeSet: attributes
)

CSSearchableIndex.default().indexSearchableItems([item])
```

### Batch Indexing

Always batch operations for performance:

```swift
// ✅ GOOD: Batch index
let items = orders.map { $0.asSearchableItem() }
CSSearchableIndex.default().indexSearchableItems(items)

// ❌ BAD: Index one at a time
for order in orders {
    CSSearchableIndex.default().indexSearchableItems([order.asSearchableItem()])
}
```

## NSUserActivity

Mark important screens for prediction and search:

```swift
func viewOrder(_ order: Order) {
    let activity = NSUserActivity(activityType: "com.app.viewOrder")
    activity.title = order.coffeeName
    activity.isEligibleForSearch = true
    activity.isEligibleForPrediction = true
    activity.persistentIdentifier = order.id.uuidString

    // Connect to App Intents
    activity.appEntityIdentifier = order.id.uuidString

    activity.becomeCurrent()
    self.userActivity = activity
}
```

## App Intents Integration

Connect NSUserActivity and Core Spotlight to App Intents:

```swift
// NSUserActivity → App Intent
activity.appEntityIdentifier = order.id.uuidString

// Core Spotlight → App Intent
let item = CSSearchableItem(appEntity: orderEntity)
```

**Benefits:**
- Automatic "Find" actions in Shortcuts
- Direct entity results in Spotlight search
- Automatic Siri suggestions based on app entities

## Related Skills

- [app-intents-ref](/reference/app-intents-ref) — App Intents framework including IndexedEntity
- [app-discoverability](/reference/app-discoverability) — Strategic guide for making apps discoverable
- [app-shortcuts-ref](/reference/app-shortcuts-ref) — App Shortcuts for instant availability
