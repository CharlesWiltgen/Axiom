---
name: axiom-axe-ref
description: Use when automating iOS Simulator UI interactions beyond simctl capabilities. Reference for AXe CLI covering accessibility-based tapping, gestures, text input, screenshots, video recording, and UI tree inspection.
version: 1.0.0
category: reference
user-invocable: false
---

# AXe Reference (iOS Simulator UI Automation)

AXe is a CLI tool for interacting with iOS Simulators using Apple's Accessibility APIs and HID functionality. Single binary, no daemon required.

## Installation

```bash
brew install cameroncooke/axe/axe

# Verify installation
axe --version
```

## Critical Best Practice: describe_ui First

**ALWAYS run `describe_ui` before UI interactions.** Never guess coordinates from screenshots.

**Best practice:** Use describe-ui to get precise element coordinates prior to using x/y parameters (don't guess from screenshots).

```bash
# 1. FIRST: Get the UI tree with frame coordinates
axe describe-ui --udid $UDID

# 2. THEN: Tap by accessibility ID (preferred)
axe tap --id "loginButton" --udid $UDID

# 3. OR: Tap by label
axe tap --label "Login" --udid $UDID

# 4. LAST RESORT: Tap by coordinates from describe-ui output
axe tap -x 200 -y 400 --udid $UDID
```

**Priority order for targeting elements:**
1. `--id` (accessibilityIdentifier) - most stable
2. `--label` (accessibility label) - stable but may change with localization
3. `-x -y` coordinates from `describe-ui` - fragile, use only when no identifier

## Core Concept: Accessibility-First

**AXe's key advantage**: Tap elements by accessibility identifier or label, not just coordinates.

```bash
# Coordinate-based (fragile - breaks with layout changes)
axe tap -x 200 -y 400 --udid $UDID

# Accessibility-based (stable - survives UI changes)
axe tap --id "loginButton" --udid $UDID
axe tap --label "Login" --udid $UDID
```

**Always prefer `--id` or `--label` over coordinates.**

## Getting the Simulator UDID

AXe requires the simulator UDID for most commands:

```bash
# Get booted simulator UDID
UDID=$(xcrun simctl list devices -j | jq -r '.devices | to_entries[] | .value[] | select(.state == "Booted") | .udid' | head -1)

# List all simulators
axe list-simulators
```

## Touch & Tap Commands

### Tap by Accessibility Identifier (Recommended)

```bash
# Tap element with accessibilityIdentifier
axe tap --id "loginButton" --udid $UDID

# Tap element with accessibility label
axe tap --label "Submit" --udid $UDID
```

### Tap by Coordinates

```bash
# Basic tap
axe tap -x 200 -y 400 --udid $UDID

# Tap with timing controls
axe tap -x 200 -y 400 --pre-delay 0.5 --post-delay 0.3 --udid $UDID

# Long press (hold duration in seconds)
axe tap -x 200 -y 400 --duration 1.0 --udid $UDID
```

### Low-Level Touch Events

```bash
# Touch down (finger press)
axe touch down -x 200 -y 400 --udid $UDID

# Touch up (finger release)
axe touch up -x 200 -y 400 --udid $UDID
```

## Swipe & Gesture Commands

### Custom Swipe

```bash
# Swipe from point A to point B
axe swipe --start-x 200 --start-y 600 --end-x 200 --end-y 200 --udid $UDID

# Swipe with duration (slower = more visible)
axe swipe --start-x 200 --start-y 600 --end-x 200 --end-y 200 --duration 0.5 --udid $UDID
```

### Gesture Presets

```bash
# Scrolling
axe gesture scroll-up --udid $UDID      # Scroll content up (swipe down)
axe gesture scroll-down --udid $UDID    # Scroll content down (swipe up)
axe gesture scroll-left --udid $UDID
axe gesture scroll-right --udid $UDID

# Edge swipes (navigation)
axe gesture swipe-from-left-edge --udid $UDID   # Back navigation
axe gesture swipe-from-right-edge --udid $UDID
axe gesture swipe-from-top-edge --udid $UDID    # Notification Center
axe gesture swipe-from-bottom-edge --udid $UDID # Home indicator/Control Center
```

## Text Input

### Type Text

```bash
# Type text (element must be focused)
axe type "user@example.com" --udid $UDID

# Type with delay between characters
axe type "password123" --char-delay 0.1 --udid $UDID

# Type from stdin
echo "Hello World" | axe type --stdin --udid $UDID

# Type from file
axe type --file /tmp/input.txt --udid $UDID
```

### Keyboard Keys

```bash
# Press specific key by HID keycode
axe key 40 --udid $UDID  # Return/Enter

# Common keycodes:
# 40 = Return/Enter
# 41 = Escape
# 42 = Backspace/Delete
# 43 = Tab
# 44 = Space
# 79 = Right Arrow
# 80 = Left Arrow
# 81 = Down Arrow
# 82 = Up Arrow

# Key sequence with timing
axe key-sequence 40 43 40 --delay 0.2 --udid $UDID
```

## Hardware Buttons

```bash
# Home button
axe button home --udid $UDID

# Lock/Power button
axe button lock --udid $UDID

# Long press power (shutdown dialog)
axe button lock --duration 3.0 --udid $UDID

# Side button (iPhone X+)
axe button side-button --udid $UDID

# Siri
axe button siri --udid $UDID

# Apple Pay
axe button apple-pay --udid $UDID
```

## Screenshots

```bash
# Screenshot to auto-named file
axe screenshot --udid $UDID
# Output: screenshot_2026-01-11_143052.png

# Screenshot to specific file
axe screenshot --output /tmp/my-screenshot.png --udid $UDID

# Screenshot to stdout (for piping)
axe screenshot --stdout --udid $UDID > screenshot.png
```

## Video Recording & Streaming

### Record Video

```bash
# Start recording (Ctrl+C to stop)
axe record-video --output /tmp/recording.mp4 --udid $UDID

# Record with quality settings
axe record-video --output /tmp/recording.mp4 --quality high --udid $UDID

# Record with scale (reduce file size)
axe record-video --output /tmp/recording.mp4 --scale 0.5 --udid $UDID
```

### Stream Video

```bash
# Stream at 10 FPS (default)
axe stream-video --udid $UDID

# Stream at specific framerate (1-30 FPS)
axe stream-video --fps 30 --udid $UDID

# Stream formats
axe stream-video --format mjpeg --udid $UDID   # MJPEG (default)
axe stream-video --format jpeg --udid $UDID    # Individual JPEGs
axe stream-video --format ffmpeg --udid $UDID  # FFmpeg compatible
axe stream-video --format bgra --udid $UDID    # Raw BGRA
```

## UI Inspection (describe-ui)

**Critical for finding accessibility identifiers and labels.**

### Full Screen UI Tree

```bash
# Get complete accessibility tree
axe describe-ui --udid $UDID

# Output includes:
# - Element type (Button, TextField, StaticText, etc.)
# - Accessibility identifier
# - Accessibility label
# - Frame (position and size)
# - Enabled/disabled state
```

### Point-Specific UI Info

```bash
# Get element at specific coordinates
axe describe-ui --point 200,400 --udid $UDID
```

### Example Output

```json
{
  "type": "Button",
  "identifier": "loginButton",
  "label": "Login",
  "frame": {"x": 150, "y": 380, "width": 100, "height": 44},
  "enabled": true,
  "focused": false
}
```

## Common Workflows

### Login Flow

```bash
UDID=$(xcrun simctl list devices -j | jq -r '.devices | to_entries[] | .value[] | select(.state == "Booted") | .udid' | head -1)

# Tap email field and type
axe tap --id "emailTextField" --udid $UDID
axe type "user@example.com" --udid $UDID

# Tap password field and type
axe tap --id "passwordTextField" --udid $UDID
axe type "password123" --udid $UDID

# Tap login button
axe tap --id "loginButton" --udid $UDID

# Wait and screenshot
sleep 2
axe screenshot --output /tmp/login-result.png --udid $UDID
```

### Discover Elements Before Automating

```bash
# 1. Get the UI tree
axe describe-ui --udid $UDID > /tmp/ui-tree.json

# 2. Find elements (search for identifiers)
cat /tmp/ui-tree.json | jq '.[] | select(.identifier != null) | {identifier, label, type}'

# 3. Use discovered identifiers in automation
axe tap --id "discoveredIdentifier" --udid $UDID
```

### Scroll to Find Element

```bash
# Scroll down until element appears (pseudo-code pattern)
for i in {1..5}; do
  if axe describe-ui --udid $UDID | grep -q "targetElement"; then
    axe tap --id "targetElement" --udid $UDID
    break
  fi
  axe gesture scroll-down --udid $UDID
  sleep 0.5
done
```

### Screenshot on Error

```bash
# Automation with error capture
if ! axe tap --id "submitButton" --udid $UDID; then
  axe screenshot --output /tmp/error-state.png --udid $UDID
  axe describe-ui --udid $UDID > /tmp/error-ui-tree.json
  echo "Failed to tap submitButton - see error-state.png"
fi
```

## Timing Controls

Most commands support timing options:

| Option | Description |
|--------|-------------|
| `--pre-delay` | Wait before action (seconds) |
| `--post-delay` | Wait after action (seconds) |
| `--duration` | Action duration (for taps, button presses) |
| `--char-delay` | Delay between characters (for type) |

```bash
# Example with full timing control
axe tap --id "button" --pre-delay 0.5 --post-delay 0.3 --udid $UDID
```

## AXe vs simctl

| Capability | simctl | AXe |
|------------|--------|-----|
| Device lifecycle | ✅ | ❌ |
| Permissions | ✅ | ❌ |
| Push notifications | ✅ | ❌ |
| Status bar | ✅ | ❌ |
| Deep links | ✅ | ❌ |
| Screenshots | ✅ | ✅ (PNG) |
| Video recording | ✅ | ✅ (H.264) |
| Video streaming | ❌ | ✅ |
| UI tap/swipe | ❌ | ✅ |
| Type text | ❌ | ✅ |
| Hardware buttons | ❌ | ✅ |
| Accessibility tree | ❌ | ✅ |

**Use both together**: simctl for device control, AXe for UI automation.

## Troubleshooting

### Element Not Found

1. Run `axe describe-ui` to see available elements
2. Check element has `accessibilityIdentifier` set in code
3. Ensure element is visible (not off-screen)

### Tap Doesn't Work

1. Check element is enabled (`"enabled": true` in describe-ui)
2. Try adding `--pre-delay 0.5` for slow-loading UI
3. Verify correct UDID with `axe list-simulators`

### Type Not Working

1. Ensure text field is focused first: `axe tap --id "textField"`
2. Check keyboard is visible
3. Try `--char-delay 0.05` for reliability

### Permission Denied

AXe uses private APIs - ensure you're running on a Mac with Xcode installed and proper entitlements.

## Resources

**GitHub**: https://github.com/cameroncooke/AXe

**Related**: xcsentinel (build orchestration)

**Skills**: axiom-xctest-automation, axiom-ui-testing

**Agents**: simulator-tester, test-runner
