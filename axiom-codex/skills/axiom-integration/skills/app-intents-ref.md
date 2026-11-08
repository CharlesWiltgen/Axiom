
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
- Testing intents — AppIntentsTesting `OS27`, then by hand in Shortcuts and Siri
- Siri AI calling the app's own actions (27.3: `@AppIntent(.tool)`, generable entities, App Skills) — see `skills/siri-ai.md`
- Implementing entity queries for app content

## Related Skills

- **app-intents** — The traps that compile but fail at run time (cold-launch dependencies, `perform()` re-runs, errors, results, donations, ids)
- **app-shortcuts-ref** — App Shortcuts for instant Siri/Spotlight availability without user setup
- **core-spotlight-ref** — Core Spotlight and NSUserActivity integration for content indexing
- **app-discoverability** — Strategic guide for making apps surface system-wide across all APIs
- **siri-ai** — Tool intents, generable entities, card snippets, and App Skills for Siri AI (27.3)
- **siri-evaluations-ref** — SiriEvaluations: scripted Siri conversations graded against expected intents and entities (27.3)

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

## Visual Intelligence Integration

### IntentValueQuery

Allow users to circle objects in the Visual Intelligence camera and see matching results from your app:

```swift
@UnionValue
enum VisualSearchResult {
    case landmark(LandmarkEntity)
    case collection(CollectionEntity)
}

struct LandmarkIntentValueQuery: IntentValueQuery {
    func values(for input: SemanticContentDescriptor) async throws -> [VisualSearchResult] {
        // Match visual input to app entities
    }
}

// Each entity type needs an OpenIntent
struct OpenLandmarkIntent: OpenIntent { /* ... */ }
struct OpenCollectionIntent: OpenIntent { /* ... */ }
```

`SemanticContentDescriptor` lives in the **VisualIntelligence** framework — add `import VisualIntelligence`. It's the `Input` associated type of `IntentValueQuery` for visual-intelligence search.

### Onscreen Entities

Associate app entities with visible content so users can ask Siri or ChatGPT about what's on screen (`NSUserActivity.appEntityIdentifier` is iOS 18.2+):

```swift
struct LandmarkDetailView: View {
    let landmark: LandmarkEntity

    var body: some View {
        Group { /* View content */ }
        .userActivity("com.landmarks.ViewingLandmark") { activity in
            activity.title = "Viewing \(landmark.name)"
            activity.appEntityIdentifier = EntityIdentifier(for: landmark)
        }
    }
}
```

`.userActivity` marks the one item a detail view shows. For a list, tag each row with `.appEntityIdentifier(_:)` (iOS 18.4+) so Siri can resolve "open the third one"; a `List` with selection takes `.appEntityIdentifier(forSelectionType:identifier:)` instead, whose closure maps a selection value to an `EntityIdentifier?`:

```swift
List(landmarks) { landmark in
    LandmarkRow(landmark: landmark)
        .appEntityIdentifier(EntityIdentifier(for: landmark))
}
```

---

## Core Concepts

### The Three Building Blocks

**1. AppIntent** — Executable actions with parameters
```swift
struct OrderSoupIntent: AppIntent {
    static let title: LocalizedStringResource = "Order Soup"
    static let description: IntentDescription = "Orders soup from the restaurant"

    @Parameter(title: "Soup")
    var soup: SoupEntity

    @Parameter(title: "Quantity")
    var quantity: Int?

    func perform() async throws -> some IntentResult {
        guard let quantity else {
            // Asks for the value, then runs perform() again from the top:
            // nothing above this line may have side effects.
            throw $quantity.needsValueError("How many soups?")
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

    @Property(title: "Name")          // only @Property members are visible to the system
    var name: String

    @Property(title: "Price")
    var price: Double                 // @Property needs an intent value type; Decimal isn't one

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Soup"

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)",
                              subtitle: "\(price, format: .currency(code: "USD"))")
    }

    static let defaultQuery = SoupQuery()
}
```

**3. AppEnum** — Enumeration types for parameters
```swift
enum SoupSize: String, AppEnum {
    // Raw values are stored in saved shortcuts: spell them out, never rename, only append.
    // A case missing from caseDisplayRepresentations is a runtime crash.
    case small = "small"
    case medium = "medium"
    case large = "large"

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Size"
    static let caseDisplayRepresentations: [SoupSize: DisplayRepresentation] = [
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
    static let title: LocalizedStringResource = "Send Message"

    // REQUIRED: Purpose explanation
    static let description: IntentDescription = "Sends a message to a contact"

    // OPTIONAL: Discovery in Shortcuts/Spotlight
    static let isDiscoverable: Bool = true

    // OPTIONAL: Execution context (iOS 26+) — replaces the deprecated `openAppWhenRun`
    static let supportedModes: IntentModes = .background
    // iOS 18 deployment targets use the boolean instead (deprecated in iOS 26):
    // static let openAppWhenRun: Bool = false

    // OPTIONAL: Authentication requirement
    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
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

    // requestValueDialog asks for a missing value;
    // requestDisambiguationDialog asks the person to choose among several matches
    @Parameter(title: "Location",
               requestValueDialog: "Which location would you like to visit?",
               requestDisambiguationDialog: "Which of these locations?")
    var location: LocationEntity

    // Parameter with default value
    @Parameter(title: "Duration", default: 60)
    var duration: Int
}
```

#### Optional parameters in update intents

In an intent that edits an existing record, a `nil` optional can mean "clear it" or "not mentioned", and a nil check can't tell them apart. Read the parameter's `valueState` (iOS 18.2+). An `@AppIntent(schema:)` intent's properties get the `IntentParameter` wrapper even without `@Parameter`, so `$property` works there too:

```swift
switch $recurrence.valueState {
case .set(let rule?): event.recurrence = rule  // new value
case .set(nil): event.recurrence = nil         // explicitly cleared
case .unset: break                             // not part of the request
@unknown default: break                        // not frozen: omitting this is a Swift 6 error
}
```

### Parameter Summary

The summary is the sentence the Shortcuts editor shows, with each parameter as an editable field. It isn't Siri's phrasing: Siri uses App Shortcut phrases and, for Siri AI tools, the intent's title and descriptions (`skills/siri-ai.md`). Parameters in the trailing block appear after the ones the string names, so don't repeat them there.

```swift
struct OrderIntent: AppIntent {
    @Parameter(title: "Item")
    var item: MenuItem

    @Parameter(title: "Quantity")
    var quantity: Int

    static var parameterSummary: some ParameterSummary {
        Summary("Order \(\.$quantity) \(\.$item)")
    }
}
// Shortcuts editor: "Order [2] [Latte]"
```

### The perform() Method

```swift
func perform() async throws -> some IntentResult & ReturnsValue<OrderEntity> & ProvidesDialog {
    // 1. Validate parameters
    guard quantity > 0 && quantity < 100 else {
        throw OrderError.invalidQuantity   // CustomLocalizedStringResourceConvertible (Error Handling, below)
    }

    // 2. Execute action (keep irreversible work last: perform() runs again
    //    from the top after a needsValueError or restartPerform)
    let order = try await orderService.placeOrder(
        item: item,
        quantity: quantity
    )

    // 3. Return a typed value a next step (or Siri) can use
    return .result(
        value: order,
        dialog: "Your order for \(quantity) \(item.name) has been placed"
    )
}
```

