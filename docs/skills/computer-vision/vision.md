# Vision Framework Computer Vision

Guides you through implementing people-focused computer vision: subject segmentation, hand/body pose detection, person detection, and combining Vision APIs to solve complex problems.

## Overview

The Vision framework provides computer vision capabilities for:
- **Subject segmentation** - Isolate foreground objects from backgrounds
- **Hand pose detection** - 21 landmarks per hand for gesture recognition
- **Body pose detection** - 18 joints (2D) or 17 joints (3D) for fitness/action classification
- **Person segmentation** - Separate masks for up to 4 people
- **Face detection** - Bounding boxes and detailed landmarks

## When to Use This Skill

Use when you need to:
- ☑ Isolate subjects from backgrounds (subject lifting)
- ☑ Detect and track hand poses for gestures
- ☑ Detect and track body poses for fitness/action classification
- ☑ Segment multiple people separately
- ☑ **Exclude hands from object bounding boxes** (combining APIs)
- ☑ Choose between VisionKit and Vision framework
- ☑ Combine Vision with CoreImage for compositing

## Key Decision Trees

### API Selection

```
What do you need to do?

Isolate subject(s) from background?
├─ Need system UI → VisionKit (ImageAnalysisInteraction)
├─ Need custom pipeline/HDR → Vision (VNGenerateForegroundInstanceMaskRequest)
└─ Need to EXCLUDE hands → Combine subject mask + hand pose

Segment people?
├─ All people in one mask → VNGeneratePersonSegmentationRequest
└─ Separate mask per person → VNGeneratePersonInstanceMaskRequest (up to 4)

Detect hand pose/gestures?
└─ 21 hand landmarks → VNDetectHumanHandPoseRequest

Detect body pose?
├─ 2D normalized landmarks → VNDetectHumanBodyPoseRequest
├─ 3D real-world coordinates → VNDetectHumanBodyPose3DRequest
└─ Action classification → Body pose + CreateML model
```

## Common Use Cases

### Isolate Object While Excluding Hand

The most common request: Getting a bounding box around an object held in hand, **without including the hand**.

**Problem**: `VNGenerateForegroundInstanceMaskRequest` is class-agnostic and treats hand+object as one subject.

**Solution**: Combine subject mask with hand pose detection to create exclusion mask.

See the full skill for implementation details.

### VisionKit Simple Subject Lifting

Add system-like subject lifting UI with just a few lines:

```swift
let interaction = ImageAnalysisInteraction()
interaction.preferredInteractionTypes = .imageSubject
imageView.addInteraction(interaction)
```

### Hand Gesture Recognition

Detect pinch gestures for custom camera controls:

```swift
let request = VNDetectHumanHandPoseRequest()
let thumbTip = try observation.recognizedPoint(.thumbTip)
let indexTip = try observation.recognizedPoint(.indexTip)

let distance = hypot(
    thumbTip.location.x - indexTip.location.x,
    thumbTip.location.y - indexTip.location.y
)

let isPinching = distance < 0.05  // Threshold
```

## Common Pitfalls

- ❌ Processing on main thread (blocks UI)
- ❌ Ignoring confidence scores (low confidence = unreliable)
- ❌ Forgetting to convert coordinates (lower-left vs top-left origin)
- ❌ Setting `maximumHandCount` too high (performance impact)
- ❌ Using ARKit when Vision suffices (offline processing)

## Platform Support

| API | Minimum Version |
|-----|-----------------|
| Subject segmentation (instance masks) | iOS 17+ |
| VisionKit subject lifting | iOS 16+ |
| Hand pose | iOS 14+ |
| Body pose (2D) | iOS 14+ |
| Body pose (3D) | iOS 17+ |
| Person instance segmentation | iOS 17+ |

## Related Resources

- [Vision Framework API Reference](/reference/vision-ref) - Complete API docs with code examples
- [Vision Framework Diagnostics](/reference/vision-diag) - Troubleshooting when things go wrong

### WWDC Sessions

- [WWDC23-10176: Lift subjects from images in your app](https://developer.apple.com/videos/play/wwdc2023/10176/)
- [WWDC23-111241: 3D body pose and person segmentation](https://developer.apple.com/videos/play/wwdc2023/111241/)
- [WWDC20-10653: Detect Body and Hand Pose with Vision](https://developer.apple.com/videos/play/wwdc2020/10653/)

### Apple Documentation

- [Vision Framework](https://developer.apple.com/documentation/vision)
- [VisionKit Framework](https://developer.apple.com/documentation/visionkit)
