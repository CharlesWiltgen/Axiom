---
name: axiom-foundation-models
description: Use when implementing on-device AI with Apple's Foundation Models framework — prevents context overflow, blocking UI, wrong model use cases, and manual JSON parsing when @Generable should be used. iOS 26+, macOS 26+, iPadOS 26+, axiom-visionOS 26+
license: MIT
compatibility: iOS 26+, macOS 26+, iPadOS 26+, axiom-visionOS 26+
metadata:
  version: "1.0.0"
  last-updated: "2025-12-03"
---

# Foundation Models — On-Device AI for Apple Platforms

## When to Use This Skill

Use when:
- Implementing on-device AI features with Foundation Models
- Adding text summarization, classification, or extraction capabilities
- Creating structured output from LLM responses
- Building tool-calling patterns for external data integration
- Streaming generated content for better UX
- Debugging Foundation Models issues (context overflow, slow generation, wrong output)
- Deciding between Foundation Models vs server LLMs (ChatGPT, Claude, etc.)

#### Related Skills
- Use `axiom-foundation-models-diag` for systematic troubleshooting (context exceeded, guardrail violations, availability problems)
- Use `axiom-foundation-models-ref` for complete API reference with all WWDC code examples

---

## Red Flags — Anti-Patterns That Will Fail

### ❌ Using for World Knowledge
**Why it fails**: The on-device model is 3 billion parameters, optimized for summarization, extraction, classification — **NOT** world knowledge or complex reasoning.

**Example of wrong use**:
```swift
// ❌ BAD - Asking for world knowledge
let session = LanguageModelSession()
let response = try await session.respond(to: "What's the capital of France?")
```

**Why**: Model will hallucinate or give low-quality answers. It's trained for content generation, not encyclopedic knowledge.

**Correct approach**: Use server LLMs (ChatGPT, Claude) for world knowledge, or provide factual data through Tool calling.

---

### ❌ Blocking Main Thread
**Why it fails**: `session.respond()` is `async` but if called synchronously on main thread, freezes UI for seconds.

**Example of wrong use**:
```swift
// ❌ BAD - Blocking main thread
Button("Generate") {
    let response = try await session.respond(to: prompt) // UI frozen!
}
```

**Why**: Generation takes 1-5 seconds. User sees frozen app, bad reviews follow.

**Correct approach**:
```swift
// ✅ GOOD - Async on background
Button("Generate") {
    Task {
        let response = try await session.respond(to: prompt)
        // Update UI with response
    }
}
```

---

### ❌ Manual JSON Parsing
**Why it fails**: Prompting for JSON and parsing with JSONDecoder leads to hallucinated keys, invalid JSON, no type safety.

**Example of wrong use**:
```swift
// ❌ BAD - Manual JSON parsing
let prompt = "Generate a person with name and age as JSON"
let response = try await session.respond(to: prompt)
let data = response.content.data(using: .utf8)!
let person = try JSONDecoder().decode(Person.self, from: data) // CRASHES!
```

**Why**: Model might output `{firstName: "John"}` when you expect `{name: "John"}`. Or invalid JSON entirely.

**Correct approach**:
```swift
// ✅ GOOD - @Generable guarantees structure
@Generable
struct Person {
    let name: String
    let age: Int
}

let response = try await session.respond(
    to: "Generate a person",
    generating: Person.self
)
// response.content is type-safe Person instance
```

---

### ❌ Ignoring Availability Check
**Why it fails**: Foundation Models only runs on Apple Intelligence devices in supported regions. App crashes or shows errors without check.

**Example of wrong use**:
```swift
// ❌ BAD - No availability check
let session = LanguageModelSession() // Might fail!
```

**Correct approach**:
```swift
// ✅ GOOD - Check first
switch SystemLanguageModel.default.availability {
case .available:
    let session = LanguageModelSession()
    // proceed
case .unavailable(let reason):
    // Show graceful UI: "AI features require Apple Intelligence"
}
```

---

### ❌ Single Huge Prompt
**Why it fails**: 4096 token context window (input + output). One massive prompt hits limit, gives poor results.

**Example of wrong use**:
```swift
// ❌ BAD - Everything in one prompt
let prompt = """
    Generate a 7-day itinerary for Tokyo including hotels, restaurants,
    activities for each day, transportation details, budget breakdown...
    """
// Exceeds context, poor quality
```

**Correct approach**: Break into smaller tasks, use tools for external data, multi-turn conversation.

---

### ❌ Not Handling Context Overflow
**Why it fails**: Multi-turn conversations grow transcript. Eventually exceeds 4096 tokens, throws error, conversation ends.

**Must handle**:
```swift
// ✅ GOOD - Handle overflow
do {
    let response = try await session.respond(to: prompt)
} catch LanguageModelSession.GenerationError.exceededContextWindowSize {
    // Condense transcript and create new session
    session = condensedSession(from: session)
}
```

---

### ❌ Not Handling Guardrail Violations
**Why it fails**: Model has content policy. Certain prompts trigger guardrails, throw error.

