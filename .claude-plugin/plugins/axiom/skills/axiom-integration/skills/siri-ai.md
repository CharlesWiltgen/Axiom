# Siri AI: Custom Actions and Content

From 27.3, Siri AI (the Apple Intelligence Siri) can call **any** app intent you mark as a tool, write parameter values itself, read your entities' properties, show your card snippets, and follow task guidance you ship as App Skills. Before 27.3, only intents and entities that fit an app schema domain reached it. Apple ships this as the **Siri AI Developer Preview**.

| Feature | API | Platforms |
|---|---|---|
| Let Siri call an intent | `@AppIntent(.tool)` → `ToolIntent` | iOS, macOS, visionOS 27.3; not watchOS/tvOS |
| Let Siri write a parameter value | `@AppEntity(.generable)` → `GenerableEntity` | iOS, macOS, visionOS 27.3; not watchOS/tvOS |
| Describe, protect, or hide entity properties | `@Property`/`@ComputedProperty`/`@DeferredProperty` `description:`, `authenticationPolicy:`, `visibility:` | all, 27.3 (`indexingKey:` variants not watchOS/tvOS) |
| Show an entity as a branded card | `SnippetRepresentableEntity` + `CardSnippet` | all, 27.3 |
| Teach multi-step tasks | `Skills.skillsbundle` with `SKILL.md` files | Xcode 27.3 |
| Check metadata quality | `xcrun sirimetadataanalyzer` (Apple's DocC also names a "Siri Integration Advisor" in Xcode; the CLI is what an assistant can run) | Xcode 27.3 |
| Test Siri end to end | SiriEvaluations (`skills/siri-evaluations-ref.md`) | iOS, macOS, visionOS 27.3; physical device |

**Preview limits.** It works on Apple Intelligence devices in a supported language, for builds signed with a development profile and for TestFlight **internal** testers. It isn't available to external TestFlight testers or App Store builds; Apple's announcement says App Store submission opens "in the spring". No entitlement or separate program is needed. The API may change during the preview.

**Apple's own guide is on disk.** Xcode 27.3 ships Apple-authored coding-assistant skills as plain markdown: `$(xcode-select -p)/../PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/siri-app-integration.idechatprompttemplate` with `siri-app-integration-ref-{tool-intents,generable-entities,entity-properties,skills-bundle,metadata-analyzer}.md.packaged`. Read the matching one before writing code. The errata below list where beta 1 disagrees with it.

## When to Use This Skill

- "Make my app work with Siri AI" or "Apple Intelligence", with or without existing App Intents
- Adding `@AppIntent(.tool)`, `@AppEntity(.generable)`, property `description:`/`visibility:`, or a `Skills.skillsbundle`
- A tool Siri never calls, calls for the wrong request, or fills wrongly
- Running `sirimetadataanalyzer`, or a skills-bundle build error

NOT for: schema-domain adoption (`skills/app-schemas-ref.md`, `skills/app-intents-ref.md` App Schemas); App Intents mechanics (`skills/app-intents-ref.md`); fixed-phrase Siri (`skills/app-shortcuts-ref.md`); writing SiriEvaluations tests (`skills/siri-evaluations-ref.md`).

## Red Flags

| Thought | Reality |
|---|---|
| "Add a Search Products tool so Siri can find things" | Siri finds entities itself, through Spotlight (`IndexedEntity`) and `EnumerableEntityQuery`. Write tools that **act on** an entity parameter. Search/find tools duplicate Siri and compete with it |
| "`.tool` on every intent and we're done" | The model chooses and fills tools mainly from `title`, `description`, and each parameter's `title`/`description`. A tool titled "Run" with no description is effectively invisible. Fix the metadata in the same change |
| "Make the checkout intent a tool, it's what people want" | Apple's two sources disagree on intents that spend money or start something the person must start explicitly. DocC's `ToolIntent` page says they make poor tools; Apple's Xcode guide says make purchases and bookings tools and keep their confirmation. Ask the developer; if it becomes a tool, `requestConfirmation` before the irreversible step is mandatory |
| "This tool only works on the cart screen" | Tools are always callable whenever Siri can reach the app. Make it work from any state (load what it needs from storage); if it can't, don't make it a tool. Throw errors that tell the person what to do for real failures, not for a precondition the tool always has |
| "I'll write a model-only description" | No such API exists. Shortcuts, Spotlight, and Siri read the same text |
| "Put `@available(iOS 27.3, …)` on the existing intent" | That removes it from Shortcuts, Spotlight, and App Shortcuts on earlier releases. Gate the conformance in an extension instead |
| "Add `.tool` to my `.messages.sendMessage` intent too" | A primary-domain schema already reaches Siri. Never add `.tool` to one; the macro rejects most, but accepting it on a few Camera and Photos intents doesn't mean they need it |
| "The skill says check first, then act — Siri will do both" | If the check tool returns a dialog, Siri reads it out and stops after the check (measured, one app and device). Make read tools value-only (Tool Intents) |
| "A skill can explain how to call my confusing tool" | Reshape the tool. Every tool must work without a skill, because Siri calls tools whether or not a skill loads |
| "The analyzer is clean, so Siri works" | It checks metadata shape only. Test requests with SiriEvaluations and on a device |
| "Simulator is fine for this" | Siri AI, App Skills, and SiriEvaluations need a physical Apple Intelligence device |
| "A 'Show Album Details' tool returning a snippet view gives us a card" | That card appears only after that one tool runs. For a card Siri shows whenever it presents the entity, adopt `SnippetRepresentableEntity` with a `CardSnippet` (Card Snippets, below) |
| "One skill description that says what it does is enough" | Siri decides from a skill's description whether to load it. Name the requests in the person's words (in a one-app test, a summary loaded less often and a bare label like "Meal planning." never loaded for a direct request), and add a "Not for …" boundary when skills overlap |

## Adoption Order

1. **Find or create the intents.** Survey the model layer for the actions people would ask for and the data they act on. Check that entity identifiers are stable across launches; an `id` from `UUID()` at launch breaks every saved reference. Include read-only tools that return data ("what's planned for dinner?").
2. **Adopt a schema where one fits.** An action that matches a primary-domain schema (Audio, Calendar, Camera, Clock, Mail, Maps, Messages, Notes, Phone, Photos, Reminders, System, Video) uses `@AppIntent(schema:)` without `.tool` (`skills/app-schemas-ref.md`).
3. **Make each tool clear from its own metadata**, return useful values, throw useful errors (below).
4. **Add `.tool`** to the intents that pass Don't make a tool and the payments rule (Tool Intents), not to every intent.
5. **Make plain-value parameters generable** (below).
6. **Describe every exposed property** of every entity a tool takes or returns.
7. **Build, run `sirimetadataanalyzer`, fix, repeat** until it exits 0.
8. **Add App Skills** only where a task needs context or orchestration the metadata can't carry.
9. **Test** with SiriEvaluations and by hand on a device.

Keep `perform()` thin and make it persist: Siri can run a tool while the app isn't on screen, and the app can exit afterward, so in-memory-only state is lost. Every tool also has to pass the general App Intents traps — dependencies registered for a cold launch, `perform()` safe to re-run, declared results, Siri-readable errors, `@Property` visibility, stable ids — in `skills/app-intents.md`. Read it first.

## Tool Intents

```swift
@available(iOS 27.3, macOS 27.3, visionOS 27.3, *)
@AppIntent(.tool)
struct AddToCart: AppIntent {
    static let title: LocalizedStringResource = "Add to Cart"
    static let description = IntentDescription("Adds a product to the shopping cart.",
                                               searchKeywords: ["basket", "add"])

    @Parameter(title: "Item", description: "The product to add")
    var item: ProductEntity

    @Parameter(title: "Quantity", default: 1)
    var quantity: Int

    func perform() async throws -> some IntentResult & ReturnsValue<CartEntity> {
        .result(value: try await Cart.shared.add(item, quantity: quantity))
    }
}
```

- The macro adds `ToolIntent` (which refines `AppIntent` and adds no requirements). `struct X: AppIntent, ToolIntent` is equivalent. Traits: `.tool` or `[.tool]`, written inline; a trait in a variable, a duplicate trait, or `@AppIntent([])` with no schema is a build error.
- **When Siri can call it**: the request names the app, the app is in the foreground, a Live Activity from the app is running, an entity from the app was retrieved from search, or the person continues a Siri conversation that mentioned the app. In testing on one iPad, a request that didn't name the app never reached its tool, even with an `IndexedEntity`: Siri used a built-in app such as Calendar, or asked "I can help you with requests like that in <App> from now on. Is that OK?" Answering yes ran the tool that once, but later app-less requests went to the built-in app again (`skills/siri-evaluations-ref.md`, Name the app). Tell people to name the app; don't promise app-less requests.
- **Metadata the model reads**: the intent's `title` and `description` (say what it does and what it affects; tell similar intents apart), each parameter's `title` and `description` (meaning and format: "Duration in minutes"; omit when the title says it all, like "Quantity"), and `IntentDescription(searchKeywords:)` for words people use that the text doesn't. A mode parameter is an `AppEnum` with every case described; split the tool if the modes take different parameters.
- **No dialog from a read step.** A tool Siri uses to look something up before acting ("Get Meal Plan" before "Plan Meal") should return a value only, not `ProvidesDialog`: Siri speaks a returned dialog as its answer and ends the turn. In testing on one app on one iPad, when an App Skill had Siri check first, the check's dialog ("nothing is planned for Dinner on Friday.") became the reply and Plan Meal never ran; rewording the skill didn't help, and making the read tool value-only fixed it. A value-only read tool still answered direct questions in full sentences ("Pad Thai is planned for lunch on Monday."). Keep dialogs for tools that finish the request: Siri reads that dialog verbatim after "From <App>:", and without one it words its own reply or says nothing. Don't rely on a skill step *after* the action ("then offer to add the ingredients" never ran). Put what the person must hear in the finishing tool's dialog.
- **Output the model reads**: return a value a next step can use, and declare it: `some IntentResult & ReturnsValue<OrderEntity>`. A bare `some IntentResult` that returns `.result(value:)` compiles, but the value's type isn't exported to the App Intents metadata (measured), so the system can't see it; throw errors whose message says what went wrong and what fixes it. Only errors conforming to `CustomLocalizedStringResourceConvertible` carry a message.
- **Entity parameters**: the entity's query needs `entities(for:)`. For Siri to find candidates from what the person said, prefer `IndexedEntity` (Spotlight lookup without launching the app; Apple says it's found even when the request doesn't name the app, but in testing app-less requests never reached the tool, so routing failed before any lookup: When Siri can call it, above); use `EnumerableEntityQuery` for small sets that can't be indexed. For privacy, Siri sends a query to the app only when the request names the app, so `EnumerableEntityQuery` entities aren't found otherwise. For tools, Siri doesn't use `suggestedEntities()`, `EntityStringQuery`, or `EntityPropertyQuery` (which surface uses which: `skills/app-intents-ref.md`, Which Surface Uses Which Lookup). Make `displayRepresentation` specific (title plus a distinguishing subtitle), never an internal ID.
- **macOS known issue (27.3 beta, 191273925)**: Siri on macOS can't find a third-party app's Spotlight-donated entities unless they conform to a schema. Test entity lookup on iOS until it's fixed. On one Mac, a non-schema `IndexedEntity` that also had an `EnumerableEntityQuery` still reached the tool with the right entity in most app-named requests; don't work around the issue with a search tool.
- **Context Siri also uses**: annotate onscreen views with their entities so "this one" resolves, give entities a `Transferable` representation so they can move to another app, and donate intents when people perform them, which Siri uses to tell intents apart (`skills/app-intents-ref.md` Onscreen Entities, Cross-app content; `skills/core-spotlight-ref.md`).
- **Don't make a tool** of a search or find intent (a free-text query, or criteria whose job is to locate entities; Siri finds entities itself, Red Flags), of an intent that only works while the app runs or on one screen, of a `WidgetConfigurationIntent` with no `perform()`, of an intent that's only useful as one step inside a shortcut (DocC), or of an intent that duplicates a built-in Siri feature (timers, messages, music, HomeKit) unless its text says what's app-specific. Good candidates are actions a person can ask for in one sentence, with parameters Siri can fill from it ("add two packs of AA batteries to my cart").
- **Payments and other explicit-start actions**: see the Red Flags row. Whether one becomes a tool is the developer's call; the confirmation is not. For any tool that spends, books, sends, or deletes, call `requestConfirmation` in `perform()` before the effect, even one that can be undone later. A dialog or App Skill text is not a confirmation. Siri can run tools on a locked device, so also set the intent's `authenticationPolicy` (`skills/app-intents-ref.md`, Authentication Policies).
- **Identity is a contract**: adding `.tool` doesn't change identity, but renaming the type, adding, removing, or renaming a parameter, changing an `id` scheme, or renumbering an `AppEnum` breaks saved shortcuts and donations. Flag such a change to the developer; never make it as a side effect, and make a new parameter optional where possible.

### Schema intents

Add `.tool` only to an intent in a **Shortcuts-specific** domain (Books, Browser, Files, Journal, Presentation, Reader, Spreadsheet, Whiteboard, WordProcessor): `@AppIntent(.tool, schema: .journal.createEntry)`. The schema contract still applies. A primary-domain schema already reaches Siri, and single-purpose ones (Assistant, Visual Intelligence) serve their own surface, so never add `.tool` to those. The macro enforces part of this, **per intent, not per domain**:

```
error: 'ToolIntent' can't be adopted by an intent that conforms to '.messages.sendMessage' because the schema is in a primary domain (from macro 'AppIntent')
```

What the macro accepts in the 27.3 SDK, `.tool` on every schema intent (a record of the compiler, not of how Siri routes):

| Domain | `.tool` |
|---|---|
| Audio, Calendar, Clock, Mail, Maps, Messages, Notes, Phone, Reminders, System, Video | Blocked, every intent |
| Camera | Allowed: `openInCaptureMode`, `setDevice`, `stopCapture`. Blocked: `startCapture`, `switchDevice` |
| Photos | Allowed: `copyEdits`, `deleteAssets`, `duplicateAssets`, `pasteEdits`, `setDepth`, `setExposure`, `setRotation`, `setSaturation`, `straighten`, `toggleDepth`, `updateAsset`, `updateRecognizedPerson`. The other 16 are blocked |
| Books, Browser, Files, Journal, Presentation, Reader, Spreadsheet, Whiteboard, WordProcessor | Allowed, except `browser.search` |
| Assistant, Visual Intelligence | Allowed; don't add it |

Accepting `.tool` doesn't mean the intent needs it: DocC gives Siri phrases for Photos intents the macro accepts (`deleteAssets`, `straighten`) and for `camera.openInCaptureMode`. Don't adopt the deprecated `books.search`, `journal.search`, `books.playAudiobook`, or `browser.search` (use `.system.searchInApp`, `.audio.playAudio`), and never put `.tool` on a search schema: Siri finds entities itself. `@AppEntity(.generable, schema:)` exists, but no entity schema is transient, so don't use it.

### Deployment target below 27.3

```swift
struct AddToCart: AppIntent { … }                 // unchanged; still in Shortcuts on 26

@available(iOS 27.3, macOS 27.3, visionOS 27.3, *)
extension AddToCart: ToolIntent {}
```

New intents that only need 27.3 can take `@available` on the type with `@AppIntent(.tool)`. A target that also builds for watchOS or tvOS needs `#if !os(watchOS) && !os(tvOS)` around the conformance; `@available(…, *)` alone isn't enough. Whether new intents exist before 27.3 is the developer's product decision. Ask; if they don't say, make new intents and entities 27.3-only and tell them they won't appear in Shortcuts or Spotlight on earlier releases.

## Generable Entities

```swift
@available(iOS 27.3, macOS 27.3, visionOS 27.3, *)
@AppEntity(.generable)
struct FlightSearch: TransientAppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Flight Search"

    @Property(title: "Origin", description: "IATA code of the departure airport, such as SFO")
    var origin: String
    @Property(title: "Destination", description: "IATA code of the arrival airport, such as LAX")
    var destination: String
    @Property(title: "Date", description: "The day to depart")
    var date: Date
    @Property(title: "Cabin", description: "The cabin class to search")
    var cabin: CabinClass                 // an AppEnum

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(origin) → \(destination)")
    }

    init() {}
}
```

- The model writes the whole value from the request; no query runs, and `perform()` receives it. Validate it in `perform()`.
- Use it for plain values a tool acts on: a draft, a time window, a plan. Not for objects the app owns (products, contacts, orders), and not for search criteria.
- Prefer one generable entity over a long list of related parameters; the same type can be one tool's input and another's output.
- Every property must be a `@Property` value type, an `AppEnum`, another generable entity, an array of these, or an optional. A non-generable entity property **fails the build**: `'FlightSearch' is a 'GenerableEntity', but property 'airline' is 'Airline', which the model cannot author…`, followed by `no AppIntents metadata have been exported`, so none of the app's intents reach Siri. Move the app-owned entity to its own intent parameter (optional if possible, and flag it: a new parameter changes the intent's shape for saved shortcuts).
- Every property needs a description precise enough to write from: format, unit, and an example. Say what leaving an optional out means; no sentinel values.
- Existing entity shipping before 27.3: `extension StudyPlan: GenerableEntity {}` under `@available(iOS 27.3, macOS 27.3, visionOS 27.3, *)`.

