
# Siri for Audio Apps — API Reference

Every type, member, parameter, case, and build error for making an audio app (music, podcasts, audiobooks, radio, ambient sound, news briefs) work with Siri: Part 1 is the Audio schema domain that Siri AI uses, Part 2 the SiriKit media intents that classic Siri uses, Part 3 the Now Playing commands both use. Which paths to build, and what "Siri AI" and "classic Siri" cover: `skills/siri-audio.md`. Symptom-driven fixes: `skills/siri-audio-diag.md`. Every other schema domain's required shapes: `skills/app-schemas-ref.md`.

The Audio schema path does not replace SiriKit media: in the 27.1 SDK the SiriKit media intents carry no deprecation (the 27 cycle deprecated only the Lists/Notes SiriKit domain, "Please adopt the Notes or Reminders AppSchema domain instead"). An app that wants every Siri user ships both.

## Part 1 — Audio Schema Domain `OS27`

**Platforms**: OS27, not watchOS/tvOS (`@available(anyAppleOS 27.0, *) @available(watchOS, unavailable) @available(tvOS, unavailable)`). `AudioSearch` itself exists on all platforms. Deployment target below 27: put that full attribute on every schema type, union, and query — builds clean at a 26.0 target. `@available(iOS 27.0, *)` alone fails in any target that also builds for watchOS (`'audio' is unavailable in watchOS`), tvOS, or macOS.

The schema path needs **no** Siri capability, `NSSiriUsageDescription`, or `requestSiriAuthorization` — those are SiriKit's (Part 2). Apple's music sample ships an empty entitlements file and declares only `UIBackgroundModes` `audio`.

The Swift interface only names the schemas (`AppSchema.Entity("SongEntity")`); the required shapes live inside `appintentsmetadataprocessor`, so the build errors in this section are the only machine-readable source.

### How enforcement works

- Shapes are checked by the **`ExtractAppIntentsMetadata` build phase**, not the type checker. That phase runs **only after Swift compiles cleanly** — a single unrelated Swift error hides every schema error, which reads as "no enforcement". Fix Swift errors first.
- A failing schema prints `error: At least one halting error was produced during export, so no AppIntents metadata have been exported and this target is not usable with AppIntents until errors are resolved`. Nothing ships to Siri until it is clean.
- "Required" means **must be declared, with exactly the stated optionality** — a required `String?` declared as `String` fails (27.2: "to be optional"; 27.1: "must be optional"), and the reverse fails too.
- **Extra members are allowed and unchecked**: additional stored properties on entities, additional intent parameters, additional enum cases. No Audio entity or intent has optional schema members — the required set is the whole schema.
- The macro turns plain `var`s into `@Property`/`@Parameter`; you may still write `@Parameter(default: [])` to set a default.
- The intents are independent: adopting `playAudio` without `warmupAudioQueue` (or any other subset) builds clean. Unlike Messages, the Audio domain has no schema-completeness build error.
- Do **not** declare `typeDisplayRepresentation` on a schema type — `warning: The property 'typeDisplayRepresentation' should not be overridden in an AppEntity that conforms to a schema`. The macro supplies it.
- Apple's docs say Xcode **warns** when `playAudio` ships without an `IntentValueQuery` (the "playback use-case group"). On Xcode 27A9275 no warning appeared. Don't rely on the warning — adopt both.

### Entities

Every entity also needs `id`, `displayRepresentation`, and `static let defaultQuery`. Relationship members take your own types that adopt the matching schema (`[ArtistEntity]` means your `.audio.artist` type).

