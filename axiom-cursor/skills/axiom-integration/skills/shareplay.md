
# SharePlay (GroupActivities) — Discipline

SharePlay gives your app a private, system-provided realtime channel between people who are already together in FaceTime or Messages — no account system, no invitations, no transport of your own. You describe an *activity*; the system creates and hands you *sessions*.

## Core mental model

Your app advertises a `GroupActivity`. It never constructs a `GroupSession`. Sessions arrive asynchronously from the framework, one per running instance, and you get them by iterating `Activity.sessions()`.

There is **no host**. Every participant is equal — the framework has no owner, no authority, and no turn-taking concept. Anything resembling a host is something you built, and you probably shouldn't have.

Three transports, and picking the wrong one is the most expensive mistake in this skill:

| Data | Transport |
|------|-----------|
| Small, time-sensitive commands and state | `GroupSessionMessenger` |
| Files and large objects, including for late joiners | `GroupSessionJournal` |
| Media timeline (play, pause, seek, rate) | AVFoundation playback coordinator — see axiom-media (`skills/shareplay-playback.md`) |

## When to Use This Skill

- Adding SharePlay to an app, or debugging why a session never arrives
- Designing what to synchronize and what to keep local
- Choosing between `prepareForActivation()`, `activate()`, and `GroupActivitySharingController`
- Messenger vs journal vs playback coordinator
- Late joiners not receiving state; participants appearing twice; a session that won't end
- Swift 6 isolation errors around `GroupSession`

For coordinated audio/video playback, use axiom-media (`skills/shareplay-playback.md`). For the full API surface, see `skills/shareplay-ref.md`.

## System Requirements

| Capability | Minimum |
|------------|---------|
| GroupActivities core, `.generic` / `.listenTogether` / `.watchTogether` | iOS 15+ / macOS 12+ / tvOS 15+ / visionOS 1+ |
| `GroupActivitySharingController` | iOS 15.4+ / macOS 13+ — **unavailable on tvOS** |
| `.playTogether` | iOS 16.2+ / macOS 13.1+ / tvOS 16.2+ |
| `GroupSessionMessenger.DeliveryMode` (`.unreliable`) | iOS 16+ / macOS 13+ / tvOS 16+ |
| The other six activity types (`workoutTogether` … `createTogether`) | iOS 17+ / macOS 14+ / tvOS 17+ |
| `sceneAssociationBehavior`, `sceneSessionIdentifier` | iOS 17+ / macOS 14+ / tvOS 17+ |
| `Transferable` activities, `ShareLink`, `GroupActivityTransferRepresentation` | iOS 17+ / macOS 14+ — **unavailable on tvOS** |
| `lifetimePolicy`, `isLocallyInitiated` | iOS 18+ / macOS 15+ |
| Spatial Personas, `SystemCoordinator` | visionOS 1+ (`.surround` / `.custom` need visionOS 2) |
| Nearby colocated participants | visionOS 26 / iOS 26 |

**tvOS has neither discovery path** — no sharing controller, no transfer representation. On tvOS a session can only arrive from an activity started elsewhere.

**watchOS is not supported at all.** Every GroupActivities symbol is `@available(watchOS, unavailable)` — that one is SDK-enforced. Apple additionally documents Group Activities as unavailable to widgets, extensions, and App Clips; that restriction is documented rather than expressed as an availability annotation, so the compiler will not stop you.

Setup is one entitlement, `com.apple.developer.group-session`, and **no Info.plist keys**.

Nothing in GroupActivities changed between the 26 and 27 SDKs. Guidance here is stable across that boundary.

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| Migrating `GroupSession` to `@Observable` | It's a framework `ObservableObject` you can't redeclare, and the participant delta depends on `@Published` willSet timing | Keep Combine; see "Catching up late joiners" |
| Observing the session from a SwiftUI view | `GroupSession` is **not** `Sendable` | One owning controller in one isolation domain |
| One messenger for reliable *and* unreliable | `deliveryMode` is a `let`, fixed at init | Construct **two** messengers on the same session |
| Treating `activate()`'s `false` as failure | `false` is a documented success — handed off to Apple TV | Failure throws; `false` is not an error |
| `activeParticipants.count` read as a people count | One person on two devices is **two** participants | It's a device count; never an account identity |
| Expecting `sessions()` to re-emit on change | It only yields *new* sessions | Observe `$state` / `$activeParticipants` separately |
| Loading your own journal attachments | The journal echoes the full set back to the uploader | Skip attachments you added |
| Copying sample code verbatim | Published samples, `AVFoundation.apinotes`, and even the SDK's own `sessions()` doc comment (obsolete `async { }`) contain code that doesn't compile | Compile every snippet before trusting it |
| Assuming your app is foregrounded when a session arrives | The system may launch it in the **background** | Adapt, or call `requestForegroundPresentation()` |

