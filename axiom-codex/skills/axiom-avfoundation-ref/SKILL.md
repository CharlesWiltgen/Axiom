---
name: axiom-avfoundation-ref
description: Reference — AVFoundation audio APIs, AVAudioSession categories/modes, AVAudioEngine pipelines, bit-perfect DAC output, iOS 26+ spatial audio capture, ASAF/APAC, Audio Mix with Cinematic framework
license: MIT
metadata:
  version: "1.0.0"
---

# AVFoundation Audio Reference

## Quick Reference

```swift
// AUDIO SESSION SETUP
import AVFoundation

try AVAudioSession.sharedInstance().setCategory(
    .playback,                              // or .playAndRecord, .ambient
    mode: .default,                         // or .voiceChat, .measurement
    options: [.mixWithOthers, .allowBluetooth]
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
    options: [.bluetoothHighQualityRecording, .allowBluetoothA2DP]
)
```

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
| `.gameChat` | Voice chat in games |
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
.allowBluetooth         // HFP (calls)
.allowBluetoothA2DP     // High quality stereo
.bluetoothHighQualityRecording  // iOS 26+ AirPods recording

// Routing
.defaultToSpeaker       // Route to speaker (not receiver)
.allowAirPlay           // Enable AirPlay
```

### Interruption Handling

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

### Format Conversion

```swift
// AVAudioEngine mic input is always 44.1kHz/32-bit float
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

## Bit-Perfect Audio / DAC Output

### iOS Behavior

iOS provides **bit-perfect output by default** to USB DACs — no resampling occurs. The DAC receives the source sample rate directly.

```swift
// iOS automatically matches source sample rate to DAC
// No special configuration needed for bit-perfect output

let player = AVAudioPlayerNode()
// File at 96kHz → DAC receives 96kHz
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
| 44.1 kHz | Passthrough | CD quality |
| 48 kHz | Passthrough | Video standard |
| 96 kHz | Passthrough | Hi-res |
| 192 kHz | Passthrough | Hi-res |
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

extension RecordingViewController: AVInputPickerInteractionDelegate {
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
        .allowBluetoothA2DP              // Fallback
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
let audioInput = AVCaptureDeviceInput(device: audioDevice)
audioInput.multichannelAudioMode = .firstOrderAmbisonics

// With AVAssetWriter (full control)
// Requires two AudioDataOutputs: FOA (4ch) + Stereo (2ch)
```

### AVAssetWriter Spatial Audio Setup

```swift
// Configure two AudioDataOutputs
let foaOutput = AVCaptureAudioDataOutput()
foaOutput.spatialAudioChannelLayoutTag = kAudioChannelLayoutTag_HOA_ACN_SN3D  // 4 channels

let stereoOutput = AVCaptureAudioDataOutput()
stereoOutput.spatialAudioChannelLayoutTag = kAudioChannelLayoutTag_Stereo    // 2 channels

// Create metadata generator
let metadataGenerator = AVCaptureSpatialAudioMetadataSampleGenerator()

// Feed FOA buffers to generator
func captureOutput(_ output: AVCaptureOutput,
                   didOutput sampleBuffer: CMSampleBuffer,
                   from connection: AVCaptureConnection) {
    metadataGenerator.append(sampleBuffer)
    // Also write to FOA AssetWriterInput
}

// When recording stops, get metadata sample
let metadataSample = metadataGenerator.createMetadataSample()
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
let nowPlayingInfo: [String: Any] = [
    MPMediaItemPropertyTitle: "Song Title",
    MPMediaItemPropertyArtist: "Artist",
    MPNowPlayingInfoPropertyElapsedPlaybackTime: player.currentTime,
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
    options: [.allowBluetooth, .allowBluetoothA2DP]
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

**Targets:** iOS 12+ (core), iOS 26+ (spatial features)
**Frameworks:** AVFoundation, AVKit, Cinematic (iOS 26+)
**History:** See git log for changes
