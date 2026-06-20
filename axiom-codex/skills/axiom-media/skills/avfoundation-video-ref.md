
# AVFoundation Video & Media-Engine Reference

Companion to `avfoundation-ref.md` (which is audio-only). Covers AVFoundation's async video write / export / render engine, the genuinely new iOS 27 capabilities, and the Swift-only deprecations that retire the old callback/KVO surface. Signatures verified against the iPhoneOS 26 and 27 SDKs (Xcode 26.6 / 27.0).

**Availability is per-section — read the tags.** The async write/export engine (`start()`, `inputReceiver(for:)`, `export(to:as:)`, `states(updateInterval:)`) is an iOS 13–26 baseline, NOT new in 27. Only resumable export, the writing planner, the renderer `Receiver` pipeline, Apple Log 2, and audio-detach are `OS27`. New-in-27 types are watchOS-unavailable unless noted.

## Quick Reference

| API | Availability | Note |
|-----|-----|------|
| `AVAssetWriter.start() throws` | iOS 26 | replaces Swift-deprecated `startWriting()` |
| `AVAssetWriter.inputReceiver(for:)` → `await receiver.append(_:)` | iOS 26 | replaces per-input `append`/adaptor |
| `AVAssetExportSession.export(to:as:) async throws` | iOS 13 | replaces `exportAsynchronously` |
| `AVAssetExportSession.states(updateInterval:)` | iOS 18 | AsyncSequence; replaces `progress` KVO |
| `configureForResumableExport()` + `ResumptionState` | `OS27` | resume a partial export |
| `AVAssetWritingPlanner` + `AVAssetVideoTrackPlan` | `OS27` | segment-based writing |
| `AVSampleBufferVideoRenderer.Receiver` enqueue pipeline | `OS27` | async enqueue with backpressure |
| `AVVideoLogTransferFunctionKey` (Apple Log / Log 2) | `OS27` | capture log color |
| `AVPlayer.setDisconnectedFromSystemAudio(_:)` | `OS27` (not macOS) | detach playback audio |

## The async write/export engine (iOS 26 baseline — not new in 27)

These shipped before iOS 27. They matter here because iOS 27 **deprecates their predecessors in Swift** (next section) — but the replacements work on your iOS 26 (or older) deployment floor, so migrating off the deprecated calls needs **no `@available` gate**.

```swift
// Writing — start() throws (iOS 26), receiver-based append (iOS 26):
try writer.start()                              // was: writer.startWriting() -> Bool
let receiver = writer.inputReceiver(for: input) // AVAssetWriterInput.SampleBufferReceiver
try await receiver.append(readySampleBuffer)    // CMReadySampleBuffer<…>; nonisolated(nonsending)
// receiver.appendImmediately(_:) throws -> Bool   // non-async fast path

// Exporting — export(to:as:) async (iOS 13), states stream (iOS 18):
let monitor = Task {
    for await state in session.states(updateInterval: 0.5) { _ = state }  // AVAssetExportSession.State
}
try await session.export(to: url, as: .mp4)
monitor.cancel()
```

`startSessionAtSourceTime:` / `endSessionAtSourceTime:` are **not** deprecated and still bound a writing session. `inputReceiverRequestingMultiPass(for:)` returns `(SampleBufferReceiver, MultiPassController)` for multi-pass encodes.

## Swift-only deprecations → migration

Every row is a Swift-only deprecation (`#if __swift__`): ObjC callers are unaffected; Swift callers get a warning. The replacements all predate iOS 27, so this migration is safe on an iOS 26 floor.

| Deprecated (Swift) | Since | Replacement |
|------|------|------|
| `AVAssetExportSession.exportAsynchronously(completionHandler:)` | iOS 18 | `export(to:as:) async throws` |
| `AVAssetExportSession.progress` | iOS 27 | `states(updateInterval:)` |
| `AVAssetExportSession.cancelExport()` | iOS 27 | `Task.cancel()` |
| `AVAssetWriter.startWriting()` | iOS 27 | `start()` |
| per-input `append(_:)` / pixel-buffer adaptor path | iOS 27 | `AVAssetWriter.inputReceiver(for:)` |

## NEW in iOS 27

### Resumable export (`OS27`)

```swift
@available(iOS 27, *)
func resume(_ session: AVAssetExportSession, to url: URL) async throws {
    let state = await session.configureForResumableExport()   // async, NON-throwing
    _ = state                                                 // AVAssetExportSession.ResumptionState
    try await session.export(to: url, as: .mp4)               // resumes rather than restarting
}
```

