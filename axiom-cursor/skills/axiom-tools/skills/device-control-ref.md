## Cursor MCP Tool Boundary

The `xclog`, `xcsym`, and `xcprof` examples below are reference syntax, not executable commands for Cursor. Map each subcommand to the same-named MCP tool—for example, `xclog launch` to `axiom_xclog_launch`, `xcsym crash` to `axiom_xcsym_crash`, and `xcprof record` to `axiom_xcprof_record`—and preserve its arguments as structured fields. Do not run a bare helper binary. If a required MCP tool is unavailable, stop and report that the Axiom MCP integration is missing; do not fall back to a same-named executable.

## Cursor UI Tool Availability

`xcui` is an external tool and is not bundled with the Cursor plugin; it has no Axiom MCP wrapper. Before UI automation, check `command -v xcui`. If it is absent, AXe fallback is limited to compatible input verbs: `tap`, `slider`, `type`, `swipe`, `drag`, `touch`, `gesture`, `button`, `key`, `key-sequence`, `key-combo`, and `screenshot`. Then check `command -v axe` before that fallback and handle `DEVELOPER_DIR` explicitly if AXe reports a SimulatorKit loading error. AXe cannot replace `wait`, `assert`, `a11y`, `dialog`, `voiceover`, `resize`, or `doctor`. If neither tool is available, stop UI automation, explain the external setup requirement, and continue only with non-UI simulator and log checks. If AXe exists but the requested workflow requires an xcui-only capability, stop that UI workflow and report the limitation.

# Device Control Reference — Device Hub, devicectl, simctl

The Xcode-independent surface for driving simulators and physical devices: which tool owns
what, and what each one costs to run. Device Hub (the Xcode 27 GUI) is a front-end over
`devicectl`/`simctl` — every operation has a scriptable, headless counterpart, so a full
dev/CI loop needs no running Xcode.

## Tool map — what each owns, and what it needs

