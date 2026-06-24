
# Screen Capture — ScreenCaptureKit on iOS/iPadOS `OS27`

`import ScreenCaptureKit` — capture the screen (or your own app) as a live video + audio stream, record it to a file, or buffer recent content for instant-replay clips. **New on iOS 27, iPadOS 27, tvOS 27, visionOS 27** (all beta); macOS has had it since 12.3. This is the modern replacement for ReplayKit-style capture.

> **The iOS model is NOT the macOS model.** On macOS you enumerate `SCShareableContent` (displays/windows/apps) and build an `SCContentFilter` programmatically. **On iOS/iPadOS none of that exists** — `SCShareableContent`, `SCDisplay`, `SCWindow`, `SCRunningApplication`, and every `SCContentFilter` initializer are `API_UNAVAILABLE(ios)`. You get a filter **only** from the system **`SCContentSharingPicker`** (user-driven, privacy-preserving). Writing iOS capture from the macOS mental model will not compile.

## When to Use

- Record or live-stream the iPad/iPhone screen — screen recording in your app, screen sharing, broadcasting
- Capture **just your own app's** content (in-app capture) with optional camera/mic overlays
- Buffer the last ~15 s for instant-replay clips

Not the same as:
- **`ImageRenderer`** (SwiftUI, iOS 16+) — rasterizes a view *you* define to a static image/PDF/`CGImage`. It only renders your own view tree; it cannot capture the live screen or other apps. Use it for a snapshot of your own UI, not screen recording.
- **ReplayKit** (`RPScreenRecorder` / broadcast upload extensions) — the pre-27 iOS screen-capture path; still valid for older OS versions and system-wide broadcast.

## The iOS flow

You drive the system picker, receive an `SCContentFilter`, then create and start an `SCStream`. (All signatures below verified against the iPhoneOS 27.0 SDK + a `swiftc` compile.)

```swift
import ScreenCaptureKit
import AVFoundation

@available(iOS 27, *)
final class ScreenCapture: NSObject, SCContentSharingPickerObserver, SCStreamDelegate, SCStreamOutput {
    private var stream: SCStream?

    func start() {
        let picker = SCContentSharingPicker.shared
        guard picker.isAvailable else { return }   // screen recording allowed on this device?
        picker.add(self)                            // NOTE: Swift name is add(_:), not addObserver
        picker.isActive = true                      // required for the system UI to appear
        picker.presentForCurrentApplication()       // in-app capture; or picker.present() for the general picker
    }

    // The user's choice arrives here as a ready-to-use filter.
    func contentSharingPicker(_ picker: SCContentSharingPicker,
                              didUpdateWith filter: SCContentFilter, for stream: SCStream?) {
        Task { await begin(with: filter) }
    }
    func contentSharingPicker(_ p: SCContentSharingPicker, didCancelFor s: SCStream?) {}
    func contentSharingPickerStartDidFailWithError(_ error: any Error) {}

    @available(iOS 27, *)
    func begin(with filter: SCContentFilter) async {
        let config = SCStreamConfiguration()
        config.width = 1080
        config.height = 1920
        config.capturesAudio = true                 // system audio; see SCStreamOutputType.microphone for mic

        let stream = SCStream(filter: filter, configuration: config, delegate: self)
        do {
            // Option A — raw frames as CMSampleBuffers:
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: .global())
            try await stream.startCapture()
            self.stream = stream
        } catch { /* SCStreamError */ }
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sb: CMSampleBuffer, of type: SCStreamOutputType) {
        // type is .screen / .audio / .microphone
    }
    func stream(_ stream: SCStream, didStopWithError error: any Error) {}
}
```

`SCContentSharingPicker` essentials: `.shared` (singleton), `.isAvailable`, `.isActive` (must be `true`), `.add(_:)` / `.remove(_:)`, `.present()` (not tvOS), `.presentForCurrentApplication()` (iOS/visionOS/tvOS — captures only your app), `.present(using:)` for a `SCShareableContentStyle`. iOS-only config knobs: `SCContentSharingPickerConfiguration.showsMicrophoneControl` and `.showsCameraControl` (in-app only) — the macOS mode/exclusion options (`allowedPickerModes`, `excludedWindowIDs`, …) are macOS-only.

## Output options (add to the `SCStream`)

| Output | API | Notes |
|---|---|---|
| Raw frames | `addStreamOutput(_:type:sampleHandlerQueue:)` + `SCStreamOutput` | `CMSampleBuffer`s; `SCStreamOutputType` = `.screen` / `.audio` / `.microphone` |
| Record to file | `addRecordingOutput(_:)` with `SCRecordingOutput(configuration:delegate:)` | `SCRecordingOutputConfiguration.outputURL` (+ `videoCodecType` default H.264, `outputFileType` default MPEG-4). Add **before** `startCapture` to catch the first frame |
| Instant-replay clips | `addClipBufferingOutput(_:)` | rolling ~15 s buffer; export recent clips. Stream must be capturing first |
| Camera video effects | `addVideoEffectOutput(_:)` | **iOS-only**, and only on **in-app** capture (`presentForCurrentApplication`); otherwise `SCStreamErrorNotSupported` |

Record-to-file sketch:

```swift
let cfg = SCRecordingOutputConfiguration()
cfg.outputURL = url                 // e.g. .mp4
cfg.outputFileType = .mp4
let rec = SCRecordingOutput(configuration: cfg, delegate: self)  // SCRecordingOutputDelegate
try stream.addRecordingOutput(rec)  // before startCapture
```

## What's macOS-only (do NOT reach for these on iOS)

`SCShareableContent` and `SCDisplay`/`SCWindow`/`SCRunningApplication` (content enumeration); all `SCContentFilter` initializers; `SCScreenshotManager` (programmatic screenshots); mid-stream `updateConfiguration(_:)` / `updateContentFilter(_:)`; and `SCStreamConfiguration.minimumFrameInterval` / `.pixelFormat` (macOS-only — iOS defaults to the content's native resolution). `SCVideoEffectOutput` is the inverse: **iOS-only**.

## Resources

**Docs**: /screencapturekit, /screencapturekit/sccontentsharingpicker, /screencapturekit/scstream

**Skills**: camera-capture, now-playing, avfoundation-ref
