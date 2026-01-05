---
name: speech
description: Use when implementing speech-to-text, live transcription, or audio transcription. Covers SpeechAnalyzer (iOS 26+), SpeechTranscriber, volatile/finalized results, AssetInventory model management, audio format handling.
version: 1.0.0
---

# Speech-to-Text with SpeechAnalyzer

## Overview

SpeechAnalyzer is Apple's new speech-to-text API introduced in iOS 26. It powers Notes, Voice Memos, Journal, and Call Summarization. The on-device model is faster, more accurate, and better for long-form/distant audio than SFSpeechRecognizer.

**Key principle**: SpeechAnalyzer is modular—add transcription modules to an analysis session. Results stream asynchronously using Swift's AsyncSequence.

## Decision Tree - SpeechAnalyzer vs SFSpeechRecognizer

```
Need speech-to-text?
  ├─ iOS 26+ only?
  │   └─ Yes → SpeechAnalyzer (preferred)
  ├─ Need iOS 10-25 support?
  │   └─ Yes → SFSpeechRecognizer (or DictationTranscriber)
  ├─ Long-form audio (meetings, lectures)?
  │   └─ Yes → SpeechAnalyzer
  ├─ Distant audio (across room)?
  │   └─ Yes → SpeechAnalyzer
  └─ Short dictation commands?
      └─ Either works
```

**SpeechAnalyzer advantages**:
- Better for long-form and conversational audio
- Works well with distant speakers (meetings)
- On-device, private
- Model managed by system (no app size increase)
- Powers Notes, Voice Memos, Journal

**DictationTranscriber** (iOS 26+): Same languages as SFSpeechRecognizer, but doesn't require user to enable Siri/dictation in Settings.

## Red Flags

Use this skill when you see:
- "Live transcription"
- "Transcribe audio"
- "Speech-to-text"
- "SpeechAnalyzer" or "SpeechTranscriber"
- "Volatile results"
- Building Notes-like or Voice Memos-like features

## Pattern 1 - File Transcription (Simplest)

Transcribe an audio file to text in one function.

```swift
import Speech

func transcribe(file: URL, locale: Locale) async throws -> AttributedString {
    // Set up transcriber
    let transcriber = SpeechTranscriber(
        locale: locale,
        preset: .offlineTranscription
    )

    // Collect results asynchronously
    async let transcriptionFuture = try transcriber.results
        .reduce(AttributedString()) { str, result in
            str + result.text
        }

    // Set up analyzer with transcriber module
    let analyzer = SpeechAnalyzer(modules: [transcriber])

    // Analyze the file
    if let lastSample = try await analyzer.analyzeSequence(from: file) {
        try await analyzer.finalizeAndFinish(through: lastSample)
    } else {
        await analyzer.cancelAndFinishNow()
    }

    return try await transcriptionFuture
}
```

**Key points**:
- `analyzeSequence(from:)` reads file and feeds audio to analyzer
- `finalizeAndFinish(through:)` ensures all results are finalized
- Results are `AttributedString` with timing metadata

## Pattern 2 - Live Transcription Setup

For real-time transcription from microphone.

### Step 1 - Configure SpeechTranscriber

```swift
import Speech

class TranscriptionManager: ObservableObject {
    private var transcriber: SpeechTranscriber?
    private var analyzer: SpeechAnalyzer?
    private var analyzerFormat: AudioFormatDescription?
    private var inputBuilder: AsyncStream<AnalyzerInput>.Continuation?

    @Published var finalizedTranscript = AttributedString()
    @Published var volatileTranscript = AttributedString()

    func setUp() async throws {
        // Create transcriber with options
        transcriber = SpeechTranscriber(
            locale: Locale.current,
            transcriptionOptions: [],
            reportingOptions: [.volatileResults],  // Enable real-time updates
            attributeOptions: [.audioTimeRange]     // Include timing
        )

        guard let transcriber else { throw TranscriptionError.setupFailed }

        // Create analyzer with transcriber module
        analyzer = SpeechAnalyzer(modules: [transcriber])

        // Get required audio format
        analyzerFormat = await SpeechAnalyzer.bestAvailableAudioFormat(
            compatibleWith: [transcriber]
        )

        // Ensure model is available
        try await ensureModel(for: transcriber)

        // Create input stream
        let (stream, builder) = AsyncStream<AnalyzerInput>.makeStream()
        inputBuilder = builder

        // Start analyzer
        try await analyzer?.start(inputSequence: stream)
    }
}
```

