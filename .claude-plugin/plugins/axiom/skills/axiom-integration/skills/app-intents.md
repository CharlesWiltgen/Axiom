# App Intents: Traps That Compile

App Intents code fails in ways the compiler doesn't catch: a crash on a cold launch from Siri, a purchase charged twice, an error Siri shows as "something went wrong", a result the system never sees. Every rule below applies to any intent, and doubly to Siri AI tools, which Siri runs while your app isn't on screen (`skills/siri-ai.md`). API surface: `skills/app-intents-ref.md`.

Apple's own coding-assistant guides ship in Xcode as plain markdown: `$(xcode-select -p)/../PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/app-intents-specialist*.md.packaged` (evergreen) and `app-intents-whats-new-27*` (26/27 APIs). This skill carries their traps plus what was measured on Xcode 27.3.

## Guardrails

- **Public API only.** Never an underscore-prefixed symbol, never an invented one to make code compile.
- **Identifiers are a public contract.** Intent and entity type names, entity `id` schemes, `AppEnum` raw values, parameter names, and App Shortcut phrases live in people's saved shortcuts. Flag any change to one; never make it as a side effect.
- **Gate, don't drop.** A newer API gets `@available` at its real floor plus a fallback; don't remove the feature for older targets.

## Red Flags

| Thought | Reality |
|---|---|
| "I'll register the dependency in `onAppear`; the app always launches first" | Siri, Spotlight, and App Shortcuts launch the app with no UI. The first access traps, and nothing can catch it |
| "It works when I tap the button, so it works from Siri" | The button ran on the main actor in a running app. Siri runs `perform()` off the main actor, maybe in an extension, maybe twice |
| "The value is in `.result(value:)`, Siri can use it" | Not unless the return type declares `ReturnsValue<T>` |
| "My `LocalizedError` already has a nice message" | Siri and Shortcuts ignore it and show a generic failure |
| "Renaming this enum case is a refactor" | Saved shortcuts store the raw value. Renaming a case with an implicit raw value, or editing any raw value, breaks them silently |
| "The build succeeded, so my intents shipped" | A successful build can export no App Intents metadata (Check the Built Metadata) |

## Rules at a Glance

| Rule | Why it isn't obvious |
|---|---|
| Register every `@Dependency` in `App.init()` | Siri launches the app cold; an unregistered one is an uncatchable `fatalError` |
| `@Dependency` only on intents and queries, and `Sendable` | On an `AppEntity`/`AppEnum` it doesn't resolve; spelled `@AppDependency` it compiles and is never populated |
| `perform()` has no actor isolation: hop explicitly, or mark the *method* `@MainActor` | Never mark the intent *type* `@MainActor` (`#ConformanceIsolation`) |
| Irreversible work last; confirm first | `needsValueError` and `restartPerform` re-run `perform()` from the top, with no rollback |
| Declare results: `some IntentResult & ReturnsValue<T>` | An undeclared `.result(value:)` compiles, but its type isn't exported (measured) |
| Throw `CustomLocalizedStringResourceConvertible` or `AppIntentError` | A `LocalizedError` is shown as a generic failure |
| No catch-all around `perform()` | It swallows or rewraps `needsValueError`, `restartPerform`, and confirmation cancels |
| Donate in-app actions after they succeed, never in `perform()` | In-app taps aren't donated for you; the system already donates what it runs |
| Only `@Property`-family members are visible to the system | A plain `var` is invisible to Shortcuts, Spotlight, and Siri |
| Entity ids stable across launches *and devices*, ≤4,096 characters | No `UUID()` at launch, row ids, array indexes, or Photos `localIdentifier` |
| `AppEnum` raw values explicit and append-only; every case displayed | Saved shortcuts store the raw value string; a missing display entry crashes at run time |
| One intent per task | A "Manage X" intent with an `action` switch is one action to Siri, Shortcuts, and prediction |
| Open content with `OpenIntent`/`OpenURLIntent`, not `UIApplication` | `perform()` may run in an extension |
| Localize through `LocalizedStringResource`, interpolate enums and entities | A runtime `String` produces no string-catalog key |
| Background intents get about 30 s (not on macOS) | Use `LongRunningIntent` (`OS27`) and `CancellableIntent` (26.4) |

