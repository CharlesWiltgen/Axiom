
# CallKit + LiveCommunicationKit + IdentityLookup — API Reference

Comprehensive API reference for CallKit, PushKit VoIP, LiveCommunicationKit, and IdentityLookup. For the discipline (the PushKit rule, audio session ownership, action fulfillment), see `skills/callkit-livecommunicationkit.md`.

## Key Terminology

- **CXProvider** — Reports calls to the system and surfaces system-initiated actions via its delegate.
- **CXCallController** — Requests user-initiated actions (start/end/hold/mute) as transactions.
- **CXTransaction** — One or more `CXAction`s submitted together.
- **CXCallUpdate** — Mutable description of a call's metadata (handle, video, caller name).
- **PKPushRegistry** — Delivers VoIP pushes; each must report a call.
- **ConversationManager** — LiveCommunicationKit's CXProvider analogue (watch/visionOS, default apps).
- **CXCallDirectoryProvider** — Bulk, offline caller identification/blocking extension.
- **LiveCallerIDLookupManager** — Real-time, PIR-based caller ID/blocking (iOS 18+).

---

# Part 1: CXProvider and configuration

```swift
let config = CXProviderConfiguration()
config.supportsVideo = true
config.maximumCallGroups = 1
config.maximumCallsPerCallGroup = 1
config.supportedHandleTypes = [.phoneNumber, .generic]   // also .emailAddress
config.iconTemplateImageData = UIImage(named: "callkit-icon")?.pngData()
config.ringtoneSound = "ringtone.caf"
config.includesCallsInRecents = true

let provider = CXProvider(configuration: config)
provider.setDelegate(self, queue: nil)   // nil = main queue
```

---

# Part 2: CXProviderDelegate

```swift
func providerDidReset(_ provider: CXProvider)                                   // tear down all calls
func provider(_ provider: CXProvider, perform action: CXStartCallAction)
func provider(_ provider: CXProvider, perform action: CXAnswerCallAction)
func provider(_ provider: CXProvider, perform action: CXEndCallAction)
func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction)
func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction)
func provider(_ provider: CXProvider, perform action: CXSetGroupCallAction)
func provider(_ provider: CXProvider, perform action: CXPlayDTMFCallAction)
func provider(_ provider: CXProvider, timedOutPerforming action: CXAction)
func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession)
func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession)
```

Every `perform` overload must call `action.fulfill()` or `action.fail()`.

---

# Part 3: Reporting calls

```swift
// Incoming (from a VoIP push — see Part 6)
provider.reportNewIncomingCall(with: uuid, update: update) { error in /* ... */ }

// Outgoing progress
provider.reportOutgoingCall(with: uuid, startedConnectingAt: Date())
provider.reportOutgoingCall(with: uuid, connectedAt: Date())

// Updates and termination
provider.reportCall(with: uuid, updated: update)
provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
// CXCallEndedReason: .failed, .remoteEnded, .unanswered, .answeredElsewhere, .declinedElsewhere
```

## CXCallUpdate

```swift
let update = CXCallUpdate()
update.remoteHandle = CXHandle(type: .phoneNumber, value: "+15551234")  // .generic, .emailAddress
update.localizedCallerName = "Jane Doe"
update.hasVideo = false
update.supportsHolding = true
update.supportsGrouping = false
update.supportsUngrouping = false
update.supportsDTMF = true
```

---

# Part 4: CXCallController and transactions

```swift
let callController = CXCallController()

// Start
let start = CXStartCallAction(call: uuid, handle: CXHandle(type: .phoneNumber, value: "+15551234"))
start.isVideo = false
callController.request(CXTransaction(action: start)) { error in /* ... */ }

// Answer / End / Hold / Mute / DTMF
CXAnswerCallAction(call: uuid)
CXEndCallAction(call: uuid)
CXSetHeldCallAction(call: uuid, onHold: true)
CXSetMutedCallAction(call: uuid, muted: true)
CXPlayDTMFCallAction(call: uuid, digits: "5", type: .singleTone)
```

---

# Part 5: CXCallObserver

```swift
let observer = CXCallObserver()
observer.setDelegate(self, queue: nil)

func callObserver(_ observer: CXCallObserver, callChanged call: CXCall) {
    // call.uuid, call.isOutgoing, call.isOnHold, call.hasConnected, call.hasEnded
}
```

---

# Part 6: PushKit (VoIP)

