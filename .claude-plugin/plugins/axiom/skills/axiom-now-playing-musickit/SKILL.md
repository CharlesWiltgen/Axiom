---
name: axiom-now-playing-musickit
description: MusicKit Now Playing integration patterns. Use when playing Apple Music content with ApplicationMusicPlayer and understanding automatic vs manual Now Playing info updates.
user-invocable: false
---

# MusicKit Integration (Apple Music)

**Time cost**: 5-10 minutes

## Key Insight

**MusicKit's ApplicationMusicPlayer automatically publishes to MPNowPlayingInfoCenter.** You don't need to manually update Now Playing info when playing Apple Music content.

## What's Automatic

When using `ApplicationMusicPlayer`:
- Track title, artist, album
- Artwork (Apple's album art)
- Duration and elapsed time
- Playback rate (playing/paused state)

The system handles all MPNowPlayingInfoCenter updates for you.

## What's NOT Automatic

- Custom metadata (chapter markers, custom artist notes)
- Remote command customization beyond standard controls
- Mixing MusicKit content with your own content

## GOOD Code (MusicKit Content)

```swift
import MusicKit

@MainActor
class MusicKitPlayer {
    private let player = ApplicationMusicPlayer.shared

    func play(song: Song) async throws {
        // ✅ Just play - MPNowPlayingInfoCenter updates automatically
        player.queue = [song]
        try await player.play()

        // ❌ DO NOT manually set nowPlayingInfo here
        // MPNowPlayingInfoCenter.default().nowPlayingInfo = [...] // WRONG!
    }
}
```

## Hybrid Apps (Own Content + Apple Music)

If your app plays both Apple Music and your own content:

```swift
import MusicKit

@MainActor
class HybridPlayer {
    private let musicKitPlayer = ApplicationMusicPlayer.shared
    private var avPlayer: AVPlayer?
    private var currentSource: ContentSource = .none

    enum ContentSource {
        case none
        case appleMusic      // MusicKit handles Now Playing
        case ownContent  // We handle Now Playing
    }

    func playAppleMusicSong(_ song: Song) async throws {
        // Switch to MusicKit
        avPlayer?.pause()
        currentSource = .appleMusic

        musicKitPlayer.queue = [song]
        try await musicKitPlayer.play()
        // ✅ MusicKit handles Now Playing automatically
    }

    func playOwnContent(_ url: URL) {
        // Switch to AVPlayer
        musicKitPlayer.pause()
        currentSource = .ownContent

        avPlayer = AVPlayer(url: url)
        avPlayer?.play()

        // ✅ Manually update Now Playing (Patterns 1-4)
        updateNowPlayingForOwnContent()
    }

    private func updateNowPlayingForOwnContent() {
        var nowPlayingInfo = [String: Any]()
        nowPlayingInfo[MPMediaItemPropertyTitle] = "My Track"
        // ... rest of manual setup from Patterns 1-4
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }
}
```

## Common Mistake

```swift
// ❌ WRONG - Overwrites MusicKit's automatic Now Playing data
func playAppleMusicSong(_ song: Song) async throws {
    try await ApplicationMusicPlayer.shared.play()

    // ❌ This clears MusicKit's Now Playing info!
    var nowPlayingInfo = [String: Any]()
    nowPlayingInfo[MPMediaItemPropertyTitle] = song.title
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
}

// ✅ CORRECT - Let MusicKit handle it
func playAppleMusicSong(_ song: Song) async throws {
    try await ApplicationMusicPlayer.shared.play()
    // That's it! MusicKit publishes Now Playing automatically.
}
```

## When to Use Manual Updates with MusicKit

Only override MPNowPlayingInfoCenter if:
- You're mixing in additional metadata (e.g., podcast chapter markers)
- You're displaying custom content alongside Apple Music
- You have a specific reason to replace MusicKit's automatic behavior

**Default**: Let MusicKit manage Now Playing automatically.

## Resources

**Skills**: axiom-now-playing, axiom-now-playing-carplay