## Entity Properties

```swift
@available(iOS 27.3, macOS 27.3, visionOS 27.3, *)
struct BankAccount: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Bank Account"
    static let defaultQuery = BankAccountQuery()
    static let authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed   // 27.3: entity-wide minimum

    var id: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(nickname)") }

    @Property(title: "Nickname", description: "The name the account holder gave this account.",
              authenticationPolicy: .requiresAuthentication)
    var nickname: String

    @Property(title: "Balance", description: "The current balance, including pending transactions.",
              authenticationPolicy: .requiresLocalDeviceAuthentication)   // preview: may show without unlock (190573761)
    var balance: IntentCurrencyAmount

    @Property(title: "Routing Number", visibility: .internal)    // app and its extensions only
    var routingNumber: String
}
```

- Argument order: `title:`, `description:`, `authenticationPolicy:`, `visibility:`, then `indexingKey:` or `customIndexingKey:`.
- The model reads `displayRepresentation` and every exposed property's title and description, for every entity it sees, not only generable ones. Expose what tells entities apart, what people ask about, and what a next step needs. Describe units, time zones, and formats. Use an `AppEnum` for fixed value sets.
- **Entity-level `authenticationPolicy`** (27.3) applies to the entity and every property; a property that passes `nil` gets it. The SDK doc comment calls it "the minimum policy for each of the entity's properties": a property's own policy can be stricter, and "a weaker one is raised to this policy" (untested on device). The default is `.alwaysAllowed`. A property policy covers Siri's responses only; if the intent *result* is sensitive, set the policy on the intent.
- **`visibility: .internal`** hides a property from Siri, Shortcuts, and the model while the app, widgets, and controls keep it. Don't combine it with `indexingKey:`/`customIndexingKey:`, which make the property discoverable in Spotlight.
- **On a schema entity it isn't enough for schema-defined properties.** `@Property(visibility: .internal)` on `.photos.asset`'s `location` exports `isDiscoverable: false`, but the schema still maps it to the Spotlight `place` key (measured), which is the combination above. For sensitive data in a schema property, don't put it there: return `nil`, or a coarser value such as a city.
- **Known issue (27.3 beta, 190573761)**: Siri AI might show an entity whose entity- or property-level `authenticationPolicy` requires unlock without asking for the unlock. During the preview, keep data that must never show on a locked device out of exposed properties (`visibility: .internal`) rather than relying on the policy alone.
- **Shipping before 27.3**: these arguments need 27.3, and a stored property can't be gated, so on an entity that isn't itself 27.3-only they fail with `'init(title:description:authenticationPolicy:visibility:)' is only available in iOS 27.3 or newer` until the deployment target is 27.3. Until then, make the title carry the meaning, put formats in the tool parameter's description, and **don't expose a sensitive property you can't hide yet**.

