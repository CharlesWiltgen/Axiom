---
name: device-control-ref
description: Reference for driving iOS simulators and physical devices without Xcode running — the Device Hub GUI and its Xcode-independent CLI counterparts (devicectl, simctl), how they divide labor, and which operations still require the Xcode MCP bridge
---

# Device Control Reference (Device Hub, devicectl, simctl)

Reference for controlling iOS simulators and physical devices from outside Xcode. On Xcode 27, **Device Hub** is the GUI that replaces `Simulator.app` and manages simulators and physical devices together — but it is a front-end over the `devicectl` and `simctl` command-line tools, so every operation also has a scriptable, headless counterpart. This page maps the tools to their jobs and answers the question "what can I do without Xcode running?"

## When to Use This Reference

Use this reference when:
- You want to drive a simulator or device from a script or CI without keeping Xcode open
- Your workflow depends on the Xcode **MCP bridge** (`xcrun mcpbridge`) and breaks whenever Xcode isn't running, and you want an Xcode-independent path
- You're deciding between `devicectl` and `simctl` for a given operation
- You need to script Face ID / Touch ID, orientation, appearance, or simulated location
- You want to screenshot or screen-record a simulator or a physical device from the command line
- You're parsing `devicectl --json-output` in CI and need the stable keys
- You want to know what the Xcode 27 Device Hub GUI offers and how it maps to the CLI

## Example Prompts

- "Can I control the simulator without Xcode running?"
- "How do I script Face ID enrollment and a match in a UI test?"
- "What's the difference between devicectl and simctl?"
- "What is Device Hub in Xcode 27, and do I need to open Xcode to use it?"
- "How do I list physical devices and simulators together from the command line?"
- "How do I record a video of a physical device from the command line?"
- "Which device operations still require the Xcode MCP server?"

## What's Covered

### Tool map
- Which tool owns which job — `devicectl`, `simctl`, `xcui`, `xclog`, `xcsym`, `xcprof`, Device Hub, and `mcpbridge`
- The "needs Xcode running?" column (only the MCP bridge does)

### devicectl (Core Device CLI)
- Unified `list devices` inventory (physical + simulated, `Reality` column)
- Install / launch / inspect by `-d <udid>`
- `--json-output` stability contract and the keys to parse
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

## Documentation Scope

This page documents the `device-control-ref` reference skill (in the `axiom-tools` suite). It is the canonical home for the devicectl / simctl / Device Hub facts that the build, testing, and tools skills cross-reference.

- For the bundled Axiom CLI tools this reference sits alongside, see [xcui](/reference/xcui-ref) (simulator UI & accessibility), [Console Capture (xclog)](/reference/xclog-ref), and [Crash Symbolication (xcsym)](/reference/xcsym-ref)
- For the Xcode **MCP** path (and why it needs Xcode running), see the [Xcode MCP Integration](/skills/xcode-mcp/) skill
- For the debugging workflow that uses Device Hub to reproduce a device-only bug on a simulator, that lives in the `axiom-build` xcode-debugging skill
- For the agent that drives simulator state live, see the [simulator-tester agent](/agents/simulator-tester)

## Related

- [xcui](/reference/xcui-ref) – validates the on-screen UI that `devicectl` sets up; the two compose
- [simulator-tester](/agents/simulator-tester) – the agent that applies device state and asserts on the result
