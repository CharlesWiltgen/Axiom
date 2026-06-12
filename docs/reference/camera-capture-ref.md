---
name: camera-capture-ref
description: AVCaptureSession, AVCapturePhotoOutput, AVCapturePhotoSettings, RotationCoordinator, ReadinessCoordinator, AVCaptureMovieFileOutput, AVCaptureVideoPreviewLayer API reference
---

# Camera Capture API Reference

Comprehensive API reference for AVFoundation camera capture covering AVCaptureSession, AVCaptureDevice, AVCapturePhotoOutput, RotationCoordinator, responsive capture APIs, and video recording.

## When to Use This Reference

Use this reference when:
- Looking up AVCaptureSession presets and configuration APIs
- Checking AVCapturePhotoSettings options (quality, flash, format, resolution)
- Implementing RotationCoordinator for automatic rotation handling
- Understanding ReadinessCoordinator delegate states for shutter button UX
- Configuring AVCaptureMovieFileOutput for video recording
- Setting up AVCaptureVideoPreviewLayer in SwiftUI or UIKit
- Looking up device types, discovery sessions, or device configuration APIs
- Adopting deferred start for fast camera launch (iOS 26 and later)
- Supporting the Center Stage front camera — dynamic aspect ratio, smart framing, sensor orientation compensation (iPhone 17 lineup, iOS 26 and later)
- Capturing 24/48 megapixel photos with prepared photo settings
- Recording ProRes with Pro Video Storage (iOS 27)

## Example Prompts

Questions you can ask Claude that will draw from this reference:

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

## What's Covered

- AVCaptureSession presets, lifecycle, notifications, and interruption reasons
- Deferred start APIs for fast launch (iOS 26 and later)
- Session hardware cost and system pressure monitoring
- AVCaptureDevice types, discovery sessions, configuration (focus, exposure, zoom, torch)
- Center Stage front camera: dynamic aspect ratio, smart framing monitor, sensor orientation compensation, low-latency stabilization (iOS 26 and later, iPhone 17 lineup)
- AVCaptureDevice.RotationCoordinator setup, properties, and KVO observation (iOS 17+)
- AVCapturePhotoOutput configuration, responsive capture APIs, and deferred processing
- High-resolution capture (24/48 MP) with prepared photo settings
- AVCapturePhotoOutputReadinessCoordinator delegate and capture readiness states
- AVCapturePhotoSettings formats (JPEG, HEIF, RAW), quality prioritization, flash, resolution
- AVCapturePhotoCaptureDelegate callbacks including deferred proxy handling
- AVCaptureMovieFileOutput recording, delegate, and state properties
- Pro Video Storage for deterministic high-data-rate recording (iOS 27)
- AVCaptureVideoPreviewLayer video gravity options and SwiftUI integration
- Complete CameraManager pattern with @MainActor, async setup, and rotation

## Documentation Scope

This page documents the `axiom-media` skill. It provides complete API documentation for AVFoundation camera classes. For guided implementation patterns, use the discipline skill. For troubleshooting, use the diagnostic skill.

- For implementation guidance, use [camera-capture](/skills/integration/camera-capture)
- For troubleshooting camera issues, see [camera-capture-diag](/diagnostic/camera-capture-diag)

## Key APIs

### Session Presets

| Preset | Resolution | Use Case |
|--------|------------|----------|
| `.photo` | Optimal for photos | Photo capture |
| `.high` | Highest device quality | Video recording |
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

- [camera-capture](/skills/integration/camera-capture) -- Implementation patterns and session setup
- [camera-capture-diag](/diagnostic/camera-capture-diag) -- Troubleshooting camera issues
- [photo-library-ref](/reference/photo-library-ref) -- Photo library and picker API reference

## Resources

**WWDC**: 2023-10105, 2026-303, 2026-304, 2026-341

**Docs**: /avfoundation/avcapturesession, /avfoundation/avcapturedevice, /avfoundation/avcapturephotosettings, /avfoundation/avcapturedevice/rotationcoordinator, /avfoundation/avprovideostorage, /avfoundation/avcapturesmartframingmonitor
