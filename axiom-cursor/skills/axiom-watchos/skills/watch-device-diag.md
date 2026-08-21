# Apple Watch Device Connection Diagnostics

## When to Use This Skill

Use when:
- Xcode will not install, launch, or attach to an Apple Watch
- The Watch is missing from Device Hub, the run-destination list, or `devicectl list devices`
- The Watch appears but shows `unavailable`, or the app installs but LLDB never attaches
- Data is not moving between the iPhone and watchOS apps and you do not yet know whether the transport or the app is at fault
- You are about to unpair a Watch, delete DerivedData, or run a forum command against CoreDevice

#### Related Skills

- Use `watch-connectivity.md` once you have proven the Xcode connection is healthy — that skill owns `WCSession` design
- Use axiom-tools (`skills/device-control-ref.md`) for the full Device Hub / devicectl / simctl tool map
- Use axiom-security (`skills/code-signing-diag.md`) when installation fails with a signing or provisioning error

## Core Principle

**There are two independent developer connections, and confusing them wastes the most time.**

1. **Mac/Xcode → Apple Watch** — CoreDevice. Installs, launches, attaches LLDB.
2. **iPhone app ↔ watchOS app** — WatchConnectivity. Moves your app's data.

Beneath both sits a third thing that is not a developer connection at all: the **consumer pairing** between the Watch and its iPhone, the one users set up in the Watch app. It is the substrate the other two ride on, and it is the one people destroy by reflex when either of the developer layers misbehaves. Keep it named and separate — Device Hub's unpair acts on layer 1, not on this.

These fail separately. A Watch can be perfectly consumer-paired to its iPhone while the CoreDevice tunnel is broken. Xcode can work fine while a `WCSession` design incorrectly treats momentary unreachability as failure.

The expensive mistake is redesigning WatchConnectivity to compensate for an Xcode tunnel problem. Before touching `WCSession` code, prove which layer is broken.

## Diagnose the Broken Layer First

| Observation | Layer at fault |
|---|---|
| Watch shows disconnected in the iPhone's Watch app | Consumer pairing (Bluetooth/Wi-Fi) — not a developer problem yet |
| Watch absent from Device Hub and `devicectl` | CoreDevice discovery, trust, Developer Mode, or network |
| Watch present but `unavailable` | CoreDevice transport, Developer Mode, OS/Xcode compatibility |
| Watch appears, app will not install | Signing, deployment target, bundle association, device preparation |
| App installs and launches, LLDB fails | Debugger attachment / tunnel — **not** your app code |
| Both apps run, data does not arrive | `WCSession` lifecycle or wrong transfer API — see `watch-connectivity.md` |
| `isReachable == false` | Usually normal. Does **not** mean the Watch is disconnected |

#### If a rewrite is already underway

Anyone reaching for this skill after losing a day has usually started "fixing" the wrong layer already. Stop before adding to it: stash or branch the in-progress work, run the **original** code with the debugger detached, and only then decide whether it was ever broken. Diagnosing against a half-rewritten sync layer means you can no longer tell which layer you are measuring — and if the tunnel was the fault, the rewrite was never tested against a working baseline in the first place.

Two cheap tests separate "Xcode problem" from "app problem":

- **Run without the debugger attached**, or install a TestFlight build. If the app behaves correctly without LLDB, the defect is in the tunnel, not your code.
- **Install through Device Hub's Apps panel.** If that succeeds but Xcode cannot run with the debugger, you have isolated the problem to launch/attach rather than pairing or signing.

## Start With devicectl, Not a Clean Build

`devicectl` is the command-line interface to the same device stack Xcode and Device Hub use, so it reports the truth about the connection instead of a symptom of it.

```bash
xcrun devicectl list devices
```

The summary table collapses several independent states into one column, so read the structured output:

```bash
xcrun devicectl list devices --json-output /tmp/dev.json --omit-deprecated-fields-in-json
```

```python
import json
for d in json.load(open("/tmp/dev.json"))["result"]["devices"]:
    p = d["properties"]
    print(p["state"].get("name"),
          p["hardware"]["platform"],
          p["connection"]["state"],                      # connected / disconnected / unavailable
          p["connection"]["pairingState"],               # paired / …
          list(p["state"].get("developerModeStatus", {}))) # ["enabled"] / ["disabled"]
```