```swift
import PushKit

let registry = PKPushRegistry(queue: .main)
registry.delegate = self
registry.desiredPushTypes = [.voIP]

// Delegate
func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    // credentials.token — send to your server
}
func pushRegistry(_ registry: PKPushRegistry,
                  didReceiveIncomingPushWith payload: PKPushPayload,
                  for type: PKPushType,
                  completion: @escaping () -> Void) {
    // MUST reportNewIncomingCall before completion() — see discipline Part 1
}
func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) { }
```

APNs VoIP push: `apns-push-type: voip`, `apns-topic: <bundleID>.voip`.

---

# Part 7: LiveCommunicationKit (iOS 17.4+)

```swift
import LiveCommunicationKit

let config = ConversationManager.Configuration(/* ringtoneName, iconTemplateImageData, supportsVideo, supportedHandleTypes */)
let manager = ConversationManager(configuration: config)
manager.delegate = delegate                  // ConversationManagerDelegate

try await manager.reportNewIncomingConversation(uuid: id, update: update)   // update: Conversation.Update
// Report later events against the Conversation object (from manager.conversations), NOT a UUID.
// reportConversationEvent is synchronous and takes a Conversation:
if let conversation = manager.conversations.first(where: { $0.uuid == id }) {
    manager.reportConversationEvent(event, for: conversation)               // event: Conversation.Event
}
manager.conversations                         // [Conversation]; ConversationManager is Observable

// Cellular / default dialer (iOS 26+, EU) — singleton, no public init
let telephony = TelephonyConversationManager.sharedInstance
telephony.startCellularConversation(action)   // ConversationAction
telephony.cellularServices                     // available cellular accounts
```

- `Conversation` — a call. `ConversationAction` — system-initiated action (mirror of `CXAction`); fulfill/fail it.
- `Handle` — participant identifier (mirror of `CXHandle`).
- Availability: iOS 17.4+, iPadOS 17.4+, Mac Catalyst 17.4+, visionOS 1.1+, watchOS 10.4+.

---

# Part 8: IdentityLookup and call directories

## Call Directory (bulk, offline) — CallKit

```swift
// In a Call Directory app extension
class DirectoryHandler: CXCallDirectoryProvider {
    override func beginRequest(with context: CXCallDirectoryExtensionContext) {
        context.addIdentificationEntry(withNextSequentialPhoneNumber: 15551234, label: "Spam Likely")
        context.addBlockingEntry(withNextSequentialPhoneNumber: 15555678)  // ascending order required
        context.completeRequest()
    }
}
```

Entries must be added in **ascending** numeric order. No per-call runtime lookups.

## Live Caller ID Lookup (real-time, PIR) — IdentityLookup, iOS 18+

```swift
import IdentityLookup

let manager = LiveCallerIDLookupManager.shared
try await manager.refreshPIRParameters(forExtensionWithIdentifier: "com.example.lookup")  // async throws
let status = manager.status(forExtensionWithIdentifier: "com.example.lookup")  // sync, returns .enabled / .disabled
```

Backed by a Live Caller ID Lookup app extension (`LiveCallerIDLookupExtensionContext`, `LiveCallerIDLookupProtocol`). Uses Private Information Retrieval so your server can't see who is being looked up.

## Message filtering — IdentityLookup

```swift
class MessageFilter: ILMessageFilterExtension, ILMessageFilterQueryHandling {
    func handle(_ request: ILMessageFilterQueryRequest,
                context: ILMessageFilterExtensionContext,
                completion: @escaping (ILMessageFilterQueryResponse) -> Void) {
        let response = ILMessageFilterQueryResponse()
        response.action = .junk    // .none, .allow, .junk, .promotion, .transaction
        completion(response)
    }
}
```

---

# Part 9: Entitlements and Info.plist

- `UIBackgroundModes` → `voip` (required for VoIP pushes)
- `com.apple.developer.calling-app` — default calling app (iOS 18.2+)
- `com.apple.developer.dialing-app` — default dialer app (iOS 26.0+, EU)
- A Call Directory or Live Caller ID Lookup **app extension** target for caller ID/blocking

---

## Resources

**WWDC**: 2016-230, 2019-707, 2020-10113

**Docs**: /callkit, /callkit/cxprovider, /callkit/cxproviderconfiguration, /callkit/cxcallcontroller, /callkit/cxcallupdate, /callkit/cxproviderdelegate, /callkit/cxcalldirectoryprovider, /pushkit, /pushkit/pkpushregistry, /livecommunicationkit, /livecommunicationkit/conversationmanager, /identitylookup, /identitylookup/livecalleridlookupmanager

**Skills**: skills/callkit-livecommunicationkit.md, skills/push-notifications-ref.md, axiom-media (AVAudioSession)
