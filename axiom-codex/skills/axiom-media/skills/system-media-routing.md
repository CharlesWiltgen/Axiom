
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
`Observation.Observable` — so state changes drive SwiftUI directly, with no KVO glue. **But do not build the
position readout on it:** Apple obliges the provider to republish `playbackPosition` on play, pause, seek,
scan, and buffering changes — that is a *minimum*, not a promise of per-frame updates, so a provider may
push nothing between events. A smooth clock needs `TimelineView(.animation)` plus the extrapolation below.

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
| `playbackPosition` is **get-only**, and `position` is not "now" | It bundles `position` + `hostTime` + `rate` as one snapshot. To show a live time, **extrapolate**: `position + rate × (now − hostTime)`, then clamp — `CMTimeClampToRange(extrapolated, range: control.timeRange)` — or the readout runs past the end once the snapshot goes stale. Read "now" with `CMClockGetTime(CMClockGetHostTimeClock())`. `hostTime` is a `CMTime` on that clock (nanosecond timescale), and **`CMTimeGetSeconds(hostTime)` lands on the same seconds base as `CACurrentMediaTime()` / `CADisplayLink.targetTimestamp`** — so correlate there, with no `mach_timebase_info` needed. (Apple's "mach host time" wording is *accurate*: per `CMSync.h` the host clock **uses** `mach_absolute_time`, just in a different timescale. Don't reach for `CMClockConvertHostTimeToSystemUnits` to correlate — it returns raw mach **ticks**, which is the one path that *does* need `mach_timebase_info`.) `rate` already folds in `playbackSpeed`/`scanSpeed` — **do not multiply by them again**. It is 0 when paused, negative on reverse scan; the formula handles both. Apple obliges the provider to republish the snapshot **with a fresh `hostTime`** on play/pause/seek/scan/buffering — a stale `hostTime` silently corrupts the readout. Suppress extrapolation entirely for live-without-DVR, where `timeRange` is zero-duration. |
| `isPlaying` is **intent, not state** | Apple: it "**should** remain YES while `isBuffering` is YES" — it means "resume automatically when data arrives". Do not treat a stall as a pause. (A "should", so a third-party provider may not comply.) |
| A mistyped observer signature **silently never fires** | `AVSystemRouteControllerObserver` ships a **default implementation** of `systemRouteController(_:handle:)`. Get the signature subtly wrong and your type still conforms — no compiler error, and your handler is simply never called. A compile probe cannot catch this; check that events actually arrive. |
| `isReady` is one-way *by contract* | Apple: it "should transition from NO to YES … and **should not** revert". A mid-playback stall shows up as `isBuffering`, not `isReady == false`. It's a provider contract, not an invariant — a defensive consumer should not assume a third-party provider honors it. |
| `nil` and `[]` on `seekableTimeRanges` mean **opposite** things — on VOD | Apple: "**If `nil`, the entire content … is considered seekable**"; "**an empty array means the entire content … is *not* seekable**." So `?? []` bricks the scrubber on unrestricted content, and `isEmpty ? everything : ranges` opens it on restricted content. **But not on live**: for live-without-DVR Apple says `seekableTimeRanges` "**must be nil or empty**" — there, the two *are* interchangeable. Branch on `containsLiveStreamingContent` before applying the VOD rule. |
| The segment API | `segments: [AVPlaybackUserInterfaceTimelineSegment]` (nonnull, but **may be empty**) and `currentSegment` (**NOT optional** — a `guard let` does not compile). Each carries `timeRange: CMTimeRange`, `segmentType` (`.advertisement`, `.intro`, …), `requiresLinearPlayback: Bool`, `isMarked: Bool`, `identifier: String?`. In Swift `seekableTimeRanges` is `[CMTimeRange]?` — **not** the header's `NSArray<NSValue *>`, so don't write `NSValue` unboxing. There is no CoreMedia `CMTimeRange` set-subtraction; you write it. |
| Equality is by **value**, and that cuts both ways | The class overrides `isEqual:` and `hash` with value equality over **all** its fields (runtime-verified on iOS 27; the header doesn't declare them because `NSObject` already does — never infer "not implemented" from an ObjC header). So `==`, `contains`, `Set` and `Dictionary` keys all work by value. **But**: `segments` may be `[]` while `currentSegment` is still non-nil, so `segments.contains(currentSegment)` can legitimately be `false`. And because equality spans *every* field, a provider that republishes a segment with `isMarked` or `requiresLinearPlayback` flipped produces a **non-equal** object — so a watched-ad ledger keyed on the whole segment silently misses and the ad replays. Key it on the stable projection (`timeRange`, or `timeRange` + `segmentType`), not on the segment and not on the nullable `identifier`. |
| Live vs DVR is something you **detect**, not set | `timeRange` is read-only. Live **without** DVR = a zero-duration `timeRange` at the live edge. Live **with** DVR = a rolling window plus explicit `seekableTimeRanges`. Pair with `containsLiveStreamingContent`. |
| `state = .scrubbing` is not decorative | While the user drags the scrubber, set `control.state = .scrubbing` (and back to `.normal` on commit) so the remote device can distinguish a scrub from a seek. `playbackControl` is declared `nullable` so you must still unwrap it — but do not build a "provider vended no controls" fallback path on that: Apple says it is "always non-nil when obtained from a successful call to `start()`". |
| `segments` "should" be contiguous — not "must" | Apple's word is *should* (contiguous, covering the timeline, no gaps or overlaps). A third-party provider may not comply, so don't index into `segments` assuming full coverage. |
| `AVPlaybackUserInterfaceVideoProviding` and `…ThumbnailControllable` are **unusable** | They appear in the AVKit Swift interface but are `@available(iOS, unavailable)` on **every** platform. Same for `AVExperienceController`, `AVMultiviewManager`, `AVContentSelectionViewController`. Do not adopt them. |
| In Swift, metadata is a **new struct**, not the ObjC class | Both `…ContentMetadataTemplate` and the `…ContentMetadata` *class* are `NS_REFINED_FOR_SWIFT`; the overlay vends a fresh Swift struct `AVPlaybackUserInterfaceContentMetadata` (with a nested `VideoProperties`) and a memberwise init. Read-path trivia mostly — `metadata` is **read-only** on the controllable. |

### Ad gating — do not let this skill write your enforcement

**AVKit enforces nothing here, and its data is advisory.** If ad-skip is a revenue requirement, your own ad
schedule (VAST / SSAI cue-outs / the manifest) is the source of truth. Treat the route's data as *additive*,
and **fail closed** when it is absent or contradictory — this is a third-party provider's data, not yours.

What the API gives you, and where each signal fails:

| Signal | What it does NOT do |
|--------|---------------------|
| `requiresLinearPlayback` | Read-only **indicator**. Blocks nothing. `segments` may be `[]`, so an ad can exist with no linear segment at all. |
| `seekableTimeRanges` | Apple only says it "**typically**" excludes linear segments. A lazy provider may leave it `nil` (= all seekable) while still marking ads — and an ad may instead be expressed only as a **hole** in these ranges, with no segment. |
| `supportedSeekCapabilities.contains(.seek)` | Gates `seek(to:tolerance:)` **only**. |

**The bypass a seek-only gate misses entirely:** `state`, `scanSpeed`, and `playbackSpeed` are all settable
and **never route through `seek(to:tolerance:)`**. `state = .scanning; scanSpeed = 30` crosses a 60-second ad
in two seconds. A route can advertise `.scanForward` **without** `.seek` — so a gate that "disables the
scrubber because the route can't seek" hands the user a fast-forward button straight through the ad break.
Real enforcement must also refuse scan and rate changes while inside a linear segment.

**Traps in the obvious implementations:** clamping a seek back to the start of the crossed segment **replays**
an ad the user was already part-way through; a direction-agnostic rule force-plays ads on a *rewind*; and
picking "the crossed segment" with `first(where:)` can clamp *past* an earlier ad — Apple never states that
`segments` is chronologically ordered (the chronological-order "should" is on `seekableTimeRanges`, not
`segments`), so sort it yourself.

None of that is a reason to skip the gate. It is a reason to build it from **your** ad schedule, use the
route's signals to enrich it, fail closed on missing data, and test against the real receiver.

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
