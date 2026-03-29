---
name: axiom-now-playing
description: Use when Now Playing metadata doesn't appear on Lock Screen/Control Center, remote commands (play/pause/skip) don't respond, artwork is missing/wrong/flickering, or playback state is out of sync - provides systematic diagnosis, correct patterns, and professional push-back for audio/video apps on iOS 18+
license: MIT
compatibility: iOS 18+, iPadOS 18+, CarPlay (iOS 14+)
metadata:
  version: "1.1.0"
---

# Now Playing Integration Guide

**Purpose**: Prevent the 4 most common Now Playing issues on iOS 18+: info not appearing, commands not working, artwork problems, and state sync issues

**Swift Version**: Swift 6.0+
**iOS Version**: iOS 18+
**Xcode**: Xcode 16+

## Core Philosophy

> "Now Playing eligibility requires THREE things working together: AVAudioSession activation, remote command handlers, and metadata publishing. Missing ANY of these silently breaks the entire system. 90% of Now Playing issues stem from incorrect activation order or missing command handlers, not API bugs."

**Key Insight from WWDC 2022/110338**: Apps must meet two system heuristics:
1. Register handlers for at least one remote command
2. Configure AVAudioSession with a non-mixable category

## When to Use This Skill

✅ **Use this skill when**:
- Now Playing info doesn't appear on Lock Screen or Control Center
- Play/pause/skip buttons are grayed out or don't respond
- Album artwork is missing, wrong, or flickers between images
- Control Center shows "Playing" when app is paused, or vice versa
- Apple Music or other apps "steal" Now Playing status
- Implementing Now Playing for the first time
- Debugging Now Playing issues in existing implementation
- Integrating CarPlay Now Playing (covered in Pattern 6)
- Working with MusicKit/Apple Music content (covered in Pattern 7)

### iOS 26 Note

iOS 26 introduces **Liquid Glass visual design** for Lock Screen and Control Center Now Playing widgets. This is **automatic system behavior** — no code changes required. The patterns in this skill remain valid for iOS 26.

❌ **Do NOT use this skill for**:
- Background audio configuration details (see AVFoundation skill)

## Related Skills

- **swift-concurrency** - For @MainActor patterns, weak self in closures, async artwork loading
- **memory-debugging** - For retain cycles in command handlers
- **avfoundation-ref** - For AVAudioSession configuration details

---

## Red Flags / Anti-Patterns

**If you see ANY of these, suspect Now Playing misconfiguration:**

- Info appears briefly then disappears (AVAudioSession deactivated)
- Commands work in simulator but not on device (simulator has different audio stack)
- Artwork shows placeholder then updates (race condition, not necessarily wrong)
- Artwork never appears (format/size issue or MPMediaItemArtwork block returning nil)
- Play/pause state incorrect after backgrounding (not updating on playback rate changes)
- Another app "steals" Now Playing (didn't meet eligibility requirements)
- `playbackState` property doesn't update (iOS doesn't have `playbackState`, macOS only!)

**FORBIDDEN Assumptions:**
- "Just set nowPlayingInfo and it works" - Must have AVAudioSession + command handlers
- "playbackState controls Control Center" - iOS ignores playbackState, uses playbackRate
- "Artwork just needs an image" - Needs proper MPMediaItemArtwork with size handler
- "Commands enable themselves" - Must add target AND set isEnabled = true
- "Update elapsed time every second" - System infers from rate, causes jitter

## Mandatory First Steps (Pre-Diagnosis)

Run this code to understand current state before debugging:

```swift
// 1. Verify AVAudioSession configuration
let session = AVAudioSession.sharedInstance()
print("Category: \(session.category.rawValue)")
print("Mode: \(session.mode.rawValue)")
print("Options: \(session.categoryOptions)")
print("Is active: \(try? session.setActive(true))")
// Must be: .playback category, NOT .mixWithOthers option

// 2. Verify background mode
// Info.plist must have: UIBackgroundModes = ["audio"]

// 3. Check command handlers are registered
let commandCenter = MPRemoteCommandCenter.shared()
print("Play enabled: \(commandCenter.playCommand.isEnabled)")
print("Pause enabled: \(commandCenter.pauseCommand.isEnabled)")
// Must have at least one command with target AND isEnabled = true

// 4. Check nowPlayingInfo dictionary
if let info = MPNowPlayingInfoCenter.default().nowPlayingInfo {
    print("Title: \(info[MPMediaItemPropertyTitle] ?? "nil")")
    print("Artwork: \(info[MPMediaItemPropertyArtwork] != nil)")
    print("Duration: \(info[MPMediaItemPropertyPlaybackDuration] ?? "nil")")
    print("Elapsed: \(info[MPNowPlayingInfoPropertyElapsedPlaybackTime] ?? "nil")")
    print("Rate: \(info[MPNowPlayingInfoPropertyPlaybackRate] ?? "nil")")
} else {
    print("No nowPlayingInfo set!")
}
```

