
# Local Push Connectivity — Push Without APNs (NEAppPushProvider)

Local Push Connectivity (LPC) delivers call, Push to Talk, and message notifications on networks where APNs is unreachable — cruise ships, hospitals, hotels, industrial sites with firewalled or offline Wi-Fi. A NetworkExtension app extension (`NEAppPushProvider`) keeps a persistent connection to your local server and reports incoming calls/messages to your app; the system runs the extension whenever the device is on a network you declared, even when your app isn't running. No macOS, watchOS, or tvOS; restricted entitlement.

## Core mental model

Two halves with a strict split:

1. **`NEAppPushManager` (containing app)** — declares *where* the provider runs (Wi-Fi SSIDs, private LTE networks, Ethernet, MCX cellular slice) and receives incoming-call reports via `NEAppPushDelegate`.
2. **`NEAppPushProvider` (app extension)** — maintains the server connection and reports incoming calls / PTT messages. The **system** starts and stops it based on network match, not your app's lifecycle.

LPC complements APNs, it never replaces it. Ship both; your server picks the channel by which connection is active.

## When to Use This Skill

- Receiving VoIP calls or messages on a network with no internet/APNs reachability
- Push to Talk over a 3GPP Mission Critical Services (MCX) cellular slice `iOS27`
- Wired deployments — Ethernet-docked iPads/iPhones (iOS 26)
- Deciding between APNs and a persistent local connection for a managed-network app

NOT for ordinary push — that's `skills/push-notifications.md`. Apple grants the LPC entitlement only for environments where APNs cannot reach the device; "I want lower latency than APNs" gets rejected. For the in-provider connection itself (NWConnection/NetworkConnection), see axiom-networking. For reporting the incoming call, see `skills/callkit-livecommunicationkit.md`.

## Availability

| Capability | Minimum |
|------------|---------|
| `matchSSIDs` (Wi-Fi), `reportIncomingCall`, `NEAppPushDelegate` | iOS 14 |
| `matchPrivateLTENetworks` (`NEPrivateLTENetwork`), `start()` override | iOS 15 |
| `reportPushToTalkMessage(userInfo:)` (PushToTalk framework hand-off, not Catalyst) | iOS 16.4 |
| `matchEthernet` + `unmatchEthernet()` | iOS 26 |
| `matchMissionCriticalService` (MCX cellular slice) | iOS 27 |

No macOS, watchOS, or tvOS — the whole API is `API_UNAVAILABLE(macos, watchos, tvos)`. The base API carries to visionOS, but Ethernet and MCX matching are unavailable there. Apple's Local Push Connectivity overview article still describes the feature as Wi-Fi-only — the prose lags the SDK; the headers above are authoritative.

## Entitlements

- `com.apple.developer.networking.networkextension` with value `app-push-provider`, on **both** the app and extension targets. Restricted — request at developer.apple.com/contact/request/local-push-connectivity with the concrete no-APNs deployment story.
- MCX additionally requires `com.apple.developer.networking.slicing.appcategory` with value `mc-9500` `iOS27`.

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| Expecting the provider to start with your app | The system starts it on network match, independent of app lifecycle | Configure the manager, save preferences, and let the system drive; test by joining the network |
| Incoming call reported but nothing happens | `NEAppPushDelegate` isn't set, set too late, or deallocated (`delegate` is weak) | Load managers, set delegates, and hold a strong reference to the delegate immediately at app launch — calls arrive while the app is backgrounded |
| Provider killed for running its own heartbeat timers | The provider has a constrained runtime | Override `handleTimerEvent()` — the system calls it every 60 seconds; use it for keepalives |
| A saved configuration silently flips `isEnabled` to false | Saving another configuration that overlaps (same SSID etc.) disables the earlier one | One manager per distinct network set; check `isEnabled` after `loadAllFromPreferences` |
| Ethernet matching floods the provider on unusable networks | Unlike `matchSSIDs`, `matchEthernet` is a bool with no allowlist — every Ethernet network matches | Probe your server from the provider; call `unmatchEthernet()` to stop on networks where it can't operate |
| Overriding `startWithCompletionHandler` | Deprecated with replacement | Override `start()` (iOS 15+) |
| Non-band-48 private LTE never matches | Those networks require a supervised device | Band 48 works unsupervised; otherwise deploy via MDM supervision |
| SSID list silently capped | `matchSSIDs` and `matchPrivateLTENetworks` each cap at 10 entries | Consolidate networks or ship per-site configuration |

## Part 1 — App side: configure the manager

