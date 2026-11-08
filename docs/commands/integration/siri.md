# /axiom:siri

Check how ready your app is for Siri AI, from source code to built metadata. The build and analyzer steps need Xcode 27.3 or later; with an older Xcode selected, the command stops after the source audit.

## Command

```bash
/axiom:siri
/axiom:siri MyAppScheme
```

Pass a scheme name to build that scheme; without one, the command uses the app target's scheme. Run it explicitly: your assistant doesn't start this command on its own.

## What It Does

1. **Audits the source** – Runs the siri-ai-auditor agent and fixes CRITICAL findings, such as a cold-launch crash or a build error, before building
2. **Builds the app** – Builds through Axiom's build runner, so any App Intents metadata errors are captured
3. **Analyzes the metadata** – Runs Xcode's `sirimetadataanalyzer` on the built app, once per shipping language, and maps each finding to the guidance that fixes it
4. **Checks App Skills** – Confirms your `Skills.skillsbundle` compiled into the app
5. **Repeats** – Rebuilds and re-analyzes until only deliberate findings remain
6. **Sets up testing** – Offers to write SiriEvaluations scenarios, which run on a physical Apple Intelligence device; it asks before using one. For each tool the audit flags as overlapping a built-in app, it writes the request both with and without your app's name, so you can see whether Siri reaches your tool when the name is left out

## When to Use

- You're adopting the Siri AI Developer Preview and want to know what's left to do
- Siri doesn't call your tools, or fills them in wrongly, and you want to rule out metadata problems first
- You added App Skills and want to confirm they ship with the app

## Related

- [siri-ai-auditor](/agents/siri-ai-auditor) – The source audit this command starts with
- [/axiom:audit siri-ai](/commands/integration/audit-siri-ai) – Runs only the source audit, with no build
- [siri-ai](/skills/integration/siri-ai) – The guidance each finding points to
- [siri-evaluations-ref](/reference/siri-evaluations-ref) – Writing the SiriEvaluations scenarios the command offers at the end