### Step 2 - Ensure Model Availability

```swift
func ensureModel(for transcriber: SpeechTranscriber) async throws {
    let locale = Locale.current

    // Check if language is supported
    let supported = await SpeechTranscriber.supportedLocales
    guard supported.contains(where: {
        $0.identifier(.bcp47) == locale.identifier(.bcp47)
    }) else {
        throw TranscriptionError.localeNotSupported
    }

    // Check if model is installed
    let installed = await SpeechTranscriber.installedLocales
    if installed.contains(where: {
        $0.identifier(.bcp47) == locale.identifier(.bcp47)
    }) {
        return  // Already installed
    }

    // Download model
    if let downloader = try await AssetInventory.assetInstallationRequest(
        supporting: [transcriber]
    ) {
        // Track progress if needed
        let progress = downloader.progress
        try await downloader.downloadAndInstall()
    }
}
```

**Note**: Models are stored in system storage, not app storage. Limited number of languages can be allocated at once.

### Step 3 - Handle Results

```swift
func startResultHandling() {
    Task {
        guard let transcriber else { return }

        do {
            for try await result in transcriber.results {
                let text = result.text

                if result.isFinal {
                    // Finalized result - won't change
                    finalizedTranscript += text
                    volatileTranscript = AttributedString()

                    // Access timing info
                    for run in text.runs {
                        if let timeRange = run.audioTimeRange {
                            print("Time: \(timeRange)")
                        }
                    }
                } else {
                    // Volatile result - will be replaced
                    volatileTranscript = text
                }
            }
        } catch {
            print("Transcription failed: \(error)")
        }
    }
}
```

## Pattern 3 - Audio Recording and Streaming

Connect AVAudioEngine to SpeechAnalyzer.

```swift
import AVFoundation

class AudioRecorder {
    private let audioEngine = AVAudioEngine()
    private var outputContinuation: AsyncStream<AVAudioPCMBuffer>.Continuation?
    private let transcriptionManager: TranscriptionManager

    func startRecording() async throws {
        // Request permission
        guard await AVAudioApplication.requestRecordPermission() else {
            throw RecordingError.permissionDenied
        }

        // Configure audio session (iOS)
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .spokenAudio)
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        #endif

        // Set up transcriber
        try await transcriptionManager.setUp()
        transcriptionManager.startResultHandling()

        // Stream audio to transcriber
        for await buffer in try audioStream() {
            try await transcriptionManager.streamAudio(buffer)
        }
    }

    private func audioStream() throws -> AsyncStream<AVAudioPCMBuffer> {
        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(
            onBus: 0,
            bufferSize: 4096,
            format: format
        ) { [weak self] buffer, time in
            self?.outputContinuation?.yield(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()

        return AsyncStream { continuation in
            outputContinuation = continuation
        }
    }
}
```

### Stream Audio with Format Conversion

```swift
extension TranscriptionManager {
    private var converter: AVAudioConverter?

    func streamAudio(_ buffer: AVAudioPCMBuffer) async throws {
        guard let inputBuilder, let analyzerFormat else {
            throw TranscriptionError.notSetUp
        }

        // Convert to analyzer's required format
        let converted = try convertBuffer(buffer, to: analyzerFormat)

        // Send to analyzer
        let input = AnalyzerInput(buffer: converted)
        inputBuilder.yield(input)
    }

    private func convertBuffer(
        _ buffer: AVAudioPCMBuffer,
        to format: AudioFormatDescription
    ) throws -> AVAudioPCMBuffer {
        // Lazy initialize converter
        if converter == nil {
            let sourceFormat = buffer.format
            let destFormat = AVAudioFormat(cmAudioFormatDescription: format)!
            converter = AVAudioConverter(from: sourceFormat, to: destFormat)
        }

        guard let converter else {
            throw TranscriptionError.conversionFailed
        }

        let outputBuffer = AVAudioPCMBuffer(
            pcmFormat: converter.outputFormat,
            frameCapacity: buffer.frameLength
        )!

        try converter.convert(to: outputBuffer, from: buffer)
        return outputBuffer
    }
}
```

## Pattern 4 - Stopping Transcription

Properly finalize to get remaining volatile results as finalized.

```swift
func stopRecording() async {
    // Stop audio
    audioEngine.stop()
    audioEngine.inputNode.removeTap(onBus: 0)
    outputContinuation?.finish()

    // Finalize transcription (converts remaining volatile to final)
    try? await analyzer?.finalizeAndFinishThroughEndOfInput()

    // Cancel any pending tasks
    recognizerTask?.cancel()
}
```

