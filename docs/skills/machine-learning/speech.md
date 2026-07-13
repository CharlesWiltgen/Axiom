# SpeechAnalyzer Speech-to-Text

Implement speech-to-text with Apple's new SpeechAnalyzer API (iOS 26+). Powers Notes, Voice Memos, Journal, and Call Summarization.

## Overview

SpeechAnalyzer is Apple's next-generation speech-to-text API:
- **On-device processing** – Private, no server required
- **Long-form audio** – Optimized for meetings, lectures, conversations
- **Distant audio** – Works well with speakers across the room
- **Volatile results** – Real-time approximate results while processing
- **Timing metadata** – Sync text with audio playback
- **Model management** – System handles model downloads and updates

## When to Use This Skill

Use when you need to:
- ☑ Transcribe live audio (microphone)
- ☑ Transcribe audio files
- ☑ Build Notes-like or Voice Memos-like features
- ☑ Show real-time transcription feedback
- ☑ Sync transcription with audio playback
- ☑ Choose between SpeechAnalyzer and SFSpeechRecognizer

## Example Prompts

- "How do I add speech-to-text to my iOS app?"
- "What's the difference between SpeechAnalyzer and SFSpeechRecognizer?"
- "How do I show real-time transcription while recording?"
- "How do I handle volatile vs finalized transcription results?"
- "How do I sync transcript text with audio playback?"
- "Why am I getting `insufficientResources` from SpeechAnalyzer?"
- "How many transcribers can I run at once?"
- "Why does transcription work on my Mac but fail on a real iPhone?"
- "Why did my audio session break after I added transcription?"
- "How do I transcribe straight from the mic or a video's audio track on iOS 27?"

## Key Decision Trees

### SpeechAnalyzer vs SFSpeechRecognizer

```
Need speech-to-text?
├─ iOS 26+ only?
│   └─ Yes → SpeechAnalyzer (preferred)
├─ Need iOS 10-25 support?
│   └─ Yes → SFSpeechRecognizer (or DictationTranscriber)
├─ Long-form audio (meetings, lectures)?
│   └─ Yes → SpeechAnalyzer
└─ Distant audio (across room)?
    └─ Yes → SpeechAnalyzer
```

## Common Use Cases

### File Transcription (Simplest)

```swift
import AVFoundation
import Speech

func transcribe(fileURL: URL, locale: Locale) async throws -> AttributedString {
    let transcriber = SpeechTranscriber(locale: locale, preset: .transcription)

    async let result = try transcriber.results
        .reduce(AttributedString()) { $0 + $1.text }

    let analyzer = SpeechAnalyzer(modules: [transcriber])

    // analyzeSequence(from:) takes an AVAudioFile — not a URL.
    let file = try AVAudioFile(forReading: fileURL)

    if let lastSample = try await analyzer.analyzeSequence(from: file) {
        try await analyzer.finalizeAndFinish(through: lastSample)
    } else {
        await analyzer.cancelAndFinishNow()
    }

    return try await result
}
```

`SpeechTranscriber`'s presets are `.transcription`, `.transcriptionWithAlternatives`, `.timeIndexedTranscriptionWithAlternatives`, `.progressiveTranscription`, `.timeIndexedProgressiveTranscription`. There is no `.offlineTranscription`.

### Live Transcription Setup

```swift
// 1. Configure transcriber with volatile results
let transcriber = SpeechTranscriber(
    locale: Locale.current,
    transcriptionOptions: [],          // required — this init has no defaults
    reportingOptions: [.volatileResults],
    attributeOptions: [.audioTimeRange]
)

// 2. Create analyzer
let analyzer = SpeechAnalyzer(modules: [transcriber])

// 3. Get required audio format
let format = await SpeechAnalyzer.bestAvailableAudioFormat(
    compatibleWith: [transcriber]
)

// 4. Ensure model is available
if let downloader = try await AssetInventory.assetInstallationRequest(
    supporting: [transcriber]
) {
    try await downloader.downloadAndInstall()
}

// 5. Start analyzer
let (stream, builder) = AsyncStream<AnalyzerInput>.makeStream()
try await analyzer.start(inputSequence: stream)
```

### Handle Results

```swift
for try await result in transcriber.results {
    if result.isFinal {
        // Finalized - won't change
        finalTranscript += result.text
        volatileTranscript = AttributedString()
    } else {
        // Volatile - will be replaced
        volatileTranscript = result.text
    }
}
```

## Common Pitfalls

- ❌ Forgetting to call `finalizeAndFinishThroughEndOfInput()` (loses volatile results)
- ❌ Not converting audio to `bestAvailableAudioFormat`
- ❌ Skipping model availability check before use
- ❌ Not clearing volatile results when finalized arrives
- ❌ Assuming `insufficientResources` can be caught as `catch SFSpeechError.insufficientResources` — it can't; that shorthand doesn't compile. Spell the `Code` type: `catch SFSpeechError.Code.insufficientResources`
- ❌ Using `providerWithSession(...)` (iOS 27) when your app owns its audio session — it reconfigures your default `AVAudioSession`. Use `provider(from:in:)` and add its `captureAudioDataOutput` to your own session. (On visionOS that escape hatch does not exist — `providerWithSession` is the only option there.)
- ❌ Reading `AnalyzerInput.buffer` (deprecated iOS 27) for duration or format — each access copies the audio. Read `bufferDuration` / `bufferFormat`

## Simultaneous Analyses

`SpeechAnalyzer` caps how many backing engines and models it will allocate at once. Apple puts it at roughly **two** ongoing recognition instances on **iOS and visionOS**, with **currently no limit on macOS** — so the same code can pass on a Mac and fail on a real iPhone. Exceeding the cap throws `SFSpeechError.Code.insufficientResources`.

The cap counts *incompatible* work: transcribers configured similarly (same locale, same settings) **can share** backing engines, so making your analyzers alike is the cheap first fix. `SpeechAnalyzer.Options.ignoresResourceLimits` (iOS 27) opts out of the counting — but it does not raise the hardware ceiling, so you trade a clean, early, catchable error for an unpredictable one later. This dates from iOS 26; it is not new in 27.

## Platform Support

| Feature | Availability |
|---------|--------------|
| SpeechTranscriber | iOS 26+, macOS 26+ (not watchOS) |
| DictationTranscriber | iOS 26+, macOS 26+ (**not** watchOS, **not** tvOS) |
| SpeechAnalyzer | iOS 26+, macOS 26+ (not watchOS) |
| `CaptureInputSequenceProvider` / `AssetInputSequenceProvider` / `AnalyzerInputConverter` | iOS 27+ (not watchOS) |
| SFSpeechRecognizer | iOS 10+ (legacy) |

## Related

- [CoreML](/skills/machine-learning/coreml) – deploy custom speech/audio ML models when SpeechAnalyzer doesn't meet your needs
- [Foundation Models](/skills/integration/foundation-models) – generate summaries or titles from transcribed text using Apple Intelligence

### WWDC Sessions

- [WWDC25-277: Bring advanced speech-to-text with SpeechAnalyzer](https://developer.apple.com/videos/play/wwdc2025/277/)

### Apple Documentation

- [Speech Framework](https://developer.apple.com/documentation/speech)
