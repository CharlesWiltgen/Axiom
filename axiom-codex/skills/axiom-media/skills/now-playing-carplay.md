
# CPNowPlayingTemplate Customization

**Scope**: This skill covers the Now Playing template API mechanics only — configuring buttons, customizing playback controls, and sports mode metadata. For CarPlay app design principles, category selection, the 8 Universal Guidelines, entitlement review, and per-category design rules, **see `carplay-hig.md` first**.

**Time cost**: 15-20 minutes if `MPNowPlayingInfoCenter` is already wired up.

## Key Insight

**CarPlay reuses the same `MPNowPlayingInfoCenter` and `MPRemoteCommandCenter` as the Lock Screen and Control Center.** If your Now Playing integration works on iOS, it automatically renders in CarPlay — no CarPlay-specific metadata needed for the basic case.

| iOS Component | CarPlay Display |
|---|---|
| `MPNowPlayingInfoCenter.nowPlayingInfo` | `CPNowPlayingTemplate` metadata (title, artist, artwork) |
| `MPRemoteCommandCenter` handlers | `CPNowPlayingTemplate` button responses |
| Artwork from `nowPlayingInfo` | Album art in CarPlay UI |

The CarPlay-specific code below customizes template buttons and adds sports mode metadata.

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
        // Configure CPNowPlayingTemplate at connection time, not when pushed.
        // The shared template is always present in CarPlay; configure its buttons up front
        // so the system can display them whenever Now Playing is shown.
        let nowPlayingTemplate = CPNowPlayingTemplate.shared

        nowPlayingTemplate.isAlbumArtistButtonEnabled = true
        nowPlayingTemplate.isUpNextButtonEnabled = true

        setupCustomButtons(for: nowPlayingTemplate)
    }

    private func setupCustomButtons(for template: CPNowPlayingTemplate) {
        let rateButton = CPNowPlayingPlaybackRateButton { [weak self] _ in
            self?.cyclePlaybackRate()
        }
        let shuffleButton = CPNowPlayingShuffleButton { [weak self] _ in
            self?.toggleShuffle()
        }
        let repeatButton = CPNowPlayingRepeatButton { [weak self] _ in
            self?.cycleRepeatMode()
        }

        template.updateNowPlayingButtons([rateButton, shuffleButton, repeatButton])
    }
}
```

Source: *CarPlay Developer Guide*, Feb 2026, p.31.

## Sports Mode (iOS 18.4+)

The Now Playing template supports a **sports mode** for apps that stream live or pre-recorded sporting events. Sports mode augments standard Now Playing metadata (playback controls, state, elapsed time) with team images, scores, a countdown/count-up clock, standings, and possession indicators. Source: *CarPlay Developer Guide*, Feb 2026, p.21.

"If your app is capable of showing sports scores, you can populate your app's existing now playing template with additional text and images to represent scores for any sport that involves 2 teams."

### Sports mode content schema

The template lays out content in a fixed arrangement:

| Slot | Content type |
|---|---|
| Background artwork | image |
| Sports event status text | array of text |
| Sports event status image | image |
| Sports event clock | time (configured as count up, count down, or paused) |
| L1, R1 (team name) | text |
| L2, R2 (team logo) | image or text |
| L3, R3 (team standings) | text |
| L4, R4 (team score) | text |
| L5, R5 (possession indicator) | image |
| L6, R6 (favorite indicator) | boolean |

"L" columns and "R" columns represent the two teams (home/away or visiting/home).

### Clock behavior

When you set the sports event clock, CarPlay automatically counts up or down from the point provided on your behalf. At any point your app can push a new set of sports mode metadata to adjust scores, possession indicators, standings, or the clock.

### When to use

Use sports mode only when your app is actively streaming a live or pre-recorded sporting event. Leave the template in standard Now Playing mode for regular music, podcast, or audiobook playback.

## Entitlement Requirement

CarPlay audio apps require both a background mode and the CarPlay audio entitlement.

**Info.plist**

```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

**Entitlements**

```xml
<key>com.apple.developer.carplay-audio</key>
<true/>
```

