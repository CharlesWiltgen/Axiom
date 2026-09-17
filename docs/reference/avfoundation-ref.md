---
name: avfoundation-ref
description: AVFoundation audio APIs — AVAudioSession categories/modes, iOS 27 async activation and deactivation notifications, AVAudioEngine pipelines and iOS 27 throwing engine APIs, bit-perfect DAC output, iOS 26+ spatial audio capture, ASAF/APAC, Audio Mix
---

# AVFoundation Audio Reference

API reference for AVFoundation audio — AVAudioSession, AVAudioEngine, bit-perfect USB DAC output, iOS 26+ spatial audio, and the iOS 27 async session and throwing engine APIs. It's for developers building playback, recording, or audio-processing features who need exact API names and platform availability.

## When to Use This Reference

Use this reference when:
- Configuring audio session categories, modes, and options
- Handling interruptions and route changes, or moving to the iOS 27 deactivation and resumption notifications
- Building AVAudioEngine processing pipelines, taps, and format conversion
- Fixing iOS 27 deprecation warnings on `connect`, `play()`, or `installTap`
- Implementing USB DAC bit-perfect output
- Adding iOS 26+ input selection UI or AirPods high-quality recording
- Recording spatial audio or controlling Audio Mix

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "Which audio session category should a podcast player use?"
- "How do I activate my audio session without blocking the main thread on iOS 27?"
- "My interruption handler warns that `InterruptionType` is deprecated — what replaces it?"
- "How do I tell whether the system or my app deactivated the audio session?"
- "`AVAudioEngine.connect` is deprecated in iOS 27 — what do I use instead?"
- "How do I read samples from the read-only buffer that `installAudioTap` delivers?"
- "Can I write a realtime-safe `AVAudioSourceNode` render block in Swift?"
- "How do I let users pick a microphone with `AVInputPickerInteraction`?"
- "How do I record spatial audio with First Order Ambisonics?"

## What's Covered

### AVAudioSession
- Categories (`.ambient`, `.soloAmbient`, `.playback`, `.record`, `.playAndRecord`, `.multiRoute`) and modes
- Options (`.mixWithOthers`, `.duckOthers`, `.allowBluetoothHFP`, `.allowBluetoothA2DP`, `.bluetoothHighQualityRecording`, `.defaultToSpeaker`)
- Interruption and route-change handling

### Async activation and deactivation (iOS 27, not macOS)
- `activate(options:)`, `deactivate(options:)`, `AVAudioSessionDeactivationOptions.notifyOthersOnDeactivation`
- `didBecomeActiveNotification`, `didBecomeInactiveNotification`, `resumptionRecommendationNotification`
- `DeactivationContext`, `InterruptionContext`, `ResumptionContext`
- Typed messages — `DidBecomeInactiveMessage` (`DeactivationResult`), `ResumptionRecommendationMessage`
- Deprecated `InterruptionType` / `InterruptionOptions`
- `AVAudioSession.Port.mediaDeviceExtension` (iOS only)

### AVAudioEngine
- Node types, connections, and pipelines
- Input taps and format conversion (`AVAudioConverter`)

### Throwing engine and node APIs (iOS 27)
- `connectNode(_:to:format:)` and bus/connection-point variants, `playAudio()`, `playAudio(at:)`
- `installAudioTap(onBus:bufferSize:format:tapProvider:)`, `AVReadOnlyAudioPCMBuffer`, `channelData(_:)`
- `connectMIDI(_:to:format:eventListProvider:)`, `AVMIDIEventListBlock`
- `AVAudioFormat.init(formatDescription:)`
- Realtime-safe render and receiver blocks (Objective-C and C only)
- `AVAudioUnitReverbPreset.outdoorGeneral`

### Bit-perfect output (USB DAC)
- Hardware-rate rendering, asking for the source rate with `setPreferredSampleRate(_:)`, USB DAC routing

### iOS 26+ features
- `AVInputPickerInteraction`
- AirPods high-quality recording
- Spatial audio capture (First Order Ambisonics), ASAF, APAC
- Audio Mix with the Cinematic framework (`CNAssetSpatialAudioInfo`)

## Documentation Scope

This page documents the `avfoundation-ref` skill in the `axiom-media` suite. It is a **reference skill** — a comprehensive API guide without mandatory workflows. The skill file holds the code examples and anti-patterns Claude uses when answering.

- For AVFoundation **video** writing, export, and rendering, see [AVFoundation Video](/reference/avfoundation-video-ref)
- For camera and microphone capture sessions, see [Camera Capture](/reference/camera-capture-ref)

## Related

- [AVFoundation Video](/reference/avfoundation-video-ref) – The video write/export/render counterpart to this audio reference
- [Camera Capture](/reference/camera-capture-ref) – `AVCaptureSession` setup, which also configures the audio session for spatial and AirPods recording
- [Now Playing](/skills/integration/now-playing) – Lock Screen and Control Center metadata for background audio playback
- [Screen Capture](/skills/integration/screen-capture) – ScreenCaptureKit recording, which writes the `AVFileType` and codec types covered here
- [networking](/skills/integration/networking) – Network.framework for streaming audio

## Resources

**WWDC**: 2025-251, 2025-403, 2019-510

**Docs**: /avfoundation, /avfaudio/avaudiosession, /avfaudio/avaudioengine, /avkit, /cinematic