## Dependencies

```swift
// ❌ Registered from a view: never runs when Siri launches the app cold
.onAppear { AppDependencyManager.shared.add(dependency: NoteDatabase.shared) }

// ✅ Runs on every launch, before any intent or query resolves it
@main
struct NotesApp: App {
    init() {
        let database = NoteDatabase.shared   // a @MainActor store: read it outside the @Sendable autoclosure
        AppDependencyManager.shared.add(dependency: database)
    }
    var body: some Scene { WindowGroup { ContentView() } }
}
```

- An unregistered dependency traps inside the wrapper's getter. `try` can't catch it. Registering in `App.init()` costs nothing up front: `add(dependency:)` takes an autoclosure that registration doesn't evaluate. `@Dependency(default:)` is only for a service that may genuinely be absent; never use it to skip registration, and never let the default build a second instance of a store the app also uses, or the intent writes to a copy the app never sees.
- `@Dependency` is resolved on `AppIntent`, `IntentValueQuery`, and `DynamicOptionsProvider`, so on `EntityQuery`. On an `AppEntity` or `AppEnum`, `@Dependency` doesn't resolve (`unknown attribute 'Dependency'`); spelled `@AppDependency` it compiles and is never prepared. Move data access into the query.
- The value must be `Sendable`. An `@Observable final class` store isn't; make it `@MainActor @Observable final class` or an `actor`, or the intent fails to compile with `Stored property '_store' … contains non-Sendable type`. Register a `@MainActor` store by reading it into a local first (`let db = NoteDatabase.shared`, then `add(dependency: db)`): its `static let shared` inside the `@Sendable` autoclosure warns in Swift 6 (`main actor-isolated static property 'shared' can not be referenced from a Sendable closure`).
- An extension that vends intents registers in its own one-time setup.

## Running perform()

```swift
// ❌ Charges, then asks for the recipient: the restart charges again
try await payments.charge(amount)
guard let recipient else { throw $recipient.needsValueError("Send to whom?") }

// ✅ Resolve and confirm first; irreversible work last
guard let recipient else { throw $recipient.needsValueError("Send to whom?") }
try await requestConfirmation(dialog: "Send \(amount) to \(recipient)?")   // cancel throws
try await payments.charge(amount)
try await payments.send(amount, to: recipient)
```

- `needsValueError` and `AppIntentError.restartPerform` re-enter `perform()` from the top without rolling anything back. Make anything before them idempotent. `try await $param.requestValue(_:)` asks inline without restarting (the non-async `requestValue(_:)` that returns an error to throw is deprecated).
- The intent's `requestConfirmation(…)` throws on cancel, in the same pass. Put it right before the destructive step, and never wrap it in `try?`, which makes cancel act like confirm. `requestChoice` throws when the person picks `.cancel` too. The parameter form `$param.requestConfirmation(for:dialog:)` returns a `Bool` instead: branch on it.
- **Don't wrap `perform()` in a catch-all.** A `do { … } catch { }` that swallows or rewraps errors also swallows `needsValueError`, `restartPerform`, and confirmation and choice cancels. Catch specific errors, and rethrow the rest. The smallest fix for your own `LocalizedError` type is to add `CustomLocalizedStringResourceConvertible` to it; convert errors from lower layers by catching their types by name.
- **Foreground continuation**: `continueInForeground` throws where the app can't come forward, such as voice-only Siri. Check `systemContext.currentMode.canContinueInForeground` first, and give a voice result otherwise.
- `perform()` has no actor isolation. Hop with `await MainActor.run { }`, call `@MainActor` methods with `await`, or mark the *method* `@MainActor func perform()` when most of it is UI work. A background run may have no scene, so update the model, not view state, and keep heavy work off the main actor. Marking the intent type `@MainActor` fails to compile; don't apply Xcode's `@preconcurrency` fix-it, which makes it compile by pinning the whole intent, construction and parameter resolution included, to the main actor.
- Pin the process only when you must: `allowedExecutionTargets` (`OS27`) set to `.main` defeats extension execution and adds launch latency. It applies to `EntityQuery` and `IntentValueQuery` too.

