---
name: axiom-camera-capture-ref
description: Reference — AVCaptureSession, AVCapturePhotoSettings, AVCapturePhotoOutput, RotationCoordinator, photoQualityPrioritization, deferred processing, AVCaptureMovieFileOutput, session presets, capture device APIs
license: MIT
metadata:
  version: "1.0.0"
---

# Camera Capture API Reference

## Quick Reference

```swift
// SESSION SETUP
import AVFoundation

let session = AVCaptureSession()
let sessionQueue = DispatchQueue(label: "camera.session")

sessionQueue.async {
    session.beginConfiguration()
    session.sessionPreset = .photo

    guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
          let input = try? AVCaptureDeviceInput(device: camera),
          session.canAddInput(input) else { return }
    session.addInput(input)

    let photoOutput = AVCapturePhotoOutput()
    if session.canAddOutput(photoOutput) {
        session.addOutput(photoOutput)
    }

    session.commitConfiguration()
    session.startRunning()
}

// CAPTURE PHOTO
var settings = AVCapturePhotoSettings()
settings.photoQualityPrioritization = .balanced
photoOutput.capturePhoto(with: settings, delegate: self)

// ROTATION (iOS 17+)
let coordinator = AVCaptureDevice.RotationCoordinator(device: camera, previewLayer: previewLayer)
previewLayer.connection?.videoRotationAngle = coordinator.videoRotationAngleForHorizonLevelPreview
```

---

## AVCaptureSession

Central coordinator for capture data flow.

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

### Session Configuration

```swift
// Batch configuration (atomic)
session.beginConfiguration()
defer { session.commitConfiguration() }

// Check preset support
if session.canSetSessionPreset(.hd4K3840x2160) {
    session.sessionPreset = .hd4K3840x2160
}

// Add input/output
if session.canAddInput(input) {
    session.addInput(input)
}

if session.canAddOutput(output) {
    session.addOutput(output)
}
```

### Session Lifecycle

```swift
// Start (ALWAYS on background queue)
sessionQueue.async {
    session.startRunning()  // Blocking call
}

// Stop
sessionQueue.async {
    session.stopRunning()
}

// Check state
session.isRunning      // true/false
session.isInterrupted  // true during phone calls, etc.
```

### Session Notifications

```swift
// Session started
NotificationCenter.default.addObserver(
    forName: .AVCaptureSessionDidStartRunning,
    object: session, queue: .main) { _ in }

// Session stopped
NotificationCenter.default.addObserver(
    forName: .AVCaptureSessionDidStopRunning,
    object: session, queue: .main) { _ in }

// Session interrupted (phone call, etc.)
NotificationCenter.default.addObserver(
    forName: .AVCaptureSessionWasInterrupted,
    object: session, queue: .main) { notification in
        let reason = notification.userInfo?[AVCaptureSessionInterruptionReasonKey] as? Int
    }

// Interruption ended
NotificationCenter.default.addObserver(
    forName: .AVCaptureSessionInterruptionEnded,
    object: session, queue: .main) { _ in }

// Runtime error
NotificationCenter.default.addObserver(
    forName: .AVCaptureSessionRuntimeError,
    object: session, queue: .main) { notification in
        let error = notification.userInfo?[AVCaptureSessionErrorKey] as? Error
    }
```

### Interruption Reasons

| Reason | Value | Cause |
|--------|-------|-------|
| `.videoDeviceNotAvailableInBackground` | 1 | App went to background |
| `.audioDeviceInUseByAnotherClient` | 2 | Another app using audio |
| `.videoDeviceInUseByAnotherClient` | 3 | Another app using camera |
| `.videoDeviceNotAvailableWithMultipleForegroundApps` | 4 | Split View (iPad) |
| `.videoDeviceNotAvailableDueToSystemPressure` | 5 | Thermal throttling |

---

## AVCaptureDevice

Represents a physical capture device (camera, microphone).

### Getting Devices

```swift
// Default back camera
AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)

// Default front camera
AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front)

// Default microphone
AVCaptureDevice.default(for: .audio)

// Discovery session for all cameras
let discoverySession = AVCaptureDevice.DiscoverySession(
    deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera, .builtInTelephotoCamera],
    mediaType: .video,
    position: .unspecified
)
let cameras = discoverySession.devices
```

### Device Types

