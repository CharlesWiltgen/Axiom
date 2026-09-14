
# ScreenCaptureKit — API Reference

Comprehensive API reference for ScreenCaptureKit: content enumeration, filtering, configuration, streaming, the system picker, screenshots, and file recording. For the discipline (pipeline, threading, consent, gotchas), see `skills/screencapturekit.md`.

## Key Terminology

- **SCShareableContent** — Snapshot of capturable displays, windows, and apps.
- **SCContentFilter** — What to capture (a window, or a display with inclusions/exclusions).
- **SCStreamConfiguration** — How to capture (resolution, fps, audio, cursor, color, HDR).
- **SCStream** — The live capture session; emits `CMSampleBuffer`s to outputs.
- **SCStreamOutput** — Protocol receiving sample buffers on a queue you supply.
- **SCContentSharingPicker** — System selection UI that hands back an `SCContentFilter` (macOS 14+).
- **SCScreenshotManager** — One-shot frame capture (macOS 14+).
- **SCRecordingOutput** — Records a stream straight to a file (macOS 15+).
- **SCClipBufferingOutput** — Rolling ≤15 s buffer exported on demand as instant-replay clips.
- **SCRecordingEditor** — System preview/share UI for a finished recording.

---

## Platform availability `OS27`

ScreenCaptureKit is no longer macOS-only — it ships on iOS 27, iPadOS 27, tvOS 27, and visionOS 27. **This reference documents the macOS surface.** The iOS model differs in kind: `SCShareableContent`, `SCDisplay`, `SCWindow`, and every `SCContentFilter` initializer are unavailable there, so the system picker is the only way to obtain a filter. For iOS and iPadOS see axiom-media (skills/screen-capture.md).

The 27-cycle additions, and where each one actually exists:

| Added in the 27 cycle | Platforms |
|---|---|
| `SCClipBufferingOutput`, `SCStream.addClipBufferingOutput(_:)` / `removeClipBufferingOutput(_:)` | all |
| `SCRecordingEditor` — presenter differs: `NSWindow` on macOS, `UIWindowScene` elsewhere | all |
| `SCStream.isCapturing`, `SCContentSharingPicker.isAvailable` | all |
| `SCRecordingOutputConfiguration.mixesAudioWithMicrophone` | all |
| `SCStreamError.Code.insufficientStorage`, `.notSupported` | all |
| `SCStreamError.Code.missingBackgroundMode` | all — but it carries no `macos` clause, so on macOS it inherits the enum's 12.3 floor and needs **no** `@available(macOS 27, *)` guard; background modes are an iOS-family concept, so expect it from iOS/tvOS/visionOS |
| `SCContentFilter.isMicrophoneEnabled`, `SCStreamFrameInfo.videoOrientation` | all except tvOS |
| `SCContentSharingPicker.presentForCurrentApplication()`, `SCContentSharingPickerConfiguration.showsMicrophoneControl` | **not macOS** — iOS and visionOS, plus tvOS for the first |
| `SCVideoEffectOutput`, `addVideoEffectOutput(_:)` / `removeVideoEffectOutput(_:)`, `SCStreamDelegate.outputVideoEffectDidFail(for:withError:)`, `SCContentFilter.isCameraEnabled`, `SCContentSharingPickerConfiguration.showsCameraControl` | **iOS only** |

The last two rows are hard compile errors on macOS, not soft runtime failures: `'presentForCurrentApplication()' is unavailable in macOS`.

---

# Part 1: Enumerating content (SCShareableContent)

```swift
// Async (preferred)
let content = try await SCShareableContent.current
let content2 = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

content.displays       // [SCDisplay]
content.windows        // [SCWindow]
content.applications   // [SCRunningApplication]
```

- **SCDisplay**: `displayID`, `width`, `height`, `frame`.
- **SCWindow**: `windowID`, `frame`, `title`, `isOnScreen`, `isActive`, `owningApplication` (`SCRunningApplication?`), `windowLayer`.
- **SCRunningApplication**: `bundleIdentifier`, `applicationName`, `processID`.

---

# Part 2: Content filters (SCContentFilter)

```swift
// Display-independent: follow one window across displays
SCContentFilter(desktopIndependentWindow: window)

// Display-dependent: whole display, excluding apps/windows
SCContentFilter(display: display, excludingApplications: [myApp], exceptingWindows: [])

// Display-dependent: only specific windows
SCContentFilter(display: display, including: [window1, window2])

filter.contentRect      // CGRect of captured content
filter.pointPixelScale  // Float backing scale
filter.streamType       // SCStreamType
filter.isMicrophoneEnabled  // OS27 — read-only, reflects the picker's mic control
```

Audio is filtered only at the application level, never per-window.

`isMicrophoneEnabled` is readable on macOS, but the control that sets it — `SCContentSharingPickerConfiguration.showsMicrophoneControl` — is iOS/visionOS-only. Unavailable on tvOS.

---

# Part 3: Stream configuration (SCStreamConfiguration)

