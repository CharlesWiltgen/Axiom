---
name: app-intents-ref
description: App Intents for Siri, Apple Intelligence, Shortcuts, Spotlight integration
---

# App Intents Reference

API reference for the App Intents framework, which exposes your app's actions and content to Siri, Apple Intelligence, Shortcuts, Spotlight, and Visual Intelligence. It covers intents, entities, queries, app schemas, and automated intent tests.

## When to Use This Reference

Use this reference when you need:
- To implement the `AppIntent` and `AppEntity` protocols
- Parameter types and validation patterns
- Entity queries for Siri disambiguation
- Siri voice command integration
- Actions in the Shortcuts app
- Your app's content and actions in Spotlight search
- Apple Intelligence integration through app schemas or the Use Model action
- Automated tests that run your intents through the system (iOS 27)

**For a quick start:** define an `AppIntent`, add parameters, and implement `perform()`.

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "How do I create an AppIntent for Siri?"
- "How do I implement an AppEntity with queries?"
- "How do I add dynamic options for Siri disambiguation?"
- "Why isn't my intent showing up in Shortcuts?"
- "How do I handle authentication in App Intents?"
- "How do I index my intents for Spotlight search?"
- "How do I adopt an app schema so Siri can drive my app?"
- "How do I let Siri act on a row in my list, like 'open the third one'?"
- "How can my edit intent tell a cleared field from one the person didn't mention?"
- "How do I write automated tests for my App Intents?"
- "Why does my App Intents test say the intent doesn't exist?"
- "How do I give my intent access to my app's database?"
- "How do I keep an intent running longer than 30 seconds in the background?"
- "How can my entity query read another parameter of the intent?"

## What's Covered

### Core Building Blocks
- `AppIntent`: `title`, `description`, `isDiscoverable`, `@Parameter`, parameter summaries, `perform()`, errors
- Dependencies: `@Dependency`, `AppDependencyManager`, `@Dependency(default:)`
- Undo: `UndoableIntent` (iOS 26+)
- Optional parameters in update intents: `valueState` (iOS 18.2+)
- `AppEntity`: display representations, exposed properties, `@ComputedProperty`, `@DeferredProperty`, and the property `description:` and `visibility:` arguments (27.3)
- `AppEnum`
- `EntityQuery` and `EntityStringQuery`; keeping entities separate from your data models
- `IntentParameterDependency` for queries that read the intent's other parameters
- Cross-device identity: `SyncableEntity` and `SyncableEntityIdentifier` (iOS 27+)
- Bulk deletes with `DeleteIntent.target` and `EntityCollection` (27.3)

### Execution and Interaction
- Intent modes: `supportedModes` (iOS 26+), which replaces the deprecated `openAppWhenRun`, and `continueInForeground`
- Long-running work: `LongRunningIntent`, `performBackgroundTask`, `LongRunningTaskOptions` (iOS 27+)
- Cancellation: `CancellableIntent`, `IntentCancellationReason` (iOS 26.4+)
- Execution targets: `allowedExecutionTargets`, `IntentExecutionTargets` (iOS 27+)
- Confirmation dialogs and multiple choice (`requestChoice`, iOS 26+)
- Interactive snippets (`SnippetIntent`, iOS 26+)
- `AppIntentsPackage` for intents in Swift packages

### Authentication and Security
- `IntentAuthenticationPolicy` (iOS 16+)
- Schema-inherited policies and risk-based confirmations (iOS 27+)

### App Schemas
- `@AppEntity`, `@AppIntent`, and `@AppEnum(schema:)` macros, which replace the deprecated `@Assistant…` macros
- System schema domains, grouped by Apple's three tiers: primary domains for Apple Intelligence and Siri (the 27 cycle adds Audio, Calendar, Clock, Maps, Messages, Notes, Phone, and Reminders, and 27.3 adds Video), single-purpose domains (Visual Intelligence, Assistant), and Shortcuts-specific domains such as Books, Files, and Spreadsheet
- Xcode schema-completeness build errors with fix-its (iOS 27)
- Xcode code snippets (`calendar_event`, `system_open`) that scaffold a whole schema conformance
- Cross-app content: on-screen annotations and `Transferable` export
- On-screen entities in SwiftUI: `userActivity` for one item, `appEntityIdentifier` (iOS 18.4+) per view or list row