| Type | Description |
|------|-------------|
| `.builtInWideAngleCamera` | Standard camera (1x) |
| `.builtInUltraWideCamera` | Ultra-wide camera (0.5x) |
| `.builtInTelephotoCamera` | Telephoto camera (2x, 3x) |
| `.builtInDualCamera` | Wide + telephoto |
| `.builtInDualWideCamera` | Wide + ultra-wide |
| `.builtInTripleCamera` | Wide + ultra-wide + telephoto |
| `.builtInTrueDepthCamera` | Front TrueDepth (Face ID) |
| `.builtInLiDARDepthCamera` | LiDAR depth |

### Device Configuration

```swift
do {
    try device.lockForConfiguration()
    defer { device.unlockForConfiguration() }

    // Focus
    if device.isFocusModeSupported(.continuousAutoFocus) {
        device.focusMode = .continuousAutoFocus
    }

    // Exposure
    if device.isExposureModeSupported(.continuousAutoExposure) {
        device.exposureMode = .continuousAutoExposure
    }

    // Torch (flashlight)
    if device.hasTorch && device.isTorchModeSupported(.on) {
        device.torchMode = .on
    }

    // Zoom
    device.videoZoomFactor = 2.0  // 2x zoom

} catch {
    print("Failed to configure device: \(error)")
}
```

### Authorization

```swift
// Check status
let status = AVCaptureDevice.authorizationStatus(for: .video)

switch status {
case .authorized: break
case .notDetermined:
    await AVCaptureDevice.requestAccess(for: .video)
case .denied, .restricted:
    // Show settings prompt
@unknown default: break
}
```

---

## AVCaptureDevice.RotationCoordinator (iOS 17+)

Automatically tracks device orientation and provides rotation angles.

### Setup

```swift
// Create with device and preview layer
let coordinator = AVCaptureDevice.RotationCoordinator(
    device: captureDevice,
    previewLayer: previewLayer
)
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `videoRotationAngleForHorizonLevelPreview` | CGFloat | Rotation for preview layer |
| `videoRotationAngleForHorizonLevelCapture` | CGFloat | Rotation for captured output |

### Observation

```swift
// KVO observation for preview updates
let observation = coordinator.observe(
    \.videoRotationAngleForHorizonLevelPreview,
    options: [.new]
) { [weak previewLayer] coordinator, _ in
    DispatchQueue.main.async {
        previewLayer?.connection?.videoRotationAngle = coordinator.videoRotationAngleForHorizonLevelPreview
    }
}

// Set initial value
previewLayer.connection?.videoRotationAngle = coordinator.videoRotationAngleForHorizonLevelPreview
```

### Applying to Capture

```swift
func capturePhoto() {
    if let connection = photoOutput.connection(with: .video) {
        connection.videoRotationAngle = coordinator.videoRotationAngleForHorizonLevelCapture
    }
    photoOutput.capturePhoto(with: settings, delegate: self)
}
```

---

## AVCapturePhotoOutput

Output for capturing still photos.

### Configuration

```swift
let photoOutput = AVCapturePhotoOutput()

// High resolution
photoOutput.isHighResolutionCaptureEnabled = true

// Max quality prioritization
photoOutput.maxPhotoQualityPrioritization = .quality

// Deferred processing (iOS 17+)
photoOutput.isAutoDeferredPhotoDeliveryEnabled = true

// Live Photo
photoOutput.isLivePhotoCaptureEnabled = true

// Depth
photoOutput.isDepthDataDeliveryEnabled = true

// Portrait Effects Matte
photoOutput.isPortraitEffectsMatteDeliveryEnabled = true
```

### Supported Features

```swift
// Check support before enabling
photoOutput.isHighResolutionCaptureEnabled && photoOutput.isHighResolutionCaptureSupported
photoOutput.isLivePhotoCaptureSupported
photoOutput.isDepthDataDeliverySupported
photoOutput.isPortraitEffectsMatteDeliverySupported
photoOutput.maxPhotoQualityPrioritization  // .speed, .balanced, .quality
```

### Responsive Capture APIs (iOS 17+)

```swift
// Zero Shutter Lag - uses ring buffer for instant capture
photoOutput.isZeroShutterLagSupported
photoOutput.isZeroShutterLagEnabled  // true by default for iOS 17+ apps

// Responsive Capture - overlapping captures
photoOutput.isResponsiveCaptureSupported
photoOutput.isResponsiveCaptureEnabled

// Fast Capture Prioritization - adapts quality for burst-like capture
photoOutput.isFastCapturePrioritizationSupported
photoOutput.isFastCapturePrioritizationEnabled

