
# SharePlay Coordinated Playback — Discipline

When a SharePlay activity plays media, **AVFoundation owns the timeline** — not your messenger. A playback coordinator negotiates play, pause, seek, rate, stalls, and interruptions across every participant, and hands you an absolute host-clock time to start at.

For session lifecycle, activation, and non-media state, see axiom-integration (`skills/shareplay.md` and `skills/shareplay-ref.md`).

## Core mental model

The coordinator is not a message bus with `play` and `pause` verbs. It is a **clock agreement protocol**, and the reason you cannot rebuild it over the messenger is concrete rather than stylistic: **you cannot measure one-way delay with one-way messages on unsynchronized clocks.** `Date()` differs between devices by tens of milliseconds and steps under NTP, so a `sentAt` subtraction yields transit *plus* an unknown, moving clock offset. Feed that into last-writer-wins convergence and you have an unstable control loop — shortening the broadcast interval raises the gain and diverges faster. It tells you *when*, in `CMClockGetHostTimeClock()` terms, playback should begin at a given item time — which is why you cannot reproduce it by broadcasting positions over `GroupSessionMessenger`. The messenger has no clock.

Two paths, and the difference is large:

| Player | Coordinator | Suspensions |
|--------|-------------|-------------|
| `AVPlayer` | `AVPlayerPlaybackCoordinator` (already attached at `player.playbackCoordinator`) | automatic — audio interruptions, stalls, interstitials |
| Custom engine (AVAudioEngine, SFBAudioEngine, a game mixer) | `AVDelegatingPlaybackCoordinator` | **none — you begin and end every one** |

That asymmetry is the whole risk. The delegating coordinator adds no automatic safety net.

## System Requirements

| Capability | Minimum |
|------------|---------|
| `AVPlaybackCoordinator`, `AVPlayerPlaybackCoordinator`, `AVDelegatingPlaybackCoordinator` | iOS 15+ / macOS 12+ / tvOS 15+ / visionOS 1+ |
| All six built-in suspension reasons | iOS 15+ |
| `AVPlaybackCoordinationMedium` (local multi-player) | iOS 26+ / macOS 26+ / tvOS 26+ / visionOS 26+ |

**Not available on watchOS** — the entire coordinator surface is `API_UNAVAILABLE(watchos)`, matching GroupActivities itself.

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| Nothing retains the adapter | The coordinator holds `playbackControlDelegate` **weakly** | Retain it yourself; playback silently goes local otherwise |
| Starting playback on receipt of a play command | Every device starts at a different wall-clock moment | Schedule against `hostClockTime` |
| Resuming after a seek command | Desynchronizes the group | Wait for the next play command |
| Suspension begun and never ended | Other participants wait on you | Always pair begin with end |
| Acting on a stale command | Wrong track plays | Check `expectedCurrentItemIdentifier` |
| Expecting automatic suspensions | Only `AVPlayerPlaybackCoordinator` provides them | A custom engine begins and ends every one |
| Reaching for `AVPlaybackCoordinationMedium` | It excludes delegating coordinators and conflicts with a group session | Use `coordinateWithSession` |

## When to Use This Skill

- Adding SharePlay to an audio or video app
- Adapting a custom playback engine to `AVDelegatingPlaybackCoordinator`
- Playback drifts, starts at the wrong time, or won't start until someone seeks
- A participant stalls and everyone else keeps going (or hangs forever)
- Deciding what belongs on the coordinator vs the messenger

## Connect it to the session

```swift
import AVFoundation
import GroupActivities

for await session in ListenTogether.sessions() {
    player.playbackCoordinator.coordinateWithSession(session)
    session.join()
}
```

That is the entire AVPlayer integration. Keep driving `AVPlayer` through its normal interface — `play()`, `pause()`, `seek(to:)` — and the coordinator negotiates the result with the group. Do **not** also send play/pause over the messenger; you will fight the coordinator.

## The custom-engine contract