**Must handle**:
```swift
// ✅ GOOD - Handle guardrails
do {
    let response = try await session.respond(to: userInput)
} catch LanguageModelSession.GenerationError.guardrailViolation {
    // Show message: "I can't help with that request"
}
```

---

### ❌ Not Handling Unsupported Language
**Why it fails**: Model supports specific languages. User input might be unsupported, throws error.

**Must check**:
```swift
// ✅ GOOD - Check supported languages
let supported = SystemLanguageModel.default.supportedLanguages
guard supported.contains(Locale.current.language) else {
    // Show disclaimer
    return
}
```

---

## Mandatory First Steps

Before writing any Foundation Models code, complete these steps:

### 1. Check Availability
```swift
switch SystemLanguageModel.default.availability {
case .available:
    // Proceed with implementation
    print("✅ Foundation Models available")
case .unavailable(let reason):
    // Handle gracefully - show UI message
    print("❌ Unavailable: \(reason)")
}
```

**Why**: Foundation Models requires:
- Apple Intelligence-enabled device
- Supported region
- User opted in to Apple Intelligence

**Failure mode**: App crashes or shows confusing errors without check.

---

### 2. Identify Use Case
**Ask yourself**: What is my primary goal?

| Use Case | Foundation Models? | Alternative |
|----------|-------------------|-------------|
| Summarization | ✅ YES | |
| Extraction (key info from text) | ✅ YES | |
| Classification (categorize content) | ✅ YES | |
| Content tagging | ✅ YES (built-in adapter!) | |
| World knowledge | ❌ NO | ChatGPT, Claude, Gemini |
| Complex reasoning | ❌ NO | Server LLMs |
| Mathematical computation | ❌ NO | Calculator, symbolic math |

**Critical**: If your use case requires world knowledge or advanced reasoning, **stop**. Foundation Models is the wrong tool.

---

### 3. Design @Generable Schema
If you need structured output (not just plain text):

**Bad approach**: Prompt for "JSON" and parse manually
**Good approach**: Define @Generable type

```swift
@Generable
struct SearchSuggestions {
    @Guide(description: "Suggested search terms", .count(4))
    var searchTerms: [String]
}
```

**Why**: Constrained decoding guarantees structure. No parsing errors, no hallucinated keys.

---

### 4. Consider Tools for External Data
If your feature needs external information:
- Weather → WeatherKit tool
- Locations → MapKit tool
- Contacts → Contacts API tool
- Calendar → EventKit tool

**Don't** try to get this information from the model (it will hallucinate).
**Do** define Tool protocol implementations.

---

### 5. Plan Streaming for Long Generations
If generation takes >1 second, use streaming:

```swift
let stream = session.streamResponse(
    to: prompt,
    generating: Itinerary.self
)

for try await partial in stream {
    // Update UI incrementally
    self.itinerary = partial
}
```

**Why**: Users see progress immediately, perceived latency drops dramatically.

---

## Decision Tree

```
Need on-device AI?
│
├─ World knowledge/reasoning?
│  └─ ❌ NOT Foundation Models
│     → Use ChatGPT, Claude, Gemini, etc.
│     → Reason: 3B parameter model, not trained for encyclopedic knowledge
│
├─ Summarization?
│  └─ ✅ YES → Pattern 1 (Basic Session)
│     → Example: Summarize article, condense email
│     → Time: 10-15 minutes
│
├─ Structured extraction?
│  └─ ✅ YES → Pattern 2 (@Generable)
│     → Example: Extract name, date, amount from invoice
│     → Time: 15-20 minutes
│
├─ Content tagging?
│  └─ ✅ YES → Pattern 3 (contentTagging use case)
│     → Example: Tag article topics, extract entities
│     → Time: 10 minutes
│
├─ Need external data?
│  └─ ✅ YES → Pattern 4 (Tool calling)
│     → Example: Fetch weather, query contacts, get locations
│     → Time: 20-30 minutes
│
├─ Long generation?
│  └─ ✅ YES → Pattern 5 (Streaming)
│     → Example: Generate itinerary, create story
│     → Time: 15-20 minutes
│
└─ Dynamic schemas (runtime-defined structure)?
   └─ ✅ YES → Pattern 6 (DynamicGenerationSchema)
      → Example: Level creator, user-defined forms
      → Time: 30-40 minutes
```

---

## Pattern 1: Basic Session (~1500 words)

**Use when**: Simple text generation, summarization, or content analysis.

### Core Concepts

**LanguageModelSession**:
- Stateful — retains transcript of all interactions
- Instructions vs prompts:
  - **Instructions** (from developer): Define model's role, static guidance
  - **Prompts** (from user): Dynamic input for generation
- Model trained to obey instructions over prompts (security feature)

### Implementation

```swift
import FoundationModels

func respond(userInput: String) async throws -> String {
    let session = LanguageModelSession(instructions: """
        You are a friendly barista in a pixel art coffee shop.
        Respond to the player's question concisely.
        """
    )
    let response = try await session.respond(to: userInput)
    return response.content
}
```