| Schema | Required members (exact optionality) |
|---|---|
| `.audio.song` | `title: String`, `artistName: String`, `artists: [Artist]`, `composerName: String?`, `composers: [Artist]`, `albumTitle: String?`, `album: Album?`, `internationalStandardRecordingCode: String?` |
| `.audio.album` | `title: String`, `artistName: String`, `artists: [Artist]`, `universalProductCode: String?` |
| `.audio.artist` | `name: String` |
| `.audio.playlist` | `title: String`, `owner: Owner?` (union `Person \| String`), `createdByMe: Bool?`, `curatedForMe: Bool?` |
| `.audio.songCollection` | `title: String?` |
| `.audio.classicalMusicRecording` | `title: String`, `artistName: String`, `artists: [Artist]`, `composerName: String?`, `composers: [Artist]`, `internationalStandardRecordingCode: String?` |
| `.audio.liveRadioStation` | `title: String`, `providerName: String?` |
| `.audio.algorithmicRadioStation` | `title: String`, `curatedForMe: Bool?` |
| `.audio.podcastShow` | `title: String`, `showDescription: String?` |
| `.audio.podcastEpisode` | `title: String`, `showName: String?`, `show: PodcastShow?`, `releaseDate: Date?`, `duration: Double?` |
| `.audio.podcastCollection` | `title: String` |
| `.audio.radioShow` | `title: String` |
| `.audio.radioShowEpisode` | `title: String`, `showName: String?`, `show: RadioShow?`, `releaseDate: Date?` |
| `.audio.audiobook` (schema name `MediaBookEntity`) | `title: String?`, `author: String?`, `narrator: String?`, `publisher: String?`, `genre: String?`, `seriesTitle: String?`, `releaseDate: Date?`, `purchaseDate: Date?` |
| `.audio.ambientSound` | `title: String` |
| `.audio.newsProvider` | `title: String` |
| `.audio.newsBrief` | `title: String`, `providerName: String?`, `provider: NewsProvider?`, `date: Date?` |
| `.audio.warmupAudioQueueResult` | none — adopt `TransientAppEntity` |

Note the `title` asymmetry: `songCollection.title` and every audiobook member are optional; everywhere else `title` is non-optional.

### Intents

| Schema | Required parameters (exact types) | `perform()` must return | Macro adds |
|---|---|---|---|
| `.audio.playAudio` | `audioEntity: AudioItem`, `playbackAttributes: Set<PlaybackAttributes>` (non-optional), `warmupAudioQueueResult: WarmupAudioQueueResult?`, `queueLocation: QueueInsertionLocation?` | any `IntentResult` | `AudioPlaybackIntent` |
| `.audio.warmupAudioQueue` | `audioEntity: AudioItem`, `playbackAttributes: Set<PlaybackAttributes>` | `ReturnsValue<WarmupAudioQueueResult>` | — |
| `.audio.updateAudioAffinity` | `target: AudioItem` (not `audioEntity`), `affinityState: AffinityState` (non-optional) | any | — |
| `.audio.addToLibrary` | `audioEntity: AudioItem` | any | — |
| `.audio.addToPlaylist` | `audioEntity: AudioItem`, `playlist: Playlist` | any | — |
| `.audio.createStation` | none — "starts a station based on the now-playing item" | any | — |
| `.audio.recognizeAudio` | none | `ReturnsValue<[AudioItem]>` (an array; a single item fails) | `AudioRecordingIntent` |

- Apple's `playAudio` template declares `: AudioStartingIntent`, which is deprecated ("renamed to 'AudioPlaybackIntent'" — a deprecation warning). Write nothing (the macro adds `AudioPlaybackIntent`) or `: AudioPlaybackIntent`.
- `AudioRecordingIntent` (added to `recognizeAudio`): Apple's docs require starting a Live Activity when recording begins, or "the audio recording stops".
- Apple's sample gives `playbackAttributes` `@Parameter(default: [])`. The iOS 27 release notes fixed "Default values from schemas might not be applied for parameters that are of 'Set' type" (175534195).

### Enums

Write `enum X: String` (the macro adds `AppEnum`) and give every case a `caseDisplayRepresentations` entry — without it, `error: type 'X' does not conform to protocol 'CaseDisplayRepresentable'`.

| Schema | Required cases |
|---|---|
| `.audio.playbackAttributes` | `shuffle`, `` `repeat` `` |
| `.audio.queueInsertionLocation` | `next` (play next), `tail` (play last) |
| `.audio.affinityState` | `like`, `dislike`, `unset` (no "love") |
| `.audio.invocationSource` | `userInitiated`, `suggestedByApp` |
| `.audio.appViewIdentifier` | `nowPlaying` |
| `.audio.activity` | 33: `cooking dining studying focusing reading gaming working showering cleaning relaxing sleeping indoorActivity partying commuting driving traveling gardening barbecuing beachDay roadTrip outdoorActivity meditating yoga walking running strength cycling dance hiit rowing workoutLowIntensity workoutMediumIntensity workoutHighIntensity` |

