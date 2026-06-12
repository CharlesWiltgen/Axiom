# Vision Framework API Reference

Comprehensive reference for Vision framework computer vision: subject segmentation, hand/body pose detection, person detection, face analysis, text recognition (OCR), barcode detection, document scanning, Visual Intelligence integration, and the 27-cycle additions (tap-to-segment, Vision on watchOS, Foundation Models tools).

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
- **Integrating with Visual Intelligence** — camera/screenshot search surfacing your app's content (iOS 26+, iPadOS27/macOS27)
- **Tap-to-segment any object** with GenerateIterativeSegmentationRequest `OS27`
- **Using Vision on watchOS** `watchOS27`
- **Giving Foundation Models vision tools** (BarcodeReaderTool, OCRTool) `OS27`

**Related skills**: See `skills/vision-framework.md` for decision trees and patterns, `skills/vision-diag.md` for troubleshooting

## Vision Framework Overview

Vision provides computer vision algorithms for still images and video:

**Core workflow**:
1. Create request (e.g., `VNDetectHumanHandPoseRequest()`)
2. Create handler with image (`VNImageRequestHandler(cgImage: image)`)
3. Perform request (`try handler.perform([request])`)
4. Access observations from `request.results`

**Coordinate system**: Lower-left origin, normalized (0.0-1.0) coordinates

**Performance**: Run on background queue - resource intensive, blocks UI if on main thread

## Request Handlers

Vision provides two request handlers for different scenarios.

### VNImageRequestHandler

Analyzes a **single image**. Initialize with the image, perform requests against it, discard.

```swift
let handler = VNImageRequestHandler(cgImage: image)
try handler.perform([request1, request2])  // Multiple requests, one image
```

**Initialize with**: `CGImage`, `CIImage`, `CVPixelBuffer`, `Data`, or `URL`

**Rule**: One handler per image. Reusing a handler with a different image is unsupported.

### VNSequenceRequestHandler

Analyzes a **sequence of frames** (video, camera feed). Initialize empty, pass each frame to `perform()`. Maintains inter-frame state for temporal smoothing.

```swift
let sequenceHandler = VNSequenceRequestHandler()

// In your camera/video frame callback:
func processFrame(_ pixelBuffer: CVPixelBuffer) throws {
    try sequenceHandler.perform([request], on: pixelBuffer)
}
```

**Rule**: Create once, reuse across frames. The handler tracks state between calls.

### When to Use Which

| Use Case | Handler |
|----------|---------|
| Single photo or screenshot | `VNImageRequestHandler` |
| Video stream or camera frames | `VNSequenceRequestHandler` |
| Temporal smoothing (pose, segmentation) | `VNSequenceRequestHandler` |
| One-off analysis of a CVPixelBuffer | `VNImageRequestHandler` |

### Requests That Benefit from Sequence Handling

These requests use inter-frame state when run through `VNSequenceRequestHandler`:
- `VNDetectHumanBodyPoseRequest` — Smoother joint tracking
- `VNDetectHumanHandPoseRequest` — Smoother landmark tracking
- `VNGeneratePersonSegmentationRequest` — Temporally consistent masks
- `VNGeneratePersonInstanceMaskRequest` — Stable person identity across frames
- `VNDetectDocumentSegmentationRequest` — Stable document edges
- Any `VNStatefulRequest` subclass — Designed for sequences

### Common Mistake

Creating a new `VNImageRequestHandler` per video frame discards temporal context. Pose landmarks jitter, segmentation masks flicker, and you lose the smoothing that sequence handling provides.

```swift
// Wrong — loses temporal context every frame
func processFrame(_ buffer: CVPixelBuffer) throws {
    let handler = VNImageRequestHandler(cvPixelBuffer: buffer)
    try handler.perform([poseRequest])
}

// Right — maintains inter-frame state
let sequenceHandler = VNSequenceRequestHandler()
func processFrame(_ buffer: CVPixelBuffer) throws {
    try sequenceHandler.perform([poseRequest], on: buffer)
}
```

## Subject Segmentation APIs

### VNGenerateForegroundInstanceMaskRequest

**Availability**: iOS 17+, macOS 14+, tvOS 17+, visionOS 1+

