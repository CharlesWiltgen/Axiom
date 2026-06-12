
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

### Deferred Start (iOS 26+)

Postpones output initialization until after the first preview frame, cutting launch time roughly in half (WWDC 2026-303). Not on visionOS/watchOS.

```swift
session.beginConfiguration()
session.automaticallyRunsDeferredStart = true  // default true when linked against iOS 26 SDK+

let previewLayer = AVCaptureVideoPreviewLayer(session: session)
previewLayer.isDeferredStartEnabled = false    // preview must NOT be deferred

let photoOutput = AVCapturePhotoOutput()
session.addOutput(photoOutput)
photoOutput.isDeferredStartEnabled = true      // defer everything not needed for first frame

session.setDeferredStartDelegate(delegate, deferredStartDelegateCallbackQueue: sessionQueue)
session.commitConfiguration()
session.startRunning()
```

| API | Owner | Notes |
|-----|-------|-------|
| `isDeferredStartSupported` / `isDeferredStartEnabled` | `AVCaptureOutput`, `AVCaptureVideoPreviewLayer` | Set before `commitConfiguration()` — changing later forces a lengthy reconfiguration |
| `automaticallyRunsDeferredStart` | `AVCaptureSession` | `true` = system picks the moment (shortly after preview appears). Setting `false` raises `NSInvalidArgumentException` if `isManualDeferredStartSupported` is `false` |
| `isManualDeferredStartSupported` | `AVCaptureSession` | Check before opting into manual mode |
| `runDeferredStartWhenNeeded()` | `AVCaptureSession` | Manual mode only (raises otherwise). Call after your first frame is presented; once per configuration commit |
| `setDeferredStartDelegate(_:deferredStartDelegateCallbackQueue:)` | `AVCaptureSession` | Delegate gets `sessionWillRunDeferredStart(_:)` (create background resources here) and `sessionDidRunDeferredStart(_:)` (all outputs ready) |

**Manual-mode trigger from a CAMetalLayer** — run deferred start after the first drawable is presented:

```swift
guard let drawable = layer.nextDrawable() else { return }
if !firstFramePresented {
    drawable.addPresentedHandler { _ in
        captureSession.runDeferredStartWhenNeeded()
    }
    firstFramePresented = true
}
```

### Session Cost and System Pressure

```swift
// After commitConfiguration(), before startRunning()
session.hardwareCost          // target <= 1.0; > 1.0 = configuration can't run (iOS 16+)
// Contributors: camera count, active formats (1080p vs 4K), format max frame rate
// (cost assumes the format's max — set AVCaptureDeviceInput.videoMinFrameDurationOverride
// to the reciprocal of the frame rate you actually use), binned formats

// Multi-cam sessions also expose sustainability
multiCamSession.systemPressureCost  // > 1.0 = unsustainable (AVCaptureMultiCamSession, iOS 13+)

// Adapt at runtime: KVO the device's pressure state
let obs = device.observe(\.systemPressureState, options: [.initial, .new]) { device, _ in
    // Reduce frame rate, throttle GPU/ANE work, minimize UI work as pressure rises
}
```

| `SystemPressureState.Factors` | Meaning |
|-------------------------------|---------|
| `.systemTemperature` | Whole system thermally elevated |
| `.peakPower` | Power demand exceeds battery capability |
| `.depthModuleTemperature` | Depth module hot — depth quality may degrade |
| `.cameraTemperature` | Camera module hot |
| `.systemStress` `OS27` | System is ~30 seconds from unexpected power-off |

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

### Switching Cameras

```swift
// Switch between front and back during active session
func switchCamera() {
    sessionQueue.async { [self] in
        session.beginConfiguration()
        defer { session.commitConfiguration() }

        // Remove current camera input
        if let currentInput = session.inputs.first(where: { ($0 as? AVCaptureDeviceInput)?.device.hasMediaType(.video) == true }) as? AVCaptureDeviceInput {
            session.removeInput(currentInput)

            // Get opposite camera
            let newPosition: AVCaptureDevice.Position = currentInput.device.position == .back ? .front : .back
            guard let newDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: newPosition),
                  let newInput = try? AVCaptureDeviceInput(device: newDevice) else { return }

            if session.canAddInput(newInput) {
                session.addInput(newInput)
            }
        }
    }
}
```

