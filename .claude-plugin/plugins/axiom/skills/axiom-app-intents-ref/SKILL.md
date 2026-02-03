---
name: axiom-app-intents-ref
description: Use when integrating App Intents for Siri, Apple Intelligence, Shortcuts, Spotlight, or system experiences - covers AppIntent, AppEntity, parameter handling, entity queries, background execution, authentication, and debugging common integration issues for iOS 16+
license: MIT
metadata:
  version: "1.0.0"
---

# App Intents Integration

## Overview

Comprehensive guide to App Intents framework for exposing app functionality to Siri, Apple Intelligence, Shortcuts, Spotlight, and other system experiences. Replaces older SiriKit custom intents with modern Swift-first API.

**Core principle** App Intents make your app's actions discoverable across Apple's ecosystem. Well-designed intents feel natural in Siri conversations, Shortcuts automation, and Spotlight search.

## When to Use This Skill

- Exposing app functionality to Siri and Apple Intelligence
- Making app actions available in Shortcuts app
- Enabling Spotlight search for app content
- Integrating with Focus filters, widgets, Live Activities
- Adding Action button support (Apple Watch Ultra)
- Debugging intent resolution or parameter validation failures
- Testing intents with Shortcuts app
- Implementing entity queries for app content

## Related Skills

- **app-shortcuts-ref** — App Shortcuts for instant Siri/Spotlight availability without user setup
- **core-spotlight-ref** — Core Spotlight and NSUserActivity integration for content indexing
- **app-discoverability** — Strategic guide for making apps surface system-wide across all APIs

## System Experiences Supported

App Intents integrate with:
- **Siri** — Voice commands and Apple Intelligence
- **Shortcuts** — Automation workflows
- **App Shortcuts** — Pre-configured actions available instantly (see app-shortcuts-ref)
- **Spotlight** — Search discovery
- **Focus Filters** — Contextual filtering
- **Action Button** — Quick actions (Apple Watch Ultra)
- **Control Center** — Custom controls
- **WidgetKit** — Interactive widgets
- **Live Activities** — Dynamic Island updates
- **Visual Intelligence** — Image-based interactions

## Core Concepts

### The Three Building Blocks

**1. AppIntent** — Executable actions with parameters
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

**2. AppEntity** — Objects users interact with
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

**3. AppEnum** — Enumeration types for parameters
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

#### ❌ DON'T: Modify core data models
```swift
// DON'T make your model conform to AppEntity
struct Book: AppEntity { // Bad - couples model to intents
    var id: UUID
    var title: String
    // ...
}
```

#### ✅ DO: Create dedicated entities
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

## Apple Intelligence: Use Model Action

### Overview

The **Use Model action** in Shortcuts (iOS 18.1+) allows users to incorporate Apple Intelligence models into their automation workflows. Your app's entities can be passed to language models for filtering, transformation, and reasoning.

**Key capability** Under the hood, the action passes a JSON representation of your entity to the model, so you'll want to make sure to expose any information you want it to be able to reason over, in the entity definition.

### Three Output Types

#### 1. Text (AttributedString)
- Models often respond with Rich Text (bold, italic, lists, tables)
- Use `AttributedString` type for text parameters to preserve formatting
- Enables lossless transfer from model to your app

#### 2. Dictionary
- Structured data extraction from unstructured input
- Useful for parsing PDFs, emails, documents
- Example: Extract vendor, amount, date from invoice

#### 3. App Entities (Your Types)
- Pass lists of entities to models for filtering/reasoning
- Model receives JSON representation of entities
- Example: "Filter calendar events related to my trip"

### Exposing Entities to Models

Models receive a JSON representation of your entities including:

**1. All exposed properties** (converted to strings)
```swift
struct EventEntity: AppEntity {
    var id: UUID

    @Property(title: "Title")
    var title: String

    @Property(title: "Start Date")
    var startDate: Date

    @Property(title: "End Date")
    var endDate: Date

    @Property(title: "Notes")
    var notes: String?

    // All @Property values included in JSON for model
}
```