Generates class-agnostic instance mask of foreground objects (people, pets, buildings, food, shoes, etc.)

#### Basic Usage

```swift
let handler = ImageRequestHandler(image)

guard let observation = try await handler.perform(GenerateForegroundInstanceMaskRequest()) else {
    return
}
```

#### InstanceMaskObservation

**allInstances**: `IndexSet` containing all foreground instance indices (excludes background 0)

**allInstancesMask**: `PixelBufferObservation` holding the UInt8 label buffer (0 = background, 1+ = instance indices). Read a single label with `pixel(at:)` (takes a `NormalizedPoint`, returns `Float`) or scan the whole buffer — pre-27 via `withUnsafePointer(_:)`; on 27 via the new `pixelBuffer` property (`CVReadOnlyPixelBuffer`, `OS27`) and `pixelBuffer.withUnsafeBuffer`, which deprecates `withUnsafePointer`. There is no mutable `CVPixelBuffer` accessor.

**instanceAtPoint(_:)**: Takes a `NormalizedPoint` and returns the `IndexSet` of instances at that point. iOS 18+ modern `InstanceMaskObservation` only. (For raw label lookup you can instead use `allInstancesMask.pixel(at:)` — see below.)

```swift
// Center of image; returns an IndexSet (empty = background)
let instances = observation.instanceAtPoint(NormalizedPoint(x: 0.5, y: 0.5))

if instances.isEmpty {
    print("Background tapped")
} else {
    print("Instances \(instances) tapped")
}
```

#### Generating Masks

Three methods generate output from the selected instances. All are throwing and require the request handler that performed the request (`VNImageRequestHandler`/`ImageRequestHandler`).

**generateScaledMask(for:scaledToImageFrom:)** → soft segmentation mask

Parameters:
- `for`: `IndexSet` of instances to include
- `scaledToImageFrom`: the request handler that performed the request

Returns: single-channel floating-point `CVPixelBuffer` (soft mask) at the input image's resolution. No crop option — use it for compositing.

**generateMaskedImage(for:imageFrom:croppedToInstancesExtent:)** → masked image

Parameters:
- `for`: `IndexSet` of instances to include
- `imageFrom`: the request handler that performed the request
- `croppedToInstancesExtent`: `false` (default) = full image; `true` = tight crop around the selected instances

Returns: the masked **image** as a `CVPixelBuffer`, optionally cropped.

**generateMask(for:)** → handler-free soft mask (modern `InstanceMaskObservation` only)

Returns a soft mask without needing a handler. For input-resolution scaling use `generateScaledMask(for:scaledToImageFrom:)` instead.

```swift
// All instances, soft mask at input resolution (handler in scope)
let mask = try observation.generateScaledMask(
    for: observation.allInstances,
    scaledToImageFrom: handler
)

// Single instance, masked image cropped to its extent
let instances = IndexSet(integer: 1)
let croppedImage = try observation.generateMaskedImage(
    for: instances,
    imageFrom: handler,
    croppedToInstancesExtent: true
)
```

#### Instance Mask Hit Testing

The simplest path is `instanceAtPoint(_:)`, which maps a `NormalizedPoint` straight to an `IndexSet`. To read the raw label yourself, the `allInstancesMask` (`PixelBufferObservation`) gives you `pixel(at:)` for a single point; for whole-buffer scans use `withUnsafePointer(_:)` pre-27, or `pixelBuffer.withUnsafeBuffer` on 27 (`pixelBuffer` is the `OS27` read-only buffer accessor; `withUnsafePointer` is deprecated in 27 and renamed to it).