// Deferred Processing - proxy + background processing
photoOutput.isAutoDeferredPhotoDeliverySupported
photoOutput.isAutoDeferredPhotoDeliveryEnabled
```

---

## AVCapturePhotoOutputReadinessCoordinator (iOS 17+)

Provides synchronous shutter button state updates.

### Setup

```swift
let coordinator = AVCapturePhotoOutputReadinessCoordinator(photoOutput: photoOutput)
coordinator.delegate = self
```

### Tracking Captures

```swift
// Call BEFORE capturePhoto()
coordinator.startTrackingCaptureRequest(using: settings)
photoOutput.capturePhoto(with: settings, delegate: self)
```

### Delegate

```swift
func readinessCoordinator(_ coordinator: AVCapturePhotoOutputReadinessCoordinator,
                          captureReadinessDidChange captureReadiness: AVCapturePhotoOutput.CaptureReadiness) {
    switch captureReadiness {
    case .ready:                         // Can capture immediately
    case .notReadyMomentarily:           // Brief delay, prevent double-tap
    case .notReadyWaitingForCapture:     // Flash firing, sensor reading
    case .notReadyWaitingForProcessing:  // Processing previous photo
    case .sessionNotRunning:             // Session stopped
    @unknown default: break
    }
}
```

---

## AVCapturePhotoSettings

Configuration for a single photo capture.

### Basic Settings

```swift
// Standard JPEG
var settings = AVCapturePhotoSettings()

// HEIF format
settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.hevc])

// RAW
settings = AVCapturePhotoSettings(rawPixelFormatType: kCVPixelFormatType_14Bayer_BGGR)

// RAW + JPEG
settings = AVCapturePhotoSettings(
    rawPixelFormatType: kCVPixelFormatType_14Bayer_BGGR,
    processedFormat: [AVVideoCodecKey: AVVideoCodecType.jpeg]
)
```

### Quality Prioritization

| Value | Speed | Quality | Use Case |
|-------|-------|---------|----------|
| `.speed` | Fastest | Lower | Social sharing, rapid capture |
| `.balanced` | Medium | Good | General photography |
| `.quality` | Slowest | Best | Professional, documents |

```swift
settings.photoQualityPrioritization = .speed
```

### Flash

```swift
settings.flashMode = .auto  // .off, .on, .auto
```

### Resolution

```swift
// High resolution still image
settings.isHighResolutionPhotoEnabled = true

// Max dimensions (limit resolution)
settings.maxPhotoDimensions = CMVideoDimensions(width: 4032, height: 3024)
```

### Preview/Thumbnail

```swift
// Preview for immediate display
settings.previewPhotoFormat = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
]

// Thumbnail
settings.embeddedThumbnailPhotoFormat = [
    AVVideoCodecKey: AVVideoCodecType.jpeg,
    AVVideoWidthKey: 160,
    AVVideoHeightKey: 120
]
```

### Important Notes

```swift
// Settings cannot be reused
// Each capture needs a NEW settings instance
let settings1 = AVCapturePhotoSettings()  // Use once
let settings2 = AVCapturePhotoSettings()  // Use for second capture

// Copy settings for similar captures
let settings2 = AVCapturePhotoSettings(from: settings1)
```

---

## AVCapturePhotoCaptureDelegate

Delegate for photo capture events.

```swift
extension CameraManager: AVCapturePhotoCaptureDelegate {

    // Photo capture will begin
    func photoOutput(_ output: AVCapturePhotoOutput,
                     willBeginCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings) {
        // Show shutter animation
    }

    // Photo capture finished
    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto,
                     error: Error?) {
        guard error == nil else {
            print("Capture error: \(error!)")
            return
        }

        // Get JPEG data
        if let data = photo.fileDataRepresentation() {
            savePhoto(data)
        }

        // Or get raw pixel buffer
        if let pixelBuffer = photo.pixelBuffer {
            processBuffer(pixelBuffer)
        }
    }

    // Deferred processing proxy (iOS 17+)
    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishCapturingDeferredPhotoProxy deferredPhotoProxy: AVCaptureDeferredPhotoProxy,
                     error: Error?) {
        guard error == nil, let data = deferredPhotoProxy.fileDataRepresentation() else { return }
        replaceThumbnailWithFinal(data)
    }
}
```

---

## AVCaptureMovieFileOutput

Output for recording video to file.

### Setup

```swift
let movieOutput = AVCaptureMovieFileOutput()

if session.canAddOutput(movieOutput) {
    session.addOutput(movieOutput)
}