**Important**: Always switch on the session queue, within beginConfiguration/commitConfiguration.

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

### Center Stage Front Camera (iOS 26+, iPhone 17 / iPhone Air / iPhone 17 Pro)

The Center Stage front camera has a **square sensor** (any aspect ratio without rotating the phone) with a 95° field of view, exposed as the **front `.builtInUltraWideCamera`** (WWDC 2026-341). Three new iOS 26, iOS-only API families support it, alongside the existing Center Stage controls:

#### Dynamic Aspect Ratio

Crops your chosen aspect ratio out of the square sensor without rebuilding the session or interrupting preview.

```swift
let discovery = AVCaptureDevice.DiscoverySession(
    deviceTypes: [.builtInUltraWideCamera], mediaType: .video, position: .front)
guard let camera = discovery.devices.first else { return }

// Find a format supporting the target ratio
for format in camera.formats where format.supportedDynamicAspectRatios.contains(.ratio4x3) {
    try camera.lockForConfiguration()
    camera.activeFormat = format
    camera.unlockForConfiguration()
    break
}

try camera.lockForConfiguration()
defer { camera.unlockForConfiguration() }
let syncTime = try await camera.setDynamicAspectRatio(.ratio4x3)  // returns first-buffer timestamp
```

| API | Notes |
|-----|-------|
| `AVCaptureDevice.AspectRatio` | `.ratio1x1`, `.ratio16x9`, `.ratio9x16`, `.ratio4x3`, `.ratio3x4` |
| `format.supportedDynamicAspectRatios` | Square formats only (1280–4032); the 4032 photo format supports only `.ratio3x4`/`.ratio4x3` |
| `device.dynamicAspectRatio` | KVO-observable current ratio; `nil` when active format has none |
| `device.dynamicDimensions` | KVO-observable output dimensions; `{0,0}` when unsupported |
| `device.setDynamicAspectRatio(_:)` | Requires `lockForConfiguration()`; raises `NSInvalidArgumentException` for unsupported ratios. Timestamp is on the device clock — convert via `session.synchronizationClock` before comparing with video-data-output buffers |

**Video recording**: QuickTime tracks require constant dimensions — `AVCaptureMovieFileOutput` recordings stop automatically when the ratio changes. With `AVCaptureVideoDataOutput` + `AVAssetWriter`, use the completion timestamp to end one recording and start the next.

#### Smart Framing Monitor (Auto Zoom / Auto Rotate)

Face/gaze-driven framing recommendations. Photo-capture oriented: recommendations only on the 4032 photo format.

```swift
for format in camera.formats where format.isSmartFramingSupported {
    try camera.lockForConfiguration()
    camera.activeFormat = format
    camera.unlockForConfiguration()
    break
}

guard let monitor = camera.smartFramingMonitor else { return }  // nil if unsupported
try camera.lockForConfiguration()
monitor.enabledFramings = monitor.supportedFramings  // default: empty — nothing recommended
camera.unlockForConfiguration()

observation = monitor.observe(\.recommendedFraming, options: [.new]) { monitor, _ in
    guard let framing = monitor.recommendedFraming else { return }
    Task {
        try camera.lockForConfiguration()
        defer { camera.unlockForConfiguration() }
        // Apple recommends ratio first, then zoom, for a smooth preview transition
        try await camera.setDynamicAspectRatio(framing.aspectRatio)
        camera.videoZoomFactor = CGFloat(framing.zoomFactor)
    }
}

try monitor.startMonitoring()   // before or after session.startRunning()
// later: observation?.invalidate(); monitor.stopMonitoring()
```

`AVCaptureFraming` = `aspectRatio` + `zoomFactor` (Float). Set `enabledFramings` before running the session; you can change it any time while monitoring.

#### Sensor Orientation Compensation

Historically front sensors are mounted landscape-left; the Center Stage front camera is mounted **portrait**. `AVCapturePhotoOutput` compensates by default — photos are physically rotated and EXIF-updated to landscape-left, so existing rotation code keeps working. Applies to HEIC/JPEG/uncompressed processed photos only — **never Bayer RAW or ProRAW**.

```swift
photoOutput.isCameraSensorOrientationCompensationSupported  // iOS 26+, iOS-only
// Disabling skips the rotation pass (best performance) — verify orientation stays correct
photoOutput.isCameraSensorOrientationCompensationEnabled = false
```

