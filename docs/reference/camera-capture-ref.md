---
name: camera-capture-ref
description: AVCaptureSession, AVCapturePhotoOutput, AVCapturePhotoSettings, RotationCoordinator, ReadinessCoordinator, AVCaptureMovieFileOutput, AVCaptureVideoPreviewLayer API reference
---

# Camera Capture API Reference

API reference for AVFoundation camera capture: `AVCaptureSession`, `AVCaptureDevice`, `AVCapturePhotoOutput`, `RotationCoordinator`, the responsive capture APIs, and video recording. Use it to look up exact class names, settings, and states while building a camera feature.

## When to Use This Reference

Use this reference when:
- Looking up `AVCaptureSession` presets and configuration APIs
- Checking `AVCapturePhotoSettings` options (quality, flash, format, resolution)
- Implementing `RotationCoordinator` for automatic rotation handling
- Understanding `ReadinessCoordinator` delegate states for shutter button UX
- Configuring `AVCaptureMovieFileOutput` for video recording
- Setting up `AVCaptureVideoPreviewLayer` in SwiftUI or UIKit
- Looking up device types, discovery sessions, or device configuration APIs
- Adopting deferred start for fast camera launch (iOS 26+)
- Supporting the Center Stage front camera: dynamic aspect ratio, smart framing, sensor orientation compensation (iPhone 17, iPhone Air, and iPhone 17 Pro; iOS 26+)
- Capturing 24- or 48-megapixel photos with prepared photo settings
- Recording ProRes with Pro Video Storage (iOS 27+)
- Setting lens aperture, shutter, or ISO priority modes, or tuning exposure signals (iOS 27+)
- Enabling continuous autofocus tracking, low-light video noise reduction, or cinematic video metadata capture (iOS 27+)
- Choosing a camera by direction on iPhone Duo (iOS 27.1+)

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "What are all the AVCaptureSession presets?"
- "How does AVCapturePhotoOutputReadinessCoordinator work?"
- "What AVCaptureDevice types are available?"
- "How do I configure AVCapturePhotoSettings for HEIF format?"
- "What are the responsive capture APIs in iOS 17+?"
- "How do I set up AVCaptureVideoPreviewLayer in SwiftUI?"
- "What are the session interruption reasons?"
- "How does deferred start work?"
- "How do I set the front camera's aspect ratio without rotating the phone?"
- "What resolutions does each photo quality prioritization support?"
- "How do I choose a camera by direction instead of position on iPhone Duo?"
- "How do I set the lens aperture, or use aperture priority, on iOS 27?"
- "How do I keep a moving subject in focus while recording?"
- "How do I record video I can edit cinematically afterwards?"

## What's Covered

### Session
- `AVCaptureSession` presets, configuration, lifecycle, notifications, and interruption reasons
- Deferred start for fast launch (iOS 26+)
- `hardwareCost` and `systemPressureCost`

### Devices
- `AVCaptureDevice` types, discovery sessions, and configuration (focus, exposure, zoom, torch)
- Switching cameras and camera authorization
- Lens aperture, exposure priority modes, and exposure signals (iOS 27+)
- Continuous autofocus tracking and focus-tracked metadata objects (iOS 27+)
- Center Stage front camera: dynamic aspect ratio, smart framing monitor, sensor orientation compensation, Center Stage control mode and stabilization (iOS 26+)
- iPhone Duo front cameras: the virtual front camera and mirroring, plus the individual inner and outer ultra-wide cameras and choosing a camera by direction (iOS 27.1+; build these with Xcode 27.1, or with Xcode 27.2 from the RC on, because Xcode 27.2 beta 2 lacks their types)
- `AVCaptureDevice.RotationCoordinator` setup, properties, and KVO observation (iOS 17+)

