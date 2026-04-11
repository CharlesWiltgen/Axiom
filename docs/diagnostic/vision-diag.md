# Vision Framework Diagnostics

Systematic troubleshooting for Vision framework issues: subjects not detected, missing landmarks, low confidence, performance problems, and coordinate mismatches.

## Core Principle

When Vision doesn't work, the problem is usually:

1. **Environment** (lighting, occlusion, edge of frame) - 40%
2. **Confidence threshold** (ignoring low confidence data) - 30%
3. **Threading** (blocking main thread causes frozen UI) - 15%
4. **Coordinates** (mixing lower-left and top-left origins) - 10%
5. **API availability** (using iOS 17+ APIs on older devices) - 5%

**Always check environment and confidence BEFORE debugging code.**

## Common Issues

### Subject Not Detected

**Symptom**: `request.results` is nil or empty

**Diagnostic steps**:
1. Verify request succeeded (no error thrown)
2. Check subject size (should be >10% of image)
3. Inspect lighting and contrast
4. Ensure subject not at edge of frame

**Common causes**:
- Subject too small
- Poor lighting/blur
- Low contrast with background
- Partial occlusion at edge

### Hand Pose Missing Landmarks

**Symptom**: Hand detected but landmarks have low confidence

**Diagnostic code**:

```swift
let allPoints = try observation.recognizedPoints(.all)

for (key, point) in allPoints {
    if point.confidence < 0.3 {
        print("\(key): LOW CONFIDENCE (\(point.confidence))")
    }
}
```

**Common causes**:
- Hand parallel to camera (rotate hand toward lens)
- Hand near edge of frame
- Gloves or occlusion
- Feet misidentified as hands

### UI Freezing

**Symptom**: App freezes during Vision processing

**Diagnostic**:

```swift
print("Thread: \(Thread.isMainThread ? "MAIN" : "Background")")
```

**Fix**: Move to background queue

```swift
DispatchQueue.global(qos: .userInitiated).async {
    let request = VNGenerateForegroundInstanceMaskRequest()
    try? handler.perform([request])

    DispatchQueue.main.async {
        // Update UI
    }
}
```

### Overlays in Wrong Position

**Symptom**: UI overlays don't align with detected features

**Root cause**: Coordinate system mismatch (Vision uses lower-left origin, UIKit uses top-left)

**Fix**:

```swift
// ❌ WRONG
let uiY = visionPoint.y * height

// ✅ CORRECT
let uiY = (1 - visionPoint.y) * height  // Flip Y axis
```

### Person Segmentation Missing People

**Symptom**: `VNGeneratePersonInstanceMaskRequest` detects fewer people than expected

**Root cause**: API segments up to 4 people maximum

**Diagnostic**:

```swift
let faceRequest = VNDetectFaceRectanglesRequest()
try handler.perform([faceRequest])

let faceCount = faceRequest.results?.count ?? 0

if faceCount > 4 {
    print("Crowded scene - some people will be missed/combined")
}
```

**Fix**: Fallback to `VNGeneratePersonSegmentationRequest` (single mask for all people)

## Performance Optimization

### Slow Processing

**Diagnostic**: Measure request time

```swift
let start = CFAbsoluteTimeGetCurrent()
try handler.perform([request])
let elapsed = CFAbsoluteTimeGetCurrent() - start

print("Request took \(elapsed * 1000)ms")
```

**Common fixes**:

| Cause | Fix | Time Saved |
|-------|-----|------------|
| `maximumHandCount` = 10 | Set to actual need (2) | 50-70% |
| Processing every frame | Skip frames (every 3rd) | 66% |
| Full-res images | Downscale to 1280x720 | 40-60% |

## Quick Reference

| Symptom | First Check | Pattern | Est. Time |
|---------|-------------|---------|-----------|
| No results | Subject size/lighting | Environment | 30 min |
| Low confidence | Hand/body orientation | Confidence | 45 min |
| UI freezes | Thread check | Threading | 15 min |
| Wrong position | Coordinate conversion | Coordinates | 20 min |
| Missing people (>4) | Face count | Crowded scene | 30 min |

## Resources

- [Vision Framework (Main Skill)](/skills/computer-vision/vision) - Implementation patterns
- [Vision Framework API Reference](/reference/vision-ref) - Complete API docs

### Apple Documentation

- [Vision Framework](https://developer.apple.com/documentation/vision)
- [Vision Performance Best Practices](https://developer.apple.com/documentation/vision/applying_mps_graphs_to_vision_requests)
