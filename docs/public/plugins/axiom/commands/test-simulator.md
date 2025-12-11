---
name: test-simulator
description: Launch simulator testing agent for test scenarios and visual verification
---

# Simulator Testing Agent

Launches the **simulator-tester** agent for automated simulator testing with visual verification.

## What It Does

The agent will:
1. Check simulator state and boot if needed
2. Set up test scenarios (location, permissions, push notifications)
3. Capture screenshots and video
4. Monitor logs for crashes/errors
5. Analyze results and provide clear reports

## Capabilities

- **Screenshot capture** for visual debugging
- **Video recording** for complex workflows
- **Location simulation** for GPS-based features
- **Push notification testing** without a server
- **Permission management** without manual tapping
- **Deep link navigation** to specific screens
- **Status bar override** for clean screenshots
- **Log analysis** for crash detection

## Common Scenarios

**Visual Verification**:
```bash
/axiom:test-simulator
```
"Take a screenshot to verify the login button fix"

**Location Testing**:
```bash
/axiom:test-simulator
```
"Set location to San Francisco and test the map feature"

**Push Notifications**:
```bash
/axiom:test-simulator
```
"Send a test push notification and screenshot the result"

**Permission Flows**:
```bash
/axiom:test-simulator
```
"Test the camera permission dialog"

## Prefer Natural Language?

Instead of using this command, you can simply say:
- "Can you take a screenshot of the app?"
- "Test my app with location simulation"
- "Check if the push notification handling works"
- "Navigate to Settings and take a screenshot"
- "Record a video of the app running"

The simulator-tester agent will automatically trigger.

## Quick Screenshot

For just a quick screenshot without full testing, use:
```bash
/axiom:screenshot
```
