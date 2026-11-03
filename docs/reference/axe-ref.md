---
name: axe-ref
description: AXe CLI reference for accessibility-based iOS Simulator UI automation — tapping, gestures, text input, screenshots, video, UI tree inspection
---

# AXe Reference

Reference for AXe, an open-source command-line tool that drives the iOS Simulator through Apple's accessibility APIs. It taps elements by accessibility identifier, performs gestures, types text, takes screenshots, records video, and inspects the UI tree, all from a single binary with no background daemon.

> **Xcode 27 and SimulatorKit:** AXe needs `SimulatorKit.framework`, which Xcode 27 moved to `Contents/SharedFrameworks/`. AXe 1.8.0 finds it there on its own; older versions fail to load it. Rather than guessing from your Xcode version, run `xcui doctor` (part of Axiom's [xcui](/reference/xcui-ref) tool), which decides by actually running AXe. Only if it reports an `axe_developer_dir` do you prefix the `axe` commands below with `DEVELOPER_DIR=<that value>`, for example `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer axe tap …`.

## When to Use This Reference

Use this reference when:
- Automating UI interactions in the iOS Simulator beyond what `simctl` offers
- Tapping elements by accessibility identifier or label instead of fragile coordinates
- Recording or streaming video from the simulator on the command line
- Inspecting the accessibility tree to discover element identifiers
- Building CI scripts that interact with the simulator's UI

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "How do I tap a button in the simulator by accessibility ID?"
- "How do I type text into a field in the iOS Simulator from the command line?"
- "How do I record video from the simulator?"
- "How do I inspect the UI tree to find element identifiers?"
- "Why does `axe tap` report success when nothing happened?"
- "What's the difference between AXe and simctl?"
- "How do I automate a login flow in the simulator?"

## What's Covered

### Setup
- Installing with Homebrew
- Finding the simulator UDID

### Touch and Gestures
- Tapping by accessibility identifier, label, or coordinates, in that order of preference
- `--tap-style physical`
- Low-level touch events and long presses
- Custom swipes and gesture presets for scrolling and edge swipes

### Text and Buttons
- Typing text from an argument, stdin, or a file
- Keys by HID keycode and key sequences
- Hardware buttons: home, lock, side button, Siri, Apple Pay

### Capture and Inspection
- Screenshots
- Video recording and streaming
- `describe-ui` for the full accessibility tree, or the element at a point

### Workflows and Timing
- Login flows, discovering elements before automating, scroll-to-find, screenshot on error
- Timing controls: `--pre-delay`, `--post-delay`, `--delay`, `--duration`

### Comparison and Troubleshooting
- AXe vs. `simctl` capabilities
- Element not found, taps that do nothing, text input problems, permission errors

## Key Pattern

Always inspect the UI tree before automating interactions:

```bash
# 1. Get the UI tree with element identifiers
axe describe-ui --udid $UDID

# 2. Tap by accessibility ID (most stable)
axe tap --id "loginButton" --tap-style physical --udid $UDID

# 3. Or by label (stable, but may change with localization)
axe tap --label "Login" --tap-style physical --udid $UDID
```

**Priority order:** `--id` (most stable), then `--label`, then `-x -y` coordinates as a last resort.

**Pass `--tap-style physical`.** AXe's default tap style left SwiftUI buttons, list rows, menus, and tabs untouched in testing on Xcode 27.1, while AXe still reported `✓ … completed successfully`. `xcui tap` adds the flag for you, and `axe touch --down --up` sends the same physical touch. Either way, confirm that the tap did something rather than trusting its output.

## Documentation Scope

This page documents the `axe-ref` skill (in the `axiom-xcode-mcp` suite), the AXe command guide your assistant uses to automate simulator UI. AXe handles UI interaction only; for device lifecycle, permissions, push notifications, and deep links, see [Device Control](/reference/device-control-ref).

## Related

- [xcui](/reference/xcui-ref) – Axiom's simulator UI tool, which forwards taps, typing, and swipes to AXe and adds waits, assertions, and accessibility checks
- [simulator-tester](/agents/simulator-tester) – Agent that drives the simulator for visual checks, screenshots, and accessibility validation
- [UI Testing](/skills/ui-design/ui-testing) – Xcode UI tests with Recording UI Automation, for flows you want in your test suite rather than a script

## Resources

**GitHub**: https://github.com/cameroncooke/AXe
