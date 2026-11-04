# SiriEvaluations Reference

SiriEvaluations (Xcode 27.3) drives real Siri on a device with scripted conversations and grades what Siri did: which intents it called and with what arguments, which entities it found or saw on screen, which App Skills it loaded, and what it replied. It is how you regression-test a Siri AI integration (`skills/siri-ai.md`).

**Platforms**: iOS, iPadOS, macOS, visionOS 27.3+; not tvOS, watchOS, or Mac Catalyst. Raise the test target's deployment target rather than annotating test code (Prerequisites). Siri AI Developer Preview, so the API may change.

**It is a Developer framework**, like Evaluations and AppIntentsTesting: it ships under the platform's `Developer/Library/Frameworks` (iPhoneOS, MacOSX, XROS; there is no simulator copy) and links into test targets only. It re-exports AppIntentsTesting (`IntentDefinitions`, `.expect`, `.expectIdentifier`, `.result`, matchers) and Evaluations (`Evaluation`, `.evaluates`, `EvaluationContext`, `Metric`).

Apple's own coding-assistant guide ships in Xcode 27.3: `$(xcode-select -p)/../PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/siri-evaluations.idechatprompttemplate` plus `siri-evaluations-ref-{writing,running,analyzing,api}.md.packaged` (plain markdown).

## When to Use

- Checking that Siri picks the right tool intent and fills its parameters from natural requests
- Guarding a Siri integration against regressions as intents, entities, and skills change
- Verifying an App Skill is loaded for the requests its `description` claims
- Asserting Siri does *not* call a destructive intent for a near-miss request

NOT for: testing `perform()` logic (AppIntentsTesting, `skills/app-intents-ref.md` Testing & Debugging); Foundation Models feature quality (axiom-ai (skills/foundation-models-evaluations-ref.md), the same Evaluations harness).

## Prerequisites

