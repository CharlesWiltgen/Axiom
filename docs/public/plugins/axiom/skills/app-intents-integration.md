---
name: app-intents-integration
description: Use when integrating App Intents for Siri, Apple Intelligence, Shortcuts, Spotlight, or system experiences - covers AppIntent, AppEntity, parameter handling, entity queries, background execution, authentication, and debugging common integration issues for iOS 16+
---

# App Intents Integration

## Overview

Comprehensive guide to App Intents framework for exposing app functionality to Siri, Apple Intelligence, Shortcuts, Spotlight, and other system experiences. Replaces older SiriKit custom intents with modern Swift-first API.

**Core principle:** App Intents make your app's actions discoverable across Apple's ecosystem. Well-designed intents feel natural in Siri conversations, Shortcuts automation, and Spotlight search.

## When to Use This Skill

- Exposing app functionality to Siri and Apple Intelligence
- Making app actions available in Shortcuts app
- Enabling Spotlight search for app content
- Integrating with Focus filters, widgets, Live Activities
- Adding Action button support (Apple Watch Ultra)
- Debugging intent resolution or parameter validation failures
- Testing intents with Shortcuts app
- Implementing entity queries for app content

## System Experiences Supported

App Intents integrate with:
- **Siri** - Voice commands and Apple Intelligence
- **Shortcuts** - Automation workflows
- **Spotlight** - Search discovery
- **Focus Filters** - Contextual filtering
- **Action Button** - Quick actions (Apple Watch Ultra)
- **Control Center** - Custom controls
- **WidgetKit** - Interactive widgets
- **Live Activities** - Dynamic Island updates
- **Visual Intelligence** - Image-based interactions

## Core Concepts

### The Three Building Blocks

**1. AppIntent** - Executable actions with parameters
```swift
struct OrderSoupIntent: AppIntent {
    static var title: LocalizedStringResource = "Order Soup"
    static var description: IntentDescription = "Orders soup from the restaurant"

    @Parameter(title: "Soup")
    var soup: SoupEntity

    @Parameter(title: "Quantity")
    var quantity: Int?

    func perform() async throws -> some IntentResult {
        guard let quantity = quantity, quantity < 10 else {
            throw $quantity.needsValue("Please specify how many soups")
        }

        try await OrderService.shared.order(soup: soup, quantity: quantity)
        return .result()
    }
}
```

**2. AppEntity** - Objects users interact with
```swift
struct SoupEntity: AppEntity {
    var id: String
    var name: String
    var price: Decimal

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Soup"

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)", subtitle: "$\(price)")
    }

    static var defaultQuery = SoupQuery()
}
```

**3. AppEnum** - Enumeration types for parameters
```swift
enum SoupSize: String, AppEnum {
    case small
    case medium
    case large

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Size"
    static var caseDisplayRepresentations: [SoupSize: DisplayRepresentation] = [
        .small: "Small (8 oz)",
        .medium: "Medium (12 oz)",
        .large: "Large (16 oz)"
    ]
}
```

---

## AppIntent: Defining Actions

### Essential Properties

```swift
struct SendMessageIntent: AppIntent {
    // REQUIRED: Short verb-noun phrase
    static var title: LocalizedStringResource = "Send Message"

    // REQUIRED: Purpose explanation
    static var description: IntentDescription = "Sends a message to a contact"

    // OPTIONAL: Discovery in Shortcuts/Spotlight
    static var isDiscoverable: Bool = true

    // OPTIONAL: Launch app when run
    static var openAppWhenRun: Bool = false

    // OPTIONAL: Authentication requirement
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
}
```

### Parameter Declaration

```swift
struct BookAppointmentIntent: AppIntent {
    // Required parameter (non-optional)
    @Parameter(title: "Service")
    var service: ServiceEntity

    // Optional parameter
    @Parameter(title: "Preferred Date")
    var preferredDate: Date?

    // Parameter with requestValueDialog for disambiguation
    @Parameter(title: "Location",
               requestValueDialog: "Which location would you like to visit?")
    var location: LocationEntity

    // Parameter with default value
    @Parameter(title: "Duration")
    var duration: Int = 60
}
```