## Results and Errors

```swift
// ❌ Compiles, but no output type is exported for the value
func perform() async throws -> some IntentResult { .result(value: order) }

// ✅ Declared, so Siri and a next Shortcuts step can use it
func perform() async throws -> some IntentResult & ReturnsValue<OrderEntity> { .result(value: order) }
```

Measured on Xcode 27.3: the undeclared form exports no `outputType` in `Metadata.appintents/extract.actionsdata`; `ReturnsValue<Int>` does. Declare only the markers you use (`ReturnsValue`, `ProvidesDialog`, `OpensIntent`, `ShowsSnippetView`, `ShowsSnippetIntent`), and every `.result(value:)` needs `ReturnsValue<T>` whatever else the signature declares: `some IntentResult & ProvidesDialog` returning `.result(value:dialog:)` compiles too.

```swift
// ❌ LocalizedError: Siri and Shortcuts show a generic failure
enum CartError: LocalizedError { case full; var errorDescription: String? { "Cart is full." } }

// ✅ The framework reads localizedStringResource and shows it
enum CartError: Error, CustomLocalizedStringResourceConvertible {
    case full
    var localizedStringResource: LocalizedStringResource {
        "Your cart is full. Remove an item to add another."
    }
}
```

- For standard failures, throw a prebuilt category Siri can act on (iOS 18+): `AppIntentError.UserActionRequired.signin`, `AppIntentError.PermissionRequired.photos`, `AppIntentError.Unrecoverable.entityNotFound`. `AppIntentError.Unrecoverable.unknown` is deprecated.
- The same routing applies to errors thrown from `EntityQuery` methods.
- Say what went wrong and what fixes it. Siri AI reads the message to decide its next step.

## Donations

```swift
// ✅ After the person does it in your UI and it succeeded
// PlayPlaylistIntent needs an init(playlist:): @Parameter gives it no memberwise initializer
func userTappedPlay(_ playlist: PlaylistEntity) async throws {
    await player.play(playlist)
    _ = try await IntentDonationManager.shared.donate(intent: PlayPlaylistIntent(playlist: playlist))
}
```

- The system donates intents that Siri, Shortcuts, and system features run. Donating inside `perform()` double-counts.
- Put in enough detail to replay the action later, and pass `result:` when the intent returns a value.
- Delete donations when the data behind them is deleted.
- `PredictableIntent` only words the suggestion; it doesn't donate.

## Entities and Enums

- **Visibility**: only `@Property`, `@ComputedProperty`, and `@DeferredProperty` members reach the system. A plain `var` is invisible; Siri AI's metadata analyzer flags an entity with none as `SMA601`. Schema entities get `@Property` implicitly for schema-defined members only; an extra member needs it explicitly.
- **Property types**: `@Property` needs an intent value type. `Decimal` isn't one (`… requires that 'Decimal' conform to '_IntentValue'`); use `Double` or `IntentCurrencyAmount`.
- **Identity**: the `id` must survive relaunch, reinstall, and other devices (saved shortcuts sync). A server id or stored `UUID` works; `UUID()` created at launch, a row id, an array index, or a Photos `localIdentifier` doesn't. A custom id type's string form is truncated past 4,096 characters. For ids that differ per device, `SyncableEntity` (`OS27`) carries both a local and a stable id; queries must handle whichever survived.
- **Ownership** (`OS27`): conform to `OwnershipProvidingEntity` so the system can add a confirmation before acting on shared or public data. Return `[]` for the person's own data: `.unknown` *is* `[]`.

```swift
enum CabinClass: String, AppEnum {
    // ✅ Saved shortcuts store "economy": spell values out, never rename, only append (an implicit Int raw value is a position)
    case economy = "economy"
    case business = "business"

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Cabin"
    // Every case needs an entry: a missing one is a run-time crash, not a build error
    static let caseDisplayRepresentations: [CabinClass: DisplayRepresentation] = [
        .economy: "Economy", .business: "Business",
    ]
}
```

