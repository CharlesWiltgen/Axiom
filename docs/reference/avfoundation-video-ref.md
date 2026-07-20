---
name: avfoundation-video-ref
description: AVFoundation video & media-engine APIs — AVAssetWriter/AVAssetExportSession, the concurrency-native sample-buffer Receiver pipeline, iOS 27 resumable export, segment-based writing, Apple Log 2, and the Swift-only deprecations
---

# AVFoundation Video & Media-Engine Reference

API reference for AVFoundation's video write / export / render engine — the companion to the audio-focused [AVFoundation](/reference/avfoundation-ref) reference. Covers the async writing and export APIs, the genuinely new iOS 27 capabilities, and the Swift-only deprecations that retire the old callback/KVO surface.

## When to Use This Reference

Use this reference when:
- Writing or exporting video with `AVAssetWriter` or `AVAssetExportSession`
- Migrating off the Swift-deprecated export/write callbacks (`exportAsynchronously`, `startWriting`, `progress`, `cancelExport`)
- Adopting the concurrency-native sample-buffer `Receiver` pipeline
- Adding iOS 27 resumable export or segment-based writing
- Capturing in Apple Log / Apple Log 2, or detaching playback from system audio
- Driving simulator/device state from CI (see also [Device Control](/reference/device-control-ref) for Device Hub, `devicectl`, and `simctl`)

## Example Prompts

Questions you can ask Claude that draw from this reference:

- "How do I migrate off `exportAsynchronously` in Swift 6?"
- "What replaces `AVAssetWriter.startWriting()` in iOS 27?"
- "How does resumable export work with `configureForResumableExport`?"
- "Show me the segment-based writing flow with `AVAssetWritingPlanner`."
- "How do I enqueue sample buffers with backpressure on the new `Receiver`?"
- "How do I record in Apple Log 2?"
- "Why did my processed frame lose its colour tagging?"
- "How do I copy attachments from a source pixel buffer to a destination?"

## What's Covered

### Writing & export engine (iOS 26 baseline)

These predate iOS 27 — they're the *targets* of the iOS 27 Swift deprecations, and they work on an iOS 26 (or older) deployment floor, so migrating to them needs no availability gate.

- `AVAssetWriter.start()`, `inputReceiver(for:)`, `AVAssetWriterInput.SampleBufferReceiver`
- `AVAssetExportSession.export(to:as:)` (async), `states(updateInterval:)` (AsyncSequence)

### iOS 27 additions

- **Resumable export** – `AVAssetExportSession.configureForResumableExport()`, `AVAssetExportSessionResumptionState`
- **Segment-based writing** – `AVAssetWritingPlanner` (`init(directoryForTemporaryFiles:)`, `plan(_:segmentHandler:)`, `executePlan()`), `AVAssetVideoTrackPlan`
- **Concurrency-native rendering** – `AVSampleBufferVideoRenderer.Receiver` (and audio mirror): `sampleBufferReceiver(adding:)` on `AVSampleBufferRenderSynchronizer`, `enqueue(_:)` → `EnqueueResult`, `renderingEventsAfterFinishedEnqueuing`
- **Apple Log 2** – `AVVideoLogTransferFunctionKey`, `AVVideoLogTransferFunction_AppleLog` / `_AppleLog2`
- **Typed buffer attachments** – `CVAttachmentAccess` / `CVAttachmentContainer`, `propagate(from:)`, `copy()`, `attachedMode(of:)`, `CVPixelBufferAttachmentKeyDefinitions` and `CMSampleBufferAttachmentKeyDefinitions` — replacing untyped `CMSetAttachment` / `kCVImageBuffer*` keys (Swift-native buffer types only)
- **Detach playback from system audio** – `AVPlayer.setDisconnectedFromSystemAudio(_:)` (iOS/tvOS/watchOS/visionOS 27, not macOS)

### Swift-only deprecations → migration

The old callback/KVO surface is deprecated in Swift only (ObjC unaffected): `exportAsynchronously` (iOS 18), `progress` / `cancelExport` / `startWriting` / per-input append (iOS 27) — each with its async replacement.

### Concurrency posture

The media engine is `async`- and `Sendable`-first without broad `@MainActor` isolation; the async append/enqueue entry points are `nonisolated(nonsending)`.

## Documentation Scope

This page documents the `avfoundation-video-ref` skill. It is a **reference skill** — a comprehensive API guide without mandatory workflows.

- For AVFoundation **audio** (AVAudioSession, AVAudioEngine, spatial audio), see [AVFoundation](/reference/avfoundation-ref)
- For the unified `devicectl` device/simulator inventory and the Device Hub workflow, see axiom-build
- For Swift 6 `async`/`Sendable` patterns underlying these APIs, see [Swift Concurrency](/skills/concurrency/)

## Related Resources

- [AVFoundation (audio)](/reference/avfoundation-ref) – audio session, engine, spatial audio
- [Camera Capture](/reference/camera-capture-ref) – AVCaptureSession and recording
- [WWDC 2026/256](https://developer.apple.com/videos/play/wwdc2026/256/) – AVFoundation updates
