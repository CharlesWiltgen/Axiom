# HDR Tone Mapping & Color Reference

How HDR content is tone-mapped when drawn, and how the 27 releases carry adaptive tone-mapping metadata in ICC profiles.

## When to Use This Reference

Use this reference when:
- HDR images look washed out, clipped, or too dark when drawn into a `CGContext`
- Choosing a tone-mapping method for HDR-to-SDR display
- Reading or attaching Headroom Adaptive Gain Curve (HAGC) metadata on an ICC profile
- Persisting a `CGColor` or `CGColorSpace`
- Deciding whether a display's headroom should change how content is rendered

## Part 1: Tone Mapping at Draw Time

Two separate surfaces control tone mapping, and they are easy to confuse.

| Surface | Availability | What it is |
|---|---|---|
| `CGContentToneMappingInfo` | 26 | Swift-native enum, a **gstate parameter** on the context — applies to HDR `CGColor`s and `CGImage`s drawn into it |
| `CGToneMapping` | pre-26, C-imported | The method argument to `CGContextDrawImageApplyingToneMapping`, which **overrides** the gstate for that one draw |

### The trap `OS27`

**The Swift-refined `CGContentToneMappingInfo` enum cannot express HAGC.** It gained no case in 27 — still only `.default`, `.imageSpecificLumaScaling`, `.referenceWhiteBased`, `.ituRecommended`, `.exrGamma`, `.none`. (The underlying C type is a struct whose `method` field is a `CGToneMapping` and *does* accept the HAGC value; it is the refined Swift enum you actually write against that cannot.) From Swift, reach HAGC through the C-imported `CGToneMapping`:

```swift
@available(iOS 27, macOS 27, tvOS 27, watchOS 27, *)
func drawHDR(_ image: CGImage, in rect: CGRect, into ctx: CGContext) {
    _ = ctx.draw(image, in: rect, by: .headroomAdaptiveGainCurve, options: nil)
}
```

Reaching for `CGContentToneMappingInfo` because it is the modern, Swift-native, more-recently-introduced type is the failure mode here. Newer spelling, narrower capability.

Note the drawing *function* is not new — `CGContextDrawImageApplyingToneMapping` dates to iOS 18. Only the `.headroomAdaptiveGainCurve` **method value** is new in 27.

### Availability — read the compiler, not the header

Both halves ship on **all five platforms at 27**, so `@available(anyAppleOS 27, *)` correctly covers code that reads metadata and draws with it.

The two headers do not *look* symmetric, and that is the trap. ColorSync spells visionOS out; CoreGraphics does not:

```c
// ColorSyncHeadroomAdaptiveGainCurve.h
API_AVAILABLE_BEGIN(macos(27.0), ios(27.0), tvos(27.0), watchos(27.0), visionos(27.0))

// CGToneMapping.h — no visionos clause
kCGToneMappingHeadroomAdaptiveGainCurve API_AVAILABLE(macos(27.0), ios(27.0), tvos(27.0), watchos(27.0)) = 6,
```

**An omitted `visionos` clause means "inferred from iOS," not "unavailable."** Building for `arm64-apple-xros27.0` compiles clean; building for `xros26.0` reports *"only available in visionOS 27.0 or newer"* — a version gate, which is what an inferred-and-introduced API looks like. Genuine unavailability reads differently (*"'UIScreen' is unavailable in visionOS"*).

The same file proves the rule locally: the enclosing `CGToneMapping` enum also omits `visionos`, yet CoreGraphics' `.swiftinterface` resolves its draw method to `visionOS 2.0`.

When platform support is the question, typecheck against the platform's SDK. Header annotations under-report by design.

## Part 2: HAGC Metadata (ColorSync)

New in the 27 releases per **ICC and SMPTE ST 2094-50:2026**. The curve travels inside the ICC profile: ColorSync reads and writes it, CoreGraphics consumes it at draw time. A new C header, `ColorSyncHeadroomAdaptiveGainCurve.h`, backs a Swift overlay — this is *not* a Swift-ification of legacy ColorSync. That overlay contains **only** HAGC; the rest of ColorSync still reaches Swift as bare CF types with no overlay of its own.

```swift
@available(anyAppleOS 27, *)
func copyCurve(from source: ColorSyncProfile,
               to destination: ColorSyncProfile) -> ColorSyncProfile? {
    guard let curve = source.headroomAdaptiveGainCurve else { return nil }  // Optional
    return destination.adding(headroomAdaptiveGainCurve: curve)             // also Optional
}
```

For a cheap presence check, call `ColorSyncProfileContainsHeadroomAdaptiveGainCurve(profileRef) -> Bool` — the one function in the header *not* marked `CF_REFINED_FOR_SWIFT`, so it is the C entry point you call directly from Swift.

**Every initializer in the curve tree `throws`** — they are validating constructors, so `HeadroomAdaptiveGainCurve(...)` without `try` does not compile. (`HeadroomAdaptiveGainCurveOptions.init()` is the lone non-throwing init, and it configures nothing about the curve.) The `Error` enum carries the runtime limits (`tooManyControlPoints(count:limit:)`, `mismatchedTangentCount`, `zeroFreeStyleWeights`, …). Both `adding(...)` overloads return an **Optional** profile.

### Curve semantics

These come from the SDK doc comments; Apple's web documentation covers the keys only as an ASCII tree in the C header.

| Symbol | Meaning |
|---|---|
| `ControlPoints.x` | Input levels normalized to [0,1] — **0 = reference white, 1 = peak signal** |
| `ControlPoints.y` | Gain offsets **in stops**; positive expands dynamic range. **Max 32 points** |
| `Slopes.interpolate` | Tangents computed by PCHIP (Piecewise Cubic Hermite Interpolating Polynomial) |
| `Slopes.tangent` | Explicit tangents as **tan(slope_angle)**, one per control point |
| `ComponentMix.freeStyle` | `signal = R·red + G·green + B·blue + MAX(R,G,B)·maxRGB + MIN(R,G,B)·minRGB + C·component` |
| `baselineHeadroomStops` | Baseline headroom in **stops above reference white** |

**Scope**: *authoring* gain curves is niche pro-imaging work. The two broadly useful halves are **detection** (does this asset carry a curve?) and **consumption** (draw with it). Reach for the full `ColorVolumeTransform` / `ToneMapping` / `AlternateCurve` tree only if you are building a color pipeline.

## Part 3: Codable Color `OS27`

`CGColor`, `CGColorSpace`, and `CGInterpolationQuality` conform to `Codable` in 27; `CGInterpolationQuality` alone also gains `CustomDebugStringConvertible`. Persisting a color or color space no longer means hand-extracting components and reconstructing them on load.

Do not confuse this with `CGPoint` / `CGRect` / `CGSize` / `CGVector` / `CGAffineTransform`, whose `Codable` conformances already existed — in 27 they only gained `@retroactive`.

## Resources

**Docs**: /coregraphics/cgtonemapping, /coregraphics/cgcontext, /colorsync

**Skills**: axiom-graphics (skills/display-performance.md), axiom-media (skills/photo-library.md), axiom-media (skills/avfoundation-video-ref.md)
