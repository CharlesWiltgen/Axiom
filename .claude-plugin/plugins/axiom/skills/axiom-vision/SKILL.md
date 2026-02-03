---
name: axiom-vision
description: subject segmentation, VNGenerateForegroundInstanceMaskRequest, isolate object from hand, VisionKit subject lifting, image foreground detection, instance masks, class-agnostic segmentation, VNRecognizeTextRequest, OCR, VNDetectBarcodesRequest, DataScannerViewController, document scanning, RecognizeDocumentsRequest
license: MIT
compatibility: iOS 14+, iPadOS 14+, macOS 11+, tvOS 14+, axiom-visionOS 1+
metadata:
  version: "1.1.0"
  last-updated: "2026-01-03"
---

# Vision Framework Computer Vision

Guides you through implementing computer vision: subject segmentation, hand/body pose detection, person detection, text recognition, barcode detection, document scanning, and combining Vision APIs to solve complex problems.

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
- ☑ Recognize text in images (OCR)
- ☑ Detect barcodes and QR codes
- ☑ Scan documents with perspective correction
- ☑ Extract structured data from documents (iOS 26+)
- ☑ Build live scanning experiences (DataScannerViewController)

## Example Prompts

"How do I isolate a subject from the background?"
"I need to detect hand gestures like pinch"
"How can I get a bounding box around an object **without including the hand holding it**?"
"Should I use VisionKit or Vision framework for subject lifting?"
"How do I segment multiple people separately?"
"I need to detect body poses for a fitness app"
"How do I preserve HDR when compositing subjects on new backgrounds?"
"How do I recognize text in an image?"
"I need to scan QR codes from camera"
"How do I extract data from a receipt?"
"Should I use DataScannerViewController or Vision directly?"
"How do I scan documents and correct perspective?"
"I need to extract table data from a document"

## Red Flags

Signs you're making this harder than it needs to be:
- ❌ Manually implementing subject segmentation with CoreML models
- ❌ Using ARKit just for body pose (Vision works offline)
- ❌ Writing gesture recognition from scratch (use hand pose + simple distance checks)
- ❌ Processing on main thread (blocks UI - Vision is resource intensive)
- ❌ Training custom models when Vision APIs already exist
- ❌ Not checking confidence scores (low confidence = unreliable landmarks)
- ❌ Forgetting to convert coordinates (lower-left origin vs UIKit top-left)
- ❌ Building custom text recognizer when VNRecognizeTextRequest exists
- ❌ Using AVFoundation + Vision when DataScannerViewController suffices
- ❌ Processing every camera frame for scanning (skip frames, use region of interest)
- ❌ Enabling all barcode symbologies when you only need one (performance hit)
- ❌ Ignoring RecognizeDocumentsRequest when you need table/list structure (iOS 26+)

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
├─ Person detection (location only)?
│  └─ VNDetectHumanRectanglesRequest
│
├─ Recognize text in images?
│  ├─ Real-time from camera + need UI → DataScannerViewController (iOS 16+)
│  ├─ Processing captured image → VNRecognizeTextRequest
│  │  ├─ Need speed (real-time camera) → recognitionLevel = .fast
│  │  └─ Need accuracy (documents) → recognitionLevel = .accurate
│  └─ Need structured documents (iOS 26+) → RecognizeDocumentsRequest
│
├─ Detect barcodes/QR codes?
│  ├─ Real-time camera + need UI → DataScannerViewController (iOS 16+)
│  └─ Processing image → VNDetectBarcodesRequest
│
└─ Scan documents?
   ├─ Need built-in UI + perspective correction → VNDocumentCameraViewController
   ├─ Need structured data (tables, lists) → RecognizeDocumentsRequest (iOS 26+)
   └─ Custom pipeline → VNDetectDocumentSegmentationRequest + perspective correction
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
| VNRecognizeTextRequest (basic) | iOS 13+ |
| VNRecognizeTextRequest (accurate, multi-lang) | iOS 14+ |
| VNDetectBarcodesRequest | iOS 11+ |
| VNDetectBarcodesRequest (revision 2: Codabar, MicroQR) | iOS 15+ |
| VNDetectBarcodesRequest (revision 3: ML-based) | iOS 16+ |
| DataScannerViewController | iOS 16+ |
| VNDocumentCameraViewController | iOS 13+ |
| VNDetectDocumentSegmentationRequest | iOS 15+ |
| RecognizeDocumentsRequest | iOS 26+ |

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

### Pattern 9: Text Recognition (OCR)

**Use case**: Extract text from images, receipts, signs, documents.

```swift
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate  // Or .fast for real-time
request.recognitionLanguages = ["en-US"]  // Specify known languages
request.usesLanguageCorrection = true  // Helps accuracy

let handler = VNImageRequestHandler(cgImage: image)
try handler.perform([request])

guard let observations = request.results as? [VNRecognizedTextObservation] else {
    return
}

for observation in observations {
    // Get top candidate (most likely)
    guard let candidate = observation.topCandidates(1).first else { continue }

    let text = candidate.string
    let confidence = candidate.confidence

    // Get bounding box for specific substring
    if let range = text.range(of: searchTerm) {
        if let boundingBox = try? candidate.boundingBox(for: range) {
            // Use for highlighting
        }
    }
}
```

