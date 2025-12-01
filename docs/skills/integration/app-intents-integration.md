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

## What It Covers

### Three Building Blocks

**1. AppIntent** - Executable actions with parameters
- Define perform() method for action logic
- Parameter validation and natural language summaries
- Background vs foreground execution
- Authentication policies
- Error handling and confirmation dialogs

**2. AppEntity** - Objects users interact with
- Entity identification and display representation
- Entity queries for content discovery
- Spotlight indexing integration
- Separating entities from core data models

**3. AppEnum** - Enumeration types for parameters
- Case display representations
- Type display names
- Natural language phrasing

### System Experiences

App Intents integrate with:
- Siri voice commands and Apple Intelligence
- Shortcuts automation workflows
- Spotlight search discovery
- Focus filters
- Action button (Apple Watch Ultra)
- Control Center shortcuts
- WidgetKit interactive widgets
- Live Activities
- Visual Intelligence

### Parameter Handling

- Required vs optional parameters
- Parameter summaries for natural phrasing
- RequestValueDialog for disambiguation
- Validation and error messages

### Entity Queries

- EntityQuery protocol implementation
- entities(for:) for ID-based lookup
- suggestedEntities() for recommendations
- EntityStringQuery for search

### Testing & Debugging

- Testing with Shortcuts app
- Xcode intent testing
- Siri voice command testing
- Common issues:
  - Intent not appearing in Shortcuts
  - Parameter not resolving
  - Crashes in background execution
  - Empty entity query results

## Key Features

- **Assistant Schemas** - Pre-built intents for Books, Browser, Camera, Email, Photos, Presentations, Spreadsheets, Documents
- **Authentication Policies** - alwaysAllowed, requiresAuthentication, requiresLocalDeviceAuthentication
- **Confirmation Dialogs** - Request user confirmation before destructive actions
- **Real-World Examples** - Start Workout, Add Task with entity queries
- **Best Practices** - Naming conventions, error messages, entity suggestions
- **App Store Checklist** - Preparation checklist before submission

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
- [Develop for Shortcuts and Spotlight (WWDC 2025)](https://developer.apple.com/videos/play/wwdc2025/260/)

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

- **[Apple Intelligence & Integration Category](/skills/integration/)** - All integration-related skills
