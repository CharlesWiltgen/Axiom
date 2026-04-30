# camera-auditor

Scans Swift code for camera, video, and audio capture issues — both known anti-patterns like main-thread session work, deprecated `videoOrientation`, missing interruption observers, and `UIImagePickerController` for photos, and architectural gaps like missing `sessionRuntimeError` recovery, concurrent session queues, missing audio session deactivation, and stuck permission-denied UI when the user returns from Settings.

## What It Does

- Detects 10 known anti-patterns (main-thread `startRunning`, deprecated `videoOrientation`, missing `sessionWasInterrupted`/`sessionInterruptionEnded` observers, `UIImagePickerController` with `.photoLibrary`, over-requesting `PHPhotoLibrary.requestAuthorization`, missing `photoQualityPrioritization`, wrong `AVAudioSession` category for recording, missing purpose strings, configuration outside `beginConfiguration` block, synchronous photo loading)
- Identifies architectural gaps (missing `sessionRuntimeError` observer + restart logic, concurrent session queue letting reconfiguration race, no Open-Settings guidance after permission denial and no `didBecomeActiveNotification` re-check on return, hot session left running in background, missing `AVAudioSession.setActive(false)` on end, missing audio interruption handling, stale rotation tracking on iOS 17+ without `RotationCoordinator`, deprecated `AVCaptureDevice.devices()` enumeration vs `DiscoverySession`, non-atomic reconfiguration, `AVCaptureMultiCamSession` without `isMultiCamSupported` check, `try!` on `loadTransferable`)
- Correlates findings that compound into higher severity (main-thread + heavy initial config, missing interruption + audio capture, missing purpose strings + capture session, deprecated `videoOrientation` + iOS 17+ deployment, AVAudioSession `.playback` + video recording produces silent files)
- Produces a Capture Reliability Health Score (RELIABLE / FRAGILE / BROKEN)

## How to Use

**Natural language:**
- "Can you check my camera code for issues?"
- "Audit my capture implementation"
- "Is my camera code following best practices?"
- "Check for deprecated camera APIs"
- "Review my AVFoundation capture code"

**Explicit command:**
```bash
/axiom:audit camera
```

## Related

- **camera-capture** skill — session setup, rotation handling, interruption recovery patterns
- **camera-capture-ref** skill — full AVCaptureSession/AVCaptureDevice/RotationCoordinator API reference
- **camera-capture-diag** skill — decision trees for camera freezes, black preview, rotation bugs
- **photo-library** skill — PHPicker/PhotosPicker patterns
- **avfoundation-ref** skill — AVAudioSession category and activation rules
- **concurrency-auditor** agent — overlaps on main-thread session work and sample-buffer processing
- **security-privacy-scanner** agent — overlaps on `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, photo library purpose strings
- **energy-auditor** agent — overlaps on hot session left running in background and HEVC encoding pressure
- **swift-performance-analyzer** agent — overlaps on ARC overhead in `AVCaptureVideoDataOutput` sample-buffer paths
- **storage-auditor** agent — overlaps on saved photo/video file location and `isExcludedFromBackup`
- **health-check** agent — includes camera-auditor in project-wide scans