#### Center Stage Toggle and Stabilization

```swift
// Center Stage (system video effect, per process). VoIP-background-mode apps get it for
// free via Control Center; otherwise enable in-app:
for format in camera.formats where format.isCenterStageSupported {
    try camera.lockForConfiguration()
    camera.activeFormat = format
    camera.unlockForConfiguration()
    break
}
AVCaptureDevice.centerStageControlMode = .cooperative  // or .app — set BEFORE enabling
AVCaptureDevice.isCenterStageEnabled = true

// Real-time low-latency stabilization for video calls (iOS 26+, off by default)
connection.preferredVideoStabilizationMode = .lowLatency

// Recording: .cinematicExtended / .cinematicExtendedEnhanced are face-aware on this camera
```

Bonus (iOS 26+, iOS-only): `device.nominalFocalLengthIn35mmFilm` — nominal 35mm-equivalent focal length (`0` for virtual/external devices).

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

// High resolution (iOS 16+) — isHighResolutionCaptureEnabled is deprecated.
// Set the output's max dimensions to one of the active format's supported values.
photoOutput.maxPhotoDimensions = camera.activeFormat.supportedMaxPhotoDimensions.last!

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
camera.activeFormat.supportedMaxPhotoDimensions  // [CMVideoDimensions] — pick one for maxPhotoDimensions
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

On iOS 27 (iPhone 16/17), the system also routes **balanced** fast captures through deferred processing, further shrinking shot-to-shot delay during rapid capture (WWDC 2026-304).

### High-Resolution Capture (24/48 MP)

Only the `.photo` session preset supports 24/48 MP. Resolution availability by quality prioritization (WWDC 2026-304):

| Resolution | `.speed` | `.balanced` | `.quality` | Notes |
|------------|----------|-------------|------------|-------|
| 12 MP | ✓ | ✓ | ✓ | Single or fused |
| 18 MP | | | ✓ | Center Stage front camera (iPhone 17) only; multi-frame fused |
| 24 MP | | | ✓ | Multi-frame fused (12 MP HDR + 48 MP detail via Photonic Engine) |
| 48 MP | | ✓ | ✓ | Single full-sensor frame |

48 MP quad-sensor: iPhone 14 Pro+. 24 MP: iPhone 15+ (Camera-app default). 24/48 MP also on the telephoto (iPhone 16 Pro) and ultra-wide (iPhone 17) cameras. Deferred processing is what makes the multi-frame 18/24 MP resolutions practical — processing happens in the background without holding capture-session memory.

```swift
// 1. Configure the output for the largest dimensions you'll request (before commit —
//    changing maxPhotoDimensions after commit triggers a lengthy reconfiguration)
let dims = camera.activeFormat.supportedMaxPhotoDimensions  // [CMVideoDimensions], iOS 16+
photoOutput.maxPhotoDimensions = dims.max { Int($0.width) * Int($0.height) < Int($1.width) * Int($1.height) }!
photoOutput.maxPhotoQualityPrioritization = .quality

// 2. Pre-allocate capture resources as soon as the user enters the mode —
//    otherwise allocation happens at capture time and slows the first shot
let prepareSettings = AVCapturePhotoSettings()
prepareSettings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
prepareSettings.photoQualityPrioritization = .quality
photoOutput.setPreparedPhotoSettingsArray([prepareSettings]) { prepared, error in /* ... */ }

// 3. Capture with a NEW settings object matching the prepared configuration
//    (prepared settings objects cannot be reused for capture)
let settings = AVCapturePhotoSettings()
settings.maxPhotoDimensions = photoOutput.maxPhotoDimensions  // request, not guarantee
settings.photoQualityPrioritization = .quality
photoOutput.capturePhoto(with: settings, delegate: self)

// Actual dimensions + expected processing time arrive in the delegate's
// AVCaptureResolvedPhotoSettings (photoProcessingTimeRange)
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

### Apple ProRAW and HDR

```swift
// Check ProRAW support
if photoOutput.isAppleProRAWSupported {
    photoOutput.isAppleProRAWEnabled = true

    // Capture ProRAW
    let query = photoOutput.isAppleProRAWEnabled
        ? AVCapturePhotoOutput.AppleProRAWQuery(photoOutput)
        : nil
    if let rawType = query?.availableRawPixelFormatTypes.first {
        let settings = AVCapturePhotoSettings(
            rawPixelFormatType: rawType,
            processedFormat: [AVVideoCodecKey: AVVideoCodecType.hevc]
        )
    }
}

