
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
- Use `axiom-ai (skills/foundation-models-diag.md)` for systematic troubleshooting (context exceeded, guardrail violations, availability problems)
- Use `axiom-ai (skills/foundation-models-ref.md)` for complete API reference with all WWDC code examples

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
case .unavailable(.deviceNotEligible):
    // Hide AI entry point; degrade to offline functionality
case .unavailable(.appleIntelligenceNotEnabled):
    // Coach the user toward Settings opt-in
case .unavailable(.modelNotReady):
    // Tell the user to try again later; model still downloading
case .unavailable(let other):
    // Unknown reason; show generic fallback
}
```

Each `.unavailable` branch needs a tested fallback UI. Use the Xcode scheme's **Simulated Foundation Models Availability** override to force each reason on an AI-capable device during development — see "Testing Availability Paths" below.

---

### ❌ Single Huge Prompt
**Why it fails**: The model has a fixed context window (input + output) — **8,192 tokens** in the 27 on-device model (`OS27`), 4,096 in the original. One massive prompt hits the limit and gives poor results. Read `SystemLanguageModel().contextSize` rather than assuming a number.

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

### ❌ Not Handling Generation Errors
**Why it fails**: `GenerationError` has 9 cases. Handle the ones your app can actually hit, or it will crash in production. The three below are the most common; the remaining six follow.

```swift
do {
    let response = try await session.respond(to: prompt)
} catch LanguageModelSession.GenerationError.exceededContextWindowSize {
    // Multi-turn transcript grew beyond the context window
    // → Condense transcript and create new session (see Pattern 5)
} catch LanguageModelSession.GenerationError.guardrailViolation {
    // Content policy triggered
    // → Show graceful message: "I can't help with that request"
} catch LanguageModelSession.GenerationError.unsupportedLanguageOrLocale {
    // User input in unsupported language
    // → Show disclaimer, check SystemLanguageModel.default.supportedLanguages
}
```

The remaining six cases (each also carries a `Context`):
- `assetsUnavailable` — model assets aren't on the device (still downloading or evicted); fall back to your non-AI path
- `unsupportedGuide` — a `@Guide` constraint the model can't satisfy; fix the schema, not at runtime
- `decodingFailure` — output couldn't be decoded into your `@Generable` type; surface a retry
- `rateLimited` — too many requests; back off and retry
- `concurrentRequests` — a request was issued while `session.isResponding == true`; serialize requests per session
- `refusal(let refusal, _)` — model refused; the `Refusal` value carries the reason to surface or log

---

### ❌ Assuming Private Cloud Compute Is Always On (OS27)
**Why it fails**: `PrivateCloudComputeLanguageModel` (`OS27`) is entitlement-gated, device-eligibility-gated, network-dependent, and quota-limited. Treating it like the on-device model — no availability check, no quota handling — ships a feature that silently fails for ineligible devices, offline users, or anyone who hits their daily limit.

```swift
let pcc = PrivateCloudComputeLanguageModel()
guard pcc.isAvailable else { /* fall back to SystemLanguageModel */ return }
do {
    let response = try await LanguageModelSession(model: pcc).respond(to: prompt)
} catch let error as PrivateCloudComputeLanguageModel.Error {
    switch error {
    case .quotaLimitReached(let info):     // info.resetDate / .limitIncreaseSuggestion
        break  // tell the user when access resets; offer the on-device path
    case .networkFailure, .serviceUnavailable:
        break  // PCC needs the network — fall back or retry
    }
}
```

**Correct approach**: check `availability`/`isAvailable`, handle `.quotaLimitReached`/`.networkFailure`/`.serviceUnavailable`, and keep the on-device model as a fallback. PCC requires the Private Cloud Compute entitlement.

---

## Mandatory First Steps

Before writing any Foundation Models code, complete these steps:

### 1. Check Availability

See "Ignoring Availability Check" in Red Flags above for the required pattern. Foundation Models requires Apple Intelligence-enabled device, supported region, and user opt-in.

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

for try await snapshot in stream {
    // Update UI incrementally
    self.itinerary = snapshot.content
}
```