| Requirement | Detail |
|---|---|
| Device | Physical iPhone, iPad, or Apple Vision Pro on 27.3+ that supports Apple Intelligence. **No Simulator.** The framework and DocC include macOS, but Apple's run guide lists no Mac; treat Mac runs as unverified |
| Device setup | Developer Mode on; Siri and Apple Intelligence on with models downloaded; device unlocked and untouched for the run; enter the passcode when it asks to enable Automation Mode. Apple's DocC also says to turn on Settings > Developer > Enable UI Automation |
| App | Built, installed, **launched once since install** (registers intents, indexes entities). Reinstalling resets this, and `xcodebuild test` reinstalls. The `.evaluates` trait runs before a suite's `init`, so launch the app in `subject(from:)`: `XCUIApplication().launch()`, then `XCUIDevice.shared.press(.home)` and a few seconds' wait. Without it every scenario fails before grading with a misleading `… isn't installed, or isn't signed by this test's team` (measured, iPadOS 27.3) |
| Signing | The app must be signed by the same development team as the test target |
| Test target | Deployment target 27.3+ on the test target (the app keeps its own). Don't put `@available(iOS 27.3, *)` on a `@Suite`/`@Test` instead — Swift Testing rejects it |
| Target type | **A UI Testing Bundle**, with Swift Testing (supported there from Xcode 27.3, release notes 95593221). XCUIAutomation can then launch the app and navigate before Siri runs, and AppIntentsTesting, which SiriEvaluations re-exports, fails with `transportCancelled` outside one. (Apple's Xcode guide says any Swift Testing target; DocC says UI testing target) |
| `OnScreen` checks | App in the foreground with the entity visible |
| Turn time | Up to a minute per turn |

## Test File

```swift
import SiriEvaluations
import Testing
import XCTest   // XCUIApplication, to launch the app before each scenario

struct CometCalEvaluation: Evaluation {
    let name: String                       // report title; memberwise init takes it first
    let dataset: SiriScenarioLoader

    func subject(from sample: SiriScenario) async throws -> SiriScenarioSubject {
        // Launch once per scenario: registers the app's intents after install, and a
        // launch argument the app honors resets its state so scenarios don't leak
        await MainActor.run {
            let app = XCUIApplication()
            app.launchArguments = ["-resetState"]
            app.launch()
            XCUIDevice.shared.press(.home)
        }
        try await Task.sleep(for: .seconds(5))
        return try await SiriService.run(scenario: sample)   // pass `sample` itself, unchanged
    }

    var evaluators: Evaluators {
        SiriExpectationEvaluator()
    }

    func aggregateMetrics(using aggregator: inout MetricsAggregator) {
        Self.computeSiriMetrics(into: &aggregator)
    }
}

@Suite("CometCal - Siri", .serialized)
struct CometCalSiriTests {
    static let app = IntentDefinitions(bundleIdentifier: "com.example.CometCal")
    static let CreateEventIntent = app.intents["CreateEventIntent"]     // Swift type names
    static let DeleteEventIntent = app.intents["DeleteEventIntent"]
    static let EventEntity = app.entities["EventEntity"]
    static let CalendarEntity = app.entities["CalendarEntity"]
    static let PlanEventSkill = app.skills["plan-event"]                // SKILL.md `name:`

    static let createEvent = SiriScenario {
        UserTurn("In CometCal, create an event called Comet Watch tomorrow at 3PM in my Deep Space calendar") {
            Calls {
                CreateEventIntent
                    .expect(title: .equals("Comet Watch"),
                            calendar: CalendarEntity.expectIdentifier("deep-space"))
                    .result(EventEntity.expect(title: .equals("Comet Watch")))
            }
            Calls(.disallowed) { DeleteEventIntent }
        }
    }

    @Test("Siri creates the event", .evaluates(CometCalEvaluation(
        name: "CometCal - Create an event",
        dataset: SiriScenarioLoader { createEvent })))
    func createsEvent() {
        let result = EvaluationContext.current.result
        #expect(result.aggregateValue(.mean(of: .intentsAllPass)) == 1.0)
    }

    static let planEvent = SiriScenario {
        UserTurn("Help me plan a launch party in CometCal") {
            Loads(.required) { PlanEventSkill }
        }
    }

    @Test("Siri loads the plan-event skill", .evaluates(CometCalEvaluation(
        name: "CometCal - App Skills",
        dataset: SiriScenarioLoader { planEvent })))
    func loadsSkill() {
        let result = EvaluationContext.current.result
        #expect(result.aggregateValue(.mean(of: .skillsLoadedAllPass)) == 1.0)
    }
}
```

- Import `SiriEvaluations`, `Testing`, and `XCTest` (for `XCUIApplication`); SiriEvaluations re-exports AppIntentsTesting and Evaluations.
- `.serialized` is required: the device runs one Siri conversation at a time. Never run these in parallel.
- Don't declare `Sample`/`SampleLoader`/`Subject` typealiases; Evaluations infers them.
- One evaluation per behavior, one `@Test` per evaluation; paraphrases of one behavior go in one loader.
- Every intent, entity, parameter, identifier, and skill name comes from the app's source. Never invent one to make a scenario compile. Labels in `.expect(title:)` are matched at run time, not by the compiler, so a misspelled label compiles and reads as a missing parameter.

## Workflow Guardrails

- **One stage at a time**: write scenarios, build, then stop and offer to run. A run drives real Siri on the developer's device, which must stay unlocked and untouched.
- **Writing tests never edits App Intents code.** Failures say what to fix; fixing is a separate step.
- **Keep it small**: a handful of scenarios per intent, prioritizing primary actions, entity parameters, multi-step flows, and destructive intents (to assert they're *not* called). At least one scenario per App Skill.
- **Name the app** in utterances ("In CometCal, …") unless the scenario deliberately tests app-less routing. One request per turn; paraphrases are separate scenarios, not extra turns.

## Scenarios

```swift
SiriScenario {
    UserTurn("Start a quiz in QuizExample")    // no block: no expectations for this turn
    UserTurn("Science")                        // answers Siri's follow-up
} expectation: {
    Calls { StartQuizIntent.expect(topic: .equals("Science")) }   // any turn
    Calls(.disallowed) { CreateQuizReminderIntent }
}
```

- All turns run in one Siri session, in order. A clarification is a turn: expect `SiriResponse(.contains("…"))` on the asking turn, the `Calls` on the answering turn.
- Turn blocks grade only that turn; the `expectation:` block sees every turn and takes `Calls`, `Finds`, `OnScreen`, `Loads` — **not** `SiriResponse`.
- Blocks are result builders: `if`/`for` work. A loader accepts scenarios and arrays: `SiriScenarioLoader { a; [b, c]; for t in topics { make(t) } }`.
- **App state persists across scenarios and runs.** Reset it in `subject(from:)` (for example a launch argument the app honors), or a scenario sees the last one's data: measured, a planning turn reported the meal the previous run had planned ("Shakshuka is planned…") and never called Plan Meal, failing its `Calls`.
- Setup runs once per test, not between scenarios. Put per-scenario setup/cleanup around `SiriService.run` in `subject(from:)`; record a cleanup failure with `Issue.record(error)`, don't throw. Group scenarios that need the same starting state in one loader.
- `SiriScenario` is `Codable`. To load JSON, decode inside the `@Test` body, call `evaluation.run()`, and attach `result.jsonData(includeReportMetadata: true)` as `<name>.xcevalresult` — never decode inside the `.evaluates(…)` arguments.

## Expectations

| Want to check | Write |
|---|---|
| Siri called the intent | `Calls { CreateEventIntent }` |
| …with a scalar parameter | `CreateEventIntent.expect(title: .equals("…"))` |
| …with a specific entity | `.expect(calendar: CalendarEntity.expectIdentifier("<id>"))` |
| …with any entity of the type | `.expect(calendar: CalendarEntity)` |
| …returning a value | `.result(EventEntity.expect(title: .equals("…")))`, `.result(.notNil)` |
| Several, in written order (others may interleave) | `Calls { A; B }` (`.ordered` is the default) |
| Several, any order (each call satisfies one expectation) | `Calls(.unordered) { A; B }` |
| Siri must not call it (also fails if Siri asked to confirm it) | `Calls(.disallowed) { DeleteEventIntent }`; constrain to narrow: `.disallowed { Delete.expect(title: .equals("Launch")) }` |
| Siri found entities | `Finds { EventEntity.expect(title: .contains("…")) }` (property checks allowed) |
| Entity on screen | `OnScreen { EventEntity.expectIdentifier("<id>") }` (identity only) |
| Reply text | `SiriResponse(.contains("…", caseSensitive: false))` — turn blocks only; no exact or model-judged match exists |
| Skill loaded | `Loads(.required) { app.skills["<name>"] }`; `Loads(.preferred)` shows in the report and is never graded. No default enforcement |

Matchers (AppIntentsTesting): `.equals`, `.contains`, `.contains(regex:)`, `.notNil`, `.isNil`, `.matches(#Predicate { … }, requirement:)`.

- `.equals` and `.contains` take strings. For an `Int` or other non-string parameter, use a predicate: `.expect(questionCount: .matches(#Predicate<Int> { $0 == 5 }))`. `.equals(5)` doesn't compile (`cannot convert value of type 'Int' to expected argument type 'String'`).

- **`nil` is not `.isNil`.** `.expect(location: nil)` or `.result(nil)` leaves the value unchecked and can never fail. Write `.isNil`.
- An entity-valued **parameter** takes only identity (bare definition or `.expectIdentifier`). Check properties through `.result(…)`.
- Constrain only what the utterance determines. Don't assert dates/times as exact strings.
- Prefer `.equals` when the whole value is known; `.contains` can't catch Siri stuffing extra words into a parameter.
- Fail-closed: a constrained value that can't be decoded makes a required call unmatched and a disallowed call count as called.
- `.disallowed` counts a call that ran or that Siri asked to confirm; a call that stopped for a missing value or failed doesn't count.
- A turn that never ran fails its required expectations; its `.disallowed` ones hold.

## Metrics

Each is 1 or 0 per scenario; the summary card is the mean.

| Metric | Facet |
|---|---|
| `.intentsAllPass` | `Calls`, every ordering |
| `.foundEntitiesAllPass` | `Finds` |
| `.onScreenEntitiesAllPass` | `OnScreen` |
| `.siriResponseAllPass` | `SiriResponse` |
| `.skillsLoadedAllPass` | `Loads(.required)` |

- `Loads(.required)` is noisy: on device one skill loaded in 20 of 24 turns of its own requests over 8 runs, with misses clustered in one run. Gate CI on intents; track `.skillsLoadedAllPass` over several runs rather than requiring 1.0 from one.
- Gate tests on the `…AllPass` metrics, and only for facets the scenarios constrain. A facet with no expectations is ignored; if no scenario constrains it, its card is missing and `aggregateValue(.mean(of:))` returns **`-1`**, so `== 1.0` fails and `>= 0` passes vacuously.
- `…PercentagePass` metrics have no summary card: their mean reads `-1`. Don't assert on them.
- `.intentsPass`, `.foundEntitiesPass`, `.onScreenEntitiesPass`, `.siriResponsePass`, `.skillsLoadedPass` are deprecated renames of the `…AllPass` names.

## Custom Evaluators

```swift
extension Metric { static let titleTrimmed = Metric("Title Trimmed") }

struct TitleTrimmedEvaluator: EvaluatorProtocol {
    func metrics(subject: SiriScenarioSubject, input: SiriScenario) async throws -> [Metric] {
        let titles = subject.siriTranscript.turns.flatMap(\.intentInvocations)
            .compactMap { $0.value.arguments["title"] }
        guard !titles.isEmpty else { return [Metric.titleTrimmed.ignore(rationale: "no title was bound")] }
        let clean = titles.filter { $0 == $0.trimmingCharacters(in: .whitespaces) }.count
        return [Metric.titleTrimmed.scoring(Double(clean) / Double(titles.count))]
    }
}
// evaluators:   SiriExpectationEvaluator(); TitleTrimmedEvaluator()   (one per line, standard one first; no `+` arrays)
// aggregate:    Self.computeSiriMetrics(into: &aggregator)
//               aggregator.group("Domain") { $0.computeMean(of: .titleTrimmed) }
```

- Omitting `SiriExpectationEvaluator()` drops every standard metric; omitting `computeSiriMetrics` leaves the standard metrics at `-1`; a custom metric with no card reads `-1`.
- Return `.ignore(rationale:)`, not a passing score, when a scenario gives the rule nothing to judge — ignored metrics leave the average.
- `SiriTranscript.Turn` has `intentInvocations`, `foundEntities`, `onScreenEntities`, `loadedSkills`, `response`. `IntentInvocation` has `intent`, `arguments: [String: String]`, `result`, and `outcome` (`succeeded`, `awaitingConfirmation`, `needsInput`, `failed`, `unknown`, `unreported`; `.ran`, `.committed`). Every observation's `timestamp` is when the transcript was built, so it says nothing about order.

## Reading Results

- **Xcode**: Report navigator → the test run → the evaluation. Summary cards (Overview, App Entities, Siri Response, App Skills), one row per scenario; each opens to Diagnostics (turns completed, undecodable observations, Spotlight index count), Scenario, then Turn 1…n with Key / Subject (what Siri did) / Expected / Issues.
- **CLI**: `xcrun xcresulttool export attachments --path <bundle>.xcresult --output-path <dir>` exports one `.xcevalresult` (JSON) per evaluation.
- The `#expect` is only the summary. Read the per-scenario rows to explain a failure; the first failing row in a turn usually explains the rest.

## Triage

| Pattern | Cause | Action |
|---|---|---|
| Every scenario fails the same way, fewer turns completed than written, or Spotlight index empty | Environment | Re-check Prerequisites. Don't edit scenarios or the app |
| Wrong intent, or a parameter holds extra words ("Comet Watch tomorrow at 3PM") | App metadata | Fix the intent/parameter `title`/`description` (`skills/siri-ai.md`). If a parameter is missing, propose it (optional where possible) and flag it to the developer: it changes the intent's shape |
| Entity not found | App | Index it (`IndexedEntity`). `EnumerableEntityQuery` entities are found only when the request names the app. Relaunch the app after reinstall |
| Skill not loaded in most runs | App | Rewrite the skill's `description` in the words people use. An occasional miss is normal |
| Expectation asks for something the utterance doesn't say | Test | Fix the expectation, and say so explicitly. Never loosen one just to pass |

Siri is nondeterministic: run the set more than once and across paraphrases; treat a single failure as a lead, a repeated one as systematic. After any App Intents change, rebuild, reinstall, and launch before rerunning.

## Resources

**Docs**: /sirievaluations, /sirievaluations/siriservice, /appintents/siri-ai-developer-preview, /appintents/verifying-your-app-intents-implementation, /appintentstesting

**Skills**: siri-ai, app-intents-ref, axiom-ai (foundation-models-evaluations-ref), axiom-testing (ui-testing)
