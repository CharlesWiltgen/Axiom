---
name: axiom-camera-capture
description: AVCaptureSession, camera preview, photo capture, video recording, RotationCoordinator, session interruptions, deferred processing, capture responsiveness, zero-shutter-lag, photoQualityPrioritization, front camera mirroring
user-invocable: true
skill_type: discipline
version: 1.0.0
last_updated: 2026-01-03
apple_platforms: iOS 17+, iPadOS 17+, macOS 14+, tvOS 17+, axiom-visionOS 1+
---

# Camera Capture with AVFoundation

Guides you through implementing camera capture: session setup, photo capture, video recording, responsive capture UX, rotation handling, and session lifecycle management.

## When to Use This Skill

Use when you need to:
- ☑ Build a custom camera UI (not system picker)
- ☑ Capture photos with quality/speed tradeoffs
- ☑ Record video with audio
- ☑ Handle device rotation correctly (RotationCoordinator)
- ☑ Make capture feel responsive (zero-shutter-lag)
- ☑ Handle session interruptions (phone calls, multitasking)
- ☑ Switch between front/back cameras
- ☑ Configure capture quality and resolution

## Example Prompts

"How do I set up a camera preview in SwiftUI?"
"My camera freezes when I get a phone call"
"The photo preview is rotated wrong on front camera"
"How do I make photo capture feel instant?"
"Should I use deferred processing?"
"My camera takes too long to capture"
"How do I switch between front and back cameras?"
"How do I record video with audio?"

## Red Flags

Signs you're making this harder than it needs to be:

- ❌ Calling `startRunning()` on main thread (blocks UI for seconds)
- ❌ Using deprecated `videoOrientation` instead of RotationCoordinator (iOS 17+)
- ❌ Not observing session interruptions (app freezes on phone call)
- ❌ Creating new AVCaptureSession for each capture (expensive)
- ❌ Using `.photo` preset for video (wrong format)
- ❌ Ignoring `photoQualityPrioritization` (slow captures)
- ❌ Not handling `.notAuthorized` permission state
- ❌ Modifying session without `beginConfiguration()`/`commitConfiguration()`
- ❌ Using UIImagePickerController for custom camera UI (limited control)

## Mandatory First Steps

Before implementing any camera feature:

### 1. Choose Your Capture Mode

```
What do you need?

┌─ Just let user pick a photo?
│  └─ Don't use AVFoundation - use PHPicker or PhotosPicker
│     See: /skill axiom-photo-library
│
├─ Simple photo/video capture with system UI?
│  └─ UIImagePickerController (but limited customization)
│
├─ Custom camera UI with photo capture?
│  └─ AVCaptureSession + AVCapturePhotoOutput
│     → Continue with this skill
│
├─ Custom camera UI with video recording?
│  └─ AVCaptureSession + AVCaptureMovieFileOutput
│     → Continue with this skill
│
└─ Both photo and video in same session?
   └─ AVCaptureSession + both outputs
      → Continue with this skill
```

### 2. Request Camera Permission

```swift
import AVFoundation

func requestCameraAccess() async -> Bool {
    let status = AVCaptureDevice.authorizationStatus(for: .video)

    switch status {
    case .authorized:
        return true
    case .notDetermined:
        return await AVCaptureDevice.requestAccess(for: .video)
    case .denied, .restricted:
        // Show settings prompt
        return false
    @unknown default:
        return false
    }
}
```

**Info.plist required**:
```xml
<key>NSCameraUsageDescription</key>
<string>Take photos and videos</string>
```

For audio (video recording):
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Record audio with video</string>
```

### 3. Understand Session Architecture

```
AVCaptureSession
    ├─ Inputs
    │   ├─ AVCaptureDeviceInput (camera)
    │   └─ AVCaptureDeviceInput (microphone, for video)
    │
    ├─ Outputs
    │   ├─ AVCapturePhotoOutput (photos)
    │   ├─ AVCaptureMovieFileOutput (video files)
    │   └─ AVCaptureVideoDataOutput (raw frames)
    │
    └─ Connections (automatic between compatible input/output)
```

**Key rule**: All session configuration happens on a **dedicated serial queue**, never main thread.

## Core Patterns

### Pattern 1: Basic Session Setup

**Use case**: Set up camera preview with photo capture capability.

```swift
import AVFoundation

class CameraManager: NSObject {
    let session = AVCaptureSession()
    let photoOutput = AVCapturePhotoOutput()

