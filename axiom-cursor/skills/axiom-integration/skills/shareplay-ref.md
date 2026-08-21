
# SharePlay (GroupActivities) — API Reference

Signatures verified against the iOS 27 SDK `.swiftinterface`. **Nothing in GroupActivities changed between the 26 and 27 SDKs** on iOS or visionOS — no additions, no removals.

Every symbol below is `@available(watchOS, unavailable)`. Base availability is iOS 15 / macOS 12 / tvOS 15 / visionOS 1 unless noted.

For discipline and patterns, see `skills/shareplay.md`. For coordinated playback, see axiom-media (`skills/shareplay-playback.md`).

## Setup

| Item | Value |
|------|-------|
| Entitlement | `com.apple.developer.group-session` (Boolean) |
| Info.plist keys | none |
| Allowed targets | app targets only — Apple documents widgets, extensions, and App Clips as excluded, though no availability annotation enforces it |
| Platforms | iOS, macOS, tvOS, visionOS. **Not watchOS** |

## GroupActivity

```swift
protocol GroupActivity {
    static var activityIdentifier: String { get }     // has a default implementation
    var metadata: GroupActivityMetadata { get async }
}
```

`metadata` is an **async** requirement, but a synchronous property satisfies it — the common case is a plain computed `var`.

| Member | Signature |
|--------|-----------|
| Session stream | `static func sessions() -> GroupSession<Self>.Sessions` |
| Activate | `func activate() async throws -> Bool` |
| Prepare | `func prepareForActivation() async -> GroupActivityActivationResult` |

`activate()`'s `Bool` is **not** success/failure — it reports whether a session will reach *your app*. From the SDK doc comment: *"If a session will be delivered to your app this function returns true, otherwise it returns false. A case where this function could return false is when a session is created and handed off to an Apple TV. If a call isn't active or a session wasn't created, this method throws an error."*

So `false` is one documented **example** away from being general: it means no session is coming to you. Stop waiting; do not retry or call `end()`.

On the TV handoff the local device **leaves** the session — Apple describes it as "his phone dropping off the GroupSession and his TV joining". Nothing migrates; the TV joins as a new participant, and the FaceTime conversation continues on the phone. Treat the local session invalidating right after a `false` as the success path.

`supportsContinuationOnTV` (tvOS 15+) gates this. Apple documents its *effect* and never states a precondition — and an exhaustive sweep (SDK doc comments, all 18 WWDC SharePlay sessions, the HIG, TN3128, the SharePlay Q&A, the full forum tag) found none. Apple's Destination Video sample sets the flag with a single multiplatform target, one bundle ID, no `activityIdentifier` override, no Info.plist key, and only `com.apple.developer.group-session`. A separate tvOS target is not required; a shipping third-party SDK sets the flag without one.

The tvOS receive path is ordinary `sessions()` iteration — no distinct entry point. The iOS and tvOS `.swiftinterface` files differ by one line, and there are no ObjC headers hiding a tvOS-only API.

No documented pattern exists for the `false` branch; Apple's samples discard the value. Do **not** reuse `.activationDisabled` handling there — that means "play locally", while `false` means the TV already is, so transplanting it duplicates playback. No App Store Review requirement mentions SharePlay.

`NSGroupActivitiesIdentifier` is a hallucinated Info.plist key circulating in AI-generated guides. It does not exist.

## GroupActivityMetadata

```swift
struct GroupActivityMetadata: Equatable, Sendable {
    init()
    var type: ActivityType
    var title: String?
    var subtitle: String?
    var previewImage: CGImage?
    var fallbackURL: URL?
    var supportsContinuationOnTV: Bool
    var preferredBroadcastOptions: BroadcastOptions          // no availability floor
    var sceneAssociationBehavior: SceneAssociationBehavior   // iOS 17 / macOS 14 / tvOS 17
    var lifetimePolicy: LifetimePolicy                       // iOS 18 / macOS 15 / tvOS 18
}
```

### ActivityType

A **struct of static lets**, not an enum — a `switch` over it requires `default:`. Ten values on three availability tiers:

| Value | Availability |
|-------|-------------|
| `.generic`, `.listenTogether`, `.watchTogether` | iOS 15 / macOS 12 / tvOS 15 |
| `.playTogether` | iOS 16.2 / macOS 13.1 / tvOS 16.2 |
| `.workoutTogether`, `.shopTogether`, `.readTogether`, `.exploreTogether`, `.learnTogether`, `.createTogether` | iOS 17 / macOS 14 / tvOS 17 |

`type` drives the SharePlay banner icon, and App Store Connect's SharePlay usage report breaks down by activity type rather than by `activityIdentifier`. `.generic` means undifferentiated analytics.

### LifetimePolicy (iOS 18+)

| Value | Meaning |
|-------|---------|
| `.automatic` | Session persists independent of the initiator |
| `.endsWhenInitiatorLeaves` | Session ends when whoever started it leaves |

This is the only "host-like" concept in the framework, and it is a policy on the *activity*, not authority over the *session*.

### SceneAssociationBehavior

| Value | Meaning |
|-------|---------|
| `.default` | System picks the scene |
| `.content(_ contentIdentifier: String)` | Associate with a specific content scene |
| `.none` | No scene association |

### BroadcastOptions

`OptionSet`. Only member: `.mirroredVideo`.

## Activation and discovery

### GroupStateObserver

```swift
final class GroupStateObserver: ObservableObject {
    init()
    @Published var isEligibleForGroupSession: Bool { get }
    var $isEligibleForGroupSession: Published<Bool>.Publisher { get }
}
```

The gate. `true` → `prepareForActivation()` / `activate()`. `false` → present `GroupActivitySharingController`.

### GroupActivityActivationResult

| Case | What to do |
|------|-----------|
| `.activationPreferred` | Call `activate()` |
| `.activationDisabled` | Run the experience **locally** — not an error |
| `.cancelled` | Do nothing at all |

### GroupActivitySharingController

**iOS 15.4+, macOS 13+, `@available(tvOS, unavailable)`.** Lives in a cross-import overlay — needs `import UIKit` (or `import AppKit` on macOS) alongside `import GroupActivities`. The `init(_:)` form **throws**; `init(preparationHandler:)` does not. After a `.success` result, do **not** also call `activate()`.

Combined with the transfer representation below, tvOS has **no** in-app way to start SharePlay: sessions must originate on another device.

### GroupActivityTransferRepresentation

```swift
@available(iOS 17, macOS 14, *)
@available(tvOS, unavailable)
struct GroupActivityTransferRepresentation<Item>: TransferRepresentation
    where Item: Transferable
```

Powers share-sheet, `ShareLink`, and AirDrop starts. **Unavailable on tvOS** even though GroupActivities itself runs there — the modern discovery path simply does not exist on that platform.

## GroupSession

```swift
final class GroupSession<ActivityType>: ObservableObject where ActivityType: GroupActivity
```

**Not `Sendable`.** Not `@Observable`. Observation is Combine only — there is no AsyncSequence for `state`, `activity`, or `activeParticipants`.

| Member | Signature |
|--------|-----------|
| Identity | `let id: UUID` |
| State | `@Published var state: State` / `$state` |
| Activity | `@Published var activity: ActivityType` / `$activity` |
| Participants | `@Published var activeParticipants: Set<Participant>` / `$activeParticipants` |
| Local | `var localParticipant: Participant { get }` |
| Initiated here | `let isLocallyInitiated: Bool` — **iOS 18 / macOS 15** |
| Scene | `var sceneSessionIdentifier: String? { get }` — **iOS 17 / macOS 14 / tvOS 17** |
| Join | `func join()` |
| Leave | `func leave()` |
| End | `func end()` |
| Foreground | `func requestForegroundPresentation()` — no-op unless state is `.waiting` or `.joined` |
| Notice | `func showNotice(_ event: GroupSessionEvent)` |

### State

```swift
enum State: Sendable {
    case waiting
    case joined
    case invalidated(reason: any Error)
}
```

`leave()` and `end()` both land in `.invalidated`. The difference: an ended session can never be rejoined. Calling either on an already-invalidated session is forbidden.

