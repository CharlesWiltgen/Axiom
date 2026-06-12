
# Foundation Models Framework — Complete API Reference

## Overview

The Foundation Models framework provides access to Apple's on-device Large Language Model with a Swift API, and — new in the 27 cycle (`OS27`) — to a larger server-hosted model on Private Cloud Compute. This reference covers every API and the WWDC 2025 and 2026 code examples.

### Model Specifications

**On-device model.** A 3B-parameter, 2-bit-quantized LLM that runs entirely on-device — no network, no cost, no data leaves the device. Optimized for summarization, extraction, classification, and generation. NOT suited for world knowledge, complex reasoning, math, or translation.

The 27-cycle on-device model was rebuilt (`OS27`): better at logic and tool calling, fewer guardrail false positives, and an **8,192-token** context window — double the original 4,096. Always read `SystemLanguageModel().contextSize` at runtime instead of hard-coding the limit.

**Private Cloud Compute model (`OS27`, not tvOS).** For work the on-device model can't handle, `PrivateCloudComputeLanguageModel` runs a larger server-hosted model on Apple's Private Cloud Compute — a **32,000-token** context window plus multi-level reasoning, with the same privacy posture (no account, no API keys, no stored prompts). It carries an entitlement and is the first time Foundation Models reaches **watchOS** (`watchOS27`). See [Private Cloud Compute](#private-cloud-compute-os27).

---

## When to Use This Reference

Use this reference when:
- Implementing Foundation Models features
- Understanding API capabilities
- Looking up specific code examples
- Planning architecture with Foundation Models
- Migrating from prototype to production
- Debugging implementation issues

**Related Skills**:
- `axiom-ai (skills/foundation-models.md)` — Discipline skill with anti-patterns, pressure scenarios, decision trees
- `axiom-ai (skills/foundation-models-diag.md)` — Diagnostic skill for troubleshooting issues

---

## LanguageModelSession

### Overview

`LanguageModelSession` is the core class for interacting with the model. It maintains conversation history (transcript), handles multi-turn interactions, and manages model state.

### Creating a Session

**Basic Creation**:
```swift
import FoundationModels

let session = LanguageModelSession()
```

**With Custom Instructions**:
```swift
let session = LanguageModelSession(instructions: """
    You are a friendly barista in a pixel art coffee shop.
    Respond to the player's question concisely.
    """
)
```

#### From WWDC 301:1:05

**With Tools**:
```swift
let session = LanguageModelSession(
    tools: [GetWeatherTool()],
    instructions: "Help user with weather forecasts."
)
```

#### From WWDC 286:15:03

**With Specific Model/Use Case**:
```swift
let session = LanguageModelSession(
    model: SystemLanguageModel(useCase: .contentTagging)
)
```

#### From WWDC 286:18:39

### Choosing a Model — `LanguageModel` Protocol (OS27)

Every `LanguageModelSession` is backed by a type conforming to the `LanguageModel` protocol. `SystemLanguageModel` (on-device) and `PrivateCloudComputeLanguageModel` (server — see [Private Cloud Compute](#private-cloud-compute-os27)) both conform, and the session initializers are generic over `some LanguageModel`:

```swift
// On-device (default)
let local = LanguageModelSession(model: SystemLanguageModel.default)

// Larger server model on Private Cloud Compute
let cloud = LanguageModelSession(model: PrivateCloudComputeLanguageModel())
```

Everything downstream — `respond(to:)`, `@Generable`, streaming, tools — is identical no matter which model backs the session. Query what a model supports before relying on a capability:

```swift
let caps = model.capabilities                  // LanguageModelCapabilities
if caps.contains(.vision) { /* image input OK */ }
// capabilities: .vision, .guidedGeneration, .reasoning, .toolCalling
```

Custom on-device models (via MLX or Core AI) and frontier server models (third-party Swift packages) conform to the same protocol — see [Ecosystem](#ecosystem-os27). `LanguageModelCapabilities` and the generalized initializers are `OS27` (not tvOS).

### Instructions vs Prompts

**Instructions**:
- Come from **developer**
- Define model's role, style, constraints
- Mostly static
- First entry in transcript
- Model trained to obey instructions over prompts (security feature)

**Prompts**:
- Come from **user** (or dynamic app state)
- Specific requests for generation
- Dynamic input
- Each call to `respond(to:)` adds prompt to transcript

**Security Consideration**:
- **NEVER** interpolate untrusted user input into instructions
- User input should go in prompts only
- Prevents prompt injection attacks

### respond(to:) Method

**Basic Text Generation**:
```swift
func respond(userInput: String) async throws -> String {
    let session = LanguageModelSession(instructions: """
        You are a friendly barista in a world full of pixels.
        Respond to the player's question.
        """
    )
    let response = try await session.respond(to: userInput)
    return response.content
}
```

#### From WWDC 301:1:05

**Return Type**: `Response<String>` with `.content` property

### respond(to:generating:) Method

**Structured Output with @Generable**:
```swift
@Generable
struct SearchSuggestions {
    @Guide(description: "A list of suggested search terms", .count(4))
    var searchTerms: [String]
}

let prompt = """
    Generate a list of suggested search terms for an app about visiting famous landmarks.
    """

let response = try await session.respond(
    to: prompt,
    generating: SearchSuggestions.self
)

print(response.content) // SearchSuggestions instance
```

#### From WWDC 286:5:51

**Return Type**: `Response<SearchSuggestions>` with `.content` property

### Generation Options

See [Sampling & Generation Options](#sampling--generation-options) for `GenerationOptions` (`sampling:`, `temperature:`, `maximumResponseTokens:`). Note that `includeSchemaInPrompt:` is a parameter on `respond(...)` / `streamResponse(...)` itself, not a `GenerationOptions` member — see [Optimization: includeSchemaInPrompt](#optimization-includeschemainprompt).

---

## Multi-Turn Interactions

### Retaining Context

```swift
let session = LanguageModelSession()

// First turn
let firstHaiku = try await session.respond(to: "Write a haiku about fishing")
print(firstHaiku.content)
// Silent waters gleam,
// Casting lines in morning mist—
// Hope in every cast.

// Second turn - model remembers context
let secondHaiku = try await session.respond(to: "Do another one about golf")
print(secondHaiku.content)
// Silent morning dew,
// Caddies guide with gentle words—
// Paths of patience tread.

print(session.transcript) // Shows full history
```

#### From WWDC 286:17:46

**How it works**:
- Each `respond()` call adds entry to transcript
- Model uses entire transcript for context
- Enables conversational interactions

### Transcript Property

`Transcript` is a `RandomAccessCollection` of `Transcript.Entry` — iterate it directly. There is no `.entries` property (`entries:` is only the `Transcript(entries:)` init label).

```swift
let transcript = session.transcript

for entry in transcript {
    // Entry is an enum: .instructions / .prompt / .toolCalls / .toolOutput / .response.
    // Text lives in per-case Segments (TextSegment.content / StructuredSegment.content),
    // not on the Entry itself.
    print("Entry: \(entry)")
}
```

**Use cases**:
- Debugging generation issues
- Displaying conversation history in UI
- Exporting chat logs
- Condensing for context management

---

## isResponding Property

Gate UI on `session.isResponding` to prevent concurrent requests:

```swift
Button("Go!") {
    Task { haiku = try await session.respond(to: prompt).content }
}
.disabled(session.isResponding)
```

#### From WWDC 286:18:22

---

## @Generable Macro

### Overview

`@Generable` enables structured output from the model using Swift types. The macro generates a schema at compile-time and uses **constrained decoding** to guarantee structural correctness.

A `@Generable(name:description:)` overload (`OS27`) lets you give the generated schema an explicit name instead of inheriting the type name — useful when two `@Generable` types would otherwise collide in the prompt schema, or to keep a stable schema name across refactors.

### Basic Usage

**On Structs**:
```swift
@Generable
struct Person {
    let name: String
    let age: Int
}

let response = try await session.respond(
    to: "Generate a person",
    generating: Person.self
)

let person = response.content // Type-safe Person instance
```

#### From WWDC 301:8:14

**On Enums**:
```swift
@Generable
struct NPC {
    let name: String
    let encounter: Encounter

    @Generable
    enum Encounter {
        case orderCoffee(String)
        case wantToTalkToManager(complaint: String)
    }
}
```

#### From WWDC 301:10:49

### Supported Types

**Primitives**:
- `String`
- `Int`, `Float`, `Double`, `Decimal`
- `Bool`

**Collections**:
- `[ElementType]` (arrays)

**Composed Types**:
```swift
@Generable
struct Itinerary {
    var destination: String
    var days: Int
    var budget: Float
    var rating: Double
    var requiresVisa: Bool
    var activities: [String]
    var emergencyContact: Person
    var relatedItineraries: [Itinerary] // Recursive!
}
```

#### From WWDC 286:6:18

### @Guide Constraints

`@Guide` constrains generated properties. Supports `description:` (natural language), `.range()` (numeric bounds), `.count()` / `.maximumCount()` (array length), and `.pattern(Regex)` (string pattern matching).

```swift
@Generable
struct NPC {
    @Guide(description: "A full name")
    let name: String

    @Guide(.range(1...10))
    let level: Int

    @Guide(.count(3))
    let attributes: [String]
}
```

#### From WWDC 301:11:20

### Constrained Decoding

**How it works**:
1. `@Generable` macro generates schema at compile-time
2. Schema defines valid token sequences
3. During generation, model creates probability distribution for next token
4. Framework **masks out invalid tokens** based on schema
5. Model can only pick tokens valid according to schema
6. Guarantees structural correctness - no hallucinated keys, no invalid JSON

**From WWDC 286**: "Constrained decoding prevents structural mistakes. Model is prevented from generating invalid field names or wrong types."

**Benefits**:
- Zero parsing code needed
- No runtime parsing errors
- Type-safe Swift objects
- Compile-time safety (changes to struct caught by compiler)

### Property Declaration Order

**Properties generated in order declared**:
```swift
@Generable
struct Itinerary {
    var name: String        // Generated FIRST
    var days: [DayPlan]     // Generated SECOND
    var summary: String     // Generated LAST
}
```

**Why it matters**:
- Later properties can reference earlier ones
- Better model quality: Summaries after content
- Better streaming UX: Important properties first

#### From WWDC 286:11:00

---

## Streaming

### Overview

Foundation Models uses **snapshot streaming** (not delta streaming). Instead of raw deltas, the framework streams `PartiallyGenerated` types with optional properties that fill in progressively.

### PartiallyGenerated Type

The `@Generable` macro automatically creates a `PartiallyGenerated` nested type:

```swift
@Generable
struct Itinerary {
    var name: String
    var days: [DayPlan]
}

// Compiler generates:
extension Itinerary {
    struct PartiallyGenerated {
        var name: String?        // All properties optional!
        var days: [DayPlan]?
    }
}
```

#### From WWDC 286:9:20

### streamResponse Method

```swift
@Generable
struct Itinerary {
    var name: String
    var days: [Day]
}

let stream = session.streamResponse(
    to: "Craft a 3-day itinerary to Mt. Fuji.",
    generating: Itinerary.self
)

for try await snapshot in stream {
    print(snapshot.content) // Incrementally updated Itinerary.PartiallyGenerated
}
```

#### From WWDC 286:9:40

**Return Type**: `ResponseStream<Itinerary>`. Its `Element` is `ResponseStream<Itinerary>.Snapshot`, which exposes `content: Itinerary.PartiallyGenerated` and `rawContent: GeneratedContent`. Iterate the stream and read `snapshot.content` for the partially generated value.

### SwiftUI Integration

```swift
struct ItineraryView: View {
    let session: LanguageModelSession
    let dayCount: Int
    let landmarkName: String

    @State
    private var itinerary: Itinerary.PartiallyGenerated?

    var body: some View {
        VStack {
            if let name = itinerary?.name {
                Text(name).font(.title)
            }

            if let days = itinerary?.days {
                ForEach(days, id: \.self) { day in
                    DayView(day: day)
                }
            }

            Button("Start") {
                Task {
                    do {
                        let prompt = """
                            Generate a \(dayCount) itinerary \
                            to \(landmarkName).
                            """

                        let stream = session.streamResponse(
                            to: prompt,
                            generating: Itinerary.self
                        )

                        for try await snapshot in stream {
                            self.itinerary = snapshot.content
                        }
                    } catch {
                        print(error)
                    }
                }
            }
        }
    }
}
```

#### From WWDC 286:10:05

### Best Practices

**1. Use SwiftUI animations**:
```swift
if let name = itinerary?.name {
    Text(name)
        .transition(.opacity)
}
```

**2. View identity for arrays**:
```swift
// ✅ GOOD - Stable identity
ForEach(days, id: \.id) { day in
    DayView(day: day)
}

// ❌ BAD - Identity changes
ForEach(days.indices, id: \.self) { index in
    DayView(day: days[index])
}
```

**3. Property order optimization**:
```swift
// ✅ GOOD - Title first for streaming
@Generable
struct Article {
    var title: String      // Shows immediately
    var summary: String    // Shows second
    var fullText: String   // Shows last
}
```

#### From WWDC 286:11:00

---

## Tool Protocol

### Overview

Tools let the model autonomously execute your custom code to fetch external data or perform actions. Tools integrate with MapKit, WeatherKit, Contacts, EventKit, or any custom API.

### Protocol Definition

```swift
protocol Tool {
    var name: String { get }
    var description: String { get }

    associatedtype Output: PromptRepresentable
    associatedtype Arguments: ConvertibleFromGeneratedContent

    func call(arguments: Arguments) async throws -> Output
}
```

Tools return their `Output` directly. There is no standalone `ToolOutput` type — return a `String` (which is `PromptRepresentable`) for natural-language results, or a `GeneratedContent` for structured results. `@Generable` structs satisfy the `Arguments` constraint, since `Generable` refines `ConvertibleFromGeneratedContent`.

### Example: GetWeatherTool

```swift
import FoundationModels
import WeatherKit
import CoreLocation

struct GetWeatherTool: Tool {
    let name = "getWeather"
    let description = "Retrieve the latest weather information for a city"

    @Generable
    struct Arguments {
        @Guide(description: "The city to fetch the weather for")
        var city: String
    }

    func call(arguments: Arguments) async throws -> GeneratedContent {
        let places = try await CLGeocoder().geocodeAddressString(arguments.city)
        let weather = try await WeatherService.shared.weather(for: places.first!.location!)
        let temperature = weather.currentWeather.temperature.value

        // Structured output: return GeneratedContent directly.
        return GeneratedContent(properties: ["temperature": temperature])

        // Or if your tool's output is natural language, declare the return type
        // as String and return text directly:
        // return "\(arguments.city)'s temperature is \(temperature) degrees."
    }
}
```

#### From WWDC 286:13:42

### Attaching Tools to Session

```swift
let session = LanguageModelSession(
    tools: [GetWeatherTool()],
    instructions: "Help the user with weather forecasts."
)

let response = try await session.respond(
    to: "What is the temperature in Cupertino?"
)

print(response.content)
// It's 71˚F in Cupertino!
```

#### From WWDC 286:15:03

**How it works**:
1. Session initialized with tools
2. User prompt: "What's Tokyo's weather?"
3. Model analyzes prompt, decides weather data needed
4. Model generates tool call: `getWeather(city: "Tokyo")`
5. Framework calls `call()` method
6. Your code fetches real data from API
7. Tool output inserted into transcript
8. Model generates final response using tool output

**From WWDC 301**: "Model autonomously decides when and how often to call tools. Can call multiple tools per request, even in parallel."

### Stateful Tools

Use `class` instead of `struct` to maintain state across tool calls. The tool instance persists for the session lifetime, enabling patterns like tracking previously returned results:

```swift
class FindContactTool: Tool {
    let name = "findContact"
    let description = "Finds a contact from a specified age generation."
    var pickedContacts = Set<String>()

    @Generable
    struct Arguments {
        let generation: Generation
        @Generable
        enum Generation { case babyBoomers, genX, millennial, genZ }
    }

    func call(arguments: Arguments) async throws -> String {
        // Fetch, filter out already-picked, return new contact
        pickedContacts.insert(pickedContact.givenName)
        return pickedContact.givenName
    }
}
```

#### From WWDC 301:18:47, 301:21:55

### Tool Output

A tool returns its `Output` value directly — there is no `ToolOutput` wrapper type. Choose the return type based on the result:

1. **Natural language** (`Output = String`):
```swift
func call(arguments: Arguments) async throws -> String {
    return "Temperature is 71°F"
}
```

2. **Structured** (`Output = GeneratedContent`):
```swift
func call(arguments: Arguments) async throws -> GeneratedContent {
    return GeneratedContent(properties: ["temperature": 71])
}
```

### Tool Naming Best Practices

**DO**:
- Short, readable names: `getWeather`, `findContact`
- Use verbs: `get`, `find`, `fetch`, `create`
- One sentence descriptions
- Keep descriptions concise (they're in prompt)

**DON'T**:
- Abbreviations: `gtWthr`
- Implementation details in description
- Long descriptions (increases token count)

**From WWDC 301**: "Tool name and description put verbatim in prompt. Longer strings mean more tokens, which increases latency."

### Multiple Tools

```swift
let session = LanguageModelSession(
    tools: [
        GetWeatherTool(),
        FindRestaurantTool(),
        FindHotelTool()
    ],
    instructions: "Plan travel itineraries."
)

// Model autonomously decides which tools to call and when
```

### Tool Calling Behavior

**Key facts**:
- Tool can be called **multiple times** per request
- Multiple tools can be called **in parallel**
- Model decides **when** to call (not guaranteed to call)
- Arguments guaranteed valid via @Generable

**From WWDC 301**: "When tools called in parallel, your call method may execute concurrently. Keep this in mind when accessing data."

---

## Dynamic Schemas

### Overview

`DynamicGenerationSchema` enables creating schemas at runtime instead of compile-time. Useful for user-defined structures, level creators, or dynamic forms.

### Creating and Using Dynamic Schemas

Build properties with `DynamicGenerationSchema.Property`, compose into schemas, then validate with `GenerationSchema`:

```swift
// Build schema at runtime
let questionProp = DynamicGenerationSchema.Property(
    name: "question", schema: DynamicGenerationSchema(type: String.self)
)
let answersProp = DynamicGenerationSchema.Property(
    name: "answers", schema: DynamicGenerationSchema(
        arrayOf: DynamicGenerationSchema(referenceTo: "Answer")
    )
)

let riddleSchema = DynamicGenerationSchema(name: "Riddle", properties: [questionProp, answersProp])
let answerSchema = DynamicGenerationSchema(name: "Answer", properties: [/* text, isCorrect */])

// Validate and use
let schema = try GenerationSchema(root: riddleSchema, dependencies: [answerSchema])
let response = try await session.respond(to: "Generate a riddle", schema: schema)

let question = try response.content.value(String.self, forProperty: "question")
```

#### From WWDC 301:14:50, 301:15:10

### Dynamic vs Static @Generable

**Use @Generable when**:
- Structure known at compile-time
- Want type safety
- Want automatic parsing

**Use Dynamic Schemas when**:
- Structure only known at runtime
- User-defined schemas
- Maximum flexibility

**From WWDC 301**: "Compile-time @Generable gives type safety. Dynamic schemas give runtime flexibility. Both use same constrained decoding guarantees."

---

## Sampling & Generation Options

**Greedy (deterministic)** — use for tests and demos. Only deterministic within same model version:
```swift
let response = try await session.respond(
    to: prompt,
    options: GenerationOptions(sampling: .greedy)
)
```

**Temperature** — controls variance. `0.1-0.5` focused, `1.0` default, `1.5-2.0` creative:
```swift
let response = try await session.respond(
    to: prompt,
    options: GenerationOptions(temperature: 0.5)
)
```

#### From WWDC 301:6:14

---

## Built-in Use Cases

### Content Tagging Adapter

**Specialized adapter for**:
- Tag generation
- Entity extraction
- Topic detection

```swift
@Generable
struct Result {
    let topics: [String]
}

let session = LanguageModelSession(
    model: SystemLanguageModel(useCase: .contentTagging)
)

let response = try await session.respond(
    to: articleText,
    generating: Result.self
)
```

#### From WWDC 286:19:19

**Beyond the built-in adapter**: the content-tagging adapter is Apple-trained and covers the common tagging / entity-extraction case. For app-specific behavior that the built-in adapter doesn't cover, the next rung is a custom adapter trained with Apple's Foundation Models Adapter Training Toolkit (Python, Developer Program-gated, produces a `.fmadapter` package delivered via Background Assets). When that path is justified — and only after exhausting prompt engineering, `@Generable`, tool calling, and the built-in adapter — see `axiom-ai (skills/foundation-models-adapters.md)` for decision discipline, `axiom-ai (skills/foundation-models-adapters-ref.md)` for the toolkit and runtime API, and `axiom-ai (skills/foundation-models-adapters-diag.md)` for adapter-specific failure modes. The Approach Triage section in `axiom-ai (skills/foundation-models.md)` has the full deflection ladder.

### Custom Use Cases

**With custom instructions**:
```swift
@Generable
struct Top3ActionEmotionResult {
    @Guide(.maximumCount(3))
    let actions: [String]
    @Guide(.maximumCount(3))
    let emotions: [String]
}

let session = LanguageModelSession(
    model: SystemLanguageModel(useCase: .contentTagging),
    instructions: "Tag the 3 most important actions and emotions in the given input text."
)

let response = try await session.respond(
    to: text,
    generating: Top3ActionEmotionResult.self
)
```

#### From WWDC 286:19:35

---

## Error Handling

### GenerationError Types

Catch `LanguageModelSession.GenerationError` cases (9 total; each carries a `Context`, and `refusal` carries `(Refusal, Context)`):
- **`.exceededContextWindowSize`** — Context limit exceeded. Condense transcript or create a new session.
- **`.guardrailViolation`** — Content policy triggered. Show a graceful message.
- **`.unsupportedLanguageOrLocale`** — Language not supported. Check `supportedLanguages`.
- **`.unsupportedGuide`** — A `@Guide` constraint isn't supported for that type. Simplify the guide.
- **`.decodingFailure`** — Output couldn't be decoded into the `@Generable` type. Retry or relax the schema.
- **`.rateLimited`** — Too many requests. Back off and retry.
- **`.concurrentRequests`** — A request was issued while `isResponding == true`. Serialize requests.
- **`.assetsUnavailable`** — Model assets unavailable. Treat like an availability failure.
- **`.refusal(Refusal, Context)`** — The model refused; read the `Refusal` for the reason (`await refusal.explanation`).

Tool failures surface separately as `LanguageModelSession.ToolCallError` (`.tool`, `.underlyingError`), not as a `GenerationError`.

#### From WWDC 301:3:37, 301:7:06

### `LanguageModelError` migration (OS27)

The whole `LanguageModelSession.GenerationError` enum is **deprecated in 27.0** (iOS/iPadOS/macOS/visionOS). The errors split across three homes — a new unified `LanguageModelError` enum (each case carrying a typed payload struct, e.g. `LanguageModelError.ContextSizeExceeded`) plus two type-specific errors:

| Deprecated `GenerationError` case | Replacement (27) |
|------------------------------------|------------------|
| `.exceededContextWindowSize` | `LanguageModelError.contextSizeExceeded(_:)` |
| `.guardrailViolation` | `LanguageModelError.guardrailViolation(_:)` |
| `.unsupportedGuide` | `LanguageModelError.unsupportedGenerationGuide(_:)` |
| `.unsupportedLanguageOrLocale` | `LanguageModelError.unsupportedLanguageOrLocale(_:)` |
| `.rateLimited` | `LanguageModelError.rateLimited(_:)` |
| `.refusal` | `LanguageModelError.refusal(_:)` |
| `.assetsUnavailable` | `SystemLanguageModel.Error.assetsUnavailable(_:)` |
| `.decodingFailure` | `GeneratedContent.ParsingError` |
| `.concurrentRequests` | `LanguageModelSession.Error.concurrentRequests` |

`LanguageModelError` also adds cases with no `GenerationError` equivalent: `.unsupportedCapability`, `.unsupportedTranscriptContent`, `.timeout`. The deprecated cases still compile on a 26.x deployment target; migrate `catch` clauses to the new types before raising the floor to 27. This is a deprecation, not an obsoletion — both error types resolve in the 27 SDK.

### Context Window Management

#### Strategy 1: Fresh Session
```swift
var session = LanguageModelSession()

do {
    let response = try await session.respond(to: prompt)
    print(response.content)
} catch LanguageModelSession.GenerationError.exceededContextWindowSize {
    // New session, no history
    session = LanguageModelSession()
}
```

#### From WWDC 301:3:37

#### Strategy 2: Condensed Session
```swift
do {
    let response = try await session.respond(to: prompt)
} catch LanguageModelSession.GenerationError.exceededContextWindowSize {
    // New session with some history
    session = newSession(previousSession: session)
}

private func newSession(previousSession: LanguageModelSession) -> LanguageModelSession {
    // Transcript is a RandomAccessCollection of Transcript.Entry — index it directly.
    let transcript = previousSession.transcript
    var condensedEntries = [Transcript.Entry]()

    if let firstEntry = transcript.first {
        condensedEntries.append(firstEntry) // Instructions

        if transcript.count > 1, let lastEntry = transcript.last {
            condensedEntries.append(lastEntry) // Recent context
        }
    }

    let condensedTranscript = Transcript(entries: condensedEntries)
    // Note: transcript includes instructions
    return LanguageModelSession(transcript: condensedTranscript)
}
```

#### From WWDC 301:3:55

### Fallback Architecture

When Foundation Models is unavailable (`.deviceNotEligible`, `.appleIntelligenceNotEnabled`, or `.modelNotReady`), provide graceful degradation:

```swift
func summarize(_ text: String) async throws -> String {
    let model = SystemLanguageModel.default
    switch model.availability {
    case .available:
        let session = LanguageModelSession()
        let response = try await session.respond(to: "Summarize: \(text)")
        return response.content
    case .unavailable:
        // Fallback: truncate with ellipsis, or call server API
        return String(text.prefix(200)) + "..."
    }
}
```

**Architecture pattern**: Wrap Foundation Models behind a protocol so you can swap implementations:

```swift
protocol TextSummarizer {
    func summarize(_ text: String) async throws -> String
}

struct OnDeviceSummarizer: TextSummarizer { /* Foundation Models */ }
struct ServerSummarizer: TextSummarizer { /* Server API fallback */ }
struct TruncationSummarizer: TextSummarizer { /* Simple truncation */ }
```

### Nested @Generable Troubleshooting

Nested `@Generable` types must each independently conform to `@Generable`:

```swift
// ✅ Both types marked @Generable
@Generable struct Itinerary {
    var days: [DayPlan]
}

@Generable struct DayPlan {
    var activities: [String]
}

// ❌ Will fail — nested type not @Generable
@Generable struct Itinerary {
    var days: [DayPlan]  // DayPlan must also be @Generable
}
struct DayPlan { var activities: [String] }
```

**Common issue**: Arrays of non-Generable types compile but fail at runtime. Check all types in the graph.

---

## Availability

### Checking Availability

```swift
struct AvailabilityExample: View {
    private let model = SystemLanguageModel.default

    var body: some View {
        switch model.availability {
        case .available:
            Text("Model is available").foregroundStyle(.green)
        case .unavailable(let reason):
            Text("Model is unavailable").foregroundStyle(.red)
            Text("Reason: \(reason)")
        }
    }
}
```

#### From WWDC 286:19:56

### Supported Languages

```swift
let supportedLanguages = SystemLanguageModel.default.supportedLanguages
guard supportedLanguages.contains(Locale.current.language) else {
    // Show message
    return
}
```

#### From WWDC 301:7:06

### Token Sizing and Context Size

`SystemLanguageModel.contextSize` reports the ceiling, and `SystemLanguageModel`'s `tokenCount(for:)` overloads give exact counts for every component of the budget:

```swift
let model = SystemLanguageModel.default

// Maximum tokens the model can hold (input + output combined).
let maxTokens: Int = model.contextSize

// Exact token counts — five overloads on SystemLanguageModel, iOS 26.4+.
@available(iOS 26.4, iPadOS 26.4, macOS 26.4, visionOS 26.4, *)
func budget(session: LanguageModelSession) async throws {
    _ = try await model.tokenCount(for: "some prompt")          // any PromptRepresentable
    _ = try await model.tokenCount(for: Instructions("..."))     // Instructions
    _ = try await model.tokenCount(for: [GetWeatherTool()])      // [any Tool]
    _ = try await model.tokenCount(for: someGenerationSchema)    // GenerationSchema
    _ = try await model.tokenCount(for: session.transcript)      // some Collection<Transcript.Entry>
}
```

**Scope and constraints**:
- `tokenCount(for:)` is a method on `SystemLanguageModel` (e.g. `SystemLanguageModel.default`), not `LanguageModelSession`, and has **five overloads**: prompt (`PromptRepresentable`), `Instructions`, `[any Tool]`, `GenerationSchema`, and transcript entries (`some Collection<Transcript.Entry>`). Exact counting **is** available for prompts and transcript entries — use these to size against `contextSize` before composing a turn.
- All overloads are `async throws`, **iOS 26.4+** (with matching iPadOS / macOS / visionOS / Mac Catalyst 26.4). Only pre-26.4 targets need to fall back to estimation.
- `contextSize` is the absolute ceiling for input + output combined. Use it as the denominator in any budget calculation.

**Estimation fallback** (pre-26.4 targets only — on 26.4+ prefer the exact overloads above):

```swift
// Pre-26.4 fallback. Empirical rule for English: ~3 characters per token;
// non-English varies (PFIGSCJK languages typically use more tokens per character).
let approxTokens = text.count / 3
```

The 3-chars-per-token heuristic is intentionally conservative; treat it as an upper-bound for English and a lower-bound for languages with multi-byte characters.

**Common pattern**: on 26.4+, count instructions, transcript, and the next prompt exactly before deciding whether to compose a turn or condense first.

```swift
@available(iOS 26.4, *)
func canAccept(_ instructions: Instructions, session: LanguageModelSession, nextPrompt: String) async throws -> Bool {
    let model = SystemLanguageModel.default
    let max = model.contextSize
    let instructionTokens = try await model.tokenCount(for: instructions)
    let transcriptTokens = try await model.tokenCount(for: session.transcript)
    let promptTokens = try await model.tokenCount(for: nextPrompt)
    let outputBudget = 512 // reserve for generation
    return instructionTokens + transcriptTokens + promptTokens + outputBudget < max
}
```

### Requirements

**Device Requirements**:
- Apple Intelligence-enabled device
- iPhone 15 Pro or later
- iPad with M1+ chip
- Mac with Apple silicon

**Apple Intelligence enabled** (when not, surfaces as `.appleIntelligenceNotEnabled`):
- User opted in to Apple Intelligence in Settings
- Available in the user's region — regional rollout gates whether Apple Intelligence can be enabled; there is no separate region `UnavailableReason` case

---

## Multimodal Image Input (OS27)

The model can take **images** in a prompt when its `.vision` capability is present. `Attachment` is built with `@PromptBuilder` and conforms to `PromptRepresentable`, so it drops into any prompt builder alongside text:

```swift
import FoundationModels

// Gate on the .vision capability; multimodal input is OS27 (not tvOS).
guard model.capabilities.contains(.vision) else { /* fall back to text-only */ return }

let response = try await session.respond {
    "What landmark is in this photo, and what era is it from?"
    Attachment(cgImage)                 // CGImage / CIImage / CVPixelBuffer
    // or: Attachment(imageURL: fileURL)
}
```

Image sources accepted (WWDC 241): `UIImage`/`NSImage`, `CGImage`, Core Image, CoreVideo pixel buffers, and file URLs — verified initializers are `Attachment(_ cgImage:orientation:)`, `Attachment(_ ciImage:orientation:)`, `Attachment(_ pixelBuffer:orientation:)`, and `Attachment(imageURL:orientation:)`. `.label("…")` annotates an attachment. Any size or aspect ratio works; larger images cost more tokens and latency. `Attachment` / `ImageAttachmentContent` are `OS27` (not tvOS).

### Image references in tool arguments — `ImageReference`

When a **tool** needs an image the user already shared in the conversation, declare its `@Generable` argument as an `ImageReference` instead of raw pixels (WWDC 237). The model fills in a *reference* to a transcript image rather than re-encoding pixels into the arguments, and the tool resolves it against the transcript:

```swift
struct PlantIdentifierTool: Tool {
    let name = "identifyPlant"
    let description = "Identify a plant from a photo in this conversation"
    @SessionProperty(\.history) var history    // the conversation's transcript entries

    @Generable struct Arguments {
        @Guide(description: "The plant photo to identify")
        var image: ImageReference
    }

    func call(arguments: Arguments) async throws -> String {
        let transcript = Transcript(entries: history)
        guard let attachment = arguments.image.resolve(in: transcript) else {
            throw PlantError.imageNotFound
        }
        let pixelBuffer = try attachment.pixelBuffer()   // CVReadOnlyPixelBuffer
        return classifyPlant(pixelBuffer)                // e.g. a Vision request
    }
}
```

`ImageReference` is `Sendable`, `Equatable`, `Generable`, with `attachmentLabel: String` and `resolve(in: Transcript) -> Transcript.ImageAttachment?`. `resolve` hands back the unwrapped `Transcript.ImageAttachment` directly — not the `Transcript.Attachment` enum — so you call `pixelBuffer()` straight on the result. `Transcript.ImageAttachment.pixelBuffer(resolution:pixelFormat:)` throws a `CVReadOnlyPixelBuffer`. The WWDC 237 slide writes `Transcript(history)`, but the framework init is labeled — `Transcript(entries:)` is the source-correct form (compile-verified). `ImageReference` is `OS27` **including watchOS 27** (not tvOS).

---

## Private Cloud Compute (OS27)

`PrivateCloudComputeLanguageModel` runs the larger, server-hosted Apple model — a **32,000-token** context window plus reasoning — on Private Cloud Compute, with the same privacy guarantees as on-device (no account, no API keys, no stored prompts). It is `OS27` (not tvOS) and is the first time Foundation Models reaches **watchOS** (`watchOS27`).

```swift
import FoundationModels

let pcc = PrivateCloudComputeLanguageModel()      // requires the PCC entitlement

switch pcc.availability {
case .available:
    let session = LanguageModelSession(model: pcc)
    let response = try await session.respond(
        to: "Summarize the key risks in this contract.",
        contextOptions: ContextOptions(reasoningLevel: .deep)
    )
    print(response.content)
case .unavailable(.deviceNotEligible):
    break   // fall back to SystemLanguageModel or a server you control
case .unavailable(.systemNotReady):
    break   // try again later
}
```

**Key points**:
- **Requires the Private Cloud Compute entitlement.** Without it the model is unavailable.
- `availability` → `.available` / `.unavailable(.deviceNotEligible | .systemNotReady)`; `isAvailable` is the Bool shortcut. `contextSize` is `async throws` (reports 32,000).
- Quota: `pcc.quotaUsage` (`.status`, `.isLimitReached`, `.resetDate`, `.limitIncreaseSuggestion`). Handle `PrivateCloudComputeLanguageModel.Error`: `.networkFailure`, `.quotaLimitReached` (its payload carries `resetDate` + `limitIncreaseSuggestion`), `.serviceUnavailable`.
- Pricing (WWDC 241): no developer cloud cost under 2M first-time downloads; users get daily PCC access, with higher limits for iCloud+ subscribers.
- `supportedLanguages` / `supportsLocale(_:)` report language coverage, same as `SystemLanguageModel`.

---

## Reasoning & Token Usage (OS27)

`ContextOptions` is a new argument on every `respond(...)` / `streamResponse(...)` overload. It carries a reasoning level and the per-call `includeSchemaInPrompt` flag:

```swift
let response = try await session.respond(
    to: "Recommend a craft that doesn't require scissors.",
    contextOptions: ContextOptions(reasoningLevel: .light)   // .light, .moderate, .deep, .custom("…")
)

// Token accounting — on the response, or cumulatively on the session
print(response.usage.input.totalTokenCount)
print(response.usage.input.cachedTokenCount)
print(response.usage.output.totalTokenCount)
print(response.usage.output.reasoningTokenCount)   // tokens spent reasoning
print(session.usage.totalTokenCount)               // running total for the session
```

`ReasoningLevel` is `.light`, `.moderate`, `.deep`, or `.custom(String)`. Reasoning is most impactful with Private Cloud Compute, though the rebuilt on-device model also reasons better in 27. `ContextOptions` and `Usage` are `OS27` (not tvOS).

---

## Dynamic Profiles (OS27)

`LanguageModelSession.DynamicProfile` is a declarative replacement for hand-rolled multi-session orchestration (rebuilding a session whenever the app's mode changes). A profile resolves to a single active `Profile` — instructions + tools + model/reasoning — and the framework transitions between branches while preserving conversation history:

```swift
struct CraftProfile: LanguageModelSession.DynamicProfile {
    let states: CraftProjectStates
    var body: some DynamicProfile {
        switch states.mode {
        case .analysis:
            Profile {
                Instructions { "You analyze craft project photos…" }
                RecordImageAnalysisTool()
                SwitchModeTool(states: states)
            }
        case .brainstorm:
            Profile {
                Instructions { "You brainstorm new project ideas…" }
                BrainstormRecordTool()
            }
            .model(states.privateCloudCompute)   // swap the model per branch…
            .reasoningLevel(.deep)               // …and the reasoning level, keeping history
        }
    }
}

let session = LanguageModelSession(profile: CraftProfile())
```

Built with `@DynamicProfileBuilder`; `if`/`switch` are backed by `ConditionalDynamicProfile`. `OS27` (not tvOS).

#### Profile modifiers

Modifiers reconfigure the active branch **without discarding the transcript**. The full set on `some DynamicProfile`:

| Modifier | Effect |
|----------|--------|
| `.model(_:)` | Swap the backing model for this branch |
| `.reasoningLevel(_:)` | Set `ReasoningLevel` for this branch |
| `.temperature(_:)` / `.samplingMode(_:)` / `.maximumResponseTokens(_:)` | Per-branch generation options |
| `.toolCallingMode(_:)` | `GenerationOptions.ToolCallingMode` — `.allowed` / `.required` / `.disallowed` |
| `.historyTransform(_:)` | Rewrite `[Transcript.Entry]` before each request — spotlight/redact history |
| `.transcriptErrorHandlingPolicy(_:)` | How malformed transcript entries are handled |
| `.onPrompt` / `.onResponse` / `.onToolCall` / `.onToolOutput` | Lifecycle hooks; each has a no-arg form and a typed form (`Transcript.Prompt`, `Transcript.Response`, `Transcript.ToolCall`, `(Transcript.ToolCall, Transcript.ToolOutput)`) |
| `.onActivate` / `.onDeactivate` | Fire when a branch becomes / stops being the active profile |

Two were renamed in 27 — the old spellings still compile but are `deprecated, renamed`: `.toolCalling(_:)` → **`.toolCallingMode(_:)`**, `.inputFilter(_:)` → **`.historyTransform(_:)`**. `historyTransform` re-applies on **every** request (per-iteration), so keep the transform pure and cheap.

The security treatment of `.onToolCall` confirmation-gating and `.historyTransform` redaction lives in `axiom-security (skills/agentic-security.md)` — cross-link, don't reimplement here.

#### Reading app state — `@SessionProperty`

A custom `DynamicProfileModifier` or profile reads live app state through `@SessionProperty`, a property wrapper keyed by `SessionPropertyValues`:

```swift
extension SessionPropertyValues {
    @SessionPropertyEntry var currentMode: CraftMode = .analysis
}

struct ModeModifier: LanguageModelSession.DynamicProfileModifier {
    @SessionProperty(\.currentMode) var mode
    func body(content: Content) -> some DynamicProfile { /* …read mode… */ content }
}
```

`SessionPropertyValues` is `Observable`; built-in entries include `\.history` (`ArraySlice<Transcript.Entry>`). Define your own with `@SessionPropertyEntry`. `DynamicProfileModifier`, `@SessionProperty`, `SessionPropertyValues` are all `OS27` (not tvOS).

---

## Dynamic Instructions (OS27)

`DynamicInstructions` is a **separate, builder-based** API (distinct from `DynamicProfile`): it re-derives the session's instructions **and tool set before every request** from current app state, instead of branching between fixed `Profile`s. This is the "re-evaluates instructions and tools before each request" surface profiled by the Foundation Models Instrument's *Instructions* lane (see `axiom-performance (skills/performance-profiling.md)`).

```swift
struct TripInstructions: DynamicInstructions {
    let trip: Trip
    var body: some DynamicInstructions {
        Instructions { "Help plan \(trip.destination). Today is \(Date.now)." }
        FlightSearchTool(trip: trip)             // tools re-evaluated per request
        if trip.hasHotel { HotelTool(trip: trip) }
    }
}

let session = LanguageModelSession(dynamicInstructions: TripInstructions(trip: trip))
```

Built with `@DynamicInstructionsBuilder`: a body may mix `Instructions`, `Tool` values, and nested `DynamicInstructions`; `if`/`switch` are backed by `ConditionalDynamicInstructions`, and `_DynamicInstructionsForEach` drives an instruction/tool set off a collection. `LanguageModelSession(model:dynamicInstructions:history:)` constructs the session; `model:` defaults to `SystemLanguageModel.default`. `OS27` (not tvOS).

**Choosing between them**: `DynamicProfile` models a *state machine* (named branches, one active `Profile`, transitions preserve history) — use it when the app has discrete modes. `DynamicInstructions` *recomputes* the instruction/tool set each request from whatever the app state currently is — use it when instructions track continuously-changing context (location, time, a live document).

---

## Custom Model Providers (OS27)

The `LanguageModel` protocol lets a `LanguageModelSession` run on a model you supply — an on-device model via MLX / Core AI, or a frontier server model from a provider shipping a conforming Swift package. You implement two protocols (WWDC 339):

```swift
public protocol LanguageModel: Sendable {
    associatedtype Executor: LanguageModelExecutor where Self == Self.Executor.Model
    var capabilities: LanguageModelCapabilities { get }   // .vision/.guidedGeneration/.reasoning/.toolCalling
    var executorConfiguration: Executor.Configuration { get }
}

public protocol LanguageModelExecutor: Sendable {
    associatedtype Configuration: Hashable, Sendable
    associatedtype Model: LanguageModel
    func prewarm(model: Model, transcript: Transcript)
    init(configuration: Configuration) throws
    func respond(to request: LanguageModelExecutorGenerationRequest,
                 model: Model,
                 streamingInto channel: LanguageModelExecutorGenerationChannel) async throws
}
```

The executor streams results by sending events into the channel — `LanguageModelExecutorGenerationChannel` is an `AsyncSequence` whose events are `.Response` (`appendText` / `replaceTextSegment` / `updateMetadata` / `updateUsage`), `.Reasoning`, and `.ToolCalls`. Declare `capabilities` honestly: the framework gates guided generation, tool calling, vision, and reasoning on what the executor advertises. `LanguageModel`, `LanguageModelExecutor`, and the channel are `OS27` **including watchOS 27** (not tvOS). For the open-source MLX/Core AI providers and third-party server packages, see the Ecosystem section.

---

## Built-in System Tools (OS27)

The 27 cycle ships native `Tool`s through cross-import overlays — no custom implementation needed:

```swift
import FoundationModels
import Vision                              // surfaces BarcodeReaderTool, OCRTool

let session = LanguageModelSession(tools: [BarcodeReaderTool(), OCRTool()])
```

- **`BarcodeReaderTool`** — Vision-backed barcode/QR reading. `OS27` including `watchOS27` (not tvOS). Optional `init(name:description:)`.
- **`OCRTool`** — Vision-backed text recognition. `OS27` except watchOS (not watchOS/tvOS).
- **`SpotlightSearchTool`** — `import CoreSpotlight` + `FoundationModels`. Runs fully local **RAG** over your Spotlight-indexed content via `SearchSource` / `CoreSpotlightSource` / `FileSource` with a `Configuration` + `Guide`. `OS27` except watchOS (not watchOS/tvOS). For the indexing side, see axiom-integration (CoreSpotlight).

---

## Ecosystem (OS27)

- The FoundationModels framework is going **open source** and runs anywhere Swift runs (including Linux).
- The `LanguageModel` protocol lets a session be backed by custom on-device models via **MLX** (`MLXLanguageModel`) or **Core AI** (`CoreAILanguageModel`) — both open-source, running on the Neural Engine / Mac GPU — or by **frontier server models** from providers (Anthropic, Google) shipping conforming Swift packages. With third-party server models you own auth + per-token billing: use OAuth + Keychain, never embed keys.
- **Evaluations** framework — measure feature quality/accuracy as you iterate on prompts (macOS tooling; not in the iOS SDK).
- **`fm` CLI** (`macOS27`) — terminal access to the on-device and PCC models (`fm chat`), scriptable into shell pipelines.
- **Foundation Models SDK for Python** (`apple_fm_sdk`) — the same on-device model from Python.
- **Core AI** is the 27-cycle on-device inference framework for authoring/compiling/running your own models (`AIModel`/`InferenceFunction`/`NDArray`, specialization & caching); `CoreAILanguageModel` is its open-source `coreai-models` Swift package, not a system-framework type. See `axiom-ai (skills/core-ai.md)`. The custom-provider plumbing behind MLX/Core AI/server models (`LanguageModel`, `LanguageModelExecutor`, `LanguageModelExecutorGenerationChannel`) is in the **Custom Model Providers (OS27)** section above.

---

## Performance & Profiling

### Foundation Models Instrument

**Access**: Instruments app → Foundation Models template

**Metrics**:
- Initial model load time
- Token counts (input/output)
- Generation time per request
- Latency breakdown
- Optimization opportunities

**From WWDC 286**: "New Instruments profiling template lets you observe areas of optimization and quantify improvements."

#### Improved instrument in Xcode 27 (OS27)

The Xcode 27 Foundation Models Instrument (WWDC 243) profiles **any** model used through the framework — on-device, a custom provider, or the Private Cloud Compute server model — and adds a six-lane timeline. Two lanes carry the most signal:

- **Instructions** — the lifetime of each active instruction/tool set. With `DynamicInstructions` a fresh set can apply per request; a static set spans many requests. This lane is the fastest way to catch the **silent tool-omission bug**: if you reference a tool in the prompt but never add it to the active instruction set, no error is thrown — the lane simply shows the one set you did configure, with your tool absent.
- **Model Inference** — yellow segments are prompt processing, orange are response generation.

The detail tree is **sessions → requests → inferences**, with an inspector and an info column that flags errors, unusually long durations, and large token counts. Prompt/response **logging is on only while a trace records** (a privacy warning gates it behind "Record Anyway"); captured text is not retained after the trace.

Three latency metrics drive optimization: **Time to First Token** (shorten the prompt / prewarm), **Tokens per Second** (benchmark for regressions), and **Total Latency** (stream partial results to mask it). The performance-engineering view of this instrument lives in `axiom-performance (skills/performance-profiling.md)` — this section owns the Foundation Models specifics.

### Optimization: Prewarming

**Problem**: First request takes 1-2s to load model

**Solution**: Create session before user interaction

```swift
class ViewModel: ObservableObject {
    private var session: LanguageModelSession?

    init() {
        // Prewarm on init
        Task {
            self.session = LanguageModelSession(instructions: "...")
        }
    }

    func generate(prompt: String) async throws -> String {
        let response = try await session!.respond(to: prompt)
        return response.content
    }
}
```

**From WWDC 259**: "Prewarming session before user interaction reduces initial latency."

**Time saved**: 1-2 seconds off first generation

### Optimization: includeSchemaInPrompt

**Problem**: Large @Generable schemas increase token count

**Solution**: Skip schema insertion for subsequent requests

```swift
// First request - schema inserted
let first = try await session.respond(
    to: "Generate first person",
    generating: Person.self
)

// Subsequent requests - skip schema.
// includeSchemaInPrompt is a parameter on respond(...)/streamResponse(...),
// NOT a member of GenerationOptions.
let second = try await session.respond(
    to: "Generate another person",
    generating: Person.self,
    includeSchemaInPrompt: false
)
```

**From WWDC 259**: "Setting includeSchemaInPrompt to false decreases token count and latency for subsequent requests."

**Time saved**: 10-20% per request

### Optimization: Property Order

Declare important properties first in `@Generable` structs. With streaming, perceived latency drops from 2.5s to 0.2s when title appears before full text. See [Streaming Best Practices](#best-practices) for examples.

---

## Feedback & Analytics

Report model quality issues to Apple via Feedback Assistant. The session method `logFeedbackAttachment(sentiment:issues:desiredOutput:)` returns `Data` you attach to a Feedback Assistant report. There is no `LanguageModelFeedbackAttachment` type — the feedback model is `LanguageModelFeedback`, with nested `Sentiment` (`.positive` / `.negative` / `.neutral`) and `Issue` (built from an `Issue.Category` plus an optional explanation).

```swift
let feedbackData = session.logFeedbackAttachment(
    sentiment: .negative,
    issues: [
        LanguageModelFeedback.Issue(
            category: .didNotFollowInstructions,
            explanation: "Returned prose instead of the requested list"
        )
    ],
    desiredOutput: nil // optional Transcript.Entry
)
// Convenience variants take desiredResponseText: or desiredResponseContent:
// instead of a Transcript.Entry.
```

#### From WWDC 286:22:13

---

## Xcode Playgrounds

### Overview

Xcode Playgrounds enable rapid iteration on prompts without rebuilding entire app.

### Basic Usage

```swift
import FoundationModels
import Playgrounds

#Playground {
    let session = LanguageModelSession()
    let response = try await session.respond(
        to: "What's a good name for a trip to Japan? Respond only with a title"
    )
}
```

#### From WWDC 286:2:28

Playgrounds can also access types defined in your app (like @Generable structs).

---

## API Quick Reference

- **`LanguageModelSession`** — Main interface: `respond(to:)` → `Response<String>`, `respond(to:generating:)` → `Response<T>`, `streamResponse(to:generating:)` → `ResponseStream<T>` (Element is `Snapshot`; read `snapshot.content` → `T.PartiallyGenerated`). `respond`/`streamResponse` also take `includeSchemaInPrompt:` (defaults `true`). Properties: `transcript`, `isResponding`.
- **`SystemLanguageModel`** — `default.availability` (`.available`/`.unavailable(reason)`), `default.supportedLanguages`, `default.contextSize`, `default.tokenCount(for:)` → `Int` (5 overloads, iOS 26.4+), `init(useCase:)`
- **`GenerationOptions`** — `init(sampling:temperature:maximumResponseTokens:)`. `sampling` (`.greedy`, `.random(top:seed:)`, `.random(probabilityThreshold:seed:)`), `temperature`, `maximumResponseTokens`. (`includeSchemaInPrompt` is NOT a `GenerationOptions` member — it has two legitimate homes: a direct parameter on the legacy `respond`/`streamResponse` overloads, and `ContextOptions(includeSchemaInPrompt:)` on the OS27 overloads.)
- **`@Generable`** — Macro enabling structured output with constrained decoding
- **`@Guide`** — Property constraints: `description:`, `.range()`, `.count()`, `.maximumCount()`, `.pattern(Regex)`
- **`Tool` protocol** — `name`, `description`, `Arguments: ConvertibleFromGeneratedContent`, `Output: PromptRepresentable`, `call(arguments:) → Output` (return `String` for text or `GeneratedContent` for structured — no `ToolOutput` type)
- **`DynamicGenerationSchema`** — Runtime schema definition with `GeneratedContent` output
- **`GenerationError`** (9 cases) — `.exceededContextWindowSize`, `.guardrailViolation`, `.unsupportedLanguageOrLocale`, `.unsupportedGuide`, `.decodingFailure`, `.rateLimited`, `.concurrentRequests`, `.assetsUnavailable`, `.refusal(Refusal, Context)`. Tool failures: `ToolCallError` (`.tool`, `.underlyingError`).

### OS27 additions

- **`LanguageModel`** (protocol) — backs any session; `SystemLanguageModel` + `PrivateCloudComputeLanguageModel` conform. `var capabilities: LanguageModelCapabilities`. Session inits are generic over `model: some LanguageModel`.
- **`LanguageModelCapabilities`** — `.contains(.vision | .guidedGeneration | .reasoning | .toolCalling)`
- **`PrivateCloudComputeLanguageModel`** — `init()`, `availability` (`.available`/`.unavailable(.deviceNotEligible|.systemNotReady)`), `isAvailable`, `quotaUsage`, `contextSize` (async, 32 000), `Error` (`.networkFailure`/`.quotaLimitReached`/`.serviceUnavailable`). Entitlement-gated. Not tvOS.
- **`Attachment<ImageAttachmentContent>`** — image prompt input: `init(_ cgImage:/ciImage:/pixelBuffer:orientation:)`, `init(imageURL:orientation:)`, `.label(_:)`. Not tvOS.
- **`ContextOptions(includeSchemaInPrompt:reasoningLevel:)`** — param on `respond`/`streamResponse`; `ReasoningLevel` = `.light`/`.moderate`/`.deep`/`.custom(String)`.
- **`session.usage` / `response.usage`** — `Usage` → `input.totalTokenCount`/`input.cachedTokenCount`, `output.totalTokenCount`/`output.reasoningTokenCount`, `totalTokenCount`.
- **`LanguageModelSession.DynamicProfile`** — `Profile { Instructions {…}; <Tools> }`, `LanguageModelSession(profile:)`; modifiers `.model`/`.reasoningLevel`/`.temperature`/`.samplingMode`/`.maximumResponseTokens`/`.toolCallingMode`/`.historyTransform`/`.transcriptErrorHandlingPolicy`/`.onPrompt`/`.onResponse`/`.onToolCall`/`.onToolOutput`/`.onActivate`/`.onDeactivate` (`.toolCalling`→`.toolCallingMode`, `.inputFilter`→`.historyTransform` renamed). Custom modifiers via `DynamicProfileModifier`; app state via `@SessionProperty(\.…)` over `SessionPropertyValues` (`@SessionPropertyEntry`).
- **`DynamicInstructions`** (protocol, `@DynamicInstructionsBuilder`) — re-derives instructions + tools per request; `LanguageModelSession(model:dynamicInstructions:history:)`. Distinct from `DynamicProfile`.
- **`LanguageModel` / `LanguageModelExecutor`** — custom model providers; executor streams `LanguageModelExecutorGenerationChannel` events (`.Response`/`.Reasoning`/`.ToolCalls`). Incl. watchOS 27.
- **`ImageReference`** — `Generable` tool-argument referencing a transcript image; `.resolve(in: Transcript)` → `Transcript.ImageAttachment` → `.pixelBuffer(...)`. Incl. watchOS 27.
- **`GenerationOptions.ToolCallingMode`** — `.allowed` / `.required` / `.disallowed`.
- **`LanguageModelError`** (9 cases, typed payloads) — replaces deprecated `GenerationError`; see migration table. Adds `.unsupportedCapability`/`.unsupportedTranscriptContent`/`.timeout`.
- **`@Generable(name:description:)`** — explicit schema name overload.
- **System tools** — `BarcodeReaderTool`, `OCRTool` (`import Vision`); `SpotlightSearchTool` (`import CoreSpotlight`) for local RAG.

---

## Migration Strategies

### From Server LLMs

- **Migrate when**: Privacy required, offline needed, per-request costs are a concern, and use case fits (summarization/extraction/classification)
- **Reach for Private Cloud Compute** (`OS27`) when the on-device model's 8,192-token window or capabilities fall short but you still want Apple's privacy boundary — `PrivateCloudComputeLanguageModel` gives a 32,000-token window and reasoning without an API key or stored prompts
- **Stay on a third-party server when**: Need broad world knowledge or context beyond what Private Cloud Compute offers — and accept that you own auth, billing, and the privacy trade-off

### From Manual JSON Parsing

Use `@Generable` with `respond(to:generating:)` instead of prompting for JSON and parsing manually. See `axiom-ai (skills/foundation-models.md)` Scenario 2 for the complete migration pattern.

---

## Resources

**WWDC**: 2025-286, 2025-259, 2025-301, 2026-237, 2026-241, 2026-242, 2026-243, 2026-319, 2026-339, 2026-347

**Docs**: /foundationmodels, /foundationmodels/privatecloudcomputelanguagemodel, /foundationmodels/attachment, /CoreAI, /Evaluations

**Skills**: axiom-ai (skills/foundation-models.md), axiom-ai (skills/foundation-models-diag.md)

---

**Last Updated**: 2026-06-09
**Skill Type**: Reference
**Content**: WWDC 2025 + 2026 code examples; OS27 surface verified against the Xcode 27 SDK
