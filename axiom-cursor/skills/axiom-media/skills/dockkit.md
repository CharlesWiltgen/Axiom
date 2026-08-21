
# DockKit — Motorized Camera Stands

DockKit lets your camera app drive motorized stands and gimbals that physically pan and tilt to keep subjects in frame across a 360-degree field of view. The iPhone is the brain: subject detection, tracking, and motor control all run on-device, so *any* app that uses the camera benefits automatically — and you can take direct control when you want a custom experience.

## Overview

A DockKit stand extends any iPhone camera to 360 degrees of pan (Yaw) and 90 degrees of tilt (Pitch) using an on-device system tracker. The phone analyzes camera frames, decides who to track, and sends actuation commands to the dock over the DockKit protocol. Because this runs in the camera pipeline at the system level, automatic tracking works with zero code in any app using the camera APIs.

You integrate with DockKit only when you want *more* than the default: custom framing, direct motor control, your own tracking model, device animations, or access to the on-device ML tracking signals (iOS 18+).

## When to Use This Skill

- Building a camera, video-conferencing, live-streaming, fitness, or education app that should track subjects on a motorized stand
- Customizing how the subject is framed (alignment or region of interest)
- Taking direct control of the motors for custom motion or animations
- Feeding your own Vision / Core ML inference to track non-default subjects (hands, animals, objects)
- Reacting to accessory buttons (shutter, flip, zoom) or gimbal controls (iOS 18+)
- Reading intelligent-tracking signals (saliency, speaking, looking-at-camera) to build custom tracking logic (iOS 18+)

## System Requirements

| API | Availability |
|-----|--------------|
| `DockAccessory`, `DockAccessoryManager` | iOS 17.0+, iPadOS 17.0+, Mac Catalyst 17.0+, macOS 14.0+ |
| `DockAccessory.TrackingStates`, `selectSubjects`, battery states, button events | iOS 18.0+ |
| `NSCameraUsageDescription` | Required — DockKit operates inside the camera pipeline |

`accessoryStateChanges` throws `DockKitError.notSupported` on macOS. Most app integration targets iOS/iPadOS.

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| `.docked` means **no device present** | The state names are inverted from intuition: `.docked` = stand has no phone, `.undocked` = phone is in the stand and connected | Treat `.undocked` as "ready"; gate all control on it |
| Custom motor/inference does nothing | System tracking is on by default and overrides your commands | `try await DockAccessoryManager.shared.setSystemTrackingEnabled(false)` before custom control |
| `.cameraTCCMissing` thrown | Camera permission not granted | Request camera access (`NSCameraUsageDescription`) before any DockKit call |
| Coordinate origin mismatch | Region of interest uses **upper-left** (display) origin; `Observation` rects use **lower-left** (Vision) origin | Keep the two coordinate spaces straight; set `.corrected` on the `CameraInformation` orientation when your coords are already in the standard unit rect |
| Feeding `track()` too fast/slow | Observation delivery outside the valid rate window throws `.frameRateTooHigh` / `.frameRateTooLow` | Feed observations at a steady camera-pipeline rate; handle both errors |

## Part 1 — Tracking out of the box

No code required. When a DockKit stand is paired and the phone is docked, the system tracker keeps subjects framed in any app that opens an `AVCaptureSession` — including the built-in Camera and FaceTime. A statistical filter (EKF) smooths inference gaps and handles multi-person scenes, tracking a primary subject and re-framing when a second person or object becomes relevant.

You only write DockKit code to customize this behavior.

## Part 2 — Observe dock state before controlling anything

A dock/undock notification is the prerequisite for any customization. Get a `DockAccessory` reference from the state-change stream, then drive it.

```swift
import DockKit

func observeDock() async throws {
    // accessoryStateChanges is a throwing getter ({ get throws }) — note `try`
    for await event in try DockAccessoryManager.shared.accessoryStateChanges {
        switch event.state {
        case .undocked:                 // phone IS in the stand and connected
            if let accessory = event.accessory {   // event.accessory is DockAccessory?
                await configure(accessory)
            }
        case .docked:                   // no phone in the stand
            break
        @unknown default:
            break
        }
    }
}
```

Treat the stream as long-lived; iterate it for the lifetime of the capture session.

## Part 3 — Framing

Two ways to control how the subject sits in the cropped frame.

