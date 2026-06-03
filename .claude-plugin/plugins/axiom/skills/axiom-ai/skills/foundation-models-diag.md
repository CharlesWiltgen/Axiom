
# Foundation Models Diagnostics

## Overview

Foundation Models issues manifest as context window exceeded errors, guardrail violations, slow generation, availability failures, and unexpected output. **Core principle** 80% of Foundation Models problems stem from misunderstanding model capabilities (3B parameter device-scale model, not world knowledge), context limits (4096 tokens), or availability requirements—not framework bugs.

## Red Flags — Suspect Foundation Models Issue

If you see ANY of these, suspect a Foundation Models misunderstanding, not framework breakage:
- Generation takes >5 seconds
- Error: `exceededContextWindowSize`
- Error: `guardrailViolation`
- Error: `unsupportedLanguageOrLocale`
- Model gives hallucinated/wrong output
- UI freezes during generation
- Feature works in simulator but not on device
- ❌ **FORBIDDEN** "Foundation Models is broken, we need a different AI"
  - Foundation Models powers Apple Intelligence across millions of devices
  - Wrong output = wrong use case (world knowledge vs summarization)
  - Do not rationalize away the issue—diagnose it

**Critical distinction** Foundation Models is a **device-scale model** (3B parameters) optimized for summarization, extraction, classification—NOT world knowledge or complex reasoning. Using it for the wrong task guarantees poor results.

## Mandatory First Steps

**ALWAYS run these FIRST** (before changing code):

```swift
// 1. Check availability
let availability = SystemLanguageModel.default.availability

switch availability {
case .available:
    print("✅ Available")
case .unavailable(let reason):
    print("❌ Unavailable: \(reason)")
    // The only three reasons the API surfaces (UnavailableReason):
    // - .deviceNotEligible — device not Apple Intelligence-capable
    // - .appleIntelligenceNotEnabled — user hasn't turned on Apple Intelligence
    // - .modelNotReady — model still downloading / not yet ready; retry later
}

// Record: "Available? Yes/no, reason if not"

// 2. Check supported languages
let supported = SystemLanguageModel.default.supportedLanguages
print("Supported languages: \(supported)")
print("Current locale: \(Locale.current.language)")

if !supported.contains(Locale.current.language) {
    print("⚠️ Current language not supported!")
}

// Record: "Language supported? Yes/no"

// 3. Check context usage
let session = LanguageModelSession()
// Transcript is a RandomAccessCollection of Transcript.Entry — iterate it directly.
// After some interactions:
print("Transcript entries: \(session.transcript.count)")

// Rough estimation (not exact). Entry is an enum (.instructions / .prompt /
// .toolCalls / .toolOutput / .response); text lives in each case's Segments,
// so reconstruct prompt/response text from those rather than a `.content` property:
func text(in entry: Transcript.Entry) -> String {
    let segments: [Transcript.Segment]
    switch entry {
    case .instructions(let i): segments = i.segments
    case .prompt(let p):       segments = p.segments
    case .toolOutput(let o):   segments = o.segments
    case .response(let r):     segments = r.segments
    case .toolCalls:           segments = []
    @unknown default:          segments = []
    }
    return segments.compactMap { segment in
        if case .text(let textSegment) = segment { return textSegment.content }
        return nil
    }.joined()
}

let transcriptText = session.transcript.map(text(in:)).joined()
print("Approximate chars: \(transcriptText.count)")
print("Rough token estimate: \(transcriptText.count / 3)")
// 4096 token limit ≈ 12,000 characters

// Record: "Approaching context limit? Yes/no"

// 4. Profile with Instruments
// Run with Foundation Models Instrument template
// Check:
// - Initial model load time
// - Token counts (input/output)
// - Generation time per request
// - Areas for optimization

// Record: "Latency profile: [numbers from Instruments]"

// 5. Inspect transcript for debugging
print("Full transcript:")
for entry in session.transcript {
    print("Entry: \(text(in: entry).prefix(100))...")
}

// Record: "Any unusual entries? Repeated content?"
```

#### What this tells you
- **Unavailable** → Proceed to Pattern 1a/1b/1c (availability issues)
- **Context exceeded** → Proceed to Pattern 2a (token limit)
- **Guardrail error** → Proceed to Pattern 2b (content policy)
- **Language error** → Proceed to Pattern 2c (unsupported language)
- **Wrong output** → Proceed to Pattern 3a/3b/3c (output quality)
- **Slow generation** → Proceed to Pattern 4a/4b/4c/4d (performance)
- **UI frozen** → Proceed to Pattern 5a (main thread blocking)

#### MANDATORY INTERPRETATION

Before changing ANY code, identify ONE of these:

