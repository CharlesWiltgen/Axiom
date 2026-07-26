---
name: shareplay
description: GroupActivities session lifecycle, activation, and distributed state with correct Swift 6 isolation and late-joiner catch-up
skill_type: skill
version: 1.0
apple_platforms: iOS 15+, macOS 12+, tvOS 15+, visionOS 1+ (not watchOS)
---

# SharePlay

SharePlay gives your app a private, system-provided realtime channel between people already together in FaceTime or Messages — no account system, no invitations, and no transport of your own to build and operate.

Part of Axiom's SharePlay coverage — start at the [SharePlay overview](/SharePlay) if you're not sure which page you need.

Two skills in the **axiom-integration** suite: `skills/shareplay.md` (discipline) and `skills/shareplay-ref.md` (API reference). Coordinated media playback lives separately, in [shareplay-playback](/skills/integration/shareplay-playback).

## When to Use

Use this skill when you're:
- Adding SharePlay to an app, or debugging why a session never arrives
- Deciding what to synchronize and what to keep local to each participant
- Choosing between `prepareForActivation()`, `activate()`, and `GroupActivitySharingController`
- Picking a transport: messenger, journal, or playback coordinator
- Fixing late joiners who never receive state, or participants appearing twice
- Hitting Swift 6 isolation errors around `GroupSession`

For coordinated audio or video playback, see [shareplay-playback](/skills/integration/shareplay-playback). For the full API surface, see the [GroupActivities reference](/reference/shareplay-ref).

## Example Prompts

- "How do I add SharePlay to my app?"
- "My GroupSession never activates — what am I missing?"
- "Should I call `prepareForActivation()` or `activate()`?"
- "How do I send current state to someone who joined late?"
- "Why do I see two participants when only one person joined?"
- "How do I share images during a group activity?"

## Key Concepts

### Apps advertise activities; the system creates sessions

You define a `GroupActivity`. You never construct a `GroupSession` — sessions arrive asynchronously, one per running instance, from `Activity.sessions()`. Keep the activity small: it describes enough to *locate or begin* the shared experience, not the experience's mutable state.

### There is no host

Every participant is equal. The framework has no owner, no authority, and no turn-taking concept. Apple's guidance on conflicts is deliberately blunt — pick a simple, consistent rule and avoid building permissions systems. The one related control is `lifetimePolicy` (iOS 18+), which decides whether the activity ends when its initiator leaves.

### `GroupSession` is not `Sendable`, and Combine is not legacy here

`GroupSession` is a framework `ObservableObject`. There is no AsyncSequence for `state`, `activity`, or `activeParticipants`, and `@Published` publishes from `willSet` — which is exactly what makes the standard late-joiner delta work:

```swift
session.$activeParticipants
    .sink { active in
        // session.activeParticipants is still the PREVIOUS set here
        let joiners = active
            .subtracting(session.activeParticipants)
            .filter { $0 != session.localParticipant }   // the set includes you
        sendSnapshot(to: .only(joiners))
    }
```

Rewriting that against `@Observable` returns an empty set. No crash, no warning — late joiners silently never receive state.

### Three transports, chosen by what you're sending

Small time-sensitive commands go through `GroupSessionMessenger` (256 KB per payload). Files and large objects go through `GroupSessionJournal` (100 MB per attachment), which hands every participant the entire current attachment set on each iteration — so late joiners need no snapshot code, though you must reconcile against that array every iteration rather than appending to it. Media timelines belong to a playback coordinator, never to the messenger.

### Your app can be launched in the background

The system may start your app in the background when a session arrives — a supported path, not an edge case. Adapt (Apple suggests picture-in-picture over fullscreen), or call `requestForegroundPresentation()` when you genuinely can't proceed without the user. That call does nothing unless the session is `.waiting` or `.joined`.

### `deliveryMode` is fixed at construction

An app that needs both reliable commands and unreliable transient state builds **two** messengers on the same session. Neither `send` overload takes a mode.

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| Migrating `GroupSession` to `@Observable` | Late joiners silently get no state | Keep Combine observation |
| Observing the session from a SwiftUI view | Swift 6 isolation errors; dropped sessions | One owning controller |
| One messenger for both delivery modes | Half your protocol silently unsupported | Construct two messengers |
| Treating `activate()`'s `false` as failure | Spinning, retrying, or calling `end()` when no session is coming | `false` = no session will be delivered to you; failure throws |
| Reading `activeParticipants.count` as people | One person on two devices counts twice | It's a device count |
| Loading your own journal attachments | Wasted work and duplicate state | Skip what you uploaded |

## Related

- [shareplay-playback](/skills/integration/shareplay-playback) – Coordinated audio and video playback, which owns the media timeline instead of the messenger
- [GroupActivities reference](/reference/shareplay-ref) – Full API surface, availability matrix, and the deprecation table
- [swift-concurrency](/skills/concurrency/swift-concurrency) – Isolation rules that govern how you own a `GroupSession`

## Resources

**WWDC**: 2021-10183, 2021-10187, 2022-10140, 2023-10239, 2023-10241

**Docs**: /groupactivities, /groupactivities/groupsession, /xcode/configuring-group-activities
