---
name: axiom-now-playing-carplay
description: CarPlay Now Playing integration patterns. Use when implementing CarPlay audio controls, CPNowPlayingTemplate customization, or debugging CarPlay-specific issues.
license: MIT
---

# CarPlay Integration

**Time cost**: 15-20 minutes (if MPNowPlayingInfoCenter already working)

## Key Insight

**CarPlay uses the SAME MPNowPlayingInfoCenter and MPRemoteCommandCenter as Lock Screen and Control Center.** If your Now Playing integration works on iOS, it automatically works in CarPlay with zero additional code.

## What CarPlay Reads

| iOS Component | CarPlay Display |
|---------------|-----------------|
| `MPNowPlayingInfoCenter.nowPlayingInfo` | CPNowPlayingTemplate metadata (title, artist, artwork) |
| `MPRemoteCommandCenter` handlers | CPNowPlayingTemplate button responses |
| Artwork from `nowPlayingInfo` | Album art in CarPlay UI |

No CarPlay-specific metadata needed. Your existing code works.

## CPNowPlayingTemplate Customization (iOS 14+)

For custom playback controls beyond standard play/pause/skip:

```swift
import CarPlay

@MainActor
class SceneDelegate: UIResponder, UIWindowSceneDelegate, CPTemplateApplicationSceneDelegate {

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        // ✅ Configure CPNowPlayingTemplate at connection time (not when pushed)
        let nowPlayingTemplate = CPNowPlayingTemplate.shared

        // Enable Album/Artist browsing (shows button that navigates to album/artist view in your app)
        nowPlayingTemplate.isAlbumArtistButtonEnabled = true

        // Enable Up Next queue (shows button that displays upcoming tracks)
        nowPlayingTemplate.isUpNextButtonEnabled = true

        // Add custom buttons (iOS 14+)
        setupCustomButtons(for: nowPlayingTemplate)
    }

    private func setupCustomButtons(for template: CPNowPlayingTemplate) {
        var buttons: [CPNowPlayingButton] = []

        // Playback rate button
        let rateButton = CPNowPlayingPlaybackRateButton { [weak self] button in
            self?.cyclePlaybackRate()
        }
        buttons.append(rateButton)

        // Shuffle button
        let shuffleButton = CPNowPlayingShuffleButton { [weak self] button in
            self?.toggleShuffle()
        }
        buttons.append(shuffleButton)

        // Repeat button
        let repeatButton = CPNowPlayingRepeatButton { [weak self] button in
            self?.cycleRepeatMode()
        }
        buttons.append(repeatButton)

        // Update template with custom buttons
        template.updateNowPlayingButtons(buttons)
    }
}
```

## Entitlement Requirement

CarPlay requires an entitlement in your Xcode project:

**Info.plist:**
```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

**Entitlements file:**
```xml
<key>com.apple.developer.carplay-audio</key>
<true/>
```

Without the entitlement, CarPlay won't show your app at all.

## CarPlay-Specific Gotchas

| Issue | Cause | Fix | Time |
|-------|-------|-----|------|
| CarPlay doesn't show app | Missing entitlement | Add `com.apple.developer.carplay-audio` | 5 min |
| Now Playing blank in CarPlay | MPNowPlayingInfoCenter not set | Same fix as Lock Screen (Pattern 1) | 10 min |
| Custom buttons don't appear | Configured after push | Configure at `templateApplicationScene(_:didConnect:)` | 5 min |
| Buttons work on device, not CarPlay simulator | Debugger interference | Test without debugger attached | 1 min |
| Album art missing | Same as iOS issue | Fix MPMediaItemArtwork (Pattern 3) | 15 min |

## Testing CarPlay

**Simulator (Xcode 12+):**
1. I/O → External Displays → CarPlay
2. Tap CarPlay display
3. Find your app in Audio section
4. **Important**: Run without debugger for reliable testing (debugger can interfere with CarPlay audio session activation)

**Real Vehicle:**
Requires entitlement approval from Apple (automatic for apps with `UIBackgroundModes` audio; no manual request needed).

## Verification

- [ ] App appears in CarPlay Audio section
- [ ] Now Playing shows correct metadata
- [ ] Album artwork displays
- [ ] Play/pause/skip buttons respond
- [ ] Custom buttons (if any) appear and work
- [ ] Tested both with and without debugger

## Resources

**Skills**: axiom-now-playing, axiom-now-playing-musickit
