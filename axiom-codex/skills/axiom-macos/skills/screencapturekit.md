
# ScreenCaptureKit — Screen Recording & Sharing

ScreenCaptureKit is the modern, GPU-accelerated, privacy-gated framework for capturing macOS screen content — displays, windows, applications, and their audio — as a live stream, a one-shot screenshot, or a recorded file. It replaces the deprecated `CGDisplayStream` and `CGWindowListCreateImage`, and supersedes `AVCaptureScreenInput`.

## Core mental model

Capture is a four-stage pipeline:

1. **Enumerate** — `SCShareableContent` lists the displays, windows, and apps you can capture.
2. **Filter** — `SCContentFilter` narrows that to exactly what to capture (one window, a whole display minus your own app, etc.).
3. **Configure** — `SCStreamConfiguration` sets resolution, frame rate, audio, cursor, color, HDR.
4. **Stream** — `SCStream` (filter + configuration + delegate) delivers `CMSampleBuffer`s to an `SCStreamOutput` on a queue you provide.

Filters and configurations can be swapped **on the fly** without tearing down the stream. For consent, prefer the system `SCContentSharingPicker` (macOS 14+) over building your own selection UI.

## When to Use This Skill

- Building screen sharing, recording, or streaming (conferencing, OBS-style capture, demos)
- Capturing a specific window or display, with or without audio
- Taking a high-quality programmatic screenshot
- Recording screen content straight to a file (macOS 15+)
- Migrating off `CGDisplayStream` / `CGWindowListCreateImage` / `AVCaptureScreenInput`

This file documents the **macOS** surface. ScreenCaptureKit is **no longer macOS-only** — it ships on iOS 27, iPadOS 27, tvOS 27, and visionOS 27 — but the iOS model differs in kind: no `SCShareableContent`, and none of the `SCContentFilter` initializers, so the picker is the entry point. For that, see axiom-media (`skills/screen-capture.md`); ReplayKit (`RPScreenRecorder` / broadcast extensions) remains the path below iOS 27. For the full type/property surface, see `skills/screencapturekit-ref.md`. For sandbox/entitlement details, see `skills/sandbox-and-file-access.md`.

## System Requirements

| API | Availability |
|-----|--------------|
| `SCStream`, `SCShareableContent`, `SCContentFilter`, `SCStreamConfiguration`, `SCStreamOutput` | macOS |
| `SCContentSharingPicker`, `SCScreenshotManager`, Presenter Overlay (`outputVideoEffectDidStart`) | macOS |
| `SCRecordingOutput`, microphone capture (`captureMicrophone`), HDR (`captureDynamicRange`) | macOS 15.0+ |
| Mac Catalyst | 18.2+ |
| iOS / iPadOS | **iOS 27+**, picker-based capture only — see axiom-media (`skills/screen-capture.md`). Use ReplayKit below 27 |

Screen capture requires the user's **Screen Recording** permission (TCC). Without it, `SCShareableContent` returns no shareable content. A background/login-item capturer (VNC, remote desktop) additionally needs the **Persistent Content Capture** entitlement.

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| Porting this file's code to iOS | iOS 27 ships ScreenCaptureKit but without `SCShareableContent` or the `SCContentFilter` initializers | Drive capture from `SCContentSharingPicker` on iOS 27+; ReplayKit below 27 |
| No frames ever arrive | Screen Recording permission not granted | `SCShareableContent` is empty without TCC consent — request it and handle the empty case |
| UI hitches / dropped frames | Heavy work on the sample-handler queue | Pass a dedicated **serial** `DispatchQueue`; copy what you need and return fast |
| Memory balloons or the stream stalls | Holding IOSurface-backed buffers past `queueDepth` | Process and release each `CMSampleBuffer` promptly; tune `queueDepth` |
| Reinventing the consent UI | Misses system integration (Video menu bar, Presenter Overlay) | Use `SCContentSharingPicker` (macOS 14+) |
| Treating idle frames as new content | `.idle` frame status means no new IOSurface | Read `SCStreamFrameInfo.status`; skip `.idle` |
| "Hall of mirrors" recursion | Capturing your own window inside a display filter | Exclude your app in the `SCContentFilter` |

## Part 1 — The capture pipeline

```swift
import ScreenCaptureKit

// 1. Enumerate
let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
guard let display = content.displays.first else { return }

// 2. Filter — capture the display, excluding our own app (avoid the hall of mirrors)
let myApp = content.applications.first { $0.bundleIdentifier == Bundle.main.bundleIdentifier }
let filter = SCContentFilter(display: display,
                             excludingApplications: myApp.map { [$0] } ?? [],
                             exceptingWindows: [])

// 3. Configure
let config = SCStreamConfiguration()
config.width = 1920
config.height = 1080
config.minimumFrameInterval = CMTime(value: 1, timescale: 60)  // 60 fps
config.showsCursor = true
config.capturesAudio = true
config.queueDepth = 5                                           // buffered frames

// 4. Stream
let stream = SCStream(filter: filter, configuration: config, delegate: self)  // self: SCStreamDelegate
try stream.addStreamOutput(self, type: .screen,
                           sampleHandlerQueue: DispatchQueue(label: "capture.video"))
try await stream.startCapture()
```

