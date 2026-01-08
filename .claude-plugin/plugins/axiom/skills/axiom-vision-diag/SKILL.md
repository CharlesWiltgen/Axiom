---
name: axiom-vision-diag
description: subject not detected, hand pose missing landmarks, low confidence observations, Vision performance, coordinate conversion, VisionKit errors, observation nil, text not recognized, barcode not detected, DataScannerViewController not working, document scan issues
user-invocable: false
skill_type: diagnostic
version: 1.1.0
last_updated: 2026-01-03
apple_platforms: iOS 11+, iPadOS 11+, macOS 10.13+, tvOS 11+, axiom-visionOS 1+
---

# Vision Framework Diagnostics

Systematic troubleshooting for Vision framework issues: subjects not detected, missing landmarks, low confidence, performance problems, coordinate mismatches, text recognition failures, barcode detection issues, and document scanning problems.

## Overview

**Core Principle**: When Vision doesn't work, the problem is usually:
1. **Environment** (lighting, occlusion, edge of frame) - 40%
2. **Confidence threshold** (ignoring low confidence data) - 30%
3. **Threading** (blocking main thread causes frozen UI) - 15%
4. **Coordinates** (mixing lower-left and top-left origins) - 10%
5. **API availability** (using iOS 17+ APIs on older devices) - 5%

**Always check environment and confidence BEFORE debugging code.**

## Red Flags

Symptoms that indicate Vision-specific issues:

| Symptom | Likely Cause |
|---------|--------------|
| Subject not detected at all | Edge of frame, poor lighting, very small subject |
| Hand landmarks intermittently nil | Hand near edge, parallel to camera, glove/occlusion |
| Body pose skipped frames | Person bent over, upside down, flowing clothing |
| UI freezes during processing | Running Vision on main thread |
| Overlays in wrong position | Coordinate conversion (lower-left vs top-left) |
| Crash on older devices | Using iOS 17+ APIs without `@available` check |
| Person segmentation misses people | >4 people in scene (instance mask limit) |
| Low FPS in camera feed | `maximumHandCount` too high, not dropping frames |
| Text not recognized at all | Blurry image, stylized font, wrong recognition level |
| Text misread (wrong characters) | Language correction disabled, missing custom words |
| Barcode not detected | Wrong symbology, code too small, glare/reflection |
| DataScanner shows blank screen | Camera access denied, device not supported |
| Document edges not detected | Low contrast, non-rectangular, glare |
| Real-time scanning too slow | Processing every frame, region too large |

## Mandatory First Steps

Before investigating code, run these diagnostics:

### Step 1: Verify Detection with Diagnostic Code

```swift
let request = VNGenerateForegroundInstanceMaskRequest()  // Or hand/body pose
let handler = VNImageRequestHandler(cgImage: testImage)

do {
    try handler.perform([request])

    if let results = request.results {
        print("✅ Request succeeded")
        print("Result count: \(results.count)")

        if let observation = results.first as? VNInstanceMaskObservation {
            print("All instances: \(observation.allInstances)")
            print("Instance count: \(observation.allInstances.count)")
        }
    } else {
        print("⚠️ Request succeeded but no results")
    }
} catch {
    print("❌ Request failed: \(error)")
}
```

**Expected output**:
- ✅ Request succeeded, instance count > 0 → Detection working
- ⚠️ Request succeeded, instance count = 0 → Nothing detected (see Decision Tree)
- ❌ Request failed → API availability issue

### Step 2: Check Confidence Scores

```swift
// For hand/body pose
if let observation = request.results?.first as? VNHumanHandPoseObservation {
    let allPoints = try observation.recognizedPoints(.all)

    for (key, point) in allPoints {
        print("\(key): confidence \(point.confidence)")

        if point.confidence < 0.3 {
            print("  ⚠️ LOW CONFIDENCE - unreliable")
        }
    }
}
```

**Expected output**:
- Most landmarks > 0.5 confidence → Good detection
- Many landmarks < 0.3 → Poor lighting, occlusion, or edge of frame

### Step 3: Verify Threading

```swift
print("🧵 Thread: \(Thread.current)")

if Thread.isMainThread {
    print("❌ Running on MAIN THREAD - will block UI!")
} else {
    print("✅ Running on background thread")
}
```