Don't donate from `perform()`: the system already donates intents that Siri, Shortcuts, and other system features run, so donating there double-counts. Donate when the person does the same thing in your app's own UI, after it succeeds: `try await IntentDonationManager.shared.donate(intent: intent)`.

### Error Handling

```swift
enum OrderError: Error, CustomLocalizedStringResourceConvertible {
    case outOfStock(itemName: String)
    case invalidQuantity
    case paymentFailed
    case networkError

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .outOfStock(let name):
            return "Sorry, \(name) is out of stock"
        case .invalidQuantity:
            return "Order between 1 and 99"
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

### Dependencies

```swift
@main
struct OrdersApp: App {
    init() {
        // App.init() runs on every launch, including a cold launch by Siri.
        let store = OrderStore.shared   // read a @MainActor store outside the @Sendable autoclosure
        AppDependencyManager.shared.add(dependency: store)
        AppDependencyManager.shared.add(key: "archive", dependency: ArchiveService())
    }
    var body: some Scene { WindowGroup { ContentView() } }
}

struct PlaceOrderIntent: AppIntent {
    static let title: LocalizedStringResource = "Place Order"
    @Dependency private var store: OrderStore
    @Dependency(key: "archive") private var archive: ArchiveService

    func perform() async throws -> some IntentResult {
        try await store.placeOrder()
        return .result()
    }
}
```

- `@Dependency` is `AppDependency<Value>` (`Value: Sendable`), resolved on `AppIntent`, `EntityQuery` and other `DynamicOptionsProvider`s, and `IntentValueQuery`. On an `AppEntity` or `AppEnum`, `@Dependency` doesn't resolve (`unknown attribute 'Dependency'`); spelled `@AppDependency` it compiles and is never populated.
- `add(key:dependency:)` takes an `@autoclosure` (not evaluated at registration) or an `@Sendable () async throws -> Value` closure. `key:` tells apart two registrations of one type.
- Referencing a `@MainActor` type's `static let shared` inside the autoclosure warns in Swift 6 (`main actor-isolated static property 'shared' can not be referenced from a Sendable closure`); read it into a local first, as above.
- An unregistered dependency traps on first access, uncatchably. `@Dependency(default:)` (autoclosure or async throwing closure) is only for a service that may be absent: `skills/app-intents.md`, Dependencies.

### Undo (26.0+)

```swift
struct ArchiveNoteIntent: UndoableIntent {
    static let title: LocalizedStringResource = "Archive Note"
    @Parameter var note: NoteEntity
    @Dependency private var notes: NoteStore   // @MainActor final class

    func perform() async throws -> some IntentResult {
        let id = note.id
        await MainActor.run {
            notes.archive(id)
            undoManager?.registerUndo(withTarget: notes) { $0.unarchive(id) }
        }
        return .result()
    }
}
```

- `UndoableIntent` refines `SystemIntent`; its `undoManager` is `@MainActor` and `nil` when no suitable one exists. Works from the app or an App Intents extension.
- Only register undo actions. The app's own menus and UI call `undo()`/`redo()`; an intent never does.

---

## AppEntity: Representing App Content

### Entity Definition

```swift
struct BookEntity: AppEntity {
    // REQUIRED: Unique identifier, stable across launches and devices
    // (never a row id, array index, or Photos localIdentifier)
    var id: UUID

    // Only @Property members are visible to Shortcuts, Spotlight, and Siri
    @Property(title: "Title")
    var title: String

    @Property(title: "Author")
    var author: String

    var coverImageURL: URL?   // used for the display image only

    // REQUIRED: Type display name
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Book"

    // REQUIRED: Instance display
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(title)",
            subtitle: "by \(author)",
            image: coverImageURL.map { .init(url: $0) }
        )
    }

    // REQUIRED: Query for resolution
    static let defaultQuery = BookQuery()
}
```

### Cross-Device Identity: SyncableEntity `OS27`

`SyncableEntity` tells the system an entity can be referred to consistently across devices; Siri uses it to move a conversation from one device to another. An `id` that's already the same everywhere (a server `UUID`) needs no other change. For separate local and stable ids, make the `id` a `SyncableEntityIdentifier`:

```swift
struct PhotoEntity: AppEntity, SyncableEntity {
    var id: SyncableEntityIdentifier<String, String>   // <LocalID, StableID>
    @Property(title: "Title") var title: String
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Photo"
    static let defaultQuery = PhotoQuery()
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(title)") }

    init(localID: String, cloudID: String, title: String) {
        id = SyncableEntityIdentifier(local: localID, stable: cloudID)
        self.title = title
    }
}

struct PhotoQuery: EntityQuery {
    func entities(for identifiers: [SyncableEntityIdentifier<String, String>]) async throws -> [PhotoEntity] {
        var found: [PhotoEntity] = []
        for id in identifiers {
            if let local = id.local, let photo = try await PhotoLibrary.photo(localID: local) {
                found.append(photo)
            } else if let stable = id.stable, let photo = try await PhotoLibrary.photo(cloudID: stable) {
                found.append(photo)
            }
        }
        return found
    }
}
```

`local` is `nil` when the framework resolves the entity on another device; `stable` can be `nil` for on-device operations. Refer to the entity by `local` in your own code, and resolve whichever one is present. When both ids are the same value, `SyncableEntityIdentifier(id:)`.

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

From 27.3, `@Property`, `@ComputedProperty`, and `@DeferredProperty` take `title:`, `description:`, `authenticationPolicy:`, and `visibility:` (`.default` or `.internal`, which hides the property from Siri and Shortcuts), and an entity can declare `static let authenticationPolicy` as the minimum for all its properties. Siri AI reads every exposed property's title and description. These arguments don't build on an entity that ships before 27.3 until the deployment target is 27.3. Details and fallbacks: `skills/siri-ai.md` (Entity Properties).

### Computed and Deferred Properties

#### @ComputedProperty

Computed properties that read directly from a source of truth (no stored value):

```swift
struct SettingsEntity: UniqueAppEntity {
    @ComputedProperty
    var defaultPlace: PlaceDescriptor {
        UserDefaults.standard.defaultPlace
    }

