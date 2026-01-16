---
name: axiom-foundation-models-ref
description: Reference — Complete Foundation Models framework guide covering LanguageModelSession, @Generable, @Guide, Tool protocol, streaming, dynamic schemas, built-in use cases, and all WWDC 2025 code examples
user-invocable: true
skill_type: reference
version: 1.0.0
last_updated: 2025-12-03
apple_platforms: iOS 26+, macOS 26+, iPadOS 26+, axiom-visionOS 26+
---

# Foundation Models Framework — Complete API Reference

## Overview

The Foundation Models framework provides access to Apple's on-device Large Language Model (3 billion parameters, 2-bit quantized) with a Swift API. This reference covers every API, all WWDC 2025 code examples, and comprehensive implementation patterns.

### Model Specifications

**Technical Details**:
- **Parameters**: 3 billion (3B)
- **Quantization**: 2-bit
- **Context Window**: 4096 tokens (combined input + output)
- **Supported Languages**: English + additional languages via `SystemLanguageModel.default.supportedLanguages`
- **Platforms**: iOS 26+, macOS 26+, iPadOS 26+, axiom-visionOS 26+

**Optimized For**:
- Text summarization
- Information extraction
- Content classification
- Content generation
- Tag generation
- Entity detection

**NOT Optimized For**:
- World knowledge queries
- Complex multi-step reasoning
- Mathematical computation
- Translation (use dedicated translation models)