**What this tells you:**

| Observation | Diagnosis | Pattern |
|-------------|-----------|---------|
| Category is .ambient or has .mixWithOthers | Won't become Now Playing app | Pattern 1 |
| No commands have targets | System ignores app | Pattern 2 |
| Commands have targets but isEnabled = false | UI grayed out | Pattern 2 |
| Artwork is nil | MPMediaItemArtwork block returning nil | Pattern 3 |
| playbackRate is 0.0 when playing | Control Center shows paused | Pattern 4 |
| Background mode "audio" not in Info.plist | Info disappears on lock | Pattern 1 |

## Decision Tree

```
Now Playing not working?
├─ Info never appears at all?
│  ├─ AVAudioSession category .ambient or .mixWithOthers?
│  │  └─ Pattern 1a (Wrong Category)
│  ├─ No remote command handlers registered?
│  │  └─ Pattern 2a (Missing Handlers)
│  ├─ Background mode "audio" not in Info.plist?
│  │  └─ Pattern 1b (Background Mode)
│  └─ AVAudioSession.setActive(true) never called?
│     └─ Pattern 1c (Not Activated)
│
├─ Info appears briefly, then disappears?
│  ├─ On lock screen specifically?
│  │  ├─ AVAudioSession deactivated too early?
│  │  │  └─ Pattern 1d (Early Deactivation)
│  │  └─ App suspended (no background mode)?
│  │     └─ Pattern 1b (Background Mode)
│  └─ When switching apps?
│     └─ Another app claiming Now Playing → Pattern 5
│
├─ Commands not responding?
│  ├─ Buttons grayed out (disabled)?
│  │  └─ command.isEnabled = false → Pattern 2b
│  ├─ Buttons visible but no response?
│  │  ├─ Handler not returning .success?
│  │  │  └─ Pattern 2c (Handler Return)
│  │  └─ Using wrong command center (session vs shared)?
│  │     └─ Pattern 2d (Command Center)
│  └─ Skip forward/backward not showing?
│     └─ preferredIntervals not set → Pattern 2e
│
├─ Artwork problems?
│  ├─ Never appears?
│  │  ├─ MPMediaItemArtwork block returning nil?
│  │  │  └─ Pattern 3a (Artwork Block)
│  │  └─ Image format/size invalid?
│  │     └─ Pattern 3b (Image Format)
│  ├─ Wrong artwork showing?
│  │  └─ Race condition between sources → Pattern 3c
│  └─ Artwork flickering?
│     └─ Multiple updates in rapid succession → Pattern 3d
│
├─ State sync issues?
│  ├─ Shows "Playing" when paused?
│  │  └─ playbackRate not updated → Pattern 4a
│  ├─ Progress bar stuck or jumping?
│  │  └─ elapsedTime not updated at right moments → Pattern 4b
│  └─ Duration wrong?
│     └─ Not setting playbackDuration → Pattern 4c
│
├─ CarPlay specific issues?
│  ├─ App doesn't appear in CarPlay at all?
│  │  └─ Missing entitlement → Pattern 6 (Add com.apple.developer.carplay-audio)
│  ├─ Now Playing blank in CarPlay but works on iOS?
│  │  └─ Same root cause as iOS → Check Patterns 1-4
│  ├─ Custom buttons don't appear in CarPlay?
│  │  └─ Wrong configuration timing → Pattern 6 (Configure at templateApplicationScene)
│  └─ Works on device but not CarPlay simulator?
│     └─ Debugger interference → Pattern 6 (Run without debugger)
│
└─ Using MusicKit (ApplicationMusicPlayer)?
   ├─ Now Playing shows wrong info?
   │  └─ Overwriting automatic data → Pattern 7 (Don't set nowPlayingInfo manually)
   └─ Mixing MusicKit + own content?
      └─ Hybrid approach needed → Pattern 7 (Switch between players)
```

