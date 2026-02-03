---
name: axiom-ui-recording
description: Use when setting up UI test recording in Xcode 26, enhancing recorded tests for stability, or configuring test plans for multi-configuration replay. Based on WWDC 2025-344 "Record, replay, and review".
license: MIT
metadata:
  version: "1.0.0"
---

# Recording UI Automation (Xcode 26+)

Guide to Xcode 26's Recording UI Automation feature for creating UI tests through user interaction recording.

## The Three-Phase Workflow

From WWDC 2025-344:

```
┌─────────────────────────────────────────────────────────────┐
│                   UI Automation Workflow                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. RECORD ──────► Interact with app in Simulator           │
│                    Xcode captures as Swift test code        │
│                                                             │
│  2. REPLAY ──────► Run across devices, languages, configs   │
│                    Using test plans for multi-config        │
│                                                             │
│  3. REVIEW ──────► Watch video recordings in test report    │
│                    Analyze failures with screenshots        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Recording

### Starting a Recording

1. Open your UI test file in Xcode
2. Place cursor inside a test method
3. **Debug → Record UI Automation** (or use the record button)
4. App launches in Simulator
5. Perform interactions - Xcode generates code
6. Stop recording when done

### What Gets Recorded

- **Taps** on buttons, cells, controls
- **Text input** into text fields
- **Swipes** and scrolling
- **Gestures** (pinch, rotate)
- **Hardware button presses** (Home, volume)

### Generated Code Example

```swift
// Xcode generates this from your interactions
func testLoginFlow() {
    let app = XCUIApplication()
    app.launch()

    // Recorded: Tap email field, type email
    app.textFields["Email"].tap()
    app.textFields["Email"].typeText("user@example.com")

    // Recorded: Tap password field, type password
    app.secureTextFields["Password"].tap()
    app.secureTextFields["Password"].typeText("password123")

    // Recorded: Tap login button
    app.buttons["Login"].tap()
}
```

## Enhancing Recorded Code

**Critical**: Recorded code is often fragile. Always enhance it for stability.

### 1. Add Accessibility Identifiers

Recorded code uses labels which break with localization:

```swift
// RECORDED (fragile - breaks with localization)
app.buttons["Login"].tap()

// ENHANCED (stable - uses identifier)
app.buttons["loginButton"].tap()
```

**Add identifiers in your app code:**

```swift
// SwiftUI
Button("Login") { ... }
    .accessibilityIdentifier("loginButton")

// UIKit
loginButton.accessibilityIdentifier = "loginButton"
```

### 2. Add waitForExistence

Recorded code assumes elements exist immediately:

```swift
// RECORDED (may fail if app is slow)
app.buttons["Login"].tap()

// ENHANCED (waits for element)
let loginButton = app.buttons["loginButton"]
XCTAssertTrue(loginButton.waitForExistence(timeout: 5))
loginButton.tap()
```

### 3. Add Assertions

Recorded code just performs actions without verification:

```swift
// RECORDED (no verification)
app.buttons["Login"].tap()

// ENHANCED (with assertion)
app.buttons["loginButton"].tap()
let welcomeLabel = app.staticTexts["welcomeLabel"]
XCTAssertTrue(welcomeLabel.waitForExistence(timeout: 10),
              "Welcome screen should appear after login")
```

### 4. Use Shorter Queries

Recorded code may have overly specific queries:

```swift
// RECORDED (too specific)
app.tables.cells.element(boundBy: 0).buttons["Action"].tap()

// ENHANCED (simpler)
app.buttons["actionButton"].tap()
```

## Query Selection Guidelines

From WWDC 2025-344:

| Scenario | Problem | Solution |
|----------|---------|----------|
| Localized strings | "Login" changes by language | Use accessibilityIdentifier |
| Deeply nested views | Long query chains break easily | Use shortest possible query |
| Dynamic content | Cell content changes | Use identifier or generic query |
| Multiple matches | Query returns many elements | Add unique identifier |

### Best Practices

1. **Prefer identifiers over labels**
2. **Use the shortest query that works**
3. **Avoid index-based queries** (`element(boundBy: 0)`)
4. **Add identifiers to dynamic content**

## Phase 2: Replay with Test Plans

Test plans allow running the same tests across multiple configurations.

### Creating a Test Plan

1. **File → New → File → Test Plan**
2. Add test targets
3. Configure configurations

### Test Plan Structure

```json
{
  "configurations": [
    {
      "name": "iPhone - English",
      "options": {
        "targetForVariableExpansion": {
          "containerPath": "container:MyApp.xcodeproj",
          "identifier": "MyApp"
        },
        "language": "en",
        "region": "US"
      }
    },
    {
      "name": "iPhone - Spanish",
      "options": {
        "language": "es",
        "region": "ES"
      }
    },
    {
      "name": "iPhone - Dark Mode",
      "options": {
        "userInterfaceStyle": "dark"
      }
    },
    {
      "name": "iPad - Landscape",
      "options": {
        "defaultTestExecutionTimeAllowance": 120,
        "testTimeoutsEnabled": true
      }
    }
  ],
  "defaultOptions": {
    "targetForVariableExpansion": {
      "containerPath": "container:MyApp.xcodeproj",
      "identifier": "MyApp"
    }
  },
  "testTargets": [
    {
      "target": {
        "containerPath": "container:MyApp.xcodeproj",
        "identifier": "MyAppUITests",
        "name": "MyAppUITests"
      }
    }
  ],
  "version": 1
}
```

### Configuration Options

| Option | Purpose |
|--------|---------|
| `language` | Test localization |
| `region` | Test regional formatting |
| `userInterfaceStyle` | Test dark/light mode |
| `targetForVariableExpansion` | App target for configuration |
| `testTimeoutsEnabled` | Enable timeout enforcement |
| `defaultTestExecutionTimeAllowance` | Timeout in seconds |

### Running with Test Plan

```bash
# Command line
xcodebuild test \
  -scheme "MyApp" \
  -testPlan "MyTestPlan" \
  -destination "platform=iOS Simulator,name=iPhone 16" \
  -resultBundlePath /tmp/results.xcresult