1. If `availability = .unavailable` → Read the `UnavailableReason`: `.deviceNotEligible` (device), `.appleIntelligenceNotEnabled` (opt-in), or `.modelNotReady` (still downloading — retry later). Not a code bug.
2. If error is `exceededContextWindowSize` → Too many tokens (condense transcript)
3. If error is `guardrailViolation` → Content policy triggered (not model failure)
4. If error is `unsupportedLanguageOrLocale` → Language not supported (check supported list)
5. If output is hallucinated → Wrong use case (world knowledge vs extraction)
6. If generation >5 seconds → Not streaming or need optimization
7. If UI frozen → Calling on main thread (use Task {})

#### If diagnostics are contradictory or unclear
- STOP. Do NOT proceed to patterns yet
- Add detailed logging to every `respond()` call
- Run with Instruments Foundation Models template
- Establish baseline: what's actually happening vs what you assumed

## Decision Tree

```
Foundation Models problem?
│
├─ Won't start?
│  ├─ .unavailable → Availability issue
│  │  ├─ .deviceNotEligible? → Pattern 1a (device requirement)
│  │  ├─ .modelNotReady? → Pattern 1b (model not yet ready — retry later)
│  │  └─ .appleIntelligenceNotEnabled? → Pattern 1c (Settings check)
│  │
├─ Generation fails?
│  ├─ exceededContextWindowSize → Context limit
│  │  └─ Long conversation or verbose prompts? → Pattern 2a (condense)
│  │
│  ├─ guardrailViolation → Content policy
│  │  └─ Sensitive or inappropriate content? → Pattern 2b (handle gracefully)
│  │
│  ├─ unsupportedLanguageOrLocale → Language issue
│  │  └─ Non-English or unsupported language? → Pattern 2c (language check)
│  │
│  └─ Other error → General error handling
│     └─ Unknown error type? → Pattern 2d (catch-all)
│
├─ Output wrong?
│  ├─ Hallucinated facts → Wrong model use
│  │  └─ Asking for world knowledge? → Pattern 3a (use case mismatch)
│  │
│  ├─ Wrong structure → Parsing issue
│  │  └─ Manual JSON parsing? → Pattern 3b (use @Generable)
│  │
│  ├─ Missing data → Tool needed
│  │  └─ Need external information? → Pattern 3c (tool calling)
│  │
│  └─ Inconsistent output → Sampling issue
│     └─ Different results each time? → Pattern 3d (temperature/greedy)
│
├─ Too slow?
│  ├─ Initial delay (1-2s) → Model loading
│  │  └─ First request slow? → Pattern 4a (prewarm)
│  │
│  ├─ Long wait for results → Not streaming
│  │  └─ User waits 3-5s? → Pattern 4b (streaming)
│  │
│  ├─ Verbose schema → Token overhead
│  │  └─ Large @Generable type? → Pattern 4c (includeSchemaInPrompt)
│  │
│  └─ Complex prompt → Too much processing
│     └─ Massive prompt or task? → Pattern 4d (break down)
│
└─ UI frozen?
   └─ Main thread blocked → Async issue
      └─ App unresponsive during generation? → Pattern 5a (Task {})
```

## Diagnostic Patterns

### Pattern 1a: Device Not Capable

**Symptom**:
- `SystemLanguageModel.default.availability = .unavailable`
- Reason: Device not Apple Intelligence-capable

**Diagnosis**:
```swift
let availability = SystemLanguageModel.default.availability

switch availability {
case .available:
    print("✅ Available")
case .unavailable(let reason):
    print("❌ Reason: \(reason)")
    // Check if device-related
}
```

**Fix**:
```swift
// ❌ BAD - No availability UI
let session = LanguageModelSession() // Crashes on unsupported devices

// ✅ GOOD - Graceful UI
struct AIFeatureView: View {
    @State private var availability = SystemLanguageModel.default.availability

    var body: some View {
        switch availability {
        case .available:
            AIContentView()
        case .unavailable:
            VStack {
                Image(systemName: "cpu")
                Text("AI features require Apple Intelligence")
                    .font(.headline)
                Text("Available on iPhone 15 Pro and later")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}
```

**Time cost**: 5-10 minutes to add UI

---

### Pattern 1b: Model Not Ready

**Symptom**:
- Device is eligible and Apple Intelligence is enabled, but `.unavailable(.modelNotReady)`
- Often transient right after enabling Apple Intelligence or after an OS update — the model assets are still downloading

**Diagnosis**:
`UnavailableReason.modelNotReady` means the device qualifies but the model isn't ready yet (still downloading or preparing). There is NO region/locale reason in the API — `UnavailableReason` has exactly three cases: `.deviceNotEligible`, `.appleIntelligenceNotEnabled`, `.modelNotReady`.

