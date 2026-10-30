---
name: device-control-ref
description: Reference for driving iOS simulators and physical devices without Xcode running — the Device Hub GUI and its Xcode-independent CLI counterparts (devicectl, simctl), how they divide labor, and how they compare to the Xcode MCP bridge
---

# Device Control Reference (Device Hub, devicectl, simctl)

Reference for controlling iOS simulators and physical devices from outside Xcode. On Xcode 27, **Device Hub** replaces `Simulator.app` as the GUI for both, and because it is a front end over the `devicectl` and `simctl` command-line tools, everything it does can also be scripted without Xcode running.

## When to Use This Reference

Use this reference when:
- You want to drive a simulator or device from a script or CI without keeping Xcode open
- You're choosing between the CLI tools and the Xcode **MCP bridge** (`xcrun mcpbridge`) for a given job
- You're deciding between `devicectl` and `simctl` for a given operation
- You need to script Face ID / Touch ID, orientation, appearance, VoiceOver, or simulated location
- You want to resize an app's window from a script — sweeping breakpoints in CI instead of dragging by hand
- You want to screenshot or screen-record a simulator or a physical device from the command line
- You're preparing App Store screenshots and need a clean status bar (9:41, full bars, full battery)
- You're parsing `devicectl --json-output` in CI and need the stable keys
- You want to know what the Xcode 27 Device Hub GUI offers and how it maps to the CLI

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "Can I control the simulator without Xcode running?"
- "How do I script Face ID enrollment and a match in a UI test?"
- "What's the difference between devicectl and simctl?"
- "How do I resize the app window from a script?"
- "Can I automate resize-readiness testing across breakpoints?"
- "What is Device Hub in Xcode 27, and do I need to open Xcode to use it?"
- "My simulator is stuck and `killall -9 Simulator` does nothing — what changed in Xcode 27?"
- "How do I list physical devices and simulators together from the command line?"
- "How do I record a video of a physical device from the command line?"
- "How do I set the status bar to 9:41 with full bars for App Store screenshots?"
- "Why did my screenshot come out with the wrong status bar even though the command succeeded?"
- "Should I use xcui or the Xcode MCP device-interaction tools?"
- "Which devicectl JSON keys are deprecated, and what replaced them?"
- "How do I tell whether a device has Developer Mode enabled from the command line?"

## What's Covered

### Tool map
- Which tool owns which job — `devicectl`, `simctl`, Axiom's bundled CLI tools (`xcui`, `xclog`, `xcsym`, `xcprof`), Device Hub, and `mcpbridge`
- The "needs Xcode running?" column — nothing does on Xcode 27, though headless MCP requires a one-time `sudo` opt-in that CI may not permit
- CLI tools vs Xcode MCP (the server that lets your assistant drive Xcode itself) — with neither needing Xcode open, choose by capability: the CLI tools assert, wait, toggle accessibility settings and run without special privileges, which decides it in CI; MCP owns what only the IDE knows, such as build state and rendered previews

### Resizable app sessions (Xcode 27)
- `devicectl device appResize start` / `set` / `observe`, and `devicectl device info appResize`
- `--preferred-size WxH` and `--corner-radius`, and why the actual size can differ from the requested one
- The sweep-and-assert recipe — drive breakpoints from the CLI, assert each with `xcui`

### devicectl (Core Device CLI)
- Unified `list devices` inventory (physical + simulated, `Reality` column)
- Install / launch / inspect by `-d <udid>`
- `--json-output` stability contract and the keys to parse
- The `properties` dictionary that supersedes the deprecated `hardwareProperties` / `deviceProperties` / `connectionProperties` keys, and `--omit-deprecated-fields-in-json`
- `properties.hardware.reality`, `.deviceType`, `.platform`; `properties.connection.state`, `.pairingState`, `.transportType`; `properties.state.developerModeStatus`, `.bootState`
- Which of those fields are always present and which drop out on an unreachable device
- devicectl-vs-simctl division of labor (interaction vs lifecycle)
- Verified simulator-capable subcommand matrix
- Face ID / Touch ID as a CI primitive; the `CoreDeviceError 1001` "device-only" signal