**Fast vs Accurate**:
- **Fast**: Real-time camera, large legible text (signs, billboards), character-by-character
- **Accurate**: Documents, receipts, small text, handwriting, ML-based word/line recognition

**Language tips**:
- Order matters: first language determines ML model for accurate path
- Use `automaticallyDetectsLanguage = true` only when language unknown
- Query `supportedRecognitionLanguages` for current revision

**Cost**: 30 min basic implementation, 2 hours with language handling

### Pattern 10: Barcode/QR Code Detection

**Use case**: Scan product barcodes, QR codes, healthcare codes.

```swift
let request = VNDetectBarcodesRequest()
request.revision = VNDetectBarcodesRequestRevision3  // ML-based, iOS 16+
request.symbologies = [.qr, .ean13]  // Specify only what you need!

let handler = VNImageRequestHandler(cgImage: image)
try handler.perform([request])

guard let observations = request.results as? [VNBarcodeObservation] else {
    return
}

for barcode in observations {
    let payload = barcode.payloadStringValue  // Decoded content
    let symbology = barcode.symbology  // Type of barcode
    let bounds = barcode.boundingBox  // Location (normalized)

    print("Found \(symbology): \(payload ?? "no string")")
}
```

**Performance tip**: Specifying fewer symbologies = faster scanning

**Revision differences**:
- **Revision 1**: One code at a time, 1D codes return lines
- **Revision 2**: Codabar, GS1Databar, MicroPDF, MicroQR, better with ROI
- **Revision 3**: ML-based, multiple codes at once, better bounding boxes, fewer duplicates

**Cost**: 15 min implementation

### Pattern 11: DataScannerViewController (Live Scanning)

**Use case**: Camera-based text/barcode scanning with built-in UI (iOS 16+).

```swift
import VisionKit

// Check support
guard DataScannerViewController.isSupported,
      DataScannerViewController.isAvailable else {
    // Not supported or camera access denied
    return
}

// Configure what to scan
let recognizedDataTypes: Set<DataScannerViewController.RecognizedDataType> = [
    .barcode(symbologies: [.qr]),
    .text(textContentType: .URL)  // Or nil for all text
]

// Create and present
let scanner = DataScannerViewController(
    recognizedDataTypes: recognizedDataTypes,
    qualityLevel: .balanced,  // Or .fast, .accurate
    recognizesMultipleItems: false,  // Center-most if false
    isHighFrameRateTrackingEnabled: true,  // For smooth highlights
    isPinchToZoomEnabled: true,
    isGuidanceEnabled: true,
    isHighlightingEnabled: true
)

scanner.delegate = self
present(scanner, animated: true) {
    try? scanner.startScanning()
}
```

**Delegate methods**:
```swift
func dataScanner(_ scanner: DataScannerViewController,
                 didTapOn item: RecognizedItem) {
    switch item {
    case .text(let text):
        print("Tapped text: \(text.transcript)")
    case .barcode(let barcode):
        print("Tapped barcode: \(barcode.payloadStringValue ?? "")")
    @unknown default: break
    }
}

// For custom highlights
func dataScanner(_ scanner: DataScannerViewController,
                 didAdd addedItems: [RecognizedItem],
                 allItems: [RecognizedItem]) {
    for item in addedItems {
        let highlight = createHighlight(for: item)
        scanner.overlayContainerView.addSubview(highlight)
    }
}
```

**Async stream alternative**:
```swift
for await items in scanner.recognizedItems {
    // Process current items
}
```

**Cost**: 45 min implementation with custom highlights

### Pattern 12: Document Scanning with VNDocumentCameraViewController

**Use case**: Scan paper documents with automatic edge detection and perspective correction.

```swift
import VisionKit

let documentCamera = VNDocumentCameraViewController()
documentCamera.delegate = self
present(documentCamera, animated: true)

// In delegate
func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                   didFinishWith scan: VNDocumentCameraScan) {
    controller.dismiss(animated: true)

    // Process each page
    for pageIndex in 0..<scan.pageCount {
        let image = scan.imageOfPage(at: pageIndex)

        // Now run text recognition on the corrected image
        let handler = VNImageRequestHandler(cgImage: image.cgImage!)
        let textRequest = VNRecognizeTextRequest()
        try? handler.perform([textRequest])
    }
}
```

**Cost**: 30 min implementation

### Pattern 13: Document Segmentation (Custom Pipeline)

**Use case**: Detect document edges programmatically for custom camera UI.

