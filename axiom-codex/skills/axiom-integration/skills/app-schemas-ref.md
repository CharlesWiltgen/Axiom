# App Schemas — Required Shapes Reference

What the build enforces for every App Intents system schema (`@AppIntent(schema:)`, `@AppEntity(schema:)`, `@AppEnum(schema:)`), domain by domain: required intent parameters and return types, required entity properties, required enum cases, and the protocols each schema macro adds. Which domains reach Siri, and the tiers: `skills/app-intents-ref.md` (App Schemas). Audio in depth, including union resolvability and the SiriKit fallback: `skills/siri-audio-ref.md`.

## Reading the Tables

- **Every listed member is required.** The build fails without it, and extra parameters, properties and cases are allowed. `?` is the type you must declare, not permission to leave the member out: `dueDate: DateComponents?` must be declared, as optional. A required member declared non-optional fails with `to be optional` (Xcode 27.1: `must be optional`), and the reverse fails too (27.1: `must not be optional`). The build reports nothing about members that are not required, so none appear here.
- **Types are spelled the way you write them.** `.notes.folder` means your own type that adopts `@AppEntity(schema: .notes.folder)`. `AppEntity` means any entity type of yours: the build accepted one that adopts no schema.
- **Unions.** A capitalized name that is not a Swift type, such as `AudioItem`, is a `@UnionValue` enum of your own; Xcode 27.1's build messages call it `AudioItemCases`, and 27.2 spells out `a @UnionValue with cases limited to the types …`. You choose the enum's name and its case names. Each case's payload type comes from the union's row. In the last column, `yes` means the build accepted the union cut to only its first case and to only its last, and rejected it cut to one wrong case. `no` means a cut failed. `unverified` means the wrong case also built, so the cuts prove nothing. Middle cases were not tested alone. Every entity a union wraps must also be resolvable (below).
- **Adopting a schema means adopting what it names.** `createReminder` takes `.reminders.list`, `.reminders.section` and `.reminders.locationTrigger`, so each needs a type of yours adopting that schema, with that schema's own required members, down to the enums they use.
- **Parameter entities must be resolvable.** Every entity an intent takes as a parameter, and every entity a union wraps, needs `IndexedEntity`, `UniqueAppEntity` or `TransientAppEntity`, a default `EntityStringQuery`, or an `IntentValueQuery` returning that type. The build enforces it, and the tables do not show it. Measured in Audio, Notes and Reminders. An entity used only as a property, such as `.notes.account`, builds with a plain `EntityQuery`.
- **A protocol after a name** means the schema macro adds that conformance, so Swift demands its members before the schema check runs:
  - `OpenIntent` needs `target`.
  - `DeleteIntent` needs `entities`.
  - `ShowInAppSearchResultsIntent` needs `criteria` and `static let searchScopes`.
  - `FileEntity` needs an `id` of `FileEntityIdentifier` and `static let supportedContentTypes`.
  - `UniqueAppEntity` needs a `defaultQuery` conforming to `UniqueAppEntityQuery`.
