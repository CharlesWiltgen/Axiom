---
name: axiom-vision-ref
description: Vision framework API, VNDetectHumanHandPoseRequest, VNDetectHumanBodyPoseRequest, person segmentation, face detection, VNImageRequestHandler, recognized points, joint landmarks, VNRecognizeTextRequest, VNDetectBarcodesRequest, DataScannerViewController, VNDocumentCameraViewController, RecognizeDocumentsRequest
license: MIT
compatibility: iOS 11+, iPadOS 11+, macOS 10.13+, tvOS 11+, axiom-visionOS 1+
metadata:
  version: "1.1.0"
  last-updated: "2026-01-03"
---

# Vision Framework API Reference

Comprehensive reference for Vision framework computer vision: subject segmentation, hand/body pose detection, person detection, face analysis, text recognition (OCR), barcode detection, and document scanning.

## When to Use This Reference

- **Implementing subject lifting** using VisionKit or Vision
- **Detecting hand/body poses** for gesture recognition or fitness apps
- **Segmenting people** from backgrounds or separating multiple individuals
- **Face detection and landmarks** for AR effects or authentication
- **Combining Vision APIs** to solve complex computer vision problems
- **Looking up specific API signatures** and parameter meanings
- **Recognizing text** in images (OCR) with VNRecognizeTextRequest
- **Detecting barcodes** and QR codes with VNDetectBarcodesRequest
- **Building live scanners** with DataScannerViewController
- **Scanning documents** with VNDocumentCameraViewController
- **Extracting structured document data** with RecognizeDocumentsRequest (iOS 26+)

**Related skills**: See `axiom-vision` for decision trees and patterns, `axiom-vision-diag` for troubleshooting

## Vision Framework Overview

Vision provides computer vision algorithms for still images and video:

**Core workflow**:
1. Create request (e.g., `VNDetectHumanHandPoseRequest()`)
2. Create handler with image (`VNImageRequestHandler(cgImage: image)`)
3. Perform request (`try handler.perform([request])`)
4. Access observations from `request.results`

**Coordinate system**: Lower-left origin, normalized (0.0-1.0) coordinates

**Performance**: Run on background queue - resource intensive, blocks UI if on main thread

## Subject Segmentation APIs

### VNGenerateForegroundInstanceMaskRequest

**Availability**: iOS 17+, macOS 14+, tvOS 17+, axiom-visionOS 1+

Generates class-agnostic instance mask of foreground objects (people, pets, buildings, food, shoes, etc.)

#### Basic Usage

```swift
let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: image)

try handler.perform([request])

guard let observation = request.results?.first as? VNInstanceMaskObservation else {
    return
}
```

#### InstanceMaskObservation

**allInstances**: `IndexSet` containing all foreground instance indices (excludes background 0)

**instanceMask**: `CVPixelBuffer` with UInt8 labels (0 = background, 1+ = instance indices)

**instanceAtPoint(_:)**: Returns instance index at normalized point

```swift
let point = CGPoint(x: 0.5, y: 0.5)  // Center of image
let instance = observation.instanceAtPoint(point)

if instance == 0 {
    print("Background tapped")
} else {
    print("Instance \(instance) tapped")
}
```

#### Generating Masks

**createScaledMask(for:croppedToInstancesContent:)**

Parameters:
- `for`: `IndexSet` of instances to include
- `croppedToInstancesContent`:
  - `false` = Output matches input resolution (for compositing)
  - `true` = Tight crop around selected instances

Returns: Single-channel floating-point `CVPixelBuffer` (soft segmentation mask)

```swift
// All instances, full resolution
let mask = try observation.createScaledMask(
    for: observation.allInstances,
    croppedToInstancesContent: false
)

// Single instance, cropped
let instances = IndexSet(integer: 1)
let croppedMask = try observation.createScaledMask(
    for: instances,
    croppedToInstancesContent: true
)
```

#### Instance Mask Hit Testing