    // CRITICAL: Dedicated serial queue for session work
    private let sessionQueue = DispatchQueue(label: "camera.session")

    func setupSession() {
        sessionQueue.async { [self] in
            session.beginConfiguration()
            defer { session.commitConfiguration() }

            // 1. Set session preset
            session.sessionPreset = .photo

            // 2. Add camera input
            guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera,
                                                        for: .video,
                                                        position: .back),
                  let input = try? AVCaptureDeviceInput(device: camera),
                  session.canAddInput(input) else {
                return
            }
            session.addInput(input)

            // 3. Add photo output
            guard session.canAddOutput(photoOutput) else { return }
            session.addOutput(photoOutput)

            // 4. Configure photo output
            photoOutput.isHighResolutionCaptureEnabled = true
            photoOutput.maxPhotoQualityPrioritization = .quality
        }
    }

    func startSession() {
        sessionQueue.async { [self] in
            if !session.isRunning {
                session.startRunning()  // Blocking call - never on main thread!
            }
        }
    }

    func stopSession() {
        sessionQueue.async { [self] in
            if session.isRunning {
                session.stopRunning()
            }
        }
    }
}
```

**Cost**: 30 min implementation

### Pattern 2: SwiftUI Camera Preview

**Use case**: Display camera preview in SwiftUI view.

```swift
import SwiftUI
import AVFoundation

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

// Usage in SwiftUI
struct CameraView: View {
    @StateObject private var camera = CameraManager()

    var body: some View {
        CameraPreview(session: camera.session)
            .ignoresSafeArea()
            .onAppear { camera.startSession() }
            .onDisappear { camera.stopSession() }
    }
}
```

**Cost**: 20 min implementation

### Pattern 3: Rotation Handling with RotationCoordinator (iOS 17+)

**Use case**: Keep preview and captured photos correctly oriented regardless of device rotation.

**Why RotationCoordinator**: Deprecated `videoOrientation` requires manual observation of device orientation. RotationCoordinator automatically tracks gravity and provides angles.

```swift
import AVFoundation

class CameraManager {
    private var rotationCoordinator: AVCaptureDevice.RotationCoordinator?
    private var rotationObservation: NSKeyValueObservation?

    func setupRotationCoordinator(device: AVCaptureDevice, previewLayer: AVCaptureVideoPreviewLayer) {
        // Create coordinator with device and preview layer
        rotationCoordinator = AVCaptureDevice.RotationCoordinator(
            device: device,
            previewLayer: previewLayer
        )

        // Observe preview rotation changes
        rotationObservation = rotationCoordinator?.observe(
            \.videoRotationAngleForHorizonLevelPreview,
            options: [.new]
        ) { [weak previewLayer] coordinator, _ in
            // Update preview layer rotation on main thread
            DispatchQueue.main.async {
                previewLayer?.connection?.videoRotationAngle = coordinator.videoRotationAngleForHorizonLevelPreview
            }
        }

        // Set initial rotation
        previewLayer.connection?.videoRotationAngle = rotationCoordinator!.videoRotationAngleForHorizonLevelPreview
    }

