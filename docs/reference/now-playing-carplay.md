---
name: now-playing-carplay
description: CarPlay Now Playing integration patterns, CPNowPlayingTemplate customization, entitlement setup, and CarPlay-specific debugging
---

# CarPlay Now Playing Reference

CarPlay audio integration patterns for Now Playing metadata, custom playback controls, and entitlement configuration.

## When to Use This Reference

Use this reference when:
- Adding CarPlay support to an audio app
- Now Playing metadata doesn't appear in CarPlay
- Custom buttons (shuffle, repeat, playback rate) aren't showing in CarPlay
- Your app doesn't appear in the CarPlay Audio section
- Debugging differences between iOS and CarPlay simulator behavior

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "My app doesn't show up in CarPlay at all"
- "Now Playing works on Lock Screen but is blank in CarPlay"
- "How do I add shuffle and repeat buttons to CarPlay?"
- "Custom buttons work on device but not in CarPlay simulator"
- "What entitlements do I need for CarPlay audio?"

## What's Covered

- CarPlay's relationship to MPNowPlayingInfoCenter (zero additional code needed)
- CPNowPlayingTemplate customization with custom buttons (iOS 14+)
- Required entitlements (`com.apple.developer.carplay-audio`) and background modes
- CarPlay-specific gotchas table with time-to-fix estimates
- Testing in CarPlay simulator and real vehicles
- Verification checklist for CarPlay audio integration

## Key Insight

CarPlay reads from the same `MPNowPlayingInfoCenter` and `MPRemoteCommandCenter` as Lock Screen and Control Center. If your Now Playing integration works on iOS, it automatically works in CarPlay with zero additional code. The only CarPlay-specific work is the entitlement and optional CPNowPlayingTemplate customization.

## Documentation Scope

This page documents the `axiom-now-playing-carplay` reference skill -- CarPlay-specific patterns for Now Playing integration.

- For core Now Playing setup (MPNowPlayingInfoCenter, remote commands, artwork), see [now-playing](/skills/integration/now-playing)
- For MusicKit automatic Now Playing with Apple Music content, see [now-playing-musickit](/reference/now-playing-musickit)

## Related

- [now-playing](/skills/integration/now-playing) -- Core Now Playing patterns (the foundation CarPlay builds on)
- [now-playing-musickit](/reference/now-playing-musickit) -- MusicKit automatic Now Playing for Apple Music content
- [avfoundation-ref](/reference/avfoundation-ref) -- AVAudioSession configuration for background audio

## Resources

**WWDC**: 2019-501, 2022-110338

**Docs**: /carplay, /mediaplayer/mpnowplayinginfocenter
