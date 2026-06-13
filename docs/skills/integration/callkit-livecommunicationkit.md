---
name: callkit-livecommunicationkit
description: VoIP calling with CallKit, the PushKit rule, LiveCommunicationKit, and caller ID/blocking with IdentityLookup
skill_type: skill
version: 1.0
apple_platforms: iOS 10+ (LiveCommunicationKit 17.4+, Live Caller ID Lookup 18+)
---

# CallKit & LiveCommunicationKit

CallKit integrates your VoIP app with the system call UI — the full-screen incoming-call screen, the lock screen, Recents, Do Not Disturb, and audio routing. LiveCommunicationKit (iOS 17.4+) extends the model to Apple Watch and visionOS and powers default calling/dialer apps. IdentityLookup handles caller identification, blocking, and message filtering.

Part of the **axiom-integration** suite (`skills/callkit-livecommunicationkit.md` and `skills/callkit-livecommunicationkit-ref.md`).

## When to Use

Use this skill when you're:
- Building a VoIP calling app (incoming/outgoing calls, hold, mute, DTMF)
- Wiring VoIP push notifications to the system call UI
- Diagnosing "my app gets killed" / "VoIP pushes stopped arriving"
- Fixing call audio that's silent, routed wrong, or doesn't start
- Reaching Apple Watch / visionOS, or becoming a default calling/dialer app
- Identifying or blocking spam callers, or filtering messages

## Example Prompts

- "My VoIP app gets killed when a call comes in"
- "How do I report a CallKit call from a PushKit push?"
- "Why is my call audio silent?"
- "How do I make an outgoing call with CallKit?"
- "How do I block spam callers?"
- "What's LiveCommunicationKit for?"

## Key Concepts

### The PushKit rule (the one that bricks your app)

When built against the iOS 13 SDK or later, **every VoIP push must report a call to CallKit** via `reportNewIncomingCall(...)` before the push handler's `completion()` runs. If it doesn't, iOS terminates your app and stops delivering VoIP pushes entirely. Report the call immediately with what you have, then do the network round-trip. Never use VoIP pushes for non-call data.

### CallKit owns the audio session

You configure the audio category, but CallKit activates the session. Start audio only in `provider(_:didActivate:)` and stop it in `provider(_:didDeactivate:)`. Activating `AVAudioSession` yourself produces silent or misrouted audio.

### Fulfill every action

System-initiated actions (`provider(_:perform:)` for answer/end/hold/mute/DTMF) must call `action.fulfill()` or `.fail()`, or the call gets stuck and times out.

### LiveCommunicationKit complements CallKit

It's not a replacement — it expands the model to watchOS 10.4+ and visionOS 1.1+ and enables default calling (`com.apple.developer.calling-app`, iOS 18.2+) and default dialer (`com.apple.developer.dialing-app`, EU) apps. Use CallKit on iOS as the baseline.

### Caller ID: bulk vs real-time

`CXCallDirectoryProvider` supplies a bulk, offline, ascending-ordered list to identify/block — no runtime lookups. Live Caller ID Lookup (iOS 18+, `LiveCallerIDLookupManager`) does real-time identification via Private Information Retrieval so your server never learns who's calling whom.

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| Not reporting a call on a VoIP push | App killed, pushes cut off | `reportNewIncomingCall` before `completion()` |
| Network work before reporting | Push times out | Report first, fetch after |
| Activating `AVAudioSession` yourself | Silent / misrouted audio | Start audio in `provider(_:didActivate:)` |
| Not fulfilling a `CXAction` | Stuck call | `fulfill()` / `fail()` every action |
| VoIP push for non-call data | Same kill penalty | Use APNs / UserNotifications |
| Expecting runtime lookups from a Call Directory | No live data | Use Live Caller ID Lookup (iOS 18+) |

## Related

- [Push Notifications](/skills/integration/push-notifications) – PushKit VoIP vs APNs delivery
- For the call audio session category (`.playAndRecord`), see the axiom-media suite
- For LiveCommunicationKit on Apple Watch, see the axiom-watchos suite

## Resources

**WWDC**: 2016-230, 2019-707, 2020-10113

**Docs**: /callkit, /callkit/cxprovider, /callkit/cxcallcontroller, /callkit/cxproviderdelegate, /pushkit, /livecommunicationkit, /livecommunicationkit/conversationmanager, /identitylookup, /identitylookup/livecalleridlookupmanager