## Card Snippets

```swift
@available(iOS 27.3, macOS 27.3, visionOS 27.3, *)
extension ProductEntity: SnippetRepresentableEntity {
    static var snippet: some EntitySnippetContent<Self> {
        CardSnippet(supportedFamilies: [.standard]) { product, context in
            ProductCard(product: product)     // switch on context.family when you support several
        }
    }
}
```

- Siri shows the card in responses and conversation transcripts; families you don't list fall back to `displayRepresentation`.
- The card is the app's own view, so it can show any value the app can read, including `visibility: .internal` properties and ones behind an `authenticationPolicy`, and Siri keeps it in transcripts. Show only what the entity exposes to Siri.
- The system renders the view and archives a snapshot, possibly while the app isn't running. Prepare all data before returning the view; anything that loads asynchronously afterward doesn't appear.
- **Beta 1 has only `CardSnippetFamily.standard`.** Apple's docs show `[.compact, .standard]`, and `CardSnippetSize.small` is deprecated with `renamed: "CardSnippetFamily.compact"`, but `.compact` isn't in the 27.3 SDK on any platform: `type 'CardSnippetFamily' has no member 'compact'`. `CardSnippetSize` (`.small`/`.medium`) and `CardSnippetContext` claim 27.0 availability but first appear in the 27.3 SDK; `CardSnippetSize` is already deprecated, so don't adopt it.

