
# CallKit + LiveCommunicationKit + IdentityLookup — VoIP Calls

CallKit integrates your VoIP app with the system call UI — the full-screen incoming-call screen, the lock screen, Recents, Do Not Disturb, and audio routing. LiveCommunicationKit (iOS 17.4+) is the platform-expanded sibling that brings the same model to Apple Watch and visionOS and powers default calling/dialer apps. IdentityLookup handles caller identification, blocking, and message filtering. The one rule that will brick your app if you ignore it: **every VoIP push must report a call to CallKit, synchronously, or iOS kills your app and stops delivering VoIP pushes.**

## Core mental model

CallKit is a *coordinator*, not a calling stack. Your app does the networking and audio; CallKit owns the system UI and the **audio session lifecycle**. Two non-negotiable contracts:

1. **PushKit ↔ CallKit:** a VoIP push (`PKPushRegistry`) must result in `CXProvider.reportNewIncomingCall(...)` before the push handler's completion runs. No exceptions.
2. **CallKit owns the audio session:** you configure the category, but you only *start* audio in `provider(_:didActivate:)` and stop it in `provider(_:didDeactivate:)`. Never activate `AVAudioSession` yourself for a call.

LiveCommunicationKit mirrors this with `ConversationManager` / `Conversation` and adds watchOS/visionOS reach and the default-app entitlements. IdentityLookup is separate: bulk call directories (`CXCallDirectoryProvider`, a CallKit type) and real-time Live Caller ID Lookup (iOS 18+).

## When to Use This Skill

- Building a VoIP calling app (incoming/outgoing calls, hold, mute, DTMF)
- Wiring VoIP push notifications to the system call UI
- Diagnosing "my app gets killed" / "VoIP pushes stopped arriving"
- Fixing call audio that's silent, routed wrong, or doesn't start
- Reaching Apple Watch / visionOS, or becoming a default calling/dialer app (LiveCommunicationKit)
- Identifying or blocking spam callers, or filtering messages (IdentityLookup)

For the full type/method surface, see `skills/callkit-livecommunicationkit-ref.md`. For the audio session category itself, see axiom-media. For PushKit-vs-APNs delivery, see `skills/push-notifications.md`.

## System Requirements

| Capability | Minimum |
|------------|---------|
| CallKit (`CXProvider`, `CXCallController`, `CXProviderDelegate`) | iOS 10+, Mac Catalyst, watchOS 9+, visionOS 1+ |
| PushKit VoIP pushes; the `reportNewIncomingCall` rule | iOS 8+ (rule enforced when built against the iOS 13 SDK+) |
| LiveCommunicationKit (`ConversationManager`) | iOS 17.4+, iPadOS 17.4+, Mac Catalyst 17.4+, visionOS 1.1+, watchOS 10.4+ |
| Default calling app (`com.apple.developer.calling-app`) | iOS 18.2+ |
| Default dialer app (`com.apple.developer.dialing-app`) | iOS 26.0+ (EU only) |
| Live Caller ID Lookup (`LiveCallerIDLookupManager`) | iOS 18+, macOS 15+ |

The VoIP background mode (`UIBackgroundModes` → `voip`) is required to receive VoIP pushes.

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| Not reporting a call on a VoIP push | iOS 13 SDK+ **terminates your app** when a push doesn't report a call, and **stops delivering VoIP pushes** if you do it repeatedly | Call `reportNewIncomingCall` in `pushRegistry(_:didReceiveIncomingPushWith:for:completion:)` on **every** VoIP push, before `completion()` |
| Reporting the call *after* async work | The push handler may not finish your network round-trip in time | Report the call **immediately** with what you have, then fetch details |
| Using VoIP pushes for non-call data | Same termination penalty | Use regular APNs / `UserNotifications` for non-call payloads |
| Activating `AVAudioSession` yourself | Breaks CallKit's routing and the call UI | Start audio only in `provider(_:didActivate:)`; stop in `provider(_:didDeactivate:)` |
| Not fulfilling a `CXAction` | Unfulfilled actions time out → `provider(_:timedOutPerforming:)` and a stuck call | Call `action.fulfill()` (or `.fail()`) for **every** action |
| Treating LiveCommunicationKit as a CallKit replacement | It's a complement that expands platforms (watch/visionOS) and enables default-app status | Use CallKit on iOS; add LiveCommunicationKit for watch/visionOS/default-app |

## Part 1 — The PushKit rule (the one that bricks your app)

This is the single most important contract in VoIP development. When you build against the iOS 13 SDK or later, **iOS requires that every VoIP push reports an incoming call to CallKit**. Fail to report a call and the system terminates your app; do it *repeatedly* and the system stops delivering VoIP pushes to your app entirely.

```swift
import PushKit
import CallKit

func pushRegistry(_ registry: PKPushRegistry,
                  didReceiveIncomingPushWith payload: PKPushPayload,
                  for type: PKPushType,
                  completion: @escaping () -> Void) {
    guard type == .voIP else { completion(); return }

    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: payload.dictionaryPayload["caller"] as? String ?? "Unknown")
    update.hasVideo = false

    // Report SYNCHRONOUSLY, with whatever you have, BEFORE completion().
    provider.reportNewIncomingCall(with: UUID(), update: update) { error in
        completion()   // only call completion after the report
    }
}
```

Do the network round-trip *after* reporting — never gate `reportNewIncomingCall` on it. For non-call pushes, use regular notifications; VoIP pushes are exclusively for reporting calls.