// WWDC 301:1:05

### Key Points

1. **Instructions are optional** — Reasonable defaults if omitted
2. **Never interpolate user input into instructions** — Security risk (prompt injection)
3. **Keep instructions concise** — Each token adds latency

### Multi-Turn Interactions

```swift
let session = LanguageModelSession()

// First turn
let first = try await session.respond(to: "Write a haiku about fishing")
print(first.content)
// "Silent waters gleam,
//  Casting lines in morning mist—
//  Hope in every cast."

// Second turn - model remembers context
let second = try await session.respond(to: "Do another one about golf")
print(second.content)
// "Silent morning dew,
//  Caddies guide with gentle words—
//  Paths of patience tread."

// Inspect full transcript
print(session.transcript)
```

// WWDC 286:17:46

**Why this works**: Session retains transcript automatically. Model uses context from previous turns.

### Transcript Inspection

```swift
let transcript = session.transcript
// Use for:
// - Debugging generation issues
// - Showing conversation history in UI
// - Exporting chat logs
```

### Error Handling (Basic)

```swift
do {
    let response = try await session.respond(to: prompt)
} catch LanguageModelSession.GenerationError.guardrailViolation {
    // Content policy triggered
    print("Cannot generate that content")
} catch LanguageModelSession.GenerationError.unsupportedLanguageOrLocale {
    // Language not supported
    print("Please use English or another supported language")
}
```

### When to Use This Pattern

✅ **Good for**:
- Simple Q&A
- Text summarization
- Content analysis
- Single-turn generation

❌ **Not good for**:
- Structured output (use Pattern 2)
- Long conversations (will hit context limit)
- External data needs (use Pattern 4)

### Time Cost

**Implementation**: 10-15 minutes for basic usage
**Debugging**: +5-10 minutes if hitting errors

---

## Pattern 2: @Generable Structured Output (~2000 words)

**Use when**: You need structured data from model, not just plain text.

### The Problem

Without @Generable:
```swift
// ❌ BAD - Unreliable
let prompt = "Generate a person with name and age as JSON"
let response = try await session.respond(to: prompt)
// Might get: {"firstName": "John"} when you expect {"name": "John"}
// Might get invalid JSON entirely
// Must parse manually, prone to crashes
```

### The Solution: @Generable

```swift
@Generable
struct Person {
    let name: String
    let age: Int
}

let session = LanguageModelSession()
let response = try await session.respond(
    to: "Generate a person",
    generating: Person.self
)

let person = response.content // Type-safe Person instance!
```

// WWDC 301:8:14

### How It Works (Constrained Decoding)

1. `@Generable` macro generates schema at compile-time
2. Schema passed to model automatically
3. Model generates tokens constrained by schema
4. Framework parses output into Swift type
5. **Guaranteed structural correctness** — No hallucinated keys, no parsing errors

"Constrained decoding masks out invalid tokens. Model can only pick tokens valid according to schema."

### Supported Types

**Primitives**:
- `String`, `Int`, `Float`, `Double`, `Bool`

**Arrays**:
```swift
@Generable
struct SearchSuggestions {
    var searchTerms: [String]
}
```

**Nested/Composed**:
```swift
@Generable
struct Itinerary {
    var destination: String
    var days: [DayPlan] // Composed type
}

@Generable
struct DayPlan {
    var activities: [String]
}
```

// WWDC 286:6:18

**Enums with Associated Values**:
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

// WWDC 301:10:49

**Recursive Types**:
```swift
@Generable
struct Itinerary {
    var destination: String
    var relatedItineraries: [Itinerary] // Recursive!
}
```

### @Guide Constraints

Control generated values with @Guide:

**Natural Language Description**:
```swift
@Generable
struct NPC {
    @Guide(description: "A full name with first and last")
    let name: String
}
```

**Numeric Ranges**:
```swift
@Generable
struct Character {
    @Guide(.range(1...10))
    let level: Int
}
```

// WWDC 301:11:20

**Array Count**:
```swift
@Generable
struct Suggestions {
    @Guide(description: "Suggested search terms", .count(4))
    var searchTerms: [String]
}
```

// WWDC 286:5:32

**Maximum Count**:
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

// Output: {name: "Mrs. Brewster"}
```

// WWDC 301:13:40

### Property Order Matters

Properties generated **in declaration order**:
```swift
@Generable
struct Itinerary {
    var destination: String // Generated first
    var days: [DayPlan]     // Generated second
    var summary: String     // Generated last
}
```

"You may find model produces best summaries when they're last property."

**Why**: Later properties can reference earlier ones. Put most important properties first for streaming.

---

## Pattern 3: Streaming with PartiallyGenerated (~1500 words)

**Use when**: Generation takes >1 second and you want progressive UI updates.

### The Problem

Without streaming:
```swift
// User waits 3-5 seconds seeing nothing
let response = try await session.respond(to: prompt, generating: Itinerary.self)
// Then entire result appears at once
```

**User experience**: Feels slow, frozen UI.

### The Solution: Streaming

```swift
@Generable
struct Itinerary {
    var name: String
    var days: [DayPlan]
}