    func captureRotationAngle() -> CGFloat {
        // Use this angle when capturing photos
        rotationCoordinator?.videoRotationAngleForHorizonLevelCapture ?? 0
    }
}
```

**When capturing**:
```swift
func capturePhoto() {
    let settings = AVCapturePhotoSettings()

    // Apply rotation angle from coordinator
    if let connection = photoOutput.connection(with: .video) {
        connection.videoRotationAngle = captureRotationAngle()
    }

    photoOutput.capturePhoto(with: settings, delegate: self)
}
```

**Cost**: 45 min implementation, prevents 2+ hours debugging rotation issues

### Pattern 4: Responsive Capture Pipeline (iOS 17+)

**Use case**: Make photo capture feel instant with zero-shutter-lag, overlapping captures, and responsive button states.

**iOS 17+ introduces four complementary APIs** that work together for maximum responsiveness:

#### 4a. Zero Shutter Lag

Uses a ring buffer of recent frames to "time travel" back to the exact moment you tapped the shutter. Enabled automatically for iOS 17+ apps.

```swift
// Check if supported for current format
if photoOutput.isZeroShutterLagSupported {
    // Enabled by default for apps linking iOS 17+
    // Opt out if causing issues:
    // photoOutput.isZeroShutterLagEnabled = false
}
```

**Why it matters**: Without ZSL, there's a delay between tap and frame capture. For action shots, the moment is already over.

**Requirements**: iPhone XS and newer. Does NOT apply to flash captures, manual exposure, bracketed captures, or constituent photo delivery.

#### 4b. Responsive Capture (Overlapping Captures)

Allows a new capture to start while the previous one is still processing:

```swift
// Check support first
if photoOutput.isZeroShutterLagSupported {
    photoOutput.isZeroShutterLagEnabled = true  // Required for responsive capture

    if photoOutput.isResponsiveCaptureSupported {
        photoOutput.isResponsiveCaptureEnabled = true
    }
}
```

**Tradeoff**: Increases peak memory usage. If your app is memory-constrained, consider leaving disabled.

**Requirements**: A12 Bionic (iPhone XS) and newer.

#### 4c. Fast Capture Prioritization

Automatically adapts quality when taking multiple photos rapidly (like burst mode):

```swift
if photoOutput.isFastCapturePrioritizationSupported {
    photoOutput.isFastCapturePrioritizationEnabled = true
    // When enabled, rapid captures use "balanced" quality instead of "quality"
    // to maintain consistent shot-to-shot time
}
```

**When to enable**: User-facing toggle ("Prioritize Faster Shooting" in Camera.app). Off by default because it reduces quality.

#### 4d. Readiness Coordinator (Button State Management)

**Critical for UX**: Provides synchronous updates for shutter button state without async lag.

```swift
class CameraManager {
    private var readinessCoordinator: AVCapturePhotoOutputReadinessCoordinator!

    func setupReadinessCoordinator() {
        readinessCoordinator = AVCapturePhotoOutputReadinessCoordinator(photoOutput: photoOutput)
        readinessCoordinator.delegate = self
    }

    func capturePhoto() {
        var settings = AVCapturePhotoSettings()
        settings.photoQualityPrioritization = .balanced

        // Tell coordinator to track this capture BEFORE calling capturePhoto
        readinessCoordinator.startTrackingCaptureRequest(using: settings)

        photoOutput.capturePhoto(with: settings, delegate: self)
    }
}

extension CameraManager: AVCapturePhotoOutputReadinessCoordinatorDelegate {
    func readinessCoordinator(_ coordinator: AVCapturePhotoOutputReadinessCoordinator,
                              captureReadinessDidChange captureReadiness: AVCapturePhotoOutput.CaptureReadiness) {
        DispatchQueue.main.async {
            switch captureReadiness {
            case .ready:
                self.shutterButton.isEnabled = true
                self.shutterButton.alpha = 1.0

            case .notReadyMomentarily:
                // Brief delay - disable to prevent double-tap
                self.shutterButton.isEnabled = false

            case .notReadyWaitingForCapture:
                // Flash is firing - dim button
                self.shutterButton.alpha = 0.5

            case .notReadyWaitingForProcessing:
                // Processing previous photo - show spinner
                self.showProcessingIndicator()

            case .sessionNotRunning:
                self.shutterButton.isEnabled = false

            @unknown default:
                break
            }
        }
    }
}
```

**Why use Readiness Coordinator**: Without it, you'd need to track capture state manually and users might spam the shutter button during processing.

#### Quality Prioritization (Baseline)

Still useful even without the new APIs:

```swift
func capturePhoto() {
    var settings = AVCapturePhotoSettings()

    // Speed vs Quality tradeoff
    // .speed     - Fastest capture, lower quality
    // .balanced  - Good default
    // .quality   - Best quality, may have delay
    settings.photoQualityPrioritization = .speed

    // For specific use cases:
    // - Social sharing: .speed (users expect instant)
    // - Document scanning: .quality (accuracy matters)
    // - General photography: .balanced

    photoOutput.capturePhoto(with: settings, delegate: self)
}
```

**Deferred Processing (iOS 17+)**:

For maximum responsiveness, capture returns immediately with proxy image, full Deep Fusion processing happens in background:

```swift
// Check support and enable deferred processing
if photoOutput.isAutoDeferredPhotoDeliverySupported {
    photoOutput.isAutoDeferredPhotoDeliveryEnabled = true
}
```

**Delegate callbacks with deferred processing**:

```swift
// Called for BOTH regular photos AND deferred proxies
func photoOutput(_ output: AVCapturePhotoOutput,
                 didFinishProcessingPhoto photo: AVCapturePhoto,
                 error: Error?) {
    guard error == nil else { return }

    // Non-deferred photo - save directly
    if !photo.isRawPhoto, let data = photo.fileDataRepresentation() {
        savePhotoToLibrary(data)
    }
}

