---
name: shareplay-overview
description: Everything Axiom knows about SharePlay and GroupActivities — session lifecycle, distributed state, and coordinated media playback
skill_type: overview
version: 1.0
apple_platforms: iOS 15+, macOS 12+, tvOS 15+, visionOS 1+ (not watchOS)
---

# SharePlay

SharePlay gives your app a private, system-provided realtime channel between people already together on a FaceTime or Messages call — no account system, no invitations, and no transport of your own to build and operate.

## The three SharePlay skills

Axiom's SharePlay coverage is three skills. Each one's examples show the kind of question it answers, not the limit of what it covers.

- **[shareplay](/skills/integration/shareplay)** – Session lifecycle, activation, distributed state, and a short spatial section for visionOS. *Examples*: adding SharePlay at all; a session that never arrives; late joiners getting no state; participants appearing twice.
- **[shareplay-playback](/skills/integration/shareplay-playback)** – The media timeline, which AVFoundation owns rather than your messenger. *Examples*: syncing audio or video across participants; adapting a custom audio engine instead of `AVPlayer`.
- **[shareplay-ref](/reference/shareplay-ref)** – Full API surface, availability matrix, and deprecation table. *Examples*: looking up a signature, an availability floor, or a deprecation.

## Example Prompts

- "How do I add SharePlay to my app?"
- "My `GroupSession` never activates — what am I missing?"
- "How do I send current state to someone who joined late?"
- "How do I sync playback across SharePlay participants?"
- "How do I adopt `AVDelegatingPlaybackCoordinator` with my custom audio engine?"
- "What's the full list of `GroupActivityMetadata.ActivityType` values?"

## Five things that bite everyone

These cut across all three skills. Each one produces code that looks correct, compiles, and is wrong.

**`GroupSession` is not `Sendable`, and Combine is not legacy here.** It's a framework `ObservableObject` you cannot redeclare. There is no AsyncSequence for `state`, `activity`, or `activeParticipants`. Worse, the standard late-joiner delta depends on `@Published` publishing from `willSet` — so migrating it to `@Observable`, or even adding a reflexive `.receive(on:)`, silently returns an empty set and late joiners never receive state. No crash, no warning.

**There is no host.** Every participant is equal; the framework has no owner and no turn-taking concept. That means every existing participant independently sees a newcomer, so N−1 devices will each send a catch-up snapshot unless you version them or elect one sender.

**`activate()` returning `false` is a success.** It means no session will be delivered to *your* app — stop waiting, don't retry, don't call `end()`. An Apple TV handoff is one case where that happens, not the definition. Failure throws instead.

**The messenger has no clock.** Playback position is not messenger data. Broadcasting positions on a timer cannot work, because you cannot measure one-way delay with one-way messages on unsynchronized clocks — and last-writer-wins convergence is an unstable control loop, so shortening the interval makes it diverge faster. Use a playback coordinator.

**watchOS is not supported at all**, and tvOS has no way to *start* SharePlay — no sharing controller, no transfer representation. On tvOS, sessions can only arrive by continuation from another device.

## Limits worth knowing before you design

| Thing | Value |
|---|---|
| Messenger payload | 256 KB (64 KB before iOS 16) |
| Journal attachment | 100 MB |
| Journal pre-download validation | none — protected content belongs on your server |
| Entitlement | `com.apple.developer.group-session` |
| Info.plist keys | none |
| Excluded targets | widgets, extensions, App Clips |

## Related

- [swift-concurrency](/skills/concurrency/swift-concurrency) – Isolation rules governing how you own a `GroupSession`

## Resources

**WWDC**: 2021-10183, 2021-10187, 2022-10140, 2023-10239, 2023-10241, 2021-10225

**Docs**: /groupactivities, /groupactivities/groupsession, /avfoundation/avplaybackcoordinator, /xcode/configuring-group-activities