**Fix**:
```swift
// ✅ GOOD - Tell the user it's coming, offer retry
switch SystemLanguageModel.default.availability {
case .available:
    // proceed
case .unavailable(.modelNotReady):
    Text("AI features are getting ready")
    Text("The on-device model is still downloading. Try again in a little while.")
    Button("Retry") { /* re-read SystemLanguageModel.default.availability */ }
case .unavailable:
    // .deviceNotEligible or .appleIntelligenceNotEnabled — see Patterns 1a / 1c
    EmptyView()
}
```

**Time cost**: 5 minutes

---

### Pattern 1c: User Not Opted In

**Symptom**:
- Device capable, model ready
- Still `.unavailable(.appleIntelligenceNotEnabled)`

**Diagnosis**:
User must turn on Apple Intelligence in Settings (`.appleIntelligenceNotEnabled`)

**Fix**:
```swift
// ✅ GOOD - Direct user to settings
switch SystemLanguageModel.default.availability {
case .available:
    // proceed
case .unavailable:
    VStack {
        Text("Enable Apple Intelligence")
        Text("Settings → Apple Intelligence → Enable")
        Button("Open Settings") {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        }
    }
}
```

**Time cost**: 10 minutes

---

### Pattern 2a: Context Window Exceeded

**Symptom**:
```
Error: LanguageModelSession.GenerationError.exceededContextWindowSize
```

**Diagnosis**:
- Token limit is `SystemLanguageModel.default.contextSize` (currently 4096 on the on-device base; input + output combined)
- Long conversations accumulate tokens
- Verbose prompts eat into limit
- On iOS 26.4+, use `try await SystemLanguageModel.default.tokenCount(for: instructions)` to verify the instructions budget *before* composing a session; for prompt and transcript sizing, fall back to the ~3 chars/token heuristic (see `axiom-ai (skills/foundation-models-ref.md)` "Token Sizing and Context Size")

**Fix**:
```swift
// ❌ BAD - Unhandled error
let response = try await session.respond(to: prompt)
// Crashes after ~10-15 turns

// ✅ GOOD - Condense transcript
var session = LanguageModelSession()

do {
    let response = try await session.respond(to: prompt)
} catch LanguageModelSession.GenerationError.exceededContextWindowSize {
    // Condense and continue
    session = condensedSession(from: session)
    let response = try await session.respond(to: prompt)
}

func condensedSession(from previous: LanguageModelSession) -> LanguageModelSession {
    // Transcript is a RandomAccessCollection of Transcript.Entry — iterate/index it directly.
    let transcript = previous.transcript

    guard transcript.count > 2,
          let first = transcript.first,
          let last = transcript.last else {
        return LanguageModelSession(transcript: transcript)
    }

    // Keep: first (instructions) + last (recent context). Rebuild from Entry values.
    let condensed = Transcript(entries: [first, last])
    return LanguageModelSession(transcript: condensed)
}
```

**Time cost**: 15-20 minutes to implement condensing

---

### Pattern 2b: Guardrail Violation

**Symptom**:
```
Error: LanguageModelSession.GenerationError.guardrailViolation
```

**Diagnosis**:
- User input triggered content policy
- Violence, hate speech, illegal activities
- Model refuses to generate

**Fix**:
```swift
// ✅ GOOD - Graceful handling
do {
    let response = try await session.respond(to: userInput)
    print(response.content)
} catch LanguageModelSession.GenerationError.guardrailViolation {
    // Show user-friendly message
    print("I can't help with that request")
    // Log for review (but don't show user input to avoid storing harmful content)
}
```

**If the refusal is on content you believe is legitimate** (news summarization, faithful transformation, a real place name), don't reflexively flip to `permissiveContentTransformations`. The decision — is this refusal correct or over-restrictive, is permissive appropriate, how do you prove it's safe — lives in `axiom-ai (skills/foundation-models-guardrails.md)`.

**Time cost**: 5-10 minutes

---

### Pattern 2c: Unsupported Language

**Symptom**:
```
Error: LanguageModelSession.GenerationError.unsupportedLanguageOrLocale
```

**Diagnosis**:
User input in language model doesn't support

**Fix**:
```swift
// ❌ BAD - No language check
let response = try await session.respond(to: userInput)
// Crashes if unsupported language

// ✅ GOOD - Check first
let supported = SystemLanguageModel.default.supportedLanguages

guard supported.contains(Locale.current.language) else {
    // Show disclaimer
    print("Language not supported. Currently supports: \(supported)")
    return
}

// Also handle errors
do {
    let response = try await session.respond(to: userInput)
} catch LanguageModelSession.GenerationError.unsupportedLanguageOrLocale {
    print("Please use English or another supported language")
}
```

