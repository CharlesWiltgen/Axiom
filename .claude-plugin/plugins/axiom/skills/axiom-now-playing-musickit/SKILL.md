---
name: axiom-now-playing-musickit
description: MusicKit Now Playing integration patterns. Use when playing Apple Music content with ApplicationMusicPlayer and understanding automatic vs manual Now Playing info updates.
license: MIT
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

---

## Subscription and Authorization

### Check Music Authorization

```swift
import MusicKit

func requestMusicAccess() async -> Bool {
    let status = await MusicAuthorization.request()
    return status == .authorized
}

// Check current status without prompting
let currentStatus = MusicAuthorization.currentStatus
// .authorized, .denied, .notDetermined, .restricted
```

### Check Apple Music Subscription

```swift
func checkSubscription() async -> Bool {
    do {
        let subscription = try await MusicSubscription.current
        return subscription.canPlayCatalogContent
    } catch {
        return false
    }
}

// Observe subscription changes
func observeSubscription() {
    Task {
        for await subscription in MusicSubscription.subscriptionUpdates {
            if subscription.canPlayCatalogContent {
                // Full Apple Music access
            } else if subscription.canBecomeSubscriber {
                // Show subscription offer
                showSubscriptionOffer()
            }
        }
    }
}
```

### Subscription Offer Sheet

```swift
import MusicKit
import StoreKit

// Present Apple Music subscription offer
MusicSubscriptionOffer.Options(
    messageIdentifier: .playMusic,
    itemID: song.id
)

// In SwiftUI
.musicSubscriptionOffer(isPresented: $showOffer, options: offerOptions)
```

### Graceful Fallback Without Subscription

```swift
@MainActor
class MusicPlayer: ObservableObject {
    @Published var canPlay = false

    func handlePlayRequest(song: Song) async {
        let authorized = await requestMusicAccess()
        guard authorized else {
            showAuthorizationDeniedAlert()
            return
        }

        do {
            let subscription = try await MusicSubscription.current
            if subscription.canPlayCatalogContent {
                // Full playback
                try await play(song: song)
            } else {
                // Preview only (30-second clips)
                if let previewURL = song.previewAssets?.first?.url {
                    playPreview(url: previewURL)
                }
            }
        } catch {
            handleError(error)
        }
    }
}
```

---

## Playback

### Basic Playback

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

    func pause() {
        player.pause()
    }

    func stop() {
        player.stop()
    }
}
```

### Observing Playback State

```swift
@MainActor
class PlayerViewModel: ObservableObject {
    private let player = ApplicationMusicPlayer.shared
    @Published var isPlaying = false
    @Published var currentEntry: ApplicationMusicPlayer.Queue.Entry?
    @Published var playbackTime: TimeInterval = 0

    func observeState() {
        // Observe playback status
        Task {
            for await state in player.state.objectWillChange.values {
                isPlaying = player.state.playbackStatus == .playing
            }
        }

        // Observe current entry (track changes)
        Task {
            for await queue in player.queue.objectWillChange.values {
                currentEntry = player.queue.currentEntry
            }
        }
    }
}
```

---

## Queue Management

### Setting the Queue

```swift
let player = ApplicationMusicPlayer.shared

// Single song
player.queue = [song]

// Album
player.queue = ApplicationMusicPlayer.Queue(album: album)

// Playlist
player.queue = ApplicationMusicPlayer.Queue(playlist: playlist)

// Multiple items
player.queue = ApplicationMusicPlayer.Queue(for: [song1, song2, song3])

// Start at specific item
player.queue = ApplicationMusicPlayer.Queue(for: songs, startingAt: songs[2])
```

### Queue Operations

```swift
// Skip to next
try await player.skipToNextEntry()

// Skip to previous
try await player.skipToPreviousEntry()

// Restart current track
player.restartCurrentEntry()

// Append to queue
try await player.queue.insert(song, position: .afterCurrentEntry)
try await player.queue.insert(song, position: .tail)  // End of queue

// Shuffle and repeat
player.state.shuffleMode = .songs    // .off, .songs
player.state.repeatMode = .all       // .none, .one, .all
```

### Observing Queue Changes

```swift
// Current track info
if let entry = player.queue.currentEntry {
    let title = entry.title
    let subtitle = entry.subtitle      // Artist name
    let artwork = entry.artwork         // Artwork for display

    // Get full Song object if needed
    if case .song(let song) = entry.item {
        let albumTitle = song.albumTitle
    }
}
```

---

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

        // ✅ Manually update Now Playing (see axiom-now-playing)
        updateNowPlayingForOwnContent()
    }

    private func updateNowPlayingForOwnContent() {
        var nowPlayingInfo = [String: Any]()
        nowPlayingInfo[MPMediaItemPropertyTitle] = "My Track"
        // ... rest of manual setup
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }
}
```

---

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

**Docs**: /musickit, /musickit/applicationmusicplayer, /musickit/musicsubscription

**Skills**: axiom-now-playing, axiom-now-playing-carplay