## Defining the activity

Keep the activity small. It describes enough to *locate or begin* the shared experience — not the experience's mutable state.

```swift
import GroupActivities

struct ListenTogether: GroupActivity {
    static let activityIdentifier = "com.example.app.listen-together"

    let albumID: String

    var metadata: GroupActivityMetadata {
        var meta = GroupActivityMetadata()
        meta.title = "Listen Together"
        meta.subtitle = "Shared queue"
        meta.type = .listenTogether
        meta.fallbackURL = URL(string: "https://example.com/albums/\(albumID)")
        return meta
    }
}
```

`metadata.type` is not cosmetic — it drives the SharePlay banner icon, and App Store Connect's SharePlay usage report breaks down by activity type rather than by your activity identifier. Leaving it `.generic` costs you both a correct icon and any ability to tell your activities apart in analytics.

`ActivityType` is a **struct of static lets**, not an enum, so a `switch` over it needs a `default:`. Ten values, on three availability tiers:

| Values | Availability |
|--------|-------------|
| `generic`, `listenTogether`, `watchTogether` | iOS 15+ |
| `playTogether` | iOS 16.2+ / macOS 13.1+ / tvOS 16.2+ |
| `workoutTogether`, `shopTogether`, `readTogether`, `exploreTogether`, `learnTogether`, `createTogether` | iOS 17+ / macOS 14+ / tvOS 17+ |

The deprecated `Experience` enum exposes only `watchTogether` and `listenTogether`, so migrating off it unlocks the other eight — but six of those need an iOS 17 floor, so gate them rather than assuming they're free.

## Starting it

Two decisions, in order. First, is the user already in a call?

```swift
let activity = ListenTogether(albumID: albumID)

if groupStateObserver.isEligibleForGroupSession {
    switch await activity.prepareForActivation() {
    case .activationPreferred:
        _ = try await activity.activate()
    case .activationDisabled:
        playLocallyInstead()          // user chose not to share — this is not an error
    case .cancelled:
        break                          // ignore entirely
    @unknown default:
        break
    }
} else {
    // not in a call — present GroupActivitySharingController (UIKit overlay)
}
```

`prepareForActivation()` is the default for an ordinary content action that *might* become shared — it lets the system decide and remembers the user's preference. Reach for `activate()` directly only when the activity makes no sense outside a group.

**`activate()`'s `Bool` answers one question: will a session be delivered to *you*?** Apple's own words — *"If a session will be delivered to your app this function returns true, otherwise it returns false."* Apple TV handoff is given as *a case where* `false` happens, not its definition. So `false` means stop waiting: no session is coming from this activation. Don't spin, don't retry, don't call `end()`.

For the TV case specifically, the handoff *"results in his phone dropping off the GroupSession and his TV joining"* — the local device leaves, nothing migrates, and the FaceTime conversation continues on the phone. An app that treats that invalidation as an error shows a failure at the exact moment continuation worked; at least one shipping app surfaces "SharePlay is not available" right there.

**Do not reuse the `.activationDisabled` handling here.** That result means "play locally"; `false` means the TV is *already* playing. Transplanting the local-playback branch gives you duplicate playback on two devices. Apple documents no pattern for the `false` branch, and every Apple sample simply writes `_ = try await activity.activate()` after gating on `prepareForActivation()` — discarding the value is the demonstrated norm.

Failure is the throwing path: `activate()` throws "if a call isn't active or a session wasn't created".

**Receiving a continued activity on tvOS needs no special code.** It is the ordinary `for await session in MyActivity.sessions()` loop — the iOS and tvOS module interfaces differ by a single line, and everything tvOS withholds is spatial or initiation API. Set `metadata.supportsContinuationOnTV = true` and handle sessions normally. Apple documents no further requirement, and its own Destination Video sample ships one multiplatform target, one bundle ID, no `activityIdentifier` override, no extra entitlement, and no Info.plist key. A separate tvOS target is *not* required — a shipping third-party SDK sets the flag with no tvOS target at all.

Watch for `NSGroupActivitiesIdentifier` in AI-generated setup instructions: **no such Info.plist key exists.**