No 27.1 Audio intent takes `invocationSource`, `appViewIdentifier`, or `activity`; adopting them is optional and Apple documents no consumer yet.

### The `AudioItem` union

Every `audioEntity`/`target` parameter and the `recognizeAudio` result is the union `AudioItemCases`: song, album, artist, playlist, songCollection, classicalMusicRecording, liveRadioStation, algorithmicRadioStation, radioShowEpisode, radioShow, podcastShow, podcastEpisode, podcastCollection, audiobook, ambientSound, newsBrief, newsProvider.

- Declare it with `@UnionValue` on an enum whose cases wrap your schema entities. **Any subset** of cases is valid — keep the ones you can play (Apple: "Keep the cases that your app supports and remove the rest").
- A case wrapping a non-schema entity, or a non-entity (`String`), fails: `… requires type of parameter 'audioEntity' to be a @UnionValue with cases limited to the types …` (27.2; 27.1 says `does not match required AppSchemaIntent type 'AudioItemCases:(…)'`).
- A single entity type in place of the union fails with the same error. There is no "songs-only" `playAudio`.
- `playlist.owner` is a second union, `OwnerCases:(Person | String)` — `case person(IntentPerson)` + `case name(String)`. A plain `String?` fails: `AppSchemaEntity 'audio.playlist' requires type of property 'owner' to be a @UnionValue with cases limited to the types Person or String` (27.2; 27.1: `Property 'owner' type does not match required AppSchemaEntity property type 'OwnerCases:(Person | String)'`).

### Resolvability — every entity Siri can pass you

Each union case, `addToPlaylist.playlist`, and `warmupAudioQueueResult` must be resolvable:

> `AppSchemaIntent 'PlayAudioIntent' requires UnionValue case 'SongEntity' to conform to 'IndexedEntity', 'UniqueAppEntity', 'TransientAppEntity', provide a default 'EntityStringQuery', or provide an 'IntentValueQuery'`

- Satisfied by: `IndexedEntity` on the entity, a `defaultQuery` that is an `EntityStringQuery`, or an `IntentValueQuery` **whose result is that entity type**.
- **Not satisfied** by an `IntentValueQuery` over `AudioSearch` that returns the union — that query feeds Siri's search but counts for none of the cases. Each entity still needs its own path.
- `warmupAudioQueueResult` → `TransientAppEntity`. Apple's own doc template gives it a plain `EntityQuery`, which fails this rule.
- A plain `EntityQuery` also can't be searched by name at runtime: AppIntentsTesting reports `LNPerformQueryErrorDomain 10002` with the message "Type does not support EntityStringQuery". Read the message — 10002 is also what `allEntities()` returns for a query that isn't an `EnumerableEntityQuery`.

### Initializer ordering

The schema macro observes its members. In a custom `init`, assign **every non-schema stored property — `id` included — before the first schema member**, or Swift reports `'self' used before all stored properties are initialized`. Order among schema members is free.

The synthesized memberwise init takes the wrappers, not the values (`cannot convert value of type 'String' to expected argument type 'EntityProperty<String>'`) — write an explicit `init` for any schema entity you construct in code. Likewise a bare interpolated literal (`{ "\(name)" }`) doesn't convert to `DisplayRepresentation` for a schema member; use `DisplayRepresentation(title: "\(name)")`.

### Complete adoption

One module, compiled verbatim against the 27.1 SDK. `Library`, `Player`, and `Track` stand for your own data and playback layers.

