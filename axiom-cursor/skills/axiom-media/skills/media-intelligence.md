# Media Intelligence (On-Device Face Grouping & Video Analysis) `OS27`

`import MediaIntelligence` — a new framework (iOS 27, macOS 27, tvOS 27, visionOS 27 — **not** watchOS) that runs two on-device media-analysis engines over photo and video assets you supply by URL. Everything is on-device: the media never leaves the device, and you need no Vision or ML expertise.

Two independent engines:
- **`FaceGroupAnalyzer`** — clusters faces across a collection of images into persistent **entities** (one entity ≈ one person), maintained in a working directory you own. This is for building a "People"-style index over a library *you* manage.
- **`VideoAnalyzer`** — analyzes a video for **highlights** (notable moments + intensity) and a **key frame** (the single best representative frame — seek there or extract a thumbnail).

## When to Use

- Build a faces/People view in a third-party photo manager — group, fetch, and persist face↔person associations across a large asset collection (`FaceGroupAnalyzer`)
- Auto-pick a representative thumbnail or build a highlight reel / Memories-style montage from a video (`VideoAnalyzer`)

**Not the same as these neighbors:**

| If you want… | Use instead |
|---|---|
| To detect *where* faces are in a single image (bounding boxes, landmarks) | Vision — `DetectFaceRectanglesRequest` (`/skill axiom-vision`). MediaIntelligence *groups identities across many assets*; it does not replace per-image detection. |
| The system Photos "People" album | PhotoKit — that album is system-owned. `FaceGroupAnalyzer` builds *your own* index over assets you manage (`skills/photo-library.md`). |
| To identify a song / match audio | ShazamKit (`skills/shazamkit.md`); for tempo/key/structure, `skills/music-understanding.md`. |

## FaceGroupAnalyzer — Quick Start

`FaceGroupAnalyzer` is a persistent `Sendable` class. You give it a **working directory** (a URL it owns and writes to); the grouping index survives across launches. All work is `async` and surfaced as `AsyncSequence`s.

```swift
import MediaIntelligence

@available(anyAppleOS 27, *) @available(watchOS, unavailable)
func indexFaces(in imageURLs: [URL]) async throws {
    let workingDir = URL.applicationSupportDirectory.appending(path: "FaceIndex")
    // Must already exist — init throws MediaIntelligenceError.workingDirectory otherwise.
    try FileManager.default.createDirectory(at: workingDir, withIntermediateDirectories: true)
    let analyzer = try FaceGroupAnalyzer(workingDirectory: workingDir)

    // IDs must be unique across the library and stable across launches —
    // filenames only work for a flat directory; prefer your own asset identifiers.
    let assets = imageURLs.map { url in
        MediaIntelligenceImageAsset(id: .init(url.lastPathComponent), kind: .url(url))
    }

    // Insert (or re-insert) assets; faces stream back per asset as they're found.
    for try await (assetID, faces) in try await analyzer.insertOrUpdateAssets(assets) {
        print("\(assetID.rawValue): \(faces.count) face(s)")
    }

    // Recompute groupings after a batch of inserts/deletes.
    try await analyzer.update()
}
```

`MediaIntelligenceImageAsset` is your handle to one image: an `id` (`MediaIntelligenceImageAsset.ID`, a `String`-backed identifier you assign and reuse) and a `kind` (currently `.url(URL)`).

### Lifecycle & state

`FaceGroupAnalyzer.State` tells you whether the index reflects the current assets:

| State | Meaning |
|---|---|
| `.ready` | Groupings are up to date |
| `.stale` | Assets changed since the last `update()` — call `update()` to recompute |
| `.updating` | An `update()` is in progress |

```swift
if await analyzer.state == .stale {
    // update(subprogress:) reports to a parent Progress; defaults to nil.
    // Returns immediately if the index is already up to date.
    try await analyzer.update()
}
```

After mutating the set, call `update()` to refresh entity groupings. Read `state` (an `async` property) before relying on results.

### Querying the index