### Parameter Summary (Siri Phrasing)

```swift
struct OrderIntent: AppIntent {
    @Parameter(title: "Item")
    var item: MenuItem

    @Parameter(title: "Quantity")
    var quantity: Int

    static var parameterSummary: some ParameterSummary {
        Summary("Order \(\.$quantity) \(\.$item)") {
            \.$quantity
            \.$item
        }
    }
}
// Siri: "Order 2 lattes"
```

### The perform() Method

```swift
func perform() async throws -> some IntentResult {
    // 1. Validate parameters
    guard quantity > 0 && quantity < 100 else {
        throw ValidationError.invalidQuantity
    }

    // 2. Execute action
    let order = try await orderService.placeOrder(
        item: item,
        quantity: quantity
    )

    // 3. Donate for learning (optional)
    await donation()

    // 4. Return result
    return .result(
        value: order,
        dialog: "Your order for \(quantity) \(item.name) has been placed"
    )
}
```

### Error Handling

```swift
enum OrderError: Error, CustomLocalizedStringResourceConvertible {
    case outOfStock(itemName: String)
    case paymentFailed
    case networkError

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .outOfStock(let name):
            return "Sorry, \(name) is out of stock"
        case .paymentFailed:
            return "Payment failed. Please check your payment method"
        case .networkError:
            return "Network error. Please try again"
        }
    }
}

func perform() async throws -> some IntentResult {
    if !item.isInStock {
        throw OrderError.outOfStock(itemName: item.name)
    }
    // ...
}
```

---

## AppEntity: Representing App Content

### Entity Definition

```swift
struct BookEntity: AppEntity {
    // REQUIRED: Unique, persistent identifier
    var id: UUID

    // App data properties
    var title: String
    var author: String
    var coverImageURL: URL?

    // REQUIRED: Type display name
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Book"

    // REQUIRED: Instance display
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(title)",
            subtitle: "by \(author)",
            image: coverImageURL.map { .init(url: $0) }
        )
    }

    // REQUIRED: Query for resolution
    static var defaultQuery = BookQuery()
}
```

### Exposing Properties

```swift
struct TaskEntity: AppEntity {
    var id: UUID

    @Property(title: "Title")
    var title: String

    @Property(title: "Due Date")
    var dueDate: Date?

    @Property(title: "Priority")
    var priority: TaskPriority

    @Property(title: "Completed")
    var isCompleted: Bool

    // Properties exposed to system for filtering/sorting
}
```

### Entity Query

```swift
struct BookQuery: EntityQuery {
    func entities(for identifiers: [UUID]) async throws -> [BookEntity] {
        // Fetch entities by IDs
        return try await BookService.shared.fetchBooks(ids: identifiers)
    }

    func suggestedEntities() async throws -> [BookEntity] {
        // Provide suggestions (recent, favorites, etc.)
        return try await BookService.shared.recentBooks(limit: 10)
    }
}

// Optional: Enable string-based search
extension BookQuery: EntityStringQuery {
    func entities(matching string: String) async throws -> [BookEntity] {
        return try await BookService.shared.searchBooks(query: string)
    }
}
```

### Separating Entities from Models

**❌ DON'T: Modify core data models**
```swift
// DON'T make your model conform to AppEntity
struct Book: AppEntity { // Bad - couples model to intents
    var id: UUID
    var title: String
    // ...
}
```

**✅ DO: Create dedicated entities**
```swift
// Your core model
struct Book {
    var id: UUID
    var title: String
    var isbn: String
    var pages: Int
    // ... lots of internal properties
}

// Separate entity for intents
struct BookEntity: AppEntity {
    var id: UUID
    var title: String
    var author: String

    // Convert from model
    init(from book: Book) {
        self.id = book.id
        self.title = book.title
        self.author = book.author.name
    }
}
```

---

## Authentication & Security

### Authentication Policies