```swift
import AppIntents

@AppEntity(schema: .audio.artist)
struct ArtistEntity: IndexedEntity {
    static let defaultQuery = ArtistQuery()
    let id: String
    var name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }

    init(id: String, name: String) {    // the memberwise init takes EntityProperty<String>
        self.id = id
        self.name = name
    }
}

@AppEntity(schema: .audio.album)
struct AlbumEntity: IndexedEntity {
    static let defaultQuery = AlbumQuery()
    let id: String
    var title: String
    var artistName: String
    var artists: [ArtistEntity]
    var universalProductCode: String?
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)", subtitle: "\(artistName)")
    }
}

@AppEntity(schema: .audio.song)
struct SongEntity: IndexedEntity {   // index only local, bounded sets — see Indexing
    static let defaultQuery = SongQuery()
    let id: String
    var duration: TimeInterval          // your own property; extras are allowed

    var title: String
    var artistName: String
    var artists: [ArtistEntity]
    var composerName: String?
    var composers: [ArtistEntity]
    var albumTitle: String?
    var album: AlbumEntity?
    var internationalStandardRecordingCode: String?

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)", subtitle: "\(artistName)")
    }

    init(_ track: Track) {
        id = track.id                   // non-schema stored properties first
        duration = track.duration
        title = track.title
        artistName = track.artistName
        artists = [ArtistEntity(id: track.artistID, name: track.artistName)]
        composerName = nil
        composers = []
        albumTitle = track.albumTitle
        album = nil
        internationalStandardRecordingCode = track.isrc
    }
}

@UnionValue
enum PlaylistOwner {
    case person(IntentPerson)
    case name(String)
}

@AppEntity(schema: .audio.playlist)
struct PlaylistEntity: IndexedEntity {
    static let defaultQuery = PlaylistQuery()
    let id: String
    var title: String
    var owner: PlaylistOwner?
    var createdByMe: Bool?
    var curatedForMe: Bool?
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(title)") }
}

@AppEntity(schema: .audio.warmupAudioQueueResult)
struct WarmupAudioQueueResult: TransientAppEntity {
    var displayRepresentation: DisplayRepresentation { "Queue ready" }
    init() {}
}

@UnionValue
enum AudioItem {
    case song(SongEntity)
    case album(AlbumEntity)
    case artist(ArtistEntity)
    case playlist(PlaylistEntity)
}

@AppEnum(schema: .audio.playbackAttributes)
enum PlaybackAttributes: String {
    case shuffle
    case `repeat`
    static let caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .shuffle: "Shuffle", .repeat: "Repeat",
    ]
}

@AppEnum(schema: .audio.queueInsertionLocation)
enum QueueInsertionLocation: String {
    case next
    case tail
    static let caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .next: "Play Next", .tail: "Play Last",
    ]
}

@AppEnum(schema: .audio.affinityState)
enum AffinityState: String {
    case like
    case dislike
    case unset
    static let caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .like: "Like", .dislike: "Dislike", .unset: "No Rating",
    ]
}

@AppIntent(schema: .audio.playAudio)
struct PlayAudioIntent {
    var audioEntity: AudioItem
    @Parameter(default: [])
    var playbackAttributes: Set<PlaybackAttributes>
    var warmupAudioQueueResult: WarmupAudioQueueResult?
    var queueLocation: QueueInsertionLocation?

    func perform() async throws -> some IntentResult {
        let tracks = try await Library.shared.tracks(for: audioEntity)
        switch queueLocation {
        case nil: await Player.shared.play(tracks, shuffled: playbackAttributes.contains(.shuffle))
        case .next: await Player.shared.insertNext(tracks)
        case .tail: await Player.shared.append(tracks)
        }
        return .result()
    }
}

@AppIntent(schema: .audio.warmupAudioQueue)
struct WarmupAudioQueueIntent {
    var audioEntity: AudioItem
    @Parameter(default: [])
    var playbackAttributes: Set<PlaybackAttributes>

    func perform() async throws -> some IntentResult & ReturnsValue<WarmupAudioQueueResult> {
        await Player.shared.prepare(try await Library.shared.tracks(for: audioEntity))
        return .result(value: WarmupAudioQueueResult())
    }
}

@AppIntent(schema: .audio.updateAudioAffinity)
struct UpdateAudioAffinityIntent {
    var target: AudioItem
    var affinityState: AffinityState

    func perform() async throws -> some IntentResult {
        try await Library.shared.setAffinity(affinityState, for: target)
        return .result()
    }
}

@AppIntent(schema: .audio.addToPlaylist)
struct AddToPlaylistIntent {
    var audioEntity: AudioItem
    var playlist: PlaylistEntity

    func perform() async throws -> some IntentResult {
        try await Library.shared.add(audioEntity, to: playlist)
        return .result()
    }
}
```

