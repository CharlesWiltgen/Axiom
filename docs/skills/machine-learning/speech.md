# SpeechAnalyzer Speech-to-Text

Implement speech-to-text with Apple's new SpeechAnalyzer API (iOS 26+). Powers Notes, Voice Memos, Journal, and Call Summarization.

## Overview

SpeechAnalyzer is Apple's next-generation speech-to-text API:
- **On-device processing** - Private, no server required
- **Long-form audio** - Optimized for meetings, lectures, conversations
- **Distant audio** - Works well with speakers across the room
- **Volatile results** - Real-time approximate results while processing
- **Timing metadata** - Sync text with audio playback
- **Model management** - System handles model downloads and updates

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
import Speech

func transcribe(file: URL, locale: Locale) async throws -> AttributedString {
    let transcriber = SpeechTranscriber(
        locale: locale,
        preset: .offlineTranscription
    )

    async let result = try transcriber.results
        .reduce(AttributedString()) { $0 + $1.text }

    let analyzer = SpeechAnalyzer(modules: [transcriber])

    if let lastSample = try await analyzer.analyzeSequence(from: file) {
        try await analyzer.finalizeAndFinish(through: lastSample)
    } else {
        await analyzer.cancelAndFinishNow()
    }

    return try await result
}
```

### Live Transcription Setup

```swift
// 1. Configure transcriber with volatile results
let transcriber = SpeechTranscriber(
    locale: Locale.current,
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

## Platform Support

| Feature | Availability |
|---------|--------------|
| SpeechTranscriber | iOS 26+, macOS Tahoe+ |
| DictationTranscriber | iOS 26+, macOS Tahoe+, watchOS 26+ |
| SFSpeechRecognizer | iOS 10+ (legacy) |

## Related

- [CoreML](/skills/machine-learning/coreml) — deploy custom speech/audio ML models when SpeechAnalyzer doesn't meet your needs
- [Foundation Models](/skills/integration/foundation-models) — generate summaries or titles from transcribed text using Apple Intelligence

### WWDC Sessions

- [WWDC25-277: Bring advanced speech-to-text with SpeechAnalyzer](https://developer.apple.com/videos/play/wwdc2025/277/)

### Apple Documentation

- [Speech Framework](https://developer.apple.com/documentation/speech)