## App Skills

A `Skills.skillsbundle` in the app target holds one `SKILL.md` per skill. Siri reads a skill's `description` to decide whether it applies, then reads the body. A skill explains a kind of task (what "clean up" means in this app, the user's vocabulary) and how to combine tools for it. It can't force a sequence; Siri doesn't run the listed tools deterministically.

**Write one when** a task needs context the tools can't carry, takes several tools in a particular order, the same request could mean different tasks, Siri should ask instead of guessing, or there's something it must never do (enforce that in the tool too, since the skill may not load). Otherwise good metadata is enough; one skill per kind of task, not per tool.

```
Skills.skillsbundle/
└── Skills/
    └── meal-planning/
        └── SKILL.md
```

```markdown
---
name: meal-planning
description: Put a recipe on the meal plan for breakfast, lunch, or dinner on a specific day. Use when the user asks to plan, schedule, or put a recipe on the menu. Not for adding single items to the shopping list.
---

Before planning, use the Get Meal Plan tool for that day. If a different
recipe is already planned for that meal, ask before replacing it.
If the user didn't say which meal, ask; don't assume dinner.

## Don't
- Don't plan meals the user didn't ask for.
```

This skill works only if Get Meal Plan returns a value with no dialog (Tool Intents, No dialog from a read step).