**Why**: Users see progress immediately, perceived latency drops dramatically.

---

## Testing Availability Paths

Every `.unavailable(reason:)` branch in the availability switch needs a tested fallback UI. The canonical production crisis (see `axiom-ai (skills/foundation-models-diag.md)` "Production Crisis Scenario") is shipping a feature without testing the non-AI path — 20% of users on older devices get an error wall instead of a graceful degradation.

Xcode 26 provides a **Simulated Foundation Models Availability** override in the scheme editor that forces each `.unavailable` reason — plus the adapter-incompatible runtime error — on an AI-capable device. Use it instead of bench-testing on a non-AI device or disabling Apple Intelligence in Settings.

**Where**: Product menu → Scheme → Edit Scheme → Run → Options → "Simulated Foundation Models Availability" override.

**Override states**:

| Override | Triggers | Test the UI that |
|----------|----------|-------------------|
| Off (default) | Device's actual availability | Real-device behavior; `.available` on AI-capable hardware |
| Device Not Eligible | Force `.unavailable(.deviceNotEligible)` | Hides the AI entry point entirely; falls back to offline data |
| Apple Intelligence Not Enabled | Force `.unavailable(.appleIntelligenceNotEnabled)` | Tells the user the feature requires opting in; deep-links to Settings |
| Model Not Ready | Force `.unavailable(.modelNotReady)` | Tells the user to try again later; model still downloading |
| Custom Adapter Incompatible With Base Model | Force `SystemLanguageModel.Adapter.AssetError.compatibleAdapterNotFound` on adapter load | Adapter-using code paths fall back to base model or surface a "needs update" prompt — see `foundation-models-adapters-diag.md` Pattern 1 |

The first four force a specific `SystemLanguageModel.Availability` state. The fifth simulates a **runtime adapter-load error**, not an `Availability` case — `UnavailableReason` itself has only three cases (`deviceNotEligible`, `appleIntelligenceNotEnabled`, `modelNotReady`). Apps without custom adapters can ignore the fifth row.

**Required test loop**: run the app against each override at least once before submission. Confirm each branch renders the right UI, the unavailable branches do not attempt to construct a `LanguageModelSession`, and adapter-using paths handle `compatibleAdapterNotFound` cleanly.

### Testing Environment Matrix

Foundation Models support depends on the simulator/host/VM combination. Apple DTS confirmed in forum thread 787199 that **simulators use the models shipped with the host macOS** — so simulators on a Sequoia (15.x) host have no model to load, and macOS-26-in-a-VM cannot enable Apple Intelligence at all.

| Environment | Works? | Notes |
|-------------|--------|-------|
| Physical iPhone 15 Pro+ / iPad M-series / Apple silicon Mac on iOS / iPadOS / macOS 26+ | ✅ | Canonical; required for any meaningful behavior testing |
| iPhone simulator on Apple silicon Mac running macOS 26+ with Apple Intelligence enabled | ✅ | Confirmed by Apple DTS; inherits host's model and availability; respects the scheme override |
| visionOS simulator on Apple silicon Mac running macOS 26+ with Apple Intelligence enabled | ✅ | Same as iPhone simulator |
| Any simulator on Apple silicon Mac running macOS Sequoia (15.x) | ❌ | Host macOS doesn't ship FM models; simulators have nothing to load |
| Any simulator on Intel Mac | ❌ | Hardware-gated; Apple Intelligence requires Apple silicon |
| macOS 26 running in a VM (Virtual Buddy, UTM, Parallels) on an Apple silicon host | ❌ | Apple Intelligence cannot be enabled in a macOS-in-a-VM environment (`.deviceNotEligible`); user-reported in forum thread 787199 |
| iOS simulator running *inside* a macOS-26 VM | ⚠️ | Availability reports `.available` but runtime fails: `Error Domain=com.apple.UnifiedAssetFramework Code=5000` ("no underlying assets for asset set com.apple.MobileAsset.UAF.FM.Overrides") — the embedded sim has no real model to talk to |
| Dual-boot macOS 26 on separate APFS volume | ✅ | Confirmed by Apple DTS as a supported alternative to upgrading the primary install |