---

## Pattern 1: AVAudioSession Configuration (Info Not Appearing)

**Time cost**: 10-15 minutes

### Symptom
- Now Playing info never appears on Lock Screen
- Info appears briefly then disappears on lock
- Works in foreground, disappears in background

### BAD Code

```swift
// ❌ WRONG — Category allows mixing, won't become Now Playing app
class PlayerService {
    func setupAudioSession() throws {
        try AVAudioSession.sharedInstance().setCategory(
            .playback,
            options: .mixWithOthers  // ❌ Mixable = not eligible for Now Playing
        )
        // Never called setActive()  // ❌ Session not activated
    }

    func play() {
        player.play()
        updateNowPlaying()  // ❌ Won't appear - session not active
    }
}
```

### GOOD Code

```swift
// ✅ CORRECT — Non-mixable category, activated before playback
class PlayerService {
    func setupAudioSession() throws {
        try AVAudioSession.sharedInstance().setCategory(
            .playback,
            mode: .default,
            options: []  // ✅ No .mixWithOthers = eligible for Now Playing
        )
    }

    func play() async throws {
        // ✅ Activate BEFORE starting playback
        try AVAudioSession.sharedInstance().setActive(true)

        player.play()
        updateNowPlaying()  // ✅ Now appears correctly
    }

    func stop() async throws {
        player.pause()

        // ✅ Deactivate AFTER stopping, with notify option
        try AVAudioSession.sharedInstance().setActive(
            false,
            options: .notifyOthersOnDeactivation
        )
    }
}
```

### Info.plist Requirement

```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

### Verification
- Lock screen shows Now Playing controls
- Info persists when app backgrounded
- Survives app switch (unless another app plays)

---

## Pattern 2: Remote Command Registration (Commands Not Working)

**Time cost**: 15-20 minutes

### Symptom
- Play/pause buttons grayed out
- Buttons visible but tapping does nothing
- Skip buttons don't appear
- Commands work once then stop

### BAD Code

```swift
// ❌ WRONG — Missing targets and isEnabled
class PlayerService {
    func setupCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()

        // ❌ Added target but forgot isEnabled
        commandCenter.playCommand.addTarget { _ in
            self.player.play()
            return .success
        }
        // playCommand.isEnabled defaults to false!

        // ❌ Never added pause handler

        // ❌ skipForward without preferredIntervals
        commandCenter.skipForwardCommand.addTarget { _ in
            return .success
        }
    }
}
```

### GOOD Code

```swift
// ✅ CORRECT — Targets registered, enabled, with proper configuration
@MainActor
class PlayerService {
    private var commandTargets: [Any] = []  // Keep strong references

    func setupCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()

        // ✅ Play command - add target AND enable
        let playTarget = commandCenter.playCommand.addTarget { [weak self] _ in
            self?.player.play()
            self?.updateNowPlayingPlaybackState(isPlaying: true)
            return .success
        }
        commandCenter.playCommand.isEnabled = true
        commandTargets.append(playTarget)

