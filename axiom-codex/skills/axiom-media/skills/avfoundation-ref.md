
# AVFoundation Audio Reference

## Quick Reference

```swift
// AUDIO SESSION SETUP
import AVFoundation

try AVAudioSession.sharedInstance().setCategory(
    .playback,                              // or .playAndRecord, .ambient
    mode: .default,                         // or .voiceChat (needs .playAndRecord), .measurement
    options: [.mixWithOthers]
)
try AVAudioSession.sharedInstance().setActive(true)

// AUDIO ENGINE PIPELINE
let engine = AVAudioEngine()
let player = AVAudioPlayerNode()
engine.attach(player)
engine.connect(player, to: engine.mainMixerNode, format: nil)
try engine.start()
player.scheduleFile(audioFile, at: nil)
player.play()

// INPUT PICKER (iOS 26+)
import AVKit
let picker = AVInputPickerInteraction()
picker.delegate = self
myButton.addInteraction(picker)
// In button action: picker.present()

// AIRPODS HIGH QUALITY (iOS 26+)
try AVAudioSession.sharedInstance().setCategory(
    .playAndRecord,
    options: [.bluetoothHighQualityRecording, .allowBluetoothHFP]  // HFP is the fallback when the route lacks HQ recording
)
```

On 27, `engine.connect` and `player.play()` are **deprecated**, while `setActive` merely gains an async alternative (it is not deprecated) — see Async Activation and the Deactivation Model and Throwing Engine and Node APIs below.

---

## AVAudioSession

### Categories

| Category | Use Case | Silent Switch | Background |
|----------|----------|---------------|------------|
| `.ambient` | Game sounds, not primary | Silences | No |
| `.soloAmbient` | Default, interrupts others | Silences | No |
| `.playback` | Music player, podcast | Ignores | Yes |
| `.record` | Voice recorder | — | Yes |
| `.playAndRecord` | VoIP, voice chat | Ignores | Yes |
| `.multiRoute` | DJ apps, multiple outputs | Ignores | Yes |

### Modes

| Mode | Use Case |
|------|----------|
| `.default` | General audio |
| `.voiceChat` | VoIP, reduces echo |
| `.videoChat` | FaceTime-style |
| `.gameChat` | Set by Game Kit for GKVoiceChat — do not set directly; use `.voiceChat` |
| `.videoRecording` | Camera recording |
| `.measurement` | Flat response, no processing |
| `.moviePlayback` | Video playback |
| `.spokenAudio` | Podcasts, audiobooks |

### Options

```swift
// Mixing
.mixWithOthers          // Play with other apps
.duckOthers             // Lower other audio while playing
.interruptSpokenAudioAndMixWithOthers  // Pause podcasts, mix music

// Bluetooth
.allowBluetoothHFP      // HFP (calls); replaces deprecated .allowBluetooth
.allowBluetoothA2DP     // High quality stereo
.bluetoothHighQualityRecording  // iOS 26+ AirPods recording

// Routing
.defaultToSpeaker       // Route to speaker (not receiver)
.allowAirPlay           // Enable AirPlay
```

### Interruption Handling

This pattern warns on 27 — `InterruptionType` and `InterruptionOptions` are deprecated. See Async Activation and the Deactivation Model below.

```swift
NotificationCenter.default.addObserver(
    forName: AVAudioSession.interruptionNotification,
    object: nil,
    queue: .main
) { notification in
    guard let userInfo = notification.userInfo,
          let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
        return
    }

    switch type {
    case .began:
        // Pause playback
        player.pause()

    case .ended:
        guard let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt else { return }
        let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
        if options.contains(.shouldResume) {
            player.play()
        }

    @unknown default:
        break
    }
}
```

### Route Change Handling

```swift
NotificationCenter.default.addObserver(
    forName: AVAudioSession.routeChangeNotification,
    object: nil,
    queue: .main
) { notification in
    guard let userInfo = notification.userInfo,
          let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
          let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
        return
    }

    switch reason {
    case .oldDeviceUnavailable:
        // Headphones unplugged — pause playback
        player.pause()

    case .newDeviceAvailable:
        // New device connected
        break

    case .categoryChange:
        // Category changed by system or another app
        break

    default:
        break
    }
}
```

---

## Async Activation and the Deactivation Model OS27