When `isEligibleForGroupSession` is `false`, don't call either one. Present `GroupActivitySharingController` (iOS 15.4+, macOS 13+), which shows the people picker and starts FaceTime itself. It lives in a cross-import overlay, so it needs `import UIKit` (or `import AppKit` on macOS); the `init(_:)` form **throws**; and after a `.success` result you must **not** also call `activate()`.

There is no such controller on tvOS, and no transfer representation either — a tvOS app can only receive sessions started from another device.

Collapsing `.activationDisabled` and `.cancelled` into one "didn't work" branch is a real bug: the first means *play it locally*, the second means *do nothing*.

## Owning the session

This is where correctness is won or lost. One long-lived controller owns the session, the messengers, the journal, and every observation task, so they share a single lifetime.

```swift
@MainActor
final class ListenTogetherController {
    private var session: GroupSession<ListenTogether>?
    private var commands: GroupSessionMessenger?
    private var journal: GroupSessionJournal?
    private var tasks = Set<Task<Void, Never>>()

    func listen() async {
        for await session in ListenTogether.sessions() {
            configure(session)
        }
    }

    private func configure(_ session: GroupSession<ListenTogether>) {
        tearDown()
        self.session = session
        self.commands = GroupSessionMessenger(session: session)
        self.journal = GroupSessionJournal(session: session)

        startObservers(for: session)
        prepareLocalState(for: session.activity)
        session.join()                 // LAST: messages arriving before the receive
                                       // loops exist are dropped, not queued
    }

    private func tearDown() {
        tasks.forEach { $0.cancel() }
        tasks.removeAll()
        journal = nil
        commands = nil
        session = nil
    }
}
```

`GroupSession` is a `final class` conforming to `ObservableObject` and is **not** `Sendable`. `GroupSessionMessenger` and `GroupSessionJournal` *are* `@unchecked Sendable`, and `Sessions` is `Sendable` when the activity is. So the session must stay in one isolation domain while the things you derive from it may travel — which is exactly why a single owning controller beats observing from a view.

Retain the messenger and journal. Neither survives on its own, and a released messenger simply stops delivering.

Run the `listen()` loop at `App` / `WindowGroup` scope, never from a view's `.task`. A view-scoped task is cancelled when that view goes away, and since the system may launch your app in the background (below), the session can arrive when no view exists at all.

**Your app can be launched into the background by a SharePlay session.** Apple: *"To create a smoother user experience, the system might launch your app in the background when starting an activity. Apps can start activities in either the foreground or background."* That is a supported path, not an edge case — the suggested adaptation is to play media picture-in-picture rather than fullscreen. If you genuinely cannot proceed without the user (credentials, a purchase, a content gate), call `requestForegroundPresentation()`, which asks the system to surface your app. It silently does nothing unless the session is `.waiting` or `.joined`, so check state first.

`sessions()` yields only *new* sessions; it never re-emits when a live session changes. State, activity, and participants each need their own observation. `state` has three cases — `.waiting`, `.joined`, `.invalidated(reason:)` — and both `leave()` and `end()` land in `.invalidated`. The difference is that an ended session can never be rejoined. Calling either on an already-invalidated session is forbidden.

### Catching up late joiners

The framework tells you *who* joined; sending them current state is your job. The idiomatic delta depends on a Combine detail:

```swift
session.$activeParticipants
    .sink { [weak self] active in
        guard let self, let session = self.session else { return }
        // session.activeParticipants is still the PREVIOUS set inside this sink,
        // because @Published publishes from willSet.
        let joiners = active
            .subtracting(session.activeParticipants)
            .filter { $0 != session.localParticipant }   // the set includes you
        guard !joiners.isEmpty else { return }
        self.sendSnapshot(to: .only(joiners))
    }
    .store(in: &cancellables)
```

Rewrite that against `@Observable` or an AsyncSequence and `subtracting` returns an empty set — no crash, no warning, late joiners silently never receive state. The bug needs three participants and a late join to appear at all.

**`.receive(on:)` breaks it the same way, and is far likelier to appear.** Wiring this publisher into a `@MainActor` controller invites a reflexive `.receive(on: DispatchQueue.main)`, which defers the sink past the `willSet` and zeroes the delta — a one-line "cleanup" no reviewer would flag. If you would rather not depend on the timing at all, carry the previous set inside the pipeline and the hazard disappears:

```swift
session.$activeParticipants
    .scan((previous: Set<Participant>(), current: Set<Participant>())) { acc, next in
        (previous: acc.current, current: next)
    }
    .map { $0.current.subtracting($0.previous) }
    .filter { !$0.isEmpty }
    .sink { [weak self] joiners in self?.sendSnapshot(to: joiners) }
    .store(in: &cancellables)
```

That form survives `.receive(on:)`, and it is the one to reach for when someone will later "modernize the Combine".

**Every existing participant sees the same joiner.** There is no host, so with N participants a late join triggers N−1 snapshots at one device — possibly divergent, and the snippet above gives the joiner no way to choose. Either version the snapshot (a counter plus the originating participant ID, applied only if newer) or elect a single sender deterministically, e.g. the lowest participant ID among the incumbents. There is no AsyncSequence for `state`, `activity`, or `activeParticipants`; Combine is the supported surface here, not legacy baggage. When you do want an async sequence, bridge with `session.$activeParticipants.values` — Apple's own doc comments use that form.

**`activeParticipants` includes `localParticipant`.** Apple's sample for `isNearbyWithLocalParticipant` filters with `$0 != session.localParticipant`, which would be dead code otherwise. So every "is anyone else here?" test needs that filter, and `activeParticipants.count` counts *you* — and counts devices, not people, since one person on two devices produces two `Participant` values. Participant identity is device-and-session identity, never an account.

## Distributed state

**Two messengers, not one.** `deliveryMode` is a `let` set at construction and neither `send` overload takes a mode, so an app that wants both must build both:

```swift
let commands = GroupSessionMessenger(session: session)                          // .reliable
let live     = GroupSessionMessenger(session: session, deliveryMode: .unreliable)
```

`.reliable` guarantees delivery **and** FIFO order — but explicitly not *timeliness*. Apple: *"we guarantee that messages will be received on all the devices, but that doesn't mean that they'll be received at the time that they're expecting it."* A dropped message is retried and arrives late. So `.reliable` trades latency for completeness; `.unreliable` guarantees **neither** delivery nor ordering and trades the reverse.

Use `.unreliable` only for values immediately superseded — drag positions, hover state, and the *cosmetic* remote scrub handle. Mind that distinction: the scrub **preview** others watch during your drag is ephemeral presence and belongs here; the resulting **playback position** is timeline state and belongs to the playback coordinator, never the messenger — see axiom-media (`skills/shareplay-playback.md`).

Follow a burst with exactly one **reliable** commit, and treat that as mandatory rather than belt-and-braces: if the final unreliable packet drops, every remote preview freezes at the wrong value permanently with nothing to correct it. Coalesce the burst too — the rate limit is unpublished, so throttle well under your input rate (a 60 Hz touch stream at ~20 Hz is a reasonable starting point) and measure rather than assume. Neither mode reaches participants who left or who join later; that's what the journal and your snapshot are for.

Two limits, both of which throw from `send`: a **256 KB** payload cap (raised from 64 KB in iOS 16), and an unpublished burst rate — sending in a tight loop can fail. Coalesce.

Give each message type its own receive task rather than one loop with a type switch:

```swift
private func startObservers(for session: GroupSession<ListenTogether>) {
    guard let commands else { return }

    tasks.insert(Task { [weak self] in
        for await (change, context) in commands.messages(of: QueueEdit.self) {
            await self?.apply(change, from: context.source)
        }
    })
}
```

Messages should be small, `Codable`, `Sendable`, versioned, and idempotent — identified by stable entity IDs so a duplicated or stale operation can't corrupt state.

**The journal is a snapshot, not a stream.** Its `Attachments` sequence yields `[Attachment]` — the *entire current set*, every iteration, to everyone including whoever just uploaded. Apple states the reconciliation rule directly: *"Remove any attachments from your app that aren't still in the array."* Diff against local state; never append. Never `load(_:)` an attachment you added yourself.

Three things Apple documents only in passing:

- **`add(_:)` can return before the upload finishes.** Its return is not a delivery receipt, so don't flip UI to "shared" on return.
- **Attachments outlive the uploader.** They survive that participant disconnecting and are removed only when *everyone* leaves. There is no TTL.
- **`remove(attachment:)` is global** — "from the journal on all sessions" — and nothing restricts it to the uploader. You hold other participants' `Attachment` values from the sequence, so removal is unilateral and there is no documented conflict-resolution rule.

Attachments cap at **100 MB** each, and both caps are stated in Apple's written docs, not just on stage. Messenger payloads and journal attachments are both end-to-end encrypted on the same FaceTime channel.