    init() { }
}
```

#### @DeferredProperty

Properties that are expensive to calculate, only fetched when explicitly requested:

```swift
struct LandmarkEntity: IndexedEntity {
    @DeferredProperty
    var crowdStatus: Int {
        get async throws {
            await modelData.getCrowdStatus(self)
        }
    }
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

#### Reading another parameter: IntentParameterDependency

A query can't read the intent's other parameters directly. List the ones it needs:

```swift
struct SizeQuery: EntityQuery {
    @IntentParameterDependency<OrderCoffeeIntent>(\.$drink)
    var order

    func entities(for identifiers: [SizeEntity.ID]) async throws -> [SizeEntity] {
        SizeEntity.all.filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [SizeEntity] {
        guard let order else { return SizeEntity.all }   // nil until drink has a value
        return SizeEntity.all.filter { $0.drinkIDs.contains(order.drink.id) }
    }
}
```

The wrapped value is an `IntentProjection<OrderCoffeeIntent>?`, `nil` until a listed parameter has a value; it reads values by key path (`order.drink`). Read only the key paths you listed: reading another is a `fatalError`, so don't force-unwrap around it.

### Which Surface Uses Which Lookup

The same entity is found differently by each system surface. Pick mechanisms by the surfaces you target:

| Mechanism | Shortcuts | Spotlight | Siri AI tools (27.3) |
|---|---|---|---|
| `entities(for:)` | Resolves saved ids | Resolves ids from results | Resolves ids Siri already has. Required for every non-transient entity a tool uses |
| `suggestedEntities()` | The parameter picker's list (default `[]`, an empty picker) | Spotlight on Mac shows and filters them | Not used |
| `EntityStringQuery.entities(matching:)` | The picker's search field (unfiltered input) | — | Not used |
| `EntityPropertyQuery` | Generated Find/filter actions | — | Not used |
| `EnumerableEntityQuery.allEntities()` | The full list (small sets) | — | Used, but runs app code, and only when the request names the app |
| `IndexedEntity` + Core Spotlight index | Generated Find action | Search results, opened by an `OpenIntent` | Preferred: lookup without launching the app. Apple says it's found even when the request doesn't name the app; measured (one app, 27.3 beta), app-less requests never reached the tool (`skills/siri-ai.md`, When Siri can call it) |
| `IntentValueQuery` | — | — | Resolves values for schemas and use-case groups (`AudioSearch`, a `maps.place`, Video playback) and Visual Intelligence |

Schema intents have their own rule: each parameter entity needs `IndexedEntity`, `UniqueAppEntity`, `TransientAppEntity`, a default `EntityStringQuery`, or an `IntentValueQuery` (`skills/app-schemas-ref.md`). Siri AI tools: `skills/siri-ai.md` (Entity parameters). Query traps: `skills/app-intents.md` (Queries and Parameters).

### Bulk Deletes: `DeleteIntent.target`

From 27.3 a `DeleteIntent` can declare `target` instead of `entities`, as `[Entity]`, `Set<Entity>`, or `EntityCollection<Entity>` (any `AppEntityCollectionValue`). Implement one of the two, not both. `EntityCollection` delivers identifiers without resolving each entity, which saves time and memory when someone deletes many at once:

```swift
@available(anyAppleOS 27.3, *)
struct DeleteNotesIntent: DeleteIntent {
    static let title: LocalizedStringResource = "Delete Notes"

    @Parameter(title: "Notes")
    var target: EntityCollection<NoteEntity>

    func perform() async throws -> some IntentResult {
        try await NoteStore.shared.delete(target.identifiers)
        return .result()
    }
}
```

With an `EntityCollection` target, `entities` returns an empty array: read `target.identifiers`, or call `target.resolvedEntities()`. With an array or set target, `entities` returns its elements (unordered for a set). Schema delete intents (`.reminders.deleteReminders`, `.files.deleteFiles` …) still require the parameter named `entities` (`skills/app-schemas-ref.md`).

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
    var authorName: String
    var isbn: String
    var pages: Int
    // ... lots of internal properties
}

// Separate entity for intents
struct BookEntity: AppEntity {
    var id: UUID
    @Property(title: "Title") var title: String
    @Property(title: "Author") var author: String

    // Convert from model
    init(from book: Book) {
        self.id = book.id
        self.title = book.title
        self.author = book.authorName
    }
}
```

---

## Authentication & Security

### Authentication Policies

```swift
struct ViewAccountIntent: AppIntent {
    // No authentication required
    static let authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
}

struct TransferMoneyIntent: AppIntent {
    // Requires user to be logged in
    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
}

struct UnlockVaultIntent: AppIntent {
    // Requires device unlock (Face ID/Touch ID/passcode)
    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication
}
```

`IntentAuthenticationPolicy` itself is iOS 16+, not a 27-cycle addition.

### Schema-Adopting Intents: Inherited Policies and Risk-Based Confirmations OS27

A schema-adopting intent becomes a tool in the Siri Toolbox — the *model* decides when to call it and generates its arguments, so prompt injection can attempt to invoke your intent without user intent. The App Intents system adds two guardrails:

**Inherited authentication policy.** Schemas carry their own default `authenticationPolicy`, set internally based on each schema's sensitivity and the data it handles. Your intent is automatically assigned the schema's default — no code needed. You can still set the property explicitly; never go weaker than the schema's default. A weaker override is **not** a compiler diagnostic — a plain `swiftc` build accepts `.alwaysAllowed` on any schema — so don't wait for a build error to catch it; the schema-validation machinery carries the `valueLowerThanMinimum` check. Review your intents with lock-screen behavior in mind — Siri runs on the lock screen, so an attacker in physical possession of a locked device can attempt to invoke intents.

**Risk-based contextual confirmations.** Schemas also carry internal risk metadata derived from side effects — deleting device state, exfiltrating data, and updating shared content are flagged risky. Before execution, the system combines that static metadata with dynamic system state to evaluate overall risk; high-risk invocations trigger an automatic user confirmation, and declining blocks execution entirely. Risk is subtle: even a seemingly harmless `createTimer` schema accepts a model-generated label string an attacker could poison and later read back via a list query — which is why the dynamic-state half of the evaluation exists and why low-stakes schemas still confirm in some contexts.

The security-side treatment (threat modeling, lock-screen attack framing, label-poisoning subtleties, Foundation Models mitigations) lives in `axiom-security (skills/agentic-security.md)` — cross-reference rather than duplicate.

---

## Background vs Foreground Execution

### Intent Modes

Use `supportedModes` (iOS 26+) for granular control over execution context. It replaces the boolean `openAppWhenRun`, which is **deprecated in iOS 26** — keep `openAppWhenRun` only for iOS 18 deployment targets:

```swift
struct GetCrowdStatusIntent: AppIntent {
    static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]

    func perform() async throws -> some ReturnsValue<Int> & ProvidesDialog {
        guard await modelData.isOpen(landmark) else {
            return .result(value: 0, dialog: "The landmark is currently closed.")
        }

        if systemContext.currentMode.canContinueInForeground {
            do {
                try await continueInForeground(alwaysConfirm: false)
                await navigator.navigateToCrowdStatus(landmark)
            } catch let error as AppIntentError where error == AppIntentError.Unrecoverable.notAllowed {
                // Can't come forward: answer from the background. Other errors propagate.
            }
        }

        let status = await modelData.getCrowdStatus(landmark)
        return .result(value: status, dialog: "Current crowd level: \(status)")
    }
}
```

#### Available Modes

| Mode | Behavior |
|------|----------|
| `.background` | Performs entirely in background |
| `.foreground(.immediate)` | App foregrounded before `perform()` runs |
| `.foreground(.dynamic)` | Can request foreground during execution |
| `.foreground(.deferred)` | Background initially, foreground before completion |

#### Common Combinations

| Combination | Use When |
|-------------|----------|
| `[.background, .foreground]` | Foreground default, background fallback |
| `[.background, .foreground(.dynamic)]` | Background default, can request foreground |
| `[.background, .foreground(.deferred)]` | Background initially, guaranteed foreground when requested |

### Continuing in Foreground

Request foreground transition at runtime when using `.foreground(.dynamic)`:

```swift
// Normal transition. Throws AppIntentError.Unrecoverable.notAllowed where the app
// can't come forward; check systemContext.currentMode.canContinueInForeground first
try await continueInForeground(alwaysConfirm: false)

