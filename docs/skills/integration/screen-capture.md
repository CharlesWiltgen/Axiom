---
name: screen-capture
description: Capture, record, and stream the screen or your own app with the ScreenCaptureKit framework — new on iOS/iPadOS 27
skill_type: reference
apple_platforms: iOS 27+, iPadOS 27+, tvOS 27+, visionOS 27+, macOS 12.3+
---

# Screen Capture (ScreenCaptureKit)

`import ScreenCaptureKit` captures the screen — or just your own app — as a live video + audio stream, records it to a file, or buffers recent content for instant-replay clips. It's **new on iOS 27, iPadOS 27, tvOS 27, and visionOS 27** (beta); macOS has had it since 12.3. On iOS it's the modern successor to ReplayKit-style capture.

## When to Use

Use this skill when you're:
- Recording or live-streaming the iPad/iPhone screen (screen recording, screen sharing, broadcasting)
- Capturing just your own app's content (in-app capture), optionally with camera/mic overlays
- Buffering the last several seconds for instant-replay clips

## Example Prompts

- "How do I record the iPad screen with ScreenCaptureKit on iOS 27?"
- "Capture just my own app's content and stream the frames."
- "How is ScreenCaptureKit different on iOS than on macOS?"
- "Record the screen straight to an .mp4 file."

## What This Skill Provides

- **The iOS capture model** – on iOS you can't enumerate `SCShareableContent` (it's macOS-only); you obtain an `SCContentFilter` from the system **`SCContentSharingPicker`** (`.present()` / `.presentForCurrentApplication()`), then create an `SCStream`
- **Output options** – raw `CMSampleBuffer` frames (`SCStreamOutput`), record-to-file (`SCRecordingOutput`), instant-replay clip buffering, and iOS-only camera video effects (`SCVideoEffectOutput`, in-app capture only)
- **Configuration** – `SCStreamConfiguration` (width/height/audio); the verified iOS-vs-macOS availability deltas (e.g. `minimumFrameInterval`/`pixelFormat`/`SCScreenshotManager` are macOS-only)
- **How it differs from neighbors** – vs `ImageRenderer` (snapshots *your own* SwiftUI view, not the screen) and vs ReplayKit (the pre-27 iOS path)

## Related

- [Camera Capture](/skills/integration/camera-capture) – `AVCaptureSession` capture; the capture sibling for camera input rather than screen
- [Now Playing](/skills/integration/now-playing) – playback metadata for media you capture or stream
- [avfoundation-ref](/reference/avfoundation-ref) – the `AVFoundation` types (`AVFileType`, codecs) that `SCRecordingOutput` writes