### Rotating a simulator
- `devicectl device orientation set` / `get`, and why `simctl` can't do it
- Verifying a rotation by screenshot dimensions rather than by exit code
- The two devices that don't rotate this way — iPhone Duo (a silent no-op) and an app's own request on iPad

### Screen capture
- `devicectl device capture screenshot` / `screen-record` – unified sim + device path (Xcode 26.6+)
- Codec, mask-policy, and `--duration` auto-stop options, and the `.png` / `.mp4` extension rules
- Simulator-only fallbacks (`simctl io`, `axe`) and when to reach for them
- `--mask alpha` / `ignored` / `black`, and which one shows what the user sees
- Why a black or failed simulator capture can reflect display state, and what to check before attributing it to your app — display state first, accessibility tree second
- Naming a display on a two-display device — simctl's port UUID vs devicectl's `uniqueId`, and which display you get by default

### Status bar for screenshots
- `devicectl device simulate statusBar preset` and its four presets — `screenshot`, `low-battery`, `no-service`, `charging`
- `override` / `show` / `clear`, and the `simctl status_bar` equivalents that share the same store
- Why to clear before every override, and why to assert on the readback instead of the exit code
- The two tools' incompatible flag vocabularies, side by side
- Setting a carrier name, which only `simctl`'s `--operatorName` can do
- The `--cellular-strength` range `devicectl`'s own help text gets wrong, and the JSON backtick quirk in `dataNetworkType`
- Why `devicectl`'s command set follows a machine-wide CoreDevice, not `xcode-select`
- Why the overrides are cosmetic: a 9:41 status bar doesn't change the clock your app reads

### Device Hub (Xcode 27 GUI)
- Compact vs full window, the interactive canvas
- What Xcode 27.2 changes: input to pre-iOS 18 simulators, touch from a Sidecar iPad or touch-display Mac, and the conflict between Secure keyboard entry and Capture keyboard
- The five-panel inspector and what each panel is for
- Bundle path, process name, and bundle id per Xcode version, why `killall -9 Simulator` kills nothing on Xcode 27, and confirming the kill with `pgrep` rather than the exit code
- CarPlay Simulator built into Device Hub (it needs a physical iPhone, and on Xcode 27.2 a USB cable), and the `CarPlayExtraOptions` default that does not exist in Xcode 27

## Documentation Scope

This page documents the `device-control-ref` skill (in the `axiom-tools` suite), the canonical home for the `devicectl`, `simctl`, and Device Hub facts that the build, testing, and tools skills cross-reference.

- For the bundled Axiom CLI tools this reference sits alongside, see [Console Capture (xclog)](/reference/xclog-ref), [Trace Capture & Analysis (xcprof)](/reference/xcprof-ref), [Crash Symbolication (xcsym)](/reference/xcsym-ref), and [xcui](/reference/xcui-ref), which validates the on-screen UI that `devicectl` sets up
- For the Xcode **MCP** path, including the headless `mcp-server` setup that removes the running-Xcode requirement, see [Xcode MCP Setup](/skills/xcode-mcp/xcode-mcp-setup)
- For the debugging workflow that uses Device Hub to reproduce a device-only bug on a simulator, see [Xcode Debugging](/skills/debugging/xcode-debugging)

## Related

- [simulator-tester](/agents/simulator-tester) – The agent that applies device state and asserts on the result
- [AXe Reference](/reference/axe-ref) – The simulator-only input and video tool behind `xcui`, and one of the capture fallbacks covered here
- [watch-device-diag](/diagnostic/watch-device-diag) – Applies these fields to a hard case: an Apple Watch that Xcode won't install to, launch, or attach to