// Transition after an error
throw needsToContinueInForegroundError(
    IntentDialog("Need to open app to complete this action"),
    alwaysConfirm: true
)
```

### Long-Running Work `OS27`

A background intent gets about 30 seconds on iOS, iPadOS, tvOS, visionOS, and watchOS; macOS has no limit. `LongRunningIntent` extends it:

```swift
struct ExportLibraryIntent: LongRunningIntent, CancellableIntent {
    static let title: LocalizedStringResource = "Export Library"
    @Dependency private var library: LibraryStore

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let path = try await performBackgroundTask {
            progress.totalUnitCount = 100
            progress.localizedDescription = "Exporting library"
            for chunk in 0..<100 {
                try Task.checkCancellation()
                try await library.exportChunk(chunk)
                progress.completedUnitCount = Int64(chunk + 1)
            }
            return try await library.finishExport()
        } onCancel: { reason in
            // .timeout or .userCancelled; clean up quickly
        }
        return .result(value: path)
    }
}
```

- `LongRunningIntent` refines `ProgressReportingIntent`. Update `progress` regularly: if it stalls, the system can withdraw the extra time and end the task. The system shows the progress in a Live Activity, with no UI code.
- `performBackgroundTask(options:operation:)` starts its own system background task (don't start another), outlives the surface that started it, and throws if the system can't run it; `options: .requiresGPU` declares GPU use. The `onCancel:` overload needs `CancellableIntent` and replaces `withIntentCancellationHandler`.

### Cancellation (26.4+)

```swift
struct SyncIntent: AppIntent, CancellableIntent {
    static let title: LocalizedStringResource = "Sync"
    @Dependency private var sync: SyncService

    func perform() async throws -> some IntentResult {
        try await withIntentCancellationHandler {
            try await sync.run()
        } onCancel: { reason in
            if reason == .timeout { /* no progress reported in time */ }
        }
        return .result()
    }
}
```

Gate with `@available(iOS 26.4, macOS 26.4, watchOS 26.4, tvOS 26.4, visionOS 26.4, *)`; `anyAppleOS 26.4` needs Xcode 27. Reasons are `.timeout` (no progress within the ~30 s limit) and `.userCancelled` (the cancel control in Siri, a Live Activity, or Shortcuts). The handler gets a little extra time to save state and release resources; errors from the operation are rethrown. Without needing the reason, Swift's `withTaskCancellationHandler` also sees the cancel; the extra cleanup time is documented only for `withIntentCancellationHandler`.

### Execution Targets `OS27`

When intents live in a package or framework shared by the app and its extensions, the system may run an intent or query in any of them. Restrict it:

```swift
struct OpenTabIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Tab"
    static let allowedExecutionTargets: IntentExecutionTargets = [.main]

    func perform() async throws -> some IntentResult { .result() }
}
```

Options: `.default` (any target), `.main`, `.appIntentsExtension`, `.widgetKitExtension`. `EntityQuery` and `IntentValueQuery` have the same `allowedExecutionTargets`. Pinning to `.main` defeats extension execution and adds launch latency, so pin only what needs the app's process.

### Background Execution — iOS 18 (pre-`supportedModes`)

On iOS 18, where `supportedModes` is unavailable, use the boolean `openAppWhenRun` (deprecated in iOS 26 — prefer `supportedModes` above when targeting iOS 26+):

```swift
struct QuickToggleIntent: AppIntent {
    static let openAppWhenRun: Bool = false // Runs in background

    func perform() async throws -> some IntentResult {
        // Executes without opening app
        await SettingsService.shared.toggle(setting: .darkMode)
        return .result()
    }
}
```

### Foreground Continuation — iOS 18 (pre-`supportedModes`)

For iOS 18 targets, pair a background intent with a foreground one via `opensIntent` (the iOS 26+ path is `.foreground(.dynamic)` + `continueInForeground`, shown above):

```swift
struct EditDocumentIntent: AppIntent {
    @Parameter(title: "Document")
    var document: DocumentEntity

    func perform() async throws -> some IntentResult {
        // Open app to continue in UI
        let openIntent = OpenDocumentIntent()
        openIntent.document = document
        return .result(opensIntent: openIntent)
    }
}

struct OpenDocumentIntent: AppIntent {
    static let openAppWhenRun: Bool = true

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
            conditions: [],
            actionName: .custom(acceptLabel: "Delete", acceptAlternatives: [], denyLabel: "Cancel", denyAlternatives: []),
            dialog: "Are you sure you want to delete '\(task.title)'?"
        )

        // User confirmed, proceed
        try await TaskService.shared.delete(task: task)
        return .result(dialog: "Task deleted")
    }
}
```

---

## Multiple Choice API (iOS 26+)

Request user input with structured options (`IntentChoiceOption` and `requestChoice(between:dialog:)` are iOS 26+ — gate call sites with `if #available(iOS 26, *)` on lower deployment targets):

```swift
let options = [
    IntentChoiceOption(title: "Option 1"),                      // style defaults to .default
    IntentChoiceOption(title: "Option 2", style: .destructive),
    IntentChoiceOption.cancel                                   // a static var, NOT a function
]

do {
    let choice = try await requestChoice(
        between: options,
        dialog: IntentDialog("Please select an option")
    )
    // IntentChoiceOption is Equatable (not Identifiable) — compare by value, not `.id`.
    if choice == options[0] {        // Option 1 selected
    } else if choice == options[1] { // Option 2 selected
    }
} catch {
    // Choosing `.cancel` throws; it is never returned. Clean up here, then rethrow.
    throw error
}
```

`IntentChoiceOption` is `init(title:style:)` (style defaults to `.default`; other styles `.destructive`, `.cancel`). There is no `subtitle:` parameter, and `cancel` is a `static var`, not `cancel(title:)`.

---

## Interactive Snippets

### Static Snippets

Return a SwiftUI view showing the outcome of an intent:

```swift
func perform() async throws -> some IntentResult {
    return .result(view: Text("Order placed!").font(.title))
}
```

### SnippetIntent (iOS 26+)

Return interactive snippets with follow-up action buttons:

```swift
func perform() async throws -> some IntentResult & ReturnsValue<LandmarkEntity> & OpensIntent & ShowsSnippetIntent {
    let landmark = await findNearestLandmark()

    var openIntent = OpenLandmarkIntent()
    openIntent.landmark = landmark
    var snippetIntent = LandmarkSnippetIntent()
    snippetIntent.landmark = landmark

    return .result(
        value: landmark,
        opensIntent: openIntent,
        snippetIntent: snippetIntent
    )
}

struct LandmarkSnippetIntent: SnippetIntent {
    static let title: LocalizedStringResource = "Landmark"

    @Parameter var landmark: LandmarkEntity

    // SnippetIntent requires `perform()` returning `some ShowsSnippetView` — there is
    // NO `var snippet: some View` requirement (that form does not compile). Supply the
    // SwiftUI view through `.result(view:)`.
    func perform() async throws -> some IntentResult & ShowsSnippetView {
        .result(view: VStack {
            Text(landmark.name).font(.headline)
            Text(landmark.description).font(.body)

            HStack {
                // Snippet controls must run intents: a plain closure Button compiles but does nothing
                Button(intent: AddFavoriteLandmarkIntent(landmark: landmark)) { Text("Add to Favorites") }
                Button(intent: SearchTicketsIntent(landmark: landmark)) { Text("Search Tickets") }
            }
        }
        .padding())
    }
}

struct AddFavoriteLandmarkIntent: AppIntent {
    static let title: LocalizedStringResource = "Add Landmark to Favorites"
    @Parameter var landmark: LandmarkEntity

    init() {}
    init(landmark: LandmarkEntity) { self.landmark = landmark }

    func perform() async throws -> some IntentResult {
        try await FavoritesStore.shared.add(landmark.id)
        return .result()   // the system then re-runs the snippet's perform() to refresh it
    }
}
```

- The snippet intent's `perform()` must be read-only and safe to re-run; the system re-runs it after each control intent.
- Never point a button at the snippet intent itself. Call the static `LandmarkSnippetIntent.reload()` only for updates that don't come from a tap.
- `SnippetIntent` is iOS 26+. A pre-26 fallback must be a separate intent: one opaque result type can't return both kinds.

---

## Swift Package Support

### AppIntentsPackage

Include App Intents in Swift Packages and static libraries:

```swift
// In your framework or dynamic library
public struct LandmarksKitPackage: AppIntentsPackage { }

// In your app target
struct LandmarksPackage: AppIntentsPackage {
    static var includedPackages: [any AppIntentsPackage.Type] {
        [LandmarksKitPackage.self]
    }
}
```

This enables modular intent definitions across package boundaries. The app target aggregates all packages via `includedPackages`.

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
static let typeDisplayRepresentation: TypeDisplayRepresentation = "Calendar Event"
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

**Availability** `IndexedEntity` is iOS 18+; the `indexingKey:` and `customIndexingKey:` forms of `@Property` used below are iOS 18.4+.

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
    @Property(title: "Title", indexingKey: \.title)
    var title: String

    @Property(title: "Start Date", indexingKey: \.startDate)
    var startDate: Date

    @Property(title: "End Date", indexingKey: \.endDate)
    var endDate: Date

    // 2. Custom key for properties without standard Spotlight attribute
    @Property(title: "Notes", customIndexingKey: CSCustomAttributeKey(keyName: "eventNotes")!)
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

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Event"
}
```

### Indexing Key Mapping

#### Standard Spotlight attribute keys
```swift
// Common Spotlight keys for events
@Property(title: "Title", indexingKey: \.title)
var title: String

@Property(title: "Start Date", indexingKey: \.startDate)
var startDate: Date

@Property(title: "Location", indexingKey: \.namedLocation)
var location: String?
```

#### Custom keys for non-standard attributes
```swift
@Property(title: "Notes", customIndexingKey: CSCustomAttributeKey(keyName: "eventNotes")!)
var notes: String?

@Property(title: "Attendee Count", customIndexingKey: CSCustomAttributeKey(keyName: "attendeeCount")!)
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

### Explicit Spotlight Indexing

For entities that need custom searchable attributes or manual index management:

```swift
extension LandmarkEntity {
    var searchableAttributes: CSSearchableItemAttributeSet {
        let attributes = CSSearchableItemAttributeSet()
        attributes.title = name
        attributes.namedLocation = regionDescription
        attributes.keywords = activities
        attributes.latitude = NSNumber(value: coordinate.latitude)
        attributes.longitude = NSNumber(value: coordinate.longitude)
        attributes.supportsNavigation = true
        return attributes
    }
}

// Add entities to index
func indexLandmarks() async throws {
    let landmarks = await fetchLandmarks()
    try await CSSearchableIndex.default().indexAppEntities(landmarks)
}

// Remove from index when deleted
func deleteLandmark(_ landmark: LandmarkEntity) async throws {
    await dataStore.delete(landmark)
    try await CSSearchableIndex.default().deleteAppEntities(
        identifiedBy: [landmark.id],
        ofType: LandmarkEntity.self
    )
}
```

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

    @Property(title: "Destination", customIndexingKey: CSCustomAttributeKey(keyName: "destination")!)
    var destination: String

    // Auto-generated Find Trips action with filters for all properties
}
```

---

## Spotlight on Mac

### Overview

**Spotlight on Mac** (macOS Tahoe 26+) allows users to run your app's intents directly from system search. Intents that work in Shortcuts automatically work in Spotlight with proper configuration.

**Key principle** Spotlight is all about running things quickly. To do that, people need to be able to provide all the information your intent needs to run directly in Spotlight.

### Requirements for Spotlight Visibility

#### 1. Parameter Summary Must Include All Required Parameters

The parameter summary, which is what people will see in Spotlight UI, must contain all required parameters that don't have a default value.

#### ❌ WON'T SHOW in Spotlight
```swift
struct CreateEventIntent: AppIntent {
    static let title: LocalizedStringResource = "Create Event"

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
@Parameter(title: "Notes", default: "") // Has default - can omit from summary
var notes: String
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
static let isDiscoverable: Bool = false

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
    // EnumerableEntityQuery only supplies a default for `suggestedEntities()` —
    // `entities(for:)` is still required.
    func entities(for identifiers: [TimezoneEntity.ID]) async throws -> [TimezoneEntity] {
        return TimezoneEntity.allTimezones.filter { identifiers.contains($0.id) }
    }

    func allEntities() async throws -> [TimezoneEntity] {
        // Small list - provide all
        return TimezoneEntity.allTimezones
    }
}
```

**Use suggested entities when** List is large or unbounded (calendar events, notes, contacts)
**Use all entities when** List is small and bounded (timezones, priority levels, categories)

### On-Screen Content Tagging

Tag the active screen so Spotlight suggests its entity for parameters. SwiftUI, lists and selection: Onscreen Entities above. In UIKit, a view takes `view.appEntityIdentifier` (iOS 18.4+); a view controller sets its `NSUserActivity`:

```swift
// In your detail view controller
func showEventDetail(_ event: Event) {
    let activity = NSUserActivity(activityType: "com.myapp.viewEvent")
    activity.persistentIdentifier = event.id.uuidString

    // Spotlight suggests this event for parameters
    activity.appEntityIdentifier = EntityIdentifier(for: EventEntity(from: event))

    userActivity = activity
}
```

### Search Beyond Suggestions

**Basic filtering**:
Spotlight on Mac filters the suggestions it shows as the person types. The Shortcuts picker does not filter `suggestedEntities()` by substring, and Siri AI tools don't use suggestions at all (`skills/siri-ai.md`).

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
    static let title: LocalizedStringResource = "Create Event"
    static let supportedModes: IntentModes = .background  // iOS 26+ (was `openAppWhenRun = false`)

    @Parameter(title: "Title")
    var title: String

    @Parameter(title: "Start Date")
    var startDate: Date

    func perform() async throws -> some IntentResult & ReturnsValue<EventEntity> {
        let event = try await EventService.shared.createEvent(
            title: title,
            startDate: startDate
        )

        // Optionally open app to view created event
        let entity = EventEntity(from: event)
        var openIntent = OpenEventIntent()
        openIntent.event = entity

        return .result(
            value: entity,
            opensIntent: openIntent
        )
    }
}

// Foreground intent - opens app to specific event
struct OpenEventIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Event"
    static let supportedModes: IntentModes = .foreground  // iOS 26+ (was `openAppWhenRun = true`)

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

Words the suggestions that donations produce. It donates nothing itself; the suggestions come from `IntentDonationManager` donations of in-app actions and from runs by Siri and Shortcuts (`skills/app-intents.md`, Donations):

```swift
struct OrderCoffeeIntent: AppIntent, PredictableIntent {
    static let title: LocalizedStringResource = "Order Coffee"