## Queries and Parameters

- `entities(for:)` is a batch lookup: fetch all ids in one query, and return fewer entities for ids that no longer exist instead of throwing.
- `suggestedEntities()` defaults to `[]`, which leaves the Shortcuts picker empty. Siri AI tools don't use suggestions (`skills/siri-ai.md`).
- `entities(matching:)` gets the raw string; nothing filters for you. `EnumerableEntityQuery.allEntities()` loads every entity, so keep it to small sets.
- A query can't read the intent's other parameters directly. Use `@IntentParameterDependency`, and read only the key paths it lists: reading another one is a `fatalError`.
- A non-optional `AppEnum` parameter prompts with `requestDisambiguationDialog` (a picker), not `requestValueDialog`; a single-case enum is filled with no prompt.
- A parameter left out of `parameterSummary` doesn't appear in the Shortcuts editor.

## Shaping Intents

- **Pick the type by the data**: a fixed set is an `AppEnum`; dynamic data the app stores is an `AppEntity` with a query; free text is a plain `@Parameter`.
- **One intent per task.** `ManageNoteIntent` with an `action` switch is one entry in Siri, Shortcuts, and prediction. Split it into `DeleteNoteIntent`, `PinNoteIntent`, and so on. A mode `AppEnum` is acceptable only for closely related actions on the same value, with every case described (Apple's Siri AI guidance).
- **Opening content**: an `OpenIntent` exposes `target` and the system foregrounds the app. To open a URL, return `.result(opensIntent: OpenURLIntent(url))`. `URLRepresentableIntent`/`Entity`/`Enum` need universal links, not custom schemes, and their URL format is a public contract.
- **Localization**: titles, dialogs, and descriptions are `LocalizedStringResource`. Interpolate the `AppEnum` or entity itself (`"Starting \(workoutType) workout"`), not a computed English `String`. Format numbers and currency with `format:`.

## Long-Running Work

- A background intent gets about 30 s on iOS, iPadOS, watchOS, tvOS, and visionOS before the system ends it; macOS has no limit.
- `LongRunningIntent` (`OS27`) hands the work to a system background task with `performBackgroundTask(options:)`, and its `progress` drives a system Live Activity with no UI code. `.requiresGPU` declares GPU need. The `onCancel:` overload needs `CancellableIntent`.
- `CancellableIntent` (26.4): `withIntentCancellationHandler { … } onCancel: { reason in }`, where the reason is `.timeout` or `.userCancelled`.
- `UndoableIntent` (26.0): its `undoManager` is `@MainActor`.

## Check the Built Metadata

A successful build can export no App Intents metadata. The system then has none of the app's intents, and Siri declines every request to the app (observed: "Pantry Planner doesn't support that.", "I can't plan meals in Pantry Planner."). Before testing a build, confirm `MyApp.app/Metadata.appintents/extract.actionsdata` exists (macOS: `Contents/Resources/Metadata.appintents/`). Check for the file, not the folder: it can exist holding only `Skills.skillsc`. Then confirm the file names each new intent type, and its `outputType` when it returns a value.

- Missing, with `warning: Metadata extraction skipped, no AppIntents.framework dependency found` in the build log: an occasional incremental Debug build on Xcode 27.3 beta, trigger unknown. A clean build restores the metadata. For repeated device test builds, `xcodebuild … ENABLE_DEBUG_DYLIB=NO` (which drops the SwiftUI preview dylib's link step) kept the metadata in testing; keep the check anyway.
- A failed build with `no AppIntents metadata have been exported` as an error: the metadata step rejected something. Fix that error first.

## Resources

**Docs**: /appintents/appdependencymanager, /appintents/appintenterror, /appintents/intentdonationmanager, /appintents/openurlintent, /appintents/longrunningintent, /appintents/cancellableintent

**Skills**: app-intents-ref, siri-ai, siri-evaluations-ref, app-schemas-ref, axiom-concurrency
