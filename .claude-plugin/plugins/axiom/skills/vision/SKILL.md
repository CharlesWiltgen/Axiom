---
name: vision
description: subject segmentation, VNGenerateForegroundInstanceMaskRequest, isolate object from hand, VisionKit subject lifting, image foreground detection, instance masks, class-agnostic segmentation
skill_type: discipline
version: 1.0.0
last_updated: 2025-12-20
apple_platforms: iOS 14+, iPadOS 14+, macOS 11+, tvOS 14+, visionOS 1+
---

# Vision Framework Computer Vision

Guides you through implementing people-focused computer vision: subject segmentation, hand/body pose detection, person detection, and combining Vision APIs to solve complex problems.

## When to Use This Skill

Use when you need to:
- ☑ Isolate subjects from backgrounds (subject lifting)
- ☑ Detect and track hand poses for gestures
- ☑ Detect and track body poses for fitness/action classification
- ☑ Segment multiple people separately
- ☑ Exclude hands from object bounding boxes (combining APIs)
- ☑ Choose between VisionKit and Vision framework
- ☑ Combine Vision with CoreImage for compositing
- ☑ Decide which Vision API solves your problem

## Example Prompts

"How do I isolate a subject from the background?"
"I need to detect hand gestures like pinch"
"How can I get a bounding box around an object **without including the hand holding it**?"
"Should I use VisionKit or Vision framework for subject lifting?"
"How do I segment multiple people separately?"
"I need to detect body poses for a fitness app"
"How do I preserve HDR when compositing subjects on new backgrounds?"

## Red Flags

Signs you're making this harder than it needs to be:
- ❌ Manually implementing subject segmentation with CoreML models
- ❌ Using ARKit just for body pose (Vision works offline)
- ❌ Writing gesture recognition from scratch (use hand pose + simple distance checks)
- ❌ Processing on main thread (blocks UI - Vision is resource intensive)
- ❌ Training custom models when Vision APIs already exist
- ❌ Not checking confidence scores (low confidence = unreliable landmarks)
- ❌ Forgetting to convert coordinates (lower-left origin vs UIKit top-left)

## Mandatory First Steps

Before implementing any Vision feature:

### 1. Choose the Right API (Decision Tree)

```
What do you need to do?

┌─ Isolate subject(s) from background?
│  ├─ Need system UI + out-of-process → VisionKit
│  │  └─ ImageAnalysisInteraction (iOS/iPadOS)
│  │  └─ ImageAnalysisOverlayView (macOS)
│  ├─ Need custom pipeline / HDR / large images → Vision
│  │  └─ VNGenerateForegroundInstanceMaskRequest
│  └─ Need to EXCLUDE hands from object → Combine APIs
│     └─ Subject mask + Hand pose + custom masking (see Pattern 1)
│
├─ Segment people?
│  ├─ All people in one mask → VNGeneratePersonSegmentationRequest
│  └─ Separate mask per person (up to 4) → VNGeneratePersonInstanceMaskRequest
│
├─ Detect hand pose/gestures?
│  ├─ Just hand location → VNDetectHumanRectanglesRequest
│  └─ 21 hand landmarks → VNDetectHumanHandPoseRequest
│     └─ Gesture recognition → Hand pose + distance checks
│
├─ Detect body pose?
│  ├─ 2D normalized landmarks → VNDetectHumanBodyPoseRequest
│  ├─ 3D real-world coordinates → VNDetectHumanBodyPose3DRequest
│  └─ Action classification → Body pose + CreateML model
│
├─ Face detection?
│  ├─ Just bounding boxes → VNDetectFaceRectanglesRequest
│  └─ Detailed landmarks → VNDetectFaceLandmarksRequest
│
└─ Person detection (location only)?
   └─ VNDetectHumanRectanglesRequest
```

### 2. Set Up Background Processing

**NEVER run Vision on main thread**:

```swift
let processingQueue = DispatchQueue(label: "com.yourapp.vision", qos: .userInitiated)

processingQueue.async {
    do {
        let request = VNGenerateForegroundInstanceMaskRequest()
        let handler = VNImageRequestHandler(cgImage: image)
        try handler.perform([request])

        // Process observations...

        DispatchQueue.main.async {
            // Update UI
        }
    } catch {
        // Handle error
    }
}
```

