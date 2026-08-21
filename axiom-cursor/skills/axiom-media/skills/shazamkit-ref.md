
# ShazamKit API Reference

## Overview

ShazamKit provides audio recognition against Shazam's music catalog and custom audio catalogs. The framework covers matching, signature generation, catalog management, and library integration.

For decision trees, setup checklist, and best practices, see the **shazamkit** discipline skill.

**Platform**: iOS 15+, iPadOS 15+, macOS 12+, tvOS 15+, watchOS 8+, visionOS 1+

---

# Part 1: SHManagedSession (iOS 17+)

A managed session that handles recording and matching captured sound automatically. This is the modern, recommended path for microphone-based recognition.

## Initialization

```swift
init()                              // Matches against Shazam catalog
init(catalog: SHCatalog)            // Matches against custom catalog
```

## Matching

```swift
func result() async -> SHSession.Result           // Single match attempt
var results: SHManagedSession.Results             // AsyncSequence for continuous matching
```

## Lifecycle

```swift
func prepare() async                // Preallocate resources + start prerecording
func cancel()                       // Stop recording + cancel current match
```

## State (Observable)

```swift
var state: SHManagedSession.State   // Current session state
```

`SHManagedSession` conforms to `Observable` (iOS 17+). SwiftUI views refresh automatically on state changes.

Conforms to `Sendable` as of iOS 18.

---

# Part 2: SHManagedSession.State

```swift
@frozen enum State
```

| Case | Meaning |
|------|---------|
| `.idle` | Not recording or matching |
| `.prerecording` | Prepared, recording in anticipation of match |
| `.matching` | Actively making match attempts |

---

# Part 3: SHSession (iOS 15+)

Lower-level session for matching audio buffers or signatures against catalogs.

## Initialization

```swift
init()                              // Matches against Shazam catalog
init(catalog: SHCatalog)            // Matches against custom catalog
```

## Matching Methods

```swift
func match(_ signature: SHSignature)                        // Match a complete signature
func matchStreamingBuffer(_ buffer: AVAudioPCMBuffer, at time: AVAudioTime?)  // Match streaming audio
```

When using `matchStreamingBuffer`, include the `time` parameter when available — the session validates contiguous audio.

## Delegate

```swift
var delegate: (any SHSessionDelegate)?
```

## AsyncSequence (iOS 16+)

```swift
var results: SHSession.Results     // AsyncSequence of SHSession.Result
```

## Audio Format Support

- iOS 15-16: Specific PCM formats and sample rates required
- iOS 17+: Most PCM format settings accepted; automatic conversion

## Multiple Matches (iOS 17+)

When a query matches multiple reference signatures in a custom catalog, all matches are returned sorted by quality. Use metadata annotation to distinguish between them.

---

# Part 4: SHSession.Result (iOS 16+)

```swift
@frozen enum Result: Sendable
```

| Case | Associated Value |
|------|-----------------|
| `.match(SHMatch)` | Matched media items found |
| `.noMatch(SHSignature)` | No match for this signature |
| `.error(any Error, SHSignature)` | Error during matching |

---

# Part 5: SHSessionDelegate (iOS 15+)

```swift
protocol SHSessionDelegate: NSObjectProtocol
```

### Methods

```swift
optional func session(_ session: SHSession, didFind match: SHMatch)
optional func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: (any Error)?)
```

---

# Part 6: SHMatch (iOS 15+)

Contains the results of a successful match.

## Properties

```swift
var mediaItems: [SHMatchedMediaItem]    // Matched items (multiple possible)
var querySignature: SHSignature         // The query that produced this match
```

---

# Part 7: SHMediaItem (iOS 15+)

Metadata associated with a reference signature.

## Initialization

```swift
init(properties: [SHMediaItemProperty : any NSSecureCoding & NSObjectProtocol])
```

## Predefined Properties

| Property | Type | Description |
|----------|------|-------------|
| `.title` | String | Song/content title |
| `.subtitle` | String | Subtitle |
| `.artist` | String | Artist name |
| `.artworkURL` | URL | Album art URL |
| `.videoURL` | URL | Video URL |
| `.genres` | [String] | Genre list |
| `.explicitContent` | Bool | Explicit content flag |
| `.isrc` | String | International Standard Recording Code |
| `.appleMusicID` | String | Apple Music identifier |
| `.appleMusicURL` | URL | Apple Music URL |
| `.webURL` | URL | Web URL for sharing |
| `.shazamID` | String | Shazam catalog identifier |
| `.creationDate` | Date | When item was created |

## Timed Content Properties (iOS 16+)

| Property | Type | Description |
|----------|------|-------------|
| `.timeRanges` | [Range\<TimeInterval\>] | When this item is active in the reference |
| `.frequencySkewRanges` | [Range\<Float\>] | Frequency skew ranges for differentiation |

