# App Intents Integration

Comprehensive guide to App Intents framework for integrating your app with Siri, Apple Intelligence, Shortcuts, Spotlight, and other system experiences.

## When to Use

- Exposing app functionality to Siri and Apple Intelligence
- Making app actions available in Shortcuts app
- Enabling Spotlight search for app content
- Integrating with Focus filters, widgets, Live Activities
- Adding Action button support (Apple Watch Ultra)
- Debugging intent resolution or parameter validation failures
- Testing intents with Shortcuts app
- Implementing entity queries for app content
- **NEW:** Passing entities to Apple Intelligence models for reasoning
- **NEW:** Reducing boilerplate with IndexedEntity
- **NEW:** Running intents from Spotlight on Mac
- **NEW:** Creating automated workflows with Automations on Mac

## What It Covers

### Three Building Blocks

**1. AppIntent** — Executable actions with parameters
- Define perform() method for action logic
- Parameter validation and natural language summaries
- Background vs foreground execution
- Authentication policies
- Error handling and confirmation dialogs

**2. AppEntity** — Objects users interact with
- Entity identification and display representation
- Entity queries for content discovery
- Spotlight indexing integration
- Separating entities from core data models
- **NEW:** JSON representation for Apple Intelligence models
- **NEW:** IndexedEntity automatic Find actions

**3. AppEnum** — Enumeration types for parameters
- Case display representations
- Type display names
- Natural language phrasing

### System Experiences

App Intents integrate with:
- Siri voice commands and Apple Intelligence
- Shortcuts automation workflows
- Spotlight search discovery (macOS Sequoia+)
- Focus filters
- Action button (Apple Watch Ultra)
- Control Center shortcuts
- WidgetKit interactive widgets
- Live Activities
- Visual Intelligence
- **NEW:** Automations on Mac (folder, external drive, time, Bluetooth)

### Apple Intelligence Integration

**Use Model Action:**
- Pass app entities to language models for filtering and reasoning
- Three output types: Text (AttributedString), Dictionary, App Entities
- Automatic type conversion (e.g., Boolean for If actions)
- Follow-up feature for iterative refinement

**AttributedString Support:**
- Preserve Rich Text formatting from AI models (bold, italic, lists, tables)
- Lossless transfer from model to your app
- Real example: Bear app diary templates with mood logging tables

**Entity JSON Representation:**
Models receive structured data including:
- All @Property values (converted to strings)
- Type display representation
- Display representation (title, subtitle)

### IndexedEntity Protocol

**Dramatic Boilerplate Reduction:**
- Auto-generate Find actions from Spotlight integration
- Map properties to Spotlight attribute keys
- Automatic search and filtering support
- Eliminates manual EntityQuery/EntityPropertyQuery implementation

**Example:**
```swift
struct EventEntity: AppEntity, IndexedEntity {
    @Property(title: "Title", indexingKey: \.eventTitle)
    var title: String

    @Property(title: "Notes", customIndexingKey: "eventNotes")
    var notes: String?

    // Auto-generates Find Events action in Shortcuts!
}
```

### Spotlight on Mac

**Run Intents Directly from Spotlight:**
- Parameter summary must include all required parameters
- Provide suggestions for quick parameter filling
- On-screen content tagging with appEntityIdentifier
- Background/foreground intent pairing with opensIntent
- PredictableIntent for usage-based suggestions

**Visibility Requirements:**
- All required params in parameter summary (or make optional/provide defaults)
- Not hidden via isDiscoverable = false or assistantOnly = true
- Must have perform() method (widget config-only intents excluded)

### Automations on Mac

**Personal Automations Arrive on Mac:**
- Folder automation - trigger when files added/removed
- External drive automation - trigger on connect/disconnect
- Time of Day, Bluetooth, and more from iOS

**Automatic Availability:**
As long as your intent is available on macOS, they will also be available to use in Shortcuts to run as a part of Automations on Mac. This includes iOS apps that are installable on macOS.

### Parameter Handling

- Required vs optional parameters
- Parameter summaries for natural phrasing
- RequestValueDialog for disambiguation
- Validation and error messages
- **NEW:** AttributedString for Rich Text from AI models

### Entity Queries

- EntityQuery protocol implementation
- entities(for:) for ID-based lookup
- suggestedEntities() for recommendations
- EntityStringQuery for search
- **NEW:** IndexedEntity for automatic Find actions

### Testing & Debugging

- Testing with Shortcuts app
- Xcode intent testing
- Siri voice command testing
- **NEW:** Testing in Spotlight on Mac
- **NEW:** Testing automations with folder/drive triggers
- Common issues:
  - Intent not appearing in Shortcuts
  - Parameter not resolving
  - Crashes in background execution
  - Empty entity query results
  - **NEW:** Intent not showing in Spotlight (missing param in summary)
  - **NEW:** Rich Text lost (using String instead of AttributedString)

## Key Features

- **Assistant Schemas** — Pre-built intents for Books, Browser, Camera, Email, Photos, Presentations, Spreadsheets, Documents
- **Authentication Policies** — alwaysAllowed, requiresAuthentication, requiresLocalDeviceAuthentication
- **Confirmation Dialogs** — Request user confirmation before destructive actions
- **Real-World Examples** — Start Workout, Add Task with entity queries
- **Best Practices** — Naming conventions, error messages, entity suggestions
- **App Store Checklist** — Preparation checklist before submission

## Requirements

iOS 16+

## Resources

### Apple Documentation
- [App Intents Framework](https://developer.apple.com/documentation/appintents)
- [AppIntent Protocol](https://developer.apple.com/documentation/appintents/appintent)
- [AppEntity Protocol](https://developer.apple.com/documentation/appintents/appentity)

### WWDC Sessions
- [Get to know App Intents (WWDC 2025)](https://developer.apple.com/videos/play/wwdc2025/244/)
- [Explore new advances in App Intents (WWDC 2025)](https://developer.apple.com/videos/play/wwdc2025/275/)
- **[Develop for Shortcuts and Spotlight (WWDC 2025)](https://developer.apple.com/videos/play/wwdc2025/260/)** — Use Model action, IndexedEntity, Spotlight on Mac, Automations

## Example Patterns

### Simple Intent
```swift
struct OrderSoupIntent: AppIntent {
    static var title: LocalizedStringResource = "Order Soup"

    @Parameter(title: "Soup")
    var soup: SoupEntity

    @Parameter(title: "Quantity")
    var quantity: Int?

    func perform() async throws -> some IntentResult {
        guard let quantity = quantity, quantity < 10 else {
            throw $quantity.needsValue
        }
        soup.order(quantity: quantity)
        return .result()
    }
}
```

### Entity with Query
```swift
struct BookEntity: AppEntity {
    var id: UUID
    var title: String
    var author: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(title)",
            subtitle: "by \(author)"
        )
    }

    static var defaultQuery = BookQuery()
}

struct BookQuery: EntityQuery {
    func entities(for identifiers: [UUID]) async throws -> [BookEntity] {
        return try await BookService.shared.fetchBooks(ids: identifiers)
    }

    func suggestedEntities() async throws -> [BookEntity] {
        return try await BookService.shared.recentBooks(limit: 10)
    }
}
```

## See Also

- **[Apple Intelligence & Integration Category](/skills/integration/)** — All integration-related skills