### 3. Verify Platform Availability

| API | Minimum Version |
|-----|-----------------|
| Subject segmentation (instance masks) | iOS 17+ |
| VisionKit subject lifting | iOS 16+ |
| Hand pose | iOS 14+ |
| Body pose (2D) | iOS 14+ |
| Body pose (3D) | iOS 17+ |
| Person instance segmentation | iOS 17+ |

## Common Patterns

### Pattern 1: Isolate Object While Excluding Hand

**User's original problem**: Getting a bounding box around an object held in hand, **without including the hand**.

**Root cause**: `VNGenerateForegroundInstanceMaskRequest` is class-agnostic and treats hand+object as one subject.

**Solution**: Combine subject mask with hand pose to create exclusion mask.

```swift
// 1. Get subject instance mask
let subjectRequest = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: sourceImage)
try handler.perform([subjectRequest])

guard let subjectObservation = subjectRequest.results?.first as? VNInstanceMaskObservation else {
    fatalError("No subject detected")
}

// 2. Get hand pose landmarks
let handRequest = VNDetectHumanHandPoseRequest()
handRequest.maximumHandCount = 2
try handler.perform([handRequest])

guard let handObservation = handRequest.results?.first as? VNHumanHandPoseObservation else {
    // No hand detected - use full subject mask
    let mask = try subjectObservation.createScaledMask(
        for: subjectObservation.allInstances,
        croppedToInstancesContent: false
    )
    return mask
}

// 3. Create hand exclusion region from landmarks
let handPoints = try handObservation.recognizedPoints(.all)
let handBounds = calculateConvexHull(from: handPoints)  // Your implementation

// 4. Subtract hand region from subject mask using CoreImage
let subjectMask = try subjectObservation.createScaledMask(
    for: subjectObservation.allInstances,
    croppedToInstancesContent: false
)

let subjectCIMask = CIImage(cvPixelBuffer: subjectMask)
let handMask = createMaskFromRegion(handBounds, size: sourceImage.size)
let finalMask = subtractMasks(handMask: handMask, from: subjectCIMask)

// 5. Calculate bounding box from final mask
let objectBounds = calculateBoundingBox(from: finalMask)
```

**Helper: Convex Hull**

```swift
func calculateConvexHull(from points: [VNRecognizedPointKey: VNRecognizedPoint]) -> CGRect {
    // Get high-confidence points
    let validPoints = points.values.filter { $0.confidence > 0.5 }

    guard !validPoints.isEmpty else { return .zero }

    // Simple bounding rect (for more accuracy, use actual convex hull algorithm)
    let xs = validPoints.map { $0.location.x }
    let ys = validPoints.map { $0.location.y }

    let minX = xs.min()!
    let maxX = xs.max()!
    let minY = ys.min()!
    let maxY = ys.max()!

    return CGRect(
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    )
}
```

**Cost**: 2-5 hours initial implementation, 30 min ongoing maintenance

### Pattern 2: VisionKit Simple Subject Lifting

**Use case**: Add system-like subject lifting UI with minimal code.

```swift
// iOS
let interaction = ImageAnalysisInteraction()
interaction.preferredInteractionTypes = .imageSubject
imageView.addInteraction(interaction)

// macOS
let overlayView = ImageAnalysisOverlayView()
overlayView.preferredInteractionTypes = .imageSubject
nsView.addSubview(overlayView)
```

**When to use**:
- ✓ Want system behavior (long-press to select, drag to share)
- ✓ Don't need custom processing pipeline
- ✓ Image size within VisionKit limits (out-of-process)

**Cost**: 15 min implementation, 5 min ongoing

### Pattern 3: Programmatic Subject Access (VisionKit)

**Use case**: Need subject images/bounds without UI interaction.

```swift
let analyzer = ImageAnalyzer()
let configuration = ImageAnalyzer.Configuration([.text, .visualLookUp])

let analysis = try await analyzer.analyze(sourceImage, configuration: configuration)

// Get all subjects
for subject in analysis.subjects {
    let subjectImage = subject.image
    let subjectBounds = subject.bounds

    // Process subject...
}

// Tap-based lookup
if let subject = try await analysis.subject(at: tapPoint) {
    let compositeImage = try await analysis.image(for: [subject])
}
```

**Cost**: 30 min implementation, 10 min ongoing