The queries — `EntityStringQuery` makes each entity resolvable and searchable by name; the `AudioSearch` query is the structured-search half of the playback use-case group. Apple's sample states the order that fills `audioEntity`: "Spotlight-indexed entities, the `EntityStringQuery` matcher, or `AudioIntentValueQuery` for open-ended 'play something' requests."

```swift
import AppIntents
import MediaIntents

struct SongQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [SongEntity] {
        try await Library.shared.songs(ids: identifiers)
    }
    func entities(matching string: String) async throws -> [SongEntity] {
        try await Library.shared.songs(matching: string)
    }
}
// AlbumQuery, ArtistQuery, PlaylistQuery: same shape.

struct AudioSearchQuery: IntentValueQuery {
    func values(for input: AudioSearch) async throws -> [AudioItem] {
        switch input.criteria {
        case .searchQuery(let text): try await Library.shared.search(text)
        case .unspecified: try await Library.shared.recommended()
        case .url(let urls): try await Library.shared.items(for: urls)
        @unknown default: []
        }
    }
}
```

No registration connects `AudioSearchQuery` to `PlayAudioIntent.audioEntity`; the system matches by input and result type. The cross-import overlay `_MediaIntents_AppIntents` (makes `AudioSearch` an intent value) loads automatically when a file imports both modules.

### `AudioSearch` (MediaIntents)