**Time cost**: 10 minutes

---

### Pattern 2d: General Error Handling

**Symptom**:
Unknown error types

**Fix**:

`GenerationError` has **nine** cases, not three. Each carries a `Context` payload (`refusal` carries `(Refusal, Context)`) you can inspect for diagnostics — `context.debugDescription`, or `await refusal.explanation` for the model's own reason. Handle them all:

```swift
// ✅ GOOD - Handle every GenerationError case
do {
    let response = try await session.respond(to: prompt)
    print(response.content)
} catch LanguageModelSession.GenerationError.exceededContextWindowSize {
    // Too many tokens — condense the transcript and retry (see Pattern 2a)
    session = condensedSession(from: session)
} catch LanguageModelSession.GenerationError.assetsUnavailable {
    // Model assets not on device yet (downloading) — tell user to try later
    showMessage("AI model isn't ready yet. Please try again shortly.")
} catch LanguageModelSession.GenerationError.guardrailViolation {
    // Content policy triggered (see Pattern 2b)
    showMessage("Cannot generate that content")
} catch LanguageModelSession.GenerationError.unsupportedGuide {
    // A @Guide constraint the model can't satisfy — relax/fix the @Guide in your @Generable type
    showMessage("Couldn't satisfy the requested format. Loosen the @Guide constraints.")
} catch LanguageModelSession.GenerationError.unsupportedLanguageOrLocale {
    // Language not supported (see Pattern 2c)
    showMessage("Language not supported")
} catch LanguageModelSession.GenerationError.decodingFailure {
    // Output didn't decode into the requested @Generable type — simplify the type or retry
    showMessage("Couldn't parse the response. Try again.")
} catch LanguageModelSession.GenerationError.rateLimited {
    // Too many requests — back off and retry with delay
    showMessage("Too many requests. Please wait a moment.")
} catch LanguageModelSession.GenerationError.concurrentRequests {
    // A second request was issued while session.isResponding == true.
    // Serialize calls per session (or use a separate session) — don't fire in parallel.
    showMessage("A request is already in progress.")
} catch let LanguageModelSession.GenerationError.refusal(refusal, _) {
    // Model refused. The Refusal value carries the reason:
    if let explanation = try? await refusal.explanation {
        print("Refused: \(explanation.content)")
    }
    showMessage("The request was declined.")
} catch let error as LanguageModelSession.ToolCallError {
    // A tool threw. ToolCallError exposes { tool, underlyingError } so you can
    // distinguish a tool failure from a session/generation failure.
    print("Tool \(error.tool.name) failed: \(error.underlyingError)")
    showMessage("A tool used by the assistant failed.")
} catch {
    // Catch-all for anything unexpected
    print("Unexpected error: \(error)")
    showMessage("Something went wrong. Please try again.")
}
```

**Time cost**: 10-15 minutes

---

### Pattern 3a: Hallucinated Output (Wrong Use Case)

**Symptom**:
- Model gives factually incorrect answers
- Makes up information

**Diagnosis**:
Using model for world knowledge (wrong use case)

**Fix**:
```swift
// ❌ BAD - Wrong use case
let prompt = "Who is the president of France?"
let response = try await session.respond(to: prompt)
// Will hallucinate or give outdated info

// ✅ GOOD - Use server LLM for world knowledge
// Foundation Models is for:
// - Summarization
// - Extraction
// - Classification
// - Content generation

// OR: Use Tool calling with external data source
struct GetFactTool: Tool {
    let name = "getFact"
    let description = "Fetch factual information from verified source"

    @Generable
    struct Arguments {
        let query: String
    }

    // Tool.call returns Self.Output (any PromptRepresentable). String conforms,
    // so return a String directly — there is no standalone ToolOutput type.
    func call(arguments: Arguments) async throws -> String {
        // Fetch from Wikipedia API, news API, etc.
        let fact = await fetchFactFromAPI(arguments.query)
        return fact
    }
}
```

**Time cost**: 20-30 minutes to implement tool OR switch to appropriate AI

---

### Pattern 3b: Wrong Structure (Not Using @Generable)

**Symptom**:
- Parsing errors
- Invalid JSON
- Wrong keys

**Diagnosis**:
Manual JSON parsing instead of @Generable

**Fix**:
```swift
// ❌ BAD - Manual parsing
let prompt = "Generate person as JSON"
let response = try await session.respond(to: prompt)
let data = response.content.data(using: .utf8)!
let person = try JSONDecoder().decode(Person.self, from: data) // CRASHES

// ✅ GOOD - @Generable
@Generable
struct Person {
    let name: String
    let age: Int
}

let response = try await session.respond(
    to: "Generate a person",
    generating: Person.self
)
// response.content is type-safe Person, guaranteed structure
```

