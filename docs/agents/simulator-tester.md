# simulator-tester

Automated simulator testing with visual verification for closed-loop debugging.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you test my app with location simulation?"
- "Take a screenshot to verify this fix"
- "Check if the push notification handling works"
- "Navigate to Settings and take a screenshot"
- "Record a video of the app running"
- "Test my app's permission dialogs"

**Explicit command:**
```bash
/axiom:test-simulator
```

## What It Does

### Testing Capabilities
1. **Screenshot capture** — Visual verification and debugging
2. **Video recording** — Capture complex workflows
3. **Location simulation** — Test GPS-based features
4. **Push notifications** — Test notification handling without a server
5. **Permission management** — Grant/revoke permissions programmatically
6. **Deep link navigation** — Navigate to specific screens
7. **App lifecycle** — Launch, terminate, install apps
8. **Status bar override** — Clean screenshots for documentation
9. **Log analysis** — Monitor console for crashes/errors

### Test Scenarios Fixed
- Visual verification → Screenshot capture + Claude analysis
- Location testing → Set coordinates + grant permission
- Push notifications → Send test payload + capture result
- Permission flows → Reset + grant + verify state
- Crash reproduction → Navigate + log capture + analysis

## How It Works

**Core Principle**: The simulator is a verification mechanism for closed-loop debugging.

**Workflow**:
1. Check simulator state (boot if needed)
2. Set up test scenario (location, permissions, etc.)
3. Capture evidence (screenshots, video, logs)
4. Analyze results (Claude is multimodal!)
5. Report findings with clear pass/fail

**Time savings**: 60-75% faster iteration on visual bugs

## Example Usage

### Screenshot Verification

```bash
# User: "Take a screenshot to verify the login button fix"

# Agent automatically:
1. Checks if simulator is booted
2. Boots iPhone 16 Pro if needed
3. Navigates to login screen (if deep link available)
4. Waits for UI to render
5. Captures screenshot
6. Analyzes image: "The login button appears centered and properly sized"
```

### Location Testing

```bash
# User: "Test my app with location set to San Francisco"

# Agent automatically:
1. Sets location: xcrun simctl location booted set 37.7749 -122.4194
2. Grants location permission: xcrun simctl privacy booted grant location-always <bundle-id>
3. Launches app
4. Takes screenshot of map view
5. Verifies location marker appears at SF coordinates
```

### Push Notification Testing

```bash
# User: "Send a test push notification and screenshot the result"

# Agent automatically:
1. Creates test payload JSON
2. Sends push: xcrun simctl push booted <bundle-id> payload.json
3. Waits for notification to appear
4. Captures screenshot showing notification
5. Checks logs for notification handling
```

## Key Features

### Visual Verification
- Claude can **read screenshots** (multimodal analysis)
- Before/after comparison for fixes
- UI state verification
- Error message capture

### Test Automation
- Programmatic navigation via deep links
- Automated test scenario setup
- Background process management
- Log capture and analysis

### Integration
- Works with `/axiom:screenshot` for quick captures
- Integrates with `deep-link-debugging` skill for navigation
- Referenced in enhanced debugging skills

## Common Scenarios

| Scenario | Capabilities Used |
|----------|------------------|
| Visual bug fix | Screenshot + navigation + analysis |
| Location feature | Location simulation + permissions |
| Push handling | Push notification + log capture |
| Permission dialog | Permission management + screenshot |
| Crash reproduction | App lifecycle + log capture |
| App Store screenshots | Status bar override + navigation |

## Requirements

- Xcode with iOS Simulator installed
- App built for simulator
- Optionally: Deep links for navigation (see `deep-link-debugging` skill)

## Related Tools

- **`/axiom:screenshot`** — Quick screenshot capture without full testing
- **`deep-link-debugging` skill** — Add debug-only deep links for navigation
- **`xcode-debugging` skill** — Environment-first debugging
- **`swiftui-debugging` skill** — SwiftUI-specific debugging with simulator verification
- **`memory-debugging` skill** — Memory leak detection with visual verification

## Real-World Impact

**Before**: Make fix → rebuild → manually navigate 5 screens → visually check → 3 minutes
**After**: Make fix → rebuild → agent navigates + screenshots → Claude verifies → 1 minute

**Key insight**: Automated visual verification enables closed-loop debugging.