**The journal has no gate.** Apple: *"Don't use a `GroupSessionJournal` object to store files larger than 100 megabytes, or when you need to protect or validate content before someone downloads it. Instead, store those files on your company's server and let participants download them from there."* There is no hook to check entitlements, moderate, or validate before a participant downloads. Anything requiring a gate belongs on your server, with the journal carrying at most a reference.

## What to share

Sort state into four buckets before writing any sync code. (This split is Axiom's framing, not Apple's, but the constraints behind it are Apple's.)

| Bucket | Examples | Transport |
|--------|----------|-----------|
| Shared canonical | selected track, queue order, playback position | messenger + playback coordinator |
| Participant-local | volume, captions, audio route, accessibility presentation | never synchronized |
| Ephemeral presence | transient selection and gesture state | unreliable messenger |
| Private | credentials, account details, local file paths | never leaves the device |

Apple's guidance on conflicts is deliberately blunt: *"consider implementing a simple rule, like last change wins"*, and *"Avoid the temptation to create complicated permissions systems or turn-taking mechanisms."* Last-writer-wins is the example, not the mandate — but the bar it sets is low on purpose. If your conflict rule needs a diagram to explain, you have built the turn-taking system Apple just told you not to build.

## Spatial SharePlay (visionOS)

Enough to avoid the traps; template and role design is a larger subject.

- `SystemCoordinator` comes from the session (`session.systemCoordinator`) and drives spatial behavior. Its `Observable` conformance is marked `unavailable` on **every** platform including visionOS — a dead conformance. Observe it through its AsyncSequences, not `@Observable`.
- `SpatialTemplatePreference` offers `.none`, `.sideBySide`, and `.conversational` from visionOS 1, but `.surround` and `.custom(_:)` require **visionOS 2**. Gate accordingly or you get a compile error.
- `groupImmersionStyle` and `groupActivityAssociation` live in the SwiftUI cross-import overlay — `import SwiftUI` alongside `import GroupActivities`.
- `Participant.isNearbyWithLocalParticipant` exists on **iOS 26 too**, not just visionOS — but it is unavailable on macOS, tvOS, and Mac Catalyst. It is **always `true` for the local participant**, so an unfiltered `contains { $0.isNearbyWithLocalParticipant }` always reports someone nearby. Filter with `$0 != session.localParticipant` first.
- Simulated FaceTime participants in the simulator **never assign roles**, so role reservation cannot be tested there. Don't chase that as a bug.
- `SystemCoordinator.defaultInitiatorRole` (visionOS 2) is documented only in the SDK — no WWDC session or sample covers it; they teach `assignRole` instead. `remoteParticipantStates` (visionOS 26) has **no doc comment at all**. Expect to reason from signatures for both.

## Common Mistakes

- Burying the `sessions()` loop in a view whose identity can change, so the session is dropped or duplicated
- Calling `join()` before local state is ready, then racing the first inbound message
- Assuming the initiator is a host who stays for the whole session
- Synchronizing volume, captions, or audio route because they *look* like shared state
- Broadcasting playback position over the messenger instead of using a playback coordinator
- Accumulating an uncancelled `Task` per view appearance
- Treating `.reliable` as "everyone eventually gets this" — it excludes leavers and late joiners

## Testing checklist

Two devices joining is not a test matrix. Cover:

- [ ] Start with no active call (sharing controller path)
- [ ] Start during an existing call (`prepareForActivation()` path)
- [ ] Start from the share sheet or `ShareLink` (transfer representation)
- [ ] A participant joins late — full state reconstruction
- [ ] A participant leaves and rejoins — new session delivered, old one torn down
- [ ] The initiator leaves — session survives (or ends, if `lifetimePolicy` says so)
- [ ] `leave()` vs `end()` — correct group semantics
- [ ] App backgrounds and returns
- [ ] Same person on two devices — participant identity assumptions
- [ ] Rapid transient input — coalescing and unreliable delivery
- [ ] Activity changes in place — model and UI replacement

Real testing needs multiple physical devices with distinct Apple IDs.

## Resources

**WWDC**: 2021-10183, 2021-10187, 2021-10184, 2022-10140, 2023-10239, 2023-10241

**Docs**: /groupactivities, /groupactivities/groupsession, /groupactivities/groupsessionmessenger, /groupactivities/groupsessionjournal, /xcode/configuring-group-activities

**Skills**: shareplay-ref, axiom-media (shareplay-playback), axiom-concurrency (swift-concurrency)