Unavailable on macOS. This replaces the interruption-notification model for tracking why audio stopped.

### Async activate and deactivate

`setActive(_:)` blocks the calling thread. The 27 calls return immediately and deliver the result asynchronously. Both also have `completionHandler:` forms.

```swift
@available(iOS 27, *)
func beginPlayback() async throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback)
    _ = try await session.activate()
}

@available(iOS 27, *)
func endPlayback() async throws {
    _ = try await AVAudioSession.sharedInstance()
        .deactivate(options: .notifyOthersOnDeactivation)
}
```

| API | Introduced | Notes |
|---|---|---|
| `activate(options:)` | iOS/tvOS/visionOS 27, watchOS 5 | Not new on watchOS. **On watchOS** under the long-form audio routing policy it may present a route picker and fail if the user cancels |
| `deactivate(options:)` | 27 | Async alternative to `setActive(false, options:)` (not deprecated) |
| `AVAudioSessionDeactivationOptions.notifyOthersOnDeactivation` | 27 | Signals an interrupted app that it may resume |

### Deactivation and resumption notifications

| Notification | userInfo key | Payload |
|---|---|---|
| `AVAudioSession.didBecomeActiveNotification` | none | no payload |
| `AVAudioSession.didBecomeInactiveNotification` | `AVAudioSession.deactivationContextKey` | `AVAudioSession.DeactivationContext` |
| `AVAudioSession.resumptionRecommendationNotification` | `AVAudioSession.resumptionContextKey` | `AVAudioSession.ResumptionContext` |

| Type | Members |
|---|---|
| `DeactivationContext` | `source` (`.app` / `.system`), `interruptionContext` — non-nil only when another app caused the interruption |
| `InterruptionContext` | `reason: AVAudioSession.InterruptionReason` |
| `ResumptionContext` | `recommendation` (`.shouldResume` / `.shouldNotResume`) |

```swift
@available(iOS 27, *)
func audioDidBecomeInactive(_ notification: Notification, player: AVAudioPlayerNode) {
    guard let context = notification.userInfo?[AVAudioSession.deactivationContextKey]
            as? AVAudioSession.DeactivationContext else { return }

    if context.source == .system, context.interruptionContext != nil {
        player.pause()
    }
}
```

### Typed notification messages

The same three notifications ship as `NotificationCenter.Message` types. The typed path fuses source and interruption into one `DeactivationResult` enum, which the userInfo path does not expose.

```swift
@available(iOS 27, *)
@MainActor
func observeSession() {
    let session = AVAudioSession.sharedInstance()

    _ = NotificationCenter.default.addObserver(
        of: session,
        for: AVAudioSession.DidBecomeInactiveMessage.self
    ) { message in
        switch message.deactivationResult {
        case .appDeactivated:
            break
        case .systemInterruption(let context):
            _ = context.reason
        @unknown default:
            break
        }
    }

    _ = NotificationCenter.default.addObserver(
        of: session,
        for: AVAudioSession.ResumptionRecommendationMessage.self
    ) { message in
        if message.recommendation == .shouldResume {
            // resume playback
        }
    }
}
```

### Legacy interruption API status

`AVAudioSession.InterruptionType` and `AVAudioSession.InterruptionOptions` are deprecated in 27, directing callers to the notifications above. The Swift `interruptionNotification` constant and its userInfo keys are *not* themselves marked deprecated, but decoding the payload requires the deprecated types — so the legacy handler still builds, warning on `InterruptionType` and `InterruptionOptions`.

### New port

`AVAudioSession.Port.mediaDeviceExtension` — iOS 27 only, unavailable on watchOS, tvOS, visionOS, and macOS. Output to a media device vended through a user-installed system-wide extension.

---

## AVAudioEngine

### Basic Pipeline

```swift
let engine = AVAudioEngine()

// Create nodes
let player = AVAudioPlayerNode()
let reverb = AVAudioUnitReverb()
reverb.loadFactoryPreset(.largeHall)
reverb.wetDryMix = 50

// Attach to engine
engine.attach(player)
engine.attach(reverb)

// Connect: player → reverb → mixer → output
engine.connect(player, to: reverb, format: nil)
engine.connect(reverb, to: engine.mainMixerNode, format: nil)

// Start
engine.prepare()
try engine.start()

// Play file
let url = Bundle.main.url(forResource: "audio", withExtension: "m4a")!
let file = try AVAudioFile(forReading: url)
player.scheduleFile(file, at: nil)
player.play()
```