**Implication for CI/CD**:

- Apple silicon runners booted into macOS 26+ with Apple Intelligence enabled → iOS / iPadOS / visionOS simulator tests against FM work
- VM-based runners (the common cheap-CI configuration) → both host macOS app tests and embedded simulator tests will fail at runtime
- macOS app tests that exercise FM directly require a **physical Apple silicon Mac** runner, not a VM
- The Xcode scheme's Simulated Foundation Models Availability override (above) works in any supported environment and is the right tool for exercising non-AI paths on AI-capable CI runners

**Practical recipes**:

- **Single-developer machine, don't want to risk beta on primary install** → dual-boot macOS 26 on a separate APFS volume; develop and test from the macOS 26 boot, switch back for daily driver work
- **CI runner constraint** → either provision physical Apple silicon runners booted into macOS 26+, or accept that the FM-touching tests must run on-device (TestFlight / device farm)
- **Designer / PM review without a fleet** → AI-capable Mac + iOS simulator + scheme override; covers every `.unavailable` branch and the happy path without leaving the desk

**Source caveat**: the macOS-VM behavior is documented in forum thread 787199 as of June 2025 (iOS 26 beta) and was still accurate at the time of this writing. Apple may revisit VM support in a future macOS update; re-verify if VM-based CI is on the table.

