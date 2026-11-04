---
name: siri-evaluations-ref
description: SiriEvaluations API reference for testing how Siri AI calls an app's intents, finds its entities, and loads its App Skills
---

# SiriEvaluations Reference

API reference for SiriEvaluations, the Xcode 27.3 test framework that runs scripted conversations through Siri on a real device and grades what Siri did. It's for developers who have brought their app's actions to Siri AI and want automated checks that keep it working as their App Intents change.

## When to Use This Reference

Use this reference when:
- You want a test that checks Siri picks the right intent and fills its parameters from a natural request
- You need to confirm Siri loads one of your App Skills for the requests it describes
- You want to make sure Siri never calls a destructive intent, like delete, for a near-miss request
- An evaluation fails before grading, or you need to read its report

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "Write a Siri evaluation for my Create Event intent."
- "How do I check that Siri doesn't delete anything when I ask it to rename an event?"
- "Why does `aggregateValue(.mean(of: .skillsLoadedAllPass))` return -1?"
- "Can I run Siri evaluations in the Simulator?"
- "How do I check an `Int` parameter in a Siri expectation?"
- "Why did this Siri scenario fail?"

## What's Covered

### Setup
- Device, Siri, Apple Intelligence, and signing requirements
- Test target deployment target, imports, and test target type

### Writing Scenarios
- `SiriScenario`, `UserTurn`, multi-turn clarifications, and per-scenario setup and cleanup
- `SiriScenarioLoader`, and loading scenarios from JSON

### Expectations
- `Calls` (ordered, unordered, disallowed), `Finds`, `OnScreen`, `SiriResponse`, and `Loads`
- Intent, entity, and result expectations, and the value matchers

### Metrics and Results
- The `…AllPass` metrics, the `-1` value for a facet with no expectations, and deprecated metric names
- Custom evaluators that read `SiriTranscript`
- The Xcode report, `.xcevalresult` export, and how to tell environment, app, and test failures apart

## Documentation Scope

This page documents the `siri-evaluations-ref` skill (in the `axiom-integration` suite). Its code samples compile against the iOS 27.3 beta SDK.

- For making the app work with Siri AI in the first place, see [siri-ai](/skills/integration/siri-ai)

## Related

- [app-intents-ref](/reference/app-intents-ref) – AppIntentsTesting, which tests your intents' own behavior and supplies the matchers these expectations use
- [foundation-models-evaluations](/skills/integration/foundation-models-evaluations) – The Evaluations framework that SiriEvaluations builds on, applied to Foundation Models features
- [ui-testing](/skills/ui-design/ui-testing) – UI test targets, where Siri evaluations run

## Resources

**Docs**: /sirievaluations, /sirievaluations/siriservice, /sirievaluations/siriscenario, /appintents/verifying-your-app-intents-implementation, /appintentstesting
