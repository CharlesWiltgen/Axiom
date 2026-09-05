---
name: music-library
description: Enumerating the user's Apple Music library — MusicLibraryRequest vs MPMediaQuery, the bulk-property hazard, library identity, and Sync Library replica behavior
skill_type: discipline
apple_platforms: iOS 16+, iPadOS 16+, tvOS 16+, watchOS 9+, visionOS 1+, macOS 14+ (MusicKit); MediaPlayer is iOS/iPadOS/visionOS/Mac Catalyst only
---

# Apple Music Library Enumeration

Reading the user's Apple Music library is a different problem from playing it. Two frameworks — MusicKit's `MusicLibraryRequest` and MediaPlayer's `MPMediaQuery` — enumerate the same library with different contents, different identifiers, and opposite performance characteristics. This skill covers which to reach for, and the failure modes that only appear on a large library.

## When to Use

Use this skill when you're:
- Listing a user's songs, albums, artists, or playlists from their Apple Music library
- Building a local index or database of library content
- Deciding which identifier to persist for a song or playlist
- Reconciling what MusicKit reports against what MediaPlayer reports
- Debugging MusicKit requests that stop responding partway through a scan
- Handling what happens to your data when the user toggles Settings → Music → Sync Library

For *playing* what you found and publishing Now Playing metadata, use [now-playing-musickit](/reference/now-playing-musickit) instead.

## Example Prompts

- "List every song in the user's Apple Music library."
- "MediaPlayer says this playlist has 229 members but MusicKit says 311 — which is right?"
- "My join between MusicKit playlist entries and MediaPlayer items returns zero matches."
- "My MusicKit requests stop responding after I scan the library — no error, they just never return."
- "What identifier should I store for a song so it matches on the user's other device?"
- "Some songs in my queue silently refuse to play."
- "The user turned on Sync Library and now half their playlists show as empty."
- "Should I use MPMediaQuery or MusicLibraryRequest?"

## What This Skill Provides

- **The count-reconciliation rule** – MusicKit shows the *catalog*, MediaPlayer shows what is *local*, and the difference between them is exact rather than a sync fault. Treating it as a health signal is the most expensive mistake in this domain, and the skill carries the case where it silently disabled a feature on most of a user's playlists
- **The playlist-entry join trap** – why `musicKit_persistentID` on a `Playlist.Entry` means something different than on a `Playlist`, and why the wrong join returns zero matches instead of an error
- **The bulk-property rule** – why reading one MusicKit property across a large library leaves the reading task, and every later MusicKit request, never resuming for the rest of the run, with no error thrown. The mechanism is unknown and the skill says so: pool starvation is the visible symptom, but the same loop on a plain `Thread` fails identically, so fixes aimed at the executor are aimed at the wrong thing
- **Two authorization gates that fail silently** – MusicKit and MediaPlayer each have their own, and an unmet gate returns *empty results*, not an error; plus the Info.plist key and App ID service that produce no build error when missing
- **The batching inversion** – one unbatched request is roughly 100x *faster* than `limit` + `nextBatch()`, with measured numbers
- **A measured read-cost table** – enumeration, per-item fields, artwork presence vs decode, playlist entries, and memory, taken on a ~99K-song library
- **Identity rules** – why `Song.id`'s *format* differs per device, which identifiers survive a Sync Library toggle, and what `cloudGlobalID` does and does not cover
- **Optional properties with undocumented `nil`** – `Playlist.lastModifiedDate` is nil in practice with no MediaPlayer fallback, so "unknown" and "unchanged" must be distinguished by you
- **Sync Library behavior** – playlist re-keying, and nameless-empty rows with both candidate causes named rather than one asserted
- **A framework decision table** – MusicKit vs MediaPlayer per task, and why real apps on iOS use both

## Platform Caveat

MediaPlayer's library API (`MPMediaQuery`, `MPMediaPlaylist`, `MPMediaLibrary`) is marked `API_UNAVAILABLE` on native macOS, tvOS, and watchOS — it does not compile there, while `MusicLibraryRequest` does. Much of the common advice for this problem assumes MediaPlayer is always available as a fallback. It isn't, and the skill's guidance is scoped accordingly.

## Measurement Note

The numbers and failure modes in this skill were measured on a specific large library (an iPad running iPadOS 27 with ~99,000 songs), and the bulk-property failure did **not** reproduce on a 771-song library. The skill states its regime so you can judge whether it applies to your data — treat the thresholds as "large personal library", not as constants, and note where it marks a claim as reasoned-but-unmeasured rather than measured.

## Related

- [now-playing-musickit](/reference/now-playing-musickit) – playback, authorization, subscription, and Now Playing publishing; the other half of MusicKit
- [Now Playing](/skills/integration/now-playing) – Lock Screen and Control Center metadata for your own content
- [music-understanding](/skills/integration/music-understanding) – on-device analysis of a track's key, tempo, and structure, once you have the audio
- [ShazamKit](/skills/integration/shazamkit) – identifying an unknown song, which is catalog matching rather than library reading