**2. Type display representation** (hints what entity represents)
```swift
static var typeDisplayRepresentation: TypeDisplayRepresentation = "Calendar Event"
```

**3. Display representation** (title and subtitle)
```swift
var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(
        title: "\(title)",
        subtitle: "\(startDate.formatted())"
    )
}
```

#### Example JSON sent to model
```json
{
  "type": "Calendar Event",
  "title": "Team Meeting",
  "subtitle": "Jan 15, 2025 at 2:00 PM",
  "properties": {
    "Title": "Team Meeting",
    "Start Date": "2025-01-15T14:00:00Z",
    "End Date": "2025-01-15T15:00:00Z",
    "Notes": "Discuss Q1 roadmap"
  }
}
```

### Supporting Rich Text with AttributedString

**Why it matters** If your app supports Rich Text content, now is the time to make sure your app intents use the attributed string type for text parameters where appropriate.

#### ❌ DON'T: Use plain String
```swift
struct CreateNoteIntent: AppIntent {
    @Parameter(title: "Content")
    var content: String // Loses formatting from model
}
```

#### ✅ DO: Use AttributedString
```swift
struct CreateNoteIntent: AppIntent {
    @Parameter(title: "Content")
    var content: AttributedString // Preserves Rich Text

    func perform() async throws -> some IntentResult {
        let note = Note(content: content) // Rich Text preserved
        try await NoteService.shared.save(note)
        return .result()
    }
}
```

#### Real-world example from WWDC
Bear app's Create Note accepts AttributedString, allowing diary templates from ChatGPT to include:
- Bold headings
- Mood logging tables
- Formatted lists
- All preserved losslessly

### Automatic Type Conversion

When Use Model output connects to another action, the runtime automatically converts types:

#### Example: Boolean for If actions
```swift
// User's shortcut:
// 1. Get notes created today
// 2. For each note:
//    - Use Model: "Is this note related to developing features for Shortcuts?"
//    - If [model output] = yes:
//      - Add to Shortcuts Projects folder
```

Instead of returning verbose text like "Yes, this note seems to be about developing features for the Shortcuts app", the model automatically returns a Boolean (`true`/`false`) when connected to an If action.

#### Explicit output types available
- Text (AttributedString)
- Number
- Boolean
- Dictionary
- Date
- App Entities

### Follow-Up Feature

Enable iterative refinement before passing to next action:

```swift
// User runs shortcut:
// 1. Get recipe from Safari
// 2. Use Model: "Extract ingredients list"
//    - Follow Up: enabled
//    - User types: "Double the recipe"
//    - Model adjusts: 800g flour instead of 400g
// 3. Add to Grocery List in Things app
```

#### When to use
- Recipe modifications (scale servings, substitute ingredients)
- Content refinement (adjust tone, length, style)
- Data validation (confirm extracted values before saving)

---

## IndexedEntity: Automatic Find Actions

### Overview

**IndexedEntity** dramatically reduces boilerplate by auto-generating Find actions from your Spotlight integration. Instead of manually implementing `EntityQuery` and `EntityPropertyQuery`, adopt IndexedEntity to get:

- Automatic Find action in Shortcuts
- Property-based filtering
- Search support
- Minimal code required

### Basic Implementation

```swift
struct EventEntity: AppEntity, IndexedEntity {
    var id: UUID

    // 1. Properties with indexing keys
    @Property(title: "Title", indexingKey: \.eventTitle)
    var title: String

    @Property(title: "Start Date", indexingKey: \.startDate)
    var startDate: Date

    @Property(title: "End Date", indexingKey: \.endDate)
    var endDate: Date

    // 2. Custom key for properties without standard Spotlight attribute
    @Property(title: "Notes", customIndexingKey: "eventNotes")
    var notes: String?

    // Display representation automatically maps to Spotlight
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(title)",
            subtitle: "\(startDate.formatted())"
            // title → kMDItemTitle
            // subtitle → kMDItemDescription
            // image → kMDItemContentType (if provided)
        )
    }

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Event"
}
```

### Indexing Key Mapping