| Member | Meaning (Apple's words in quotes) |
|---|---|
| `criteria: AudioSearch.Criteria` | The system's classification of the request |
| `.searchQuery(String)` | "The person's natural-language search query". Observed: it can still carry Siri's own words ("play …", "… in AppName") |
| `.unspecified` | "The request includes a vague search query or no specific search criteria" — "Provide recommended or recently played content" |
| `.url([URL])` | An array — URLs from the request, from **URLs you donated to the Spotlight index**, or from onscreen context |
| `init(criteria:)` | For tests. `init(criteria:spotlightSearchResults:)` is deprecated ("spotlightSearchResults is no longer used") |

`Criteria` is not frozen: a `switch` without `@unknown default` fails in Swift 6 — `error: switch covers known cases, but 'AudioSearch.Criteria' may have additional unknown values`. Apple's article sample omits it and does not compile in Swift 6 mode.

Apple's sample instead extends the entity's own query (`extension SongQuery: IntentValueQuery { func values(for: AudioSearch) -> [SongEntity] }`); that builds too, and also satisfies `SongEntity`'s resolvability, but returns only one entity type. A union-returning query lets one search return songs and playlists together.

### Indexing

- `IndexedEntity` + `CSSearchableIndex.indexAppEntities(_:)` puts entities in the Spotlight semantic index, so Siri matches by meaning. Keep it current: index on add, update when display-representation properties change, delete on removal; adopt `IndexedEntityQuery` (`reindexEntities(for:indexDescription:)`, `reindexAllEntities(indexDescription:)`) unless Core Spotlight-level reindexing already exists.
- Large, server-side, or fast-changing catalogs: skip indexing those types and rely on the `AudioSearch` query.
- iOS 27 release notes (181763422, under Resolved Issues) describe a 10 MB cumulative limit per `AppEntity` instance, child properties included, with a crash when exceeded. Treat it as a hard ceiling: identifiers in entities, artwork fetched on demand.
- macOS 27 release note (177198033): "If you adopt the Audio App Schema domain, you might have trouble playing your content using Siri. Workaround: Adopt an IntentValueQuery that takes the AudioSearch input, or index your entities in Spotlight."

### Context for Siri beyond search

| Surface | API | Enables |
|---|---|---|
| Now Playing (NowPlaying framework) | `MediaContentRepresentable.appEntityIdentifiers = [EntityIdentifier(for: song), EntityIdentifier(for: artist), EntityIdentifier(for: playlist)]`, most specific first | "Play the live version", "add this to my running playlist" |
| Now Playing (MediaPlayer) | `nowPlayingInfo[MPNowPlayingInfoPropertyAppEntityIdentifiers] = [MPAppEntityIdentifier]`, built with `MPAppEntityIdentifier(entityIdentifier:)` (failable) | Same, for `MPNowPlayingInfoCenter` apps |
| Onscreen | `.userActivity` for the screen's primary item, `.appEntityIdentifier(_:)` per view, `.appEntityIdentifier(forSelectionType:identifier:)` on `List` | "Play the third one" |
| Suggestions | `RelevantEntities.shared.updateEntities(_:for: .audio(.nowPlaying))`; `.audio(.workout)`, `.workout(activityType:)`, `.workout(intensityLevel:)` come from the HealthKit overlay | Now Playing / Fitness media pickers; expire after ~4 weeks without a launch |
| In-app search | `.system.searchInApp` (renamed from `.system.search`) | "Show me running playlists in AppName" in your own search UI |
| Donations | `IntentDonationManager` — donate **UI** interactions only (Siri ones are already known); excess donations may be ignored | App Selection learns the user's preferred audio app |

Entity annotations cannot use `TransientAppEntity` — annotated entities need persistent identifiers. Now Playing annotation code for both frameworks: axiom-media (skills/now-playing.md) (Siri and Now Playing).

### App Shortcuts with a deployment target below 27

An `AppShortcut` for a schema intent can be gated inside `appShortcuts` with `if #available(iOS 27.0, *) { … }`. On Xcode 27A9275 this builds and the exported shortcut carries an iOS 27.0 availability annotation. Older-OS runtime behavior was not measured.

### Build error → fix

| Error text (metadata phase unless noted) | Fix |
|---|---|
| `Missing required property 'X' from AppSchemaEntity 'audio.Y'` + `fixit: var X: T` | Declare it with exactly that type and optionality |
| `AppSchemaEntity 'audio.Y' requires type of property 'X' to be optional` (Xcode 27.2; 27.1: `Required AppSchemaEntity property 'X' must be optional` / `must not be optional`) | Match the table's optionality |
| `AppSchemaEntity 'audio.Y' requires type of property 'X' to be T` (27.2; 27.1: `Property 'X' type does not match required AppSchemaEntity property type 'T'`) | Relationship → your schema entity type; `owner` → the `Person \| String` union |
| `Missing required parameter 'X' from AppSchemaIntent 'audio.Y'` | Add the parameter (names differ: `target` for affinity) |
| `AppSchemaIntent 'audio.Y' requires type of parameter 'X' to be optional` (27.2; 27.1: `Required AppSchemaIntent parameter 'X' must be optional` / `must not be optional`) | `warmupAudioQueueResult`/`queueLocation` optional; `playbackAttributes`/`affinityState` not |
| `… requires type of parameter 'playbackAttributes' to be a set of @AppEnum(schema: .audio.playbackAttributes)` (27.2; 27.1: `Parameter 'playbackAttributes' does not match required AppSchemaIntent parameter of 'Set<Schema<PlaybackAttributes>>'`) | `Set<YourPlaybackAttributes>`, not an array |
| `… requires type of parameter 'audioEntity' to be a @UnionValue with cases limited to the types @AppEntity(schema: .audio.song), …` (27.2; 27.1: `Parameter 'audioEntity' does not match required AppSchemaIntent type 'AudioItemCases:(…)'`) | `@UnionValue` enum whose cases are all Audio-schema entities |
| `AppSchemaIntent 'audio.warmupAudioQueue' requires that 'perform()' must return @AppEntity(schema: .audio.warmupAudioQueueResult)` (27.2; 27.1: `… include a 'ReturnsValue<Schema<WarmupAudioQueueResult>>'`) | Return your warmup result entity |
| `AppSchemaIntent 'audio.recognizeAudio' requires that 'perform()' must return an array of a @UnionValue with cases limited to the types …` (27.2; 27.1: `… include a 'ReturnsValue<Array<AudioItemCases:(…)>>'`) | Return `[AudioItem]` |
| `… requires UnionValue case 'X' to conform to 'IndexedEntity', 'UniqueAppEntity', 'TransientAppEntity', provide a default 'EntityStringQuery', or provide an 'IntentValueQuery'` | See Resolvability |
| `Type 'X' is missing case 'Z' required by AppSchemaEnum 'audio.Y'` (27.2; 27.1: `'X' conforming to 'audio.Y' requires enum case 'Z'`) | Add the case |
| `type 'X' does not conform to protocol 'CaseDisplayRepresentable'` (Swift) | Add `caseDisplayRepresentations` |
| `'self' used before all stored properties are initialized` (Swift, schema entity init) | Assign non-schema properties, including `id`, first |
| `'AudioStartingIntent' is deprecated: renamed to 'AudioPlaybackIntent'` (Swift warning) | Drop the conformance or use `AudioPlaybackIntent` |

## Part 2 — SiriKit Media Intents (Classic Siri)

**Platforms**: iOS, iPadOS, watchOS, tvOS, visionOS; **not macOS** (`API_UNAVAILABLE(macos)`). On watchOS and tvOS this is the only "play X" path — the Audio schemas don't exist there.

### Setup

| Piece | Value |
|---|---|
| Capability | Siri → entitlement `com.apple.developer.siri` |
| `INIntentsSupported` (Info.plist) | `INPlayMediaIntent` (plus `INAddMediaIntent`, `INUpdateMediaAffinityIntent`, `INSearchForMediaIntent` if handled) — Xcode's target General → Supported Intents |
| `INSupportedMediaCategories` | at least one of `INMediaCategoryMusic`, `INMediaCategoryPodcasts`, `INMediaCategoryAudiobooks`, `INMediaCategoryRadio`, `INMediaCategoryVideo`, `INMediaCategoryGeneral` (sound effects, white noise). "To opt in to Siri media control, you must choose at least one category" |
| `NSSiriUsageDescription` | Required — the string shown in the authorization alert |
| `SRResearchDataGeneration` | Optional `NO` — stops SensorKit research apps collecting Face Metrics while your SiriKit app is in use |
| Authorization | `INPreferences.requestSiriAuthorization(_:)` from the iOS app at a moment that explains why |
| Handler location | **In the app** (iOS 14+): `UIApplicationDelegate.application(_:handlerFor:)`; SwiftUI via `@UIApplicationDelegateAdaptor`. **Only invoked in apps that support multiple scenes** (`UIApplicationSupportsMultipleScenes`). Handle playback in the app: an Intents extension is a separate short-lived process with no access to your player |

### Authorization facts

- "Siri can't interact with your app or app extension until the user grants permission." Entitlement and usage string configure the app; neither grants permission.
- The system remembers the answer: repeat `requestSiriAuthorization` calls never prompt again; only Settings reverses it.
- Apple: "Siri and Maps may assist in authorizing your app … when the user first tries to use an intent you support." Don't rely on it — request explicitly (`skills/siri-audio.md`, Build Order 7).
- Apps that only expose Shortcuts-app actions need no authorization.
- `INPreferences.siriAuthorizationStatus()` reports the **SiriKit** grant only. Apple DTS: it "checks the legacy SiriKit authorization status" — it returns `.authorized` even when the separate, TCC-backed App Shortcuts opt-in ("Turn on [App] shortcuts with Siri?") was declined. It is not a readiness check for App Intents.

### Handler

```swift
import Intents
import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, handlerFor intent: INIntent) -> Any? {
        intent is INPlayMediaIntent ? PlayMediaHandler() : nil
    }
}

final class PlayMediaHandler: NSObject, INPlayMediaIntentHandling {
    func resolveMediaItems(for intent: INPlayMediaIntent) async -> [INPlayMediaMediaItemResolutionResult] {
        if let items = intent.mediaItems, !items.isEmpty {
            return INPlayMediaMediaItemResolutionResult.successes(with: items)
        }
        let matches = await MediaCatalog.search(intent.mediaSearch)   // nil search = "play music in AppName"
        guard !matches.isEmpty else { return [.unsupported()] }
        return INPlayMediaMediaItemResolutionResult.successes(with: matches)
    }

    func handle(intent: INPlayMediaIntent) async -> INPlayMediaIntentResponse {
        guard let item = intent.mediaItems?.first, let id = item.identifier else {
            return INPlayMediaIntentResponse(code: .failure, userActivity: nil)
        }
        await MediaCatalog.play(id, shuffled: intent.playShuffled ?? false,
                                repeatMode: intent.playbackRepeatMode, queue: intent.playbackQueueLocation)
        return INPlayMediaIntentResponse(code: .success, userActivity: nil)
    }
}
```

### What Siri sends (`INMediaSearch`)

Apple's measured traffic (WWDC 2020-10060): more than half of requests are generic ("play AppName", "play music on AppName") — `mediaSearch` is nil or only `mediaType == .music`; ~30% carry only `mediaName` (could be any type, so search broadly); ~5% add `artistName`; ~5% are playlists (`mediaType == .playlist`). Those four shapes are >90% of traffic. Other fields: `albumName`, `genreNames`, `moodNames`, `releaseDate`, `reference` (`.currentlyPlaying`, `.my`), `sortOrder`, `mediaIdentifier`. Intent fields: `playShuffled`, `playbackRepeatMode`, `playbackQueueLocation` (`.now/.next/.later`), `playbackSpeed`, `resumePlayback`.

### Making the classic path work well

- **App Selection** (Siri picks your app without its name): donate an `INInteraction` wrapping `INPlayMediaIntent` each time playback starts in your UI (donate the playlist/station, not each song); delete donations for removed media with `INInteraction.delete(with:)` — never `deleteAll` casually.
- `INMediaUserContext` at launch: `numberOfLibraryItems`, `subscriptionStatus`, then `becomeCurrent()`.
- Spotlight items with `CSSearchableItemAttributeSet(contentType: .audio)` (title, artist, album, genre, playCount, lastUsedDate); store the index with `.completeUntilFirstUserAuthentication` so it's readable while your app isn't running. `deleteAllSearchableItems` also deletes every donated `INInteraction` — delete by domain instead.
- Vocabulary: `AppIntentVocabulary.plist` (global) and `INVocabulary` (per-user: playlist names, unusual spellings, numbers).
- Lock Screen / Control Center audio suggestions require a customized Play Media system intent (`.intentdefinition`) whose Supported Combinations include `mediaContainer` alone.
- Related intents: `INAddMediaIntent` (add to library/playlist), `INUpdateMediaAffinityIntent` (like/dislike), `INSearchForMediaIntent` (Spotlight "listen on" suggestions for an artist).

## Part 3 — Now Playing Commands (Both Siris)

Siri sends "pause", "next track", "skip ahead 30 seconds", "play it slower" to the same command handlers as Control Center and CarPlay buttons — `MPRemoteCommandCenter` targets, or on 27 the NowPlaying framework's `MediaCommand` closures — no SiriKit, no authorization. Answers to "what song/band/album is this?" come from the published title/artist/album: `MPNowPlayingInfoCenter`, or the `MediaSession` content. An app uses one of the two APIs for local playback, never both (undefined behavior). Not supporting a command: don't register it (Siri explains gracefully), disable it temporarily (e.g. no skipping during an ad), or fail it (generic error). `changeShuffleMode`/`changeRepeatMode` toggle modes on the current queue; starting playback shuffled is `INPlayMediaIntent`/`playAudio`. Implementation: axiom-media (skills/now-playing.md).

## Resources

**WWDC**: 2026-343, 2026-240, 2026-345, 2026-312, 2020-10060

**Docs**: /appintents/app-schema-domain-audio, /appintents/integrating-your-music-app-with-apple-intelligence, /mediaintents/responding-to-audio-search-and-playback-requests, /mediaintents/audiosearch, /appintents/intentvaluequery, /appintents/relevantentities, /sirikit/improving-siri-media-interactions-and-app-selection, /sirikit/requesting-authorization-to-use-siri, /sirikit/dispatching-intents-to-handlers, /intents/inplaymediaintent

**Skills**: skills/siri-audio.md, skills/siri-audio-diag.md, skills/app-intents-ref.md, skills/core-spotlight-ref.md, axiom-media (skills/now-playing.md)