# In Xcode
# Product → Test Plan → Select your plan
# Then Cmd+U to run tests
```

## Phase 3: Review

### Test Report Features

After tests complete:

1. **View test results** in Report Navigator
2. **Watch video recordings** of each test
3. **See screenshots** at failure points
4. **Analyze timeline** of actions

### Enabling Attachments

In test plan or scheme:

```json
"options": {
  "systemAttachmentLifetime": "keepAlways",
  "userAttachmentLifetime": "keepAlways"
}
```

### Capturing Custom Screenshots

```swift
func testCheckout() {
    // ... actions ...

    // Manual screenshot at specific point
    let screenshot = app.screenshot()
    let attachment = XCTAttachment(screenshot: screenshot)
    attachment.name = "Checkout Confirmation"
    attachment.lifetime = .keepAlways
    add(attachment)
}
```

## Common Patterns

### Login Flow Template

```swift
func testLoginWithValidCredentials() throws {
    let app = XCUIApplication()
    app.launch()

    // Navigate to login
    let showLoginButton = app.buttons["showLoginButton"]
    XCTAssertTrue(showLoginButton.waitForExistence(timeout: 5))
    showLoginButton.tap()

    // Enter credentials
    let emailField = app.textFields["emailTextField"]
    XCTAssertTrue(emailField.waitForExistence(timeout: 5))
    emailField.tap()
    emailField.typeText("test@example.com")

    let passwordField = app.secureTextFields["passwordTextField"]
    passwordField.tap()
    passwordField.typeText("password123")

    // Submit
    app.buttons["loginButton"].tap()

    // Verify success
    let welcomeScreen = app.staticTexts["welcomeLabel"]
    XCTAssertTrue(welcomeScreen.waitForExistence(timeout: 10))
}
```

### Navigation Flow Template

```swift
func testNavigateToSettings() throws {
    let app = XCUIApplication()
    app.launch()

    // Open tab bar item
    app.tabBars.buttons["Settings"].tap()

    // Verify navigation
    let settingsTitle = app.navigationBars["Settings"]
    XCTAssertTrue(settingsTitle.waitForExistence(timeout: 5))

    // Navigate deeper
    app.tables.cells["Account"].tap()
    XCTAssertTrue(app.navigationBars["Account"].exists)
}
```

### Form Validation Template

```swift
func testFormValidation() throws {
    let app = XCUIApplication()
    app.launch()

    // Submit empty form
    app.buttons["submitButton"].tap()

    // Verify error appears
    let errorAlert = app.alerts["Error"]
    XCTAssertTrue(errorAlert.waitForExistence(timeout: 5))
    XCTAssertTrue(errorAlert.staticTexts["Please fill all fields"].exists)

    // Dismiss alert
    errorAlert.buttons["OK"].tap()
}
```

## Troubleshooting

### Recording Doesn't Start

1. Ensure you're in a test method
2. Check simulator is available
3. Verify app builds and runs
4. Try restarting Xcode

### Recorded Code Doesn't Work

1. **Add waitForExistence** before interactions
2. **Check accessibility identifiers** are set
3. **Simplify queries** to shortest form
4. **Run app manually** to verify flow works

### Tests Pass Locally, Fail in CI

1. **Increase timeouts** for slower CI machines
2. **Add explicit waits** for animations
3. **Check simulator configuration** matches
4. **Disable animations** in test setup:
   ```swift
   app.launchArguments = ["--disable-animations"]
   ```

## Anti-Patterns

### Don't Use Raw Recorded Code in CI

```swift
// BAD - Raw recorded code
app.buttons["Login"].tap()
app.textFields["Email"].typeText("user@example.com")

// GOOD - Enhanced for CI
let loginButton = app.buttons["loginButton"]
XCTAssertTrue(loginButton.waitForExistence(timeout: 10))
loginButton.tap()
```

### Don't Hardcode Coordinates

```swift
// BAD - Coordinates from recording
app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()

// GOOD - Use element queries
app.buttons["centerButton"].tap()
```

### Don't Skip Assertions

```swift
// BAD - Actions only
app.buttons["Login"].tap()
sleep(2)  // Hope it works

// GOOD - Verify outcomes
app.buttons["loginButton"].tap()
XCTAssertTrue(app.staticTexts["Welcome"].waitForExistence(timeout: 10))
```

## Resources

**WWDC**: 2025-344, 2024-10206, 2019-413

**Docs**: /xcode/testing/recording-ui-tests, /xctest/xcuiapplication

**Skills**: axiom-xctest-automation, axiom-ui-testing
