---
name: media-intelligence
description: On-device face grouping and video highlight/key-frame analysis with the iOS 27 MediaIntelligence framework
skill_type: reference
apple_platforms: iOS 27+, iPadOS 27+, macOS 27+, tvOS 27+, visionOS 27+
---

# Media Intelligence

`import MediaIntelligence` is a new iOS 27 framework that runs two on-device media-analysis engines over photo and video assets you supply by URL. Everything stays on-device — the media never leaves the device, and you need no Vision or ML background.

## When to Use

Use this skill when you're:
- Building a faces / People view in a photo manager — clustering faces into persistent people (entities) across a library you manage
- Auto-picking a representative thumbnail or building a highlight reel from a video
- Persisting and querying face↔person associations across a large asset collection

For detecting *where* a face is in a single image (bounding box, landmarks), or for OCR / segmentation, use the [Vision](/skills/computer-vision/vision) framework instead — MediaIntelligence clusters identities across many assets; it does not replace per-image detection.

## Example Prompts

- "Group faces into people across my photo library on-device in iOS 27."
- "Cluster faces into persons and persist the index across launches."
- "Find the highlight moments in a video and their intensity."
- "Pick the best representative thumbnail frame for a clip."
- "Fetch all the faces belonging to one person in my library."

## What This Skill Provides

- **`FaceGroupAnalyzer`** – a persistent, `Sendable` analyzer backed by a working directory you own; clusters faces into **entities** (people) across image assets
- **Lifecycle & state** – `insertOrUpdateAssets`, `update()`, `deleteAssets`/`deleteAllAssets`/`purge`, and a `State` (`.ready` / `.stale` / `.updating`) telling you when to recompute
- **Query surface** – `allEntities`, `allFaces`, `allAssetIDs`, plus `fetchFaces(for:)` / `fetchFaces(in:)` / `fetchAssetIDs(for:)`, all as `AsyncSequence`s; `Face` is `Codable`
- **`VideoAnalyzer`** – a shared analyzer whose variadic `analyze(_:for:)` runs typed requests: `HighlightAnalysisRequest` (notable ranges + intensity levels) and `KeyFrameAnalysisRequest` (representative-frame timestamp)
- **`MediaIntelligenceError`** – `LocalizedError` cases for working-directory, media-processing, face-grouping, and result-fetching failures

## Related

- [Vision](/skills/computer-vision/vision) – per-image face *detection*, OCR, and segmentation, a different task from identity clustering
- [Photo Library](/skills/integration/photo-library) – PHPicker / PhotosPicker and the asset access MediaIntelligence consumes
- [Music Understanding](/skills/integration/music-understanding) – the on-device *audio* analysis counterpart