| Rule | Detail |
|---|---|
| Bundle | File ▸ New ▸ File from Template ▸ Skills Bundle, name `Skills`, app target. One `.skillsbundle` per target. It must be in **Copy Bundle Resources**; a bundle outside a build phase is silently not compiled |
| Layout | `Skills/` required; one folder per skill containing `SKILL.md`. Only `SKILL.md` ships — `references/`, scripts, and other files are ignored |
| `name` | Required; 1–64 of `a-z`, `0-9`, `-`; no leading/trailing hyphen, no `--`; must equal the folder name; keep it stable across versions |
| `description` | Required, one line, ≤1,024 characters. Name the requests in the user's words, specific enough to beat the app's other skills, with boundaries ("Not for …"). In one test, a summary loaded less often, and a bare label like "Meal planning." lost every direct request (below) |
| Other frontmatter | Only `name` and `description` are read (an Agent Skills subset); `license`, `allowed-tools`, `metadata`… are ignored. Apple says they warn; on beta 1 `license:` drew no warning |
| Body | Free-form markdown, ≤10,000 characters. Refer to tools by title in natural language ("the Plan Meal tool"), never Swift type names. Order the steps, say how to choose, when to ask, what not to do. Steps after the final tool call didn't run (Tool Intents, No dialog from a read step). Don't restate intent metadata |
| Uniqueness | Names must be unique across the app, its extensions, and embedded frameworks; on a clash one is kept arbitrarily and the build doesn't warn |