    @Parameter(title: "Coffee Type")
    var coffeeType: CoffeeType

    @Parameter(title: "Size")
    var size: CoffeeSize

    // Required by PredictableIntent — without it the conformance fails to compile
    static var predictionConfiguration: some IntentPredictionConfiguration {
        IntentPrediction(displayRepresentation: { DisplayRepresentation(title: "Order a coffee") })
    }

    func perform() async throws -> some IntentResult {
        // Order logic
        return .result()
    }
}
```

Without donations there's nothing to suggest, however the prediction is worded.

---

## Automations on Mac

### Overview

**Personal Automations** arrive on macOS (macOS Tahoe 26+) with Mac-specific triggers:

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
    static let title: LocalizedStringResource = "Process Invoice"

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

## App Schemas (System Schemas for Siri & Apple Intelligence)

**App schemas** are predefined system understandings of common concepts — messages, contacts, photos, calendar events. When your `AppEntity` / `AppIntent` / `AppEnum` conforms to a schema, Siri and Apple Intelligence already know how to reason about it and drive it with natural language — you map the schema's parameters onto your app's logic; the system handles the language. Schemas are grouped into **domains** (messages, mail, photos, calendar, …); a domain is "a contract between your app and Siri".

> App schemas debuted in iOS 18 (then *assistant schemas*). The 27 cycle renames the macros, greatly expands the domains, and adds Xcode build-time tooling. The form below is current.

### Adopting a schema

Conform an entity or intent with the `schema:` form of the macro. Xcode autocompletes every available schema as `.<domain>.<schema>` (e.g. `.photos.asset`, `.messages.sendMessage`). To scaffold the whole conformance (required properties, query stub, `perform`, every enum case, union types), type a `<domain>_<schema>` code snippet instead (`calendar_event`, `calendar_attendeeStatus`, `system_open`):

```swift
// Entity — adopt the photos `asset` schema so Siri understands what it represents
@AppEntity(schema: .photos.asset)
struct PhotoEntity: IndexedEntity {
    var id: String
    // …your existing properties…
}

// Intent — adopt the messages `sendMessage` schema; map its params to your app
@AppIntent(schema: .messages.sendMessage)
struct SendMessageIntent {
    @Parameter var recipient: ContactEntity
    @Parameter var content: String

    func perform() async throws -> some IntentResult & ReturnsValue<MessageEntity> {
        let sent = await UnicornChat.shared.send(content, to: recipient)
        return .result(value: sent)   // return the new entity to the system
    }
}
```

`@AppEntity` / `@AppIntent` / `@AppEnum` replace the deprecated `@AssistantEntity` / `@AssistantIntent` / `@AssistantEnum` (the SDK marks the old names `deprecated, renamed:` to these). Adopt `IndexedEntity` so Siri resolves your content by *meaning* (semantic search over the Spotlight index), not just exact text — the recommended path for the best Siri experience; use `EntityStringQuery` when data is too large/remote/volatile to index.

### Available domains

Apple groups the domains in three tiers. It documents the primary domains as making actions available to Apple Intelligence and Siri, and the Shortcuts-specific domains as making them available in the Shortcuts app.

| Tier | Domains | Since |
|---|---|---|
| Primary — Apple Intelligence and Siri | Audio, Calendar, Clock, Maps, Messages, Notes, Phone, Reminders | `OS27` |
| | Camera | iOS 18+, macOS 15+, visionOS 2+ |
| | Mail, Photos, System (in-app search) | iOS 18+, macOS 15+, visionOS 2+, with schemas added in `OS27` |
| | Video (play, trailers, watch list) | iOS 27.3+, tvOS 27.3+, visionOS 27.3+; not macOS |
| Single-purpose | Visual Intelligence (camera search results) | iOS 26+, macOS 27+; not visionOS |
| | Assistant (side-button launch of a voice app, Japan) | iOS 26.2+; not macOS/visionOS |
| Shortcuts-specific | Books, Files, Journal, Presentation, Reader, Spreadsheet, Whiteboard, WordProcessor | iOS 18+, macOS 15+, visionOS 2+ |
| | Browser | iOS 18+, macOS 15+, visionOS 2+, with schemas added in `OS27` |

No domain exists on watchOS; Video, from 27.3, is the only one on tvOS. Every schema's required members, parameters, return types, enum cases and deprecations, plus the schema build errors and their fixes: `skills/app-schemas-ref.md`. Moving a SiriKit Lists/Notes app to the Notes and Reminders domains: `skills/siri-notes-reminders.md`.

**Audio**: every schema's required members, parameters, enum cases, the `AudioItem` union, `AudioSearch` resolution, and the SiriKit media path that Siri without Apple Intelligence still uses — `skills/siri-audio-ref.md` (approach: `skills/siri-audio.md`).

### Use-case groups `OS27`

Some Siri flows need several schemas, called a use-case group: Message Sending (`sendMessage` + `draftMessage`), Mail Composing, Replying, and Forwarding (with `saveDraft`, `updateDraft`, `sendDraft`), Cancel Alarm (`dismissAlarm` + `updateAlarm`), Start Navigation (with a `maps.place` `IntentValueQuery`), Play Audio, Play Video (`playContent` + an `IntentValueQuery`), and Install Application. Adopt part of a group and the build **warns**, with a fix-it stub: `App Intents use case 'Message Sending' is missing the schema 'messages.draftMessage'`. The build still succeeds (measured on Xcode 27.3 beta 27C5020n), but Apple says to adopt the whole group to reach Siri AI, so treat the warning as required work. Fill in the stub: wire your entities and inject dependencies. `perform()` has no actor isolation: `await` main-actor calls, and mark it `@MainActor` only when most of it is UI work. A Siri run may have no scene, so update the model, not view state (`skills/app-intents.md`).

Extra members beyond a schema: an extra intent `@Parameter` must be optional (`Intent parameters not defined by AppSchemaIntent 'calendar.createEvent' must be optional`, a halting error). An extra entity property can be non-optional, but it's exported only with `@Property`; schema-defined properties get it implicitly. Apple says Apple Intelligence reads only schema-defined members and extras serve Shortcuts.

### Cross-app content (on-screen awareness + transfer)

Siri requests often span apps ("email my wife this reply"). Annotate views with their entities (see Onscreen Entities) so Siri can resolve "this message", then adopt `Transferable` with an `IntentValueRepresentation` to export entities to other apps. On import, resolve to an existing entity with `IntentValueQuery`, or create a new one via `IntentValueRepresentation` importing.

---

## Testing & Debugging

### AppIntentsTesting `OS27`

For Siri's own behavior (which tool it picks, how it fills parameters, which skills load), use SiriEvaluations (27.3), which builds on this framework: `skills/siri-evaluations-ref.md`.

Runs intents out of process through the same App Intents stack as Siri and Shortcuts: real parameter resolution, real entity queries. Intents are looked up by bundle ID and Swift type name (`"CreateEventIntent"`, not the title), so the test target doesn't link the app. Test in this order: intent behavior here, then system surfaces (Spotlight, annotations, Transferable), then a manual Shortcuts/Siri pass.

- **UI Testing Bundle only.** The runner accepts only clients in UI automation mode. From a unit-test bundle, hosted or not, every call fails with `transportCancelled`. Calling `perform()` in process from a unit test exercises only your logic and skips parameter resolution and entity queries.
- **OS 27 test destination.** The app's deployment target can be lower (verified with 26.0).
- **Same signing team** for the runner and the app.
- **Launch the app in `setUp`.** After a reinstall the system serves the previous build's intent list until the app launches, so a new intent fails with `401 "does not expose any AppIntent named …"` and retrying doesn't help. `run()` launches a stopped app in the background, but only after the lookup.
- **Not covered; leave these to the manual pass.** Only the result `value` is readable; dialogs, snippets and `opensIntent` aren't. `requestConfirmation` auto-confirms, so the cancel path can't be tested. App Shortcuts phrases and Siri's language understanding aren't exercised.

```swift
import AppIntentsTesting
import XCTest