let stream = session.streamResponse(
    to: "Generate a 3-day itinerary to Mt. Fuji",
    generating: Itinerary.self
)

for try await partial in stream {
    print(partial) // Incrementally updated
}
```

// WWDC 286:9:40

### PartiallyGenerated Type

`@Generable` macro automatically creates `PartiallyGenerated` type:
```swift
// Compiler generates:
extension Itinerary {
    struct PartiallyGenerated {
        var name: String?        // All properties optional!
        var days: [DayPlan]?
    }
}
```

**Why optional**: Properties fill in as model generates them.

### SwiftUI Integration

```swift
struct ItineraryView: View {
    let session: LanguageModelSession
    @State private var itinerary: Itinerary.PartiallyGenerated?

    var body: some View {
        VStack {
            if let name = itinerary?.name {
                Text(name)
                    .font(.title)
            }

            if let days = itinerary?.days {
                ForEach(days, id: \.self) { day in
                    DayView(day: day)
                }
            }

            Button("Generate") {
                Task {
                    let stream = session.streamResponse(
                        to: "Generate 3-day itinerary to Tokyo",
                        generating: Itinerary.self
                    )

                    for try await partial in stream {
                        self.itinerary = partial
                    }
                }
            }
        }
    }
}
```

// WWDC 286:10:05

### Animations & Transitions

**Add polish**:
```swift
if let name = itinerary?.name {
    Text(name)
        .transition(.opacity)
}

if let days = itinerary?.days {
    ForEach(days, id: \.self) { day in
        DayView(day: day)
            .transition(.slide)
    }
}
```

"Get creative with SwiftUI animations to hide latency. Turn waiting into delight."

### View Identity

**Critical for arrays**:
```swift
// ✅ GOOD - Stable identity
ForEach(days, id: \.id) { day in
    DayView(day: day)
}

// ❌ BAD - Identity changes, animations break
ForEach(days.indices, id: \.self) { index in
    DayView(day: days[index])
}
```

### Property Order for Streaming UX

```swift
// ✅ GOOD - Title appears first, summary last
@Generable
struct Itinerary {
    var name: String        // Shows first
    var days: [DayPlan]     // Shows second
    var summary: String     // Shows last (can reference days)
}

// ❌ BAD - Summary before content
@Generable
struct Itinerary {
    var summary: String     // Doesn't make sense before days!
    var days: [DayPlan]
}
```

// WWDC 286:11:00

### When to Use Streaming

✅ **Use for**:
- Itineraries
- Stories
- Long descriptions
- Multi-section content

❌ **Skip for**:
- Simple Q&A (< 1 sentence)
- Quick classification
- Content tagging

### Time Cost

**Implementation**: 15-20 minutes with SwiftUI
**Polish (animations)**: +5-10 minutes

---

## Pattern 4: Tool Calling (~2000 words)

**Use when**: Model needs external data (weather, locations, contacts) to generate response.

### The Problem

```swift
// ❌ BAD - Model will hallucinate
let response = try await session.respond(
    to: "What's the temperature in Cupertino?"
)
// Output: "It's about 72°F" (completely made up!)
```

**Why**: 3B parameter model doesn't have real-time weather data.

### The Solution: Tool Calling

Let model **autonomously call your code** to fetch external data.

```swift
import FoundationModels
import WeatherKit
import CoreLocation

struct GetWeatherTool: Tool {
    let name = "getWeather"
    let description = "Retrieve latest weather for a city"

    @Generable
    struct Arguments {
        @Guide(description: "The city to fetch weather for")
        var city: String
    }

    func call(arguments: Arguments) async throws -> ToolOutput {
        let places = try await CLGeocoder().geocodeAddressString(arguments.city)
        let weather = try await WeatherService.shared.weather(for: places.first!.location!)
        let temp = weather.currentWeather.temperature.value

        return ToolOutput("\(arguments.city)'s temperature is \(temp) degrees.")
    }
}
```

// WWDC 286:13:42

### Attaching Tool to Session

```swift
let session = LanguageModelSession(
    tools: [GetWeatherTool()],
    instructions: "Help user with weather forecasts."
)

let response = try await session.respond(
    to: "What's the temperature in Cupertino?"
)

print(response.content)
// "It's 71°F in Cupertino!"
```

// WWDC 286:15:03

**Model autonomously**:
1. Recognizes it needs weather data
2. Calls `GetWeatherTool`
3. Receives real temperature
4. Incorporates into natural response

### Tool Protocol Requirements

```swift
protocol Tool {
    var name: String { get }
    var description: String { get }

    associatedtype Arguments: Generable

    func call(arguments: Arguments) async throws -> ToolOutput
}
```

**Name**: Short, verb-based (e.g. `getWeather`, `findContact`)
**Description**: One sentence explaining purpose
**Arguments**: Must be `@Generable` (guarantees valid input)
**call**: Your code — fetch data, process, return

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

### Multiple Tools Example

```swift
let session = LanguageModelSession(
    tools: [
        GetWeatherTool(),
        FindRestaurantTool(),
        FindHotelTool()
    ],
    instructions: "Plan travel itineraries."
)

