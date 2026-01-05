---
name: app-intents-ref
description: App Intents for Siri, Apple Intelligence, Shortcuts, Spotlight integration
---

# App Intents Reference

Complete API reference for App Intents framework. Covers AppIntent protocol, AppEntity, parameter handling, entity queries, and integration with Siri, Apple Intelligence, Shortcuts, and Spotlight.

## When to Use This Reference

Use this reference when you need:
- AppIntent and AppEntity protocol implementation
- Parameter types and validation patterns
- Entity queries for Siri disambiguation
- Siri voice command integration
- Shortcuts app action creation
- Spotlight search indexing
- Apple Intelligence integration

**For quick start:** Define an AppIntent, add parameters, implement perform().

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I create an AppIntent for Siri?"
- "How do I implement an AppEntity with queries?"
- "How do I add dynamic options for Siri disambiguation?"
- "Why isn't my intent showing up in Shortcuts?"
- "How do I handle authentication in App Intents?"
- "How do I index my intents for Spotlight search?"

## What's Covered

### Core Protocols
- AppIntent definition and perform()
- AppEntity with display representations
- EntityQuery for finding entities
- Parameter types and validation

### Siri Integration
- Voice command handling
- Disambiguation prompts
- Confirmation dialogs
- Error messages for voice

### Apple Intelligence
- Smart suggestions
- Contextual actions
- Proactive recommendations
- System integration

### Shortcuts App
- Action discovery
- Parameter customization
- Multi-step workflows
- Background execution

### Spotlight Search
- Intent indexing
- Search result actions
- Deep linking patterns

### Debugging
- Intent testing in Xcode
- Shortcuts app debugging
- Siri transcript logging

## Key Pattern

### Simple AppIntent

```swift
struct OrderCoffeeIntent: AppIntent {
    static var title: LocalizedStringResource = "Order Coffee"

    @Parameter(title: "Coffee Type")
    var coffeeType: CoffeeType

    func perform() async throws -> some IntentResult {
        // Order coffee
        return .result()
    }
}
```

### AppEntity with Query

```swift
struct SongEntity: AppEntity {
    var id: String
    var title: String

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Song"

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)")
    }

    static var defaultQuery = SongEntityQuery()
}

struct SongEntityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [SongEntity] {
        // Fetch songs by ID
    }

    func suggestedEntities() async throws -> [SongEntity] {
        // Return popular songs for Siri
    }
}
```

## Documentation Scope

This page documents the `axiom-app-intents-ref` reference skill—complete API coverage Claude uses when you need specific App Intents APIs or integration patterns.

**For troubleshooting:** Check Info.plist, rebuild app, wait 5-10 minutes for Shortcuts discovery.

## Related

- [swiftui-26-ref](/reference/swiftui-26-ref) — iOS 26 SwiftUI features
- [extensions-widgets](/skills/integration/extensions-widgets) — Widget development

## Resources

**WWDC**: 2025-260 (App Intents), 2023-10103 (Dive into App Intents), 2022-10170 (App Shortcuts)

**Docs**: /appintents, /appintents/appintent, /appintents/appentity
