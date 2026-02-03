---
name: axiom-camera-capture-diag
description: camera freezes, preview rotated wrong, capture slow, session interrupted, black preview, front camera mirrored, camera not starting, AVCaptureSession errors, startRunning blocks, phone call interrupts camera
license: MIT
compatibility: iOS 17+, iPadOS 17+, macOS 14+, tvOS 17+
metadata:
  version: "1.0.0"
  last-updated: "2026-01-03"
---

# Camera Capture Diagnostics

Systematic troubleshooting for AVFoundation camera issues: frozen preview, wrong rotation, slow capture, session interruptions, and permission problems.

## Overview

**Core Principle**: When camera doesn't work, the problem is usually:
1. **Threading** (session work on main thread) - 35%
2. **Session lifecycle** (not started, interrupted, not configured) - 25%
3. **Rotation** (deprecated APIs, missing coordinator) - 20%
4. **Permissions** (denied, not requested) - 15%
5. **Configuration** (wrong preset, missing input/output) - 5%

**Always check threading and session state BEFORE debugging capture logic.**

## Red Flags

Symptoms that indicate camera-specific issues:

| Symptom | Likely Cause |
|---------|--------------|
| Preview shows black screen | Session not started, permission denied, no camera input |
| UI freezes when opening camera | `startRunning()` called on main thread |
| Camera freezes on phone call | No interruption handling |
| Preview rotated 90° wrong | Not using RotationCoordinator (iOS 17+) |
| Captured photo rotated wrong | Rotation angle not applied to output connection |
| Front camera photo not mirrored | This is correct! (preview mirrors, photo does not) |
| "Camera in use by another app" | Another app has exclusive access |
| Capture takes 2+ seconds | `photoQualityPrioritization` set to `.quality` |
| Session won't start on iPad | Split View - camera unavailable |
| Crash on older iOS | Using iOS 17+ APIs without availability check |

## Mandatory First Steps

Before investigating code, run these diagnostics:

### Step 1: Check Session State

```swift
print("📷 Session state:")
print("  isRunning: \(session.isRunning)")
print("  inputs: \(session.inputs.count)")
print("  outputs: \(session.outputs.count)")

for input in session.inputs {
    if let deviceInput = input as? AVCaptureDeviceInput {
        print("  Input: \(deviceInput.device.localizedName)")
    }
}

for output in session.outputs {
    print("  Output: \(type(of: output))")
}
```

**Expected output**:
- ✅ isRunning: true, inputs ≥ 1, outputs ≥ 1 → Session working
- ⚠️ isRunning: false → Session not started or interrupted
- ❌ inputs: 0 → Camera not added (permission? configuration?)

### Step 2: Check Threading

```swift
print("🧵 Thread check:")

// When setting up session
sessionQueue.async {
    print("  Setup thread: \(Thread.isMainThread ? "❌ MAIN" : "✅ Background")")
}

// When starting session
sessionQueue.async {
    print("  Start thread: \(Thread.isMainThread ? "❌ MAIN" : "✅ Background")")
}
```

**Expected output**:
- ✅ All background → Correct
- ❌ Any main thread → UI will freeze

### Step 3: Check Permissions

```swift
let status = AVCaptureDevice.authorizationStatus(for: .video)
print("🔐 Camera permission: \(status.rawValue)")

switch status {
case .authorized: print("  ✅ Authorized")
case .notDetermined: print("  ⚠️ Not yet requested")
case .denied: print("  ❌ Denied by user")
case .restricted: print("  ❌ Restricted (parental controls?)")
@unknown default: print("  ❓ Unknown")
}
```

### Step 4: Check for Interruptions

```swift
// Add temporary observer to see interruptions
NotificationCenter.default.addObserver(
    forName: .AVCaptureSessionWasInterrupted,
    object: session,
    queue: .main
) { notification in
    if let reason = notification.userInfo?[AVCaptureSessionInterruptionReasonKey] as? Int {
        print("🚨 Interrupted: reason \(reason)")
    }
}
```

## Decision Tree

