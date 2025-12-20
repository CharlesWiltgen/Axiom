---
name: ios-vision
description: Use when implementing ANY computer vision feature - image analysis, object detection, pose detection, person segmentation, subject lifting, hand/body pose tracking.
---

# iOS Computer Vision Router

**You MUST use this skill for ANY computer vision work using the Vision framework.**

## When to Use

Use this router when:
- Analyzing images or video
- Detecting objects, faces, or people
- Tracking hand or body pose
- Segmenting people or subjects
- Lifting subjects from backgrounds
- Using VisionKit

## Routing Logic

### Vision Work

**Implementation patterns** → `/skill vision`
- Subject segmentation (VisionKit)
- Hand pose detection (21 landmarks)
- Body pose detection (2D/3D)
- Person segmentation
- Face detection
- Isolating objects while excluding hands

**API reference** → `/skill vision-ref`
- Complete Vision framework API
- VNDetectHumanHandPoseRequest
- VNDetectHumanBodyPoseRequest
- VNGenerateForegroundInstanceMaskRequest
- Coordinate conversion patterns

**Diagnostics** → `/skill vision-diag`
- Subject not detected
- Hand pose missing landmarks
- Low confidence observations
- Performance issues
- Coordinate conversion bugs

## Decision Tree

```
User asks about computer vision
  ├─ Implementing? → vision
  ├─ Need API reference? → vision-ref
  └─ Debugging issues? → vision-diag
```

## Critical Patterns

**vision**:
- Subject segmentation with VisionKit
- Hand pose detection (21 landmarks)
- Body pose detection (2D/3D, up to 4 people)
- Isolating objects while excluding hands
- CoreImage HDR compositing

**vision-diag**:
- Subject detection failures
- Landmark tracking issues
- Performance optimization
- Observation confidence thresholds

## Example Invocations

User: "How do I detect hand pose in an image?"
→ Invoke: `/skill vision`

User: "Isolate a subject but exclude the user's hands"
→ Invoke: `/skill vision`

User: "Subject detection isn't working"
→ Invoke: `/skill vision-diag`

User: "Show me VNDetectHumanBodyPoseRequest examples"
→ Invoke: `/skill vision-ref`