```swift
let labelMask = observation.allInstancesMask  // PixelBufferObservation

// Single point: read the label directly (returns Float; 0 = background)
let label = labelMask.pixel(at: NormalizedPoint(x: normalizedX, y: normalizedY))

let instances = label == 0
    ? observation.allInstances
    : IndexSet(integer: Int(label))

// Whole buffer: scan all labels via the unsafe pointer (pre-27;
// on 27 use labelMask.pixelBuffer.withUnsafeBuffer instead)
labelMask.withUnsafePointer { raw in
    let first = raw.load(fromByteOffset: 0, as: UInt8.self)
    // ... iterate label bytes as needed
    _ = first
}
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

#### ImageAnalysisInteraction (subjects)

Subject APIs live on `ImageAnalysisInteraction` (a `@MainActor` `UIInteraction`), NOT on the `ImageAnalysis` returned by `analyzer.analyze(...)`. The `ImageAnalysis` result only exposes `transcript` and `hasResults(for:)`.

**subjects**: `Set<ImageAnalysisInteraction.Subject>` - All subjects in image (async — read with `await`)

**highlightedSubjects**: `Set<ImageAnalysisInteraction.Subject>` - Currently highlighted (user long-pressed)

**subject(at:)**: Async lookup of subject at a point (returns `nil` if none)

**image(for:)**: Async composite of the given subjects

```swift
// Get all subjects (Set — cannot subscript by Int). `subjects` is async.
let subjects = await interaction.subjects

// Look up subject at tap
if let subject = await interaction.subject(at: tapPoint) {
    // Process subject
}

// Change highlight state (take first two safely)
interaction.highlightedSubjects = Set(subjects.prefix(2))
```

#### Subject Struct

The type is `ImageAnalysisInteraction.Subject` (nested on the interaction).

**image**: `UIImage` - Extracted subject with transparency. The accessor is `async throws` — read it with `try await`.

**bounds**: `CGRect` - Subject boundaries in image coordinates (`@MainActor`-isolated)

```swift
// Single subject image (`image` is async throws)
let subjectImage = try await subject.image

// Composite multiple subjects
let compositeImage = try await interaction.image(for: [subject1, subject2])
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
let handler = ImageRequestHandler(image)

guard let observation = try await handler.perform(GeneratePersonInstanceMaskRequest()) else {
    return
}

// Same InstanceMaskObservation API as foreground instance masks
let allPeople = observation.allInstances  // Up to 4 people (1-4)

// Get mask for person 1
let person1Mask = try observation.generateScaledMask(
    for: IndexSet(integer: 1),
    scaledToImageFrom: handler
)
```

**Limitations**:
- Segments up to 4 people
- With >4 people: may miss people or combine them (typically background people)
- Use `VNDetectFaceRectanglesRequest` to count faces if you need to handle crowded scenes

## Iterative Segmentation (Tap-to-Segment) `OS27`

`GenerateIterativeSegmentationRequest` segments **any object the user selects** — by tap, bounding box, or scribble/lasso — and refines the mask interactively. Modern Swift API; not available on watchOS. Apple ships a tap-to-segment sample app (WWDC 2026-237).

### Seeding and Refining

```swift
let handler = ImageRequestHandler(image)
let request = GenerateIterativeSegmentationRequest(seedPoint: point)  // NormalizedPoint
let observation = try await handler.perform(request)  // PixelBufferObservation?
let mask = observation?.pixelBuffer  // CVReadOnlyPixelBuffer (or try .cgImage)

// Refine: include the plate, exclude the cup — then perform again
try request.addIncludedPoint(platePoint)
try request.addExcludedPoint(cupPoint)
let refined = try await handler.perform(request)
```

Seed initializers (each takes an optional trailing `Revision` argument):

| Initializer | Use for |
|-------------|---------|
| `init(seedPoint: NormalizedPoint)` | Simple objects — single tap |
| `init(seedBox: NormalizedRect)` | Multiple or complex objects — drawn bounding box |
| `init(seedScribbleBuffer: CVReadOnlyPixelBuffer)` | Lasso or scribble strokes drawn by the user |

- `qualityLevel` — `.fast` / `.balanced` / `.accurate`
- Result is `PixelBufferObservation?` — pixels in the mask belong to the selected object
- Coordinates are normalized (0–1) with **lower-left origin** — the same conversion gotchas as every Vision request
- Scribble/lasso strokes must be at least **1% of the image width** wide; thinner strokes degrade results

### Model Download (DownloadableAssetsRequest)

The segmentation model is not on-device by default — **first use requires a download**. `GenerateIterativeSegmentationRequest` is the first request conforming to the new `DownloadableAssetsRequest` protocol (`OS27`):

```swift
switch await request.assetStatus {  // DownloadableAssetsRequestStatus
case .notReady:
    try await request.downloadAssets()  // or downloadAssets(progress: consuming Subprogress)
case .ready:
    break
case .error(let error):
    throw error  // surface or retry the download
@unknown default:
    break
}
```

Performing without the model downloaded fails; the legacy `VNError` domain adds `VNErrorResourceUnavailable` and `VNErrorResourceCorrupted` codes in 27 for asset failures. Check `assetStatus` before the first perform.

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

Detects **19 body landmarks** (2D normalized coordinates):

```swift
let request = VNDetectHumanBodyPoseRequest()
try handler.perform([request])