```swift
let config = SCStreamConfiguration()

// Video
config.width = 3840
config.height = 2160
config.minimumFrameInterval = CMTime(value: 1, timescale: 60)  // fps cap
config.pixelFormat = kCVPixelFormatType_32BGRA
config.colorSpaceName = CGColorSpace.sRGB
config.showsCursor = true
config.scalesToFit = true
config.queueDepth = 5                  // in-flight frame buffers (memory vs. smoothness)
config.capturesShadowsOnly = false

// Audio (macOS 13+)
config.capturesAudio = true
config.sampleRate = 48_000
config.channelCount = 2
config.excludesCurrentProcessAudio = true

// macOS 15+
config.captureMicrophone = true
config.microphoneCaptureDeviceID = nil
config.captureDynamicRange = .hdrLocalDisplay   // .sdr | .hdrLocalDisplay | .hdrCanonicalDisplay
config.showMouseClicks = true
```

---

# Part 4: The stream (SCStream)

```swift
let stream = SCStream(filter: filter, configuration: config, delegate: streamDelegate)

try stream.addStreamOutput(output, type: .screen, sampleHandlerQueue: videoQueue)
try stream.addStreamOutput(output, type: .audio, sampleHandlerQueue: audioQueue)
try stream.addStreamOutput(output, type: .microphone, sampleHandlerQueue: micQueue)  // macOS 15+

try await stream.startCapture()
try await stream.stopCapture()
stream.isCapturing              // OS27 — started and actively capturing

// Hot updates — no restart
try await stream.updateConfiguration(newConfig)
try await stream.updateContentFilter(newFilter)
```

## SCStreamOutput

```swift
func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
            of type: SCStreamOutputType) { /* .screen | .audio | .microphone */ }
```

## SCStreamDelegate

```swift
func stream(_ stream: SCStream, didStopWithError error: Error)
func outputVideoEffectDidStart(for stream: SCStream)   // Presenter Overlay began (macOS 14+)
func outputVideoEffectDidStop(for stream: SCStream)
```

## Frame attachments (SCStreamFrameInfo)

```swift
let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false)
    as? [[SCStreamFrameInfo: Any]]
// keys: .status, .displayTime, .scaleFactor, .contentRect, .dirtyRects, .contentScale,
//       .videoOrientation (OS27, not tvOS)
// status value is an SCFrameStatus: .complete, .idle, .blank, .suspended, .started, .stopped
```

Use only `.complete` frames; `.idle` carries no new IOSurface. The `.videoOrientation` value follows the `CGImagePropertyOrientation` enum.

---

# Part 5: System picker (SCContentSharingPicker, macOS 14+)

```swift
let picker = SCContentSharingPicker.shared
picker.add(observer)                 // SCContentSharingPickerObserver
picker.isActive = true
picker.maximumStreamCount = 1
picker.isAvailable                   // OS27 — is screen recording allowed on this device?

var config = SCContentSharingPickerConfiguration()
config.allowedPickerModes = [.singleWindow, .multipleWindows, .singleApplication,
                             .multipleApplications, .singleDisplay]
config.excludedWindowIDs = []
config.excludedBundleIDs = []
config.allowsChangingSelectedContent = true

picker.defaultConfiguration = config       // applies to all
picker.setConfiguration(config, for: stream)  // per-stream override
picker.present()                            // also present(for:) / present(using:) / present(for:using:)
```

## Observer callbacks

```swift
func contentSharingPicker(_ picker: SCContentSharingPicker,
                          didUpdateWith filter: SCContentFilter, for stream: SCStream?)
func contentSharingPicker(_ picker: SCContentSharingPicker, didCancelFor stream: SCStream?)
func contentSharingPickerStartDidFailWithError(_ error: Error)
```

---

# Part 6: Screenshots (SCScreenshotManager, macOS 14+)

```swift
// CGImage
let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
// CMSampleBuffer (more pixel formats)
let buffer = try await SCScreenshotManager.captureSampleBuffer(contentFilter: filter, configuration: config)
```

Class methods — no instance needed. Reuses the same `SCContentFilter` / `SCStreamConfiguration` as streaming.

---

# Part 7: File recording (SCRecordingOutput, macOS 15+)

```swift
let recConfig = SCRecordingOutputConfiguration()
recConfig.outputURL = url
recConfig.outputFileType = .mov          // AVFileType
recConfig.videoCodecType = .h264         // AVVideoCodecType
recConfig.mixesAudioWithMicrophone = false  // OS27 — false keeps system + mic as two tracks (default true)

let recording = SCRecordingOutput(configuration: recConfig, delegate: recDelegate)
try stream.addRecordingOutput(recording)
// recording.recordedDuration, recording.recordedFileSize
try stream.removeRecordingOutput(recording)
```

## SCRecordingOutputDelegate

```swift
func recordingOutputDidStartRecording(_ recordingOutput: SCRecordingOutput)
func recordingOutput(_ recordingOutput: SCRecordingOutput, didFailWithError error: Error)
func recordingOutputDidFinishRecording(_ recordingOutput: SCRecordingOutput)
```

---

# Part 8: Clip buffering (SCClipBufferingOutput) `OS27`

