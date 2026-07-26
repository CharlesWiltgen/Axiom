---
name: shareplay-playback
description: SharePlay coordinated media playback with AVPlayerPlaybackCoordinator and custom-engine adaptation via AVDelegatingPlaybackCoordinator
skill_type: skill
version: 1.0
apple_platforms: iOS 15+, macOS 12+, tvOS 15+, visionOS 1+ (not watchOS)
---

# SharePlay Coordinated Playback

When a SharePlay activity plays media, AVFoundation owns the timeline — not your messenger. A playback coordinator negotiates play, pause, seek, rate, stalls, and interruptions across every participant, and hands you an absolute host-clock time to start at.

Part of Axiom's SharePlay coverage — start at the [SharePlay overview](/SharePlay) if you're not sure which page you need.

One skill in the **axiom-media** suite: `skills/shareplay-playback.md`. Session lifecycle, activation, and non-media state live in [shareplay](/skills/integration/shareplay).

## When to Use

Use this skill when you're:
- Adding SharePlay to an audio or video app
- Adapting a custom playback engine (AVAudioEngine, SFBAudioEngine, a game mixer) to `AVDelegatingPlaybackCoordinator`
- Debugging playback that drifts, starts late, or won't start until someone seeks
- Handling a participant who stalls while everyone else keeps playing
- Deciding what belongs on the coordinator versus the messenger

## Example Prompts

- "How do I sync playback across SharePlay participants?"
- "How do I adopt `AVDelegatingPlaybackCoordinator` with my custom audio engine?"
- "My coordinated playback drifts between devices."
- "When should I begin an `AVCoordinatedPlaybackSuspension`?"
- "Why does playback stay local when I call `play()`?"

## Key Concepts

### The coordinator is a clock agreement protocol

It is not a message bus with `play` and `pause` verbs. `AVDelegatingPlaybackCoordinatorPlayCommand.hostClockTime` tells you *when*, in `CMClockGetHostTimeClock()` terms, playback should begin at a given item time. That is why broadcasting positions over `GroupSessionMessenger` cannot reach parity — the messenger has no clock.

### Two paths, and the difference is large

With `AVPlayer` the coordinator already exists at `player.playbackCoordinator`; connect it with `coordinateWithSession(_:)`, keep driving the player normally, and interruptions, stalls, and interstitials produce **automatic** suspensions.

With a custom engine you adopt `AVDelegatingPlaybackCoordinator`, which adds **no** automatic suspensions. You begin and end every one yourself.

### The custom-engine contract is four methods

`AVPlaybackCoordinatorPlaybackControlDelegate` requires play, pause, seek, and buffering handlers — all sharing one overloaded Swift name, `playbackCoordinator(_:didIssue:)`. There is no rate-change callback. The coordinator holds the delegate **weakly**, so an adapter nothing else retains stops receiving commands silently.

### A suspension you never end can hang the group

Six built-in reasons cover the cases — audio session interruption, stall recovery, interstitials, coordinated playback not possible, user action required, and scrubbing — and the type is extensible, so custom strings are allowed. Blocking happens only for reasons listed in `suspensionReasonsThatTriggerWaiting`, and only below that reason's limit set via `setParticipantLimit(_:forWaitingOutSuspensionsWithReason:)`; those are the levers if you need to stop blocking others. To decide whether it is safe to end one while others kept playing, ask `expectedItemTime(atHostTime:)` where the group is now.

### `AVPlaybackCoordinationMedium` is not your transport

It synchronizes several **local** players (multiview, camera angles, commentary). It excludes delegating coordinators entirely, and it is mutually exclusive with a group session on the same coordinator.

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| Broadcasting current time on a timer | Reinvents clock agreement, badly | Use the playback coordinator |
| Starting playback immediately on a play command | Drift on every device | Schedule to `hostClockTime` |
| Resuming after a seek command | Desynchronizes the group | Wait for the next play command |
| Beginning a suspension and never ending it | Other participants wait on you, for the waiting-triggering reasons | Always pair begin with end |
| Letting the adapter be deallocated | Playback silently goes local | Retain it; the coordinator won't |
| Acting on stale commands | Wrong track plays | Check `expectedCurrentItemIdentifier` |

## Related

- [shareplay](/skills/integration/shareplay) – Session lifecycle and activation, which you need before any playback coordination happens
- [GroupActivities reference](/reference/shareplay-ref) – `coordinateWithSession(_:)` and the surrounding session API
- [avfoundation-ref](/reference/avfoundation-ref) – The wider AVFoundation playback surface

## Resources

**WWDC**: 2021-10225, 2023-10239, 2024-10114, 2025-302

**Docs**: /avfoundation/avplaybackcoordinator, /avfoundation/avdelegatingplaybackcoordinator, /avfoundation/avcoordinatedplaybacksuspension