| Tool | Owns | Needs Xcode running? |
|------|------|----------------------|
| `devicectl` (CLI) | configure + interact with a booted sim OR physical device through one `-d <udid>` selector; install/launch/inspect; capture screenshots + screen recordings; status-bar overrides incl. a `screenshot` preset; drive free resize (`appResize`) `OS27`; stable `--json-output` | No |
| `simctl` (CLI) | simulator lifecycle (create/boot/shutdown/erase) + sim-only state: push, privacy permissions, media, `openurl`, `ui appearance`; shares the `status_bar` override store with devicectl and solely owns `--operatorName` | No |
| `xcui` (Axiom) | drive in-app UI + accessibility tree (tap/assert, VoiceOver order); toggle a11y settings | No |
| `xclog` (Axiom) | capture simulator/device console | No |
| `xcsym` (Axiom) | symbolicate crashes (`.ips`, MetricKit, `.crash`) | No |
| `xcprof` (Axiom) | record/analyze xctrace CPU & network profiles | No |
| Device Hub (GUI) | visual front-end over devicectl/simctl — canvas, inspector; auto-launches on build-and-run | No (Xcode 27 installed, but needn't be open) |
| `mcpbridge` (Xcode MCP) | IDE tools — build, test, render previews, project read | 26.x: **yes**. 27: no, via headless `mcp-server` (needs a `sudo` opt-in) `OS27` |

**Answer to "control the device without Xcode running":** all of it.
`devicectl` + `simctl` + Axiom's `xcui`/`xclog`/`xcsym`/`xcprof` cover the full scriptable
surface headlessly with no privilege escalation. On Xcode 27 the MCP bridge joins them —
`sudo xcrun mcp-server enable` runs the tool service with Xcode.app closed
(`axiom-xcode-mcp`) — so uptime is no longer what separates them `OS27`.

Pick on **capability and privilege** instead. `xcui` asserts, waits, toggles accessibility
settings, and computes VoiceOver announcements, and the whole CLI set runs unprivileged —
decisive in CI, where `sudo` is often unavailable. MCP owns what only the IDE knows: build
state and rendered previews. On Xcode 26.x the old rule still holds — `mcpbridge` alone
needs a running Xcode with a project open.

## devicectl — the Core Device CLI

`devicectl` (Xcode 15+, replaces the legacy `idevice*` tools) installs, launches, inspects, and
configures devices from the command line. `xcrun devicectl list devices` returns a **unified
inventory of physical devices *and* simulators**, distinguished by a `Reality` column
(`physical` / `simulated`).

The pre-existing surface is materially identical across the 26 and 27 toolchains — same
subcommands and flags, verified against both (the exact binary build advances between beta seeds,
so don't pin one). Xcode 27 adds: the `appResize` family (below), `devicectl device settings
voiceover`, and a service-side change letting `simctl` and `devicectl` reboot a simulator via
`reboot`.

```bash
# Unified inventory: physical + simulated (--json-output for CI)
xcrun devicectl list devices

# Install / launch / inspect by identifier (sim UDID or device id — same -d)
xcrun devicectl device install app --device <udid> MyApp.app
xcrun devicectl device process launch --device <udid> com.your.bundleid
xcrun devicectl device info apps --device <udid>
xcrun devicectl device info processes --device <udid>
```

**Parse the structured `--json-output`, not the human-readable text.** devicectl guarantees the
JSON is versioned and stable across releases; its human-readable output is explicitly *not* stable
(simctl's human output never carried that guarantee either — the stability contract, not the
unified `-d` syntax, is the real CI win).

**Use the `properties` dictionary.** The older top-level `hardwareProperties`, `deviceProperties`,
and `connectionProperties` keys are deprecated in favor of one `properties` dictionary and will be
removed; the `tags` key is already gone. Pass `--omit-deprecated-fields-in-json` to drop them now
and prove a parser is forward-compatible. The fields worth keying off:

| Field | Values | Always present |
|---|---|---|
| `properties.hardware.reality` | `physical` / `simulated` | Yes |
| `properties.hardware.deviceType` | `iPhone`, `iPad`, `appleWatch`, … | Yes |
| `properties.hardware.platform` | `iOS`, `watchOS`, … | Yes |
| `properties.connection.state` | `connected` / `disconnected` / `unavailable` | Yes |
| `properties.connection.pairingState` | `paired`, … | Yes |
| `properties.state.developerModeStatus` | single-key dict: `{"enabled":{}}` / `{"disabled":{}}` | Physical only |
| `properties.connection.transportType` | `sameMachine` (sim) / `localNetwork` / `wired` | **No** |
| `properties.state.bootState` | `booted` / `shutdown` | **No** |

**Read `reality` directly; never derive it from `transportType`.** `transportType` and `bootState`
are absent on a physical device with no active connection — precisely the device you are debugging.
A parser that infers physical-vs-simulated from `transportType` misclassifies or throws on exactly
the rows that matter. `hardware.reality` is a literal field and is always populated.

`developerModeStatus` encodes an enum as a single-key dictionary, so test key presence
(`"enabled" in status`), not a string compare. `connection.lastConnectionDate` is a number in this
schema (seconds from the 2001 epoch) where the deprecated keys carried an ISO-8601 string — a
silent type change to catch when migrating.

For reading these states on an Apple Watch that will not appear or will not run, see
axiom-watchos (`skills/watch-device-diag.md`).

### Interaction vs lifecycle — devicectl does NOT replace simctl

devicectl **configures and interacts** with a booted device/sim; it has no `create`/`boot`/`erase`.
simctl still owns the simulator lifecycle and the sim-only features.

| Need | Tool |
|------|------|
| create / boot / shutdown / erase a sim | `xcrun simctl boot\|shutdown\|erase` |
| pick the test destination | `xcodebuild -destination` |
| configure / interact with a booted sim or device | `xcrun devicectl` |
| push, privacy permissions, media, openurl | `xcrun simctl` (sim-only) |
| status bar overrides for screenshots | either — same store; `devicectl` adds a `screenshot` preset, `simctl` owns `--operatorName` |

CI order is unchanged at the front: simctl or xcodebuild boots the sim → devicectl configures it
→ run tests.

### Simulator-capable subcommands (verified on Xcode 26.6 + 27.0)

| Subcommand | On simulator | Use |
|------------|--------------|-----|
| `device info displays` | works (verified) | bounds, pointScale, nativeSize, `framebufferMaskIdentifier` (exact JSON keys) |
| `device capture screenshot` / `screen-record` | works (verified) | PNG / H.264 `.mp4` capture, sim or device — see Screen capture below |
| `device orientation get` (also `set`, `rotate`) | works (`get` verified) | orientation without entering the app |
| `device settings biometrics [--enable\|--disable]` | works (verified) | enroll / unenroll Face ID / Touch ID |
| `device simulate biometrics --success\|--failure` | works (verified) | drive a match / no-match |
| `device settings appearance --mode light\|dark` | works (verified) | force Dark/Light; also `--look-and-feel clear\|tinted`, text size, contrast |
| `device settings voiceover --enable\|--disable` (also `device info voiceover`) | works (verified) `OS27` | toggle VoiceOver — the one a11y toggle `xcui` omitted for lack of a mechanism |
| `device simulate location` | available | inject location |
| `device simulate statusBar` (`preset`/`override`/`show`/`clear`) | works (verified) | clean status bar for screenshots — see Status bar for screenshots below |
| `device process sendMemoryWarning` | available | memory-pressure scenarios |
| `device info lockState` / `info files` / `copy` / `profile *` | physical-device-only | see caveat below |

**Face ID / Touch ID is devicectl-only** — simctl has no biometric command (enrolling/matching was
a GUI-only Simulator menu, unscriptable):

```bash
SIM=$(xcrun simctl list devices booted | grep -Eo '[0-9A-F-]{36}' | head -1)
xcrun devicectl device settings biometrics -d "$SIM" --enable    # enroll
xcrun devicectl device simulate biometrics -d "$SIM" --success   # match (--failure for the reject path)
xcrun devicectl device settings biometrics -d "$SIM" --disable   # restore
```

The flags are `--success` / `--failure` (mutually exclusive) — **not** `--match`.

**Physical-device-only capabilities** on a simulator fail with a distinct, detectable error — not a
crash, not a silent no-op:

```
ERROR: The capability "Get Lock State" is not supported by this device.
       (com.apple.dt.CoreDeviceError error 1001)
```

`info lockState` is confirmed device-only; `info files`, `copy`, and `profile *` are reported
device-only on simulators. In CI, treat `CoreDeviceError 1001` as "skip on simulator", not a failure.

## Screen capture — screenshot & video

`devicectl device capture` is the **unified** capture path: one `-d <udid>` selector across
simulators and physical devices, the same stable `--json-output`, and — for video — a
`--duration` auto-stop that makes it the only script/CI-friendly recorder of the options here.
Present and verified on **both Xcode 26.6 and 27.0** (not new in 27 — another instance of the
"materially identical across 26 and 27" CLI).

```bash
# Screenshot — destination MUST end in .png
xcrun devicectl device capture screenshot -d <udid> --destination shot.png

# Screen recording — destination MUST end in .mp4; --duration auto-stops (else Ctrl+C)
xcrun devicectl device capture screen-record -d <udid> --destination clip.mp4 --duration 5
```

| Flag | screenshot | screen-record | Notes |
|------|------------|---------------|-------|
| `--destination` | `.png` only | `.mp4` only | wrong extension is a hard error, not a coercion |
| `--display-unique-id` | yes | yes | pick from `device info displays`; omit = primary display |
| `--codec` | — | `h264` (default), `hevc` | |
| `--mask-policy` | — | `ignored` (default), `premultipliedAlpha`, `black` | bezel mask for non-rectangular displays |
| `--duration <s>` | — | auto-stop after N seconds | omit = record until SIGINT |

Verified on a booted iOS 26.5 simulator (screenshot → 1206×2622 PNG; screen-record → h264
`.mp4`) with both the 26.6 and 27.0 toolchains. The physical-device path uses the same command
and `-d` selector by design; it was not re-verified here against wired hardware.

### Fallbacks (simulator-only)

Reach for these only when devicectl capture doesn't fit — none reach a physical device:

| Tool | Use | Watch out |
|------|-----|-----------|
| `simctl io <udid> screenshot [--type png] <file>` | sim PNG; `-` writes to stdout | sim only |
| `simctl io <udid> recordVideo [--codec h264\|hevc] [--mask ignored\|alpha\|black] <file>` | sim video to a `.mov` | default codec is `hevc` (devicectl defaults `h264`); stop with SIGINT; sim only |
| `axe record-video --output f.mp4` / `axe stream-video` | sim video / live preview stream (mjpeg, jpeg, ffmpeg, bgra) | sim only; `record-video` stops on Ctrl+C — see `axiom-xcode-mcp (skills/axe-ref.md)` |

## Status bar for screenshots

A shipping screenshot needs a clean status bar — 9:41, full bars, full battery. On a simulator
both tools write the **same override store**: a `devicectl` override shows up in
`simctl status_bar list`, and either tool's `clear` empties the other's view. Pick by toolchain,
not by effect.

### Fastest path — the `screenshot` preset

```bash
SIM=$(xcrun simctl list devices booted | grep -Eo '[0-9A-F-]{36}' | head -1)
xcrun devicectl device simulate statusBar preset -d "$SIM" screenshot
xcrun devicectl device capture screenshot -d "$SIM" --destination shot.png
xcrun devicectl device simulate statusBar clear -d "$SIM"
```

| Preset | Applies |
|---|---|
| `screenshot` | 9:41, battery 100 `charged`, cellular `active` 4 bars, `LTE`, Wi-Fi `active` 3 bars (verified readback) |
| `low-battery` | 5% draining, weak signals |
| `no-service` | no cellular or Wi-Fi |
| `charging` | 50% charging, moderate signals |

`screenshot` picks **LTE** (not 5G) and `charged` (a green charging battery, not a plain full
one). It rewrites every field it owns, so it is safe to re-run over a dirty state — unlike a bare
`override`, below.

**The preset also sets the carrier to the literal string `Carrier`** — the placeholder
`screenshot-validator` flags as a defect. It is invisible on Dynamic Island iPhones, but renders on
iPad and older iPhones, and you **cannot** correct it afterward: `operatorName` refuses to overwrite
an existing value (below). For any device that shows a carrier name, skip the preset and use the
`simctl` path with an explicit `--operatorName` in the same `override` call.

**`devicectl`'s subcommand set tracks a machine-wide component, not `xcode-select`.** Every
`devicectl` binary defers to `/Library/Developer/PrivateFrameworks/CoreDevice.framework` — one copy
per machine, upgraded by the newest Xcode installed — so selecting an older Xcode does *not* hand
you an older `devicectl`, and a second Xcode on the machine changes what the first one can do. Probe
the capability instead of inferring it from an Xcode version:

```bash
xcrun devicectl device simulate statusBar --help >/dev/null 2>&1 \
  && echo "statusBar available" || echo "fall back to simctl"
```

### simctl — sim-only, and the only way to set a carrier name

`devicectl` has no operator-name flag.

```bash
xcrun simctl status_bar "$SIM" clear                     # first — override merges
xcrun simctl status_bar "$SIM" override \
  --time "9:41" --dataNetwork lte --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --operatorName "Your Co" \
  --batteryState charged --batteryLevel 100
```

That is the preset's look with a real carrier name (verified readback). For a Wi-Fi-only status
bar, drop **every** cellular flag — see the `wifi` trap below:

```bash
xcrun simctl status_bar "$SIM" override --time "9:41" \
  --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100
```

`--operatorName` only renders alongside a cellular override, and Dynamic Island iPhones show no
carrier name at all — set it for iPad and older-iPhone shots; don't debug its absence on an
iPhone 17.

### Clear first; verify by readback, never by exit code

`override` **merges** into whatever is already set, and some values silently fail to land. All of
these **exit 0**:

| Silent failure | Stored result | Changes the capture? |
|---|---|---|
| `--dataNetwork wifi` alongside any `--cellularMode`, even `notSupported` | `5G` | No — the data label isn't drawn while Wi-Fi is active. Breaks readback assertions only |
| `--dataNetwork wifi` over an existing data-network value | old value (`LTE`, `hide`) survives | Only on a Wi-Fi-only shot, where the label renders |
| `--operatorName` over an existing carrier name | first value survives, including the preset's `Carrier` | Yes, on iPad and older iPhones |

Other values overwrite normally (`LTE` replaces `wifi`, `hide` replaces `LTE`), so a script reads
as working until the one case that changes pixels lands in a shipped screenshot.

```bash
xcrun devicectl device simulate statusBar clear -d "$SIM"          # always, before override
xcrun devicectl device simulate statusBar override -d "$SIM" --time "9:41" --battery-level 100
xcrun devicectl device simulate statusBar show -d "$SIM" --json-output -    # assert on this
```

`show` returns the full override set; `simctl status_bar <udid> list` prints the same state as
text. In CI, assert on the readback — a screenshot with a stale status bar is exactly the failure
this prevents, and no exit code reports it.

### The two flag vocabularies are not copy-paste compatible

Cross-tool spellings are rejected outright: `simctl --batteryState draining` and
`devicectl --battery-state discharging` both fail.

| Field | devicectl | simctl |
|---|---|---|
| time | `--time "9:41"` | `--time "9:41"` |
| data network | `--data-network` — `hide, wifi, hotspot, 1x, GPRS, Edge, UMTS, 4G, LTE, LTEA, LTEPlus, 5G, 5GPlus, 5GUWB, 5GUC` | `--dataNetwork` — `hide, wifi, 3g, 4g, lte, lte-a, lte+, 5g, 5g+, 5g-uwb, 5g-uc` |
| Wi-Fi | `--wifi-mode` (`notSupported, searching, failed, active`) + `--wifi-strength` | `--wifiMode` (`searching, failed, active`) + `--wifiBars` |
| cellular | `--cellular-mode` + `--cellular-strength` | `--cellularMode` + `--cellularBars` |
| battery | `--battery-state` (`draining, charging, charged`) + `--battery-level` | `--batteryState` (`discharging, charging, charged`) + `--batteryLevel` |
| carrier | *(none)* | `--operatorName` |
| not charging | `--battery-failing-to-charge` | *(none)* |

`devicectl` matches its own values case-insensitively (`5g` sets `5G`); `simctl` does not
(`--dataNetwork 5G` fails). Exit codes on a bad value: `devicectl` 1, `simctl` 117 for an unknown
enum and 22 for an out-of-range integer.

**`--cellular-strength`'s help text is wrong.** It advertises 1–5; a simulator rejects 5 with
`Invalid value for cellular bars: expected 0-4`. Cap at 4, matching `simctl --cellularBars`.

**Strip backticks when parsing `dataNetworkType` out of the JSON.** Values whose names aren't valid
Swift identifiers come back wrapped — `` "`5G`" ``, `` "`4G`" ``, `` "`1x`" ``, `` "`5GUC`" `` —
while `"LTE"`, `"Edge"`, `"wifi"`, and `"hide"` come back clean.

### Overrides are cosmetic

devicectl states outright that these overrides "do not affect the actual device state": a `--time`
of 9:41 changes the displayed string, not the clock, so a `Date()` read inside the app is
unaffected. One exception on the simctl side — its `--time` help notes that a **valid ISO date
string** also sets the date on relevant devices.

Device Hub exposes no GUI control for status-bar overrides; run these commands while the simulator
is displayed in Device Hub.

## Resizable app sessions — `devicectl device appResize` `OS27`

Free resize is **scriptable**. Device Hub's resize mode is the manual equivalent.

> **Use `xcui resize sweep` for breakpoint testing.** It wraps everything below — session
> lifecycle, actual-vs-requested readback, per-size assertions, and the 1001/24001/24004 error
> split — in one command. See axiom-tools (skills/xcui-ref.md). Reach for the raw `devicectl`
> calls here only when you need something the sweep does not cover. The commands are device-and-simulator shaped (`-d`
accepts either), but only the **simulator** path was verified here — the physical-device path was
not re-verified against wired hardware.

| Subcommand | Does |
|---|---|
| `appResize start -d <id> [--preferred-size WxH] [--corner-radius R]` | Moves the frontmost apps to the Resizable display and holds the session. Runs until interrupted — **the session ends when the command exits**, so background it |
| `appResize set -d <id> --preferred-size WxH [--corner-radius R]` | Adjusts geometry of the live session from another terminal |
| `appResize observe -d <id>` | Streams resizability state changes until interrupted |
| `devicectl device info appResize -d <id>` | Current session state; fails with CoreDeviceError **24004** when no session is active |

The target display is auto-discovered by finding one whose name contains "Resizable".

### Sweep breakpoints and assert each one

```bash
SIM=<udid>
xcrun devicectl device appResize start -d $SIM --preferred-size 500x800 &   # hold the session
sleep 15
for SIZE in 900x600 1100x500 400x900; do
  xcrun devicectl device appResize set -d $SIM --preferred-size $SIZE
  sleep 5
  xcui assert --id primary-cta || { sleep 5; xcui assert --id primary-cta; }
done
kill $!                                  # ends the session
```

`xcui` and AXe attach normally during a session. Immediately after `start` the automation
session can time out once while the display transitions — retry rather than concluding the
tools are blocked.

**Read the actual size back; don't assume you got what you asked for.** Requesting `1100x500`
on an iPhone 17 simulator yielded `1100x550`. `start` prints `Requested`/`Actual` size and
corner radius plus `Minimum possible size` and `Maximum possible size` (`1280.0x1280.0` there),
streams `Scene state updated:` on every change, and `info appResize --json-output -` returns
`preferredSize`, `cornerRadius`, `minimumPossibleSize`, `maximumPossibleSize`, and
`displayUniqueId`.

`--corner-radius` drives the container's corner radius, which makes it the way to exercise
concentric-corner behavior under CI — SwiftUI's `ConcentricRectangle` and UIKit's
`UICornerRadius.containerConcentric(minimum:)`. Note SwiftUI has no `containerConcentric` corner
*style*; that spelling is UIKit's and AppKit's. See axiom-swiftui (skills/26-ref.md).

## Device Hub `OS27`

Xcode 27 unifies simulators and physical devices in **Device Hub** — a standalone app that ships
alongside Xcode and auto-launches when you build and run to a simulator (you don't need to open
Xcode to use it), replacing the `Simulator.app` GUI. Xcode 26 and earlier keep `Simulator.app`, so
it isn't "gone" for those users.

**The bundle and process names changed, and scripts that force-quit the GUI depend on it:**

| Xcode | Path | Process | Bundle id |
|---|---|---|---|
| 26 | `Contents/Developer/Applications/Simulator.app` | `Simulator` | `com.apple.iphonesimulator` |
| 27 | `Contents/Applications/DeviceHub.app` | `DeviceHub` | `com.apple.dt.Devices` |

Xcode 27 ships **no** `Simulator.app` at any path, so `killall -9 Simulator` kills nothing there
— it prints `No matching processes belonging to you were found` and leaves the stuck GUI running.
Name both: `killall -9 Simulator DeviceHub`.

**Do not verify that with `$?`.** killall exits 0 when *either* name matched, so on a machine
carrying both Xcodes a 0 can mean "killed Simulator, never touched DeviceHub" — the GUI you were
trying to kill is still running. Confirm against the process, not the exit code:

```bash
killall -9 Simulator DeviceHub
pgrep -l Simulator DeviceHub    # must print NOTHING
``` CarPlay simulation moved with it, into DeviceKit's
`CarPlaySimulator.devicekitplugin`; the Xcode 26 `defaults write com.apple.iphonesimulator
CarPlayExtraOptions -bool YES` key does not exist anywhere in the 27 toolchain.

Device Hub offers the same toolset for simulators and physical devices, in
a *compact* window (live screen plus a few essentials) that expands to a *full window* with canvas,
sidebar inventory, and inspector. Bottom controls are contextual — home/screenshot/rotate on iPhone,
play/pause and navigation on Apple TV, environment/camera on Vision Pro, side button and Digital
Crown on Apple Watch.

The **canvas** is a live, interactive screen (click, drag, scroll, trackpad gestures) with zoom,
snap-to-1:1 physical size, *Resize mode* (transform app dimensions freely — see `axiom-uikit` for
resizability), and *Capture keyboard* (routes Mac keystrokes to the device for key-command and
hardware testing).

### Inspector panels

Five panels; two carry most of the debugging weight — Diagnostic reports (investigate) and Device
settings (reproduce conditions).

| Panel | Use |
|---|---|
| Device settings | Appearance and accessibility applied instantly — dark mode, increased contrast, larger Dynamic Type, simulated location, audio |
| Diagnostic reports | Start here when the app hangs or crashes — crashes, spins, and other logged diagnostics |
| Info | Storage, model, serial number |
| Apps | Install/uninstall; download and replace data containers |
| Profiles | Configuration and provisioning profiles |

Device Hub is a GUI over the same `devicectl`/`simctl` operations — a front-end, not a replacement.
Reach for the CLI in scripts, CI, and headless verification; for the reproduce-a-device-only-bug-on-a-
simulator debugging workflow, see `axiom-build (skills/xcode-debugging.md)`.

## Resources

**Skills**: xcui-ref, xclog-ref, axiom-build (xcode-debugging.md), axiom-testing (ui-testing.md), axiom-xcode-mcp