`configureForResumableExport() async -> AVAssetExportSession.ResumptionState` lets an interrupted export pick up where it left off instead of re-encoding from zero.

### Segment-based writing: `AVAssetWritingPlanner` (`OS27`)

The planner is constructed with a temp directory; the segment shape lives on `AVAssetVideoTrackPlan`; `plan(_:segmentHandler:)` drives generation and `executePlan()` assembles the result.

```swift
@available(iOS 27, *)
func writeSegments(_ trackID: CMPersistentTrackID,
                   _ segmentConfigs: [AVPlannedVideoSegmentConfiguration],
                   tmp: URL) async throws -> AVComposition {
    let planner = try AVAssetWritingPlanner(directoryForTemporaryFiles: tmp)
    let trackPlan = AVAssetVideoTrackPlan(
        videoCodecType: .hevc,
        encoderSpecification: nil,
        mediaType: .video,
        segmentConfigurations: segmentConfigs,
        assemblyTrackID: trackID)
    planner.plan(trackPlan) { request in        // @Sendable (AVPlannedSegmentWritingRequest) async throws -> SegmentResult
        // …write the requested segment…
        return .success
    }
    return try await planner.executePlan()      // -> AVComposition
}
```

`AVAssetWritingPlanner.segmentBoundaryGuidelinesForVideo(codecType:encoderSpecification:)` returns guidance for choosing cut points.

### Concurrency-native rendering: sample-buffer `Receiver` (`OS27`)

An `AVSampleBufferRenderSynchronizer` vends a `Receiver` for a renderer; the receiver's enqueue is `async` and returns an `EnqueueResult`, so backpressure is explicit rather than a silent drop. `AVSampleBufferAudioRenderer` has a parallel API.

```swift
@available(iOS 27, *)
func feed(_ synchronizer: AVSampleBufferRenderSynchronizer,
          _ renderer: AVSampleBufferVideoRenderer,
          _ buffer: CMReadySampleBuffer<CMSampleBuffer.DynamicContent>) async throws {
    let receiver = synchronizer.sampleBufferReceiver(adding: renderer)   // -> Receiver (sending)
    let result = try await receiver.enqueue(buffer)                      // -> EnqueueResult; nonisolated(nonsending)
    _ = result
    for await event in receiver.renderingEventsAfterFinishedEnqueuing { _ = event }  // RenderingEvent
    _ = await synchronizer.removeReceiver(receiver: receiver, at: .zero) // async -> Bool
}
```

`receiver.enqueueImmediately(_:) -> EnqueueResult` is the synchronous variant. `sampleBufferReceiver(adding:)` / `removeReceiver` live on `AVSampleBufferRenderSynchronizer`; the audio overload uses the unlabeled `removeReceiver(_:at:)` form.

### Apple Log 2 capture color (`OS27`)

```swift
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.hevc,
    AVVideoLogTransferFunctionKey: AVVideoLogTransferFunction_AppleLog2,  // or _AppleLog
]
```

Values: `AVVideoLogTransferFunction_AppleLog`, `AVVideoLogTransferFunction_AppleLog2`.

### Detach playback from system audio (`OS27`, not macOS)

`@available(iOS 27, tvOS 27, watchOS 27, visionOS 27, *)`, `@available(macOS, unavailable)`, `@available(macCatalyst, unavailable)` — note the inverse platform set (watchOS yes, macOS/Catalyst no):

```swift
player.setDisconnectedFromSystemAudio(true) { /* completion */ }
let detached = player.disconnectedFromSystemAudio   // Bool, nonisolated
```

## Concurrency posture

AVFoundation's media engine is `async`- and `Sendable`-first **without** broad `@MainActor` isolation. The async append/enqueue entry points are `nonisolated(nonsending)` — they run on the caller's executor, integrating into actor-isolated code without forcing a hop; ownership crosses boundaries via `sending` parameters. In Swift 6 code prefer the async forms over the deprecated callback/KVO surface.

## Resources

**WWDC**: 2026-256

**Docs**: /avfoundation/avassetexportsession, /avfoundation/avassetwriter, /avfoundation/avassetwritingplanner, /avfoundation/avsamplebuffervideorenderer

**Skills**: avfoundation-ref (audio), camera-capture-ref, axiom-concurrency (Swift 6 async/Sendable)
