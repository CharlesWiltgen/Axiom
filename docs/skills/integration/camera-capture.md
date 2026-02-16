---
name: camera-capture
description: AVCaptureSession camera preview, photo capture, video recording, RotationCoordinator, responsive capture pipeline, session interruptions, deferred processing
---

# Camera Capture

AVFoundation camera patterns for custom camera UIs. Covers session setup, photo capture, video recording, rotation handling, responsive capture pipeline, and session lifecycle management.

## When to Use

Use this skill when you're:
- Building a custom camera UI (not the system picker)
- Capturing photos with quality/speed tradeoffs
- Recording video with audio
- Handling device rotation correctly with RotationCoordinator (iOS 17+)
- Making capture feel instant (zero-shutter-lag, deferred processing)
- Handling session interruptions (phone calls, multitasking, thermal pressure)
- Switching between front and back cameras

**Note:** If you just need users to pick existing photos, use [photo-library](/skills/integration/photo-library) instead. This skill is for building custom camera experiences with AVCaptureSession.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I set up a camera preview in SwiftUI?"
- "My camera freezes when I get a phone call"
- "The photo preview is rotated wrong on front camera"
- "How do I make photo capture feel instant?"
- "Should I use deferred processing?"
- "How do I switch between front and back cameras?"
- "How do I record video with audio?"
- "My camera takes too long to capture"

## What This Skill Provides

### Session Architecture
- AVCaptureSession setup with dedicated serial queue
- Input/output configuration with atomic beginConfiguration/commitConfiguration
- Session presets for photo vs video use cases

### Capture Patterns
- Basic photo capture with AVCapturePhotoOutput
- Video recording with AVCaptureMovieFileOutput and audio
- Camera switching between front and back with fallback handling

### Responsive Capture Pipeline (iOS 17+)
- Zero-shutter-lag with ring buffer for instant capture
- Responsive capture for overlapping photo captures
- Fast capture prioritization for burst-like shooting
- Readiness coordinator for shutter button state management
- Deferred processing with proxy images and background processing

### Rotation and Orientation
- RotationCoordinator for automatic rotation tracking (replaces deprecated videoOrientation)
- KVO observation for preview angle updates
- Capture angle application for correctly oriented photos

### Session Lifecycle
- Interruption handling (phone calls, Split View, thermal pressure)
- Proper start/stop on background queue
- UI feedback patterns for interrupted states

### Pressure Scenarios
- Shipping camera features under deadline pressure
- Responding to "camera is too slow" complaints
- Explaining front camera mirroring behavior to designers

## Key Pattern

### SwiftUI Camera Preview

```swift
struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}

    class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }
}
```

## Documentation Scope

This page documents the `axiom-camera-capture` skill -- AVFoundation camera patterns Claude uses when helping you build custom camera features. The skill contains 7 core patterns with code examples, anti-patterns, a shipping checklist, and pressure scenarios.

**For diagnostics:** See [camera-capture-diag](/diagnostic/camera-capture-diag) for troubleshooting black previews, frozen cameras, and rotation issues.

**For API reference:** See [camera-capture-ref](/reference/camera-capture-ref) for comprehensive AVCaptureSession, AVCapturePhotoOutput, and RotationCoordinator API coverage.

## Related

- [camera-capture-diag](/diagnostic/camera-capture-diag) -- Troubleshooting camera issues (black preview, rotation, slow capture)
- [camera-capture-ref](/reference/camera-capture-ref) -- Complete AVFoundation camera API reference
- [photo-library](/skills/integration/photo-library) -- Photo picking and library access (use instead if you just need photo selection)

## Resources

**WWDC**: 2021-10247, 2023-10105

**Docs**: /avfoundation/avcapturesession, /avfoundation/avcapturedevice/rotationcoordinator