Access raw pixel buffer to map tap coordinates to instance labels:

```swift
let instanceMask = observation.instanceMask

CVPixelBufferLockBaseAddress(instanceMask, .readOnly)
defer { CVPixelBufferUnlockBaseAddress(instanceMask, .readOnly) }

let baseAddress = CVPixelBufferGetBaseAddress(instanceMask)
let width = CVPixelBufferGetWidth(instanceMask)
let bytesPerRow = CVPixelBufferGetBytesPerRow(instanceMask)

// Convert normalized tap to pixel coordinates
let pixelPoint = VNImagePointForNormalizedPoint(
    CGPoint(x: normalizedX, y: normalizedY),
    width: imageWidth,
    height: imageHeight
)

// Calculate byte offset
let offset = Int(pixelPoint.y) * bytesPerRow + Int(pixelPoint.x)

// Read instance label
let label = UnsafeRawPointer(baseAddress!).load(
    fromByteOffset: offset,
    as: UInt8.self
)

let instances = label == 0 ? observation.allInstances : IndexSet(integer: Int(label))
```

## VisionKit Subject Lifting

### ImageAnalysisInteraction (iOS)

**Availability**: iOS 16+, iPadOS 16+

Adds system-like subject lifting UI to views:

```swift
let interaction = ImageAnalysisInteraction()
interaction.preferredInteractionTypes = .imageSubject  // Or .automatic
imageView.addInteraction(interaction)
```

**Interaction types**:
- `.automatic`: Subject lifting + Live Text + data detectors
- `.imageSubject`: Subject lifting only (no interactive text)

### ImageAnalysisOverlayView (macOS)

**Availability**: macOS 13+

```swift
let overlayView = ImageAnalysisOverlayView()
overlayView.preferredInteractionTypes = .imageSubject
nsView.addSubview(overlayView)
```

### Programmatic Access

#### ImageAnalyzer

```swift
let analyzer = ImageAnalyzer()
let configuration = ImageAnalyzer.Configuration([.text, .visualLookUp])

let analysis = try await analyzer.analyze(image, configuration: configuration)
```

#### ImageAnalysis

**subjects**: `[Subject]` - All subjects in image

**highlightedSubjects**: `Set<Subject>` - Currently highlighted (user long-pressed)

**subject(at:)**: Async lookup of subject at normalized point (returns `nil` if none)

```swift
// Get all subjects
let subjects = analysis.subjects

// Look up subject at tap
if let subject = try await analysis.subject(at: tapPoint) {
    // Process subject
}

// Change highlight state
analysis.highlightedSubjects = Set([subjects[0], subjects[1]])
```

#### Subject Struct

**image**: `UIImage`/`NSImage` - Extracted subject with transparency

**bounds**: `CGRect` - Subject boundaries in image coordinates

```swift
// Single subject image
let subjectImage = subject.image

// Composite multiple subjects
let compositeImage = try await analysis.image(for: [subject1, subject2])
```

**Out-of-process**: VisionKit analysis happens out-of-process (performance benefit, image size limited)

## Person Segmentation APIs

### VNGeneratePersonSegmentationRequest

**Availability**: iOS 15+, macOS 12+

Returns single mask containing **all people** in image:

```swift
let request = VNGeneratePersonSegmentationRequest()
// Configure quality level if needed
try handler.perform([request])

guard let observation = request.results?.first as? VNPixelBufferObservation else {
    return
}

let personMask = observation.pixelBuffer  // CVPixelBuffer
```

### VNGeneratePersonInstanceMaskRequest

**Availability**: iOS 17+, macOS 14+

Returns **separate masks for up to 4 people**:

```swift
let request = VNGeneratePersonInstanceMaskRequest()
try handler.perform([request])

guard let observation = request.results?.first as? VNInstanceMaskObservation else {
    return
}

// Same InstanceMaskObservation API as foreground instance masks
let allPeople = observation.allInstances  // Up to 4 people (1-4)

// Get mask for person 1
let person1Mask = try observation.createScaledMask(
    for: IndexSet(integer: 1),
    croppedToInstancesContent: false
)
```