let response = try await session.respond(
    to: "Create a 2-day plan for Tokyo"
)

// Model autonomously decides:
// - Calls FindRestaurantTool for dining
// - Calls FindHotelTool for accommodation
// - Calls GetWeatherTool to suggest activities
```

### Stateful Tools

Tools can maintain state across calls:

```swift
class FindContactTool: Tool {
    let name = "findContact"
    let description = "Find contact from age generation"

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
        // Use Contacts API
        var contacts = fetchContacts(for: arguments.generation)

        // Remove already picked
        contacts.removeAll(where: { pickedContacts.contains($0.name) })

        guard let picked = contacts.randomElement() else {
            return ToolOutput("No more contacts")
        }

        pickedContacts.insert(picked.name) // Update state
        return ToolOutput(picked.name)
    }
}
```

// WWDC 301:21:55

**Why class, not struct**: Need to mutate state from `call` method.

### Tool Calling Flow

```
1. Session initialized with tools
2. User prompt: "What's Tokyo's weather?"
3. Model analyzes: "Need weather data"
4. Model generates tool call: getWeather(city: "Tokyo")
5. Framework calls your tool's call() method
6. Your tool fetches real data from API
7. Tool output inserted into transcript
8. Model generates final response using tool output
```

"Model decides autonomously when and how often to call tools. Can call multiple tools per request, even in parallel."

### Tool Calling Guarantees

✅ **Guaranteed**:
- Valid tool names (no hallucinated tools)
- Valid arguments (via @Generable)
- Structural correctness

❌ **Not guaranteed**:
- Tool will be called (model might not need it)
- Specific argument values (model decides based on context)

### Real-World Example: Itinerary Planner

```swift
struct FindPointsOfInterestTool: Tool {
    let name = "findPointsOfInterest"
    let description = "Find restaurants, museums, parks near a landmark"

    let landmark: String

    @Generable
    struct Arguments {
        let category: Category

        @Generable
        enum Category {
            case restaurant
            case museum
            case park
            case marina
        }
    }

    func call(arguments: Arguments) async throws -> ToolOutput {
        // Use MapKit
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = "\(arguments.category) near \(landmark)"

        let search = MKLocalSearch(request: request)
        let response = try await search.start()

        let names = response.mapItems.prefix(5).map { $0.name ?? "" }
        return ToolOutput(names.joined(separator: ", "))
    }
}
```

**From WWDC 259 summary**: "Tool fetches points of interest from MapKit. Model uses world knowledge to determine promising categories."

### When to Use Tools

✅ **Use for**:
- Weather data
- Map/location queries
- Contact information
- Calendar events
- External APIs

❌ **Don't use for**:
- Data model already has
- Information in prompt/instructions
- Simple calculations (model can do these)

### Time Cost

**Simple tool**: 20-25 minutes
**Complex tool with state**: 30-40 minutes

---

## Pattern 5: Context Management (~1500 words)

**Use when**: Multi-turn conversations that might exceed 4096 token limit.

### The Problem

```swift
// Long conversation...
for i in 1...100 {
    let response = try await session.respond(to: "Question \(i)")
    // Eventually...
    // Error: exceededContextWindowSize
}
```

**Context window**: 4096 tokens (input + output combined)
**Average**: ~3 characters per token in English

**Rough calculation**:
- 4096 tokens ≈ 12,000 characters
- ≈ 2,000-3,000 words total

**Long conversation** or **verbose prompts/responses** → Exceed limit

### Handling Context Overflow

#### Basic: Start fresh session
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

// WWDC 301:3:37

**Problem**: Loses entire conversation history.

### Better: Condense Transcript

```swift
var session = LanguageModelSession()

do {
    let response = try await session.respond(to: prompt)
} catch LanguageModelSession.GenerationError.exceededContextWindowSize {
    // New session with condensed history
    session = condensedSession(from: session)
}

