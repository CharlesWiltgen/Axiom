
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
func controlPlayback(_ media: AVSystemRouteMediaSession) async throws {
    // .player mode: a system-provided controller for position / rate / volume + state observation.
    if let control = media.playbackControl {        // (any AVKit.AVInterfaceControllable)?
        _ = control
    }
    // .application mode: exchange raw protocol bytes with the companion app.
    if let channel = media.dataChannel {
        channel.dataDelegate = self                 // AVSystemRouteDataDelegate.receive(_:) async throws
        try await channel.send(Data(/* protocol frame */))
    }
}
```

`playbackControl` is AVKit's `AVInterfaceControllable` — read/write playback state and observe the remote device. Use the `dataChannel` for the `.application` companion-app model. Note there are two data channels: the route exposes a non-optional `AVSystemRoute.routeDataChannel`, while the started media session exposes the optional `AVSystemRouteMediaSession.dataChannel` used above.

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
