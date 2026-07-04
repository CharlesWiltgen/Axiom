# Device Control Reference — Device Hub, devicectl, simctl

The Xcode-independent surface for driving simulators and physical devices: which tool owns
what, and which ones need Xcode running. Device Hub (the Xcode 27 GUI) is a front-end over
`devicectl`/`simctl` — every operation has a scriptable, headless counterpart, so a full
dev/CI loop needs no running Xcode and no MCP bridge.

## Tool map — what each owns, and what needs Xcode running

| Tool | Owns | Needs Xcode running? |
|------|------|----------------------|
| `devicectl` (CLI) | configure + interact with a booted sim OR physical device through one `-d <udid>` selector; install/launch/inspect; stable `--json-output` | No |
| `simctl` (CLI) | simulator lifecycle (create/boot/shutdown/erase) + sim-only state: push, privacy permissions, media, `status_bar`, `openurl`, `ui appearance` | No |
| `xcui` (Axiom) | drive in-app UI + accessibility tree (tap/assert, VoiceOver order); toggle a11y settings | No |
| `xclog` (Axiom) | capture simulator/device console | No |
| `xcsym` (Axiom) | symbolicate crashes (`.ips`, MetricKit, `.crash`) | No |
| `xcprof` (Axiom) | record/analyze xctrace CPU & network profiles | No |
| Device Hub (GUI) | visual front-end over devicectl/simctl — canvas, inspector; auto-launches on build-and-run | No (Xcode 27 installed, but needn't be open) |
| `mcpbridge` (Xcode MCP) | 20 IDE tools — build, test, render previews, project read | **Yes — the only one** |

**Answer to "control the device without Xcode running":** everything except the MCP bridge.
`devicectl` + `simctl` + Axiom's `xcui`/`xclog`/`xcsym`/`xcprof` cover the full scriptable
surface headlessly. Only `mcpbridge` (`axiom-xcode-mcp`) requires a running Xcode with a
project open — so build MCP-independent workflows on the CLI trio when uptime matters.

## devicectl — the Core Device CLI

`devicectl` (Xcode 15+, replaces the legacy `idevice*` tools) installs, launches, inspects, and
configures devices from the command line. `xcrun devicectl list devices` returns a **unified
inventory of physical devices *and* simulators**, distinguished by a `Reality` column
(`physical` / `simulated`).

Not new in Xcode 27: the CLI is materially identical across the 26 and 27 toolchains — same
subcommands and flags, verified against both (the exact binary build advances between beta seeds,
so don't pin one). Xcode 27 adds one service-side change — `simctl` and `devicectl` can now reboot
a simulator via `reboot`.

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
unified `-d` syntax, is the real CI win). There is no literal `simulated` field: the `Reality` column is derived from
`connectionProperties.transportType` (`sameMachine` = simulator; `localNetwork` / wired =
physical). Key off that, plus `deviceProperties.bootState` (`booted` / `shutdown`) and
`hardwareProperties.deviceType`, when enumerating.

### Interaction vs lifecycle — devicectl does NOT replace simctl

devicectl **configures and interacts** with a booted device/sim; it has no `create`/`boot`/`erase`.
simctl still owns the simulator lifecycle and the sim-only features.

| Need | Tool |
|------|------|
| create / boot / shutdown / erase a sim | `xcrun simctl boot\|shutdown\|erase` |
| pick the test destination | `xcodebuild -destination` |
| configure / interact with a booted sim or device | `xcrun devicectl` |
| push, privacy permissions, media, status bar, openurl | `xcrun simctl` (sim-only) |

CI order is unchanged at the front: simctl or xcodebuild boots the sim → devicectl configures it
→ run tests.

### Simulator-capable subcommands (verified on Xcode 26.6 + 27.0)

| Subcommand | On simulator | Use |
|------------|--------------|-----|
| `device info displays` | works (verified) | bounds, pointScale, nativeSize, `framebufferMaskIdentifier` (exact JSON keys) |
| `device orientation get` (also `set`, `rotate`) | works (`get` verified) | orientation without entering the app |
| `device settings biometrics [--enable\|--disable]` | works (verified) | enroll / unenroll Face ID / Touch ID |
| `device simulate biometrics --success\|--failure` | works (verified) | drive a match / no-match |
| `device settings appearance --mode light\|dark` | works (verified) | force Dark/Light; also `--look-and-feel clear\|tinted`, text size, contrast |
| `device simulate location` / `device simulate statusBar` | available | inject location; clean status bar for screenshots |
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

## Device Hub (OS27)

Xcode 27 unifies simulators and physical devices in **Device Hub** — a standalone app that ships
alongside Xcode and auto-launches when you build and run to a simulator (you don't need to open
Xcode to use it), replacing the `Simulator.app` GUI. Xcode 26 and earlier keep `Simulator.app`, so
it isn't "gone" for those users. It offers the same toolset for simulators and physical devices, in
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