## Custom Properties

Add custom metadata using `SHMediaItemProperty` extensions:

```swift
extension SHMediaItemProperty {
    static let episodeNumber = SHMediaItemProperty("episodeNumber")
    static let teacher = SHMediaItemProperty("teacher")
}

let item = SHMediaItem(properties: [
    .title: "Episode 3",
    .episodeNumber: 3,
    .teacher: "Neil"
])
```

Custom property values must be valid property list types.

## Fetching by Shazam ID

```swift
class func fetch(shazamID: String, completionHandler: @escaping (SHMediaItem?, (any Error)?) -> Void)
```

Requests a media item from the Shazam catalog by its Shazam ID.

## Subscript Access

```swift
subscript(key: SHMediaItemProperty) -> Any { get }
```

## Protocols

NSSecureCoding, NSCopying, NSObjectProtocol, Identifiable (iOS 17+), Sendable

---

# Part 8: SHMatchedMediaItem (iOS 15+)

Subclass of `SHMediaItem` with match-specific information. Only created by the framework from successful matches.

## Additional Properties

| Property | Type | Description |
|----------|------|-------------|
| `.matchOffset` | TimeInterval | Where in the reference the match occurred |
| `.predictedCurrentMatchOffset` | TimeInterval | Auto-updating position in reference (seconds) |
| `.frequencySkew` | Float | Frequency difference between matched and reference |
| `.confidence` | Float | Match confidence (0.0 to 1.0, where 1.0 is highest) |

`predictedCurrentMatchOffset` updates continuously during streaming matches — use it to sync UI to audio position.

---

# Part 9: SHMediaItemProperty (iOS 15+)

```swift
struct SHMediaItemProperty: RawRepresentable, Hashable, Sendable
```

Predefined property keys for `SHMediaItem`. Extend with custom keys using `init(rawValue:)`.

### All Predefined Keys

`.title`, `.subtitle`, `.artist`, `.artworkURL`, `.videoURL`, `.genres`, `.explicitContent`, `.isrc`, `.appleMusicID`, `.appleMusicURL`, `.webURL`, `.shazamID`, `.creationDate`, `.matchOffset`, `.frequencySkew`, `.confidence`, `.timeRanges`, `.frequencySkewRanges`

---

# Part 10: SHSignature (iOS 15+)

Contains opaque audio fingerprint data.

## Properties

```swift
var duration: TimeInterval          // Duration of audio represented
var dataRepresentation: Data        // Serializable data for storage/transmission
```

## Initialization

```swift
init(dataRepresentation: Data) throws
```

## Slicing

```swift
func slices(from start: TimeInterval, duration: TimeInterval, stride: TimeInterval) -> SHSignature.Slices
```

Returns a sequence of signature segments of the specified duration, stepping by stride from the start offset.

## Protocols

NSSecureCoding, NSCopying, NSObjectProtocol, Sendable

---

# Part 11: SHSignatureGenerator (iOS 15+)

Converts audio into signatures.

## From Buffers

```swift
func append(_ buffer: AVAudioPCMBuffer, at time: AVAudioTime?) throws
func signature() -> SHSignature
```

## From Asset (iOS 16+)

```swift
static func signature(from asset: AVAsset) async throws -> SHSignature
```

Accepts any `AVAsset` with an audio track. Multiple tracks are mixed automatically.

---

# Part 12: SHCatalog (iOS 15+)

Abstract base class for catalogs.

## Properties

```swift
var minimumQuerySignatureDuration: TimeInterval  // Minimum query length needed
var maximumQuerySignatureDuration: TimeInterval  // Maximum useful query length
```

---

# Part 13: SHCustomCatalog (iOS 15+)

Mutable catalog for custom audio matching.

## Adding Content

```swift
func addReferenceSignature(_ signature: SHSignature, representing mediaItems: [SHMediaItem]) throws
```

## Persistence

```swift
func write(to url: URL) throws                  // Save .shazamcatalog file
func add(from url: URL) throws                   // Load/merge from file
```

File extension: `.shazamcatalog`

## Protocols

Sendable

---

# Part 14: SHLibrary (iOS 17+)

User's synced Shazam library. Each app can only read and delete items it has added.

## Access

```swift
static var `default`: SHLibrary
```

## Methods

```swift
func addItems(_ items: [SHMediaItem]) async throws
func removeItems(_ items: [SHMediaItem]) async throws
var items: [SHMediaItem] { get }                    // Observable
```

## Reading Current Items (Non-UI)

```swift
let currentItems = await SHLibrary.default.items
```

## Observable

Conforms to `Observable`. SwiftUI views using `SHLibrary.default.items` update automatically when items change.

