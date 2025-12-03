---
name: app-intents-ref
description: App Intents for Siri, Apple Intelligence, Shortcuts, Spotlight — AppIntent, AppEntity, parameters, queries, debugging
---

# App Intents Integration Reference

Comprehensive guide to integrating App Intents for Siri, Apple Intelligence, Shortcuts, Spotlight, and system experiences.

## Overview

App Intents framework enables your app to integrate deeply with iOS system features including Siri, Apple Intelligence, Shortcuts, Spotlight, and widgets. This reference covers intent definition, parameter handling, entity queries, and debugging common integration issues.

## What's Covered

### Core Concepts

#### AppIntent Protocol
- Defining user-facing actions
- Parameter types and validation
- Async/await perform methods
- Error handling and user feedback

#### AppEntity Protocol
- Representing app data objects
- Display representations
- Query protocols
- Identity and uniqueness

#### Intent Parameters
- Required vs optional parameters
- Type-safe parameter definitions
- Dynamic options (search, suggest)
- Parameter summaries for Siri

#### Entity Queries
- Finding entities by identifier
- Search suggestions
- Filtering and sorting
- Performance considerations

### Integration Points

#### Siri Integration
- Voice command handling
- Disambiguation prompts
- Confirmation dialogs
- Error messages for voice

#### Apple Intelligence
- Smart suggestions
- Contextual actions
- Proactive recommendations
- System integration

#### Shortcuts App
- Action discovery
- Parameter customization
- Multi-step workflows
- Sharing shortcuts

#### Spotlight Search
- Intent indexing
- Search result actions
- Continue in app patterns
- Deep linking

### Advanced Features

#### Background Execution
- Intent handlers in extensions
- Data sharing with app groups
- Network requests
- State management

#### Authentication
- User authentication flows
- Secure data access
- Error handling for locked device
- Biometric authentication

#### Debugging
- Intent testing in Xcode
- Shortcuts app debugging
- Siri transcript logging
- Console logging best practices

## When to Use This Reference

Use this reference when:
- Adding Siri support to your app
- Integrating with Apple Intelligence
- Creating Shortcuts actions
- Making app content searchable in Spotlight
- Building widgets that perform actions
- Implementing system integration features

## Common Patterns

### Simple Intent

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

### Intent with Entity Query

```swift
struct PlaySongIntent: AppIntent {
    static var title: LocalizedStringResource = "Play Song"

    @Parameter(title: "Song")
    var song: SongEntity

    func perform() async throws -> some IntentResult {
        // Play the song
        return .result()
    }
}

struct SongEntity: AppEntity {
    var id: String
    var title: String

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Song"

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)")
    }
}

struct SongEntityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [SongEntity] {
        // Fetch songs by ID
    }

    func suggestedEntities() async throws -> [SongEntity] {
        // Return popular songs
    }
}
```

### Dynamic Options

```swift
@Parameter(title: "Playlist")
var playlist: PlaylistEntity

func $playlist() async throws -> [PlaylistEntity] {
    // Return user's playlists for Siri disambiguation
}
```

## Integration Checklist

### Siri Setup
- [ ] Add `NSUserActivityTypes` to Info.plist
- [ ] Implement AppIntent protocols
- [ ] Test voice commands with Siri
- [ ] Handle disambiguation gracefully
- [ ] Add error messages for voice feedback

### Shortcuts Setup
- [ ] Define intent metadata
- [ ] Add parameter summaries
- [ ] Test in Shortcuts app
- [ ] Handle background execution
- [ ] Support multi-step workflows

### Spotlight Setup
- [ ] Index intents with CoreSpotlight
- [ ] Provide meaningful titles/descriptions
- [ ] Handle deep links from search results
- [ ] Update index when data changes

### Apple Intelligence
- [ ] Tag intents with appropriate categories
- [ ] Provide contextual metadata
- [ ] Test proactive suggestions
- [ ] Monitor adoption metrics

## Debugging Common Issues

#### Intent Not Appearing in Shortcuts
- Check Info.plist configuration
- Verify intent is public (not internal)
- Rebuild and reinstall app
- Check Shortcuts app after 5-10 minute delay

#### Siri Can't Find Entity
- Implement `suggestedEntities()` correctly
- Check entity query fetch logic
- Verify display representations
- Test with Siri transcript logging

#### Background Execution Fails
- Use app groups for data sharing
- Check background modes in capabilities
- Verify intent handler extension setup
- Test with device, not simulator

#### Authentication Errors
- Handle locked device state
- Provide clear error messages
- Support biometric auth when needed
- Test with device locked

## Related Skills

- [swiftui-26-ref](/reference/swiftui-26-ref) — iOS 26 SwiftUI features including widget improvements

## WWDC 2025 Sessions

- WWDC 2025-260: App Intents Integration
- WWDC 2023: Dive into App Intents
- WWDC 2022: Implement App Shortcuts with App Intents

## Documentation Scope

This is a **reference skill** — comprehensive integration guide without mandatory workflows.

#### Reference includes
- Complete API catalog
- Integration patterns
- Debugging strategies
- Best practices
- Real-world examples

## Size

30 KB - Comprehensive App Intents integration reference