### Pattern 4: Vision Instance Mask for Custom Pipeline

**Use case**: HDR preservation, large images, custom compositing.

```swift
let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: sourceImage)
try handler.perform([request])

guard let observation = request.results?.first as? VNInstanceMaskObservation else {
    return
}

// Get soft segmentation mask
let mask = try observation.createScaledMask(
    for: observation.allInstances,
    croppedToInstancesContent: false  // Full resolution for compositing
)

// Use with CoreImage for HDR preservation
let filter = CIFilter(name: "CIBlendWithMask")!
filter.setValue(CIImage(cgImage: sourceImage), forKey: kCIInputImageKey)
filter.setValue(CIImage(cvPixelBuffer: mask), forKey: kCIInputMaskImageKey)
filter.setValue(newBackground, forKey: kCIInputBackgroundImageKey)

let compositedImage = filter.outputImage
```

**Cost**: 1 hour implementation, 15 min ongoing

### Pattern 5: Tap-to-Select Instance

**Use case**: User taps to select which subject/person to lift.

```swift
// Get instance at tap point
let instance = observation.instanceAtPoint(tapPoint)

if instance == 0 {
    // Background tapped - select all instances
    let mask = try observation.createScaledMask(
        for: observation.allInstances,
        croppedToInstancesContent: false
    )
} else {
    // Specific instance tapped
    let mask = try observation.createScaledMask(
        for: IndexSet(integer: instance),
        croppedToInstancesContent: true
    )
}
```

**Alternative: Raw pixel buffer access**

```swift
let instanceMask = observation.instanceMask

CVPixelBufferLockBaseAddress(instanceMask, .readOnly)
defer { CVPixelBufferUnlockBaseAddress(instanceMask, .readOnly) }

let baseAddress = CVPixelBufferGetBaseAddress(instanceMask)
let bytesPerRow = CVPixelBufferGetBytesPerRow(instanceMask)

// Convert normalized tap to pixel coordinates
let pixelPoint = VNImagePointForNormalizedPoint(
    tapPoint,
    width: imageWidth,
    height: imageHeight
)

let offset = Int(pixelPoint.y) * bytesPerRow + Int(pixelPoint.x)
let label = UnsafeRawPointer(baseAddress!).load(
    fromByteOffset: offset,
    as: UInt8.self
)
```

**Cost**: 45 min implementation, 10 min ongoing

### Pattern 6: Hand Gesture Recognition (Pinch)

**Use case**: Detect pinch gesture for custom camera trigger or UI control.

```swift
let request = VNDetectHumanHandPoseRequest()
request.maximumHandCount = 1

try handler.perform([request])

guard let observation = request.results?.first as? VNHumanHandPoseObservation else {
    return
}

let thumbTip = try observation.recognizedPoint(.thumbTip)
let indexTip = try observation.recognizedPoint(.indexTip)

// Check confidence
guard thumbTip.confidence > 0.5, indexTip.confidence > 0.5 else {
    return
}

// Calculate distance (normalized coordinates)
let dx = thumbTip.location.x - indexTip.location.x
let dy = thumbTip.location.y - indexTip.location.y
let distance = sqrt(dx * dx + dy * dy)

let isPinching = distance < 0.05  // Adjust threshold

// State machine for evidence accumulation
if isPinching {
    pinchFrameCount += 1
    if pinchFrameCount >= 3 {
        state = .pinched
    }
} else {
    pinchFrameCount = max(0, pinchFrameCount - 1)
    if pinchFrameCount == 0 {
        state = .apart
    }
}
```

**Cost**: 2 hours implementation, 20 min ongoing

### Pattern 7: Separate Multiple People

**Use case**: Apply different effects to each person or count people.

```swift
let request = VNGeneratePersonInstanceMaskRequest()
try handler.perform([request])

guard let observation = request.results?.first as? VNInstanceMaskObservation else {
    return
}

let peopleCount = observation.allInstances.count  // Up to 4

for personIndex in observation.allInstances {
    let personMask = try observation.createScaledMask(
        for: IndexSet(integer: personIndex),
        croppedToInstancesContent: false
    )

    // Apply effect to this person only
    applyEffect(to: personMask, personIndex: personIndex)
}
```

**Crowded scenes (>4 people)**:

```swift
// Count faces to detect crowding
let faceRequest = VNDetectFaceRectanglesRequest()
try handler.perform([faceRequest])

let faceCount = faceRequest.results?.count ?? 0

if faceCount > 4 {
    // Fallback: Use single mask for all people
    let singleMaskRequest = VNGeneratePersonSegmentationRequest()
    try handler.perform([singleMaskRequest])
}
```

**Cost**: 1.5 hours implementation, 15 min ongoing

### Pattern 8: Body Pose for Action Classification

**Use case**: Fitness app that recognizes exercises (jumping jacks, squats, etc.)

```swift
// 1. Collect body pose observations
var poseObservations: [VNHumanBodyPoseObservation] = []

let request = VNDetectHumanBodyPoseRequest()
try handler.perform([request])

if let observation = request.results?.first as? VNHumanBodyPoseObservation {
    poseObservations.append(observation)
}

// 2. When you have 60 frames of poses, prepare for CreateML model
if poseObservations.count == 60 {
    var multiArray = try MLMultiArray(
        shape: [60, 18, 3],  // 60 frames, 18 joints, (x, y, confidence)
        dataType: .double
    )

    for (frameIndex, observation) in poseObservations.enumerated() {
        let allPoints = try observation.recognizedPoints(.all)

        for (jointIndex, (_, point)) in allPoints.enumerated() {
            multiArray[[frameIndex, jointIndex, 0] as [NSNumber]] = NSNumber(value: point.location.x)
            multiArray[[frameIndex, jointIndex, 1] as [NSNumber]] = NSNumber(value: point.location.y)
            multiArray[[frameIndex, jointIndex, 2] as [NSNumber]] = NSNumber(value: point.confidence)
        }
    }

    // 3. Run inference with CreateML model
    let input = YourActionClassifierInput(poses: multiArray)
    let output = try actionClassifier.prediction(input: input)

    let action = output.label  // "jumping_jacks", "squats", etc.
}
```

**Cost**: 3-4 hours implementation, 1 hour ongoing

## Anti-Patterns

### Anti-Pattern 1: Processing on Main Thread

**Wrong**:
```swift
let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: image)
try handler.perform([request])  // Blocks UI!
```

**Right**:
```swift
DispatchQueue.global(qos: .userInitiated).async {
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: image)
    try handler.perform([request])

    DispatchQueue.main.async {
        // Update UI
    }
}
```

**Why it matters**: Vision is resource-intensive. Blocking main thread freezes UI.

### Anti-Pattern 2: Ignoring Confidence Scores

**Wrong**:
```swift
let thumbTip = try observation.recognizedPoint(.thumbTip)
let location = thumbTip.location  // May be unreliable!
```

**Right**:
```swift
let thumbTip = try observation.recognizedPoint(.thumbTip)
guard thumbTip.confidence > 0.5 else {
    // Low confidence - landmark unreliable
    return
}
let location = thumbTip.location
```

**Why it matters**: Low confidence points are inaccurate (occlusion, blur, edge of frame).

### Anti-Pattern 3: Forgetting Coordinate Conversion

**Wrong** (mixing coordinate systems):
```swift
// Vision uses lower-left origin
let visionPoint = recognizedPoint.location  // (0, 0) = bottom-left

// UIKit uses top-left origin
let uiPoint = CGPoint(x: visionPoint.x, y: visionPoint.y)  // WRONG!
```

**Right**:
```swift
let visionPoint = recognizedPoint.location

// Convert to UIKit coordinates
let uiPoint = CGPoint(
    x: visionPoint.x * imageWidth,
    y: (1 - visionPoint.y) * imageHeight  // Flip Y axis
)
```

**Why it matters**: Mismatched origins cause UI overlays to appear in wrong positions.

### Anti-Pattern 4: Setting maximumHandCount Too High

**Wrong**:
```swift
let request = VNDetectHumanHandPoseRequest()
request.maximumHandCount = 10  // "Just in case"
```

**Right**:
```swift
let request = VNDetectHumanHandPoseRequest()
request.maximumHandCount = 2  // Only compute what you need
```

**Why it matters**: Performance scales with `maximumHandCount`. Pose computed for all detected hands ≤ max.

### Anti-Pattern 5: Using ARKit When Vision Suffices