for observation in request.results as? [VNHumanBodyPoseObservation] ?? [] {
    // Process each person
}
```

### Body Landmarks (19 points)

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
| `.all` | All 19 landmarks |
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

**3D Body Landmarks** (17 joints, `VNHumanBodyPose3DObservation.JointName`): root, spine, centerShoulder, centerHead, topHead, plus left/right shoulder, elbow, wrist, hip, knee, ankle. The 3D skeleton is NOT the 2D set minus ears — it omits the 2D face/head joints (nose, eyes, ears, neck) and adds spine, centerShoulder, centerHead, topHead. (2D set = 19 joints via `VNHumanBodyPoseObservation.JointName`.)

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
// 1. Get mask from Vision (`handler` is the ImageRequestHandler that performed the request)
let handler = ImageRequestHandler(sourceImage)
guard let observation = try await handler.perform(GenerateForegroundInstanceMaskRequest()) else { return }
let visionMask = try observation.generateScaledMask(
    for: observation.allInstances,
    scaledToImageFrom: handler
)

// 2. Convert to CIImage
let maskImage = CIImage(cvPixelBuffer: visionMask)

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
└── document: DocumentObservation.Container
    ├── text: Container.Text
    ├── paragraphs: [Container.Text]
    ├── tables: [Container.Table]
    └── lists: [Container.List]
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
    case .link(let link):
        let url = link.url
    case .postalAddress(let address):
        let components = address
    case .calendarEvent(let event):
        let dates = (event.startDate, event.endDate)
    default:
        break
    }
}
```

#### Container.Text Hierarchy

```
Container.Text
├── transcript: String
├── lines: [RecognizedTextObservation]
├── words: [RecognizedTextObservation]?
└── detectedData: [DataDetectorMatch]
```

## Visual Intelligence Integration

Visual Intelligence is a **system-level feature** (iOS 26+; expands to iPadOS27/macOS27) that lets users point their camera at real-world objects — or highlight a screenshot — and find matching content across apps. This is distinct from the Vision framework (VNRequest-based image analysis) covered above. Vision analyzes images within your app; Visual Intelligence lets the system invoke your app when users search with the camera or screenshots.

The same `IntentValueQuery`, entities, and `OpenIntent` code works unchanged across iOS, iPadOS, and macOS. Platform differences worth handling:

- **iOS** — primary entry point is the camera (physical objects: posters, products, artwork)
- **iPad/Mac** — primary entry point is screenshots (digital media); make sure your search handles both kinds of content
- **Mac** — the input pixel buffer can be much larger than on iPhone; consider resizing before analysis

### How It Works

1. User activates Visual Intelligence camera or takes a screenshot
2. System analyzes what the user is looking at
3. System queries participating apps via `IntentValueQuery`
4. Your app receives a `SemanticContentDescriptor` with labels and/or pixel data
5. Your app searches its content and returns matching `AppEntity` results
6. Results appear in the Visual Intelligence UI with your app's branding

### Required Frameworks

```swift
import VisualIntelligence
import AppIntents
```

### SemanticContentDescriptor

The core object the system provides to describe what the user is looking at.

| Property | Type | Description |
|----------|------|-------------|
| `labels` | `[String]` | Classification labels for the detected item |
| `pixelBuffer` | `CVReadOnlyPixelBuffer?` | Visual data of the detected item |

Use labels for fast keyword matching against your content catalog. Use the pixel buffer for image-similarity search when labels are insufficient.

### Matching by Image Similarity (Feature Prints)

For visual matching against your own catalog, compare Vision feature prints. Pre-compute prints for catalog items (never at query time); at query time, convert the descriptor's pixel buffer to a `CGImage` and rank by distance:

```swift
import Vision
import VideoToolbox

var cgImage: CGImage?
_ = pixelBuffer.withUnsafeBuffer {
    VTCreateCGImageFromCVPixelBuffer($0, options: nil, imageOut: &cgImage)
}
guard let cgImage else { return [] }

let queryPrint = try await GenerateImageFeaturePrintRequest().perform(on: cgImage)
let distance = try queryPrint.distance(to: entry.featurePrint)  // pre-computed FeaturePrintObservation; smaller = more similar
```

Filter by a maximum distance, sort ascending, and cap the result count — return results fast and ranked. Returning an empty array is fine; the system handles the empty state.

### IntentValueQuery

The entry point for Visual Intelligence to communicate with your app. Implement `values(for:)` to receive search requests and return matching entities.

```swift
struct LandmarkIntentValueQuery: IntentValueQuery {
    @Dependency var modelData: ModelData

    func values(for input: SemanticContentDescriptor) async throws -> [LandmarkEntity] {
        if !input.labels.isEmpty {
            return try await modelData.search(matching: input.labels)
        }
        guard let pixelBuffer = input.pixelBuffer else { return [] }
        return try await modelData.search(matching: pixelBuffer)
    }
}
```

### Returning Multiple Result Types

Use `@UnionValue` when your app can return different entity types from a single search.

```swift
@UnionValue
enum VisualSearchResult {
    case landmark(LandmarkEntity)
    case collection(CollectionEntity)
}
```

### Display Representation

Visual Intelligence uses your entity's `DisplayRepresentation` to show results. Provide a title, subtitle, and image for each result.

```swift
struct LandmarkEntity: AppEntity {
    var id: String
    var name: String
    var location: String

    static var typeDisplayRepresentation: TypeDisplayRepresentation {
        TypeDisplayRepresentation(
            name: LocalizedStringResource("Landmark", table: "AppIntents"),
            numericFormat: "\(placeholder: .int) landmarks"
        )
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            subtitle: "\(location)",
            image: .init(named: thumbnailImageName)
        )
    }
}
```

### Deep Linking from Results

When a user taps a result, your app should open to the relevant content. Provide an `appLinkURL` on your entity.

```swift
var appLinkURL: URL? {
    URL(string: "yourapp://landmark/\(id)")
}
```

### "More Results" — Continue Search in Your App

Adopt the `semanticContentSearch` schema so the system's **More results** button lands users in your full in-app search, pre-populated from the captured context. The system provides the `semanticContent` property automatically — no `@Parameter` needed:

```swift
@AppIntent(schema: .visualIntelligence.semanticContentSearch)
struct SemanticContentSearchIntent: AppIntent {
    static let title: LocalizedStringResource = "Search in app"
    static let openAppWhenRun: Bool = true

    var semanticContent: SemanticContentDescriptor

    func perform() async throws -> some IntentResult {
        guard let pixelBuffer = semanticContent.pixelBuffer else { return .result() }
        // Search, then navigate to your full search UI pre-populated with results
        return .result()
    }
}
```

Your in-app search can show far more than the Visual Intelligence results sheet — filters, categories, the full depth of your content.

### System Store Integrations

Image Search is your app providing results *to* Visual Intelligence. The reverse also works: Visual Intelligence actions write data to system stores your app may already read — making Visual Intelligence a new input source with zero Visual Intelligence code. New in the 27 cycle: adding to contacts, saving multiple calendar events, and medical-device logging (WWDC 2026-297).

| Visual Intelligence captures | Your app reads it with |
|------------------------------|------------------------|
| Calendar events from posters/posts (multi-event saving `OS27`) | EventKit (`EKEventStore`) |
| Contact info from business cards `OS27` | Contacts (`CNContactStore`) |
| Medical-device readings (blood pressure monitors, glucose meters, scales) `OS27` | HealthKit (`HKHealthStore`) |

Observe store-change notifications (e.g. `.EKEventStoreChanged`) so entries created by Visual Intelligence appear in your app without a manual refresh.

### Best Practices