### Node Types

| Node | Purpose |
|------|---------|
| `AVAudioPlayerNode` | Plays audio files/buffers |
| `AVAudioInputNode` | Mic input (engine.inputNode) |
| `AVAudioOutputNode` | Speaker output (engine.outputNode) |
| `AVAudioMixerNode` | Mix multiple inputs |
| `AVAudioUnitEQ` | Equalizer |
| `AVAudioUnitReverb` | Reverb effect |
| `AVAudioUnitDelay` | Delay effect |
| `AVAudioUnitDistortion` | Distortion effect |
| `AVAudioUnitTimePitch` | Time stretch / pitch shift |

### Installing Taps (Audio Analysis)

```swift
let inputNode = engine.inputNode
let format = inputNode.outputFormat(forBus: 0)

inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, time in
    // Process audio buffer
    guard let channelData = buffer.floatChannelData?[0] else { return }
    let frameLength = Int(buffer.frameLength)

    // Calculate RMS level
    var sum: Float = 0
    for i in 0..<frameLength {
        sum += channelData[i] * channelData[i]
    }
    let rms = sqrt(sum / Float(frameLength))
    let dB = 20 * log10(rms)

    DispatchQueue.main.async {
        self.levelMeter = dB
    }
}

// Don't forget to remove when done
inputNode.removeTap(onBus: 0)
```

`installTap(onBus:bufferSize:format:block:)` is deprecated in 27 — see Throwing Engine and Node APIs below.

### Format Conversion

```swift
// The input format is the current hardware format — read it, never assume it.
// On iPhone it is typically 48 kHz, not 44.1 kHz.
// Use AVAudioConverter for other formats

let inputFormat = engine.inputNode.outputFormat(forBus: 0)
let outputFormat = AVAudioFormat(
    commonFormat: .pcmFormatInt16,
    sampleRate: 48000,
    channels: 1,
    interleaved: false
)!

let converter = AVAudioConverter(from: inputFormat, to: outputFormat)!

// In tap callback:
let outputBuffer = AVAudioPCMBuffer(
    pcmFormat: outputFormat,
    frameCapacity: AVAudioFrameCount(outputFormat.sampleRate * 0.1)
)!

var error: NSError?
converter.convert(to: outputBuffer, error: &error) { inNumPackets, outStatus in
    outStatus.pointee = .haveData
    return inputBuffer
}
```

---

## Throwing Engine and Node APIs OS27

27 replaces the AVAudioEngine surface that trapped on misuse with throwing equivalents. The originals are deprecated, so existing code keeps building with warnings.

| Deprecated in 27 | Replacement |
|---|---|
| `connect(_:to:format:)` | `connectNode(_:to:format:) throws` |
| `connect(_:to:fromBus:toBus:format:)` | `connectNode(_:to:fromBus:toBus:format:) throws` |
| `connect(_:to:fromBus:format:)` (to `[AVAudioConnectionPoint]`) | `connectNode(_:to:fromBus:format:) throws` |
| `play()` | `playAudio() throws` |
| `play(at:)` | `playAudio(at:) throws` |
| `installTap(onBus:bufferSize:format:block:)` | `installAudioTap(onBus:bufferSize:format:tapProvider:) throws` |
| `connectMIDI(_:to:format:eventListBlock:)` | `connectMIDI(_:to:format:eventListProvider:)` — the block type changes with it, `AUMIDIEventListBlock?` → `AVMIDIEventListBlock?`, so a straight rename hits a type error |
| `AVAudioFormat.init(cmAudioFormatDescription:)` | `AVAudioFormat.init(formatDescription:)`, now failable |

A format mismatch that used to crash the process now throws.

```swift
@available(iOS 27, *)
func buildGraph(engine: AVAudioEngine, player: AVAudioPlayerNode, format: AVAudioFormat) throws {
    engine.attach(player)
    try engine.connectNode(player, to: engine.mainMixerNode, format: format)
    try engine.start()
    try player.playAudio()
}
```

### Taps deliver a read-only buffer

`installAudioTap` hands the callback an `AVReadOnlyAudioPCMBuffer` and takes a `@Sendable` closure. `channelData(_:)` returns a `Span`-carrying enum instead of a raw pointer.