### Apple Intelligence
- The Use Model action in Shortcuts (iOS 18.1+)
- Exposing entities to models, `AttributedString` output, automatic type conversion, Follow-Up

### Spotlight and the Mac
- `IndexedEntity` and its auto-generated Find action
- Spotlight on Mac: parameter-summary requirements, suggestions, on-screen content tagging, `PredictableIntent`
- Automations on Mac (folder and external-drive triggers)

### Visual Intelligence
- `IntentValueQuery` and `SemanticContentDescriptor`
- On-screen entities (`NSUserActivity.appEntityIdentifier`)

### Testing (iOS 27)
- AppIntentsTesting: `IntentDefinitions`, `makeIntent`, `run()`, `ResolvedIntentResult`
- Why the tests must live in a UI Testing Bundle
- Passing strings, enums, entities, transient entities, and your own wrapper types as parameters
- Which entity properties a test can read
- Spotlight (`spotlightQuery`), on-screen annotations (`viewAnnotations`), and `Transferable` round trips
- Error reference: wrong bundle type, stale intent metadata, misspelled parameters, the 30-second timeout
- Running the tests with Swift Testing instead of XCTest, which UI test targets allow from Xcode 27.3

### Debugging
- Testing by hand in Shortcuts and Siri
- Common issues: an intent missing from Shortcuts, parameters that don't resolve, crashes in the background, empty entity queries

### Best Practices
- Intent naming, parameter summaries, error messages, entity suggestions, and an App Store checklist

## Key Pattern

### Simple AppIntent

```swift
struct OrderCoffeeIntent: AppIntent {
    static let title: LocalizedStringResource = "Order Coffee"

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

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Song"

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)")
    }

    static let defaultQuery = SongEntityQuery()
}

struct SongEntityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [SongEntity] {
        try await SongStore.shared.songs(ids: identifiers)
    }

    func suggestedEntities() async throws -> [SongEntity] {
        try await SongStore.shared.popularSongs(limit: 10)  // suggestions for Siri
    }
}
```

## Intent Not Showing Up

If an intent is missing from Shortcuts, first check that it isn't marked `isDiscoverable = false`; leaving the property out is fine, because it defaults to `true`. Then launch the app once after installing the new build. After a reinstall, the system keeps serving the previous build's intents until the app launches, and retrying doesn't refresh them.

## Documentation Scope

This page documents the `app-intents-ref` skill (in the `axiom-integration` suite), the API reference your assistant uses for App Intents APIs, integration patterns, and automated intent tests. The skill holds the full API detail and code examples.

## Related

- [app-intents](/skills/integration/app-intents) – The traps that compile but fail at run time, for every intent built from this reference
- [siri-ai](/skills/integration/siri-ai) – Turns the intents and entities defined here into tools and values that Siri AI can use (27.3)
- [siri-evaluations-ref](/reference/siri-evaluations-ref) – Tests Siri's own choices of intents and entities, building on the AppIntentsTesting matchers covered here
- [app-shortcuts-ref](/reference/app-shortcuts-ref) – Wraps the intents defined here in App Shortcuts so they work in Siri and Spotlight with no user setup
- [core-spotlight-ref](/reference/core-spotlight-ref) – Indexes the entities your intents operate on, so they appear in Spotlight search
- [ui-testing](/skills/ui-design/ui-testing) – Where AppIntentsTesting tests live: they must run from a UI test target
- [extensions-widgets](/skills/integration/extensions-widgets) – Interactive widgets and Control Center controls run App Intents for their buttons and toggles
- [app-discoverability](/skills/integration/app-discoverability) – The strategy for surfacing your app system-wide, of which App Intents are one part
- [agentic-security](/skills/security/agentic-security) – Threat modeling for schema-adopting intents that the model, not the user, decides to run

## Resources

**WWDC**: 2026-240, 2026-295, 2026-343, 2026-344, 2026-345, 2026-347, 2025-244, 2025-260, 2025-275

**Docs**: /appintents, /appintents/appintent, /appintents/appentity, /appintents/appschema, /appintentstesting
