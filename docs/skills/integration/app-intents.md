---
name: app-intents
description: The App Intents traps that compile but fail at run time — cold-launch dependency crashes, intents that run twice, errors Siri shows as generic, results the system can't see, and identifiers that break saved shortcuts
skill_type: skill
version: 1.0
apple_platforms: iOS 16+, macOS 13+, watchOS 9+, tvOS 16+, visionOS 1+ (individual APIs note their own floors)
---

# App Intents: Traps That Compile

App Intents let Siri, Shortcuts, Spotlight, and widgets run your app's actions. A lot of App Intents code compiles cleanly and then fails when the system runs it, often while your app isn't on screen. This skill helps your assistant avoid those failures, whether it's writing new intents or reviewing existing ones, and it matters most for intents that Siri AI calls as tools.

Part of the **axiom-integration** suite (`skills/app-intents.md`).

## When to Use

Use this skill when you're:
- Writing a new App Intent, entity, enum, or entity query
- Reviewing existing App Intents code before shipping it or adding Siri AI support
- Debugging an intent that crashes only when Siri runs it, runs an action twice, or shows "something went wrong"
- Renaming an intent, entity, or enum case that people may have saved in a shortcut
- Moving long or heavy work into an intent

## Example Prompts

- "My intent crashes when Siri runs it but works when I tap the button in the app."
- "Why does Siri say 'something went wrong' instead of my error message?"
- "My Add to Cart intent charged the customer twice. How?"
- "Can I rename this AppEnum case?"
- "Why can't the next Shortcuts step use the value my intent returns?"
- "How long can a background intent run?"

## What This Skill Provides

- **Dependencies** – Registering `@Dependency` values so they exist when Siri launches your app without its UI, and which types can use them
- **How `perform()` runs** – Why it isn't on the main actor, why it can run more than once, and where confirmations and irreversible work belong
- **Results and errors** – Declaring results so the system can use them, and throwing errors Siri and Shortcuts can show
- **Donations** – Telling the system about actions people take in your app, and why not to donate from inside an intent
- **Entities and enums** – Which properties the system can see, identifiers that survive other devices, and enum values that keep saved shortcuts working
- **Designing intents** – One intent per task, opening content without `UIApplication`, and localization
- **Long-running work** – The background time limit, `LongRunningIntent`, cancellation, and undo

## Related

- [app-intents-ref](/reference/app-intents-ref) – The App Intents API reference this skill's rules apply to
- [siri-ai](/skills/integration/siri-ai) – Making intents callable by Siri AI, which depends on every rule here
- [app-schemas-ref](/reference/app-schemas-ref) – Required shapes for intents that adopt Apple's schema domains

## Resources

**Docs**: /appintents/appdependencymanager, /appintents/appintenterror, /appintents/intentdonationmanager, /appintents/openurlintent, /appintents/longrunningintent