`State` is **non-frozen** — in Swift 6 language mode a `switch` over it without `@unknown default` is a compile error (a warning under `-swift-version 5`). `GroupActivityActivationResult` behaves the same way.

### Sessions

```swift
struct Sessions: AsyncSequence {
    typealias Element = GroupSession<ActivityType>
}
extension GroupSession.Sessions: Sendable where ActivityType: Sendable
```

Yields only **new** sessions. It never re-emits when a live session's properties change.

Note: the SDK doc comment for `sessions()` illustrates usage with the obsolete `async { }` spelling, which no longer compiles. Apple's own doc comments are not exempt from verification.

## Participant

```swift
struct Participant: Hashable, Identifiable, Sendable {
    typealias ID = UUID
    var id: ID { get }
    var isNearbyWithLocalParticipant: Bool { get }     // iOS 26 / visionOS 26
}

enum Participants: Sendable {
    case all
    case only(Set<Participant>)
}
extension Participants {
    static func only(_ participant: Participant) -> Participants   // singular convenience
}
```

One person joining from two devices produces **two** `Participant` values — device-and-session identity, never account identity.

`activeParticipants` **includes** `localParticipant` (proven by Apple's own `isNearbyWithLocalParticipant` sample, which filters `$0 != session.localParticipant`). Filter self out for any "are others present?" check. `isNearbyWithLocalParticipant` is always `true` for the local participant.

## GroupSessionMessenger

```swift
final class GroupSessionMessenger: @unchecked Sendable {
    init<Activity>(session: GroupSession<Activity>)
    init<Activity>(session: GroupSession<Activity>, deliveryMode: DeliveryMode)   // iOS 16+
    let deliveryMode: DeliveryMode
}
```

`deliveryMode` is a **`let`**, fixed at construction. Neither `send` overload takes a mode, so an app needing both reliable and unreliable delivery must construct **two messengers** on the same session.

| Member | Signature |
|--------|-----------|
| Send (async) | `func send<Message: Codable>(_ value: Message, to participants: Participants = .all) async throws` |
| Send (Data) | `func send(_ value: Data, to participants: Participants = .all) async throws` |
| Send (completion) | `func send<Message: Codable>(_ value: Message, to: Participants = .all, completion: @escaping ((any Error)?) -> Void)` — and a `Data` overload of the same shape |
| Receive | `func messages<Message: Codable>(of type: Message.Type) -> Messages<Message>` |
| Receive (Data) | `func messages(of type: Data.Type) -> Messages<Data>` |

```swift
struct Messages<Message: Codable>: AsyncSequence {
    typealias Element = (Message, MessageContext)
}

struct MessageContext: Sendable {
    var source: Participant
}
```

### DeliveryMode (iOS 16+)

| Mode | Guarantees |
|------|-----------|
| `.reliable` | Delivery **and** FIFO order guaranteed; **timeliness is not** — a dropped message is retried and arrives late |
| `.unreliable` | **Neither** delivery **nor** ordering. Best effort only |

Both modes exclude participants who left or who join later.

**Payload cap: 256 KB** (raised from 64 KB in iOS 16), messenger-wide rather than per-mode — stated in the "Synchronizing data during a SharePlay activity" article as well as WWDC22-10140. Oversize throws from `send`, as does sending a burst in a tight loop; the rate is unpublished. Apple adds: "keep the total size as small as possible to minimize the time it takes to send and process the data."

Sourcing note: FIFO ordering is stated in WWDC21-10187 — *"GroupSessionMessenger provides reliable and FIFO-ordered message delivery"* — which predates `DeliveryMode` (iOS 16). Reading it as a property of `.reliable` is a well-founded inference, not an Apple statement about the named mode. The retry-not-timeliness guarantee is stated directly in WWDC22-10140.

## GroupSessionJournal

```swift
final class GroupSessionJournal: @unchecked Sendable {
    convenience init<Activity>(session: GroupSession<Activity>)
    var attachments: Attachments { get }
    func add<T: Transferable>(_ item: T) async throws -> Attachment
    func add<T: Transferable, M: Codable>(_ item: T, metadata: M) async throws -> Attachment
    func remove(attachment: Attachment) async throws
}

struct Attachment: Identifiable, Sendable {
    var id: UUID
    func load<T: Transferable>(_ attachmentType: T.Type) async throws -> T
    func loadMetadata<M: Codable>(of: M.Type) async throws -> M
}

struct Attachments: AsyncSequence, @unchecked Sendable {
    typealias Element = [Attachment]        // the ENTIRE current set, every iteration
}
```

`Attachments.Element` is an **array** — the full current set, every iteration, to everyone including the uploader. Retain the journal; it does not survive on its own. See `skills/shareplay.md` for the reconciliation pattern this forces.

| Property | Value |
|----------|-------|
| Max attachment size | 100 MB (documented in writing, not just WWDC) |
| Pre-download validation | **none** — no hook to gate, moderate, or check entitlements. Apple directs protected content to your own server |
| Max count / aggregate cap / rate limit | undocumented |
| Lifetime | session-bound; survives the uploader disconnecting, removed when everyone leaves; no TTL |
| `add(_:)` return | not a delivery receipt — "can return before the upload operation finishes" |
| `remove(attachment:)` scope | global ("on all sessions"), not restricted to the uploader |
| Conflict resolution | undocumented — Apple asserts the journal "stays consistent for everyone" without saying how |
| Encryption | end-to-end, same FaceTime channel as messenger payloads |

## GroupSessionEvent

```swift
struct GroupSessionEvent {
    init(originator: Participant, action: Action, url: URL?)
    struct Action {
        static let play: Action
        static let pause: Action
        static let seek: Action
        static let updatedQueue: Action
        static func skip(item: String) -> Action
        static func updatedQueue(_ change: Action.QueueChange) -> Action

        struct QueueChange {                       // GroupSessionEvent.Action.QueueChange
            static func setUpNext(_ item: Item) -> QueueChange
            static func added(_ item: Item) -> QueueChange
            struct Item {
                static func song(_ name: String) -> Item
                static func container(_ name: String) -> Item
            }
        }
    }
}
```

Surface with `session.showNotice(_:)` to tell the group what a participant just did.

## Deprecations

Exactly what stale tutorials still teach. All still present in the 27 SDK.

| Deprecated | Replacement |
|------------|-------------|
| `GroupSession.Event` | `GroupSessionEvent` |
| `session.postEvent(_:)` | `session.showNotice(_:)` |
| `GroupActivityMetadata.Experience` | `GroupActivityMetadata.ActivityType` |
| `metadata.experience` | `metadata.type` |
| `metadata.localizedTitle` | `metadata.title` |
| `metadata.localizedSubtitle` | `metadata.subtitle` |

`Experience` exposes only `watchTogether` and `listenTogether`. Migrating to `ActivityType` is what unlocks the other eight values.

## Cross-import overlays

Neither of these is in the base module.

| Symbol | Needs |
|--------|-------|
| `GroupActivitySharingController` | `import UIKit` |
| `View.groupActivityAssociation`, `groupImmersionStyle` | `import SwiftUI` |

## visionOS additions

All present since visionOS 26 — **none** are new in 27.

| Symbol | Availability |
|--------|-------------|
| `GroupSession.systemCoordinator` | visionOS 1+ |
| `SpatialTemplatePreference.none/.sideBySide/.conversational` | visionOS 1+ |
| `SpatialTemplatePreference.surround/.custom(_:)` | **visionOS 2+** |
| `Participant.isNearbyWithLocalParticipant` | visionOS 26 / iOS 26 — unavailable on macOS, tvOS, Mac Catalyst |
| `GroupActivityAssociationKind` | visionOS 26 |

`extension SystemCoordinator: Observable` is marked `unavailable` on **every** platform including visionOS — a dead conformance. Observe it via its AsyncSequences.

## Resources

**WWDC**: 2021-10183, 2021-10187, 2022-10140, 2023-10239, 2023-10241

**Docs**: /groupactivities, /groupactivities/groupsession, /groupactivities/groupsessionmessenger, /groupactivities/groupsessionjournal, /groupactivities/groupactivitymetadata, /xcode/configuring-group-activities

**Skills**: shareplay, axiom-media (shareplay-playback), axiom-concurrency (swift-concurrency)
