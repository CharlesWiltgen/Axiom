
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
```

Audio is filtered only at the application level, never per-window.

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
func outputEffectDidStart(for stream: SCStream)   // Presenter Overlay began (macOS 14+)
func outputEffectDidStop(for stream: SCStream)
```

## Frame attachments (SCStreamFrameInfo)

```swift
let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false)
    as? [[SCStreamFrameInfo: Any]]
// keys: .status, .displayTime, .scaleFactor, .contentRect, .dirtyRects, .contentScale
// status value is an SCFrameStatus: .complete, .idle, .blank, .suspended, .started, .stopped
```

Use only `.complete` frames; `.idle` carries no new IOSurface.

---

# Part 5: System picker (SCContentSharingPicker, macOS 14+)

```swift
let picker = SCContentSharingPicker.shared
picker.add(observer)                 // SCContentSharingPickerObserver
picker.isActive = true
picker.maximumStreamCount = 1

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

# Part 8: Permissions and migration

- **Screen Recording TCC** is mandatory; `SCShareableContent` is empty until granted.
- **Persistent Content Capture** entitlement for login-item/background capturers (VNC, remote desktop).
- Presenter Overlay is automatic for any ScreenCaptureKit + camera app; observe `outputEffectDidStart`.

| Deprecated | Replacement |
|------------|-------------|
| `CGDisplayStream` | `SCStream` |
| `CGWindowListCreateImage` | `SCScreenshotManager.captureImage(contentFilter:configuration:)` |
| `AVCaptureScreenInput` (superseded, not deprecated) | `SCStream` |

---

## Resources

**WWDC**: 2022-10156, 2022-10155, 2023-10136, 2024-10088

**Docs**: /screencapturekit, /screencapturekit/scshareablecontent, /screencapturekit/sccontentfilter, /screencapturekit/scstreamconfiguration, /screencapturekit/scstream, /screencapturekit/scstreamoutput, /screencapturekit/sccontentsharingpicker, /screencapturekit/scscreenshotmanager, /screencapturekit/screcordingoutput

**Skills**: skills/screencapturekit.md, skills/sandbox-and-file-access.md, axiom-media (ReplayKit, CMSampleBuffer), axiom-concurrency (serial queues, async)
