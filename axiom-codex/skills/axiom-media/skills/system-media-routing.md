
# System Media Routing — Casting Beyond AirPlay `iOS27`

`import AVSystemRouting` — a new framework, iOS only (not macCatalyst/visionOS/macOS/tvOS/watchOS), that lets a media app route playback to **non-AirPlay system routes**: third-party casting targets such as **Google Cast / Chromecast, DLNA, and other streaming standards**, surfaced in the same system route picker / Control Center as AirPlay.

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

Both are declared `nullable`, so both need unwrapping — but the pairing above is not merely conventional: **in `.player` mode `dataChannel` is `nil`** (per the `start()` doc). Note Apple's headers contradict themselves here — each property's own doc comment claims it is "always non-nil when obtained from a successful call to `start()`", while `start()` says otherwise for `.player`. Unwrap both and don't rely on either promise.

`dataDelegate` is `weak`, so the delegate must be a type you retain — hence a method on a conforming class, not a free function:

```swift
@available(iOS 27, *)
@MainActor                                          // REQUIRED: the controllable is @MainActor-isolated
final class PlaybackDriver: NSObject, AVSystemRouteDataDelegate {
    func receive(_ data: Data) async throws { /* companion-app protocol frame */ }

    func controlPlayback(_ media: AVSystemRouteMediaSession) async throws {
        // .player mode: a system-provided controller for position / rate / volume + state observation.
        if let control = media.playbackControl {     // (any AVKit.AVPlaybackUserInterfaceControllable)?
            control.isPlaying = true                 // settable — "play"
            control.volume = 0.6                     // 0.0...1.0
            control.seek(to: .init(seconds: 30, preferredTimescale: 600), tolerance: .zero)
        }
        // .application mode: exchange raw protocol bytes with the companion app.
        if let channel = media.dataChannel {
            channel.dataDelegate = self              // weak — `self` must be retained elsewhere
            try await channel.send(Data(/* protocol frame */))
        }
    }
}
```

Drop the `@MainActor` and Swift 6 rejects every write: *"main actor-isolated property `isPlaying` can not be mutated from a nonisolated context."* `AVPlaybackUserInterfaceControllable` and all five protocols it composes are `@MainActor`.

Use the `dataChannel` for the `.application` companion-app model. Note there are two data channels: the route exposes a non-optional `AVSystemRoute.routeDataChannel`, while the started media session exposes the optional `AVSystemRouteMediaSession.dataChannel` used above.

> **Do not use `AVInterfaceControllable` — it was renamed mid-beta.** Apple shipped an `AVInterface*` family
> in an early 27 beta and deprecated the whole family in the same release (15 born-deprecated clauses,
> `introduced: 27.0, deprecated: 27.0`). `playbackControl` is typed
> `(any AVKit.AVPlaybackUserInterfaceControllable)?`, and the old and new protocols are **unrelated types** —
> so the old name is a **hard type error**, not a deprecation warning:
> `error: cannot assign value of type '(any AVPlaybackUserInterfaceControllable)?' to type '(any AVInterfaceControllable)?'`.

## Info.plist — without it, nothing ever appears

`AVSystemRouteController.supportedExtensionAvailable` is gated on **your own Info.plist**, not just on what's
installed. Apple: *"If neither key is declared, or no installed extension matches the declared support, this
property is `NO`."* `addObserver` likewise only fires for routes whose extension matches what you declared.

| Key | Type | Pairs with |
|-----|------|-----------|
| `MDESupportsUniversalURLPlayback` | Bool | `.player` mode — hand a content URL to the remote system player |
| `MDESupportedProtocols` | Dict: protocol ID → the remote application's ID | `.application` mode — launch a companion app on the receiver |

**This is the first thing to check when nothing works.** A developer who omits these gets
`supportedExtensionAvailable == false` forever — even on a device with a provider installed — and will
otherwise conclude they are region-gated.

## Does not build for the simulator

`AVSystemRouting.framework` **is absent from the iPhoneSimulator SDK** — not gated, *absent*. The umbrella
header guards on `!TARGET_OS_SIMULATOR`. `#available(iOS 27, *)` does **not** save you, because this fails at
module resolution, not at runtime:

```
error: no such module 'AVSystemRouting'
```

Since the simulator is the default run destination, this is the first thing you hit. Guarding only the
`import` is not enough — every AVSystemRouting-typed declaration must sit inside the same `#if`, or the
simulator build fails with `cannot find 'AVSystemRouteController' in scope`. Isolate the whole feature in
one file:

```swift
#if canImport(AVSystemRouting)
import AVSystemRouting

// ...every AVSystemRouting-typed declaration lives in here too, not just the import.
#endif
```

Your CI needs a **device** lane for this feature; a simulator-only lane cannot compile it.

## What `playbackControl` gives you