**Expected output**:
- ✅ Background thread → Correct
- ❌ Main thread → Move to `DispatchQueue.global()`

## Decision Tree

```
Vision not working as expected?
│
├─ No results returned?
│  ├─ Check Step 1 output
│  │  ├─ "Request failed" → See Pattern 1a (API availability)
│  │  ├─ "No results" → See Pattern 1b (nothing detected)
│  │  └─ Results but count = 0 → See Pattern 1c (edge of frame)
│
├─ Landmarks have nil/low confidence?
│  ├─ Hand pose → See Pattern 2 (hand detection issues)
│  ├─ Body pose → See Pattern 3 (body detection issues)
│  └─ Face detection → See Pattern 4 (face detection issues)
│
├─ UI freezing/slow?
│  ├─ Check Step 3 (threading)
│  │  ├─ Main thread → See Pattern 5a (move to background)
│  │  └─ Background thread → See Pattern 5b (performance tuning)
│
├─ Overlays in wrong position?
│  └─ See Pattern 6 (coordinate conversion)
│
├─ Person segmentation missing people?
│  └─ See Pattern 7 (crowded scenes)
│
├─ VisionKit not working?
│  └─ See Pattern 8 (VisionKit specific)
│
├─ Text recognition issues?
│  ├─ No text detected → See Pattern 9a (image quality)
│  ├─ Wrong characters → See Pattern 9b (language/correction)
│  └─ Too slow → See Pattern 9c (recognition level)
│
├─ Barcode detection issues?
│  ├─ Barcode not detected → See Pattern 10a (symbology/size)
│  └─ Wrong payload → See Pattern 10b (barcode quality)
│
├─ DataScannerViewController issues?
│  ├─ Blank screen → See Pattern 11a (availability check)
│  └─ Items not detected → See Pattern 11b (data types)
│
└─ Document scanning issues?
   ├─ Edges not detected → See Pattern 12a (contrast/shape)
   └─ Perspective wrong → See Pattern 12b (corner points)
```

## Diagnostic Patterns

### Pattern 1a: Request Failed (API Availability)

**Symptom**: `try handler.perform([request])` throws error

**Common errors**:
```
"VNGenerateForegroundInstanceMaskRequest is only available on iOS 17.0 or newer"
"VNDetectHumanBodyPose3DRequest is only available on iOS 17.0 or newer"
```

**Root cause**: Using iOS 17+ APIs on older deployment target

**Fix**:

```swift
if #available(iOS 17.0, *) {
    let request = VNGenerateForegroundInstanceMaskRequest()
    // ...
} else {
    // Fallback for iOS 14-16
    let request = VNGeneratePersonSegmentationRequest()
    // ...
}
```

**Prevention**: Check API availability in `axiom-vision-ref` before implementing

**Time to fix**: 10 min

### Pattern 1b: No Results (Nothing Detected)

**Symptom**: `request.results == nil` or `results.isEmpty`

**Diagnostic**:

```swift
// 1. Save debug image to Photos
UIImageWriteToSavedPhotosAlbum(debugImage, nil, nil, nil)

// 2. Inspect visually
// - Is subject too small? (< 10% of image)
// - Is subject blurry?
// - Poor contrast with background?
```

**Common causes**:
- Subject too small (resize or crop closer)
- Subject too blurry (increase lighting, stabilize camera)
- Low contrast (subject same color as background)

**Fix**:

```swift
// Crop image to focus on region of interest
let croppedImage = cropImage(sourceImage, to: regionOfInterest)
let handler = VNImageRequestHandler(cgImage: croppedImage)
```

**Time to fix**: 30 min

### Pattern 1c: Edge of Frame Issues

**Symptom**: Subject detected intermittently as object moves across frame

**Root cause**: Partial occlusion when subject touches image edges

**Diagnostic**:

```swift
// Check if subject is near edges
if let observation = results.first as? VNInstanceMaskObservation {
    let mask = try observation.createScaledMask(
        for: observation.allInstances,
        croppedToInstancesContent: true
    )

    let bounds = calculateMaskBounds(mask)

    if bounds.minX < 0.1 || bounds.maxX > 0.9 ||
       bounds.minY < 0.1 || bounds.maxY > 0.9 {
        print("⚠️ Subject too close to edge")
    }
}
```