// Add audio input
if let microphone = AVCaptureDevice.default(for: .audio),
   let audioInput = try? AVCaptureDeviceInput(device: microphone),
   session.canAddInput(audioInput) {
    session.addInput(audioInput)
}
```

### Recording

```swift
// Start recording
let outputURL = FileManager.default.temporaryDirectory
    .appendingPathComponent(UUID().uuidString)
    .appendingPathExtension("mov")

// Apply rotation
if let connection = movieOutput.connection(with: .video) {
    connection.videoRotationAngle = rotationCoordinator.videoRotationAngleForHorizonLevelCapture
}

movieOutput.startRecording(to: outputURL, recordingDelegate: self)

// Stop recording
movieOutput.stopRecording()

// Check state
movieOutput.isRecording
movieOutput.recordedDuration
movieOutput.recordedFileSize
```

### Delegate

```swift
extension CameraManager: AVCaptureFileOutputRecordingDelegate {

    func fileOutput(_ output: AVCaptureFileOutput,
                    didStartRecordingTo fileURL: URL,
                    from connections: [AVCaptureConnection]) {
        // Recording started
    }

    func fileOutput(_ output: AVCaptureFileOutput,
                    didFinishRecordingTo outputFileURL: URL,
                    from connections: [AVCaptureConnection],
                    error: Error?) {
        if let error = error {
            print("Recording failed: \(error)")
            return
        }

        // Video saved to outputFileURL
        saveToPhotoLibrary(outputFileURL)
    }
}
```

---

## AVCaptureVideoPreviewLayer

Layer for displaying camera preview.

### Setup

```swift
let previewLayer = AVCaptureVideoPreviewLayer(session: session)
previewLayer.videoGravity = .resizeAspectFill
previewLayer.frame = view.bounds
view.layer.addSublayer(previewLayer)
```

### Video Gravity

| Value | Behavior |
|-------|----------|
| `.resizeAspect` | Fit entire image, may letterbox |
| `.resizeAspectFill` | Fill layer, may crop edges |
| `.resize` | Stretch to fill (distorts) |

### SwiftUI Integration

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

---

## Common Code Patterns

### Complete Camera Manager

```swift
import AVFoundation

@MainActor
class CameraManager: NSObject, ObservableObject {
    let session = AVCaptureSession()
    let photoOutput = AVCapturePhotoOutput()
    private let sessionQueue = DispatchQueue(label: "camera.session")
    private var rotationCoordinator: AVCaptureDevice.RotationCoordinator?
    private var rotationObservation: NSKeyValueObservation?

    @Published var isSessionRunning = false

    func setup() async -> Bool {
        guard await AVCaptureDevice.requestAccess(for: .video) else { return false }

        return await withCheckedContinuation { continuation in
            sessionQueue.async { [self] in
                session.beginConfiguration()
                defer { session.commitConfiguration() }

                session.sessionPreset = .photo

                guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                      let input = try? AVCaptureDeviceInput(device: camera),
                      session.canAddInput(input) else {
                    continuation.resume(returning: false)
                    return
                }
                session.addInput(input)

                guard session.canAddOutput(photoOutput) else {
                    continuation.resume(returning: false)
                    return
                }
                session.addOutput(photoOutput)
                photoOutput.maxPhotoQualityPrioritization = .quality

                continuation.resume(returning: true)
            }
        }
    }

    func start() {
        sessionQueue.async { [self] in
            session.startRunning()
            DispatchQueue.main.async {
                self.isSessionRunning = self.session.isRunning
            }
        }
    }

    func stop() {
        sessionQueue.async { [self] in
            session.stopRunning()
            DispatchQueue.main.async {
                self.isSessionRunning = false
            }
        }
    }

    func capturePhoto() {
        var settings = AVCapturePhotoSettings()
        settings.photoQualityPrioritization = .balanced

        if let connection = photoOutput.connection(with: .video),
           let angle = rotationCoordinator?.videoRotationAngleForHorizonLevelCapture {
            connection.videoRotationAngle = angle
        }

        photoOutput.capturePhoto(with: settings, delegate: self)
    }
}

extension CameraManager: AVCapturePhotoCaptureDelegate {
    nonisolated func photoOutput(_ output: AVCapturePhotoOutput,
                                  didFinishProcessingPhoto photo: AVCapturePhoto,
                                  error: Error?) {
        guard let data = photo.fileDataRepresentation() else { return }
        // Handle photo data
    }
}
```

---

## Resources

**Docs**: /avfoundation/avcapturesession, /avfoundation/avcapturedevice, /avfoundation/avcapturephotosettings, /avfoundation/avcapturedevice/rotationcoordinator

**Skills**: axiom-camera-capture, axiom-camera-capture-diag