Four required methods on `AVPlaybackCoordinatorPlaybackControlDelegate`, all sharing one overloaded Swift name. There is no rate-change callback — rate is an input you send, not something you're asked to honor.

Make the engine an `actor` (or otherwise `Sendable`). A plain class engine reached by `await` from a `@MainActor` adapter is a Swift 6 error — *"sending `self.engine` risks causing data races"* — because the call sends a non-`Sendable` value across isolation.

```swift
actor MyAudioEngine { /* schedulePlayback, pause, seek, buffer */ }

@MainActor
final class EngineAdapter: NSObject, AVPlaybackCoordinatorPlaybackControlDelegate {
    private let engine: MyAudioEngine
    private lazy var coordinator = AVDelegatingPlaybackCoordinator(playbackControlDelegate: self)

    init(engine: MyAudioEngine) {
        self.engine = engine
        super.init()
    }

    func playbackCoordinator(_ coordinator: AVDelegatingPlaybackCoordinator,
                             didIssue playCommand: AVDelegatingPlaybackCoordinatorPlayCommand) async {
        // Schedule against the host clock — never "start now".
        await engine.schedulePlayback(atItemTime: playCommand.itemTime,
                                      hostTime: playCommand.hostClockTime,
                                      rate: playCommand.rate)
    }

    func playbackCoordinator(_ coordinator: AVDelegatingPlaybackCoordinator,
                             didIssue pauseCommand: AVDelegatingPlaybackCoordinatorPauseCommand) async {
        await engine.pause(buffering: pauseCommand.shouldBufferInAnticipationOfPlayback)
    }

    func playbackCoordinator(_ coordinator: AVDelegatingPlaybackCoordinator,
                             didIssue seekCommand: AVDelegatingPlaybackCoordinatorSeekCommand) async {
        await engine.seek(to: seekCommand.itemTime)
        // Do NOT resume here — wait for the next play command.
    }

    func playbackCoordinator(_ coordinator: AVDelegatingPlaybackCoordinator,
                             didIssue bufferingCommand: AVDelegatingPlaybackCoordinatorBufferingCommand) async {
        // completionDueDate is nullable; anticipatedPlaybackRate says what to prepare for.
        await engine.buffer(until: bufferingCommand.completionDueDate)
    }
}
```

**`hostClockTime` is the sync primitive.** From the header: *"the host clock time (see `CMClockGetHostTimeClock()`) defining when playback should start (or should have started) at the given itemTime."* If that time is already past, you're late — skew the item time forward by your lateness rather than starting at the original `itemTime`.

**It is a *presentation* time, and your render callback's timestamp is not.** `AVPlayer` gets this compensation free; a custom engine does not. Subtract your whole output chain before scheduling:

```
anchor = hostClockTime
       − hostTicks(AVAudioSession.sharedInstance().outputLatency
                 + AVAudioSession.sharedInstance().ioBufferDuration
                 + engine.outputNode.presentationLatency
                 + yourRingBufferDepth)
```

Skip this and two participants on different routes sit **130–190 ms apart** with a perfectly correct anchor — AirPods add ~150–200 ms, built-in speaker ~10–20 ms. Re-read these on `AVAudioSession.routeChangeNotification` and re-anchor if the total moves; a route change alters the mapping without moving the content.

**Seek does not imply resume.** If the rate was non-zero, pause and wait for the coordinator to issue another play command. Resuming on your own desynchronizes the group.

The delegate is held **weakly** (`@property (nonatomic, readonly, weak) playbackControlDelegate`). An adapter that nothing else retains stops receiving commands silently — no error, no crash, playback simply goes local.

### The outbound half — without it, your play button reaches nobody

The four delegate methods are only what the group tells *you*. You never call them yourself. To push local intent out, call the coordinator:

```swift
func userTappedPlay()  { coordinator.coordinateRateChange(to: 1.0, options: []) }
func userTappedPause() { coordinator.coordinateRateChange(to: 0,   options: []) }
func userCommittedSeek(to t: CMTime) { coordinator.coordinateSeek(to: t, options: []) }
```