        // ✅ Pause command
        let pauseTarget = commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.player.pause()
            self?.updateNowPlayingPlaybackState(isPlaying: false)
            return .success
        }
        commandCenter.pauseCommand.isEnabled = true
        commandTargets.append(pauseTarget)

        // ✅ Skip forward - set preferredIntervals BEFORE adding target
        commandCenter.skipForwardCommand.preferredIntervals = [15.0]
        let skipForwardTarget = commandCenter.skipForwardCommand.addTarget { [weak self] event in
            guard let skipEvent = event as? MPSkipIntervalCommandEvent else {
                return .commandFailed
            }
            self?.skip(by: skipEvent.interval)
            return .success
        }
        commandCenter.skipForwardCommand.isEnabled = true
        commandTargets.append(skipForwardTarget)

        // ✅ Skip backward
        commandCenter.skipBackwardCommand.preferredIntervals = [15.0]
        let skipBackwardTarget = commandCenter.skipBackwardCommand.addTarget { [weak self] event in
            guard let skipEvent = event as? MPSkipIntervalCommandEvent else {
                return .commandFailed
            }
            self?.skip(by: -skipEvent.interval)
            return .success
        }
        commandCenter.skipBackwardCommand.isEnabled = true
        commandTargets.append(skipBackwardTarget)
    }

    func teardownCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()
        commandCenter.playCommand.removeTarget(nil)
        commandCenter.pauseCommand.removeTarget(nil)
        commandCenter.skipForwardCommand.removeTarget(nil)
        commandCenter.skipBackwardCommand.removeTarget(nil)
        commandTargets.removeAll()
    }

    deinit {
        teardownCommands()
    }
}
```

### Verification
- Buttons not grayed out in Control Center
- Tapping play/pause actually plays/pauses
- Skip buttons show with correct interval (15s)

---

## Pattern 3: Artwork Configuration (Artwork Problems)

**Time cost**: 15-25 minutes

### Symptom
- Artwork never appears (generic placeholder)
- Wrong artwork for current track
- Artwork flickers between images
- Artwork appears then disappears

### BAD Code

```swift
// ❌ WRONG — MPMediaItemArtwork block can return nil, no size handling
func updateNowPlaying() {
    var nowPlayingInfo = [String: Any]()
    nowPlayingInfo[MPMediaItemPropertyTitle] = track.title

    // ❌ Storing UIImage directly (doesn't work)
    nowPlayingInfo[MPMediaItemPropertyArtwork] = image

    // ❌ Or: Block that ignores requested size
    let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in
        return self.cachedImage  // ❌ May be nil, ignores requested size
    }

    MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
}

// ❌ WRONG — Multiple rapid updates cause flickering
func loadArtwork(from url: URL) {
    // Request 1
    loadImage(url) { image in
        self.updateNowPlayingArtwork(image)  // Update 1
    }
    // Request 2 (cached) returns faster
    loadCachedImage(url) { image in
        self.updateNowPlayingArtwork(image)  // Update 2 - flicker!
    }
}
```

### GOOD Code

```swift
// ✅ CORRECT — Proper MPMediaItemArtwork with value capture (Swift 6 compliant)
@MainActor
class NowPlayingService {
    private var currentArtworkURL: URL?

    func updateNowPlayingArtwork(_ image: UIImage, for trackURL: URL) {
        // ✅ Prevent race conditions - only update if still current track
        guard trackURL == currentArtworkURL else { return }

        // ✅ Create MPMediaItemArtwork with VALUE CAPTURE (not stored property)
        // This is Swift 6 strict concurrency compliant — UIImage is immutable
        // and safe to capture across isolation domains
        let artwork = MPMediaItemArtwork(boundsSize: image.size) { [image] requestedSize in
            // ✅ System calls this block from any thread
            // Captured value avoids "Main actor-isolated property" error
            return image
        }

        // ✅ Update only artwork key, preserve other values
        var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        nowPlayingInfo[MPMediaItemPropertyArtwork] = artwork
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    // ✅ Single entry point with priority: embedded > cached > remote
    func loadArtwork(for track: Track) async {
        currentArtworkURL = track.artworkURL

        // Priority 1: Embedded in file (immediate, no flicker)
        if let embedded = await extractEmbeddedArtwork(track.fileURL) {
            updateNowPlayingArtwork(embedded, for: track.artworkURL)
            return
        }

        // Priority 2: Already cached (fast)
        if let cached = await loadFromCache(track.artworkURL) {
            updateNowPlayingArtwork(cached, for: track.artworkURL)
            return
        }

        // Priority 3: Remote (slow, but don't flicker)
        // ✅ Set placeholder first, then update once with real image
        if let remote = await downloadImage(track.artworkURL) {
            updateNowPlayingArtwork(remote, for: track.artworkURL)
        }
    }
}
```

**Why value capture, not `nonisolated(unsafe)`**: The closure passed to `MPMediaItemArtwork` may be called by the system from any thread. Under Swift 6 strict concurrency, accessing `@MainActor`-isolated stored properties from this closure would cause a compile error. Capturing the image value directly is cleaner than using `nonisolated(unsafe)` because UIImage is immutable and thread-safe for reads.

### Artwork Size Guidelines
- Lock Screen: 300x300 points (600x600 @2x, 900x900 @3x)
- Control Center: Various sizes
- **Best practice**: Provide image at least 600x600 pixels

### Verification
- Artwork appears on Lock Screen
- Correct artwork for current track
- No flickering when track changes
- Artwork persists after backgrounding

---

## Pattern 4: Playback State Synchronization (State Sync Issues)

**Time cost**: 10-20 minutes

### Symptom
- Control Center shows "Playing" when actually paused
- Progress bar doesn't move or jumps unexpectedly
- Duration shows wrong value
- Scrubbing doesn't work correctly

### BAD Code

```swift
// ❌ WRONG — Using playbackState (macOS only, ignored on iOS)
func updatePlaybackState(isPlaying: Bool) {
    MPNowPlayingInfoCenter.default().playbackState = isPlaying ? .playing : .paused
    // ❌ iOS ignores this property! Only macOS uses it.
}

// ❌ WRONG — Updating elapsed time on a timer (causes drift)
Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
    var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = self.player.currentTime().seconds
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    // ❌ Every second creates jitter, system already infers from timestamp
}