A rolling buffer of the most recent samples — **15 seconds maximum** — exported on demand as instant-replay clips. Buffering continues during an export.

```swift
let clips = SCClipBufferingOutput(delegate: self)
try stream.addClipBufferingOutput(clips)            // stream must already be capturing
try await clips.exportClip(to: url, duration: 15)   // newest samples; 15 s max
try stream.removeClipBufferingOutput(clips)         // stops buffering, flushes the buffer
```

- Add only while the stream is **actively capturing**; one clip-buffering session per stream.
- A `duration` longer than what is buffered yields all available content, not an error.
- The destination URL must be a file URL, and is overwritten if it already exists.
- `exportClip(to:duration:completionHandler:)` is the non-async form.
- Stopping the stream stops buffering; removing the output discards everything buffered.
- What gets buffered follows the stream's `SCStreamConfiguration`.

## SCClipBufferingOutputDelegate

```swift
extension Recorder: SCClipBufferingOutputDelegate {
    func clipBufferingOutputDidStartBuffering(_ clipBufferingOutput: SCClipBufferingOutput) {}
    func clipBufferingOutput(_ clipBufferingOutput: SCClipBufferingOutput, didFailWithError error: any Error) {}
    func clipBufferingOutputDidStopBuffering(_ clipBufferingOutput: SCClipBufferingOutput) {}
}
```

---

# Part 9: Recording editor (SCRecordingEditor) `OS27`

System-owned preview and share UI for a finished recording — the file written by `SCRecordingOutput` or exported by `SCClipBufferingOutput`. The editor owns its entire presentation lifecycle.

```swift
let editor = SCRecordingEditor(url: url)   // file written by SCRecordingOutput or SCClipBufferingOutput
editor.delegate = self
try await editor.present(from: window)     // NSWindow; present(from:completionHandler:) also exists
```

On macOS the presenter takes an `NSWindow`; on iOS, iPadOS, visionOS, and tvOS it takes a `UIWindowScene`. There is no anchor-less overload — `present()` fails with `error: missing argument for parameter 'from' in call`. Apple's discussion describes automatic foreground discovery, but every `present` overload in the 27 SDK requires an anchor. The `SCRecordingEditor.Mode` preview-versus-share variant is **tvOS-only** — the macOS `present(from:mode:completionHandler:)` overload is explicitly unavailable.

## SCRecordingEditorDelegate

```swift
extension Recorder: SCRecordingEditorDelegate {
    func recordingEditorDidDismiss(_ editor: SCRecordingEditor) {}
    func recordingEditor(_ editor: SCRecordingEditor, didFailWithError error: any Error) {}
}
```

---

# Part 10: Errors (SCStreamError)

Failures arrive as `NSError` in `SCStreamErrorDomain`; match them against `SCStreamError.Code`.

```swift
do { try await stream.startCapture() }
catch SCStreamError.userDeclined { }          // user declined to authorize capture
catch SCStreamError.insufficientStorage { }   // OS27 — recording ran out of storage
catch SCStreamError.notSupported { }          // OS27 — operation unsupported on this platform
catch { }                                     // other NSError in SCStreamErrorDomain
```

| New in the 27 cycle | Raw | Meaning |
|---|---|---|
| `.insufficientStorage` | -3822 | stream stopped — not enough storage for the recording |
| `.notSupported` | -3823 | the operation is unsupported on this platform |
| `.missingBackgroundMode` | -3824 | required background mode not configured. Carries **no `macos` clause**, so on macOS it inherits the enum's 12.3 floor — no `@available` guard needed there; background modes are an iOS-family concept, so expect it from iOS/tvOS/visionOS |

---

# Part 11: Permissions and migration

- **Screen Recording TCC** is mandatory; `SCShareableContent` is empty until granted.
- **Persistent Content Capture** entitlement for login-item/background capturers (VNC, remote desktop).
- Presenter Overlay is automatic for any ScreenCaptureKit + camera app; observe `outputVideoEffectDidStart`.

| Deprecated | Replacement |
|------------|-------------|
| `CGDisplayStream` | `SCStream` |
| `CGWindowListCreateImage` | `SCScreenshotManager.captureImage(contentFilter:configuration:)` |
| `AVCaptureScreenInput` (superseded, not deprecated) | `SCStream` |

---

## Resources

**WWDC**: 2022-10156, 2022-10155, 2023-10136, 2024-10088

**Docs**: /screencapturekit, /screencapturekit/scshareablecontent, /screencapturekit/sccontentfilter, /screencapturekit/scstreamconfiguration, /screencapturekit/scstream, /screencapturekit/scstreamoutput, /screencapturekit/sccontentsharingpicker, /screencapturekit/scscreenshotmanager, /screencapturekit/screcordingoutput, /screencapturekit/scclipbufferingoutput, /screencapturekit/screcordingeditor, /screencapturekit/scstreamerror

**Skills**: skills/screencapturekit.md, skills/sandbox-and-file-access.md, axiom-media (skills/screen-capture.md for iOS/iPadOS, ReplayKit, CMSampleBuffer), axiom-concurrency (serial queues, async)