```
Camera not working as expected?
│
├─ Black/frozen preview?
│  ├─ Check Step 1 (session state)
│  │  ├─ isRunning = false → See Pattern 1 (session not started)
│  │  ├─ inputs = 0 → See Pattern 2 (no camera input)
│  │  └─ isRunning = true, inputs > 0 → See Pattern 3 (preview layer)
│
├─ UI freezes when opening camera?
│  └─ Check Step 2 (threading)
│     └─ Main thread → See Pattern 4 (move to session queue)
│
├─ Camera freezes during use?
│  ├─ After phone call → See Pattern 5 (interruption handling)
│  ├─ In Split View (iPad) → See Pattern 6 (multitasking)
│  └─ Random freezes → See Pattern 7 (thermal pressure)
│
├─ Preview/photo rotated wrong?
│  ├─ Preview rotated → See Pattern 8 (RotationCoordinator preview)
│  ├─ Captured photo rotated → See Pattern 9 (capture rotation)
│  └─ Front camera "wrong" → See Pattern 10 (mirroring expected)
│
├─ Capture too slow?
│  ├─ 2+ seconds delay → See Pattern 11 (quality prioritization)
│  └─ Slight delay → See Pattern 12 (deferred processing)
│
├─ Permission issues?
│  ├─ Status: notDetermined → See Pattern 13 (request permission)
│  └─ Status: denied → See Pattern 14 (settings prompt)
│
└─ Crash on some devices?
   └─ See Pattern 15 (API availability)
```

## Diagnostic Patterns

### Pattern 1: Session Not Started

**Symptom**: Black preview, `isRunning = false`

**Common causes**:
1. `startRunning()` never called
2. `startRunning()` called but session has no inputs
3. Session stopped and never restarted

**Diagnostic**:
```swift
// Check if startRunning was called
print("isRunning before start: \(session.isRunning)")
session.startRunning()
print("isRunning after start: \(session.isRunning)")
```

**Fix**:
```swift
// Ensure session is started on session queue
func startSession() {
    sessionQueue.async { [self] in
        guard !session.isRunning else { return }

        // Verify we have inputs before starting
        guard !session.inputs.isEmpty else {
            print("❌ Cannot start - no inputs configured")
            return
        }

        session.startRunning()
    }
}
```

**Time to fix**: 10 min

### Pattern 2: No Camera Input

**Symptom**: `session.inputs.count = 0`

**Common causes**:
1. Camera permission denied
2. `AVCaptureDeviceInput` creation failed
3. `canAddInput()` returned false
4. Configuration not committed

**Diagnostic**:
```swift
// Step through input setup
guard let camera = AVCaptureDevice.default(for: .video) else {
    print("❌ No camera device found")
    return
}
print("✅ Camera: \(camera.localizedName)")

do {
    let input = try AVCaptureDeviceInput(device: camera)
    print("✅ Input created")

    if session.canAddInput(input) {
        print("✅ Can add input")
    } else {
        print("❌ Cannot add input - check session preset compatibility")
    }
} catch {
    print("❌ Input creation failed: \(error)")
}
```

**Fix**: Ensure permission is granted BEFORE creating input, and wrap in configuration block:
```swift
session.beginConfiguration()
// Add input here
session.commitConfiguration()
```

**Time to fix**: 15 min

### Pattern 3: Preview Layer Not Connected

**Symptom**: `isRunning = true`, inputs configured, but preview is black

**Common causes**:
1. Preview layer session not set
2. Preview layer not in view hierarchy
3. Preview layer frame is zero

**Diagnostic**:
```swift
print("Preview layer session: \(previewLayer.session != nil)")
print("Preview layer superlayer: \(previewLayer.superlayer != nil)")
print("Preview layer frame: \(previewLayer.frame)")
print("Preview layer connection: \(previewLayer.connection != nil)")
```

**Fix**:
```swift
// Ensure preview layer is properly configured
previewLayer.session = session
previewLayer.videoGravity = .resizeAspectFill

// Ensure frame is set (common in SwiftUI)
previewLayer.frame = view.bounds
```

**Time to fix**: 10 min

### Pattern 4: Main Thread Blocking

**Symptom**: UI freezes for 1-3 seconds when camera opens

**Root cause**: `startRunning()` is a blocking call executed on main thread

**Diagnostic**:
```swift
// If this prints on main thread, that's the problem
print("startRunning on thread: \(Thread.current)")
session.startRunning()
```