```swift
@available(iOS 27, *)
func meterInput(engine: AVAudioEngine) throws {
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)

    try input.installAudioTap(onBus: 0, bufferSize: 1024, format: format) { buffer, time in
        guard case .float(let samples) = buffer.channelData(0) else { return }
        var sum: Float = 0
        for i in 0..<samples.count {
            sum += samples[i] * samples[i]
        }
        let rms = (sum / Float(samples.count)).squareRoot()
        _ = 20 * log10(rms)
    }
}
```

`AVAudioPCMBuffer` gains matching accessors in 27 — `channelData(_:)`, `mutableChannelData(_:)`, `init(copying:)`, `withUnsafeAudioBufferList(_:)` — but not on identical terms: both of its channel-data accessors are marked `@unsafe`, whereas `AVReadOnlyAudioPCMBuffer.channelData(_:)` is not.

### Realtime-safe render blocks are ObjC only

All four are marked `__SWIFT_UNAVAILABLE_MSG("Swift is not supported for use with audio realtime threads")` and do not appear in Swift at all. Write realtime render and receive callbacks in ObjC or C.

| ObjC selector | Type |
|---|---|
| `initWithRealtimeSafeRenderBlock:` | `AVAudioSourceNode` |
| `initWithFormat:realtimeSafeRenderBlock:` | `AVAudioSourceNode` |
| `initWithRealtimeSafeReceiverBlock:` | `AVAudioSinkNode` |
| `setRealtimeSafeManualRenderingInputPCMFormat:inputBlock:` | `AVAudioInputNode` |

### Reverb preset

`AVAudioUnitReverbPreset.outdoorGeneral` — new in 27, unavailable on watchOS.

---

## Bit-Perfect Audio / DAC Output

### iOS Behavior

iOS renders the audio graph at the current hardware sample rate. A file whose rate differs is resampled; to avoid it, set the session's preferred sample rate to the source rate and let the route follow.

```swift
// The graph runs at the hardware rate — a 96 kHz file is resampled unless the route runs at 96 kHz
// Ask for the source rate before activating; the route honours it only if the DAC supports it
try AVAudioSession.sharedInstance().setPreferredSampleRate(96000)
try AVAudioSession.sharedInstance().setActive(true)
```

### Avoiding Resampling

```swift
// Check hardware sample rate
let hardwareSampleRate = AVAudioSession.sharedInstance().sampleRate

// Match your audio format to hardware when possible
let format = AVAudioFormat(
    standardFormatWithSampleRate: hardwareSampleRate,
    channels: 2
)
```

### USB DAC Routing

```swift
// List available outputs
let currentRoute = AVAudioSession.sharedInstance().currentRoute
for output in currentRoute.outputs {
    print("Output: \(output.portName), Type: \(output.portType)")
    // USB DAC shows as .usbAudio
}

// Prefer USB output
try AVAudioSession.sharedInstance().setPreferredInput(usbPort)
```

### Sample Rate Considerations

| Source | iOS Behavior | Notes |
|--------|--------------|-------|
| 44.1 kHz | Resampled unless the session rate matches | CD quality |
| 48 kHz | Resampled unless the session rate matches | Video standard |
| 96 kHz | Resampled unless the session rate matches | Hi-res |
| 192 kHz | Resampled unless the session rate matches | Hi-res |
| DSD | Not supported | Use DoP or convert |

---

## iOS 26+ Input Selection

### AVInputPickerInteraction

Native input device selection with live metering:

```swift
import AVKit

class RecordingViewController: UIViewController {
    let inputPicker = AVInputPickerInteraction()

    override func viewDidLoad() {
        super.viewDidLoad()

        // Configure audio session first
        try? AVAudioSession.sharedInstance().setCategory(.playAndRecord)
        try? AVAudioSession.sharedInstance().setActive(true)

        // Setup picker
        inputPicker.delegate = self
        selectMicButton.addInteraction(inputPicker)
    }

    @IBAction func selectMicTapped(_ sender: UIButton) {
        inputPicker.present()
    }
}

extension RecordingViewController: AVInputPickerInteraction.Delegate {
    // Implement delegate methods as needed
}
```

**Features:**
- Live sound level metering
- Microphone mode selection
- System remembers selection per app

