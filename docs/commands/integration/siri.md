# /axiom:siri

Check how ready your app is for Siri AI, from source code to built metadata. Requires Xcode 27.3 or later for the build and analyzer steps.

## Command

```bash
/axiom:siri
/axiom:siri MyAppScheme
```

## What It Does

1. **Audits the source** – Runs the siri-ai-auditor agent and fixes crashes and build-blocking problems first
2. **Builds the app** – Builds through Axiom's build runner, so any App Intents metadata errors are captured
3. **Analyzes the metadata** – Runs Xcode's `sirimetadataanalyzer` on the built app and maps each finding to the guidance that fixes it
4. **Checks App Skills** – Confirms your `Skills.skillsbundle` compiled into the app
5. **Repeats** – Rebuilds and re-analyzes until only deliberate findings remain
6. **Sets up testing** – Offers to write SiriEvaluations scenarios to run on a device

## When to Use

- You're adopting the Siri AI Developer Preview and want to know what's left to do
- Siri doesn't call your tools, or fills them in wrongly, and you want to rule out metadata problems first
- You added App Skills and want to confirm they ship with the app

## Related

- [siri-ai-auditor](/agents/siri-ai-auditor) – The source audit this command starts with
- [siri-ai](/skills/integration/siri-ai) – The guidance each finding points to
- [siri-evaluations-ref](/reference/siri-evaluations-ref) – Writing the SiriEvaluations scenarios the command offers at the end