```swift
import NetworkExtension

let manager = NEAppPushManager()
manager.localizedDescription = "SimplePush"
manager.providerBundleIdentifier = "com.example.app.PushProvider"
manager.delegate = pushDelegate                     // weak — hold pushDelegate strongly elsewhere
manager.matchSSIDs = ["Ship-Crew-WiFi"]             // max 10
manager.providerConfiguration = ["host": "10.0.1.5"] // plist types only, passed to the provider
manager.isEnabled = true
try await manager.saveToPreferences()
```

Receive incoming calls in the containing app and hand them straight to CallKit:

```swift
final class PushDelegate: NSObject, NEAppPushDelegate {
    func appPushManager(_ manager: NEAppPushManager,
                        didReceiveIncomingCallWithUserInfo userInfo: [AnyHashable: Any]) {
        // Report to CallKit immediately — same urgency as a VoIP push
    }
}
```

At launch, reload persisted managers with `NEAppPushManager.loadAllFromPreferences { managers, error in ... }` and re-attach delegates. `isActive` (KVO-observable) tells you the provider is currently running — useful for the server-side APNs/LPC channel switch.

## Part 2 — Extension side: the provider

```swift
import NetworkExtension

final class PushProvider: NEAppPushProvider {
    override func start() {
        // Connect to the local server (NWConnection / NetworkConnection).
        // Host/port come from providerConfiguration.
    }

    override func stop(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        // Tear down the connection.
        completionHandler()
    }

    override func handleTimerEvent() {
        // Called every 60 s — send keepalive, check connection health.
    }

    func didReceiveCallMessage(_ payload: [AnyHashable: Any]) {
        reportIncomingCall(userInfo: payload)   // delivered to NEAppPushDelegate in the app
    }
}
```

For Push to Talk apps, call `reportPushToTalkMessage(userInfo:)` (iOS 16.4+) instead — the system delivers it to the containing app's `PTChannelManagerDelegate` if the user has joined a PTT channel.

## Part 3 — Ethernet (iOS 26)

```swift
if #available(iOS 26, *) {
    manager.matchEthernet = true   // provider runs when Ethernet is the primary route
}
```

There is no Ethernet allowlist, so the provider must verify the network actually hosts your server:

```swift
// In the provider, after a failed probe of the local server:
unmatchEthernet()   // stops the provider on THIS network; re-evaluated on network change
```

## Part 4 — Mission Critical Services `iOS27`

`matchMissionCriticalService` runs the provider over an MCX (3GPP Mission Critical Services) 5G network slice — LPC's first carrier-cellular transport (private LTE has been matchable since iOS 15, but only on-premises networks). Built for public-safety Push to Talk apps that must meet MCX latency standards.

```swift
if #available(iOS 27, *) {
    manager.matchMissionCriticalService = true
}
try await manager.saveToPreferences()
```

The system starts the provider only when **all** hold:

1. The app has the LPC entitlement (`app-push-provider`) **and** the slicing app-category entitlement `com.apple.developer.networking.slicing.appcategory` = `mc-9500`.
2. The device's cellular plan supports Mission Critical Services.

The extension then connects to your backend over the MCX slice and delivers incoming PTT traffic via `reportPushToTalkMessage(userInfo:)`. Pre-27 fallback: LPC has no carrier-cellular transport — use APNs Push to Talk pushes when off Wi-Fi/private LTE.

## Common Mistakes

- Requesting the entitlement for a general-purpose app (Apple grants it for APNs-unreachable environments only).
- Setting the delegate lazily (the system can launch the app in the background for an incoming call; a late or deallocated delegate misses the report).
- Skipping the APNs path entirely — devices off the managed network receive nothing.
- Running connection retry loops on custom timers instead of `handleTimerEvent()`.
- Assuming `matchEthernet`/`matchMissionCriticalService` exist on visionOS (both unavailable there).
- Treating an `NEAppPushManagerError` (`.configurationInvalid`, `.configurationNotLoaded`, `.inactiveSession`) as fatal instead of reloading preferences.

## Resources

**WWDC**: 2020-10113

**Docs**: /networkextension/local-push-connectivity, /networkextension/neapppushmanager, /networkextension/neapppushprovider, /networkextension/neapppushdelegate, /networkextension/neprivateltenetwork, /pushtotalk

**Skills**: skills/push-notifications.md (APNs path), skills/callkit-livecommunicationkit.md (reporting calls, PTT), axiom-networking (provider connection), axiom-security (entitlements, code signing)