`SCShareableContent` exposes `.displays` (`SCDisplay`), `.windows` (`SCWindow`), and `.applications` (`SCRunningApplication`), all read-only metadata. **Audio can only be filtered at the application level**, not per-window.

## Part 2 — Get consent right (macOS 14+)

Don't build your own picker. `SCContentSharingPicker` gives you the system selection UI, the Video menu-bar item, Presenter Overlay, and per-stream re-picking for free. It hands you an `SCContentFilter` via an observer callback.

```swift
let picker = SCContentSharingPicker.shared
picker.add(self)                     // self: SCContentSharingPickerObserver
picker.isActive = true               // register so the system includes your app
var pickerConfig = SCContentSharingPickerConfiguration()
pickerConfig.allowedPickerModes = [.singleWindow, .singleApplication, .singleDisplay]
picker.defaultConfiguration = pickerConfig
picker.present()

// Observer callback — you receive a ready-made filter
func contentSharingPicker(_ picker: SCContentSharingPicker,
                          didUpdateWith filter: SCContentFilter,
                          for stream: SCStream?) {
    // create a new stream with `filter`, or `stream?.updateContentFilter(filter)`
}
```

Also implement the cancel and fail callbacks so your stream state stays correct.

## Part 3 — The output callback and threading

Samples arrive on the serial queue you provided. Check the frame status before using a video frame.

```swift
func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
            of type: SCStreamOutputType) {
    switch type {
    case .screen:
        guard let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer,
                  createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let raw = attachments.first?[.status] as? Int,
              let status = SCFrameStatus(rawValue: raw),
              status == .complete else { return }   // skip .idle / .blank / .suspended
        // sampleBuffer is IOSurface-backed — use it now, don't retain it
    case .audio:
        // PCM audio CMSampleBuffer
    default:
        break
    }
}
```

Keep this callback fast. Long work here back-pressures the capture pipeline and drops frames. Never retain video buffers beyond `queueDepth` — they hold IOSurfaces from a fixed pool.

## Part 4 — Hot updates

Change what or how you capture without restarting the stream:

```swift
try await stream.updateConfiguration(newConfig)     // resolution, fps, audio toggle
try await stream.updateContentFilter(newFilter)     // switch window/display/exclusions
```

This is the whole point of the framework's design — adjust quality on the fly (e.g. drop resolution and raise fps when motion increases) instead of stopping and recreating the stream.

## Part 5 — Screenshots (macOS 14+)

For a single frame, skip the stream entirely. `SCScreenshotManager` reuses the same filter + configuration.

```swift
let image = try await SCScreenshotManager.captureImage(contentFilter: filter,
                                                       configuration: config)   // CGImage
// or captureSampleBuffer(contentFilter:configuration:) for a CMSampleBuffer with more pixel formats
```

This replaces `CGWindowListCreateImage` — the window-image options it had now live on `SCStreamConfiguration`, and "windows above ID" enumeration lives on `SCShareableContent`.

## Part 6 — Recording to a file (macOS 15+)

`SCRecordingOutput` records the stream straight to a movie file — no manual `AVAssetWriter` plumbing.

```swift
let recordingConfig = SCRecordingOutputConfiguration()
recordingConfig.outputURL = outputURL
recordingConfig.outputFileType = .mov
let recording = SCRecordingOutput(configuration: recordingConfig, delegate: self)  // SCRecordingOutputDelegate
try stream.addRecordingOutput(recording)
try await stream.startCapture()
// recording.recordedDuration / recording.recordedFileSize while running
```

## Part 7 — Migration

| Deprecated API | Replacement |
|----------------|-------------|
| `CGDisplayStream` | `SCStream` with a display `SCContentFilter` |
| `CGWindowListCreateImage` | `SCScreenshotManager.captureImage(contentFilter:configuration:)` |
| `AVCaptureScreenInput` (superseded, not deprecated) | `SCStream` |
| Manual `AVAssetWriter` for screen recording | `SCRecordingOutput` (macOS 15+) |

## Common Mistakes

- Assuming ScreenCaptureKit is still macOS-only — it ships on iOS 27+, with a picker-first API shape rather than this file's enumerate-then-filter model.
- Not handling the empty `SCShareableContent` case when Screen Recording permission is denied.
- Doing real work (encoding, disk I/O, UI updates) directly on the sample-handler queue.
- Retaining IOSurface-backed video buffers — exhausts the pool and stalls capture.
- Ignoring `SCStreamFrameInfo.status` and processing `.idle` frames as if they were new.
- Capturing your own app's window inside a display filter (hall of mirrors) instead of excluding it.
- Hand-rolling a selection UI instead of `SCContentSharingPicker`.

## Resources

**WWDC**: 2022-10156, 2022-10155, 2023-10136, 2024-10088

**Docs**: /screencapturekit, /screencapturekit/scstream, /screencapturekit/scshareablecontent, /screencapturekit/sccontentfilter, /screencapturekit/scstreamconfiguration, /screencapturekit/sccontentsharingpicker, /screencapturekit/scscreenshotmanager, /screencapturekit/screcordingoutput

**Skills**: skills/screencapturekit-ref.md, skills/sandbox-and-file-access.md (TCC, entitlements), axiom-media (skills/screen-capture.md — iOS 27 ScreenCaptureKit, ReplayKit below 27, CMSampleBuffer handling), axiom-concurrency (async sequences, serial queues)
