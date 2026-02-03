---
name: axiom-ios-vision
description: Use when implementing ANY computer vision feature - image analysis, object detection, pose detection, person segmentation, subject lifting, hand/body pose tracking.
license: MIT
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
- Recognizing text in images (OCR)
- Detecting barcodes or QR codes
- Scanning documents
- Using VisionKit or DataScannerViewController

## Routing Logic

### Vision Work

**Implementation patterns** → `/skill axiom-vision`
- Subject segmentation (VisionKit)
- Hand pose detection (21 landmarks)
- Body pose detection (2D/3D)
- Person segmentation
- Face detection
- Isolating objects while excluding hands
- Text recognition (VNRecognizeTextRequest)
- Barcode/QR detection (VNDetectBarcodesRequest)
- Document scanning (VNDocumentCameraViewController)
- Live scanning (DataScannerViewController)
- Structured document extraction (RecognizeDocumentsRequest, iOS 26+)

**API reference** → `/skill axiom-vision-ref`
- Complete Vision framework API
- VNDetectHumanHandPoseRequest
- VNDetectHumanBodyPoseRequest
- VNGenerateForegroundInstanceMaskRequest
- VNRecognizeTextRequest (fast/accurate modes)
- VNDetectBarcodesRequest (symbologies)
- DataScannerViewController delegates
- RecognizeDocumentsRequest (iOS 26+)
- Coordinate conversion patterns

**Diagnostics** → `/skill axiom-vision-diag`
- Subject not detected
- Hand pose missing landmarks
- Low confidence observations
- Performance issues
- Coordinate conversion bugs
- Text not recognized or wrong characters
- Barcodes not detected
- DataScanner showing blank or no items
- Document edges not detected

## Decision Tree

1. Implementing (pose, segmentation, OCR, barcodes, documents, live scanning)? → vision
2. Need API reference / code examples? → vision-ref
3. Debugging issues (detection failures, confidence, coordinates)? → vision-diag

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Vision framework is just a request/handler pattern" | Vision has coordinate conversion, confidence thresholds, and performance gotchas. vision covers them. |
| "I'll handle text recognition without the skill" | VNRecognizeTextRequest has fast/accurate modes and language-specific settings. vision has the patterns. |
| "Subject segmentation is straightforward" | Instance masks have HDR compositing and hand-exclusion patterns. vision covers complex scenarios. |

## Critical Patterns

**vision**:
- Subject segmentation with VisionKit
- Hand pose detection (21 landmarks)
- Body pose detection (2D/3D, up to 4 people)
- Isolating objects while excluding hands
- CoreImage HDR compositing
- Text recognition (fast vs accurate modes)
- Barcode detection (symbology selection)
- Document scanning with perspective correction
- Live scanning with DataScannerViewController
- Structured document extraction (iOS 26+)

**vision-diag**:
- Subject detection failures
- Landmark tracking issues
- Performance optimization
- Observation confidence thresholds
- Text recognition failures (language, contrast)
- Barcode detection issues (symbology, distance)
- DataScanner troubleshooting
- Document edge detection problems

## Example Invocations

User: "How do I detect hand pose in an image?"
→ Invoke: `/skill axiom-vision`

User: "Isolate a subject but exclude the user's hands"
→ Invoke: `/skill axiom-vision`

User: "How do I read text from an image?"
→ Invoke: `/skill axiom-vision`

User: "Scan QR codes with the camera"
→ Invoke: `/skill axiom-vision`

User: "How do I implement document scanning?"
→ Invoke: `/skill axiom-vision`

User: "Use DataScannerViewController for live text"
→ Invoke: `/skill axiom-vision`

User: "Subject detection isn't working"
→ Invoke: `/skill axiom-vision-diag`

User: "Text recognition returns wrong characters"
→ Invoke: `/skill axiom-vision-diag`

User: "Barcode not being detected"
→ Invoke: `/skill axiom-vision-diag`

User: "Show me VNDetectHumanBodyPoseRequest examples"
→ Invoke: `/skill axiom-vision-ref`

User: "What symbologies does VNDetectBarcodesRequest support?"
→ Invoke: `/skill axiom-vision-ref`

User: "RecognizeDocumentsRequest API reference"
→ Invoke: `/skill axiom-vision-ref`
