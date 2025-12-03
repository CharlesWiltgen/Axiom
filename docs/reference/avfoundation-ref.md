---
name: avfoundation-ref
description: AVFoundation audio APIs — AVAudioSession categories/modes, AVAudioEngine pipelines, bit-perfect DAC output, iOS 26+ spatial audio capture, ASAF/APAC, Audio Mix
---

# AVFoundation Audio Reference

Comprehensive API reference for AVFoundation audio covering AVAudioSession, AVAudioEngine, bit-perfect USB DAC output, and iOS 26+ spatial audio features.

## Overview

Complete guide to AVFoundation audio based on WWDC 2025 sessions 251 and 403, covering input device selection, AirPods high-quality recording, spatial audio capture with ASAF/APAC formats, and Audio Mix integration with the Cinematic framework.

## What This Reference Covers

### AVAudioSession
- Categories (playback, record, playAndRecord)
- Modes (default, voiceChat, videoRecording)
- Options (mixWithOthers, allowBluetooth, bluetoothHighQualityRecording)
- Route management and interruption handling

### AVAudioEngine
- Node connections and pipelines
- Input/output taps for processing
- Format conversion and sample rates
- Real-time audio processing

### Bit-Perfect Output (USB DAC)
- iOS automatic passthrough behavior
- Sample rate matching
- Format negotiation
- Hardware-native playback

### iOS 26+ Features
- AVInputPickerInteraction for in-app input selection
- AirPods high-quality recording mode
- Spatial audio capture (First Order Ambisonics)
- ASAF (Apple Spatial Audio Format)
- APAC (Apple Positional Audio Codec)
- Audio Mix with Cinematic framework

## When to Use This Reference

Use this reference when:
- Configuring audio session categories and modes
- Building AVAudioEngine processing pipelines
- Implementing USB DAC bit-perfect output
- Adding iOS 26+ input selection UI
- Recording spatial audio with AirPods
- Implementing Audio Mix effect control

## Key Patterns

### AVAudioSession Categories

```swift
let session = AVAudioSession.sharedInstance()

// Playback only (silences other apps)
try session.setCategory(.playback)

// Recording only
try session.setCategory(.record)

// Simultaneous play and record
try session.setCategory(.playAndRecord, options: [.defaultToSpeaker])

// Mix with other apps (background music)
try session.setCategory(.playback, options: [.mixWithOthers])
```

### iOS 26+ Input Selection

```swift
import AVKit

let picker = AVInputPickerInteraction()
picker.delegate = self
myButton.addInteraction(picker)

// In button action:
picker.present()
```

### AirPods High-Quality Recording

```swift
try AVAudioSession.sharedInstance().setCategory(
    .playAndRecord,
    options: [.bluetoothHighQualityRecording, .allowBluetoothA2DP]
)
```

### Spatial Audio Capture

```swift
// Configure AVCaptureDeviceInput for spatial audio
deviceInput.multichannelAudioMode = .firstOrderAmbisonics

// Or configure AVCaptureSession directly
captureSession.supportsMultichannelAudioRecording = true
```

### Audio Mix with Cinematic Framework

```swift
import Cinematic

let audioInfo = CNAssetSpatialAudioInfo(asset: asset)
audioInfo.effectIntensity = 0.7  // 0-1
audioInfo.renderingStyle = .cinematic  // or .studio, .inFrame

let audioMix = try audioInfo.audioMix()
playerItem.audioMix = audioMix
```

## Complete Coverage

This reference includes:
- All AVAudioSession categories, modes, and options
- AVAudioEngine node types and connections
- iOS 26+ input picker implementation
- AirPods high-quality recording setup
- Spatial audio formats (FOA, ASAF, APAC)
- Audio Mix parameter control
- Bit-perfect USB DAC configuration
- Common anti-patterns and prevention

## Anti-Patterns

### Using Default Category
```swift
// ❌ Default category may not suit your needs
let session = AVAudioSession.sharedInstance()
// Missing category configuration
```

### Ignoring Interruptions
```swift
// ❌ Not handling phone calls, alarms, Siri
// Your audio stops without graceful handling
```

### Blocking Main Thread
```swift
// ❌ Processing audio on main thread
audioEngine.inputNode.installTap(...) { buffer, time in
    self.heavyProcessing(buffer)  // Blocks UI
}
```

## Related Resources

- [networking](/skills/integration/networking) — Network.framework for streaming
- [WWDC 2025/251](https://developer.apple.com/videos/play/wwdc2025/251/) — Enhance audio capabilities
- [WWDC 2025/403](https://developer.apple.com/videos/play/wwdc2025/403/) — Apple Immersive Video and Spatial Audio

## Documentation Scope

This is a **reference skill** — comprehensive API guide without mandatory workflows.

#### Reference includes
- Complete AVFoundation audio API documentation
- iOS 26+ spatial audio features
- Bit-perfect DAC output patterns
- WWDC 2025 code examples
- Anti-pattern prevention

**Vs Diagnostic**: Reference skills provide information. Diagnostic skills enforce workflows and handle pressure scenarios.