**Limitations**:
- Segments up to 4 people
- With >4 people: may miss people or combine them (typically background people)
- Use `VNDetectFaceRectanglesRequest` to count faces if you need to handle crowded scenes

## Hand Pose Detection

### VNDetectHumanHandPoseRequest

**Availability**: iOS 14+, macOS 11+

Detects **21 hand landmarks** per hand:

```swift
let request = VNDetectHumanHandPoseRequest()
request.maximumHandCount = 2  // Default: 2, increase if needed

let handler = VNImageRequestHandler(cgImage: image)
try handler.perform([request])

for observation in request.results as? [VNHumanHandPoseObservation] ?? [] {
    // Process each hand
}
```

**Performance note**: `maximumHandCount` affects latency. Pose computed only for hands ≤ maximum. Set to lowest acceptable value.

### Hand Landmarks (21 points)

**Wrist**: 1 landmark

**Thumb** (4 landmarks):
- `.thumbTip`
- `.thumbIP` (interphalangeal joint)
- `.thumbMP` (metacarpophalangeal joint)
- `.thumbCMC` (carpometacarpal joint)

**Fingers** (4 landmarks each):
- Tip (`.indexTip`, `.middleTip`, `.ringTip`, `.littleTip`)
- DIP (distal interphalangeal joint)
- PIP (proximal interphalangeal joint)
- MCP (metacarpophalangeal joint)

### Group Keys

Access landmark groups:

| Group Key | Points |
|-----------|--------|
| `.all` | All 21 landmarks |
| `.thumb` | 4 thumb joints |
| `.indexFinger` | 4 index finger joints |
| `.middleFinger` | 4 middle finger joints |
| `.ringFinger` | 4 ring finger joints |
| `.littleFinger` | 4 little finger joints |

```swift
// Get all points
let allPoints = try observation.recognizedPoints(.all)

// Get index finger points only
let indexPoints = try observation.recognizedPoints(.indexFinger)

// Get specific point
let thumbTip = try observation.recognizedPoint(.thumbTip)
let indexTip = try observation.recognizedPoint(.indexTip)

// Check confidence
guard thumbTip.confidence > 0.5 else { return }

// Access location (normalized coordinates, lower-left origin)
let location = thumbTip.location  // CGPoint
```

### Gesture Recognition Example (Pinch)

```swift
let thumbTip = try observation.recognizedPoint(.thumbTip)
let indexTip = try observation.recognizedPoint(.indexTip)

guard thumbTip.confidence > 0.5, indexTip.confidence > 0.5 else {
    return
}

let distance = hypot(
    thumbTip.location.x - indexTip.location.x,
    thumbTip.location.y - indexTip.location.y
)

let isPinching = distance < 0.05  // Normalized threshold
```

### Chirality (Handedness)

```swift
let chirality = observation.chirality  // .left or .right or .unknown
```

## Body Pose Detection

### VNDetectHumanBodyPoseRequest (2D)

**Availability**: iOS 14+, macOS 11+

Detects **18 body landmarks** (2D normalized coordinates):

```swift
let request = VNDetectHumanBodyPoseRequest()
try handler.perform([request])

for observation in request.results as? [VNHumanBodyPoseObservation] ?? [] {
    // Process each person
}
```

### Body Landmarks (18 points)

**Face** (5 landmarks):
- `.nose`, `.leftEye`, `.rightEye`, `.leftEar`, `.rightEar`

**Arms** (6 landmarks):
- Left: `.leftShoulder`, `.leftElbow`, `.leftWrist`
- Right: `.rightShoulder`, `.rightElbow`, `.rightWrist`