**When this is the right tool**:
- ✅ Verifying every `.unavailable` branch in your `switch`
- ✅ CI runs that need to exercise non-AI code paths on AI-capable runners
- ✅ Designer / PM review of the fallback UI without a fleet of older devices
- ❌ Testing actual model behavior changes (use real devices for that)
- ❌ Testing offline / poor-network scenarios (the override doesn't simulate network state)

**Cross-references**:
- `axiom-ai (skills/foundation-models-diag.md)` Patterns 1a/1b/1c (per-reason diagnostic when the override isn't engaged but production reports the same case)
- `axiom-ai (skills/foundation-models-diag.md)` "Production Crisis Scenario" (the 20%-on-non-AI failure pattern this override prevents)

---

## Approach Triage — Try Each Before the Next

Foundation Models gives you the on-device LLM directly. **Most quality complaints stem from skipping intermediate steps and reaching for custom adapter training.** Apple's explicit guidance: *"Before considering adapters, try to get the most out of the system model using prompt engineering or tool calling."* Run this ladder before considering any custom training:

```
You want the model to do task X better.
│
├─ 1. Have you written clear, explicit instructions?
│  └─ Imperative phrasing ("DO X", "DO NOT Y"), defined role, few-shot
│     examples in the prompt. Pattern 1 covers this.
│  → Stop here if quality is good enough.
│
├─ 2. Are you generating structured output via @Generable?
│  └─ @Generable + @Guide give constrained-decoding guarantees the
│     prompt can't. Pattern 2 covers this.
│  → Stop here if structural failures were the issue.
│
├─ 3. Are you giving the model the right context via Tool calling or RAG?
│  └─ Tool protocol for weather / contacts / calendar lookups; in-prompt
│     retrieval for app-side documents. Pattern 4 covers tool calling.
│     Hallucination on factual tasks is almost always a context problem,
│     not a model problem.
│  → Stop here if factual gaps were the issue.
│
├─ 4. Does the use case match a built-in adapter?
│  └─ `SystemLanguageModel(useCase: .contentTagging)` ships an Apple-
│     trained adapter that beats prompt engineering for tag / entity
│     extraction. See `foundation-models-ref.md`.
│  → Stop here if your task is tag / entity extraction.
│
└─ 5. Only then — consider training a custom adapter.
   └─ Apple's Adapter Training Toolkit (Python, Developer Program-gated)
      trains a rank-32 LoRA adapter against a specific base-model
      version. The cost is real:
      - ~160 MB per adapter, delivered via Background Assets (NOT
        bundle-able); see `axiom-integration (skills/background-assets.md)`
      - Per-OS-version pinning: one adapter per system-model release
        in your install base, retrained every OS minor
      - Custom evaluation methodology required (quantitative metrics +
        human or larger-model grading + safety eval, locale-specific)
      - Apple Developer Program toolkit download + entitlement request
        for deployment
      → Do not start here. Verify steps 1-4 first. Adapter training
        is the highest-cost, lowest-iteration-velocity option in this
        ladder. When you've genuinely reached this rung, see
        `skills/foundation-models-adapters.md` for decision discipline,
        `skills/foundation-models-adapters-ref.md` for the toolkit and
        runtime API, and `skills/foundation-models-adapters-diag.md`
        for adapter-specific failure modes.
```

**Decision rule**: every rung you skip is a rung's worth of free quality you're leaving on the table. Adapter training without rungs 1-4 done first is almost always a sign that prompt engineering, `@Generable`, or tool calling wasn't given a fair attempt.

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

## Pattern 1: Basic Session

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

**Why this works**: Session retains transcript automatically. Model uses context from previous turns.

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

---

## Pattern 2: @Generable Structured Output

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

### How It Works (Constrained Decoding)

1. `@Generable` macro generates schema at compile-time
2. Schema passed to model automatically
3. Model generates tokens constrained by schema
4. Framework parses output into Swift type
5. **Guaranteed structural correctness** — No hallucinated keys, no parsing errors

"Constrained decoding masks out invalid tokens. Model can only pick tokens valid according to schema."

### Supported Types

Supports `String`, `Int`, `Float`, `Double`, `Bool`, arrays, nested `@Generable` types, enums with associated values, and recursive types. See `axiom-ai (skills/foundation-models-ref.md)` for complete list with examples.

### @Guide Constraints

Control generated values with `@Guide`. Supports descriptions, numeric ranges, array counts, and regex patterns:

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

**Runtime validation**: `@Guide` constraints are enforced during generation via constrained decoding — the model cannot produce out-of-range values. However, always validate business logic on the result since the model may produce semantically wrong but structurally valid output.

See `axiom-ai (skills/foundation-models-ref.md)` for complete `@Guide` reference (ranges, regex, maximum counts).

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

## Pattern 3: Streaming with PartiallyGenerated

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

for try await snapshot in stream {
    print(snapshot.content) // Incrementally updated
}
```

### PartiallyGenerated Type

`@Generable` macro automatically creates a `PartiallyGenerated` type where all properties are optional (they fill in as the model generates them). See `axiom-ai (skills/foundation-models-ref.md)` for details.

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

                    for try await snapshot in stream {
                        self.itinerary = snapshot.content
                    }
                }
            }
        }
    }
}
```

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

### Streaming Error Handling

Handle errors during streaming gracefully — partial results may already be displayed:

```swift
do {
    for try await snapshot in stream {
        self.itinerary = snapshot.content
    }
} catch LanguageModelSession.GenerationError.guardrailViolation {
    // Partial content may be visible — show non-disruptive error
    self.errorMessage = "Generation stopped by content policy"
} catch LanguageModelSession.GenerationError.exceededContextWindowSize {
    // Too much context — create fresh session and retry
    session = LanguageModelSession()
}
```

---

## Pattern 4: Tool Calling

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

    func call(arguments: Arguments) async throws -> String {
        let places = try await CLGeocoder().geocodeAddressString(arguments.city)
        let weather = try await WeatherService.shared.weather(for: places.first!.location!)
        let temp = weather.currentWeather.temperature.value

        return "\(arguments.city)'s temperature is \(temp) degrees."
    }
}
```

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

**Model autonomously**:
1. Recognizes it needs weather data
2. Calls `GetWeatherTool`
3. Receives real temperature
4. Incorporates into natural response

### Key Concepts

- **Tool protocol**: Requires `name`, `description`, an `Arguments` type, and a `call(arguments:)` method. `Arguments` must conform to `ConvertibleFromGeneratedContent` — a `@Generable` struct satisfies this.
- **Return value**: There is no `ToolOutput` type. `call(arguments:)` returns its associated `Output` directly — a `String` (natural language; `String` is `PromptRepresentable`), or a `@Generable`/`GeneratedContent` value for structured output.
- **Multiple tools**: Session accepts array of tools; model autonomously decides which to call
- **Stateful tools**: Use `class` (not `struct`) when tools need to maintain state across calls

See `axiom-ai (skills/foundation-models-ref.md)` for `Tool` protocol reference, `Output` forms, stateful tool patterns, and additional examples.

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

---

## Pattern 5: Context Management

**Use when**: Multi-turn conversations that might exceed the model's context window.

### The Problem

```swift
// Long conversation...
for i in 1...100 {
    let response = try await session.respond(to: "Question \(i)")
    // Eventually...
    // Error: exceededContextWindowSize
}
```

**Context window**: always read `SystemLanguageModel().contextSize` at runtime. The rebuilt 27 on-device model reports **8,192 tokens** (input + output combined) — double the original 4,096 (`OS27`). Don't hard-code either number.

**Exact sizing for Instructions** (iOS 26.4+): `try await SystemLanguageModel.default.tokenCount(for: instructions)`. Use this before composing a session so verbose instructions don't silently consume the budget.

**Estimation fallback** for prompts, transcripts, and pre-26.4 targets: ~3 characters per token in English; more for PFIGSCJK languages. See `axiom-ai (skills/foundation-models-ref.md)` "Token Sizing and Context Size".

**Rough calculation** (8,192-token on-device window):
- 8,192 tokens ≈ 24,000 characters
- ≈ 4,000-6,000 words total

**Long conversation** or **verbose prompts/responses** → Exceed limit

**Genuinely need more?** Escalating to `PrivateCloudComputeLanguageModel` (`OS27`) raises the window to **32,000 tokens** while staying inside Apple's privacy boundary — prefer it over a third-party server when the use case fits. See `axiom-ai (skills/foundation-models-ref.md)` "Private Cloud Compute".

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
    // Transcript is a RandomAccessCollection of Transcript.Entry — there is no
    // `.entries` property; index/iterate it directly.
    let transcript = previous.transcript
    var condensedEntries = [Transcript.Entry]()

    // Always include first entry (instructions)
    if let first = transcript.first {
        condensedEntries.append(first)

        // Include last entry (most recent context)
        if transcript.count > 1, let last = transcript.last {
            condensedEntries.append(last)
        }
    }

    let condensedTranscript = Transcript(entries: condensedEntries)
    return LanguageModelSession(transcript: condensedTranscript)
}
```

**Why this works**:
- Instructions always preserved
- Recent context retained
- Total tokens drastically reduced

For advanced strategies (summarizing middle entries with Foundation Models itself), see `axiom-ai (skills/foundation-models-ref.md)`.

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

---

## Pattern 6: Sampling & Generation Options

**Use when**: You need control over output randomness/determinism.

### When to Adjust Sampling

| Goal | Setting | Use Cases |
|------|---------|-----------|
| Deterministic | `GenerationOptions(sampling: .greedy)` | Unit tests, demos, consistency-critical |
| Focused | `GenerationOptions(temperature: 0.5)` | Fact extraction, classification |
| Creative | `GenerationOptions(temperature: 2.0)` | Story generation, brainstorming, varied NPC dialog |

**Default**: Random sampling (temperature 1.0) gives balanced results.

**Caveat**: Greedy determinism only holds for same model version. OS updates may change output.

See `axiom-ai (skills/foundation-models-ref.md)` for complete `GenerationOptions` API reference.

---

## Pressure Scenarios

### Scenario 1: "Just Use ChatGPT API"

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

### Scenario 2: "Parse JSON Manually"

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

### Scenario 3: "One Big Prompt"

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
) // 0.5 seconds, high quality