**Fix**:

```swift
// Add padding to capture area
let paddedRect = captureRect.insetBy(dx: -20, dy: -20)

// OR guide user with on-screen overlay
overlayView.addSubview(guideBox)  // Visual boundary
```

**Time to fix**: 20 min

### Pattern 2: Hand Pose Issues

**Symptom**: `VNDetectHumanHandPoseRequest` returns nil or low confidence landmarks

**Diagnostic**:

```swift
if let observation = request.results?.first as? VNHumanHandPoseObservation {
    let thumbTip = try? observation.recognizedPoint(.thumbTip)
    let wrist = try? observation.recognizedPoint(.wrist)

    print("Thumb confidence: \(thumbTip?.confidence ?? 0)")
    print("Wrist confidence: \(wrist?.confidence ?? 0)")

    // Check hand orientation
    if let thumb = thumbTip, let wristPoint = wrist {
        let angle = atan2(
            thumb.location.y - wristPoint.location.y,
            thumb.location.x - wristPoint.location.x
        )
        print("Hand angle: \(angle * 180 / .pi) degrees")

        if abs(angle) > 80 && abs(angle) < 100 {
            print("⚠️ Hand parallel to camera (hard to detect)")
        }
    }
}
```

**Common causes**:
| Cause | Confidence Pattern | Fix |
|-------|-------------------|-----|
| Hand near edge | Tips have low confidence | Adjust framing |
| Hand parallel to camera | All landmarks low | Prompt user to rotate hand |
| Gloves/occlusion | Fingers low, wrist high | Remove gloves or change lighting |
| Feet detected as hands | Unexpected hand detected | Add `chirality` check or ignore |

**Fix for parallel hand**:

```swift
// Detect and warn user
if avgConfidence < 0.4 {
    showWarning("Rotate your hand toward the camera")
}
```

**Time to fix**: 45 min

### Pattern 3: Body Pose Issues

**Symptom**: `VNDetectHumanBodyPoseRequest` skips frames or returns low confidence

**Diagnostic**:

```swift
if let observation = request.results?.first as? VNHumanBodyPoseObservation {
    let nose = try? observation.recognizedPoint(.nose)
    let root = try? observation.recognizedPoint(.root)

    if let nosePoint = nose, let rootPoint = root {
        let bodyAngle = atan2(
            nosePoint.location.y - rootPoint.location.y,
            nosePoint.location.x - rootPoint.location.x
        )

        let angleFromVertical = abs(bodyAngle - .pi / 2)

        if angleFromVertical > .pi / 4 {
            print("⚠️ Person bent over or upside down")
        }
    }
}
```

**Common causes**:
| Cause | Solution |
|-------|----------|
| Person bent over | Prompt user to stand upright |
| Upside down (handstand) | Use ARKit instead (better for dynamic poses) |
| Flowing clothing | Increase contrast or use tighter clothing |
| Multiple people overlapping | Use person instance segmentation |

**Time to fix**: 1 hour

### Pattern 4: Face Detection Issues

**Symptom**: `VNDetectFaceRectanglesRequest` misses faces or returns wrong count

**Diagnostic**:

```swift
if let faces = request.results as? [VNFaceObservation] {
    print("Detected \(faces.count) faces")

    for face in faces {
        print("Face bounds: \(face.boundingBox)")
        print("Confidence: \(face.confidence)")

        if face.boundingBox.width < 0.1 {
            print("⚠️ Face too small")
        }
    }
}
```

**Common causes**:
- Face < 10% of image (crop closer)
- Profile view (use face landmarks request instead)
- Poor lighting (increase exposure)

**Time to fix**: 30 min

### Pattern 5a: UI Freezing (Main Thread)

**Symptom**: App freezes when performing Vision request

**Diagnostic** (Step 3 above confirms main thread)

**Fix**:

```swift
// BEFORE (wrong)
let request = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([request])  // Blocks UI

// AFTER (correct)
DispatchQueue.global(qos: .userInitiated).async {
    let request = VNGenerateForegroundInstanceMaskRequest()
    try? handler.perform([request])

    DispatchQueue.main.async {
        // Update UI
    }
}
```

**Time to fix**: 15 min

### Pattern 5b: Performance Issues (Background Thread)

**Symptom**: Already on background thread but still slow / dropping frames

