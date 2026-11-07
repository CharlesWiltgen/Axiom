---
name: app-schemas-ref
description: Required shapes of every App Intents schema domain — intent parameters, return types, entity properties, enum cases — as the build enforces them
---

# App Schemas Reference

Lookup reference for every App Intents system schema (`@AppIntent(schema:)`, `@AppEntity(schema:)`, `@AppEnum(schema:)`), across every domain. Apple's SDK names each schema but not its shape: the required members are enforced only as build errors. This reference records those shapes for each domain. It's produced by a script that builds a probe app against the iOS 27.3 SDK, then confirms the result with a control build that adopts every schema exactly as listed.

## When to Use This Reference

Use this reference when:
- You're adopting a schema in any domain (Notes, Reminders, Calendar, Mail, Photos, Messages, Clock, Maps, Video, Files, and the rest) and need its required parameters, properties, or enum cases
- A build fails in the App Intents metadata phase with `Missing required parameter`, `Missing required property`, `is missing case … required by AppSchemaEnum`, or `to be optional` (Xcode 27.1: `requires enum case`, `must be optional`)
- You need to know what a schema's `perform()` must return
- You want to know which domains Apple documents for Siri and which for the Shortcuts app
- You're checking whether a schema is deprecated, and what replaces it

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "What parameters does the `.notes.createNote` schema require?"
- "Why does my build say `Missing required property 'list'` for my reminder entity?"
- "What does `.calendar.createEvent` have to return?"
- "Which enum cases does `.reminders.listType` need?"
- "My attachments parameter fails with a `supportedTypeIdentifiers` error. What does it want?"
- "Is `.photos.openAsset` still the right schema on iOS 27?"
- "What does the `.video.playContent` schema need, and does it work on tvOS?"
- "Why does my build say an intent parameter not defined by the schema must be optional?"

## What's Covered

### Reading the Tables
- Type spellings, optionality, and union types
- Rules for extra members: extra intent parameters must be optional, and extra entity properties need `@Property`
- Conformances the schema macros add (`OpenIntent`, `DeleteIntent`, `ShowInAppSearchResultsIntent`, `FileEntity`, `UniqueAppEntity`)
- Content-type requirements for file parameters, static members, deprecations, and use-case build warnings
- Each schema build error and its fix

### Primary Domains (Apple Intelligence and Siri)
- Audio, Calendar, Camera, Clock, Mail, Maps
- Messages, Notes, Phone, Photos, Reminders, System (in-app search)
- Video (iOS, tvOS, and visionOS 27.3)

### Single-Purpose Domains
- Assistant, Visual Intelligence

### Shortcuts-Specific Domains
- Books, Browser, Files, Journal, Presentation
- Reader, Spreadsheet, Whiteboard, WordProcessor

## Documentation Scope

This page documents the `app-schemas-ref` skill (in the `axiom-integration` suite), the reference your assistant uses for the exact shape of any schema. The skill's tables are regenerated from a fresh build census each time a new SDK ships, so they track the SDK rather than a hand-written summary.

- For the App Intents framework itself, and which domain fits your app, see [app-intents-ref](/reference/app-intents-ref)
- For the Audio domain in depth, including unions, `AudioSearch`, and SiriKit, see [siri-audio-ref](/reference/siri-audio-ref)

## Related

- [siri-audio](/skills/integration/siri-audio) – Approach and build order for an audio app adopting the Audio domain
- [siri-notes-reminders](/skills/integration/siri-notes-reminders) – Moving a SiriKit Lists/Notes app to the Notes and Reminders domains
- [app-shortcuts-ref](/reference/app-shortcuts-ref) – App Shortcuts, which expose your schema intents with spoken phrases
- [core-spotlight-ref](/reference/core-spotlight-ref) – Spotlight indexing for `IndexedEntity`, one way to make schema entities resolvable

## Resources

**Docs**: /appintents/app-schema-domains, /appintents/appintent(schema:), /appintents/appentity(schema:), /appintents/appenum(schema:)
