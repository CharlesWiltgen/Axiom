---
name: shazamkit-ref
description: ShazamKit API reference — SHManagedSession (iOS 17+), SHSession, custom catalogs, signature generation, media items, library management, and the Shazam CLI
---

# ShazamKit Reference

API reference for ShazamKit — audio recognition against Shazam's music catalog and against custom audio catalogs. Covers the iOS 17+ `SHManagedSession` path that eliminates `AVAudioEngine` boilerplate, the iOS 15 `SHSession` path for buffer-level control, custom catalog construction, signature generation, library management, and the `shazam` CLI.

## When to Use This Reference

Use this reference when:

- Looking up `SHManagedSession` initializers, methods (`prepare()`, `result()`, `results`, `cancel()`), or state cases (`.idle`, `.prerecording`, `.matching`)
- Working with `SHSession` for buffer-level matching (iOS 15+ minimum, AVAudioEngine boilerplate required) or `matchStreamingBuffer(_:at:)` for streaming audio
- Building a custom catalog (`SHCustomCatalog`) from `SHMediaItem` + `SHSignature` pairs, loading a `.shazamcatalog` file, or writing a catalog to disk
- Generating signatures with `SHSignatureGenerator` from `AVAudioPCMBuffer` chunks or finishing a signature with `signature()`
- Defining custom `SHMediaItemProperty` keys for app-specific metadata on matched items
- Reading match-specific properties (`matchOffset`, `predictedCurrentMatchOffset`, `frequencySkew`, `confidence`) from `SHMatchedMediaItem`
- Managing the user's Shazam library with `SHLibrary` (read-only) or `SHMediaLibrary` (add)
- Looking up `SHError` cases and their meanings
- Using the `shazam` command-line tool for offline catalog generation at scale

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What's the API signature for `SHManagedSession.result()` and what does the return type look like?"
- "How do I use `SHSession.matchStreamingBuffer` and what's the `at:` parameter for?"
- "What properties does `SHMatchedMediaItem` add on top of `SHMediaItem`?"
- "How do I define a custom `SHMediaItemProperty` for my podcast episode number?"
- "What's the difference between `SHLibrary` and `SHMediaLibrary`?"
- "Which `SHError` case do I get when the ShazamKit App Service isn't enabled?"
- "How do I generate signatures from audio files at scale with the CLI?"
- "Can I match against both the Shazam catalog and a custom catalog from one session?"

## What's Covered

- **`SHManagedSession` (iOS 17+)** – initializer overloads (default catalog vs custom catalog), single-shot `result() async`, `Results` `AsyncSequence` for continuous matching, `prepare() async` for pre-recording, `cancel()` to stop, `state` Observable property with `.idle` / `.prerecording` / `.matching` cases, `Sendable` conformance as of iOS 18
- **`SHSession` (iOS 15+)** – initializer overloads, `match(_:)` for complete signatures, `matchStreamingBuffer(_:at:)` for streaming audio (with the contiguous-audio validation), `delegate` for callback-based delivery, `Results` `AsyncSequence` (iOS 16+), audio format support differences between iOS 15-16 (specific PCM formats) and iOS 17+ (automatic conversion), multiple-match behavior on iOS 17+
- **`SHSession.Result` (iOS 16+)** – `.match(SHMatch)` / `.noMatch(SHSignature)` / `.error(any Error, SHSignature)`
- **`SHSessionDelegate`** – `session(_:didFind:)` and `session(_:didNotFindMatchFor:error:)` optional methods
- **`SHMatch`** – `mediaItems` array of `SHMatchedMediaItem` and `querySignature`
- **`SHMediaItem`** – properties dictionary keyed by `SHMediaItemProperty`, predefined keys (`.title`, `.subtitle`, `.artist`, `.artworkURL`, `.videoURL`, `.genres`, `.explicitContent`, `.isrc`, `.appleMusicID`, `.appleMusicURL`, `.webURL`, `.shazamID`, `.creationDate`), iOS 16+ timed content properties (`.timeRanges`, `.frequencySkewRanges`), custom property extension pattern, `fetch(shazamID:)` class method, `Identifiable` / `Sendable` conformances
- **`SHMatchedMediaItem`** – match-only additions: `.matchOffset`, `.predictedCurrentMatchOffset` (auto-updating during streaming), `.frequencySkew`, `.confidence` (0.0 to 1.0)
- **`SHMediaItemProperty`** – `RawRepresentable` struct for predefined and custom property keys, complete list of predefined keys, custom extension pattern
- **`SHSignature`** – `duration`, `dataRepresentation` for storage/transmission, `init(dataRepresentation:)` throwing initializer, `slices(from:duration:stride:)` for segmenting
- **`SHSignatureGenerator`** – `append(_:at:)` for `AVAudioPCMBuffer` chunks, `signature()` to finalize, the streaming-construction pattern
- **`SHCatalog`** and **`SHCustomCatalog`** — building catalogs in-memory, persisting to `.shazamcatalog` files, loading from URL or `Data`, the matching-many-references model
- **`SHLibrary` (read-only) and `SHMediaLibrary` (additive)** – the user's Shazam library access split, why you must opt the user into writes
- **`SHError` cases** – the framework's error vocabulary including the silent-failure cases that indicate provisioning problems (no ShazamKit App Service enabled)
- **Audio format requirements** – what formats `SHSession` accepts on iOS 15-16 vs iOS 17+, format conversion responsibilities
- **`shazam` CLI** – `shazam custom-catalog create`, `shazam custom-catalog add`, `shazam signature` subcommands for offline batch signature generation and catalog construction; how it integrates into a build pipeline

## Documentation Scope

This page documents the `shazamkit-ref` skill — the API reference half of the ShazamKit pair.

- For **decision discipline** (API era choice, use case decision tree, setup checklist, common provisioning mistakes, pressure scenarios), see [ShazamKit](/skills/integration/shazamkit)
- For **microphone permission setup** (`NSMicrophoneUsageDescription` Info.plist key, permission prompt UX), see the privacy-ux reference under [axiom-integration](/skills/integration/)
- For **playing matched results via Now Playing or MusicKit**, see [Now Playing](/skills/integration/now-playing)

## Resources

**Primary sources (Apple):**

- ShazamKit framework documentation — developer.apple.com/documentation/shazamkit
- `SHManagedSession` – developer.apple.com/documentation/shazamkit/shmanagedsession
- `SHSession` – developer.apple.com/documentation/shazamkit/shsession
- `SHCustomCatalog` – developer.apple.com/documentation/shazamkit/shcustomcatalog

**WWDC**: 2021-10044, 2021-10045, 2022-10028, 2023-10051