**Critical**: Always call `finalizeAndFinishThroughEndOfInput()` to ensure volatile results are finalized.

## Pattern 5 - Model Asset Management

### Check Supported Languages

```swift
// Languages the API supports
let supported = await SpeechTranscriber.supportedLocales

// Languages currently installed on device
let installed = await SpeechTranscriber.installedLocales
```

### Deallocate Languages

Limited number of languages can be allocated. Deallocate unused ones.

```swift
func deallocateLanguages() async {
    let allocated = await AssetInventory.allocatedLocales
    for locale in allocated {
        await AssetInventory.deallocate(locale: locale)
    }
}
```

## Pattern 6 - Displaying Results with Timing

Highlight text during audio playback using timing metadata.

```swift
struct TranscriptView: View {
    let transcript: AttributedString
    @Binding var playbackTime: CMTime

    var body: some View {
        Text(highlightedTranscript)
    }

    var highlightedTranscript: AttributedString {
        var result = transcript

        for (range, run) in transcript.runs {
            guard let timeRange = run.audioTimeRange else { continue }

            let isActive = timeRange.containsTime(playbackTime)
            if isActive {
                result[range].backgroundColor = .yellow
            }
        }

        return result
    }
}
```

## Anti-Patterns

### Don't - Forget to finalize

```swift
// BAD - volatile results lost
func stopRecording() {
    audioEngine.stop()
    // Missing finalize!
}

// GOOD - volatile results become finalized
func stopRecording() async {
    audioEngine.stop()
    try? await analyzer?.finalizeAndFinishThroughEndOfInput()
}
```

### Don't - Ignore format conversion

```swift
// BAD - format mismatch may fail silently
inputBuilder.yield(AnalyzerInput(buffer: rawBuffer))

// GOOD - convert to analyzer's format
let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber])
let converted = try convertBuffer(rawBuffer, to: format)
inputBuilder.yield(AnalyzerInput(buffer: converted))
```

### Don't - Skip model availability check

```swift
// BAD - may crash if model not installed
let transcriber = SpeechTranscriber(locale: locale, ...)
// Start using immediately

// GOOD - ensure model is ready
let transcriber = SpeechTranscriber(locale: locale, ...)
try await ensureModel(for: transcriber)
// Now safe to use
```

## Presets Reference

| Preset | Use Case |
|--------|----------|
| `.offlineTranscription` | File transcription, no real-time feedback needed |
| `.progressiveLiveTranscription` | Live transcription with volatile updates |

## Options Reference

### TranscriptionOptions
- Default: None (standard transcription)

### ReportingOptions
- `.volatileResults`: Enable real-time approximate results

### AttributeOptions
- `.audioTimeRange`: Include CMTimeRange for each text segment

## Platform Availability

| Platform | SpeechTranscriber | DictationTranscriber |
|----------|-------------------|---------------------|
| iOS 26+ | Yes | Yes |
| macOS Tahoe+ | Yes | Yes |
| watchOS 26+ | No | Yes |
| tvOS 26+ | TBD | TBD |

**Hardware requirements**: Varies by device. Use `supportedLocales` to check.

## Integration with Apple Intelligence

Combine with Foundation Models for summarization:

```swift
import FoundationModels

func generateTitle(for transcript: String) async throws -> String {
    let session = LanguageModelSession()
    let prompt = "Generate a short, clever title for this story: \(transcript)"
    let response = try await session.respond(to: prompt)
    return response.content
}
```

See `axiom-ios-ai` skill for Foundation Models details.

## Checklist

Before shipping speech-to-text:

- [ ] Check locale support with `supportedLocales`
- [ ] Ensure model with `AssetInventory.assetInstallationRequest`
- [ ] Handle download progress for user feedback
- [ ] Convert audio to `bestAvailableAudioFormat`
- [ ] Enable `.volatileResults` for live transcription
- [ ] Call `finalizeAndFinishThroughEndOfInput()` on stop
- [ ] Handle timing with `.audioTimeRange` if needed
- [ ] Clear volatile results when finalized result arrives
- [ ] Request microphone permission before recording

## Resources

**WWDC**: 2025-277

**Docs**: /speech, /speech/speechanalyzer, /speech/speechtranscriber

**Skills**: coreml (on-device ML), axiom-ios-ai (Foundation Models)