**Any skills error ships no skills at all**, not just the broken one. The build checks format only; a vague description or Swift type names in the body pass silently. Diagnostics from the 27.3 build:

| Problem | Diagnostic |
|---|---|
| Unquoted `: ` in `description` | `error: 'meal-planning': YAML syntax error: mapping values are not allowed in this context` — quote the value |
| `name: Plan_Trip` | `error: 'Plan_Trip': Invalid identifier format 'Plan_Trip'. Identifier must be 1-64 characters, contain only lowercase alphanumeric characters (a-z, 0-9) and hyphens…` |
| `name` ≠ folder name | `error: 'meal-planning': The 'name' field must match the parent directory name` |
| Frontmatter only | `warning: 'meal-planning': Expected a non-empty markdown body after the frontmatter` |
| Extra top-level folder | `warning: Unexpected directory in 'Skills.skillsbundle': 'Extra'` |
| Extra file beside `SKILL.md` | No diagnostic; not shipped |

Skills don't load every time; on an iPad, Siri still called the right tool from metadata when a skill didn't load. Treat a skill as context, never as the only way a task works.

The description decides whether the skill loads. In a one-app test that changed only the description, requests in the user's words plus a "Not for …" boundary loaded most reliably, a summary of what the skill does loaded less often, and a bare label ("Meal planning.") never loaded for a direct request. No version loaded for a neighboring skill's request. On the iPad, in every app-named turn Siri called the right tool regardless, so a weak description cost the skill's guidance, not the action. The "Not for …" clause wasn't tested there; keep it for skills whose requests overlap.

