# /axiom:screenshot

Quick screenshot capture from booted iOS Simulator.

## What It Does

Captures a screenshot of the currently booted simulator and displays it for analysis (Claude is multimodal!).

## Usage

```bash
/axiom:screenshot
```

## How It Works

1. Checks if a simulator is booted
2. Boots iPhone 16 Pro if needed
3. Captures screenshot to timestamped file: `/tmp/axiom-screenshot-<timestamp>.png`
4. Returns file path
5. Claude displays and analyzes the screenshot

## Common Use Cases

### Debug Visual Issues

```bash
/axiom:screenshot
```

Then ask: "Does the login button look centered?"

### Verify Fixes

After making a change:

```bash
/axiom:screenshot
```

Then ask: "Is the text still clipped?"

### Document Current State

```bash
/axiom:screenshot
```

Claude will capture and describe the current UI state.

## Prerequisites

- An iOS Simulator must be booted
- If no simulator is running, command will boot one automatically

## For More Control

For advanced simulator testing (location, push notifications, video recording, etc.), use:

```bash
/axiom:test-simulator
```

Or invoke the simulator-tester agent with natural language:
- "Test my app with location simulation"
- "Send a test push notification"
- "Record a video of the app"

## Related

- **`/axiom:test-simulator`** — Full simulator testing with scenarios
- **`simulator-tester` agent** — Automated testing with visual verification
- **`deep-link-debugging` skill** — Add navigation for better screenshot targeting

## Example

```bash
# User runs command
/axiom:screenshot

# Claude responds:
"Screenshot captured: /tmp/axiom-screenshot-2025-12-08-14-30-45.png

Looking at the screenshot, I can see the login screen with the email and password fields. The 'Sign In' button appears centered and properly sized. The logo at the top is correctly positioned with adequate spacing."
```

**Time saved**: Instant visual verification without manual navigation.