**Fix**:
```swift
// Create dedicated serial queue
private let sessionQueue = DispatchQueue(label: "camera.session")

func startSession() {
    sessionQueue.async { [self] in
        session.startRunning()
    }
}
```

**Time to fix**: 15 min

### Pattern 5: Phone Call Interruption

**Symptom**: Camera works, then freezes when phone call comes in

**Root cause**: Session interrupted but no handling/UI feedback

**Diagnostic**:
```swift
// Check if session is still running after returning from call
print("Session running: \(session.isRunning)")
// Will be false during active call, true after call ends
```

**Fix**: Add interruption observers (see camera-capture skill Pattern 5)

**Key point**: Session AUTOMATICALLY resumes after interruption ends. You don't need to call `startRunning()` again. Just update your UI.

**Time to fix**: 30 min

### Pattern 6: Split View Camera Unavailable

**Symptom**: Camera stops working when iPad enters Split View

**Root cause**: Camera not available with multiple foreground apps

**Diagnostic**:
```swift
// Check interruption reason
// InterruptionReason.videoDeviceNotAvailableWithMultipleForegroundApps
```

**Fix**: Show appropriate UI message and resume when user exits Split View:
```swift
case .videoDeviceNotAvailableWithMultipleForegroundApps:
    showMessage("Camera unavailable in Split View. Use full screen.")
```

**Time to fix**: 15 min

### Pattern 7: Thermal Pressure

**Symptom**: Camera stops randomly, especially after prolonged use

**Root cause**: Device getting hot, system reducing resources

**Diagnostic**:
```swift
// Check thermal state
print("Thermal state: \(ProcessInfo.processInfo.thermalState.rawValue)")
// 0 = nominal, 1 = fair, 2 = serious, 3 = critical
```

**Fix**: Reduce quality or show cooling message:
```swift
case .videoDeviceNotAvailableDueToSystemPressure:
    // Reduce quality
    session.sessionPreset = .medium
    showMessage("Camera quality reduced due to device temperature")
```

**Time to fix**: 20 min

### Pattern 8: Preview Rotation Wrong

**Symptom**: Preview is rotated 90° from expected

**Root cause**: Not using RotationCoordinator (iOS 17+) or not observing updates

**Diagnostic**:
```swift
print("Preview connection rotation: \(previewLayer.connection?.videoRotationAngle ?? -1)")
```

**Fix**:
```swift
// Create and observe RotationCoordinator
let coordinator = AVCaptureDevice.RotationCoordinator(device: camera, previewLayer: previewLayer)

// Set initial rotation
previewLayer.connection?.videoRotationAngle = coordinator.videoRotationAngleForHorizonLevelPreview

// Observe changes
observation = coordinator.observe(\.videoRotationAngleForHorizonLevelPreview) { [weak previewLayer] coord, _ in
    DispatchQueue.main.async {
        previewLayer?.connection?.videoRotationAngle = coord.videoRotationAngleForHorizonLevelPreview
    }
}
```

**Time to fix**: 30 min

### Pattern 9: Captured Photo Rotation Wrong

**Symptom**: Preview looks correct, but captured photo is rotated

**Root cause**: Rotation angle not applied to photo output connection

**Diagnostic**:
```swift
if let connection = photoOutput.connection(with: .video) {
    print("Photo connection rotation: \(connection.videoRotationAngle)")
}
```

**Fix**:
```swift
func capturePhoto() {
    // Apply current rotation to capture
    if let connection = photoOutput.connection(with: .video) {
        connection.videoRotationAngle = rotationCoordinator.videoRotationAngleForHorizonLevelCapture
    }

    photoOutput.capturePhoto(with: settings, delegate: self)
}
```

**Time to fix**: 15 min

### Pattern 10: Front Camera Mirroring

**Symptom**: Designer says "front camera photo doesn't match preview"

**Reality**: This is CORRECT behavior, not a bug.

**Explanation**:
- Preview is mirrored (like looking in a mirror - user expectation)
- Captured photo is NOT mirrored (text reads correctly when shared)
- This matches the system Camera app behavior

**If business requires mirrored photos** (selfie apps):
```swift
func mirrorImage(_ image: UIImage) -> UIImage? {
    guard let cgImage = image.cgImage else { return nil }
    return UIImage(cgImage: cgImage, scale: image.scale, orientation: .upMirrored)
}
```