**Diagnostic**:

```swift
let start = CFAbsoluteTimeGetCurrent()

try handler.perform([request])

let elapsed = CFAbsoluteTimeGetCurrent() - start
print("Request took \(elapsed * 1000)ms")

if elapsed > 0.2 {  // 200ms = too slow for real-time
    print("⚠️ Request too slow for real-time processing")
}
```

**Common causes & fixes**:

| Cause | Fix | Time Saved |
|-------|-----|------------|
| `maximumHandCount` = 10 | Set to actual need (e.g., 2) | 50-70% |
| Processing every frame | Skip frames (process every 3rd) | 66% |
| Full-res images | Downscale to 1280x720 | 40-60% |
| Multiple requests per frame | Batch or alternate requests | 30-50% |

**Fix for real-time camera**:

```swift
// Skip frames
frameCount += 1
guard frameCount % 3 == 0 else { return }

// OR downscale
let scaledImage = resizeImage(sourceImage, to: CGSize(width: 1280, height: 720))

// OR set lower hand count
request.maximumHandCount = 2  // Instead of default
```

**Time to fix**: 1 hour

### Pattern 6: Coordinate Conversion

**Symptom**: UI overlays appear in wrong position

**Diagnostic**:

```swift
// Vision point (lower-left origin, normalized)
let visionPoint = recognizedPoint.location
print("Vision point: \(visionPoint)")  // e.g., (0.5, 0.8)

// Convert to UIKit
let uiX = visionPoint.x * imageWidth
let uiY = (1 - visionPoint.y) * imageHeight  // FLIP Y
print("UIKit point: (\(uiX), \(uiY))")

// Verify overlay
overlayView.center = CGPoint(x: uiX, y: uiY)
```

**Common mistakes**:

```swift
// ❌ WRONG (no Y flip)
let uiPoint = CGPoint(
    x: axiom-visionPoint.x * width,
    y: axiom-visionPoint.y * height
)

// ❌ WRONG (forgot to scale from normalized)
let uiPoint = CGPoint(
    x: axiom-visionPoint.x,
    y: 1 - visionPoint.y
)

// ✅ CORRECT
let uiPoint = CGPoint(
    x: axiom-visionPoint.x * width,
    y: (1 - visionPoint.y) * height
)
```

**Time to fix**: 20 min

### Pattern 7: Crowded Scenes (>4 People)

**Symptom**: `VNGeneratePersonInstanceMaskRequest` misses people or combines them

**Diagnostic**:

```swift
// Count faces
let faceRequest = VNDetectFaceRectanglesRequest()
try handler.perform([faceRequest])

let faceCount = faceRequest.results?.count ?? 0
print("Detected \(faceCount) faces")

// Person instance segmentation
let personRequest = VNGeneratePersonInstanceMaskRequest()
try handler.perform([personRequest])

let personCount = (personRequest.results?.first as? VNInstanceMaskObservation)?.allInstances.count ?? 0
print("Detected \(personCount) people")

if faceCount > 4 && personCount <= 4 {
    print("⚠️ Crowded scene - some people combined or missing")
}
```

**Fix**:

```swift
if faceCount > 4 {
    // Fallback: Use single mask for all people
    let singleMaskRequest = VNGeneratePersonSegmentationRequest()
    try handler.perform([singleMaskRequest])

    // OR guide user
    showWarning("Please reduce number of people in frame (max 4)")
}
```

**Time to fix**: 30 min

### Pattern 8: VisionKit Specific Issues

**Symptom**: `ImageAnalysisInteraction` not showing subject lifting UI

**Diagnostic**:

```swift
// 1. Check interaction types
print("Interaction types: \(interaction.preferredInteractionTypes)")

// 2. Check if analysis is set
print("Analysis: \(interaction.analysis != nil ? "set" : "nil")")

// 3. Check if view supports interaction
if let view = interaction.view {
    print("View: \(view)")
} else {
    print("❌ View not set")
}
```

**Common causes**:

| Symptom | Cause | Fix |
|---------|-------|-----|
| No UI appears | `analysis` not set | Call `analyzer.analyze()` and set result |
| UI appears but no subject lifting | Wrong interaction type | Set `.imageSubject` or `.automatic` |
| Crash on interaction | View removed before interaction | Keep view in memory |