**The entitlement is not automatic.** You request it at [developer.apple.com/carplay](https://developer.apple.com/carplay) and Apple reviews your app before granting it. The older `com.apple.developer.playable-content` entitlement (which paired with the `MPPlayableContent` APIs) is deprecated; apps supporting only that path on iOS 14+ still run but cannot customize the CarPlay UI. Source: *CarPlay Developer Guide*, Feb 2026, p.11, p.62.

See `carplay-hig.md` for the full entitlement request flow and what Apple reviews.

## CarPlay-Specific Gotchas

| Issue | Cause | Fix | Time |
|---|---|---|---|
| CarPlay doesn't show app | Missing entitlement or entitlement not yet granted by Apple | Verify `com.apple.developer.carplay-audio` is in your profile; request via developer.apple.com/carplay if missing | 5 min (once approved) |
| Now Playing blank in CarPlay | `MPNowPlayingInfoCenter` not set | Same fix as Lock Screen — populate `nowPlayingInfo` with `MPMediaItemPropertyTitle`, `…PropertyArtist`, artwork, playback rate | 10 min |
| Custom buttons don't appear | Configured after `pushTemplate` | Configure at `templateApplicationScene(_:didConnect:)` | 5 min |
| Buttons work on device, not CarPlay simulator | Debugger attachment interferes with audio session activation | Test without debugger attached (run from Xcode, detach, re-connect in CarPlay Simulator) | 1 min |
| Album art missing | `MPMediaItemArtwork` not configured for the right size | Set artwork via `MPMediaItemArtwork(boundsSize:requestHandler:)` and return a scaled `UIImage` | 15 min |
| Sports mode not rendering | Template still in standard mode | Set sports mode metadata via `CPNowPlayingTemplate.shared` update path (iOS 18.4+) | 5 min |

## Testing CarPlay

**Xcode Simulator (Xcode 12+):**

1. Simulator menu → I/O → External Displays → CarPlay
2. Tap CarPlay display
3. Find your app in the Audio section
4. Run without debugger attached for reliable testing (debugger interference is the most common cause of "works on device, not simulator")

**CarPlay Simulator (standalone Mac app):**

More faithful than Xcode Simulator — includes screen sizes, dark mode signaling, and instrument cluster scenarios. Install via Xcode → Open Developer Tool → More Developer Tools… (downloads the *Additional Tools for Xcode* package; CarPlay Simulator is in the Hardware folder). Source: *CarPlay Developer Guide*, Feb 2026, p.7.

**Real vehicle:**

Required for features Simulator can't reproduce — iPhone-locked behavior, actual FM radio interruption, Siri interactions, instrument cluster displays. Test with iPhone locked (most CarPlay use is locked-screen).

## Verification Checklist

- [ ] App appears in CarPlay Audio section (entitlement in provisioning profile)
- [ ] Now Playing shows correct title, artist, and artwork
- [ ] Play/pause/skip buttons respond
- [ ] Custom buttons (if any) appear and respond
- [ ] Works when iPhone is locked (test with passcode set)
- [ ] Tested both with and without Xcode debugger attached
- [ ] Sports mode renders correctly (if your app uses it) — clock counts correctly, L/R slots populate
- [ ] HIG compliance review complete — see `carplay-hig.md` expert review checklist

## Resources

**Primary sources:**

- *CarPlay Developer Guide*, Feb 2026 — pp.11 (entitlements), p.21 (sports mode), p.31 (Now Playing template code)
- *CarPlay Audio App Programming Guide*, March 2017 — legacy MediaPlayer path, still useful for iPhone-locked data access limits

**Related Axiom skills:**

- `carplay-hig.md` — **start here for any CarPlay work** (app categories, 8 Universal Guidelines, entitlement review, per-category rules)
- `now-playing.md` — iOS Now Playing (Lock Screen, Control Center) shared path
- `now-playing-musickit.md` — MusicKit-specific Now Playing integration
- `avfoundation-ref.md` — audio session configuration

**WWDC:**

- WWDC18-213 "CarPlay Audio and Navigation Apps" — MPPlayableContent origins, now-deprecated flow
- WWDC20-10635 "Accelerate your app with CarPlay" — CarPlay framework audio app patterns
