---
name: audit-siri-ai
description: Scan App Intents code and App Skills for Siri AI readiness — search tools, missing tool metadata, entities Siri can't read or find, cold-launch dependency crashes, undeclared results, App Skill errors
---

# audit-siri-ai

Scan your App Intents code and App Skills for problems that keep Siri AI from finding, choosing, or running your app's actions in the 27.3 Siri AI Developer Preview.

## What This Command Does

Launches the **siri-ai-auditor** agent. It reads your source code, so it catches problems that appear only when Siri runs an intent, before you build and test on a device.

## What It Checks

1. **Search tools** – Tools that search for your app's content, which Siri already does through Spotlight
2. **Tool metadata** – Missing intent and parameter descriptions that Siri's model relies on
3. **Entities** – Entities with no exposed properties, or that Siri can't find
4. **Cold launches** – `@Dependency` values that don't exist when Siri starts your app without its UI
5. **Results and errors** – Values the system can't see, errors shown as generic failures, and work that can repeat when an intent re-runs
6. **App Skills** – `SKILL.md` problems that keep every skill from shipping, and bundles left out of the app target

## Related Agent

- [siri-ai-auditor](/agents/siri-ai-auditor) – The agent that powers this command
- [siri-ai](/skills/integration/siri-ai) – How to bring your app's actions to Siri AI