## Part 2 — Provider setup and reporting calls

`CXProvider` (configured once) drives the system call UI; `CXProviderDelegate` receives system-initiated actions.

```swift
let config = CXProviderConfiguration()
config.supportsVideo = true
config.maximumCallsPerCallGroup = 1
config.supportedHandleTypes = [.phoneNumber, .generic]
let provider = CXProvider(configuration: config)
provider.setDelegate(self, queue: nil)

// Update an in-progress call (e.g. caller name resolved, connected)
provider.reportCall(with: callUUID, updated: update)
provider.reportOutgoingCall(with: callUUID, connectedAt: Date())
provider.reportCall(with: callUUID, endedAt: Date(), reason: .remoteEnded)
```

## Part 3 — Audio session (CallKit owns it)

Configure the category early, but let CallKit drive activation. The system raises the call UI, activates the session, and *then* calls you.

```swift
func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    startAudioEngine()   // begin RTP / playback HERE, not before
}

func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    stopAudioEngine()
}
```

Never call `audioSession.setActive(true)` yourself for a call — CallKit does it, and doing it yourself produces silent or misrouted audio. See axiom-media for choosing the `.playAndRecord` category and options.

## Part 4 — Outgoing calls and actions

User-initiated actions (start, end, hold, mute) go through `CXCallController` as a `CXTransaction`. The system calls back into your delegate; you must **fulfill** each action.

```swift
let action = CXStartCallAction(call: UUID(), handle: CXHandle(type: .phoneNumber, value: "+15551234"))
callController.request(CXTransaction(action: action)) { error in /* requested */ }

// Delegate: perform the work, then fulfill
func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
    startNetworkCall(uuid: action.callUUID)
    action.fulfill()                                  // REQUIRED, or it times out
    provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: Date())
}

func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    endNetworkCall(uuid: action.callUUID)
    action.fulfill()
}
```

Every `provider(_:perform:)` overload (answer, end, hold, mute, DTMF) must call `fulfill()` or `fail()`.

## Part 5 — LiveCommunicationKit (iOS 17.4+)

LiveCommunicationKit is the platform-expanded complement to CallKit: same call-coordination model, but it reaches **Apple Watch (watchOS 10.4+)** and **visionOS (1.1+)**, and it's how you become a **default calling or dialer app**. The central object is `ConversationManager` (mirrors `CXProvider`); calls are `Conversation`s; you report and act with `ConversationAction`s.

```swift
import LiveCommunicationKit

let manager = ConversationManager(configuration: .init(/* ringtone, icon, supported handles */))
try await manager.reportNewIncomingConversation(uuid: id, update: update)
```

- **Default calling app** (iOS 18.2+): `com.apple.developer.calling-app` entitlement + `UIBackgroundModes` `voip`. Such an app accepts CallKit *or* LiveCommunicationKit.
- **Default dialer app** (iOS 26.0+, EU): `com.apple.developer.dialing-app` entitlement, driven via `TelephonyConversationManager` for cellular calls.

Use CallKit on iOS as the baseline; add LiveCommunicationKit when you need watch/visionOS or default-app status.

## Part 6 — Caller ID, blocking, and message filtering (IdentityLookup)

Two complementary approaches to caller ID and blocking:

- **Call Directory** — `CXCallDirectoryProvider` (a CallKit extension). You supply a **bulk, sorted** list of numbers to identify or block, loaded when the system asks. **No runtime/per-call lookups** — it's offline data.
- **Live Caller ID Lookup** (iOS 18+) — `LiveCallerIDLookupManager` + a Live Caller ID Lookup app extension. Real-time identification/blocking using **Private Information Retrieval (PIR)** so your server never learns who the user is being called by. Use `refreshPIRParameters(forExtensionWithIdentifier:)`, check `status()`.

IdentityLookup also provides SMS/MMS filtering via `ILMessageFilterExtension` (`ILMessageFilterQueryRequest` → `ILMessageFilterQueryResponse` with `.allow` / `.junk` / `.promotion` / `.transaction`).

## Common Mistakes

- Not reporting a call on every VoIP push — the #1 way to get your app terminated and VoIP pushes cut off.
- Doing network work before `reportNewIncomingCall` — report first, fetch after.
- Sending non-call data over VoIP pushes — use APNs/UserNotifications.
- Activating `AVAudioSession` yourself instead of waiting for `provider(_:didActivate:)`.
- Forgetting to `fulfill()` / `fail()` a `CXAction` — the call gets stuck and times out.
- Assuming LiveCommunicationKit replaces CallKit — it complements it for watch/visionOS/default-app.
- Expecting runtime lookups from `CXCallDirectoryProvider` — it's bulk/offline; use Live Caller ID Lookup for real-time.

## Resources

**WWDC**: 2016-230, 2019-707, 2020-10113

**Docs**: /callkit, /callkit/cxprovider, /callkit/cxproviderconfiguration, /callkit/cxcallcontroller, /callkit/cxcallupdate, /callkit/cxproviderdelegate, /callkit/preparing-your-app-to-be-the-default-calling-app, /pushkit, /livecommunicationkit, /livecommunicationkit/conversationmanager, /identitylookup, /identitylookup/livecalleridlookupmanager

**Skills**: skills/callkit-livecommunicationkit-ref.md, skills/push-notifications.md (PushKit vs APNs), axiom-media (AVAudioSession), axiom-watchos (LiveCommunicationKit on watch)
