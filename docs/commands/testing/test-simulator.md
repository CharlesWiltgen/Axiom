# /axiom:test-simulator

Launch simulator testing agent for automated test scenarios and visual verification.

## What It Does

Launches the **simulator-tester** agent for comprehensive simulator testing with:
- Screenshot and video capture
- Location simulation
- Push notification testing
- Permission management
- Deep link navigation
- Log analysis

## Usage

```bash
/axiom:test-simulator
```

Then describe what you want to test:
- "Take a screenshot to verify the login button fix"
- "Set location to San Francisco and test the map feature"
- "Send a test push notification and screenshot the result"
- "Navigate to Settings and take a screenshot"

## Capabilities

### Screenshot Capture
Visual verification and debugging with Claude's multimodal analysis.

### Video Recording
Record complex workflows (background process with proper cleanup).

### Location Simulation
Test GPS-based features with specific coordinates or GPX files.

### Push Notification Testing
Send test push notifications without a server.

### Permission Management
Grant/revoke permissions without manual tapping.

### Deep Link Navigation
Navigate to specific screens programmatically.

### Status Bar Override
Clean screenshots for documentation/App Store.

### Log Analysis
Monitor console for crashes and errors.

## Common Scenarios

### Visual Verification

```bash
/axiom:test-simulator
```

"Take a screenshot to verify the login button fix"

**Agent automatically**:
1. Boots simulator if needed
2. Navigates to login screen (if deep link available)
3. Captures screenshot
4. Analyzes: "The login button appears centered..."

---

### Location Testing

```bash
/axiom:test-simulator
```

"Set location to San Francisco and test the map feature"

**Agent automatically**:
1. Sets location: `37.7749, -122.4194`
2. Grants location permission
3. Launches app
4. Screenshots map view
5. Verifies location marker

---

### Push Notifications

```bash
/axiom:test-simulator
```

"Send a test push notification and screenshot the result"

**Agent automatically**:
1. Creates test payload JSON
2. Sends push notification
3. Waits for notification
4. Captures screenshot
5. Checks logs for handling

---

### Permission Flows

```bash
/axiom:test-simulator
```

"Test the camera permission dialog"

**Agent automatically**:
1. Resets permissions
2. Launches app
3. Screenshots permission dialog
4. Grants permission
5. Screenshots granted state

---

## Prefer Natural Language?

Instead of using this command, you can simply say:
- "Can you take a screenshot of the app?"
- "Test my app with location simulation"
- "Check if the push notification handling works"
- "Navigate to Settings and take a screenshot"
- "Record a video of the app running"

The simulator-tester agent will automatically trigger.

## Quick Screenshot

For just a quick screenshot without full testing capabilities:

```bash
/axiom:screenshot
```

## Prerequisites

- Xcode with iOS Simulator installed
- App built for simulator
- Optionally: Deep links for navigation (see `deep-link-debugging` skill)

## Related

- **`/axiom:screenshot`** — Quick screenshot only
- **`simulator-tester` agent** — Full documentation
- **`deep-link-debugging` skill** — Add debug-only deep links
- **`xcode-debugging` skill** — Environment-first debugging
- **`swiftui-debugging` skill** — SwiftUI debugging with simulator verification

## Real-World Impact

**Before**: Manual navigation + visual check = 2-3 minutes per iteration
**After**: Automated navigation + screenshot + Claude verification = 45 seconds

**Key insight**: Closed-loop debugging with 60-75% faster iteration.