@MainActor
final class EventIntentTests: XCTestCase {
    let definitions = IntentDefinitions(bundleIdentifier: "com.example.calendar")

    override func setUp() async throws {
        XCUIApplication().launch()
        try await definitions.intents["ResetDatabaseIntent"].makeIntent().run()
    }

    func testCreateEventThenAddAttendee() async throws {
        let created = try await definitions.intents["CreateEventIntent"]
            .makeIntent(title: "Sprint Planning", calendar: "Work", priority: "high")
            .run()
        let added = try await definitions.intents["AddAttendeeIntent"]
            .makeIntent(event: created.value, email: "jada@example.com")
            .run()
        let attendees: Int = try added.value.attendeeCount
        XCTAssertEqual(attendees, 1)
    }
}
```

Test-only intents go in the app: `isDiscoverable = false` hides them from Shortcuts and Spotlight but not from AppIntentsTesting, and `#if DEBUG` drops them from Release.

```swift
#if DEBUG
struct ResetDatabaseIntent: AppIntent {
    static let title: LocalizedStringResource = "Reset Database"
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        try await EventStore.shared.deleteAll()
        return .result()
    }
}
#endif
```

#### Parameters

Labels are the `@Parameter` property names. `makeIntent` is `@dynamicCallable`, so a misspelled label compiles and fails at run time with 206.

| Type | Pass |
|---|---|
| String, Int, Double, Bool, Date, URL, Measurement… | The Swift value |
| `AppEnum` | Its raw value (`priority: "high"`) or `definitions.enums["EventPriority"].makeCase("high")` |
| `AppEntity` | Any of three: a string, resolved through the entity's `EntityStringQuery` (first match wins); an entity from a query or an earlier result (`event: created.value`); or `definitions.entities["CalendarEntity"].makeReference(identifier:)` |
| `TransientAppEntity` | `definitions.transientEntities["EventDraft"].makeEntity(title: "Offsite", attendees: 3)`. The labels are its `@Property` names |
| A test-side type of your own | Conform it to `IntentValueConvertibleWrapper` (`BaseValue`, `init(baseValue:)`, `baseValue`). Passing it works. Reading an enum result back into it fails (`elementType: "AppEnumSpecification"`); read enums as `AnyAppEnum` |

#### Results and queries

`run()` returns a `ResolvedIntentResult`. `value` and its properties are dynamic members; annotate the type for a typed read, which throws `castingFailed` on a mismatch.

```swift
let result = try await definitions.intents["CountEventsIntent"].makeIntent().run()
let count: Int = try result.value
```

- **Readable:** `@Property` and `@ComputedProperty`. **Not readable**, reading as NSNull: plain stored properties and `@DeferredProperty`. Read optionals as `T?`; a nil value read as a non-optional `T` also comes back as NSNull.
- **Enums** come back as `AnyAppEnum`; use `.rawValue`.
- **`makeReference(identifier:)`** holds only the identifier. It works as a parameter, but its properties can't be read; fetch the entity with `entities(identifiers:)` first.
- **Entity queries.** `definitions.entities["X"]` offers `entities(matching:)`, `entities(identifiers:)`, `suggestedEntities()` and `allEntities()`. `allEntities()` requires `EnumerableEntityQuery`, and otherwise fails with 10002.

#### System surfaces

| Surface | Test | App |
|---|---|---|
| Spotlight (not tvOS/watchOS) | `definitions.entities["EventEntity"].spotlightQuery("Design Review")`, returning `[AnyAppEntity]` | `IndexedEntity` + `CSSearchableIndex.default().indexAppEntities(_:)` |
| On-screen annotations | `definitions.entities["EventEntity"].viewAnnotations()`, returning `[ViewAnnotation]` (`.entity`, `.isSelected`) | SwiftUI: `.appEntityIdentifier(EntityIdentifier(for:))`. UIKit: `view.appEntityIdentifier`. Navigate with a `.foreground` intent, and wait with `XCUIApplication` |
| Transferable | `exported(as:)` on an `AnyAppEntity`, with a content type the entity's `transferRepresentation` exports, returns an `IntentFile`; pass that file to the definition's `resolved(from:)` | `Transferable` on the entity |

#### Errors

| Error | Cause |
|---|---|
| `transportCancelled` ("Underlying session was cancelled") | The tests are in a unit-test bundle. Move them to a UI Testing Bundle |
| Metadata 401: "does not expose any AppIntent named …" | Typo in the type name; an intent added or renamed since the app last launched; or a `#if DEBUG` intent in a non-Debug test build |
| Metadata 400: "… is not present" | Wrong bundle ID |
| Execution 206: "requested value for parameter '…' … AutoConfirmingPerformDelegate" | A required parameter is empty: a misspelled label, or an entity string or identifier that matched nothing. The error names the parameter that's missing, not the label you typed |
| Error text `castingFailed(elementType:targetType:)` | The wrong type in a typed read. With `"NSNull"`: an unreadable property kind, a nil value read as non-optional, or a property read from a `makeReference` entity. With `"AppEnumSpecification"`: read the enum as `AnyAppEnum` |
| `LNPerformQueryErrorDomain` 10002 | A query capability the type lacks — read the message: `allEntities()` on a query that isn't `EnumerableEntityQuery`, or `entities(matching:)` on one that isn't `EntityStringQuery` ("Type does not support EntityStringQuery") |
| `LNConnectionErrorDomain` 1014 "timeout" | `run()` gives up after 30 s. Keep setup and seeding intents short |