@Generable
struct LineItem {
    let description: String
    let quantity: Int
    let price: Double
}

let items = try await session.respond(
    to: "Extract line items",
    generating: [LineItem].self
) // 1 second, high quality

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

## User Trust & Disclosure (HIG Generative AI)

Apple's HIG on Generative AI sets baseline requirements that apply to every Foundation Models feature regardless of whether you use the base model, the built-in content-tagging adapter, or a custom-trained adapter.

### Mandatory disclosure

**"Never trick someone into thinking they're interacting with or viewing content authored by a human if they're actually interacting with AI."** This is the load-bearing rule.

Practical implications:
- Visible labeling on AI-generated content (Image Playground is the canonical pattern — visible "Made by AI" affordance plus region-appropriate disclosure)
- Set expectations *before* the user invokes the feature, not after
- Disclosure must align with applicable regulations in each region

### Error and refusal UX

Apple's HIG: *"Help people improve requests when blocked or undesirable results occur. Minimize scoped or blocked output by coaching people how to be more successful next time."*

When `guardrailViolation` fires:
- Don't show a moralizing error wall. Name the failure neutrally ("Unable to use that description") and offer a constructive next step (suggested alternative prompts).
- Don't display the user's blocked input back to them — log for review without surfacing harmful content.

When `exceededContextWindowSize` fires:
- Don't surface "Error 4096 tokens exceeded" — that's developer text, not user text.
- Offer "Start a new conversation" or summarize-and-continue as a one-tap action.