func condensedSession(from previous: LanguageModelSession) -> LanguageModelSession {
    let allEntries = previous.transcript.entries
    var condensedEntries = [Transcript.Entry]()

    // Always include first entry (instructions)
    if let first = allEntries.first {
        condensedEntries.append(first)

        // Include last entry (most recent context)
        if allEntries.count > 1, let last = allEntries.last {
            condensedEntries.append(last)
        }
    }

    let condensedTranscript = Transcript(entries: condensedEntries)
    return LanguageModelSession(transcript: condensedTranscript)
}
```

// WWDC 301:3:55

**Why this works**:
- Instructions always preserved
- Recent context retained
- Total tokens drastically reduced

### Advanced: Summarize Middle Entries

For long conversations where recent context isn't enough:

```swift
func condensedSession(from previous: LanguageModelSession) -> LanguageModelSession {
    let entries = previous.transcript.entries

    guard entries.count > 3 else {
        return LanguageModelSession(transcript: previous.transcript)
    }

    // Keep first (instructions) and last (recent)
    var condensedEntries = [entries.first!]

    // Summarize middle entries
    let middleEntries = Array(entries[1..<entries.count-1])
    let summaryPrompt = """
        Summarize this conversation in 2-3 sentences:
        \(middleEntries.map { $0.content }.joined(separator: "\n"))
        """

    // Use Foundation Models itself to summarize!
    let summarySession = LanguageModelSession()
    let summary = try await summarySession.respond(to: summaryPrompt)

    condensedEntries.append(Transcript.Entry(content: summary.content))
    condensedEntries.append(entries.last!)

    return LanguageModelSession(transcript: Transcript(entries: condensedEntries))
}
```

"You could summarize parts of transcript with Foundation Models itself."

### Preventing Context Overflow

**1. Keep prompts concise**:
```swift
// ❌ BAD
let prompt = """
    I want you to generate a comprehensive detailed analysis of this article
    with multiple sections including summary, key points, sentiment analysis,
    main arguments, counter arguments, logical fallacies, and conclusions...
    """

// ✅ GOOD
let prompt = "Summarize this article's key points"
```

**2. Use tools for data**:
Instead of putting entire dataset in prompt, use tools to fetch on-demand.

**3. Break complex tasks into steps**:
```swift
// ❌ BAD - One massive generation
let response = try await session.respond(
    to: "Create 7-day itinerary with hotels, restaurants, activities..."
)

// ✅ GOOD - Multiple smaller generations
let overview = try await session.respond(to: "Create high-level 7-day plan")
for day in 1...7 {
    let details = try await session.respond(to: "Detail activities for day \(day)")
}
```

### Monitoring Context Usage

"Each token in instructions and prompt adds latency. Longer outputs take longer."

**Use Instruments** (Foundation Models template) to:
- See token counts
- Identify verbose prompts
- Optimize context usage

### Time Cost

**Basic overflow handling**: 5-10 minutes
**Condensing strategy**: 15-20 minutes
**Advanced summarization**: 30-40 minutes

---

## Pattern 6: Sampling & Generation Options (~1000 words)

**Use when**: You need control over output randomness/determinism.

### Understanding Sampling

Model generates output **one token at a time**:
1. Creates probability distribution for next token
2. Samples from distribution
3. Picks token
4. Repeats

**Default**: Random sampling → Different output each time

### Deterministic Output (Greedy)

```swift
let response = try await session.respond(
    to: prompt,
    options: GenerationOptions(sampling: .greedy)
)
```

// WWDC 301:6:14

**Use cases**:
- Repeatable demos
- Testing/debugging
- Consistent results required

**Caveat**: Only holds for same model version. OS updates may change output.

### Temperature Control

**Low variance** (conservative, focused):
```swift
let response = try await session.respond(
    to: prompt,
    options: GenerationOptions(temperature: 0.5)
)
```

**High variance** (creative, diverse):
```swift
let response = try await session.respond(
    to: prompt,
    options: GenerationOptions(temperature: 2.0)
)
```

// WWDC 301:6:14

**Temperature scale**:
- `0.1-0.5`: Very focused, predictable
- `1.0` (default): Balanced
- `1.5-2.0`: Creative, varied

**Example use cases**:
- **Low temp**: Fact extraction, classification
- **High temp**: Creative writing, brainstorming

### When to Adjust Sampling

✅ **Greedy for**:
- Unit tests
- Demos
- Consistency critical

✅ **Low temperature for**:
- Factual tasks
- Classification
- Extraction

✅ **High temperature for**:
- Creative content
- Story generation
- Varied NPC dialog

### Time Cost

**Implementation**: 2-3 minutes (one line change)

---

## Pressure Scenarios

### Scenario 1: "Just Use ChatGPT API" (~1000 words)

**Context**: You're implementing a new AI feature. PM suggests using ChatGPT API for "better results."

**Pressure signals**:
- 👔 **Authority**: PM outranks you
- 💸 **Existing integration**: Team already uses OpenAI for other features
- ⏰ **Speed**: "ChatGPT is proven, Foundation Models is new"

**Rationalization traps**:
- "PM knows best"
- "ChatGPT gives better answers"
- "Faster to implement with existing code"

**Why this fails**:

1. **Privacy violation**: User data sent to external server
   - Medical notes, financial docs, personal messages
   - Violates user expectation of on-device privacy
   - Potential GDPR/privacy law issues

2. **Cost**: Every API call costs money
   - Foundation Models is **free**
   - Scale to millions of users = massive costs

3. **Offline unavailable**: Requires internet
   - Airplane mode, poor signal → feature broken
   - Foundation Models works offline

4. **Latency**: Network round-trip adds 500-2000ms
   - Foundation Models: On-device, <100ms startup

**When ChatGPT IS appropriate**:
- World knowledge required (e.g. "Who is the president of France?")
- Complex reasoning (multi-step logic, math proofs)
- Very long context (>4096 tokens)

**Mandatory response**:

```
"I understand ChatGPT delivers great results for certain tasks. However,
for this feature, Foundation Models is the right choice for three critical reasons:

1. **Privacy**: This feature processes [medical notes/financial data/personal content].
   Users expect this data stays on-device. Sending to external API violates that trust
   and may have compliance issues.

2. **Cost**: At scale, ChatGPT API calls cost $X per 1000 requests. Foundation Models
   is free. For Y million users, that's $Z annually we can avoid.

3. **Offline capability**: Foundation Models works without internet. Users in airplane
   mode or with poor signal still get full functionality.

**When to use ChatGPT**: If this feature required world knowledge or complex reasoning,
ChatGPT would be the right choice. But this is [summarization/extraction/classification],
which is exactly what Foundation Models is optimized for.

**Time estimate**: Foundation Models implementation: 15-20 minutes.
Privacy compliance review for ChatGPT: 2-4 weeks."
```

**Time saved**: Privacy compliance review vs correct implementation: 2-4 weeks vs 20 minutes

---

### Scenario 2: "Parse JSON Manually" (~1000 words)

**Context**: Teammate suggests prompting for JSON, parsing with JSONDecoder. Claims it's "simple and familiar."

**Pressure signals**:
- ⏰ **Deadline**: Ship in 2 days
- 📚 **Familiarity**: "Everyone knows JSON"
- 🔧 **Existing code**: Already have JSON parsing utilities

**Rationalization traps**:
- "JSON is standard"
- "We parse JSON everywhere already"
- "Faster than learning new API"

**Why this fails**:

1. **Hallucinated keys**: Model outputs `{firstName: "John"}` when you expect `{name: "John"}`
   - JSONDecoder crashes: `keyNotFound`
   - No compile-time safety

2. **Invalid JSON**: Model might output:
   ```
   Here's the person: {name: "John", age: 30}
   ```
   - Not valid JSON (preamble text)
   - Parsing fails

3. **No type safety**: Manual string parsing, prone to errors

**Real-world example**:
```swift
// ❌ BAD - Will fail
let prompt = "Generate a person with name and age as JSON"
let response = try await session.respond(to: prompt)

// Model outputs: {"firstName": "John Smith", "years": 30}
// Your code expects: {"name": ..., "age": ...}
// CRASH: keyNotFound(name)
```

**Debugging time**: 2-4 hours finding edge cases, writing parsing hacks

**Correct approach**:
```swift
// ✅ GOOD - 15 minutes, guaranteed to work
@Generable
struct Person {
    let name: String
    let age: Int
}

let response = try await session.respond(
    to: "Generate a person",
    generating: Person.self
)
// response.content is type-safe Person, always valid
```

**Mandatory response**:

```
"I understand JSON parsing feels familiar, but for LLM output, @Generable is objectively
better for three technical reasons:

1. **Constrained decoding guarantees structure**: Model can ONLY generate valid Person
   instances. Impossible to get wrong keys, invalid JSON, or missing fields.

2. **No parsing code needed**: Framework handles parsing automatically. Zero chance of
   parsing bugs.

3. **Compile-time safety**: If we change Person struct, compiler catches all issues.
   Manual JSON parsing = runtime crashes.

**Real cost**: Manual JSON approach will hit edge cases. Debugging 'keyNotFound' crashes
takes 2-4 hours. @Generable implementation takes 15 minutes and has zero parsing bugs.

**Analogy**: This is like choosing Swift over Objective-C for new code. Both work, but
Swift's type safety prevents entire categories of bugs."
```

**Time saved**: 4-8 hours debugging vs 15 minutes correct implementation

---

### Scenario 3: "One Big Prompt" (~1000 words)

**Context**: Feature requires extracting name, date, amount, category from invoice. Teammate suggests one prompt: "Extract all information."

**Pressure signals**:
- 🏗️ **Architecture**: "Simpler with one API call"
- ⏰ **Speed**: "Why make it complicated?"
- 📉 **Complexity**: "More prompts = more code"

**Rationalization traps**:
- "Simpler is better"
- "One prompt means less code"
- "Model is smart enough"

**Why this fails**:

1. **Context overflow**: Complex prompt + large invoice → Exceeds 4096 tokens
2. **Poor results**: Model tries to do too much at once, quality suffers
3. **Slow generation**: One massive response takes 5-8 seconds
4. **All-or-nothing**: If one field fails, entire generation fails

**Better approach**: Break into tasks + use tools

```swift
// ❌ BAD - One massive prompt
let prompt = """
    Extract from this invoice:
    - Vendor name
    - Invoice date
    - Total amount
    - Line items (description, quantity, price each)
    - Payment terms
    - Due date
    - Tax amount
    ...
    """
// 4 seconds, poor quality, might exceed context

// ✅ GOOD - Structured extraction with focused prompts
@Generable
struct InvoiceBasics {
    let vendor: String
    let date: String
    let amount: Double
}