// ❌ WRONG — Partial dictionary updates cause race conditions
func updateTitle() {
    var info = [String: Any]()
    info[MPMediaItemPropertyTitle] = track.title
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    // ❌ Cleared all other values (artwork, duration, etc.)!
}
```

### GOOD Code

```swift
// ✅ CORRECT — Use playbackRate for iOS, update at key moments only
@MainActor
class NowPlayingService {

    // ✅ Update when playback STARTS
    func playbackStarted(track: Track, player: AVPlayer) {
        var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]

        // ✅ Core metadata
        nowPlayingInfo[MPMediaItemPropertyTitle] = track.title
        nowPlayingInfo[MPMediaItemPropertyArtist] = track.artist
        nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = track.album
        nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = player.currentItem?.duration.seconds ?? 0

        // ✅ Playback state via RATE (not playbackState property)
        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = player.currentTime().seconds
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = 1.0  // Playing

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    // ✅ Update when playback PAUSES
    func playbackPaused(player: AVPlayer) {
        var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]

        // ✅ Update elapsed time AND rate together
        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = player.currentTime().seconds
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = 0.0  // Paused

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    // ✅ Update when user SEEKS
    func userSeeked(to time: CMTime, player: AVPlayer) {
        var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]

        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = time.seconds
        // ✅ Keep current rate (don't change playing/paused state)

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    // ✅ Update when track CHANGES
    func trackChanged(to newTrack: Track, player: AVPlayer) {
        // ✅ Full refresh of all metadata
        var nowPlayingInfo = [String: Any]()

        nowPlayingInfo[MPMediaItemPropertyTitle] = newTrack.title
        nowPlayingInfo[MPMediaItemPropertyArtist] = newTrack.artist
        nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = newTrack.album
        nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = player.currentItem?.duration.seconds ?? 0
        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = 0.0
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = player.rate

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo

        // Then load artwork asynchronously
        Task {
            await loadArtwork(for: newTrack)
        }
    }
}
```

### When to Update Now Playing Info

| Event | What to Update |
|-------|---------------|
| Playback starts | All metadata + elapsed=current + rate=1.0 |
| Playback pauses | elapsed=current + rate=0.0 |
| User seeks | elapsed=newPosition (keep rate) |
| Track changes | All metadata (new track) |
| Playback rate changes (2x, 0.5x) | rate=newRate |

### DO NOT Update
- On a timer (system infers from elapsed + rate + timestamp)
- Elapsed time continuously (causes jitter)
- Partial dictionaries (loses other values)

---

## Pattern 5: MPNowPlayingSession (iOS 16+ Recommended Approach)

**Time cost**: 20-30 minutes

### When to Use MPNowPlayingSession
- iOS 16+ (available since iOS 16, previously tvOS only)
- Using AVPlayer for playback
- Want automatic publishing of playback state
- Multiple players (Picture-in-Picture scenarios)

### BAD Code (Manual Approach - More Error-Prone)

```swift
// ❌ Manual updates are error-prone, easy to miss state changes
class OldStylePlayer {
    func play() {
        player.play()
        // Must remember to:
        updateNowPlayingElapsed()
        updateNowPlayingRate()
        // Easy to forget one...
    }
}
```

### GOOD Code (MPNowPlayingSession)

```swift
// ✅ CORRECT — MPNowPlayingSession handles automatic publishing
@MainActor
class ModernPlayerService {
    private var player: AVPlayer
    private var session: MPNowPlayingSession?

    init() {
        player = AVPlayer()
        setupSession()
    }

