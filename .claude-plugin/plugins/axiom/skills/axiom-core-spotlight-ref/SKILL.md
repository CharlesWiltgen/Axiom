---
name: axiom-core-spotlight-ref
description: Use when indexing app content for Spotlight search, using NSUserActivity for prediction/handoff, or choosing between CSSearchableItem and IndexedEntity - covers Core Spotlight framework and NSUserActivity integration for iOS 9+
skill_type: reference
version: 1.0.0
---

# Core Spotlight & NSUserActivity Reference

## Overview

Comprehensive guide to Core Spotlight framework and NSUserActivity for making app content discoverable in Spotlight search, enabling Siri predictions, and supporting Handoff. Core Spotlight directly indexes app content while NSUserActivity captures user engagement for prediction.

**Key distinction** Core Spotlight = indexing all app content; NSUserActivity = marking current user activity for prediction/handoff.

---

## When to Use This Skill

Use this skill when:
- Indexing app content (documents, notes, orders, messages) for Spotlight
- Using NSUserActivity for Handoff or Siri predictions
- Choosing between CSSearchableItem, IndexedEntity, and NSUserActivity
- Implementing activity continuation from Spotlight results
- Batch indexing for performance
- Deleting indexed content
- Debugging Spotlight search not finding app content
- Integrating NSUserActivity with App Intents (appEntityIdentifier)

Do NOT use this skill for:
- App Shortcuts implementation (use app-shortcuts-ref)
- App Intents basics (use app-intents-ref)
- Overall discoverability strategy (use app-discoverability)

---

## Related Skills

- **app-intents-ref** — App Intents framework including IndexedEntity
- **app-discoverability** — Strategic guide for making apps discoverable
- **app-shortcuts-ref** — App Shortcuts for instant availability

---

## When to Use Each API

| Use Case | Approach | Example |
|----------|----------|---------|
| User viewing specific screen | `NSUserActivity` | User opened order details |
| Index all app content | `CSSearchableItem` | All 500 orders searchable |
| App Intents entity search | `IndexedEntity` | "Find orders where..." |
| Handoff between devices | `NSUserActivity` | Continue editing note on Mac |
| Background content indexing | `CSSearchableItem` batch | Index documents on launch |

**Apple guidance** Use NSUserActivity for user-initiated activities (screens currently visible), not as a general indexing mechanism. For comprehensive content indexing, use Core Spotlight's CSSearchableItem.

---

## Core Spotlight (CSSearchableItem)

### Creating Searchable Items

```swift
import CoreSpotlight
import UniformTypeIdentifiers

func indexOrder(_ order: Order) {
    // 1. Create attribute set with metadata
    let attributes = CSSearchableItemAttributeSet(contentType: .item)
    attributes.title = order.coffeeName
    attributes.contentDescription = "Ordered on \(order.date.formatted())"
    attributes.keywords = ["coffee", "order", order.coffeeName.lowercased()]
    attributes.thumbnailData = order.imageData

    // Optional: Add location
    attributes.latitude = order.location.coordinate.latitude
    attributes.longitude = order.location.coordinate.longitude

    // Optional: Add rating
    attributes.rating = NSNumber(value: order.rating)

    // 2. Create searchable item
    let item = CSSearchableItem(
        uniqueIdentifier: order.id.uuidString,        // Stable ID
        domainIdentifier: "orders",                   // Grouping
        attributeSet: attributes
    )

    // Optional: Set expiration
    item.expirationDate = Date().addingTimeInterval(60 * 60 * 24 * 365)  // 1 year

    // 3. Index the item
    CSSearchableIndex.default().indexSearchableItems([item]) { error in
        if let error = error {
            print("Indexing error: \(error.localizedDescription)")
        }
    }
}
```

---

### Key Properties

#### uniqueIdentifier
**Purpose** Stable, persistent ID unique to this item within your app.

```swift
uniqueIdentifier: order.id.uuidString
```

