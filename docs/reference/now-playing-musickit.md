---
name: now-playing-musickit
description: MusicKit Now Playing integration patterns, ApplicationMusicPlayer automatic metadata publishing, and hybrid app strategies
---

# MusicKit Now Playing Reference

MusicKit integration patterns for Now Playing metadata when playing Apple Music content with ApplicationMusicPlayer.

## When to Use This Reference

Use this reference when:
- Playing Apple Music content with MusicKit's ApplicationMusicPlayer
- Building a hybrid app that plays both Apple Music and your own content
- Now Playing info is wrong or missing when playing Apple Music tracks
- Manually setting nowPlayingInfo and overwriting MusicKit's automatic data

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "Do I need to set Now Playing info when using MusicKit?"
- "Now Playing shows wrong metadata for Apple Music tracks"
- "My app plays both Apple Music and local files -- how do I handle Now Playing?"
- "I'm manually setting nowPlayingInfo but it keeps getting overwritten"
- "How does ApplicationMusicPlayer handle Now Playing automatically?"

## What's Covered

- What ApplicationMusicPlayer publishes automatically (title, artist, album, artwork, duration, rate)
- What is NOT automatic (custom metadata, remote command customization, mixed content)
- Correct pattern for MusicKit-only playback (let the system handle it)
- Hybrid app architecture for switching between MusicKit and AVPlayer
- The common mistake of manually overwriting MusicKit's automatic Now Playing data
- When manual MPNowPlayingInfoCenter updates are appropriate with MusicKit

## Key Insight

MusicKit's `ApplicationMusicPlayer` automatically publishes to `MPNowPlayingInfoCenter`. You do not need to manually update Now Playing info when playing Apple Music content. The most common mistake is manually setting `nowPlayingInfo`, which overwrites MusicKit's automatic data and causes incorrect metadata.

## Documentation Scope

This page documents the `axiom-now-playing-musickit` reference skill -- MusicKit-specific Now Playing patterns.

- For core Now Playing setup (MPNowPlayingInfoCenter, remote commands, artwork), see [now-playing](/skills/integration/now-playing)
- For CarPlay integration, see [now-playing-carplay](/reference/now-playing-carplay)

## Related

- [now-playing](/skills/integration/now-playing) -- Core Now Playing patterns (manual MPNowPlayingInfoCenter setup)
- [now-playing-carplay](/reference/now-playing-carplay) -- CarPlay Now Playing with CPNowPlayingTemplate customization
- [avfoundation-ref](/reference/avfoundation-ref) -- AVAudioSession and AVPlayer for non-MusicKit audio content

## Resources

**WWDC**: 2021-10294, 2022-110338

**Docs**: /musickit, /musickit/applicationmusicplayer