**`pairingState` and `connection.state` are orthogonal.** A Watch reading `unavailable` in the table is very often `pairingState: paired` — fully paired, with no tunnel. Reading "unavailable" as "not paired" is what sends people to unpair and re-pair, which cannot fix a tunnel and destroys the evidence.

Three physical devices in one real listing, all `pairingState: paired`:

| Device | `connection.state` | Developer Mode | Meaning |
|---|---|---|---|
| iPhone | `disconnected` | enabled | Prepared; simply not attached right now |
| Apple Watch | `unavailable` | **disabled** | Paired, but cannot be used for development |
| iPad | `connected` | **disabled** | Attached, yet still unusable — no DDI can mount |

The iPad row is the one to internalize: **`connected` does not mean usable.** Developer Mode gates the Developer Disk Image, so a device can be attached and still refuse to run your build.

**Reason from the JSON values, never the table's.** The two vocabularies differ: `connection.state` is `connected` / `disconnected` / `unavailable`, while the summary table's State column prints its own strings such as `available (paired)` and `connected (no DDI)`. A developer pasting the table will hand you words that do not appear in the API at all.

Interpret the result before doing anything else:

- **Watch absent** — stop investigating app code, signing, and `WCSession`. Fix pairing and discovery.
- **Watch present but `unavailable` or sparsely populated** — investigate transport, trust, Developer Mode, OS/Xcode compatibility, network.
- **Watch `connected`** — install via Device Hub, then narrow to launch/attach.

An `unavailable` row is also **sparsely populated**: `transportType` and `bootState` drop out of it entirely, while a merely `disconnected` device still carries both. So never derive "is this a simulator" from `transportType` — the field vanishes on exactly the rows you are debugging. Use `hardware.reality`, which is always present. See axiom-tools (`skills/device-control-ref.md`).

## Developer Mode Is Not Inherited From the iPhone

**Enable Developer Mode on the Apple Watch itself.** Pairing a Watch to a Developer-Mode iPhone does not enable it on the Watch. This is the single most common cause of a paired Watch that Xcode refuses to use, and nothing in the summary table names it — `devicectl` reports it only as `state.developerModeStatus`.

On the Watch: **Settings → Privacy & Security → Developer Mode**, turn it on, tap **Turn On** at the prompt, and restart the device. Then re-read `developerModeStatus` and confirm it flipped before changing anything else. The whole fix is about two minutes, which is why it is worth ruling out before every heavier step below.

The status encodes an enum as a single-key dictionary whose payload differs per case — `{"enabled":{"mode":1}}` versus `{"disabled":{}}` — so test for key presence (`"enabled" in status`) and never compare the whole value. Simulators omit the field entirely.

`devicectl device pairings` is the watch-specific surface and is worth knowing before you touch Device Hub's UI:

```bash
xcrun devicectl device pairings list        # what the Mac believes is paired
xcrun devicectl device pairings set-active  # choose which watch/phone pair is active
xcrun devicectl device pairings pair
xcrun devicectl device pairings unpair
```

`set-active` matters when more than one Watch is paired to the same iPhone: only the active pairing is usable, so a second Watch can be present, paired, and still unreachable with no error that says so.

## The Most Reliable Physical-Device Setup

For an iPhone running **iOS 26 or earlier, keep the paired iPhone connected to the Mac by USB while running on the Watch.** Apple's Device Hub documentation requires this for earlier iOS versions. Xcode 27 adds direct wireless Device Hub pairing for devices on iOS/watchOS 27, but the USB-connected iPhone remains the best diagnostic baseline — reach for it first when anything is wrong, regardless of OS version.

Baseline:

- Connect the paired iPhone to the Mac by USB.
- Pair and prepare the **iPhone first**, then the Watch.
- Enable Developer Mode on **both** iPhone and Watch.
- Accept the trust prompts on both devices.
- Keep the Watch unlocked, awake, near the iPhone, and preferably charging during preparation.
- For wireless, use a simple Bonjour-capable network with IPv6 enabled. Avoid guest networks, client isolation, VPNs, and corporate filtering while diagnosing.
- Grant **Xcode** Local Network permission (System Settings → Privacy & Security → Local Network). Watch development runs over the local network, and a denial here produces a silent, permanent `unavailable` with no error text anywhere.
- Match Xcode to the installed OS. Testing a beta OS requires the corresponding Xcode beta — and with both installed, `xcode-select -p` decides which one is in play. A Watch on a beta watchOS will never become available under a release Xcode.

**Give discovery time before escalating.** A Watch typically moves `unavailable` → `connecting` → `available` over 30–60 seconds; `devicectl list devices` also takes `--timeout`, and Apple's own tooling notes that a longer timeout may be needed to detect paired Apple Watches specifically. Judging the state instantly is how people talk themselves down the ladder into an unpair they never needed.

In Xcode 27 the entry point is **Device Hub**, which exposes pairing, device information, app installation, diagnostic reports, and sysdiagnose capture independently of your project. On earlier Xcode releases the equivalent is Devices and Simulators, or Manage Run Destinations.

For a serious watchOS project a dedicated iPhone–Watch test pair is worth the hardware. Keep the two OS versions reasonably aligned and reinstall both app halves together. Mismatched iOS/watchOS releases, or mismatched iPhone/Watch builds of your own app, produce installation and `WCSession` failures that look exactly like transport problems.

## Recovery Ladder — Least Destructive First

Match the step to the layer you identified. Do not start at the bottom.

**Before any step below that restarts, unpairs, or removes anything — capture diagnostics.** Steps 4–6 destroy the state that makes the failure reportable, and a reproducible bug you cannot evidence is worth far less than one you can. This is a precondition, not a final step.

1. Unlock and wake both devices; confirm the Watch is connected normally in the iPhone's Watch app.
2. Connect the iPhone by USB and reopen Device Hub.
3. Verify Developer Mode and trust on both devices. When a trust dialog was dismissed or fails to appear, Apple recommends restarting the device.
4. Restart the Watch and iPhone. Restart the Mac only if CoreDevice/Device Hub is still stuck.
5. Unpair and re-pair the Watch **from Device Hub** (or `devicectl device pairings`). This acts on the developer pairing only — it does not erase the consumer pairing with the iPhone. Roughly two minutes, against 30+ for the full unpair-from-iPhone cycle people reach for by reflex. When someone insists on "just re-pair it", this is that idea done cheaply, and it belongs here rather than at step 1.
6. Remove both development app installs and deploy a fresh, matching iPhone/Watch build.
7. Retest on a simple network with VPNs, proxies, security filters, and unusual network extensions disabled, to separate an Xcode defect from machine or network configuration. A VPN's packet-filter rules can block USB device communication outright — see TN3158.

### What Not to Start With

| Reflex | Why it is wrong |
|---|---|
| Delete DerivedData | Fixes stale compilation products. Device discovery and pairing are owned by CoreDevice/Device Hub, which DerivedData has nothing to do with |
| Delete CoreDevice directories, or kill Apple daemons from a forum post | Destroys the evidence you need and typically creates a different failure state |
| Unpair the Watch from the iPhone | A 30+ minute round trip that cannot fix a tunnel problem. Try the Device Hub unpair (step 5) first |
| Redesign `WCSession` because the debugger dropped | The tunnel and WatchConnectivity are different layers. Prove it with a no-debugger run first |

One Xcode 27 workaround is worth knowing but belongs at the very bottom: when direct Watch pairing hangs at "Waiting to Pair" with no PIN, powering the companion iPhone **off** has been reported to let the Watch and Mac complete direct Device Hub pairing. This is anecdotal, and it applies to the new watchOS 27 direct-pairing path, not the normal iOS 26 USB workflow.

## A Broken Connection Is Not a Release Blocker

Before treating this as ship-stopping, note what does **not** need a working developer connection to the Watch:

- **Archiving.** Product → Archive and Distribute work with nothing attached; the watch app ships inside the iOS app bundle.
- **TestFlight as a physical smoke test.** Install the build on the phone and let the watch app install through the Watch app on iPhone. That path needs no developer pairing at all, so it works tonight even if `devicectl` never says `connected`.
- **A paired simulator pair** exercises `WCSession` delegate wiring, payload types, and transfer-API choice well enough to validate correctness. Background *timing* there is not representative, and the queued transfers are not fully implemented — so it proves the code shape, not the delivery.

Ship the artifact, then keep diagnosing. Deadline pressure is what turns a two-minute Developer Mode fix into a 40-minute unpair.

## Capturing an Actionable Apple Bug Report

When the failure reproduces:

1. Record exact Xcode, macOS, iOS, and watchOS versions **and builds**.
2. Record whether `devicectl list devices` showed the Watch, and its `connection.state` / `pairingState` / `developerModeStatus`.
3. Capture the complete Xcode error domain, code, and operation name.
4. Note whether installation **without** the debugger succeeded.
5. Trigger a sysdiagnose immediately after reproducing.
6. File Feedback with the smallest reproducing project and the exact timestamp.

Device Hub surfaces diagnostic reports, and `devicectl diagnose` gathers diagnostics from the local system and connected devices. Supply profiles, logs, and a reproducible case — not a screenshot of Xcode's final error.

**`devicectl diagnose` cannot reach the device this skill is about.** It collects only from devices **with a mounted Developer Disk Image**, and Developer Mode gates the DDI — so for the headline case (a Watch that is `unavailable` with Developer Mode disabled) you get host-side CoreDevice logs and nothing from the Watch. Those host logs are still the evidence worth filing; just do not report them as watch-side diagnostics, and capture a sysdiagnose from the Watch itself when you need its side of the story.

## The Highest-Leverage Workflow

USB baseline → verify with Device Hub/`devicectl` → install without the debugger → instrument `WCSession` independently → capture local logs and sysdiagnose **before** resetting anything.

## Common Mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Reading `unavailable` as "not paired" | Unpair/re-pair cycles that change nothing | Read `pairingState` and `connection.state` separately from `--json-output` |
| Assuming Developer Mode is inherited from the paired iPhone | Watch stays `unavailable` forever; no error explains why | Enable Developer Mode on the Watch itself; confirm via `state.developerModeStatus` |
| Treating `connected` as usable | Device attaches, builds still refuse to run | Developer Mode gates the DDI — check it even when the state says `connected` |
| Running on the Watch with the iPhone unplugged on iOS 26 or earlier | Intermittent install/attach failures that look random | Keep the paired iPhone on USB; that is the documented requirement |
| Debugging `WCSession` because the debugger detached | Days spent redesigning a working data layer | Run without the debugger or install a TestFlight build first |
| Deleting DerivedData as step one | No change; real cause still unexamined | Start with `devicectl list devices` |
| Diagnosing on a VPN or corporate Wi-Fi | Wireless pairing fails inconsistently | Move to a simple IPv6/Bonjour network before concluding anything |
| Xcode denied Local Network permission | Permanent `unavailable` with no error text anywhere | Grant it in System Settings → Privacy & Security → Local Network |
| Judging the state the instant the command returns | Escalating down the ladder while discovery was still in progress | Allow 30–60s for `unavailable` → `connecting` → `available`; raise `--timeout` |
| Treating a broken connection as ship-stopping | Panic unpair the night before release | Archive and TestFlight need no developer pairing — ship, then diagnose |
| Mismatched iPhone/Watch app builds | Installation and `WCSession` failures that mimic transport faults | Reinstall both halves together from the same build |
| Resetting before capturing a sysdiagnose | Reproducible bug becomes unreportable | Capture diagnostics as a precondition of the ladder, before any step that restarts, unpairs, or removes |

## Resources

**Docs**: /xcode/devices-and-simulator, /xcode/running-your-app-in-simulator-or-on-a-device, /technotes/tn3158-resolving-xcode-15-device-connection-issues, /watchos-apps/building_a_watchos_app

**Skills**: axiom-watchos (watch-connectivity, platform-basics), axiom-tools (device-control-ref), axiom-security (code-signing-diag)