---

## iOS 26+ AirPods High Quality Recording

LAV-microphone equivalent quality for content creators:

```swift
// AVAudioSession approach
try AVAudioSession.sharedInstance().setCategory(
    .playAndRecord,
    options: [
        .bluetoothHighQualityRecording,  // New in iOS 26
        .allowBluetoothHFP              // Fallback if the route lacks HQ recording
    ]
)

// AVCaptureSession approach
let captureSession = AVCaptureSession()
captureSession.configuresApplicationAudioSessionForBluetoothHighQualityRecording = true
```

**Notes:**
- Uses dedicated Bluetooth link optimized for AirPods
- Falls back to HFP if device doesn't support HQ mode
- Supports AirPods stem controls for start/stop recording

---

## Spatial Audio Capture (iOS 26+)

### First Order Ambisonics (FOA)

Record 3D spatial audio using device microphone array:

```swift
// With AVCaptureMovieFileOutput (simple)
let audioInput = try AVCaptureDeviceInput(device: audioDevice)
audioInput.multichannelAudioMode = .firstOrderAmbisonics

// With AVAssetWriter (full control)
// Requires two AudioDataOutputs: FOA (4ch) + Stereo (2ch)
```

### AVAssetWriter Spatial Audio Setup

```swift
// Configure two AudioDataOutputs
let foaOutput = AVCaptureAudioDataOutput()
foaOutput.spatialAudioChannelLayoutTag = kAudioChannelLayoutTag_HOA_ACN_SN3D | 4  // 4 channels (FOA)

let stereoOutput = AVCaptureAudioDataOutput()
stereoOutput.spatialAudioChannelLayoutTag = kAudioChannelLayoutTag_Stereo    // 2 channels

// Create metadata generator
let metadataGenerator = AVCaptureSpatialAudioMetadataSampleGenerator()

// Feed FOA buffers to generator
func captureOutput(_ output: AVCaptureOutput,
                   didOutput sampleBuffer: CMSampleBuffer,
                   from connection: AVCaptureConnection) {
    _ = metadataGenerator.analyzeAudioSample(sampleBuffer)
    // Also write to FOA AssetWriterInput
}

// When recording stops, get metadata sample
let metadataSample = metadataGenerator.newTimedMetadataSampleBufferAndResetAnalyzer()
// Write to metadata track
```

### Output File Structure

Spatial audio files contain:
1. **Stereo AAC track** — Compatibility fallback
2. **APAC track** — Spatial audio (FOA)
3. **Metadata track** — Audio Mix tuning parameters

File formats: `.mov`, `.mp4`, `.qta` (QuickTime Audio, iOS 26+)

---

## ASAF / APAC (Apple Spatial Audio)

### Overview

| Component | Purpose |
|-----------|---------|
| **ASAF** | Apple Spatial Audio Format — production format |
| **APAC** | Apple Positional Audio Codec — delivery codec |

### APAC Capabilities

- Bitrates: 64 kbps to 768 kbps
- Supports: Channels, Objects, Higher Order Ambisonics, Dialogue, Binaural
- Head-tracked rendering adaptive to listener position/orientation
- Required for Apple Immersive Video

### Playback

```swift
// Standard AVPlayer handles APAC automatically
let player = AVPlayer(url: spatialAudioURL)
player.play()

// Head tracking enabled automatically on AirPods
```

### Platform Support

All Apple platforms except watchOS support APAC playback.

---

## Audio Mix (Cinematic Framework)

Separate and remix speech vs ambient sounds in spatial recordings:

### AVPlayer Integration

```swift
import Cinematic

// Load spatial audio asset
let asset = AVURLAsset(url: spatialAudioURL)
let audioInfo = try await CNAssetSpatialAudioInfo(asset: asset)

// Configure mix parameters
let intensity: Float = 0.5  // 0.0 to 1.0
let style = CNSpatialAudioRenderingStyle.cinematic

// Create and apply audio mix
let audioMix = audioInfo.audioMix(
    effectIntensity: intensity,
    renderingStyle: style
)
playerItem.audioMix = audioMix
```

### Rendering Styles

| Style | Effect |
|-------|--------|
| `.cinematic` | Balanced speech/ambient |
| `.studio` | Enhanced speech clarity |
| `.inFrame` | Focus on visible speakers |
| + 6 extraction modes | Speech-only, ambient-only stems |