### Retry as a first-class affordance

HIG: *"Give them the ability to dismiss new content they don't want, and revert or retry content transformations."*

Generative features need:
- Retry button on every result, not only on errors
- Alternate results so people can choose
- Dismiss / revert path for content transformations

### Feedback collection

Recommended pattern: thumbs-up / thumbs-down on each generated result. Voluntary, not mandatory. The `LanguageModelFeedback` struct + `session.logFeedbackAttachment(sentiment:issues:desiredOutput:)` API (see `foundation-models-ref.md`) bundles input / output / sentiment / issues into a `Data` payload for Feedback Assistant.

### Trust language

HIG: *"Ensure they remain in charge of decision making and the overall experience."*

- Provide a clear opt-out path for any data use
- Disclose whether personal data is used for training (Apple's foundation models do NOT train on user data; if your app sends anything to a server LLM, you must disclose that)
- Test across a diverse set of people to identify and correct stereotypes

---

## Performance Optimization

### Key Optimizations

1. **Prewarm session**: Create `LanguageModelSession` at init, not when user taps button. Saves 1-2 seconds off first generation.

2. **`includeSchemaInPrompt: false`**: For subsequent requests with the same `@Generable` type, pass this as an argument to `respond(...)` / `streamResponse(...)` (it's a method parameter, default `true` — NOT a `GenerationOptions` field) to reduce token count by 10-20%.

3. **Property order for streaming**: Put most important properties first in `@Generable` structs. User sees title in 0.2s instead of waiting 2.5s for full generation.

4. **Foundation Models Instrument**: Use `Instruments > Foundation Models` template to profile latency, see token counts, and identify optimization opportunities.

See `axiom-ai (skills/foundation-models-ref.md)` for code examples of each optimization.

---

## Checklist

Before shipping Foundation Models features:

### Required Checks
- [ ] **Availability checked** before creating session
- [ ] **Using @Generable** for structured output (not manual JSON)
- [ ] **Handling the `GenerationError` cases your app can hit** (9 total) — at minimum `exceededContextWindowSize`, `guardrailViolation`, and `unsupportedLanguageOrLocale`; plus `assetsUnavailable`, `unsupportedGuide`, `decodingFailure`, `rateLimited`, `concurrentRequests`, and `refusal` where applicable
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
- [ ] **Not** using the on-device model for complex reasoning (escalate to `PrivateCloudComputeLanguageModel` for that — `OS27`)
- [ ] Use case is: summarization, extraction, classification, or generation
- [ ] Have fallback if unavailable (show message, disable feature)
- [ ] Image input gated on `model.capabilities.contains(.vision)` (`OS27`)
- [ ] Private Cloud Compute paths check `availability` and handle quota/network errors (`OS27`)

---

## Resources

**WWDC**: 2025-286, 2025-259, 2025-301, 2026-241, 2026-242

**Skills**: axiom-ai (skills/foundation-models-diag.md), axiom-ai (skills/foundation-models-ref.md)

---

**Last Updated**: 2026-06-09
**Target**: iOS 26+, macOS 26+, iPadOS 26+, visionOS 26+; OS27 surface verified against the Xcode 27 SDK
