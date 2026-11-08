---
name: audit-siri-ai
description: Scan App Intents code and App Skills for Siri AI readiness — search tools, missing tool metadata, entities Siri can't read or find, cold-launch dependency crashes, undeclared results, App Skill errors
---

# audit-siri-ai

Scan your App Intents code and App Skills for problems that keep Siri AI from finding, choosing, or running your app's actions in the 27.3 Siri AI Developer Preview.

## What This Command Does

Launches the **siri-ai-auditor** agent. Because it reads your source code, it catches problems that appear only when Siri runs an intent, before you build the app and test it on a device.

## What It Checks

1. **Search tools** – Tools that search for your app's content, which Siri already does through Spotlight
2. **Tool metadata** – Missing intent and parameter descriptions that Siri's model relies on
3. **Entities** – Entities with no exposed properties, entities Siri can't find, and sensitive properties that stay discoverable in Spotlight
4. **Background runs** – `@Dependency` values that don't exist when Siri starts your app without its UI, and URLs opened from an intent, which fail in an extension
5. **Results and errors** – Values the system can't see, errors shown as generic failures, work that can repeat when an intent re-runs, donations made from inside an intent, and look-up tools whose spoken answer ends Siri's turn before an App Skill's acting tool runs
6. **Saved shortcuts and availability** – Entity identifiers and enum values that change between launches, and tools gated wrongly for earlier OS releases or for watchOS and tvOS targets
7. **App Skills** – `SKILL.md` problems that keep every skill from shipping, and bundles left out of the app target
8. **Built-in app overlap** – Tools for requests a built-in app already handles, such as creating a meeting. In testing, those requests went to the built-in app unless they named your app

It finishes with a readiness score (READY, NEEDS WORK, or BLOCKED).

## Usage

```
/axiom:audit siri-ai
```

## Related

- [siri-ai-auditor](/agents/siri-ai-auditor) – The agent that powers this command
- [siri-ai](/skills/integration/siri-ai) – How to bring your app's actions to Siri AI, and the fix behind each finding
- [/axiom:siri](/commands/integration/siri) – Runs this audit, then builds the app and analyzes its metadata with `sirimetadataanalyzer`