### AUAudioMix (Direct AudioUnit)

For apps not using AVPlayer:

```swift
// Input: 4 channels FOA
// Output: Separated speech + ambient

// Get tuning metadata from file
let audioInfo = try await CNAssetSpatialAudioInfo(asset: asset)
let remixMetadata = audioInfo.spatialAudioMixMetadata as CFData

// Apply to AudioUnit via AudioUnitSetProperty
```

---

## Common Patterns

### Background Audio Playback

```swift
// 1. Set category
try AVAudioSession.sharedInstance().setCategory(.playback)

// 2. Enable background mode in Info.plist
// <key>UIBackgroundModes</key>
// <array><string>audio</string></array>

// 3. Set Now Playing info (recommended)
// Elapsed time is seconds as an NSNumber — a player node's node time is not playback time.
// playerTime(forNodeTime:) is nil while the player is not playing, so keep the elapsed time
// already on the lock screen rather than letting a paused publish snap the scrubber to 0:00.
let publishedElapsed = MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyElapsedPlaybackTime] as? Double
let elapsed = player.lastRenderTime
    .flatMap { player.playerTime(forNodeTime: $0) }
    .map { Double($0.sampleTime) / $0.sampleRate }
    ?? publishedElapsed ?? 0

let nowPlayingInfo: [String: Any] = [
    MPMediaItemPropertyTitle: "Song Title",
    MPMediaItemPropertyArtist: "Artist",
    MPNowPlayingInfoPropertyElapsedPlaybackTime: elapsed,
    MPMediaItemPropertyPlaybackDuration: duration
]
MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
```

### Ducking Other Audio

```swift
try AVAudioSession.sharedInstance().setCategory(
    .playback,
    options: .duckOthers
)

// When done, restore others
try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
```

### Bluetooth Device Handling

```swift
// Allow all Bluetooth
try AVAudioSession.sharedInstance().setCategory(
    .playAndRecord,
    options: [.allowBluetoothHFP, .allowBluetoothA2DP]
)

// Check current Bluetooth route
let route = AVAudioSession.sharedInstance().currentRoute
let hasBluetoothOutput = route.outputs.contains {
    $0.portType == .bluetoothA2DP || $0.portType == .bluetoothHFP
}
```

---

## Anti-Patterns

### Wrong Category

```swift
// WRONG — music player using ambient (silenced by switch)
try AVAudioSession.sharedInstance().setCategory(.ambient)

// CORRECT — music needs .playback
try AVAudioSession.sharedInstance().setCategory(.playback)
```

### Missing Interruption Handling

```swift
// WRONG — no interruption observer
// Audio stops on phone call and never resumes

// CORRECT — always handle interruptions
NotificationCenter.default.addObserver(
    forName: AVAudioSession.interruptionNotification,
    // ... handle began/ended
)
```

On 27, observe `didBecomeInactiveNotification` and `resumptionRecommendationNotification` instead.

### Tap Memory Leaks

```swift
// WRONG — tap installed, never removed
engine.inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { ... }

// CORRECT — remove tap when done
deinit {
    engine.inputNode.removeTap(onBus: 0)
}
```

### Format Mismatch Crashes

```swift
// WRONG — connecting nodes with incompatible formats
engine.connect(playerNode, to: mixerNode, format: wrongFormat)  // Crash!

// CORRECT — use nil for automatic format negotiation, or match exactly
engine.connect(playerNode, to: mixerNode, format: nil)
```

On 27, prefer `connectNode(_:to:format:)`, which throws instead of trapping.

### Forgetting to Activate Session

```swift
// WRONG — configure but don't activate
try AVAudioSession.sharedInstance().setCategory(.playback)
// Audio doesn't work!

// CORRECT — always activate
try AVAudioSession.sharedInstance().setCategory(.playback)
try AVAudioSession.sharedInstance().setActive(true)
```

---

## Resources

**WWDC**: 2025-251, 2025-403, 2019-510

**Docs**: /avfoundation, /avkit, /cinematic

---

**Targets:** iOS 12+ (core), iOS 26+ (spatial features), iOS 27 (async activation, throwing engine APIs)
**Frameworks:** AVFoundation, AVKit, Cinematic (iOS 26+)
