# camera-auditor

Scans Swift code for camera, video, and audio capture issues including deprecated APIs, missing interruption handlers, threading violations, and permission anti-patterns.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my camera code for issues?"
- "Audit my capture implementation"
- "Is my camera code following best practices?"
- "Check for deprecated camera APIs"
- "Review my AVFoundation capture code"

**Explicit command:**
```bash
/axiom:audit camera
```

## What It Does

### Critical Issues
- **Main thread session work** — `startRunning()` on main thread causes UI freezes
- **Missing purpose strings** — Camera/microphone usage without Info.plist keys causes App Store rejection

### High Priority
- **Deprecated videoOrientation** — Use `RotationCoordinator` instead (iOS 17+)
- **Missing interruption handling** — No observers for phone calls, multitasking
- **UIImagePickerController for photos** — Replace with PHPicker or PhotosPicker

### Medium Priority
- **Over-requesting photo library access** — PHPicker doesn't need permission
- **Missing photo quality settings** — Default `.quality` is slow for social apps
- **AVAudioSession category mismatch** — Wrong category prevents recording

### Low Priority
- **Configuration without block** — Missing `beginConfiguration`/`commitConfiguration`
- **Synchronous photo loading** — Blocking main thread during image load

## Example Output

```markdown
## Audit Summary

- **CRITICAL**: 2 issues
- **HIGH**: 3 issues
- **MEDIUM**: 1 issue

**Top priority fixes**:
1. Move startRunning() to session queue (UI freeze risk)
2. Add AVCaptureSession interruption observers
3. Replace deprecated videoOrientation with RotationCoordinator
```

## Related

- **axiom-camera-capture** skill — Session setup, rotation, interruption handling patterns
- **axiom-photo-library** skill — Photo picker and library patterns
