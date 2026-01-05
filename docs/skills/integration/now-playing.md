---
name: now-playing
description: Now Playing metadata, remote commands, artwork, and state sync for audio/video apps on iOS 18+
skill_type: discipline
version: 1.1.0
apple_platforms: iOS 18+, iPadOS 18+, CarPlay
---

# Now Playing Integration

MediaPlayer framework patterns for Lock Screen and Control Center integration. Covers MPNowPlayingInfoCenter (manual) and MPNowPlayingSession (iOS 16+ automatic), plus CarPlay and MusicKit integration.

## When to Use This Skill

Use this skill when you're:
- Now Playing info doesn't appear on Lock Screen or Control Center
- Play/pause/skip buttons are grayed out or don't respond
- Album artwork is missing, wrong, or flickers between images
- Control Center shows "Playing" when paused (or vice versa)
- Another app "steals" Now Playing status from your app
- Implementing Now Playing for the first time
- Integrating CarPlay Now Playing support

**Core insight:** Now Playing eligibility requires THREE things: AVAudioSession activation, remote command handlers, and metadata publishing. Missing ANY silently breaks the entire system.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Now Playing info shows briefly when playback starts, then disappears when I lock the screen."
- "Play/pause buttons in Control Center are grayed out or don't respond to taps."
- "Album artwork never appears, or shows wrong artwork, or flickers between images."
- "Control Center shows 'Playing' when my app is actually paused. How do I sync them?"
- "Apple Music takes over and my app loses Now Playing control."
- "How do I add Now Playing support to my CarPlay audio app?"

## What's Covered

### AVAudioSession Configuration (Pattern 1)
- Non-mixable `.playback` category for eligibility
- Background mode "audio" in Info.plist
- Activation timing before playback
- Session deactivation with notify option

### Remote Command Registration (Pattern 2)
- Command targets AND `isEnabled = true`
- Skip intervals with `preferredIntervals`
- Handler return values
- Strong references to targets

### Artwork (Pattern 3)
- `MPMediaItemArtwork` with size handler
- Single source of truth to prevent flickering
- Task cancellation on track change
- Minimum 600x600 pixel images

### Playback State Sync (Pattern 4)
- `playbackRate` (not `playbackState`) on iOS
- When to update: play, pause, seek, track change
- NOT on timer (causes jitter)
- Preserve dictionary values on partial updates

### MPNowPlayingSession (Pattern 5)
- iOS 16+ automatic publishing
- `session.remoteCommandCenter` not shared
- `becomeActiveIfPossible()` for eligibility
- Multiple sessions for PiP

### CarPlay (Pattern 6)
- Same MPNowPlayingInfoCenter as iOS
- `com.apple.developer.carplay-audio` entitlement
- Custom buttons via CPNowPlayingTemplate
- Configuration at scene connection

### MusicKit (Pattern 7)
- ApplicationMusicPlayer auto-publishes
- Don't manually set nowPlayingInfo
- Hybrid apps switching between players

## Key Pattern

### The Eligibility Requirements

```swift
// ✅ All three required for Now Playing to appear:

// 1. Non-mixable audio session
try AVAudioSession.sharedInstance().setCategory(.playback, options: [])
try AVAudioSession.sharedInstance().setActive(true)

// 2. At least one command handler
let commandCenter = MPRemoteCommandCenter.shared()
commandCenter.playCommand.addTarget { _ in .success }
commandCenter.playCommand.isEnabled = true

// 3. Metadata published
MPNowPlayingInfoCenter.default().nowPlayingInfo = [
    MPMediaItemPropertyTitle: "Track Name",
    MPNowPlayingInfoPropertyPlaybackRate: 1.0  // iOS uses rate, not playbackState
]
```

### Decision Tree

```
Now Playing not working?
├─ Info never appears?
│  ├─ Category .ambient or .mixWithOthers? → Remove .mixWithOthers
│  ├─ No command handlers? → Add target + isEnabled
│  └─ Background mode missing? → Add "audio" to Info.plist
├─ Commands grayed out?
│  └─ isEnabled = false → Set to true
├─ Artwork missing/flickering?
│  └─ MPMediaItemArtwork block issues → Single source + cancellation
└─ State out of sync?
   └─ Using playbackState? → Use playbackRate (iOS ignores playbackState)
```

## Documentation Scope

This page documents the `axiom-now-playing` skill—MediaPlayer framework patterns Claude uses when you're implementing or debugging Lock Screen and Control Center integration for audio/video apps.

**For AVAudioSession details:** See [avfoundation-ref](/reference/avfoundation-ref) for audio session configuration beyond Now Playing.

**For memory issues with handlers:** See [memory-debugging](/skills/debugging/memory-debugging) for retain cycle diagnosis in command closures.

## Related

- [avfoundation-ref](/reference/avfoundation-ref) — AVAudioSession configuration, spatial audio, ASAF/APAC
- [memory-debugging](/skills/debugging/memory-debugging) — Retain cycle diagnosis in closure-based command handlers
- [swift-concurrency](/skills/concurrency/swift-concurrency) — @MainActor patterns for async artwork loading

## Resources

**WWDC**: 2019-501, 2022-110338

**Docs**: /mediaplayer/mpnowplayinginfocenter, /mediaplayer/mpnowplayingsession, /mediaplayer/mpremotecommandcenter
