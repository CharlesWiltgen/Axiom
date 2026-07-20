---
name: hdr-color-ref
description: HDR tone mapping and color metadata — CGContentToneMappingInfo vs CGToneMapping, the Headroom Adaptive Gain Curve (HAGC) added in the 27 releases, and Codable CGColor/CGColorSpace
---

# HDR Tone Mapping & Color Reference

API reference for how HDR content is tone-mapped when it is drawn, and how the 27 releases carry adaptive tone-mapping metadata inside ICC profiles. If an HDR image looks washed out, clipped, or unexpectedly dark once your code draws it, the cause is almost always which tone-mapping method the draw used.

## When to Use This Reference

Use this reference when:
- HDR images look washed out, clipped, or too dark when drawn into a `CGContext`
- You are choosing a tone-mapping method for HDR-to-SDR display
- You need to read or attach Headroom Adaptive Gain Curve (HAGC) metadata on an ICC profile
- You are persisting a `CGColor` or `CGColorSpace` and want to stop hand-extracting components
- You are deciding whether a display's headroom should change how your content renders

## Example Prompts

Questions you can ask Claude that draw from this reference:

- "My HDR photo looks washed out when I draw it into a `CGContext` — why?"
- "What's the difference between `CGContentToneMappingInfo` and `CGToneMapping`?"
- "How do I draw an image using the Headroom Adaptive Gain Curve?"
- "How do I check whether an ICC profile carries a gain curve?"
- "Can I encode a `CGColor` with `Codable` now?"
- "Why doesn't `CGContentToneMappingInfo` have a HAGC case?"

## What's Covered

### Tone mapping at draw time

- `CGContentToneMappingInfo` – the Swift-native gstate parameter (iOS 26), and its six cases
- `CGToneMapping` – the C-imported method argument that overrides the gstate for a single draw
- `CGContextDrawImageApplyingToneMapping` / `CGContext.draw(_:in:by:options:)`
- Why the newer Swift enum is the *narrower* of the two

### Headroom Adaptive Gain Curve (iOS 27)

- `ColorSyncProfile.headroomAdaptiveGainCurve`, `.headroomAdaptiveGainCurveMetadata`
- `adding(headroomAdaptiveGainCurve:)` and `adding(headroomAdaptiveGainCurveMetadata:options:)`
- `ColorSyncProfileContainsHeadroomAdaptiveGainCurve` for detection
- The validating-constructor tree: `ColorVolumeTransform`, `ToneMapping`, `Method`, `AlternateCurve`, `ControlPoints`, `ComponentMix`
- Curve semantics — control-point ranges, gain in stops, PCHIP interpolation, the free-style mix formula
- Why an omitted platform in an ObjC `API_AVAILABLE` clause means *inferred from iOS*, not unavailable — both halves ship on all five platforms at 27

### Codable color (iOS 27)

- `CGColor`, `CGColorSpace`, `CGInterpolationQuality` conformances
- Which geometry types only gained `@retroactive` (and so are not new)

## Documentation Scope

This page documents the `hdr-color-ref` skill in the axiom-graphics suite.

- For frame rate, ProMotion, and render-loop pacing, see [Display Performance](/skills/debugging/display-performance) — that page covers *when* frames present, this one covers how their colors are mapped
- For HDR capture and Apple Log recording, see [AVFoundation Video & Media Engine](/reference/avfoundation-video-ref)
- For decoding and downsampling image data safely, see [Photo Library](/skills/integration/photo-library)