**Torso** (7 landmarks):
- `.neck` (between shoulders)
- `.leftShoulder`, `.rightShoulder` (also in arm groups)
- `.leftHip`, `.rightHip`
- `.root` (between hips)

**Legs** (6 landmarks):
- Left: `.leftHip`, `.leftKnee`, `.leftAnkle`
- Right: `.rightHip`, `.rightKnee`, `.rightAnkle`

**Note**: Shoulders and hips appear in multiple groups

### Group Keys (Body)

| Group Key | Points |
|-----------|--------|
| `.all` | All 18 landmarks |
| `.face` | 5 face landmarks |
| `.leftArm` | shoulder, elbow, wrist |
| `.rightArm` | shoulder, elbow, wrist |
| `.torso` | neck, shoulders, hips, root |
| `.leftLeg` | hip, knee, ankle |
| `.rightLeg` | hip, knee, ankle |

```swift
// Get all body points
let allPoints = try observation.recognizedPoints(.all)

// Get left arm only
let leftArmPoints = try observation.recognizedPoints(.leftArm)

// Get specific joint
let leftWrist = try observation.recognizedPoint(.leftWrist)
```

### VNDetectHumanBodyPose3DRequest (3D)

**Availability**: iOS 17+, macOS 14+

Returns **3D skeleton with 17 joints** in meters (real-world coordinates):

```swift
let request = VNDetectHumanBodyPose3DRequest()
try handler.perform([request])

guard let observation = request.results?.first as? VNHumanBodyPose3DObservation else {
    return
}

// Get 3D joint position
let leftWrist = try observation.recognizedPoint(.leftWrist)
let position = leftWrist.position  // simd_float4x4 matrix
let localPosition = leftWrist.localPosition  // Relative to parent joint
```

**3D Body Landmarks** (17 points): Same as 2D except no ears (15 vs 18 2D landmarks)

#### 3D Observation Properties

**bodyHeight**: Estimated height in meters
- With depth data: Measured height
- Without depth data: Reference height (1.8m)

**heightEstimation**: `.measured` or `.reference`

**cameraOriginMatrix**: `simd_float4x4` camera position/orientation relative to subject

**pointInImage(\_:)**: Project 3D joint back to 2D image coordinates

```swift
let wrist2D = try observation.pointInImage(leftWrist)
```

#### 3D Point Classes

**VNPoint3D**: Base class with `simd_float4x4` position matrix

**VNRecognizedPoint3D**: Adds identifier (joint name)

**VNHumanBodyRecognizedPoint3D**: Adds `localPosition` and `parentJoint`

```swift
// Position relative to skeleton root (center of hip)
let modelPosition = leftWrist.position

// Position relative to parent joint (left elbow)
let relativePosition = leftWrist.localPosition
```

#### Depth Input

Vision accepts depth data alongside images:

```swift
// From AVDepthData
let handler = VNImageRequestHandler(
    cvPixelBuffer: imageBuffer,
    depthData: depthData,
    orientation: orientation
)

// From file (automatic depth extraction)
let handler = VNImageRequestHandler(url: imageURL)  // Depth auto-fetched
```

**Depth formats**: Disparity or Depth (interchangeable via AVFoundation)

**LiDAR**: Use in live capture sessions for accurate scale/measurement

## Face Detection & Landmarks

### VNDetectFaceRectanglesRequest

**Availability**: iOS 11+

Detects face bounding boxes:

```swift
let request = VNDetectFaceRectanglesRequest()
try handler.perform([request])

for observation in request.results as? [VNFaceObservation] ?? [] {
    let faceBounds = observation.boundingBox  // Normalized rect
}
```

### VNDetectFaceLandmarksRequest

**Availability**: iOS 11+

Detects face with detailed landmarks:

```swift
let request = VNDetectFaceLandmarksRequest()
try handler.perform([request])

for observation in request.results as? [VNFaceObservation] ?? [] {
    if let landmarks = observation.landmarks {
        let leftEye = landmarks.leftEye
        let nose = landmarks.nose
        let leftPupil = landmarks.leftPupil  // Revision 2+
    }
}
```

