---
name: local-push-connectivity
description: Receive calls and messages on networks where APNs can't reach the device — restricted Wi-Fi, Ethernet, and Mission Critical 5G slices
skill_type: skill
version: 1.0
apple_platforms: iOS 14+, iPadOS 14+
---

# Local Push Connectivity

Local Push Connectivity delivers call, Push to Talk, and message notifications on networks where APNs is unreachable — cruise ships, hospitals, hotels, and industrial sites with firewalled or offline networks. A NetworkExtension provider keeps a persistent connection to your local server, and the system runs it whenever the device joins a network you declared, even when your app isn't running. iOS 26 extends it to Ethernet; iOS 27 adds carrier-cellular support via Mission Critical Services (MCX) 5G network slices.

Part of the **axiom-integration** suite (`skills/local-push-connectivity.md`).

## When to Use

Use this skill when you're:
- Receiving VoIP calls or messages on a network with no internet or APNs reachability
- Building Push to Talk over a 3GPP Mission Critical Services (MCX) cellular slice (iOS 27)
- Supporting wired, Ethernet-docked iPads or iPhones (iOS 26)
- Deciding between APNs and a persistent local connection for a managed-network app

## Example Prompts

- "Our app must receive calls on a ship network with no internet"
- "How do I get push notifications on an isolated hospital Wi-Fi?"
- "How do I run my push provider on Ethernet-docked iPads? (iOS 26)"
- "How do I receive Push to Talk over a Mission Critical 5G slice? (iOS 27)"
- "What entitlements does NEAppPushProvider need?"
- "Why doesn't my NEAppPushDelegate receive incoming calls?"

## Key Concepts

### Two halves, system-driven

`NEAppPushManager` (in your app) declares *where* the provider runs — Wi-Fi SSIDs, private LTE networks, Ethernet, or an MCX slice. `NEAppPushProvider` (an app extension) maintains the server connection and reports incoming calls. The system starts and stops the provider on network match, independent of your app's lifecycle.

### LPC complements APNs

Ship both channels; your server picks by which connection is active. Devices off the managed network still receive everything via APNs.

### A restricted entitlement

`com.apple.developer.networking.networkextension` with value `app-push-provider` must be requested from Apple with a concrete no-APNs deployment story. MCX additionally requires the `com.apple.developer.networking.slicing.appcategory` entitlement with value `mc-9500` (iOS 27).

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| Keeping your own background socket for calls | iOS suspends the app; calls missed | Use the provider extension — that's what it's for |
| Setting the delegate lazily | Incoming call reports dropped | Load managers and set (and retain) delegates at launch |
| Skipping the APNs path | No messages off the managed network | Run both channels; switch server-side |
| Custom heartbeat timers in the provider | Provider terminated | Use `handleTimerEvent()` (called every 60 seconds) |
| Assuming Ethernet networks can be allowlisted | Provider runs on unusable networks | Probe your server; call `unmatchEthernet()` to opt out (iOS 26) |

## Related

- [Push Notifications](/skills/integration/push-notifications) – The APNs path this complements; use it for all ordinary push
- [CallKit & LiveCommunicationKit](/skills/integration/callkit-livecommunicationkit) – Reporting the incoming calls your provider delivers
- [Networking](/skills/integration/networking) – The NWConnection/NetworkConnection the provider uses to reach your server

## Resources

**WWDC**: 2020-10113

**Docs**: /networkextension/local-push-connectivity, /networkextension/neapppushmanager, /networkextension/neapppushprovider, /networkextension/neapppushdelegate, /pushtotalk
