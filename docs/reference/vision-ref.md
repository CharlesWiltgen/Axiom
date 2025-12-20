# Vision Framework API Reference

Comprehensive reference for Vision framework people-focused computer vision: subject segmentation, hand/body pose detection, person detection, and face analysis.

## Overview

Vision provides computer vision algorithms for still images and video. This reference covers all people-focused APIs with complete code examples.

**Core workflow**:
1. Create request (e.g., `VNDetectHumanHandPoseRequest()`)
2. Create handler with image (`VNImageRequestHandler(cgImage: image)`)
3. Perform request (`try handler.perform([request])`)
4. Access observations from `request.results`

## API Categories

### Subject Segmentation

- **VNGenerateForegroundInstanceMaskRequest** (iOS 17+)
  - Class-agnostic subject detection
  - Returns instance masks for individual objects
  - Use with CoreImage for HDR compositing

- **VisionKit APIs** (iOS 16+)
  - `ImageAnalysisInteraction` / `ImageAnalysisOverlayView`
  - System UI for subject lifting
  - Programmatic access via `ImageAnalyzer`

### Person Segmentation

- **VNGeneratePersonInstanceMaskRequest** (iOS 17+)
  - Separate masks for up to 4 people
  - Per-person effects and counting

- **VNGeneratePersonSegmentationRequest** (iOS 15+)
  - Single mask for all people
  - Background removal

### Hand Pose Detection

- **VNDetectHumanHandPoseRequest** (iOS 14+)
  - 21 hand landmarks per hand
  - Gesture recognition support
  - Configurable `maximumHandCount`

### Body Pose Detection

- **VNDetectHumanBodyPoseRequest** (iOS 14+)
  - 18 body landmarks (2D)
  - Normalized coordinates

- **VNDetectHumanBodyPose3DRequest** (iOS 17+)
  - 17 body joints (3D)
  - Real-world coordinates in meters
  - Supports depth data input

### Face Detection

- **VNDetectFaceRectanglesRequest** (iOS 11+)
  - Face bounding boxes only

- **VNDetectFaceLandmarksRequest** (iOS 11+)
  - Detailed facial landmarks
  - Pupil locations (Revision 3+)

## Code Examples

### Subject Segmentation

```swift
let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: image)
try handler.perform([request])

guard let observation = request.results?.first as? VNInstanceMaskObservation else {
    return
}

// Get soft segmentation mask
let mask = try observation.createScaledMask(
    for: observation.allInstances,
    croppedToInstancesContent: false
)
```

### Hand Pose Detection

```swift
let request = VNDetectHumanHandPoseRequest()
request.maximumHandCount = 2

try handler.perform([request])

for observation in request.results as? [VNHumanHandPoseObservation] ?? [] {
    let thumbTip = try observation.recognizedPoint(.thumbTip)
    let indexTip = try observation.recognizedPoint(.indexTip)

    // Check confidence
    guard thumbTip.confidence > 0.5, indexTip.confidence > 0.5 else {
        continue
    }

    // Calculate distance for pinch gesture
    let distance = hypot(
        thumbTip.location.x - indexTip.location.x,
        thumbTip.location.y - indexTip.location.y
    )
}
```

### CoreImage Compositing

```swift
// Preserve HDR with CoreImage
let filter = CIFilter(name: "CIBlendWithMask")!
filter.setValue(sourceImage, forKey: kCIInputImageKey)
filter.setValue(CIImage(cvPixelBuffer: mask), forKey: kCIInputMaskImageKey)
filter.setValue(newBackground, forKey: kCIInputBackgroundImageKey)

let output = filter.outputImage
```

## Quick Reference Tables

### Subject Segmentation APIs

| API | Platform | Purpose |
|-----|----------|---------|
| `VNGenerateForegroundInstanceMaskRequest` | iOS 17+ | Class-agnostic subject instances |
| `VNGeneratePersonInstanceMaskRequest` | iOS 17+ | Up to 4 people separately |
| `VNGeneratePersonSegmentationRequest` | iOS 15+ | All people (single mask) |
| `ImageAnalysisInteraction` (VisionKit) | iOS 16+ | UI for subject lifting |

### Pose Detection APIs

| API | Platform | Landmarks | Coordinates |
|-----|----------|-----------|-------------|
| `VNDetectHumanHandPoseRequest` | iOS 14+ | 21 per hand | 2D normalized |
| `VNDetectHumanBodyPoseRequest` | iOS 14+ | 18 body joints | 2D normalized |
| `VNDetectHumanBodyPose3DRequest` | iOS 17+ | 17 body joints | 3D meters |

### Observation Types

| Observation | Returned By |
|-------------|-------------|
| `VNInstanceMaskObservation` | Foreground/person instance masks |
| `VNPixelBufferObservation` | Person segmentation (single mask) |
| `VNHumanHandPoseObservation` | Hand pose |
| `VNHumanBodyPoseObservation` | Body pose (2D) |
| `VNHumanBodyPose3DObservation` | Body pose (3D) |
| `VNFaceObservation` | Face detection/landmarks |

## Coordinate System

Vision uses **lower-left origin** with **normalized coordinates** (0.0-1.0).

**Converting to UIKit** (top-left origin):

```swift
let visionPoint = recognizedPoint.location

let uiPoint = CGPoint(
    x: visionPoint.x * imageWidth,
    y: (1 - visionPoint.y) * imageHeight  // Flip Y axis
)
```

## Performance Considerations

- **Always use background queue** - Vision is resource intensive
- **Set `maximumHandCount` appropriately** - Pose computed for all detected hands ≤ max
- **Check confidence scores** - Low confidence landmarks are unreliable
- **Downscale images** - 1280x720 sufficient for most real-time use cases

## Resources

- [Vision Framework (Main Skill)](/skills/computer-vision/vision) - Decision trees and patterns
- [Vision Diagnostics](/reference/vision-diag) - Troubleshooting guide

### WWDC Sessions

- [WWDC 2023 - Session 10176: Lift subjects from images in your app](https://developer.apple.com/videos/play/wwdc2023/10176/)
- [WWDC 2023 - Session 111241: 3D body pose and person segmentation](https://developer.apple.com/videos/play/wwdc2023/111241/)
- [WWDC 2020 - Session 10653: Detect Body and Hand Pose with Vision](https://developer.apple.com/videos/play/wwdc2020/10653/)

### Apple Documentation

- [Vision Framework](https://developer.apple.com/documentation/vision)
- [VisionKit Framework](https://developer.apple.com/documentation/visionkit)