**Revisions**:
- Revision 1: Basic landmarks
- Revision 2: Detects upside-down faces
- Revision 3+: Pupil locations

## Person Detection

### VNDetectHumanRectanglesRequest

**Availability**: iOS 13+

Detects human bounding boxes (torso detection):

```swift
let request = VNDetectHumanRectanglesRequest()
try handler.perform([request])

for observation in request.results as? [VNHumanObservation] ?? [] {
    let humanBounds = observation.boundingBox  // Normalized rect
}
```

**Use case**: Faster than pose detection when you only need location

## CoreImage Integration

### CIBlendWithMask Filter

Composite subject on new background using Vision mask:

```swift
// 1. Get mask from Vision
let observation = request.results?.first as? VNInstanceMaskObservation
let visionMask = try observation.createScaledMask(
    for: observation.allInstances,
    croppedToInstancesContent: false
)

// 2. Convert to CIImage
let maskImage = CIImage(cvPixelBuffer: axiom-visionMask)

// 3. Apply filter
let filter = CIFilter(name: "CIBlendWithMask")!
filter.setValue(sourceImage, forKey: kCIInputImageKey)
filter.setValue(maskImage, forKey: kCIInputMaskImageKey)
filter.setValue(newBackground, forKey: kCIInputBackgroundImageKey)

let output = filter.outputImage  // Composited result
```

**Parameters**:
- **Input image**: Original image to mask
- **Mask image**: Vision's soft segmentation mask
- **Background image**: New background (or empty image for transparency)

**HDR preservation**: CoreImage preserves high dynamic range from input (Vision/VisionKit output is SDR)

## Text Recognition APIs

### VNRecognizeTextRequest

**Availability**: iOS 13+, macOS 10.15+

Recognizes text in images with configurable accuracy/speed trade-off.

#### Basic Usage

```swift
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate  // Or .fast
request.recognitionLanguages = ["en-US", "de-DE"]  // Order matters
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: image)
try handler.perform([request])

for observation in request.results as? [VNRecognizedTextObservation] ?? [] {
    // Get top candidates
    let candidates = observation.topCandidates(3)
    let bestText = candidates.first?.string ?? ""
}
```

#### Recognition Levels

| Level | Performance | Accuracy | Best For |
|-------|-------------|----------|----------|
| `.fast` | Real-time | Good | Camera feed, large text, signs |
| `.accurate` | Slower | Excellent | Documents, receipts, handwriting |

**Fast path**: Character-by-character recognition (Neural Network → Character Detection)

**Accurate path**: Full-line ML recognition (Neural Network → Line/Word Recognition)

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `recognitionLevel` | `VNRequestTextRecognitionLevel` | `.fast` or `.accurate` |
| `recognitionLanguages` | `[String]` | BCP 47 language codes, order = priority |
| `usesLanguageCorrection` | `Bool` | Use language model for correction |
| `customWords` | `[String]` | Domain-specific vocabulary |
| `automaticallyDetectsLanguage` | `Bool` | Auto-detect language (iOS 16+) |
| `minimumTextHeight` | `Float` | Min text height as fraction of image (0-1) |
| `revision` | `Int` | API version (affects supported languages) |

#### Language Support

```swift
// Check supported languages for current settings
let languages = try VNRecognizeTextRequest.supportedRecognitionLanguages(
    for: .accurate,
    revision: VNRecognizeTextRequestRevision3
)
```

**Language correction**: Improves accuracy but takes processing time. Disable for codes/serial numbers.

**Custom words**: Add domain-specific vocabulary for better recognition (medical terms, product codes).

#### VNRecognizedTextObservation

**boundingBox**: Normalized rect containing recognized text

**topCandidates(_:)**: Returns `[VNRecognizedText]` ordered by confidence

#### VNRecognizedText

