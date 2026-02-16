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

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What are all the AVCaptureSession presets?"
- "How does AVCapturePhotoOutputReadinessCoordinator work?"
- "What AVCaptureDevice types are available?"
- "How do I configure AVCapturePhotoSettings for HEIF format?"
- "What are the responsive capture APIs in iOS 17+?"
- "How do I set up AVCaptureVideoPreviewLayer in SwiftUI?"
- "What are the session interruption reasons?"

## What's Covered

- AVCaptureSession presets, lifecycle, notifications, and interruption reasons
- AVCaptureDevice types, discovery sessions, configuration (focus, exposure, zoom, torch)
- AVCaptureDevice.RotationCoordinator setup, properties, and KVO observation (iOS 17+)
- AVCapturePhotoOutput configuration, responsive capture APIs, and deferred processing
- AVCapturePhotoOutputReadinessCoordinator delegate and capture readiness states
- AVCapturePhotoSettings formats (JPEG, HEIF, RAW), quality prioritization, flash, resolution
- AVCapturePhotoCaptureDelegate callbacks including deferred proxy handling
- AVCaptureMovieFileOutput recording, delegate, and state properties
- AVCaptureVideoPreviewLayer video gravity options and SwiftUI integration
- Complete CameraManager pattern with @MainActor, async setup, and rotation

## Documentation Scope

This page documents the `axiom-camera-capture-ref` skill. It provides complete API documentation for AVFoundation camera classes. For guided implementation patterns, use the discipline skill. For troubleshooting, use the diagnostic skill.

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

**Docs**: /avfoundation/avcapturesession, /avfoundation/avcapturedevice, /avfoundation/avcapturephotosettings, /avfoundation/avcapturedevice/rotationcoordinator
