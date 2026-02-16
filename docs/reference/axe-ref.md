---
name: axe-ref
description: AXe CLI reference for accessibility-based iOS Simulator UI automation -- tapping, gestures, text input, screenshots, video, UI tree inspection
---

# AXe Reference

Reference for AXe, a CLI tool for automating iOS Simulator interactions using Apple's Accessibility APIs. Enables tapping by accessibility identifier, gestures, text input, screenshots, video recording, and UI tree inspection -- all without a daemon.

## When to Use This Reference

Use this reference when:
- Automating UI interactions in the iOS Simulator beyond what `simctl` offers
- Tapping elements by accessibility identifier or label instead of fragile coordinates
- Recording video or streaming from the simulator via CLI
- Inspecting the accessibility tree to discover element identifiers
- Building CI/CD automation scripts that interact with simulator UI

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I tap a button in the simulator by accessibility ID?"
- "How do I type text into a field in the iOS Simulator from the command line?"
- "How do I record video from the simulator?"
- "How do I inspect the UI tree to find element identifiers?"
- "What's the difference between AXe and simctl?"
- "How do I automate a login flow in the simulator?"

## What's Covered

- Installation via Homebrew and UDID discovery
- Tapping by accessibility identifier, label, or coordinates (with priority guidance)
- `describe-ui` for inspecting the full accessibility tree and element frames
- Swipe, scroll, and edge gesture commands
- Text input with character delay and stdin/file support
- Hardware button simulation (home, lock, Siri, Apple Pay)
- Screenshots and video recording/streaming
- Common workflows: login flows, scroll-to-find, error capture
- AXe vs simctl capability comparison
- Troubleshooting: element not found, tap failures, text input issues

## Key Pattern

Always inspect the UI tree before automating interactions:

```bash
# 1. Get the UI tree with element identifiers
axe describe-ui --udid $UDID

# 2. Tap by accessibility ID (most stable)
axe tap --id "loginButton" --udid $UDID

# 3. Or by label (stable, but may change with localization)
axe tap --label "Login" --udid $UDID
```

**Priority order:** `--id` (most stable) > `--label` > `-x -y` coordinates (last resort).

## Documentation Scope

This page documents the `axiom-axe-ref` reference skill -- the complete AXe CLI guide Claude uses when you need to automate simulator UI interactions.

**For UI testing with XCTest:** See [UI Testing](/skills/ui-design/ui-testing) for Xcode's built-in UI testing framework.

**For simctl device control:** AXe handles UI interactions; use `xcrun simctl` for device lifecycle, permissions, push notifications, and deep links.

## Related

- [UI Testing](/skills/ui-design/ui-testing) -- Xcode UI testing with Recording UI Automation

## Resources

**GitHub**: https://github.com/cameroncooke/AXe