#### Standard Spotlight attribute keys
```swift
// Common Spotlight keys for events
@Property(title: "Title", indexingKey: \.eventTitle)
var title: String

@Property(title: "Start Date", indexingKey: \.startDate)
var startDate: Date

@Property(title: "Location", indexingKey: \.eventLocation)
var location: String?
```

#### Custom keys for non-standard attributes
```swift
@Property(title: "Notes", customIndexingKey: "eventNotes")
var notes: String?

@Property(title: "Attendee Count", customIndexingKey: "attendeeCount")
var attendeeCount: Int
```

### Auto-Generated Find Action

With IndexedEntity conformance, users get this Find action automatically:

#### In Shortcuts app
```
Find Events where:
  - Title contains "Team"
  - Start Date is today
  - Location is "San Francisco"
```

#### Without IndexedEntity, you'd need to manually implement
- `EnumerableEntityQuery` protocol
- `EntityPropertyQuery` protocol
- Property filters for each searchable field
- Search/suggestion logic

**With IndexedEntity** Just add indexing keys, done!

### Search Support

Enable string-based search by implementing `EntityStringQuery`:

```swift
extension EventEntityQuery: EntityStringQuery {
    func entities(matching string: String) async throws -> [EventEntity] {
        return try await EventService.shared.search(query: string)
    }
}
```

Or rely on IndexedEntity + Spotlight for automatic search.

### Example: Travel Tracking App

Apple's sample code (App Intents Travel Tracking App) demonstrates IndexedEntity:

```swift
struct TripEntity: AppEntity, IndexedEntity {
    var id: UUID

    @Property(title: "Name", indexingKey: \.title)
    var name: String

    @Property(title: "Start Date", indexingKey: \.startDate)
    var startDate: Date

    @Property(title: "End Date", indexingKey: \.endDate)
    var endDate: Date

    @Property(title: "Destination", customIndexingKey: "destination")
    var destination: String

    // Auto-generated Find Trips action with filters for all properties
}
```

---

## Spotlight on Mac

### Overview

**Spotlight on Mac** (macOS Sequoia+) allows users to run your app's intents directly from system search. Intents that work in Shortcuts automatically work in Spotlight with proper configuration.

**Key principle** Spotlight is all about running things quickly. To do that, people need to be able to provide all the information your intent needs to run directly in Spotlight.

### Requirements for Spotlight Visibility

#### 1. Parameter Summary Must Include All Required Parameters

The parameter summary, which is what people will see in Spotlight UI, must contain all required parameters that don't have a default value.

#### ❌ WON'T SHOW in Spotlight
```swift
struct CreateEventIntent: AppIntent {
    static var title: LocalizedStringResource = "Create Event"

    @Parameter(title: "Title")
    var title: String

    @Parameter(title: "Start Date")
    var startDate: Date

    @Parameter(title: "End Date")
    var endDate: Date

    @Parameter(title: "Notes") // Required, no default
    var notes: String

    static var parameterSummary: some ParameterSummary {
        Summary("Create '\(\.$title)' from \(\.$startDate) to \(\.$endDate)")
        // Missing 'notes' parameter!
    }
}
```

#### ✅ WILL SHOW in Spotlight (Option 1: Make optional)
```swift
@Parameter(title: "Notes")
var notes: String? // Optional - can omit from summary
```

#### ✅ WILL SHOW in Spotlight (Option 2: Provide default)
```swift
@Parameter(title: "Notes")
var notes: String = "" // Has default - can omit from summary
```

#### ✅ WILL SHOW in Spotlight (Option 3: Include in summary)
```swift
static var parameterSummary: some ParameterSummary {
    Summary("Create '\(\.$title)' from \(\.$startDate) to \(\.$endDate)") {
        \.$notes // All required params included
    }
}
```

#### 2. Intent Must Not Be Hidden

Intents hidden from Shortcuts won't appear in Spotlight:

```swift
// ❌ Hidden from Spotlight
static var isDiscoverable: Bool = false

// ❌ Hidden from Spotlight
static var assistantOnly: Bool = true

// ❌ Hidden from Spotlight
// Intent with no perform() method (widget configuration only)
```