| Property | Type | Description |
|----------|------|-------------|
| `string` | `String` | Recognized text |
| `confidence` | `VNConfidence` | 0.0-1.0 |
| `boundingBox(for:)` | `VNRectangleObservation?` | Box for substring range |

```swift
// Get bounding box for substring
let text = candidate.string
if let range = text.range(of: "invoice") {
    let box = try candidate.boundingBox(for: range)
}
```

## Barcode Detection APIs

### VNDetectBarcodesRequest

**Availability**: iOS 11+, macOS 10.13+

Detects and decodes barcodes and QR codes.

#### Basic Usage

```swift
let request = VNDetectBarcodesRequest()
request.symbologies = [.qr, .ean13, .code128]  // Specific codes

let handler = VNImageRequestHandler(cgImage: image)
try handler.perform([request])

for barcode in request.results as? [VNBarcodeObservation] ?? [] {
    let payload = barcode.payloadStringValue
    let type = barcode.symbology
    let bounds = barcode.boundingBox
}
```

#### Symbologies

**1D Barcodes**:
- `.codabar` (iOS 15+)
- `.code39`, `.code39Checksum`, `.code39FullASCII`, `.code39FullASCIIChecksum`
- `.code93`, `.code93i`
- `.code128`
- `.ean8`, `.ean13`
- `.gs1DataBar`, `.gs1DataBarExpanded`, `.gs1DataBarLimited` (iOS 15+)
- `.i2of5`, `.i2of5Checksum`
- `.itf14`
- `.upce`

**2D Codes**:
- `.aztec`
- `.dataMatrix`
- `.microPDF417` (iOS 15+)
- `.microQR` (iOS 15+)
- `.pdf417`
- `.qr`

**Performance**: Specifying fewer symbologies = faster detection

#### Revisions

| Revision | iOS | Features |
|----------|-----|----------|
| 1 | 11+ | Basic detection, one code at a time |
| 2 | 15+ | Codabar, GS1, MicroPDF, MicroQR, better ROI |
| 3 | 16+ | ML-based, multiple codes, better bounding boxes |

#### VNBarcodeObservation

| Property | Type | Description |
|----------|------|-------------|
| `payloadStringValue` | `String?` | Decoded content |
| `symbology` | `VNBarcodeSymbology` | Barcode type |
| `boundingBox` | `CGRect` | Normalized bounds |
| `topLeft/topRight/bottomLeft/bottomRight` | `CGPoint` | Corner points |

## VisionKit Scanner APIs

### DataScannerViewController

**Availability**: iOS 16+

Camera-based live scanner with built-in UI for text and barcodes.

#### Check Availability

```swift
// Hardware support
DataScannerViewController.isSupported

// Runtime availability (camera access, parental controls)
DataScannerViewController.isAvailable
```

#### Configuration

```swift
import VisionKit

let dataTypes: Set<DataScannerViewController.RecognizedDataType> = [
    .barcode(symbologies: [.qr, .ean13]),
    .text(textContentType: .URL),  // Or nil for all text
    // .text(languages: ["ja"])  // Filter by language
]

let scanner = DataScannerViewController(
    recognizedDataTypes: dataTypes,
    qualityLevel: .balanced,  // .fast, .balanced, .accurate
    recognizesMultipleItems: true,
    isHighFrameRateTrackingEnabled: true,
    isPinchToZoomEnabled: true,
    isGuidanceEnabled: true,
    isHighlightingEnabled: true
)

scanner.delegate = self
present(scanner, animated: true) {
    try? scanner.startScanning()
}
```

#### RecognizedDataType

| Type | Description |
|------|-------------|
| `.barcode(symbologies:)` | Specific barcode types |
| `.text()` | All text |
| `.text(languages:)` | Text filtered by language |
| `.text(textContentType:)` | Text filtered by type (URL, phone, email) |

#### Delegate Protocol