**Wrong** (if you don't need AR):
```swift
// Requires AR session just for body pose
let arSession = ARBodyTrackingConfiguration()
```

**Right**:
```swift
// Vision works offline on still images
let request = VNDetectHumanBodyPoseRequest()
```

**Why it matters**: ARKit body pose requires rear camera, AR session, supported devices. Vision works everywhere (even offline).

## Pressure Scenarios

### Scenario 1: "Just Ship the Feature"

**Context**: Product manager wants subject lifting "like in Photos app" by Friday. You're considering skipping background processing.

**Pressure**: "It's working on my iPhone 15 Pro, let's ship it."

**Reality**: Vision blocks UI on older devices. Users on iPhone 12 will experience frozen app.

**Correct action**:
1. Implement background queue (15 min)
2. Add loading indicator (10 min)
3. Test on iPhone 12 or earlier (5 min)

**Push-back template**: "Subject lifting works, but it freezes the UI on older devices. I need 30 minutes to add background processing and prevent 1-star reviews."

### Scenario 2: "Training Our Own Model"

**Context**: Designer wants to exclude hands from subject bounding box. Engineer suggests training custom CoreML model for specific object detection.

**Pressure**: "We need perfect bounds, let's train a model."

**Reality**: Training requires labeled dataset (weeks), ongoing maintenance, and still won't generalize to new objects. Built-in Vision APIs + hand pose solve it in 2-5 hours.

**Correct action**:
1. Explain Pattern 1 (combine subject mask + hand pose)
2. Prototype in 1 hour to demonstrate
3. Compare against training timeline (weeks vs hours)

**Push-back template**: "Training a model takes weeks and only works for specific objects. I can combine Vision APIs to solve this in a few hours and it'll work for any object."

### Scenario 3: "We Can't Wait for iOS 17"

**Context**: You need instance masks but app supports iOS 15+.

**Pressure**: "Just use iOS 15 person segmentation and ship it."

**Reality**: `VNGeneratePersonSegmentationRequest` (iOS 15) returns single mask for all people. Doesn't solve multi-person use case.

**Correct action**:
1. Raise minimum deployment target to iOS 17 (best UX)
2. OR implement fallback: use iOS 15 API but disable multi-person features
3. OR use `@available` to conditionally enable features

**Push-back template**: "Person segmentation on iOS 15 combines all people into one mask. We can either require iOS 17 for the best experience, or disable multi-person features on older OS versions. Which do you prefer?"

## Checklist

Before shipping Vision features:

**Performance**:
- ☑ All Vision requests run on background queue
- ☑ UI shows loading indicator during processing
- ☑ Tested on iPhone 12 or earlier (not just latest devices)
- ☑ `maximumHandCount` set to minimum needed value

**Accuracy**:
- ☑ Confidence scores checked before using landmarks
- ☑ Fallback behavior for low confidence observations
- ☑ Handles case where no subjects/hands/people detected

**Coordinates**:
- ☑ Vision coordinates (lower-left origin) converted to UIKit (top-left)
- ☑ Normalized coordinates scaled to pixel dimensions
- ☑ UI overlays aligned correctly with image

**Platform Support**:
- ☑ `@available` checks for iOS 17+ APIs (instance masks)
- ☑ Fallback for iOS 14-16 (or raised deployment target)
- ☑ Tested on actual devices, not just simulator

**Edge Cases**:
- ☑ Handles images with no detectable subjects
- ☑ Handles partially occluded hands/bodies
- ☑ Handles hands/bodies near image edges
- ☑ Handles >4 people for person instance segmentation

**CoreImage Integration** (if applicable):
- ☑ HDR preservation verified with high dynamic range images
- ☑ Mask resolution matches source image
- ☑ `croppedToInstancesContent` set appropriately (false for compositing)

## Resources

**Related Axiom skills**:
- `vision-ref` — Complete API reference with code examples
- `vision-diag` — Troubleshooting when Vision doesn't work

**WWDC sessions**:
- WWDC23-10176: Lift subjects from images in your app
- WWDC23-111241: 3D body pose and person segmentation
- WWDC20-10653: Detect Body and Hand Pose with Vision

**Apple documentation**:
- [Vision Framework](https://developer.apple.com/documentation/vision)
- [VisionKit Framework](https://developer.apple.com/documentation/visionkit)
