# Vision Framework Computer Vision

Guides you through implementing computer vision: subject segmentation, hand/body pose detection, person detection, text recognition (OCR), barcode/QR scanning, document scanning, and combining Vision APIs to solve complex problems.

## Overview

The Vision framework provides computer vision capabilities for:
- **Subject segmentation** - Isolate foreground objects from backgrounds
- **Hand pose detection** - 21 landmarks per hand for gesture recognition
- **Body pose detection** - 18 joints (2D) or 17 joints (3D) for fitness/action classification
- **Person segmentation** - Separate masks for up to 4 people
- **Face detection** - Bounding boxes and detailed landmarks
- **Text recognition** - Fast or accurate OCR with language support
- **Barcode/QR detection** - 20+ symbologies with revision history
- **Document scanning** - Edge detection, perspective correction, structured extraction (iOS 26+)
- **Live scanning** - DataScannerViewController for real-time text/barcode (iOS 16+)

## When to Use This Skill

Use when you need to:
- ☑ Isolate subjects from backgrounds (subject lifting)
- ☑ Detect and track hand poses for gestures
- ☑ Detect and track body poses for fitness/action classification
- ☑ Segment multiple people separately
- ☑ **Exclude hands from object bounding boxes** (combining APIs)
- ☑ Choose between VisionKit and Vision framework
- ☑ Combine Vision with CoreImage for compositing
- ☑ **Recognize text in images** (OCR)
- ☑ **Scan barcodes and QR codes**
- ☑ **Scan documents with perspective correction**
- ☑ **Build live camera scanning** (DataScannerViewController)

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

Recognize text?
├─ Static image → VNRecognizeTextRequest (fast or accurate)
├─ Live camera → DataScannerViewController (iOS 16+)
└─ Need custom words → VNRecognizeTextRequest.customWords

Detect barcodes?
├─ Static image → VNDetectBarcodesRequest
├─ Live camera → DataScannerViewController (iOS 16+)
└─ Need specific symbologies → Set .symbologies property

Scan documents?
├─ Need system UI → VNDocumentCameraViewController (iOS 13+)
├─ Need structured data (iOS 26+) → RecognizeDocumentsRequest
└─ Programmatic edges → VNDetectDocumentSegmentationRequest
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

### Text Recognition (OCR)

Recognize text in images with fast or accurate modes:

```swift
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate  // or .fast
request.recognitionLanguages = ["en-US"]
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: image)
try handler.perform([request])

let observations = request.results ?? []
let text = observations.compactMap { $0.topCandidates(1).first?.string }
```

### Live Camera Scanning (DataScannerViewController)

Scan barcodes and text in real-time with iOS 16+ VisionKit:

```swift
let scanner = DataScannerViewController(
    recognizedDataTypes: [
        .barcode(symbologies: [.qr, .ean13]),
        .text(textContentType: .URL)
    ],
    qualityLevel: .balanced
)

scanner.delegate = self
present(scanner, animated: true) {
    try? scanner.startScanning()
}
```

## Common Pitfalls

- ❌ Processing on main thread (blocks UI)
- ❌ Ignoring confidence scores (low confidence = unreliable)
- ❌ Forgetting to convert coordinates (lower-left vs top-left origin)
- ❌ Setting `maximumHandCount` too high (performance impact)
- ❌ Using ARKit when Vision suffices (offline processing)
- ❌ Using `.fast` text recognition when accuracy matters
- ❌ Not checking `DataScannerViewController.isSupported` before using
- ❌ Processing every video frame (use frame skipping for performance)

## Platform Support

| API | Minimum Version |
|-----|-----------------|
| Subject segmentation (instance masks) | iOS 17+ |
| VisionKit subject lifting | iOS 16+ |
| Hand pose | iOS 14+ |
| Body pose (2D) | iOS 14+ |
| Body pose (3D) | iOS 17+ |
| Person instance segmentation | iOS 17+ |
| Text recognition (VNRecognizeTextRequest) | iOS 13+ |
| Barcode detection (VNDetectBarcodesRequest) | iOS 11+ |
| DataScannerViewController | iOS 16+ |
| Document camera (VNDocumentCameraViewController) | iOS 13+ |
| RecognizeDocumentsRequest (structured) | iOS 26+ |

## Related Resources

- [Vision Framework API Reference](/reference/vision-ref) - Complete API docs with code examples
- [Vision Framework Diagnostics](/reference/vision-diag) - Troubleshooting when things go wrong

### WWDC Sessions

- [WWDC23-10176: Lift subjects from images in your app](https://developer.apple.com/videos/play/wwdc2023/10176/)
- [WWDC23-111241: 3D body pose and person segmentation](https://developer.apple.com/videos/play/wwdc2023/111241/)
- [WWDC20-10653: Detect Body and Hand Pose with Vision](https://developer.apple.com/videos/play/wwdc2020/10653/)
- [WWDC19-234: Text Recognition in Vision Framework](https://developer.apple.com/videos/play/wwdc2019/234/)
- [WWDC21-10041: Extract document data using Vision](https://developer.apple.com/videos/play/wwdc2021/10041/)
- [WWDC22-10024: What's new in Vision](https://developer.apple.com/videos/play/wwdc2022/10024/)
- [WWDC22-10025: Capture machine-readable codes and text](https://developer.apple.com/videos/play/wwdc2022/10025/)
- [WWDC25-272: Read documents using the Vision framework](https://developer.apple.com/videos/play/wwdc2025/272/)

### Apple Documentation

- [Vision Framework](https://developer.apple.com/documentation/axiom-vision)
- [VisionKit Framework](https://developer.apple.com/documentation/visionkit)
