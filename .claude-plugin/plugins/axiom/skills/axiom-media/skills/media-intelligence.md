
# Media Intelligence (On-Device Face Grouping & Video Analysis) `OS27`

`import MediaIntelligence` — a new framework (`OS27`: iOS 27, macOS 27, tvOS 27, visionOS 27 — **not** watchOS) that runs two on-device media-analysis engines over photo and video assets you supply by URL. Everything is on-device: the media never leaves the device, and you need no Vision or ML expertise.

Two independent engines:
- **`FaceGroupAnalyzer`** — clusters faces across a collection of images into persistent **entities** (one entity ≈ one person), maintained in a working directory you own. This is for building a "People"-style index over a library *you* manage.
- **`VideoAnalyzer`** — analyzes a video for **highlights** (notable moments + intensity) and **key frames** (representative thumbnails).

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

@available(iOS 27, macOS 27, tvOS 27, visionOS 27, *)
func indexFaces(in imageURLs: [URL]) async throws {
    let workingDir = URL.applicationSupportDirectory.appending(path: "FaceIndex")
    let analyzer = try FaceGroupAnalyzer(workingDirectory: workingDir)

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
    // Subprogress lets you drive a progress UI; the parameter defaults to nil.
    try await analyzer.update()
}
```

After mutating the set, call `update()` to refresh entity groupings. Read `state` (an `async` property) before relying on results.

### Querying the index

Every accessor is an `AsyncSequence` (or returns one). An **entity** is a discovered person; a **face** has `bounds` (a `CGRect` in its source image), an `assetID`, and an `entityID` (`nil` until grouped).

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

### Removing assets & cleanup

```swift
try await analyzer.deleteAssets([assetID])          // remove specific assets
try await analyzer.deleteAllAssets()                // clear the index, keep the directory
try await FaceGroupAnalyzer.purge(workingDirectory: workingDir)  // delete the store entirely
```

`identifyFaces(in:)` has the same signature as `insertOrUpdateAssets(_:)` — it returns the same per-asset `(assetID, faces)` stream for a set of assets.

## VideoAnalyzer — Quick Start

`VideoAnalyzer` is a shared singleton (`VideoAnalyzer.shared`). Its `analyze(_:for:)` takes a video asset and a **variadic list of requests**, and returns one `Result` per request (in order), each independently success-or-failure:

```swift
import MediaIntelligence
import CoreMedia

@available(iOS 27, macOS 27, tvOS 27, visionOS 27, *)
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

## Errors

`MediaIntelligenceError` (a `LocalizedError`, with `errorDescription`):

| Case | Meaning |
|---|---|
| `.workingDirectory` | The `FaceGroupAnalyzer` working directory could not be created or opened |
| `.mediaProcessing` | An asset could not be decoded / processed |
| `.faceGroupProcessing` | Face grouping failed |
| `.resultFetching` | A query could not be served |

## Resources

**Docs**: /mediaintelligence

**Skills**: vision-framework, vision-ref, photo-library, music-understanding