**Requirements:**
- Must be stable (same item = same identifier)
- Used for updates and deletion
- Scoped to your app

---

#### domainIdentifier
**Purpose** Groups related items for bulk operations.

```swift
domainIdentifier: "orders"
```

**Use cases:**
- Delete all items in a domain
- Organize by type (orders, documents, messages)
- Batch operations

**Pattern:**
```swift
// Index with domains
item1.domainIdentifier = "orders"
item2.domainIdentifier = "documents"

// Delete entire domain
CSSearchableIndex.default().deleteSearchableItems(
    withDomainIdentifiers: ["orders"]
) { error in }
```

---

### CSSearchableItemAttributeSet

Metadata describing the searchable content.

```swift
let attributes = CSSearchableItemAttributeSet(contentType: .item)

// Required
attributes.title = "Order #1234"
attributes.displayName = "Coffee Order"

// Highly recommended
attributes.contentDescription = "Medium latte with oat milk"
attributes.keywords = ["coffee", "latte", "order"]
attributes.thumbnailData = imageData

// Optional but valuable
attributes.contentCreationDate = Date()
attributes.contentModificationDate = Date()
attributes.rating = NSNumber(value: 5)
attributes.comment = "My favorite order"
```

#### Common Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `title` | Primary title | "Coffee Order #1234" |
| `displayName` | User-visible name | "Morning Latte" |
| `contentDescription` | Description text | "Medium latte with oat milk" |
| `keywords` | Search terms | ["coffee", "latte"] |
| `thumbnailData` | Preview image | JPEG/PNG data |
| `contentCreationDate` | When created | Date() |
| `contentModificationDate` | Last modified | Date() |
| `rating` | Star rating | NSNumber(value: 5) |
| `latitude` / `longitude` | Location | 37.7749, -122.4194 |

#### Document-Specific Attributes

```swift
// For document types
attributes.contentType = UTType.pdf
attributes.author = "John Doe"
attributes.pageCount = 10
attributes.fileSize = 1024000
attributes.path = "/path/to/document.pdf"
```

#### Message-Specific Attributes

```swift
// For messages
attributes.recipients = ["jane@example.com"]
attributes.recipientNames = ["Jane Doe"]
attributes.authorNames = ["John Doe"]
attributes.subject = "Meeting notes"
```

---

### Batch Indexing for Performance

#### ❌ DON'T: Index items one at a time
```swift
// Bad: 100 index operations
for order in orders {
    CSSearchableIndex.default().indexSearchableItems([order.asSearchableItem()]) { _ in }
}
```

#### ✅ DO: Batch index operations
```swift
// Good: 1 index operation
let items = orders.map { $0.asSearchableItem() }

CSSearchableIndex.default().indexSearchableItems(items) { error in
    if let error = error {
        print("Batch indexing error: \(error)")
    } else {
        print("Indexed \(items.count) items")
    }
}
```

**Recommended batch size** 100-500 items per call. For larger sets, split into multiple batches.

---

### Deletion Patterns

#### Delete by Identifier
```swift
let identifiers = ["order-1", "order-2", "order-3"]

CSSearchableIndex.default().deleteSearchableItems(
    withIdentifiers: identifiers
) { error in
    if let error = error {
        print("Deletion error: \(error)")
    }
}
```

#### Delete by Domain
```swift
// Delete all items in "orders" domain
CSSearchableIndex.default().deleteSearchableItems(
    withDomainIdentifiers: ["orders"]
) { error in }
```

#### Delete All
```swift
// Nuclear option: delete everything
CSSearchableIndex.default().deleteAllSearchableItems { error in
    if let error = error {
        print("Failed to delete all: \(error)")
    }
}
```

**When to delete:**
- User deletes content
- Content expires
- User logs out
- App reset/reinstall

---

### App Entity Integration (App Intents)