// Called ONLY for deferred proxies - save to PhotoKit for later processing
func photoOutput(_ output: AVCapturePhotoOutput,
                 didFinishCapturingDeferredPhotoProxy deferredPhotoProxy: AVCaptureDeferredPhotoProxy,
                 error: Error?) {
    guard error == nil else { return }

    // CRITICAL: Save proxy to library ASAP before app is backgrounded
    // App may be force-quit if memory pressure is high during backgrounding
    guard let proxyData = deferredPhotoProxy.fileDataRepresentation() else { return }

    Task {
        try await PHPhotoLibrary.shared().performChanges {
            let request = PHAssetCreationRequest.forAsset()
            // Use .photoProxy resource type - triggers deferred processing in Photos
            request.addResource(with: .photoProxy, data: proxyData, options: nil)
        }
    }
}
```

**When final processing happens**:
- On-demand when image is requested from PhotoKit
- Or automatically when device is idle (plugged in, not in use)

**Fetching images with deferred processing awareness**:

```swift
// Request with secondary degraded image for smoother UX
let options = PHImageRequestOptions()
options.allowSecondaryDegradedImage = true  // New in iOS 17

PHImageManager.default().requestImage(
    for: asset,
    targetSize: targetSize,
    contentMode: .aspectFill,
    options: options
) { image, info in
    let isDegraded = info?[PHImageResultIsDegradedKey] as? Bool ?? false

    if isDegraded {
        // First: Low quality (immediate)
        // Second: Medium quality (new - while processing)
        // Third callback will be final quality
        self.showTemporaryImage(image)
    } else {
        // Final quality - processing complete
        self.showFinalImage(image)
    }
}
```

**Requirements**: iPhone 11 Pro and newer. Not used for flash captures or formats that don't benefit from extended processing.

**Important considerations**:
- Can't apply pixel buffer customizations (filters, metadata changes) to deferred photos
- Use PhotoKit adjustments after processing for edits
- Get proxy into library ASAP - limited time when backgrounded

**Cost**: 1 hour implementation, prevents "camera feels slow" complaints

### Pattern 5: Session Interruption Handling

**Use case**: Handle phone calls, multitasking, system camera usage.

```swift
class CameraManager {
    private var interruptionObservers: [NSObjectProtocol] = []

    func setupInterruptionHandling() {
        // Session was interrupted
        let interruptedObserver = NotificationCenter.default.addObserver(
            forName: .AVCaptureSessionWasInterrupted,
            object: session,
            queue: .main
        ) { [weak self] notification in
            guard let reason = notification.userInfo?[AVCaptureSessionInterruptionReasonKey] as? Int,
                  let interruptionReason = AVCaptureSession.InterruptionReason(rawValue: reason) else {
                return
            }

            switch interruptionReason {
            case .videoDeviceNotAvailableInBackground:
                // App went to background - normal, will resume
                self?.showPausedOverlay()

            case .audioDeviceInUseByAnotherClient:
                // Another app using audio
                self?.showInterruptedBanner("Audio in use by another app")

            case .videoDeviceInUseByAnotherClient:
                // Another app using camera
                self?.showInterruptedBanner("Camera in use by another app")

            case .videoDeviceNotAvailableWithMultipleForegroundApps:
                // Split View/Slide Over - camera not available
                self?.showInterruptedBanner("Camera unavailable in Split View")

            case .videoDeviceNotAvailableDueToSystemPressure:
                // Thermal state - reduce quality or stop
                self?.handleThermalPressure()

            @unknown default:
                self?.showInterruptedBanner("Camera interrupted")
            }
        }
        interruptionObservers.append(interruptedObserver)

        // Session interruption ended
        let endedObserver = NotificationCenter.default.addObserver(
            forName: .AVCaptureSessionInterruptionEnded,
            object: session,
            queue: .main
        ) { [weak self] _ in
            self?.hideInterruptedBanner()
            self?.hidePausedOverlay()
            // Session automatically resumes - no need to call startRunning()
        }
        interruptionObservers.append(endedObserver)
    }