```swift
struct ViewAccountIntent: AppIntent {
    // No authentication required
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
}

struct TransferMoneyIntent: AppIntent {
    // Requires user to be logged in
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
}

struct UnlockVaultIntent: AppIntent {
    // Requires device unlock (Face ID/Touch ID/passcode)
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication
}
```

---

## Background vs Foreground Execution

### Background Execution

```swift
struct QuickToggleIntent: AppIntent {
    static var openAppWhenRun: Bool = false // Runs in background

    func perform() async throws -> some IntentResult {
        // Executes without opening app
        await SettingsService.shared.toggle(setting: .darkMode)
        return .result()
    }
}
```

### Foreground Continuation

```swift
struct EditDocumentIntent: AppIntent {
    @Parameter(title: "Document")
    var document: DocumentEntity

    func perform() async throws -> some IntentResult {
        // Open app to continue in UI
        return .result(opensIntent: OpenDocumentIntent(document: document))
    }
}

struct OpenDocumentIntent: AppIntent {
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Document")
    var document: DocumentEntity

    func perform() async throws -> some IntentResult {
        // App is now foreground, safe to update UI
        await MainActor.run {
            DocumentCoordinator.shared.open(document: document)
        }
        return .result()
    }
}
```

---

## Confirmation Dialogs

### Requesting Confirmation

```swift
struct DeleteTaskIntent: AppIntent {
    @Parameter(title: "Task")
    var task: TaskEntity

    func perform() async throws -> some IntentResult {
        // Request confirmation before destructive action
        try await requestConfirmation(
            result: .result(dialog: "Are you sure you want to delete '\(task.title)'?"),
            confirmationActionName: .init(stringLiteral: "Delete")
        )

        // User confirmed, proceed
        try await TaskService.shared.delete(task: task)
        return .result(dialog: "Task deleted")
    }
}
```

---

## Assistant Schemas (Pre-built Intents)

Apple provides pre-built schemas for common app categories:

### Books App Example

```swift
import AppIntents
import BooksIntents

struct OpenBookIntent: BooksOpenBookIntent {
    @Parameter(title: "Book")
    var target: BookEntity

    func perform() async throws -> some IntentResult {
        await MainActor.run {
            BookReader.shared.open(book: target)
        }
        return .result()
    }
}
```

### Available Assistant Schemas

- **BooksIntents** - Navigate pages, open books, play audiobooks, search
- **BrowserIntents** - Bookmark tabs, clear history, manage windows
- **CameraIntents** - Capture modes, device switching, start/stop
- **EmailIntents** - Draft management, reply, forward, archive
- **PhotosIntents** - Album/asset management, editing, filtering
- **PresentationsIntents** - Slide creation, media insertion, playback
- **SpreadsheetsIntents** - Sheet management, content addition
- **DocumentsIntents** - File management, page manipulation, search

---

## Testing & Debugging

### Testing with Shortcuts App

1. **Add intent to Shortcuts**:
   - Open Shortcuts app
   - Tap "+" to create new shortcut
   - Search for your app name
   - Select your intent

2. **Test parameter resolution**:
   - Fill in parameters
   - Run shortcut
   - Check Xcode console for logs

3. **Test with Siri**:
   - "Hey Siri, [your intent name]"
   - Siri should prompt for parameters
   - Verify dialog text and results

### Xcode Intent Testing

```swift
// In your app target, not tests
#if DEBUG
extension OrderSoupIntent {
    static func testIntent() async throws {
        let intent = OrderSoupIntent()
        intent.soup = SoupEntity(id: "1", name: "Tomato", price: 8.99)
        intent.quantity = 2

        let result = try await intent.perform()
        print("Result: \(result)")
    }
}
#endif
```

### Common Debugging Issues

**Issue 1: Intent not appearing in Shortcuts**
```swift
// ❌ Problem: isDiscoverable = false or missing
struct MyIntent: AppIntent {
    // Missing isDiscoverable
}

// ✅ Solution: Make discoverable
struct MyIntent: AppIntent {
    static var isDiscoverable: Bool = true
}
```