#### Create from App Entity
```swift
import AppIntents

struct OrderEntity: AppEntity, IndexedEntity {
    var id: UUID

    @Property(title: "Coffee", indexingKey: \.title)
    var coffeeName: String

    @Property(title: "Date", indexingKey: \.contentCreationDate)
    var orderDate: Date

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Order"

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(coffeeName)", subtitle: "Order from \(orderDate.formatted())")
    }
}

// Create searchable item from entity
let order = OrderEntity(id: UUID(), coffeeName: "Latte", orderDate: Date())
let item = CSSearchableItem(appEntity: order)
CSSearchableIndex.default().indexSearchableItems([item])
```

#### Associate Entity with Existing Item
```swift
let attributes = CSSearchableItemAttributeSet(contentType: .item)
attributes.title = "Order #1234"

let item = CSSearchableItem(
    uniqueIdentifier: "order-1234",
    domainIdentifier: "orders",
    attributeSet: attributes
)

// Associate with App Intent entity
item.associateAppEntity(orderEntity, priority: .default)
```

**Benefits:**
- Automatic "Find" actions in Shortcuts
- Spotlight search returns entities directly
- App Intents integration

---

## NSUserActivity

### Overview

NSUserActivity captures user engagement for:
- **Handoff** — Continue activity on another device
- **Spotlight search** — Index currently viewed content
- **Siri predictions** — Suggest returning to this screen
- **Quick Note** — Link notes to app content

**Platform support** iOS 8.0+, iPadOS 8.0+, macOS 10.10+, tvOS 9.0+, watchOS 2.0+, axiom-visionOS 1.0+

---

### Eligibility Properties

```swift
let activity = NSUserActivity(activityType: "com.app.viewOrder")

// Enable Spotlight search
activity.isEligibleForSearch = true

// Enable Siri predictions
activity.isEligibleForPrediction = true

// Enable Handoff to other devices
activity.isEligibleForHandoff = true

// Contribute URL to global search (public content only)
activity.isEligibleForPublicIndexing = false
```

**Privacy note** Only set `isEligibleForPublicIndexing = true` for publicly accessible content (e.g., blog posts with public URLs).

---

### Basic Pattern

```swift
func viewOrder(_ order: Order) {
    // 1. Create activity
    let activity = NSUserActivity(activityType: "com.coffeeapp.viewOrder")
    activity.title = order.coffeeName

    // 2. Set eligibility
    activity.isEligibleForSearch = true
    activity.isEligibleForPrediction = true

    // 3. Provide identifier for updates/deletion
    activity.persistentIdentifier = order.id.uuidString

    // 4. Provide rich metadata
    let attributes = CSSearchableItemAttributeSet(contentType: .item)
    attributes.title = order.coffeeName
    attributes.contentDescription = "Your \(order.coffeeName) order"
    attributes.thumbnailData = order.imageData
    activity.contentAttributeSet = attributes

    // 5. Mark as current
    activity.becomeCurrent()

    // 6. Store reference (important!)
    self.userActivity = activity
}
```

**Critical** Maintain strong reference to activity. It won't appear in search without one.

---

### becomeCurrent() and resignCurrent()

```swift
// UIKit pattern
class OrderDetailViewController: UIViewController {
    var currentActivity: NSUserActivity?

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        let activity = NSUserActivity(activityType: "com.app.viewOrder")
        activity.title = order.coffeeName
        activity.isEligibleForSearch = true
        activity.becomeCurrent()  // Mark as active

        self.currentActivity = activity
        self.userActivity = activity  // UIKit integration
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        currentActivity?.resignCurrent()  // Mark as inactive
    }
}
```

```swift
// SwiftUI pattern
struct OrderDetailView: View {
    let order: Order

    var body: some View {
        VStack {
            Text(order.coffeeName)
        }
        .onAppear {
            let activity = NSUserActivity(activityType: "com.app.viewOrder")
            activity.title = order.coffeeName
            activity.isEligibleForSearch = true
            activity.becomeCurrent()

            // SwiftUI automatically manages userActivity
            self.userActivity = activity
        }
    }
}
```

