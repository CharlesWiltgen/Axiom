---
name: dockkit
description: Motorized camera stand and gimbal integration for subject tracking and custom motor control
skill_type: skill
version: 1.0
apple_platforms: iOS 17+, iPadOS 17+, Mac Catalyst 17+, macOS 14+
---

# DockKit

DockKit lets your camera app drive motorized stands and gimbals that physically pan and tilt to keep subjects in frame across a 360-degree field of view. Automatic tracking works in any camera app with zero code; you integrate only when you want custom framing, direct motor control, your own tracking model, device animations, or the on-device tracking signals added in iOS 18.

Part of the **axiom-media** suite (`skills/dockkit.md`).

## When to Use

Use this skill when you're:
- Building a camera, video-conferencing, live-streaming, fitness, or education app that should track subjects on a motorized stand
- Customizing how a subject is framed (alignment or a region of interest)
- Taking direct control of the motors for custom motion or animations
- Feeding your own Vision / Core ML inference to track non-default subjects (hands, animals, objects)
- Reacting to accessory buttons (shutter, flip, zoom) or gimbal controls
- Reading intelligent-tracking signals (saliency, speaking, looking-at-camera) to build custom tracking logic (iOS 18+)

## Example Prompts

- "How do I track a subject with a DockKit motorized stand?"
- "How do I take direct control of a DockKit stand's motors?"
- "How do I feed my own Vision hand-tracking into DockKit?"
- "Why isn't my DockKit custom motor control doing anything?"
- "How do I read which person is speaking from DockKit tracking states?"
- "How do I handle DockKit gimbal buttons and battery level?"

## Key Concepts

### Observe dock state first

`.docked` and `.undocked` are inverted from intuition: `.undocked` means the phone IS in the stand and connected. Gate all control on `.undocked` from the `accessoryStateChanges` async sequence.

### System tracking overrides you

System tracking is on by default. Disable it before any custom motor control or custom inference, or your commands are silently ignored:

```swift
try await DockAccessoryManager.shared.setSystemTrackingEnabled(false)
```

### Direct motor control

`setAngularVelocity(_:)` takes a `Spatial.Vector3D` in radians/second for pitch (x), yaw (y), and roll (z):

```swift
import Spatial
// Pan right at 0.2 rad/s while tilting down at 0.1 rad/s
try await accessory.setAngularVelocity(Vector3D(x: -0.1, y: 0.2, z: 0))
```

### Coordinate origins differ

Region of interest uses an upper-left (display) origin; `DockAccessory.Observation` rects use a lower-left (Vision) origin. Vision results pass straight through to `track(_:cameraInformation:)`.

### iOS 18 intelligent tracking

The `trackingStates` async sequence exposes per-subject saliency rank, speaking confidence, and looking-at-camera confidence so you can build features like "always track the active speaker" via `selectSubjects(_:)`.

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| Treating `.docked` as "ready" | Commands sent with no accessory | Gate on `.undocked` |
| Leaving system tracking on | Custom control silently overridden | `setSystemTrackingEnabled(false)` first |
| Missing camera permission | `.cameraTCCMissing` thrown | Request `NSCameraUsageDescription` first |
| Confusing coordinate origins | Tracking drifts or inverts | Region of interest = upper-left; observations = lower-left |
| `Thread.sleep`/GCD between commands | Blocks, fights the async API | Use `Task.sleep`; the APIs are async |

## Related

- [camera-capture](/skills/integration/camera-capture) — The underlying AVCaptureSession DockKit tracks against
- [now-playing](/skills/integration/now-playing) — Other media-suite system integrations
- For custom Vision / Core ML inference feeding observations, see the axiom-vision suite

## Resources

**WWDC**: 2023-10304, 2024-10164, 2023-111336

**Docs**: /dockkit, /dockkit/dockaccessory, /dockkit/dockaccessorymanager, /dockkit/dockaccessory/observation, /dockkit/dockkiterror