**Issue 2: Parameter not resolving**
```swift
// ❌ Problem: Missing defaultQuery
struct ProductEntity: AppEntity {
    var id: String
    // Missing defaultQuery
}

// ✅ Solution: Add query
struct ProductEntity: AppEntity {
    var id: String
    static var defaultQuery = ProductQuery()
}
```

**Issue 3: Intent crashes in background**
```swift
// ❌ Problem: Accessing MainActor from background
func perform() async throws -> some IntentResult {
    UIApplication.shared.open(url) // Crash! MainActor only
    return .result()
}

// ✅ Solution: Use MainActor or openAppWhenRun
func perform() async throws -> some IntentResult {
    await MainActor.run {
        UIApplication.shared.open(url)
    }
    return .result()
}
```

**Issue 4: Entity query returns empty results**
```swift
// ❌ Problem: entities(for:) not implemented
struct BookQuery: EntityQuery {
    // Missing entities(for:) implementation
}

// ✅ Solution: Implement required methods
struct BookQuery: EntityQuery {
    func entities(for identifiers: [UUID]) async throws -> [BookEntity] {
        return try await BookService.shared.fetchBooks(ids: identifiers)
    }

    func suggestedEntities() async throws -> [BookEntity] {
        return try await BookService.shared.recentBooks(limit: 10)
    }
}
```

---

## Best Practices

### 1. Intent Naming

**❌ DON'T: Generic or unclear**
```swift
static var title: LocalizedStringResource = "Do Thing"
static var title: LocalizedStringResource = "Process"
```

**✅ DO: Verb-noun, specific**
```swift
static var title: LocalizedStringResource = "Send Message"
static var title: LocalizedStringResource = "Book Appointment"
static var title: LocalizedStringResource = "Start Workout"
```

### 2. Parameter Summary

**❌ DON'T: Technical or confusing**
```swift
static var parameterSummary: some ParameterSummary {
    Summary("Execute \(\.$action) with \(\.$target)")
}
```

**✅ DO: Natural language**
```swift
static var parameterSummary: some ParameterSummary {
    Summary("Send \(\.$message) to \(\.$contact)")
}
// Siri: "Send 'Hello' to John"
```

### 3. Error Messages

**❌ DON'T: Technical jargon**
```swift
throw MyError.validationFailed("Invalid parameter state")
```

**✅ DO: User-friendly**
```swift
throw MyError.outOfStock("Sorry, this item is currently unavailable")
```

### 4. Entity Suggestions

**❌ DON'T: Return all entities**
```swift
func suggestedEntities() async throws -> [TaskEntity] {
    return try await TaskService.shared.allTasks() // Could be thousands!
}
```

**✅ DO: Limit to recent/relevant**
```swift
func suggestedEntities() async throws -> [TaskEntity] {
    return try await TaskService.shared.recentTasks(limit: 10)
}
```

### 5. Async Operations

**❌ DON'T: Block main thread**
```swift
func perform() async throws -> some IntentResult {
    let data = URLSession.shared.synchronousDataTask(url) // Blocks!
    return .result()
}
```

**✅ DO: Use async/await**
```swift
func perform() async throws -> some IntentResult {
    let data = try await URLSession.shared.data(from: url)
    return .result()
}
```

---

## Real-World Examples

### Example 1: Start Workout Intent

```swift
struct StartWorkoutIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Workout"
    static var description: IntentDescription = "Starts a new workout session"
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Workout Type")
    var workoutType: WorkoutType

    @Parameter(title: "Duration (minutes)")
    var duration: Int?

    static var parameterSummary: some ParameterSummary {
        Summary("Start \(\.$workoutType)") {
            \.$duration
        }
    }

    func perform() async throws -> some IntentResult {
        let workout = Workout(
            type: workoutType,
            duration: duration.map { TimeInterval($0 * 60) }
        )

        await MainActor.run {
            WorkoutCoordinator.shared.start(workout)
        }

        return .result(
            dialog: "Starting \(workoutType.displayName) workout"
        )
    }
}

enum WorkoutType: String, AppEnum {
    case running
    case cycling
    case swimming
    case yoga

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Workout Type"
    static var caseDisplayRepresentations: [WorkoutType: DisplayRepresentation] = [
        .running: "Running",
        .cycling: "Cycling",
        .swimming: "Swimming",
        .yoga: "Yoga"
    ]

    var displayName: String {
        switch self {
        case .running: return "running"
        case .cycling: return "cycling"
        case .swimming: return "swimming"
        case .yoga: return "yoga"
        }
    }
}
```