- **Return results quickly** — Visual Intelligence expects low-latency responses. Limit to 10-20 most relevant results; returning an empty array is fine
- **Prefer labels first** — Label matching is faster than pixel buffer analysis. Fall back to pixel buffer when labels are empty or insufficient
- **Serve thumbnail-sized images** — the results sheet shows ~3 lines of text + a thumbnail in a two-column layout; a single result's image spans the full sheet width
- **Reuse your existing `OpenIntent`** — if you already have one for the entity, Visual Intelligence uses it; don't write a separate one
- **Keep `perform()` lightweight** — it runs as your app comes to the foreground; navigate first, defer heavy loading until the view appears
- **Localize everything** — Display representations appear in the system UI. Use `LocalizedStringResource` for all user-facing text

### Testing

1. Build and run on a physical device (iPhone, iPad, or Mac)
2. Activate Visual Intelligence camera or take a screenshot of relevant content
3. Perform a visual search and verify your app's results appear (ordering among providers is decided by the system)
4. Tap results to verify deep linking opens the correct content
5. On Mac, test with large screenshots — input pixel buffers are bigger than iPhone's

## Vision on watchOS `watchOS27`

Vision arrives on watchOS in the 27 cycle — the framework does not exist in earlier watchOS SDKs. The watch gets the **modern Swift API only** (no legacy `VN*` request classes) and a subset of requests:

| On watchOS 27 | NOT on watchOS |
|---------------|----------------|
| Face detection/landmarks/capture quality | Text recognition (`RecognizeTextRequest`, `RecognizeDocumentsRequest`, `DetectTextRectanglesRequest`) |
| Image classification + animal recognition | All pose requests (body 2D/3D, hand, animal) |
| Segmentation (foreground/person/person-instance) | Optical flow (`TrackOpticalFlowRequest`) |
| Saliency (attention + objectness), feature prints | Iterative segmentation (tap-to-segment) |
| Barcodes, contours, rectangles, horizon, document segmentation | |
| Lens smudge, aesthetics scores, `CoreMLRequest` | |
| Tracking (object/rectangle/trajectories/registration), `VideoProcessor` | |

Canonical watch use case from WWDC 2026-237 — saliency-based cropping so small screens feature the subject prominently:

```swift
// Crop to the most prominent subject for a small watch screen
let request = GenerateObjectnessBasedSaliencyImageRequest()
let observation = try await request.perform(on: image)  // SaliencyImageObservation
let crop = observation.salientObjects.first?.boundingBox  // NormalizedRect
```

`salientObjects` is `[RectangleObservation]` — take `.boundingBox` (or the quadrilateral corners) for the crop rect.

## Vision Tools for Foundation Models `OS27`

Vision ships two ready-made `FoundationModels.Tool` implementations via a cross-import overlay (`import Vision` + `import FoundationModels`) so the on-device LLM can call computer vision on attached images:

| Tool | Purpose | Platforms |
|------|---------|-----------|
| `BarcodeReaderTool` | Barcode/QR reading — models can't read QR codes themselves | `OS27` (not tvOS) |
| `OCRTool` | Fine or dense text recognition, 30+ languages | `OS27` (not watchOS/tvOS) |

```swift
import FoundationModels
import Vision

let session = LanguageModelSession(tools: [BarcodeReaderTool()])
let response = try await session.respond(generating: EventInfo.self) {  // EventInfo: your @Generable struct
    "Get the date, location, and website from this flyer"
    Attachment(image)
        .label("flyer")  // labels are how the model picks which image to pass to a tool
}
```

Both tools accept optional `init(name:description:)` overrides. For image inputs, `ImageReference` tool arguments, and the rest of the Foundation Models surface, see axiom-ai `foundation-models-ref.md` (Built-in System Tools).

## API Quick Reference

### Subject Segmentation

| API | Platform | Purpose |
|-----|----------|---------|
| `VNGenerateForegroundInstanceMaskRequest` | iOS 17+ | Class-agnostic subject instances |
| `VNGeneratePersonInstanceMaskRequest` | iOS 17+ | Up to 4 people separately |
| `VNGeneratePersonSegmentationRequest` | iOS 15+ | All people (single mask) |
| `ImageAnalysisInteraction` (VisionKit) | iOS 16+ | UI for subject lifting |
| `GenerateIterativeSegmentationRequest` | `OS27` (not watchOS) | Tap/box/scribble-seeded segmentation of any object |

### Pose Detection