### Providing Suggestions

Make parameter filling quick with suggestions:

#### Option 1: Suggested Entities (Subset of Large List)
```swift
struct EventEntityQuery: EntityQuery {
    func entities(for identifiers: [UUID]) async throws -> [EventEntity] {
        return try await EventService.shared.fetchEvents(ids: identifiers)
    }

    // Provide upcoming events, not all past/present events
    func suggestedEntities() async throws -> [EventEntity] {
        return try await EventService.shared.upcomingEvents(limit: 10)
    }
}
```

#### Option 2: All Entities (Small, Bounded List)
```swift
struct TimezoneQuery: EnumerableEntityQuery {
    func allEntities() async throws -> [TimezoneEntity] {
        // Small list - provide all
        return TimezoneEntity.allTimezones
    }
}
```

**Use suggested entities when** List is large or unbounded (calendar events, notes, contacts)
**Use all entities when** List is small and bounded (timezones, priority levels, categories)

### On-Screen Content Tagging

Suggest currently active content:

```swift
// In your detail view controller
func showEventDetail(_ event: Event) {
    let activity = NSUserActivity(activityType: "com.myapp.viewEvent")
    activity.persistentIdentifier = event.id.uuidString

    // Spotlight suggests this event for parameters
    activity.appEntityIdentifier = event.id.uuidString

    userActivity = activity
}
```

For more details on on-screen content tagging, see the "Exploring New Advances in App Intents" session.

### Search Beyond Suggestions

**Basic filtering** (automatic):
If you provide suggestions, Spotlight automatically filters them as user types.

**Deep search** (requires implementation):
For searching beyond suggestions:

#### Option 1: EntityStringQuery
```swift
extension EventQuery: EntityStringQuery {
    func entities(matching string: String) async throws -> [EventEntity] {
        return try await EventService.shared.search(query: string)
    }
}
```

#### Option 2: IndexedEntity
```swift
struct EventEntity: AppEntity, IndexedEntity {
    // Spotlight search automatically supported
}
```

### Background vs Foreground Intents

#### Pattern: Paired Intents with opensIntent

```swift
// Background intent - runs without opening app
struct CreateEventIntent: AppIntent {
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Title")
    var title: String

    @Parameter(title: "Start Date")
    var startDate: Date

    func perform() async throws -> some IntentResult {
        let event = try await EventService.shared.createEvent(
            title: title,
            startDate: startDate
        )

        // Optionally open app to view created event
        return .result(
            value: EventEntity(from: event),
            opensIntent: OpenEventIntent(event: EventEntity(from: event))
        )
    }
}

// Foreground intent - opens app to specific event
struct OpenEventIntent: AppIntent {
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Event")
    var event: EventEntity

    func perform() async throws -> some IntentResult {
        await MainActor.run {
            EventCoordinator.shared.showEvent(id: event.id)
        }
        return .result()
    }
}
```

#### User experience
1. User runs "Create Event" in Spotlight (background)
2. Event created without opening app
3. Spotlight shows "Open in App" button (opensIntent)
4. User taps button → App opens to event detail

### Predictable Intent Protocol

Enable Spotlight suggestions based on usage patterns:

```swift
struct OrderCoffeeIntent: AppIntent, PredictableIntent {
    static var title: LocalizedStringResource = "Order Coffee"

    @Parameter(title: "Coffee Type")
    var coffeeType: CoffeeType

    @Parameter(title: "Size")
    var size: CoffeeSize

    func perform() async throws -> some IntentResult {
        // Order logic
        return .result()
    }
}
```

Spotlight learns when/how user runs this intent and surfaces suggestions proactively.

---

## Automations on Mac

### Overview

**Personal Automations** arrive on macOS (macOS Sequoia+) with Mac-specific triggers:

#### New Mac Automation Types
- **Folder Automation** — Trigger when files added/removed from folder
- **External Drive Automation** — Trigger when drive connected/disconnected
- Time of Day (from iOS)
- Bluetooth (from iOS)
- And more...

