# siri-ai-auditor

Scans your App Intents code and App Skills to check how well Siri AI can use them, for the 27.3 Siri AI Developer Preview. It checks whether Siri can find, choose, fill in, and run your app's actions, and whether those actions keep working when Siri runs them while your app isn't on screen. It reads source code, so it finds problems Xcode's `sirimetadataanalyzer` can't see in built metadata, such as a dependency registered from a view or a search tool that competes with Siri.

## What It Does

- Flags search and find tools, which duplicate how Siri finds your content through Spotlight
- Checks that tools have the titles and descriptions Siri's model reads, and that the entities they use expose described properties Siri can read and find
- Finds intents that crash when Siri launches your app in the background (`@Dependency` values registered too late or on the wrong type)
- Finds results the system can't see, errors Siri shows as "something went wrong", irreversible work that can repeat when an intent re-runs, donations made from inside an intent, and URL opening that fails in an extension
- Checks entity identifiers and enum values that saved shortcuts depend on, and sensitive properties that stay discoverable in Spotlight
- Validates `Skills.skillsbundle` files, where one error means the app ships no skills at all
- Checks availability gating for apps that still support earlier OS releases or build for watchOS and tvOS
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

- **siri-ai** skill (axiom-integration) – How to bring your app's actions and content to Siri AI; the auditor checks code against it
- **app-intents** skill (axiom-integration) – The App Intents traps behind most of the auditor's findings
- **siri-evaluations-ref** skill (axiom-integration) – Testing Siri's behavior on a device after the audit
- **foundation-models-auditor** agent – For on-device language model code, which is a different framework
- **security-privacy-scanner** agent – Overlaps on intents that run from the Lock Screen and on prompt-injection risk
- **health-check** agent – Includes this auditor in project-wide scans when it finds tool intents or an App Skills bundle
