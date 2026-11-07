---
name: siri-ai
description: Bring an app's own actions and content to Siri AI with tool intents, generable entities, entity property descriptions, card snippets, and App Skills
skill_type: skill
version: 1.0
apple_platforms: iOS 27.3+, iPadOS 27.3+, macOS 27.3+, visionOS 27.3+ (Siri AI Developer Preview; not watchOS or tvOS)
---

# Siri AI: Custom Actions and Content

This skill helps your assistant connect your app's own actions and content to Siri AI, the Apple Intelligence version of Siri. In the Siri AI Developer Preview, which starts with the 27.3 betas, Siri can call any App Intent you mark as a tool, not only ones that fit Apple's schema domains, and can also fill in values from what a person says, read your entities' properties, show your content in branded cards, and follow task guidance you ship as App Skills.

The preview works in development builds and for internal TestFlight testers, but not yet in App Store builds.

## When to Use

Use this skill when you're:
- Asking your assistant to "make my app work with Siri AI", whether or not the app already has App Intents
- Adding `@AppIntent(.tool)` to an intent, or `@AppEntity(.generable)` to an entity
- Writing an App Skill for Siri in a `Skills.skillsbundle`
- Deciding which entity properties Siri should see, and hiding sensitive ones
- Running `sirimetadataanalyzer` and fixing what it reports
- Debugging a tool that Siri never calls, calls for the wrong request, or fills in wrongly

## Example Prompts

- "Make my shopping app's Add to Cart action work with Siri AI."
- "Should my Search Products intent be a tool?"
- "Why does my build fail with `'ToolIntent' can't be adopted by an intent that conforms to '.messages.sendMessage'`?"
- "Write an App Skill that tells Siri how to plan a meal in my app."
- "My skills bundle builds, but Siri never uses my skills. What's wrong?"
- "How do I keep Siri from reading an account's routing number?"
- "My app still supports iOS 26. How do I adopt tool intents without breaking it?"

## What This Skill Provides

- **Adoption order** – The steps from finding or creating intents to testing on a device, and which actions should become tools, including purchases and bookings
- **Tool intents** – When Siri can call a tool, the titles and descriptions Siri's model reads, return values and error messages, and how Siri finds entities without a search tool
- **Schema intents** – Which schema intents accept `.tool`, measured for every schema intent on the 27.3 beta, since the boundary doesn't follow Apple's domain tiers exactly
- **Generable entities** – Values Siri writes itself, what they may contain, and the build error that stops all App Intents metadata from exporting
- **Entity properties** – Descriptions, per-property and entity-wide authentication, and `visibility: .internal`, plus a fallback for apps that ship before 27.3
- **Card snippets** – Branded cards for entities, what is safe to show on them, and the `.compact` card family that Apple documents but the beta doesn't include yet
- **App Skills** – The `Skills.skillsbundle` layout, `SKILL.md` rules, and the exact build diagnostics, including the silent failure when the bundle isn't in Copy Bundle Resources
- **Siri Metadata Analyzer** – Running `sirimetadataanalyzer`, its exit codes, and the findings Apple names
- **Verification ladder** – The testing order from AppIntentsTesting and Shortcuts through SiriEvaluations to requests by hand on a device
- **Errata** – Where the beta disagrees with Apple's documentation

## Documentation Scope

This page documents the `siri-ai` skill (in the `axiom-integration` suite). Its code samples are checked against the iOS 27.3 beta SDK.

- For writing and running SiriEvaluations tests, see [siri-evaluations-ref](/reference/siri-evaluations-ref)
- For each schema's required parameters and properties, see [app-schemas-ref](/reference/app-schemas-ref)

## Related

- [app-intents](/skills/integration/app-intents) – The traps every tool has to pass first: cold-launch dependencies, `perform()` re-runs, errors Siri can read, and declared results
- [app-intents-ref](/reference/app-intents-ref) – The App Intents framework that tool intents and generable entities build on
- [core-spotlight-ref](/reference/core-spotlight-ref) – Indexing entities in Spotlight, which is how Siri finds the entities your tools act on
- [app-shortcuts-ref](/reference/app-shortcuts-ref) – Fixed-phrase App Shortcuts, which work in every Siri, not only Siri AI
- [siri-notes-reminders](/skills/integration/siri-notes-reminders) – Schema adoption for notes and to-do apps, where the schema already reaches Siri
- [siri-ai-auditor](/agents/siri-ai-auditor) – Scans your code for the problems this skill describes
- [/axiom:siri](/commands/integration/siri) – Runs the audit, build, metadata analyzer, and App Skills check as one loop

## Resources

**Docs**: /appintents/siri-ai-developer-preview, /appintents/bringing-custom-actions-and-content-to-siri, /appintents/orchestrating-complex-actions-with-app-skills, /appintents/toolintent, /appintents/generableentity, /sirievaluations