**Time to fix**: 5 min (explanation) or 15 min (if mirroring required)

### Pattern 11: Slow Capture (Quality Priority)

**Symptom**: Photo capture takes 2+ seconds

**Root cause**: `photoQualityPrioritization = .quality` (default for some devices)

**Diagnostic**:
```swift
print("Max quality prioritization: \(photoOutput.maxPhotoQualityPrioritization.rawValue)")
// Check what you're requesting in AVCapturePhotoSettings
```

**Fix**:
```swift
var settings = AVCapturePhotoSettings()

// For fast capture (social/sharing)
settings.photoQualityPrioritization = .speed

// For balanced (general use)
settings.photoQualityPrioritization = .balanced

// Only use .quality when image quality is critical
```

**Time to fix**: 5 min

### Pattern 12: Deferred Processing

**Symptom**: Want maximum responsiveness (zero-shutter-lag)

**Solution**: Enable deferred processing (iOS 17+)
```swift
photoOutput.isAutoDeferredPhotoDeliveryEnabled = true

// Then handle proxy in delegate:
// - didFinishProcessingPhoto gives proxy for immediate display
// - didFinishCapturingDeferredPhotoProxy gives final image later
```

**Time to fix**: 30 min

### Pattern 13: Permission Not Requested

**Symptom**: `authorizationStatus = .notDetermined`

**Fix**:
```swift
// Must request before setting up session
Task {
    let granted = await AVCaptureDevice.requestAccess(for: .video)
    if granted {
        setupSession()
    }
}
```

**Time to fix**: 10 min

### Pattern 14: Permission Denied

**Symptom**: `authorizationStatus = .denied`

**Fix**: Show settings prompt
```swift
func showSettingsPrompt() {
    let alert = UIAlertController(
        title: "Camera Access Required",
        message: "Please enable camera access in Settings to use this feature.",
        preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "Settings", style: .default) { _ in
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    })
    alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
    present(alert, animated: true)
}
```

**Time to fix**: 15 min

### Pattern 15: API Availability Crash

**Symptom**: Crash on iOS 16 or earlier

**Root cause**: Using iOS 17+ APIs without availability check

**Fix**:
```swift
if #available(iOS 17.0, *) {
    // Use RotationCoordinator
    let coordinator = AVCaptureDevice.RotationCoordinator(device: camera, previewLayer: preview)
} else {
    // Fallback to deprecated videoOrientation
    if let connection = previewLayer.connection {
        connection.videoOrientation = .portrait
    }
}
```

**Time to fix**: 20 min

## Quick Reference Table

| Symptom | Check First | Likely Pattern |
|---------|-------------|----------------|
| Black preview | Step 1 (session state) | 1, 2, or 3 |
| UI freezes | Step 2 (threading) | 4 |
| Freezes on call | Step 4 (interruptions) | 5 |
| Wrong rotation | Print rotation angle | 8 or 9 |
| Slow capture | Print quality setting | 11 |
| Denied access | Step 3 (permissions) | 14 |
| Crash on old iOS | Check @available | 15 |

## Checklist

Before escalating camera issues:

**Basics**:
- ☑ Session has at least one input
- ☑ Session has at least one output
- ☑ Session isRunning = true
- ☑ Preview layer connected to session
- ☑ Preview layer has non-zero frame

**Threading**:
- ☑ All session work on sessionQueue
- ☑ startRunning() on background thread
- ☑ UI updates on main thread

**Permissions**:
- ☑ Authorization status checked
- ☑ Permission requested if notDetermined
- ☑ Graceful UI for denied state

**Rotation**:
- ☑ RotationCoordinator created with device AND previewLayer
- ☑ Observation set up for preview angle changes
- ☑ Capture angle applied when taking photos

**Interruptions**:
- ☑ Interruption observer registered
- ☑ UI feedback for interrupted state
- ☑ Tested with incoming phone call

## Resources

**WWDC**: 2021-10247, 2023-10105

**Docs**: /avfoundation/avcapturesession, /avfoundation/avcapturesessionwasinterruptednotification

**Skills**: axiom-camera-capture, axiom-camera-capture-ref