Implement only the delegate and you have built a **receive-only adapter**: it follows the group perfectly and can never lead it. `AVDelegatingPlaybackCoordinatorRateChangeOptions` and `...SeekOptions` carry the fine-grained variants; `[]` is the correct default.

### Item identity

Every command carries `expectedCurrentItemIdentifier`. If it doesn't match what you're playing, the command is stale — ignore it, but **still return** (the async method returning *is* the completion; skipping it hangs the coordinator). Commands also carry `originator`, which is who caused the action.

Tell the coordinator about track changes yourself — and mind the second parameter:

```swift
var timebase: CMTimebase?
CMTimebaseCreateWithSourceClock(allocator: kCFAllocatorDefault,
                                sourceClock: CMClockGetHostTimeClock(),
                                timebaseOut: &timebase)
if let timebase {
    CMTimebaseSetTime(timebase, time: itemTime)
    CMTimebaseSetRate(timebase, rate: Double(rate))
}
coordinator.transitionToItem(withIdentifier: track.id, proposingInitialTimingBasedOn: timebase)
```

**`proposingInitialTimingBasedOn: nil` does not mean "no opinion".** Apple: *"If NULL, the coordinator will assume that playback is paused at `kCMTimeZero`."* For a gapless player auto-advancing mid-playback, passing `nil` silently tells the room you stopped. Pass `nil` only when you really are starting paused at zero.

The *identifier* may separately be `nil` — that means nothing is playing, and it is how you stop coordinating. Two different parameters, two different meanings.

Also note Apple's constraint: this "is not a way to affect the play queue of other participants. All other participants must do this independently." Queue changes travel over your messenger; only timing travels over the coordinator.

`currentItemIdentifier` reads back what the coordinator believes is current, and `reapplyCurrentItemStateToPlaybackControlDelegate()` re-issues state after your engine recovers.

## Suspensions

Any time local playback diverges from the group, you must wrap it:

```swift
// Retain the token — you cannot end a suspension you didn't keep.
self.suspension = coordinator.beginSuspension(for: .audioSessionInterrupted)
// ... interruption handled, engine ready again ...
suspension.end()                                  // move ME to the group
suspension.end(proposingNewTime: recoveredTime)   // move the GROUP to me
```

**Pick between them by asking who should move.** After an interruption, a stall, or buffering, you were absent and the group kept going: use `end()` and rejoin them. Only a deliberate user action — a committed scrub — justifies `end(proposingNewTime:)`, which drags everyone to your position. Getting this backwards makes one person's phone call rewind the whole room, which is the same failure as hand-rolled position sync, just through a supported API. A proposed time is also ignored unless yours is the last suspension.

| Reason | When |
|--------|------|
| `.audioSessionInterrupted` | Phone call, Siri, another app took the session |
| `.stallRecovery` | Buffer underrun |
| `.playingInterstitial` | Ad or interstitial on your timeline only |
| `.coordinatedPlaybackNotPossible` | You cannot honor the group's state at all |
| `.userActionRequired` | Sign-in, purchase, content gate |
| `.userIsChangingCurrentTime` | Scrubbing in progress |

`AVCoordinatedPlaybackSuspensionReason` is `NS_TYPED_EXTENSIBLE_ENUM` — the header notes you may also pass a custom string, so treat this as the built-in set rather than a closed one.

A suspension you never end can hang the group — but only for reasons listed in the coordinator's `suspensionReasonsThatTriggerWaiting`, and only while the group is smaller than the reason's participant limit (default `NSIntegerMax`, i.e. always wait). Those are the actual levers if you need a reason to stop blocking others:

```swift
coordinator.suspensionReasonsThatTriggerWaiting = [.stallRecovery]
coordinator.setParticipantLimit(4, forWaitingOutSuspensionsWithReason: .stallRecovery)
let limit = coordinator.participantLimitForWaitingOutSuspensions(withReason: .stallRecovery)
```

To decide whether it is safe to end a suspension while others kept playing, ask the coordinator where the group is now:

```swift
let groupItemTime = coordinator.expectedItemTime(atHostTime: CMClockGetTime(CMClockGetHostTimeClock()))
```

The header calls this out specifically for ending a `.stallRecovery` suspension — but it is also your **drift probe**, and it costs no network traffic. Sample it on a slow timer to compare where you are against where the group expects you to be.

Startup sync is not the whole job. Independent crystals (±50 ppm) accumulate roughly 12 ms over a four-minute track. Two remedies, and the right one depends on your product: a fractional rate trim (±0.3% is ~5 cents, inaudible) nulls it continuously but **is resampling** — forbidden if you claim bit-perfect output. Otherwise re-anchor at gapless track boundaries, which bounds error at ~15 ms indefinitely with no DSP, and accept one discontinuity inside any single item longer than ~15 minutes.

## Swift 6 isolation

Conform with the **async** variants. A `@MainActor` type conforming via the `completionHandler:` variants fails to compile under `#ConformanceIsolation`; the async spellings compile clean. Clean options: `@MainActor` + async methods, `nonisolated` methods, or an actor.

## Local multi-player coordination

`AVPlaybackCoordinationMedium` (26.0) synchronizes several **local** players in one process — multiview, camera angles, commentary tracks.

It is **not** a general transport, and two constraints matter:

- It works only with `AVPlayerPlaybackCoordinator`. The header states plainly: *"we exclude AVDelegatingPlaybackCoordinators."* A custom engine cannot use it.
- It is **mutually exclusive** with a group session on the same coordinator. Connecting to a medium while already connected to a session populates `outError`, and a medium-connected coordinator "is not available to coordinate with a group session."

Only one direction of that exclusivity is documented. `coordinateUsingCoordinationMedium(_:error:)` reports the conflict; `coordinateWithSession(_:)` returns `Void` and **cannot** — it predates the medium by eleven OS versions and has no error channel. What it does when the coordinator is already on a medium is undocumented, so don't rely on it failing loudly. Disconnect first by passing `nil` to `coordinateUsingCoordinationMedium(_:error:)`, then connect the session.

So for SharePlay with a custom engine, `coordinateWithSession` is the only path.

## Common Mistakes

- Broadcasting the current time over `GroupSessionMessenger` on a timer — reinvents clock agreement, seek ordering, startup barriers, and stalls, badly
- Starting playback immediately on a play command instead of scheduling to `hostClockTime`
- Resuming after a seek command instead of waiting for the next play command
- Beginning a suspension and never ending it, hanging every other participant
- Letting the adapter be deallocated because the coordinator only holds it weakly
- Acting on commands whose `expectedCurrentItemIdentifier` doesn't match the current track
- Reaching for `AVPlaybackCoordinationMedium` to talk to remote participants

## Testing checklist

- [ ] Two devices start together — playback begins in sync, not "close enough"
- [ ] Late joiner receives correct position and starts aligned
- [ ] One device stalls — group waits, then recovers via `.stallRecovery`
- [ ] Incoming phone call — `.audioSessionInterrupted` begins and ends
- [ ] Scrub on one device — `.userIsChangingCurrentTime`, then group follows the commit
- [ ] Track change — `transitionToItem` propagates, stale commands ignored
- [ ] Rate change (0.5×, 2×) propagates
- [ ] Mid-session route change — AirPods connect during playback (the most common real-world desync)
- [ ] Long session — still in sync at minute 40, not just at start
- [ ] App backgrounds and returns without losing coordination
- [ ] Content unavailable on one account — `.coordinatedPlaybackNotPossible`, group not blocked forever

## Resources

**WWDC**: 2021-10225, 2023-10239, 2024-10114, 2025-302

**Docs**: /avfoundation/avplaybackcoordinator, /avfoundation/avdelegatingplaybackcoordinator, /avfoundation/avplayerplaybackcoordinator, /avfoundation/avcoordinatedplaybacksuspension

**Skills**: axiom-integration (shareplay, shareplay-ref), avfoundation-ref, now-playing
