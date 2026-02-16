---
name: camera-capture-diag
description: Troubleshooting AVFoundation camera issues — black preview, frozen camera, wrong rotation, slow capture, session interruptions, permission problems
---

# Camera Capture Diagnostics

Systematic troubleshooting for AVFoundation camera issues including frozen previews, wrong rotation, slow capture, session interruptions, and permission problems.

## Overview

When camera doesn't work, the problem is usually threading (35%), session lifecycle (25%), rotation (20%), permissions (15%), or configuration (5%). This diagnostic enforces environment checks before code debugging.

## Symptoms This Diagnoses

Use when you're experiencing:
- Black or frozen camera preview
- UI freezes for 1-3 seconds when opening camera
- Camera freezes during a phone call or in Split View
- Preview or captured photo rotated 90 degrees wrong
- Front camera photo doesn't match mirrored preview
- Photo capture takes 2+ seconds
- "Camera in use by another app" errors
- Camera stops working after prolonged use (thermal)
- Crash on older iOS versions using iOS 17+ APIs
- Permission denied or not requested

## Example Prompts

- "My camera preview is just a black screen"
- "The UI freezes when I open the camera"
- "Camera freezes when I get a phone call"
- "Why is the captured photo rotated wrong?"
- "The front camera photo doesn't match the preview"
- "Photo capture is really slow, takes 2+ seconds"
- "Camera crashes on iOS 16 devices"
- "User says camera permission is denied but they never saw a prompt"

## Diagnostic Workflow

```
1. Check Session State (2 min)
   ├─ Verify session.isRunning = true
   ├─ Verify inputs.count >= 1
   ├─ Verify outputs.count >= 1
   └─ Check preview layer connection

2. Check Threading (2 min)
   ├─ Verify startRunning() is on background queue
   ├─ Verify all session work on sessionQueue
   └─ Verify UI updates on main thread

3. Check Permissions (1 min)
   ├─ Print authorizationStatus
   ├─ Handle .notDetermined (request)
   └─ Handle .denied (settings prompt)

4. Check Interruptions (2 min)
   ├─ Add interruption observer
   ├─ Reproduce with phone call
   └─ Verify UI feedback shown
```

## Diagnostic Patterns

This skill covers 15 diagnostic patterns:

| Symptom | Check First | Likely Fix |
|---------|-------------|------------|
| Black preview | Session state | Start session, add input, connect preview layer |
| UI freezes | Threading | Move startRunning() to background queue |
| Freezes on call | Interruptions | Add interruption observer with UI feedback |
| Wrong rotation | Rotation angle | Use RotationCoordinator (iOS 17+) |
| Slow capture | Quality setting | Set photoQualityPrioritization to .speed or .balanced |
| Denied access | Permissions | Show settings prompt |
| Crash on old iOS | @available check | Guard iOS 17+ APIs |
| Random stops | Thermal state | Reduce quality, show cooling message |
| iPad Split View | Multitasking | Show "unavailable in Split View" message |
| Front camera "bug" | Mirroring | Explain: preview mirrors, photo does not (Apple standard) |

## Documentation Scope

This is a **diagnostic skill** -- it enforces systematic troubleshooting workflows before diving into code. Each of the 15 patterns includes specific symptoms, diagnostic steps, and fixes with estimated time to resolve.

**For implementation patterns:** See [camera-capture](/skills/integration/camera-capture) for building camera features from scratch.

**For API reference:** See [camera-capture-ref](/reference/camera-capture-ref) for complete API documentation.

## Related

- [camera-capture](/skills/integration/camera-capture) -- Camera implementation patterns and session setup
- [camera-capture-ref](/reference/camera-capture-ref) -- Complete AVFoundation camera API reference
- [photo-library](/skills/integration/photo-library) -- Photo picking and library access

## Resources

**WWDC**: 2021-10247, 2023-10105

**Docs**: /avfoundation/avcapturesession, /avfoundation/avcapturesessionwasinterruptednotification