Every accessor is an `AsyncSequence` (or returns one). An **entity** is a discovered person; a **face** has `bounds` (a **normalized** `CGRect` in its source image: 0.0 at the top-left to 1.0 at the bottom-right on each axis — top-left origin, *not* Vision's lower-left convention), an `assetID`, and an `entityID` (`nil` until grouped).

```swift
// All discovered people:
for try await entity in analyzer.allEntities {
    // All faces belonging to this person:
    for try await (entityID, faces) in try analyzer.fetchFaces(for: [entity.id]) {
        print("Person \(entityID.rawValue): \(faces.count) faces")
    }
}

// All faces, regardless of grouping:
for try await face in analyzer.allFaces {
    print(face.bounds, face.entityID?.rawValue ?? "ungrouped")
}
```

Other accessors: `allAssetIDs`, `allAssetIDsByEntityID`, `allFacesByEntityID`, plus `fetchFaces(_:)` (by face ID), `fetchFaces(in:)` (by asset), and `fetchAssetIDs(for:)` (by entity). `Face` is `Codable` — persist or export results directly.

`identifyFaces(in:)` recognizes faces in new images against the existing gallery **without modifying the analyzer's data** — the same per-asset `(assetID, faces)` stream as `insertOrUpdateAssets(_:)`, but nothing is stored: each face's `entityID` is the matched known entity, or `nil` if no match.

### Removing assets & cleanup

```swift
try await analyzer.deleteAssets([assetID])          // remove specific assets
try await analyzer.deleteAllAssets()                // clear the index, keep the directory
try await FaceGroupAnalyzer.purge(workingDirectory: workingDir)  // delete the store entirely
```

## VideoAnalyzer — Quick Start

`VideoAnalyzer` is a shared singleton (`VideoAnalyzer.shared`). Its `analyze(_:for:)` takes a video asset and a **variadic list of requests**, and returns one value per request (in order) — each an independent `Swift.Result` whose success payload is that request's typed result:

```swift
import MediaIntelligence
import CoreMedia

@available(anyAppleOS 27, *) @available(watchOS, unavailable)
func analyze(videoURL: URL) async throws {
    let asset = MediaIntelligenceVideoAsset(id: .init("clip-1"), kind: .url(videoURL))

    let (highlightResult, keyFrameResult) = try await VideoAnalyzer.shared.analyze(
        asset,
        for: HighlightAnalysisRequest(), KeyFrameAnalysisRequest()
    )

    if case .success(let r) = highlightResult {
        for (range, level) in r.levels {           // [(timeRange: CMTimeRange, level: Float)]
            print("highlight at \(range.start.seconds)s, intensity \(level)")
        }
        let moments: [CMTimeRange] = r.highlights   // the notable ranges
        _ = moments
    }
    if case .success(let r) = keyFrameResult {
        let thumbnailTime: CMTime = r.timestamp     // best single representative frame
        _ = thumbnailTime
    }
}
```

| Request | `Result` fields |
|---|---|
| `HighlightAnalysisRequest` | `highlights: [CMTimeRange]` (notable moments), `levels: [(timeRange: CMTimeRange, level: Float)]` (intensity per range) |
| `KeyFrameAnalysisRequest` | `timestamp: CMTime` (representative frame to extract a thumbnail at) |

The request/result pair conforms to `VideoAnalyzer.Request`/`VideoAnalyzer.Result`, so a single `analyze(_:for:)` call can mix request types and each result is typed to its request.

## Caveats

- **The Simulator can't run analysis in the 27 betas** ("Can't create context") — test on a physical device, and gate Simulator builds with `#if targetEnvironment(simulator)` if the code path must still run there.
- **The working directory is the analyzer's, not yours.** It must exist before `init` (create it with `FileManager`), never edit its contents by hand, and keep your own data — user-assigned person names, favorites — outside it, or `purge` takes them with it.
- **Asset IDs must be unique across the library and stable across launches.** Re-inserting an existing ID replaces that asset's face data — colliding IDs silently overwrite each other; a fresh ID re-imports the image as a new asset, so random per-run IDs re-ingest the whole library on every launch.
- **Entities are clusters, not verified identities.** No grouping-confidence value is exposed; one person can split across entities, and similar faces can merge. Layer user naming/correction on top rather than trusting groupings blind.

## Errors

`MediaIntelligenceError` (a `LocalizedError`, with `errorDescription`):

| Case | Meaning |
|---|---|
| `.workingDirectory` | The working directory doesn't exist or isn't accessible — create it before `init(workingDirectory:)` |
| `.mediaProcessing` | An asset could not be decoded / processed |
| `.faceGroupProcessing` | Face grouping failed |
| `.resultFetching` | A query could not be served |

## Resources

**Docs**: /mediaintelligence

**Skills**: vision-framework, vision-ref, photo-library, shazamkit, music-understanding