`AVPlaybackUserInterfaceControllable` (`@MainActor`) composes five protocols, and all five inherit
`Observation.Observable` — so state changes drive SwiftUI directly, with no KVO glue. **But not the
position readout:** Observation republishes `playbackPosition` only when the provider pushes a new
*snapshot* (play, pause, seek, scan, buffering) — never per frame. A smooth clock needs
`TimelineView(.animation)` plus the extrapolation below. Observation alone gives you a readout that
freezes between events.

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
| `playbackPosition` is **get-only**, and `position` is not "now" | It bundles `position` + `hostTime` + `rate` as one snapshot (an ObjC class, so a reference — not a value type). To show a live time, **extrapolate**: `position + rate × (now − hostTime)`. `hostTime` is a **`CMTime` on the CoreMedia host clock** — read "now" with `CMClockGetTime(CMClockGetHostTimeClock())`. Apple's doc comment says "mach host time", which misleads you toward `mach_absolute_time()` + `mach_timebase_info`; that is the wrong API family and a type mismatch. Reading `position` as the current time makes your scrubber lag. The old `AVInterface` protocol had a settable `currentPlaybackPosition: CMTime`; this replaced it. |
| `isPlaying` is **intent, not state** | Apple: it "**should** remain YES while `isBuffering` is YES" — it means "resume automatically when data arrives". Do not treat a stall as a pause. (A "should", so a third-party provider may not comply.) |
| A mistyped observer signature **silently never fires** | `AVSystemRouteControllerObserver` ships a **default implementation** of `systemRouteController(_:handle:)`. Get the signature subtly wrong and your type still conforms — no compiler error, and your handler is simply never called. A compile probe cannot catch this; check that events actually arrive. |
| `isReady` is one-way *by contract* | Apple: it "should transition from NO to YES … and **should not** revert". A mid-playback stall shows up as `isBuffering`, not `isReady == false`. It's a provider contract, not an invariant — a defensive consumer should not assume a third-party provider honors it. |
| `nil` and `[]` on `seekableTimeRanges` mean **opposite** things | Apple: "**If `nil`, the entire content defined by `timeRange` is considered seekable**" — but "**an empty array means the entire content … is *not* seekable**." Collapsing the two breaks you in both directions: `?? []` bricks the scrubber on unrestricted content, and `isEmpty ? everything : ranges` lets users scrub straight through ads. Treat `nil` as "all of `timeRange`", `[]` as "nothing". |
| Nothing enforces the ad gate for you, and "don't land in an ad" is **not** the requirement | `requiresLinearPlayback` is named like a switch but is a read-only **indicator**; it blocks nothing. `seekableTimeRanges` is the primary gate — but Apple only says it "**typically** excludes segments where `requiresLinearPlayback` is YES", so a provider may leave it `nil` (= *everything* seekable) while still marking ad segments. A correct gate needs **four** things: (1) `supportedSeekCapabilities.contains(.seek)` — the route may not seek at all; (2) membership in `seekableTimeRanges`; (3) subtract every `requiresLinearPlayback` segment; and (4) **reject a seek that *crosses* an unwatched linear segment, not merely one that lands in it.** (1)–(3) only stop the playhead *landing* inside an ad — a forward seek straight over it still skips the ad, which is the exact failure you were trying to prevent. Clamp such a seek to the start of the crossed segment instead, and keep your own watched-ad ledger, or the rule never releases. If ad-skip is a revenue requirement, test against the real receiver. |
| The segment API the gate needs | `segments` and `currentSegment` are `[AVPlaybackUserInterfaceTimelineSegment]` / `AVPlaybackUserInterfaceTimelineSegment`. Each carries `timeRange: CMTimeRange`, `segmentType` (`.advertisement`, `.intro`, …), `requiresLinearPlayback: Bool`, `isMarked: Bool`, `identifier: String?`. **`currentSegment` is NOT optional** — a `guard let` on it does not compile. There is no Apple API for `CMTimeRange` set-subtraction; you write it. |
| Live vs DVR is something you **detect**, not set | `timeRange` is read-only. Live **without** DVR = a zero-duration `timeRange` at the live edge. Live **with** DVR = a rolling window plus explicit `seekableTimeRanges`. Pair with `containsLiveStreamingContent`. |
| `state = .scrubbing` is not decorative | While the user drags the scrubber, set `control.state = .scrubbing` (and back to `.normal` on commit) so the remote device can distinguish a scrub from a seek. `playbackControl` is declared `nullable` so you must still unwrap it — but do not build a "provider vended no controls" fallback path on that: Apple says it is "always non-nil when obtained from a successful call to `start()`". |
| `segments` "should" be contiguous — not "must" | Apple's word is *should* (contiguous, covering the timeline, no gaps or overlaps). A third-party provider may not comply, so don't index into `segments` assuming full coverage. |
| `AVPlaybackUserInterfaceVideoProviding` and `…ThumbnailControllable` are **unusable** | They appear in the AVKit Swift interface but are `@available(iOS, unavailable)` on **every** platform. Same for `AVExperienceController`, `AVMultiviewManager`, `AVContentSelectionViewController`. Do not adopt them. |
| In Swift, metadata is a **new struct**, not the ObjC class | Both `…ContentMetadataTemplate` and the `…ContentMetadata` *class* are `NS_REFINED_FOR_SWIFT`; the overlay vends a fresh Swift struct `AVPlaybackUserInterfaceContentMetadata` (with a nested `VideoProperties`) and a memberwise init. Read-path trivia mostly — `metadata` is **read-only** on the controllable. |

## Gate on availability + keep a fallback

```swift
if #available(iOS 27, *), AVSystemRouteController.supportedExtensionAvailable {
    coordinator.startObserving()
} else {
    // your existing AirPlay route-picker / in-app cast path
}
```

`supportedExtensionAvailable` being `false` is the common case today — design for it. When it is `false`, check
these in order:

1. **Your Info.plist keys are missing** (see above). This is the most common cause and it is entirely on you.
2. No matching route-provider extension is installed — Apple does not implement Chromecast; the *vendor*
   ships the extension. Dropping a per-vendor cast SDK is contingent on that extension actually existing.
3. Region gating (reported EU/DMA-driven).

## Resources

**Docs**: /avsystemrouting, /avsystemrouting/routing-media-to-third-party-devices, /avkit/avplaybackuserinterfacecontrollable

**Skills**: now-playing, now-playing-carplay, avfoundation-ref
