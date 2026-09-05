
# MusicKit Integration (Apple Music)

**Time cost**: 5-10 minutes

**Scope**: playback, authorization, subscription, and Now Playing publishing. For *reading the user's library* — enumerating songs and playlists, library identity, `PlayParameters` availability, sync — see `skills/music-library.md`. Do not walk the library with the patterns here; a bulk MusicKit property read can wedge the framework for the life of the process.

## Key Insight

**`ApplicationMusicPlayer` publishes Now Playing itself — but it does NOT write your app's dictionary.** It is a client of the Music playback service, which renders the audio out of process and publishes the metadata from there. `MPNowPlayingInfoCenter.default()` holds info about **your process** ("the current application", per the header). The two are separate publishers of one Lock Screen slot.

That distinction is the whole skill. Get it wrong and you reason as if MusicKit will overwrite a stale dictionary you left behind. **It will not.** Whatever wrote last wins, and MusicKit publishes *asynchronously, after `play()` returns* — which is why the resulting bugs are intermittent rather than consistent.

## What's Automatic

When using `ApplicationMusicPlayer`, the playback service publishes:
- Track title, artist, album
- Artwork (Apple's album art)
- Duration and elapsed time
- Playback rate (playing/paused state)

It keeps these current across queue auto-advance, remote-control skips, and seeks — state your app never sees synchronously. A dictionary you write at `play()` time is a snapshot that goes stale at the first track change.

**A paused `ApplicationMusicPlayer` still owns the slot.** It still has a current entry, so it keeps republishing. `pause()` does not hand ownership back; only `stop()` does. See Hybrid Apps.

Two caveats on the evidence, so you know how far to trust the model. The out-of-process split is confirmed by the header (`MPNowPlayingInfoCenter` "holds now playing info about the current application"); the paused-player-keeps-publishing behaviour is **inferred from that ownership model and from the observed symptom**, not from a documented guarantee. And whether the service republishes on its own schedule — which would make a stale dictionary self-heal at the next auto-advance — is **unestablished**. If you see a hybrid bug that "sometimes fixes itself", that is the likely reason, and the handoff rules below are correct either way.

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

`ApplicationMusicPlayer.Queue` and `MusicPlayer.State` are both `ObservableObject`. **Prefer binding them directly in SwiftUI** — `@ObservedObject` handles the update timing for you:

```swift
struct NowPlayingBar: View {
    @ObservedObject private var queue = ApplicationMusicPlayer.shared.queue
    @ObservedObject private var state = ApplicationMusicPlayer.shared.state

    var body: some View {
        if let entry = queue.currentEntry {
            Text(entry.title)
            Image(systemName: state.playbackStatus == .playing ? "pause.fill" : "play.fill")
        }
    }
}
```

If you must observe imperatively, mind the timing — **`objectWillChange` fires *before* the mutation**, so reading in the same iteration returns the OLD value:

```swift
// ❌ WRONG — reads the pre-change value; the UI lags one track behind
for await _ in player.queue.objectWillChange.values {
    currentEntry = player.queue.currentEntry
}

// ✅ CORRECT — yield so the mutation lands before you read
for await _ in player.queue.objectWillChange.values {
    await Task.yield()
    currentEntry = player.queue.currentEntry
}
```

Bind `_`, not a named variable: `objectWillChange` emits `Void`, so a named binding is unused and warns.

---

## Queue Management

### Setting the Queue

```swift
let player = ApplicationMusicPlayer.shared

// Single song (Album/Playlist/Song all conform to PlayableMusicItem,
// so the array-literal form queues the whole item from the start)
player.queue = [song]

// Whole album / whole playlist
player.queue = [album]
player.queue = [playlist]

// Start an album at a specific track (the album init REQUIRES startingAt —
// there is no bare Queue(album:) / Queue(playlist:))
player.queue = ApplicationMusicPlayer.Queue(album: album, startingAt: track)

// Multiple items (startingAt defaults to nil → start at the beginning)
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

**The hard part is the handoff, not the playback.** Two publishers, one slot — and the two classic symptoms are both handoff bugs:

| Symptom | Cause |
|---|---|
| Switch to your file, Lock Screen still shows the Apple Music track | You called `pause()`, not `stop()`. A paused player keeps its entry and keeps republishing over you. |
| Switch to Apple Music, Lock Screen *sometimes* shows your old file | Your stale dictionary was never cleared, and/or an AVPlayer observer is still firing. MusicKit publishes asynchronously after `play()` returns, so it is a race — hence "sometimes". |

Three rules make it deterministic:

1. **Tear the old engine down before starting the new one** — `stop()` MusicKit (never `pause()`); cancel AVPlayer observers and `replaceCurrentItem(with: nil)`.
2. **Clear your dictionary on every switch** (`nowPlayingInfo = nil`), then never write it while Apple Music is the source. Guard the writer on the source so call-site discipline isn't the only defence.
3. **Never read-modify-write.** `var info = center.nowPlayingInfo ?? [:]` merges your elapsed time into Apple Music's title and artwork. Always assign a complete dictionary.

```swift
import MusicKit
import MediaPlayer
import AVFoundation

@MainActor
final class HybridPlayer {
    enum Source { case none, appleMusic, ownContent }

    private let musicKitPlayer = ApplicationMusicPlayer.shared
    private let avPlayer = AVPlayer()
    private var source: Source = .none
    private var statusObservation: Task<Void, Never>?
    private var track: OwnTrack?

    func playAppleMusic(_ song: Song) async throws {
        // 1. Silence every in-process writer FIRST.
        statusObservation?.cancel(); statusObservation = nil
        avPlayer.pause()
        avPlayer.replaceCurrentItem(with: nil)
        track = nil

        // 2. Withdraw our dictionary — a stale one races MusicKit's async publish.
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil

        // 3. Hand over. publish() is now a no-op by construction.
        source = .appleMusic
        musicKitPlayer.queue = [song]
        try await musicKitPlayer.play()
    }

    func playOwnContent(_ track: OwnTrack) async throws {
        musicKitPlayer.stop()          // stop(), NOT pause()
        try AVAudioSession.sharedInstance().setActive(true)

        source = .ownContent
        self.track = track
        avPlayer.replaceCurrentItem(with: AVPlayerItem(url: track.url))
        observeAVPlayer()
        avPlayer.play()
        // publish() runs from the observer on the first REAL status change.
    }

    private func observeAVPlayer() {
        statusObservation?.cancel()
        statusObservation = Task { [weak self, avPlayer] in
            // `options: [.new]` is load-bearing. The default is [.initial], which emits
            // `.paused` synchronously at subscription — BEFORE play() — publishing a
            // rate-0 entry immediately after stop() instead of when playback starts.
            for await status in avPlayer.publisher(for: \.timeControlStatus, options: [.new]).values {
                guard let self, !Task.isCancelled else { return }
                switch status {
                case .playing: publish(rate: 1)
                case .paused:  publish(rate: 0)
                default:       break
                }
            }
        }
    }

    /// The ONLY place that writes the info center. Guarded on source.
    private func publish(rate: Float) {
        guard source == .ownContent, let track else { return }
        let elapsed = avPlayer.currentTime().seconds
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyPlaybackDuration: track.duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: elapsed.isFinite ? elapsed : 0,
            MPNowPlayingInfoPropertyPlaybackRate: rate,
        ]
    }
}
```

**Preconditions for the AVPlayer half**, all easy to miss because MusicKit needs none of them. Miss these and you can fix the handoff perfectly and still have no Lock Screen entry for your own content:

- `AVAudioSession` category `.playback`, activated.
- `UIBackgroundModes` → `audio` in Info.plist. MusicKit playback survives backgrounding without it; AVPlayer does not, and the Lock Screen entry vanishes with the audio.
- **Registered `MPRemoteCommandCenter` targets.** Register once at launch and dispatch on `source` — for own content drive `AVPlayer`, for Apple Music forward to `ApplicationMusicPlayer` (usually a no-op, since the service handles its own transport).

**Artwork for your own files** is the other half of the artwork story below, and it is where rule 3 actually gets violated. Load embedded art from `AVAsset.commonMetadata`, wrap it in `MPMediaItemArtwork`, and **re-assign the whole dictionary** — the async completion is the classic site for `var info = center.nowPlayingInfo ?? [:]`, which, if it lands after a switch, grafts your file's artwork onto Apple's title. Guard the completion on both `source` and the track id.

**No periodic timer.** Write elapsed time and rate on play / pause / seek only and let the system extrapolate. A per-second timer is precisely the late writer that produces the intermittent symptom.

`MPNowPlayingSession(players:)` with `automaticallyPublishesNowPlayingInfo` (iOS 16+) automates the AVPlayer side, but how it arbitrates against MusicKit's out-of-process publisher is unverified here — don't introduce it to fix a handoff bug.

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

**Why the manual write yields blank artwork.** `MusicKit.Artwork` is a **URL template**, not an image — its accessor is `url(width:height:)`, and `MPMediaItemPropertyArtwork` needs an `MPMediaItemArtwork` wrapping a real `UIImage`. A dictionary written synchronously at `play()` time therefore ships with no artwork *and* overwrites the artwork the service already had. Two symptoms, one cause.

## When to Use Manual Updates with MusicKit

Only override MPNowPlayingInfoCenter if:
- You're mixing in additional metadata (e.g., podcast chapter markers)
- You're displaying custom content alongside Apple Music
- You have a specific reason to replace MusicKit's automatic behavior

**Default**: Let MusicKit manage Now Playing automatically.

## Resources

**Docs**: /musickit, /musickit/applicationmusicplayer, /musickit/musicsubscription

**Skills**: skills/now-playing.md, skills/now-playing-carplay.md, skills/music-library.md