**Time cost**: 10 minutes to convert to @Generable

---

### Pattern 3c: Missing Data (Need Tool)

**Symptom**:
- Model doesn't have required information
- Output is vague or generic

**Diagnosis**:
Need external data (weather, locations, contacts)

**Fix**:
```swift
// ❌ BAD - No external data
let response = try await session.respond(
    to: "What's the weather in Tokyo?"
)
// Will make up weather data

// ✅ GOOD - Tool calling
import WeatherKit

struct GetWeatherTool: Tool {
    let name = "getWeather"
    let description = "Get current weather for a city"

    @Generable
    struct Arguments {
        let city: String
    }

    // Return a String directly — Tool.Output just needs to be PromptRepresentable.
    func call(arguments: Arguments) async throws -> String {
        // Fetch real weather
        let weather = await WeatherService.shared.weather(for: arguments.city)
        return "Temperature: \(weather.temperature)°F"
    }
}

let session = LanguageModelSession(tools: [GetWeatherTool()])
let response = try await session.respond(to: "What's the weather in Tokyo?")
// Uses real weather data
```

**Time cost**: 20-30 minutes to implement tool

---

### Pattern 3d: Inconsistent Output (Sampling)

**Symptom**:
- Different output every time for same prompt
- Need consistent results for testing

**Diagnosis**:
Random sampling (default behavior)

**Fix**:
```swift
// Default: Random sampling
let response1 = try await session.respond(to: "Write a haiku")
let response2 = try await session.respond(to: "Write a haiku")
// Different every time

// ✅ For deterministic output (testing/demos)
let response = try await session.respond(
    to: "Write a haiku",
    options: GenerationOptions(sampling: .greedy)
)
// Same output for same prompt (given same model version)

// ✅ For low variance
let response = try await session.respond(
    to: "Classify this article",
    options: GenerationOptions(temperature: 0.5)
)
// Slightly varied but focused

// ✅ For high creativity
let response = try await session.respond(
    to: "Write a creative story",
    options: GenerationOptions(temperature: 2.0)
)
// Very diverse output
```

**Time cost**: 2-5 minutes

---

### Pattern 4a: Initial Latency (Prewarm)

**Symptom**:
- First generation takes 1-2 seconds to start
- Subsequent requests faster

**Diagnosis**:
Model loading time

**Fix**:
```swift
// ❌ BAD - Load on user interaction
Button("Generate") {
    Task {
        let session = LanguageModelSession() // 1-2s delay here
        let response = try await session.respond(to: prompt)
    }
}

// ✅ GOOD - Prewarm on init
class ViewModel: ObservableObject {
    private var session: LanguageModelSession?

    init() {
        // Prewarm before user interaction
        Task {
            self.session = LanguageModelSession(instructions: "...")
        }
    }

    func generate(prompt: String) async throws -> String {
        guard let session = session else {
            // Fallback if not ready
            self.session = LanguageModelSession()
            return try await self.session!.respond(to: prompt).content
        }
        return try await session.respond(to: prompt).content
    }
}
```

**Time cost**: 10 minutes
**Latency saved**: 1-2 seconds on first request

---

### Pattern 4b: Long Generation (Streaming)

**Symptom**:
- User waits 3-5 seconds seeing nothing
- Then entire result appears at once

**Diagnosis**:
Not streaming long generations

**Fix**:
```swift
// ❌ BAD - No streaming
let response = try await session.respond(
    to: "Generate 5-day itinerary",
    generating: Itinerary.self
)
// User waits 4 seconds seeing nothing

// ✅ GOOD - Streaming
@Generable
struct Itinerary {
    var destination: String
    var days: [DayPlan]
}

// streamResponse yields ResponseStream<Itinerary>.Snapshot values; the partial
// result lives in snapshot.content, typed Itinerary.PartiallyGenerated.
@State private var itinerary: Itinerary.PartiallyGenerated?

let stream = session.streamResponse(
    to: "Generate 5-day itinerary to Tokyo",
    generating: Itinerary.self
)

for try await snapshot in stream {
    // Update UI incrementally
    self.itinerary = snapshot.content
}
// User sees destination in 0.5s, then days progressively
```

**Time cost**: 15-20 minutes
**Perceived latency**: 0.5s vs 4s

---

### Pattern 4c: Large Schema Overhead

**Symptom**:
- Subsequent requests with same @Generable type slow

**Diagnosis**:
Schema re-inserted into prompt every time