    deinit {
        interruptionObservers.forEach { NotificationCenter.default.removeObserver($0) }
    }
}
```

**Cost**: 30 min implementation, prevents "camera freezes" bug reports

### Pattern 6: Camera Switching (Front/Back)

**Use case**: Toggle between front and back cameras.

```swift
func switchCamera() {
    sessionQueue.async { [self] in
        guard let currentInput = session.inputs.first as? AVCaptureDeviceInput else {
            return
        }

        let currentPosition = currentInput.device.position
        let newPosition: AVCaptureDevice.Position = currentPosition == .back ? .front : .back

        guard let newDevice = AVCaptureDevice.default(
            .builtInWideAngleCamera,
            for: .video,
            position: newPosition
        ) else {
            return
        }

        session.beginConfiguration()
        defer { session.commitConfiguration() }

        // Remove old input
        session.removeInput(currentInput)

        // Add new input
        do {
            let newInput = try AVCaptureDeviceInput(device: newDevice)
            if session.canAddInput(newInput) {
                session.addInput(newInput)

                // Update rotation coordinator for new device
                if let previewLayer = previewLayer {
                    setupRotationCoordinator(device: newDevice, previewLayer: previewLayer)
                }
            } else {
                // Fallback: restore old input
                session.addInput(currentInput)
            }
        } catch {
            session.addInput(currentInput)
        }
    }
}
```

**Front camera mirroring**: Front camera preview is mirrored by default (matches user expectation). Captured photos are NOT mirrored (correct for sharing). This is intentional.

**Cost**: 20 min implementation

### Pattern 7: Video Recording

**Use case**: Record video with audio to file.

```swift
class CameraManager: NSObject {
    let movieOutput = AVCaptureMovieFileOutput()
    private var currentRecordingURL: URL?

    func setupVideoRecording() {
        sessionQueue.async { [self] in
            session.beginConfiguration()
            defer { session.commitConfiguration() }

            // Set video preset
            session.sessionPreset = .high  // Or .hd1920x1080, .hd4K3840x2160

            // Add microphone input
            if let microphone = AVCaptureDevice.default(for: .audio),
               let audioInput = try? AVCaptureDeviceInput(device: microphone),
               session.canAddInput(audioInput) {
                session.addInput(audioInput)
            }

            // Add movie output
            if session.canAddOutput(movieOutput) {
                session.addOutput(movieOutput)
            }
        }
    }

    func startRecording() {
        guard !movieOutput.isRecording else { return }

        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("mov")

        currentRecordingURL = outputURL

        // Apply rotation
        if let connection = movieOutput.connection(with: .video) {
            connection.videoRotationAngle = captureRotationAngle()
        }

        movieOutput.startRecording(to: outputURL, recordingDelegate: self)
    }

    func stopRecording() {
        guard movieOutput.isRecording else { return }
        movieOutput.stopRecording()
    }
}