**Privacy & Performance**:
- Runs entirely on-device
- No network required (works offline)
- Data never leaves device
- No per-request costs
- Integrated into OS (doesn't increase app size)

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
- `axiom-foundation-models` — Discipline skill with anti-patterns, pressure scenarios, decision trees
- `axiom-foundation-models-diag` — Diagnostic skill for troubleshooting issues

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

**Deterministic Output (Greedy Sampling)**:
```swift
let response = try await session.respond(
    to: prompt,
    options: GenerationOptions(sampling: .greedy)
)
```

#### From WWDC 301:6:14

**Low Variance (Conservative)**:
```swift
let response = try await session.respond(
    to: prompt,
    options: GenerationOptions(temperature: 0.5)
)
```

**High Variance (Creative)**:
```swift
let response = try await session.respond(
    to: prompt,
    options: GenerationOptions(temperature: 2.0)
)
```

#### From WWDC 301:6:14

**Skip Schema in Prompt (Optimization)**:
```swift
let response = try await session.respond(
    to: prompt,
    generating: Person.self,
    options: GenerationOptions(includeSchemaInPrompt: false)
)
```

**Use when**: Subsequent requests with same @Generable type. Reduces token count and latency.

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

```swift
let transcript = session.transcript

for entry in transcript.entries {
    print("Entry: \(entry.content)")
}
```

**Use cases**:
- Debugging generation issues
- Displaying conversation history in UI
- Exporting chat logs
- Condensing for context management

---

## isResponding Property

```swift
struct HaikuView: View {
    @State private var session = LanguageModelSession()
    @State private var haiku: String?

    var body: some View {
        if let haiku {
            Text(haiku)
        }

        Button("Go!") {
            Task {
                haiku = try await session.respond(
                    to: "Write a haiku about something you haven't yet"
                ).content
            }
        }
        // Gate on `isResponding`
        .disabled(session.isResponding)
    }
}
```

#### From WWDC 286:18:22

**Why important**: Prevents multiple concurrent requests, which could cause errors or unexpected behavior.

---

## @Generable Macro

### Overview

`@Generable` enables structured output from the model using Swift types. The macro generates a schema at compile-time and uses **constrained decoding** to guarantee structural correctness.

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

**Natural Language Description**:
```swift
@Generable
struct NPC {
    @Guide(description: "A full name")
    let name: String
}
```

#### From WWDC 301:11:20

**Numeric Range**:
```swift
@Generable
struct Character {
    @Guide(.range(1...10))
    let level: Int
}
```

#### From WWDC 301:11:20

**Array Count**:
```swift
@Generable
struct Suggestions {
    @Guide(.count(3))
    let attributes: [Attribute]
}
```

#### From WWDC 301:11:20

**Array Maximum Count**:
```swift
@Generable
struct Result {
    @Guide(.maximumCount(3))
    let topics: [String]
}
```

**Regex Patterns**:
```swift
@Generable
struct NPC {
    @Guide(Regex {
        Capture {
            ChoiceOf {
                "Mr"
                "Mrs"
            }
        }
        ". "
        OneOrMore(.word)
    })
    let name: String
}

session.respond(to: "Generate a fun NPC", generating: NPC.self)
// > {name: "Mrs. Brewster"}
```

#### From WWDC 301:13:40

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

for try await partial in stream {
    print(partial) // Incrementally updated Itinerary.PartiallyGenerated
}
```

#### From WWDC 286:9:40

**Return Type**: `AsyncSequence<Itinerary.PartiallyGenerated>`

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

                        for try await partial in stream {
                            self.itinerary = partial
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

    associatedtype Arguments: Generable

    func call(arguments: Arguments) async throws -> ToolOutput
}
```

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

    func call(arguments: Arguments) async throws -> ToolOutput {
        let places = try await CLGeocoder().geocodeAddressString(arguments.city)
        let weather = try await WeatherService.shared.weather(for: places.first!.location!)
        let temperature = weather.currentWeather.temperature.value

        let content = GeneratedContent(properties: ["temperature": temperature])
        let output = ToolOutput(content)

        // Or if your tool's output is natural language:
        // let output = ToolOutput("\(arguments.city)'s temperature is \(temperature) degrees.")

        return output
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

### Example: FindContactTool

```swift
import FoundationModels
import Contacts

struct FindContactTool: Tool {
    let name = "findContact"
    let description = "Finds a contact from a specified age generation."

    @Generable
    struct Arguments {
        let generation: Generation

        @Generable
        enum Generation {
            case babyBoomers
            case genX
            case millennial
            case genZ
        }
    }

    func call(arguments: Arguments) async throws -> ToolOutput {
        let store = CNContactStore()

        let keysToFetch = [CNContactGivenNameKey, CNContactBirthdayKey] as [CNKeyDescriptor]
        let request = CNContactFetchRequest(keysToFetch: keysToFetch)

        var contacts: [CNContact] = []
        try store.enumerateContacts(with: request) { contact, stop in
            if let year = contact.birthday?.year {
                if arguments.generation.yearRange.contains(year) {
                    contacts.append(contact)
                }
            }
        }

        guard let pickedContact = contacts.randomElement() else {
            return ToolOutput("Could not find a contact.")
        }

        return ToolOutput(pickedContact.givenName)
    }
}
```

#### From WWDC 301:18:47

### Stateful Tools

Tools can maintain state across calls using `class` instead of `struct`:

```swift
class FindContactTool: Tool {
    let name = "findContact"
    let description = "Finds a contact from a specified age generation."

    var pickedContacts = Set<String>() // State!

    @Generable
    struct Arguments {
        let generation: Generation

        @Generable
        enum Generation {
            case babyBoomers
            case genX
            case millennial
            case genZ
        }
    }

    func call(arguments: Arguments) async throws -> ToolOutput {
        // Fetch contacts...
        contacts.removeAll(where: { pickedContacts.contains($0.givenName) })

        guard let pickedContact = contacts.randomElement() else {
            return ToolOutput("Could not find a contact.")
        }

        pickedContacts.insert(pickedContact.givenName) // Update state
        return ToolOutput(pickedContact.givenName)
    }
}
```

#### From WWDC 301:21:55

**Why**: Tool instance persists for session lifetime. Can track what's been called.

### Example: GetContactEventTool

```swift
import FoundationModels
import EventKit

struct GetContactEventTool: Tool {
    let name = "getContactEvent"
    let description = "Get an event with a contact."

    let contactName: String

    @Generable
    struct Arguments {
        let day: Int
        let month: Int
        let year: Int
    }

    func call(arguments: Arguments) async throws -> ToolOutput {
        // Fetch events from Calendar...
        let eventStore = EKEventStore()
        // ... implementation ...
        return ToolOutput(/* event details */)
    }
}
```

#### From WWDC 301:22:27

### ToolOutput

**Two forms**:

1. **Natural language** (String):
```swift
return ToolOutput("Temperature is 71°F")
```

2. **Structured** (GeneratedContent):
```swift
let content = GeneratedContent(properties: ["temperature": 71])
return ToolOutput(content)
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

### Creating Dynamic Schemas

```swift
@Generable
struct Riddle {
    let question: String
    let answers: [Answer]

    @Generable
    struct Answer {
        let text: String
        let isCorrect: Bool
    }
}
```

#### From WWDC 301:14:50

If this structure is only known at runtime:

```swift
struct LevelObjectCreator {
    var properties: [DynamicGenerationSchema.Property] = []

    mutating func addStringProperty(name: String) {
        let property = DynamicGenerationSchema.Property(
            name: name,
            schema: DynamicGenerationSchema(type: String.self)
        )
        properties.append(property)
    }

    mutating func addBoolProperty(name: String) {
        let property = DynamicGenerationSchema.Property(
            name: name,
            schema: DynamicGenerationSchema(type: Bool.self)
        )
        properties.append(property)
    }

    mutating func addArrayProperty(name: String, customType: String) {
        let property = DynamicGenerationSchema.Property(
            name: name,
            schema: DynamicGenerationSchema(
                arrayOf: DynamicGenerationSchema(referenceTo: customType)
            )
        )
        properties.append(property)
    }

    var root: DynamicGenerationSchema {
        DynamicGenerationSchema(
            name: name,
            properties: properties
        )
    }
}

// Create riddle schema
var riddleBuilder = LevelObjectCreator(name: "Riddle")
riddleBuilder.addStringProperty(name: "question")
riddleBuilder.addArrayProperty(name: "answers", customType: "Answer")

// Create answer schema
var answerBuilder = LevelObjectCreator(name: "Answer")
answerBuilder.addStringProperty(name: "text")
answerBuilder.addBoolProperty(name: "isCorrect")

let riddleDynamicSchema = riddleBuilder.root
let answerDynamicSchema = answerBuilder.root
```

#### From WWDC 301:15:10

### Validating and Using Dynamic Schemas

```swift
let schema = try GenerationSchema(
    root: riddleDynamicSchema,
    dependencies: [answerDynamicSchema]
)

let session = LanguageModelSession()
let response = try await session.respond(
    to: "Generate a fun riddle about coffee",
    schema: schema
)

let generatedContent = response.content // GeneratedContent
let question = try generatedContent.value(String.self, forProperty: "question")
let answers = try generatedContent.value([GeneratedContent].self, forProperty: "answers")
```

#### From WWDC 301:15:10

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

### Sampling Methods

**Random Sampling (Default)**:
```swift
let response = try await session.respond(to: prompt)
// Different output each time
```

**Greedy Sampling (Deterministic)**:
```swift
let response = try await session.respond(
    to: prompt,
    options: GenerationOptions(sampling: .greedy)
)
// Same output for same prompt (given same model version)
```

#### From WWDC 301:6:14

**Use greedy for**:
- Unit tests
- Demos that need repeatability
- When consistency critical

**Caveat**: Only deterministic for same model version. OS updates may change model, changing output.

### Temperature Control

**Low variance** (focused, conservative):
```swift
let response = try await session.respond(
    to: prompt,
    options: GenerationOptions(temperature: 0.5)
)
// Predictable, focused output
```

**High variance** (creative, diverse):
```swift
let response = try await session.respond(
    to: prompt,
    options: GenerationOptions(temperature: 2.0)
)
// Varied, creative output
```

#### From WWDC 301:6:14

**Temperature scale**:
- `0.1-0.5`: Very focused
- `1.0` (default): Balanced
- `1.5-2.0`: Very creative

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

**exceededContextWindowSize**:
```swift
do {
    let response = try await session.respond(to: prompt)
} catch LanguageModelSession.GenerationError.exceededContextWindowSize {
    // Context limit (4096 tokens) exceeded
    // Solution: Condense transcript, create new session
}
```

#### From WWDC 301:3:37

**guardrailViolation**:
```swift
do {
    let response = try await session.respond(to: userInput)
} catch LanguageModelSession.GenerationError.guardrailViolation {
    // Content policy triggered
    // Solution: Show graceful message, don't generate
}
```

**unsupportedLanguageOrLocale**:
```swift
do {
    let response = try await session.respond(to: userInput)
} catch LanguageModelSession.GenerationError.unsupportedLanguageOrLocale {
    // Language not supported
    // Solution: Check supported languages, show message
}
```

#### From WWDC 301:7:06

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
    let allEntries = previousSession.transcript.entries
    var condensedEntries = [Transcript.Entry]()

    if let firstEntry = allEntries.first {
        condensedEntries.append(firstEntry) // Instructions

        if allEntries.count > 1, let lastEntry = allEntries.last {
            condensedEntries.append(lastEntry) // Recent context
        }
    }

    let condensedTranscript = Transcript(entries: condensedEntries)
    // Note: transcript includes instructions
    return LanguageModelSession(transcript: condensedTranscript)
}
```

#### From WWDC 301:3:55

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

### Requirements

**Device Requirements**:
- Apple Intelligence-enabled device
- iPhone 15 Pro or later
- iPad with M1+ chip
- Mac with Apple silicon

**Region Requirements**:
- Supported region (check Apple Intelligence availability)

**User Requirements**:
- User opted in to Apple Intelligence in Settings

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

// Subsequent requests - skip schema
let second = try await session.respond(
    to: "Generate another person",
    generating: Person.self,
    options: GenerationOptions(includeSchemaInPrompt: false)
)
```

**From WWDC 259**: "Setting includeSchemaInPrompt to false decreases token count and latency for subsequent requests."

**Time saved**: 10-20% per request

### Optimization: Property Order

```swift
// ✅ GOOD - Important properties first
@Generable
struct Article {
    var title: String      // Shows in 0.2s (streaming)
    var summary: String    // Shows in 0.8s
    var fullText: String   // Shows in 2.5s
}

// ❌ BAD - Important properties last
@Generable
struct Article {
    var fullText: String   // User waits 2.5s
    var summary: String
    var title: String
}
```

**UX impact**: Perceived latency drops from 2.5s to 0.2s with streaming

---

## Feedback & Analytics

### LanguageModelFeedbackAttachment

```swift
let feedback = LanguageModelFeedbackAttachment(
    input: [
        // Input tokens/prompts
    ],
    output: [
        // Output tokens/content
    ],
    sentiment: .negative,
    issues: [
        LanguageModelFeedbackAttachment.Issue(
            category: .incorrect,
            explanation: "Model hallucinated facts"
        )
    ],
    desiredOutputExamples: [
        [
            // Example of desired output
        ]
    ]
)

let data = try JSONEncoder().encode(feedback)
// Attach to Feedback Assistant report
```

#### From WWDC 286:22:13

**Use for**:
- Reporting quality issues
- Providing examples of desired behavior
- Helping Apple improve models
- Tracking sentiment

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

### Accessing App Types

```swift
import FoundationModels
import Playgrounds

#Playground {
    let session = LanguageModelSession()
    for landmark in ModelData.shared.landmarks {
        let response = try await session.respond(
            to: "What's a good name for a trip to \(landmark.name)? Respond only with a title"
        )
    }
}
```

#### From WWDC 286:2:43

**Benefit**: Can access types defined in your app (like @Generable structs)

---

## API Quick Reference

### Classes

| Class | Purpose |
|-------|---------|
| `LanguageModelSession` | Main interface for model interaction |
| `SystemLanguageModel` | Access to model availability and use cases |
| `GenerationOptions` | Configure sampling, temperature, schema inclusion |
| `ToolOutput` | Return value from Tool.call() |
| `GeneratedContent` | Dynamic structured output |
| `DynamicGenerationSchema` | Runtime schema definition |
| `Transcript` | Conversation history |

### Protocols

| Protocol | Purpose |
|----------|---------|
| `Tool` | Define custom tools for model to call |
| `Generable` | (Not direct protocol) Macro-generated conformance |

### Macros

| Macro | Purpose |
|-------|---------|
| `@Generable` | Enable structured output for types |
| `@Guide` | Add constraints to @Generable properties |

### Enums

| Enum | Purpose |
|------|---------|
| `SystemLanguageModel.Availability` | `.available` or `.unavailable(reason)` |
| `GenerationError` | Error types (context exceeded, guardrail, language) |
| `SamplingMethod` | `.greedy` or `.random` |

### Key Methods

| Method | Return | Purpose |
|--------|--------|---------|
| `session.respond(to:)` | `Response<String>` | Generate text |
| `session.respond(to:generating:)` | `Response<T>` | Generate structured output |
| `session.streamResponse(to:generating:)` | `AsyncSequence<T.PartiallyGenerated>` | Stream structured output |

### Properties

| Property | Type | Purpose |
|----------|------|---------|
| `session.transcript` | `Transcript` | Conversation history |
| `session.isResponding` | `Bool` | Whether currently generating |
| `SystemLanguageModel.default.availability` | `Availability` | Model availability status |
| `SystemLanguageModel.default.supportedLanguages` | `[Language]` | Supported languages |

---

## Migration Strategies

### From Server LLMs

**When to migrate**:
- Privacy concerns (data leaving device)
- Offline requirements
- Cost concerns (per-request fees)
- Use case is summarization/extraction/classification

**When NOT to migrate**:
- Need world knowledge
- Need complex reasoning
- Need very long context (>4096 tokens)

### From Manual JSON Parsing

**Before**:
```swift
let prompt = "Generate person as JSON"
let response = try await session.respond(to: prompt)
let data = response.content.data(using: .utf8)!
let person = try JSONDecoder().decode(Person.self, from: data)
```

**After**:
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
```

**Benefits**:
- No parsing code
- Guaranteed structure
- Type safety
- No crashes from invalid JSON

---

## Resources

**WWDC**: 286, 259, 301

**Skills**: axiom-foundation-models, axiom-foundation-models-diag

---

**Last Updated**: 2025-12-03
**Version**: 1.0.0
**Skill Type**: Reference
**Content**: All WWDC 2025 code examples included