## Sync

Items sync across devices via iCloud. Attributed to the app that added them. Visible in Shazam app and Control Center Music Recognition module.

---

# Part 15: SHMediaLibrary (iOS 15+, Legacy)

Legacy write-only access to the user's Shazam library.

## Access

```swift
static var `default`: SHMediaLibrary
```

## Methods

```swift
func add(_ mediaItems: [SHMediaItem], completionHandler: @escaping (Error?) -> Void)
```

## Constraints

- Write-only (no read, no delete)
- Only accepts items with valid Shazam catalog IDs
- End-to-end encrypted, requires two-factor authentication
- No special permission required

---

# Part 16: SHError

```swift
struct SHError: Error
```

## Error Codes (SHError.Code)

### Matching Errors

| Code | Description |
|------|-------------|
| `.matchAttemptFailed` | Match attempt failed |
| `.signatureInvalid` | Invalid signature data |

### Catalog Errors

| Code | Description |
|------|-------------|
| `.customCatalogInvalid` | Catalog data is corrupt or invalid |
| `.customCatalogInvalidURL` | URL for catalog is invalid |

### Signature Errors

| Code | Description |
|------|-------------|
| `.signatureDurationInvalid` | Signature duration too short or long |
| `.audioDiscontinuity` | Gap detected in streaming audio |

### Media Library Errors

| Code | Description |
|------|-------------|
| `.mediaLibrarySyncFailed` | Failed to sync with library |
| `.internalError` | Internal framework error |

### Session Errors

| Code | Description |
|------|-------------|
| `.invalidAudioFormat` | Audio format not supported |
| `.mediaItemFetchFailed` | Failed to fetch media item details |

---

# Part 17: Shazam CLI (macOS 13+)

Command-line tool for building custom catalogs at scale.

## Commands

```bash
# Create signature from media file
shazam signature --input <media-file> --output <signature-file>

# Create custom catalog
shazam custom-catalog create \
    --input <signature-file> \
    --media-items <csv-file> \
    --output <catalog-file>

# Update existing catalog
shazam custom-catalog update \
    --input <signature-file> \
    --media-items <csv-file> \
    --catalog <catalog-file>

# Display catalog contents
shazam custom-catalog display --catalog <catalog-file>

# Add/remove/export signatures and media items
shazam custom-catalog add ...
shazam custom-catalog remove ...
shazam custom-catalog export ...
```

Run `shazam custom-catalog create --help` for CSV header-to-property mapping.

---

# Part 18: Sample Projects

### Building a Custom Catalog and Matching Audio

FoodMath educational app demonstrating custom catalog matching with synced UI content. Uses `SHSession` with delegate pattern.

**Key patterns**: Custom `SHMediaItemProperty` extensions, `predictedCurrentMatchOffset` for time-sync, `SHCustomCatalog` from `.shazamsignature` files.

### ShazamKit Dance Finder with Managed Session

Dance discovery app using `SHManagedSession` for simplified matching. Demonstrates `SHLibrary` read/write/delete and `Observable` SwiftUI integration.

**Key patterns**: `SHManagedSession` result/results, session state in SwiftUI, `SHLibrary.default.items` in `List`, swipe-to-delete with `removeItems`.

---

## Quick Reference

### Class Hierarchy

```
SHCatalog (abstract)
├── SHCustomCatalog (mutable, user-created)
└── (internal Shazam catalog)

SHMediaItem
└── SHMatchedMediaItem (match-specific subclass)

SHSession         → delegate or AsyncSequence
SHManagedSession  → AsyncSequence, Observable, handles recording
```

### Common Patterns

| Task | API |
|------|-----|
| Identify song (iOS 17+) | `SHManagedSession().result()` |
| Continuous recognition | `for await result in session.results` |
| Match custom audio | `SHManagedSession(catalog: custom)` |
| Match signature file | `SHSession().match(signature)` |
| Generate from file | `SHSignatureGenerator.signature(from: asset)` |
| Generate from mic | `generator.append(buffer, at: time)` |
| Add to library | `SHLibrary.default.addItems([item])` |
| Read library | `SHLibrary.default.items` |
| Remove from library | `SHLibrary.default.removeItems([item])` |

### File Extensions

| Extension | Purpose |
|-----------|---------|
| `.shazamsignature` | Audio signature file |
| `.shazamcatalog` | Custom catalog file |

---

## Resources

**WWDC**: 2021-10044, 2021-10045, 2022-10028, 2023-10051

**Docs**: /shazamkit, /shazamkit/shmanagedsession, /shazamkit/shsession, /shazamkit/shcustomcatalog, /shazamkit/shmediaitem, /shazamkit/shlibrary

**Skills**: shazamkit, avfoundation-ref, swift-concurrency