Apple's docs have two errors. The article's `definitions.intent[…]` is `intents`, and the `AnyTransientAppEntity` doc comment's `withProperties(…)` is `makeEntity(…)`.

#### Swift Testing

Xcode 27.3 supports UI tests written with Swift Testing and `XCUIAutomation` (release notes 95593221), so a UI Testing Bundle can `import Testing` with no override. Through Xcode 27.2 the UI-test product type aliases it away: `TESTING_FRAMEWORK_MODULE_ALIAS_FLAGS` (`-module-alias Testing=_Testing_Unavailable`) fails the build with `Unable to resolve module dependency: '_Testing_Unavailable'`. On 27.2 and earlier, set `TESTING_FRAMEWORK_MODULE_ALIAS_FLAGS =` (empty) on the UI test target; that override is undocumented.

```swift
import AppIntentsTesting
import Testing
import XCTest

@MainActor
@Suite(.serialized)
struct EventIntentSwiftTests {
    let definitions = IntentDefinitions(bundleIdentifier: "com.example.calendar")

    init() async throws {
        XCUIApplication().launch()
        try await definitions.intents["ResetDatabaseIntent"].makeIntent().run()
    }

    @Test func createEvent() async throws {
        let created = try await definitions.intents["CreateEventIntent"]
            .makeIntent(title: "Sprint Planning", calendar: "Work", priority: "high")
            .run()
        let title: String = try created.value.title
        #expect(title == "Sprint Planning")
    }
}
```

Every test shares one app and its data, but `.serialized` covers only its own suite. With several intent suites, nest them under one `.serialized` parent.

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

### Common Debugging Issues

#### Issue 1: Intent not appearing in Shortcuts
```swift
// ❌ Problem: isDiscoverable = false. A *missing* declaration is not a problem —
// the SDK default is `true`.
struct MyIntent: AppIntent {
    static let isDiscoverable: Bool = false
}

// ✅ Solution: set it back to `true` (or delete the line entirely)
struct MyIntent: AppIntent {
    static let isDiscoverable: Bool = true
}
```

#### Issue 2: Parameter not resolving
```swift
// ❌ Problem: the saved id came from another device (or a reinstall)
//    and entities(for:) finds nothing for it
var id: UUID = UUID()               // regenerated per launch or per device

// ✅ Solution: an id stored with the data, stable across launches and devices
var id: UUID { model.id }           // persisted server or database id
```

#### Issue 3: Intent crashes in background
```swift
// ❌ Problem: opening a URL with UIApplication from perform()
func perform() async throws -> some IntentResult {
    UIApplication.shared.open(url) // main-actor only, and absent when perform() runs in an extension
    return .result()
}

// ✅ Solution: hand the URL to the system
func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(url))
}
```

For other main-actor work, hop explicitly with `await MainActor.run { … }`, or mark the method `@MainActor` when most of it is UI work. Don't mark the intent type `@MainActor`: `perform()` isn't main-actor isolated, and the conformance fails (`#ConformanceIsolation`).

#### Issue 4: Entity query returns empty results
```swift
// ❌ Problem: no suggestedEntities(); the default returns [], so the Shortcuts picker is empty
struct BookQuery: EntityQuery {
    func entities(for identifiers: [UUID]) async throws -> [BookEntity] {
        try await BookService.shared.fetchBooks(ids: identifiers)
    }
}

// ✅ Solution: provide suggestions (Siri AI tools don't use them; index the entities for Siri)
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
static let title: LocalizedStringResource = "Do Thing"
static let title: LocalizedStringResource = "Process"
```

#### ✅ DO: Verb-noun, specific
```swift
static let title: LocalizedStringResource = "Send Message"
static let title: LocalizedStringResource = "Book Appointment"
static let title: LocalizedStringResource = "Start Workout"
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
// Shortcuts editor: "Send [Hello] to [John]"
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
    static let title: LocalizedStringResource = "Start Workout"
    static let description: IntentDescription = "Starts a new workout session"
    static let supportedModes: IntentModes = .foreground  // iOS 26+ (was `openAppWhenRun = true`)

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
            dialog: "Starting \(workoutType) workout"   // interpolate the AppEnum itself: it's localized
        )
    }
}

enum WorkoutType: String, AppEnum {
    case running = "running"
    case cycling = "cycling"
    case swimming = "swimming"
    case yoga = "yoga"

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Workout Type"
    static let caseDisplayRepresentations: [WorkoutType: DisplayRepresentation] = [
        .running: "Running",
        .cycling: "Cycling",
        .swimming: "Swimming",
        .yoga: "Yoga"
    ]
}
```

### Example 2: Add Task with Entity Query

```swift
struct AddTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Add Task"
    static let description: IntentDescription = "Creates a new task"
    static let isDiscoverable: Bool = true

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

    func perform() async throws -> some IntentResult & ReturnsValue<TaskEntity> & ProvidesDialog {
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
    @Property(title: "Name") var name: String
    @Property(title: "Color") var color: String

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "List"

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            image: .init(systemName: "list.bullet")
        )
    }

    static let defaultQuery = TaskListQuery()
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
- ☐ `perform()` reaches the main actor through `await` (`MainActor.run` or a `@MainActor` call), or is a `@MainActor` method when most of it is UI work, never a `@MainActor` intent type; URLs open via `OpenURLIntent`, not `UIApplication`
- ☐ Foreground intents declare `.foreground` in `supportedModes` (iOS 26+; `openAppWhenRun = true` is the deprecated pre-26 equivalent)
- ☐ Entity `displayRepresentation` shows meaningful info
- ☐ Each intent covered by an AppIntentsTesting test in a UI Testing Bundle `OS27`
- ☐ Siri AI (27.3): chosen intents are tools with full metadata, every exposed entity property is described, `sirimetadataanalyzer` exits 0, SiriEvaluations scenarios pass (`skills/siri-ai.md`, `skills/siri-evaluations-ref.md`)
- ☐ Tested with Siri voice commands
- ☐ Tested in Shortcuts app
- ☐ Tested with different parameter combinations
- ☐ Verified localization for all supported languages

---

## Resources

**WWDC**: 2025-244, 2025-275, 2025-260, 2026-240, 2026-343, 2026-344, 2026-345, 2026-295, 2026-347

**Docs**: /appintents, /appintents/appintent, /appintents/appentity, /appintents/appschema, /appintents/adopting-app-intents-to-support-system-experiences, /appintents/apple-intelligence-and-siri-ai, /appintentstesting, /appintentstesting/testing-your-app-intents-code, /Updates/AppIntents

**Skills**: skills/app-intents.md, skills/siri-ai.md, skills/siri-evaluations-ref.md, skills/app-shortcuts-ref.md, skills/core-spotlight-ref.md, skills/app-discoverability.md, skills/siri-audio-ref.md, axiom-security (skills/agentic-security.md)

---

**Remember** App Intents are how users interact with your app through Siri, Shortcuts, and system features. Well-designed intents feel like a natural extension of your app's functionality and provide value across Apple's ecosystem.