| API | Platform | Landmarks | Coordinates |
|-----|----------|-----------|-------------|
| `VNDetectHumanHandPoseRequest` | iOS 14+ | 21 per hand | 2D normalized |
| `VNDetectHumanBodyPoseRequest` | iOS 14+ | 19 body joints | 2D normalized |
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

### Visual Intelligence

| API | Platform | Purpose |
|-----|----------|---------|
| `SemanticContentDescriptor` | iOS 26+, iPadOS27/macOS27 | Describes what the user is looking at (labels + pixel buffer) |
| `IntentValueQuery` | iOS 26+, iPadOS27/macOS27 | Entry point for receiving visual search requests |
| `semanticContentSearch` schema | iOS 26+, iPadOS27/macOS27 | "More results" intent that continues search in your app |

### Observation Types

| Observation | Returned By |
|-------------|-------------|
| `InstanceMaskObservation` | Foreground/person instance masks (modern, iOS 18+) |
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
| `PixelBufferObservation` | Iterative segmentation mask (`OS27`); modern person segmentation |
| `SaliencyImageObservation` | Saliency heat map + salient object rects (modern) |

## Sensitive Content Analysis (`SensitiveContentAnalysis` framework)

A **separate framework** from Vision (and VisionKit), but the same job family — `SensitiveContentAnalysis` (iOS 17+, macOS 14+, visionOS 2+; **not watchOS/tvOS**) flags nudity, gore, and violence in images and video. It runs only when the user has the system **Sensitive Content Warning** / **Communication Safety** setting on: check `analysisPolicy` first, and treat `.disabled` as "feature off," not an error.

```swift
import SensitiveContentAnalysis

let analyzer = SCSensitivityAnalyzer()
guard analyzer.analysisPolicy != .disabled else { return }   // user setting gates analysis

let result = try await analyzer.analyzeImage(cgImage)         // -> SCSensitivityAnalysis
if result.isSensitive {
    if #available(iOS 27, macOS 27, visionOS 27, *) {
        let kinds = result.detectedTypes                     // Set<SCSensitivityAnalysis.ContentType>
        if kinds.contains(.goreOrViolence) { /* gore-specific UX */ }
        if kinds.contains(.sexuallyExplicit) { /* explicit-specific UX */ }
    }
}
```

| Member | Availability | Notes |
|--------|--------------|-------|
| `SCSensitivityAnalyzer` | iOS 17+, macOS 14+, visionOS 2+ | `analyzeImage(_:)` / `analyzeImage(at:)`; video via `videoAnalysis(forFileAt:)` → `VideoAnalysisHandler.hasSensitiveContent()` |
| `analysisPolicy` | iOS 17+ | `SCSensitivityAnalysisPolicy`: `.disabled` / `.simpleInterventions` / `.descriptiveInterventions` |
| `SCSensitivityAnalysis.isSensitive` | iOS 17+ | Boolean — *any* sensitive content |
| `SCSensitivityAnalysis.detectedTypes` | `OS27` (not watchOS/tvOS) | `Set<SCSensitivityAnalysis.ContentType>` — which categories |
| `SCSensitivityAnalysis.ContentType` | `OS27` (not watchOS/tvOS) | `.sexuallyExplicit`, `.goreOrViolence` |

**`OS27` upgrade — categorized results.** Before 27 you got only the boolean `isSensitive`. At 27 (`iOS27`/`macOS27`/`visionOS27`, not watchOS/tvOS) `detectedTypes` reports *which kind* of sensitive content was found, so you can branch handling (different messaging for gore vs. explicit). Guard it with `#available` and fall back to the boolean on earlier targets.

## Resources

**WWDC**: 2019-234, 2021-10041, 2022-10024, 2022-10025, 2025-272, 2023-10176, 2023-111241, 2023-10048, 2020-10653, 2020-10043, 2020-10099, 2026-237, 2026-297

**Docs**: /vision, /visionkit, /visualintelligence, /visualintelligence/semanticcontentdescriptor, /visualintelligence/integrating-your-app-with-visual-intelligence, /vision/generateiterativesegmentationrequest, /vision/vnrecognizetextrequest, /vision/vndetectbarcodesrequest, /sensitivecontentanalysis

**Skills**: skills/vision-framework.md, skills/vision-diag.md, axiom-ai (skills/foundation-models-ref.md)