**Fix**:
```swift
// First request - schema inserted automatically
let first = try await session.respond(
    to: "Generate first person",
    generating: Person.self
)

// ✅ Subsequent requests - skip schema insertion.
// includeSchemaInPrompt is a parameter on respond()/streamResponse() (default true),
// NOT a GenerationOptions member.
let second = try await session.respond(
    to: "Generate another person",
    generating: Person.self,
    includeSchemaInPrompt: false
)
```

**Time cost**: 2 minutes
**Latency saved**: 10-20% per request

---

### Pattern 4d: Complex Prompt (Break Down)

**Symptom**:
- Generation takes >5 seconds
- Poor quality results

**Diagnosis**:
Prompt too complex for single generation

**Fix**:
```swift
// ❌ BAD - One massive prompt
let prompt = """
    Generate complete 7-day itinerary with hotels, restaurants,
    activities, transportation, budget, tips, and local customs
    """
// 5-8 seconds, poor quality

// ✅ GOOD - Break into steps
let overview = try await session.respond(
    to: "Generate high-level 7-day plan for Tokyo"
)

var dayDetails: [DayPlan] = []
for day in 1...7 {
    let detail = try await session.respond(
        to: "Detail activities and restaurants for day \(day) in Tokyo",
        generating: DayPlan.self
    )
    dayDetails.append(detail.content)
}
// Total time similar, but better quality and progressive results
```

**Time cost**: 20-30 minutes
**Quality improvement**: Significantly better

---

### Pattern 5a: UI Frozen (Main Thread Blocking)

**Symptom**:
- App unresponsive during generation
- UI freezes for seconds

**Diagnosis**:
Calling `respond()` on main thread synchronously

**Fix**:
```swift
// ❌ BAD - Blocking main thread
Button("Generate") {
    let response = try await session.respond(to: prompt)
    // UI frozen for 2-5 seconds!
}

// ✅ GOOD - Async task
Button("Generate") {
    Task {
        do {
            let response = try await session.respond(to: prompt)
            // Update UI on main thread
            await MainActor.run {
                self.result = response.content
            }
        } catch {
            print("Error: \(error)")
        }
    }
}
```

**Time cost**: 5 minutes
**UX improvement**: Massive (no frozen UI)

---

### Pattern 6a: @Generable Macro Not Resolved in Playgrounds

**Symptom**:
```
external macro implementation type 'FoundationModelsMacros.GenerableMacro' could not be found
```

The same `@Generable` struct that compiles in Xcode fails in a Swift Playground.

**Diagnosis**:
Swift Playgrounds (the iPad app) resolves macros differently than Xcode. The `FoundationModelsMacros` plugin used by `@Generable` is not exposed to the Playgrounds runtime.

**Fix**:
- For prototyping, use an Xcode Playground inside an Xcode project rather than a standalone Swift Playground
- For Playgrounds-only workflows, avoid `@Generable` and use `DynamicGenerationSchema` instead

```swift
// ❌ Won't resolve in Swift Playgrounds
@Generable
struct Person { let name: String; let age: Int }

// ✅ Works in Swift Playgrounds (runtime schema, not macro)
let nameProp = DynamicGenerationSchema.Property(
    name: "name",
    schema: DynamicGenerationSchema(type: String.self)
)
let ageProp = DynamicGenerationSchema.Property(
    name: "age",
    schema: DynamicGenerationSchema(type: Int.self)
)
let personSchema = DynamicGenerationSchema(
    name: "Person",
    properties: [nameProp, ageProp]
)
let schema = try GenerationSchema(root: personSchema, dependencies: [])
```

**Time cost**: 10-15 minutes to switch to dynamic schema in Playgrounds; not applicable in Xcode (use Xcode instead).

---

### Pattern 6b: Recursive @Generable Types Crash

**Symptom**:
```
Fatal error in SchemaAugmentor.swift:209
```

A `@Generable` type that references itself (directly or via a nested type) crashes when used with `respond(to:generating:)`.

**Diagnosis**:
The schema augmentor cannot resolve cycles via the `@Generable` macro path. Recursive-type support only works via `DynamicGenerationSchema(referenceTo:)`.

**Fix**:
Use dynamic schemas for any recursive or cyclic graph:

```swift
// ❌ Crashes — SchemaAugmentor doesn't resolve the cycle
@Generable
struct Tree {
    let value: String
    let children: [Tree]
}

// ✅ Use DynamicGenerationSchema with referenceTo
let valueProp = DynamicGenerationSchema.Property(
    name: "value",
    schema: DynamicGenerationSchema(type: String.self)
)
let childrenProp = DynamicGenerationSchema.Property(
    name: "children",
    schema: DynamicGenerationSchema(
        arrayOf: DynamicGenerationSchema(referenceTo: "Tree")
    )
)
let treeSchema = DynamicGenerationSchema(
    name: "Tree",
    properties: [valueProp, childrenProp]
)
let schema = try GenerationSchema(root: treeSchema, dependencies: [])
```