- **Returns**: `perform()` must return `some IntentResult & ReturnsValue<T>` with that type. `—` means any result.
- **"`x` content types: …"** is a `@Parameter(supportedContentTypes:)` argument. At least one listed type must conform to one of the named supertypes, and subtypes count: `[.mp3]` satisfies public.audio, `[.pdf]` satisfies public.item, and `[.image]` alone satisfies "public.audio, public.image or public.item".
- **"needs `static let …`"** is a static member the build demands by value.
- **Every entity** also needs `id`, `displayRepresentation` and `static let defaultQuery`. **Every enum** needs `caseDisplayRepresentations` covering its cases. Never declare `typeDisplayRepresentation` on a schema type, because the macro supplies it.
- **Tiers** follow Apple's grouping. Apple documents Primary domains for Apple Intelligence and Siri, Shortcuts-specific domains for the Shortcuts app, and Single-purpose domains each for one system feature (the Japan side-button assistant, visual intelligence).
- **Platforms.** No domain exists on watchOS or tvOS. A domain's Platforms value applies to each of its rows unless the row is tagged. A row's tag is the newest release among the row itself and every type it names, schema or not, unless the build also accepts an older type for that member: `.photos.asset` and Journal's `createEntry`, `updateEntry` and `entry` list `location: GeoToolbox.PlaceDescriptor?`, which is iOS 26, but `location: CLPlacemark?` builds from an iOS 18 deployment target (measured at 18.0, 26.0 and 27.2), so those rows keep their iOS 18 availability and code below iOS 26 declares `CLPlacemark?`. For a deployment target below a row's release, gate every schema type, union and query with `@available` for that release, and exclude watchOS and tvOS: for 27, `@available(anyAppleOS 27, *) @available(watchOS, unavailable) @available(tvOS, unavailable)`. Without the exclusions, any target that also builds for watchOS or tvOS fails with `'reminders' is unavailable in watchOS` (or that domain's name).
- **"deprecated in 27; use `.x.y`"** is the SDK's own deprecation. The replacements are themselves `OS27`. On a 27 deployment target, adopt the replacement. Below that, keep the deprecated schema for older releases and gate the replacement with `@available`.
- **Build warnings** under a domain are use-case checks. The build succeeds without them, but the named use case is incomplete. Each carries Xcode's fix-it. On Xcode 27.2, Maps' `App Intents use case 'Start Navigation' is missing the schema 'maps.placeIntentValueQuery'` printed in a control build that also had schema errors and not in the clean build of the same Maps code, so the 27.2 census, which reads the clean build, lists none.

## Build Errors

All of these come from the `ExtractAppIntentsMetadata` phase, which runs only after Swift compiles cleanly. One unrelated Swift error hides every schema error. Any of them also prints `At least one halting error was produced during export`, and nothing reaches Siri until the build is clean.

| Error | Fix |
|---|---|
| `Missing required parameter 'x' from AppSchemaIntent 'd.i'` / `Missing required property 'x' from AppSchemaEntity 'd.e'` | Declare `x` with the type and optionality in the row |
| `Type 'T' is missing case 'c' required by AppSchemaEnum 'd.e'` (Xcode 27.2; 27.1: `'T' conforming to 'd.e' requires enum case 'c'`) | Add case `c` |
| `AppSchemaIntent 'd.i' requires type of parameter 'x' to be T` / `AppSchemaEntity 'd.e' requires type of property 'x' to be T` (27.2; 27.1: `… does not match required AppSchemaIntent type 'T'` / `Property 'x' type does not match required AppSchemaEntity property type 'T'`) | Use the row's type. In 27.2, `@AppEntity(schema: .d.e)` is your type adopting that schema, `an array of T` / `a set of T` are `[T]` / `Set<T>`, and `a @UnionValue with cases limited to the types A or B` is a union (27.1 spelled these `Schema<XEntity>`, `Array<T>` and `XCases:(A \| B)`) |
| `… requires type of parameter 'x' to be optional` / `… of property 'x' to be optional` (27.2; 27.1: `Required AppSchemaIntent parameter 'x' must be optional` or `must not be optional`) | Match the row's `?` |
| `AppSchemaIntent 'd.i' requires that 'perform()' must return T` (27.2; 27.1: `… include a 'ReturnsValue<T>'`) | Return `some IntentResult & ReturnsValue<YourType>` |
| `The 'supportedTypeIdentifiers' argument of parameter 'x' must specify at least one UTType subtype of the following supertypes: …` | `@Parameter(supportedContentTypes: [.image])` with a conforming type |
| `AppSchemaIntent 'X' requires 'E' to conform to 'IndexedEntity', 'UniqueAppEntity', 'TransientAppEntity', provide a default 'EntityStringQuery', or provide an 'IntentValueQuery'` | Make `E` resolvable: adopt `IndexedEntity`, or make its `defaultQuery` an `EntityStringQuery` |
| `AssistantSchemaIntent 'assistant.activate' requires 'supportedModes = .foreground'` | `static let supportedModes: IntentModes = .foreground` |
| `'OpenIntent' must have 'target' as the only required parameter` | Make the intent's other required parameters optional, as their rows say |
| `type 'X' does not conform to protocol 'OpenIntent'` (or `DeleteIntent`, `FileEntity`, …), a Swift error | Add that protocol's members (above) |

<!-- generated by node scripts/app-schemas.ts from scripts/app-schemas.json; edit those, not the text below -->
Census: Xcode 27.2 (27B52), iphoneos 27.2 SDK. A control build adopting every schema exactly as listed produced no errors.

## Audio

**Tier**: Primary. **Platforms**: OS27

| Intent | Required parameters | Returns |
|---|---|---|
| `addToLibrary` | `audioEntity: AudioItem` | — |
| `addToPlaylist` | `audioEntity: AudioItem, playlist: .audio.playlist` | — |
| `createStation` | — | — |
| `playAudio` | `audioEntity: AudioItem, playbackAttributes: Set<.audio.playbackAttributes>, queueLocation: .audio.queueInsertionLocation?, warmupAudioQueueResult: .audio.warmupAudioQueueResult?` | — |
| `recognizeAudio` | — | `[AudioItem]` |
| `updateAudioAffinity` | `affinityState: .audio.affinityState, target: AudioItem` | — |
| `warmupAudioQueue` | `audioEntity: AudioItem, playbackAttributes: Set<.audio.playbackAttributes>` | `.audio.warmupAudioQueueResult` |

| Entity | Required properties |
|---|---|
| `album` | `artistName: String, artists: [.audio.artist], title: String, universalProductCode: String?` |
| `algorithmicRadioStation` | `curatedForMe: Bool?, title: String` |
| `ambientSound` | `title: String` |
| `artist` | `name: String` |
| `audiobook` | `author: String?, genre: String?, narrator: String?, publisher: String?, purchaseDate: Date?, releaseDate: Date?, seriesTitle: String?, title: String?` |
| `classicalMusicRecording` | `artistName: String, artists: [.audio.artist], composerName: String?, composers: [.audio.artist], internationalStandardRecordingCode: String?, title: String` |
| `liveRadioStation` | `providerName: String?, title: String` |
| `newsBrief` | `date: Date?, provider: .audio.newsProvider?, providerName: String?, title: String` |
| `newsProvider` | `title: String` |
| `playlist` | `createdByMe: Bool?, curatedForMe: Bool?, owner: Owner?, title: String` |
| `podcastCollection` | `title: String` |
| `podcastEpisode` | `duration: Double?, releaseDate: Date?, show: .audio.podcastShow?, showName: String?, title: String` |
| `podcastShow` | `showDescription: String?, title: String` |
| `radioShow` | `title: String` |
| `radioShowEpisode` | `releaseDate: Date?, show: .audio.radioShow?, showName: String?, title: String` |
| `song` | `album: .audio.album?, albumTitle: String?, artistName: String, artists: [.audio.artist], composerName: String?, composers: [.audio.artist], internationalStandardRecordingCode: String?, title: String` |
| `songCollection` | `title: String?` |
| `warmupAudioQueueResult` | — |

| Enum | Required cases |
|---|---|
| `activity` | `barbecuing, beachDay, cleaning, commuting, cooking, cycling, dance, dining, driving, focusing, gaming, gardening, hiit, indoorActivity, meditating, outdoorActivity, partying, reading, relaxing, roadTrip, rowing, running, showering, sleeping, strength, studying, traveling, walking, working, workoutHighIntensity, workoutLowIntensity, workoutMediumIntensity, yoga` |
| `affinityState` | `dislike, like, unset` |
| `appViewIdentifier` | `nowPlaying` |
| `invocationSource` | `suggestedByApp, userInitiated` |
| `playbackAttributes` | `repeat, shuffle` |
| `queueInsertionLocation` | `next, tail` |

| Union (`@UnionValue`) | Cases | Builds with only its first case, and with only its last |
|---|---|---|
| `AudioItem` | `.audio.song, .audio.album, .audio.artist, .audio.playlist, .audio.songCollection, .audio.classicalMusicRecording, .audio.liveRadioStation, .audio.algorithmicRadioStation, .audio.radioShowEpisode, .audio.radioShow, .audio.podcastShow, .audio.podcastEpisode, .audio.podcastCollection, .audio.audiobook, .audio.ambientSound, .audio.newsBrief, .audio.newsProvider` | yes |
| `Owner` | `IntentPerson, String` | yes |

## Calendar

**Tier**: Primary. **Platforms**: OS27

| Intent | Required parameters | Returns |
|---|---|---|
| `createEvent` | `attendees: [.calendar.attendee], calendar: .calendar.calendar, endDate: Date?, isAllDay: Bool, location: EventLocation?, note: AttributedString?, recurrence: Calendar.RecurrenceRule?, startDate: Date, title: String` | `.calendar.event` |
| `deleteEvent` | `entity: .calendar.event, span: .calendar.eventSpan?` | — |
| `updateEvent` | `attendees: [.calendar.attendee]?, calendar: .calendar.calendar?, endDate: Date?, event: .calendar.event, isAllDay: Bool?, location: EventLocation?, note: String?, recurrence: Calendar.RecurrenceRule?, span: .calendar.eventSpan?, startDate: Date?, title: String?` | `.calendar.event` |

| Entity | Required properties |
|---|---|
| `attendee` | `isAttendanceOptional: Bool, person: IntentPerson, status: .calendar.attendeeStatus?, type: .calendar.attendeeType?` |
| `calendar` | `title: String` |
| `event` | `alarms: [EventAlarm], attendees: [.calendar.attendee], calendar: .calendar.calendar, endDate: Date, isAllDay: Bool, location: EventLocation?, note: AttributedString?, organizers: [IntentPerson], recurrence: Calendar.RecurrenceRule?, startDate: Date, status: .calendar.eventStatus?, title: String, travelTime: Duration?, virtualLocation: URL?` |

| Enum | Required cases |
|---|---|
| `attendeeStatus` | `accepted, declined, tentative` |
| `eventSpan` | `all, future, this` |
| `eventStatus` | `cancelled, confirmed, tentative` |

Enums with no required cases: `attendeeType`

| Union (`@UnionValue`) | Cases | Builds with only its first case, and with only its last |
|---|---|---|
| `EventAlarm` | `Duration, Date` | yes |
| `EventLocation` | `GeoToolbox.PlaceDescriptor, String` | yes |

## Camera

**Tier**: Primary. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `openInCaptureMode` (OpenIntent) | `target: .camera.captureMode` | — |
| `setDevice` | `device: .camera.captureDevice` | — |
| `startCapture` | `captureMode: .camera.captureMode, device: .camera.captureDevice?, timerDuration: .camera.captureDuration?` | — |
| `stopCapture` | — | — |
| `switchDevice` | — | — |

Enums with no required cases: `captureDevice`, `captureDuration`, `captureMode`

## Clock

**Tier**: Primary. **Platforms**: OS27

| Intent | Required parameters | Returns |
|---|---|---|
| `cancelTimer` | `entities: [.clock.timer]` | — |
| `createAlarm` | `canSnooze: Bool, label: String?, recurrenceDays: Calendar.RecurrenceRule?, time: DateComponents` | `.clock.alarm` |
| `createTimer` | `duration: Duration, isSleepTimer: Bool, label: String?` | `.clock.timer` |
| `deleteAlarm` (DeleteIntent) | `entities: [.clock.alarm]` | — |
| `dismissAlarm` | `alarm: .clock.alarm` | `.clock.alarm` |
| `lapStopwatch` | `stopwatch: .clock.stopwatch` | — |
| `pauseTimer` | `timer: .clock.timer` | — |
| `resetStopwatch` | `stopwatch: .clock.stopwatch` | — |
| `resumeTimer` | `timer: .clock.timer` | — |
| `snoozeAlarm` | `alarm: .clock.alarm, duration: Duration` | `.clock.alarm` |
| `startStopwatch` | — | `.clock.stopwatch` |
| `stopStopwatch` | `stopwatch: .clock.stopwatch` | — |
| `updateAlarm` | `alarm: .clock.alarm, allowsSnooze: Bool?, isEnabled: Bool?, label: String?, recurrenceDays: Calendar.RecurrenceRule?, time: DateComponents?` | `.clock.alarm` |
| `updateTimer` | `duration: Duration?, isSleepTimer: Bool?, label: String?, timer: .clock.timer` | `.clock.timer` |

| Entity | Required properties |
|---|---|
| `alarm` | `canSnooze: Bool, isEnabled: Bool, label: String?, recurrenceDays: Calendar.RecurrenceRule?, time: DateComponents, triggerState: .clock.alarmTriggerState` |
| `stopwatch` | `laps: [Duration], pauseTime: Date?, startTime: Date, state: .clock.stopwatchState` |
| `timer` | `duration: Duration, durationRemaining: Duration, isSleepTimer: Bool, label: String?, state: .clock.timerState` |

| Enum | Required cases |
|---|---|
| `alarmTriggerState` | `firing, none, snoozed` |
| `stopwatchState` | `paused, running` |
| `timerState` | `firing, paused, running, undefined` |

## Mail

**Tier**: Primary. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `archiveMail` | `entities: [.mail.message]` | — |
| `createDraft` | `account: .mail.account?, attachments: [IntentFile], bcc: [IntentPerson], body: AttributedString?, cc: [IntentPerson], subject: String?, to: [IntentPerson]` | `.mail.draft` |
| `deleteDraft` (DeleteIntent) | `entities: [.mail.draft]` | — |
| `deleteMail` (DeleteIntent) | `entities: [.mail.message]` | — |
| `forwardMail` | `account: .mail.account?, attachments: [IntentFile], bcc: [IntentPerson], body: AttributedString?, cc: [IntentPerson], subject: String?, target: .mail.message, to: [IntentPerson]` | — |
| `openDraft` (OpenIntent) `OS27` | `target: .mail.draft` | — |
| `openMessage` (OpenIntent) `OS27` | `target: .mail.message` | — |
| `replyMail` | `account: .mail.account?, attachments: [IntentFile], bcc: [IntentPerson], body: AttributedString?, cc: [IntentPerson], isReplyAll: Bool, subject: String?, target: .mail.message, to: [IntentPerson]` | — |
| `saveDraft` | `target: .mail.draft` | — |
| `sendDraft` | `sendLaterDate: Date?, target: .mail.draft` | — |
| `updateDraft` | `account: .mail.account?, attachments: [IntentFile]?, bcc: [IntentPerson]?, body: AttributedString?, cc: [IntentPerson]?, subject: String?, target: .mail.draft, to: [IntentPerson]?` | — |
| `updateMail` | `isFlagged: Bool?, isJunk: Bool?, isRead: Bool?, mailbox: .mail.mailbox?, target: [.mail.message]` | — |

| Entity | Required properties |
|---|---|
| `account` | `emailAddress: String, name: String` |
| `draft` | `account: .mail.account, attachments: [IntentFile], bcc: [IntentPerson], body: AttributedString?, cc: [IntentPerson], subject: String?, to: [IntentPerson]` |
| `mailbox` | `account: .mail.account, name: String` |
| `message` | `account: .mail.account, attachments: [IntentFile], bcc: [IntentPerson], body: AttributedString?, category: .mail.category?, cc: [IntentPerson], dateReceived: Date, dateSent: Date, isFlagged: Bool, isJunk: Bool, isRead: Bool, mailbox: .mail.mailbox, sender: IntentPerson, subject: String?, to: [IntentPerson]` |
| `thread` `OS27` | `description: String?, messages: [.mail.message], title: String` |

Enums with no required cases: `category`

## Maps

**Tier**: Primary. **Platforms**: OS27

| Intent | Required parameters | Returns |
|---|---|---|
| `reportIncident` | `incident: .maps.incident` | — |
| `shareETA` | `person: IntentPerson` | — |
| `startNavigation` | `destinations: [MapsLocation], origin: MapsLocation, preferences: Set<.maps.navigationPreferences>, transportationType: .maps.transportType` | `.maps.navigationSession` |
| `stopNavigation` | `navigation: .maps.navigationSession` | — |
| `stopShareETA` | `person: IntentPerson?` | — |
| `updateNavigationWaypoints` | `navigation: .maps.navigationSession, waypoints: [MapsLocation]` | `.maps.navigationSession` |

| Entity | Required properties |
|---|---|
| `currentLocation` | — |
| `navigationSession` (UniqueAppEntity) | `estimatedArrivalDate: Date, preferences: [.maps.navigationPreferences], transportationType: .maps.transportType, waypoints: [MapsLocation]` |
| `operatingHours` | `friday: [.maps.operatingTimeRange], monday: [.maps.operatingTimeRange], saturday: [.maps.operatingTimeRange], sunday: [.maps.operatingTimeRange], thursday: [.maps.operatingTimeRange], tuesday: [.maps.operatingTimeRange], wednesday: [.maps.operatingTimeRange]` |
| `operatingTimeRange` | `endTime: DateComponents, startTime: DateComponents` |
| `place` | `amenities: [String], categories: [String], name: String?, operatingHours: .maps.operatingHours?, operatingStatus: .maps.operatingStatus?, phoneNumber: String?, place: GeoToolbox.PlaceDescriptor, priceRange: .maps.priceRange?, ratings: [.maps.rating]` |
| `rating` | `count: Int?, descriptor: .maps.ratingDescriptor, provider: String, value: Double` |

| Enum | Required cases |
|---|---|
| `ratingDescriptor` | `percentage` |

Enums with no required cases: `amenity`, `incident`, `navigationPreferences`, `operatingStatus`, `priceRange`, `transportType`

| Union (`@UnionValue`) | Cases | Builds with only its first case, and with only its last |
|---|---|---|
| `MapsLocation` | `.maps.place, .maps.currentLocation` | yes |

## Messages

**Tier**: Primary. **Platforms**: OS27

| Intent | Required parameters | Returns |
|---|---|---|
| `draftMessage` | `attachments: [IntentFile], audioMessage: IntentFile?, content: AttributedString?, destination: MessageDestination?, links: [URL], locations: [GeoToolbox.PlaceDescriptor], scheduledDate: Date?, subject: AttributedString?`; `attachments` content types: public.audio, public.image or public.item; `audioMessage` content types: public.audio | — |
| `editSentMessage` | `content: AttributedString, message: .messages.message` | — |
| `sendMessage` | `attachments: [IntentFile], audioMessage: IntentFile?, content: AttributedString?, destination: MessageDestination, links: [URL], locations: [GeoToolbox.PlaceDescriptor], scheduledDate: Date?, subject: AttributedString?`; `attachments` content types: public.audio, public.image or public.item; `audioMessage` content types: public.audio | `[.messages.message]` |
| `setMessageReadStatus` | `isRead: Bool, message: .messages.message` | — |
| `unsendMessage` | `message: .messages.message` | — |

| Entity | Required properties |
|---|---|
| `conversation` | `attributes: Set<.messages.conversationAttribute>, conversationName: String?, dateLastActive: Date?, displayName: String, isRead: Bool, previewText: AttributedString, recipients: [.messages.messagePerson]` |
| `customAttachment` | `description: AttributedString?, sourceName: AttributedString?` |
| `message` | `attachments: [IntentFile], attributes: Set<.messages.messageAttribute>, audioMessage: IntentFile?, author: .messages.messagePerson, body: AttributedString?, conversation: .messages.conversation, customAttachments: [.messages.customAttachment], date: Date, isRead: Bool, links: [LinkPresentation.LinkMetadata], locations: [GeoToolbox.PlaceDescriptor], messageEffect: .messages.messageEffect?, messageType: .messages.messageType, notificationIdentifier: String?, reaction: ReadReaction?, referencedMessage: .messages.message?, subject: AttributedString?` |
| `messagePerson` | `person: IntentPerson` |

| Enum | Required cases |
|---|---|
| `messageType` | `unspecified` |

Enums with no required cases: `conversationAttribute`, `customReaction`, `messageAttribute`, `messageEffect`

| Union (`@UnionValue`) | Cases | Builds with only its first case, and with only its last |
|---|---|---|
| `MessageDestination` | `[IntentPerson], .messages.messagePerson, [.messages.messagePerson]` | yes |
| `ReadReaction` | `.messages.customReaction, AttributedString` | yes |

## Notes

**Tier**: Primary. **Platforms**: OS27

| Intent | Required parameters | Returns |
|---|---|---|
| `appendText` | `content: AttributedString, target: .notes.note` | `.notes.note` |
| `createNote` | `attachments: [IntentFile], content: AttributedString?, folder: .notes.folder?, isPinned: Bool, name: AttributedString`; `attachments` content types: public.item | `.notes.note` |
| `updateNote` | `attachments: [IntentFile]?, folder: .notes.folder?, isPinned: Bool?, name: AttributedString?, target: .notes.note`; `attachments` content types: public.item | `.notes.note` |

| Entity | Required properties |
|---|---|
| `account` | `name: String` |
| `folder` | `account: .notes.account?, name: String, parentFolder: .notes.folder?` |
| `note` | `attachments: [IntentFile], content: AttributedString?, creationDate: Date?, folder: .notes.folder?, isPinned: Bool, modificationDate: Date?, name: AttributedString` |

## Phone

**Tier**: Primary. **Platforms**: OS27

| Intent | Required parameters | Returns |
|---|---|---|
| `startCall` | `audioVisualMode: .phone.audioVisualMode, destination: CallDestination` | — |

| Entity | Required properties |
|---|---|
| `phonePerson` | `person: IntentPerson` |

| Enum | Required cases |
|---|---|
| `audioVisualMode` | `audio, video` |

| Union (`@UnionValue`) | Cases | Builds with only its first case, and with only its last |
|---|---|---|
| `CallDestination` | `.phone.phonePerson, [.phone.phonePerson]` | yes |

## Photos

**Tier**: Primary. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `addAssetsToAlbum` | `album: .photos.album, assets: [.photos.asset]` | — |
| `cleanupPhoto` | `target: .photos.asset` | — |
| `copyEdits` | `target: .photos.asset` | — |
| `createAlbum` | `name: String` | `.photos.album` |
| `createAssets` | `files: [IntentFile]` | `[.photos.asset]` |
| `crop` | `target: .photos.asset` | — |
| `deleteAlbum` (DeleteIntent) | `entities: [.photos.album]` | — |
| `deleteAssets` (DeleteIntent) | `entities: [.photos.asset]` | — |
| `duplicateAssets` | `entities: [.photos.asset]` | `[.photos.asset]` |
| `editAsset` `OS27` | `asset: .photos.asset` | — |
| `openAlbum` (OpenIntent) | `target: .photos.album` | — |
| `openAsset` (OpenIntent), deprecated in 27; use `.system.open` | `target: .photos.asset` | — |
| `pasteEdits` | `target: [.photos.asset]` | — |
| `postToSharedAlbum` | `assets: [.photos.asset]?, comment: String?, files: [IntentFile]?, sharedAlbum: .photos.album` | — |
| `removeAssetsFromAlbum` | `album: .photos.album, assets: [.photos.asset]` | — |
| `search` (ShowInAppSearchResultsIntent), deprecated in 27; use `.system.searchInApp` | `criteria: StringSearchCriteria` | — |
| `setDepth` | `target: .photos.asset, value: Double` | — |
| `setExposure` | `target: .photos.asset, value: Double` | — |
| `setFilter` | `filterType: .photos.filterType, target: .photos.asset` | — |
| `setRotation` | `direction: .photos.rotationDirection, target: .photos.asset` | — |
| `setSaturation` | `target: .photos.asset, value: Double` | — |
| `setWarmth` | `target: .photos.asset, value: Double` | — |
| `straighten` | `target: .photos.asset` | — |
| `toggleDepth` | `isEnabled: Bool, target: .photos.asset` | — |
| `toggleSuggestedEdits` | `isEnabled: Bool, target: .photos.asset` | — |
| `updateAlbum` | `name: String, target: .photos.album` | — |
| `updateAsset` | `isFavorite: Bool?, isHidden: Bool?, name: String?, target: [.photos.asset]` | — |
| `updateRecognizedPerson` | `isFavorite: Bool?, name: String?, target: .photos.recognizedPerson` | — |

| Entity | Required properties |
|---|---|
| `album` | `albumType: .photos.albumType, creationDate: Date?, name: String` |
| `asset` | `aperture: Double?, assetType: .photos.assetType?, creationDate: Date?, exposure: Double?, filter: .photos.filterType?, hasSuggestedEdits: Bool, isFavorite: Bool, isHidden: Bool, isPortraitModeEnabled: Bool?, location: GeoToolbox.PlaceDescriptor?, saturation: Double?, warmth: Double?` |
| `recognizedPerson` | `isFavorite: Bool, name: String` |

Enums with no required cases: `albumType`, `assetType`, `filterType`, `rotationDirection`

`asset.location` also builds as `CLPlacemark` (measured at an iOS 18.0 deployment target), the type to declare where `GeoToolbox.PlaceDescriptor` (iOS 26+, macOS 26+, visionOS 26+) is unavailable.

## Reminders

**Tier**: Primary. **Platforms**: OS27

| Intent | Required parameters | Returns |
|---|---|---|
| `createList` | `name: String, type: .reminders.listType` | `.reminders.list` |
| `createReminder` | `dueDate: DateComponents?, images: [IntentFile], isFlagged: Bool?, list: .reminders.list?, locationTrigger: .reminders.locationTrigger?, note: AttributedString?, recurrence: Calendar.RecurrenceRule?, section: .reminders.section?, tags: Set<String>, title: String, urls: [URL]`; `images` content types: public.image | `.reminders.reminder` |
| `createSection` | `list: .reminders.list, name: String` | `.reminders.section` |
| `deleteReminders` (DeleteIntent) | `entities: [.reminders.reminder]` | — |
| `updateReminder` | `dueDate: DateComponents?, isCompleted: Bool?, isFlagged: Bool?, list: .reminders.list?, locationTrigger: .reminders.locationTrigger?, note: AttributedString?, recurrence: Calendar.RecurrenceRule?, tags: Set<String>?, target: .reminders.reminder, title: String?, urls: [URL]?` | `.reminders.reminder` |

| Entity | Required properties |
|---|---|
| `group` | `lists: [.reminders.list], name: String` |
| `list` | `name: String, type: .reminders.listType` |
| `locationTrigger` | `event: .reminders.locationTriggerEvent, place: GeoToolbox.PlaceDescriptor` |
| `reminder` | `completionDate: Date?, creationDate: Date?, dueDate: DateComponents?, isCompleted: Bool, isFlagged: Bool?, list: .reminders.list, locationTrigger: .reminders.locationTrigger?, note: AttributedString?, recurrence: Calendar.RecurrenceRule?, tags: Set<String>, title: String, urls: [URL]` |
| `section` | `list: .reminders.list, name: String` |

| Enum | Required cases |
|---|---|
| `listType` | `standard` |
| `locationTriggerEvent` | `arrive, depart` |

## System

**Tier**: Primary. **Platforms**: OS27

| Intent | Required parameters | Returns |
|---|---|---|
| `open` (OpenIntent) | `target: AppEntity` | — |
| `search` (ShowInAppSearchResultsIntent) (iOS 18+, macOS 15+, visionOS 2+), deprecated in 27; use `.system.searchInApp` | `criteria: StringSearchCriteria` | — |
| `searchInApp` (ShowInAppSearchResultsIntent) | `criteria: StringSearchCriteria` | — |

## Assistant

**Tier**: Single-purpose. **Platforms**: iOS 26.2+; not macOS/visionOS

| Intent | Required parameters | Returns |
|---|---|---|
| `activate` | needs `static let supportedModes: IntentModes = .foreground` | — |

## VisualIntelligence

**Tier**: Single-purpose. **Platforms**: iOS 26+, macOS 27+; not visionOS

| Intent | Required parameters | Returns |
|---|---|---|
| `semanticContentSearch` | `semanticContent: VisualIntelligence.SemanticContentDescriptor` | — |

## Books

**Tier**: Shortcuts-specific. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `navigatePage` | `direction: .books.navigationDirection, target: .books.book` | — |
| `openBook` (OpenIntent) | `target: .books.book` | — |
| `playAudiobook`, deprecated in 27; use `.audio.playAudio` | `target: .books.audiobook` | — |
| `search` (ShowInAppSearchResultsIntent), deprecated in 27; use `.system.searchInApp` | `criteria: StringSearchCriteria` | — |
| `updateCharacterSpacing` | `changeOperation: .books.relativeCharacterSpacingChange, target: .books.settings` | — |
| `updateFontSize` | `changeOperation: .books.relativeFontChange, target: .books.settings` | — |
| `updateLineSpacing` | `changeOperation: .books.relativeLineSpacingChange, target: .books.settings` | — |
| `updateSettings` | `font: .books.font?, isAllowMultipleColumns: Bool?, isTextJustified: Bool?, pageNavigationSetting: .books.pageNavigationSetting?, target: .books.settings, theme: .books.theme?` | — |
| `updateWordSpacing` | `changeOperation: .books.relativeWordSpacingChange, target: .books.settings` | — |

| Entity | Required properties |
|---|---|
| `audiobook` | `author: String?, genre: String?, purchaseDate: Date?, seriesTitle: String?, title: String?, url: URL?` |
| `book` | `author: String?, genre: String?, purchaseDate: Date?, seriesTitle: String?, title: String?, url: URL?` |
| `settings` | `font: .books.font, fontSize: .books.fontSize, isAllowMultipleColumns: Bool, isTextJustified: Bool, pageNavigationSetting: .books.pageNavigationSetting, theme: .books.theme` |

Enums with no required cases: `contentType`, `font`, `fontSize`, `navigationDirection`, `pageNavigationSetting`, `relativeCharacterSpacingChange`, `relativeFontChange`, `relativeLineSpacingChange`, `relativeWordSpacingChange`, `theme`

## Browser

**Tier**: Shortcuts-specific. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `bookmarkTab` | `name: String?, tab: .browser.tab` | `.browser.bookmark` |
| `bookmarkURL` | `name: String?, url: URL` | `.browser.bookmark` |
| `clearHistory` | `timeFrame: .browser.clearHistoryTimeFrame` | — |
| `closeTabs` | `target: [.browser.tab]` | — |
| `closeWindows` | `target: [.browser.window]` | — |
| `createTab` | `isPrivate: Bool, url: URL?` | `.browser.tab` |
| `createWindow` | `isPrivate: Bool` | `.browser.window` |
| `deleteBookmarks` (DeleteIntent) | `entities: [.browser.bookmark]` | — |
| `findOnPage` | `searchPhrase: String, tab: .browser.tab` | — |
| `openBookmark` (OpenIntent) | `tab: .browser.tab?, target: .browser.bookmark` | — |
| `openURLInTab` | `tab: .browser.tab, url: URL` | — |
| `search` (ShowInAppSearchResultsIntent), deprecated in 27; use `.system.searchInApp` | `criteria: StringSearchCriteria` | — |
| `switchTab` (OpenIntent) | `target: .browser.tab` | — |

| Entity | Required properties |
|---|---|
| `bookmark` | `name: String, url: URL` |
| `readingListItem` `OS27` | `title: String, url: URL` |
| `tab` | `isPrivate: Bool, name: String, url: URL?` |
| `tabGroup` `OS27` | `title: String` |
| `window` | `isPrivate: Bool, tabs: [.browser.tab]` |

Enums with no required cases: `clearHistoryTimeFrame`

## Files

**Tier**: Shortcuts-specific. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `createFolder` | `fileName: String?, target: .files.file` | `.files.file` |
| `deleteFiles` (DeleteIntent) | `entities: [.files.file]` | — |
| `moveFiles` | `destinationFolder: .files.file, entities: [.files.file]` | — |
| `openFile` (OpenIntent) | `target: .files.file` | — |
| `renameFile` | `newName: String, target: .files.file` | — |

| Entity | Required properties |
|---|---|
| `file` (FileEntity) | `creationDate: Date?, fileModificationDate: Date?` |

## Journal

**Tier**: Shortcuts-specific. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `createAudioEntry` | — | — |
| `createEntry` | `entryDate: Date?, location: GeoToolbox.PlaceDescriptor?, mediaItems: [IntentFile], message: AttributedString, title: String?` | `.journal.entry` |
| `deleteEntry` (DeleteIntent) | `entities: [.journal.entry]` | — |
| `search` (ShowInAppSearchResultsIntent), deprecated in 27; use `.system.searchInApp` | `criteria: StringSearchCriteria` | — |
| `updateEntry` | `entryDate: Date?, location: GeoToolbox.PlaceDescriptor?, mediaItems: [IntentFile]?, message: AttributedString?, target: .journal.entry, title: String?` | — |

| Entity | Required properties |
|---|---|
| `entry` | `entryDate: Date?, location: GeoToolbox.PlaceDescriptor?, mediaItems: [IntentFile], message: AttributedString?, title: String?` |

`createEntry.location`, `updateEntry.location` and `entry.location` also build as `CLPlacemark` (measured at an iOS 18.0 deployment target), the type to declare where `GeoToolbox.PlaceDescriptor` (iOS 26+, macOS 26+, visionOS 26+) is unavailable.

## Presentation

**Tier**: Shortcuts-specific. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `addAudioToSlide` | `audio: IntentFile, target: .presentation.slide`; `audio` content types: public.audio | — |
| `addCommentToSlide` | `comment: String?, target: .presentation.slide` | — |
| `addImageToSlide` | `image: IntentFile, target: .presentation.slide`; `image` content types: public.image | — |
| `addTextBoxToSlide` | `target: .presentation.slide, text: String` | — |
| `addVideoToSlide` | `target: .presentation.slide, video: IntentFile`; `video` content types: public.movie | — |
| `addWebVideoToSlide` | `target: .presentation.slide, url: URL` | — |
| `create` | `template: .presentation.template?` | `.presentation.document` |
| `createSlide` | `presentation: .presentation.document, slideLayout: String?` | `.presentation.slide` |
| `deleteSlide` (DeleteIntent) | `entities: [.presentation.slide]` | — |
| `open` (OpenIntent) | `target: .presentation.document` | — |
| `openSlide` (OpenIntent) | `target: .presentation.slide` | — |
| `setSlideTitle` | `target: .presentation.slide, title: String` | — |
| `startPlayback` | `presentation: .presentation.document, target: .presentation.slide?` | — |
| `stopPlayback` | `presentation: .presentation.document` | — |
| `update` | `name: String?, target: .presentation.document` | — |

| Entity | Required properties |
|---|---|
| `document` | `name: String` |
| `slide` | `presentation: .presentation.document, slideIndex: Int?, title: String?` |
| `template` | `name: String` |

## Reader

**Tier**: Shortcuts-specific. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `deletePages` (DeleteIntent) | `entities: [.reader.page]` | — |
| `enhanceDocuments` | `target: [.reader.document]` | — |
| `insertPages` | `files: [IntentFile], isAfter: Bool, page: .reader.page` | — |
| `openDocument` | `files: [IntentFile]` | — |
| `openPage` (OpenIntent) | `target: .reader.page` | — |
| `resizeDocuments` | `documents: [.reader.document], height: Double?, width: Double?` | — |
| `rotateDocuments` | `documents: [.reader.document], isClockwise: Bool` | — |
| `rotatePages` | `isClockwise: Bool, pages: [.reader.page]` | — |
| `searchDocuments` | `criteria: String, documents: [.reader.document]` | — |

| Entity | Required properties |
|---|---|
| `document` | `height: Int?, kind: .reader.documentKind, title: String, width: Int?` |
| `page` | `label: String` |

Enums with no required cases: `documentKind`

## Spreadsheet

**Tier**: Shortcuts-specific. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `addAudioToSheet` | `audio: IntentFile, target: .spreadsheet.sheet`; `audio` content types: public.audio | — |
| `addCommentToSheet` | `comment: String?, target: .spreadsheet.sheet` | — |
| `addImageToSheet` | `image: IntentFile, target: .spreadsheet.sheet`; `image` content types: public.image | — |
| `addTextBoxToSheet` | `target: .spreadsheet.sheet, text: String` | — |
| `addVideoToSheet` | `target: .spreadsheet.sheet, video: IntentFile`; `video` content types: public.movie | — |
| `addWebVideoToSheet` | `target: .spreadsheet.sheet, url: URL` | — |
| `create` | `template: .spreadsheet.template?` | `.spreadsheet.document` |
| `createSheet` | `spreadsheet: .spreadsheet.document` | `.spreadsheet.sheet` |
| `delete` (DeleteIntent) | `entities: [.spreadsheet.document]` | — |
| `deleteSheet` (DeleteIntent) | `entities: [.spreadsheet.sheet]` | — |
| `open` (OpenIntent) | `target: .spreadsheet.document` | — |
| `openSheet` (OpenIntent) | `target: .spreadsheet.sheet` | — |
| `update` | `name: String?, target: .spreadsheet.document` | — |
| `updateSheet` | `name: String?, position: Int?, target: .spreadsheet.sheet` | — |

| Entity | Required properties |
|---|---|
| `document` | `name: String` |
| `sheet` | `name: String, sheetIndex: Int, spreadsheet: .spreadsheet.document` |
| `template` | `name: String` |

## Whiteboard

**Tier**: Shortcuts-specific. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `createBoard` | `title: String?` | `.whiteboard.board` |
| `createItem` | `itemType: .whiteboard.itemType?, mediaItems: [IntentFile], target: .whiteboard.board, text: AttributedString?, url: URL?` | — |
| `deleteBoard` (DeleteIntent) | `entities: [.whiteboard.board]` | — |
| `deleteItem` (DeleteIntent) | `entities: [.whiteboard.item]` | — |
| `openBoard` (OpenIntent) | `target: .whiteboard.board` | — |
| `updateBoard` | `target: .whiteboard.board, title: String?` | — |
| `updateItem` | `color: .whiteboard.color?, label: String?, target: .whiteboard.item` | — |

| Entity | Required properties |
|---|---|
| `board` | `creationDate: Date, lastModificationDate: Date, title: String` |
| `item` | `height: Double?, label: String?, type: .whiteboard.itemType, width: Double?, x: Double, y: Double` |

Enums with no required cases: `color`, `itemType`

## WordProcessor

**Tier**: Shortcuts-specific. **Platforms**: iOS 18+, macOS 15+, visionOS 2+

| Intent | Required parameters | Returns |
|---|---|---|
| `addAudioToPage` | `audio: IntentFile, target: .wordProcessor.page`; `audio` content types: public.audio | — |
| `addImageToPage` | `image: IntentFile, target: .wordProcessor.page`; `image` content types: public.image | — |
| `addTextBoxToPage` | `target: .wordProcessor.page, text: String` | — |
| `addVideoToPage` | `target: .wordProcessor.page, video: IntentFile`; `video` content types: public.movie | — |
| `addWebVideoToPage` | `target: .wordProcessor.page, url: URL` | — |
| `create` | `template: .wordProcessor.template?` | — |
| `createPage` | `target: .wordProcessor.document, template: String?` | — |
| `open` (OpenIntent) | `target: .wordProcessor.document` | — |
| `openPage` (OpenIntent) | `target: .wordProcessor.page` | — |

| Entity | Required properties |
|---|---|
| `document` | `creationDate: Date?, modificationDate: Date?, name: String` |
| `page` | `document: .wordProcessor.document, pageIndex: Int` |
| `template` | `name: String` |
<!-- end of generated section -->

## Resources

**WWDC**: 2026-240, 2026-343, 2026-344

**Docs**: /appintents/app-schema-domains, /appintents/appintent(schema:), /appintents/appentity(schema:), /appintents/appenum(schema:)

**Skills**: app-intents-ref, siri-audio-ref, siri-notes-reminders