let basics = try await session.respond(
    to: "Extract vendor, date, and amount",
    generating: InvoiceBasics.self
) // 0.5 seconds, axiom-high quality

@Generable
struct LineItem {
    let description: String
    let quantity: Int
    let price: Double
}

let items = try await session.respond(
    to: "Extract line items",
    generating: [LineItem].self
) // 1 second, axiom-high quality

// Total: 1.5 seconds, better quality, graceful partial failures
```

**Mandatory response**:

```
"I understand the appeal of one simple API call. However, this specific task requires
a different approach:

1. **Context limits**: Invoice + complex extraction prompt will likely exceed 4096 token
   limit. Multiple focused prompts stay well under limit.

2. **Better quality**: Model performs better with focused tasks. 'Extract vendor name'
   gets 95%+ accuracy. 'Extract everything' gets 60-70%.

3. **Faster perceived performance**: Multiple prompts with streaming show progressive
   results. Users see vendor name in 0.5s, not waiting 5s for everything.

4. **Graceful degradation**: If line items fail, we still have basics. All-or-nothing
   approach means total failure.

**Implementation**: Breaking into 3-4 focused extractions takes 30 minutes. One big
prompt takes 2-3 hours debugging why it hits context limit and produces poor results."
```

**Time saved**: 2-3 hours debugging vs 30 minutes proper design

---

## Performance Optimization

### 1. Prewarm Session (~200 words)

**Problem**: First generation takes 1-2 seconds just to load model.

**Solution**: Create session **before** user interaction.

```swift
class ViewModel: ObservableObject {
    private var session: LanguageModelSession?

    init() {
        // Prewarm on init, not when user taps button
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

"Prewarming session before user interaction reduces initial latency."

**Time saved**: 1-2 seconds off first generation

---

### 2. includeSchemaInPrompt: false (~200 words)

**Problem**: @Generable schemas inserted into prompt, increases token count.

**Solution**: For **subsequent requests** with same schema, skip insertion.

```swift
let firstResponse = try await session.respond(
    to: "Generate first person",
    generating: Person.self
    // Schema inserted automatically
)

// Subsequent requests with SAME schema
let secondResponse = try await session.respond(
    to: "Generate another person",
    generating: Person.self,
    options: GenerationOptions(includeSchemaInPrompt: false)
)
```

"Setting includeSchemaInPrompt to false decreases token count and latency for subsequent requests."

**When to use**: Multi-turn with same @Generable type

**Time saved**: 10-20% latency reduction per request

---

### 3. Property Order for Streaming UX (~200 words)

**Problem**: User waits for entire generation.

**Solution**: Put important properties first, stream to show early.

```swift
// ✅ GOOD - Title shows immediately
@Generable
struct Article {
    var title: String      // Shows in 0.2s
    var summary: String    // Shows in 0.8s
    var fullText: String   // Shows in 2.5s
}

// ❌ BAD - Wait for everything
@Generable
struct Article {
    var fullText: String   // User waits 2.5s
    var title: String
    var summary: String
}
```

**UX impact**: Perceived latency drops from 2.5s to 0.2s

---

### 4. Foundation Models Instrument (~100 words)

**Use Instruments app** with Foundation Models template to:
- Profile latency of each request
- See token counts (input/output)
- Identify optimization opportunities
- Quantify improvements

"New Instruments profiling template lets you observe areas of optimization and quantify improvements."

**Access**: Instruments → Create → Foundation Models template

---

## Checklist

Before shipping Foundation Models features:

### Required Checks
- [ ] **Availability checked** before creating session
- [ ] **Using @Generable** for structured output (not manual JSON)
- [ ] **Handling context overflow** (`exceededContextWindowSize`)
- [ ] **Handling guardrail violations** (`guardrailViolation`)
- [ ] **Handling unsupported language** (`unsupportedLanguageOrLocale`)
- [ ] **Streaming for long generations** (>1 second)
- [ ] **Not blocking UI** (using `Task {}` for async)
- [ ] **Tools for external data** (not prompting for weather/locations)
- [ ] **Prewarmed session** if latency-sensitive

### Best Practices
- [ ] Instructions are concise (not verbose)
- [ ] Never interpolating user input into instructions
- [ ] Property order optimized for streaming UX
- [ ] Using appropriate temperature/sampling
- [ ] Tested on real device (not just simulator)
- [ ] Profiled with Instruments (Foundation Models template)
- [ ] Error handling shows graceful UI messages
- [ ] Tested offline (airplane mode)
- [ ] Tested with long conversations (context handling)

### Model Capability
- [ ] **Not** using for world knowledge
- [ ] **Not** using for complex reasoning
- [ ] Use case is: summarization, extraction, classification, or generation
- [ ] Have fallback if unavailable (show message, disable feature)

---

## Resources

**WWDC**: 286, 259, 301

**Skills**: axiom-foundation-models-diag, axiom-foundation-models-ref

---

**Last Updated**: 2025-12-03
**Version**: 1.0.0
**Target**: iOS 26+, macOS 26+, iPadOS 26+, axiom-visionOS 26+