```swift
protocol DataScannerViewControllerDelegate {
    func dataScanner(_ dataScanner: DataScannerViewController,
                     didTapOn item: RecognizedItem)

    func dataScanner(_ dataScanner: DataScannerViewController,
                     didAdd addedItems: [RecognizedItem],
                     allItems: [RecognizedItem])

    func dataScanner(_ dataScanner: DataScannerViewController,
                     didUpdate updatedItems: [RecognizedItem],
                     allItems: [RecognizedItem])

    func dataScanner(_ dataScanner: DataScannerViewController,
                     didRemove removedItems: [RecognizedItem],
                     allItems: [RecognizedItem])

    func dataScanner(_ dataScanner: DataScannerViewController,
                     becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable)
}
```

#### RecognizedItem

```swift
enum RecognizedItem {
    case text(RecognizedItem.Text)
    case barcode(RecognizedItem.Barcode)

    var id: UUID { get }
    var bounds: RecognizedItem.Bounds { get }
}

// Text item
struct Text {
    let transcript: String
}

// Barcode item
struct Barcode {
    let payloadStringValue: String?
    let observation: VNBarcodeObservation
}
```

#### Async Stream

```swift
// Alternative to delegate
for await items in scanner.recognizedItems {
    // Current recognized items
}
```

#### Custom Highlights

```swift
// Add custom views over recognized items
scanner.overlayContainerView.addSubview(customHighlight)

// Capture still photo
let photo = try await scanner.capturePhoto()
```

### VNDocumentCameraViewController

**Availability**: iOS 13+

Document scanning with automatic edge detection, perspective correction, and lighting adjustment.

#### Basic Usage

```swift
import VisionKit

let camera = VNDocumentCameraViewController()
camera.delegate = self
present(camera, animated: true)
```

#### Delegate Protocol

```swift
protocol VNDocumentCameraViewControllerDelegate {
    func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                       didFinishWith scan: VNDocumentCameraScan)

    func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController)

    func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                       didFailWithError error: Error)
}
```

#### VNDocumentCameraScan

| Property | Type | Description |
|----------|------|-------------|
| `pageCount` | `Int` | Number of scanned pages |
| `imageOfPage(at:)` | `UIImage` | Get page image at index |
| `title` | `String` | User-editable title |

```swift
func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                   didFinishWith scan: VNDocumentCameraScan) {
    controller.dismiss(animated: true)

    for i in 0..<scan.pageCount {
        let pageImage = scan.imageOfPage(at: i)
        // Process with VNRecognizeTextRequest
    }
}
```

## Document Analysis APIs

### VNDetectDocumentSegmentationRequest

**Availability**: iOS 15+, macOS 12+

Detects document boundaries for custom camera UIs or post-processing.

```swift
let request = VNDetectDocumentSegmentationRequest()
let handler = VNImageRequestHandler(ciImage: image)
try handler.perform([request])

guard let observation = request.results?.first as? VNRectangleObservation else {
    return  // No document found
}

// Get corner points (normalized)
let corners = [
    observation.topLeft,
    observation.topRight,
    observation.bottomLeft,
    observation.bottomRight
]
```

**vs VNDetectRectanglesRequest**:
- Document: ML-based, trained specifically on documents
- Rectangle: Edge-based, finds any quadrilateral

### RecognizeDocumentsRequest (iOS 26+)

**Availability**: iOS 26+, macOS 26+

Structured document understanding with semantic parsing.

#### Basic Usage

```swift
let request = RecognizeDocumentsRequest()
let observations = try await request.perform(on: imageData)

guard let document = observations.first?.document else {
    return
}
```

#### DocumentObservation Hierarchy

```
DocumentObservation
└── document: DocumentObservation.Document
    ├── text: TextObservation
    ├── tables: [Container.Table]
    ├── lists: [Container.List]
    └── barcodes: [Container.Barcode]
```

#### Table Extraction

