---
name: screenshot
description: Capture screenshot from booted iOS Simulator
disable-model-invocation: true
---

# Capture Simulator Screenshot

Take a screenshot of the currently booted iOS Simulator and display it for analysis.

## What This Does

1. Checks if a simulator is booted
2. Captures screenshot to timestamped file
3. Displays the screenshot (Claude is multimodal!)
4. Returns the file path for reference

## Usage

Simply run this command and Claude will:
- Execute: `xcrun simctl io booted screenshot /tmp/axiom-screenshot-<timestamp>.png`
- Read and display the screenshot
- Analyze what's visible in the screenshot

## Prerequisites

- An iOS Simulator must be booted
- If no simulator is running, Claude will boot one first

## Common Use Cases

**Debug Visual Issues**:
```bash
/axiom:screenshot
```
Then ask: "Does the login button look centered?"

**Verify Fixes**:
```bash
/axiom:screenshot
```
Then ask: "Is the text still clipped?"

**Document Current State**:
```bash
/axiom:screenshot
```
Claude will capture and describe the current UI state.

## Physical devices & scriptable recording

This command shoots a **simulator** screenshot via `simctl`. To capture a **physical
device**, or to record video with a clean auto-stop (no Ctrl+C), use the unified
`devicectl device capture` path — one `-d <udid>` selector works for both sim and device
(Xcode 26.6+):

```bash
xcrun devicectl device capture screenshot   -d <udid> --destination shot.png    # .png required
xcrun devicectl device capture screen-record -d <udid> --destination clip.mp4 --duration 5
```

See the `axiom-tools` device-control reference (Screen capture) for codecs, mask policy,
and the simctl/axe fallbacks.

## For More Control

For advanced simulator testing (location, push notifications, video recording, etc.), use:
```bash
/axiom:test-simulator
```

Or invoke the full simulator-tester agent with natural language:
- "Test my app with location simulation"
- "Send a test push notification"
- "Record a video of the app"