// HDR configuration
settings.photoQualityPrioritization = .quality  // Enables computational photography/HDR
// HDR is automatic with .balanced or .quality — no separate toggle needed
```

**Note**: ProRAW requires iPhone 12 Pro or later. HDR is automatic with quality prioritization — Apple's Deep Fusion and Smart HDR are controlled by the system based on the quality setting.

### Resolution

```swift
// Per-shot max dimensions (iOS 16+) — isHighResolutionPhotoEnabled is deprecated.
// Must match one of camera.activeFormat.supportedMaxPhotoDimensions, and be no
// larger than photoOutput.maxPhotoDimensions.
settings.maxPhotoDimensions = CMVideoDimensions(width: 4032, height: 3024)
```

**Note**: `isHighResolutionPhotoEnabled` is deprecated since iOS 16 — use `maxPhotoDimensions` only.

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

### Pro Video Storage `OS27`

Pre-allocated, system-wide storage for high-data-rate captures (e.g. ProRes) giving deterministic file-write performance — normal file I/O is non-deterministic under load (WWDC 2026-303). User controls capacity in Camera settings. Not on visionOS/watchOS.

| API | Notes |
|-----|-------|
| `AVProVideoStorage.isSupported` | Class property — device + OS support |
| `AVProVideoStorage.shared` | Nullable singleton |
| `initialCapacity` / `remainingCapacity` | Bytes; `0` = unconfigured, `-1` = read failure. `initialCapacity` = user-allocated size; `remainingCapacity` decreases while recording |
| `isBusy` | KVO-observable; resizing/file ops in flight — starting a capture while busy raises an exception |
| `openSettings()` | Jump to the Settings allocation UI |
| `AVCaptureMovieFileOutput.isProVideoStorageSupported` / `usesProVideoStorage` | Setting the flag while unsupported raises an exception. Recording writes to pre-allocated storage, then moves to your URL when capture finishes |
| `AVAssetWriter.isProVideoStorageSupported` / `usesProVideoStorage` | Same pair for `AVCaptureVideoDataOutput`-based recording |

Guided adoption flow: camera-capture.md Pattern 9.

---

## Other 27-Cycle Capture Additions `OS27`

| API | What it is |
|-----|------------|
| `AVCaptureBroadcastVideoOutput` | Broadcast-quality video + ancillary data over the DisplayPort hardware interface (USB-C DP Alt Mode). Delegate reports dropped frames; `maxBufferedFrameCount` (default 0 = drop late frames) vs class `maxSupportedBufferedFrameCount`; `resetFrameBuffer()`; `droppedFrameReplacementPolicy` `.repeatPreviousFrame` (default) / `.blackFrame`; `videoSettings` reports the negotiated SMPTE ST 377 (MXF) format. Verify the format supports it via `AVCaptureDevice.Format.unsupportedCaptureOutputClasses` before adding. Not visionOS/watchOS |
| `AVExternalStorageDevice.reasonsNotRecommendedForCaptureUse` | Typed reasons (`.encrypted`, `.unsupportedFileSystem`, `.slowWritingSpeed`, `.unknownWritingSpeed`) replacing the deprecated boolean `isNotRecommendedForCaptureUse` |
| External-sync `AVError` cases (iOS only) | `.followExternalSyncFailed` (-11894), `.externalSyncDeviceFrequencyHigherThanSpecified` (-11895), `.externalSyncDeviceFrequencyLowerThanSpecified` (-11896) for the iOS 26 `AVExternalSyncDevice` frame-sync feature |

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

**WWDC**: 2023-10105, 2026-303, 2026-304, 2026-341

**Docs**: /avfoundation/avcapturesession, /avfoundation/avcapturedevice, /avfoundation/avcapturephotosettings, /avfoundation/avcapturedevice/rotationcoordinator, /avfoundation/avprovideostorage, /avfoundation/avcapturesmartframingmonitor

**Skills**: skills/camera-capture.md, skills/camera-capture-diag.md