```swift
for table in document.tables {
    for row in table.rows {
        for cell in row {
            let text = cell.content.text.transcript
            let detectedData = cell.content.text.detectedData
        }
    }
}
```

#### Detected Data Types

```swift
for data in document.text.detectedData {
    switch data.match.details {
    case .emailAddress(let email):
        let address = email.emailAddress
    case .phoneNumber(let phone):
        let number = phone.phoneNumber
    case .link(let url):
        let link = url
    case .address(let address):
        let components = address
    case .date(let date):
        let dateValue = date
    default:
        break
    }
}
```

#### TextObservation Hierarchy

```
TextObservation
├── transcript: String
├── lines: [TextObservation.Line]
├── paragraphs: [TextObservation.Paragraph]
├── words: [TextObservation.Word]
└── detectedData: [DetectedDataObservation]
```

## API Quick Reference

### Subject Segmentation

| API | Platform | Purpose |
|-----|----------|---------|
| `VNGenerateForegroundInstanceMaskRequest` | iOS 17+ | Class-agnostic subject instances |
| `VNGeneratePersonInstanceMaskRequest` | iOS 17+ | Up to 4 people separately |
| `VNGeneratePersonSegmentationRequest` | iOS 15+ | All people (single mask) |
| `ImageAnalysisInteraction` (VisionKit) | iOS 16+ | UI for subject lifting |

### Pose Detection

| API | Platform | Landmarks | Coordinates |
|-----|----------|-----------|-------------|
| `VNDetectHumanHandPoseRequest` | iOS 14+ | 21 per hand | 2D normalized |
| `VNDetectHumanBodyPoseRequest` | iOS 14+ | 18 body joints | 2D normalized |
| `VNDetectHumanBodyPose3DRequest` | iOS 17+ | 17 body joints | 3D meters |

### Face & Person Detection

| API | Platform | Purpose |
|-----|----------|---------|
| `VNDetectFaceRectanglesRequest` | iOS 11+ | Face bounding boxes |
| `VNDetectFaceLandmarksRequest` | iOS 11+ | Face with detailed landmarks |
| `VNDetectHumanRectanglesRequest` | iOS 13+ | Human torso bounding boxes |

### Text & Barcode

| API | Platform | Purpose |
|-----|----------|---------|
| `VNRecognizeTextRequest` | iOS 13+ | Text recognition (OCR) |
| `VNDetectBarcodesRequest` | iOS 11+ | Barcode/QR detection |
| `DataScannerViewController` | iOS 16+ | Live camera scanner (text + barcodes) |
| `VNDocumentCameraViewController` | iOS 13+ | Document scanning with perspective correction |
| `VNDetectDocumentSegmentationRequest` | iOS 15+ | Programmatic document edge detection |
| `RecognizeDocumentsRequest` | iOS 26+ | Structured document extraction |

### Observation Types

| Observation | Returned By |
|-------------|-------------|
| `VNInstanceMaskObservation` | Foreground/person instance masks |
| `VNPixelBufferObservation` | Person segmentation (single mask) |
| `VNHumanHandPoseObservation` | Hand pose |
| `VNHumanBodyPoseObservation` | Body pose (2D) |
| `VNHumanBodyPose3DObservation` | Body pose (3D) |
| `VNFaceObservation` | Face detection/landmarks |
| `VNHumanObservation` | Human rectangles |
| `VNRecognizedTextObservation` | Text recognition |
| `VNBarcodeObservation` | Barcode detection |
| `VNRectangleObservation` | Document segmentation |
| `DocumentObservation` | Structured document (iOS 26+) |

## Resources

**WWDC**: 2019-234, 2021-10041, 2022-10024, 2022-10025, 2025-272, 2023-10176, 2023-111241, 2023-10048, 2020-10653, 2020-10043, 2020-10099

**Docs**: /vision, /visionkit, /vision/vnrecognizetextrequest, /vision/vndetectbarcodesrequest

**Skills**: axiom-vision, axiom-vision-diag
