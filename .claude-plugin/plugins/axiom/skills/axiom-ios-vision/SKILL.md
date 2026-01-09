---
name: axiom-ios-vision
description: Use when implementing ANY computer vision feature - image analysis, object detection, pose detection, person segmentation, subject lifting, hand/body pose tracking.
user-invocable: false
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

```
User asks about computer vision
  ├─ Implementing?
  │   ├─ Pose detection (hand/body)? → vision
  │   ├─ Subject segmentation? → vision
  │   ├─ Text recognition/OCR? → vision
  │   ├─ Barcode/QR scanning? → vision
  │   ├─ Document scanning? → vision
  │   └─ Live camera scanning? → vision (DataScannerViewController)
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