    func setupSession() {
        // ✅ Create session with player
        session = MPNowPlayingSession(players: [player])

        // ✅ Enable automatic publishing of:
        // - Duration
        // - Elapsed time
        // - Playback state (rate)
        // - Playback progress
        session?.automaticallyPublishNowPlayingInfo = true

        // ✅ Register commands on SESSION's command center (not shared)
        session?.remoteCommandCenter.playCommand.addTarget { [weak self] _ in
            self?.player.play()
            return .success
        }
        session?.remoteCommandCenter.playCommand.isEnabled = true

        session?.remoteCommandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.player.pause()
            return .success
        }
        session?.remoteCommandCenter.pauseCommand.isEnabled = true

        // ✅ Try to become active Now Playing session
        session?.becomeActiveIfPossible { success in
            print("Became active Now Playing: \(success)")
        }
    }

    func play(track: Track) async {
        let item = AVPlayerItem(url: track.url)

        // ✅ Set static metadata on player item (title, artwork)
        item.nowPlayingInfo = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyArtist: track.artist,
            MPMediaItemPropertyArtwork: await createArtwork(for: track)
        ]

        player.replaceCurrentItem(with: item)
        player.play()
        // ✅ No need to manually update elapsed time, rate, duration
        // MPNowPlayingSession publishes automatically!
    }
}
```

### Multiple Sessions (Picture-in-Picture)

```swift
class MultiPlayerService {
    var mainSession: MPNowPlayingSession
    var pipSession: MPNowPlayingSession

    func pipDidExpand() {
        // ✅ Promote PiP session when it expands to full screen
        pipSession.becomeActiveIfPossible { success in
            // PiP now controls Lock Screen, Control Center
        }
    }

    func pipDidMinimize() {
        // ✅ Demote back to main session
        mainSession.becomeActiveIfPossible { success in
            // Main player now controls Lock Screen, Control Center
        }
    }
}
```

### Critical Gotcha

**When using MPNowPlayingSession**: Use `session.remoteCommandCenter`, NOT `MPRemoteCommandCenter.shared()`

```swift
// ❌ WRONG
let commandCenter = MPRemoteCommandCenter.shared()
commandCenter.playCommand.addTarget { _ in }

// ✅ CORRECT
session.remoteCommandCenter.playCommand.addTarget { _ in }
```

---

## Pattern 6: CarPlay Integration

For CarPlay-specific integration patterns, invoke `/skill axiom-now-playing-carplay`.

**Key insight**: CarPlay uses the SAME MPNowPlayingInfoCenter and MPRemoteCommandCenter as iOS. If your Now Playing works on iOS, it works in CarPlay with zero additional code.

---

## Pattern 7: MusicKit Integration (Apple Music)

For MusicKit-specific integration patterns and hybrid app examples, invoke `/skill axiom-now-playing-musickit`.

**Key insight**: MusicKit's ApplicationMusicPlayer automatically publishes to MPNowPlayingInfoCenter. You don't need to manually update Now Playing info when playing Apple Music content.

---

## Pressure Scenarios

### Scenario 1: Apple Music Keeps Taking Over (24-Hour Launch Deadline)

#### Situation
- App launching tomorrow
- QA reports: "Now Playing works, but when user opens Apple Music then returns to our app, our controls disappear"
- Product manager: "This is a blocker, users will think our app is broken"
- You're 2 hours from code freeze

#### Rationalization Traps (DO NOT)
1. *"Just tell users not to use Apple Music"* - Unacceptable UX, will get 1-star reviews
2. *"Force our app to always be Now Playing"* - Impossible, system controls eligibility
3. *"File a bug with Apple"* - Won't help before launch

#### Root Cause
Your app loses eligibility because:
- Using `.mixWithOthers` option (allows other apps to play simultaneously)
- Not calling `becomeActiveIfPossible()` when returning to foreground
- AVAudioSession deactivated when backgrounded

#### Systematic Fix (30 minutes)

```swift
// 1. Remove mixWithOthers
try AVAudioSession.sharedInstance().setCategory(.playback, options: [])

// 2. Reactivate when returning to foreground
NotificationCenter.default.addObserver(
    forName: UIApplication.willEnterForegroundNotification,
    object: nil,
    queue: .main
) { [weak self] _ in
    guard self?.isPlaying == true else { return }

    do {
        try AVAudioSession.sharedInstance().setActive(true)
        self?.session?.becomeActiveIfPossible { _ in }
    } catch {
        print("Failed to reactivate audio session: \(error)")
    }
}