**Alignment** — keep automatic tracking but bias the composition left, center, or right. Useful when a graphic overlay occupies part of the frame.

```swift
// Bias framing to the right to balance a logo on the left third
try await accessory.setFramingMode(.right)
```

**Region of interest** — define exactly where the tracked subject should be kept, in normalized coordinates with an **upper-left** origin.

```swift
// Keep the subject in a centered square (e.g. for a square-cropped call UI).
// `regionOfInterest` is get-only — set it with the async setter.
try await accessory.setRegionOfInterest(CGRect(x: 0.25, y: 0.0, width: 0.5, height: 1.0))
```

## Part 4 — Direct motor control

To drive the motors yourself, first disable system tracking, then send angular velocities or absolute orientations. The motion model is two axes: Pitch (tilt, around X) and Yaw (pan, around Y).

`setAngularVelocity(_:)` takes a `Spatial.Vector3D` in axis/angle notation — radians per second for pitch (x), yaw (y), and roll (z).

```swift
import DockKit
import Spatial

func sweep(_ accessory: DockAccessory) async throws {
    try await DockAccessoryManager.shared.setSystemTrackingEnabled(false)

    // Pan right at 0.2 rad/s while tilting down at 0.1 rad/s
    try await accessory.setAngularVelocity(Vector3D(x: -0.1, y: 0.2, z: 0))
    try await Task.sleep(for: .seconds(2))

    // Reverse: pan left, tilt up
    try await accessory.setAngularVelocity(Vector3D(x: 0.1, y: -0.2, z: 0))
    try await Task.sleep(for: .seconds(2))

    try await accessory.setAngularVelocity(Vector3D(x: 0, y: 0, z: 0)) // stop
}
```

For absolute or relative target positions instead of continuous velocity, use DockKit's orientation API (it takes a `Spatial.Rotation3D` target). Re-enable system tracking (`setSystemTrackingEnabled(true)`) when you want the dock to resume automatic framing.

## Part 5 — Custom inference

