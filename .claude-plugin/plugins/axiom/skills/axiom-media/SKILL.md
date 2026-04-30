---
name: axiom-media
description: Use when working with camera, photos, audio, haptics, ShazamKit, or Now Playing. Covers AVCaptureSession, PHPicker, PhotosPicker, AVFoundation, Core Haptics, audio recognition, MediaPlayer, CarPlay, MusicKit.
license: MIT
---

# Media

**You MUST use this skill for ANY camera, photo, audio, haptic, or media playback work.**

## Quick Reference

| Symptom / Task | Reference |
|----------------|-----------|
| Camera capture, AVCaptureSession | See `skills/camera-capture.md` |
| Camera API (RotationCoordinator, etc.) | See `skills/camera-capture-ref.md` |
| Camera freezes, black preview, rotation | See `skills/camera-capture-diag.md` |
| Photo pickers, library access | See `skills/photo-library.md` |
| PHPicker, PhotosPicker API reference | See `skills/photo-library-ref.md` |
| Audio, AVFoundation, spatial audio | See `skills/avfoundation-ref.md` |
| Audio recognition, ShazamKit | See `skills/shazamkit.md` |
| ShazamKit API reference | See `skills/shazamkit-ref.md` |
| Haptic feedback, Core Haptics | See `skills/haptics.md` |
| Now Playing metadata, remote commands | See `skills/now-playing.md` |
| Animated lock-screen artwork (iOS 26+) | See `skills/now-playing.md` Pattern 8 |
| CarPlay HIG, app categories, design rules, entitlements | See `skills/carplay-hig.md` |
| CarPlay templates reference (all 13 templates, availability matrix, depth limits) | See `skills/carplay-templates-ref.md` |
| CarPlay navigation reference (base view, route guidance, cluster/HUD, multitouch, voice prompts) | See `skills/carplay-navigation-ref.md` |
| CarPlay Now Playing template customization + sports mode | See `skills/now-playing-carplay.md` |
| MusicKit Now Playing | See `skills/now-playing-musickit.md` |

## Decision Tree

```dot
digraph media {
    start [label="Media task" shape=ellipse];
    what [label="Which media feature?" shape=diamond];

    start -> what;
    what -> "skills/camera-capture.md" [label="camera capture"];
    what -> "skills/photo-library.md" [label="photo pickers\n/ library"];
    what -> "skills/avfoundation-ref.md" [label="audio / AVFoundation"];
    what -> "skills/shazamkit.md" [label="ShazamKit\n/ audio recognition"];
    what -> "skills/haptics.md" [label="haptic feedback"];
    what -> "skills/now-playing.md" [label="Now Playing\n/ remote commands"];
    what -> "skills/carplay-hig.md" [label="CarPlay app design\n/ categories / entitlements"];
}
```

1. Camera capture? → `skills/camera-capture.md` (patterns), `skills/camera-capture-ref.md` (API), `skills/camera-capture-diag.md` (debugging)
2. Photo pickers / library? → `skills/photo-library.md`, `skills/photo-library-ref.md`
3. Audio / AVFoundation? → `skills/avfoundation-ref.md`
4. ShazamKit / audio recognition? → `skills/shazamkit.md`, `skills/shazamkit-ref.md`
5. Haptics? → `skills/haptics.md`
6. Now Playing / remote commands? → `skills/now-playing.md`, `skills/now-playing-carplay.md`, `skills/now-playing-musickit.md`
7. CarPlay app design, category selection, entitlement request? → `skills/carplay-hig.md` (start here for any CarPlay work)
8. Want camera code audit? → Launch `camera-auditor` agent (detects deprecated APIs and architectural gaps: missing interruption handlers, runtime-error recovery, audio session deactivation, permission-denied UX, RotationCoordinator on iOS 17+; scores RELIABLE / FRAGILE / BROKEN)

## Cross-Domain Routing

**Camera + permissions** (camera access denied, Info.plist missing):
- Camera code → **stay here** (camera-capture)
- Privacy manifest / Info.plist → **invoke axiom-integration** (privacy-ux reference)
- Build/entitlement errors → **invoke axiom-build**

**ShazamKit + microphone permissions**:
- Microphone NSMicrophoneUsageDescription → **invoke axiom-integration** (privacy-ux reference)
- ShazamKit API and matching → **stay here** (shazamkit)

**Now Playing + background audio**:
- Now Playing metadata/controls → **stay here** (now-playing)
- Background audio mode / BGTaskScheduler → **invoke axiom-integration** (background-processing reference)

**Photo library + privacy**:
- Photo picker (PHPicker, PhotosPicker) → **stay here** (photo-library) — no permissions needed
- Full PHPhotoLibrary access → **stay here** (photo-library-ref) — limited access model
- Privacy manifest for photo usage → **invoke axiom-integration** (privacy-ux reference)

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Camera capture is just AVCaptureSession setup" | Camera has interruption handlers, rotation, and threading requirements. |
| "I'll add haptics with a simple API call" | Haptic design has patterns for each interaction type matching HIG. |
| "ShazamKit is just SHSession + a delegate" | iOS 17+ has SHManagedSession which eliminates all AVAudioEngine boilerplate. |
| "Now Playing info is just setting metadata" | Remote commands, artwork handling, and state sync have 15+ gotchas. |
| "I'll use UIImagePickerController for photos" | PHPicker/PhotosPicker are the modern API — no permissions required. |

## Example Invocations

User: "How do I set up a camera preview?"
→ Read: `skills/camera-capture.md`

User: "Camera freezes when I get a phone call"
→ Read: `skills/camera-capture-diag.md`

User: "How do I let users pick photos in SwiftUI?"
→ Read: `skills/photo-library.md`

User: "Implement haptic feedback for button taps"
→ Read: `skills/haptics.md`

User: "Now Playing info doesn't appear on Lock Screen"
→ Read: `skills/now-playing.md`

User: "How do I identify songs with ShazamKit?"
→ Read: `skills/shazamkit.md`

User: "Check my camera code for issues"
→ Launch: `camera-auditor` agent