---

### App Intents Integration (appEntityIdentifier)

Connect NSUserActivity to App Intent entities.

```swift
func viewOrder(_ order: Order) {
    let activity = NSUserActivity(activityType: "com.app.viewOrder")
    activity.title = order.coffeeName
    activity.isEligibleForSearch = true
    activity.isEligibleForPrediction = true

    // Connect to App Intent entity
    activity.appEntityIdentifier = order.id.uuidString

    // Now Spotlight can surface this as an entity suggestion
    activity.becomeCurrent()
    self.userActivity = activity
}
```

**Benefits:**
- Siri suggests this order in relevant contexts
- App Intents can reference this activity
- Shortcuts integration

---

### On-Screen Content Tagging

**Pattern from WWDC** Tag currently visible content for Spotlight parameter suggestions.

```swift
func showEvent(_ event: Event) {
    let activity = NSUserActivity(activityType: "com.app.viewEvent")
    activity.persistentIdentifier = event.id.uuidString

    // Spotlight suggests this event for intent parameters
    activity.appEntityIdentifier = event.id.uuidString

    activity.becomeCurrent()
    userActivity = activity
}
```

**Result** When users invoke intents requiring an event parameter, Spotlight suggests the currently visible event.

---

### Quick Note Integration (macOS/iPadOS)

For Quick Note linking, activities must:
1. Be the app's **current activity** (via `becomeCurrent()`)
2. Have a clear, concise `title` (nouns, not verbs)
3. Provide stable, consistent identifiers
4. Support navigation to linked content indefinitely
5. Gracefully handle missing content

```swift
let activity = NSUserActivity(activityType: "com.app.viewNote")
activity.title = note.title  // ✅ "Project Ideas" not ❌ "View Note"
activity.persistentIdentifier = note.id.uuidString
activity.targetContentIdentifier = note.id.uuidString
activity.becomeCurrent()
```

---

### Activity Continuation (Handling Spotlight Taps)

When users tap Spotlight results, handle continuation:

#### UIKit
```swift
// AppDelegate or SceneDelegate
func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
) -> Bool {
    guard userActivity.activityType == "com.app.viewOrder" else {
        return false
    }

    // Extract identifier
    if let identifier = userActivity.persistentIdentifier,
       let orderID = UUID(uuidString: identifier) {
        // Navigate to order
        navigateToOrder(orderID)
        return true
    }

    return false
}
```

#### SwiftUI
```swift
@main
struct CoffeeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onContinueUserActivity("com.app.viewOrder") { userActivity in
                    if let identifier = userActivity.persistentIdentifier,
                       let orderID = UUID(uuidString: identifier) {
                        // Navigate to order
                        navigateToOrder(orderID)
                    }
                }
        }
    }
}
```

#### Searchable Item Continuation
```swift
// When continuing from CSSearchableItem
func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
) -> Bool {
    if userActivity.activityType == CSSearchableItemActionType {
        // Get identifier from Core Spotlight item
        if let identifier = userActivity.userInfo?[CSSearchableItemActivityIdentifier] as? String {
            // Navigate based on identifier
            navigateToItem(identifier)
            return true
        }
    }

    return false
}
```

---

### Deletion APIs

#### Delete All Saved Activities
```swift
NSUserActivity.deleteAllSavedUserActivities { }
```

#### Delete Specific Activities
```swift
let identifiers = ["order-1", "order-2"]

NSUserActivity.deleteSavedUserActivities(
    withPersistentIdentifiers: identifiers
) { }
```

**When to delete:**
- User deletes content
- User logs out
- Content no longer accessible

---

## NSUserActivity vs CSSearchableItem

