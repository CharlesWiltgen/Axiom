---
name: screencapturekit
description: Modern macOS screen recording, sharing, screenshots, and file capture with ScreenCaptureKit
skill_type: skill
version: 1.0
apple_platforms: macOS 12.3+ (macOS 14+ picker/screenshots, macOS 15+ recording)
---

# ScreenCaptureKit

ScreenCaptureKit is the modern, GPU-accelerated, privacy-gated framework for capturing macOS screen content — displays, windows, applications, and their audio — as a live stream, a one-shot screenshot, or a recorded file. It replaces the deprecated `CGDisplayStream`, `CGWindowListCreateImage`, and `AVCaptureScreenInput`.

Part of the **axiom-macos** suite (`skills/screencapturekit.md` and `skills/screencapturekit-ref.md`).

## When to Use

Use this skill when you're:
- Building screen sharing, recording, or streaming (conferencing, OBS-style capture, demos)
- Capturing a specific window or display, with or without audio
- Taking a high-quality programmatic screenshot
- Recording screen content straight to a file (macOS 15+)
- Migrating off `CGDisplayStream` / `CGWindowListCreateImage` / `AVCaptureScreenInput`

This is **macOS only**. For iOS screen capture, use ReplayKit (see the axiom-media suite).

## Example Prompts

- "How do I record the screen on macOS?"
- "How do I capture a single window with ScreenCaptureKit?"
- "Why isn't my SCStream delivering any frames?"
- "How do I add the system screen-sharing picker?"
- "How do I take a programmatic screenshot of a window?"
- "How do I record a stream to a .mov file?"

## Key Concepts

### The four-stage pipeline

Enumerate (`SCShareableContent`) → filter (`SCContentFilter`) → configure (`SCStreamConfiguration`) → stream (`SCStream` + `SCStreamOutput`). Filters and configurations can be swapped on the fly with `updateContentFilter` / `updateConfiguration` — no restart.

### Screen Recording permission is mandatory

Without the user's TCC consent, `SCShareableContent` returns nothing. Handle the empty case. Background/login-item capturers (VNC, remote desktop) also need the Persistent Content Capture entitlement.

### The sample callback runs on your queue

`SCStreamOutput` fires on the serial `DispatchQueue` you supply. Keep it fast — heavy work back-pressures capture and drops frames. Video buffers are IOSurface-backed from a fixed pool (`queueDepth`); release them promptly and skip `.idle` frames via `SCStreamFrameInfo.status`.

### Prefer the system picker

`SCContentSharingPicker` (macOS 14+) gives you the system selection UI, the Video menu-bar item, and Presenter Overlay for free, and hands back a ready-made `SCContentFilter`. Don't hand-roll a selection UI.

### Screenshots and file recording without the plumbing

`SCScreenshotManager.captureImage(contentFilter:configuration:)` (macOS 14+) grabs one frame. `SCRecordingOutput` (macOS 15+) records a stream straight to a file — no manual `AVAssetWriter`.

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| Building for iOS | No API there | Use ReplayKit |
| Ignoring denied permission | No frames, no error you handle | Handle empty `SCShareableContent` |
| Heavy work on the sample queue | Dropped frames, hitches | Copy out fast; dedicated serial queue |
| Retaining video buffers | Pool exhaustion, stalls | Release promptly; tune `queueDepth` |
| Processing `.idle` frames | Wasted work / artifacts | Check `SCStreamFrameInfo.status == .complete` |
| Capturing your own window | Hall of mirrors | Exclude your app in the filter |

## Related

- [Sandbox & File Access](/skills/macos/sandbox-and-file-access) — TCC consent and entitlements for capture
- For iOS screen recording (ReplayKit) and CMSampleBuffer handling, see the axiom-media suite
- For serial queues and async sequences around the capture callback, see the axiom-concurrency suite

## Resources

**WWDC**: 2022-10156, 2022-10155, 2023-10136, 2024-10088

**Docs**: /screencapturekit, /screencapturekit/scstream, /screencapturekit/sccontentfilter, /screencapturekit/scstreamconfiguration, /screencapturekit/sccontentsharingpicker, /screencapturekit/scscreenshotmanager, /screencapturekit/screcordingoutput
