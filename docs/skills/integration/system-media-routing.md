---
name: system-media-routing
description: Cast/route media to non-AirPlay system routes (Google Cast, DLNA) with the iOS 27 AVSystemRouting framework
skill_type: reference
apple_platforms: iOS 27+
---

# System Media Routing (Casting Beyond AirPlay)

`import AVSystemRouting` is a new iOS 27 framework (iOS only — no macOS/visionOS/tvOS/watchOS/Mac Catalyst) that lets a media app route playback to **non-AirPlay system routes** — third-party casting targets such as Google Cast / Chromecast and DLNA — surfaced in the same system route picker and Control Center as AirPlay. Instead of bundling a per-vendor cast SDK, your app adopts one Apple API and drives playback through a uniform interface.

::: warning Availability is narrow and in flux
Reportedly driven by the EU Digital Markets Act, this capability is **likely region-gated (EU)** and **beta** in the Xcode 27 betas. Treat third-party routes as *may or may not be present*: always `#available`-gate and keep your existing AirPlay / in-app cast path as the fallback.
:::

## When to Use

Use this skill when you're:
- Casting to non-AirPlay devices (Chromecast, DLNA, …) without bundling each vendor's cast SDK
- Making playback follow a route the user picked from the system picker / Control Center, and controlling or observing that remote playback

For AirPlay specifically, the existing `AVRoutePickerView` + `AVPlayer` path still applies — AVSystemRouting is the addition for third-party protocols.

## Example Prompts

- "How do I cast to Chromecast on iOS 27 without the Google Cast SDK?"
- "Support non-AirPlay casting / DLNA as a system route."
- "Respond when the user picks a third-party media route and control playback."
- "What's the difference between AVSystemRouteSession `.player` and `.application` modes?"
- "Why does 'no such module AVSystemRouting' happen when I build for the simulator?"
- "Why is `supportedExtensionAvailable` always false?"
- "How do I stop users seeking through an ad on a cast route?"

## What This Skill Provides

- **Explicit adoption model** – observe `AVSystemRouteController` events, and on an *activate* event start an `AVSystemRouteSession` on the route (playback is **not** auto-routed)
- **`LaunchMode` guidance** – `.player` (hand a URL to the system media player on the device) vs `.application` (companion app + bidirectional `dataChannel`)
- **`playbackControl` vs `dataChannel`** – AVKit's `AVPlaybackUserInterfaceControllable` for standard playback control/observation, or raw `Data` exchange for custom protocols. (Do **not** use `AVInterfaceControllable`: Apple shipped and deprecated it in the same release, and it is a different, incompatible type.)
- **What `playbackControl` actually gives you** – which members you set (`isPlaying`, `volume`, `state`, `seek(to:tolerance:)`) versus read (`isReady`, `isBuffering`, `segments`, `seekableTimeRanges`), that it is `@MainActor`-isolated, and that it is `Observable` — so it drives SwiftUI with no KVO glue
- **Info.plist prerequisites** – `MDESupportsUniversalURLPlayback` / `MDESupportedProtocols`. Without them `supportedExtensionAvailable` is always `false`, even with a provider installed — the most common reason "nothing appears"
- **The simulator wall** – `AVSystemRouting` is **absent** from the iPhoneSimulator SDK, so you get `no such module` and `#available` cannot help. Covers the `canImport` guard and the device-only CI lane
- **Ad-gating the scrubber** – `requiresLinearPlayback` enforces nothing; the real gate is `seekableTimeRanges` (where `nil` and `[]` mean **opposite** things)
- **Consumer vs provider** – your app is the consumer (no extension); a casting-protocol vendor ships the route-provider extension. `AVSystemRouteController.supportedExtensionAvailable` reports whether one is installed
- **Availability gating** – `#available(iOS 27, *)` plus a `supportedExtensionAvailable` check, with an AirPlay fallback

## Related

- [Now Playing](/skills/integration/now-playing) – Lock Screen / Control Center metadata and remote commands for the content you route
- [avfoundation-ref](/reference/avfoundation-ref) – the `AVPlayer` / AirPlay path AVSystemRouting complements