### Example 2: Add Task with Entity Query

```swift
struct AddTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Task"
    static var description: IntentDescription = "Creates a new task"
    static var isDiscoverable: Bool = true

    @Parameter(title: "Title")
    var title: String

    @Parameter(title: "List")
    var list: TaskListEntity?

    @Parameter(title: "Due Date")
    var dueDate: Date?

    static var parameterSummary: some ParameterSummary {
        Summary("Add '\(\.$title)'") {
            \.$list
            \.$dueDate
        }
    }

    func perform() async throws -> some IntentResult {
        let task = try await TaskService.shared.createTask(
            title: title,
            list: list?.id,
            dueDate: dueDate
        )

        return .result(
            value: TaskEntity(from: task),
            dialog: "Task '\(title)' added"
        )
    }
}

struct TaskListEntity: AppEntity {
    var id: UUID
    var name: String
    var color: String

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "List"

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            image: .init(systemName: "list.bullet")
        )
    }

    static var defaultQuery = TaskListQuery()
}

struct TaskListQuery: EntityQuery, EntityStringQuery {
    func entities(for identifiers: [UUID]) async throws -> [TaskListEntity] {
        return try await TaskService.shared.fetchLists(ids: identifiers)
    }

    func suggestedEntities() async throws -> [TaskListEntity] {
        // Provide user's favorite lists
        return try await TaskService.shared.favoriteLists(limit: 5)
    }

    func entities(matching string: String) async throws -> [TaskListEntity] {
        return try await TaskService.shared.searchLists(query: string)
    }
}
```

---

## App Intents Checklist

### Before Submitting to App Store

- ☐ All intents have clear, localized titles and descriptions
- ☐ Parameter summaries use natural language phrasing
- ☐ Error messages are user-friendly, not technical
- ☐ Authentication policies match data sensitivity
- ☐ Entity queries return reasonable suggestion counts (< 20)
- ☐ Intents marked `isDiscoverable` appear in Shortcuts
- ☐ Destructive actions request confirmation
- ☐ Background intents don't access MainActor
- ☐ Foreground intents set `openAppWhenRun = true`
- ☐ Entity `displayRepresentation` shows meaningful info
- ☐ Tested with Siri voice commands
- ☐ Tested in Shortcuts app
- ☐ Tested with different parameter combinations
- ☐ Verified localization for all supported languages

---

## Resources

### Apple Documentation
- [App Intents Framework](https://sosumi.ai/documentation/appintents) - Framework overview
- [AppIntent Protocol](https://sosumi.ai/documentation/appintents/appintent) - Intent definition
- [AppEntity Protocol](https://sosumi.ai/documentation/appintents/appentity) - Entity representation

### WWDC Sessions
- [Get to know App Intents (WWDC 2025)](https://developer.apple.com/videos/play/wwdc2025/244/) - Foundational concepts
- [Explore new advances in App Intents (WWDC 2025)](https://developer.apple.com/videos/play/wwdc2025/275/) - Advanced features
- [Develop for Shortcuts and Spotlight with App Intents (WWDC 2025)](https://developer.apple.com/videos/play/wwdc2025/260/) - Integration patterns

### Sample Code
- [App Intents Sample Apps](https://developer.apple.com/documentation/appintents/making_your_app_s_functionality_available_to_siri) - Complete examples

---

**Remember:** App Intents are how users interact with your app through Siri, Shortcuts, and system features. Well-designed intents feel like a natural extension of your app's functionality and provide value across Apple's ecosystem.