### Photo Capture
- `AVCapturePhotoOutput` configuration, responsive capture APIs, and deferred processing
- High-resolution 24- or 48-megapixel capture with prepared photo settings
- `AVCapturePhotoOutputReadinessCoordinator` delegate and capture readiness states
- `AVCapturePhotoSettings` formats (JPEG, HEIF, RAW), quality prioritization, flash, Apple ProRAW and HDR, resolution, previews and thumbnails
- `AVCapturePhotoCaptureDelegate` callbacks, including deferred proxy handling

### Video Recording
- `AVCaptureMovieFileOutput` recording, delegate, and state properties
- Low-light video noise reduction on the connection (iOS 27+)
- Cinematic video metadata capture, with the handoff to the Cinematic framework for editing (iOS 27+)
- Pro Video Storage, which reserves space so high-data-rate recording such as ProRes writes at a steady speed (iOS 27+)

### Other OS 27 Additions
- `AVCaptureBroadcastVideoOutput` and its `ancillaryDataEncoder`
- `AVExternalStorageDevice.reasonsNotRecommendedForCaptureUse`
- External-sync `AVError` cases
- `setPrimaryConstituentDeviceSwitchingBehaviorLockedWith(_:)`

### Preview and Patterns
- `AVCaptureVideoPreviewLayer` video gravity options and SwiftUI integration
- A complete `CameraManager` pattern with `@MainActor`, async setup, and rotation

## Documentation Scope

This page documents the `camera-capture-ref` skill (in the `axiom-media` suite), the API reference your assistant uses for AVFoundation camera classes. The skill holds the full API detail and code examples.

## Key APIs

### Session Presets

| Preset | Resolution | Use Case |
|--------|------------|----------|
| `.photo` | Optimal for photos | Photo capture |
| `.high` | Highest device quality | Video recording |
| `.medium` | VGA quality | Preview, lower storage |
| `.low` | CIF quality | Minimal storage |
| `.hd1280x720` | 720p | HD video |
| `.hd1920x1080` | 1080p | Full HD video |
| `.hd4K3840x2160` | 4K | Ultra HD video |
| `.inputPriority` | Use device format | Custom configuration |

### Quality Prioritization

| Value | Speed | Quality | Use Case |
|-------|-------|---------|----------|
| `.speed` | Fastest | Lower | Social sharing, rapid capture |
| `.balanced` | Medium | Good | General photography |
| `.quality` | Slowest | Best | Professional, documents |

### Capture Readiness States

| State | Meaning |
|-------|---------|
| `.ready` | Can capture immediately |
| `.notReadyMomentarily` | Brief delay, prevent double-tap |
| `.notReadyWaitingForCapture` | Flash firing, sensor reading |
| `.notReadyWaitingForProcessing` | Processing previous photo |
| `.sessionNotRunning` | Session stopped |

## Related

- [camera-capture](/skills/integration/camera-capture) – Guided implementation patterns and session setup that use these APIs
- [camera-capture-diag](/diagnostic/camera-capture-diag) – Troubleshooting a black preview, a frozen session, or rotation bugs
- [camera-auditor](/agents/camera-auditor) – Agent that scans your capture code for deprecated APIs, missing interruption handling, and threading mistakes
- [avfoundation-video-ref](/reference/avfoundation-video-ref) – Writing and exporting the video you capture, and typed buffer attachments
- [photo-library-ref](/reference/photo-library-ref) – Saving captured photos to the library, and the photo picker

## Resources

**WWDC**: 2023-10105, 2026-303, 2026-304, 2026-341

**Tech Talks**: 111465

**Docs**: /avfoundation/avcapturesession, /avfoundation/avcapturedevice, /avfoundation/avcapturephotosettings, /avfoundation/avcapturedevice/rotationcoordinator, /avfoundation/avprovideostorage, /avfoundation/avcapturesmartframingmonitor, /avkit/choosing-a-camera-by-the-direction-it-faces, /avfoundation/registering-a-camera-capture-accessory-on-iphone-duo, /avfoundation/supporting-device-rotation-in-your-camera-app