After building, check for `Skills.skillsc` in `MyApp.app/Metadata.appintents/` (macOS: `Contents/Resources/Metadata.appintents/`). A successful build with no `.skillsc` means the bundle isn't in Copy Bundle Resources. Check for `extract.actionsdata` there too: a successful build can ship no App Intents metadata, and then Siri declines every request to the app (`skills/app-intents.md`, Check the Built Metadata). Test on a device: try each request the description names, rephrase it, and cover each skill with a `Loads(.required)` evaluation. Test the Mac separately; iPad results didn't carry over. With the same app on a Mac, app-named requests got "I can help you with requests like that in <App> from now on. Is that OK?" instead of a tool call until the first "Yes" (Siri named the app by its bundle name, not its display name). After that the acting tool ran for most app-named requests, but some were refused ("I can't do that in <App>"), the skill rarely loaded, and a question about an empty slot was answered without calling the read tool.

## Siri Metadata Analyzer

```sh
xcrun sirimetadataanalyzer path/to/MyApp.app --format json   # or Metadata.appintents, extract.actionsdata
```

- Reads **built** metadata. If the build failed, it reports the previous build. Exit `0` = no error-level findings, `2` = some, `1` = couldn't run. `--language fr` per shipping localization; `--config <json>` disables, re-severities, or suppresses rules (suppress only behavior the developer chose to keep).
- Text output: `MyApp.app — 2 intents (2 tools), 5 entities`, then one finding per line (`warning SMA601 CartEntity …`) and a count line.
- `SMA109` (info) fires even when every intent is a primary-domain schema intent that Siri already handles. Measured on Apple's messaging sample: `The app has 6 intents but none is a tool, so Siri can't call any of them`. Don't add `.tool` to those (build error); it applies only to custom intents.
- Findings named by Apple: `SMA109` (no intent is a tool), `SMA202` (parameter has no description; fine when the title says it all), `SMA203` (entity property has no description), `SMA601` (entity exposes no properties), `SMA701` (tool closely matches a system schema: adopt the schema, or make the text say what's app-specific).
- It doesn't catch overlapping tools, vague skill descriptions, or Swift type names in skills.

## Verification Ladder

0. Source scan: `/axiom:audit siri-ai`, or `/axiom:siri` for the whole build-and-analyze loop.
1. AppIntentsTesting: `perform()` behavior (`skills/app-intents-ref.md`).
2. Shortcuts: intents appear under the app, parameter summaries read naturally.
3. Spotlight on a device: entities are indexed and open the right scene.
4. `sirimetadataanalyzer` clean.
5. SiriEvaluations scenarios, run several times (`skills/siri-evaluations-ref.md`).
6. By hand on a device: foreground and background, with and without naming the app, onscreen references ("this one"), cross-app ("send it to my partner"), voice-only (AirPods), every shipping language.

## Apple Docs Errata (27.3 beta 1)

| Source says | Measured |
|---|---|
| `FlightSearch.displayRepresentation` returns `"\(origin) → \(destination)"` (DocC article) | Doesn't compile: `DisplayRepresentation` is `ExpressibleByStringLiteral` only. Use `DisplayRepresentation(title: "\(origin) → \(destination)")` |
| `CardSnippet(supportedFamilies: [.compact, .standard])` (SDK doc comments) | `.compact` doesn't exist; only `.standard` |
| `.tool` on any primary-domain schema intent is a build error (Xcode guide) | Per intent: 3 Camera and 12 Photos intents accept `.tool` and export `ToolIntent`. Still don't add it |
| Files is a primary domain whose intents can't be tools (Xcode guide) | DocC lists Files as Shortcuts-specific, and `.tool` builds on all five Files intents |
| Siri AI is available on watchOS 27.3 (news post) | The developer APIs are unavailable on watchOS and tvOS |
| Placing an order and paying makes a poor tool (DocC `ToolIntent`) vs. purchases and bookings should be tools (Xcode guide) | Unresolved; not measurable without device runs. Ask the developer, and confirm before the irreversible step |

## Resources

**Docs**: /appintents/siri-ai-developer-preview, /appintents/bringing-custom-actions-and-content-to-siri, /appintents/orchestrating-complex-actions-with-app-skills, /appintents/toolintent, /appintents/generableentity, /appintents/intentvisibility, /appintents/verifying-your-app-intents-implementation, /sirievaluations

**Skills**: siri-evaluations-ref, app-intents-ref, app-schemas-ref, core-spotlight-ref, app-shortcuts-ref, axiom-security (agentic-security)