// 3. Handle interruptions (phone call, Siri)
NotificationCenter.default.addObserver(
    forName: AVAudioSession.interruptionNotification,
    object: nil,
    queue: .main
) { [weak self] notification in
    guard let info = notification.userInfo,
          let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
        return
    }

    if type == .ended {
        // ✅ Reactivate after interruption
        try? AVAudioSession.sharedInstance().setActive(true)
        self?.session?.becomeActiveIfPossible { _ in }
    }
}
```

#### Communication Template

```
To PM: Found root cause - our audio session config allowed Apple Music to take over.
Fix implemented: 3 changes to audio session handling.
Testing: Verified fix with Apple Music, Spotify, phone calls.
ETA: 20 more minutes for full regression test.

To QA: Please test this flow:
1. Play audio in our app
2. Open Apple Music, play a song
3. Return to our app, tap play
4. Lock screen should show OUR controls
```

#### Time Saved
- 2-3 hours of debugging speculation
- Launch delay avoided
- QA confidence restored

---

### Scenario 2: Artwork Flickers Every Track Change

#### Situation
- User feedback: "Album art keeps flashing when songs change"
- Analytics show 3-4 artwork updates per track change
- Designer: "This looks unprofessional"

#### Root Cause
Multiple artwork sources racing:
1. Cache check (async)
2. Remote URL fetch (async)
3. Embedded artwork extraction (async)

All three complete at different times, each updating Now Playing

#### Fix (20 minutes)

```swift
// ✅ Single-source-of-truth with cancellation
private var artworkTask: Task<Void, Never>?

func loadArtwork(for track: Track) {
    // Cancel previous artwork load
    artworkTask?.cancel()

    artworkTask = Task { @MainActor in
        // Clear previous artwork immediately (optional)
        // updateNowPlayingArtwork(nil)

        // Wait for best available artwork
        let artwork = await loadBestArtwork(for: track)

        // Check if still current track
        guard !Task.isCancelled else { return }

        // Single update
        updateNowPlayingArtwork(artwork, for: track.artworkURL)
    }
}