```swift
let request = VNDetectDocumentSegmentationRequest()
let handler = VNImageRequestHandler(ciImage: inputImage)
try handler.perform([request])

guard let observation = request.results?.first,
      let document = observation as? VNRectangleObservation else {
    return
}

// Get corner points (normalized coordinates)
let topLeft = document.topLeft
let topRight = document.topRight
let bottomLeft = document.bottomLeft
let bottomRight = document.bottomRight

// Apply perspective correction with CoreImage
let correctedImage = inputImage
    .cropped(to: document.boundingBox.scaled(to: imageSize))
    .applyingFilter("CIPerspectiveCorrection", parameters: [
        "inputTopLeft": CIVector(cgPoint: topLeft.scaled(to: imageSize)),
        "inputTopRight": CIVector(cgPoint: topRight.scaled(to: imageSize)),
        "inputBottomLeft": CIVector(cgPoint: bottomLeft.scaled(to: imageSize)),
        "inputBottomRight": CIVector(cgPoint: bottomRight.scaled(to: imageSize))
    ])
```

**VNDetectDocumentSegmentationRequest vs VNDetectRectanglesRequest**:
- Document: ML-based, trained on documents, handles non-rectangles, returns one document
- Rectangle: Edge-based, finds any quadrilateral, returns multiple, CPU-only

**Cost**: 1-2 hours implementation

### Pattern 14: Structured Document Extraction (iOS 26+)

**Use case**: Extract tables, lists, paragraphs with semantic understanding.

```swift
// iOS 26+
let request = RecognizeDocumentsRequest()
let observations = try await request.perform(on: imageData)

guard let document = observations.first?.document else {
    return
}

// Extract tables
for table in document.tables {
    for row in table.rows {
        for cell in row {
            let text = cell.content.text.transcript
            print("Cell: \(text)")
        }
    }
}

// Get detected data (emails, phones, URLs, dates)
let allDetectedData = document.text.detectedData
for data in allDetectedData {
    switch data.match.details {
    case .emailAddress(let email):
        print("Email: \(email.emailAddress)")
    case .phoneNumber(let phone):
        print("Phone: \(phone.phoneNumber)")
    case .link(let url):
        print("URL: \(url)")
    default: break
    }
}
```

**Document hierarchy**:
- Document → containers (text, tables, lists, barcodes)
- Table → rows → cells → content
- Content → text (transcript, lines, paragraphs, words, detectedData)

**Cost**: 1 hour implementation

### Pattern 15: Real-time Phone Number Scanner

**Use case**: Scan phone numbers from camera like barcode scanner (from WWDC 2019).

```swift
// 1. Use region of interest to guide user
let textRequest = VNRecognizeTextRequest { request, error in
    guard let observations = request.results as? [VNRecognizedTextObservation] else { return }

    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }

        // Use domain knowledge to filter
        if let phoneNumber = self.extractPhoneNumber(from: candidate.string) {
            self.stringTracker.add(phoneNumber)
        }
    }

    // Build evidence over frames
    if let stableNumber = self.stringTracker.getStableString(threshold: 10) {
        self.foundPhoneNumber(stableNumber)
    }
}

textRequest.recognitionLevel = .fast  // Real-time
textRequest.usesLanguageCorrection = false  // Codes, not natural text
textRequest.regionOfInterest = guidanceBox  // Crop to user's focus area

// 2. String tracker for stability
class StringTracker {
    private var seenStrings: [String: Int] = [:]

    func add(_ string: String) {
        seenStrings[string, default: 0] += 1
    }

    func getStableString(threshold: Int) -> String? {
        seenStrings.first { $0.value >= threshold }?.key
    }
}
```

**Key techniques from WWDC 2019**:
- Use `.fast` recognition level for real-time
- Disable language correction for codes/numbers
- Use region of interest to improve speed and focus
- Build evidence over multiple frames (string tracker)
- Apply domain knowledge (phone number regex)

**Cost**: 2 hours implementation

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
let uiPoint = CGPoint(x: axiom-visionPoint.x, y: axiom-visionPoint.y)  // WRONG!
```

**Right**:
```swift
let visionPoint = recognizedPoint.location

// Convert to UIKit coordinates
let uiPoint = CGPoint(
    x: axiom-visionPoint.x * imageWidth,
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

**Text/Barcode Recognition** (if applicable):
- ☑ Recognition level matches use case (fast for real-time, accurate for documents)
- ☑ Language correction disabled for codes/serial numbers
- ☑ Barcode symbologies limited to actual needs (performance)
- ☑ Region of interest used to focus scanning area
- ☑ Multiple candidates checked (not just top candidate)
- ☑ Evidence accumulated over frames for real-time (string tracker)
- ☑ DataScannerViewController availability checked before presenting

## Resources

**WWDC**: 2019-234, 2021-10041, 2022-10024, 2022-10025, 2025-272, 2023-10176, 2023-111241, 2020-10653

**Docs**: /vision, /visionkit, /vision/vnrecognizetextrequest, /vision/vndetectbarcodesrequest

**Skills**: axiom-vision-ref, axiom-vision-diag
