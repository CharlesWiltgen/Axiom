# siri-ai-auditor

Scans your App Intents code and App Skills to check whether Siri AI can find, choose, fill in, and run your app's actions in the 27.3 Siri AI Developer Preview, including while your app isn't on screen. Because it reads source code, it finds problems that Xcode's `sirimetadataanalyzer` can't see in built metadata, such as a dependency registered from a view or a search tool that competes with Siri.

## What It Does

- Flags search and find tools, which duplicate how Siri finds your content through Spotlight
- Checks that tools have the titles and descriptions Siri's model reads, and that the entities they use expose described properties Siri can read and find
- Finds intents that crash when Siri launches your app in the background because a `@Dependency` value is registered too late, and dependencies declared on entities or enums, which are never filled in
- Finds results the system can't see, errors Siri shows as "something went wrong", irreversible work that can repeat when an intent re-runs, donations made from inside an intent, and URL opening that fails in an extension
- Checks entity identifiers and enum values that saved shortcuts depend on, and sensitive properties that stay discoverable in Spotlight
- Validates `Skills.skillsbundle` files, where one error means the app ships no skills at all
- Flags tools for requests a built-in app already handles, such as creating a meeting or setting a timer. In testing, those requests went to the built-in app unless they named the app, even when its content was indexed. The auditor suggests adopting the matching schema or making the tool's description app-specific, and showing users example requests that include your app's name
- Finds look-up tools that speak their answer, which ends Siri's turn before an App Skill's acting tool can run
- Checks availability gating for apps that still support earlier OS releases or build for watchOS and tvOS
- Reasons about what a pattern search can't prove: actions people would ask Siri for that aren't tools yet, tools that overlap, and tools that work only on one screen
- Scores readiness as READY, NEEDS WORK, or BLOCKED, and tells you how to confirm the result with `sirimetadataanalyzer` and SiriEvaluations

## How to Use

**Natural language:**
- "Is my app ready for Siri AI?"
- "Review my App Intents before I add `@AppIntent(.tool)`"
- "Check my Skills.skillsbundle"
- "Siri never calls my Add to Cart tool"

**Explicit command:**
```bash
/axiom:audit siri-ai
```

## Related

- [siri-ai](/skills/integration/siri-ai) – How to bring your app's actions and content to Siri AI; the auditor checks your code against it
- [app-intents](/skills/integration/app-intents) – The App Intents traps behind most of the auditor's findings
- [siri-evaluations-ref](/reference/siri-evaluations-ref) – Testing Siri's behavior on a device after the audit
- [/axiom:siri](/commands/integration/siri) – Runs this audit, then builds the app and checks its metadata with `sirimetadataanalyzer`
- [foundation-models-auditor](/agents/foundation-models-auditor) – For on-device language model code, which is a different framework
- [security-privacy-scanner](/agents/security-privacy-scanner) – Overlaps on intents that run from the Lock Screen and on prompt-injection risk
- [health-check](/agents/health-check) – Includes this auditor in project-wide scans when it finds tool intents, `@Dependency` in intent code, or an App Skills bundle