Replace the default face/body tracking with your own detector by feeding `DockAccessory.Observation` values to `track(_:cameraInformation:)`. An observation is a normalized bounding box (Vision's **lower-left** origin) with an `ObservationType` of `.humanFace`, `.humanBody`, or `.object`. Using `.humanFace`/`.humanBody` preserves the system's multi-person framing optimizations.

```swift
import DockKit
import Vision

func trackHand(in pixelBuffer: CVPixelBuffer,
               accessory: DockAccessory,
               cameraInfo: DockAccessory.CameraInformation) async throws {
    try await DockAccessoryManager.shared.setSystemTrackingEnabled(false)

    let request = VNDetectHumanHandPoseRequest()
    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer)
    try handler.perform([request])

    guard let hand = request.results?.first,
          let thumb = try? hand.recognizedPoint(.thumbTip), thumb.confidence > 0.3
    else { return }

    // Vision points are normalized, lower-left origin — same space DockKit expects
    let rect = CGRect(x: thumb.location.x - 0.05, y: thumb.location.y - 0.05,
                      width: 0.1, height: 0.1)
    // Observation identifiers are Int (your own per-frame IDs), distinct from the
    // UUID identifiers that tracking states / selectSubjects use.
    let observation = DockAccessory.Observation(identifier: 0, type: .object, rect: rect)

    // How DockKit interprets these coordinates comes from cameraInfo.orientation
    // (a DockAccessory.CameraOrientation, e.g. .corrected for the standard unit rect),
    // set when you build the CameraInformation — not from track().
    try await accessory.track([observation], cameraInformation: cameraInfo)
}
```

`CameraInformation` is built from your capture device
(`init(captureDevice:cameraPosition:orientation:cameraIntrinsics:referenceDimensions:)`).
Vision requests (body pose, animal body pose, barcode) share DockKit's coordinate system, so their bounding boxes pass through directly — you only set the device orientation.

## Part 6 — Device animations

Drive motion as an affordance. Built-in animations are `.yes` (nod), `.no` (shake), `.wakeup` (rise to center), and `.kapow` (quick tilt-and-snap). Disable system tracking, run the animation, then re-enable.

```swift
func celebrate(_ accessory: DockAccessory) async throws {
    try await DockAccessoryManager.shared.setSystemTrackingEnabled(false)
    try await accessory.animate(motion: DockAccessory.Animation.kapow)
    try await DockAccessoryManager.shared.setSystemTrackingEnabled(true)
}
```

The animation runs asynchronously from the stand's current position. Build custom animations with direct motor control (Part 4).

## Part 7 — iOS 18 additions

#### Intelligent tracking signals

The on-device ML pipeline selects the most relevant subject using body/face pose, attention, and speaking confidence. Read the per-subject summary from the `trackingStates` async sequence and act on it.

```swift
func trackActiveSpeakers(_ accessory: DockAccessory) async throws {
    for await state in accessory.trackingStates {
        // trackedSubjects is [DockAccessory.TrackedSubjectType]: .person / .object
        let speakerIDs: [UUID] = state.trackedSubjects.compactMap { subject in
            guard case .person(let person) = subject,
                  (person.speakingConfidence ?? 0) > 0.8 else { return nil }
            return person.identifier
        }
        try await accessory.selectSubjects(speakerIDs)
    }
}
```

Each `TrackedSubjectType` is `.person(TrackedPerson)` or `.object(TrackedObject)`. A `TrackedPerson` exposes a `UUID` `identifier`, a face rectangle, an optional `saliencyRank` (`Int?`, rank 1 = most important, increasing monotonically), and optional `speakingConfidence` and `lookingAtCameraConfidence` (`Double?`, 0...1). `selectSubjects(_:)` takes `[UUID]`.

#### Button events

Camera and FaceTime get shutter, flip, and zoom out of the box; the same events are delivered to your app, plus custom button events (an ID and a pressed bool). Zoom carries a relative factor (2.0 = double the image / halve the field of view). Subscribe via `accessoryEvents` to implement custom behaviors — e.g. a gimbal button that starts/stops a panorama sweep.

#### Gimbals

A handheld DockKit accessory class for action and sports capture; same APIs, with button controls (flip, record, scroll-wheel zoom).

#### Battery monitoring

Subscribe to `batteryStates` (a dock may report multiple named batteries, each with a percentage and charge state) to surface status in your UI.

#### New camera modes

iOS 18 extends DockKit tracking in the system Camera app to photo, panorama, and cinematic modes.

## Common Mistakes

- Sending motor or `track()` commands before seeing `.undocked` — there is no connected accessory yet.
- Forgetting to disable system tracking, so your custom commands are immediately overridden.
- Confusing the two coordinate origins (region of interest = upper-left; observations = lower-left).
- Treating `.docked` as "ready" — it is the opposite.
- Blocking with `Thread.sleep` or GCD between motor commands; these APIs are async — use `Task.sleep`.
- Not re-enabling system tracking after a one-shot animation or custom sequence.
- Mixing identifier types: `Observation` identifiers are `Int` (your per-frame IDs); `selectSubjects(_:)` takes the tracked subjects' `UUID` identifiers. They are not interchangeable.

## Error Handling

`DockKitError` is the single error type. Map the common cases:

| Case | Meaning / response |
|------|--------------------|
| `.notConnected` | Accessory not docked; wait for `.undocked` |
| `.cameraTCCMissing` | Request camera permission first |
| `.notSupported` / `.notSupportedByDevice` | Feature unavailable (e.g. on macOS, or unsupported hardware); guard with platform/feature checks |
| `.frameRateTooHigh` / `.frameRateTooLow` | Observation feed rate out of range; throttle/steady the `track()` cadence |
| `.noSubjectFound` | `selectSubject(at:)` point didn't intersect a tracked subject |
| `.invalidParameter` | Out-of-range value (e.g. malformed region of interest) |

Wrap control calls in `do/catch` and degrade gracefully — a missing or disconnected stand should never crash the camera experience.

## Resources

**WWDC**: 2023-10304, 2024-10164, 2023-111336

**Docs**: /dockkit, /dockkit/dockaccessory, /dockkit/dockaccessorymanager, /dockkit/dockaccessory/observation, /dockkit/dockaccessory/camerainformation, /dockkit/dockaccessory/cameraorientation, /dockkit/dockaccessory/trackingstate, /dockkit/dockkiterror

**Skills**: axiom-media (camera-capture for AVCaptureSession), axiom-vision (custom inference), axiom-concurrency (async sequences)