extension CameraManager: AVCaptureFileOutputRecordingDelegate {
    func fileOutput(_ output: AVCaptureFileOutput,
                    didFinishRecordingTo outputFileURL: URL,
                    from connections: [AVCaptureConnection],
                    error: Error?) {
        if let error = error {
            print("Recording error: \(error)")
            return
        }

        // Video saved to outputFileURL
        saveVideoToPhotoLibrary(outputFileURL)
    }
}
```

**Cost**: 45 min implementation

## Anti-Patterns

### Anti-Pattern 1: Session Work on Main Thread

**Wrong**:
```swift
func startCamera() {
    session.startRunning()  // Blocks UI for 1-3 seconds!
}
```

**Right**:
```swift
func startCamera() {
    sessionQueue.async { [self] in
        session.startRunning()
    }
}
```

**Why it matters**: `startRunning()` is blocking. On main thread, UI freezes.

### Anti-Pattern 2: Using Deprecated videoOrientation

**Wrong** (pre-iOS 17):
```swift
// Manually tracking orientation
NotificationCenter.default.addObserver(
    forName: UIDevice.orientationDidChangeNotification,
    object: nil,
    queue: .main
) { _ in
    // Manual rotation logic...
}
```

**Right** (iOS 17+):
```swift
let coordinator = AVCaptureDevice.RotationCoordinator(device: camera, previewLayer: preview)
// Automatically tracks gravity, provides angles
```

**Why it matters**: RotationCoordinator handles edge cases (face-up, face-down) that manual tracking misses.

### Anti-Pattern 3: Ignoring Session Interruptions

**Wrong**:
```swift
// No interruption handling - camera freezes on phone call
```

**Right**:
```swift
NotificationCenter.default.addObserver(
    forName: .AVCaptureSessionWasInterrupted,
    object: session,
    queue: .main
) { notification in
    // Show UI feedback
}
```

**Why it matters**: Without handling, camera appears frozen when interrupted.

### Anti-Pattern 4: Modifying Session Without Configuration Block

**Wrong**:
```swift
session.removeInput(oldInput)
session.addInput(newInput)  // May fail mid-stream
```

**Right**:
```swift
session.beginConfiguration()
session.removeInput(oldInput)
session.addInput(newInput)
session.commitConfiguration()  // Atomic change
```

**Why it matters**: Without configuration block, session may enter invalid state between calls.

## Pressure Scenarios

### Scenario 1: "Just Make the Camera Work by Friday"

**Context**: Product wants camera feature shipped. You're considering skipping interruption handling.

**Pressure**: "It works when I test it, let's ship."

**Reality**: First user who gets a phone call while using camera will see frozen UI. App Store review may catch this.

**Correct action**:
1. Implement interruption handling (30 min)
2. Test by calling your test device during camera use
3. Verify UI shows appropriate feedback

**Push-back template**: "Camera captures work, but the app freezes if a phone call comes in. I need 30 minutes to handle interruptions properly and avoid 1-star reviews."

### Scenario 2: "The Camera is Too Slow"

**Context**: QA reports photo capture feels sluggish. PM wants it "instant like the system camera."

**Pressure**: "Just make it faster somehow."

**Reality**: Default settings prioritize quality over speed. System camera uses deferred processing.

**Correct action**:
1. Set `photoQualityPrioritization = .speed` for social/sharing use cases
2. Consider deferred processing for maximum responsiveness
3. Show capture animation immediately (before processing completes)

**Push-back template**: "We're currently optimizing for image quality. I can make capture feel instant by prioritizing speed and showing the preview immediately while processing continues in background. This is what the system Camera app does."

### Scenario 3: "Why is the Front Camera Photo Mirrored?"

**Context**: Designer reports front camera photos look "wrong" - they're not mirrored like the preview.

**Pressure**: "The preview shows it one way, the photo should match."

**Reality**: Preview is mirrored (user expectation - like a mirror). Photo is NOT mirrored (correct for sharing - text reads correctly). This is intentional behavior matching system camera.

**Correct action**:
1. Explain this is Apple's standard behavior
2. If business requires mirrored photos (selfie apps), manually mirror in post-processing
3. Never mirror the preview differently than expected

**Push-back template**: "This is intentional Apple behavior. The preview is mirrored like a mirror so users can frame themselves, but the captured photo is unmirrored so text reads correctly when shared. We can add optional mirroring in post-processing if our use case requires it."

## Checklist

Before shipping camera features:

**Session Setup**:
- ☑ All session work on dedicated serial queue
- ☑ `startRunning()` never called on main thread
- ☑ Session preset matches use case (`.photo` for photos, `.high` for video)
- ☑ Configuration changes wrapped in `beginConfiguration()`/`commitConfiguration()`

**Permissions**:
- ☑ Camera permission requested before session setup
- ☑ `NSCameraUsageDescription` in Info.plist
- ☑ `NSMicrophoneUsageDescription` if recording audio
- ☑ Graceful handling of denied permission

**Rotation**:
- ☑ RotationCoordinator used (not deprecated videoOrientation)
- ☑ Preview layer rotation updated via observation
- ☑ Capture rotation angle applied when taking photos
- ☑ Tested in all orientations (portrait, landscape, face-up)

**Responsiveness**:
- ☑ photoQualityPrioritization set appropriately for use case
- ☑ Capture button shows immediate feedback
- ☑ Deferred processing considered for maximum speed

**Interruptions**:
- ☑ Session interruption observer registered
- ☑ UI feedback shown when interrupted
- ☑ Tested with incoming phone call
- ☑ Tested in Split View (iPad)

**Camera Switching**:
- ☑ Front/back switch updates rotation coordinator
- ☑ Switch happens on session queue
- ☑ Fallback if new camera unavailable

**Video Recording** (if applicable):
- ☑ Microphone input added
- ☑ Recording delegate handles completion
- ☑ File cleanup for temporary recordings

## Resources

**WWDC**: 2021-10247, 2023-10105

**Docs**: /avfoundation/avcapturesession, /avfoundation/avcapturedevice/rotationcoordinator, /avfoundation/avcapturephotosettings, /avfoundation/avcapturephotooutputreadinesscoordinator

**Skills**: axiom-camera-capture-ref, axiom-camera-capture-diag, axiom-photo-library