private func loadBestArtwork(for track: Track) async -> UIImage? {
    // Priority order: embedded > cached > remote
    if let embedded = await extractEmbeddedArtwork(track) {
        return embedded
    }
    if let cached = await loadFromCache(track.artworkURL) {
        return cached
    }
    return await downloadImage(track.artworkURL)
}
```

#### Communication Template

```
To Designer: Fixed artwork flicker - reduced from 3-4 updates to 1 per track.
Root cause: Multiple async sources racing to update artwork.
Solution: Task cancellation + priority order (embedded > cached > remote).
Testing: Verified with 10 track changes, zero flicker.
```

#### Time Saved
- 1-2 hours investigating image caching
- Designer approval unblocked
- Professional UX restored

---

## Common Gotchas

| Symptom | Cause | Solution | Time to Fix |
|---------|-------|----------|-------------|
| Info never appears | Missing background mode | Add `audio` to UIBackgroundModes in Info.plist | 2 min |
| Info never appears | AVAudioSession not activated | Call `setActive(true)` before playback | 5 min |
| Info never appears | No command handlers | Add target to at least one command | 10 min |
| Info never appears | Using `.mixWithOthers` | Remove .mixWithOthers option | 5 min |
| Commands grayed out | `isEnabled = false` | Set `command.isEnabled = true` after adding target | 5 min |
| Commands don't respond | Handler returns wrong status | Return `.success` from handler | 5 min |
| Commands don't respond | Using shared command center with MPNowPlayingSession | Use `session.remoteCommandCenter` instead | 10 min |
| Skip buttons missing | No preferredIntervals | Set `skipCommand.preferredIntervals = [15.0]` | 5 min |
| Artwork never appears | MPMediaItemArtwork block returns nil | Ensure image is loaded before creating artwork | 15 min |
| Artwork flickers | Multiple rapid updates | Single source of truth with cancellation | 20 min |
| Wrong play/pause state | Using `playbackState` property | Use `playbackRate` (1.0 = playing, 0.0 = paused) | 10 min |
| Progress bar stuck | Not updating on seek | Update `elapsedPlaybackTime` after seek completes | 10 min |
| Progress bar jumps | Updating elapsed on timer | Don't update on timer; system infers from rate | 10 min |
| Loses Now Playing to other apps | Session not reactivated on foreground | Call `becomeActiveIfPossible()` on foreground | 15 min |
| `playbackState` doesn't work | iOS-only app | `playbackState` is macOS only; use `playbackRate` on iOS | 10 min |
| Siri skip ignores preferredIntervals | Hardcoded interval in handler | Use `event.interval` from MPSkipIntervalCommandEvent | 5 min |
| **CarPlay**: App doesn't appear | Missing entitlement | Add `com.apple.developer.carplay-audio` to entitlements | 5 min |
| **CarPlay**: Custom buttons don't appear | Configured at wrong time | Configure at `templateApplicationScene(_:didConnect:)` | 5 min |
| **CarPlay**: Works on device, not simulator | Debugger attached | Run without debugger for reliable testing | 1 min |
| **MusicKit**: Now Playing wrong | Overwriting automatic data | Don't set `nowPlayingInfo` when using ApplicationMusicPlayer | 5 min |

---

## Expert Checklist

### Before Implementing Now Playing
- [ ] Added `audio` to UIBackgroundModes in Info.plist
- [ ] AVAudioSession category is `.playback` without `.mixWithOthers`
- [ ] Decided: Manual (MPNowPlayingInfoCenter) or Automatic (MPNowPlayingSession)?

### AVAudioSession Setup
- [ ] `setCategory(.playback)` called at app launch
- [ ] `setActive(true)` called before playback starts
- [ ] `setActive(false, options: .notifyOthersOnDeactivation)` on stop
- [ ] Interruption notification handled (reactivate after phone call)
- [ ] Foreground notification handled (reactivate after background)

### Remote Commands
- [ ] At least one command has target registered
- [ ] All registered commands have `isEnabled = true`
- [ ] Skip commands have `preferredIntervals` set
- [ ] Handlers return `.success` on success
- [ ] Using correct command center (session's vs shared)
- [ ] Command targets stored to prevent deallocation
- [ ] Commands removed in deinit

### Now Playing Info
- [ ] Title set (`MPMediaItemPropertyTitle`)
- [ ] Duration set (`MPMediaItemPropertyPlaybackDuration`)
- [ ] Elapsed time set at play/pause/seek (`MPNowPlayingInfoPropertyElapsedPlaybackTime`)
- [ ] Playback rate set (`MPNowPlayingInfoPropertyPlaybackRate`: 1.0 = playing, 0.0 = paused)
- [ ] Artwork created with `MPMediaItemArtwork(boundsSize:requestHandler:)`
- [ ] NOT using `playbackState` property (macOS only)
- [ ] NOT updating elapsed time on a timer

### Artwork
- [ ] Image at least 600x600 pixels
- [ ] MPMediaItemArtwork block never returns nil (return placeholder if needed)
- [ ] Single source of truth prevents flickering
- [ ] Previous artwork load cancelled on track change

### Testing
- [ ] Lock screen shows correct info
- [ ] Control Center shows correct info
- [ ] Play/pause buttons respond
- [ ] Skip buttons show and respond
- [ ] Progress bar moves correctly
- [ ] Survives app background/foreground
- [ ] Survives phone call interruption
- [ ] Survives other app playing audio
- [ ] Tested with Apple Music conflict
- [ ] Tested with Spotify conflict

### CarPlay (if applicable)
- [ ] Added `com.apple.developer.carplay-audio` entitlement
- [ ] CPNowPlayingTemplate configured at `templateApplicationScene(_:didConnect:)`
- [ ] Custom buttons (if any) configured with CPNowPlayingButton
- [ ] Tested on CarPlay simulator (I/O → External Displays → CarPlay)
- [ ] Tested in real vehicle (if available)
- [ ] Tested both with and without debugger attached

---

## Resources

**WWDC**: 2022-110338, 2017-251, 2019-501

**Docs**: /mediaplayer/mpnowplayinginfocenter, /mediaplayer/mpremotecommandcenter, /mediaplayer/mpnowplayingsession

**Skills**: axiom-avfoundation-ref, axiom-now-playing-carplay, axiom-now-playing-musickit

---

**Last Updated**: 2026-01-04
**Status**: iOS 18+ discipline skill covering Now Playing, CarPlay, and MusicKit integration
**Tested**: Based on WWDC 2019-501, WWDC 2022-110338 patterns
