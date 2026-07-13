
# System Media Routing — Casting Beyond AirPlay `iOS27`

`import AVSystemRouting` — a new framework (`iOS27`, iOS only — not macCatalyst/visionOS/macOS/tvOS/watchOS) that lets a media app route playback to **non-AirPlay system routes**: third-party casting targets such as **Google Cast / Chromecast, DLNA, and other streaming standards**, surfaced in the same system route picker / Control Center as AirPlay.

Historically iOS exposed only **one** native streaming protocol (AirPlay); supporting Chromecast etc. meant bundling each vendor's SDK and your own cast button. AVSystemRouting replaces that with **one Apple API**: the protocol is supplied by a system **route provider**, and your app drives playback through a uniform interface.

> **Availability is narrow and in flux.** This capability is reported to be driven by the EU Digital Markets Act, so it is **likely region-gated (EU)** and is **beta** as of the Xcode 27 betas. Treat third-party routes as *may or may not be present*: always `#available`-gate, and keep your existing AirPlay / in-app cast path as the fallback. Confirm regional + provider availability before relying on it.

## When to Use

- Your video/music app wants to cast to **non-AirPlay** devices (Chromecast, DLNA, etc.) without bundling a per-vendor cast SDK
- You want playback to follow a route the user selected from the **system** picker / Control Center, and to control or observe that remote playback

For AirPlay specifically, the existing route-picker (`AVRoutePickerView`) + `AVPlayer` path still applies — AVSystemRouting is the **add** for third-party protocols.

## Two sides — you almost certainly want the consumer side

| Side | Who | What they build |
|------|-----|-----------------|
| **Consumer** (this skill) | Any media app | Adopt `AVSystemRouting` to play to whatever routes exist |
| **Provider** | A casting-protocol vendor (Google, DLNA stack, …) | A system **route-provider extension** that implements the wire protocol and registers the route. Niche; out of scope here. `AVSystemRouteController.supportedExtensionAvailable` reports whether such a provider is installed. |

The consumer app builds **no extension** — it adopts the API below.

## Adoption is explicit

Per Apple's docs, playback is **not** auto-routed — you observe route events and, when the user activates a route, attach a session to that route, start it, and drive playback:

```swift
import AVSystemRouting

@available(iOS 27, *)
final class RouteCoordinator: AVSystemRouteControllerObserver {
    private var media: AVSystemRouteMediaSession?

    func startObserving() {
        // supportedExtensionAvailable is a TYPE property (not on the instance).
        guard AVSystemRouteController.supportedExtensionAvailable else { return }
        _ = AVSystemRouteController.shared.addObserver(self)
    }

    // Return true to accept handling the event.
    func systemRouteController(
        _ controller: AVSystemRouteController,
        handle event: AVSystemRouteEvent
    ) async -> Bool {
        switch event.reason {
        case .activate:
            let route = event.route                 // protocolType: UTType, routeDisplayName, routeSymbolName
            let session = AVSystemRouteSession(url: contentURL, mode: .player)
            guard route.addSession(session) else {  // attach the session to the activated route (Bool = accepted)
                return false
            }
            do {
                media = try await session.start()   // -> AVSystemRouteMediaSession
                return true
            } catch let error as AVSystemRoutingError where error.code == .connectionFailed {
                report(error)                        // .connectionFailed is AVSystemRoutingError.Code, via error.code
                return false
            } catch {
                return false
            }
        case .deactivate:
            media = nil
            return true
        @unknown default:
            return false
        }
    }
}
```

`addObserver(_:)` returns a `Bool` (whether the observer was registered). Call `AVSystemRouteController.shared.removeObserver(_:)` to stop.

## LaunchMode — `.player` vs `.application`

`AVSystemRouteSession(url:mode:)` takes a `AVSystemRoute.LaunchMode`:

| Mode | Use when | Intended control surface (per Apple's docs) |
|------|----------|---------------------------------------------|
| `.player` | Standard URL-based playback — hand the content URL to the **system media player** on the remote device | `AVSystemRouteMediaSession.playbackControl` |
| `.application` | The remote device runs a **dedicated companion app**; you need a custom wire protocol | `AVSystemRouteMediaSession.dataChannel` (bidirectional `Data`) |

Both `playbackControl` and `dataChannel` exist on every `AVSystemRouteMediaSession` regardless of mode (both are optional); the pairing above is the intended usage, not enforced by the type.

```swift
@available(iOS 27, *)
@MainActor                                          // REQUIRED: the controllable is @MainActor-isolated
func controlPlayback(_ media: AVSystemRouteMediaSession) async throws {
    // .player mode: a system-provided controller for position / rate / volume + state observation.
    if let control = media.playbackControl {        // (any AVKit.AVPlaybackUserInterfaceControllable)?
        control.isPlaying = true                    // settable — "play"
        control.volume = 0.6                        // 0.0...1.0
        control.seek(to: .init(seconds: 30, preferredTimescale: 600), tolerance: .zero)
    }
    // .application mode: exchange raw protocol bytes with the companion app.
    if let channel = media.dataChannel {
        channel.dataDelegate = self                 // AVSystemRouteDataDelegate.receive(_:) async throws
        try await channel.send(Data(/* protocol frame */))
    }
}
```

Drop the `@MainActor` and Swift 6 rejects every write: *"main actor-isolated property `isPlaying` can not be mutated from a nonisolated context."* `AVPlaybackUserInterfaceControllable` and all five protocols it composes are `@MainActor`.

Use the `dataChannel` for the `.application` companion-app model. Note there are two data channels: the route exposes a non-optional `AVSystemRoute.routeDataChannel`, while the started media session exposes the optional `AVSystemRouteMediaSession.dataChannel` used above.

> **Do not use `AVInterfaceControllable` — it was renamed mid-beta.** Apple shipped an `AVInterface*` family
> in an early 27 beta and deprecated all 15 symbols in the same release (`introduced: 27.0, deprecated: 27.0`).
> `playbackControl` is typed `(any AVKit.AVPlaybackUserInterfaceControllable)?`, and the old and new protocols
> are **unrelated types** — so the old name is a **hard type error**, not a deprecation warning:
> `error: cannot assign value of type '(any AVPlaybackUserInterfaceControllable)?' to type '(any AVInterfaceControllable)?'`.

## Does not build for the simulator

`AVSystemRouting.framework` **is absent from the iPhoneSimulator SDK** — not gated, *absent*. The umbrella
header guards on `!TARGET_OS_SIMULATOR`. `#available(iOS 27, *)` does **not** save you, because this fails at
module resolution, not at runtime:

```
error: no such module 'AVSystemRouting'
```

Since the simulator is the default run destination, this is the first thing you hit. Guard the import:

```swift
#if canImport(AVSystemRouting)
import AVSystemRouting
#endif
```

## What `playbackControl` gives you

`AVPlaybackUserInterfaceControllable` (`@MainActor`) composes five protocols, and all five inherit
`Observation.Observable` — so the object drives SwiftUI updates directly, with no KVO glue.

**You receive a conformer; you never write one.** `media.playbackControl` is get-only, and the object is
vended by the system route provider. So most of this surface is **read**, and only a few members are yours
to set. Apple's header comments are written as obligations *on the provider* — do not mistake them for
instructions to you.

**You set** (this is your remote control): `isPlaying`, `playbackSpeed`, `scanSpeed`, `state`, `isMuted`,
`volume` (0.0–1.0), `currentAudioOption` / `currentAudioDescriptionOption` / `currentLegibleOption`, and the
`seek(to:tolerance:)` method.

**You read** (this is the remote device's truth): `isReady`, `isBuffering`, `supportedSeekCapabilities`,
`containsLiveStreamingContent`, `error`, `timeRange`, `playbackPosition`, `segments`, `currentSegment`,
`seekableTimeRanges`, `hasAudio`, `audioOptions` / `audioDescriptionOptions` / `legibleOptions`, and
`metadata`.

`state` is `.normal` / `.scanning` / `.scrubbing`. `supportedSeekCapabilities` is an OptionSet:
`.scanForward` / `.scanBackward` / `.seek`. Segment types: `.primary`, `.advertisement`, `.bonus`,
`.credits`, `.intro`, `.recap`, `.trailer`, `.other`.

### Gotchas

| Gotcha | Why it bites |
|--------|--------------|
| `playbackPosition` is **get-only**, and `position` is not "now" | It bundles `position` + `hostTime` + `rate` as one snapshot (an ObjC class, so a reference — not a value type). To show a live time, **extrapolate** from `position` using `rate` and the elapsed mach host time since `hostTime`. Reading `position` as the current time makes your scrubber lag. The old `AVInterface` protocol had a settable `currentPlaybackPosition: CMTime`; this replaced it. |
| `isPlaying` is **intent, not state** | It stays `true` while `isBuffering` is `true` — it means "resume automatically when data arrives". Do not treat a stall as a pause. |
| `isReady` is one-way *by contract* | Apple: it "should transition from NO to YES … and **should not** revert". A mid-playback stall shows up as `isBuffering`, not `isReady == false`. It's a provider contract, not an invariant — a defensive consumer should not assume a third-party provider honors it. |
| Read `seekableTimeRanges` to gate your own scrubber | `requiresLinearPlayback` on a segment is an **indicator** ("must be played sequentially"), not a switch that blocks anything — and it's read-only. The real gate is `seekableTimeRanges`, which per Apple "**typically** excludes segments where `requiresLinearPlayback` is YES". Disable your seek UI from that; do not expect the API to enforce ad-skipping for you. |
| Live vs DVR is something you **detect**, not set | `timeRange` is read-only. Live **without** DVR = a zero-duration `timeRange` at the live edge with `seekableTimeRanges` nil/empty. Live **with** DVR = a rolling window plus explicit `seekableTimeRanges`. Pair with `containsLiveStreamingContent`. |
| `segments` "should" be contiguous — not "must" | Apple's word is *should* (contiguous, covering the timeline, no gaps or overlaps). A third-party provider may not comply, so don't index into `segments` assuming full coverage. |
| `AVPlaybackUserInterfaceVideoProviding` and `…ThumbnailControllable` are **unusable** | They appear in the AVKit Swift interface but are `@available(iOS, unavailable)` on **every** platform. Same for `AVExperienceController`, `AVMultiviewManager`, `AVContentSelectionViewController`. Do not adopt them. |
| In Swift, metadata is the **struct** | `AVPlaybackUserInterfaceContentMetadataTemplate` is `NS_REFINED_FOR_SWIFT` — Swift sees only `AVPlaybackUserInterfaceContentMetadata` (memberwise init). Note `metadata` itself is **read-only** on the controllable. |

## Gate on availability + keep a fallback

```swift
if #available(iOS 27, *), AVSystemRouteController.supportedExtensionAvailable {
    coordinator.startObserving()
} else {
    // your existing AirPlay route-picker / in-app cast path
}
```

`supportedExtensionAvailable` being `false` (no provider installed, or region without third-party routing) is the common case today — design for it.

## Resources

**Docs**: /avsystemrouting, /avsystemrouting/routing-media-to-third-party-devices

**Skills**: now-playing, now-playing-carplay, avfoundation-ref
