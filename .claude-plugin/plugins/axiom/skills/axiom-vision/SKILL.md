---
name: axiom-vision
description: Use when implementing ANY computer vision feature — image analysis, pose detection, person segmentation, subject lifting, text recognition, barcode scanning.
license: MIT
---

# Computer Vision

**You MUST use this skill for ANY computer vision work using the Vision framework.**

## Quick Reference

| Symptom / Task | Reference |
|----------------|-----------|
| Subject segmentation, lifting | See `references/vision.md` |
| Hand/body pose detection | See `references/vision.md` |
| Text recognition (OCR) | See `references/vision.md` |
| Barcode/QR code detection | See `references/vision.md` |
| Document scanning | See `references/vision.md` |
| DataScannerViewController | See `references/vision.md` |
| Structured document extraction (iOS 26+) | See `references/vision.md` |
| Isolate object excluding hand | See `references/vision.md` |
| Vision framework API reference | See `references/vision-ref.md` |
| Visual Intelligence integration (iOS 26+) | See `references/vision-ref.md` |
| Subject not detected | See `references/vision-diag.md` |
| Hand/body pose missing landmarks | See `references/vision-diag.md` |
| Low confidence observations | See `references/vision-diag.md` |
| UI freezing during processing | See `references/vision-diag.md` |
| Coordinate conversion bugs | See `references/vision-diag.md` |
| Text not recognized / wrong chars | See `references/vision-diag.md` |
| Barcode not detected | See `references/vision-diag.md` |
| DataScanner blank / no items | See `references/vision-diag.md` |
| Document edges not detected | See `references/vision-diag.md` |

## Decision Tree

```dot
digraph vision {
    start [label="Computer vision task" shape=ellipse];
    what [label="What do you need?" shape=diamond];

    start -> what;
    what -> "references/vision.md" [label="implement feature"];
    what -> "references/vision-ref.md" [label="API reference"];
    what -> "references/vision-ref.md" [label="Visual Intelligence"];
    what -> "references/vision-diag.md" [label="something broken"];
}
```

1. Implementing (pose, segmentation, OCR, barcodes, documents, live scanning)? → `references/vision.md`
2. Visual Intelligence system integration (camera feature, iOS 26+)? → `references/vision-ref.md` (Visual Intelligence section)
3. Need API reference / code examples? → `references/vision-ref.md`
4. Debugging issues (detection failures, confidence, coordinates)? → `references/vision-diag.md`

## Critical Patterns

**Implementation** (`references/vision.md`):
- Decision tree for choosing the right Vision API
- Subject segmentation with VisionKit
- Isolating objects while excluding hands (combining APIs)
- Hand/body pose detection (21/18 landmarks)
- Text recognition (fast vs accurate modes)
- Barcode detection with symbology selection
- Document scanning and structured extraction (iOS 26+)
- Live scanning with DataScannerViewController
- CoreImage HDR compositing

**Diagnostics** (`references/vision-diag.md`):
- Subject detection failures (edge of frame, lighting)
- Landmark tracking issues (confidence thresholds)
- Performance optimization (frame skipping, downscaling)
- Coordinate conversion (lower-left vs top-left origin)
- Text recognition failures (language, contrast)
- Barcode detection issues (symbology, size, glare)
- DataScanner troubleshooting (availability, data types)

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Vision framework is just a request/handler pattern" | Vision has coordinate conversion, confidence thresholds, and performance gotchas. vision.md covers them. |
| "I'll handle text recognition without the skill" | VNRecognizeTextRequest has fast/accurate modes and language-specific settings. vision.md has the patterns. |
| "Subject segmentation is straightforward" | Instance masks have HDR compositing and hand-exclusion patterns. vision.md covers complex scenarios. |
| "Visual Intelligence is just the camera API" | Visual Intelligence is a system-level feature requiring IntentValueQuery and SemanticContentDescriptor. vision-ref.md has the integration section. |
| "I'll just process on the main thread" | Vision blocks UI on older devices. Users on iPhone 12 will experience frozen app. 15 min to add background queue. |

## Example Invocations

User: "How do I detect hand pose in an image?"
→ See `references/vision.md`

User: "Isolate a subject but exclude the user's hands"
→ See `references/vision.md`

User: "How do I read text from an image?"
→ See `references/vision.md`

User: "Scan QR codes with the camera"
→ See `references/vision.md`

User: "Subject detection isn't working"
→ See `references/vision-diag.md`

User: "Text recognition returns wrong characters"
→ See `references/vision-diag.md`

User: "Show me VNDetectHumanBodyPoseRequest examples"
→ See `references/vision-ref.md`

User: "How do I make my app work with Visual Intelligence?"
→ See `references/vision-ref.md`

User: "RecognizeDocumentsRequest API reference"
→ See `references/vision-ref.md`
