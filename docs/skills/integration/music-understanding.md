---
name: music-understanding
description: On-device musical analysis (key, tempo, structure, pace, instruments, loudness) with the iOS 27 MusicUnderstanding framework
skill_type: reference
apple_platforms: iOS 27+, iPadOS 27+, macOS 27+, watchOS 27+, tvOS 27+, visionOS 27+
---

# Music Understanding

`import MusicUnderstanding` is a new iOS 27 framework that extracts musical features from audio entirely on-device — it works offline, the audio never leaves the device, and you need no signal-processing or ML background. Apple's Final Cut Pro uses it for beat detection and montage sync.

## When to Use

Use this skill when you're:
- Syncing visuals or edits to a song's beat, sections, loudness, or pace (video editors, montage, audio-reactive animation/games)
- Organizing a music catalog by tempo or key (DJ / library apps)
- Pre-computing analysis data to drive playback-time effects
- Reading a track's key, BPM, structure, instrument activity, or LUFS loudness

For **identifying** which song is playing (catalog matching), use [ShazamKit](/skills/integration/shazamkit) instead — that's a different problem.

## Example Prompts

- "How do I detect a song's tempo and beat grid on-device in iOS 27?"
- "Analyze an audio file's musical key and structure."
- "Get LUFS loudness measurements from a track."
- "Drive an animation from how intensely the vocals are playing."
- "Stream live loudness while audio plays."

## What This Skill Provides

- **`MusicUnderstandingSession`** — the `actor` entry point; create it from an `AVAsset` (`async throws`) or a custom audio provider
- **`analyze()` vs `analyze(for:)`** — all six areas, or a targeted subset (unrequested results come back `nil`)
- **Six result types** — `KeyResult` (tonic + major/minor), `RhythmResult` (beats/bars + BPM), `StructureResult` (sections/segments/phrases), `PaceResult` (perceived energy), `InstrumentActivityResult` (per-instrument presence + intensity), `LoudnessResult` (integrated/momentary/short-term LUFS + peak dB)
- **`TimedValue` / `RangedValue`** — the standard time-association helpers
- **Streaming loudness** — an `AsyncSequence` emitting as each 100 ms is analyzed
- **Custom `AudioProvider`** — feed `AVReadOnlyAudioPCMBuffer`s from any `AsyncSequence`
- **Codable export** — encode any `SessionResult` to JSON

## Related

- [ShazamKit](/skills/integration/shazamkit) — song *identification* (catalog matching), a different task from feature analysis
- [Now Playing](/skills/integration/now-playing) — Lock Screen / Control Center playback metadata
- [avfoundation-ref](/reference/avfoundation-ref) — AVAudioSession and the `AVAsset` inputs MusicUnderstanding consumes