**Example use case** Invoice processing shortcut runs automatically every time a new invoice is added to ~/Documents/Invoices folder.

### Automatic Availability

As long as your intent is available on macOS, they will also be available to use in Shortcuts to run as a part of Automations on Mac. This includes iOS apps that are installable on macOS.

**No additional code required** — your existing intents work in automations automatically.

### Platform Support

```swift
struct ProcessInvoiceIntent: AppIntent {
    static var title: LocalizedStringResource = "Process Invoice"

    // Available on macOS automatically
    // Also works: iOS apps installed on Mac (Catalyst, Mac Catalyst)

    @Parameter(title: "Invoice")
    var invoice: FileEntity

    func perform() async throws -> some IntentResult {
        // Extract data, add to spreadsheet, etc.
        return .result()
    }
}
```

### Additional System Integration Points

With automations, your intents are now accessible from:
- **Siri** — Voice commands
- **Shortcuts app** — Manual workflows
- **Spotlight** — Quick actions
- **Automations** — Triggered workflows
- **Action Button** — Hardware trigger (Apple Watch Ultra)
- **Control Center** — Quick controls
- **Widgets** — Interactive elements
- **Live Activities** — Dynamic Island

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

- **BooksIntents** — Navigate pages, open books, play audiobooks, search
- **BrowserIntents** — Bookmark tabs, clear history, manage windows
- **CameraIntents** — Capture modes, device switching, start/stop
- **EmailIntents** — Draft management, reply, forward, archive
- **PhotosIntents** — Album/asset management, editing, filtering
- **PresentationsIntents** — Slide creation, media insertion, playback
- **SpreadsheetsIntents** — Sheet management, content addition
- **DocumentsIntents** — File management, page manipulation, search

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

#### Issue 1: Intent not appearing in Shortcuts
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

#### Issue 2: Parameter not resolving
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

#### Issue 3: Intent crashes in background
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

#### Issue 4: Entity query returns empty results
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

#### ❌ DON'T: Generic or unclear
```swift
static var title: LocalizedStringResource = "Do Thing"
static var title: LocalizedStringResource = "Process"
```

#### ✅ DO: Verb-noun, specific
```swift
static var title: LocalizedStringResource = "Send Message"
static var title: LocalizedStringResource = "Book Appointment"
static var title: LocalizedStringResource = "Start Workout"
```

### 2. Parameter Summary

#### ❌ DON'T: Technical or confusing
```swift
static var parameterSummary: some ParameterSummary {
    Summary("Execute \(\.$action) with \(\.$target)")
}
```

#### ✅ DO: Natural language
```swift
static var parameterSummary: some ParameterSummary {
    Summary("Send \(\.$message) to \(\.$contact)")
}
// Siri: "Send 'Hello' to John"
```

### 3. Error Messages

#### ❌ DON'T: Technical jargon
```swift
throw MyError.validationFailed("Invalid parameter state")
```

#### ✅ DO: User-friendly
```swift
throw MyError.outOfStock("Sorry, this item is currently unavailable")
```

### 4. Entity Suggestions

#### ❌ DON'T: Return all entities
```swift
func suggestedEntities() async throws -> [TaskEntity] {
    return try await TaskService.shared.allTasks() // Could be thousands!
}
```

#### ✅ DO: Limit to recent/relevant
```swift
func suggestedEntities() async throws -> [TaskEntity] {
    return try await TaskService.shared.recentTasks(limit: 10)
}
```

### 5. Async Operations

#### ❌ DON'T: Block main thread
```swift
func perform() async throws -> some IntentResult {
    let data = URLSession.shared.synchronousDataTask(url) // Blocks!
    return .result()
}
```

#### ✅ DO: Use async/await
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

**WWDC**: 244, 275, 260

**Docs**: /appintents, /appintents/appintent, /appintents/appentity

**Skills**: axiom-app-shortcuts-ref, axiom-core-spotlight-ref, axiom-app-discoverability

---

**Remember** App Intents are how users interact with your app through Siri, Shortcuts, and system features. Well-designed intents feel like a natural extension of your app's functionality and provide value across Apple's ecosystem.
