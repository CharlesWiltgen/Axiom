
# Music Understanding (On-Device Musical Analysis) `OS27`

`import MusicUnderstanding` — a new framework (`OS27`, all platforms: iOS 27, macOS 27, watchOS 27, tvOS 27, visionOS 27) that extracts musical features from audio entirely **on-device**: it works offline, the audio never leaves the device, and you need no signal-processing or ML expertise. Apple's Final Cut Pro uses it for beat detection and the iPad montage feature.

It analyzes six areas: **key**, **rhythm**, **structure**, **pace**, **instrument activity**, and **loudness**.

## When to Use

- Sync visuals/edits to a song's beat, sections, loudness, or pace (video editors, montage, audio-reactive animation/games)
- Organize a catalog by tempo or key (DJ / library apps)
- Pre-compute and bundle analysis data to drive playback-time effects

For **identifying** which song is playing, use ShazamKit instead (`skills/shazamkit.md`) — that is catalog matching, a different problem.

## Quick Start (analyze a file)

```swift
import MusicUnderstanding
import AVFoundation

// Set PreferPreciseDurationAndTiming for the most accurate results.
let asset = AVURLAsset(
    url: songURL,
    options: [AVURLAssetPreferPreciseDurationAndTimingKey: true]
)
let session = try await MusicUnderstandingSession(asset: asset)

// Analyze ALL six areas (every SessionResult field is populated):
let result = try await session.analyze()
if let bpm = result.rhythm?.beatsPerMinute {
    print("Tempo: \(bpm) bpm")
}
```

`MusicUnderstandingSession` is an `actor`. It has two convenience initializers (no public designated init):

| Init | Signature | Notes |
|------|-----------|-------|
| From an asset | `init(asset: any AVAsset & Sendable) async throws` | `async throws` — the common path |
| From live audio | `init(audioProvider:)` | **Not** async, **not** throwing — see Streaming below |

## `analyze()` vs `analyze(for:)`

Both are `@discardableResult ... async throws -> SessionResult`.

- `analyze()` — analyzes all six areas; every `SessionResult` field is non-nil.
- `analyze(for: Set<AnalysisType>)` — only the requested areas; **unrequested fields come back `nil`**. Use this to skip unnecessary computation.

`AnalysisType` values: `.key`, `.rhythm`, `.structure`, `.pace`, `.instrumentActivity`, `.loudness`.

```swift
let result = try await session.analyze(for: [.key, .rhythm])
// result.key and result.rhythm are populated; result.loudness, .structure, etc. are nil.
```

`SessionResult` fields (all optional): `key`, `rhythm`, `structure`, `pace`, `instrumentActivity`, `loudness`.

## Result Types

Two helpers tie data to time (both nested in `MusicUnderstandingSession`, both generic, both `Codable`):
- **`TimedValue<Value>`** — `{ time: CMTime, value: Value }`
- **`RangedValue<Value>`** — `{ range: CMTimeRange, value: Value }`

```swift
// KeyResult — a timeline of key signatures
if let key = result.key {
    for ranged in key.ranges {                 // [RangedValue<KeyResult.KeySignature>]
        let sig = ranged.value                 // KeySignature { tonic, mode }
        print("\(sig.tonic) \(sig.mode)")      // e.g. .dFlat .major
    }
}
// Tonic: the 17 chromatic spellings (.c, .cSharp, .dFlat, …). Mode: .major / .minor.

// RhythmResult — beat/bar grid + global tempo
if let r = result.rhythm {
    let beats: [CMTime] = r.beats
    let bars:  [CMTime] = r.bars
    let bpm:   Float?    = r.beatsPerMinute     // nil if fewer than 2 beats were found
}

// StructureResult — three nested levels, each an array of ranges
if let s = result.structure {
    let sections = s.sections   // [CMTimeRange] — chorus/verse/intro/bridge
    let segments = s.segments   // [CMTimeRange]
    let phrases  = s.phrases    // [CMTimeRange]
}

// PaceResult — how fast the music *feels* over time (energy)
if let p = result.pace {
    let energy = p.ranges       // [RangedValue<Double>] — higher = more energetic
}

// InstrumentActivityResult — per-instrument presence and intensity
if let inst = result.instrumentActivity {
    let drumWhen  = inst.ranges[.drum]          // [CMTimeRange]? — when the drum is present
    let vocalCurve = inst.activity[.vocal]      // [TimedValue<Float>]? — intensity 0…1 over time
}
// Instrument: .vocal, .drum, .bass, .other.

// LoudnessResult — LUFS perceptual loudness (peak in dB)
if let loud = result.loudness {
    let overall  = loud.integrated.value        // TimedValue<Float> — whole-song average
    let momentary = loud.momentary              // [TimedValue<Float>] — 400 ms window, every 100 ms
    let shortTerm = loud.shortTerm              // [TimedValue<Float>] — 3 s window, smoother
    let peakDB   = loud.peak.value              // absolute peak, in decibels
}
```

## Streaming Loudness

`MusicUnderstandingSession` exposes `loudnessResults`, an `AsyncSequence<LoudnessResult, any Error>` that emits as each 100 ms of audio is analyzed — useful for live meters. Consume the stream and drive analysis concurrently:

```swift
let session = MusicUnderstandingSession(audioProvider: liveBuffers)

// One task consumes the stream; analysis drives it on the current task.
let meter = Task {
    for try await loud in session.loudnessResults {
        await updateMeter(loud.momentary.last?.value)
    }
}
try await session.analyze(for: [.loudness])
try await meter.value
```

## Custom Audio Input (`AudioProvider`)

Instead of an asset, feed buffers from any `AsyncSequence` whose `Element` is `AVReadOnlyAudioPCMBuffer` and whose `Failure` is `Never`. **Send a final `nil` to signal completion** so analysis can finish.

```swift
let session = MusicUnderstandingSession(audioProvider: myBufferSequence)
let result = try await session.analyze()
```

## Export

Every result type is `Codable`. Encode the whole `SessionResult` to JSON:

```swift
let data = try JSONEncoder().encode(result)
```

## Errors & Lifecycle

| `MusicUnderstandingError` | Meaning |
|---------------------------|---------|
| `.sessionInProgress` | An analysis is already running — one at a time |
| `.emptyAnalysisSet` | `analyze(for: [])` called with no types |
| `.invalidAsset` | The asset could not be read |
| `.internalError` | Unexpected framework failure |

Call `await session.cancel()` to stop an in-flight analysis.

## Resources

**WWDC**: 2026-253

**Docs**: /musicunderstanding

**Skills**: shazamkit, avfoundation-ref