**Time cost**: 20-30 minutes to convert recursive types to dynamic schemas.

---

### Pattern 6c: GenerationSchema.SchemaError.undefinedReferences

**Symptom**:
```
GenerationSchema.SchemaError.undefinedReferences
```

`GenerationSchema(root:dependencies:)` throws when a `DynamicGenerationSchema(referenceTo: "X")` doesn't have a matching schema in `dependencies`.

**Diagnosis**:
Every name used in `referenceTo:` must appear either as the root schema's name or in the dependencies array. The error names the missing reference.

**Fix**:
```swift
// ❌ Missing the Answer schema in dependencies
let answers = DynamicGenerationSchema.Property(
    name: "answers",
    schema: DynamicGenerationSchema(
        arrayOf: DynamicGenerationSchema(referenceTo: "Answer")
    )
)
let riddleSchema = DynamicGenerationSchema(
    name: "Riddle",
    properties: [answers]
)
let schema = try GenerationSchema(root: riddleSchema, dependencies: [])
// throws SchemaError.undefinedReferences("Answer")

// ✅ Include every referenced schema
let answerSchema = DynamicGenerationSchema(
    name: "Answer",
    properties: [/* text, isCorrect */]
)
let schema = try GenerationSchema(
    root: riddleSchema,
    dependencies: [answerSchema]
)
```

**Time cost**: 5-10 minutes once the missing reference is identified.

---

## Production Crisis Scenario

### Context

**Situation**: You just launched an AI-powered feature using Foundation Models. Within 2 hours:
- 20% of users report "AI feature doesn't work"
- App Store reviews dropping: "New AI broken"
- VP of Product emailing: "What's the ETA on fix?"
- Engineering manager: "Should we roll back?"

**Pressure Signals**:
- 🚨 **Revenue impact**: Feature is key selling point for new app version
- ⏰ **Time pressure**: "Fix it NOW"
- 👔 **Executive visibility**: VP watching
- 📉 **Public reputation**: App Store reviews visible to all

### Rationalization Traps

**DO NOT** fall into these traps:

1. **"Disable the feature"**
   - Loses product differentiation
   - Admits defeat
   - Doesn't learn what went wrong

2. **"Roll back to previous version"**
   - Loses weeks of work
   - Doesn't fix root cause
   - Users still angry

3. **"It works for me"**
   - Simulator ≠ real devices
   - Your device ≠ all devices
   - Ignores real problem

4. **"Switch to ChatGPT API"**
   - Violates privacy
   - Expensive at scale
   - Doesn't address availability issue

### MANDATORY Protocol

#### Phase 1: Identify (5 minutes)

```swift
// Check error distribution
// What percentage seeing what error?

// Run this on test devices:
let availability = SystemLanguageModel.default.availability

switch availability {
case .available:
    print("✅ Available")
case .unavailable(let reason):
    print("❌ Unavailable: \(reason)")
}

// Hypothesis:
// - If 20% unavailable → Availability issue. Read the UnavailableReason:
//   .deviceNotEligible (device), .appleIntelligenceNotEnabled (opt-in),
//   or .modelNotReady (still downloading). There is no region reason.
// - If 20% getting errors → Code bug
// - If 20% seeing wrong results → Use case mismatch
```

**Results**: Discover that 20% of users have devices without Apple Intelligence support.

---

#### Phase 2: Confirm (5 minutes)

```swift
// Check which devices affected
// iPhone 15 Pro+ = ✅ Available
// iPhone 15 = ❌ Unavailable
// iPhone 14 = ❌ Unavailable

// Conclusion: Availability issue, not code bug
```

**Root cause**: Feature assumes all users have Apple Intelligence. 20% don't.

---

#### Phase 3: Device Requirements (5 minutes)

Verify:
- Apple Intelligence requires iPhone 15 Pro or later
- Or iPad with M1+ chip
- Or Mac with Apple silicon

#### 20% of user base = older devices

---

#### Phase 4: Implement Fix (15 minutes)

```swift
// ✅ Add availability check + graceful UI
struct AIFeatureView: View {
    @State private var availability = SystemLanguageModel.default.availability

    var body: some View {
        switch availability {
        case .available:
            // Show AI feature
            AIContentView()

        case .unavailable:
            // Graceful fallback
            VStack {
                Image(systemName: "sparkles")
                    .font(.largeTitle)
                    .foregroundColor(.secondary)

                Text("AI-Powered Features")
                    .font(.headline)

                Text("Available on iPhone 15 Pro and later")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)

                // Offer alternative
                Button("Use Standard Mode") {
                    // Show non-AI fallback
                }
            }
        }
    }
}
```

