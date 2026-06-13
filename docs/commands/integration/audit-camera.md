---
name: audit-camera
description: Scan camera/video/audio capture code for deprecated APIs, missing interruption handlers, threading violations
---

# audit-camera

Scan AVFoundation camera and capture code for deprecated APIs and threading issues that cause silent capture failures.

## What This Command Does

Launches the **camera-auditor** agent to flag capture-pipeline patterns that worked in earlier iOS releases but now silently fail — particularly around interruption handling, session configuration on the wrong queue, and deprecated capture APIs.

## What It Checks

1. **Deprecated camera APIs** – `AVCaptureStillImageOutput`, legacy preset constants, removed delegate methods
2. **Missing interruption handlers** – no observer for `AVCaptureSession.wasInterruptedNotification`, leading to dead sessions after a phone call
3. **Threading violations** – session configuration off the dedicated session queue, causing crashes in `commitConfiguration()`
4. **Permission anti-patterns** – capture started before authorization granted, or no fallback when denied
5. **Photo/video output mismatches** – output type chosen at runtime in a way that prevents preset compatibility

## Related Agent

- [camera-auditor](/agents/camera-auditor) – The agent that powers this command
- [camera-capture-ref](/reference/camera-capture-ref) – Camera capture reference
