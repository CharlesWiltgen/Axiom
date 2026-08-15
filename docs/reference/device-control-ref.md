---
name: device-control-ref
description: Reference for driving iOS simulators and physical devices without Xcode running — the Device Hub GUI and its Xcode-independent CLI counterparts (devicectl, simctl), how they divide labor, and how they compare to the Xcode MCP bridge
---

# Device Control Reference (Device Hub, devicectl, simctl)

Reference for controlling iOS simulators and physical devices from outside Xcode. On Xcode 27, **Device Hub** is the GUI that replaces `Simulator.app` and manages simulators and physical devices together — but it is a front-end over the `devicectl` and `simctl` command-line tools, so every operation also has a scriptable, headless counterpart. This page maps the tools to their jobs and answers the question "what can I do without Xcode running?"

On Xcode 27 the answer is *all of it* — MCP (the Model Context Protocol server that lets an AI assistant drive Xcode itself) joins the CLI tools via the headless `mcp-server`, so uptime is no longer what separates them. Pick on capability and privilege instead: the CLI tools assert, wait, toggle accessibility settings, and run unprivileged, which is decisive in CI; MCP owns what only the IDE knows, like build state and rendered previews.

## When to Use This Reference

Use this reference when:
- You want to drive a simulator or device from a script or CI without keeping Xcode open
- You're choosing between the CLI tools and the Xcode **MCP bridge** (`xcrun mcpbridge`) for a given job
- You're deciding between `devicectl` and `simctl` for a given operation
- You need to script Face ID / Touch ID, orientation, appearance, VoiceOver, or simulated location
- You want to resize an app's window from a script — sweeping breakpoints in CI instead of dragging by hand
- You want to screenshot or screen-record a simulator or a physical device from the command line
- You're parsing `devicectl --json-output` in CI and need the stable keys
- You want to know what the Xcode 27 Device Hub GUI offers and how it maps to the CLI

## Example Prompts

- "Can I control the simulator without Xcode running?"
- "How do I script Face ID enrollment and a match in a UI test?"
- "What's the difference between devicectl and simctl?"
- "How do I resize the app window from a script?"
- "Can I automate resize-readiness testing across breakpoints?"
- "What is Device Hub in Xcode 27, and do I need to open Xcode to use it?"
- "My simulator is stuck and `killall -9 Simulator` does nothing — what changed in Xcode 27?"
- "How do I list physical devices and simulators together from the command line?"
- "How do I record a video of a physical device from the command line?"
- "Should I use xcui or the Xcode MCP device-interaction tools?"
- "Which devicectl JSON keys are deprecated, and what replaced them?"
- "How do I tell whether a device has Developer Mode enabled from the command line?"

## What's Covered

### Tool map
- Which tool owns which job — `devicectl`, `simctl`, Axiom's bundled CLI tools (`xcui`, `xclog`, `xcsym`, `xcprof`), Device Hub, and `mcpbridge`
- The "needs Xcode running?" column — nothing does on Xcode 27, though headless MCP requires a one-time `sudo` opt-in that CI may not permit

### Resizable app sessions (Xcode 27)
- `devicectl device appResize start` / `set` / `observe`, and `devicectl device info appResize`
- `--preferred-size WxH` and `--corner-radius`, and why the actual size can differ from the requested one
- The sweep-and-assert recipe – drive breakpoints from the CLI, assert each with `xcui`

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

### Screen capture
- `devicectl device capture screenshot` / `screen-record` – unified sim + device path (Xcode 26.6+)
- Codec, mask-policy, and `--duration` auto-stop options, and the `.png` / `.mp4` extension rules
- Simulator-only fallbacks (`simctl io`, `axe`) and when to reach for them

### Device Hub (Xcode 27 GUI)
- Compact vs full window, the interactive canvas
- The five-panel inspector and what each panel is for
- Bundle path, process name, and bundle id per Xcode version, and why `killall -9 Simulator` kills nothing on Xcode 27
- Where CarPlay simulation went, and the `CarPlayExtraOptions` default that does not exist in Xcode 27

## Documentation Scope

This page documents the `device-control-ref` reference skill (in the `axiom-tools` suite). It is the canonical home for the devicectl / simctl / Device Hub facts that the build, testing, and tools skills cross-reference.

- For the bundled Axiom CLI tools this reference sits alongside, see [xcui](/reference/xcui-ref) (simulator UI & accessibility), [Console Capture (xclog)](/reference/xclog-ref), and [Crash Symbolication (xcsym)](/reference/xcsym-ref)
- For the Xcode **MCP** path, including the headless `mcp-server` setup that removes the running-Xcode requirement, see the [Xcode MCP Integration](/skills/xcode-mcp/) skill
- For the debugging workflow that uses Device Hub to reproduce a device-only bug on a simulator, see [Xcode Debugging](/skills/debugging/xcode-debugging)

## Related

- [xcui](/reference/xcui-ref) – validates the on-screen UI that `devicectl` sets up; the two compose
- [simulator-tester](/agents/simulator-tester) – the agent that applies device state and asserts on the result
- [watch-device-diag](/diagnostic/watch-device-diag) – applies these fields to a specific hard case: an Apple Watch that Xcode will not install to, launch, or attach to