**Fix**:

```swift
// Ensure analysis is set
let analyzer = ImageAnalyzer()
let analysis = try await analyzer.analyze(image, configuration: config)

interaction.analysis = analysis  // Required!
interaction.preferredInteractionTypes = .imageSubject
```

**Time to fix**: 20 min

### Pattern 9a: Text Not Detected (Image Quality)

**Symptom**: `VNRecognizeTextRequest` returns no results or empty strings

**Diagnostic**:

```swift
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate

try handler.perform([request])

if request.results?.isEmpty ?? true {
    print("❌ No text detected")

    // Check image quality
    print("Image size: \(image.size)")
    print("Minimum text height: \(request.minimumTextHeight)")
}

for obs in request.results as? [VNRecognizedTextObservation] ?? [] {
    let top = obs.topCandidates(3)
    for candidate in top {
        print("'\(candidate.string)' confidence: \(candidate.confidence)")
    }
}
```

**Common causes**:

| Cause | Symptom | Fix |
|-------|---------|-----|
| Blurry image | No results | Improve lighting, stabilize camera |
| Text too small | No results | Lower `minimumTextHeight` or crop closer |
| Stylized font | Misread or no results | Try `.accurate` recognition level |
| Low contrast | Partial results | Improve lighting, increase image contrast |
| Rotated text | No results with `.fast` | Use `.accurate` (handles rotation) |

**Fix for small text**:

```swift
// Lower minimum text height (default ignores very small text)
request.minimumTextHeight = 0.02  // 2% of image height
```

**Time to fix**: 30 min

### Pattern 9b: Wrong Characters (Language/Correction)

**Symptom**: Text is detected but characters are wrong (e.g., "C001" → "COOL")

**Diagnostic**:

```swift
// Check all candidates, not just first
for observation in results {
    let candidates = observation.topCandidates(5)
    for (i, candidate) in candidates.enumerated() {
        print("Candidate \(i): '\(candidate.string)' (\(candidate.confidence))")
    }
}
```

**Common causes**:

| Input Type | Problem | Fix |
|------------|---------|-----|
| Serial numbers | Language correction "fixes" them | Disable `usesLanguageCorrection` |
| Technical codes | Misread as words | Add to `customWords` |
| Non-English | Wrong ML model | Set correct `recognitionLanguages` |
| House numbers | Stylized → misread | Check all candidates, not just top |

**Fix for codes/serial numbers**:

```swift
let request = VNRecognizeTextRequest()
request.usesLanguageCorrection = false  // Don't "fix" codes

// Post-process with domain knowledge
func correctSerialNumber(_ text: String) -> String {
    text.replacingOccurrences(of: "O", with: "0")
        .replacingOccurrences(of: "l", with: "1")
        .replacingOccurrences(of: "S", with: "5")
}
```

**Time to fix**: 30 min

### Pattern 9c: Text Recognition Too Slow

**Symptom**: Text recognition takes >500ms, real-time camera drops frames

**Diagnostic**:

```swift
let start = CFAbsoluteTimeGetCurrent()
try handler.perform([request])
let elapsed = CFAbsoluteTimeGetCurrent() - start

print("Recognition took \(elapsed * 1000)ms")
print("Recognition level: \(request.recognitionLevel == .fast ? "fast" : "accurate")")
print("Language correction: \(request.usesLanguageCorrection)")
```

**Common causes & fixes**:

| Cause | Fix | Speedup |
|-------|-----|---------|
| Using `.accurate` for real-time | Switch to `.fast` | 3-5x |
| Language correction enabled | Disable for codes | 20-30% |
| Full image processing | Use `regionOfInterest` | 2-4x |
| Processing every frame | Skip frames | 50-70% |

**Fix for real-time**:

```swift
request.recognitionLevel = .fast
request.usesLanguageCorrection = false
request.regionOfInterest = CGRect(x: 0.1, y: 0.3, width: 0.8, height: 0.4)

// Skip frames
frameCount += 1
guard frameCount % 3 == 0 else { return }
```

**Time to fix**: 30 min

### Pattern 10a: Barcode Not Detected (Symbology/Size)

**Symptom**: `VNDetectBarcodesRequest` returns no results

**Diagnostic**:

```swift
let request = VNDetectBarcodesRequest()
// Don't specify symbologies to detect all types
try handler.perform([request])

if let results = request.results as? [VNBarcodeObservation] {
    print("Found \(results.count) barcodes")
    for barcode in results {
        print("Type: \(barcode.symbology)")
        print("Payload: \(barcode.payloadStringValue ?? "nil")")
        print("Bounds: \(barcode.boundingBox)")
    }
} else {
    print("❌ No barcodes detected")
}
```

**Common causes**:

| Cause | Symptom | Fix |
|-------|---------|-----|
| Wrong symbology | Not detected | Don't filter, or add correct type |
| Barcode too small | Not detected | Move camera closer, crop image |
| Glare/reflection | Not detected | Change angle, improve lighting |
| Damaged barcode | Partial/no detection | Clean barcode, improve image |
| Using revision 1 | Only one code | Use revision 2+ for multiple |

**Fix for small barcodes**:

```swift
// Crop to barcode region for better detection
let croppedHandler = VNImageRequestHandler(
    cgImage: croppedImage,
    options: [:]
)
```

**Time to fix**: 20 min

### Pattern 10b: Wrong Barcode Payload

**Symptom**: Barcode detected but `payloadStringValue` is wrong or nil

**Diagnostic**:

```swift
if let barcode = results.first {
    print("String payload: \(barcode.payloadStringValue ?? "nil")")
    print("Raw payload: \(barcode.payloadData ?? Data())")
    print("Symbology: \(barcode.symbology)")
    print("Confidence: Implicit (always 1.0 for barcodes)")
}
```

**Common causes**:

| Cause | Fix |
|-------|-----|
| Binary barcode (not string) | Use `payloadData` instead |
| Damaged code | Re-scan or clean barcode |
| Wrong symbology assumed | Check actual `symbology` value |

**Time to fix**: 15 min

### Pattern 11a: DataScanner Blank Screen

**Symptom**: `DataScannerViewController` shows black/blank when presented

**Diagnostic**:

```swift
// Check support first
print("isSupported: \(DataScannerViewController.isSupported)")
print("isAvailable: \(DataScannerViewController.isAvailable)")

// Check camera permission
let status = AVCaptureDevice.authorizationStatus(for: .video)
print("Camera access: \(status.rawValue)")
```

**Common causes**:

| Symptom | Cause | Fix |
|---------|-------|-----|
| `isSupported = false` | Device lacks camera/chip | Check before presenting |
| `isAvailable = false` | Parental controls or access denied | Request camera permission |
| Black screen | Camera in use by another app | Ensure exclusive access |
| Crash on present | Missing entitlements | Add camera usage description |

**Fix**:

```swift
guard DataScannerViewController.isSupported else {
    showError("Scanning not supported on this device")
    return
}

guard DataScannerViewController.isAvailable else {
    // Request camera access
    AVCaptureDevice.requestAccess(for: .video) { granted in
        // Retry after access granted
    }
    return
}
```

**Time to fix**: 15 min

### Pattern 11b: DataScanner Items Not Detected

**Symptom**: DataScanner shows camera but doesn't recognize items

**Diagnostic**:

```swift
// Check recognized data types
print("Data types: \(scanner.recognizedDataTypes)")

// Add delegate to see what's happening
func dataScanner(_ scanner: DataScannerViewController,
                 didAdd items: [RecognizedItem],
                 allItems: [RecognizedItem]) {
    print("Added \(items.count) items, total: \(allItems.count)")
    for item in items {
        switch item {
        case .text(let text): print("Text: \(text.transcript)")
        case .barcode(let barcode): print("Barcode: \(barcode.payloadStringValue ?? "")")
        @unknown default: break
        }
    }
}
```

**Common causes**:

| Cause | Fix |
|-------|-----|
| Wrong data types | Add correct `.barcode(symbologies:)` or `.text()` |
| Text content type filter | Remove filter or use correct type |
| Camera too close/far | Adjust distance |
| Poor lighting | Improve lighting |

**Time to fix**: 20 min

### Pattern 12a: Document Edges Not Detected

**Symptom**: `VNDetectDocumentSegmentationRequest` returns no results

**Diagnostic**:

```swift
let request = VNDetectDocumentSegmentationRequest()
try handler.perform([request])

if let observation = request.results?.first {
    print("Document found at: \(observation.boundingBox)")
    print("Corners: TL=\(observation.topLeft), TR=\(observation.topRight)")
} else {
    print("❌ No document detected")
}
```

**Common causes**:

| Cause | Fix |
|-------|-----|
| Low contrast | Use contrasting background |
| Non-rectangular | ML expects rectangular documents |
| Glare/reflection | Change lighting angle |
| Document fills frame | Need some background visible |

**Fix**: Use VNDocumentCameraViewController for guided user experience with live feedback.

**Time to fix**: 15 min

### Pattern 12b: Perspective Correction Wrong

**Symptom**: Document extracted but distorted

**Diagnostic**:

```swift
// Verify corner order
print("TopLeft: \(observation.topLeft)")
print("TopRight: \(observation.topRight)")
print("BottomLeft: \(observation.bottomLeft)")
print("BottomRight: \(observation.bottomRight)")

// Check if corners are in expected positions
// TopLeft should have larger Y than BottomLeft (Vision uses lower-left origin)
```

**Common causes**:

| Cause | Fix |
|-------|-----|
| Corner order wrong | Vision uses counterclockwise from top-left |
| Coordinate system | Convert normalized to pixel coordinates |
| Filter parameters wrong | Check CIPerspectiveCorrection parameters |

**Fix**:

```swift
// Scale normalized to image coordinates
func scaled(_ point: CGPoint, to size: CGSize) -> CGPoint {
    CGPoint(x: point.x * size.width, y: point.y * size.height)
}
```

**Time to fix**: 20 min

## Production Crisis Scenario

**Situation**: App Store review rejected for "app freezes when tapping analyze button"

**Triage (5 min)**:
1. Confirm Vision running on main thread → Pattern 5a
2. Verify on older device (iPhone 12) → Freezes
3. Check profiling: 800ms on main thread

**Fix (15 min)**:
```swift
@IBAction func analyzeTapped(_ sender: UIButton) {
    showLoadingIndicator()

    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
        let request = VNGenerateForegroundInstanceMaskRequest()
        // ... perform request

        DispatchQueue.main.async {
            self?.hideLoadingIndicator()
            self?.updateUI(with: results)
        }
    }
}
```

**Communicate to PM**:
"App Store rejection due to Vision processing on main thread. Fixed by moving to background queue (industry standard). Testing on iPhone 12 confirms fix. Safe to resubmit."

## Quick Reference Table

| Symptom | Likely Cause | First Check | Pattern | Est. Time |
|---------|--------------|-------------|---------|-----------|
| No results | Nothing detected | Step 1 output | 1b/1c | 30 min |
| Intermittent detection | Edge of frame | Subject position | 1c | 20 min |
| Hand missing landmarks | Low confidence | Step 2 (confidence) | 2 | 45 min |
| Body pose skipped | Person bent over | Body angle | 3 | 1 hour |
| UI freezes | Main thread | Step 3 (threading) | 5a | 15 min |
| Slow processing | Performance tuning | Request timing | 5b | 1 hour |
| Wrong overlay position | Coordinates | Print points | 6 | 20 min |
| Missing people (>4) | Crowded scene | Face count | 7 | 30 min |
| VisionKit no UI | Analysis not set | Interaction state | 8 | 20 min |
| Text not detected | Image quality | Results count | 9a | 30 min |
| Wrong characters | Language settings | Candidates list | 9b | 30 min |
| Text recognition slow | Recognition level | Timing | 9c | 30 min |
| Barcode not detected | Symbology/size | Results dump | 10a | 20 min |
| Wrong barcode payload | Damaged/binary | Payload data | 10b | 15 min |
| DataScanner blank | Availability | isSupported/isAvailable | 11a | 15 min |
| DataScanner no items | Data types | recognizedDataTypes | 11b | 20 min |
| Document edges missing | Contrast/shape | Results check | 12a | 15 min |
| Perspective wrong | Corner order | Corner positions | 12b | 20 min |

## Resources

**WWDC**: 2019-234, 2021-10041, 2022-10024, 2022-10025, 2025-272, 2023-10176, 2020-10653

**Docs**: /vision, /vision/vnrecognizetextrequest, /visionkit

**Skills**: axiom-vision, axiom-vision-ref