| Aspect | NSUserActivity | CSSearchableItem |
|--------|---------------|------------------|
| **Purpose** | Current user activity | Indexing all content |
| **When to use** | User viewing a screen | Background content indexing |
| **Scope** | One item at a time | Batch operations |
| **Handoff** | Supported | Not supported |
| **Prediction** | Supported | Not supported |
| **Search** | Limited | Full Spotlight integration |
| **Example** | User viewing order detail | Index all 500 orders |

**Recommended** Use both:
- NSUserActivity for screens currently visible
- CSSearchableItem for comprehensive content indexing

---

## Testing & Debugging

### Verify Indexed Items

#### Using Spotlight
1. Open Spotlight (swipe down on Home Screen)
2. Search for indexed content keywords
3. Verify your app's results appear
4. Tap result → Verify navigation works

#### Using Console Logs
```swift
CSSearchableIndex.default().fetchLastClientState { clientState, error in
    if let error = error {
        print("Error fetching client state: \(error)")
    } else {
        print("Client state: \(clientState?.base64EncodedString() ?? "none")")
    }
}
```

---

### Common Issues

#### Items not appearing in Spotlight
- Wait 1-2 minutes for indexing
- Verify `isEligibleForSearch = true`
- Check System Settings → Siri & Search → [App] → Show App in Search
- Restart device
- Check console for indexing errors

#### Activity not triggering Handoff
- Verify `isEligibleForHandoff = true`
- Ensure both devices signed into same iCloud account
- Check Bluetooth and Wi-Fi enabled on both devices
- Verify activityType is reverse DNS (com.company.app.action)

#### Continuation not working
- Verify `application(_:continue:restorationHandler:)` implemented
- Check activityType matches exactly
- Ensure persistentIdentifier is set
- Test with debugger to verify method is called

---

## Best Practices

### 1. Selective Indexing

#### ❌ DON'T: Index everything
```swift
// Bad: Index all 10,000 items
let allItems = try await ItemService.shared.all()
```

#### ✅ DO: Index selectively
```swift
// Good: Index recent/important items
let recentItems = try await ItemService.shared.recent(limit: 100)
let favoriteItems = try await ItemService.shared.favorites()
```

**Why** Performance, quota limits, user experience.

---

### 2. Use Domain Identifiers

#### ❌ DON'T: Rely only on unique identifiers
```swift
// Hard to delete all orders
CSSearchableIndex.default().deleteSearchableItems(withIdentifiers: allOrderIDs)
```

#### ✅ DO: Group with domains
```swift
// Easy to delete all orders
CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: ["orders"])
```

---

### 3. Set Expiration Dates

#### ❌ DON'T: Index items forever
```swift
// Bad: Items never expire
let item = CSSearchableItem(/* ... */)
```

#### ✅ DO: Set reasonable expiration
```swift
// Good: Expire after 1 year
item.expirationDate = Date().addingTimeInterval(60 * 60 * 24 * 365)
```

---

### 4. Provide Rich Metadata

#### ❌ DON'T: Minimal metadata
```swift
attributes.title = "Item"
```

#### ✅ DO: Rich, searchable metadata
```swift
attributes.title = "Medium Latte Order"
attributes.contentDescription = "Ordered on December 12, 2025"
attributes.keywords = ["coffee", "latte", "order", "medium"]
attributes.thumbnailData = imageData
```

---

### 5. Handle Missing Content Gracefully

```swift
func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
) -> Bool {
    guard let identifier = userActivity.persistentIdentifier else {
        return false
    }

    // Attempt to load content
    if let item = try? await ItemService.shared.fetch(id: identifier) {
        navigate(to: item)
        return true
    } else {
        // Content deleted or unavailable
        showAlert("This content is no longer available")

        // Delete activity from search
        NSUserActivity.deleteSavedUserActivities(
            withPersistentIdentifiers: [identifier]
        )

        return true  // Still handled
    }
}
```

---

## Complete Example

### Comprehensive Integration