---

#### Phase 5: Deploy (20 minutes)

1. Test on multiple devices (15 min)
   - iPhone 15 Pro: ✅ Shows AI feature
   - iPhone 14: ✅ Shows graceful message
   - iPad Pro M1: ✅ Shows AI feature

2. Submit hotfix build (5 min)

---

### Communication Template

**To VP of Product (immediate)**:
```
Root cause identified:

The AI feature requires Apple Intelligence (iPhone 15 Pro+).
20% of our users have older devices. We didn't check availability.

Fix: Added availability check with graceful fallback UI.

Timeline:
- Hotfix ready: Now
- TestFlight: 10 minutes
- App Store submission: 30 minutes
- Review: 24-48 hours (requesting expedited)

Impact mitigation:
- 80% of users see working AI feature
- 20% see clear message + standard mode fallback
- No functionality lost, just graceful degradation
```

**To Engineering Team**:
```
Post-mortem items:
1. Add availability check to launch checklist
2. Test each .unavailable branch using Xcode's Foundation Models
   Availability override (Scheme > Edit Scheme > Run > Options) —
   prevents the no-non-AI-devices-on-the-bench excuse
3. Document device requirements clearly
4. Add analytics for availability status
```

### Time Saved

- **Panic path (disable/rollback)**: 2 hours of meetings + lost work
- **Proper diagnosis**: 45 minutes root cause → fix → deploy
- **Prevention via Xcode scheme override**: zero — the test loop is part of normal development if the team knows the override exists. See `axiom-ai (skills/foundation-models.md)` "Testing Availability Paths".

### What We Learned

1. **Always check availability** before creating session
2. **Test every `.unavailable` branch using the Xcode scheme override** (`axiom-ai (skills/foundation-models.md)` "Testing Availability Paths") — the override forces each unavailable reason on an AI-capable device without disabling Apple Intelligence
3. **Graceful degradation** better than feature removal
4. **Clear messaging** to users about requirements

---

## Quick Reference Table

| Symptom | Cause | Check | Pattern | Time |
|---------|-------|-------|---------|------|
| Won't start | .unavailable(.deviceNotEligible) | SystemLanguageModel.default.availability | 1a | 5 min |
| Model not ready | .unavailable(.modelNotReady) | Still downloading — retry later | 1b | 5 min |
| Not opted in | .unavailable(.appleIntelligenceNotEnabled) | Settings check | 1c | 10 min |
| Context exceeded | >4096 tokens | Transcript length | 2a | 15 min |
| Guardrail error | Content policy | User input type | 2b | 10 min |
| Language error | Unsupported language | supportedLanguages | 2c | 10 min |
| Hallucinated output | Wrong use case | Task type check | 3a | 20 min |
| Wrong structure | No @Generable | Manual parsing? | 3b | 10 min |
| Missing data | No tool | External data needed? | 3c | 30 min |
| Inconsistent | Random sampling | Need deterministic? | 3d | 5 min |
| Initial delay | Model loading | First request slow? | 4a | 10 min |
| Long wait | No streaming | >1s generation? | 4b | 20 min |
| Schema overhead | Re-inserting schema | Subsequent requests? | 4c | 2 min |
| Complex prompt | Too much at once | >5s generation? | 4d | 30 min |
| UI frozen | Main thread | Thread check | 5a | 5 min |
| `@Generable` macro not found | Swift Playgrounds runtime | Xcode vs Playgrounds? | 6a | 15 min |
| `SchemaAugmentor.swift:209` crash | Recursive `@Generable` types | Self-referencing struct? | 6b | 30 min |
| `SchemaError.undefinedReferences` | Missing schema in `dependencies:` | All `referenceTo:` names declared? | 6c | 10 min |

---

## Cross-References

**Related Axiom Skills**:
- `axiom-ai (skills/foundation-models.md)` — Discipline skill for anti-patterns, proper usage patterns, pressure scenarios
- `axiom-ai (skills/foundation-models-ref.md)` — Complete API reference with all WWDC 2025 code examples

**Apple Resources**:
- Foundation Models Framework Documentation
- WWDC 2025-286: Meet the Foundation Models framework
- WWDC 2025-301: Deep dive into the Foundation Models framework
- Instruments Foundation Models Template

---

**Last Updated**: 2025-12-03
**Version**: 1.0.0
**Skill Type**: Diagnostic