```swift
import CoreSpotlight
import UniformTypeIdentifiers

class OrderManager {

    // MARK: - Core Spotlight Indexing

    func indexOrder(_ order: Order) {
        let attributes = CSSearchableItemAttributeSet(contentType: .item)
        attributes.title = order.coffeeName
        attributes.contentDescription = "Order from \(order.date.formatted())"
        attributes.keywords = ["coffee", "order", order.coffeeName.lowercased()]
        attributes.thumbnailData = order.thumbnailImageData
        attributes.contentCreationDate = order.date
        attributes.rating = NSNumber(value: order.rating)

        let item = CSSearchableItem(
            uniqueIdentifier: order.id.uuidString,
            domainIdentifier: "orders",
            attributeSet: attributes
        )

        item.expirationDate = Date().addingTimeInterval(60 * 60 * 24 * 365)

        CSSearchableIndex.default().indexSearchableItems([item]) { error in
            if let error = error {
                print("Indexing error: \(error)")
            }
        }
    }

    func deleteOrder(_ orderID: UUID) {
        // Delete from Core Spotlight
        CSSearchableIndex.default().deleteSearchableItems(
            withIdentifiers: [orderID.uuidString]
        )

        // Delete NSUserActivity
        NSUserActivity.deleteSavedUserActivities(
            withPersistentIdentifiers: [orderID.uuidString]
        )
    }

    func deleteAllOrders() {
        CSSearchableIndex.default().deleteSearchableItems(
            withDomainIdentifiers: ["orders"]
        )
    }

    // MARK: - NSUserActivity for Current Screen

    func createActivityForOrder(_ order: Order) -> NSUserActivity {
        let activity = NSUserActivity(activityType: "com.coffeeapp.viewOrder")
        activity.title = order.coffeeName
        activity.isEligibleForSearch = true
        activity.isEligibleForPrediction = true
        activity.persistentIdentifier = order.id.uuidString

        // Connect to App Intents
        activity.appEntityIdentifier = order.id.uuidString

        // Rich metadata
        let attributes = CSSearchableItemAttributeSet(contentType: .item)
        attributes.title = order.coffeeName
        attributes.contentDescription = "Your \(order.coffeeName) order"
        attributes.thumbnailData = order.thumbnailImageData
        activity.contentAttributeSet = attributes

        return activity
    }
}

// UIKit view controller
class OrderDetailViewController: UIViewController {
    var order: Order!
    var currentActivity: NSUserActivity?

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        currentActivity = OrderManager.shared.createActivityForOrder(order)
        currentActivity?.becomeCurrent()
        self.userActivity = currentActivity
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        currentActivity?.resignCurrent()
    }
}

// SwiftUI view
struct OrderDetailView: View {
    let order: Order

    var body: some View {
        VStack {
            Text(order.coffeeName)
                .font(.largeTitle)

            Text("Ordered on \(order.date.formatted())")
                .foregroundColor(.secondary)
        }
        .userActivity("com.coffeeapp.viewOrder") { activity in
            activity.title = order.coffeeName
            activity.isEligibleForSearch = true
            activity.isEligibleForPrediction = true
            activity.persistentIdentifier = order.id.uuidString
            activity.appEntityIdentifier = order.id.uuidString

            let attributes = CSSearchableItemAttributeSet(contentType: .item)
            attributes.title = order.coffeeName
            attributes.contentDescription = "Your \(order.coffeeName) order"
            activity.contentAttributeSet = attributes
        }
    }
}
```

---

## Resources

**WWDC**: 260, 2015-709

**Docs**: /corespotlight, /corespotlight/cssearchableitem, /foundation/nsuseractivity

**Skills**: axiom-app-intents-ref, axiom-app-discoverability, axiom-app-shortcuts-ref

---

**Remember** Core Spotlight indexes all your app's content; NSUserActivity marks what the user is currently doing. Use CSSearchableItem for batch indexing, NSUserActivity for active screens, and connect them to App Intents with appEntityIdentifier for comprehensive discoverability.
